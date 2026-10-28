import { describe, expect, it } from "vitest";

import {
  addListening,
  buildHeatmap,
  computeStreak,
  dayKey,
  emptyStats,
  isGoalMet,
  totalStats,
  type ReadingStats,
} from "./readingStats";

const date = (text: string) => new Date(`${text}T12:00:00`);

/** goalMinutes=1(60초) 기준으로 주어진 날짜들에 seconds만큼 기록한다. */
function statsWith(entries: Record<string, number>): ReadingStats {
  const stats = { ...emptyStats(), goalMinutes: 1 };
  for (const [key, seconds] of Object.entries(entries)) {
    stats.days[key] = { seconds, sentences: 1 };
  }
  return stats;
}

describe("dayKey", () => {
  it("로컬 날짜를 YYYY-MM-DD로", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("addListening", () => {
  it("그날 기록에 시간과 문장 수를 더하고 원본은 바꾸지 않는다", () => {
    const before = emptyStats();
    const after = addListening(addListening(before, 3, date("2026-10-29")), 4.5, date("2026-10-29"));
    expect(after.days["2026-10-29"]).toEqual({ seconds: 7.5, sentences: 2 });
    expect(before.days).toEqual({});
  });
});

describe("computeStreak", () => {
  it("오늘까지 목표를 채운 연속일", () => {
    const stats = statsWith({ "2026-10-27": 60, "2026-10-28": 90, "2026-10-29": 60 });
    expect(computeStreak(stats, date("2026-10-29"))).toBe(3);
  });

  it("오늘 아직 못 채웠으면 어제까지 센다 (연속이 끊긴 게 아님)", () => {
    const stats = statsWith({ "2026-10-27": 60, "2026-10-28": 60, "2026-10-29": 10 });
    expect(computeStreak(stats, date("2026-10-29"))).toBe(2);
  });

  it("하루라도 비면 거기서 끊긴다", () => {
    const stats = statsWith({ "2026-10-25": 60, "2026-10-27": 60, "2026-10-28": 60 });
    expect(computeStreak(stats, date("2026-10-28"))).toBe(2);
    expect(computeStreak(stats, date("2026-10-30"))).toBe(0);
  });

  it("월말을 넘어가도 이어진다", () => {
    const stats = statsWith({ "2026-09-30": 60, "2026-10-01": 60 });
    expect(computeStreak(stats, date("2026-10-01"))).toBe(2);
  });
});

describe("isGoalMet", () => {
  it("목표 시간 이상이면 달성", () => {
    const stats = statsWith({ "2026-10-29": 59.9 });
    expect(isGoalMet(stats, "2026-10-29")).toBe(false);
    expect(isGoalMet(addListening(stats, 0.1, date("2026-10-29")), "2026-10-29")).toBe(true);
  });
});

describe("buildHeatmap", () => {
  it("일요일 시작 주 단위 열, 마지막 열은 오늘이 속한 주", () => {
    // 2026-10-29는 목요일
    const columns = buildHeatmap(statsWith({ "2026-10-29": 30 }), date("2026-10-29"), 2);
    expect(columns).toHaveLength(2);
    expect(columns[0][0].key).toBe("2026-10-18");
    expect(columns[1][0].key).toBe("2026-10-25");
    expect(columns[1][4]).toEqual({ key: "2026-10-29", seconds: 30, isFuture: false });
    expect(columns[1][5].isFuture).toBe(true);
  });
});

describe("totalStats", () => {
  it("모든 날의 합", () => {
    expect(totalStats(statsWith({ "2026-10-28": 30, "2026-10-29": 40 }))).toEqual({ seconds: 70, sentences: 2 });
  });
});
