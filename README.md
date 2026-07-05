# ableton-control — control Ableton Live by talking to your AI

**English** · [中文](./README.zh-CN.md) · [한국어](./README.ko.md)

## What it is

A [Claude Code](https://claude.com/claude-code) skill that lets you drive a
**running** Ableton Live set just by asking your AI in plain language — *"set the
tempo to 128"*, *"write a 4-bar bassline on track 1"*, *"fire clip 2"*. It reads and
writes your Live set for you (clips, notes, tempo, tracks, playback); you never
touch code. Works with Ableton Live 11+ — no Live Suite or Max for Live needed.

## How to set it up

Don't worry — you don't need to be a developer. Just a few steps:

1. **Install Node.js** — download the LTS version from [nodejs.org](https://nodejs.org)
   and run the installer (just click through). This is the step people usually get
   stuck on, so if anything goes wrong here, just message me.
2. **Get the project** — download this repo, open the folder in a terminal, and run
   `npm install`.
3. **Connect it to Ableton** — copy the `node_modules/ableton-js/midi-script` folder
   into Live's Remote Scripts folder (`~/Music/Ableton/User Library/Remote Scripts`)
   and rename the copy to `AbletonJS`. Then in Live open **Settings → Link, Tempo &
   MIDI → Control Surface** and pick **AbletonJS** in a free slot. Keep Live running.
4. **Hand it to your AI** — open this folder with Claude Code and ask it to read
   `SKILL.md`. From then on just tell it what you want (*"set the tempo to 128"*) and
   it does the rest.

To check the connection, run `node bin/ableton.mjs status` — it should print your
current tempo and track count.

That's it! If you get stuck anywhere, feel free to reach out — happy to walk you
through it.
