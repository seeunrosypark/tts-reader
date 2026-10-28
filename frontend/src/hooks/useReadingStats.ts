import { useCallback, useEffect, useRef, useState } from "react";

import { applyListen, type ListenEvent, type Reward } from "../utils/achievements";
import { loadStats, saveStats, type ReadingStats } from "../utils/readingStats";

/** 끝까지 들은 문장을 기록하고, 목표 달성·장 완료·레벨 업·배지 같은 보상을 알려 준다. */
export function useReadingStats(onReward: (reward: Reward) => void) {
  const [stats, setStats] = useState(loadStats);
  // 문장이 연달아 끝날 때 최신 값 위에 쌓도록 ref로도 들고 있는다.
  const statsRef = useRef(stats);
  const onRewardRef = useRef(onReward);

  useEffect(() => {
    onRewardRef.current = onReward;
  }, [onReward]);

  const update = useCallback((next: ReadingStats) => {
    statsRef.current = next;
    saveStats(next);
    setStats(next);
  }, []);

  /** stats를 바꾸고 보상을 내는 계산을 적용한다 (퀴즈 결과 등에서도 쓴다). */
  const applyChange = useCallback(
    (change: (current: ReadingStats) => { stats: ReadingStats; rewards: Reward[] }) => {
      const { stats: next, rewards } = change(statsRef.current);
      update(next);
      rewards.forEach((reward) => onRewardRef.current(reward));
    },
    [update],
  );

  const recordListening = useCallback(
    (event: Omit<ListenEvent, "now">) =>
      applyChange((current) => applyListen(current, { ...event, now: new Date() })),
    [applyChange],
  );

  const setGoalMinutes = useCallback(
    (goalMinutes: number) => update({ ...statsRef.current, goalMinutes }),
    [update],
  );

  return { stats, recordListening, applyChange, setGoalMinutes };
}
