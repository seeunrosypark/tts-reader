// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { findReadingPosition, saveReadingPosition } from "./readingPositions";
import type { Sentence } from "./sentenceSplitter";

function sentences(...texts: string[]): Sentence[] {
  return texts.map((text, index) => ({ index, text }));
}

describe("읽던 위치", () => {
  beforeEach(() => localStorage.clear());

  it("저장한 문장으로 돌아간다", () => {
    const list = sentences("가.", "나.", "다.");
    saveReadingPosition("book.md", list[2]);
    expect(findReadingPosition("book.md", list)).toBe(2);
  });

  it("앞에 문장이 추가돼 번호가 밀려도 같은 문장을 찾는다", () => {
    saveReadingPosition("book.md", { index: 1, text: "나." });
    expect(findReadingPosition("book.md", sentences("새 문장.", "가.", "나.", "다."))).toBe(2);
  });

  it("문장이 바뀌었으면 같은 번호 이후 첫 문장으로", () => {
    saveReadingPosition("book.md", { index: 2, text: "삭제된 문장." });
    expect(findReadingPosition("book.md", sentences("가.", "나.", "다.", "라."))).toBe(2);
  });

  it("건너뛰는 문장(skip)은 고르지 않는다", () => {
    saveReadingPosition("book.md", { index: 1, text: "나." });
    const list: Sentence[] = [
      { index: 0, text: "가." },
      { index: 1, text: "나.", skip: true },
      { index: 2, text: "다." },
    ];
    expect(findReadingPosition("book.md", list)).toBe(2);
  });

  it("첫 문장이거나 기록이 없으면 null", () => {
    const list = sentences("가.", "나.");
    expect(findReadingPosition("book.md", list)).toBeNull();
    saveReadingPosition("book.md", list[0]);
    expect(findReadingPosition("book.md", list)).toBeNull();
  });

  it("파일 이름별로 따로 저장한다", () => {
    const list = sentences("가.", "나.", "다.");
    saveReadingPosition("a.md", list[1]);
    saveReadingPosition("b.md", list[2]);
    expect(findReadingPosition("a.md", list)).toBe(1);
    expect(findReadingPosition("b.md", list)).toBe(2);
  });
});
