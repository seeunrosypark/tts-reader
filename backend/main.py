import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from tts_service import list_voices, synthesize_speech

app = FastAPI(title="Markdown TTS Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_BUILTIN_BOOK_DIR = Path(__file__).resolve().parent.parent.parent


def resolve_book_dir() -> Path:
    configured = os.environ.get("TTS_READER_BOOK_DIR", "").strip()
    if not configured:
        return _BUILTIN_BOOK_DIR.resolve()

    path = Path(configured).expanduser()
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    else:
        path = path.resolve()
    return path


def resolve_default_file() -> Optional[str]:
    explicit = os.environ.get("TTS_READER_DEFAULT_FILE", "").strip()
    if explicit:
        return explicit
    if not os.environ.get("TTS_READER_BOOK_DIR", "").strip():
        return "4.md"
    return None


BOOK_DIR = resolve_book_dir()
DEFAULT_FILE = resolve_default_file()


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = "ko-KR-SunHiNeural"
    rate: str = "+0%"


class FileContentUpdate(BaseModel):
    content: str


def resolve_markdown_path(filename: str) -> Path:
    file_path = (BOOK_DIR / filename).resolve()
    if not file_path.exists() or file_path.parent != BOOK_DIR.resolve():
        raise HTTPException(status_code=404, detail="File not found")
    if file_path.suffix.lower() != ".md":
        raise HTTPException(status_code=400, detail="Only markdown files are supported")
    return file_path


@app.get("/api/config")
async def get_config():
    return {
        "bookDir": str(BOOK_DIR),
        "defaultFile": DEFAULT_FILE,
        "isCustomBookDir": bool(os.environ.get("TTS_READER_BOOK_DIR", "").strip()),
    }


@app.get("/api/voices")
async def get_voices(locale: Optional[str] = Query(default=None)):
    return await list_voices(locale)


@app.post("/api/tts")
async def create_tts(request: TtsRequest):
    try:
        audio = await synthesize_speech(request.text, request.voice, request.rate)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return Response(content=audio, media_type="audio/mpeg")


@app.get("/api/files")
async def get_files():
    if not BOOK_DIR.exists():
        return []

    files = []
    for path in sorted(BOOK_DIR.glob("*.md")):
        files.append({"name": path.name, "path": path.name})
    return files


@app.get("/api/files/{filename}")
async def get_file_content(filename: str):
    file_path = resolve_markdown_path(filename)
    return {"name": filename, "content": file_path.read_text(encoding="utf-8")}


@app.put("/api/files/{filename}")
async def update_file_content(filename: str, body: FileContentUpdate):
    file_path = resolve_markdown_path(filename)
    file_path.write_text(body.content, encoding="utf-8")
    return {"name": filename, "content": body.content}
