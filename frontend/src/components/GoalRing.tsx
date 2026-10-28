type GoalRingProps = {
  /** 0~1 */
  fraction: number;
  size: number;
  stroke: number;
  children?: React.ReactNode;
};

/** 오늘 목표를 얼마나 채웠는지 보여 주는 원형 막대. 다 채우면 색이 바뀐다. */
export function GoalRing({ fraction, size, stroke, children }: GoalRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(fraction, 0), 1);

  return (
    <span
      className={`goal-ring${clamped >= 1 ? " is-complete" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="goal-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="goal-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <span className="goal-ring-label">{children}</span>}
    </span>
  );
}
