// 독서 기록은 이 브라우저의 localStorage에만 저장한다.
const STORAGE_KEY = "tts-reader-stats";

export const GOAL_MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const DEFAULT_GOAL_MINUTES = 15;

export type DayStats = {
  /** 끝까지 들은 문장의 재생 시간 합 (초). */
  seconds: number;
  sentences: number;
};

export type ReadingStats = {
  goalMinutes: number;
  /** "YYYY-MM-DD"(로컬 날짜) → 그날 기록 */
  days: Record<string, DayStats>;
  xp: number;
  /** 파일 이름 → 끝까지 들은 문장 번호 (오름차순) */
  heard: Record<string, number[]>;
  /** 파일 이름 → 장 제목 → 완료 시각 */
  completedChapters: Record<string, Record<string, number>>;
  /** 배지 id → 받은 시각 */
  badges: Record<string, number>;
  /** 3배속 이상으로 끝까지 들은 문장 수 */
  fastSentences: number;
};

export function emptyStats(): ReadingStats {
  return {
    goalMinutes: DEFAULT_GOAL_MINUTES,
    days: {},
    xp: 0,
    heard: {},
    completedChapters: {},
    badges: {},
    fastSentences: 0,
  };
}

export function loadStats(): ReadingStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<ReadingStats> | null;
    return { ...emptyStats(), ...parsed };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: ReadingStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addListening(stats: ReadingStats, seconds: number, now: Date): ReadingStats {
  const key = dayKey(now);
  const today = stats.days[key] ?? { seconds: 0, sentences: 0 };
  return {
    ...stats,
    days: {
      ...stats.days,
      [key]: { seconds: today.seconds + seconds, sentences: today.sentences + 1 },
    },
  };
}

export function goalSeconds(stats: ReadingStats): number {
  return stats.goalMinutes * 60;
}

export function isGoalMet(stats: ReadingStats, key: string): boolean {
  return (stats.days[key]?.seconds ?? 0) >= goalSeconds(stats);
}

/** 목표를 채운 날이 이어진 일수. 오늘 아직 못 채웠으면 어제까지의 연속일을 센다. */
export function computeStreak(stats: ReadingStats, today: Date): number {
  let cursor = isGoalMet(stats, dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (isGoalMet(stats, dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export type HeatmapDay = { key: string; seconds: number; isFuture: boolean };

/**
 * 잔디용 날짜 칸. 일요일로 시작하는 주 단위 열(column)로 나눈다.
 * 마지막 열은 오늘이 속한 주이고, 오늘 이후 칸은 isFuture.
 */
export function buildHeatmap(stats: ReadingStats, today: Date, weeks: number): HeatmapDay[][] {
  const start = addDays(today, -today.getDay() - (weeks - 1) * 7);
  const todayKey = dayKey(today);
  const columns: HeatmapDay[][] = [];
  let isFuture = false;
  for (let week = 0; week < weeks; week++) {
    const column: HeatmapDay[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const key = dayKey(addDays(start, week * 7 + weekday));
      column.push({ key, seconds: stats.days[key]?.seconds ?? 0, isFuture });
      if (key === todayKey) {
        isFuture = true;
      }
    }
    columns.push(column);
  }
  return columns;
}

export function totalStats(stats: ReadingStats): DayStats {
  return Object.values(stats.days).reduce(
    (sum, day) => ({ seconds: sum.seconds + day.seconds, sentences: sum.sentences + day.sentences }),
    { seconds: 0, sentences: 0 },
  );
}
