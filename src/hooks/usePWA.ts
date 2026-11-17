import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type UpdateCheckResult = 'available' | 'up-to-date' | 'offline' | 'unsupported';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let swRegistrationSingleton: ServiceWorkerRegistration | undefined;
let updateSWSingleton: ((reloadPage?: boolean) => Promise<void>) | undefined;
let swInitialized = false;
const waitingListeners = new Set<() => void>();

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);

  const userRequestedUpdateRef = useRef(false);
  const reloadingRef = useRef(false);

  const markUpdateAvailable = useCallback(() => {
    setNeedRefresh(true);
    setDismissed(false);
    setCheckFeedback(null);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    waitingListeners.add(markUpdateAvailable);

    const handleControllerChange = () => {
      if (!userRequestedUpdateRef.current || reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    if (!swInitialized) {
      swInitialized = true;

      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          waitingListeners.forEach((notify) => notify());
        },
        onOfflineReady() {
          // Aset sudah tersimpan untuk mode offline
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          swRegistrationSingleton = registration;

          if (registration.waiting) {
            waitingListeners.forEach((notify) => notify());
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                waitingListeners.forEach((notify) => notify());
              }
            });
          });

          // Periksa pembaruan saat registrasi pertama kali jika online
          if (navigator.onLine) {
            void registration.update().catch(() => {});
          }
        },
      });

      updateSWSingleton = updateSW;
    } else if (swRegistrationSingleton?.waiting) {
      markUpdateAvailable();
    }

    const triggerBackgroundCheck = () => {
      if (!navigator.onLine || !swRegistrationSingleton) return;
      void swRegistrationSingleton.update().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerBackgroundCheck();
      }
    };

    const handleOnline = () => {
      triggerBackgroundCheck();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    const intervalId = window.setInterval(triggerBackgroundCheck, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      waitingListeners.delete(markUpdateAvailable);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
    };
  }, [markUpdateAvailable]);

  const applyUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    userRequestedUpdateRef.current = true;

    try {
      const reg =
        swRegistrationSingleton ??
        ('serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined);

      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      if (updateSWSingleton) {
        await updateSWSingleton(true);
      } else if (!reg?.waiting) {
        window.location.reload();
      }
    } catch {
      userRequestedUpdateRef.current = false;
      setIsUpdating(false);
    }
  }, [isUpdating]);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!('serviceWorker' in navigator)) {
      setCheckFeedback('Browser ini tidak mendukung Service Worker.');
      return 'unsupported';
    }

    if (!navigator.onLine) {
      setCheckFeedback('Tidak dapat memeriksa pembaruan saat offline.');
      return 'offline';
    }

    setIsCheckingUpdate(true);
    setCheckFeedback(null);

    try {
      const reg = swRegistrationSingleton ?? (await navigator.serviceWorker.getRegistration());
      if (!reg) {
        setCheckFeedback('Service Worker aktif pada build produksi PWA.');
        return 'unsupported';
      }

      swRegistrationSingleton = reg;

      if (reg.waiting) {
        markUpdateAvailable();
        return 'available';
      }

      await reg.update();

      // Jika ada worker baru yang sedang menginstal, tunggu sebentar hingga selesai terinstal
      if (reg.installing) {
        await new Promise<void>((resolve) => {
          const worker = reg.installing;
          if (!worker) {
            resolve();
            return;
          }
          const timer = window.setTimeout(resolve, 4000);
          const onStateChange = () => {
            if (worker.state === 'installed' || worker.state === 'redundant') {
              window.clearTimeout(timer);
              worker.removeEventListener('statechange', onStateChange);
              resolve();
            }
          };
          worker.addEventListener('statechange', onStateChange);
        });
      }

      if (reg.waiting) {
        markUpdateAvailable();
        return 'available';
      }

      setCheckFeedback('Aplikasi sudah menggunakan versi terbaru.');
      return 'up-to-date';
    } catch {
      setCheckFeedback('Gagal memeriksa pembaruan. Coba lagi saat koneksi stabil.');
      return 'offline';
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [markUpdateAvailable]);

  return {
    needRefresh,
    dismissed,
    isUpdating,
    isCheckingUpdate,
    checkFeedback,
    applyUpdate,
    dismissUpdate,
    checkForUpdates,
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
