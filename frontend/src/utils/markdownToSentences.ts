import { marked } from "marked";
import DOMPurify from "dompurify";

import { splitSentences, type Sentence } from "./sentenceSplitter";
import { enhanceCodeBlocks, getOwnText, wrapSentencesInElement } from "./wrapSentenceSpans";

export type TocItem = {
  id: string;
  level: number;
  text: string;
  sentenceIndex: number;
};

// 원문에서 복사돼 들어온 안내 문구: 항상 읽지 않는다.
const ALWAYS_SKIP_PATTERNS = [/^Skip to Content$/i, /translation-feedback@oreilly\.com/i];

// 본문에 섞인 코드 줄: 한글 설명 문장("`db_set key value`를 호출하면 …")은 읽어야 하므로 한글이 없을 때만 건너뛴다.
const CODE_LINE_PATTERNS = [
  /^#!/,
  /^\$/,
  /^db_(set|get)/,
  /^echo "/,
  /^grep "/,
  /^sed -e/,
  /^tail -n/,
  /^cat database/,
  /^\{$/,
  /^\}$/,
  /^12,\{/,
  /^42,\{/,
];

const BLOCK_SELECTORS =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th";

const HANGUL = /[가-힣]/;

function shouldSkipText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return true;
  }
  if (ALWAYS_SKIP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return !HANGUL.test(normalized) && CODE_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function preprocessForTts(markdown: string): string {
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "\n\n");
  return withoutCodeBlocks.replace(/`[^`\n]+`/g, " ");
}

/** 화면에 그려진 글자는 마크다운 문법이 이미 처리됐으므로 공백만 정리한다. */
function normalizeRenderedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildSentencesFromText(text: string, startIndex: number): Sentence[] {
  // 렌더링된 글자에 마크다운 제거를 다시 하면 "3억 * 50%"의 *나 snake_case의 _가 지워져
  // 화면 글자와 달라지고, 그 문장은 하이라이트되지 않는다.
  const cleaned = normalizeRenderedText(text);
  if (shouldSkipText(cleaned)) {
    return [];
  }

  const parts = splitSentences(cleaned);
  return parts.map((part, offset) => ({
    index: startIndex + offset,
    text: part,
    skip: shouldSkipText(part),
  }));
}

function getHeadingLevel(tagName: string): number | null {
  const match = /^h([1-6])$/i.exec(tagName);
  return match ? Number(match[1]) : null;
}

function firstPlayableIndex(sentences: Sentence[]): number | null {
  const playable = sentences.find((sentence) => !sentence.skip);
  return playable?.index ?? null;
}

function isInsideCodeBlock(element: Element): boolean {
  return Boolean(element.closest("pre, code"));
}

export function parseMarkdownToSentences(markdown: string): {
  html: string;
  sentences: Sentence[];
  toc: TocItem[];
} {
  const rawHtml = marked.parse(markdown, { breaks: true }) as string;
  const sanitized = DOMPurify.sanitize(rawHtml);

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "text/html");
  enhanceCodeBlocks(doc.body);

  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTORS)).filter(
    (block) => !isInsideCodeBlock(block),
  );

  const sentences: Sentence[] = [];
  const toc: TocItem[] = [];
  let nextIndex = 0;
  let tocCounter = 0;
  let lastPlayableIndex: number | null = null;

  for (const block of blocks) {
    const text = getOwnText(block as HTMLElement, BLOCK_SELECTORS);
    const blockSentences = buildSentencesFromText(text, nextIndex);
    const headingLevel = getHeadingLevel(block.tagName.toLowerCase());

    if (headingLevel !== null) {
      const headingId = `heading-${tocCounter}`;
      tocCounter += 1;
      block.id = headingId;

      const sentenceIndex =
        firstPlayableIndex(blockSentences) ?? lastPlayableIndex ?? nextIndex;

      toc.push({
        id: headingId,
        level: headingLevel,
        text: normalizeRenderedText(text),
        sentenceIndex,
      });
    }

    if (blockSentences.length === 0) {
      continue;
    }

    wrapSentencesInElement(block as HTMLElement, blockSentences, BLOCK_SELECTORS);
    sentences.push(...blockSentences);

    const playable = firstPlayableIndex(blockSentences);
    if (playable !== null) {
      lastPlayableIndex = playable;
    }

    nextIndex += blockSentences.length;
  }

  return {
    html: doc.body.innerHTML,
    sentences,
    toc,
  };
}

export function parseLocalMarkdown(markdown: string): {
  html: string;
  sentences: Sentence[];
  toc: TocItem[];
} {
  return parseMarkdownToSentences(markdown);
}

export function findActiveTocItem(
  toc: TocItem[],
  highlightedIndex: number | null,
): string | null {
  if (highlightedIndex === null || toc.length === 0) {
    return null;
  }

  let activeId: string | null = toc[0]?.id ?? null;
  for (const item of toc) {
    if (item.sentenceIndex <= highlightedIndex) {
      activeId = item.id;
    } else {
      break;
    }
  }
  return activeId;
}

export { preprocessForTts, shouldSkipText, stripMarkdownInline };
