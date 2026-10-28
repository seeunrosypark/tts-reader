import { useRef } from "react";

import { useDismiss } from "../hooks/useDismiss";
import {
  buildHeatmap,
  computeStreak,
  dayKey,
  GOAL_MINUTE_OPTIONS,
  goalSeconds,
  totalStats,
  type ReadingStats,
} from "../utils/readingStats";
import { GoalRing } from "./GoalRing";

const HEATMAP_WEEKS = 20;

type StatsDialogProps = {
  stats: ReadingStats;
  onClose: () => void;
  onGoalMinutesChange: (minutes: number) => void;
  children?: React.ReactNode;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}분`;
  }
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

/** 잔디 칸 색 단계: 0(안 읽음) ~ 4(목표의 2배 이상). */
function heatLevel(seconds: number, goal: number): number {
  if (seconds <= 0) {
    return 0;
  }
  return Math.min(4, Math.floor((seconds / goal) * 2) + 1);
}

export function StatsDialog({ stats, onClose, onGoalMinutesChange, children }: StatsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss([panelRef], true, onClose);

  const now = new Date();
  const today = stats.days[dayKey(now)] ?? { seconds: 0, sentences: 0 };
  const goal = goalSeconds(stats);
  const streak = computeStreak(stats, now);
  const total = totalStats(stats);
  const heatmap = buildHeatmap(stats, now, HEATMAP_WEEKS);

  return (
    <div className="dialog-backdrop">
      <div ref={panelRef} className="stats-dialog" role="dialog" aria-modal="true" aria-label="독서 기록">
        <header className="stats-dialog-header">
          <h2>독서 기록</h2>
          <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="stats-today">
          <GoalRing fraction={today.seconds / goal} size={96} stroke={10}>
            <strong>{Math.floor(today.seconds / 60)}</strong>
            <small>/ {stats.goalMinutes}분</small>
          </GoalRing>
          <dl className="stats-numbers">
            <div>
              <dt>연속</dt>
              <dd>🔥 {streak}일</dd>
            </div>
            <div>
              <dt>오늘 들은 문장</dt>
              <dd>{today.sentences}개</dd>
            </div>
            <div>
              <dt>누적</dt>
              <dd>
                {formatDuration(total.seconds)} · {total.sentences}문장
              </dd>
            </div>
          </dl>
        </section>

        <label className="stats-goal">
          하루 목표
          <select
            value={stats.goalMinutes}
            onChange={(event) => onGoalMinutesChange(Number(event.target.value))}
          >
            {GOAL_MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes}분
              </option>
            ))}
          </select>
        </label>

        <section>
          <h3 className="stats-section-title">최근 {HEATMAP_WEEKS}주</h3>
          <div className="heatmap" role="img" aria-label={`최근 ${HEATMAP_WEEKS}주 독서 기록`}>
            {heatmap.map((column) => (
              <div key={column[0].key} className="heatmap-column">
                {column.map((day) => (
                  <span
                    key={day.key}
                    className={`heatmap-cell level-${heatLevel(day.seconds, goal)}${day.isFuture ? " is-future" : ""}`}
                    title={day.isFuture ? undefined : `${day.key} · ${formatDuration(day.seconds)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="heatmap-legend">
            적음
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`heatmap-cell level-${level}`} />
            ))}
            많음 · 목표를 채우면 진한 색
          </p>
        </section>

        {children}
      </div>
    </div>
  );
}
