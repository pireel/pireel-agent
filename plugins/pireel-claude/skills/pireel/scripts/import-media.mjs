#!/usr/bin/env node
/**
 * Pireel local media import helper.
 *
 * Every file goes to the user's content-addressed cloud media store through ONE endpoint
 * (/api/studio/media): fingerprint → `put` (instant when the bytes already exist) → streamed
 * PUT to the presigned URL → registration. The main video is registered as the project's
 * narrative source (`register`, with a transcript when ffmpeg is available); B-roll (--broll),
 * images and audio are registered as project library assets (`register-asset`) that
 * `add_clips` / `insert_clips` place by assetId. No studio tab has to be open: the open tab
 * (if any) picks the new assets up from the project sync.
 *
 * Usage (normal flow — the agent gets `token` from the `import_media` MCP tool):
 *   node import-media.mjs --token imp1.… [--base https://pireel.com] \
 *        [--ffmpeg <path>] [--ffprobe <path>] [--no-transcribe] /path/to/video.mp4 /path/to/logo.png …
 *
 * B-roll mode (--broll): videos are uploaded and registered as library assets (no transcription,
 * not the narrative source).
 *
 * Auth: --token (short-lived import token from the `import_media` MCP tool). Never pass OAuth
 * tokens here.
 *
 * ffmpeg/ffprobe are OPTIONAL (flags → FFMPEG_PATH/FFPROBE_PATH env → PATH).
 * Without ffprobe: duration/dims unknown (the browser completes them on open).
 * Without ffmpeg: no transcript. Nothing is lost — only deferred.
 *
 * Zero npm dependencies; requires Node >= 20.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { open, stat, readFile, unlink } from 'node:fs/promises';
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
  "Main video:          uploaded to the user's Pireel cloud media store (content-addressed; duplicates are instant)",
  'Transcription audio: a small AAC is uploaded for transcription (only when ffmpeg is available and --no-transcribe is absent)',
  'B-roll (--broll):    uploaded to the cloud media store, registered as a project library asset',
  'Images:              uploaded to the cloud media store, registered as a project library asset',
  'Audio:               uploaded to the cloud media store, registered as a project library asset',
  'No studio tab needs to be open; the project picks the assets up on its next sync.',
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
 * Content fingerprint — byte-for-byte the browser's `durableFileSig`: `pireel2:<sha256[0..16] hex>:<size>`
 * over `${size}\n` + five 64KB slices (head / ¼ / ½ / ¾ / tail), or the whole file when it is small.
 * Filename, mtime and MIME are NOT part of the identity, so the same bytes are one object however
 * and wherever they enter.
 */
async function contentSig(path) {
  const { size } = await stat(path);
  const chunk = 64 * 1024;
  const hash = createHash('sha256');
  hash.update(`${size}\n`);
  const fh = await open(path, 'r');
  try {
    if (size <= chunk * 5) {
      hash.update(await readFile(path));
    } else {
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const offset = Math.max(0, Math.min(size - chunk, Math.floor(size * fraction) - (fraction === 1 ? chunk : Math.floor(chunk / 2))));
        const buffer = Buffer.alloc(Math.min(chunk, size - offset));
        const { bytesRead } = await fh.read(buffer, 0, buffer.length, offset);
        hash.update(buffer.subarray(0, bytesRead));
      }
    }
  } finally {
    await fh.close();
  }
  return `pireel2:${hash.digest('hex').slice(0, 32)}:${size}`;
}

