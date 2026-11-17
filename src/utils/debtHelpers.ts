import type {
  AssetDebtItem,
  DebtPaymentRecord,
  InstallmentCategory,
  InstallmentFrequency,
} from '../types/finance';
import {
  formatExactDateID,
  getDaysInMonth,
  getTodayISO,
  parseLocalDate,
  shiftDateISO,
  toLocalDateISO,
} from './format';

export const INSTALLMENT_FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  weekly: 'Mingguan',
  biweekly: '2 Mingguan',
  monthly: 'Bulanan',
  quarterly: 'Per 3 Bulan',
  yearly: 'Tahunan',
};

export const INSTALLMENT_CATEGORY_LABELS: Record<InstallmentCategory, string> = {
  vehicle: 'Kendaraan Bermotor',
  electronics: 'Elektronik & Gadget',
  property: 'Properti / KPR',
  loan: 'Pinjaman / Kredit',
  other: 'Cicilan Lainnya',
};

export type DebtReminderStatus =
  | 'paid_off'
  | 'overdue'
  | 'due_soon'
  | 'upcoming'
  | 'no_due_date';

export interface DebtReminderInfo {
  status: DebtReminderStatus;
  label: string;
  shortLabel: string;
  dueDateISO: string | null;
  daysDiff: number | null;
}

export interface DebtDashboardSummary {
  totalObligation: number;
  totalRemainingDebt: number;
  totalPaidAmount: number;
  paidPercentage: number;
  totalMonthlyInstallment: number;
  totalCount: number;
  activeCount: number;
  paidOffCount: number;
  overdueCount: number;
  dueSoonCount: number;
  dueAttentionItems: Array<{ item: AssetDebtItem; reminder: DebtReminderInfo }>;
  upcomingItems: Array<{ item: AssetDebtItem; reminder: DebtReminderInfo }>;
}

export function getDebtRemainingAmount(item: AssetDebtItem): number {
  return Math.max(0, Number.isFinite(item.amount) ? item.amount : 0);
}

export function getDebtTotalAmount(item: AssetDebtItem): number {
  const remaining = getDebtRemainingAmount(item);
  if (typeof item.totalAmount === 'number' && Number.isFinite(item.totalAmount) && item.totalAmount > 0) {
    return Math.max(remaining, item.totalAmount);
  }
  return remaining;
}

export function isDebtPaidOff(item: AssetDebtItem): boolean {
  if (item.kind !== 'debt') return false;
  return item.status === 'paid_off' || getDebtRemainingAmount(item) <= 0;
}

export function getEffectiveDueDate(
  item: AssetDebtItem,
  referenceTodayISO: string = getTodayISO()
): string | null {
  if (item.kind !== 'debt') return null;

  const explicit =
    item.subtype === 'installment'
      ? item.nextPaymentDate || item.dueDate
      : item.dueDate || item.nextPaymentDate;

  if (explicit && parseLocalDate(explicit)) {
    return explicit;
  }

  if (typeof item.dueDateDay === 'number' && item.dueDateDay >= 1 && item.dueDateDay <= 31) {
    const monthISO = referenceTodayISO.slice(0, 7);
    const maxDay = getDaysInMonth(monthISO);
    const clampedDay = Math.min(item.dueDateDay, maxDay);
    return `${monthISO}-${String(clampedDay).padStart(2, '0')}`;
  }

  return null;
}

