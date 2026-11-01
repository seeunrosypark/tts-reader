import { describe, expect, it } from "vitest";

import {
  addSpeechSample,
  charsPerSecond,
  DEFAULT_CHARS_PER_SECOND,
  estimateSeconds,
  formatRemaining,
  isMeasured,
} from "./speechRate";

describe("charsPerSecond", () => {
  it("30초 넘게 들어 보기 전에는 기본값", () => {
    const rates = addSpeechSample({}, "a", 100, 20);
    expect(charsPerSecond(rates, "a")).toBe(DEFAULT_CHARS_PER_SECOND);
    expect(isMeasured(rates, "a")).toBe(false);
  });

  it("충분히 들으면 음성별 측정값", () => {
    let rates = addSpeechSample({}, "a", 200, 25);
    rates = addSpeechSample(rates, "a", 80, 10);
    expect(charsPerSecond(rates, "a")).toBe(8);
    expect(charsPerSecond(rates, "b")).toBe(DEFAULT_CHARS_PER_SECOND);
  });

  it("오래 쌓이면 절반으로 줄여 최근 기록 비중을 높인다 (비율은 유지)", () => {
    const rates = addSpeechSample({ a: { chars: 21000, seconds: 3000 } }, "a", 7000, 1000);
    expect(rates.a).toEqual({ chars: 14000, seconds: 2000 });
  });

  it("길이가 없는 기록은 무시한다", () => {
    expect(addSpeechSample({}, "a", 10, NaN)).toEqual({});
  });
});

describe("남은 시간", () => {
  it("배속만큼 줄어든다", () => {
    expect(estimateSeconds(6000, 5, 2)).toBe(600);
  });

  it("형식", () => {
    expect([0, 20, 90, 3600, 7500].map(formatRemaining)).toEqual([
      "0분",
      "1분 미만",
      "2분",
      "1시간",
      "2시간 5분",
    ]);
  });
});
