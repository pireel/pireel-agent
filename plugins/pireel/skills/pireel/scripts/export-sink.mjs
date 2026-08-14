#!/usr/bin/env node
/**
 * Pireel local export receiver (sink).
 *
 * The studio export renders client-side and normally lands via the BROWSER's download.
 * Agent-driven browsers (headless/embedded) often DISCARD page downloads — the render
 * succeeds but the file evaporates. This sink is the reliable delivery path for that
 * case: it opens a one-shot loopback HTTP receiver, you pass its URL to the
 * `export_video` MCP tool as `sink_url`, and the studio tab PUTs the finished bytes
 * here instead. Everything stays on this machine — no cloud upload.
 *
 * Usage:
 *   node export-sink.mjs [--out <dir>] [--base <studio origin>] [--timeout-min <N>]
 *
 * Prints one JSON line with {sink_url} immediately (read it, then call export_video),
 * then BLOCKS until the file arrives (or the timeout). On success prints
 * {saved, bytes, filename} and exits 0. Run it in the background or a second shell —
 * it must be alive when the export finishes.
 *
 * No auth token needed: the sink never talks to the Pireel API. The random URL path is
 * the capability (loopback-only, single file, expires with the process).
 *
 * Zero npm dependencies; requires Node >= 18.
 */

import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--out', '--base', '--timeout-min']);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && VALUE_FLAGS.has(`--${name}`) ? args[i + 1] : fallback;
};

const OUT_DIR = resolve(opt('out') ?? process.cwd());
const BASE = (opt('base') ?? process.env.PIREEL_BASE ?? 'https://pireel.com').replace(/\/$/, '');
const TIMEOUT_MS = Math.max(1, Number(opt('timeout-min') ?? 30)) * 60_000;
const MAX_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB — far above any real export

await mkdir(OUT_DIR, { recursive: true });

const routePath = `/${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
// Same CORS/PNA posture as the import helper's local server: the HTTPS studio page
// fetching a loopback URL triggers Chrome's Private-Network-Access preflight, and some
// embedded browsers (Codex Chrome Use) block loopback responses lacking a Content-Type.
const cors = {
  'Access-Control-Allow-Origin': BASE,
  'Access-Control-Allow-Private-Network': 'true',
  'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  Vary: 'Origin',
};
const TEXT = 'text/plain; charset=utf-8';

/** Filename from the tab's x-pireel-filename header (URI-encoded); basename()d and
 *  character-restricted — a compromised page must not choose the write path. */
function safeName(req) {
  let name = '';
  try {
    name = decodeURIComponent(req.headers['x-pireel-filename'] ?? '');
  } catch {
    /* malformed encoding → fall back below */
  }
  name = basename(name).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 120);
  return name || `pireel-export-${Date.now()}.mp4`;
}

let done = false;
const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') return void res.writeHead(204, { ...cors, 'Content-Type': TEXT }).end();
  if ((req.method !== 'PUT' && req.method !== 'POST') || req.url !== routePath) {
    return void res.writeHead(404, { ...cors, 'Content-Type': TEXT }).end('not found');
  }
  if (done) return void res.writeHead(409, { ...cors, 'Content-Type': TEXT }).end('already received');
  done = true;

  const name = safeName(req);
  const tmp = join(tmpdir(), `pireel-sink-${Date.now()}.part`);
  const out = createWriteStream(tmp);
  let bytes = 0;
  const abort = (code, msg) => {
    out.destroy();
    res.writeHead(code, { ...cors, 'Content-Type': TEXT }).end(msg);
    console.error(`[pireel-sink] ${msg}`);
    process.exit(1);
  };
  req.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) abort(413, 'file too large');
  });
  req.on('error', () => abort(400, 'upload interrupted'));
  req.pipe(out);
  out.on('error', (e) => abort(500, `write failed: ${e.message}`));
  out.on('finish', async () => {
    try {
      let dest = join(OUT_DIR, name);
      // Never clobber an existing file: de-dup with a numeric suffix, browser-style.
      for (let i = 1; await stat(dest).then(() => true).catch(() => false); i++) {
        dest = join(OUT_DIR, name.replace(/(\.[^.]+)?$/, ` (${i})$1`));
      }
      await rename(tmp, dest);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, saved: dest }));
      console.log(JSON.stringify({ saved: dest, bytes, filename: name }));
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    } catch (e) {
      abort(500, `save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
});

await new Promise((resolveListen, reject) => {
  server.on('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const { port } = server.address();
console.log(JSON.stringify({ sink_url: `http://127.0.0.1:${port}${routePath}`, out_dir: OUT_DIR, timeout_min: TIMEOUT_MS / 60_000 }));
console.error(`[pireel-sink] waiting for the export (pass sink_url to the export_video MCP tool; ${TIMEOUT_MS / 60_000} min timeout)…`);

// The listening server holds the event loop open; this is the only other exit path.
setTimeout(() => {
  console.error('[pireel-sink] timed out — no export arrived. Start a fresh sink and re-run export_video with the new sink_url.');
  process.exit(1);
}, TIMEOUT_MS);
