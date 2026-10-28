export type Sentence = {
  index: number;
  text: string;
  skip?: boolean;
};

function isInsideQuotes(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const doubleQuotes = (before.match(/"/g) ?? []).length;
  const singleQuotes = (before.match(/'/g) ?? []).length;
  const openGuillemet = (before.match(/「/g) ?? []).length;
  const closeGuillemet = (before.match(/」/g) ?? []).length;
  return (
    doubleQuotes % 2 === 1 ||
    singleQuotes % 2 === 1 ||
    openGuillemet > closeGuillemet
  );
}

export function splitSentences(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) {
    return [];
  }

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (!".!?…。".includes(char)) {
      continue;
    }

    if (isInsideQuotes(trimmed, i)) {
      continue;
    }

    const nextChar = trimmed[i + 1];
    if (nextChar && !/\s/.test(nextChar)) {
      continue;
    }

    const sentence = trimmed.slice(start, i + 1).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    start = i + 1;
  }

  const remainder = trimmed.slice(start).trim();
  if (remainder) {
    sentences.push(remainder);
  }

  return sentences.length > 0 ? sentences : [trimmed];
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
