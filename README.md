# Markdown TTS Reader

마크다운 원고를 브라우저에서 열고, 문장 단위 하이라이트와 함께 edge-tts로 읽어주는 웹 리더입니다.

## 실행 방법

### 1. 백엔드

```bash
cd tts-reader/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. 프론트엔드

```bash
cd tts-reader/frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 을 엽니다.

## 기술 스택

### 개요

| 계층 | 선택 | 역할 |
|------|------|------|
| 앱 형태 | **웹 앱** (브라우저) | 마크다운 표시, TTS 재생, 편집 UI |
| 프론트엔드 | **React + Vite + TypeScript** | UI, 문장 하이라이트, 플레이어 상태 관리 |
| 마크다운 | **marked + DOMPurify** | `.md` → HTML 변환 및 XSS 방어 |
| 백엔드 | **Python FastAPI + uvicorn** | TTS API, 로컬 `.md` 파일 읽기/저장 |
| TTS | **edge-tts** | Microsoft Neural 음성 합성 (무료) |
| 오디오 | **HTMLAudioElement** | 문장별 mp3 blob 재생, 볼륨·일시정지 제어 |

프론트엔드와 백엔드를 분리한 이유는 **edge-tts가 Python 전용**이기 때문입니다. 브라우저만으로는 고품질 Neural TTS를 쓸 수 없어, TTS 합성은 백엔드에 두고 UI는 React로 구성했습니다.

---

### 앱 형태: 웹 앱

**선택 이유**

- 책 원고(`.md`)를 브라우저에서 바로 열고 읽을 수 있음
- 별도 설치·배포 없이 `npm run dev` + `uvicorn`으로 로컬 개발 가능
- 마크다운 렌더링, 스크롤, 텍스트 선택, 키보드 단축키 등 UI 요구에 브라우저 DOM API가 적합
- 문장 단위 `<span>` 하이라이트, sticky heading, 목차 사이드바 등을 CSS·React로 구현하기 쉬움

**장점**

- 크로스 플랫폼 (Windows / macOS / Linux 동일 코드)
- Hot reload(Vite)로 UI 수정·확인이 빠름
- `<input type="file">`로 로컬 `.md` 선택, FastAPI로 장별 프리셋 파일 제공을 동시에 지원

| 대안 | 미선택 이유 |
|------|-------------|
| **Electron (데스크톱)** | 설치 패키징·업데이트·용량 부담. TTS만 Python이 필요한데 전체 앱을 Chromium으로 감쌀 필요 없음 |
| **VS Code / Cursor 확장** | 에디터 API에 종속되고, 마크다운 뷰어·플레이어 UI를 자유롭게 만들기 어려움. 독립 실행·공유가 불편 |
| **Python GUI (Tkinter / PyQt)** | 문장 하이라이트·스크롤 동기화·목차 트리 UI를 웹 대비 구현 비용이 큼. 마크다운 렌더링 생태계도 약함 |

---

### TTS 엔진: edge-tts

**선택 이유**

- **무료**로 Microsoft Edge TTS(Neural) 음성 사용
- 한국어 품질 우수 (`ko-KR-SunHiNeural`, `ko-KR-InJoonNeural` 등)
- Python 공식 라이브러리(`edge-tts`)로 FastAPI와 자연스럽게 연동
- 속도(`rate`)·음성 목록 API가 문서화되어 있어 플레이어 설정 UI와 맞음

**장점**

- Azure 유료 API와 동일 계열 Neural 음성을 API 키 없이 사용
- 문장 단위 mp3 blob 반환 → `HTMLAudioElement`로 재생·종료 이벤트(`ended`)에 맞춰 하이라이트 동기화 가능
- 음성 목록을 동적으로 조회해 UI 드롭다운에 반영

| 대안 | 미선택 이유 |
|------|-------------|
| **Web Speech API** | 브라우저·OS마다 음성·품질 편차가 큼. Neural급 한국어 품질 보장 어려움. 백엔드 없이 쓸 수 있지만 **음질 일관성**이 요구사항에 맞지 않음 |
| **Azure Cognitive Services TTS** | 고품질이지만 **유료**·API 키·과금 설정 필요. 개인 원고 리더 MVP에는 과함 |
| **gTTS / pyttsx3 등** | 무료이나 Neural 대비 자연스러움·한국어 품질이 낮음 |

