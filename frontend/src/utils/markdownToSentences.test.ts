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

describe("인용·중첩 블록", () => {
  const playableTexts = (md: string) =>
    parseLocalMarkdown(md)
      .sentences.filter((sentence) => !sentence.skip)
      .map((sentence) => sentence.text);

  it("인용 박스는 한 번만 읽는다", () => {
    expect(playableTexts("> 인용 문장이다. 둘째 문장.\n\n본문.")).toEqual([
      "인용 문장이다.",
      "둘째 문장.",
      "본문.",
    ]);
  });

  it("여러 문단짜리 인용과 인용 안 목록도 한 번씩", () => {
    expect(playableTexts("> 첫 문단.\n>\n> 둘째 문단.\n>\n> - 목록 항목.")).toEqual([
      "첫 문단.",
      "둘째 문단.",
      "목록 항목.",
    ]);
  });

  it("중첩 목록은 바깥 항목 글자와 안쪽 항목을 따로 읽는다", () => {
    expect(playableTexts("- 바깥 항목.\n  - 안쪽 항목.\n- 다음 항목.")).toEqual([
      "바깥 항목.",
      "안쪽 항목.",
      "다음 항목.",
    ]);
  });
});

describe("하이라이트", () => {
  // 읽는 문장마다 화면에 하이라이트용 span이 있어야 한다.
  const unwrapped = (md: string) => {
    const { html, sentences } = parseLocalMarkdown(md);
    const doc = new DOMParser().parseFromString(html, "text/html");
    return sentences
      .filter((sentence) => !sentence.skip && !doc.querySelector(`.sentence[data-index="${sentence.index}"]`))
      .map((sentence) => sentence.text);
  };

  it.each([
    ["인라인 코드로 시작", "`SELECT` 문으로 조회한다. 다음 문장."],
    ["밑줄 있는 영어 단어", "snake_case_name 변수를 쓴다. 다음."],
    ["곱셈 기호", "DAU = 3억 * 50% * 2. 다음."],
    ["영어로 시작", "Redis는 인메모리 저장소다. Consistency is hard. 다음."],
    ["특수문자로 시작", "\"따옴표\" (괄호) → 화살표 · 가운뎃점 100% 확실. 다음."],
    ["인용 안 문장", "> `code` 로 시작하는 인용."],
  ])("%s", (_name, md) => {
    expect(unwrapped(md)).toEqual([]);
  });

  it("코드처럼 시작해도 한글 설명 문장은 읽고, 한글 없는 코드 줄은 건너뛴다", () => {
    const { sentences } = parseLocalMarkdown("`db_set key value`를 호출하면 저장합니다.\n\ndb_set 42 abc");
    // 코드 줄만 있는 문단은 문장 목록에서 아예 빠진다.
    expect(sentences.map((sentence) => [sentence.text, Boolean(sentence.skip)])).toEqual([
      ["db_set key value를 호출하면 저장합니다.", false],
    ]);
  });

  it("인용 박스의 span은 문장마다 하나", () => {
    const { html } = parseLocalMarkdown("> 인용 문장이다.");
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll(".sentence").length).toBe(1);
  });
});