/** Upload one file to the content-addressed store. Instant when the bytes already exist. */
async function upload(path, sig, contentType) {
  const { size } = await stat(path);
  const pre = await media({ action: 'put', sig, size, content_type: contentType });
  if (!pre.ok) {
    if (pre.status === 401) fail(`upload rejected (${pre.json.error ?? 'unauthenticated'}): ${pre.json.hint ?? 're-call import_media for a fresh token'}`);
    fail(`upload prepare failed: ${pre.json.error ?? `HTTP ${pre.status}`}${pre.json.max_bytes ? ` (max ${pre.json.max_bytes} bytes)` : ''}`);
  }
  if (pre.json.already) {
    console.error('[pireel-import] already in the cloud store · instant');
    return { key: pre.json.key, uploaded: false };
  }
  console.error(`[pireel-import] uploading ${(size / 1048576).toFixed(1)}MB…`);
  const put = await fetch(pre.json.url, {
    method: 'PUT',
    headers: { 'Content-Type': pre.json.content_type ?? contentType, 'Cache-Control': 'public, max-age=2592000, immutable' },
    body: await openAsBlob(path, { type: pre.json.content_type ?? contentType }),
    duplex: 'half',
  });
  if (!put.ok) fail(`upload failed: HTTP ${put.status}`);
  return { key: pre.json.key, uploaded: true };
}

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const AUDIO_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg', weba: 'audio/webm' };
const videoMime = (path) => (/\.mov$/i.test(path) ? 'video/quicktime' : /\.webm$/i.test(path) ? 'video/webm' : 'video/mp4');

/** Library asset (B-roll / image / audio): upload, then register into the active project's index. */
async function importLibraryAsset(path, kind, contentType, bins) {
  const st = await stat(path);
  const sig = await contentSig(path);
  const meta = bins.ffprobe ? probe(bins.ffprobe, path) : null; // ffprobe reads image dims too
  console.error(`[pireel-import] ${basename(path)} · ${kind} · ${(st.size / 1048576).toFixed(1)}MB${meta?.durationSec ? ` · ${meta.durationSec.toFixed(1)}s` : ''}`);
  const { key } = await upload(path, sig, contentType);
  const reg = await media({
    action: 'register-asset',
    sig,
    kind,
    filename: basename(path),
    ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}),
    ...(meta?.width ? { width: meta.width } : {}),
    ...(meta?.height ? { height: meta.height } : {}),
  });
  if (!reg.ok || !reg.json.ok) fail(`register-asset failed: ${reg.json.error ?? `HTTP ${reg.status}`}${reg.json.summary ? ` — ${reg.json.summary}` : ''}`);
  return {
    file: basename(path),
    kind,
    sig,
    key,
    ...reg.json.data,
    delivery: 'cloud',
    ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}),
    ...(meta?.width ? { width: meta.width } : {}),
    ...(meta?.height ? { height: meta.height } : {}),
  };
}

function transcriptionFailure(error, detail, httpStatus) {
  const safeError = String(error || 'transcription_failed').slice(0, 120);
  const safeDetail = typeof detail === 'string' && detail.trim() ? detail.trim().slice(0, 240) : undefined;
  const suffix = httpStatus ? `, HTTP ${httpStatus}` : '';
  console.error(`[pireel-import] transcription failed (${safeError}${suffix}) — importing video without transcript`);
  return {
    status: 'failed',
    error: safeError,
    ...(httpStatus ? { http_status: httpStatus } : {}),
    ...(safeDetail ? { detail: safeDetail } : {}),
    segments: [],
  };
}

/** Extract audio → upload the small audio → server-side transcription. The video import remains
 *  usable when transcription fails, but the result preserves the failure instead of making
 *  billing/auth/provider errors look like a valid empty transcript. */
