import { speedToRate } from "../utils/sentenceSplitter";

export type VoiceInfo = {
  shortName: string;
  friendlyName: string;
  gender: string;
  locale: string;
};

export type BookFile = {
  name: string;
  path: string;
};

export type ReaderConfig = {
  bookDir: string;
  defaultFile: string | null;
  isCustomBookDir: boolean;
};

export async function fetchReaderConfig(): Promise<ReaderConfig> {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("Failed to fetch reader config");
  }
  return response.json();
}

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

export async function fetchBookFiles(): Promise<BookFile[]> {
  const response = await fetch("/api/files");
  if (!response.ok) {
    throw new Error("Failed to fetch files");
  }
  return response.json();
}

export async function fetchBookFileContent(filename: string): Promise<string> {
  const response = await fetch(`/api/files/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch file content");
  }
  const data = (await response.json()) as { content: string };
  return data.content;
}

export async function saveBookFileContent(
  filename: string,
  content: string,
): Promise<void> {
  const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error("Failed to save file content");
  }
}