**트레이드오프:** edge-tts는 **인터넷 연결 필수**(Microsoft 서버 호출). 오프라인 TTS는 현재 범위 밖입니다.

---

### 프론트엔드: React + Vite + TypeScript

**선택 이유**

- **문장 하이라이트**처럼 DOM 상태와 재생 상태를 함께 다루는 UI에 React의 컴포넌트·훅 모델이 적합
- `useTtsPlayer`, `useKeyboardShortcuts` 등 **재생 로직을 훅으로 분리**하기 좋음
- TypeScript로 문장 인덱스, API 응답, 목차 트리 타입을 명확히 관리
- Vite는 개발 서버·HMR이 빠르고, `vite.config.ts` proxy로 FastAPI(8000) 연동이 단순

**장점**

- 컴포넌트 단위 분리: `PlayerControls`, `MarkdownViewer`, `TableOfContents`, `SettingsPanel` 등
- `useLayoutEffect`로 HTML 재주입 후 하이라이트 복원 같은 DOM 타이밍 제어
- 빌드(`npm run build`)로 정적 배포 가능

| 대안 | 미선택 이유 |
|------|-------------|
| **Vanilla HTML/CSS/JS** | MVP는 가능하나, 플레이어·목차·설정·sticky heading이 늘어날수록 **상태 관리·재사용**이 어려워짐 |
| **Vue / Svelte** | 동일하게 가능. React는 컴포넌트 생태계·DOM 제어 패턴이 널리 쓰이고, 팀/개인 선호에 맞춰 선택 |
| **Next.js 등 SSR 프레임워크** | 로컬 개발용 리더에 서버 렌더링·라우팅이 필요 없음. Vite SPA가 더 가벼움 |

---

### 마크다운 렌더링: marked + DOMPurify

**선택 이유**

- `marked`: 가벼운 마크다운 → HTML 변환. 커스텀 렌더러 없이도 heading·코드 블록·표 등 기본 요소 지원
- 변환된 HTML 위에 **문장 span 래핑**(`wrapSentenceSpans.ts`)을 적용하는 2단계 파이프라인에 맞음
- `DOMPurify`: `dangerouslySetInnerHTML` 사용 시 XSS 방어

**장점**

- 의존성 2개로 마크다운 UI 요구(코드 블록, heading, blockquote, bold 등) 충족
- HTML DOM을 직접 순회해 TTS용 plain text 매핑(`markdownPlainMapper.ts`) 가능
- React Markdown 컴포넌트 대비 **span 래핑·하이라이트 제어**를 low-level에서 다루기 쉬움

| 대안 | 미선택 이유 |
|------|-------------|
| **react-markdown + remark/rehype** | AST 기반으로 안전하지만, 문장 단위 `<span data-index>` 래핑을 커스터마이즈하려면 **플러그인·파이프라인 설계**가 더 복잡 |
| **markdown-it** | marked와 유사. marked로 충분하고 API가 단순 |
| **MDX** | JSX 임베드가 필요 없음. 순수 `.md` 원고 읽기만 하면 됨 |

---

### 백엔드: Python FastAPI + uvicorn

**선택 이유**

- `edge-tts`가 **Python async** 라이브러리 → 같은 런타임에서 TTS 호출이 자연스러움
- FastAPI는 async 라우트, Pydantic 검증, OpenAPI 문서를 기본 제공
- `GET/PUT /api/files/{filename}`로 장별 `.md` 읽기·저장(Ctrl+B bold 편집)을 간단히 구현

**장점**

- 엔드포인트 5개 수준의 소규모 API에 보일러플레이트 최소
- `uvicorn --reload`로 백엔드 수정 즉시 반영
- CORS 설정 한 곳으로 프론트(Vite 5173)와 연동

