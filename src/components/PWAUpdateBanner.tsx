import React from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

interface PWAUpdateBannerProps {
  visible: boolean;
  isUpdating: boolean;
  onUpdateNow: () => void | Promise<void>;
  onDismiss: () => void;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({
  visible,
  isUpdating,
  onUpdateNow,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Notifikasi pembaruan aplikasi"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 lg:bottom-6 sm:w-[380px] z-40 rounded-2xl bg-mm-surface/95 backdrop-blur-md border border-mm-brand/40 p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center shrink-0 text-mm-brand">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-mm-text leading-snug">
              Pembaruan MY MONEY tersedia
            </h3>
            {!isUpdating && (
              <button
                type="button"
                onClick={onDismiss}
                className="-mt-1 -mr-1 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-mm-muted hover:text-mm-text hover:bg-mm-hover transition-colors cursor-pointer shrink-0"
                aria-label="Tutup notifikasi pembaruan"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-xs text-mm-muted mt-1 leading-relaxed">
            Versi terbaru siap diterapkan tanpa menghapus data transaksi atau dompet Anda.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => void onUpdateNow()}
              className="flex-1 min-h-[40px] px-3.5 rounded-xl mm-btn-primary disabled:opacity-70 disabled:cursor-not-allowed text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>{isUpdating ? 'Memperbarui...' : 'Update Sekarang'}</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={onDismiss}
              className="min-h-[40px] px-3.5 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border disabled:opacity-50 text-xs font-medium text-mm-text whitespace-nowrap transition-colors cursor-pointer"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
