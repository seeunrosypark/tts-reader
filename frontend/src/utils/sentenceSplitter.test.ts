import { describe, expect, it } from "vitest";

import { escapeHtml, splitSentences } from "./sentenceSplitter";

describe("splitSentences", () => {
  it("마침표·물음표·느낌표 뒤 공백에서 나눈다", () => {
    expect(splitSentences("첫 문장입니다. 정말요? 그렇습니다!")).toEqual([
      "첫 문장입니다.",
      "정말요?",
      "그렇습니다!",
    ]);
  });

  it("따옴표 안의 마침표에서는 나누지 않는다", () => {
    expect(splitSentences('그가 "안녕. 반가워." 라고 했다. 끝.')).toEqual([
      '그가 "안녕. 반가워." 라고 했다.',
      "끝.",
    ]);
  });

  it("「」 안의 마침표에서는 나누지 않는다", () => {
    expect(splitSentences("「멈춰. 기다려.」 그가 말했다. 끝.")).toEqual([
      "「멈춰. 기다려.」 그가 말했다.",
      "끝.",
    ]);
  });

  it("소수점이나 버전 번호처럼 뒤에 공백이 없으면 나누지 않는다", () => {
    expect(splitSentences("원주율은 3.14이고 버전은 v1.2.3입니다. 끝.")).toEqual([
      "원주율은 3.14이고 버전은 v1.2.3입니다.",
      "끝.",
    ]);
  });

  it("문장 부호 없이 끝나는 나머지도 문장으로 남긴다", () => {
    expect(splitSentences("첫 문장. 마침표 없는 끝")).toEqual(["첫 문장.", "마침표 없는 끝"]);
  });

  it("빈 문단은 빈 배열", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("escapeHtml", () => {
  it("HTML 특수 문자를 이스케이프한다", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});