| 대안 | 미선택 이유 |
|------|-------------|
| **Flask** | 동기 중심. edge-tts async 호출 시 `asyncio` 래핑 필요. FastAPI가 async·타입 힌트 면에서 유리 |
| **Node.js (Express 등)** | edge-tts 공식 Python 라이브러리 사용 불가. Node용 비공식 래퍼에 의존하거나 별도 Python 프로세스 호출 필요 |
| **서버리스 (Lambda 등)** | 로컬 `.md` 파일 읽기/쓰기·개발 편의성과 맞지 않음. 개인 로컬 리더 목적에 과함 |

---

### 오디오 재생: HTMLAudioElement

**선택 이유**

- 백엔드가 반환하는 **mp3 blob**을 `URL.createObjectURL` + `new Audio()`로 바로 재생
- `ended` 이벤트로 **한 문장 재생 완료 → 다음 문장** 순차 진행 및 하이라이트 동기화
- `volume`, `pause()`, `currentTime`으로 볼륨·일시정지 UI 구현

**장점**

- Web Audio API 대비 구현 단순 (문장 단위 순차 재생에는 충분)
- 브라우저 기본 지원, 추가 라이브러리 불필요

| 대안 | 미선택 이유 |
|------|-------------|
| **Web Audio API (AudioContext)** | 세밀한 타이밍·이펙트에는 유리하나, 문장별 mp3 재생·ended 감지만 필요한 현재 요구에는 **과한 복잡도** |
| **Howler.js 등** | 스프라이트·게임 사운드에 유리. 단순 TTS 재생에는 HTMLAudioElement로 충분 |

---

### 아키텍처 요약

```
브라우저 (React)
  ├─ marked + DOMPurify → 마크다운 렌더 + 문장 span
  ├─ HTMLAudioElement → mp3 재생 / 볼륨 / 일시정지
  └─ fetch → FastAPI (localhost:8000)
                ├─ edge-tts → TTS mp3 합성
                └─ 로컬 BOOK_DIR → .md 읽기/쓰기
```

Vite dev server는 `/api/*` 요청을 FastAPI로 **proxy**하여 CORS·포트 분리 문제를 줄입니다.

## 기능 요약

| 영역 | 기능 |
|------|------|
| TTS 재생 | 문장 단위 순차 재생, 하이라이트, Play / Pause / Stop, 이전·다음 문장 |
| TTS 설정 | 속도(0.5x~4.0x), 볼륨(0~100%), 한국어 음성 선택 — 설정 패널에서 조절 |
| 목차 | heading 기반 트리 목차, 아코디언 접기/펼치기, 섹션 이동 |
| 편집 | 선택 텍스트 `**bold**` 토글 후 `.md` 파일 저장 |
| UI | 마크다운 렌더링(코드 블록·heading·인용 등), 재생 섹션 heading sticky |

## TTS 재생

- 재생 버튼 또는 `Space`로 재생/일시정지
- 한 문장 TTS가 끝나면 다음 문장으로 자동 진행
- 재생 중인 문장은 노란색으로 하이라이트되며 화면 중앙으로 스크롤
- 코드 블록, 번역 메타 텍스트(`Skip to Content` 등)는 TTS에서 제외

### 선택 영역부터 재생

