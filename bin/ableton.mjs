#!/usr/bin/env node
/**
 * ableton.mjs — unified Ableton Live control CLI (read + write).
 *
 * Each command connects to Ableton once, runs, prints the result as JSON to
 * stdout, then exits. All logs go to stderr so stdout stays clean JSON that an
 * AI / script can parse reliably.
 *
 * Depends on ableton-js (requires Ableton Live running with the AbletonJS
 * MIDI Remote Script installed and enabled as a Control Surface).
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Ableton } from 'ableton-js';

// ---------- temp-dir resolution ----------
// ableton-js finds the running Live server through a port file
// ("ableton-js-server.port") that Live writes into its os.tmpdir() (i.e. $TMPDIR).
// Some environments — sandboxed shells, CI, certain agent runtimes — override
// $TMPDIR, so this process' temp dir differs from the one Live wrote to and the
// connection silently times out even though everything is set up correctly.
// Point this process at the dir that actually holds the server port file.
const SERVER_PORT_FILE = 'ableton-js-server.port';

function hasServerPort(dir) {
  try {
    return fs.statSync(path.join(dir, SERVER_PORT_FILE)).isFile();
  } catch {
    return false;
  }
}

function resolveAbletonTmpDir() {
  // Explicit override always wins.
  if (process.env.ABLETON_TMPDIR) return process.env.ABLETON_TMPDIR;
  // Normal case: the default temp dir already has the port file.
  if (hasServerPort(os.tmpdir())) return null;

  // Otherwise scan likely temp locations for the freshest server port file.
  const candidates = [];
  if (process.platform === 'darwin') {
    // macOS per-user temp dirs live under /var/folders/xx/yyyy/T/
    const base = '/var/folders';
    try {
      for (const a of fs.readdirSync(base)) {
        try {
          for (const b of fs.readdirSync(path.join(base, a))) {
            candidates.push(path.join(base, a, b, 'T'));
          }
        } catch { /* unreadable (other users) — skip */ }
      }
    } catch { /* ignore */ }
  }
  candidates.push('/tmp');

  let best = null;
  let bestMtime = -1;
  for (const dir of candidates) {
    try {
      const st = fs.statSync(path.join(dir, SERVER_PORT_FILE));
      if (st.isFile() && st.mtimeMs > bestMtime) {
        best = dir;
        bestMtime = st.mtimeMs;
      }
    } catch { /* no port file here — skip */ }
  }
  return best;
}

const abletonTmpDir = resolveAbletonTmpDir();
if (abletonTmpDir) process.env.TMPDIR = abletonTmpDir;

// ---------- helpers ----------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (p) => `${NOTE_NAMES[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 1}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
const num = (v, d) => (v === undefined ? d : Number(v));
const bool = (v, d = false) =>
  v === undefined ? d : v === true || v === 'on' || v === 'true' || v === '1';

// ---------- arg parsing ----------
// Shape: <command> [positionals...] [--flag value | --flag=value | --flag]
const argv = process.argv.slice(2);
const command = argv[0];
const pos = [];
const flags = {};
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[a.slice(2)] = true;
      else (flags[a.slice(2)] = next), i++;
    }
  } else pos.push(a);
}

// ---------- help ----------
const HELP = `ableton.mjs — Ableton Live control CLI

Status / transport:
  status                         Connect and print a song summary (tempo / signature / playing / track count)
  song                           Like status, with more fields
  play | stop | continue         Transport control
  stop-all                       Stop all session clips
  set-tempo <bpm>                Set BPM
  set-signature <num> <den>      Set time signature, e.g. set-signature 4 4
  metronome <on|off>             Toggle the metronome
  record <on|off>                Toggle session record (triggerSessionRecord)

Tracks:
  tracks                         List all tracks (index / name / type / mute / solo / arm)
  create-midi-track [index]      Create a MIDI track (default: append to the end)
  create-audio-track [index]     Create an audio track
  delete-track <index>
  rename-track <index> <name>
  set-track <index> [--mute on|off] [--solo on|off] [--arm on|off]
                                 [--volume 0..1] [--pan -1..1]
  set-color <index> <hex|int>    Set track color, e.g. set-color 7 #FF453A

Read clips:
  clips <track>                  List every session clip slot on a track
  clips <track> --arrangement    List clips in the Arrangement View
  notes <track> <slot>           Print every note in a clip

Write clips (session view):
  write-clip <track> <slot> --length <beats> [--name N] [--overwrite]
             [--notes '[{"pitch":60,"time":0,"duration":1,"velocity":100}]']
                                 Create a clip and write notes (the workhorse for AI-written melodies)
  add-notes <track> <slot> --notes '[...]'   Append notes to an existing clip
  clear-notes <track> <slot>     Remove all notes from a clip
  create-clip <track> <slot> <lengthBeats>   Create an empty clip
  delete-clip <track> <slot>
  rename-clip <track> <slot> <name>
  fire-clip <track> <slot>       Launch that session clip
  fire-scene <sceneIndex>        Trigger a scene

Note coordinates: time / duration are in BEATS, measured from the start of the clip;
pitch is a MIDI note number (60 = C3 in Live), velocity is 0..127.`;

