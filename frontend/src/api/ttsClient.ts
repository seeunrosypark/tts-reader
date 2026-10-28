export type VoiceInfo = {
  shortName: string;
  friendlyName: string;
  gender: string;
  locale: string;
};

export async function fetchVoices(locale?: string): Promise<VoiceInfo[]> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const response = await fetch(`/api/voices${query}`);
  if (!response.ok) {
    throw new Error("Failed to fetch voices");
  }
  return response.json();
}

/** 기본 속도로 합성한다. 재생 속도는 브라우저(playbackRate)에서 조절한다. */
export async function synthesizeTts(text: string, voice: string): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error("Failed to synthesize speech");
  }

  return response.blob();
}
