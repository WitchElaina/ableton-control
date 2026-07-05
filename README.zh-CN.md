# ableton-control — 用 AI 操作 Ableton Live 的 Skill

[English](./README.md) · **中文** · [한국어](./README.ko.md)

一个自包含的 [Claude Code](https://claude.com/claude-code) skill,让 AI 能直接读写一个**正在运行的** Ableton Live 工程:读取歌曲/轨道/clip 状态,创建和编辑 MIDI clip 与音符,改 tempo/拍号,管理轨道,控制播放、触发 clip/scene。

底层通过 [`ableton-js`](https://github.com/leolabs/ableton-js) 与 Live 通信 —— 它借助一个 **MIDI Remote Script(控制表面脚本)**把 Live API 暴露给 Node。AI 不直接写 `ableton-js` 代码,而是调用本目录的 CLI(`bin/ableton.mjs`),每条命令输出 JSON,便于模型解析。

## 安装

### 1. 本 skill 侧:装依赖

```bash
cd ableton-control
npm install                    # 装 ableton-js(Remote Script 也随它一起装进 node_modules)
```

### 2. Ableton 侧:装 AbletonJS MIDI Remote Script

`ableton-js` 通过 **MIDI Remote Script(控制表面)**与 Live 通信,**不是** Max for Live 设备 —— 所以你不需要 Suite 版,也不需要 Max for Live。

1. 把 `node_modules/ableton-js/midi-script` 复制到 Live 的 Remote Scripts 目录并重命名为 `AbletonJS`,最终得到:
   `~/Music/Ableton/User Library/Remote Scripts/AbletonJS`
2. 在 Live 里进入 **设置 → Link, Tempo & MIDI → Control Surface**,在一个空槽里选 **AbletonJS**。(如果 Live 已在运行,重启一下。)
3. 保持 Live 运行,然后冒烟测试连接:

```bash
node bin/ableton.mjs status    # 应打印 tempo / 轨道数
```

### 3. 注册为 Claude Code skill

把本目录放到 Claude 能发现 skill 的位置,二选一:

```bash
# A) 拷贝到用户级 skills 目录
cp -R ableton-control ~/.claude/skills/ableton-control

# B) 或软链(改动即时生效,适合开发)
ln -s "$(pwd)/ableton-control" ~/.claude/skills/ableton-control
```

之后在 Claude Code 里直接说「把 tempo 调到 128」「在第 1 轨写一段 4 小节的贝斯」,它会自动发现并使用这个 skill。也可放到项目的 `.claude/skills/` 里随仓库分发。

> 注意:注册后 `~/.claude/skills/ableton-control/node_modules` 必须存在(在真实目录里 `npm install` 过);软链方式天然共享同一份 `node_modules`。

## 直接命令行使用(不经过 AI)

```bash
node bin/ableton.mjs help                    # 全部命令
node bin/ableton.mjs tracks                   # 列轨道
node bin/ableton.mjs set-tempo 128
node bin/ableton.mjs write-clip 0 0 --length 4 \
  --notes '[{"pitch":60,"time":0,"duration":1},{"pitch":64,"time":1,"duration":1},{"pitch":67,"time":2,"duration":2}]'
node bin/ableton.mjs play
```

## 文件说明

| 文件 | 作用 |
|------|------|
| `SKILL.md` | 给 AI 读的技能说明(触发条件、用法、音符格式、安全须知) |
| `bin/ableton.mjs` | 统一 CLI,所有读写操作的实现 |
| `reference.md` | 完整命令参考 + 与 ableton-js / Live API 的映射,分享讲解用 |
| `package.json` | 声明 `ableton-js` 依赖 |

## 分享这套技术时的几个要点

- **通道**:CLI ↔ AbletonJS Remote Script ↔ Live API,是本地 UDP,不联网。
- **无状态**:每条命令连接一次、执行、断开,天然适合被 AI 一条条调用。
- **可回读验证**:写完 `write-clip` 后用 `notes` 读回,让 AI 自我核对结果 —— 这是让 AI 可靠操作 DAW 的关键闭环。
- **破坏性操作要确认**:`delete-*`、`--overwrite`、`clear-notes` 不可逆,skill 里已要求 AI 先跟用户确认。

## 兼容性

针对 `ableton-js` v4、Ableton Live 11+ 编写。不同 Live 版本个别属性名可能有差异;若某命令报属性错误,查 `ableton-js` 对应版本文档并对照 `reference.md` 调整。
