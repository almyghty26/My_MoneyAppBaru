import type {
  AssetDebtItem,
  BudgetGroup,
  BudgetItem,
  CategoryDef,
  FinancialGoal,
  FinancialHealthResult,
  HealthScoreFactor,
  Transaction,
  Wallet,
} from '../types/finance';
import {
  formatExactDateID,
  getDaysInMonth,
  getMondayOfWeekISO,
  getRecentMonths,
  getRemainingDaysInMonth,
  getTodayISO,
  MONTHS_ID,
  MONTHS_SHORT_ID,
  normalizeLocalDateKey,
  shiftDateISO,
  WEEKDAYS_FULL_ID,
  WEEKDAYS_SHORT_ID,
} from './format';

export interface MonthlySummary {
  income: number;
  expense: number;
  pureExpense: number;
  savingsAllocated: number;
  netCashflow: number;
  savingsRate: number;
}

export function computeMonthlySummary(
  transactions: Transaction[],
  monthISO: string
): MonthlySummary {
  let income = 0;
  let expense = 0;
  let pureExpense = 0;
  let savingsAllocated = 0;

  for (const t of transactions) {
    const localKey = normalizeLocalDateKey(t.date);
    if (!localKey || !localKey.startsWith(monthISO)) continue;
    if (t.type === 'transfer') continue;

    if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'expense') {
      expense += t.amount;
      if (t.budgetGroup === 'savings') {
        savingsAllocated += t.amount;
      } else {
        pureExpense += t.amount;
      }
    }
  }

  const netCashflow = income - pureExpense;
  const savingsRate =
    income > 0 ? Math.max(-100, Math.min(100, ((income - pureExpense) / income) * 100)) : 0;

  return {
    income,
    expense,
    pureExpense,
    savingsAllocated,
    netCashflow,
    savingsRate,
  };
}

export interface NetWorthSummary {
  totalWallets: number;
  totalAssetsExtra: number;
  totalAssetsCombined: number;
  totalLiabilities: number;
  netWorth: number;
  liquidTotal: number;
}

export function computeNetWorth(
  wallets: Wallet[],
  assetsDebts: AssetDebtItem[]
): NetWorthSummary {
  const totalWallets = wallets.reduce((acc, w) => acc + w.balance, 0);
  let totalAssetsExtra = 0;
  let liquidExtra = 0;
  let totalLiabilities = 0;

  for (const item of assetsDebts) {
    if (item.kind === 'asset') {
      totalAssetsExtra += item.amount;
      if (item.subtype === 'liquid') {
        liquidExtra += item.amount;
      }
    } else {
      totalLiabilities += item.amount;
    }
  }

  const totalAssetsCombined = totalWallets + totalAssetsExtra;
  const netWorth = totalAssetsCombined - totalLiabilities;
  const liquidTotal = totalWallets + liquidExtra;

  return {
    totalWallets,
    totalAssetsExtra,
    totalAssetsCombined,
    totalLiabilities,
    netWorth,
    liquidTotal,
  };
}

export type BudgetStatus = 'aman' | 'mendekati' | 'terlampaui';

export interface ComputedBudgetRow extends BudgetItem {
  spent: number;
  remaining: number;
  percentage: number;
  status: BudgetStatus;
}

export interface ComputedBudgetOverview {
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
  overallPct: number;
  dailyRemainingBudget: number;
  remainingDays: number;
  groups: Record<
    BudgetGroup,
    {
      limit: number;
      spent: number;
      remaining: number;
      percentage: number;
      status: BudgetStatus;
      items: ComputedBudgetRow[];
    }
  >;
  unbudgetedSpent: number;
}

