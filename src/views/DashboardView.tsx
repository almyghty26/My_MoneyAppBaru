import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { CalendarWidget } from '../components/CalendarWidget';
import { CashflowPeriodChart } from '../components/CashflowPeriodChart';
import { ScoreRing } from '../components/Charts';
import { ExpenseTrendChart } from '../components/ExpenseTrendChart';
import { UserAvatar } from '../components/UserAvatar';
import { BUDGET_GROUP_META, WALLET_TYPE_LABELS } from '../constants/categories';
import { useTheme } from '../contexts/ThemeContext';
import type {
  AssetDebtItem,
  BudgetGroup,
  BudgetItem,
  CategoryDef,
  FinancialGoal,
  NavTab,
  SubView,
  Transaction,
  UserProfile,
  Wallet,
} from '../types/finance';
import {
  computeBudgetOverview,
  computeFinancialHealthScore,
  computeMonthlySummary,
  computeNetWorth,
} from '../utils/calculations';
import { formatDateID, formatIDR, formatMonthLabel, shiftMonthISO } from '../utils/format';

interface DashboardViewProps {
  selectedMonth: string;
  onMonthChange: (monthISO: string) => void;
  userProfile: UserProfile;
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: BudgetItem[];
  goals: FinancialGoal[];
  assetsDebts: AssetDebtItem[];
  categories: CategoryDef[];
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onNavigateTab: (tab: NavTab) => void;
  onNavigateSubView: (sub: SubView) => void;
  onOpenProfileSettings: () => void;
  onLoadSampleData: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedMonth,
  onMonthChange,
  userProfile,
  wallets,
  transactions,
  budgets,
  goals,
  assetsDebts,
  categories,
  onOpenNewTransaction,
  onEditTransaction,
  onNavigateTab,
  onNavigateSubView,
  onOpenProfileSettings,
  onLoadSampleData,
}) => {
  const { effectiveColors } = useTheme();

  const summary = useMemo(
    () => computeMonthlySummary(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const netWorth = useMemo(
    () => computeNetWorth(wallets, assetsDebts),
    [wallets, assetsDebts]
  );

  const budgetOverview = useMemo(
    () => computeBudgetOverview(budgets, transactions, categories, selectedMonth),
    [budgets, transactions, categories, selectedMonth]
  );

  const healthScore = useMemo(
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

  const recentTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);
  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  const hasNoWallets = wallets.length === 0;
  const greetingName = userProfile.displayName.trim() || 'Pengguna MY MONEY';
  const hasCustomName = userProfile.displayName.trim().length > 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Beranda MY MONEY + Dashboard Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onOpenProfileSettings}
            className="rounded-2xl focus:outline-none focus:ring-2 focus:ring-mm-brand shrink-0 cursor-pointer"
            title="Atur profil & foto pengguna"
            aria-label="Buka pengaturan profil pengguna"
          >
            <UserAvatar
              displayName={userProfile.displayName}
              avatarDataUrl={userProfile.avatarDataUrl}
              size="md"
            />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-mm-text truncate">
                Selamat datang, {greetingName} 👋
              </h1>
              <button
                type="button"
                onClick={onOpenProfileSettings}
                className="px-2.5 py-1 rounded-lg bg-mm-surface hover:bg-mm-hover border border-mm-border text-[11px] font-semibold text-mm-brand shrink-0 cursor-pointer transition-colors"
              >
                {hasCustomName ? 'Profil' : 'Atur Profil'}
              </button>
            </div>
            <p className="text-xs sm:text-sm text-mm-muted truncate">
              {userProfile.username
                ? `@${userProfile.username} · MY MONEY`
                : 'Beranda · MY MONEY · Take Control of Your Money'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl bg-mm-surface border border-mm-border p-1">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthISO(selectedMonth, -1))}
              className="min-h-[38px] min-w-[38px] rounded-lg hover:bg-mm-hover text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs sm:text-sm font-semibold text-mm-text min-w-[116px] text-center whitespace-nowrap">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthISO(selectedMonth, 1))}
              className="min-h-[38px] min-w-[38px] rounded-lg hover:bg-mm-hover text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Kartu Selamat Datang di MY MONEY (hanya ketika belum memiliki dompet) */}
      {hasNoWallets && (
        <section className="rounded-2xl bg-mm-surface border border-mm-brand/35 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-mm-text">
              Selamat Datang di MY MONEY
            </h2>
            <p className="text-xs sm:text-sm text-mm-muted max-w-xl leading-relaxed">
              Anda belum memiliki dompet aktif. Buat dompet pertama Anda untuk mulai mencatat transaksi, atau muat data simulasi untuk mencoba seluruh fitur aplikasi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateSubView('dompet')}
              className="min-h-[44px] px-4 py-2 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <WalletIcon className="w-4 h-4 shrink-0" />
              <span>Buat Dompet Pertama</span>
            </button>
            <button
              type="button"
              onClick={() => void onLoadSampleData()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-mm-elevated hover:bg-mm-hover border border-mm-border text-xs sm:text-sm font-semibold text-mm-text whitespace-nowrap cursor-pointer"
            >
              Muat Data Simulasi
            </button>
          </div>
        </section>
      )}

      {/* Baris Utama: Total Saldo Seluruh Dompet + Budget Harian Tersisa */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Kartu Total Saldo Seluruh Dompet */}
        <div className="lg:col-span-8 rounded-2xl mm-hero-surface border border-mm-border p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-mm-muted">Total Saldo Seluruh Dompet</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-mm-text font-mono-num tracking-tight">
                {formatIDR(netWorth.totalWallets)}
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-mm-muted">
                <span>
                  Kekayaan Bersih:{' '}
                  <strong className="text-mm-text font-mono-num">
                    {formatIDR(netWorth.netWorth)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigateSubView('dompet')}
                  className="text-mm-brand hover:underline font-semibold cursor-pointer"
                >
                  {wallets.length} dompet aktif
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="min-h-[44px] px-4 py-2 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Catat Transaksi</span>
            </button>
          </div>

          {/* Ringkasan Pemasukan dan Pengeluaran */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-mm-border">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-mm-muted">
                <ArrowDownLeft className="w-3.5 h-3.5 text-mm-income shrink-0" />
                <span>Pemasukan</span>
              </div>
              <p className="mt-1 text-base sm:text-lg font-bold text-mm-income font-mono-num">
                {formatIDR(summary.income)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-mm-muted">
                <ArrowUpRight className="w-3.5 h-3.5 text-mm-expense shrink-0" />
                <span>Pengeluaran</span>
              </div>
              <p className="mt-1 text-base sm:text-lg font-bold text-mm-expense font-mono-num">
                {formatIDR(summary.expense)}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-mm-muted">
                <TrendingUp className="w-3.5 h-3.5 text-mm-brand shrink-0" />
                <span>Arus Kas Bersih</span>
              </div>
              <p
                className={`mt-1 text-base sm:text-lg font-bold font-mono-num ${
                  summary.netCashflow >= 0 ? 'text-mm-text' : 'text-mm-expense'
                }`}
              >
                {formatIDR(summary.netCashflow)}
              </p>
            </div>
          </div>
        </div>

        {/* Kartu Budget Harian Tersisa */}
        <div className="lg:col-span-4 rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-mm-muted">Budget Harian Tersisa</p>
              <p className="mt-1.5 text-2xl sm:text-3xl font-extrabold text-mm-text font-mono-num tracking-tight">
                {budgetOverview.totalLimit > 0
                  ? formatIDR(budgetOverview.dailyRemainingBudget)
                  : formatIDR(0)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-mm-muted">
            {budgetOverview.totalLimit > 0 ? (
              <>
                <p>
                  Batas belanja aman per hari untuk{' '}
                  <strong className="text-mm-text font-mono-num">
                    {budgetOverview.remainingDays} hari tersisa
                  </strong>{' '}
                  di {formatMonthLabel(selectedMonth)}.
                </p>
                <p className="font-mono-num text-mm-muted">
                  Sisa total anggaran:{' '}
                  <strong
                    className={
                      budgetOverview.totalRemaining >= 0 ? 'text-mm-income' : 'text-mm-expense'
                    }
                  >
                    {formatIDR(budgetOverview.totalRemaining)}
                  </strong>
                </p>
              </>
            ) : (
              <p>
                Belum ada batas anggaran pada bulan ini. Atur anggaran bulanan agar batas harian terhitung otomatis.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('anggaran')}
            className="min-h-[42px] w-full px-3.5 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-brand inline-flex items-center justify-between whitespace-nowrap cursor-pointer"
          >
            <span>{budgetOverview.totalLimit > 0 ? 'Lihat Anggaran' : 'Atur Anggaran'}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </section>

      {/* Kartu Kesehatan Finansial (Skor, Status, dan Rincian Penilaian) + Ringkasan Anggaran */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Kartu Kesehatan Finansial */}
        <div className="lg:col-span-6 rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <ScoreRing score={healthScore.totalScore} size={84} />
              <div>
                <div className="flex items-center gap-1.5 text-xs text-mm-muted">
                  <ShieldCheck className="w-3.5 h-3.5 text-mm-brand shrink-0" />
                  <span>Kesehatan Finansial</span>
                </div>
                <h2 className="text-lg font-extrabold text-mm-text mt-0.5">{healthScore.grade}</h2>
                <p className="text-xs text-mm-muted mt-0.5 font-mono-num">
                  Skor {healthScore.totalScore} / 100 · {formatMonthLabel(selectedMonth)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateSubView('kesehatan')}
              className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Rincian</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rincian Penilaian 4 Faktor */}
          <div className="space-y-3 pt-3 border-t border-mm-border">
            {healthScore.factors.map((factor) => {
              const pct = Math.round((factor.score / factor.maxScore) * 100);
              const barColor =
                factor.status === 'baik'
                  ? effectiveColors.success
                  : factor.status === 'cukup'
                    ? effectiveColors.warning
                    : effectiveColors.expense;

              return (
                <div key={factor.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-mm-text truncate">{factor.label}</span>
                    <div className="flex items-center gap-2 shrink-0 font-mono-num">
                      <span className="text-mm-muted hidden sm:inline">{factor.metricLabel}</span>
                      <span className="text-mm-text font-bold">
                        {factor.score}/{factor.maxScore}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-mm-bg overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <p className="text-[11px] text-mm-muted sm:hidden font-mono-num">
                    {factor.metricLabel}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kartu Ringkasan Anggaran */}
        <div className="lg:col-span-6 rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-mm-text">Ringkasan Anggaran</h2>
              <p className="text-xs text-mm-muted">{formatMonthLabel(selectedMonth)}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('anggaran')}
              className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Kelola</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {budgetOverview.totalLimit === 0 ? (
            <div className="py-6 text-center space-y-3 border-t border-mm-border">
              <p className="text-xs text-mm-muted">
                Belum ada batas anggaran pada {formatMonthLabel(selectedMonth)}.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('anggaran')}
                className="min-h-[40px] px-4 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-brand whitespace-nowrap cursor-pointer"
              >
                Atur Anggaran Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-mm-border">
                <span className="text-mm-muted">Total Terpakai</span>
                <span className="font-mono-num font-bold text-mm-text">
                  {formatIDR(budgetOverview.totalSpent)} / {formatIDR(budgetOverview.totalLimit)} (
                  {budgetOverview.overallPct}%)
                </span>
              </div>

              {(['needs', 'wants', 'savings'] as BudgetGroup[]).map((groupKey) => {
                const g = budgetOverview.groups[groupKey];
                const meta = BUDGET_GROUP_META[groupKey];
                const barWidth = Math.min(100, Math.max(0, g.percentage));
                const barColor =
                  g.status === 'terlampaui'
                    ? effectiveColors.expense
                    : g.status === 'mendekati'
                      ? effectiveColors.warning
                      : groupKey === 'needs'
                        ? effectiveColors.primary
                        : groupKey === 'wants'
                          ? effectiveColors.secondary
                          : effectiveColors.success;

                return (
                  <div key={groupKey} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-mm-text">{meta.label}</span>
                      <span className="font-mono-num text-mm-muted">
                        {formatIDR(g.spent)} / {formatIDR(g.limit)} ({g.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-mm-bg overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shortcut Ringkas */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-mm-border">
            <button
              type="button"
              onClick={() => onNavigateSubView('target')}
              className="min-h-[42px] px-3 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border flex items-center gap-2 text-left cursor-pointer"
            >
              <Target className="w-4 h-4 text-mm-income shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mm-text truncate">Target</p>
                <p className="text-[11px] text-mm-muted truncate">{goals.length} aktif</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSubView('aset_utang')}
              className="min-h-[42px] px-3 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border flex items-center gap-2 text-left cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-mm-brand2 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mm-text truncate">Aset &amp; Utang</p>
                <p className="text-[11px] text-mm-muted truncate">{assetsDebts.length} item</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Grafik Pemasukan & Pengeluaran Multi-Periode (Harian, Mingguan, Bulanan, Tahunan) */}
      <CashflowPeriodChart
        transactions={transactions}
        selectedMonth={selectedMonth}
        onOpenReports={() => onNavigateSubView('laporan')}
      />

      {/* Grafik Tren Pengeluaran 6 Bulan Terakhir */}
      <ExpenseTrendChart
        transactions={transactions}
        selectedMonth={selectedMonth}
        onOpenReports={() => onNavigateSubView('laporan')}
      />

      {/* Dompet & Rekening + Transaksi Terbaru + Kalender Aktivitas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-5 rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-mm-text">Dompet &amp; Rekening</h3>
              <p className="text-xs text-mm-muted">{wallets.length} dompet aktif</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSubView('dompet')}
              className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Kelola</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {wallets.length === 0 ? (
            <div className="py-6 text-center space-y-2 border-t border-mm-border">
              <p className="text-xs text-mm-muted">Belum ada dompet tercatat.</p>
              <button
                type="button"
                onClick={() => onNavigateSubView('dompet')}
                className="min-h-[38px] px-3.5 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-brand cursor-pointer"
              >
                Buat Dompet Pertama
              </button>
            </div>
          ) : (
            <div className="divide-y divide-mm-border">
              {wallets.slice(0, 5).map((w) => (
                <div
                  key={w.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-7 rounded-full shrink-0"
                      style={{ backgroundColor: w.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-mm-text truncate">
                        {w.name}
                      </p>
                      <p className="text-[11px] text-mm-muted">
                        {WALLET_TYPE_LABELS[w.type] ?? 'Dompet'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-mm-text font-mono-num shrink-0">
                    {formatIDR(w.balance)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-mm-text">Transaksi Terbaru</h3>
              <p className="text-xs text-mm-muted">Ketuk item untuk edit nominal atau catatan</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('transaksi')}
              className="text-xs font-semibold text-mm-brand hover:underline inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <span>Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-6 text-center space-y-2 border-t border-mm-border">
              <p className="text-xs text-mm-muted">Belum ada riwayat transaksi.</p>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="min-h-[38px] px-3.5 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-brand cursor-pointer"
              >
                Catat Transaksi Pertama
              </button>
            </div>
          ) : (
            <div className="divide-y divide-mm-border">
              {recentTransactions.map((tx) => {
                const sourceName = walletMap.get(tx.walletId)?.name ?? 'Dompet';
                const destName = tx.toWalletId
                  ? walletMap.get(tx.toWalletId)?.name ?? 'Tujuan'
                  : '';

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onEditTransaction(tx)}
                    className="w-full py-2.5 px-1 hover:bg-mm-hover rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === 'income'
                            ? 'bg-mm-income/15 text-mm-income'
                            : tx.type === 'expense'
                              ? 'bg-mm-expense/15 text-mm-expense'
                              : 'bg-mm-brand/15 text-mm-brand'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : tx.type === 'expense' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowLeftRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-mm-text truncate">
                          {tx.note || tx.categoryName}
                        </p>
                        <p className="text-[11px] text-mm-muted truncate">
                          {tx.type === 'transfer'
                            ? `${sourceName} → ${destName}`
                            : `${tx.categoryName} · ${sourceName}`}{' '}
                          · {formatDateID(tx.date)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-xs sm:text-sm font-bold font-mono-num shrink-0 ${
                        tx.type === 'income'
                          ? 'text-mm-income'
                          : tx.type === 'expense'
                            ? 'text-mm-expense'
                            : 'text-mm-brand'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {formatIDR(tx.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Kalender Aktivitas */}
      <CalendarWidget
        monthISO={selectedMonth}
        onMonthChange={onMonthChange}
        transactions={transactions}
        onEditTransaction={onEditTransaction}
      />
    </div>
  );
};
