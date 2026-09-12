#!/usr/bin/env node

/**
 * One release version per channel.
 *
 *   node scripts/release-channel.mjs <production|preview> --version X.Y.Z   release an explicit version
 *   node scripts/release-channel.mjs <production|preview> --bump <kind>     release the next version
 *                                     kind: patch | minor | major (preview restarts at -preview.1)
 *                                           prerelease (preview only: -preview.N → -preview.N+1)
 *   node scripts/release-channel.mjs <production|preview> --check           validate (CI)
 *   node scripts/release-channel.mjs <production|preview> --digest          print the skill digest
 *
 * Releasing through a pull request: run the release on the source branch with
 * PIREEL_RELEASE_BRANCH=<channel branch> (e.g. main), commit, open the PR — the guard sees the
 * moved version and passes; merging is the release.
 *
 * `release/channels.json` is the only editable source. A release writes the same SemVer into the
 * Plugin manifest (`.codex-plugin/plugin.json`, what the host orders upgrades by) and the bundled
 * Skill `VERSION` (what the MCP server announces and the agent compares for equality), and records
 * `skillDigest` — a content hash of the skill tree — so `--check` can tell when skill files were
 * edited without a release. The digest is a drift check only; it is never announced to clients.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const channelsPath = join(root, 'release/channels.json');
const args = process.argv.slice(2);
const channelName = args.find((arg) => !arg.startsWith('--'));
const checkOnly = args.includes('--check');
const digestOnly = args.includes('--digest');

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message) {
  throw new Error(message);
}

function assertSemver(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value)) {
    fail(`${label} must be strict SemVer`);
  }
}

/** SemVer precedence comparison (build metadata ignored). Returns -1, 0, or 1. Both inputs must
 *  already be valid SemVer (assertSemver). Mirrors the rule a host uses to decide upgrade order. */
function compareSemver(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v);
    return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] < pb.nums[i] ? -1 : 1;
  }
  // A release (no prerelease) outranks the same core version with a prerelease suffix.
  if (pa.pre.length === 0 || pb.pre.length === 0) {
    if (pa.pre.length === pb.pre.length) return 0;
    return pa.pre.length === 0 ? 1 : -1;
  }
  const shared = Math.min(pa.pre.length, pb.pre.length);
  for (let i = 0; i < shared; i += 1) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === y) continue;
    const xNum = /^\d+$/.test(x);
    const yNum = /^\d+$/.test(y);
    if (xNum && yNum) return Number(x) < Number(y) ? -1 : 1;
    if (xNum) return -1; // numeric identifiers rank lower than alphanumeric
    if (yNum) return 1;
    return x < y ? -1 : 1;
  }
  if (pa.pre.length === pb.pre.length) return 0;
  return pa.pre.length < pb.pre.length ? -1 : 1;
}

/** Next version for --bump. Production lines are plain X.Y.Z; preview lines are X.Y.Z-preview.N.
 *  patch/minor/major move the core (a preview line restarts at -preview.1); prerelease (preview
 *  only) advances N. Anything else, or a current value outside those shapes, needs --version. */
function bumpVersion(current, kind, channel) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(current);
  if (!m) fail(`Cannot --bump from ${current}: expected X.Y.Z or X.Y.Z-preview.N (use --version)`);
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const pre = m[4] === undefined ? null : Number(m[4]);
  if (kind === 'prerelease') {
    if (channel !== 'preview') fail('--bump prerelease only applies to the preview channel');
    return `${major}.${minor}.${patch}-preview.${pre === null ? 1 : pre + 1}`;
  }
  if (kind === 'patch') patch += 1;
  else if (kind === 'minor') { minor += 1; patch = 0; }
  else if (kind === 'major') { major += 1; minor = 0; patch = 0; }
  else fail(`--bump must be patch, minor, major or prerelease, got ${kind ?? '(nothing)'}`);
  const core = `${major}.${minor}.${patch}`;
  return channel === 'preview' ? `${core}-preview.1` : core;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Content hash of the skill tree: every file under skills/ except the VERSION marker itself,
 *  sorted by POSIX-relative path, fed as `path\0bytes\0`. Same input tree ⇒ same digest on any OS. */
