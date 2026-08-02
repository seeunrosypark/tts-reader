import io
from typing import Optional

import edge_tts


async def list_voices(locale: Optional[str] = None) -> list[dict]:
    voices = await edge_tts.list_voices()
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
