---
name: ableton-control
description: >-
  Control a running Ableton Live set from the command line — read song/track/clip
  state and write changes (create/edit MIDI clips and notes, set tempo & time
  signature, manage tracks, drive transport, fire clips/scenes). Use whenever the
  user wants to inspect or manipulate Ableton Live, generate or edit a MIDI
  melody/chord clip inside Live, change tempo/tracks, or trigger playback. Trigger
  words: Ableton, Live set, MIDI clip, session/arrangement, tempo/BPM, fire clip,
  ableton-js.
---

# Ableton Live control

Read and write a **running** Ableton Live set through `ableton-js` (which talks to
Live via the AbletonJS MIDI Remote Script). Every operation goes through a single
CLI, and each command prints JSON.

## Prerequisites (once)

1. Ableton Live is running.
2. The **AbletonJS MIDI Remote Script** is installed and enabled — this is the
   channel the CLI uses to talk to Live. Once per machine:
   - Copy `node_modules/ableton-js/midi-script` into Live's Remote Scripts folder
     (`~/Music/Ableton/User Library/Remote Scripts`) and rename the copy to
     `AbletonJS`.
   - In Live, go to **Settings → Link, Tempo & MIDI → Control Surface** and pick
     **AbletonJS** in a free slot. (Restart Live if it was already running.)
3. Dependencies are installed: `cd` into this skill directory and run `npm install`.

If these aren't met, every command returns `{"error": "Timed out connecting to
Ableton…"}`. When you see that, tell the user to check the three points above —
don't keep retrying.

The CLI auto-detects the temp dir Live uses to advertise its port, so it works
even in sandboxed shells that override `$TMPDIR`. If your setup is unusual, you
can force it with `ABLETON_TMPDIR=/path/to/tempdir`.

## Usage

Call from this skill directory (`$SKILL_DIR` is the folder containing this file):

```bash
node "$SKILL_DIR/bin/ableton.mjs" <command> [args] [--flags]
```

**Always run `status` or `tracks` first** to confirm the current state, then use
real track/slot indices when writing. All indices are 0-based.

### Common commands (full list in `reference.md` or `node bin/ableton.mjs help`)

| Goal | Command |
|------|---------|
| Connect & see a summary | `status` |
| List tracks | `tracks` |
| List a track's session clips | `clips <track>` |
| Inspect a clip's notes | `notes <track> <slot>` |
| Write a melody to a clip | `write-clip <track> <slot> --length <beats> --notes '[...]'` |
| Append notes | `add-notes <track> <slot> --notes '[...]'` |
| Create a MIDI track | `create-midi-track` |
| Change BPM | `set-tempo <bpm>` |
| Play / stop | `play` / `stop` |
| Fire a clip / scene | `fire-clip <track> <slot>` / `fire-scene <i>` |

### Note format

`--notes` is a JSON array; each note looks like:

```json
{ "pitch": 60, "time": 0, "duration": 1, "velocity": 100, "muted": false }
```

- `pitch`: MIDI note number, **60 = C3** (Live's naming, one octave below the
  scientific-pitch convention).
- `time` / `duration`: measured in **beats**; `time` is relative to the start of
  the clip. In 4/4, one bar = 4 beats.
- `velocity` 0–127. `duration` / `velocity` / `muted` are optional (default 0.5 /
  100 / false).

Example — write one bar of a C major scale (one note per beat) into track 0, slot 0:

```bash
node "$SKILL_DIR/bin/ableton.mjs" write-clip 0 0 --length 8 --name "Scale" \
  --notes '[{"pitch":60,"time":0,"duration":1},{"pitch":62,"time":1,"duration":1},{"pitch":64,"time":2,"duration":1},{"pitch":65,"time":3,"duration":1},{"pitch":67,"time":4,"duration":1},{"pitch":69,"time":5,"duration":1},{"pitch":71,"time":6,"duration":1},{"pitch":72,"time":7,"duration":1}]'
```

## Safety / destructive operations

`delete-track`, `delete-clip`, `write-clip --overwrite`, and `clear-notes` change
the user's project irreversibly. **Confirm the target index with the user before
running these**, especially deletes. After a write, read it back with `notes` /
`clips` to verify.

## Troubleshooting

- `Timed out connecting` → Live isn't running / the AbletonJS Remote Script isn't
  installed or enabled as a Control Surface / you haven't run `npm install`.
- `Invalid track index …` / `Invalid clip slot …` → run `tracks` / `clips <track>`
  first to get real indices.
- Audio tracks have no notes, so `notes` will error or return empty on them.

See `reference.md` for the full command list, field details, and how each command
maps to the ableton-js API.
