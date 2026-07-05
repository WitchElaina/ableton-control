# ableton-control — an AI skill for driving Ableton Live

**English** · [中文](./README.zh-CN.md) · [한국어](./README.ko.md)

A self-contained [Claude Code](https://claude.com/claude-code) skill that lets an AI
read and write a **running** Ableton Live set: read song/track/clip state, create
and edit MIDI clips and notes, change tempo/time signature, manage tracks, drive
playback, and fire clips/scenes.

Under the hood it talks to Live through [`ableton-js`](https://github.com/leolabs/ableton-js),
which exposes the Live API to Node via a Max for Live device. The AI doesn't write
`ableton-js` code directly — it calls the CLI in this folder (`bin/ableton.mjs`),
and every command prints JSON that the model can parse.

## Install

### 1. Ableton side: install the M4L device

1. You need Ableton Live **Suite**, or Live with **Max for Live** installed.
2. Download `AbletonJS.amxd` (a MIDI device) from the
   [ableton-js releases](https://github.com/leolabs/ableton-js).
3. Drop the `.amxd` onto **any track** in Live (leave it there — it's the
   communication channel).
4. Keep Live running.

### 2. Skill side: install dependencies

```bash
cd ableton-control
npm install                    # installs ableton-js
node bin/ableton.mjs status    # smoke test: should print tempo / track count
```

### 3. Register it as a Claude Code skill

Put this folder where Claude discovers skills. Either:

```bash
# A) copy into the user-level skills directory
cp -R ableton-control ~/.claude/skills/ableton-control

# B) or symlink (changes take effect immediately — good for development)
ln -s "$(pwd)/ableton-control" ~/.claude/skills/ableton-control
```

Then in Claude Code just say "set the tempo to 128" or "write a 4-bar bassline on
track 1" and it will discover and use this skill. You can also drop it into a
project's `.claude/skills/` to ship it with a repo.

> Note: after registering, `~/.claude/skills/ableton-control/node_modules` must
> exist (run `npm install` in the real folder). The symlink approach shares the
> same `node_modules` automatically.

## Use it directly from the command line (no AI)

```bash
node bin/ableton.mjs help                   # all commands
node bin/ableton.mjs tracks                  # list tracks
node bin/ableton.mjs set-tempo 128
node bin/ableton.mjs write-clip 0 0 --length 4 \
  --notes '[{"pitch":60,"time":0,"duration":1},{"pitch":64,"time":1,"duration":1},{"pitch":67,"time":2,"duration":2}]'
node bin/ableton.mjs play
```

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | The skill spec the AI reads (triggers, usage, note format, safety notes) |
| `bin/ableton.mjs` | The unified CLI — every read/write operation |
| `reference.md` | Full command reference + mapping to the ableton-js / Live API |
| `package.json` | Declares the `ableton-js` dependency |

## Key ideas when sharing this technique

- **Channel**: CLI ↔ M4L device ↔ Live API. It's local UDP — nothing goes online.
- **Stateless**: each command connects, runs, and disconnects — a natural fit for
  an AI issuing one command at a time.
- **Read-back verification**: after `write-clip`, read it back with `notes` so the
  AI can self-check the result. This loop is the key to reliable AI-driven DAW work.
- **Confirm destructive ops**: `delete-*`, `--overwrite`, and `clear-notes` are
  irreversible; the skill already tells the AI to confirm with the user first.

## Compatibility

Written against `ableton-js` v4 and Ableton Live 11+. A few property names may
differ across Live versions; if a command reports a property error, check the
matching `ableton-js` docs and adjust against `reference.md`.