export function computeBudgetOverview(
  budgets: BudgetItem[],
  transactions: Transaction[],
  categories: CategoryDef[],
  monthISO: string
): ComputedBudgetOverview {
  const monthBudgets = budgets.filter((b) => b.month === monthISO);
  const monthExpenses = transactions.filter((t) => {
    const localKey = normalizeLocalDateKey(t.date);
    return t.type === 'expense' && localKey !== null && localKey.startsWith(monthISO);
  });

  const spentByCategory = new Map<string, number>();
  for (const t of monthExpenses) {
    spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) || 0) + t.amount);
  }

  const catLookup = new Map(categories.map((c) => [c.id, c]));

  const groups: ComputedBudgetOverview['groups'] = {
    needs: { limit: 0, spent: 0, remaining: 0, percentage: 0, status: 'aman', items: [] },
    wants: { limit: 0, spent: 0, remaining: 0, percentage: 0, status: 'aman', items: [] },
    savings: { limit: 0, spent: 0, remaining: 0, percentage: 0, status: 'aman', items: [] },
  };

  const budgetedCatIds = new Set<string>();

  for (const b of monthBudgets) {
    budgetedCatIds.add(b.categoryId);
    const spent = spentByCategory.get(b.categoryId) || 0;
    const remaining = b.limitAmount - spent;
    const percentage =
      b.limitAmount > 0 ? Math.round((spent / b.limitAmount) * 100) : spent > 0 ? 100 : 0;
    const status: BudgetStatus =
      percentage > 100 ? 'terlampaui' : percentage >= 80 ? 'mendekati' : 'aman';

    const row: ComputedBudgetRow = {
      ...b,
      spent,
      remaining,
      percentage,
      status,
    };

    groups[b.group].items.push(row);
    groups[b.group].limit += b.limitAmount;
    groups[b.group].spent += spent;
  }

  let unbudgetedSpent = 0;
  for (const t of monthExpenses) {
    if (!budgetedCatIds.has(t.categoryId)) {
      unbudgetedSpent += t.amount;
      const group: BudgetGroup =
        t.budgetGroup || catLookup.get(t.categoryId)?.budgetGroup || 'needs';
      groups[group].spent += t.amount;
    }
  }

  for (const key of ['needs', 'wants', 'savings'] as BudgetGroup[]) {
    const g = groups[key];
    g.remaining = g.limit - g.spent;
    g.percentage = g.limit > 0 ? Math.round((g.spent / g.limit) * 100) : g.spent > 0 ? 100 : 0;
    g.status = g.percentage > 100 ? 'terlampaui' : g.percentage >= 80 ? 'mendekati' : 'aman';
  }

  const totalLimit = groups.needs.limit + groups.wants.limit + groups.savings.limit;
  const totalSpent = groups.needs.spent + groups.wants.spent + groups.savings.spent;
  const totalRemaining = totalLimit - totalSpent;
  const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const consumableLimit = groups.needs.limit + groups.wants.limit;
  const consumableSpent = groups.needs.spent + groups.wants.spent;
  const effectiveLimit = consumableLimit > 0 ? consumableLimit : totalLimit;
  const effectiveRemaining =
    consumableLimit > 0 ? consumableLimit - consumableSpent : totalRemaining;

  const remainingDays = getRemainingDaysInMonth(monthISO);
  const dailyRemainingBudget =
    effectiveLimit > 0 && remainingDays > 0
      ? Math.max(0, Math.floor(effectiveRemaining / remainingDays))
      : 0;

  return {
    totalLimit,
    totalSpent,
    totalRemaining,
    overallPct,
    dailyRemainingBudget,
    remainingDays,
    groups,
    unbudgetedSpent,
  };
}

