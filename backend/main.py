from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from quiz_service import QuizError, generate_quiz
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


class QuizRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    # 장 하나 분량. 잘라서 보내지 않고, 너무 길면 거절한다.
    text: str = Field(..., min_length=200, max_length=200_000)
    count: int = Field(default=5, ge=3, le=10)


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


@app.post("/api/quiz")
async def create_quiz(request: QuizRequest):
    try:
        quiz = await generate_quiz(request.title, request.text, request.count)
    except QuizError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return quiz
