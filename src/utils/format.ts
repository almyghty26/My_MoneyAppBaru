const numberFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 2,
});

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}Rp${numberFormatter.format(Math.abs(safe))}`;
}

export function formatCompactIDR(amount: number): string {
  return formatIDR(amount);
}

export function formatInputDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return numberFormatter.format(Number(digits));
}

export function parseInputDigits(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits);
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthISO(): string {
  return getTodayISO().slice(0, 7);
}

export function shiftMonthISO(monthISO: string, delta: number): string {
  const [y, m] = monthISO.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function getRecentMonths(currentMonthISO: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(shiftMonthISO(currentMonthISO, -i));
  }
  return result;
}

export const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export const WEEKDAYS_SHORT_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const WEEKDAYS_FULL_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function toLocalDateISO(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const plainMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (plainMatch) {
    const y = Number(plainMatch[1]);
    const m = Number(plainMatch[2]);
    const d = Number(plainMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dt;
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function normalizeLocalDateKey(dateStr: string): string | null {
  const dt = parseLocalDate(dateStr);
  return dt ? toLocalDateISO(dt) : null;
}

export function shiftDateISO(dateISO: string, deltaDays: number): string {
  const dt = parseLocalDate(dateISO) ?? new Date();
  const shifted = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + deltaDays);
  return toLocalDateISO(shifted);
}

export function getMondayOfWeekISO(dateISO: string): string {
  const dt = parseLocalDate(dateISO) ?? new Date();
  const jsDay = dt.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diffToMonday);
  return toLocalDateISO(monday);
}

export function formatMonthLabel(monthISO: string): string {
  const [y, m] = monthISO.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return monthISO;
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function formatMonthShort(monthISO: string): string {
  const [y, m] = monthISO.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return monthISO;
  return `${MONTHS_SHORT_ID[m - 1]} ${String(y).slice(2)}`;
}

function getConfiguredDateFormat(): 'relative' | 'short' | 'slash' | 'iso' {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'relative';
    const raw = window.localStorage.getItem('my_money_prefs_v1');
    if (!raw) return 'relative';
    const parsed = JSON.parse(raw) as { dateFormat?: string };
    if (
      parsed.dateFormat === 'relative' ||
      parsed.dateFormat === 'short' ||
      parsed.dateFormat === 'slash' ||
      parsed.dateFormat === 'iso'
    ) {
      return parsed.dateFormat;
    }
    return 'relative';
  } catch {
    return 'relative';
  }
}

export function formatDateID(
  dateISO: string,
  overrideFormat?: 'relative' | 'short' | 'slash' | 'iso'
): string {
  const fmt = overrideFormat ?? getConfiguredDateFormat();
  const [y, m, d] = dateISO.split('-').map(Number);

  if (fmt === 'iso') return dateISO;
  if (fmt === 'slash' && y && m && d) {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  if (fmt === 'short' && y && m && d) {
    return `${d} ${MONTHS_SHORT_ID[m - 1]} ${y}`;
  }

  const today = getTodayISO();
  if (dateISO === today) return 'Hari Ini';
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yISO = toLocalDateISO(yesterdayDate);
  if (dateISO === yISO) return 'Kemarin';

  if (!y || !m || !d) return dateISO;
  return `${d} ${MONTHS_SHORT_ID[m - 1]} ${y}`;
}

export function formatExactDateID(
  dateISO: string,
  overrideFormat?: 'relative' | 'short' | 'slash' | 'iso'
): string {
  const fmt = overrideFormat ?? getConfiguredDateFormat();
  if (fmt === 'iso') return dateISO;
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return dateISO;
  if (fmt === 'slash') {
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  return `${d} ${MONTHS_SHORT_ID[m - 1]} ${y}`;
}

export function formatWeekRangeLabel(mondayISO: string): string {
  const startISO = getMondayOfWeekISO(mondayISO);
  const endISO = shiftDateISO(startISO, 6);
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return `${startISO} – ${endISO}`;

  if (sy === ey && sm === em) {
    return `${sd} – ${ed} ${MONTHS_SHORT_ID[em - 1]} ${ey}`;
  }
  if (sy === ey) {
    return `${sd} ${MONTHS_SHORT_ID[sm - 1]} – ${ed} ${MONTHS_SHORT_ID[em - 1]} ${ey}`;
  }
  return `${sd} ${MONTHS_SHORT_ID[sm - 1]} ${sy} – ${ed} ${MONTHS_SHORT_ID[em - 1]} ${ey}`;
}

export function getDaysInMonth(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function getFirstWeekdayOfMonth(monthISO: string): number {
  const [y, m] = monthISO.split('-').map(Number);
  const day = new Date(y, m - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function getRemainingDaysInMonth(monthISO: string): number {
  const today = getTodayISO();
  const currentMonth = today.slice(0, 7);
  const totalDays = getDaysInMonth(monthISO);
  if (monthISO < currentMonth) return 0;
  if (monthISO > currentMonth) return totalDays;
  const currentDay = Number(today.slice(8, 10));
  return Math.max(1, totalDays - currentDay + 1);
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
