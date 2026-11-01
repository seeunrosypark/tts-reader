# Markdown TTS Reader

마크다운(`.md`) 원고를 브라우저에서 열고, **문장 단위 하이라이트**와 함께 **edge-tts**로 읽어주는 로컬 웹 리더입니다.

- 문장 단위 TTS 재생 · 속도·볼륨·음성 조절 · 진행 바로 이동
- heading 기반 목차, 현재 섹션 표시
- 문장 클릭으로 그 위치부터 재생
- `Ctrl+B`로 **bold** 토글 → 연 원본 `.md` 파일에 바로 저장

---

## 빠른 시작

필요한 것: **Python 3.10+**, **Node.js 18+**, 인터넷 연결(edge-tts는 Microsoft 서버를 호출합니다).

```bash
# 의존성 설치 (macOS는 pip3)
pip install -r backend/requirements.txt
npm install
npm run install:frontend

# 백엔드(8000) + 프론트엔드(5173) 동시 실행
npm run dev
```

브라우저에서 **http://localhost:5173** 을 엽니다.

단위 테스트: `npm test` (vitest)

<details>
<summary>터미널 2개로 나눠 실행하기</summary>

```bash
# 터미널 1 — 백엔드
cd backend
python -m uvicorn main:app --reload --port 8000

# 터미널 2 — 프론트엔드
cd frontend
npm run dev
```

</details>

---

## 사용법

### 파일 열기

- 상단 바의 **열기** 버튼, 또는 `.md` 파일을 창에 **끌어다 놓기**
- UTF-8 인코딩 `.md` / `.markdown` 파일

### 화면 구성

| 영역 | 내용 |
|------|------|
| **상단 바** | 목차 토글 · 파일 이름 · 저장 상태 · 열기 · 단축키 도움말(`?`) |
| **목차** | 왼쪽 사이드바. 좁은 화면(900px 이하)에서는 서랍처럼 열림 |
| **본문** | 읽기 좋은 폭으로 가운데 정렬. 문장 클릭 시 그 문장부터 재생 |
| **하단 플레이어** | 진행 바 · 현재 섹션 · 이전/재생/다음/정지 · 문장 위치 · 음소거 · 속도/볼륨/음성 설정 |

### 단축키

| 키 | 동작 |
|----|------|
| `Space` | 재생 / 일시정지 / 이어 재생 |
| 문장 클릭 | 그 문장부터 재생 (재생 중이면 그 문장으로 이동) |
| 드래그 선택 후 재생 | 선택한 문장부터 재생 |
| 드래그 선택 후 `Ctrl+B` | `**bold**` 토글 → 원본 파일에 저장 |

### Ctrl+B 원본 저장

[File System Access API](https://developer.mozilla.org/docs/Web/API/File_System_API)로 연 파일에 직접 씁니다.

| 브라우저 | 저장 |
|----------|------|
| Chrome / Edge | ✅ 처음 저장할 때 브라우저가 **쓰기 권한**을 한 번 묻습니다 |
| Firefox / Safari | ❌ 화면에서만 바뀝니다 (상단 바에 "원본 미저장" 표시) |

### 장 퀴즈 (AI)

장을 정독했는지 4지선다 퀴즈로 확인합니다. 목차에서 장 제목에 마우스를 올리면 나오는 `퀴즈` 버튼이나, 장 완료 알림의 `퀴즈 풀기`로 엽니다.

- 백엔드가 그 장의 본문을 Claude(`claude-opus-5-5`)에 보내 문제를 만듭니다. 장 하나에 보통 몇 센트가 듭니다.
- 장마다 최고 점수가 목차에 표시되고, 처음 만점을 받으면 경험치 +40과 🧠 정독 인증 배지를 줍니다.
- 같은 장을 다시 열면 페이지를 새로 고치기 전까지 만든 문제를 다시 씁니다. `새 문제 만들기`를 누르면 새로 만듭니다.

Claude API 키가 필요합니다. 키는 백엔드에서만 쓰고 브라우저로 보내지 않습니다. 같은 터미널에서 키를 설정하고 서버를 켜세요.

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."   # macOS/Linux: export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

키가 없으면 퀴즈 창에 안내가 나오고, 나머지 기능은 그대로 동작합니다.

---

## TTS 설정

| 항목 | 범위 | 기본값 |
|------|------|--------|
| 음성 | `ko-KR` 음성 목록 | `ko-KR-SunHiNeural` |
| 속도 | 0.5x ~ 4.0x | 2.0x |
| 볼륨 | 0% ~ 100% | 50% |

설정은 브라우저 `localStorage`(`tts-reader-voice`, `tts-reader-speed`, `tts-reader-volume`)에 저장됩니다. 목차 접기 상태도 `tts-reader-toc-*` 키에 저장됩니다. 지우면 기본값으로 돌아갑니다.

코드 블록과 번역 메타 텍스트는 읽지 않습니다.

---

## 구조

```
브라우저 (React + Vite, :5173)
   │  .md 파일은 브라우저에서 직접 열고 저장
   │
   └─ /api (Vite proxy) ─→ FastAPI (:8000) ─┬→ edge-tts ─→ Microsoft TTS
                                           └→ Claude API (장 퀴즈)
```

| API | 설명 |
|-----|------|
| `GET /api/voices?locale=ko-KR` | 음성 목록 |
| `POST /api/tts` | 문장 → MP3 (`text`, `voice`, 선택 `rate`). 앱은 기본 속도로 합성하고 재생 속도는 브라우저에서 조절 |
| `POST /api/quiz` | 장 본문 → 4지선다 퀴즈 JSON (`title`, `text`, 선택 `count` 3~10). `ANTHROPIC_API_KEY` 필요 |

```
tts-reader/
├── backend/                FastAPI + edge-tts + Claude API
│   ├── main.py
│   ├── quiz_service.py
│   └── tts_service.py
├── frontend/src/
│   ├── App.tsx
│   ├── api/                ttsClient, quizClient
│   ├── components/         TopBar, TableOfContents, MarkdownViewer, PlayerControls, SettingsPanel
│   ├── hooks/              useTtsPlayer, useKeyboardShortcuts, useDismiss
│   └── utils/              마크다운 파싱·문장 분리·파일 열기/저장
└── scripts/run-backend.js  npm run dev용 백엔드 실행기
```

---

## 문제 해결

### `WinError 10013` — 포트 8000 사용 중

```powershell
netstat -ano | findstr :8000
Stop-Process -Id <PID> -Force
```

다른 포트를 쓰려면 `frontend/vite.config.ts`의 proxy target도 같이 바꿔야 합니다.

### TTS가 재생되지 않음

- 백엔드(`localhost:8000`)가 실행 중인지 확인
- 인터넷 연결 확인
- 브라우저 개발자 도구 Network 탭에서 `/api/tts` 오류 확인

### Ctrl+B가 원본에 저장되지 않음

- Chrome 또는 Edge에서 **열기** 버튼이나 드래그로 다시 열기
- 쓰기 권한 요청을 거부했다면 다시 Ctrl+B를 눌러 권한 허용
