import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl mm-btn-primary active:scale-[0.98] font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[38px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-4 py-2.5 text-sm w-full'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-mm-border bg-mm-elevated hover:bg-mm-hover text-mm-text font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'min-h-[38px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-4 py-2.5 text-sm w-full'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0 text-mm-brand" />
          <span>Install di iOS</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-mm-surface border border-mm-border p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-mm-text">Pasang MY MONEY di Layar Utama</h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-mm-muted hover:text-mm-text"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-mm-muted leading-relaxed">
                <li>
                  1. Ketuk tombol <strong className="text-mm-text">Bagikan (Share)</strong> pada bilah Safari.
                </li>
                <li>
                  2. Gulir ke bawah dan pilih{' '}
                  <strong className="text-mm-text">Tambahkan ke Layar Utama</strong>.
                </li>
                <li>
                  3. Ketuk <strong className="text-mm-text">Tambah</strong> untuk menggunakan aplikasi secara offline.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl mm-btn-primary text-sm font-semibold transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-mm-warning/15 border border-mm-warning/30 px-3.5 py-2.5 text-xs text-mm-text">
      <WifiOff className="w-4 h-4 text-mm-warning shrink-0" />
      <span>Mode Offline aktif — Seluruh data tetap tersimpan dan bekerja penuh secara lokal.</span>
    </div>
  );
};
