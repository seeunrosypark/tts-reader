import { describe, expect, it } from "vitest";

import { toggleBoldInMarkdown } from "./markdownBold";
import { createMarkdownPlainMapper, findPlainRangeForSelection } from "./markdownPlainMapper";

/** 화면에서 selected를 드래그하고 Ctrl+B를 누른 것과 같은 흐름. */
function boldBySelection(markdown: string, selected: string, occurrence = 0): string {
  const mapper = createMarkdownPlainMapper(markdown);
  let start = -1;
  for (let i = 0; i <= occurrence; i++) {
    start = mapper.plainText.indexOf(selected, start + 1);
  }
  expect(start, `plainText에 '${selected}'가 없음: ${mapper.plainText}`).toBeGreaterThanOrEqual(0);

  const range =
    findPlainRangeForSelection(mapper.plainText, selected, start) ??
    { start, end: start + selected.length };
  const { mdStart, mdEnd } = mapper.toMarkdownRange(range.start, range.end);
  return toggleBoldInMarkdown(markdown, mdStart, mdEnd);
}

describe("toggleBoldInMarkdown", () => {
  it("범위를 **로 감싼다", () => {
    expect(toggleBoldInMarkdown("가나다라", 1, 3)).toBe("가**나다**라");
  });

  it("이미 **로 감싸져 있으면 푼다", () => {
    expect(toggleBoldInMarkdown("가**나다**라", 3, 5)).toBe("가나다라");
  });

  it("잘못된 범위는 그대로 둔다", () => {
    expect(toggleBoldInMarkdown("가나다", 2, 2)).toBe("가나다");
    expect(toggleBoldInMarkdown("가나다", -1, 2)).toBe("가나다");
    expect(toggleBoldInMarkdown("가나다", 0, 10)).toBe("가나다");
  });
});

describe("선택 → 마크다운 위치 매핑 (Ctrl+B)", () => {
  it("일반 문장의 단어를 굵게 만든다", () => {
    expect(boldBySelection("이것은 중요한 문장입니다.\n", "중요한")).toBe(
      "이것은 **중요한** 문장입니다.\n",
    );
  });

  it("이미 굵은 단어는 원래대로 푼다", () => {
    expect(boldBySelection("이것은 **중요한** 문장입니다.\n", "중요한")).toBe(
      "이것은 중요한 문장입니다.\n",
    );
  });

  it("앞에 인라인 코드와 링크가 있어도 위치가 밀리지 않는다", () => {
    const markdown = "`code`와 [링크](https://example.com) 뒤의 목표 단어입니다.\n";
    expect(boldBySelection(markdown, "목표")).toBe(
      "`code`와 [링크](https://example.com) 뒤의 **목표** 단어입니다.\n",
    );
  });

  it("코드 블록과 mermaid 블록 뒤의 문장도 정확히 찾는다", () => {
    const markdown = [
      "# 제목",
      "",
      "```js",
      "const 목표 = 1;",
      "```",
      "",
      "```mermaid",
      "flowchart LR",
      "  목표 --> B",
      "```",
      "",
      "여기 목표가 있습니다.",
      "",
    ].join("\n");
    expect(boldBySelection(markdown, "목표")).toBe(markdown.replace("여기 목표가", "여기 **목표**가"));
  });

  it("같은 단어가 여러 번 나오면 선택한 위치의 것만 바꾼다", () => {
    expect(boldBySelection("사과와 사과와 사과\n", "사과", 1)).toBe("사과와 **사과**와 사과\n");
  });
});
