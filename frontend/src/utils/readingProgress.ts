import type { TocItem } from "./markdownToSentences";
import type { Sentence } from "./sentenceSplitter";

export type ProgressMode = "overall" | "chapter";

/**
 * 장으로 볼 제목 단계. "# 책 제목 / ## 1장" 구조가 흔하므로 ##가 있으면 ##,
 * 없으면 가장 얕은 제목 단계를 장으로 본다.
 */
export function getChapterLevel(toc: TocItem[]): number | null {
  if (toc.length === 0) {
    return null;
  }
  if (toc.some((item) => item.level === 2)) {
    return 2;
  }
  return Math.min(...toc.map((item) => item.level));
}

/** 현재 문장이 속한 장의 [시작, 끝) 문장 번호. 첫 장 앞의 머리말도 하나의 구간으로 본다. */
function getChapterRange(
  toc: TocItem[],
  currentIndex: number,
): { start: number; end: number; title: string | null } {
  const level = getChapterLevel(toc);
  const chapters = level === null ? [] : toc.filter((item) => item.level <= level);

  let start = 0;
  let end = Infinity;
  let title: string | null = null;
  for (const chapter of chapters) {
    if (chapter.sentenceIndex <= currentIndex) {
      start = chapter.sentenceIndex;
      title = chapter.level === level ? chapter.text : null;
    } else {
      end = chapter.sentenceIndex;
      break;
    }
  }
  return { start, end, title };
}

/**
 * 진행률(0~1). sentenceProgress는 현재 문장을 읽은 비율.
 * 장별이면 현재 장 안에서의 비율, 전체면 문서 전체에서의 비율.
 */
export function computeReadingProgress(
  mode: ProgressMode,
  sentences: Sentence[],
  toc: TocItem[],
  currentIndex: number,
  sentenceProgress: number,
): { progress: number; chapterTitle: string | null } {
  const range =
    mode === "chapter" ? getChapterRange(toc, currentIndex) : { start: 0, end: Infinity, title: null };

  const playable = sentences.filter(
    (sentence) => !sentence.skip && sentence.index >= range.start && sentence.index < range.end,
  );
  if (playable.length === 0) {
    return { progress: 0, chapterTitle: range.title };
  }

  const done = playable.filter((sentence) => sentence.index < currentIndex).length;
  const isCurrentPlayable = playable.some((sentence) => sentence.index === currentIndex);
  const progress = (done + (isCurrentPlayable ? sentenceProgress : 0)) / playable.length;
  return { progress: Math.min(Math.max(progress, 0), 1), chapterTitle: range.title };
}
