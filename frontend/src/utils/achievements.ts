import type { TocItem } from "./markdownToSentences";
import { listChapters, type Chapter } from "./readingProgress";
import {
  addListening,
  computeStreak,
  dayKey,
  isGoalMet,
  totalStats,
  type ReadingStats,
} from "./readingStats";
import type { Sentence } from "./sentenceSplitter";

/** 장 문장 중 이 비율 이상을 끝까지 들어야 완료로 친다 (건너뛰며 넘기면 받을 수 없게). */
export const CHAPTER_COMPLETE_RATIO = 0.9;

export const XP = {
  sentence: 1,
  goal: 30,
  chapter: 50,
  book: 200,
  quizPerfect: 40,
} as const;

export type BadgeId =
  | "first-chapter"
  | "ten-chapters"
  | "book-complete"
  | "streak-3"
  | "streak-7"
  | "streak-30"
  | "sentences-1000"
  | "night-owl"
  | "early-bird"
  | "speed-reader"
  | "quiz-perfect";

export type Badge = { id: BadgeId; icon: string; name: string; description: string };

export const BADGES: Badge[] = [
  { id: "first-chapter", icon: "🌱", name: "첫걸음", description: "처음으로 한 장을 끝까지 들었다" },
  { id: "ten-chapters", icon: "📖", name: "열 장 정복", description: "장을 10개 완료했다" },
  { id: "book-complete", icon: "📚", name: "완독", description: "한 파일의 모든 장을 완료했다" },
  { id: "streak-3", icon: "🔥", name: "작심삼일 돌파", description: "3일 연속 목표 달성" },
  { id: "streak-7", icon: "🗓️", name: "일주일 개근", description: "7일 연속 목표 달성" },
  { id: "streak-30", icon: "👑", name: "한 달 개근", description: "30일 연속 목표 달성" },
  { id: "sentences-1000", icon: "💯", name: "천 문장", description: "누적 1,000문장을 끝까지 들었다" },
  { id: "night-owl", icon: "🦉", name: "올빼미", description: "자정부터 새벽 4시 사이에 들었다" },
  { id: "early-bird", icon: "🐦", name: "아침형 독서가", description: "새벽 5시부터 7시 사이에 들었다" },
  { id: "speed-reader", icon: "⚡", name: "3배속 달인", description: "3배속 이상으로 300문장을 들었다" },
  { id: "quiz-perfect", icon: "🧠", name: "정독 인증", description: "장 퀴즈에서 만점을 받았다" },
];

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 25)) + 1;
}

/** 레벨 시작 경험치 (Lv.2 = 25, Lv.3 = 100, Lv.4 = 225 …) */
export function xpForLevel(level: number): number {
  return 25 * (level - 1) ** 2;
}

export type Reward =
  | { type: "goal-reached"; streak: number }
  | { type: "chapter-complete"; title: string }
  | { type: "book-complete"; fileName: string }
  | { type: "level-up"; level: number }
  | { type: "badge"; badge: Badge }
  | { type: "quiz-perfect"; title: string };

export type ListenEvent = {
  fileName: string | null;
  sentence: Sentence;
  sentences: Sentence[];
  toc: TocItem[];
  seconds: number;
  speed: number;
  now: Date;
};

function insertSorted(list: number[], value: number): number[] {
  if (list.includes(value)) {
    return list;
  }
  return [...list, value].sort((a, b) => a - b);
}

/** 장 안에서 끝까지 들은 문장의 비율. */
export function chapterCoverage(chapter: Chapter, sentences: Sentence[], heard: number[]): number {
  const playable = sentences.filter(
    (sentence) => !sentence.skip && sentence.index >= chapter.start && sentence.index < chapter.end,
  );
  if (playable.length === 0) {
    return 0;
  }
  const heardSet = new Set(heard);
  return playable.filter((sentence) => heardSet.has(sentence.index)).length / playable.length;
}

function awardBadge(stats: ReadingStats, id: BadgeId, now: Date, rewards: Reward[]): ReadingStats {
  if (stats.badges[id]) {
    return stats;
  }
  rewards.push({ type: "badge", badge: BADGES.find((badge) => badge.id === id)! });
  return { ...stats, badges: { ...stats.badges, [id]: now.getTime() } };
}

/** 경험치를 더하고, 레벨이 오르면 보상에 추가한다. */
export function addXp(stats: ReadingStats, amount: number, rewards: Reward[]): ReadingStats {
  const before = levelFromXp(stats.xp);
  const next = { ...stats, xp: stats.xp + amount };
  const after = levelFromXp(next.xp);
  if (after > before) {
    rewards.push({ type: "level-up", level: after });
  }
  return next;
}

