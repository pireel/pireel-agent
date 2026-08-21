#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const channelsPath = join(root, 'release/channels.json');
const args = process.argv.slice(2);
const channelName = args.find((arg) => !arg.startsWith('--'));
const checkOnly = args.includes('--check');

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message) {
  throw new Error(message);
}

function assertToken(value, label) {
  if (typeof value !== 'string' || !/^\S{1,64}$/.test(value)) {
    fail(`${label} must be one non-empty token of at most 64 characters`);
  }
}

function assertSemver(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value)) {
    fail(`${label} must be strict SemVer`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

if (channelName !== 'production' && channelName !== 'preview') {
  fail('Usage: node scripts/release-channel.mjs <production|preview> [--check] [--plugin-version X.Y.Z] [--workflow-version TOKEN]');
}

const channels = await readJson(channelsPath);
const channel = channels[channelName];
if (!channel) fail(`Missing release channel: ${channelName}`);

const requestedPluginVersion = valueAfter('--plugin-version');
const requestedWorkflowVersion = valueAfter('--workflow-version');
if (checkOnly && (requestedPluginVersion || requestedWorkflowVersion)) {
  fail('--check cannot be combined with version updates');
}

if (!checkOnly) {
  if (!requestedPluginVersion && !requestedWorkflowVersion) {
    fail('A release update needs --plugin-version, --workflow-version, or both');
  }
  if (requestedPluginVersion) {
    assertSemver(requestedPluginVersion, '--plugin-version');
    channel.pluginVersion = requestedPluginVersion;
  }
  if (requestedWorkflowVersion) {
    assertToken(requestedWorkflowVersion, '--workflow-version');
    channel.workflowVersion = requestedWorkflowVersion;
  }
}

assertSemver(channel.pluginVersion, `${channelName}.pluginVersion`);
assertToken(channel.workflowVersion, `${channelName}.workflowVersion`);
if (channelName === 'preview' && !channel.pluginVersion.includes('-preview.')) {
  fail('Preview Plugin versions must use a -preview.N prerelease');
}
if (channelName === 'production' && channel.pluginVersion.includes('-')) {
  fail('Production Plugin versions must be stable SemVer without a prerelease suffix');
}

const gitBranch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
const releaseBranch = process.env.PIREEL_RELEASE_BRANCH || gitBranch;
if (releaseBranch !== channel.branch) {
  fail(`Channel ${channelName} must be released from branch ${channel.branch}, not ${releaseBranch || 'detached HEAD'}`);
}

const pluginRoot = join(root, channel.pluginRoot);
const pluginPath = join(pluginRoot, '.codex-plugin/plugin.json');
const mcpPath = join(pluginRoot, '.mcp.json');
const versionPath = join(pluginRoot, 'skills/pireel/VERSION');
const marketplacePath = join(root, '.agents/plugins/marketplace.json');

if (!checkOnly) {
  const plugin = await readJson(pluginPath);
  plugin.version = channel.pluginVersion;
  await Promise.all([
    writeJson(channelsPath, channels),
    writeJson(pluginPath, plugin),
    writeFile(versionPath, `${channel.workflowVersion}\n`),
  ]);
}

const [plugin, mcp, marketplace, installedWorkflowVersion] = await Promise.all([
  readJson(pluginPath),
  readJson(mcpPath),
  readJson(marketplacePath),
  readFile(versionPath, 'utf8').then((value) => value.trim()),
]);
const servers = Object.entries(mcp.mcpServers ?? {});

if (plugin.name !== 'pireel') fail(`Plugin name must remain pireel, got ${plugin.name}`);
if (plugin.version !== channel.pluginVersion) fail(`plugin.json has ${plugin.version}; channel declares ${channel.pluginVersion}`);
if (installedWorkflowVersion !== channel.workflowVersion) fail(`VERSION has ${installedWorkflowVersion}; channel declares ${channel.workflowVersion}`);
if (marketplace.name !== channel.marketplace) fail(`Marketplace has ${marketplace.name}; channel declares ${channel.marketplace}`);
if (servers.length !== 1 || servers[0][0] !== channel.mcpServer) {
  fail(`Expected exactly one MCP server named ${channel.mcpServer}`);
}
for (const field of ['url', 'oauth_resource']) {
  const expected = `${channel.baseUrl}/api/studio/mcp`;
  if (servers[0][1]?.[field] !== expected) fail(`MCP ${field} must be ${expected}`);
}
if (plugin.interface?.websiteURL !== channel.baseUrl) {
  fail(`Plugin websiteURL must be ${channel.baseUrl}`);
}

console.log(`${channelName}: plugin ${channel.pluginVersion}, workflow ${channel.workflowVersion} (${channel.mcpServer})`);
