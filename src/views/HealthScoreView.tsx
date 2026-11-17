import React, { useMemo } from 'react';
import { CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { ScoreRing } from '../components/Charts';
import { useTheme } from '../contexts/ThemeContext';
import type {
  AssetDebtItem,
  BudgetItem,
  CategoryDef,
  FinancialGoal,
  Transaction,
  Wallet,
} from '../types/finance';
import { computeFinancialHealthScore } from '../utils/calculations';
import { formatMonthLabel } from '../utils/format';

interface HealthScoreViewProps {
  selectedMonth: string;
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: BudgetItem[];
  goals: FinancialGoal[];
  assetsDebts: AssetDebtItem[];
  categories: CategoryDef[];
}

export const HealthScoreView: React.FC<HealthScoreViewProps> = ({
  selectedMonth,
  wallets,
  transactions,
  budgets,
  goals,
  assetsDebts,
  categories,
}) => {
  const { effectiveColors } = useTheme();
  const result = useMemo(
    () =>
      computeFinancialHealthScore(
        wallets,
        transactions,
        budgets,
        goals,
        assetsDebts,
        categories,
        selectedMonth
      ),
    [wallets, transactions, budgets, goals, assetsDebts, categories, selectedMonth]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
          Skor Kesehatan Finansial
        </h1>
        <p className="text-xs sm:text-sm text-mm-muted">
          Evaluasi objektif berdasarkan 4 indikator utama pada {formatMonthLabel(selectedMonth)}.
        </p>
      </div>

      <section className="rounded-2xl bg-mm-surface border border-mm-border p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing score={result.totalScore} size={112} />
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-mm-brand">
            <ShieldCheck className="w-4 h-4 text-mm-brand" />
            <span>Status Finansial</span>
          </div>
          <h2 className="text-2xl font-extrabold text-mm-text">{result.grade}</h2>
          <p className="text-xs sm:text-sm text-mm-muted max-w-xl">
            Skor dihitung otomatis dari data dompet, transaksi, anggaran, dana darurat, serta rasio utang yang tersimpan secara lokal.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.factors.map((factor) => {
          const pct = Math.round((factor.score / factor.maxScore) * 100);
          const color =
            factor.status === 'baik'
              ? effectiveColors.success
              : factor.status === 'cukup'
                ? effectiveColors.warning
                : effectiveColors.expense;

          return (
            <section
              key={factor.id}
              className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-mm-text">{factor.label}</h3>
                  <p className="text-xs text-mm-muted font-mono-num mt-0.5">{factor.metricLabel}</p>
                </div>
                <span className="text-sm font-extrabold font-mono-num text-mm-text">
                  {factor.score} / {factor.maxScore}
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-mm-bg overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>

              <div className="flex items-start gap-2 text-xs text-mm-muted pt-1">
                {factor.status === 'baik' ? (
                  <CheckCircle2 className="w-4 h-4 text-mm-success shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-mm-muted shrink-0 mt-0.5" />
                )}
                <span>{factor.formulaDesc}</span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
