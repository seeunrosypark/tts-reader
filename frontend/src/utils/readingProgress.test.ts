import { describe, expect, it } from "vitest";

import type { TocItem } from "./markdownToSentences";
import { computeReadingProgress, getChapterLevel } from "./readingProgress";
import type { Sentence } from "./sentenceSplitter";

// 0: # 책   1: 머리말   2: ## 1장   3~5: 본문   6: ## 2장   7: ### 2.1   8~9: 본문
const sentences: Sentence[] = Array.from({ length: 10 }, (_, index) => ({
  index,
  text: `문장 ${index}.`,
}));
const toc: TocItem[] = [
  { id: "book", level: 1, text: "책", sentenceIndex: 0 },
  { id: "c1", level: 2, text: "1장", sentenceIndex: 2 },
  { id: "c2", level: 2, text: "2장", sentenceIndex: 6 },
  { id: "c2-1", level: 3, text: "2.1", sentenceIndex: 7 },
];

const progress = (mode: "overall" | "chapter", index: number, sentenceProgress = 0) =>
  computeReadingProgress(mode, sentences, toc, index, sentenceProgress);

describe("getChapterLevel", () => {
  it("##가 있으면 ##를 장으로 본다", () => {
    expect(getChapterLevel(toc)).toBe(2);
  });

  it("##가 없으면 가장 얕은 제목 단계", () => {
    expect(getChapterLevel(toc.filter((item) => item.level !== 2))).toBe(1);
    expect(getChapterLevel([{ id: "a", level: 3, text: "A", sentenceIndex: 0 }])).toBe(3);
    expect(getChapterLevel([])).toBeNull();
  });
});

describe("computeReadingProgress", () => {
  it("전체: 문서 전체에서 읽은 비율", () => {
    expect(progress("overall", 0).progress).toBe(0);
    expect(progress("overall", 5).progress).toBe(0.5);
    expect(progress("overall", 5, 0.5).progress).toBeCloseTo(0.55);
  });

  it("장별: 현재 장 안에서 읽은 비율과 장 제목", () => {
    // 1장은 문장 2~5 (4문장)
    expect(progress("chapter", 2)).toEqual({ progress: 0, chapterTitle: "1장" });
    expect(progress("chapter", 4).progress).toBe(0.5);
    // 2장은 하위 절(2.1)까지 포함해 문장 6~9 (4문장)
    expect(progress("chapter", 8)).toEqual({ progress: 0.5, chapterTitle: "2장" });
  });

  it("장별: 첫 장 앞의 머리말은 별도 구간이고 장 제목은 없다", () => {
    expect(progress("chapter", 1)).toEqual({ progress: 0.5, chapterTitle: null });
  });

  it("건너뛰는 문장은 세지 않는다", () => {
    const withSkip = sentences.map((s) => (s.index === 3 ? { ...s, skip: true } : s));
    // 1장의 읽는 문장은 2, 4, 5 → 4번 문장 시작 시점에 1/3
    expect(computeReadingProgress("chapter", withSkip, toc, 4, 0).progress).toBeCloseTo(1 / 3);
  });

  it("목차가 없으면 장별도 전체와 같다", () => {
    expect(computeReadingProgress("chapter", sentences, [], 5, 0).progress).toBe(0.5);
  });
});
