import type { TocItem } from "./markdownToSentences";
import type { Sentence } from "./sentenceSplitter";

export type RangeProgress = {
  /** 0~1. 현재 문장을 읽은 비율까지 반영한다. */
  progress: number;
  /** 구간 안에서 현재 문장의 순번 (1부터). 구간 밖이면 이미 읽은 문장 수. */
  position: number;
  /** 구간 안의 읽는 문장 수 (건너뛰는 문장 제외). */
  count: number;
  /** 구간 전체 글자 수와 아직 읽지 않은 글자 수 (현재 문장은 읽은 비율만큼 뺀다). */
  totalChars: number;
  remainingChars: number;
};

export type ChapterProgress = RangeProgress & { title: string | null };

export type ReadingProgress = {
  overall: RangeProgress;
  /** 목차가 없어 장을 나눌 수 없으면 null. */
  chapter: ChapterProgress | null;
};

export type Chapter = { id: string; title: string; start: number; end: number };

/** 장 목록과 각 장의 [시작, 끝) 문장 번호. 하위 절은 장에 포함된다. 머리말은 장이 아니다. */
export function listChapters(toc: TocItem[]): Chapter[] {
  const level = getChapterLevel(toc);
  if (level === null) {
    return [];
  }
  const boundaries = toc.filter((item) => item.level <= level);
  return boundaries.flatMap((item, i) =>
    item.level === level
      ? [
          {
            id: item.id,
            title: item.text,
            start: item.sentenceIndex,
            end: boundaries[i + 1]?.sentenceIndex ?? Infinity,
          },
        ]
      : [],
  );
}

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
  level: number,
  currentIndex: number,
): { start: number; end: number; title: string | null } {
  let start = 0;
  let end = Infinity;
  let title: string | null = null;
  for (const chapter of toc.filter((item) => item.level <= level)) {
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

function computeRangeProgress(
  sentences: Sentence[],
  start: number,
  end: number,
  currentIndex: number,
  sentenceProgress: number,
): RangeProgress {
  const playable = sentences.filter(
    (sentence) => !sentence.skip && sentence.index >= start && sentence.index < end,
  );
  if (playable.length === 0) {
    return { progress: 0, position: 0, count: 0, totalChars: 0, remainingChars: 0 };
  }

  const done = playable.filter((sentence) => sentence.index < currentIndex).length;
  const isCurrentInRange = playable.some((sentence) => sentence.index === currentIndex);
  const progress = (done + (isCurrentInRange ? sentenceProgress : 0)) / playable.length;

  let totalChars = 0;
  let remainingChars = 0;
  for (const sentence of playable) {
    totalChars += sentence.text.length;
    if (sentence.index > currentIndex) {
      remainingChars += sentence.text.length;
    } else if (sentence.index === currentIndex) {
      remainingChars += sentence.text.length * (1 - Math.min(Math.max(sentenceProgress, 0), 1));
    }
  }

  return {
    progress: Math.min(Math.max(progress, 0), 1),
    position: done + (isCurrentInRange ? 1 : 0),
    count: playable.length,
    totalChars,
    remainingChars,
  };
}

/** 문서 전체와 현재 장의 진행률·문장 위치. sentenceProgress는 현재 문장을 읽은 비율. */
export function computeReadingProgress(
  sentences: Sentence[],
  toc: TocItem[],
  currentIndex: number,
  sentenceProgress: number,
): ReadingProgress {
  const overall = computeRangeProgress(sentences, 0, Infinity, currentIndex, sentenceProgress);

  const level = getChapterLevel(toc);
  if (level === null) {
    return { overall, chapter: null };
  }

  const range = getChapterRange(toc, level, currentIndex);
  return {
    overall,
    chapter: {
      ...computeRangeProgress(sentences, range.start, range.end, currentIndex, sentenceProgress),
      title: range.title,
    },
  };
}

/** 장 본문을 읽는 문장만 이어 붙인 텍스트 (퀴즈 출제용). */
export function chapterText(chapter: Chapter, sentences: Sentence[]): string {
  return sentences
    .filter((sentence) => !sentence.skip && sentence.index >= chapter.start && sentence.index < chapter.end)
    .map((sentence) => sentence.text)
    .join("\n");
}
