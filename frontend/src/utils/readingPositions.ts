import type { Sentence } from "./sentenceSplitter";

const STORAGE_KEY = "tts-reader-positions";
const MAX_FILES = 50;

type StoredPosition = {
  index: number;
  // 파일이 편집돼 문장 번호가 밀려도 같은 문장을 찾을 수 있도록 원문도 저장한다.
  text: string;
  updatedAt: number;
};

function loadAll(): Record<string, StoredPosition> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveReadingPosition(fileName: string, sentence: Sentence): void {
  const positions = loadAll();
  positions[fileName] = { index: sentence.index, text: sentence.text, updatedAt: Date.now() };

  const names = Object.keys(positions);
  if (names.length > MAX_FILES) {
    names
      .sort((a, b) => positions[a].updatedAt - positions[b].updatedAt)
      .slice(0, names.length - MAX_FILES)
      .forEach((name) => delete positions[name]);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

/** 저장된 위치에 해당하는 문장 번호. 처음 문장이거나 기록이 없으면 null. */
export function findReadingPosition(fileName: string, sentences: Sentence[]): number | null {
  const stored = loadAll()[fileName];
  if (!stored) {
    return null;
  }

  const playable = sentences.filter((sentence) => !sentence.skip);
  const match =
    playable.find((sentence) => sentence.index === stored.index && sentence.text === stored.text) ??
    playable.find((sentence) => sentence.text === stored.text) ??
    playable.find((sentence) => sentence.index >= stored.index);

  if (!match || match.index === playable[0]?.index) {
    return null;
  }
  return match.index;
}