// ---------- Ableton connection ----------
const silent = () => {};
const toErr = (...a) => console.error(...a);
const ableton = new Ableton({
  logger: { log: toErr, info: toErr, warn: toErr, error: toErr, debug: silent },
});

async function connect() {
  const timeout = new Promise((_, rej) =>
    setTimeout(
      () =>
        rej(
          new Error(
            'Timed out connecting to Ableton (5s). Check that: 1) Ableton Live is running; 2) the AbletonJS MIDI Remote Script is installed and enabled as a Control Surface (Settings > Link/Tempo/MIDI); 3) you ran `npm install` in the skill directory.'
          )
        ),
      5000
    )
  );
  await Promise.race([ableton.start(), timeout]);
}

async function getTrack(idx) {
  const tracks = await ableton.song.get('tracks');
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0 || i >= tracks.length)
    throw new Error(`Invalid track index ${idx} (${tracks.length} tracks, 0-based)`);
  return tracks[i];
}

async function getSlot(track, idx) {
  const slots = await track.get('clip_slots');
  const i = Number(idx);
  if (!Number.isInteger(i) || i < 0 || i >= slots.length)
    throw new Error(`Invalid clip slot index ${idx} (this track has ${slots.length} slots)`);
  return slots[i];
}

async function getClip(track, idx) {
  const slot = await getSlot(track, idx);
  const has = await slot.get('has_clip');
  if (!has) throw new Error(`Slot ${idx} has no clip`);
  return { slot, clip: await slot.get('clip') };
}

function normalizeNotes(raw) {
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error('--notes must be a valid JSON array, e.g. \'[{"pitch":60,"time":0,"duration":1}]\'');
  }
  if (!Array.isArray(arr)) throw new Error('--notes must be an array');
  return arr.map((n) => ({
    pitch: Number(n.pitch),
    time: Number(n.time ?? 0),
    duration: Number(n.duration ?? 0.5),
    velocity: Number(n.velocity ?? 100),
    muted: Boolean(n.muted ?? false),
  }));
}

async function setParam(paramObj, value) {
  const [min, max] = await Promise.all([paramObj.get('min'), paramObj.get('max')]);
  const clamped = clamp(Number(value), min, max);
  await paramObj.set('value', clamped);
  return { min, max, value: clamped };
}

