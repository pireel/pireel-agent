#!/usr/bin/env node
/**
 * Pireel local media import helper — uploads local source files into the user's
 * Pireel cloud storage. Videos are content-addressed (dedup-idempotent) and
 * registered on a project, with optional metadata probing (ffprobe) and audio
 * transcription (ffmpeg) so transcript-based offline editing works immediately.
 * Images (png/jpg/webp/gif) go into the user's asset library and return a
 * reference URL usable in composed blocks (<img src>).
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
import { openAsBlob } from 'node:fs';
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

async function importOne(path, bins) {
  const st = await stat(path);
  // Content signature, same shape as the browser's fingerprint: one file → one cloud object
  const sig = `${basename(path)}:${st.size}:${Math.round(st.mtimeMs)}`;
  console.error(`[pireel-import] ${basename(path)} · ${(st.size / 1048576).toFixed(1)}MB · sig=${sig}`);

  // 1) Presigned direct upload (content-addressed; re-imports dedup server-side)
  const contentType = /\.mov$/i.test(path) ? 'video/quicktime' : /\.webm$/i.test(path) ? 'video/webm' : 'video/mp4';
  const pre = await media({ action: 'put', sig, size: st.size, content_type: contentType });
  if (!pre.ok) fail(`presign failed (HTTP ${pre.status}): ${JSON.stringify(pre.json)}`);
  if (pre.json.already) console.error('[pireel-import] bytes already in cloud (dedup hit), skipping upload');
  else {
    console.error('[pireel-import] uploading…');
    const put = await fetch(pre.json.url, {
      method: 'PUT',
      headers: { 'Content-Type': pre.json.content_type ?? contentType, 'Cache-Control': 'public, max-age=2592000, immutable' },
      body: await openAsBlob(path, { type: contentType }),
      duplex: 'half',
    });
    if (!put.ok) fail(`upload failed: HTTP ${put.status}`);
  }

  // 2) Probe metadata (optional)
  const meta = bins.ffprobe ? probe(bins.ffprobe, path) : null;
  if (!meta) console.error('[pireel-import] ffprobe unavailable — duration/dims unknown (browser will complete them on open)');

  // --broll: bytes only — no transcription, no project registration. The agent inserts
  // it into the timeline afterwards with the insert_clip MCP tool (pass this sig).
  if (has('broll')) {
    console.error('[pireel-import] b-roll upload done — insert with the insert_clip MCP tool');
    return { file: basename(path), kind: 'broll', sig, ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}), next: 'call insert_clip {sig, atSec?} (needs the studio tab open)' };
  }

  // 3) Extract audio → upload → server-side transcription (optional; timestamps offset-corrected)
  let transcript = [];
  if (bins.ffmpeg && (meta?.hasAudio ?? true) && !has('no-transcribe')) {
    const tmp = join(tmpdir(), `pireel-audio-${Date.now()}.m4a`);
    const r = spawnSync(bins.ffmpeg, ['-y', '-v', 'quiet', '-i', path, '-vn', '-acodec', 'aac', '-b:a', '64k', tmp], { stdio: 'ignore' });
    if (r.status === 0) {
      try {
        console.error('[pireel-import] transcribing…');
        const audio = await readFile(tmp);
        const preA = await media({ action: 'put-audio', size: audio.byteLength });
        if (preA.ok && preA.json.url) {
          const putA = await fetch(preA.json.url, {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/mp4', 'Cache-Control': 'public, max-age=2592000, immutable' },
            body: audio,
          });
          if (putA.ok) {
            const asr = await media({ action: 'asr', audio_key: preA.json.key });
            const off = meta?.audioOffset ?? 0;
            transcript = (asr.json.segments ?? [])
              .filter((s) => s.text?.trim())
              .map((s) => ({ start: Math.max(0, s.start + off), end: Math.max(s.start + off + 0.1, s.end + off), text: s.text.trim() }));
            console.error(`[pireel-import] transcript: ${transcript.length} sentences`);
          }
        }
      } finally {
        await unlink(tmp).catch(() => {});
      }
    } else console.error('[pireel-import] audio extraction failed — importing without transcript');
  }

  // 4) Register on a project (projects with existing footage are never clobbered)
  const reg = await media({
    action: 'register',
    sig,
    filename: basename(path),
    ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}),
    ...(meta?.width ? { width: meta.width } : {}),
    ...(meta?.height ? { height: meta.height } : {}),
    ...(transcript.length ? { transcript_segments: transcript } : {}),
  });
  if (!reg.ok || !reg.json.ok) fail(`register failed: ${reg.json.error ?? `HTTP ${reg.status}`}`);
  return { file: basename(path), sig, ...reg.json.data, transcript: transcript.length, probed: !!meta };
}

const bins = { ffprobe: resolveBin('ffprobe', 'ffprobe', 'FFPROBE_PATH'), ffmpeg: resolveBin('ffmpeg', 'ffmpeg', 'FFMPEG_PATH') };
if (!bins.ffmpeg || !bins.ffprobe) {
  console.error('[pireel-import] ffmpeg/ffprobe not fully available — degraded import (see skill: install them for metadata + transcript)');
}
const out = [];
for (const f of files) out.push(/\.(png|jpe?g|webp|gif)$/i.test(f) ? await importImage(f, bins) : await importOne(f, bins));
console.log(JSON.stringify({ imports: out }, null, 2));
