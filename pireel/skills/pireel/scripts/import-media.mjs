#!/usr/bin/env node
/**
 * Pireel local media import helper.
 *
 * Main video: LOCAL fast path — the bytes are served from a throwaway localhost HTTP
 * server and streamed straight into the open studio tab (register-local, over 127.0.0.1);
 * the video never touches the cloud. A studio tab MUST be open — if it isn't, this exits
 * asking the agent to open it (create_browser_handoff) and re-run. Only the small extracted
 * audio goes to R2 (transcription needs a public URL DashScope can fetch).
 * B-roll (--broll): still uploaded to the cloud (insert_clip fetches it later, maybe in
 * another session). Images (png/jpg/webp/gif): uploaded to the user's asset library and
 * return a reference URL usable in composed blocks (<img src>).
 * Metadata probing (ffprobe) + audio transcription (ffmpeg) are optional.
 *
 * Usage (normal flow — the agent gets `token` from the `import_media` MCP tool):
 *   node import-media.mjs --token imp1.… [--base https://pireel.com] \
 *        [--ffmpeg <path>] [--ffprobe <path>] [--no-transcribe] /path/to/video.mp4 /path/to/logo.png …
 *
 * B-roll mode (--broll): videos upload bytes only (no transcription, no project
 * registration) and print a `sig` — insert into the timeline with the insert_clip
 * MCP tool afterwards.
 *
 * Auth: --token (short-lived import token from the `import_media` MCP tool).
 * Never pass OAuth tokens here. All server interaction goes through ONE
 * endpoint: /api/studio/media.
 *
 * ffmpeg/ffprobe are OPTIONAL (flags → FFMPEG_PATH/FFPROBE_PATH env → PATH).
 * Without ffprobe: duration/dims unknown (browser completes them on open).
 * Without ffmpeg: no transcript. Nothing is lost — only deferred.
 *
 * Zero npm dependencies; requires Node >= 20 (fs.openAsBlob).
 */

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { openAsBlob, createReadStream } from 'node:fs';
import { stat, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--base', '--token', '--ffmpeg', '--ffprobe']);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.has(args[i - 1])));

// Authoritative data-path statement. Printed at startup and via --explain so the agent can
// verify where each asset goes BEFORE any transfer. Keep in sync with asset-import.md's matrix.
const TRANSFER_MATRIX = [
  'Main video:          local loopback → the OPEN Studio tab, NOT uploaded to the cloud',
  'Transcription audio: a small AAC is uploaded to the cloud (transcription needs a fetchable URL)',
  'B-roll (--broll):    uploaded to the cloud (insert_clip fetches it later)',
  'Images:              uploaded to the cloud asset library (or inlined as a data URI)',
  'Requires a Studio tab OPEN for the main video (bytes stream into it). No cloud fallback for it.',
];
if (has('explain')) {
  console.log(TRANSFER_MATRIX.join('\n'));
  process.exit(0);
}

const BASE = (opt('base') ?? process.env.PIREEL_BASE ?? 'https://pireel.com').replace(/\/$/, '');
const CRED = opt('token');
if (!CRED) fail('missing credential: pass --token <import token from the import_media MCP tool>');
if (!files.length) fail('no input files. usage: node import-media.mjs --token … /path/to/video.mp4');

const HEADERS = { Authorization: `Bearer ${CRED}`, 'content-type': 'application/json' };

function fail(msg) {
  console.error(`[pireel-import] ${msg}`);
  process.exit(1);
}

function resolveBin(name, flag, env) {
  const p = opt(flag) ?? process.env[env] ?? name;
  const r = spawnSync(p, ['-version'], { stdio: 'ignore' });
  return r.error ? null : p;
}

/** ffprobe: duration/width/height + audio start offset (audio start_time − min start_time). */
function probe(ffprobe, path) {
  const r = spawnSync(ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) return null;
  try {
    const j = JSON.parse(r.stdout);
    const v = (j.streams ?? []).find((s) => s.codec_type === 'video');
    const a = (j.streams ?? []).find((s) => s.codec_type === 'audio');
    const starts = (j.streams ?? []).map((s) => Number(s.start_time)).filter(Number.isFinite);
    const minStart = starts.length ? Math.min(...starts) : 0;
    const audioOffset = a && Number.isFinite(Number(a.start_time)) ? Math.max(0, Number(a.start_time) - minStart) : 0;
    return {
      durationSec: Number(j.format?.duration) || undefined,
      width: v ? Number(v.width) || undefined : undefined,
      height: v ? Number(v.height) || undefined : undefined,
      hasAudio: !!a,
      audioOffset: Math.abs(audioOffset) > 0.02 ? audioOffset : 0,
    };
  } catch {
    return null;
  }
}

async function media(body) {
  const r = await fetch(`${BASE}/api/studio/media`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j };
}

/**
 * Start a throwaway localhost HTTP server that serves ONE file to the open studio tab.
 * The main-video fast path streams bytes straight into the browser over 127.0.0.1 — no
 * cloud round-trip. Bound to loopback + random path token + torn down right after the tab
 * fetches it. CORS + Private-Network-Access headers let the HTTPS studio page reach it
 * (Chrome sends an OPTIONS preflight carrying Access-Control-Request-Private-Network).
 */
async function startLocalServer(path, contentType) {
  const st = await stat(path);
  const routePath = `/${Math.random().toString(36).slice(2)}`;
  const cors = {
    'Access-Control-Allow-Origin': BASE,
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    Vary: 'Origin',
  };
  // Every response carries a Content-Type: Codex's in-app browser (Chrome Use) blocks localhost
  // responses that lack one with ERR_BLOCKED_BY_CLIENT (see openai/codex#30687), including the
  // CORS/PNA preflight — so the OPTIONS and 404 replies set it too, not just the 200.
  const TEXT = 'text/plain; charset=utf-8';
  const server = createServer((req, res) => {
    if (req.method === 'OPTIONS') return void res.writeHead(204, { ...cors, 'Content-Type': TEXT }).end();
    if (req.method !== 'GET' || req.url !== routePath) return void res.writeHead(404, { ...cors, 'Content-Type': TEXT }).end('not found');
    res.writeHead(200, { ...cors, 'Content-Type': contentType, 'Content-Length': String(st.size), 'Cache-Control': 'no-store' });
    createReadStream(path).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}${routePath}`, close: () => new Promise((r) => server.close(r)) };
}

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** Image → user asset library. Returns a reference URL for composed blocks (<img src>)
 *  when the deployment has a public media base; otherwise url is null (inline small
 *  images as data URIs in block HTML instead — see the skill). */
async function importImage(path, bins) {
  const st = await stat(path);
  const mime = IMAGE_MIME[path.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[1] ?? ''];
  console.error(`[pireel-import] ${basename(path)} · image · ${(st.size / 1048576).toFixed(1)}MB`);
  const pre = await media({ action: 'put-image', size: st.size, content_type: mime });
  if (!pre.ok) fail(`image presign failed (HTTP ${pre.status}): ${JSON.stringify(pre.json)}`);
  const put = await fetch(pre.json.url, {
    method: 'PUT',
    headers: { 'Content-Type': mime, 'Cache-Control': pre.json.cache_control ?? 'public, max-age=2592000, immutable' },
    body: await openAsBlob(path, { type: mime }),
    duplex: 'half',
  });
  if (!put.ok) fail(`image upload failed: HTTP ${put.status}`);
  const meta = bins.ffprobe ? probe(bins.ffprobe, path) : null; // ffprobe reads image dims too
  const reg = await media({
    action: 'register-image',
    key: pre.json.key,
    label: basename(path),
    ...(meta?.width ? { width: meta.width } : {}),
    ...(meta?.height ? { height: meta.height } : {}),
  });
  if (!reg.ok || !reg.json.ok) fail(`image register failed: ${reg.json.error ?? `HTTP ${reg.status}`}`);
  if (reg.json.url) console.error('[pireel-import] image in asset library · stable public url');
  else console.error('[pireel-import] image stored, but no public media base — inline it as a data URI in block HTML instead');
  return { file: basename(path), kind: 'image', key: reg.json.key, url: reg.json.url, url_kind: reg.json.url_kind };
}

/** Extract audio → upload the small audio to R2 → server-side transcription (ASR needs a
 *  public URL DashScope can fetch; only the tiny audio goes to the cloud, never the video).
 *  Returns offset-corrected sentence segments (empty on any failure — transcript is optional). */
async function transcribe(path, meta, bins) {
  if (!bins.ffmpeg || !(meta?.hasAudio ?? true) || has('no-transcribe')) return [];
  const tmp = join(tmpdir(), `pireel-audio-${Date.now()}.m4a`);
  const r = spawnSync(bins.ffmpeg, ['-y', '-v', 'quiet', '-i', path, '-vn', '-acodec', 'aac', '-b:a', '64k', tmp], { stdio: 'ignore' });
  if (r.status !== 0) {
    console.error('[pireel-import] audio extraction failed — importing without transcript');
    return [];
  }
  try {
    console.error('[pireel-import] transcribing…');
    const audio = await readFile(tmp);
    const preA = await media({ action: 'put-audio', size: audio.byteLength });
    if (!preA.ok || !preA.json.url) return [];
    const putA = await fetch(preA.json.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mp4', 'Cache-Control': 'public, max-age=2592000, immutable' },
      body: audio,
    });
    if (!putA.ok) return [];
    const asr = await media({ action: 'asr', audio_key: preA.json.key });
    const off = meta?.audioOffset ?? 0;
    const segs = (asr.json.segments ?? [])
      .filter((s) => s.text?.trim())
      .map((s) => ({ start: Math.max(0, s.start + off), end: Math.max(s.start + off + 0.1, s.end + off), text: s.text.trim() }));
    console.error(`[pireel-import] transcript: ${segs.length} sentences`);
    return segs;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function importOne(path, bins) {
  const st = await stat(path);
  // Content signature, same shape as the browser's fingerprint: one file → one object
  const sig = `${basename(path)}:${st.size}:${Math.round(st.mtimeMs)}`;
  console.error(`[pireel-import] ${basename(path)} · ${(st.size / 1048576).toFixed(1)}MB · sig=${sig}`);
  const contentType = /\.mov$/i.test(path) ? 'video/quicktime' : /\.webm$/i.test(path) ? 'video/webm' : 'video/mp4';
  const meta = bins.ffprobe ? probe(bins.ffprobe, path) : null;
  if (!meta) console.error('[pireel-import] ffprobe unavailable — duration/dims unknown (browser will complete them on open)');

  // --broll: bytes only, still via the cloud (insert_clip fetches them from R2 later, possibly
  // in a different session). No transcription, no project registration.
  if (has('broll')) {
    const pre = await media({ action: 'put', sig, size: st.size, content_type: contentType });
    if (!pre.ok) fail(`presign failed (HTTP ${pre.status}): ${JSON.stringify(pre.json)}`);
    if (pre.json.already) console.error('[pireel-import] bytes already in cloud (dedup hit), skipping upload');
    else {
      console.error('[pireel-import] uploading b-roll…');
      const put = await fetch(pre.json.url, {
        method: 'PUT',
        headers: { 'Content-Type': pre.json.content_type ?? contentType, 'Cache-Control': 'public, max-age=2592000, immutable' },
        body: await openAsBlob(path, { type: contentType }),
        duplex: 'half',
      });
      if (!put.ok) fail(`upload failed: HTTP ${put.status}`);
    }
    console.error('[pireel-import] b-roll upload done — insert with the insert_clip MCP tool');
    return { file: basename(path), kind: 'broll', sig, ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}), next: 'call insert_clip {sig, atSec?} (needs the studio tab open)' };
  }

  // Main video: LOCAL fast path — no cloud upload. Serve the file from a throwaway localhost
  // server; register-local pushes it straight into the open tab (bytes stream over 127.0.0.1).
  // The small audio still goes to R2 for transcription (DashScope needs a public URL).
  const server = await startLocalServer(path, contentType);
  try {
    const transcript = await transcribe(path, meta, bins);
    console.error('[pireel-import] handing the video to the open studio tab…');
    const reg = await media({
      action: 'register-local',
      sig,
      local_url: server.url,
      filename: basename(path),
      ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}),
      ...(meta?.width ? { width: meta.width } : {}),
      ...(meta?.height ? { height: meta.height } : {}),
      ...(transcript.length ? { transcript_segments: transcript } : {}),
    });
    if (!reg.ok || !reg.json.ok) {
      if (reg.json.error === 'studio_not_open') {
        fail(
          'the studio tab is not open. The video streams straight into the studio over your machine (no cloud), so a tab has to be open. ' +
            'Open it (call create_browser_handoff and open the url with your own browser, or ask the user to open the project), then re-run this import.',
        );
      }
      fail(`register failed: ${reg.json.error ?? `HTTP ${reg.status}`}`);
    }
    return { file: basename(path), sig, ...reg.json.data, transcript: transcript.length, probed: !!meta, delivery: 'local' };
  } finally {
    await server.close();
  }
}

const bins = { ffprobe: resolveBin('ffprobe', 'ffprobe', 'FFPROBE_PATH'), ffmpeg: resolveBin('ffmpeg', 'ffmpeg', 'FFMPEG_PATH') };
if (!bins.ffmpeg || !bins.ffprobe) {
  console.error('[pireel-import] ffmpeg/ffprobe not fully available — degraded import (see skill: install them for metadata + transcript)');
}
console.error('[pireel-import] data paths:\n' + TRANSFER_MATRIX.map((l) => `  ${l}`).join('\n'));
const out = [];
for (const f of files) out.push(/\.(png|jpe?g|webp|gif)$/i.test(f) ? await importImage(f, bins) : await importOne(f, bins));
console.log(JSON.stringify({ imports: out }, null, 2));
