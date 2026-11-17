import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet as WalletIcon, X } from 'lucide-react';
import { ColorPickerField } from '../components/ColorPickerField';
import { PRESET_COLORS, WALLET_TYPE_LABELS } from '../constants/categories';
import type { Wallet, WalletType } from '../types/finance';
import { formatIDR, formatInputDigits, parseInputDigits } from '../utils/format';

interface WalletsViewProps {
  wallets: Wallet[];
  onSaveWallet: (
    payload: Omit<Wallet, 'id' | 'balance' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteWallet: (id: string) => Promise<void>;
}

export const WalletsView: React.FC<WalletsViewProps> = ({
  wallets,
  onSaveWallet,
  onDeleteWallet,
}) => {
  const totalBalance = useMemo(
    () => wallets.reduce((acc, w) => acc + w.balance, 0),
    [wallets]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('bank');
  const [initialBalanceInput, setInitialBalanceInput] = useState('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [colorValid, setColorValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingWallet(null);
    setName('');
    setType('bank');
    setInitialBalanceInput('');
    setColor(PRESET_COLORS[0]);
    setColorValid(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (wallet: Wallet) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type);
    setInitialBalanceInput(formatInputDigits(String(wallet.initialBalance)));
    setColor(wallet.color || PRESET_COLORS[0]);
    setColorValid(true);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Masukkan nama dompet atau rekening.');
      return;
    }
    if (!colorValid) {
      setError('Masukkan kode warna HEX yang valid (contoh: #1677FF).');
      return;
    }

    setSaving(true);
    try {
      await onSaveWallet({
        id: editingWallet?.id,
        name: name.trim(),
        type,
        initialBalance: parseInputDigits(initialBalanceInput),
        color,
      });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan dompet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Dompet &amp; Rekening
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Kelola rekening bank, e-wallet, uang tunai, dan tabungan Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Dompet</span>
        </button>
      </div>

      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-mm-muted">Total Saldo Keseluruhan</p>
          <p className="mt-1 text-2xl font-extrabold text-mm-text font-mono-num">
            {formatIDR(totalBalance)}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand">
          <WalletIcon className="w-6 h-6" />
        </div>
      </section>

      {wallets.length === 0 ? (
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-mm-text">Belum ada dompet tersimpan</p>
          <p className="text-xs text-mm-muted">
            Tambahkan minimal satu dompet untuk mulai mencatat transaksi keuangan.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="rounded-2xl bg-mm-surface border border-mm-border p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center border shrink-0"
                    style={{
                      backgroundColor: `${wallet.color}22`,
                      borderColor: `${wallet.color}55`,
                      color: wallet.color,
                    }}
                  >
                    <WalletIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-mm-text truncate">{wallet.name}</h2>
                    <p className="text-xs text-mm-muted">
                      {WALLET_TYPE_LABELS[wallet.type] ?? 'Dompet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(wallet)}
                    className="min-h-[36px] min-w-[36px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                    aria-label={`Edit ${wallet.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteWallet(wallet.id)}
                    className="min-h-[36px] min-w-[36px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                    aria-label={`Hapus ${wallet.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-mm-border flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] text-mm-muted">Saldo Saat Ini</p>
                  <p className="text-xl font-extrabold text-mm-text font-mono-num">
                    {formatIDR(wallet.balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-mm-muted">Saldo Awal</p>
                  <p className="text-xs font-semibold text-mm-text font-mono-num">
                    {formatIDR(wallet.initialBalance)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">
                {editingWallet ? 'Edit Dompet' : 'Tambah Dompet'}
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
                  Nama Dompet / Rekening
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Bank BCA, GoPay, Dompet Tunai"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Jenis Dompet
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as WalletType)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    <option value="bank">Rekening Bank</option>
                    <option value="ewallet">E-Wallet</option>
                    <option value="cash">Uang Tunai</option>
                    <option value="savings">Tabungan</option>
                    <option value="other">Dompet Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Saldo Awal (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(formatInputDigits(e.target.value))}
                    placeholder="0"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                </div>
              </div>

              <ColorPickerField
                label="Warna Identitas Dompet"
                value={color}
                previewLabel={name.trim() || 'Dompet Baru'}
                onChange={(hex, isValid) => {
                  setColor(hex);
                  setColorValid(isValid);
                }}
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Dompet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
