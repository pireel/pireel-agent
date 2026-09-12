#!/usr/bin/env node

/**
 * Keep the `preview` line identical to the source line except for its identity.
 *
 *   node scripts/sync-preview.mjs --from <ref>     copy skills/ + README from <ref>, apply the preview identity
 *   node scripts/sync-preview.mjs --verify <ref>   prove the working tree differs from <ref> ONLY by identity
 *
 * The preview branch exists so agents never confuse environments: it must announce itself as
 * "Pireel Studio Preview", register the `pireel-preview` MCP server and point every URL at
 * preview.pireel.com. Everything else in the skill tree must match the source line byte for byte.
 * Skill files are never edited on `preview` by hand — run `--from`, then release with
 * `release-channel.mjs preview --bump …`.
 *
 * Branch-owned files are NOT touched here: `.mcp.json`, `.codex-plugin/plugin.json`,
 * `.agents/plugins/marketplace.json` (identity + store copy) and `skills/pireel/VERSION` (release-owned).
 */

import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fromRef = valueAfter('--from');
const verifyRef = valueAfter('--verify');
const SKILLS = 'plugins/pireel/skills';
const README = 'README.md';
const VERSION_FILE = `${SKILLS}/pireel/VERSION`;
const SYNCED = [SKILLS, README];

function valueAfter(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}
function fail(message) {
  console.error(`[sync-preview] ${message}`);
  process.exit(1);
}
function git(...a) {
  return execFileSync('git', a, { cwd: root, encoding: 'utf8' });
}

if (!fromRef && !verifyRef) fail('Usage: node scripts/sync-preview.mjs --from <ref> | --verify <ref>');
if (fromRef && verifyRef) fail('--from and --verify are exclusive; run --from, then --verify');

// Never overlay the preview identity onto a production-configured checkout.
const mcp = JSON.parse(await readFile(join(root, 'plugins/pireel/.mcp.json'), 'utf8'));
const servers = Object.keys(mcp.mcpServers ?? {});
if (servers.length !== 1 || servers[0] !== 'pireel-preview') {
  fail(`this checkout registers MCP server "${servers.join(',')}", not pireel-preview — run this on the preview line only`);
}

