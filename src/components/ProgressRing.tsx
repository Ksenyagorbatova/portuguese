import type { ReactNode } from "react";

// SVG progress ring used on the review hero. Accent fill on a track, rounded
// cap, animated stroke-dashoffset (see .m-ring-fill in index.css).
export function ProgressRing({
  pct,
  size = 96,
  stroke = 9,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="m-ring-wrap" style={{ width: size, height: size }}>
      <svg className="m-ring" width={size} height={size}>
        <circle
          className="m-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="m-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="m-ring-center">{children}</div>
    </div>
  );
}
