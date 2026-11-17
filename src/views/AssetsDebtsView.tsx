import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Landmark,
  Palette,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { ColorPickerField } from '../components/ColorPickerField';
import { PRESET_COLORS } from '../constants/categories';
import type { AssetDebtItem, AssetSubtype, AssetTypeDef } from '../types/finance';
import {
  ASSET_SUBTYPE_LABELS,
  loadAssetTypesFromStorage,
  normalizeHexColor,
  rememberCustomColorInStorage,
  resolveAssetTypeForItem,
  saveAssetTypesToStorage,
} from '../utils/assetColors';
import {
  formatIDR,
  formatInputDigits,
  generateId,
  parseInputDigits,
} from '../utils/format';

interface AssetsDebtsViewProps {
  accountId?: string;
  items: AssetDebtItem[];
  onSaveItem: (
    payload: Omit<AssetDebtItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const AssetsDebtsView: React.FC<AssetsDebtsViewProps> = ({
  accountId = 'local_default',
  items,
  onSaveItem,
  onDeleteItem,
}) => {
  const [assetTypes, setAssetTypes] = useState<AssetTypeDef[]>(() =>
    loadAssetTypesFromStorage(accountId)
  );

  useEffect(() => {
    setAssetTypes(loadAssetTypesFromStorage(accountId));
  }, [accountId]);

  const assets = useMemo(() => items.filter((i) => i.kind === 'asset'), [items]);
  const debts = useMemo(() => items.filter((i) => i.kind === 'debt'), [items]);

  const totals = useMemo(() => {
    const totalAssets = assets.reduce((acc, a) => acc + a.amount, 0);
    const totalDebts = debts.reduce((acc, d) => acc + d.amount, 0);
    const monthlyInstallments = debts.reduce((acc, d) => acc + (d.monthlyInstallment || 0), 0);
    return {
      totalAssets,
      totalDebts,
      monthlyInstallments,
      netAssets: totalAssets - totalDebts,
    };
  }, [assets, debts]);

  // Modal Tambah / Edit Aset atau Utang
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AssetDebtItem | null>(null);
  const [kind, setKind] = useState<'asset' | 'debt'>('asset');
  const [assetTypeId, setAssetTypeId] = useState<string>(() => assetTypes[0]?.id ?? 'type_liquid');
  const [debtSubtype, setDebtSubtype] = useState<'debt' | 'installment'>('installment');
  const [itemName, setItemName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [monthlyInput, setMonthlyInput] = useState('');
  const [dueDateDay, setDueDateDay] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Modal Tambah / Edit Jenis Aset (dengan Custom Color Picker)
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssetTypeDef | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeSubtype, setTypeSubtype] = useState<AssetSubtype>('liquid');
  const [typeColor, setTypeColor] = useState<string>(PRESET_COLORS[2]);
  const [typeColorValid, setTypeColorValid] = useState(true);
  const [typeError, setTypeError] = useState<string | null>(null);

  const openCreateItem = (defaultKind: 'asset' | 'debt') => {
    setEditingItem(null);
    setKind(defaultKind);
    setAssetTypeId(assetTypes[0]?.id ?? 'type_liquid');
    setDebtSubtype('installment');
    setItemName('');
    setAmountInput('');
    setMonthlyInput('');
    setDueDateDay('');
    setItemNote('');
    setItemError(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: AssetDebtItem) => {
    setEditingItem(item);
    setKind(item.kind);
    if (item.kind === 'asset') {
      const resolved = resolveAssetTypeForItem(item, assetTypes);
      setAssetTypeId(resolved.id);
    } else {
      setDebtSubtype(item.subtype === 'debt' ? 'debt' : 'installment');
    }
    setItemName(item.name);
    setAmountInput(formatInputDigits(String(item.amount)));
    setMonthlyInput(
      item.monthlyInstallment ? formatInputDigits(String(item.monthlyInstallment)) : ''
    );
    setDueDateDay(item.dueDateDay ? String(item.dueDateDay) : '');
    setItemNote(item.note);
    setItemError(null);
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);

    const amount = parseInputDigits(amountInput);
    if (!itemName.trim()) {
      setItemError(kind === 'asset' ? 'Masukkan nama aset.' : 'Masukkan nama utang atau cicilan.');
      return;
    }
    if (!amount || amount <= 0) {
      setItemError('Masukkan nominal nilai lebih dari 0.');
      return;
    }

    setSavingItem(true);
    try {
      if (kind === 'asset') {
        const chosenType = assetTypes.find((t) => t.id === assetTypeId) ?? assetTypes[0];
        await onSaveItem({
          id: editingItem?.id,
          kind: 'asset',
          subtype: chosenType?.subtype ?? 'liquid',
          assetTypeId: chosenType?.id,
          color: chosenType?.color,
          name: itemName.trim(),
          amount,
          note: itemNote.trim(),
        });
      } else {
        const parsedDue = dueDateDay ? Number(dueDateDay) : undefined;
        await onSaveItem({
          id: editingItem?.id,
          kind: 'debt',
          subtype: debtSubtype,
          name: itemName.trim(),
          amount,
          monthlyInstallment: monthlyInput ? parseInputDigits(monthlyInput) : undefined,
          dueDateDay: parsedDue && parsedDue >= 1 && parsedDue <= 31 ? parsedDue : undefined,
          note: itemNote.trim(),
        });
      }
      setItemModalOpen(false);
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'Gagal menyimpan data.');
    } finally {
      setSavingItem(false);
    }
  };

  const openCreateTypeModal = () => {
    setEditingType(null);
    setTypeName('');
    setTypeSubtype('investment');
    setTypeColor(PRESET_COLORS[0]);
    setTypeColorValid(true);
    setTypeError(null);
    setTypeModalOpen(true);
  };

  const openEditTypeModal = (t: AssetTypeDef) => {
    setEditingType(t);
    setTypeName(t.name);
    setTypeSubtype(t.subtype);
    setTypeColor(normalizeHexColor(t.color) ?? PRESET_COLORS[0]);
    setTypeColorValid(true);
    setTypeError(null);
    setTypeModalOpen(true);
  };

  const handleSaveType = (e: React.FormEvent) => {
    e.preventDefault();
    setTypeError(null);

    if (!typeName.trim()) {
      setTypeError('Masukkan nama jenis aset.');
      return;
    }

    const validHex = normalizeHexColor(typeColor);
    if (!typeColorValid || !validHex) {
      setTypeError(
        'Format kode warna HEX tidak valid. Gunakan format 6 digit diawali # (contoh: #1677FF).'
      );
      return;
    }

    const now = new Date().toISOString();
    const nextTypes: AssetTypeDef[] = editingType
      ? assetTypes.map((t) =>
          t.id === editingType.id
            ? {
                ...t,
                name: typeName.trim(),
                subtype: typeSubtype,
                color: validHex,
                updatedAt: now,
              }
            : t
        )
      : [
          ...assetTypes,
          {
            id: generateId('atype'),
            name: typeName.trim(),
            subtype: typeSubtype,
            color: validHex,
            isBuiltIn: false,
            updatedAt: now,
          },
        ];

    saveAssetTypesToStorage(nextTypes, accountId);
    rememberCustomColorInStorage(validHex, accountId);
    setAssetTypes(nextTypes);
    setTypeModalOpen(false);
  };

  const handleDeleteType = (id: string) => {
    const target = assetTypes.find((t) => t.id === id);
    if (!target || target.isBuiltIn || assetTypes.length <= 1) return;
    const next = assetTypes.filter((t) => t.id !== id);
    saveAssetTypesToStorage(next, accountId);
    setAssetTypes(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Aset, Utang &amp; Cicilan
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Kelola kekayaan non-dompet, jenis aset dengan warna pilihan, dan kewajiban cicilan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateItem('asset')}
            className="min-h-[42px] px-4 rounded-xl bg-mm-income text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aset</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateItem('debt')}
            className="min-h-[42px] px-4 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-xs sm:text-sm font-semibold text-mm-text inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4 text-mm-expense" />
            <span>Tambah Utang</span>
          </button>
        </div>
      </div>

      {/* Ringkasan KPI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Total Aset Tercatat</p>
          <p className="mt-1 text-lg font-bold text-mm-income font-mono-num">
            {formatIDR(totals.totalAssets)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Total Utang / Kewajiban</p>
          <p className="mt-1 text-lg font-bold text-mm-expense font-mono-num">
            {formatIDR(totals.totalDebts)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Cicilan per Bulan</p>
          <p className="mt-1 text-lg font-bold text-mm-warning font-mono-num">
            {formatIDR(totals.monthlyInstallments)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Selisih Aset &amp; Utang</p>
          <p
            className={`mt-1 text-lg font-bold font-mono-num ${
              totals.netAssets >= 0 ? 'text-mm-text' : 'text-mm-expense'
            }`}
          >
            {formatIDR(totals.netAssets)}
          </p>
        </div>
      </section>

      {/* Manajemen Jenis Aset + Warna Custom */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-mm-text">Jenis Aset &amp; Warna</h2>
              <p className="text-xs text-mm-muted">
                Sesuaikan warna bawaan atau warna custom HEX untuk setiap jenis aset.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateTypeModal}
            className="min-h-[40px] px-3.5 rounded-xl mm-btn-primary text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jenis Aset</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {assetTypes.map((t) => (
            <div
              key={t.id}
              className="rounded-xl bg-mm-bg/85 border border-mm-border p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: `${t.color}22`,
                    borderColor: `${t.color}66`,
                    color: t.color,
                  }}
                >
                  <Landmark className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-mm-text truncate">{t.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-mm-muted">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span>{ASSET_SUBTYPE_LABELS[t.subtype]}</span>
                    <span className="font-mono-num">· {t.color}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditTypeModal(t)}
                  className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                  aria-label={`Edit jenis aset ${t.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!t.isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => handleDeleteType(t.id)}
                    className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                    aria-label={`Hapus jenis aset ${t.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daftar Aset & Daftar Utang */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daftar Aset */}
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-mm-text">Daftar Aset ({assets.length})</h2>
            <button
              type="button"
              onClick={() => openCreateItem('asset')}
              className="text-xs font-semibold text-mm-income hover:underline cursor-pointer"
            >
              + Tambah Aset
            </button>
          </div>

          {assets.length === 0 ? (
            <p className="text-xs text-mm-muted py-4 text-center">
              Belum ada aset non-dompet tercatat.
            </p>
          ) : (
            <div className="space-y-2.5">
              {assets.map((asset) => {
                const resolvedType = resolveAssetTypeForItem(asset, assetTypes);
                const color = resolvedType.color;

                return (
                  <div
                    key={asset.id}
                    className="rounded-xl bg-mm-bg/85 border border-mm-border p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: `${color}22`,
                          borderColor: `${color}66`,
                          color,
                        }}
                      >
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-mm-text truncate">{asset.name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-mm-muted mt-0.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate">{resolvedType.name}</span>
                        </div>
                        {asset.note && (
                          <p className="text-[11px] text-mm-muted truncate mt-0.5">{asset.note}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-mm-income font-mono-num">
                        {formatIDR(asset.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditItem(asset)}
                        className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                        aria-label={`Edit aset ${asset.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteItem(asset.id)}
                        className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                        aria-label={`Hapus aset ${asset.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Daftar Utang & Cicilan */}
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-mm-text">Utang &amp; Cicilan ({debts.length})</h2>
            <button
              type="button"
              onClick={() => openCreateItem('debt')}
              className="text-xs font-semibold text-mm-expense hover:underline cursor-pointer"
            >
              + Tambah Utang
            </button>
          </div>

          {debts.length === 0 ? (
            <p className="text-xs text-mm-muted py-4 text-center">
              Tidak ada catatan utang atau cicilan aktif.
            </p>
          ) : (
            <div className="space-y-2.5">
              {debts.map((debt) => (
                <div
                  key={debt.id}
                  className="rounded-xl bg-mm-bg/85 border border-mm-border p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-mm-expense/15 border border-mm-expense/30 text-mm-expense flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-mm-text truncate">{debt.name}</p>
                      <p className="text-[11px] text-mm-muted mt-0.5">
                        {debt.subtype === 'installment' ? 'Cicilan' : 'Utang'}
                        {debt.monthlyInstallment
                          ? ` · ${formatIDR(debt.monthlyInstallment)}/bln`
                          : ''}
                        {debt.dueDateDay ? ` · Jatuh tempo tgl ${debt.dueDateDay}` : ''}
                      </p>
                      {debt.note && (
                        <p className="text-[11px] text-mm-muted truncate mt-0.5">{debt.note}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-mm-expense font-mono-num">
                      {formatIDR(debt.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditItem(debt)}
                      className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover flex items-center justify-center cursor-pointer"
                      aria-label={`Edit utang ${debt.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteItem(debt.id)}
                      className="min-h-[34px] min-w-[34px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                      aria-label={`Hapus utang ${debt.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal Tambah / Edit Aset atau Utang */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">
                {editingItem
                  ? kind === 'asset'
                    ? 'Edit Aset'
                    : 'Edit Utang / Cicilan'
                  : kind === 'asset'
                    ? 'Tambah Aset'
                    : 'Tambah Utang / Cicilan'}
              </h2>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="mt-4 space-y-4">
              {itemError && (
                <div className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2 text-xs text-mm-expense">
                  {itemError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  {kind === 'asset' ? 'Nama Aset' : 'Nama Utang / Cicilan'}
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={
                    kind === 'asset' ? 'Contoh: Logam Mulia 5 Gram' : 'Contoh: Cicilan Laptop'
                  }
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              {kind === 'asset' ? (
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Jenis Aset
                  </label>
                  <select
                    value={assetTypeId}
                    onChange={(e) => setAssetTypeId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    {assetTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.color})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-mm-muted mb-1.5">
                    Jenis Kewajiban
                  </label>
                  <select
                    value={debtSubtype}
                    onChange={(e) => setDebtSubtype(e.target.value as 'debt' | 'installment')}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  >
                    <option value="installment">Cicilan Berkala</option>
                    <option value="debt">Utang Pinjaman</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  {kind === 'asset' ? 'Nilai Aset Saat Ini (Rp)' : 'Sisa Pokok Utang (Rp)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => setAmountInput(formatInputDigits(e.target.value))}
                  placeholder="0"
                  className="w-full min-h-[46px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-base font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              {kind === 'debt' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-mm-muted mb-1.5">
                      Cicilan / Bulan (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={monthlyInput}
                      onChange={(e) => setMonthlyInput(formatInputDigits(e.target.value))}
                      placeholder="0"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-bold font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mm-muted mb-1.5">
                      Tgl Jatuh Tempo (1-31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dueDateDay}
                      onChange={(e) => setDueDateDay(e.target.value)}
                      placeholder="25"
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <button
                type="submit"
                disabled={savingItem}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary text-sm font-semibold cursor-pointer"
              >
                {savingItem ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Jenis Aset dengan Custom Color Picker */}
      {typeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-mm-text">
                {editingType ? 'Edit Jenis Aset' : 'Tambah Jenis Aset'}
              </h2>
              <button
                type="button"
                onClick={() => setTypeModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="mt-4 space-y-4">
              {typeError && (
                <div
                  role="alert"
                  className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2.5 text-xs text-mm-expense"
                >
                  {typeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Nama Jenis Aset
                </label>
                <input
                  type="text"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="Contoh: Obligasi Ritel / Saham Dividen"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Kategori Klasifikasi
                </label>
                <select
                  value={typeSubtype}
                  onChange={(e) => setTypeSubtype(e.target.value as AssetSubtype)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  <option value="liquid">Aset Likuid (Masuk Dana Cadangan Likuid)</option>
                  <option value="investment">Investasi</option>
                  <option value="fixed">Aset Tetap</option>
                </select>
              </div>

              <ColorPickerField
                accountId={accountId}
                label="Warna Jenis Aset"
                value={typeColor}
                previewLabel={typeName.trim() || 'Jenis Aset'}
                onChange={(hex, isValid) => {
                  setTypeColor(hex);
                  setTypeColorValid(isValid);
                }}
              />

              <button
                type="submit"
                disabled={!typeColorValid}
                className="w-full min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold cursor-pointer"
              >
                {editingType ? 'Simpan Perubahan Jenis Aset' : 'Simpan Jenis Aset'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
