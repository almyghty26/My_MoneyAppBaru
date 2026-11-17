import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction } from '../types/finance';
import {
  formatExactDateID,
  formatIDR,
  formatMonthLabel,
  getDaysInMonth,
  getFirstWeekdayOfMonth,
  getTodayISO,
  normalizeLocalDateKey,
  shiftMonthISO,
} from '../utils/format';

interface CalendarWidgetProps {
  monthISO: string;
  onMonthChange: (monthISO: string) => void;
  transactions: Transaction[];
  onEditTransaction: (tx: Transaction) => void;
}

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  monthISO,
  onMonthChange,
  transactions,
  onEditTransaction,
}) => {
  const todayISO = getTodayISO();
  const [selectedDayISO, setSelectedDayISO] = useState<string>(
    todayISO.startsWith(monthISO) ? todayISO : `${monthISO}-01`
  );

  const daysInMonth = getDaysInMonth(monthISO);
  const firstWeekday = getFirstWeekdayOfMonth(monthISO);

  const dailyMap = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; txs: Transaction[] }>();
    for (const t of transactions) {
      const dateKey = normalizeLocalDateKey(t.date);
      if (!dateKey || !dateKey.startsWith(monthISO)) continue;
      const entry = map.get(dateKey) ?? { income: 0, expense: 0, txs: [] };
      if (t.type === 'income') entry.income += t.amount;
      else if (t.type === 'expense') entry.expense += t.amount;
      entry.txs.push(t);
      map.set(dateKey, entry);
    }
    return map;
  }, [transactions, monthISO]);

  const activeDateISO = selectedDayISO.startsWith(monthISO) ? selectedDayISO : `${monthISO}-01`;
  const activeEntry = dailyMap.get(activeDateISO);

  return (
    <section className="rounded-2xl bg-mm-surface border border-mm-border p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-mm-text">Kalender Aktivitas</h3>
          <p className="text-xs text-mm-muted">Ketuk tanggal untuk melihat transaksi</p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthISO(monthISO, -1))}
            className="min-h-[36px] min-w-[36px] rounded-lg bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-mm-text min-w-[104px] text-center">
            {formatMonthLabel(monthISO)}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMonthISO(monthISO, 1))}
            className="min-h-[36px] min-w-[36px] rounded-lg bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-mm-muted">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-1">
            {h}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-9" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dateISO = `${monthISO}-${String(day).padStart(2, '0')}`;
          const info = dailyMap.get(dateISO);
          const isSelected = dateISO === activeDateISO;
          const isToday = dateISO === todayISO;

          return (
            <button
              key={dateISO}
              type="button"
              onClick={() => setSelectedDayISO(dateISO)}
              className={`h-9 rounded-lg flex flex-col items-center justify-center text-xs transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-mm-brand text-mm-brand-fg font-bold'
                  : isToday
                    ? 'bg-mm-elevated text-mm-brand font-semibold border border-mm-brand/40'
                    : 'hover:bg-mm-hover text-mm-text'
              }`}
            >
              <span className="leading-none">{day}</span>
              {info && (info.income > 0 || info.expense > 0 || info.txs.length > 0) && (
                <div className="flex items-center gap-0.5 mt-1">
                  {info.income > 0 && <span className="w-1 h-1 rounded-full bg-mm-income" />}
                  {info.expense > 0 && <span className="w-1 h-1 rounded-full bg-mm-expense" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-mm-border space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-mm-text">{formatExactDateID(activeDateISO)}</span>
          <span className="text-mm-muted">
            {activeEntry ? `${activeEntry.txs.length} transaksi` : 'Belum ada aktivitas'}
          </span>
        </div>

        {activeEntry && activeEntry.txs.length > 0 && (
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {activeEntry.txs.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => onEditTransaction(tx)}
                className="w-full px-2.5 py-2 rounded-lg bg-mm-bg/80 hover:bg-mm-hover flex items-center justify-between gap-2 text-xs text-left cursor-pointer"
              >
                <span className="text-mm-text truncate">{tx.note || tx.categoryName}</span>
                <span
                  className={`font-mono-num font-semibold shrink-0 ${
                    tx.type === 'income'
                      ? 'text-mm-income'
                      : tx.type === 'expense'
                        ? 'text-mm-expense'
                        : 'text-mm-brand'
                  }`}
                >
                  {formatIDR(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
