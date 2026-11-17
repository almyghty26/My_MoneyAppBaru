import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { CategoryDef, Transaction, TransactionType, Wallet } from '../types/finance';
import { formatInputDigits, getTodayISO, parseInputDigits } from '../utils/format';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  categories: CategoryDef[];
  initialTransaction?: Transaction | null;
  onSave: (
    payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onOpenWalletManager: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  wallets,
  categories,
  initialTransaction,
  onSave,
  onDelete,
  onOpenWalletManager,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        type === 'income' ? c.type === 'income' : c.type === 'expense'
      ),
    [categories, type]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialTransaction) {
      setType(initialTransaction.type);
      setAmountInput(formatInputDigits(String(initialTransaction.amount)));
      setWalletId(initialTransaction.walletId);
      setToWalletId(initialTransaction.toWalletId || '');
      setCategoryId(initialTransaction.categoryId);
      setDate(initialTransaction.date);
      setNote(initialTransaction.note);
    } else {
      setType('expense');
      setAmountInput('');
      setWalletId(wallets[0]?.id || '');
      setToWalletId(wallets[1]?.id || '');
      const defaultExp = categories.find((c) => c.type === 'expense');
      setCategoryId(defaultExp?.id || '');
      setDate(getTodayISO());
      setNote('');
    }
  }, [isOpen, initialTransaction, wallets, categories]);

  useEffect(() => {
    if (!isOpen || type === 'transfer') return;
    const exists = filteredCategories.some((c) => c.id === categoryId);
    if (!exists && filteredCategories[0]) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, categoryId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amount = parseInputDigits(amountInput);
    if (!amount || amount <= 0) {
      setError('Masukkan nominal transaksi lebih dari 0.');
      return;
    }
    if (!walletId) {
      setError('Pilih dompet sumber terlebih dahulu.');
      return;
    }
    if (type === 'transfer') {
      if (!toWalletId) {
        setError('Pilih dompet tujuan untuk transfer.');
        return;
      }
      if (toWalletId === walletId) {
        setError('Dompet tujuan tidak boleh sama dengan dompet sumber.');
        return;
      }
    }

    const chosenCat = filteredCategories.find((c) => c.id === categoryId);

    setSaving(true);
    try {
      await onSave({
        id: initialTransaction?.id,
        type,
        amount,
        walletId,
        toWalletId: type === 'transfer' ? toWalletId : undefined,
        categoryId: type === 'transfer' ? 'transfer' : chosenCat?.id || 'cat_lainnya',
        categoryName:
          type === 'transfer'
            ? 'Transfer Antar-Dompet'
            : chosenCat?.name || 'Lainnya',
        budgetGroup: type === 'expense' ? chosenCat?.budgetGroup ?? 'needs' : undefined,
        date,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-mm-text">
            {initialTransaction ? 'Edit Transaksi' : 'Catat Transaksi'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-mm-muted hover:text-mm-text hover:bg-mm-hover cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {wallets.length === 0 ? (
          <div className="mt-5 rounded-xl bg-mm-bg border border-mm-border p-5 text-center space-y-3">
            <p className="text-sm text-mm-muted">
              Anda belum memiliki dompet atau rekening untuk mencatat transaksi.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWalletManager();
              }}
              className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
            >
              Buat Dompet Pertama
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-mm-bg border border-mm-border">
              {(
                [
                  { id: 'expense', label: 'Pengeluaran', active: 'bg-mm-expense text-white' },
                  { id: 'income', label: 'Pemasukan', active: 'bg-mm-income text-white' },
                  { id: 'transfer', label: 'Transfer', active: 'bg-mm-brand text-mm-brand-fg' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setType(tab.id)}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    type === tab.id ? tab.active : 'text-mm-muted hover:text-mm-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2.5 text-xs text-mm-expense">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">
                Nominal (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(formatInputDigits(e.target.value))}
                placeholder="0"
                className="w-full min-h-[48px] px-4 rounded-xl bg-mm-bg border border-mm-border text-lg font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  {type === 'transfer' ? 'Dompet Sumber' : 'Dompet'}
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {type === 'transfer' ? (
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Dompet Tujuan
                  </label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    <option value="">Pilih dompet tujuan</option>
                    {wallets
                      .filter((w) => w.id !== walletId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: Makan siang"
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              {initialTransaction && onDelete && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onDelete(initialTransaction.id);
                      onClose();
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="min-h-[46px] px-4 rounded-xl bg-mm-expense/15 hover:bg-mm-expense/25 border border-mm-expense/30 text-xs font-semibold text-mm-expense inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus</span>
                </button>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex-1 min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-60 text-sm font-semibold cursor-pointer"
              >
                {saving
                  ? 'Menyimpan...'
                  : initialTransaction
                    ? 'Simpan Perubahan'
                    : 'Simpan Transaksi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