async function skillDigest(skillsDir, versionPath) {
  const files = (await listFiles(skillsDir))
    .filter((file) => file !== versionPath)
    .map((file) => ({ file, rel: relative(skillsDir, file).split(sep).join('/') }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const hash = createHash('sha256');
  for (const { file, rel } of files) {
    hash.update(rel);
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

if (channelName !== 'production' && channelName !== 'preview') {
  fail('Usage: node scripts/release-channel.mjs <production|preview> [--check | --digest | --version X.Y.Z | --bump patch|minor|major|prerelease]');
}
for (const legacy of ['--plugin-version', '--workflow-version']) {
  if (args.includes(legacy)) fail(`${legacy} is gone: one release version now covers the Plugin manifest and the Skill baseline. Use --version X.Y.Z.`);
}

const channels = await readJson(channelsPath);
const channel = channels[channelName];
if (!channel) fail(`Missing release channel: ${channelName}`);

const pluginRoot = join(root, channel.pluginRoot);
const pluginPath = join(pluginRoot, '.codex-plugin/plugin.json');
const mcpPath = join(pluginRoot, '.mcp.json');
const skillsDir = join(pluginRoot, 'skills');
const versionPath = join(skillsDir, 'pireel/VERSION');
const marketplacePath = join(root, '.agents/plugins/marketplace.json');

const computedDigest = await skillDigest(skillsDir, versionPath);
if (digestOnly) {
  console.log(computedDigest);
  process.exit(0);
}

const requestedVersion = valueAfter('--version');
const bumpKind = args.includes('--bump') ? valueAfter('--bump') : undefined;
if (requestedVersion && args.includes('--bump')) fail('--version and --bump are mutually exclusive');
if (checkOnly && (requestedVersion || args.includes('--bump'))) fail('--check cannot be combined with --version or --bump');
if (!checkOnly && !requestedVersion && !args.includes('--bump')) {
  fail('A release needs --version X.Y.Z or --bump <patch|minor|major|prerelease> (or pass --check / --digest)');
}

if (!checkOnly) {
  const nextVersion = requestedVersion ?? bumpVersion(channel.version, bumpKind, channelName);
  assertSemver(nextVersion, requestedVersion ? '--version' : '--bump result');
  // A host installs by SemVer precedence and never downgrades, so a version that is not strictly
  // greater than this channel's current one silently "fails to update". Compare within the same
  // channel only — production and preview are independent marketplaces with separate version lines.
  if (compareSemver(nextVersion, channel.version) <= 0) {
    fail(`${nextVersion} must be greater than ${channelName}'s current ${channel.version}; a host only upgrades forward within a channel`);
  }
  if (!requestedVersion) console.log(`--bump ${bumpKind}: ${channel.version} -> ${nextVersion}`);
  channel.version = nextVersion;
  channel.skillDigest = computedDigest;
}

assertSemver(channel.version, `${channelName}.version`);
if (channelName === 'preview' && !channel.version.includes('-preview.')) {
  fail('Preview versions must use a -preview.N prerelease');
}
if (channelName === 'production' && channel.version.includes('-')) {
  fail('Production versions must be stable SemVer without a prerelease suffix');
}

// With the override set (CI, PR-based releases, detached checkouts) git is not consulted at all.
const releaseBranch = process.env.PIREEL_RELEASE_BRANCH
  || execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (releaseBranch !== channel.branch) {
  fail(`Channel ${channelName} must be released from branch ${channel.branch}, not ${releaseBranch || 'detached HEAD'}`);
}

// Channel identity is validated BEFORE anything is written, so releasing the wrong channel from a
// tree (e.g. preview from a production-configured checkout) fails cleanly with no half-written files.
const [pluginBefore, mcp, marketplace] = await Promise.all([readJson(pluginPath), readJson(mcpPath), readJson(marketplacePath)]);
const servers = Object.entries(mcp.mcpServers ?? {});
if (pluginBefore.name !== 'pireel') fail(`Plugin name must remain pireel, got ${pluginBefore.name}`);
if (marketplace.name !== channel.marketplace) fail(`Marketplace has ${marketplace.name}; channel declares ${channel.marketplace}`);
if (servers.length !== 1 || servers[0][0] !== channel.mcpServer) {
  fail(`Expected exactly one MCP server named ${channel.mcpServer}`);
}
for (const field of ['url', 'oauth_resource']) {
  const expected = `${channel.baseUrl}/api/studio/mcp`;
  if (servers[0][1]?.[field] !== expected) fail(`MCP ${field} must be ${expected}`);
}
if (pluginBefore.interface?.websiteURL !== channel.baseUrl) {
  fail(`Plugin websiteURL must be ${channel.baseUrl}`);
}

if (!checkOnly) {
  await Promise.all([
    writeJson(channelsPath, channels),
    writeJson(pluginPath, { ...pluginBefore, version: channel.version }),
    writeFile(versionPath, `${channel.version}\n`),
  ]);
}

// Version and digest are verified against what is on disk now (after a release: what was written).
const [plugin, installedVersion] = await Promise.all([
  readJson(pluginPath),
  readFile(versionPath, 'utf8').then((value) => value.trim()),
]);
if (plugin.version !== channel.version) fail(`plugin.json has ${plugin.version}; channel declares ${channel.version}`);
if (installedVersion !== channel.version) fail(`VERSION has ${installedVersion}; channel declares ${channel.version}`);
if (channel.skillDigest !== computedDigest) {
  fail(`skills/ changed since the last ${channelName} release (digest ${computedDigest}, manifest ${channel.skillDigest}). Run a release with a new --version.`);
}

console.log(`${channelName}: ${channel.version} (${channel.mcpServer}) skills ${channel.skillDigest.slice(0, 19)}…`);