export function computeFinancialHealthScore(
  wallets: Wallet[],
  transactions: Transaction[],
  budgets: BudgetItem[],
  goals: FinancialGoal[],
  assetsDebts: AssetDebtItem[],
  categories: CategoryDef[],
  monthISO: string
): FinancialHealthResult {
  const summary = computeMonthlySummary(transactions, monthISO);
  const netWorth = computeNetWorth(wallets, assetsDebts);
  const budgetOverview = computeBudgetOverview(budgets, transactions, categories, monthISO);

  const hasAnyFinancialActivity =
    wallets.length > 0 || transactions.length > 0 || assetsDebts.length > 0;

  let savingsScore = 0;
  let savingsMetric = 'Belum ada pemasukan';
  if (summary.income > 0) {
    const rate = summary.savingsRate;
    savingsMetric = `${rate.toFixed(1)}% dari pemasukan`;
    if (rate >= 20) savingsScore = 25;
    else if (rate >= 10) savingsScore = Math.round(15 + ((rate - 10) / 10) * 10);
    else if (rate > 0) savingsScore = Math.round((rate / 10) * 15);
    else savingsScore = 0;
  } else if (summary.pureExpense === 0 && netWorth.totalWallets > 0) {
    savingsScore = 15;
    savingsMetric = 'Saldo tersedia, belum ada arus bulan ini';
  }

  let budgetScore = 0;
  let budgetMetric = 'Belum ada anggaran';
  if (budgetOverview.totalLimit > 0) {
    const ratio = budgetOverview.totalSpent / budgetOverview.totalLimit;
    budgetMetric = `${budgetOverview.overallPct}% terpakai`;
    if (ratio <= 0.85) budgetScore = 25;
    else if (ratio <= 1.0) budgetScore = Math.round(18 + ((1.0 - ratio) / 0.15) * 7);
    else if (ratio <= 1.2) budgetScore = Math.round(8 + ((1.2 - ratio) / 0.2) * 10);
    else budgetScore = 4;
  } else if (hasAnyFinancialActivity) {
    budgetScore = 10;
    budgetMetric = 'Anggaran belum diatur (skor dasar)';
  }

  const emergencyGoalTotal = goals
    .filter((g) => g.category === 'emergency')
    .reduce((acc, g) => acc + g.currentAmount, 0);
  const savingsWallets = wallets
    .filter((w) => w.type === 'savings')
    .reduce((acc, w) => acc + w.balance, 0);
  const liquidReserve = Math.max(netWorth.liquidTotal, savingsWallets + emergencyGoalTotal);
  const monthlyBurn = summary.pureExpense > 0 ? summary.pureExpense : 3000000;
  const monthsCovered = liquidReserve / monthlyBurn;

  let emergencyScore = 0;
  let emergencyMetric = '0 bulan pengeluaran';
  if (hasAnyFinancialActivity) {
    emergencyMetric = `${monthsCovered.toFixed(1)} bulan cadangan likuid`;
    if (monthsCovered >= 6) emergencyScore = 25;
    else if (monthsCovered >= 3) emergencyScore = Math.round(16 + ((monthsCovered - 3) / 3) * 9);
    else if (monthsCovered >= 1) emergencyScore = Math.round(8 + ((monthsCovered - 1) / 2) * 8);
    else if (monthsCovered > 0) emergencyScore = Math.round(monthsCovered * 8);
  }

  let debtScore = 0;
  let debtMetric = 'Belum ada data aset';
  if (hasAnyFinancialActivity) {
    if (netWorth.totalLiabilities === 0) {
      debtScore = 25;
      debtMetric = '0% (Bebas utang)';
    } else if (netWorth.totalAssetsCombined > 0) {
      const debtRatio = (netWorth.totalLiabilities / netWorth.totalAssetsCombined) * 100;
      debtMetric = `${debtRatio.toFixed(1)}% dari total aset`;
      if (debtRatio <= 15) debtScore = 24;
      else if (debtRatio <= 30) debtScore = 20;
      else if (debtRatio <= 50) debtScore = 13;
      else if (debtRatio <= 80) debtScore = 7;
      else debtScore = 2;
    } else {
      debtScore = 2;
      debtMetric = 'Kewajiban melebihi aset tercatat';
    }
  }

  const factors: HealthScoreFactor[] = [
    {
      id: 'savings',
      label: 'Rasio Tabungan',
      score: savingsScore,
      maxScore: 25,
      metricLabel: savingsMetric,
      formulaDesc: '(Pemasukan - Pengeluaran) / Pemasukan. Target ideal >= 20%.',
      status: savingsScore >= 20 ? 'baik' : savingsScore >= 12 ? 'cukup' : 'perlu_perhatian',
    },
    {
      id: 'budget',
      label: 'Kedisiplinan Anggaran',
      score: budgetScore,
      maxScore: 25,
      metricLabel: budgetMetric,
      formulaDesc: 'Total pengeluaran terhadap batas anggaran bulanan. Ideal <= 100%.',
      status: budgetScore >= 20 ? 'baik' : budgetScore >= 12 ? 'cukup' : 'perlu_perhatian',
    },
    {
      id: 'emergency',
      label: 'Dana Darurat',
      score: emergencyScore,
      maxScore: 25,
      metricLabel: emergencyMetric,
      formulaDesc: 'Dana likuid dibagi rata-rata pengeluaran bulanan. Ideal >= 6 bulan.',
      status: emergencyScore >= 20 ? 'baik' : emergencyScore >= 12 ? 'cukup' : 'perlu_perhatian',
    },
    {
      id: 'debt',
      label: 'Rasio Utang',
      score: debtScore,
      maxScore: 25,
      metricLabel: debtMetric,
      formulaDesc: 'Total kewajiban dibagi total aset (dompet + aset tercatat). Ideal <= 30%.',
      status: debtScore >= 20 ? 'baik' : debtScore >= 12 ? 'cukup' : 'perlu_perhatian',
    },
  ];

  const totalScore = factors.reduce((acc, f) => acc + f.score, 0);
  const grade: FinancialHealthResult['grade'] =
    totalScore >= 85
      ? 'Sangat Sehat'
      : totalScore >= 70
        ? 'Sehat'
        : totalScore >= 50
          ? 'Cukup'
          : 'Perlu Perbaikan';

  return {
    totalScore,
    grade,
    hasEnoughData: hasAnyFinancialActivity,
    factors,
  };
}

