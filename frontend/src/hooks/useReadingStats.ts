import { useCallback, useEffect, useRef, useState } from "react";

import {
  addListening,
  computeStreak,
  dayKey,
  isGoalMet,
  loadStats,
  saveStats,
  type ReadingStats,
} from "../utils/readingStats";

export type StatsEvent = { type: "goal-reached"; streak: number };

/** 끝까지 들은 문장을 기록하고, 오늘 목표를 막 채운 순간을 알려 준다. */
export function useReadingStats(onEvent: (event: StatsEvent) => void) {
  const [stats, setStats] = useState(loadStats);
  // 문장이 연달아 끝날 때 최신 값 위에 쌓도록 ref로도 들고 있는다.
  const statsRef = useRef(stats);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const update = useCallback((next: ReadingStats) => {
    statsRef.current = next;
    saveStats(next);
    setStats(next);
  }, []);

  const recordListening = useCallback(
    (seconds: number) => {
      const now = new Date();
      const before = statsRef.current;
      const after = addListening(before, seconds, now);
      update(after);

      const key = dayKey(now);
      if (!isGoalMet(before, key) && isGoalMet(after, key)) {
        onEventRef.current({ type: "goal-reached", streak: computeStreak(after, now) });
      }
    },
    [update],
  );

  const setGoalMinutes = useCallback(
    (goalMinutes: number) => update({ ...statsRef.current, goalMinutes }),
    [update],
  );

  return { stats, recordListening, setGoalMinutes };
}
