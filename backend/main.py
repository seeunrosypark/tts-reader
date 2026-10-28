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


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str = "ko-KR-SunHiNeural"
    rate: str = "+0%"


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