텍스트를 드래그로 선택한 뒤 **재생** 버튼 또는 `Space`를 누르면, 선택 시작 위치의 문장부터 재생합니다. 선택이 없으면 첫 문장부터 재생합니다. 자세한 Space 동작은 [키보드 단축키](#키보드-단축키-space--ctrlb)를 참고하세요.

### TTS 설정 (기본값)

| 항목 | 범위 | 기본값 | 저장 |
|------|------|--------|------|
| 속도 | 0.5x ~ 4.0x | **2.0x** | `localStorage` |
| 볼륨 | 0% ~ 100% | **50%** | `localStorage` |
| 음성 | ko-KR Neural 등 | SunHi | `localStorage` |

- 속도 변경은 **다음 문장부터** 적용됩니다.
- 볼륨은 브라우저 오디오 재생(`HTMLAudioElement.volume`)으로 즉시 반영됩니다.
- 플레이어 우측 **설정** 버튼을 누르면 속도·볼륨·음성을 조절할 수 있습니다. 설정 패널은 버튼 아래로 열리며, sticky heading UI 위에 겹쳐 표시됩니다.

## 목차 (TOC)

- 마크다운 heading(`##` ~ `######`)을 트리 구조로 표시
- **▶ / ▼** 버튼으로 하위 목차 접기/펼치기 (아코디언)
- **전체 펼치기 / 전체 접기** 버튼
- 목차 항목 클릭 → 해당 heading으로 스크롤 + TTS 해당 섹션부터 재생(재생 중일 때)
- 재생 중인 섹션은 목차에서 active 표시, 접힌 상위 목차는 자동 펼침
- 좌측 목차 사이드바 전체 접기/펼치기 (`◀ 접기` / `목차 ▶`)
- 접기 상태는 `localStorage`에 저장

## 재생 섹션 heading (sticky)

재생 또는 일시정지 중일 때, 현재 문장이 속한 markdown heading이 플레이어 바로 아래에 고정(sticky) 표시됩니다. 스크롤해도 현재 읽고 있는 섹션 제목을 확인할 수 있습니다. **정지** 시 사라집니다.

## Bold 편집 (Ctrl+B)

본문에서 텍스트를 선택한 뒤 `Ctrl+B`로 markdown `**bold**`를 토글합니다. 자세한 동작·저장 규칙·예외는 [키보드 단축키 (Space / Ctrl+B)](#키보드-단축키-space--ctrlb) 섹션을 참고하세요.

- **폴더 내 파일**: 원본 `.md`에 즉시 저장
- **로컬 파일**: 화면만 변경
- **재생 중**에도 사용 가능, 하이라이트 유지

## 마크다운 UI

| 요소 | 표시 |
|------|------|
| 코드 블록 | 다크 테마, mono font, 언어 태그 badge |
| Heading h1~h6 | 계층별 font-size (본문 < h6 < … < h1) |
| 인용문 `>` | 좌측 border + 연한 배경 |
| bold / italic / inline code / link | inline 서식 보존 |
| 목록 / 표 / hr | 각각 스타일 적용 |

TTS 문장 span 래핑 시 inline 서식(`<strong>`, `<code>` 등)을 유지합니다.

## 마크다운 파일 위치 및 사용 방법

앱은 **두 가지 방식**으로 `.md` 파일을 열 수 있습니다.

| 방식 | 설명 | Ctrl+B 저장 |
|------|------|-------------|
| **폴더 내 파일** | 백엔드가 지정 폴더의 `.md` 목록 제공 | ✅ 디스크에 저장 |
| **로컬 파일** | 브라우저 파일 선택 (임의 경로) | ❌ 화면만 변경 |

---

### 범용 사용하기 (다른 폴더 지정)

기본값은 `tts-reader/` **상위 폴더**(책 원고 폴더)입니다. **환경 변수**로 읽기 폴더를 바꿀 수 있습니다.

#### Windows (PowerShell)

```powershell
cd tts-reader/backend
$env:TTS_READER_BOOK_DIR = "C:\Users\seeunPark\Documents\notes"
# 선택: 시작 시 자동으로 열 파일
$env:TTS_READER_DEFAULT_FILE = "readme.md"
uvicorn main:app --reload --port 8000
```

#### macOS / Linux

```bash
cd tts-reader/backend
export TTS_READER_BOOK_DIR="$HOME/Documents/notes"
export TTS_READER_DEFAULT_FILE="readme.md"   # 선택
uvicorn main:app --reload --port 8000
```

| 환경 변수 | 필수 | 설명 |
|-----------|------|------|
| `TTS_READER_BOOK_DIR` | 아니오 | 읽기·저장 대상 폴더. **절대 경로** 또는 uvicorn 실행 위치 기준 **상대 경로** |
| `TTS_READER_DEFAULT_FILE` | 아니오 | 앱 시작 시 자동으로 여는 파일명 (예: `intro.md`). 미설정 시 자동 로드 없음* |

\* `TTS_READER_BOOK_DIR`을 **설정하지 않은** 기본 모드에서는 하위 호환을 위해 `4.md`가 있으면 자동으로 엽니다.

**동작**

- 지정 폴더 **직속** `*.md` 파일이 **폴더 내 파일** 드롭다운에 모두 표시됩니다 (`4.md`~`14.md` 제한 없음).
- UI에 **읽기 폴더** 경로가 표시됩니다.
- `GET /api/config`로 현재 `bookDir`·`defaultFile`을 확인할 수 있습니다.

**예: 상대 경로**

```powershell
cd tts-reader/backend
$env:TTS_READER_BOOK_DIR = "..\..\my-markdown"
uvicorn main:app --reload --port 8000
```

`backend`에서 실행한 현재 작업 디렉터리 기준으로 해석됩니다.

---

### 읽을 수 있는 파일 위치

#### 1. 폴더 내 파일 (서버)

백엔드가 `TTS_READER_BOOK_DIR`(또는 기본 폴더)에서 `.md`를 읽습니다.

```
[BOOK_DIR]/              ← 환경 변수 또는 기본값 (tts-reader 상위 폴더)
├── note-a.md
├── note-b.md
└── ...
```

| 항목 | 내용 |
|------|------|
| 대상 경로 | `TTS_READER_BOOK_DIR`로 지정한 폴더 |
| 파일 패턴 | 해당 폴더 **직속** `*.md`만 (하위 폴더 미검색) |
| UI 표시 | **폴더 내 파일** 드롭다운에 존재하는 모든 `.md` |
| 저장 | `Ctrl+B` bold 편집 시 **해당 폴더의 원본 `.md`에 즉시 저장** |

#### 2. 로컬 파일 (브라우저 선택)

| 항목 | 내용 |
|------|------|
| 대상 | PC 어디에 있든 `.md` 파일 |
| UI | **로컬 파일** `<input type="file">` |
| 읽기 | 브라우저 `FileReader` (서버 경유 없음) |
| 저장 | 디스크에 **저장되지 않음** (TTS·읽기만 가능) |

> **임의 경로 + 디스크 저장**이 필요하면: (1) 해당 `.md`를 `BOOK_DIR`로 복사해 **폴더 내 파일**로 열거나, (2) 에디터에서 직접 저장하세요. 브라우저 보안상 로컬 파일 경로를 서버에 넘겨 쓰는 방식은 지원하지 않습니다.

---

### 사용 방법

#### 사전 준비

백엔드와 프론트엔드를 모두 실행한 뒤 `http://localhost:5173` 을 엽니다.

```bash
# 터미널 1 — 읽을 폴더를 지정하려면 환경 변수 설정 후 실행
cd tts-reader/backend
uvicorn main:app --reload --port 8000

# 터미널 2
cd tts-reader/frontend
npm run dev
```

#### 폴더 내 `.md` 읽기

1. **폴더 내 파일** 드롭다운에서 파일 선택
2. **재생** 또는 `Space`로 TTS 시작
3. 좌측 목차로 섹션 이동
4. `Ctrl+B`로 bold 편집 → `BOOK_DIR`의 파일에 저장

#### PC 다른 위치의 `.md` 읽기 (일회성)

1. **로컬 파일** → 파일 선택
2. TTS·목차·하이라이트 동일하게 사용
3. 편집 내용을 남기려면 **폴더 내 파일** 방식으로 전환

#### 읽기 흐름

```
[폴더 내 파일]  →  GET /api/files/{filename}  →  BOOK_DIR/*.md
[로컬 파일]     →  FileReader (브라우저)     →  임의 경로
         ↓
   렌더링 → 문장 span → TTS / 목차 / 편집
```

---

### 방식 비교

| | 폴더 내 파일 | 로컬 파일 |
|---|------------|----------|
| 파일 위치 | `TTS_READER_BOOK_DIR` | PC 임의 경로 |
| Ctrl+B 저장 | ✅ | ❌ |
| 드롭다운 목록 | ✅ | 파일 선택만 |
| TTS | ✅ (백엔드 필요) | ✅ (백엔드 필요) |

---

### 제한 사항

- **하위 폴더 미지원**: `BOOK_DIR/sub/note.md`는 목록에 안 나옵니다.
- **경로 탐색 차단**: `../` 등으로 `BOOK_DIR` 밖 접근 불가.
- **대용량 파일**: 수만 줄 `.md`는 로딩이 느릴 수 있음 — 파일을 나누는 것을 권장.

### (참고) 코드에서 기본 폴더 바꾸기

환경 변수 대신 코드로 고정하려면 `backend/main.py`의 `_BUILTIN_BOOK_DIR`을 수정합니다.

```python
_BUILTIN_BOOK_DIR = Path(__file__).resolve().parent.parent.parent
```

## 키보드 단축키 (Space / Ctrl+B)

플레이어 버튼과 동일한 동작을 키보드로 할 수 있습니다. 본문 영역에 포커스가 있을 때 사용하세요.

> **입력 필드**(`input`, `select`, `textarea`, contentEditable)에 포커스가 있으면 단축키가 **동작하지 않습니다**. 속도·음성 드롭다운 조작 중에는 Space/Ctrl+B가 해당 UI에 전달됩니다.

---

### Space — 재생 / 일시정지 / 이어 재생

| 현재 상태 | Space 동작 |
|-----------|------------|
| **정지** (재생 전) | 선택 영역이 있으면 **그 문장부터** 재생, 없으면 **첫 문장**부터 재생 |
| **재생 중** | **일시정지** (현재 문장·하이라이트 유지) |
| **일시정지** | **이어 재생** (멈춘 문장부터 계속) |

#### 선택 영역부터 재생

1. 본문에서 텍스트를 **드래그**로 선택
2. `Space` (또는 **재생** 버튼)
3. 선택 **시작 위치**가 속한 문장부터 TTS가 시작됩니다

```
예: 세 문장 중 두 번째 문장 일부를 선택 → 두 번째 문장부터 재생
```

- 선택이 **본문 밖**이거나 **코드 블록 안**이면 무시되고, 첫 문장부터 재생됩니다.
- TTS 대상에서 제외된 문장(`data-skip`, 코드 블록 등)은 선택해도 재생 시작점으로 쓰이지 않을 수 있습니다.

#### Space와 플레이어 버튼

| 동작 | Space | 재생 버튼 | 정지 버튼 |
|------|-------|----------|----------|
| 처음부터/선택부터 재생 | ✅ | ✅ | — |
| 일시정지 | ✅ | ✅ (토글) | — |
| 이어 재생 | ✅ | ✅ (토글) | — |
| 완전 정지 (하이라이트 해제) | ❌ | — | ✅ |

완전히 멈추고 하이라이트를 지우려면 **정지** 버튼을 사용하세요.

#### 기타

- Space는 페이지 스크롤을 막기 위해 `preventDefault` 처리됩니다.
- 재생 가능한 문장이 없으면 Space를 눌러도 아무 일도 일어나지 않습니다.

---

### Ctrl+B — 선택 텍스트 Bold 토글

마크다운 원문에 `**텍스트**` bold 문법을 추가하거나 제거합니다. 화면의 **볼드 표시**와 **`.md` 파일 내용**을 함께 바꿉니다.

#### 사용 방법

1. 본문에서 강조할 텍스트를 **드래그**로 선택
2. `Ctrl+B` 입력
3. 선택 영역이 `**선택한 텍스트**` 형태로 markdown에 반영되고, 화면에 **굵게** 표시됩니다
4. 이미 `**...**`로 감싸진 텍스트에 다시 `Ctrl+B` → bold **해제**

#### 변환 예시

| 선택 전 (원문) | Ctrl+B 후 (원문) | 화면 |
|----------------|------------------|------|
| `데이터베이스` | `**데이터베이스**` | **데이터베이스** |
| `**데이터베이스**` | `데이터베이스` | 데이터베이스 |

#### 저장 동작

| 파일 열기 방식 | Ctrl+B 후 |
|----------------|-----------|
| **폴더 내 파일** (`BOOK_DIR`) | ✅ 해당 `.md` 파일에 **즉시 저장** (`PUT /api/files/{filename}`) |
| **로컬 파일** (파일 선택) | ⚠️ **화면만** 변경, 디스크에는 저장되지 않음 |

#### 재생 중 편집

- TTS **재생·일시정지 중**에도 `Ctrl+B` 사용 가능
- 편집 후에도 **현재 문장 하이라이트**는 유지됩니다 (HTML 재렌더 후 `useLayoutEffect`로 복원)

#### 동작하지 않는 경우

| 상황 | 결과 |
|------|------|
| 선택 영역 없음 | 아무 동작 없음 |
| 선택이 본문 밖 | 아무 동작 없음 |
| 선택이 **코드 블록** 안 | 아무 동작 없음 (코드는 편집 대상 아님) |
| 선택 범위가 markdown 매핑 실패 | 아무 동작 없음 |
| 이미 bold인데 토글 결과 변화 없음 | 아무 동작 없음 |

#### 내부 처리 (참고)

1. 화면 선택 → plain text 오프셋으로 변환 (`markdownPlainMapper`)
2. plain text 범위 → markdown 원문 위치(`mdStart`~`mdEnd`)로 역매핑
3. `toggleBoldInMarkdown()`으로 `**` 추가/제거
4. 마크다운 재파싱 → HTML·문장 span·목차 갱신
5. 서버 파일이면 API로 저장

---

### 단축키 요약

| 단축키 | 동작 |
|--------|------|
| `Space` | 재생 ↔ 일시정지 ↔ 이어 재생 (정지 상태에서 선택 시 해당 문장부터) |
| `Ctrl+B` | 선택 텍스트 `**bold**` 토글 (폴더 내 파일은 디스크 저장) |

## 요구 사항

- Python 3.10+
- Node.js 18+
- 인터넷 연결 (edge-tts가 Microsoft TTS 서버를 사용)

## 문제 해결

### `WinError 10013` — 포트 8000 사용 중

이전에 실행한 백엔드가 아직 8000번 포트를 점유하고 있을 때 발생합니다.

**Windows에서 포트 사용 프로세스 확인:**

```powershell
netstat -ano | findstr :8000
```

마지막 숫자(PID)를 확인한 뒤 종료합니다.

```powershell
Stop-Process -Id <PID> -Force
```

그다음 다시 실행합니다.

```bash
uvicorn main:app --reload --port 8000
```

**다른 포트 사용 (예: 8001):**

```bash
uvicorn main:app --reload --port 8001
```

8001을 쓰는 경우 `frontend/vite.config.ts`의 proxy target도 `http://localhost:8001`로 맞춰야 합니다.

## API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/config` | 읽기 폴더 경로·기본 파일 설정 |
| GET | `/api/voices?locale=ko-KR` | 사용 가능한 음성 목록 |
| POST | `/api/tts` | TTS 합성 (`text`, `voice`, `rate`) |
| GET | `/api/files` | 상위 폴더의 `.md` 파일 목록 |
| GET | `/api/files/{filename}` | 마크다운 파일 내용 |
| PUT | `/api/files/{filename}` | 마크다운 파일 저장 (`content`) |

## 프로젝트 구조

```
tts-reader/
├── backend/
│   ├── main.py              # FastAPI, CORS, TTS/파일 API
│   ├── tts_service.py       # edge-tts 음성 목록/합성
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/ttsClient.ts
    │   ├── components/
    │   │   ├── FileSelector.tsx
    │   │   ├── MarkdownViewer.tsx
    │   │   ├── PlayerControls.tsx
    │   │   ├── SettingsPanel.tsx
    │   │   ├── StickySectionHeading.tsx
    │   │   └── TableOfContents.tsx
    │   ├── hooks/
    │   │   ├── useKeyboardShortcuts.ts
    │   │   └── useTtsPlayer.ts
    │   ├── utils/
    │   │   ├── markdownBold.ts
    │   │   ├── markdownPlainMapper.ts
    │   │   ├── markdownToSentences.ts
    │   │   ├── sentenceSplitter.ts
    │   │   ├── tocTree.ts
    │   │   └── wrapSentenceSpans.ts
    │   └── App.tsx
    └── package.json
```

## 참고

- 코드 블록과 번역 메타 텍스트는 TTS 대상에서 제외됩니다.
- `localStorage` 키: `tts-reader-voice`, `tts-reader-speed`, `tts-reader-volume`, `tts-reader-toc-collapsed`, `tts-reader-toc-sections-collapsed`
- 오프라인에서는 TTS를 사용할 수 없습니다 (edge-tts는 Microsoft 서버 호출 필요).
