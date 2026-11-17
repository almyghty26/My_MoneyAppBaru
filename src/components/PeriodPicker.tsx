import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatMonthLabel, getCurrentMonthISO, MONTHS_ID, shiftMonthISO } from '../utils/format';

interface PeriodPickerProps {
  selectedMonth: string; // YYYY-MM
  onChange: (monthISO: string) => void;
  availableYears?: number[];
}

function parseMonthISO(monthISO: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthISO);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (Number.isInteger(y) && m >= 1 && m <= 12) {
      return { year: y, month: m };
    }
  }
  const fallback = getCurrentMonthISO();
  return {
    year: Number(fallback.slice(0, 4)),
    month: Number(fallback.slice(5, 7)),
  };
}

export const PeriodPicker: React.FC<PeriodPickerProps> = ({
  selectedMonth,
  onChange,
  availableYears = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = useMemo(() => parseMonthISO(selectedMonth), [selectedMonth]);
  const [draftYear, setDraftYear] = useState<number>(parsed.year);
  const [draftMonth, setDraftMonth] = useState<number>(parsed.month);

  const currentMonthISO = getCurrentMonthISO();
  const currentParsed = useMemo(() => parseMonthISO(currentMonthISO), [currentMonthISO]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftYear(parsed.year);
    setDraftMonth(parsed.month);
  }, [isOpen, parsed.year, parsed.month]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const yearBounds = useMemo(() => {
    const candidates = [
      currentParsed.year - 10,
      currentParsed.year + 5,
      parsed.year - 2,
      parsed.year + 2,
      draftYear - 2,
      draftYear + 2,
      ...availableYears.filter((y) => Number.isInteger(y) && y >= 1990 && y <= 2100),
    ];
    const minYear = Math.min(...candidates);
    const maxYear = Math.max(...candidates);
    const list: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      list.push(y);
    }
    return { minYear, maxYear, allYears: list };
  }, [availableYears, currentParsed.year, parsed.year, draftYear]);

  const quickYears = useMemo(() => {
    const center = draftYear;
    return [center - 2, center - 1, center, center + 1, center + 2];
  }, [draftYear]);

  const handleApply = () => {
    const formatted = `${String(draftYear).padStart(4, '0')}-${String(draftMonth).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleResetToCurrentMonth = () => {
    setDraftYear(currentParsed.year);
    setDraftMonth(currentParsed.month);
  };

  const isCurrentMonth = selectedMonth === currentMonthISO;

  return (
    <>
      <section
        aria-label="Filter periode laporan dashboard"
        className="rounded-2xl bg-mm-surface border border-mm-border px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-mm-brand/15 border border-mm-brand/30 text-mm-brand flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-mm-text">Periode Laporan</p>
            <p className="text-[11px] text-mm-muted hidden xl:block">
              Filter pemasukan, pengeluaran &amp; grafik
            </p>
            <p className="text-[11px] font-medium text-mm-muted sm:hidden truncate">
              Ketuk bulan untuk pilih tahun &amp; bulan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onChange(shiftMonthISO(selectedMonth, -1))}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Bulan sebelumnya"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label={`Pilih bulan dan tahun periode laporan, saat ini ${formatMonthLabel(selectedMonth)}`}
            className="flex-1 sm:flex-initial min-h-[40px] sm:min-w-[168px] px-3.5 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border hover:border-mm-brand/50 text-xs sm:text-sm font-bold text-mm-text inline-flex items-center justify-between gap-2 transition-colors cursor-pointer"
          >
            <span className="truncate">{formatMonthLabel(selectedMonth)}</span>
            <ChevronDown className="w-4 h-4 text-mm-brand shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onChange(shiftMonthISO(selectedMonth, 1))}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Bulan berikutnya"
            title="Bulan berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => onChange(currentMonthISO)}
              className="hidden xl:inline-flex min-h-[40px] px-3 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-brand whitespace-nowrap cursor-pointer transition-colors"
            >
              Bulan Ini
            </button>
          )}
        </div>
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="period-picker-title"
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-mm-brand/15 border border-mm-brand/30 text-mm-brand flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="period-picker-title" className="text-base font-bold text-mm-text">
                    Pilih Periode Laporan
                  </h2>
                  <p className="text-xs text-mm-muted">
                    Pilih tahun dan bulan secara langsung
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                aria-label="Tutup pemilihan periode"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pemilihan Tahun */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="period-year-select"
                  className="text-xs font-semibold text-mm-muted"
                >
                  Tahun
                </label>
                <button
                  type="button"
                  onClick={handleResetToCurrentMonth}
                  className="text-xs font-semibold text-mm-brand hover:underline cursor-pointer"
                >
                  Kembali ke Bulan Ini
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftYear((y) => Math.max(1990, y - 1))}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                  aria-label="Tahun sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  id="period-year-select"
                  value={draftYear}
                  onChange={(e) => setDraftYear(Number(e.target.value))}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm font-bold font-mono-num text-mm-text text-center focus:outline-none focus:border-mm-brand cursor-pointer"
                >
                  {yearBounds.allYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setDraftYear((y) => Math.min(2100, y + 1))}
                  className="min-h-[42px] min-w-[42px] rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                  aria-label="Tahun berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {quickYears.map((yr) => {
                  const isSelectedYear = yr === draftYear;
                  const isTodayYear = yr === currentParsed.year;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setDraftYear(yr)}
                      aria-pressed={isSelectedYear}
                      className={`min-h-[38px] rounded-xl border text-xs font-bold font-mono-num transition-colors cursor-pointer ${
                        isSelectedYear
                          ? 'bg-mm-brand text-mm-brand-fg border-mm-brand shadow-sm'
                          : isTodayYear
                            ? 'bg-mm-bg text-mm-brand border-mm-brand/40 hover:bg-mm-hover'
                            : 'bg-mm-bg hover:bg-mm-hover text-mm-text border-mm-border'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pemilihan Bulan Januari - Desember */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-mm-muted">Bulan</p>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_ID.map((monthName, idx) => {
                  const monthNum = idx + 1;
                  const isSelected = monthNum === draftMonth;
                  const isRealCurrentMonth =
                    draftYear === currentParsed.year && monthNum === currentParsed.month;

                  return (
                    <button
                      key={monthName}
                      type="button"
                      onClick={() => setDraftMonth(monthNum)}
                      aria-pressed={isSelected}
                      className={`min-h-[42px] px-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer relative flex items-center justify-center ${
                        isSelected
                          ? 'bg-mm-brand text-mm-brand-fg border-mm-brand shadow-sm'
                          : isRealCurrentMonth
                            ? 'bg-mm-bg text-mm-brand border-mm-brand/45 hover:bg-mm-hover'
                            : 'bg-mm-bg hover:bg-mm-hover text-mm-text border-mm-border'
                      }`}
                    >
                      <span>{monthName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Indikator Periode Terpilih & Tombol Konfirmasi */}
            <div className="rounded-xl bg-mm-bg/85 border border-mm-border px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-mm-muted">Periode dipilih</span>
              <strong className="text-mm-text font-bold">
                {MONTHS_ID[draftMonth - 1]} {draftYear}
              </strong>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs sm:text-sm font-semibold text-mm-text cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold cursor-pointer"
              >
                Terapkan Periode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
