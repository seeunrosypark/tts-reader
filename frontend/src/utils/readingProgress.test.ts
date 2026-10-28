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

const progressAt = (index: number, sentenceProgress = 0) =>
  computeReadingProgress(sentences, toc, index, sentenceProgress);

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
  it("전체: 문서 전체에서의 비율과 문장 위치", () => {
    expect(progressAt(0).overall).toEqual({ progress: 0, position: 1, count: 10 });
    expect(progressAt(5).overall).toEqual({ progress: 0.5, position: 6, count: 10 });
    expect(progressAt(5, 0.5).overall.progress).toBeCloseTo(0.55);
  });

  it("장: 현재 장 안에서의 비율, 문장 위치, 장 제목을 함께 준다", () => {
    // 1장은 문장 2~5 (4문장)
    expect(progressAt(2).chapter).toEqual({ progress: 0, position: 1, count: 4, title: "1장" });
    expect(progressAt(4).chapter).toEqual({ progress: 0.5, position: 3, count: 4, title: "1장" });
    // 2장은 하위 절(2.1)까지 포함해 문장 6~9 (4문장)
    expect(progressAt(8).chapter).toEqual({ progress: 0.5, position: 3, count: 4, title: "2장" });
  });

  it("전체와 장을 한 번에 계산한다", () => {
    const { overall, chapter } = progressAt(8);
    expect(overall.position).toBe(9);
    expect(chapter?.position).toBe(3);
  });

  it("첫 장 앞의 머리말은 별도 구간이고 장 제목은 없다", () => {
    expect(progressAt(1).chapter).toEqual({ progress: 0.5, position: 2, count: 2, title: null });
  });

  it("건너뛰는 문장은 세지 않는다", () => {
    const withSkip = sentences.map((s) => (s.index === 3 ? { ...s, skip: true } : s));
    // 1장의 읽는 문장은 2, 4, 5 → 4번 문장은 3개 중 두 번째
    const { chapter, overall } = computeReadingProgress(withSkip, toc, 4, 0);
    expect(chapter).toMatchObject({ position: 2, count: 3 });
    expect(chapter?.progress).toBeCloseTo(1 / 3);
    expect(overall.count).toBe(9);
  });

  it("목차가 없으면 장은 null", () => {
    expect(computeReadingProgress(sentences, [], 5, 0).chapter).toBeNull();
  });

  it("문장이 없으면 0", () => {
    expect(computeReadingProgress([], [], 0, 0).overall).toEqual({ progress: 0, position: 0, count: 0 });
  });
});
