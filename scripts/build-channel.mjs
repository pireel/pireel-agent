#!/usr/bin/env node

/**
 * Build the published plugin tree for one channel, from the authored source.
 *
 *   node scripts/build-channel.mjs <production|preview>            write the built files
 *   node scripts/build-channel.mjs <production|preview> --check    fail if the tree is not the build output
 *
 * Everything that identifies a channel or carries a version is GENERATED here, so nothing can
 * drift and nothing is hand-maintained twice:
 *
 *   authored (develop)                      generated (main / preview)
 *   ─────────────────────────────────────   ──────────────────────────────────────────────
 *   package.json  ← the only version        plugins/<name>/.codex-plugin/plugin.json   (Codex)
 *   release/channels.json ← identities      plugins/<name>/.mcp.json
 *   plugins/<name>/skills, assets           plugins/<name>/skills/pireel/VERSION
 *   plugins/<name>/.codex-plugin/           plugins/<name>-claude/…                    (Claude Code)
 *     plugin.json (no version, no URLs)     .agents/plugins/marketplace.json           (Codex)
 *                                           .claude-plugin/marketplace.json            (Claude Code)
 *                                           skill text rewritten for the channel
 *
 * The two hosts need different manifest shapes for the same plugin — Codex reads
 * `.codex-plugin/plugin.json` with `mcpServers` pointing at `./.mcp.json`, Claude Code reads
 * `.claude-plugin/plugin.json` with the server inlined and no Agent Plugins `interface` block —
 * so both are produced from the one authored manifest.
 *
 * Releasing is: bump `version` in package.json on the source branch, then open a PR to the
 * channel branch whose diff is this build output. `--check` is what CI runs on that branch.
 *
 * A published branch also records `release/built-from.json` — which source commit it was built
 * from. That is provenance, not content (so `--check` ignores it), and it is what makes promoting
 * exact: `main` can be built from `develop`, or from the very commit `preview` was built from, so
 * what shipped to preview is what ships to production. Pass `--source <ref> --sha <sha>` to record it.
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const FLAGS_WITH_VALUES = ['--source', '--sha'];
const channelName = args.find((a, i) => !a.startsWith('--') && !FLAGS_WITH_VALUES.includes(args[i - 1]));
const checkOnly = args.includes('--check');
function valueAfter(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message) {
  console.error(`[build-channel] ${message}`);
  process.exit(1);
}
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const stringify = (v) => `${JSON.stringify(v, null, 2)}\n`;

const manifest = await readJson('release/channels.json');
const channel = manifest.channels?.[channelName];
if (!channel) fail(`Usage: node scripts/build-channel.mjs <${Object.keys(manifest.channels ?? {}).join('|')}> [--check]`);

const pkg = await readJson('package.json');
const version = pkg.version;
if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
  fail(`package.json version must be plain SemVer X.Y.Z, got ${JSON.stringify(version)}`);
}

/* The README documents every channel's install commands literally, so the channel rewrite leaves it
 * alone and the identity guard skips it. That makes a renamed plugin id silently wrong in the one
 * string a user actually types: of `<id>@<marketplace>`, only the marketplace half is distinctive,
 * so nothing else would notice. Check every channel, not just the one being built. */
const readme = await readFile(join(root, 'README.md'), 'utf8');
for (const [name, entry] of Object.entries(manifest.channels ?? {})) {
  if (!entry?.marketplace || !entry.pluginName) continue;
  const wrong = [...readme.matchAll(new RegExp(`([A-Za-z0-9_-]+)@${entry.marketplace}(?![\\w-])`, 'g'))]
    .find((hit) => hit[1] !== entry.pluginName);
  if (wrong) fail(`README.md installs ${wrong[0]}, but the ${name} channel publishes ${entry.pluginName}@${entry.marketplace}`);
}

/* The id the host registers this plugin under. Channels are installed side by side, so their ids
 * must differ: a host that keys plugin identity by name keeps one and drops the other, and the
 * session then talks to whichever environment survived. Production keeps the bare name so installs
 * already out there are untouched. */