export function advancePaymentDate(
  dateISO: string,
  frequency: InstallmentFrequency = 'monthly',
  preferredDay?: number
): string {
  const parsed = parseLocalDate(dateISO) ?? new Date();

  if (frequency === 'weekly') {
    return shiftDateISO(toLocalDateISO(parsed), 7);
  }
  if (frequency === 'biweekly') {
    return shiftDateISO(toLocalDateISO(parsed), 14);
  }

  const monthsToAdd = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
  const targetYear = parsed.getFullYear();
  const targetMonthIndex = parsed.getMonth() + monthsToAdd;
  const firstOfTarget = new Date(targetYear, targetMonthIndex, 1);
  const targetMonthISO = `${firstOfTarget.getFullYear()}-${String(
    firstOfTarget.getMonth() + 1
  ).padStart(2, '0')}`;
  const maxDay = getDaysInMonth(targetMonthISO);
  const desiredDay =
    typeof preferredDay === 'number' && preferredDay >= 1 && preferredDay <= 31
      ? preferredDay
      : parsed.getDate();
  const finalDay = Math.min(desiredDay, maxDay);

  return `${targetMonthISO}-${String(finalDay).padStart(2, '0')}`;
}

export function getMonthlyEquivalentInstallment(item: AssetDebtItem): number {
  if (item.kind !== 'debt' || isDebtPaidOff(item)) return 0;
  const perPeriod =
    typeof item.monthlyInstallment === 'number' && Number.isFinite(item.monthlyInstallment)
      ? Math.max(0, item.monthlyInstallment)
      : 0;
  if (perPeriod <= 0) return 0;

  const freq = item.paymentFrequency ?? 'monthly';
  switch (freq) {
    case 'weekly':
      return Math.round(perPeriod * 4);
    case 'biweekly':
      return Math.round(perPeriod * 2);
    case 'quarterly':
      return Math.round(perPeriod / 3);
    case 'yearly':
      return Math.round(perPeriod / 12);
    case 'monthly':
    default:
      return Math.round(perPeriod);
  }
}

export function getInstallmentProgress(item: AssetDebtItem): {
  totalTenor: number;
  paidInstallments: number;
  remainingTenor: number;
  totalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  percentage: number;
} {
  const totalAmount = getDebtTotalAmount(item);
  const remainingAmount = getDebtRemainingAmount(item);
  const paidAmount = Math.max(0, totalAmount - remainingAmount);

  const totalTenor =
    typeof item.totalTenor === 'number' && Number.isFinite(item.totalTenor) && item.totalTenor > 0
      ? Math.round(item.totalTenor)
      : 0;
  const rawPaid =
    typeof item.paidInstallments === 'number' && Number.isFinite(item.paidInstallments)
      ? Math.max(0, Math.round(item.paidInstallments))
      : 0;
  const paidInstallments = totalTenor > 0 ? Math.min(totalTenor, rawPaid) : rawPaid;
  const remainingTenor =
    isDebtPaidOff(item) || totalTenor <= 0 ? 0 : Math.max(0, totalTenor - paidInstallments);

  let percentage = 0;
  if (isDebtPaidOff(item)) {
    percentage = 100;
  } else if (totalAmount > 0) {
    percentage = Math.min(100, Math.max(0, Math.round((paidAmount / totalAmount) * 100)));
  } else if (totalTenor > 0) {
    percentage = Math.min(100, Math.max(0, Math.round((paidInstallments / totalTenor) * 100)));
  }

  return {
    totalTenor,
    paidInstallments,
    remainingTenor,
    totalAmount,
    remainingAmount,
    paidAmount,
    percentage,
  };
}