export interface MonthlyChartPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
  netWorth: number;
}

export function computeHistoricalSeries(
  wallets: Wallet[],
  transactions: Transaction[],
  assetsDebts: AssetDebtItem[],
  currentMonthISO: string,
  monthsCount = 6
): MonthlyChartPoint[] {
  const months = getRecentMonths(currentMonthISO, monthsCount);
  const currentNetWorth = computeNetWorth(wallets, assetsDebts).netWorth;

  const monthlyFlows = months.map((m) => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const localKey = normalizeLocalDateKey(t.date);
      if (!localKey || !localKey.startsWith(m) || t.type === 'transfer') continue;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { month: m, income, expense, net: income - expense };
  });

  const points: MonthlyChartPoint[] = new Array(monthlyFlows.length);
  let runningNW = currentNetWorth;
  for (let i = monthlyFlows.length - 1; i >= 0; i--) {
    const f = monthlyFlows[i];
    points[i] = { ...f, netWorth: runningNW };
    runningNW -= f.net;
  }

  return points;
}

export interface PeriodCashflowPoint {
  key: string;
  label: string;
  fullLabel: string;
  income: number;
  expense: number;
}

export interface DailyCashflowPoint {
  date: string;
  day: number;
  dayLabel: string;
  fullDateLabel: string;
  income: number;
  expense: number;
}

