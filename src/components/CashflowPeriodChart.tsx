import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MouseHandlerDataParam } from 'recharts/types/synchronisation/types';
import { useTheme } from '../contexts/ThemeContext';
import type { Transaction } from '../types/finance';
import {
  computeAnnualCashflow,
  computeDailyCashflow,
  computeWeeklyCashflow,
  computeYearlyMonthlyCashflow,
  type PeriodCashflowPoint,
} from '../utils/calculations';
import {
  formatIDR,
  formatMonthLabel,
  formatWeekRangeLabel,
  getCurrentMonthISO,
  getMondayOfWeekISO,
  getTodayISO,
  shiftDateISO,
  shiftMonthISO,
} from '../utils/format';

export type CashflowPeriodMode = 'daily' | 'weekly' | 'monthly' | 'annual';

interface CashflowPeriodChartProps {
  transactions: Transaction[];
  selectedMonth: string;
  onOpenReports?: () => void;
}

interface PeriodTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PeriodCashflowPoint }>;
}

const ANNUAL_WINDOW_SIZE = 6;

const PERIOD_OPTIONS: Array<{ id: CashflowPeriodMode; label: string }> = [
  { id: 'daily', label: 'Harian' },
  { id: 'weekly', label: 'Mingguan' },
  { id: 'monthly', label: 'Bulanan' },
  { id: 'annual', label: 'Tahunan' },
];

const PeriodTooltip: React.FC<PeriodTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-xl bg-mm-surface border border-mm-border px-3.5 py-2.5 shadow-xl text-xs space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-mm-text">{item.fullLabel}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-mm-muted">Pemasukan</span>
        <span className="font-bold text-mm-income font-mono-num">{formatIDR(item.income)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-mm-muted">Pengeluaran</span>
        <span className="font-bold text-mm-expense font-mono-num">{formatIDR(item.expense)}</span>
      </div>
    </div>
  );
};

