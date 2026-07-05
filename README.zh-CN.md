# ableton-control — 用聊天的方式让 AI 操作 Ableton Live

[English](./README.md) · **中文** · [한국어](./README.ko.md)

## 简介

一个 [Claude Code](https://claude.com/claude-code) skill,让你只用大白话就能操控一个
**正在运行的** Ableton Live 工程 —— 比如「把 tempo 调到 128」「在第 1 轨写一段 4 小节的
贝斯」「触发第 2 个 clip」。它替你读写 Live 工程(clip、音符、tempo、轨道、播放),你完全
不用碰代码。支持 Ableton Live 11+,不需要 Suite 版,也不需要 Max for Live。

## 如何安装

别担心 —— 你不需要是开发者,几步就好:

1. **安装 Node.js** —— 从 [nodejs.org](https://nodejs.org) 下载 LTS 版本,运行安装包
   (一路点下一步即可)。大家通常卡在这一步,这里要是出问题,直接找我。
2. **拿到项目** —— 从仓库下载本项目,在文件夹里打开终端,运行 `npm install`。
3. **连上 Ableton** —— 把 `node_modules/ableton-js/midi-script` 文件夹复制到 Live 的
   Remote Scripts 目录(`~/Music/Ableton/User Library/Remote Scripts`),并把副本重命名为
   `AbletonJS`。然后在 Live 里进入 **设置 → Link, Tempo & MIDI → Control Surface**,在一个
   空槽里选 **AbletonJS**。保持 Live 运行。
4. **交给你的 AI** —— 把整个文件夹复制到 `~/.claude/skills/`,之后直接跟 Claude Code 说你想
   干嘛(「把 tempo 调到 128」),剩下的它来做。

想确认是否连通,运行 `node bin/ableton.mjs status` —— 它应该会打印出当前的 tempo 和轨道数。

就这些!哪一步卡住了随时找我,乐意手把手带你走一遍。