export function computeDailyCashflow(
  transactions: Transaction[],
  monthISO: string
): DailyCashflowPoint[] {
  const daysInMonth = getDaysInMonth(monthISO);
  const incomeByDay = new Array<number>(daysInMonth + 1).fill(0);
  const expenseByDay = new Array<number>(daysInMonth + 1).fill(0);
  const seenIds = new Set<string>();

  for (const t of transactions) {
    if (!t.id || seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    if (t.type === 'transfer') continue;

    const dateKey = normalizeLocalDateKey(t.date);
    if (!dateKey || !dateKey.startsWith(monthISO)) continue;

    const dayNum = Number(dateKey.slice(8, 10));
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > daysInMonth) continue;

    const amount = Number.isFinite(t.amount) ? t.amount : 0;
    if (t.type === 'income') {
      incomeByDay[dayNum] += amount;
    } else if (t.type === 'expense') {
      expenseByDay[dayNum] += amount;
    }
  }

  const points: DailyCashflowPoint[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthISO}-${String(day).padStart(2, '0')}`;
    points.push({
      date,
      day,
      dayLabel: String(day),
      fullDateLabel: formatExactDateID(date),
      income: incomeByDay[day],
      expense: expenseByDay[day],
    });
  }

  return points;
}

export function computeWeeklyCashflow(
  transactions: Transaction[],
  referenceDateISO: string
): PeriodCashflowPoint[] {
  const mondayISO = getMondayOfWeekISO(referenceDateISO);
  const weekDates: string[] = [];
  const incomeByDate = new Map<string, number>();
  const expenseByDate = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const dISO = shiftDateISO(mondayISO, i);
    weekDates.push(dISO);
    incomeByDate.set(dISO, 0);
    expenseByDate.set(dISO, 0);
  }

  const seenIds = new Set<string>();
  for (const t of transactions) {
    if (!t.id || seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    if (t.type === 'transfer') continue;

    const dateKey = normalizeLocalDateKey(t.date);
    if (!dateKey || !incomeByDate.has(dateKey)) continue;

    const amount = Number.isFinite(t.amount) ? t.amount : 0;
    if (t.type === 'income') {
      incomeByDate.set(dateKey, (incomeByDate.get(dateKey) ?? 0) + amount);
    } else if (t.type === 'expense') {
      expenseByDate.set(dateKey, (expenseByDate.get(dateKey) ?? 0) + amount);
    }
  }

  return weekDates.map((dISO, idx) => ({
    key: dISO,
    label: WEEKDAYS_SHORT_ID[idx],
    fullLabel: `${WEEKDAYS_FULL_ID[idx]}, ${formatExactDateID(dISO)}`,
    income: incomeByDate.get(dISO) ?? 0,
    expense: expenseByDate.get(dISO) ?? 0,
  }));
}

export function computeYearlyMonthlyCashflow(
  transactions: Transaction[],
  year: number
): PeriodCashflowPoint[] {
  const yearPrefix = `${year}-`;
  const incomeByMonth = new Array<number>(12).fill(0);
  const expenseByMonth = new Array<number>(12).fill(0);
  const seenIds = new Set<string>();

  for (const t of transactions) {
    if (!t.id || seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    if (t.type === 'transfer') continue;

    const dateKey = normalizeLocalDateKey(t.date);
    if (!dateKey || !dateKey.startsWith(yearPrefix)) continue;

    const monthIndex = Number(dateKey.slice(5, 7)) - 1;
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) continue;

    const amount = Number.isFinite(t.amount) ? t.amount : 0;
    if (t.type === 'income') {
      incomeByMonth[monthIndex] += amount;
    } else if (t.type === 'expense') {
      expenseByMonth[monthIndex] += amount;
    }
  }

  return MONTHS_SHORT_ID.map((shortName, idx) => ({
    key: `${year}-${String(idx + 1).padStart(2, '0')}`,
    label: shortName,
    fullLabel: `${MONTHS_ID[idx]} ${year}`,
    income: incomeByMonth[idx],
    expense: expenseByMonth[idx],
  }));
}

export function computeAnnualCashflow(
  transactions: Transaction[]
): PeriodCashflowPoint[] {
  const totalsByYear = new Map<number, { income: number; expense: number }>();
  const seenIds = new Set<string>();

  for (const t of transactions) {
    if (!t.id || seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    if (t.type === 'transfer') continue;

    const dateKey = normalizeLocalDateKey(t.date);
    if (!dateKey) continue;

    const year = Number(dateKey.slice(0, 4));
    if (!Number.isInteger(year) || year < 1900 || year > 2999) continue;

    const entry = totalsByYear.get(year) ?? { income: 0, expense: 0 };
    const amount = Number.isFinite(t.amount) ? t.amount : 0;
    if (t.type === 'income') {
      entry.income += amount;
    } else if (t.type === 'expense') {
      entry.expense += amount;
    }
    totalsByYear.set(year, entry);
  }

  if (totalsByYear.size === 0) {
    const currentYear = Number(getTodayISO().slice(0, 4));
    return [
      {
        key: String(currentYear),
        label: String(currentYear),
        fullLabel: `Tahun ${currentYear}`,
        income: 0,
        expense: 0,
      },
    ];
  }

  const sortedYears = Array.from(totalsByYear.keys()).sort((a, b) => a - b);
  return sortedYears.map((year) => {
    const entry = totalsByYear.get(year)!;
    return {
      key: String(year),
      label: String(year),
      fullLabel: `Tahun ${year}`,
      income: entry.income,
      expense: entry.expense,
    };
  });
}
