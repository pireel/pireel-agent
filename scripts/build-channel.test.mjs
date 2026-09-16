import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function run(root, ...args) {
  const result = spawnSync(process.execPath, ['scripts/build-channel.mjs', ...args], { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

for (const channel of ['production']) {
  test(`${channel}: check rejects leftover bundles and files without deleting them`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'pireel-build-channel-'));
    try {
      await cp(source, root, { recursive: true, filter: (path) => !/(?:^|[/\\])(?:\.git|node_modules)(?:[/\\]|$)/.test(path) });
      let result = run(root, channel);
      assert.equal(result.status, 0, result.output);
      result = run(root, channel, '--check');
      assert.equal(result.status, 0, result.output);
      const name = 'pireel';
      const extra = 'pireel-preview';
      await cp(join(root, 'plugins', name), join(root, 'plugins', extra), { recursive: true });
      await writeFile(join(root, 'plugins', 'leftover.txt'), 'not a published bundle');
      result = run(root, channel, '--check');
      assert.notEqual(result.status, 0, result.output);
      assert.match(result.output, new RegExp(`unexpected: plugins/${extra}`));
      assert.match(result.output, /unexpected: plugins\/leftover\.txt/);
      // A check is read-only: running it again must still report the unwanted content.
      assert.notEqual(run(root, channel, '--check').status, 0);
      result = run(root, channel);
      assert.equal(result.status, 0, result.output);
      result = run(root, channel, '--check');
      assert.equal(result.status, 0, result.output);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('local: builds an unpublished channel into --out with its own id and leaves the source untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pireel-build-channel-'));
  try {
    await cp(source, root, { recursive: true, filter: (path) => !/(?:^|[/\\])(?:\.git|node_modules|\.local)(?:[/\\]|$)/.test(path) });
    assert.notEqual(run(root, 'local').status, 0, 'a never-published channel must not overwrite the source tree');
    const result = run(root, 'local', '--out', '.local', '--base-url', 'http://localhost:4010');
    assert.equal(result.status, 0, result.output);
    const { readFile: read } = await import('node:fs/promises');
    const plugin = JSON.parse(await read(join(root, '.local/plugins/pireel-local/.codex-plugin/plugin.json'), 'utf8'));
    assert.equal(plugin.name, 'pireel-local');
    const mcp = JSON.parse(await read(join(root, '.local/plugins/pireel-local/.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers['pireel-local'].url, 'http://localhost:4010/api/studio/mcp');
    const skill = await read(join(root, '.local/plugins/pireel-local/skills/pireel/SKILL.md'), 'utf8');
    assert.match(skill, /`pireel-local` MCP server/);
    assert.doesNotMatch(skill, /Pireel Preview/);
    // the authored tree is what it was
    assert.equal(run(root, 'production', '--check').status !== 0, true);
    assert.ok((await read(join(root, 'plugins/pireel/.codex-plugin/plugin.json'), 'utf8')).length > 0);
    // --check rebuilds the same identity, so it needs the same origin
    assert.notEqual(run(root, 'local', '--out', '.local', '--check').status, 0);
    assert.equal(run(root, 'local', '--out', '.local', '--base-url', 'http://localhost:4010', '--check').status, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preview: is never published and builds out of tree under its own id', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pireel-build-channel-'));
  try {
    await cp(source, root, { recursive: true, filter: (path) => !/(?:^|[/\\])(?:\.git|node_modules|\.local)(?:[/\\]|$)/.test(path) });
    assert.notEqual(run(root, 'preview').status, 0);
    const result = run(root, 'preview', '--out', '.local/preview');
    assert.equal(result.status, 0, result.output);
    const { readFile: read } = await import('node:fs/promises');
    const mcp = JSON.parse(await read(join(root, '.local/preview/plugins/pireel-preview/.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers['pireel-preview'].url, 'https://preview.pireel.com/api/studio/mcp');
    const skill = await read(join(root, '.local/preview/plugins/pireel-preview/skills/pireel/SKILL.md'), 'utf8');
    assert.match(skill, /`pireel-preview` MCP server/);
    assert.match(skill, /Pireel Preview/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
