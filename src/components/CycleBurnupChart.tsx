"use client";

import type { BurnupPoint } from "@/lib/cycle-metrics";

export function RingProgress({
  percent,
  size = 14,
  strokeWidth = 2,
  color = "#6366f1",
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CycleBurnupChart({
  series,
  height = 150,
}: {
  series: BurnupPoint[];
  height?: number;
}) {
  if (!series || series.length === 0) {
    return (
      <div
        className="w-full flex items-center justify-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg"
        style={{ height }}
      >
        Belum ada data progres untuk cycle ini
      </div>
    );
  }

  const width = 560;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 22;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxY = Math.max(
    1,
    ...series.map((p) => Math.max(p.scope, p.started, p.completed))
  );
  const maxDaily = Math.max(1, ...series.map((p) => p.dailyCompleted));

  const xFor = (idx: number) =>
    series.length <= 1 ? padL : padL + (idx / (series.length - 1)) * chartW;
  const yFor = (val: number) => padT + chartH - (val / maxY) * chartH;

  const toPath = (vals: number[]) =>
    vals
      .map((v, idx) => `${idx === 0 ? "M" : "L"}${xFor(idx).toFixed(1)},${yFor(v).toFixed(1)}`)
      .join(" ");

  const scopePath = toPath(series.map((p) => p.scope));
  const startedPath = toPath(series.map((p) => p.started));
  const completedPath = toPath(series.map((p) => p.completed));

  const completedArea = `${completedPath} L${xFor(series.length - 1).toFixed(1)},${(
    padT + chartH
  ).toFixed(1)} L${padL},${(padT + chartH).toFixed(1)} Z`;

  const idealPath = `M${xFor(0).toFixed(1)},${yFor(0).toFixed(1)} L${xFor(
    series.length - 1
  ).toFixed(1)},${yFor(series[series.length - 1].scope).toFixed(1)}`;

  const midIdx = Math.floor((series.length - 1) / 2);
  const colW = series.length > 1 ? chartW / (series.length - 1) : chartW;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto select-none overflow-visible"
      role="img"
      aria-label="Grafik progres burn-up cycle"
    >
      <defs>
        <linearGradient id="otCompletedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
        <pattern
          id="otWeekendHatch"
          width="6"
          height="6"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Weekend hatched bands */}
      {series.map((p, idx) =>
        p.isWeekend ? (
          <rect
            key={`wk-${p.date}`}
            x={Math.max(padL, xFor(idx) - colW / 2)}
            y={padT}
            width={colW}
            height={chartH}
            fill="url(#otWeekendHatch)"
          />
        ) : null
      )}

      {/* Horizontal baseline & top scope guide */}
      <line
        x1={padL}
        y1={padT + chartH}
        x2={padL + chartW}
        y2={padT + chartH}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      {/* Ideal dashed trendline */}
      <path
        d={idealPath}
        fill="none"
        stroke="rgba(129,140,248,0.4)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />

      {/* Completed area fill */}
      <path d={completedArea} fill="url(#otCompletedGrad)" />

      {/* Daily completed vertical ticks */}
      {series.map((p, idx) => {
        if (p.dailyCompleted <= 0) return null;
        const barH = Math.max(4, (p.dailyCompleted / maxDaily) * (chartH * 0.28));
        return (
          <rect
            key={`bar-${p.date}`}
            x={xFor(idx) - 1.5}
            y={padT + chartH - barH}
            width={3}
            height={barH}
            rx={1}
            fill="#818cf8"
            opacity={0.75}
          />
        );
      })}

      {/* Scope line (zinc) */}
      <path d={scopePath} fill="none" stroke="#71717a" strokeWidth="1.25" />

      {/* Started line (amber) */}
      <path d={startedPath} fill="none" stroke="#eab308" strokeWidth="1.6" />

      {/* Completed line (indigo) */}
      <path d={completedPath} fill="none" stroke="#6366f1" strokeWidth="1.8" />

      {/* End dots */}
      <circle
        cx={xFor(series.length - 1)}
        cy={yFor(series[series.length - 1].started)}
        r={2.8}
        fill="#eab308"
      />
      <circle
        cx={xFor(series.length - 1)}
        cy={yFor(series[series.length - 1].completed)}
        r={2.8}
        fill="#6366f1"
      />

      {/* X-axis date labels (Start, Mid, End) */}
      <text
        x={padL}
        y={height - 4}
        fill="#71717a"
        fontSize="10"
        fontFamily="var(--font-mono, monospace)"
      >
        {series[0].label}
      </text>
      {series.length > 2 && (
        <text
          x={xFor(midIdx)}
          y={height - 4}
          textAnchor="middle"
          fill="#71717a"
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
        >
          {series[midIdx].label}
        </text>
      )}
      {series.length > 1 && (
        <text
          x={padL + chartW}
          y={height - 4}
          textAnchor="end"
          fill="#71717a"
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
        >
          {series[series.length - 1].label}
        </text>
      )}
    </svg>
  );
}
