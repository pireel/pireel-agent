#!/usr/bin/env node
/**
 * Build one never-published channel out of tree and zip its Claude bundle into a `.plugin` archive:
 *
 *   node scripts/pack-channel.mjs <local|preview> [--base-url <origin>]
 *
 * Output: .local/<channel>/ (the full channel build) and .local/<plugin id>.plugin (the archive a
 * host such as Cowork installs from). Codex and Claude Code can also add .local/<channel> as a
 * local marketplace directory. The authored tree is never touched.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const channelName = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--base-url');
const manifest = JSON.parse(await readFile(join(root, 'release/channels.json'), 'utf8'));
const channel = manifest.channels?.[channelName];
if (!channel) { console.error(`Usage: node scripts/pack-channel.mjs <${Object.keys(manifest.channels).join('|')}> [--base-url <origin>]`); process.exit(1); }
if (channel.branch) { console.error(`${channelName} is a published channel; release it through the release workflow instead of packing it.`); process.exit(1); }

const outDir = join('.local', channelName);
const build = spawnSync(process.execPath, ['scripts/build-channel.mjs', channelName, '--out', outDir, ...args.filter((a, i) => a === '--base-url' || args[i - 1] === '--base-url')], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const bundle = join(root, outDir, 'plugins', `${channel.pluginName}-claude`);
if (!existsSync(join(bundle, '.claude-plugin/plugin.json'))) { console.error(`[pack-channel] ${bundle} has no .claude-plugin/plugin.json`); process.exit(1); }
const archive = join(root, '.local', `${channel.pluginName}.plugin`);
await rm(archive, { force: true });
const zip = spawnSync('zip', ['-qr', archive, '.', '-x', '.DS_Store'], { cwd: bundle, stdio: 'inherit' });
if (zip.status !== 0) process.exit(zip.status ?? 1);
console.log(`[pack-channel] ${channelName}: ${outDir}/ (marketplace directory) and ${join('.local', `${channel.pluginName}.plugin`)} (archive)`);
