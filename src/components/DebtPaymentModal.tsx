import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CreditCard, Wallet as WalletIcon, X } from 'lucide-react';
import type { RecordDebtPaymentInput, RecordDebtPaymentResult } from '../db/indexedDb';
import type { AssetDebtItem, Wallet } from '../types/finance';
import { getDebtRemainingAmount } from '../utils/debtHelpers';
import {
  formatIDR,
  formatInputDigits,
  generateId,
  getTodayISO,
  parseInputDigits,
} from '../utils/format';

interface DebtPaymentModalProps {
  isOpen: boolean;
  debt: AssetDebtItem | null;
  wallets: Wallet[];
  onClose: () => void;
  onPay: (input: RecordDebtPaymentInput) => Promise<RecordDebtPaymentResult>;
  onOpenWalletManager: () => void;
}

export const DebtPaymentModal: React.FC<DebtPaymentModalProps> = ({
  isOpen,
  debt,
  wallets,
  onClose,
  onPay,
  onOpenWalletManager,
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [walletId, setWalletId] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const idempotencyKeyRef = useRef<string>('');
  const inFlightRef = useRef<boolean>(false);

  const remaining = debt ? getDebtRemainingAmount(debt) : 0;
  const isInstallment = debt?.subtype === 'installment';
  const suggestedInstallment =
    isInstallment && debt?.monthlyInstallment && debt.monthlyInstallment > 0
      ? Math.min(remaining, debt.monthlyInstallment)
      : remaining;

  useEffect(() => {
    if (!isOpen || !debt) return;
    idempotencyKeyRef.current = generateId('payreq');
    inFlightRef.current = false;
    setSaving(false);
    setError(null);
    const defaultAmt =
      debt.subtype === 'installment' && debt.monthlyInstallment && debt.monthlyInstallment > 0
        ? Math.min(getDebtRemainingAmount(debt), debt.monthlyInstallment)
        : getDebtRemainingAmount(debt);
    setAmountInput(defaultAmt > 0 ? formatInputDigits(String(defaultAmt)) : '');
    setWalletId(wallets[0]?.id ?? '');
    setPaymentDate(getTodayISO());
    setNote('');
  }, [isOpen, debt, wallets]);

  const parsedAmount = parseInputDigits(amountInput);
  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === walletId) ?? null,
    [wallets, walletId]
  );

  if (!isOpen || !debt) return null;

  const nextInstallmentNumber = isInstallment ? (debt.paidInstallments ?? 0) + 1 : null;
  const projectedRemaining = Math.max(0, remaining - parsedAmount);
  const insufficientWalletBalance =
    selectedWallet !== null && parsedAmount > 0 && parsedAmount > selectedWallet.balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current || saving) return;
    setError(null);

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Masukkan nominal pembayaran lebih dari Rp0.');
      return;
    }
    if (parsedAmount > remaining) {
      setError(`Nominal pembayaran melebihi sisa kewajiban (${formatIDR(remaining)}).`);
      return;
    }
    if (!walletId) {
      setError('Pilih dompet sumber pembayaran terlebih dahulu.');
      return;
    }
    if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      setError('Pilih tanggal pembayaran yang valid.');
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    try {
      await onPay({
        debtId: debt.id,
        walletId,
        amount: parsedAmount,
        paymentDate,
        note: note.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat pembayaran.');
      // Buat kunci baru hanya bila gagal validasi/proses agar pengguna bisa memperbaiki dan coba lagi
      idempotencyKeyRef.current = generateId('payreq');
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-mm-text truncate">
                {isInstallment ? 'Bayar Cicilan' : 'Bayar Utang'}
              </h2>
              <p className="text-xs text-mm-muted truncate">{debt.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-mm-bg/90 border border-mm-border p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-mm-muted">Sisa kewajiban saat ini</span>
            <span className="font-bold text-mm-expense font-mono-num">{formatIDR(remaining)}</span>
          </div>
          {isInstallment && nextInstallmentNumber !== null && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-mm-muted">Angsuran berikutnya</span>
              <span className="font-semibold text-mm-text font-mono-num">
                Ke-{nextInstallmentNumber}
                {debt.totalTenor ? ` dari ${debt.totalTenor}` : ''}
              </span>
            </div>
          )}
          {parsedAmount > 0 && parsedAmount <= remaining && (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-mm-border">
              <span className="text-mm-muted">Sisa setelah bayar</span>
              <span
                className={`font-bold font-mono-num ${
                  projectedRemaining === 0 ? 'text-mm-income' : 'text-mm-text'
                }`}
              >
                {projectedRemaining === 0 ? 'Rp0 (Lunas)' : formatIDR(projectedRemaining)}
              </span>
            </div>
          )}
        </div>

        {wallets.length === 0 ? (
          <div className="mt-4 rounded-xl bg-mm-bg border border-mm-border p-5 text-center space-y-3">
            <WalletIcon className="w-7 h-7 text-mm-muted mx-auto" />
            <p className="text-xs sm:text-sm text-mm-muted">
              Buat dompet terlebih dahulu untuk memilih sumber dana pembayaran.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWalletManager();
              }}
              className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold cursor-pointer"
            >
              Buka Dompet &amp; Rekening
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2.5 text-xs text-mm-expense"
              >
                {error}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-medium text-mm-muted">
                  Nominal Pembayaran (Rp)
                </label>
                <div className="flex items-center gap-1.5">
                  {isInstallment && suggestedInstallment > 0 && suggestedInstallment < remaining && (
                    <button
                      type="button"
                      onClick={() => setAmountInput(formatInputDigits(String(suggestedInstallment)))}
                      className="px-2 py-0.5 rounded-md bg-mm-brand/15 text-[11px] font-semibold text-mm-brand hover:bg-mm-brand/25 cursor-pointer"
                    >
                      Cicilan ({formatIDR(suggestedInstallment)})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAmountInput(formatInputDigits(String(remaining)))}
                    className="px-2 py-0.5 rounded-md bg-mm-income/15 text-[11px] font-semibold text-mm-income hover:bg-mm-income/25 cursor-pointer"
                  >
                    Lunasi
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(formatInputDigits(e.target.value))}
                placeholder="0"
                className="w-full min-h-[48px] px-4 rounded-xl bg-mm-bg border border-mm-border text-lg font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">
                Bayar dari Dompet
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatIDR(w.balance)})
                  </option>
                ))}
              </select>
              {insufficientWalletBalance && (
                <p className="mt-1.5 text-[11px] text-mm-warning">
                  Perhatian: Saldo {selectedWallet?.name} ({formatIDR(selectedWallet?.balance ?? 0)})
                  lebih kecil dari nominal pembayaran ini.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
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
                  placeholder={
                    isInstallment
                      ? `Cicilan ke-${nextInstallmentNumber ?? 1}`
                      : 'Contoh: Cicilan bulan ini'
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>
            </div>

            <div className="rounded-xl bg-mm-bg/70 border border-mm-border px-3.5 py-2.5 flex items-start gap-2 text-[11px] text-mm-muted">
              <CheckCircle2 className="w-4 h-4 text-mm-brand shrink-0 mt-0.5" />
              <span>
                Tercatat otomatis sebagai transaksi pengeluaran kategori{' '}
                <strong className="text-mm-text">Bayar Cicilan / Utang</strong> dan mengurangi
                saldo dompet terpilih tepat satu kali.
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold cursor-pointer"
            >
              {saving ? 'Memproses Pembayaran...' : 'Konfirmasi & Catat Pembayaran'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
