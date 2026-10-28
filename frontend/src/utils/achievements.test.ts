import { describe, expect, it } from "vitest";

import { applyListen, levelFromXp, xpForLevel, type ListenEvent, type Reward } from "./achievements";
import type { TocItem } from "./markdownToSentences";
import { emptyStats, type ReadingStats } from "./readingStats";
import type { Sentence } from "./sentenceSplitter";

// 0: # 책   1~10: ## 1장 + 본문 9   11~20: ## 2장 + 본문 9
const sentences: Sentence[] = Array.from({ length: 21 }, (_, index) => ({ index, text: `문장 ${index}.` }));
const toc: TocItem[] = [
  { id: "book", level: 1, text: "책", sentenceIndex: 0 },
  { id: "c1", level: 2, text: "1장", sentenceIndex: 1 },
  { id: "c2", level: 2, text: "2장", sentenceIndex: 11 },
];
const noon = new Date("2026-10-29T12:00:00");

function listen(stats: ReadingStats, index: number, overrides: Partial<ListenEvent> = {}) {
  return applyListen(stats, {
    fileName: "book.md",
    sentence: sentences[index],
    sentences,
    toc,
    seconds: 1,
    speed: 2,
    now: noon,
    ...overrides,
  });
}

function listenAll(stats: ReadingStats, indexes: number[]): { stats: ReadingStats; rewards: Reward[] } {
  const rewards: Reward[] = [];
  for (const index of indexes) {
    const result = listen(stats, index);
    stats = result.stats;
    rewards.push(...result.rewards);
  }
  return { stats, rewards };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const types = (rewards: Reward[]) => rewards.map((reward) => (reward.type === "badge" ? `badge:${reward.badge.id}` : reward.type));

describe("레벨", () => {
  it("경험치 구간", () => {
    expect([0, 24, 25, 99, 100, 225].map(levelFromXp)).toEqual([1, 1, 2, 2, 3, 4]);
    expect(xpForLevel(levelFromXp(150))).toBe(100);
  });
});

describe("applyListen", () => {
  it("문장마다 경험치 1, 같은 문장을 다시 들어도 한 번만 기록", () => {
    const { stats } = listenAll(emptyStats(), [1, 1, 2]);
    expect(stats.xp).toBe(3);
    expect(stats.heard["book.md"]).toEqual([1, 2]);
  });

  it("장 문장의 90% 이상을 들으면 장 완료 + 첫 장 배지", () => {
    // 1장은 10문장 → 9문장째에서 완료
    const first8 = listenAll(emptyStats(), range(1, 8));
    expect(types(first8.rewards)).not.toContain("chapter-complete");
    const ninth = listen(first8.stats, 9);
    expect(types(ninth.rewards)).toEqual(
      expect.arrayContaining(["chapter-complete", "badge:first-chapter"]),
    );
    expect(ninth.stats.completedChapters["book.md"]).toHaveProperty("1장");
  });

  it("이미 완료한 장은 다시 보상하지 않는다", () => {
    const done = listenAll(emptyStats(), range(1, 10));
    expect(types(listen(done.stats, 1).rewards)).not.toContain("chapter-complete");
  });

  it("건너뛰며 일부만 들으면 완료가 아니다", () => {
    const skipped = listenAll(emptyStats(), [1, 3, 5, 7, 9, 10]);
    expect(skipped.stats.completedChapters["book.md"]).toBeUndefined();
  });

  it("모든 장을 완료하면 완독", () => {
    const { rewards } = listenAll(emptyStats(), range(1, 20));
    expect(types(rewards)).toEqual(expect.arrayContaining(["book-complete", "badge:book-complete"]));
  });

  it("오늘 목표를 채우는 순간 한 번만 알리고 보너스 경험치", () => {
    let stats = { ...emptyStats(), goalMinutes: 1 };
    stats = listen(stats, 1, { seconds: 59 }).stats;
    const reached = listen(stats, 2, { seconds: 1 });
    expect(types(reached.rewards)).toContain("goal-reached");
    expect(reached.stats.xp).toBe(2 + 30);
    expect(types(listen(reached.stats, 3).rewards)).not.toContain("goal-reached");
  });

  it("레벨이 오르면 알린다", () => {
    const { rewards } = listenAll({ ...emptyStats(), xp: 24 }, [1]);
    expect(rewards).toContainEqual({ type: "level-up", level: 2 });
  });

  it("시간대 배지", () => {
    expect(types(listen(emptyStats(), 1, { now: new Date("2026-10-29T01:30:00") }).rewards)).toContain(
      "badge:night-owl",
    );
    expect(types(listen(emptyStats(), 1, { now: new Date("2026-10-29T06:00:00") }).rewards)).toContain(
      "badge:early-bird",
    );
  });

  it("파일 이름이 없으면 장 기록은 하지 않지만 시간과 경험치는 쌓는다", () => {
    const { stats } = listen(emptyStats(), 1, { fileName: null });
    expect(stats.heard).toEqual({});
    expect(stats.xp).toBe(1);
  });
});
