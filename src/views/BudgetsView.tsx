import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { BUDGET_GROUP_META } from '../constants/categories';
import { useTheme } from '../contexts/ThemeContext';
import type { BudgetGroup, BudgetItem, CategoryDef, Transaction } from '../types/finance';
import { computeBudgetOverview } from '../utils/calculations';
import {
  formatIDR,
  formatInputDigits,
  formatMonthLabel,
  parseInputDigits,
  shiftMonthISO,
} from '../utils/format';

interface BudgetsViewProps {
  selectedMonth: string;
  onMonthChange: (monthISO: string) => void;
  budgets: BudgetItem[];
  transactions: Transaction[];
  categories: CategoryDef[];
  onSaveBudget: (
    payload: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
  onCopyPreviousMonth: (targetMonth: string) => Promise<number>;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  selectedMonth,
  onMonthChange,
  budgets,
  transactions,
  categories,
  onSaveBudget,
  onDeleteBudget,
  onCopyPreviousMonth,
}) => {
  const { effectiveColors } = useTheme();
  const overview = useMemo(
    () => computeBudgetOverview(budgets, transactions, categories, selectedMonth),
    [budgets, transactions, categories, selectedMonth]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [group, setGroup] = useState<BudgetGroup>('needs');
  const [limitInput, setLimitInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    const firstCat = expenseCategories[0];
    setEditingItem(null);
    setCategoryId(firstCat?.id ?? '');
    setGroup(firstCat?.budgetGroup ?? 'needs');
    setLimitInput('');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setCategoryId(item.categoryId);
    setGroup(item.group);
    setLimitInput(formatInputDigits(String(item.limitAmount)));
    setError(null);
    setModalOpen(true);
  };

  const handleCategoryChange = (nextId: string) => {
    setCategoryId(nextId);
    const cat = expenseCategories.find((c) => c.id === nextId);
    if (cat?.budgetGroup && !editingItem) {
      setGroup(cat.budgetGroup);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const limitAmount = parseInputDigits(limitInput);
    if (!categoryId) {
      setError('Pilih kategori anggaran.');
      return;
    }
    if (!limitAmount || limitAmount <= 0) {
      setError('Masukkan batas anggaran lebih dari 0.');
      return;
    }

    const cat = expenseCategories.find((c) => c.id === categoryId);
    setSaving(true);
    try {
      await onSaveBudget({
        id: editingItem?.id,
        month: selectedMonth,
        group,
        categoryId,
        categoryName: cat?.name ?? editingItem?.categoryName ?? 'Kategori',
        limitAmount,
      });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrev = async () => {
    const count = await onCopyPreviousMonth(selectedMonth);
    setCopyMessage(
      count > 0
        ? `${count} item anggaran berhasil disalin dari bulan sebelumnya.`
        : 'Tidak ada item anggaran baru dari bulan sebelumnya.'
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Anggaran Bulanan
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Pantau progres pemakaian tiap kategori secara real-time dengan metode 50/30/20.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            type="button"
            onClick={() => void handleCopyPrev()}
            className="min-h-[42px] px-3.5 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-mm-brand" />
            <span>Salin Bulan Lalu</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Anggaran</span>
          </button>
        </div>
      </div>

      {copyMessage && (
        <div className="rounded-xl bg-mm-brand/15 border border-mm-brand/30 px-4 py-2.5 flex items-center justify-between text-xs text-mm-text">
          <span>{copyMessage}</span>
          <button
            type="button"
            onClick={() => setCopyMessage(null)}
            className="font-semibold text-mm-brand cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Ringkasan Anggaran Keseluruhan */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-mm-muted">Total Batas Anggaran</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-mm-text font-mono-num">
              {formatIDR(overview.totalLimit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-mm-muted">Sudah Terpakai</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-mm-expense font-mono-num">
              {formatIDR(overview.totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-mm-muted">
              {overview.totalRemaining >= 0 ? 'Sisa Anggaran' : 'Melebihi Batas'}
            </p>
            <p
              className={`mt-1 text-lg sm:text-xl font-bold font-mono-num ${
                overview.totalRemaining >= 0 ? 'text-mm-income' : 'text-mm-expense'
              }`}
            >
              {formatIDR(Math.abs(overview.totalRemaining))}
            </p>
          </div>
        </div>

        {overview.totalLimit > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-mm-muted">Progres Keseluruhan</span>
              <span className="font-mono-num font-semibold text-mm-text">{overview.overallPct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-mm-bg overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, overview.overallPct)}%`,
                  backgroundColor:
                    overview.overallPct > 100
                      ? effectiveColors.expense
                      : overview.overallPct >= 80
                        ? effectiveColors.warning
                        : effectiveColors.primary,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Breakdown per Grup 50/30/20 dengan Progress Bar Tiap Kategori */}
      <div className="space-y-4">
        {(['needs', 'wants', 'savings'] as BudgetGroup[]).map((groupKey) => {
          const g = overview.groups[groupKey];
          const meta = BUDGET_GROUP_META[groupKey];
          const baseGroupColor =
            groupKey === 'needs'
              ? effectiveColors.primary
              : groupKey === 'wants'
                ? effectiveColors.secondary
                : effectiveColors.success;
          const groupBarColor =
            g.status === 'terlampaui'
              ? effectiveColors.expense
              : g.status === 'mendekati'
                ? effectiveColors.warning
                : baseGroupColor;

          return (
            <section
              key={groupKey}
              className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: baseGroupColor }}
                    />
                    <h2 className="text-base font-bold text-mm-text">
                      {meta.label} ({meta.recommendedPct}%)
                    </h2>
                  </div>
                  <p className="text-xs text-mm-muted mt-0.5">{meta.description}</p>
                </div>

                <div className="text-right font-mono-num">
                  <p className="text-xs sm:text-sm font-bold text-mm-text">
                    {formatIDR(g.spent)} / {formatIDR(g.limit)}
                  </p>
                  <p className="text-[11px] text-mm-muted">{g.percentage}% terpakai</p>
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-mm-bg overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, g.percentage)}%`,
                    backgroundColor: groupBarColor,
                  }}
                />
              </div>

              {g.items.length === 0 ? (
                <p className="text-xs text-mm-muted">
                  Belum ada pos anggaran pada grup {meta.label}.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {g.items.map((item) => {
                    const barColor =
                      item.status === 'terlampaui'
                        ? effectiveColors.expense
                        : item.status === 'mendekati'
                          ? effectiveColors.warning
                          : effectiveColors.success;

                    const statusText =
                      item.status === 'terlampaui'
                        ? 'Melebihi batas'
                        : item.status === 'mendekati'
                          ? 'Mendekati batas'
                          : 'Aman';

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-mm-bg/85 border border-mm-border p-3.5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-mm-text truncate">
                              {item.categoryName}
                            </p>
                            <p className="text-[11px] text-mm-muted">
                              Status:{' '}
                              <span
                                className={
                                  item.status === 'terlampaui'
                                    ? 'text-mm-expense font-semibold'
                                    : item.status === 'mendekati'
                                      ? 'text-mm-warning font-semibold'
                                      : 'text-mm-success font-semibold'
                                }
                              >
                                {statusText}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                              aria-label={`Edit anggaran ${item.categoryName}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteBudget(item.id)}
                              className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                              aria-label={`Hapus anggaran ${item.categoryName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Visual Progress Bar Kategori */}
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full rounded-full bg-mm-surface overflow-hidden border border-mm-border/50">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs font-mono-num">
                            <span className="text-mm-text">
                              {formatIDR(item.spent)} / {formatIDR(item.limitAmount)}
                            </span>
                            <span
                              className={`font-bold ${
                                item.status === 'terlampaui'
                                  ? 'text-mm-expense'
                                  : item.status === 'mendekati'
                                    ? 'text-mm-warning'
                                    : 'text-mm-success'
                              }`}
                            >
                              {item.percentage}%
                            </span>
                          </div>
                          <p className="text-[11px] text-mm-muted font-mono-num">
                            {item.remaining >= 0
                              ? `Sisa: ${formatIDR(item.remaining)}`
                              : `Terlampaui: ${formatIDR(Math.abs(item.remaining))}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Modal Tambah / Edit Anggaran */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">
                {editingItem ? 'Edit Anggaran' : 'Tambah Anggaran'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {error && (
                <div className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2 text-xs text-mm-expense">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Kategori Pengeluaran
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Kelompok 50/30/20
                </label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value as BudgetGroup)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  <option value="needs">Kebutuhan (50%)</option>
                  <option value="wants">Keinginan (30%)</option>
                  <option value="savings">Tabungan (20%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Batas Anggaran (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={limitInput}
                  onChange={(e) => setLimitInput(formatInputDigits(e.target.value))}
                  placeholder="0"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-base font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Anggaran'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
