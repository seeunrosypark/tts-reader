import { speedToRate } from "../utils/sentenceSplitter";

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

export async function synthesizeTts(
  text: string,
  voice: string,
  speed: number,
): Promise<Blob> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice,
      rate: speedToRate(speed),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to synthesize speech");
  }

  return response.blob();
}