export function getDebtReminderInfo(
  item: AssetDebtItem,
  todayISO: string = getTodayISO()
): DebtReminderInfo {
  if (isDebtPaidOff(item)) {
    return {
      status: 'paid_off',
      label: 'Sudah Lunas',
      shortLabel: 'Lunas',
      dueDateISO: getEffectiveDueDate(item, todayISO),
      daysDiff: null,
    };
  }

  const dueDateISO = getEffectiveDueDate(item, todayISO);
  if (!dueDateISO) {
    return {
      status: 'no_due_date',
      label: 'Belum ada tanggal jatuh tempo',
      shortLabel: 'Aktif',
      dueDateISO: null,
      daysDiff: null,
    };
  }

  const dueDt = parseLocalDate(dueDateISO);
  const todayDt = parseLocalDate(todayISO);
  if (!dueDt || !todayDt) {
    return {
      status: 'no_due_date',
      label: 'Tanggal jatuh tempo tidak valid',
      shortLabel: 'Aktif',
      dueDateISO: null,
      daysDiff: null,
    };
  }

  const daysDiff = Math.round((dueDt.getTime() - todayDt.getTime()) / 86_400_000);

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    return {
      status: 'overdue',
      label: `Melewati jatuh tempo ${overdueDays} hari (${formatExactDateID(dueDateISO)})`,
      shortLabel: `Terlambat ${overdueDays}h`,
      dueDateISO,
      daysDiff,
    };
  }

  if (daysDiff === 0) {
    return {
      status: 'due_soon',
      label: `Jatuh tempo hari ini (${formatExactDateID(dueDateISO)})`,
      shortLabel: 'Hari ini',
      dueDateISO,
      daysDiff: 0,
    };
  }

  if (daysDiff <= 7) {
    return {
      status: 'due_soon',
      label: `Segera jatuh tempo dalam ${daysDiff} hari (${formatExactDateID(dueDateISO)})`,
      shortLabel: `${daysDiff} hari lagi`,
      dueDateISO,
      daysDiff,
    };
  }

  return {
    status: 'upcoming',
    label: `Jatuh tempo ${formatExactDateID(dueDateISO)}`,
    shortLabel: formatExactDateID(dueDateISO),
    dueDateISO,
    daysDiff,
  };
}

export function computeDebtDashboardSummary(
  items: AssetDebtItem[],
  _payments: DebtPaymentRecord[] = [],
  todayISO: string = getTodayISO()
): DebtDashboardSummary {
  const debts = items.filter((i) => i.kind === 'debt');

  let totalObligation = 0;
  let totalRemainingDebt = 0;
  let totalPaidAmount = 0;
  let totalMonthlyInstallment = 0;
  let activeCount = 0;
  let paidOffCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  const dueAttentionItems: Array<{ item: AssetDebtItem; reminder: DebtReminderInfo }> = [];
  const upcomingItems: Array<{ item: AssetDebtItem; reminder: DebtReminderInfo }> = [];

  for (const d of debts) {
    const total = getDebtTotalAmount(d);
    const remaining = getDebtRemainingAmount(d);
    const paid = Math.max(0, total - remaining);

    totalObligation += total;
    totalRemainingDebt += remaining;
    totalPaidAmount += paid;

    const reminder = getDebtReminderInfo(d, todayISO);
    if (reminder.status === 'paid_off') {
      paidOffCount += 1;
    } else {
      activeCount += 1;
      totalMonthlyInstallment += getMonthlyEquivalentInstallment(d);
      if (reminder.status === 'overdue') {
        overdueCount += 1;
        dueAttentionItems.push({ item: d, reminder });
      } else if (reminder.status === 'due_soon') {
        dueSoonCount += 1;
        dueAttentionItems.push({ item: d, reminder });
      }
      if (reminder.dueDateISO) {
        upcomingItems.push({ item: d, reminder });
      }
    }
  }

  dueAttentionItems.sort((a, b) => (a.reminder.daysDiff ?? 9999) - (b.reminder.daysDiff ?? 9999));
  upcomingItems.sort((a, b) => (a.reminder.daysDiff ?? 9999) - (b.reminder.daysDiff ?? 9999));

  const paidPercentage =
    totalObligation > 0
      ? Math.min(100, Math.max(0, Math.round((totalPaidAmount / totalObligation) * 100)))
      : 0;

  return {
    totalObligation,
    totalRemainingDebt,
    totalPaidAmount,
    paidPercentage,
    totalMonthlyInstallment,
    totalCount: debts.length,
    activeCount,
    paidOffCount,
    overdueCount,
    dueSoonCount,
    dueAttentionItems,
    upcomingItems,
  };
}
