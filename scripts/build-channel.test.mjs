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

for (const channel of ['production', 'preview']) {
  test(`${channel}: check rejects leftover bundles and files without deleting them`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'pireel-build-channel-'));
    try {
      await cp(source, root, { recursive: true, filter: (path) => !/(?:^|[/\\])(?:\.git|node_modules)(?:[/\\]|$)/.test(path) });
      let result = run(root, channel);
      assert.equal(result.status, 0, result.output);
      result = run(root, channel, '--check');
      assert.equal(result.status, 0, result.output);
      const name = channel === 'preview' ? 'pireel-preview' : 'pireel';
      const extra = channel === 'preview' ? 'pireel' : 'pireel-preview';
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