async function transcribe(path, meta, bins) {
  if (!bins.ffmpeg) return { status: 'skipped', reason: 'ffmpeg_unavailable', segments: [] };
  if (!(meta?.hasAudio ?? true)) return { status: 'skipped', reason: 'no_audio_track', segments: [] };
  if (has('no-transcribe')) return { status: 'skipped', reason: 'disabled', segments: [] };
  const tmp = join(tmpdir(), `pireel-audio-${Date.now()}.m4a`);
  const r = spawnSync(bins.ffmpeg, ['-y', '-v', 'quiet', '-i', path, '-vn', '-acodec', 'aac', '-b:a', '64k', tmp], { stdio: 'ignore' });
  if (r.status !== 0) {
    return transcriptionFailure('audio_extraction_failed');
  }
  try {
    console.error('[pireel-import] transcribing…');
    const audio = await readFile(tmp);
    const preA = await media({ action: 'put-audio', size: audio.byteLength });
    if (!preA.ok || !preA.json.url) {
      return transcriptionFailure(
        preA.json.error ?? 'audio_upload_prepare_failed',
        preA.json.detail ?? preA.json.hint,
        preA.status,
      );
    }
    const putA = await fetch(preA.json.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/mp4', 'Cache-Control': 'public, max-age=2592000, immutable' },
      body: audio,
    });
    if (!putA.ok) return transcriptionFailure('audio_upload_failed', undefined, putA.status);
    const asr = await media({ action: 'asr', audio_key: preA.json.key, duration_sec: meta?.durationSec });
    if (!asr.ok) {
      return transcriptionFailure(
        asr.json.error ?? 'asr_request_failed',
        asr.json.detail ?? asr.json.hint,
        asr.status,
      );
    }
    if (asr.json.asr_ok === false) {
      const detail = typeof asr.json.detail === 'string' ? asr.json.detail : '';
      if (/returned no (?:text|transcript)|no speech/i.test(detail)) {
        console.error('[pireel-import] transcript: no speech detected');
        return { status: 'empty', reason: 'no_speech', segments: [] };
      }
      return transcriptionFailure(asr.json.error ?? 'asr_provider_failed', detail);
    }
    const off = meta?.audioOffset ?? 0;
    const segs = (asr.json.segments ?? [])
      .filter((s) => s.text?.trim())
      .map((s) => ({ start: Math.max(0, s.start + off), end: Math.max(s.start + off + 0.1, s.end + off), text: s.text.trim() }));
    if (!segs.length) {
      console.error('[pireel-import] transcript: no timed sentences returned');
      return { status: 'empty', reason: 'no_timed_sentences', segments: [] };
    }
    console.error(`[pireel-import] transcript: ${segs.length} sentences`);
    return { status: 'completed', segments: segs };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** Main video: upload, transcribe, register as the narrative source of the active project. */
async function importMainVideo(path, bins) {
  const st = await stat(path);
  const sig = await contentSig(path);
  console.error(`[pireel-import] ${basename(path)} · ${(st.size / 1048576).toFixed(1)}MB · sig=${sig}`);
  const contentType = videoMime(path);
  const meta = bins.ffprobe ? probe(bins.ffprobe, path) : null;
  if (!meta) console.error('[pireel-import] ffprobe unavailable — duration/dims unknown (browser will complete them on open)');
  const { key } = await upload(path, sig, contentType);
  const transcription = await transcribe(path, meta, bins);
  const transcript = transcription.segments;
  const reg = await media({
    action: 'register',
    sig,
    filename: basename(path),
    ...(meta?.durationSec ? { duration_sec: meta.durationSec } : {}),
    ...(meta?.width ? { width: meta.width } : {}),
    ...(meta?.height ? { height: meta.height } : {}),
    ...(transcript.length ? { transcript_segments: transcript } : {}),
  });
  if (!reg.ok || !reg.json.ok) fail(`register failed: ${reg.json.error ?? `HTTP ${reg.status}`}${reg.json.summary ? ` — ${reg.json.summary}` : ''}`);
  const { segments: _segments, ...transcriptionResult } = transcription;
  return {
    file: basename(path),
    sig,
    key,
    ...reg.json.data,
    transcript: transcript.length,
    transcription: transcriptionResult,
    probed: !!meta,
    delivery: 'cloud',
  };
}

const bins = { ffprobe: resolveBin('ffprobe', 'ffprobe', 'FFPROBE_PATH'), ffmpeg: resolveBin('ffmpeg', 'ffmpeg', 'FFMPEG_PATH') };
if (!bins.ffmpeg || !bins.ffprobe) {
  console.error('[pireel-import] ffmpeg/ffprobe not fully available — degraded import (see skill: install them for metadata + transcript)');
}
console.error('[pireel-import] data paths:\n' + TRANSFER_MATRIX.map((l) => `  ${l}`).join('\n'));
const out = [];
for (const f of files) {
  const image = f.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)?.[1];
  const audio = f.toLowerCase().match(/\.(mp3|m4a|aac|wav|flac|ogg|opus|weba)$/)?.[1];
  if (image) out.push(await importLibraryAsset(f, 'image', IMAGE_MIME[image], bins));
  else if (audio) out.push(await importLibraryAsset(f, 'audio', AUDIO_MIME[audio], bins));
  else if (has('broll')) out.push(await importLibraryAsset(f, 'video', videoMime(f), bins));
  else out.push(await importMainVideo(f, bins));
}
console.log(JSON.stringify({ imports: out }, null, 2));