// ---------- commands ----------
const commands = {
  async status() {
    const s = ableton.song;
    const [tempo, n, d, playing, tracks] = await Promise.all([
      s.get('tempo'),
      s.get('signature_numerator'),
      s.get('signature_denominator'),
      s.get('is_playing'),
      s.get('tracks'),
    ]);
    out({ connected: true, tempo, timeSignature: `${n}/${d}`, isPlaying: playing, trackCount: tracks.length });
  },

  async song() {
    const s = ableton.song;
    const [tempo, n, d, playing, metronome, songTime, tracks, scenes] = await Promise.all([
      s.get('tempo'),
      s.get('signature_numerator'),
      s.get('signature_denominator'),
      s.get('is_playing'),
      s.get('metronome'),
      s.get('current_song_time'),
      s.get('tracks'),
      s.get('scenes'),
    ]);
    out({
      tempo,
      timeSignature: `${n}/${d}`,
      isPlaying: playing,
      metronome,
      currentSongTime: songTime,
      trackCount: tracks.length,
      sceneCount: scenes.length,
    });
  },

  async play() {
    await ableton.song.startPlaying();
    out({ ok: true, action: 'play' });
  },
  async stop() {
    await ableton.song.stopPlaying();
    out({ ok: true, action: 'stop' });
  },
  async continue() {
    await ableton.song.continuePlaying();
    out({ ok: true, action: 'continue' });
  },
  async 'stop-all'() {
    await ableton.song.stopAllClips();
    out({ ok: true, action: 'stop-all-clips' });
  },
  async 'set-tempo'() {
    const bpm = Number(pos[0]);
    if (!(bpm > 0)) throw new Error('Usage: set-tempo <bpm>');
    await ableton.song.set('tempo', bpm);
    out({ ok: true, tempo: bpm });
  },
  async 'set-signature'() {
    const n = Number(pos[0]);
    const d = Number(pos[1]);
    if (!(n > 0) || !(d > 0)) throw new Error('Usage: set-signature <num> <den>');
    await ableton.song.set('signature_numerator', n);
    await ableton.song.set('signature_denominator', d);
    out({ ok: true, timeSignature: `${n}/${d}` });
  },
  async metronome() {
    const on = bool(pos[0]);
    await ableton.song.set('metronome', on);
    out({ ok: true, metronome: on });
  },
  async record() {
    await ableton.song.triggerSessionRecord();
    out({ ok: true, action: 'toggled-session-record' });
  },

  async tracks() {
    const tracks = await ableton.song.get('tracks');
    const rows = [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const [name, midi, mute, solo, arm] = await Promise.all([
        t.get('name'),
        t.get('has_midi_input'),
        t.get('mute'),
        t.get('solo'),
        t.get('arm').catch(() => null),
      ]);
      rows.push({ index: i, name, type: midi ? 'midi' : 'audio', mute, solo, arm });
    }
    out({ trackCount: rows.length, tracks: rows });
  },

  async 'create-midi-track'() {
    const idx = num(pos[0], -1);
    await ableton.song.createMidiTrack(idx);
    out({ ok: true, created: 'midi-track', at: idx });
  },
  async 'create-audio-track'() {
    const idx = num(pos[0], -1);
    await ableton.song.createAudioTrack(idx);
    out({ ok: true, created: 'audio-track', at: idx });
  },
  async 'delete-track'() {
    const idx = Number(pos[0]);
    await ableton.song.deleteTrack(idx);
    out({ ok: true, deleted: idx });
  },
  async 'rename-track'() {
    const t = await getTrack(pos[0]);
    const name = pos.slice(1).join(' ');
    if (!name) throw new Error('Usage: rename-track <index> <name>');
    await t.set('name', name);
    out({ ok: true, index: Number(pos[0]), name });
  },
  async 'set-track'() {
    const t = await getTrack(pos[0]);
    const changed = {};
    if (flags.mute !== undefined) await t.set('mute', bool(flags.mute)), (changed.mute = bool(flags.mute));
    if (flags.solo !== undefined) await t.set('solo', bool(flags.solo)), (changed.solo = bool(flags.solo));
    if (flags.arm !== undefined) await t.set('arm', bool(flags.arm)), (changed.arm = bool(flags.arm));
    if (flags.volume !== undefined) {
      const mixer = await t.get('mixer_device');
      const vol = await mixer.get('volume');
      changed.volume = await setParam(vol, flags.volume);
    }
    if (flags.pan !== undefined) {
      const mixer = await t.get('mixer_device');
      const pan = await mixer.get('panning');
      changed.pan = await setParam(pan, flags.pan);
    }
    out({ ok: true, index: Number(pos[0]), changed });
  },
  async 'set-color'() {
    const t = await getTrack(pos[0]);
    const raw = pos[1];
    if (raw === undefined) throw new Error('Usage: set-color <index> <hex|int>, e.g. set-color 7 #FF453A');
    let s = String(raw).trim();
    if (s.startsWith('#')) s = s.slice(1);
    let color;
    if (/^[0-9a-fA-F]{6}$/.test(s)) color = parseInt(s, 16);
    else if (/^\d+$/.test(s)) color = Number(s);
    else throw new Error(`Invalid color "${raw}" — use a 6-digit hex (#FF453A) or an integer`);
    // Live stores color as 0xRRGGBB and snaps it to the nearest palette entry.
    await t.set('color', color);
    const applied = await t.get('color');
    out({ ok: true, index: Number(pos[0]), requested: '#' + color.toString(16).padStart(6, '0').toUpperCase(), applied });
  },

  async clips() {
    const t = await getTrack(pos[0]);
    const trackName = await t.get('name');
    if (flags.arrangement) {
      const clips = await t.get('arrangement_clips');
      const rows = [];
      for (const clip of clips) {
        const [name, start, end] = await Promise.all([
          clip.get('name'),
          clip.get('start_time'),
          clip.get('end_time'),
        ]);
        rows.push({ name, startTime: start, endTime: end, duration: end - start });
      }
      out({ track: trackName, view: 'arrangement', clipCount: rows.length, clips: rows });
      return;
    }
    const slots = await t.get('clip_slots');
    const rows = [];
    for (let i = 0; i < slots.length; i++) {
      const has = await slots[i].get('has_clip');
      if (!has) {
        rows.push({ slot: i, empty: true });
        continue;
      }
      const clip = await slots[i].get('clip');
      const [name, length] = await Promise.all([clip.get('name'), clip.get('length')]);
      let noteCount = null;
      try {
        const notes = await clip.getNotes(0, 0, length || 9999, 128);
        noteCount = notes.length;
      } catch {
        /* audio clip has no notes */
      }
      rows.push({ slot: i, name, lengthBeats: length, noteCount });
    }
    out({ track: trackName, view: 'session', slotCount: rows.length, clips: rows });
  },

  async notes() {
    const t = await getTrack(pos[0]);
    const { clip } = await getClip(t, pos[1]);
    const length = await clip.get('length');
    const notes = await clip.getNotes(0, 0, length, 128);
    out({
      slot: Number(pos[1]),
      lengthBeats: length,
      noteCount: notes.length,
      notes: notes
        .sort((a, b) => a.time - b.time)
        .map((n) => ({
          pitch: n.pitch,
          name: pitchName(n.pitch),
          time: n.time,
          duration: n.duration,
          velocity: n.velocity,
          muted: n.muted,
        })),
    });
  },

  async 'create-clip'() {
    const t = await getTrack(pos[0]);
    const slot = await getSlot(t, pos[1]);
    const length = Number(pos[2]);
    if (!(length > 0)) throw new Error('Usage: create-clip <track> <slot> <lengthBeats>');
    if (await slot.get('has_clip'))
      throw new Error('Slot already has a clip; delete-clip first or use write-clip --overwrite');
    await slot.createClip(length);
    out({ ok: true, slot: Number(pos[1]), lengthBeats: length });
  },

  async 'write-clip'() {
    const t = await getTrack(pos[0]);
    const slot = await getSlot(t, pos[1]);
    const length = num(flags.length, 4);
    if (await slot.get('has_clip')) {
      if (flags.overwrite) await slot.deleteClip();
      else throw new Error('Slot already has a clip; add --overwrite to replace it, or use add-notes to append');
    }
    await slot.createClip(length);
    const clip = await slot.get('clip');
    if (flags.name) await clip.set('name', String(flags.name));
    let noteCount = 0;
    if (flags.notes) {
      const notes = normalizeNotes(flags.notes);
      await clip.setNotes(notes);
      noteCount = notes.length;
    }
    out({
      ok: true,
      track: await t.get('name'),
      slot: Number(pos[1]),
      lengthBeats: length,
      name: flags.name || undefined,
      noteCount,
    });
  },

  async 'add-notes'() {
    const t = await getTrack(pos[0]);
    const { clip } = await getClip(t, pos[1]);
    if (!flags.notes) throw new Error('Usage: add-notes <track> <slot> --notes \'[...]\'');
    const notes = normalizeNotes(flags.notes);
    await clip.setNotes(notes); // Live's add_new_notes: appends, does not clear existing notes
    out({ ok: true, slot: Number(pos[1]), added: notes.length });
  },

  async 'clear-notes'() {
    const t = await getTrack(pos[0]);
    const { clip } = await getClip(t, pos[1]);
    const length = await clip.get('length');
    await clip.removeNotesExtended(0, 128, 0, length);
    out({ ok: true, slot: Number(pos[1]), cleared: true });
  },

  async 'delete-clip'() {
    const t = await getTrack(pos[0]);
    const slot = await getSlot(t, pos[1]);
    if (!(await slot.get('has_clip'))) throw new Error('Slot has no clip');
    await slot.deleteClip();
    out({ ok: true, slot: Number(pos[1]), deleted: true });
  },

  async 'rename-clip'() {
    const t = await getTrack(pos[0]);
    const { clip } = await getClip(t, pos[1]);
    const name = pos.slice(2).join(' ');
    if (!name) throw new Error('Usage: rename-clip <track> <slot> <name>');
    await clip.set('name', name);
    out({ ok: true, slot: Number(pos[1]), name });
  },

  async 'fire-clip'() {
    const t = await getTrack(pos[0]);
    const slot = await getSlot(t, pos[1]);
    await slot.fire();
    out({ ok: true, fired: `track ${pos[0]} slot ${pos[1]}` });
  },

  async 'fire-scene'() {
    const scenes = await ableton.song.get('scenes');
    const i = Number(pos[0]);
    if (!Number.isInteger(i) || i < 0 || i >= scenes.length)
      throw new Error(`Invalid scene index ${pos[0]} (${scenes.length} scenes)`);
    await scenes[i].fire();
    out({ ok: true, firedScene: i });
  },
};

// ---------- main ----------
async function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(HELP + '\n');
    return;
  }
  const handler = commands[command];
  if (!handler) {
    out({ error: `Unknown command: ${command}`, hint: 'Run `node bin/ableton.mjs help` for the full list' });
    process.exitCode = 1;
    return;
  }
  try {
    await connect();
    await handler();
  } catch (e) {
    out({ error: e?.message || String(e) });
    process.exitCode = 1;
  } finally {
    try {
      await ableton.close();
    } catch {
      /* ignore */
    }
  }
}

main();