const NAME = channel.pluginName;
if (!NAME) fail(`channels.${channelName} has no pluginName`);
const AUTHORED = manifest.authoredRoot;
const CODEX = `plugins/${NAME}`;
const CLAUDE = `plugins/${NAME}-claude`;
const SKILLS = `${CODEX}/skills`;
const ENDPOINT = `${channel.baseUrl}/api/studio/mcp`;

/* The authored tree is written under the production id; a channel that renames it moves the tree
 * first so every path below — prose, generated files, the Claude copy — addresses one location.
 * Re-running on a built tree finds the move already done. */
if (!checkOnly && CODEX !== AUTHORED && existsSync(join(root, AUTHORED))) {
  await cp(join(root, AUTHORED), join(root, CODEX), { recursive: true });
  await rm(join(root, AUTHORED), { recursive: true, force: true });
}
if (!existsSync(join(root, CODEX))) {
  fail(`${CODEX} is missing. This tree is not the ${channelName} build of its source; rebuild with: node scripts/build-channel.mjs ${channelName}`);
}

/* ── channel identity inside authored prose ──────────────────────────────────────────────────
 * The authored text is written for production. Each rule is anchored; a missing anchor means the
 * source wording moved and the rule must be updated rather than the output hand-patched. */
const PROSE = channel.baseUrl === 'https://pireel.com' ? [] : [
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'Edit videos in Pireel Studio through the `pireel` MCP server', to: `Edit videos in ${channel.displayName} through the \`${channel.mcpServer}\` MCP server` },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'install/connect Pireel or edit', to: 'install/connect Pireel Preview or edit' },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'before the first Pireel MCP call', to: 'before the first Pireel Preview MCP call' },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: "the user's latest project", to: "the user's latest Preview project" },
  { file: `${SKILLS}/pireel/references/getting-started.md`, must: true, from: 'FIRST-RUN setup for Pireel Studio.', to: `FIRST-RUN setup for ${channel.displayName}.` },
  { file: 'README.md', must: true, from: 'or another compatible AI agent to\n[Pireel Studio](https://pireel.com).', to: `or another compatible AI agent to the\nisolated [${channel.displayName}](${channel.baseUrl}) environment.` },
  { re: /`pireel` MCP server/g, to: `\`${channel.mcpServer}\` MCP server`, skillsOnly: true },
  /* Every place the server name is an identifier the reader types or registers, rather than the
   * product's name in prose. channel-guard.yml searches for exactly these forms in the other
   * direction, so a rule missing here fails CI rather than shipping a login into the wrong
   * environment. The lookahead keeps `pireel` from matching inside `pireel-preview`. */
  { re: /mcp login pireel(?![\w-])/g, to: `mcp login ${channel.mcpServer}` },
  { re: /\[mcp_servers\.pireel\]/g, to: `[mcp_servers.${channel.mcpServer}]` },
  { re: /--transport http pireel(?![\w-])/g, to: `--transport http ${channel.mcpServer}` },
  { re: /Pireel Studio \(https:\/\//g, to: `${channel.displayName} (https://` },
  { re: /(?<!preview\.)https:\/\/pireel\.com/g, to: channel.baseUrl },
];
/** Docs that describe every channel at once; copied verbatim, never rewritten. */
const VERBATIM = new Set(['RELEASING.md']);
const isText = (p) => /\.(md|mjs|js|json|txt)$/.test(p);

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

/* ── the build ───────────────────────────────────────────────────────────────────────────── */

/** Read the manifest as authored: strip everything this script stamps, so building an already
 *  built tree reproduces it exactly. A version written here by hand is overwritten, never read —
 *  package.json stays the only source of the number. */
const GENERATED_KEYS = ['name', 'version', 'description', 'homepage', 'mcpServers', 'skills'];
const GENERATED_INTERFACE_KEYS = ['displayName', 'shortDescription', 'longDescription', 'websiteURL', 'privacyPolicyURL', 'termsOfServiceURL'];
const rawPlugin = await readJson(`${CODEX}/.codex-plugin/plugin.json`);
const authoredPlugin = Object.fromEntries(Object.entries(rawPlugin).filter(([k]) => !GENERATED_KEYS.includes(k)));
if (rawPlugin.interface) {
  authoredPlugin.interface = Object.fromEntries(Object.entries(rawPlugin.interface).filter(([k]) => !GENERATED_INTERFACE_KEYS.includes(k)));
}

/** Two axes the server reads off every request: how Pireel was installed, and into which host.
 *  A plugin install has a host that owns updates, so the server skips the workflow-baseline
 *  reminder for it; a manual MCP registration sends no headers and still gets it. They also make
 *  distribution × host countable without any client-side reporting. */
const originHeaders = (host) => ({ 'x-pireel-distribution': 'plugin', 'x-pireel-host': host });

/** Codex manifest: authored fields + the channel's identity + the version. */
const codexPlugin = {
  name: NAME,
  ...authoredPlugin,
  version,
  description: channel.description,
  homepage: channel.baseUrl,
  mcpServers: './.mcp.json',
  skills: './skills/',
  interface: {
    ...authoredPlugin.interface,
    displayName: channel.displayName,
    shortDescription: channel.shortDescription,
    longDescription: channel.longDescription,
    websiteURL: channel.baseUrl,
    privacyPolicyURL: `${channel.baseUrl}/en/privacy`,
    termsOfServiceURL: `${channel.baseUrl}/en/terms`,
  },
};
/** Claude Code manifest: same plugin, inlined server, no Agent Plugins `interface`. */
const { interface: _codexOnly, mcpServers: _external, ...shared } = codexPlugin;
const claudePlugin = {
  ...shared,
  keywords: (authoredPlugin.keywords ?? []).map((k) => (k === 'codex' ? 'claude-code' : k)),
  mcpServers: { [channel.mcpServer]: { type: 'http', url: ENDPOINT, headers: originHeaders('claude-code') } },
  skills: './skills/',
};

const generated = new Map([
  [`${CODEX}/.mcp.json`, stringify({ mcpServers: { [channel.mcpServer]: { url: ENDPOINT, headers: originHeaders('codex') } } })],
  [`${CODEX}/.codex-plugin/plugin.json`, stringify(codexPlugin)],
  [`${SKILLS}/pireel/VERSION`, `${version}\n`],
  [`${CLAUDE}/.claude-plugin/plugin.json`, stringify(claudePlugin)],
  ['.agents/plugins/marketplace.json', stringify({
    name: channel.marketplace,
    interface: { displayName: channel.marketplaceDisplayName },
    plugins: [{
      name: NAME,
      source: { source: 'local', path: `./${CODEX}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Design',
    }],
  })],
  ['.claude-plugin/marketplace.json', stringify({
    name: channel.marketplace,
    owner: { name: authoredPlugin.author?.name ?? 'Pireel', url: channel.baseUrl },
    metadata: { description: `${channel.displayName} for Claude Code` },
    plugins: [{
      name: NAME,
      source: `./${CLAUDE}`,
      description: channel.description,
      category: 'productivity',
      homepage: channel.baseUrl,
      author: { ...authoredPlugin.author, url: channel.baseUrl },
      license: authoredPlugin.license,
      keywords: claudePlugin.keywords,
    }],
  })],
]);

/** Authored text with this channel's identity applied. */
async function renderProse() {
  const files = [join(root, 'README.md'), ...(await listFiles(join(root, SKILLS)))]
    .map((f) => relative(root, f).split(sep).join('/'))
    .filter((p) => p !== `${SKILLS}/pireel/VERSION`);
  const out = new Map();
  for (const rel of files) {
    if (!isText(rel) || VERBATIM.has(rel)) continue;
    const before = await readFile(join(root, rel), 'utf8');
    let after = before;
    for (const rule of PROSE) {
      if (rule.file && rule.file !== rel) continue;
      if (rule.skillsOnly && !rel.startsWith(`${SKILLS}/`)) continue;
      if (rule.re) { after = after.replace(rule.re, rule.to); continue; }
      if (after.includes(rule.from)) after = after.split(rule.from).join(rule.to);
      else if (rule.must && !after.includes(rule.to)) fail(`${rel}: anchor not found — "${rule.from.split('\n')[0]}". The authored wording moved; update the rule in this script.`);
    }
    if (after !== before) out.set(rel, after);
  }
  return out;
}
const prose = await renderProse();

if (checkOnly) {
  const problems = [];
  // Match the write path's cleanup: a channel publishes exactly its two bundles.
  // Checking expected files alone would silently accept an extra installable plugin.
  for (const entry of await readdir(join(root, 'plugins'))) {
    const path = `plugins/${entry}`;
    if (path !== CODEX && path !== CLAUDE) problems.push(`unexpected: ${path}`);
  }
  for (const [rel, want] of [...generated, ...prose]) {
    const have = await readFile(join(root, rel), 'utf8').catch(() => null);
    if (have === null) problems.push(`missing: ${rel}`);
    else if (have !== want) problems.push(`not the build output: ${rel}`);
  }
  // The Claude tree ships the same skills and assets, byte for byte.
  for (const sub of ['skills', 'assets']) {
    const from = (await listFiles(join(root, CODEX, sub))).map((f) => relative(join(root, CODEX, sub), f).split(sep).join('/')).sort();
    const to = await listFiles(join(root, CLAUDE, sub)).then((l) => l.map((f) => relative(join(root, CLAUDE, sub), f).split(sep).join('/')).sort()).catch(() => null);
    if (to === null) { problems.push(`missing: ${CLAUDE}/${sub}`); continue; }
    if (from.join('\n') !== to.join('\n')) { problems.push(`${CLAUDE}/${sub} has a different file set`); continue; }
    for (const rel of from) {
      const a = await readFile(join(root, CODEX, sub, rel));
      const b = await readFile(join(root, CLAUDE, sub, rel));
      if (!a.equals(b)) problems.push(`${CLAUDE}/${sub}/${rel} differs from the Codex tree`);
    }
  }
  if (problems.length) {
    for (const p of problems) console.error(`[build-channel] ${p}`);
    fail(`${problems.length} problem(s) — this branch is not the ${channelName} build of its source. Rebuild with: node scripts/build-channel.mjs ${channelName}`);
  }
  console.log(`[build-channel] OK — ${channelName} ${version} (${channel.mcpServer} → ${channel.baseUrl})`);
} else {
  for (const [rel, content] of [...prose, ...generated]) {
    await mkdir(dirname(join(root, rel)), { recursive: true });
    await writeFile(join(root, rel), content);
  }
  // Provenance: which source commit this branch was built from. Lets a later build reproduce the
  // exact content that was validated on another channel, instead of guessing a ref.
  const sourceRef = valueAfter('--source');
  const sourceSha = valueAfter('--sha');
  if (sourceRef || sourceSha) {
    await writeFile(join(root, 'release/built-from.json'), stringify({
      channel: channelName,
      version,
      source: sourceRef ?? null,
      sha: sourceSha ?? null,
      builtAt: new Date().toISOString(),
    }));
  }
  await rm(join(root, CLAUDE), { recursive: true, force: true });
  await mkdir(join(root, `${CLAUDE}/.claude-plugin`), { recursive: true });
  await cp(join(root, CODEX, 'skills'), join(root, CLAUDE, 'skills'), { recursive: true });
  await cp(join(root, CODEX, 'assets'), join(root, CLAUDE, 'assets'), { recursive: true });
  await writeFile(join(root, `${CLAUDE}/.claude-plugin/plugin.json`), generated.get(`${CLAUDE}/.claude-plugin/plugin.json`));
  // A channel publishes exactly two bundles. Anything else under plugins/ is a leftover from a
  // build under a different id, and a host would happily install it.
  for (const e of await readdir(join(root, 'plugins'))) {
    if (`plugins/${e}` !== CODEX && `plugins/${e}` !== CLAUDE) await rm(join(root, 'plugins', e), { recursive: true, force: true });
  }
  console.log(`[build-channel] built ${channelName} ${version} (${channel.mcpServer} → ${channel.baseUrl})`);
}
