import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import { GOAL_CATEGORY_LABELS } from '../constants/categories';
import type { FinancialGoal, GoalCategory, Wallet } from '../types/finance';
import {
  formatExactDateID,
  formatIDR,
  formatInputDigits,
  getTodayISO,
  parseInputDigits,
} from '../utils/format';

interface GoalsViewProps {
  goals: FinancialGoal[];
  wallets: Wallet[];
  onSaveGoal: (
    payload: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onContributeGoal: (goalId: string, amount: number, deductWalletId?: string) => Promise<void>;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  wallets,
  onSaveGoal,
  onDeleteGoal,
  onContributeGoal,
}) => {
  const totals = useMemo(() => {
    const target = goals.reduce((acc, g) => acc + g.targetAmount, 0);
    const current = goals.reduce((acc, g) => acc + g.currentAmount, 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { target, current, pct };
  }, [goals]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GoalCategory>('emergency');
  const [targetInput, setTargetInput] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [deadline, setDeadline] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [contribGoal, setContribGoal] = useState<FinancialGoal | null>(null);
  const [contribAmountInput, setContribAmountInput] = useState('');
  const [deductFromWallet, setDeductFromWallet] = useState(false);
  const [deductWalletId, setDeductWalletId] = useState('');

  const openCreateModal = () => {
    setEditingGoal(null);
    setName('');
    setCategory('emergency');
    setTargetInput('');
    setCurrentInput('');
    setDeadline(`${getTodayISO().slice(0, 4)}-12-31`);
    setNote('');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (g: FinancialGoal) => {
    setEditingGoal(g);
    setName(g.name);
    setCategory(g.category);
    setTargetInput(formatInputDigits(String(g.targetAmount)));
    setCurrentInput(formatInputDigits(String(g.currentAmount)));
    setDeadline(g.deadline);
    setNote(g.note);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetAmount = parseInputDigits(targetInput);
    const currentAmount = parseInputDigits(currentInput);
    if (!name.trim()) {
      setError('Masukkan nama target keuangan.');
      return;
    }
    if (!targetAmount || targetAmount <= 0) {
      setError('Masukkan nominal target lebih dari 0.');
      return;
    }

    setSaving(true);
    try {
      await onSaveGoal({
        id: editingGoal?.id,
        name: name.trim(),
        category,
        targetAmount,
        currentAmount,
        deadline,
        note: note.trim(),
      });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan target.');
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribGoal) return;
    const amount = parseInputDigits(contribAmountInput);
    if (!amount || amount <= 0) return;

    setSaving(true);
    try {
      await onContributeGoal(
        contribGoal.id,
        amount,
        deductFromWallet && deductWalletId ? deductWalletId : undefined
      );
      setContribGoal(null);
      setContribAmountInput('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Target Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Rencanakan dana darurat, kendaraan, atau tabungan jangka panjang.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Target</span>
        </button>
      </div>

      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-mm-muted">Dana Terkumpul</p>
          <p className="mt-1 text-xl font-bold text-mm-income font-mono-num">
            {formatIDR(totals.current)}
          </p>
        </div>
        <div>
          <p className="text-xs text-mm-muted">Total Target</p>
          <p className="mt-1 text-xl font-bold text-mm-text font-mono-num">
            {formatIDR(totals.target)}
          </p>
        </div>
        <div>
          <p className="text-xs text-mm-muted">Pencapaian Keseluruhan</p>
          <p className="mt-1 text-xl font-bold text-mm-brand font-mono-num">{totals.pct}%</p>
        </div>
      </section>

      {goals.length === 0 ? (
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-mm-text">Belum ada target keuangan</p>
          <p className="text-xs text-mm-muted">
            Buat target tabungan pertama Anda untuk melacak progres secara rutin.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct =
              g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);

            return (
              <div
                key={g.id}
                className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-mm-income/15 border border-mm-income/30 flex items-center justify-center text-mm-income shrink-0">
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-mm-text truncate">{g.name}</h2>
                      <p className="text-xs text-mm-muted">
                        {GOAL_CATEGORY_LABELS[g.category]} · Tenggat {formatExactDateID(g.deadline)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(g)}
                      className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                      aria-label={`Edit ${g.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteGoal(g.id)}
                      className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                      aria-label={`Hapus ${g.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono-num">
                    <span className="text-mm-income font-bold">{formatIDR(g.currentAmount)}</span>
                    <span className="text-mm-muted">
                      dari {formatIDR(g.targetAmount)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-mm-bg overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, var(--mm-income), var(--mm-primary))',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-mm-muted font-mono-num">
                    {remaining === 0
                      ? 'Target tercapai!'
                      : `Kurang ${formatIDR(remaining)} lagi`}
                  </p>
                </div>

                {g.note && <p className="text-xs text-mm-muted">{g.note}</p>}

                <button
                  type="button"
                  onClick={() => {
                    setContribGoal(g);
                    setContribAmountInput('');
                    setDeductFromWallet(false);
                    setDeductWalletId(wallets[0]?.id ?? '');
                  }}
                  className="w-full min-h-[40px] rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-brand cursor-pointer"
                >
                  + Setor Dana ke Target
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah / Edit Target */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">
                {editingGoal ? 'Edit Target Keuangan' : 'Tambah Target Keuangan'}
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
                  Nama Target
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Dana Darurat 6 Bulan"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GoalCategory)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    {Object.entries(GOAL_CATEGORY_LABELS).map(([val, lbl]) => (
                      <option key={val} value={val}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Tanggal Target
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Nominal Target (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={targetInput}
                    onChange={(e) => setTargetInput(formatInputDigits(e.target.value))}
                    placeholder="0"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Sudah Terkumpul (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(formatInputDigits(e.target.value))}
                    placeholder="0"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Target'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Setor Dana */}
      {contribGoal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">Setor ke {contribGoal.name}</h2>
              <button
                type="button"
                onClick={() => setContribGoal(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContribute} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Nominal Setoran (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={contribAmountInput}
                  onChange={(e) => setContribAmountInput(formatInputDigits(e.target.value))}
                  placeholder="0"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-base font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              {wallets.length > 0 && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-mm-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductFromWallet}
                      onChange={(e) => setDeductFromWallet(e.target.checked)}
                      className="rounded accent-mm-brand"
                    />
                    <span>Catat sebagai transaksi tabungan &amp; potong saldo dompet</span>
                  </label>

                  {deductFromWallet && (
                    <select
                      value={deductWalletId}
                      onChange={(e) => setDeductWalletId(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-text focus:outline-none focus:border-mm-brand"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({formatIDR(w.balance)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Memproses...' : 'Tambah Setoran'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
