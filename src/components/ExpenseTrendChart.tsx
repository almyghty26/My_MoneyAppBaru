import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Transaction } from '../types/finance';
import {
  formatIDR,
  formatMonthLabel,
  formatMonthShort,
  getRecentMonths,
  normalizeLocalDateKey,
} from '../utils/format';

interface ExpenseTrendPoint {
  month: string;
  label: string;
  fullLabel: string;
  amount: number;
  isCurrent: boolean;
}

interface ExpenseTrendChartProps {
  transactions: Transaction[];
  selectedMonth: string;
  onOpenReports: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ExpenseTrendPoint }>;
  avg: number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, avg }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  const diffFromAvg = avg > 0 ? ((item.amount - avg) / avg) * 100 : null;

  return (
    <div className="rounded-xl bg-mm-surface border border-mm-border px-3.5 py-2.5 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-mm-text">{item.fullLabel}</p>
      <p className="text-sm font-bold text-mm-expense font-mono-num">{formatIDR(item.amount)}</p>
      {diffFromAvg !== null && item.amount > 0 && (
        <p className="text-[11px] text-mm-muted font-mono-num">
          {diffFromAvg >= 0 ? '+' : ''}
          {diffFromAvg.toFixed(0)}% vs rata-rata
        </p>
      )}
    </div>
  );
};

export const ExpenseTrendChart: React.FC<ExpenseTrendChartProps> = ({
  transactions,
  selectedMonth,
  onOpenReports,
}) => {
  const { effectiveColors, isDark } = useTheme();

  const monthlyExpenses = useMemo<ExpenseTrendPoint[]>(() => {
    const months = getRecentMonths(selectedMonth, 6);
    const totalsMap = new Map<string, number>();
    for (const m of months) totalsMap.set(m, 0);

    const seenIds = new Set<string>();
    for (const t of transactions) {
      if (!t.id || seenIds.has(t.id)) continue;
      seenIds.add(t.id);
      if (t.type !== 'expense') continue;
      const localDate = normalizeLocalDateKey(t.date);
      if (!localDate) continue;
      const m = localDate.slice(0, 7);
      if (totalsMap.has(m)) {
        totalsMap.set(m, (totalsMap.get(m) || 0) + t.amount);
      }
    }

    return months.map((m, idx) => ({
      month: m,
      label: formatMonthShort(m),
      fullLabel: formatMonthLabel(m),
      amount: totalsMap.get(m) || 0,
      isCurrent: idx === months.length - 1,
    }));
  }, [transactions, selectedMonth]);

  const stats = useMemo(() => {
    const nonZero = monthlyExpenses.filter((m) => m.amount > 0);
    const sum = monthlyExpenses.reduce((acc, m) => acc + m.amount, 0);
    const avg = nonZero.length > 0 ? Math.round(sum / nonZero.length) : 0;
    const current = monthlyExpenses[monthlyExpenses.length - 1]?.amount || 0;
    const previous = monthlyExpenses[monthlyExpenses.length - 2]?.amount || 0;
    const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
    const peak = nonZero.reduce<ExpenseTrendPoint | null>(
      (max, item) => (!max || item.amount > max.amount ? item : max),
      null
    );

    return { sum, avg, current, deltaPct, peak, hasAnyData: sum > 0 };
  }, [monthlyExpenses]);

  return (
    <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-mm-text">Tren Pengeluaran 6 Bulan Terakhir</h3>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-mm-muted">
            <span>
              Rata-rata:{' '}
              <strong className="text-mm-text font-mono-num">{formatIDR(stats.avg)}/bln</strong>
            </span>
            {stats.peak && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Tertinggi:{' '}
                  <strong className="text-mm-text">{stats.peak.label}</strong>{' '}
                  <span className="font-mono-num text-mm-muted">
                    ({formatIDR(stats.peak.amount)})
                  </span>
                </span>
              </>
            )}
            {stats.deltaPct !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1 font-medium ${
                    stats.deltaPct <= 0 ? 'text-mm-income' : 'text-mm-expense'
                  }`}
                >
                  {stats.deltaPct <= 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" />
                  )}
                  <span className="font-mono-num">
                    {stats.deltaPct >= 0 ? '+' : ''}
                    {stats.deltaPct.toFixed(1)}% vs bulan lalu
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenReports}
          className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <span>Laporan Lengkap</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-mm-muted">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: effectiveColors.secondary }}
          />
          <span>Bulan aktif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm opacity-75"
            style={{ backgroundColor: effectiveColors.primary }}
          />
          <span>Bulan sebelumnya</span>
        </div>
        {stats.avg > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-4 border-t border-dashed"
              style={{ borderColor: effectiveColors.primary }}
            />
            <span>Garis rata-rata</span>
          </div>
        )}
      </div>

      <div className="relative h-56 sm:h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={monthlyExpenses}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.10)'}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: effectiveColors.textSecondary, fontSize: 11 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={78}
              tick={{
                fill: effectiveColors.textSecondary,
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
              }}
              tickFormatter={(value: number) => (value === 0 ? '0' : formatIDR(value))}
            />
            <Tooltip
              cursor={{ fill: `${effectiveColors.primary}14`, radius: 8 }}
              content={<CustomTooltip avg={stats.avg} />}
            />
            {stats.avg > 0 && (
              <ReferenceLine
                y={stats.avg}
                stroke={effectiveColors.primary}
                strokeOpacity={0.55}
                strokeDasharray="4 4"
              />
            )}
            <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={42}>
              {monthlyExpenses.map((entry) => {
                const fill = entry.isCurrent
                  ? effectiveColors.secondary
                  : stats.avg > 0 && entry.amount > stats.avg * 1.15
                    ? effectiveColors.expense
                    : effectiveColors.primary;
                return (
                  <Cell
                    key={entry.month}
                    fill={fill}
                    fillOpacity={entry.isCurrent ? 1 : 0.72}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {!stats.hasAnyData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-mm-muted bg-mm-surface/95 px-3.5 py-2 rounded-xl border border-mm-border">
              Belum ada pengeluaran tercatat dalam 6 bulan terakhir
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
