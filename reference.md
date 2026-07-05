# Command reference & ableton-js mapping

All commands: `node bin/ableton.mjs <command> [positionals] [--flags]`. Indices are
0-based. Output is always JSON; errors look like `{"error": "..."}` and exit with
code 1.

## Status / transport

| Command | Description | Underlying (ableton-js) |
|---------|-------------|-------------------------|
| `status` | tempo / signature / playing / track count | `song.get('tempo' \| 'signature_*' \| 'is_playing' \| 'tracks')` |
| `song` | above + metronome / current time / scene count | same + `metronome` / `current_song_time` / `scenes` |
| `play` | play from start/current | `song.startPlaying()` |
| `stop` | stop | `song.stopPlaying()` |
| `continue` | resume from stop position | `song.continuePlaying()` |
| `stop-all` | stop all session clips | `song.stopAllClips()` |
| `set-tempo <bpm>` | set BPM | `song.set('tempo', bpm)` |
| `set-signature <n> <d>` | set time signature | `song.set('signature_numerator'/'signature_denominator')` |
| `metronome <on\|off>` | metronome | `song.set('metronome', bool)` |
| `record <on\|off>` | toggle session record | `song.triggerSessionRecord()` |

## Tracks

| Command | Description | Underlying |
|---------|-------------|------------|
| `tracks` | list all tracks: index/name/type/mute/solo/arm | iterate `song.get('tracks')`, `track.get(...)` each |
| `create-midi-track [index]` | new MIDI track (default end, `-1`) | `song.createMidiTrack(index)` |
| `create-audio-track [index]` | new audio track | `song.createAudioTrack(index)` |
| `delete-track <index>` | delete a track ⚠️ | `song.deleteTrack(index)` |
| `rename-track <index> <name>` | rename | `track.set('name', ...)` |
| `set-track <index> [--mute][--solo][--arm][--volume 0..1][--pan -1..1]` | set properties | `track.set(...)`; volume/pan via `track.get('mixer_device')` → `.get('volume'\|'panning')` → `param.set('value', clamp(min,max))` |

`--mute/--solo/--arm` accept `on/off/true/false/1/0`. `--volume` value is 0..1
(≈0.85 is 0 dB); `--pan` value is -1..1. Both are clamped to the parameter's
min/max.

## Read clips

| Command | Description | Underlying |
|---------|-------------|------------|
| `clips <track>` | list session slots: empty? / name / length / note count | `track.get('clip_slots')` → `slot.get('has_clip'/'clip')` → `clip.get('name'/'length')` + `clip.getNotes(...)` |
| `clips <track> --arrangement` | list Arrangement View clips | `track.get('arrangement_clips')` |
| `notes <track> <slot>` | all notes in the clip (sorted by time) | `clip.getNotes(0,0,length,128)` |

`getNotes(fromTime, fromPitch, timeSpan, pitchSpan)` returns
`{ pitch, time, duration, velocity, muted }[]`.

## Write clips (session view)

| Command | Description | Underlying |
|---------|-------------|------------|
| `create-clip <track> <slot> <lengthBeats>` | create empty clip | `slot.createClip(length)` |
| `write-clip <track> <slot> --length <beats> [--name N] [--overwrite] [--notes '[...]']` | create clip and write notes (workhorse) | `slot.deleteClip()` (if --overwrite) → `slot.createClip()` → `clip.set('name')` → `clip.setNotes(notes)` |
| `add-notes <track> <slot> --notes '[...]'` | append notes to an existing clip | `clip.setNotes(notes)` (Live `add_new_notes`, appends without clearing) |
| `clear-notes <track> <slot>` | remove all notes ⚠️ | `clip.removeNotesExtended(0,128,0,length)` |
| `delete-clip <track> <slot>` | delete clip ⚠️ | `slot.deleteClip()` |
| `rename-clip <track> <slot> <name>` | rename clip | `clip.set('name', ...)` |
| `fire-clip <track> <slot>` | launch that session clip | `slot.fire()` |
| `fire-scene <sceneIndex>` | trigger a scene | `song.get('scenes')[i].fire()` |

### Note object

```json
{ "pitch": 60, "time": 0, "duration": 1, "velocity": 100, "muted": false }
```

- `pitch`: MIDI number, **60 = C3 in Live** (one octave below scientific-pitch
  naming).
- `time` / `duration`: in beats; `time` is relative to the clip start. In 4/4, one
  bar = 4 beats.
- Defaults when omitted: `duration`=0.5, `velocity`=100, `muted`=false.

## Typical workflow (for an AI to follow)

1. `status` → confirm the connection.
2. `tracks` → find the target MIDI track index.
3. `clips <track>` → find an empty slot, or confirm the slot to overwrite.
4. `write-clip <track> <slot> --length L --notes '[...]'` → write the melody/chords.
5. `notes <track> <slot>` → read it back to verify the notes are correct.
6. `fire-clip <track> <slot>` / `play` → audition.

## Destructive commands (confirm with the user before running)

`delete-track`, `delete-clip`, `clear-notes`, `write-clip --overwrite`.

## Known limits

- Covers the common song / track / clip-slot / clip / scene surface; device
  parameter automation, audio warp, locators, cue points, etc. are not wrapped —
  extend `bin/ableton.mjs` following the same patterns when needed.
- Property names follow the Live API; a few may differ across Live versions.
- Each command connects and disconnects independently; it does not hold a long-
  lived connection. For dense real-time control, rewrite it as a resident process.
