# Markdown TTS Reader

마크다운(`.md`) 원고를 브라우저에서 열고, **문장 단위 하이라이트**와 함께 **edge-tts**로 읽어주는 로컬 웹 리더입니다.

- TTS 재생 · 속도·볼륨·음성 조절
- heading 기반 목차 · 섹션 이동
- `Space` 재생/일시정지 · `Ctrl+B` bold 편집
- 폴더 내 `.md` 읽기/저장 또는 로컬 파일 선택

---

## 목차

1. [사용 조건](#사용-조건)
2. [빠른 시작](#빠른-시작)
3. [기술 스택](#기술-스택)
4. [기능 요약](#기능-요약)
5. [TTS 재생](#tts-재생)
6. [키보드 단축키 (Space / Ctrl+B)](#키보드-단축키-space--ctrlb)
7. [마크다운 파일 열기](#마크다운-파일-열기)
8. [API](#api)
9. [프로젝트 구조](#프로젝트-구조)
10. [문제 해결](#문제-해결)

---

## 사용 조건

### 사전 설정 조건

| 조건 | 내용 |
|------|------|
| **목적** | 마크다운 원고를 **눈으로 읽으면서** TTS로 **문장 단위** 듣기 |
| **파일 형식** | UTF-8 인코딩 `.md` 파일 |
| **실행 환경** | 로컬 PC (Windows / macOS / Linux) |
| **네트워크** | TTS 사용 시 **인터넷 연결 필수** (Microsoft TTS 서버 호출) |
| **동시 실행** | **백엔드 + 프론트엔드** 두 프로세스를 함께 실행해야 함 |

### 필수 소프트웨어

| 항목 | 최소 버전 | 용도 |
|------|-----------|------|
| **Python** | 3.10+ | FastAPI 백엔드, edge-tts |
| **Node.js** | 18+ | React 프론트엔드 (Vite) |
| **pip** / **pip3** | — | Python 패키지 설치 (macOS는 **`pip3`** 사용, 아래 참고) |
| **npm** | — | Node 패키지 설치 |

### 권장 브라우저

| 브라우저 | 지원 |
|----------|------|
| Chrome / Edge (Chromium) | ✅ 권장 |
| Firefox | ✅ |
| Safari | ⚠️ 대부분 동작, 미검증 |

필요 API: `fetch`, `HTMLAudioElement`, `localStorage`, `FileReader`, DOM Selection API

### 실행 시 필요한 포트

| 서비스 | 포트 | URL |
|--------|------|-----|
| FastAPI (백엔드) | **8000** | `http://localhost:8000` |
| Vite (프론트엔드) | **5173** | `http://localhost:5173` ← **브라우저에서 접속** |

포트 8000이 이미 사용 중이면 [문제 해결](#winerror-10013--포트-8000-사용-중) 참고.

### TTS 사용 조건

| 항목 | 설명 |
|------|------|
| **엔진** | [edge-tts](https://github.com/rany2/edge-tts) (Microsoft Edge Neural TTS, 무료) |
| **API 키** | 불필요 |
| **오프라인** | ❌ TTS 불가 (합성 요청마다 Microsoft 서버 접속) |
| **기본 음성** | `ko-KR-SunHiNeural` (설정에서 변경 가능) |
| **기본 속도** | 2.0x (0.5x ~ 4.0x) |
| **기본 볼륨** | 50% (0% ~ 100%) |

### 마크다운 파일 조건

| 항목 | 지원 | 비고 |
|------|------|------|
| **폴더 내 파일** | ✅ | `TTS_READER_BOOK_DIR` 또는 기본 폴더의 직속 `*.md` |
| **로컬 파일 선택** | ✅ | PC 임의 경로, 브라우저에서 읽기 |
| **하위 폴더** | ❌ | `BOOK_DIR/sub/file.md`는 목록에 안 나옴 |
| **Ctrl+B 저장** | 폴더 내 파일만 ✅ | 로컬 파일 선택은 화면만 변경 |
| **대용량 파일** | ⚠️ | 수만 줄 `.md`는 로딩·파싱이 느릴 수 있음 |

### 사용할 수 없는 경우

- **인터넷 없이** TTS 재생
- 브라우저만 실행하고 백엔드 없이 **폴더 내 파일 읽기/저장**
- `.md`가 아닌 파일 (`.txt`, `.docx` 등)
- **배포된 원격 서버**에서 사용자 PC의 임의 경로 파일 접근 (브라우저 보안 제한)
- 문장 단위가 아닌 **단어/글자 단위 karaoke** 동기화

### 설정 저장 (localStorage)

브라우저 `localStorage`에 아래 값이 저장됩니다. 삭제하면 기본값으로 돌아갑니다.

| 키 | 기본값 |
|----|--------|
| `tts-reader-voice` | `ko-KR-SunHiNeural` |
| `tts-reader-speed` | `2.0` |
| `tts-reader-volume` | `0.5` (50%) |
| `tts-reader-toc-collapsed` | 목차 사이드바 접기 상태 |
| `tts-reader-toc-sections-collapsed` | 목차 아코디언 접기 상태 |

---

## 빠른 시작

### 1. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/seeunrosypark/tts-reader.git
cd tts-reader

# Python (Windows / Linux — pip)
pip install -r backend/requirements.txt

# Node (루트 + 프론트엔드)
npm install
npm run install:frontend
```

#### macOS

macOS에는 Python 2용 `pip`와 Python 3용 **`pip3`**가 구분되는 경우가 많습니다. **`pip3`를 사용**하세요.

```bash
git clone https://github.com/seeunrosypark/tts-reader.git
cd tts-reader

pip3 install -r backend/requirements.txt

npm install
npm run install:frontend
```

> `pip3: command not found`이면 [python.org](https://www.python.org/downloads/)에서 Python 3.10+를 설치하거나 Homebrew로 `brew install python` 후 다시 시도하세요.  
> 가상환경을 쓰는 경우: `python3 -m venv .venv` → `source .venv/bin/activate` → `pip install -r backend/requirements.txt`

### 2. 실행

#### 한 번에 실행 (권장, 터미널 1개)

루트 `package.json`의 `concurrently`로 **백엔드 + 프론트엔드를 동시에** 실행합니다.

```bash
cd tts-reader
npm run dev
```

- 백엔드: `http://localhost:8000`
- 프론트엔드: `http://localhost:5173` ← **브라우저에서 접속**
- `Ctrl+C` 한 번으로 둘 다 종료

> **사전 조건:** §1의 Python·Node 의존성 설치가 끝나 있어야 합니다.

#### 터미널 2개로 나눠 실행

백엔드를 실행하기 **전에** Python 라이브러리를 설치해야 합니다 (`backend/requirements.txt`).

**Windows (PowerShell / CMD)**

```powershell
# 터미널 1 — 백엔드
cd tts-reader/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 터미널 2 — 프론트엔드
cd tts-reader/frontend
npm install
npm run dev
```

**macOS**

```bash
# 터미널 1 — 백엔드 (macOS는 pip3 사용)
cd tts-reader/backend
pip3 install -r requirements.txt
uvicorn main:app --reload --port 8000
# uvicorn을 찾지 못하면:
# python3 -m uvicorn main:app --reload --port 8000

# 터미널 2 — 프론트엔드
cd tts-reader/frontend
npm install
npm run dev
```

**Linux**

```bash
# 터미널 1 — 백엔드
cd tts-reader/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 터미널 2 — 프론트엔드
cd tts-reader/frontend
npm install
npm run dev
```

**설치되는 Python 패키지** (`requirements.txt`):

| 패키지 | 용도 |
|--------|------|
| `fastapi` | REST API 서버 |
| `uvicorn[standard]` | ASGI 실행 서버 |
| `edge-tts` | TTS 음성 합성 |
| `pydantic` | 요청/응답 데이터 검증 |

이미 설치했다면 `pip install` / `pip3 install` 단계는 건너뛰고 `uvicorn`부터 실행하면 됩니다.

브라우저에서 **`http://localhost:5173`** 을 엽니다.

### 3. 마크다운 폴더 지정 (선택)

기본값은 `tts-reader/` **상위 폴더**입니다. 다른 폴더를 쓰려면 백엔드 실행 전에:

```powershell
# Windows PowerShell
cd tts-reader/backend
pip install -r requirements.txt
$env:TTS_READER_BOOK_DIR = "C:\Users\you\Documents\notes"
$env:TTS_READER_DEFAULT_FILE = "intro.md"   # 선택: 시작 시 자동 로드
uvicorn main:app --reload --port 8000
```

```bash
# macOS / Linux
cd tts-reader/backend
pip3 install -r requirements.txt          # Linux: pip install
export TTS_READER_BOOK_DIR="$HOME/Documents/notes"
export TTS_READER_DEFAULT_FILE="intro.md"
uvicorn main:app --reload --port 8000
```

### 4. 기본 사용 흐름

1. **폴더 내 파일** 드롭다운 또는 **로컬 파일**로 `.md` 열기
2. **재생** 또는 `Space`로 TTS 시작
3. 좌측 **목차**로 섹션 이동
4. 텍스트 선택 후 `Ctrl+B`로 bold 편집 (폴더 내 파일은 자동 저장)

---

## 기술 스택

### 한눈에 보기

| 계층 | 기술 | 버전 (대표) | 역할 |
|------|------|-------------|------|
| 앱 형태 | 웹 앱 (SPA) | — | 브라우저 UI, 로컬 개발·실행 |
| 프론트엔드 | React + Vite + TypeScript | React 19, Vite 6, TS 5.7 | UI, 하이라이트, 플레이어 |
| 마크다운 | marked + DOMPurify | marked 15, DOMPurify 3 | `.md` → HTML, XSS 방어 |
| 백엔드 | FastAPI + uvicorn | FastAPI 0.115+, uvicorn 0.32+ | REST API, 파일 I/O |
| TTS | edge-tts | 7.0+ | Neural 음성 mp3 합성 |
| 오디오 | HTMLAudioElement | 브라우저 내장 | 문장별 mp3 재생·동기화 |
| 검증 | Pydantic | 2.0+ | API 요청/응답 스키마 |

프론트엔드와 백엔드를 분리한 이유: **edge-tts는 Python 전용**이며, 브라우저만으로는 동일 품질의 Neural TTS를 쓸 수 없기 때문입니다.

### 아키텍처

```
브라우저 (React + Vite, :5173)
  ├─ marked + DOMPurify  →  마크다운 렌더 + 문장 span
  ├─ HTMLAudioElement    →  mp3 재생 / 볼륨 / 일시정지
  └─ fetch /api/*  ──────────→  FastAPI (:8000)
                                    ├─ edge-tts     → TTS mp3
                                    └─ BOOK_DIR     → .md 읽기/쓰기
```

Vite dev server가 `/api/*`를 FastAPI(`localhost:8000`)로 **proxy**합니다.

### 프론트엔드 의존성

```json
// frontend/package.json (주요)
"react": "^19.0.0"
"marked": "^15.0.7"
"dompurify": "^3.2.4"
"vite": "^6.1.0"
"typescript": "^5.7.3"
```

| 라이브러리 | 선택 이유 |
|------------|-----------|
| **React 19** | 문장 하이라이트·플레이어 상태를 컴포넌트/훅으로 분리 |
| **Vite 6** | 빠른 HMR, proxy 설정으로 백엔드 연동 간단 |
| **TypeScript** | 문장 인덱스, API 타입, 목차 트리 타입 안전성 |
| **marked** | 가벼운 md→HTML, 문장 span 래핑 파이프라인에 적합 |
| **DOMPurify** | `dangerouslySetInnerHTML` XSS 방어 |

### 백엔드 의존성

```txt
# backend/requirements.txt
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
edge-tts>=7.0.0
pydantic>=2.0.0
```

| 라이브러리 | 선택 이유 |
|------------|-----------|
| **FastAPI** | async 라우트, Pydantic 검증, OpenAPI 자동 생성 |
| **uvicorn** | ASGI 서버, `--reload` 개발 편의 |
| **edge-tts** | 무료 Microsoft Neural TTS, 한국어 품질 우수 |
| **Pydantic** | TTS 요청·파일 저장 body 검증 |

### 주요 기술 선택 vs 대안

| 영역 | 선택 | 대안 | 미선택 이유 |
|------|------|------|-------------|
| 앱 형태 | 웹 앱 | Electron, VS Code 확장, Python GUI | 설치 부담·UI 자유도·DOM 하이라이트 구현 비용 |
| TTS | edge-tts | Web Speech API, Azure TTS, gTTS | 품질 편차 / 유료 / 음질 낮음 |
| 프론트 | React + Vite | Vanilla JS, Next.js | 상태 관리 복잡도 / SSR 불필요 |
| 마크다운 | marked | react-markdown, MDX | 문장 span 커스터마이즈 복잡 / JSX 불필요 |
| 백엔드 | FastAPI | Flask, Node.js | async edge-tts / Python TTS 라이브러리 |
| 오디오 | HTMLAudioElement | Web Audio API | 문장 순차 재생에 충분, 구현 단순 |

### 트레이드오프

| 항목 | 내용 |
|------|------|
| **인터넷 필수** | edge-tts → Microsoft 서버. 오프라인 TTS 미지원 |
| **로컬 전용 설계** | 기본적으로 localhost 개발·실행. 별도 배포 설정 없음 |
| **문장 단위 동기화** | TTS 길이와 글자 수 1:1 karaoke는 미지원. `ended` 이벤트 기반 순차 재생 |
| **폴더 1단계** | `BOOK_DIR` 직속 `.md`만. 하위 폴더 재귀 검색 없음 |

---

## 기능 요약

| 영역 | 기능 |
|------|------|
| **TTS 재생** | 문장 단위 순차 재생, 하이라이트, Play / Pause / Stop, 이전·다음 문장 |
| **TTS 설정** | 속도(0.5x~4.0x), 볼륨(0~100%), 한국어 음성 — 설정 패널 |
| **목차** | heading 트리, 아코디언 접기/펼치기, 섹션 이동 |
| **편집** | `Ctrl+B`로 `**bold**` 토글, 폴더 내 파일은 `.md` 저장 |
| **UI** | 코드 블록·heading·인용 등 마크다운 렌더, 재생 섹션 sticky heading |
| **단축키** | `Space` 재생/일시정지, `Ctrl+B` bold |

---

## TTS 재생

- **재생** 버튼 또는 `Space`로 재생/일시정지
- 한 문장 TTS 종료 → 다음 문장 자동 진행
- 재생 중 문장: 노란색 하이라이트 + 화면 중앙 스크롤
- 코드 블록, 메타 텍스트(`Skip to Content` 등)는 TTS 제외

### 선택 영역부터 재생

텍스트 드래그 후 **재생** 또는 `Space` → 선택 시작 **문장**부터 재생. 선택 없으면 첫 문장부터.

### TTS 설정 (기본값)

| 항목 | 범위 | 기본값 | 저장 |
|------|------|--------|------|
| 속도 | 0.5x ~ 4.0x | **2.0x** | `localStorage` |
| 볼륨 | 0% ~ 100% | **50%** | `localStorage` |
| 음성 | ko-KR Neural 등 | SunHi | `localStorage` |

- 속도 변경: **다음 문장부터** 적용
- 볼륨: `HTMLAudioElement.volume` 즉시 반영
- 플레이어 **설정** 버튼 → 속도·볼륨·음성 패널 (sticky heading 위에 표시)

### 목차 (TOC)

- heading(`##`~`######`) 트리, ▶/▼ 아코디언, 전체 펼치기/접기
- 클릭 → heading 스크롤 + 재생 중이면 해당 섹션부터 TTS
- 사이드바 접기 (`◀ 접기` / `목차 ▶`), 상태 `localStorage` 저장

### 재생 섹션 heading (sticky)

재생·일시정지 중 현재 섹션 제목이 플레이어 아래 고정. **정지** 시 사라짐.

### 마크다운 UI

| 요소 | 표시 |
|------|------|
| 코드 블록 | 다크 테마, mono, 언어 badge |
| Heading h1~h6 | 계층별 크기 |
| 인용문 | 좌측 border + 연한 배경 |
| bold / italic / code / link | inline 서식 보존 |
| 목록 / 표 / hr | 각각 스타일 |

---

## 키보드 단축키 (Space / Ctrl+B)

본문 영역에서 사용. **input / select / textarea** 포커스 시에는 동작하지 않습니다.

### Space — 재생 / 일시정지 / 이어 재생

| 현재 상태 | Space 동작 |
|-----------|------------|
| **정지** | 선택 있음 → 그 문장부터 / 없음 → 첫 문장부터 |
| **재생 중** | **일시정지** (하이라이트 유지) |
| **일시정지** | **이어 재생** |

| 동작 | Space | 재생 버튼 | 정지 버튼 |
|------|-------|----------|----------|
| 재생 시작 | ✅ | ✅ | — |
| 일시정지 | ✅ | ✅ | — |
| 완전 정지 (하이라이트 해제) | ❌ | — | ✅ |

- 코드 블록·본문 밖 선택 → 첫 문장부터 재생
- Space는 스크롤 방지를 위해 `preventDefault` 처리

### Ctrl+B — Bold 토글

1. 본문 텍스트 **드래그 선택**
2. `Ctrl+B` → 원문에 `**텍스트**` 추가, 화면 **굵게**
3. 이미 `**...**` → bold **해제**

| 파일 열기 방식 | 저장 |
|----------------|------|
| **폴더 내 파일** | ✅ `.md` 디스크 저장 |
| **로컬 파일** | ❌ 화면만 |

- 재생 중에도 사용 가능, 하이라이트 유지
- 코드 블록 안 선택 · 선택 없음 → 동작 없음

### 단축키 요약

| 단축키 | 동작 |
|--------|------|
| `Space` | 재생 ↔ 일시정지 ↔ 이어 재생 |
| `Ctrl+B` | 선택 텍스트 `**bold**` 토글 |

---

## 마크다운 파일 열기

### 두 가지 방식

| 방식 | 설명 | Ctrl+B 저장 |
|------|------|-------------|
| **폴더 내 파일** | `BOOK_DIR`의 `.md` 목록 | ✅ |
| **로컬 파일** | 브라우저 파일 선택 | ❌ |

### 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `TTS_READER_BOOK_DIR` | 아니오 | 읽기·저장 폴더 (절대/상대 경로) |
| `TTS_READER_DEFAULT_FILE` | 아니오 | 시작 시 자동 로드 파일명 |

기본 `BOOK_DIR`: `tts-reader/` 상위 폴더. `TTS_READER_BOOK_DIR` 미설정 시 `4.md`가 있으면 자동 로드.

### 파일 위치

```
[BOOK_DIR]/          ← TTS_READER_BOOK_DIR 또는 기본값
├── note-a.md
├── note-b.md
└── ...
```

- **직속** `*.md`만 (하위 폴더 ❌)
- UI에 **읽기 폴더** 경로 표시
- `GET /api/config`로 현재 설정 확인

### 읽기 흐름

```
[폴더 내 파일]  →  GET /api/files/{filename}  →  BOOK_DIR/*.md
[로컬 파일]     →  FileReader (브라우저)     →  임의 경로
         ↓
   렌더링 → 문장 span → TTS / 목차 / 편집
```

### 제한 사항

- 하위 폴더 미지원
- `../` 경로 탐색 차단
- 로컬 파일 경로는 서버에 전달 불가 (브라우저 보안)
- 대용량 `.md`는 로딩 느릴 수 있음

---

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/config` | 읽기 폴더·기본 파일 설정 |
| GET | `/api/voices?locale=ko-KR` | 음성 목록 |
| POST | `/api/tts` | TTS 합성 (`text`, `voice`, `rate`) → `audio/mpeg` |
| GET | `/api/files` | `BOOK_DIR`의 `.md` 목록 |
| GET | `/api/files/{filename}` | 마크다운 내용 |
| PUT | `/api/files/{filename}` | 마크다운 저장 (`content`) |

---

## 프로젝트 구조

```
tts-reader/
├── package.json             # npm run dev — 백엔드+프론트 동시 실행
├── scripts/
│   └── run-backend.js       # python3/python으로 uvicorn 실행
├── backend/
│   ├── main.py              # FastAPI, CORS, 파일/TTS API
│   ├── tts_service.py       # edge-tts 래퍼
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/ttsClient.ts
│   │   ├── components/
│   │   │   ├── FileSelector.tsx
│   │   │   ├── MarkdownViewer.tsx
│   │   │   ├── PlayerControls.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── StickySectionHeading.tsx
│   │   │   └── TableOfContents.tsx
│   │   ├── hooks/
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   └── useTtsPlayer.ts
│   │   ├── utils/
│   │   │   ├── markdownBold.ts
│   │   │   ├── markdownPlainMapper.ts
│   │   │   ├── markdownToSentences.ts
│   │   │   ├── sentenceSplitter.ts
│   │   │   ├── tocTree.ts
│   │   │   └── wrapSentenceSpans.ts
│   │   └── App.tsx
│   ├── vite.config.ts         # /api → localhost:8000 proxy
│   └── package.json
├── .gitignore
└── README.md
```

---

## 문제 해결

### `WinError 10013` — 포트 8000 사용 중

```powershell
netstat -ano | findstr :8000
Stop-Process -Id <PID> -Force
uvicorn main:app --reload --port 8000
```

다른 포트(예: 8001) 사용 시 `frontend/vite.config.ts`의 proxy target도 맞춰야 합니다.

### TTS가 재생되지 않음

- 백엔드(`localhost:8000`) 실행 여부 확인
- 인터넷 연결 확인 (edge-tts는 Microsoft 서버 필요)
- 브라우저 개발자 도구 Network 탭에서 `/api/tts` 오류 확인

### 볼륨/속도가 기본값이 아님

브라우저 `localStorage`에서 `tts-reader-volume`, `tts-reader-speed` 키 삭제 후 새로고침.

### 폴더 내 파일이 목록에 없음

- `TTS_READER_BOOK_DIR` 경로 확인
- 해당 폴더 **직속** `.md`인지 확인 (하위 폴더 제외)
- UI **읽기 폴더** 표시와 `GET /api/config` 응답 비교

---

## 참고

- 코드 블록·번역 메타 텍스트는 TTS에서 제외
- 오프라인 TTS 미지원
- MIT 등 라이선스 파일은 저장소 정책에 따름
