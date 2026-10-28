// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { findActiveTocItem, parseLocalMarkdown } from "./markdownToSentences";

const markdown = [
  "# 책 제목",
  "",
  "첫 문장입니다. 둘째 문장입니다.",
  "",
  "## 1장",
  "",
  "```js",
  "const 읽으면안됨 = 1;",
  "```",
  "",
  "```mermaid",
  "flowchart LR",
  "  다이어그램 --> 읽으면안됨",
  "```",
  "",
  "1장 본문입니다.",
  "",
].join("\n");

describe("parseLocalMarkdown", () => {
  const parsed = parseLocalMarkdown(markdown);
  const playable = parsed.sentences.filter((sentence) => !sentence.skip);

  it("문단을 문장 단위로 나눈다", () => {
    expect(playable.map((sentence) => sentence.text)).toEqual([
      "책 제목",
      "첫 문장입니다.",
      "둘째 문장입니다.",
      "1장",
      "1장 본문입니다.",
    ]);
  });

  it("코드 블록과 mermaid 블록은 읽지 않는다", () => {
    expect(parsed.sentences.some((sentence) => sentence.text.includes("읽으면안됨"))).toBe(false);
  });

  it("제목으로 목차를 만들고 각 제목의 첫 문장을 가리킨다", () => {
    expect(parsed.toc.map(({ level, text }) => [level, text])).toEqual([
      [1, "책 제목"],
      [2, "1장"],
    ]);
    const chapter = parsed.toc[1];
    expect(parsed.sentences.find((s) => s.index === chapter.sentenceIndex)?.text).toBe("1장");
  });

  it("문장마다 data-index가 붙은 span을 만든다", () => {
    const doc = new DOMParser().parseFromString(parsed.html, "text/html");
    const indexes = [...doc.querySelectorAll(".sentence[data-index]")].map((el) =>
      Number(el.getAttribute("data-index")),
    );
    for (const sentence of playable) {
      expect(indexes).toContain(sentence.index);
    }
  });

  it("mermaid 블록에 data-lang을 붙여 다이어그램으로 바꿀 수 있게 한다", () => {
    const doc = new DOMParser().parseFromString(parsed.html, "text/html");
    expect(doc.querySelector('pre.code-block[data-lang="mermaid"]')).not.toBeNull();
  });
});

describe("findActiveTocItem", () => {
  it("현재 문장이 속한 가장 가까운 제목", () => {
    const { toc, sentences } = parseLocalMarkdown(markdown);
    const last = sentences[sentences.length - 1];
    expect(findActiveTocItem(toc, last.index)).toBe(toc[1].id);
    expect(findActiveTocItem(toc, null)).toBeNull();
  });
});