/** production → preview. Each rule is anchored and idempotent (its output no longer matches its input). */
const FORWARD = [
  // Environment announcements the agent reads first.
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'Edit videos in Pireel Studio through the `pireel` MCP server', to: 'Edit videos in Pireel Studio Preview through the `pireel-preview` MCP server' },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'install/connect Pireel or edit', to: 'install/connect Pireel Preview or edit' },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: 'before the first Pireel MCP call', to: 'before the first Pireel Preview MCP call' },
  { file: `${SKILLS}/pireel/SKILL.md`, must: true, from: "the user's latest project", to: "the user's latest Preview project" },
  { file: `${SKILLS}/pireel/references/getting-started.md`, must: true, from: 'FIRST-RUN setup for Pireel Studio.', to: 'FIRST-RUN setup for Pireel Studio Preview.' },
  { file: README, must: true, from: 'or another compatible AI agent to\n[Pireel Studio](https://pireel.com).', to: 'or another compatible AI agent to the\nisolated [Pireel Studio Preview](https://preview.pireel.com) environment.' },
  { file: README, must: true, from: '--transport http pireel https://', to: '--transport http pireel-preview https://' },
  // Everywhere in the synced text. The MCP-server-name rule is skills-only: the README's install
  // instructions legitimately mention both servers on every branch and must not be rewritten.
  { re: /`pireel` MCP server/g, to: '`pireel-preview` MCP server', skillsOnly: true },
  { re: /Pireel Studio \(https:\/\//g, to: 'Pireel Studio Preview (https://' },
  { re: /(?<!preview\.)https:\/\/pireel\.com/g, to: 'https://preview.pireel.com' },
];
/** preview → production, the exact inverse, applied in reverse order for --verify. */
const REVERSE = [
  { re: /https:\/\/preview\.pireel\.com/g, to: 'https://pireel.com' },
  { re: /Pireel Studio Preview \(https:\/\//g, to: 'Pireel Studio (https://' },
  { re: /`pireel-preview` MCP server/g, to: '`pireel` MCP server', skillsOnly: true },
  { re: /--transport http pireel-preview https:\/\//g, to: '--transport http pireel https://' },
  { re: /or another compatible AI agent to the\nisolated \[Pireel Studio Preview\]\(https:\/\/pireel\.com\) environment\./g, to: 'or another compatible AI agent to\n[Pireel Studio](https://pireel.com).' },
  { re: /FIRST-RUN setup for Pireel Studio Preview\./g, to: 'FIRST-RUN setup for Pireel Studio.' },
  { re: /the user's latest Preview project/g, to: "the user's latest project" },
  { re: /before the first Pireel Preview MCP call/g, to: 'before the first Pireel MCP call' },
  { re: /install\/connect Pireel Preview or edit/g, to: 'install/connect Pireel or edit' },
  { re: /Edit videos in Pireel Studio Preview through the `pireel` MCP server/g, to: 'Edit videos in Pireel Studio through the `pireel` MCP server' },
];

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
async function syncedFiles() {
  const files = [join(root, README), ...(await listFiles(join(root, SKILLS)))];
  return files.map((f) => relative(root, f).split(sep).join('/')).filter((p) => p !== VERSION_FILE).sort();
}

if (fromRef) {
  const versionBefore = await readFile(join(root, VERSION_FILE), 'utf8');
  git('checkout', fromRef, '--', ...SYNCED);
  await writeFile(join(root, VERSION_FILE), versionBefore); // release-owned; the checkout must not move it
  let touched = 0;
  for (const rel of await syncedFiles()) {
    if (!isText(rel)) continue;
    const path = join(root, rel);
    const before = await readFile(path, 'utf8');
    let after = before;
    for (const rule of FORWARD) {
      if (rule.file && rule.file !== rel) continue;
      if (rule.skillsOnly && !rel.startsWith(`${SKILLS}/`)) continue;
      if (rule.re) { after = after.replace(rule.re, rule.to); continue; }
      if (after.includes(rule.from)) after = after.split(rule.from).join(rule.to);
      else if (rule.must && !after.includes(rule.to)) fail(`${rel}: anchor not found — "${rule.from.split('\n')[0]}". The source text changed; update the overlay rule before syncing.`);
    }
    if (after !== before) { await writeFile(path, after); touched += 1; }
  }
  console.log(`[sync-preview] synced ${SYNCED.join(' + ')} from ${fromRef}; identity applied to ${touched} file(s). Next: node scripts/release-channel.mjs preview --bump prerelease`);
}

if (verifyRef) {
  const refFiles = git('ls-tree', '-r', '--name-only', verifyRef, '--', ...SYNCED).trim().split('\n').filter(Boolean).filter((p) => p !== VERSION_FILE).sort();
  const here = await syncedFiles();
  const problems = [];
  for (const p of refFiles) if (!here.includes(p)) problems.push(`missing on preview: ${p}`);
  for (const p of here) if (!refFiles.includes(p)) problems.push(`extra on preview: ${p}`);
  for (const rel of here) {
    if (!refFiles.includes(rel)) continue;
    const source = execFileSync('git', ['show', `${verifyRef}:${rel}`], { cwd: root });
    const mine = await readFile(join(root, rel));
    if (!isText(rel)) { if (!source.equals(mine)) problems.push(`differs (binary): ${rel}`); continue; }
    let normalized = mine.toString('utf8');
    for (const rule of REVERSE) {
      if (rule.skillsOnly && !rel.startsWith(`${SKILLS}/`)) continue;
      normalized = normalized.replace(rule.re, rule.to);
    }
    if (normalized !== source.toString('utf8')) problems.push(`differs beyond identity: ${rel}`);
  }
  if (problems.length) { for (const p of problems) console.error(`[sync-preview] ${p}`); fail(`${problems.length} non-identity difference(s) vs ${verifyRef}`); }
  console.log(`[sync-preview] OK — ${here.length} synced files differ from ${verifyRef} only by the preview identity`);
}
