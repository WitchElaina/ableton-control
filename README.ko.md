# ableton-control — AI와 대화하며 Ableton Live 조작하기

[English](./README.md) · [中文](./README.zh-CN.md) · **한국어**

## 소개

**실행 중인** Ableton Live 세트를 평범한 말로 조작할 수 있게 해주는 [Claude Code](https://claude.com/claude-code)
skill입니다 — *"템포를 128로 바꿔줘"*, *"1번 트랙에 4마디 베이스라인 써줘"*, *"2번 클립
실행해줘"* 처럼요. Live 세트(클립, 노트, 템포, 트랙, 재생)를 대신 읽고 써주며, 코드는 전혀
건드리지 않습니다. Ableton Live 11+에서 동작하며, Live Suite나 Max for Live는 필요 없습니다.

## 설치 방법

걱정 마세요 — 개발자가 아니어도 괜찮습니다. 몇 단계면 됩니다:

1. **Node.js 설치** — [nodejs.org](https://nodejs.org)에서 LTS 버전을 받아 설치하세요
   (계속 next만 누르면 됩니다). 보통 여기서 많이 막히니, 문제가 생기면 편하게 연락 주세요.
2. **프로젝트 받기** — 저장소에서 이 프로젝트를 다운로드한 뒤, 폴더에서 터미널을 열고
   `npm install`을 실행하세요.
3. **Ableton에 연결** — `node_modules/ableton-js/midi-script` 폴더를 Live의 Remote Scripts
   폴더(`~/Music/Ableton/User Library/Remote Scripts`)로 복사하고 이름을 `AbletonJS`로
   바꾸세요. 그런 다음 Live에서 **Settings → Link, Tempo & MIDI → Control Surface**로 가서
   빈 슬롯에 **AbletonJS**를 선택하세요. Live는 실행 상태로 유지합니다.
4. **AI에 연결** — 이 폴더 전체를 `~/.claude/skills/`로 복사한 뒤, Claude Code에 원하는 것을
   말하면(*"템포를 128로 바꿔줘"*) 나머지는 알아서 처리합니다.

연결을 확인하려면 `node bin/ableton.mjs status`를 실행하세요 — 현재 템포와 트랙 수가
출력되어야 합니다.

이게 전부입니다! 어디서든 막히시면 언제든 연락 주세요. 기꺼이 도와드리겠습니다.
