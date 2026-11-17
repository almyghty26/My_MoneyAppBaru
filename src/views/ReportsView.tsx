import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CashflowPeriodChart } from '../components/CashflowPeriodChart';
import {
  CashflowBarChart,
  CategoryDonutChart,
  type CategorySlice,
  NetWorthLineChart,
} from '../components/Charts';
import { PRESET_COLORS } from '../constants/categories';
import type { AssetDebtItem, CategoryDef, Transaction, Wallet } from '../types/finance';
import {
  computeHistoricalSeries,
  computeMonthlySummary,
  computeNetWorth,
} from '../utils/calculations';
import {
  formatIDR,
  formatMonthLabel,
  normalizeLocalDateKey,
  shiftMonthISO,
} from '../utils/format';

interface ReportsViewProps {
  selectedMonth: string;
  onMonthChange: (monthISO: string) => void;
  wallets: Wallet[];
  transactions: Transaction[];
  assetsDebts: AssetDebtItem[];
  categories: CategoryDef[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  onMonthChange,
  wallets,
  transactions,
  assetsDebts,
  categories,
}) => {
  const summary = useMemo(
    () => computeMonthlySummary(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const netWorth = useMemo(
    () => computeNetWorth(wallets, assetsDebts),
    [wallets, assetsDebts]
  );
  const historical = useMemo(
    () => computeHistoricalSeries(wallets, transactions, assetsDebts, selectedMonth, 6),
    [wallets, transactions, assetsDebts, selectedMonth]
  );

  const categorySlices = useMemo<{ slices: CategorySlice[]; total: number }>(() => {
    const catColors = new Map(categories.map((c) => [c.id, c.color]));
    const totals = new Map<string, { name: string; amount: number; color: string }>();
    let total = 0;

    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const key = normalizeLocalDateKey(t.date);
      if (!key || !key.startsWith(selectedMonth)) continue;
      total += t.amount;
      const existing = totals.get(t.categoryId);
      const color =
        catColors.get(t.categoryId) ?? PRESET_COLORS[totals.size % PRESET_COLORS.length];
      if (existing) {
        existing.amount += t.amount;
      } else {
        totals.set(t.categoryId, { name: t.categoryName, amount: t.amount, color });
      }
    }

    const slices = Array.from(totals.values())
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        ...item,
        pct: total > 0 ? (item.amount / total) * 100 : 0,
      }));

    return { slices, total };
  }, [transactions, selectedMonth, categories]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Laporan &amp; Analisis Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Ringkasan arus kas, distribusi pengeluaran per kategori, dan tren kekayaan bersih.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl bg-mm-surface border border-mm-border p-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthISO(selectedMonth, -1))}
            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-mm-hover text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2.5 text-xs sm:text-sm font-semibold text-mm-text min-w-[116px] text-center">
            {formatMonthLabel(selectedMonth)}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthISO(selectedMonth, 1))}
            className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-mm-hover text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Pemasukan</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-mm-income font-mono-num">
            {formatIDR(summary.income)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Pengeluaran</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-mm-expense font-mono-num">
            {formatIDR(summary.expense)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Rasio Tabungan</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-mm-brand font-mono-num">
            {summary.savingsRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Kekayaan Bersih</p>
          <p className="mt-1 text-base sm:text-lg font-bold text-mm-text font-mono-num">
            {formatIDR(netWorth.netWorth)}
          </p>
        </div>
      </section>

      <CashflowPeriodChart transactions={transactions} selectedMonth={selectedMonth} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-mm-text">Komposisi Pengeluaran Kategori</h2>
            <p className="text-xs text-mm-muted">{formatMonthLabel(selectedMonth)}</p>
          </div>
          {categorySlices.total === 0 ? (
            <p className="text-xs text-mm-muted py-8 text-center">
              Belum ada pengeluaran tercatat pada bulan ini.
            </p>
          ) : (
            <CategoryDonutChart
              slices={categorySlices.slices}
              totalAmount={categorySlices.total}
            />
          )}
        </section>

        <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-mm-text">Arus Kas 6 Bulan Terakhir</h2>
            <p className="text-xs text-mm-muted">Perbandingan pemasukan dan pengeluaran</p>
          </div>
          <CashflowBarChart data={historical} />
        </section>
      </div>

      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-mm-text">Tren Kekayaan Bersih (6 Bulan)</h2>
          <p className="text-xs text-mm-muted">
            Saldo dompet + total aset tercatat dikurangi total kewajiban
          </p>
        </div>
        <NetWorthLineChart data={historical} />
      </section>
    </div>
  );
};
