import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { MonthlyChartPoint } from '../utils/calculations';
import { formatIDR, formatMonthShort } from '../utils/format';

export const CashflowBarChart: React.FC<{ data: MonthlyChartPoint[] }> = ({ data }) => {
  const { effectiveColors, isDark } = useTheme();
  const [activeIdx, setActiveIdx] = useState<number>(data.length - 1);
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));

  const width = 560;
  const height = 210;
  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const slotW = chartW / Math.max(1, data.length);
  const barW = Math.min(20, slotW * 0.28);

  const selected = data[activeIdx] ?? data[data.length - 1];
  const gridStroke = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.12)';

  return (
    <div className="space-y-3">
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mm-muted">
          <span className="font-medium text-mm-text">{formatMonthShort(selected.month)}</span>
          <div className="flex items-center gap-4 font-mono-num">
            <span className="text-mm-income">Masuk: {formatIDR(selected.income)}</span>
            <span className="text-mm-expense">Keluar: {formatIDR(selected.expense)}</span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 min-w-[300px] select-none"
          role="img"
          aria-label="Grafik arus kas bulanan"
        >
          {[0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + chartH * (1 - t);
            return (
              <line
                key={t}
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke={gridStroke}
                strokeDasharray="3 3"
              />
            );
          })}

          {data.map((d, idx) => {
            const cx = padL + idx * slotW + slotW / 2;
            const incH = (d.income / maxVal) * chartH;
            const expH = (d.expense / maxVal) * chartH;
            const isActive = idx === activeIdx;

            return (
              <g
                key={d.month}
                onClick={() => setActiveIdx(idx)}
                onMouseEnter={() => setActiveIdx(idx)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - slotW / 2 + 2}
                  y={padT}
                  width={slotW - 4}
                  height={chartH}
                  rx={8}
                  fill={isActive ? `${effectiveColors.primary}18` : 'transparent'}
                />
                <rect
                  x={cx - barW - 2}
                  y={padT + chartH - incH}
                  width={barW}
                  height={Math.max(2, incH)}
                  rx={4}
                  fill={effectiveColors.income}
                  opacity={isActive ? 1 : 0.78}
                />
                <rect
                  x={cx + 2}
                  y={padT + chartH - expH}
                  width={barW}
                  height={Math.max(2, expH)}
                  rx={4}
                  fill={effectiveColors.expense}
                  opacity={isActive ? 1 : 0.78}
                />
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isActive ? effectiveColors.textPrimary : effectiveColors.textSecondary}
                  fontWeight={isActive ? 600 : 400}
                  fontSize={11}
                >
                  {formatMonthShort(d.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export const NetWorthLineChart: React.FC<{ data: MonthlyChartPoint[] }> = ({ data }) => {
  const { effectiveColors, isDark } = useTheme();
  const width = 560;
  const height = 190;
  const padL = 16;
  const padR = 16;
  const padT = 20;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const vals = data.map((d) => d.netWorth);
  const minVal = Math.min(...vals, 0);
  const maxVal = Math.max(...vals, 1);
  const span = Math.max(1, maxVal - minVal);

  const pts = data.map((d, i) => {
    const x = padL + (i / Math.max(1, data.length - 1)) * chartW;
    const y = padT + chartH - ((d.netWorth - minVal) / span) * chartH;
    return { x, y, ...d };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x} ${padT + chartH} L ${pts[0].x} ${padT + chartH} Z`
      : '';
  const gridStroke = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.12)';

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-44 min-w-[300px] select-none"
        role="img"
        aria-label="Grafik perkembangan kekayaan bersih"
      >
        <defs>
          <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={effectiveColors.primary} stopOpacity="0.35" />
            <stop offset="100%" stopColor={effectiveColors.primary} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padL}
            x2={width - padR}
            y1={padT + chartH * t}
            y2={padT + chartH * t}
            stroke={gridStroke}
            strokeDasharray="3 3"
          />
        ))}
        {areaPath && <path d={areaPath} fill="url(#nwAreaGrad)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={effectiveColors.primary}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, idx) => (
          <g key={p.month}>
            <circle
              cx={p.x}
              cy={p.y}
              r={idx === pts.length - 1 ? 5 : 3.5}
              fill={idx === pts.length - 1 ? effectiveColors.secondary : effectiveColors.primary}
              stroke={effectiveColors.surface}
              strokeWidth="2"
            />
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fill={effectiveColors.textSecondary}
              fontSize={11}
            >
              {formatMonthShort(p.month)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export interface CategorySlice {
  name: string;
  amount: number;
  color: string;
  pct: number;
}

export const CategoryDonutChart: React.FC<{
  slices: CategorySlice[];
  totalAmount: number;
}> = ({ slices, totalAmount }) => {
  const { isDark } = useTheme();
  const size = 164;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.10)'}
            strokeWidth={stroke}
          />
          {slices.map((slice) => {
            const dash = (slice.pct / 100) * circumference;
            const el = (
              <circle
                key={slice.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
          <span className="text-[11px] text-mm-muted">Total Keluar</span>
          <span className="text-xs font-bold text-mm-text font-mono-num mt-0.5 leading-tight break-all">
            {formatIDR(totalAmount)}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {slices.slice(0, 6).map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-mm-text truncate">{s.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono-num text-xs">
              <span className="text-mm-muted">{s.pct.toFixed(0)}%</span>
              <span className="text-mm-text font-semibold">{formatIDR(s.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ScoreRing: React.FC<{
  score: number;
  size?: number;
}> = ({ score, size = 84 }) => {
  const { effectiveColors, isDark } = useTheme();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circ;
  const color =
    clamped >= 80
      ? effectiveColors.success
      : clamped >= 60
        ? effectiveColors.primary
        : clamped >= 40
          ? effectiveColors.warning
          : effectiveColors.expense;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.12)'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-mm-text font-mono-num leading-none">
          {clamped}
        </span>
        <span className="text-[10px] text-mm-muted mt-0.5">/ 100</span>
      </div>
    </div>
  );
};
