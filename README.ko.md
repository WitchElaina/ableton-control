# ableton-control — Ableton Live를 AI로 조작하는 Skill

[English](./README.md) · [中文](./README.zh-CN.md) · **한국어**

**실행 중인** Ableton Live 세트를 AI가 직접 읽고 쓸 수 있게 해주는 독립형 [Claude Code](https://claude.com/claude-code) skill입니다. 곡/트랙/클립 상태 읽기, MIDI 클립과 노트 생성·편집, 템포·박자표 변경, 트랙 관리, 재생 제어, 클립/씬 실행까지 지원합니다.

내부적으로는 [`ableton-js`](https://github.com/leolabs/ableton-js)를 통해 Live와 통신합니다. `ableton-js`는 **MIDI Remote Script(컨트롤 서피스)**를 이용해 Live API를 Node로 노출합니다. AI가 `ableton-js` 코드를 직접 작성하지 않고, 이 폴더의 CLI(`bin/ableton.mjs`)를 호출하며, 모든 명령은 모델이 파싱하기 쉬운 JSON을 출력합니다.

## 설치

### 1. Skill 쪽: 의존성 설치

```bash
cd ableton-control
npm install                    # ableton-js 설치 (Remote Script도 함께 node_modules에 설치됨)
```

### 2. Ableton 쪽: AbletonJS MIDI Remote Script 설치

`ableton-js`는 **MIDI Remote Script(컨트롤 서피스)**로 Live와 통신하며, Max for Live 디바이스가 **아닙니다** — 따라서 Live Suite나 Max for Live가 필요하지 않습니다.

1. `node_modules/ableton-js/midi-script`를 Live의 Remote Scripts 폴더로 복사하고 이름을 `AbletonJS`로 바꿉니다. 최종 경로:
   `~/Music/Ableton/User Library/Remote Scripts/AbletonJS`
2. Live에서 **Settings → Link, Tempo & MIDI → Control Surface**로 가서 빈 슬롯에 **AbletonJS**를 선택합니다. (Live가 이미 실행 중이었다면 재시작하세요.)
3. Live를 실행 상태로 유지한 뒤 연결을 스모크 테스트합니다:

```bash
node bin/ableton.mjs status    # 템포 / 트랙 수가 출력되어야 함
```

### 3. Claude Code skill로 등록

Claude가 skill을 인식하는 위치에 이 폴더를 두면 됩니다. 둘 중 하나:

```bash
# A) 사용자 레벨 skills 디렉터리로 복사
cp -R ableton-control ~/.claude/skills/ableton-control

# B) 또는 심볼릭 링크(변경이 즉시 반영 — 개발용으로 편리)
ln -s "$(pwd)/ableton-control" ~/.claude/skills/ableton-control
```

이후 Claude Code에서 "템포를 128로 바꿔줘"나 "1번 트랙에 4마디짜리 베이스라인을 써줘"라고 말하면 이 skill을 자동으로 찾아 사용합니다. 프로젝트의 `.claude/skills/`에 넣어 저장소와 함께 배포할 수도 있습니다.

> 참고: 등록 후에는 `~/.claude/skills/ableton-control/node_modules`가 존재해야 합니다(실제 폴더에서 `npm install` 실행). 심볼릭 링크 방식은 같은 `node_modules`를 자동으로 공유합니다.

## 커맨드라인에서 직접 사용(AI 없이)

```bash
node bin/ableton.mjs help                    # 전체 명령
node bin/ableton.mjs tracks                   # 트랙 목록
node bin/ableton.mjs set-tempo 128
node bin/ableton.mjs write-clip 0 0 --length 4 \
  --notes '[{"pitch":60,"time":0,"duration":1},{"pitch":64,"time":1,"duration":1},{"pitch":67,"time":2,"duration":2}]'
node bin/ableton.mjs play
```

## 파일 설명

| 파일 | 역할 |
|------|------|
| `SKILL.md` | AI가 읽는 skill 명세(트리거 조건, 사용법, 노트 포맷, 안전 주의사항) |
| `bin/ableton.mjs` | 통합 CLI, 모든 읽기/쓰기 동작 구현 |
| `reference.md` | 전체 명령 레퍼런스 + ableton-js / Live API 매핑, 발표·공유용 |
| `package.json` | `ableton-js` 의존성 선언 |

## 이 기술을 공유할 때의 핵심 포인트

- **통신 채널**: CLI ↔ AbletonJS Remote Script ↔ Live API. 로컬 UDP이며 인터넷을 거치지 않습니다.
- **무상태(stateless)**: 각 명령이 연결 → 실행 → 종료로 완결됩니다. AI가 명령을 한 번에 하나씩 내리는 방식과 잘 맞습니다.
- **되읽기 검증**: `write-clip` 후 `notes`로 다시 읽어 AI가 결과를 스스로 확인합니다. 이 루프가 AI로 DAW를 안정적으로 다루는 핵심입니다.
- **파괴적 작업은 확인 필수**: `delete-*`, `--overwrite`, `clear-notes`는 되돌릴 수 없습니다. skill에는 AI가 먼저 사용자에게 확인하도록 명시되어 있습니다.

## 호환성

`ableton-js` v4, Ableton Live 11+ 기준으로 작성되었습니다. Live 버전에 따라 일부 속성 이름이 다를 수 있습니다. 명령이 속성 관련 오류를 낸다면 해당 `ableton-js` 문서를 확인하고 `reference.md`와 대조해 조정하세요.