export const CashflowPeriodChart: React.FC<CashflowPeriodChartProps> = ({
  transactions,
  selectedMonth,
  onOpenReports,
}) => {
  const { effectiveColors, isDark } = useTheme();
  const [periodMode, setPeriodMode] = useState<CashflowPeriodMode>('monthly');
  const [dailyMonth, setDailyMonth] = useState<string>(selectedMonth);
  const [weekMondayISO, setWeekMondayISO] = useState<string>(() => {
    const baseDate =
      selectedMonth === getCurrentMonthISO() ? getTodayISO() : `${selectedMonth}-01`;
    return getMondayOfWeekISO(baseDate);
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => Number(selectedMonth.slice(0, 4)));
  const [annualOffsetFromEnd, setAnnualOffsetFromEnd] = useState<number>(0);

  useEffect(() => {
    setDailyMonth(selectedMonth);
    setSelectedYear(Number(selectedMonth.slice(0, 4)));
    const baseDate =
      selectedMonth === getCurrentMonthISO() ? getTodayISO() : `${selectedMonth}-01`;
    setWeekMondayISO(getMondayOfWeekISO(baseDate));
  }, [selectedMonth]);

  const allAnnualPoints = useMemo(() => computeAnnualCashflow(transactions), [transactions]);

  useEffect(() => {
    const maxOffset = Math.max(0, allAnnualPoints.length - ANNUAL_WINDOW_SIZE);
    if (annualOffsetFromEnd > maxOffset) {
      setAnnualOffsetFromEnd(maxOffset);
    }
  }, [allAnnualPoints.length, annualOffsetFromEnd]);

  const annualRangeBounds = useMemo(() => {
    const total = allAnnualPoints.length;
    const end = Math.max(0, total - annualOffsetFromEnd);
    const start = Math.max(0, end - ANNUAL_WINDOW_SIZE);
    return {
      start,
      end,
      canPrev: start > 0,
      canNext: end < total,
    };
  }, [allAnnualPoints.length, annualOffsetFromEnd]);

  const chartData = useMemo<PeriodCashflowPoint[]>(() => {
    if (periodMode === 'daily') {
      return computeDailyCashflow(transactions, dailyMonth).map((d) => ({
        key: d.date,
        label: d.dayLabel,
        fullLabel: d.fullDateLabel,
        income: d.income,
        expense: d.expense,
      }));
    }
    if (periodMode === 'weekly') {
      return computeWeeklyCashflow(transactions, weekMondayISO);
    }
    if (periodMode === 'monthly') {
      return computeYearlyMonthlyCashflow(transactions, selectedYear);
    }
    return allAnnualPoints.slice(annualRangeBounds.start, annualRangeBounds.end);
  }, [
    periodMode,
    transactions,
    dailyMonth,
    weekMondayISO,
    selectedYear,
    allAnnualPoints,
    annualRangeBounds,
  ]);

  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const p of chartData) {
      income += p.income;
      expense += p.expense;
    }
    return { income, expense, hasAnyData: income > 0 || expense > 0 };
  }, [chartData]);

  const defaultSelectedKey = useMemo(() => {
    if (chartData.length === 0) return '';
    const today = getTodayISO();
    const currentMonth = getCurrentMonthISO();
    const currentYear = today.slice(0, 4);

    if (periodMode === 'daily' || periodMode === 'weekly') {
      const todayItem = chartData.find((p) => p.key === today);
      if (todayItem) return todayItem.key;
    } else if (periodMode === 'monthly') {
      const currMonthItem = chartData.find((p) => p.key === currentMonth);
      if (currMonthItem) return currMonthItem.key;
    } else if (periodMode === 'annual') {
      const currYearItem = chartData.find((p) => p.key === currentYear);
      if (currYearItem) return currYearItem.key;
    }

    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].income > 0 || chartData[i].expense > 0) {
        return chartData[i].key;
      }
    }
    return chartData[0].key;
  }, [chartData, periodMode]);

  const [selectedKey, setSelectedKey] = useState<string>(defaultSelectedKey);

  useEffect(() => {
    setSelectedKey(defaultSelectedKey);
  }, [defaultSelectedKey]);

  const selectedPoint = chartData.find((p) => p.key === selectedKey) ?? chartData[0] ?? null;

  const periodRangeLabel = useMemo(() => {
    if (periodMode === 'daily') return formatMonthLabel(dailyMonth);
    if (periodMode === 'weekly') return formatWeekRangeLabel(weekMondayISO);
    if (periodMode === 'monthly') return `Tahun ${selectedYear}`;
    if (chartData.length === 0) return 'Semua Tahun';
    if (chartData.length === 1) return `Tahun ${chartData[0].label}`;
    return `${chartData[0].label} – ${chartData[chartData.length - 1].label}`;
  }, [periodMode, dailyMonth, weekMondayISO, selectedYear, chartData]);

  const canNavigatePrev = periodMode === 'annual' ? annualRangeBounds.canPrev : true;
  const canNavigateNext = periodMode === 'annual' ? annualRangeBounds.canNext : true;

  const handleNavigatePrev = () => {
    if (periodMode === 'daily') {
      setDailyMonth((prev) => shiftMonthISO(prev, -1));
    } else if (periodMode === 'weekly') {
      setWeekMondayISO((prev) => getMondayOfWeekISO(shiftDateISO(prev, -7)));
    } else if (periodMode === 'monthly') {
      setSelectedYear((prev) => prev - 1);
    } else if (annualRangeBounds.canPrev) {
      setAnnualOffsetFromEnd((prev) =>
        Math.min(Math.max(0, allAnnualPoints.length - ANNUAL_WINDOW_SIZE), prev + ANNUAL_WINDOW_SIZE)
      );
    }
  };

  const handleNavigateNext = () => {
    if (periodMode === 'daily') {
      setDailyMonth((prev) => shiftMonthISO(prev, 1));
    } else if (periodMode === 'weekly') {
      setWeekMondayISO((prev) => getMondayOfWeekISO(shiftDateISO(prev, 7)));
    } else if (periodMode === 'monthly') {
      setSelectedYear((prev) => prev + 1);
    } else if (annualRangeBounds.canNext) {
      setAnnualOffsetFromEnd((prev) => Math.max(0, prev - ANNUAL_WINDOW_SIZE));
    }
  };

  const handleChartInteract = (state: MouseHandlerDataParam) => {
    const idx = state?.activeTooltipIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < chartData.length) {
      setSelectedKey(chartData[idx].key);
      return;
    }
    if (state?.activeLabel !== undefined && state.activeLabel !== null) {
      const labelStr = String(state.activeLabel);
      const found = chartData.find((p) => p.label === labelStr);
      if (found) setSelectedKey(found.key);
    }
  };

  const minChartWidthClass =
    periodMode === 'daily'
      ? 'min-w-[660px]'
      : periodMode === 'monthly'
        ? 'min-w-[460px]'
        : 'min-w-[300px]';

  const maxBarSize =
    periodMode === 'daily'
      ? 12
      : periodMode === 'monthly'
        ? 18
        : periodMode === 'weekly'
          ? 24
          : 32;

  const emptyMessage =
    periodMode === 'daily'
      ? `Belum ada pemasukan atau pengeluaran pada ${formatMonthLabel(dailyMonth)}`
      : periodMode === 'weekly'
        ? `Belum ada pemasukan atau pengeluaran pada minggu ${formatWeekRangeLabel(weekMondayISO)}`
        : periodMode === 'monthly'
          ? `Belum ada pemasukan atau pengeluaran pada Tahun ${selectedYear}`
          : 'Belum ada transaksi pemasukan atau pengeluaran tercatat';

  return (
    <section className="rounded-2xl bg-mm-surface border border-mm-border p-4 sm:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-mm-text">Grafik Pemasukan &amp; Pengeluaran</h3>
          <p className="text-xs text-mm-muted">
            Data aktual transaksi lokal berdasarkan zona waktu perangkat (transfer tidak dihitung)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Pilih periode grafik pemasukan dan pengeluaran"
            className="grid grid-cols-4 sm:inline-flex w-full sm:w-auto items-center p-1 rounded-xl bg-mm-bg border border-mm-border gap-1"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const isActive = periodMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriodMode(opt.id)}
                  aria-pressed={isActive}
                  className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-mm-brand text-mm-brand-fg shadow-sm'
                      : 'text-mm-muted hover:text-mm-text'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {onOpenReports && (
            <button
              type="button"
              onClick={onOpenReports}
              className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Laporan Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canNavigatePrev}
            onClick={handleNavigatePrev}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-mm-bg hover:bg-mm-hover disabled:opacity-40 disabled:cursor-not-allowed border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Periode sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="min-w-[140px] text-center text-xs sm:text-sm font-semibold text-mm-text px-2">
            {periodRangeLabel}
          </span>

          <button
            type="button"
            disabled={!canNavigateNext}
            onClick={handleNavigateNext}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-mm-bg hover:bg-mm-hover disabled:opacity-40 disabled:cursor-not-allowed border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Periode berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-mm-muted">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: effectiveColors.income }}
            />
            <span>Total Pemasukan:</span>
            <strong className="text-mm-income font-mono-num">
              {formatIDR(periodTotals.income)}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 text-mm-muted">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: effectiveColors.expense }}
            />
            <span>Total Pengeluaran:</span>
            <strong className="text-mm-expense font-mono-num">
              {formatIDR(periodTotals.expense)}
            </strong>
          </div>
        </div>
      </div>

      {selectedPoint && (
        <div className="rounded-xl bg-mm-bg/85 border border-mm-border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-mm-text">{selectedPoint.fullLabel}</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono-num">
            <span className="text-mm-income">
              Pemasukan: <strong>{formatIDR(selectedPoint.income)}</strong>
            </span>
            <span className="text-mm-expense">
              Pengeluaran: <strong>{formatIDR(selectedPoint.expense)}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-x-auto pb-1">
        <div className={`h-56 sm:h-64 w-full ${minChartWidthClass}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              barGap={periodMode === 'daily' ? 2 : 4}
              barCategoryGap={periodMode === 'daily' ? '24%' : '28%'}
              onClick={handleChartInteract}
              onMouseMove={handleChartInteract}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.10)'}
              />
              <XAxis
                dataKey="label"
                interval={0}
                axisLine={false}
                tickLine={false}
                tick={{ fill: effectiveColors.textSecondary, fontSize: 11 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={88}
                tick={{
                  fill: effectiveColors.textSecondary,
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                tickFormatter={(value: number) => (value === 0 ? 'Rp0' : formatIDR(value))}
              />
              <Tooltip
                cursor={{ fill: `${effectiveColors.primary}18`, radius: 6 }}
                content={<PeriodTooltip />}
              />
              <Bar
                dataKey="income"
                name="Pemasukan"
                fill={effectiveColors.income}
                radius={[4, 4, 0, 0]}
                maxBarSize={maxBarSize}
                animationDuration={220}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`inc-${entry.key}`}
                    fill={effectiveColors.income}
                    fillOpacity={selectedPoint?.key === entry.key ? 1 : 0.82}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="expense"
                name="Pengeluaran"
                fill={effectiveColors.expense}
                radius={[4, 4, 0, 0]}
                maxBarSize={maxBarSize}
                animationDuration={220}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={`exp-${entry.key}`}
                    fill={effectiveColors.expense}
                    fillOpacity={selectedPoint?.key === entry.key ? 1 : 0.82}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {!periodTotals.hasAnyData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-mm-muted bg-mm-surface/95 px-3.5 py-2 rounded-xl border border-mm-border text-center mx-4">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