/** 문장 하나를 끝까지 들었을 때의 기록과 보상. 원본 stats는 바꾸지 않는다. */
export function applyListen(
  stats: ReadingStats,
  event: ListenEvent,
): { stats: ReadingStats; rewards: Reward[] } {
  const { fileName, sentence, sentences, toc, seconds, speed, now } = event;
  const rewards: Reward[] = [];
  const key = dayKey(now);
  const wasGoalMet = isGoalMet(stats, key);

  let next = addListening(stats, seconds, now);
  next = addXp(next, XP.sentence, rewards);
  if (speed >= 3) {
    next = { ...next, fastSentences: next.fastSentences + 1 };
  }

  if (!wasGoalMet && isGoalMet(next, key)) {
    const streak = computeStreak(next, now);
    rewards.push({ type: "goal-reached", streak });
    next = addXp(next, XP.goal, rewards);
    if (streak >= 3) next = awardBadge(next, "streak-3", now, rewards);
    if (streak >= 7) next = awardBadge(next, "streak-7", now, rewards);
    if (streak >= 30) next = awardBadge(next, "streak-30", now, rewards);
  }

  if (fileName) {
    const heard = insertSorted(next.heard[fileName] ?? [], sentence.index);
    next = { ...next, heard: { ...next.heard, [fileName]: heard } };

    const chapters = listChapters(toc);
    const chapter = chapters.find((item) => sentence.index >= item.start && sentence.index < item.end);
    const completed = next.completedChapters[fileName] ?? {};
    if (
      chapter &&
      !completed[chapter.title] &&
      chapterCoverage(chapter, sentences, heard) >= CHAPTER_COMPLETE_RATIO
    ) {
      const nextCompleted = { ...completed, [chapter.title]: now.getTime() };
      next = { ...next, completedChapters: { ...next.completedChapters, [fileName]: nextCompleted } };
      rewards.push({ type: "chapter-complete", title: chapter.title });
      next = addXp(next, XP.chapter, rewards);
      next = awardBadge(next, "first-chapter", now, rewards);

      const totalCompleted = Object.values(next.completedChapters).reduce(
        (sum, fileChapters) => sum + Object.keys(fileChapters).length,
        0,
      );
      if (totalCompleted >= 10) {
        next = awardBadge(next, "ten-chapters", now, rewards);
      }

      if (chapters.length >= 2 && chapters.every((item) => nextCompleted[item.title])) {
        rewards.push({ type: "book-complete", fileName });
        next = addXp(next, XP.book, rewards);
        next = awardBadge(next, "book-complete", now, rewards);
      }
    }
  }

  if (totalStats(next).sentences >= 1000) next = awardBadge(next, "sentences-1000", now, rewards);
  if (next.fastSentences >= 300) next = awardBadge(next, "speed-reader", now, rewards);
  const hour = now.getHours();
  if (hour < 4) next = awardBadge(next, "night-owl", now, rewards);
  if (hour >= 5 && hour < 7) next = awardBadge(next, "early-bird", now, rewards);

  return { stats: next, rewards };
}

export type QuizResult = {
  fileName: string;
  chapterTitle: string;
  correct: number;
  total: number;
  now: Date;
};

/** 퀴즈 결과를 기록한다. 만점 보너스는 장마다 처음 만점일 때 한 번만 준다. */
export function applyQuizResult(
  stats: ReadingStats,
  result: QuizResult,
): { stats: ReadingStats; rewards: Reward[] } {
  const { fileName, chapterTitle, correct, total, now } = result;
  const rewards: Reward[] = [];
  const fileQuizzes = stats.quizzes[fileName] ?? {};
  const previous = fileQuizzes[chapterTitle];
  const wasPerfect = previous !== undefined && previous.best === previous.total;

  let next = stats;
  if (!previous || correct / total >= previous.best / previous.total) {
    next = {
      ...next,
      quizzes: {
        ...next.quizzes,
        [fileName]: { ...fileQuizzes, [chapterTitle]: { best: correct, total, at: now.getTime() } },
      },
    };
  }

  if (correct === total && !wasPerfect) {
    rewards.push({ type: "quiz-perfect", title: chapterTitle });
    next = addXp(next, XP.quizPerfect, rewards);
    next = awardBadge(next, "quiz-perfect", now, rewards);
  }
  return { stats: next, rewards };
}
