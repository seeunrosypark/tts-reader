import asyncio
import io
import time
from typing import Optional

import edge_tts

# 음성 목록은 거의 바뀌지 않으므로 Microsoft 서버에 매번 묻지 않고 하루 동안 재사용한다.
_VOICES_TTL_SECONDS = 24 * 60 * 60
_voices_cache: Optional[list[dict]] = None
_voices_fetched_at = 0.0
_voices_lock = asyncio.Lock()


async def _get_all_voices() -> list[dict]:
    global _voices_cache, _voices_fetched_at
    async with _voices_lock:
        if _voices_cache is None or time.monotonic() - _voices_fetched_at > _VOICES_TTL_SECONDS:
            _voices_cache = await edge_tts.list_voices()
            _voices_fetched_at = time.monotonic()
        return _voices_cache


async def list_voices(locale: Optional[str] = None) -> list[dict]:
    voices = await _get_all_voices()
    result = []
    for voice in voices:
        if locale and not voice["Locale"].startswith(locale):
            continue
        result.append(
            {
                "shortName": voice["ShortName"],
                "friendlyName": voice["FriendlyName"],
                "gender": voice["Gender"],
                "locale": voice["Locale"],
            }
        )
    return result


async def synthesize_speech(text: str, voice: str, rate: str = "+0%") -> bytes:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])
    return buffer.getvalue()
