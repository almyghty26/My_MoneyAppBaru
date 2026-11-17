import React, { useRef, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  Database,
  Download,
  Landmark,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wallet as WalletIcon,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import type { UpdateCheckResult } from '../hooks/usePWA';
import type { SubView } from '../types/finance';

interface MoreMenuViewProps {
  onSelectSubView: (sub: SubView) => void;
}

export const MoreMenuView: React.FC<MoreMenuViewProps> = ({ onSelectSubView }) => {
  const items: Array<{
    id: SubView;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      id: 'pengaturan',
      title: 'Pengaturan & Tema Custom',
      subtitle: 'Atur mode gelap/terang, 6 preset, 13 warna kustom, preferensi & data',
      icon: Settings,
      color: 'text-mm-brand',
    },
    {
      id: 'dompet',
      title: 'Dompet & Rekening',
      subtitle: 'Kelola rekening bank, e-wallet, tunai, dan saldo awal',
      icon: WalletIcon,
      color: 'text-mm-accent',
    },
    {
      id: 'target',
      title: 'Target Keuangan',
      subtitle: 'Pantau dana darurat, kendaraan, atau target tabungan',
      icon: Target,
      color: 'text-mm-income',
    },
    {
      id: 'aset_utang',
      title: 'Aset, Utang & Jenis Aset',
      subtitle: 'Catat aset, cicilan, dan atur warna custom jenis aset',
      icon: Landmark,
      color: 'text-mm-brand2',
    },
    {
      id: 'laporan',
      title: 'Laporan & Grafik',
      subtitle: 'Analisis arus kas multi-periode dan distribusi kategori',
      icon: BarChart3,
      color: 'text-mm-brand',
    },
    {
      id: 'kesehatan',
      title: 'Skor Kesehatan Finansial',
      subtitle: 'Evaluasi 4 pilar rasio tabungan, anggaran, likuiditas & utang',
      icon: ShieldCheck,
      color: 'text-mm-warning',
    },
    {
      id: 'data_pwa',
      title: 'Cadangan Data & Pembaruan PWA',
      subtitle: 'Ekspor/restore JSON, cek pembaruan aplikasi, dan mode offline',
      icon: Database,
      color: 'text-mm-accent',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
          Menu Lainnya
        </h1>
        <p className="text-xs sm:text-sm text-mm-muted">
          Akses pengaturan, dompet, aset, laporan, cadangan data, dan pembaruan aplikasi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSubView(item.id)}
              className="rounded-2xl bg-mm-surface hover:bg-mm-hover border border-mm-border p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-mm-bg border border-mm-border flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-mm-text truncate">{item.title}</p>
                  <p className="text-xs text-mm-muted mt-0.5 line-clamp-2">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-mm-muted shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface DataPWAViewProps {
  needRefresh: boolean;
  isUpdating: boolean;
  isCheckingUpdate: boolean;
  updateFeedback: string | null;
  onCheckUpdates: () => Promise<UpdateCheckResult>;
  onApplyUpdate: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onRestoreBackup: (rawText: string) => Promise<{
    wallets: number;
    transactions: number;
    budgets: number;
    goals: number;
    assetsDebts: number;
  }>;
  onLoadSampleData: () => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export const DataPWAView: React.FC<DataPWAViewProps> = ({
  needRefresh,
  isUpdating,
  isCheckingUpdate,
  updateFeedback,
  onCheckUpdates,
  onApplyUpdate,
  onExportBackup,
  onRestoreBackup,
  onLoadSampleData,
  onClearAllData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const text = await file.text();
      const summary = await onRestoreBackup(text);
      setStatusMessage(
        `Berhasil memulihkan ${summary.wallets} dompet, ${summary.transactions} transaksi, ${summary.budgets} anggaran, dan ${summary.assetsDebts} aset/utang.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membaca file cadangan JSON.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
          Cadangan Data &amp; Pengaturan PWA
        </h1>
        <p className="text-xs sm:text-sm text-mm-muted">
          Kelola cadangan lokal JSON dan pembaruan aplikasi tanpa menghapus data Anda.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-mm-success/15 border border-mm-success/30 px-4 py-3 text-xs text-mm-text">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-4 py-3 text-xs text-mm-expense">
          {errorMessage}
        </div>
      )}

      {/* Pembaruan Aplikasi PWA */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-mm-text">Pembaruan Aplikasi (PWA)</h2>
            <p className="text-xs text-mm-muted">
              Periksa apakah versi terbaru MY MONEY sudah tersedia. Pembaruan tidak menghapus data IndexedDB maupun Local Storage Anda.
            </p>
          </div>
        </div>

        {updateFeedback && (
          <div className="rounded-xl bg-mm-bg border border-mm-border px-3.5 py-2.5 text-xs text-mm-text">
            {updateFeedback}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isCheckingUpdate}
            onClick={() => void onCheckUpdates()}
            className="min-h-[42px] px-4 rounded-xl bg-mm-elevated hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
            <span>{isCheckingUpdate ? 'Memeriksa...' : 'Cek Pembaruan'}</span>
          </button>

          {needRefresh && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void onApplyUpdate()}
              className="min-h-[42px] px-4 rounded-xl mm-btn-primary text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Memperbarui...' : 'Update Sekarang'}</span>
            </button>
          )}

          <div className="w-full sm:w-auto">
            <PWAInstallButton compact />
          </div>
        </div>
      </section>

      {/* Ekspor & Pulihkan JSON */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-mm-text">Cadangan &amp; Pulihkan JSON</h2>
          <p className="text-xs text-mm-muted mt-0.5">
            Simpan salinan seluruh dompet, transaksi, anggaran, target, dan aset/utang ke perangkat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void onExportBackup()}
            className="min-h-[44px] px-4 rounded-xl bg-mm-income text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Cadangan JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 rounded-xl bg-mm-elevated hover:bg-mm-hover border border-mm-border text-xs sm:text-sm font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Pulihkan dari JSON</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </div>
      </section>

      {/* Simulasi & Reset Data */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-mm-text">Data Simulasi &amp; Pembersihan</h2>
          <p className="text-xs text-mm-muted mt-0.5">
            Gunakan data simulasi untuk mencoba nominal seperti Rp9.500, Rp125.750, dan Rp1.250.000.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              await onLoadSampleData();
              setStatusMessage('Data simulasi MY MONEY berhasil dimuat.');
            }}
            className="min-h-[42px] px-4 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-brand cursor-pointer"
          >
            Muat Data Simulasi
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[42px] px-4 rounded-xl bg-mm-expense/15 hover:bg-mm-expense/25 border border-mm-expense/30 text-xs font-semibold text-mm-expense inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Semua Data</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onClearAllData();
                  setConfirmClear(false);
                  setStatusMessage('Seluruh data transaksi dan dompet telah dikosongkan.');
                }}
                className="min-h-[42px] px-4 rounded-xl bg-mm-expense text-xs font-semibold text-white cursor-pointer"
              >
                Ya, Kosongkan Sekarang
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[42px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-muted cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
