import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  Database,
  Download,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserCircle2,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import type { UpdateCheckResult } from '../hooks/usePWA';
import type {
  DateDisplayFormat,
  LocalAccount,
  SubView,
  ThemeColorTokens,
  ThemeConfig,
  ThemeMode,
  UserProfile,
} from '../types/finance';
import { isValidHexColor, normalizeHexColor } from '../utils/assetColors';
import { formatDateID, formatIDR } from '../utils/format';
import { compressAvatarImage, validateUsernameFormat } from '../utils/imageCompress';
import {
  DEFAULT_THEME_CONFIG,
  evaluateThemeContrast,
  getPresetById,
  isDarkColor,
  repairThemeContrast,
  THEME_COLOR_FIELDS,
  THEME_PRESETS,
} from '../utils/theme';

export type SettingsSectionId =
  | 'appearance'
  | 'profile'
  | 'security'
  | 'preferences'
  | 'data'
  | 'notifications'
  | 'about';

interface SettingsViewProps {
  initialSection?: SettingsSectionId;
  profile: UserProfile;
  onSaveProfile: (patch: {
    displayName: string;
    username: string;
    avatarDataUrl?: string | null;
    bio?: string;
  }) => Promise<UserProfile>;
  onRemoveAvatar: () => Promise<UserProfile>;
  activeAccount: LocalAccount | null;
  accounts: LocalAccount[];
  onOpenRegisterAccount: () => void;
  onLockApp: () => void;
  onLogoutAccount: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onUpdatePin: (newPin: string | null) => Promise<void>;
  onUpdateAutoLock: (minutes: number) => Promise<void>;
  onUnsavedStateChange?: (dirty: boolean) => void;
  counts: {
    wallets: number;
    transactions: number;
    budgets: number;
    goals: number;
    assetsDebts: number;
  };
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
  onNavigateSubView: (sub: SubView) => void;
}

const SETTINGS_TABS: Array<{
  id: SettingsSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'appearance', label: 'Tampilan & Tema', icon: Palette },
  { id: 'profile', label: 'Profil Saya', icon: UserCircle2 },
  { id: 'security', label: 'Keamanan', icon: Lock },
  { id: 'preferences', label: 'Preferensi', icon: Sliders },
  { id: 'data', label: 'Data & Penyimpanan', icon: Database },
  { id: 'notifications', label: 'Notifikasi', icon: Bell },
  { id: 'about', label: 'Tentang', icon: Info },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialSection = 'appearance',
  profile,
  onSaveProfile,
  onRemoveAvatar,
  activeAccount,
  accounts,
  onOpenRegisterAccount,
  onLockApp,
  onLogoutAccount,
  onChangePassword,
  onUpdatePin,
  onUpdateAutoLock,
  onUnsavedStateChange,
  counts,
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
  onNavigateSubView,
}) => {
  const {
    savedTheme,
    systemPrefersDark,
    setPreviewTheme,
    applyAndSaveTheme,
    resetThemeToDefault,
    preferences,
    updatePreferences,
  } = useTheme();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>(initialSection);

  // Draft theme state for Live Preview + explicit Apply / Reset
  const [draftTheme, setDraftTheme] = useState<ThemeConfig>(savedTheme);
  const [liveGlobalPreview, setLiveGlobalPreview] = useState<boolean>(true);
  const [hexTexts, setHexTexts] = useState<Record<keyof ThemeColorTokens, string>>(
    savedTheme.colors
  );
  const [themeBanner, setThemeBanner] = useState<string | null>(null);

  // Profile editor state (Tahap 2)
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileName, setProfileName] = useState<string>(profile.displayName);
  const [profileUsername, setProfileUsername] = useState<string>(profile.username);
  const [profileBio, setProfileBio] = useState<string>(profile.bio ?? '');
  const [profileAvatarDraft, setProfileAvatarDraft] = useState<string | null>(
    profile.avatarDataUrl
  );
  const [avatarMetaInfo, setAvatarMetaInfo] = useState<string | null>(null);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Security & local account state (Tahap 3)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secBusy, setSecBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Storage & data state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{
    usageMB: string;
    quotaMB: string;
  } | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Notification permission state
  const [notifStatus, setNotifStatus] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  // Sync activeSection when navigated from Dashboard Profile shortcut
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Sync profile form when persisted profile updates
  useEffect(() => {
    setProfileName(profile.displayName);
    setProfileUsername(profile.username);
    setProfileBio(profile.bio ?? '');
    setProfileAvatarDraft(profile.avatarDataUrl);
  }, [profile]);

  // Sync draft when savedTheme changes from outside (e.g., reset)
  useEffect(() => {
    setDraftTheme(savedTheme);
    setHexTexts(savedTheme.colors);
  }, [savedTheme]);

  // Push live global preview when enabled, revert automatically on unmount if unapplied
  useEffect(() => {
    if (liveGlobalPreview) {
      setPreviewTheme(draftTheme);
    } else {
      setPreviewTheme(null);
    }
  }, [draftTheme, liveGlobalPreview, setPreviewTheme]);

  useEffect(() => {
    return () => {
      setPreviewTheme(null);
    };
  }, [setPreviewTheme]);

  // Read storage estimate when Data tab opens
  useEffect(() => {
    if (activeSection !== 'data') return;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          const usage = est.usage ? (est.usage / (1024 * 1024)).toFixed(2) : '0.00';
          const quota = est.quota ? (est.quota / (1024 * 1024)).toFixed(0) : '-';
          setStorageEstimate({ usageMB: usage, quotaMB: quota });
        })
        .catch(() => setStorageEstimate(null));
    }
  }, [activeSection]);

  const hasInvalidHex = useMemo(
    () => Object.values(hexTexts).some((v) => !isValidHexColor(v)),
    [hexTexts]
  );

  const isDirty = useMemo(
    () =>
      draftTheme.mode !== savedTheme.mode ||
      draftTheme.presetId !== savedTheme.presetId ||
      JSON.stringify(draftTheme.colors) !== JSON.stringify(savedTheme.colors),
    [draftTheme, savedTheme]
  );

  const isProfileDirty = useMemo(
    () =>
      profileName !== profile.displayName ||
      profileUsername !== profile.username ||
      profileBio !== (profile.bio ?? '') ||
      profileAvatarDraft !== profile.avatarDataUrl,
    [profileName, profileUsername, profileBio, profileAvatarDraft, profile]
  );

  const hasAnyUnsaved = isDirty || isProfileDirty;

  useEffect(() => {
    onUnsavedStateChange?.(hasAnyUnsaved);
    return () => {
      onUnsavedStateChange?.(false);
    };
  }, [hasAnyUnsaved, onUnsavedStateChange]);

  const effectiveDraftColors = useMemo(() => {
    if (draftTheme.mode === 'system' && draftTheme.presetId !== 'custom') {
      const preset = getPresetById(draftTheme.presetId);
      if (preset && preset.baseMode === (systemPrefersDark ? 'dark' : 'light')) {
        return preset.colors;
      }
      return (systemPrefersDark ? THEME_PRESETS[0] : THEME_PRESETS[5]).colors;
    }
    return draftTheme.colors;
  }, [draftTheme, systemPrefersDark]);

  const contrastWarnings = useMemo(
    () => evaluateThemeContrast(effectiveDraftColors),
    [effectiveDraftColors]
  );

  const handleModeSelect = (nextMode: ThemeMode) => {
    setThemeBanner(null);
    if (nextMode === 'system') {
      setDraftTheme((prev) => ({
        ...prev,
        mode: 'system',
      }));
      return;
    }

    const currentIsDark = isDarkColor(draftTheme.colors.bgPrimary);
    if (nextMode === 'light' && currentIsDark) {
      const lightPreset = THEME_PRESETS[5]; // Minimal Light
      setDraftTheme({
        mode: 'light',
        presetId: lightPreset.id,
        colors: { ...lightPreset.colors },
        updatedAt: new Date().toISOString(),
      });
      setHexTexts({ ...lightPreset.colors });
      return;
    }

    if (nextMode === 'dark' && !currentIsDark) {
      const darkPreset = THEME_PRESETS[0]; // Midnight
      setDraftTheme({
        mode: 'dark',
        presetId: darkPreset.id,
        colors: { ...darkPreset.colors },
        updatedAt: new Date().toISOString(),
      });
      setHexTexts({ ...darkPreset.colors });
      return;
    }

    setDraftTheme((prev) => ({ ...prev, mode: nextMode }));
  };

  const handleSelectPreset = (presetId: Exclude<ThemeConfig['presetId'], 'custom'>) => {
    const preset = getPresetById(presetId);
    if (!preset) return;
    setThemeBanner(null);
    setDraftTheme({
      mode: preset.baseMode,
      presetId: preset.id,
      colors: { ...preset.colors },
      updatedAt: new Date().toISOString(),
    });
    setHexTexts({ ...preset.colors });
  };

  const handleColorPick = (key: keyof ThemeColorTokens, hexValue: string) => {
    const norm = normalizeHexColor(hexValue) ?? hexValue.toUpperCase();
    setThemeBanner(null);
    setHexTexts((prev) => ({ ...prev, [key]: norm }));
    if (isValidHexColor(norm)) {
      setDraftTheme((prev) => ({
        ...prev,
        mode: prev.mode === 'system' ? (isDarkColor(prev.colors.bgPrimary) ? 'dark' : 'light') : prev.mode,
        presetId: 'custom',
        colors: {
          ...prev.colors,
          [key]: norm,
        },
      }));
    }
  };

  const handleHexTextChange = (key: keyof ThemeColorTokens, rawValue: string) => {
    const cleaned = rawValue.slice(0, 7);
    setThemeBanner(null);
    setHexTexts((prev) => ({ ...prev, [key]: cleaned }));
    const norm = normalizeHexColor(cleaned);
    if (norm) {
      setDraftTheme((prev) => ({
        ...prev,
        mode: prev.mode === 'system' ? (isDarkColor(prev.colors.bgPrimary) ? 'dark' : 'light') : prev.mode,
        presetId: 'custom',
        colors: {
          ...prev.colors,
          [key]: norm,
        },
      }));
    }
  };

  const handleRepairContrast = () => {
    const fixed = repairThemeContrast(draftTheme.colors);
    setDraftTheme((prev) => ({
      ...prev,
      presetId: 'custom',
      colors: fixed,
    }));
    setHexTexts(fixed);
    setThemeBanner('Kontras teks & garis batas disesuaikan agar tetap nyaman dibaca.');
  };

  const handleApplyTheme = () => {
    if (hasInvalidHex) {
      setThemeBanner('Perbaiki kode warna HEX yang belum valid sebelum menerapkan tema.');
      return;
    }
    applyAndSaveTheme(draftTheme);
    setThemeBanner('Tema berhasil diterapkan dan disimpan di perangkat.');
  };

  const handleRevertPreview = () => {
    setDraftTheme(savedTheme);
    setHexTexts(savedTheme.colors);
    setThemeBanner('Perubahan pratinjau dibatalkan.');
  };

  const handleResetDefault = () => {
    resetThemeToDefault();
    setDraftTheme(DEFAULT_THEME_CONFIG);
    setHexTexts(DEFAULT_THEME_CONFIG.colors);
    setThemeBanner('Tema dikembalikan ke pengaturan default MY MONEY (Midnight).');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataMessage(null);
    setDataError(null);
    try {
      const text = await file.text();
      const summary = await onRestoreBackup(text);
      setDataMessage(
        `Berhasil memulihkan ${summary.wallets} dompet, ${summary.transactions} transaksi, ${summary.budgets} anggaran, dan ${summary.assetsDebts} aset/utang.`
      );
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Gagal memulihkan file JSON.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRequestNotification = async () => {
    setNotifMessage(null);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifStatus('unsupported');
      setNotifMessage('Peramban ini tidak mendukung Notification API.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === 'granted') {
        updatePreferences({ notificationsEnabled: true });
        new Notification('MY MONEY', {
          body: 'Notifikasi pengingat keuangan lokal aktif.',
          icon: '/icon.svg',
        });
        setNotifMessage('Izin notifikasi diberikan dan notifikasi uji coba telah dikirim.');
      } else {
        updatePreferences({ notificationsEnabled: false });
        setNotifMessage('Izin notifikasi belum diaktifkan di peramban Anda.');
      }
    } catch {
      setNotifMessage('Tidak dapat meminta izin notifikasi di lingkungan ini.');
    }
  };

  const usernameCheck = useMemo(() => {
    if (!profileUsername.trim()) return { valid: true, normalized: '' };
    return validateUsernameFormat(profileUsername);
  }, [profileUsername]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);
    setProfileSuccess(null);
    setIsCompressingAvatar(true);

    try {
      const compressed = await compressAvatarImage(file);
      const kb = Math.max(1, Math.round(compressed.approxBytes / 1024));
      setProfileAvatarDraft(compressed.dataUrl);
      setAvatarMetaInfo(`${compressed.width}×${compressed.height}px · ~${kb} KB`);

      if (profileName.trim() && usernameCheck.valid) {
        await onSaveProfile({
          displayName: profileName.trim(),
          username: profileUsername.trim(),
          avatarDataUrl: compressed.dataUrl,
          bio: profileBio,
        });
        setProfileSuccess(`Foto profil dikompresi (${kb} KB) dan disimpan secara offline.`);
      } else {
        setProfileSuccess(
          `Foto profil siap (${kb} KB). Lengkapi Nama Tampilan lalu klik "Simpan Profil".`
        );
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal memproses foto profil.');
    } finally {
      setIsCompressingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleDeleteAvatarClick = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    setAvatarMetaInfo(null);
    setProfileAvatarDraft(null);
    try {
      if (profile.avatarDataUrl) {
        await onRemoveAvatar();
        setProfileSuccess('Foto profil dihapus dan diganti kembali dengan avatar inisial.');
      } else {
        setProfileSuccess('Pratinjau foto dibersihkan.');
      }
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal menghapus foto profil.');
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim()) {
      setProfileError('Nama tampilan tidak boleh kosong.');
      return;
    }
    if (profileUsername.trim() && !usernameCheck.valid) {
      setProfileError(usernameCheck.error || 'Format username tidak valid.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const saved = await onSaveProfile({
        displayName: profileName.trim(),
        username: profileUsername.trim(),
        avatarDataUrl: profileAvatarDraft,
        bio: profileBio,
      });
      setProfileSuccess(
        `Profil "${saved.displayName}" berhasil disimpan di perangkat dan langsung aktif di Beranda.`
      );
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Gagal menyimpan profil pengguna.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);
    if (newPasswordInput !== confirmNewPasswordInput) {
      setSecError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setSecBusy(true);
    try {
      await onChangePassword(currentPasswordInput, newPasswordInput);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setSecSuccess('Password akun lokal berhasil diperbarui.');
    } catch (err) {
      setSecError(err instanceof Error ? err.message : 'Gagal mengubah password.');
    } finally {
      setSecBusy(false);
    }
  };

  const handleSavePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);
    setSecBusy(true);
    try {
      await onUpdatePin(pinInput);
      setPinInput('');
      setSecSuccess('PIN keamanan (4–6 digit) berhasil disimpan & dienkripsi hash PBKDF2.');
    } catch (err) {
      setSecError(err instanceof Error ? err.message : 'Gagal menyimpan PIN keamanan.');
    } finally {
      setSecBusy(false);
    }
  };

  const handleRemovePinClick = async () => {
    setSecError(null);
    setSecSuccess(null);
    setSecBusy(true);
    try {
      await onUpdatePin(null);
      setPinInput('');
      setSecSuccess('PIN keamanan dinonaktifkan. Anda tetap bisa membuka kunci dengan password.');
    } catch (err) {
      setSecError(err instanceof Error ? err.message : 'Gagal menonaktifkan PIN.');
    } finally {
      setSecBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Settings Center */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Pengaturan MY MONEY
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Kustomisasi tema global, preferensi tanggal, cadangan data, dan informasi aplikasi.
          </p>
        </div>

        {isDirty && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-mm-warning/15 border border-mm-warning/30 text-xs font-semibold text-mm-warning">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pratinjau Belum Disimpan</span>
          </span>
        )}
      </div>

      {/* Navigasi Tab Settings Responsif */}
      <div
        role="tablist"
        aria-label="Kategori Pengaturan"
        className="flex items-center gap-1.5 overflow-x-auto pb-1"
      >
        {SETTINGS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveSection(tab.id)}
              className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-mm-brand/15 border-mm-brand/40 text-mm-text'
                  : 'bg-mm-surface border-mm-border text-mm-muted hover:text-mm-text hover:bg-mm-hover'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: TAMPILAN & CUSTOM THEME */}
      {activeSection === 'appearance' && (
        <div className="space-y-5">
          {themeBanner && (
            <div className="rounded-xl bg-mm-success/15 border border-mm-success/30 px-4 py-3 text-xs text-mm-text flex items-center justify-between gap-3">
              <span>{themeBanner}</span>
              <button
                type="button"
                onClick={() => setThemeBanner(null)}
                className="font-semibold text-mm-muted hover:text-mm-text cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Mode Gelap / Terang / Sistem */}
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-mm-text">Mode Tampilan</h2>
                <p className="text-xs text-mm-muted">
                  Pilih tampilan gelap, terang, atau ikuti preferensi sistem perangkat (
                  {systemPrefersDark ? 'Saat ini: Gelap' : 'Saat ini: Terang'}).
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-mm-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveGlobalPreview}
                  onChange={(e) => setLiveGlobalPreview(e.target.checked)}
                  className="rounded accent-mm-brand"
                />
                <span>Pratinjau langsung seluruh aplikasi</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'dark',
                    label: 'Gelap (Dark)',
                    desc: 'Nyaman di ruangan minim cahaya',
                    icon: Moon,
                  },
                  {
                    id: 'light',
                    label: 'Terang (Light)',
                    desc: 'Bersih dan tegas di siang hari',
                    icon: Sun,
                  },
                  {
                    id: 'system',
                    label: 'Ikuti Sistem',
                    desc: `Otomatis (${systemPrefersDark ? 'Gelap' : 'Terang'})`,
                    icon: Monitor,
                  },
                ] as const
              ).map((m) => {
                const Icon = m.icon;
                const active = draftTheme.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeSelect(m.id)}
                    aria-pressed={active}
                    className={`rounded-xl border p-3.5 text-left transition-colors flex items-center gap-3 cursor-pointer ${
                      active
                        ? 'bg-mm-brand/15 border-mm-brand text-mm-text'
                        : 'bg-mm-bg border-mm-border text-mm-muted hover:text-mm-text hover:bg-mm-hover'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? 'bg-mm-brand text-mm-brand-fg' : 'bg-mm-surface text-mm-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-mm-text">{m.label}</p>
                      <p className="text-[11px] text-mm-muted truncate">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 6 Preset Tema */}
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-mm-text">Preset Tema Siap Pakai</h2>
              <p className="text-xs text-mm-muted">
                Pilih salah satu dari 6 preset profesional, lalu sesuaikan warnanya secara bebas jika diinginkan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = draftTheme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-mm-brand/15 border-mm-brand shadow-sm'
                        : 'bg-mm-bg border-mm-border hover:bg-mm-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-mm-text">{preset.name}</p>
                        <p className="text-[11px] text-mm-muted">{preset.description}</p>
                      </div>
                      {isSelected && (
                        <span className="w-6 h-6 rounded-full bg-mm-brand text-mm-brand-fg flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Mini Palet Preview Preset */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {[
                        preset.colors.bgPrimary,
                        preset.colors.surface,
                        preset.colors.primary,
                        preset.colors.secondary,
                        preset.colors.income,
                        preset.colors.expense,
                      ].map((swatch, idx) => (
                        <span
                          key={`${preset.id}-${idx}`}
                          className="h-4 flex-1 rounded border border-white/15"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Peringatan Kontras jika warna tidak mudah dibaca */}
          {contrastWarnings.length > 0 && (
            <section
              role="alert"
              className="rounded-2xl bg-mm-warning/15 border border-mm-warning/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-mm-warning shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-mm-text">Peringatan Keterbacaan Kontras</p>
                  <ul className="space-y-0.5 text-mm-muted">
                    {contrastWarnings.map((w) => (
                      <li key={w.id}>
                        {w.label} (rasio {w.ratio.toFixed(2)}:1, disarankan minimal {w.required}:1).
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRepairContrast}
                className="min-h-[38px] px-3.5 rounded-xl bg-mm-warning text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Perbaiki Kontras</span>
              </button>
            </section>
          )}

          {/* Live Preview Card Interaktif */}
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-mm-text">Live Preview Tampilan</h2>
                <p className="text-xs text-mm-muted">
                  Simulasi kartu, tombol, badge status, dan input dengan palet yang sedang dipilih.
                </p>
              </div>
              <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-lg bg-mm-bg border border-mm-border text-mm-muted">
                {draftTheme.presetId === 'custom'
                  ? 'Custom'
                  : getPresetById(draftTheme.presetId)?.name ?? 'Custom'}
              </span>
            </div>

            <div
              className="rounded-2xl p-4 sm:p-5 border space-y-4"
              style={{
                backgroundColor: effectiveDraftColors.bgPrimary,
                borderColor: effectiveDraftColors.border,
                color: effectiveDraftColors.textPrimary,
              }}
            >
              <div
                className="rounded-xl p-4 border flex flex-wrap items-center justify-between gap-3"
                style={{
                  backgroundColor: effectiveDraftColors.surface,
                  borderColor: effectiveDraftColors.border,
                }}
              >
                <div>
                  <p className="text-[11px]" style={{ color: effectiveDraftColors.textSecondary }}>
                    Contoh Total Saldo Dompet
                  </p>
                  <p className="text-xl font-extrabold font-mono-num">
                    {formatIDR(1250000)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 font-mono-num"
                    style={{
                      backgroundColor: `${effectiveDraftColors.income}22`,
                      color: effectiveDraftColors.income,
                    }}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    +{formatIDR(125750)}
                  </span>
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 font-mono-num"
                    style={{
                      backgroundColor: `${effectiveDraftColors.expense}22`,
                      color: effectiveDraftColors.expense,
                    }}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    -{formatIDR(9500)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    backgroundColor: effectiveDraftColors.primary,
                    color: isDarkColor(effectiveDraftColors.primary) ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Tombol Utama
                </span>
                <span
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    backgroundColor: effectiveDraftColors.secondary,
                    color: isDarkColor(effectiveDraftColors.secondary) ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Tombol Sekunder
                </span>
                <span
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{
                    backgroundColor: effectiveDraftColors.bgSecondary,
                    borderColor: effectiveDraftColors.accent,
                    color: effectiveDraftColors.accent,
                  }}
                >
                  Sorotan Accent
                </span>
                <span
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    backgroundColor: `${effectiveDraftColors.warning}22`,
                    color: effectiveDraftColors.warning,
                  }}
                >
                  Peringatan
                </span>
                <span
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{
                    backgroundColor: `${effectiveDraftColors.success}22`,
                    color: effectiveDraftColors.success,
                  }}
                >
                  Berhasil
                </span>
              </div>
            </div>
          </section>

          {/* 13 Pengaturan Warna Independen */}
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-mm-text">
                Kustomisasi 13 Elemen Warna Global
              </h2>
              <p className="text-xs text-mm-muted">
                Setiap elemen warna dapat diubah secara independen menggunakan color picker atau kode HEX manual (#RRGGBB).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {THEME_COLOR_FIELDS.map((field) => {
                const rawHex = hexTexts[field.key];
                const isValid = isValidHexColor(rawHex);
                const pickerColor = isValid
                  ? normalizeHexColor(rawHex) ?? draftTheme.colors[field.key]
                  : draftTheme.colors[field.key];

                return (
                  <div
                    key={field.key}
                    className="rounded-xl bg-mm-bg border border-mm-border p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="color"
                        value={pickerColor}
                        onChange={(e) => handleColorPick(field.key, e.target.value)}
                        aria-label={`Color picker ${field.label}`}
                        className="w-10 h-10 rounded-xl bg-transparent border border-mm-border p-0.5 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-mm-text truncate">
                          {field.label}
                        </p>
                        <p className="text-[11px] text-mm-muted truncate">{field.hint}</p>
                      </div>
                    </div>

                    <div className="w-28 shrink-0">
                      <input
                        type="text"
                        value={rawHex}
                        onChange={(e) => handleHexTextChange(field.key, e.target.value)}
                        maxLength={7}
                        spellCheck={false}
                        autoCapitalize="characters"
                        aria-label={`Kode HEX ${field.label}`}
                        className={`w-full min-h-[38px] px-2.5 rounded-lg bg-mm-surface border text-xs font-mono-num text-mm-text text-center focus:outline-none ${
                          isValid
                            ? 'border-mm-border focus:border-mm-brand'
                            : 'border-mm-expense text-mm-expense'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {hasInvalidHex && (
              <p role="alert" className="text-xs text-mm-expense">
                Ada kode HEX yang tidak valid. Gunakan format 6 digit diawali # (contoh: #1677FF).
              </p>
            )}

            {/* Tombol Terapkan, Batal, & Reset to Default */}
            <div className="pt-3 border-t border-mm-border flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetDefault}
                className="min-h-[42px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-muted hover:text-mm-text inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset ke Default</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleRevertPreview}
                    className="min-h-[42px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text cursor-pointer"
                  >
                    Batalkan Perubahan
                  </button>
                )}

                <button
                  type="button"
                  disabled={hasInvalidHex}
                  onClick={handleApplyTheme}
                  className="min-h-[44px] px-5 rounded-xl mm-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Terapkan Tema</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* SECTION 2: PROFIL SAYA (Tahap 2 — Profil, Foto Lokal, & Greeting Beranda) */}
      {activeSection === 'profile' && (
        <div className="space-y-4">
          {profileError && (
            <div
              role="alert"
              className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-4 py-3 text-xs text-mm-expense"
            >
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="rounded-xl bg-mm-success/15 border border-mm-success/30 px-4 py-3 text-xs text-mm-text">
              {profileSuccess}
            </div>
          )}

          {/* Live Greeting Preview */}
          <section className="rounded-2xl mm-hero-surface border border-mm-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <UserAvatar
                displayName={profileName}
                avatarDataUrl={profileAvatarDraft}
                size="xl"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium text-mm-muted uppercase tracking-wider">
                  Pratinjau Sapaan Beranda
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-mm-text truncate">
                  Selamat datang, {profileName.trim() || 'Pengguna MY MONEY'} 👋
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-mm-muted">
                  {profileUsername.trim() ? (
                    <span className="font-mono-num text-mm-brand font-semibold">
                      @{profileUsername.trim().toLowerCase()}
                    </span>
                  ) : (
                    <span>Username belum diatur</span>
                  )}
                  {profileBio.trim() && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-xs">{profileBio.trim()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isCompressingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="min-h-[40px] px-3.5 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-mm-brand" />
                <span>
                  {isCompressingAvatar
                    ? 'Memproses...'
                    : profileAvatarDraft
                      ? 'Ganti Foto'
                      : 'Unggah Foto'}
                </span>
              </button>

              {profileAvatarDraft && (
                <button
                  type="button"
                  onClick={() => void handleDeleteAvatarClick()}
                  className="min-h-[40px] px-3.5 rounded-xl bg-mm-expense/15 hover:bg-mm-expense/25 border border-mm-expense/30 text-xs font-semibold text-mm-expense inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Foto</span>
                </button>
              )}

              <input
                ref={avatarInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => void handleAvatarFileChange(e)}
                className="hidden"
              />
            </div>
          </section>

          {/* Form Edit Identitas Profil Lokal */}
          <form
            onSubmit={(e) => void handleSaveProfileSubmit(e)}
            className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-mm-text">Identitas Profil Pengguna</h2>
                <p className="text-xs text-mm-muted">
                  Tersimpan sepenuhnya offline di perangkat Anda (IndexedDB). Foto otomatis dipotong persegi &amp; dikompresi agar hemat penyimpanan.
                </p>
              </div>
              {avatarMetaInfo && (
                <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-lg bg-mm-bg border border-mm-border text-mm-muted">
                  {avatarMetaInfo}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Nama Tampilan <span className="text-mm-expense">*</span>
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value);
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  maxLength={60}
                  placeholder="Contoh: Budi Santoso"
                  required
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
                <p className="text-[11px] text-mm-muted mt-1">
                  Ditampilkan langsung di sapaan Beranda &amp; inisial avatar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Username Unik (Opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono-num text-mm-muted">
                    @
                  </span>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => {
                      setProfileUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                      setProfileError(null);
                      setProfileSuccess(null);
                    }}
                    maxLength={30}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="budi.santoso"
                    className={`w-full min-h-[44px] pl-8 pr-3.5 rounded-xl bg-mm-bg border text-sm font-mono-num text-mm-text focus:outline-none ${
                      profileUsername.trim() && !usernameCheck.valid
                        ? 'border-mm-expense focus:border-mm-expense'
                        : 'border-mm-border focus:border-mm-brand'
                    }`}
                  />
                </div>
                {profileUsername.trim() && !usernameCheck.valid ? (
                  <p className="text-[11px] text-mm-expense mt-1">{usernameCheck.error}</p>
                ) : (
                  <p className="text-[11px] text-mm-muted mt-1">
                    3–30 karakter huruf kecil, angka, titik (.), garis bawah (_), atau strip (-).
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">
                Catatan / Target Pribadi Singkat (Opsional)
              </label>
              <input
                type="text"
                value={profileBio}
                onChange={(e) => {
                  setProfileBio(e.target.value);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                maxLength={140}
                placeholder="Contoh: Fokus bangun dana darurat 6 bulan"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
              />
            </div>

            <div className="pt-2 border-t border-mm-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-mm-muted">
                Format foto didukung: JPG, JPEG, PNG, WEBP (maks. 10 MB sebelum kompresi).
              </p>

              <button
                type="submit"
                disabled={isSavingProfile}
                className="min-h-[44px] px-5 rounded-xl mm-btn-primary disabled:opacity-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 3: KEAMANAN & AKUN LOKAL (Tahap 3) */}
      {activeSection === 'security' && (
        <div className="space-y-4">
          {secError && (
            <div
              role="alert"
              className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-4 py-3 text-xs text-mm-expense"
            >
              {secError}
            </div>
          )}
          {secSuccess && (
            <div className="rounded-xl bg-mm-success/15 border border-mm-success/30 px-4 py-3 text-xs text-mm-text">
              {secSuccess}
            </div>
          )}

          {/* Status Akun Aktif atau Mode Lokal Bawaan */}
          {!activeAccount ? (
            <section className="rounded-2xl mm-hero-surface border border-mm-border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-mm-text">
                      Mode Lokal Bawaan (Tanpa Akun Terkunci)
                    </h2>
                    <p className="text-xs sm:text-sm text-mm-muted leading-relaxed">
                      Anda saat ini menggunakan MY MONEY secara langsung di perangkat ini. Buat akun lokal offline untuk melindungi data dengan password &amp; PIN serta memisahkan data jika ada pengguna lain di perangkat yang sama.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenRegisterAccount}
                  className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Buat Akun Lokal</span>
                </button>
              </div>
            </section>
          ) : (
            <>
              {/* Kartu Akun Aktif + Lock + Logout */}
              <section className="rounded-2xl mm-hero-surface border border-mm-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <UserAvatar
                    displayName={profile.displayName || activeAccount.displayName}
                    avatarDataUrl={profile.avatarDataUrl}
                    size="lg"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-mm-income/15 text-mm-income text-[10px] font-bold uppercase tracking-wider">
                      Akun Lokal Aktif
                    </span>
                    <h2 className="text-base sm:text-lg font-extrabold text-mm-text truncate">
                      {profile.displayName || activeAccount.displayName}
                    </h2>
                    <p className="text-xs font-mono-num text-mm-muted truncate">
                      @{activeAccount.username} · Data terisolasi di perangkat ini
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onLockApp}
                    className="min-h-[40px] px-3.5 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-mm-brand" />
                    <span>Kunci Aplikasi</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenRegisterAccount}
                    className="min-h-[40px] px-3.5 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-mm-income" />
                    <span>Tambah Akun</span>
                  </button>

                  {!confirmLogout ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (hasAnyUnsaved) {
                          setConfirmLogout(true);
                        } else {
                          onLogoutAccount();
                        }
                      }}
                      className="min-h-[40px] px-3.5 rounded-xl bg-mm-expense/15 hover:bg-mm-expense/25 border border-mm-expense/30 text-xs font-semibold text-mm-expense inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar / Ganti Akun</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-mm-warning/15 border border-mm-warning/35 p-2">
                      <span className="text-[11px] font-semibold text-mm-text px-1">
                        Ada perubahan belum disimpan. Tetap keluar?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmLogout(false);
                          onLogoutAccount();
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-mm-expense text-white text-xs font-semibold cursor-pointer"
                      >
                        Ya, Keluar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmLogout(false)}
                        className="min-h-[34px] px-2.5 rounded-lg bg-mm-surface border border-mm-border text-xs text-mm-text cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Pengaturan Password, PIN & Auto-Lock */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <form
                  onSubmit={(e) => void handlePasswordSubmit(e)}
                  className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3.5"
                >
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-mm-text">
                      Ubah Password Akun
                    </h3>
                    <p className="text-xs text-mm-muted">
                      Minimal 6 karakter. Password baru di-hash ulang dengan salt acak PBKDF2.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-mm-muted mb-1">
                      Password Saat Ini
                    </label>
                    <input
                      type="password"
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      required
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-mm-muted mb-1">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-mm-muted mb-1">
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                      required
                      className="w-full min-h-[42px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={secBusy}
                    className="min-h-[42px] px-4 rounded-xl mm-btn-primary disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Simpan Password Baru</span>
                  </button>
                </form>

                <div className="space-y-4">
                  <form
                    onSubmit={(e) => void handleSavePinSubmit(e)}
                    className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-mm-text">
                          PIN Keamanan Cepat (4–6 Digit)
                        </h3>
                        <p className="text-xs text-mm-muted">
                          Status:{' '}
                          <strong className="text-mm-text">
                            {activeAccount.pinHash ? 'Aktif' : 'Belum diaktifkan'}
                          </strong>
                        </p>
                      </div>
                      {activeAccount.pinHash && (
                        <button
                          type="button"
                          disabled={secBusy}
                          onClick={() => void handleRemovePinClick()}
                          className="min-h-[34px] px-3 rounded-lg bg-mm-expense/15 border border-mm-expense/30 text-xs font-semibold text-mm-expense cursor-pointer"
                        >
                          Nonaktifkan PIN
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-mm-muted mb-1">
                        {activeAccount.pinHash ? 'Ganti PIN Baru (4–6 angka)' : 'Atur PIN (4–6 angka)'}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        required
                        className="w-full min-h-[42px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-mono-num tracking-[0.35em] text-mm-text focus:outline-none focus:border-mm-brand"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={secBusy}
                      className="min-h-[42px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-mm-income" />
                      <span>{activeAccount.pinHash ? 'Perbarui PIN' : 'Aktifkan PIN'}</span>
                    </button>
                  </form>

                  <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-2.5">
                    <h3 className="text-sm sm:text-base font-bold text-mm-text">
                      Kunci Otomatis Saat Tidak Aktif (Auto-Lock)
                    </h3>
                    <select
                      value={activeAccount.autoLockMinutes}
                      onChange={(e) => void onUpdateAutoLock(Number(e.target.value))}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                    >
                      <option value={0}>Nonaktif (hanya kunci manual)</option>
                      <option value={1}>Setelah 1 menit tidak aktif</option>
                      <option value={5}>Setelah 5 menit tidak aktif</option>
                      <option value={15}>Setelah 15 menit tidak aktif</option>
                      <option value={30}>Setelah 30 menit tidak aktif</option>
                    </select>
                    <p className="text-[11px] text-mm-muted">
                      Mengunci layar aplikasi otomatis setelah jeda aktivitas untuk mencegah akses tanpa izin.
                    </p>
                  </section>
                </div>
              </div>

              {/* Daftar Akun Lokal di Perangkat */}
              {accounts.length > 0 && (
                <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-mm-text">
                      Akun Lokal Terdaftar di Perangkat ({accounts.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {accounts.map((acc) => {
                      const isCurrent = acc.id === activeAccount.id;
                      return (
                        <div
                          key={acc.id}
                          className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                            isCurrent
                              ? 'bg-mm-brand/10 border-mm-brand/40'
                              : 'bg-mm-bg border-mm-border'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar displayName={acc.displayName} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-mm-text truncate">
                                {acc.displayName}
                              </p>
                              <p className="text-[11px] font-mono-num text-mm-muted truncate">
                                @{acc.username}
                              </p>
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-mm-brand text-mm-brand-fg shrink-0">
                              Aktif
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={onLogoutAccount}
                              className="text-xs font-semibold text-mm-brand hover:underline shrink-0 cursor-pointer"
                            >
                              Masuk
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Penjelasan Transparan Batas Keamanan Penyimpanan Lokal */}
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-mm-income shrink-0" />
              <h3 className="text-sm sm:text-base font-bold text-mm-text">
                Transparansi Keamanan Penyimpanan Lokal
              </h3>
            </div>
            <ul className="text-xs text-mm-muted space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>
                MY MONEY berjalan <strong className="text-mm-text">100% offline</strong> di perangkat Anda; password dan PIN tidak pernah disimpan dalam bentuk teks biasa melainkan di-hash secara lokal menggunakan <strong className="text-mm-text">PBKDF2 SHA-256 (120.000 iterasi)</strong> dengan salt acak unik per akun.
              </li>
              <li>
                Data dompet, transaksi, anggaran, target, aset/utang, tema, warna jenis aset, serta foto profil diisolasi secara ketat berdasarkan ID akun masing-masing.
              </li>
              <li>
                <strong className="text-mm-text">Batas Keamanan Browser Lokal:</strong> Karena semua data berada di penyimpanan browser (IndexedDB &amp; Local Storage), menghapus data situs browser akan menghapus akun beserta datanya, dan pihak yang memiliki akses fisik penuh ke perangkat atau DevTools dalam keadaan terbuka tetap dapat memeriksa penyimpanan browser. Gunakan kunci layar perangkat Anda serta rutin lakukan <strong className="text-mm-text">Ekspor Cadangan JSON</strong>.
              </li>
            </ul>
          </section>
        </div>
      )}

      {/* SECTION 4: PREFERENSI APLIKASI */}
      {activeSection === 'preferences' && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-mm-text">Format Tanggal &amp; Anggaran</h2>
              <p className="text-xs text-mm-muted">
                Sesuaikan cara tanggal transaksi ditampilkan dan ambang peringatan anggaran bulanan.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Format Tampilan Tanggal
                </label>
                <select
                  value={preferences.dateFormat}
                  onChange={(e) =>
                    updatePreferences({ dateFormat: e.target.value as DateDisplayFormat })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  <option value="relative">Relatif (Hari Ini / Kemarin / 16 Nov 2026)</option>
                  <option value="short">Tanggal Pendek (16 Nov 2026)</option>
                  <option value="slash">Angka (16/11/2026)</option>
                  <option value="iso">Standar ISO (2026-11-16)</option>
                </select>
                <p className="text-[11px] text-mm-muted mt-1.5">
                  Contoh tampilan: <strong className="text-mm-text">{formatDateID('2026-11-16', preferences.dateFormat)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Ambang Peringatan Anggaran (%)
                </label>
                <select
                  value={preferences.budgetAlertThresholdPct}
                  onChange={(e) =>
                    updatePreferences({ budgetAlertThresholdPct: Number(e.target.value) })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                >
                  <option value={70}>70% (Peringatan lebih awal)</option>
                  <option value={80}>80% (Standar MY MONEY)</option>
                  <option value={90}>90% (Mendekati batas)</option>
                </select>
                <p className="text-[11px] text-mm-muted mt-1.5">
                  Menandai kategori anggaran yang mendekati batas bulanan.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-2">
            <h3 className="text-sm font-bold text-mm-text">Presisi Mata Uang Rupiah (IDR)</h3>
            <p className="text-xs text-mm-muted leading-relaxed">
              MY MONEY selalu mempertahankan nominal akurat tanpa pembulatan ke ribuan: contoh{' '}
              <span className="font-mono-num text-mm-text font-semibold">{formatIDR(9500)}</span>,{' '}
              <span className="font-mono-num text-mm-text font-semibold">{formatIDR(125750)}</span>, dan{' '}
              <span className="font-mono-num text-mm-text font-semibold">{formatIDR(1250000)}</span>.
            </p>
          </section>
        </div>
      )}

      {/* SECTION 5: DATA & PENYIMPANAN */}
      {activeSection === 'data' && (
        <div className="space-y-4">
          {dataMessage && (
            <div className="rounded-xl bg-mm-success/15 border border-mm-success/30 px-4 py-3 text-xs text-mm-text">
              {dataMessage}
            </div>
          )}
          {dataError && (
            <div className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-4 py-3 text-xs text-mm-expense">
              {dataError}
            </div>
          )}

          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-mm-text">Ringkasan Data Lokal</h2>
              <p className="text-xs text-mm-muted">
                Seluruh data tersimpan di IndexedDB &amp; Local Storage perangkat Anda secara offline.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {[
                { label: 'Dompet', value: counts.wallets },
                { label: 'Transaksi', value: counts.transactions },
                { label: 'Anggaran', value: counts.budgets },
                { label: 'Target', value: counts.goals },
                { label: 'Aset & Utang', value: counts.assetsDebts },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-mm-bg border border-mm-border p-3"
                >
                  <p className="text-[11px] text-mm-muted">{stat.label}</p>
                  <p className="mt-0.5 text-lg font-extrabold text-mm-text font-mono-num">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {storageEstimate && (
              <p className="text-xs text-mm-muted font-mono-num">
                Estimasi penyimpanan browser terpakai: {storageEstimate.usageMB} MB dari kuota{' '}
                {storageEstimate.quotaMB} MB.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-mm-text">Cadangan &amp; Pemulihan Data</h2>
              <p className="text-xs text-mm-muted">
                Ekspor seluruh data keuangan ke file JSON atau pulihkan dari file cadangan Anda.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void onExportBackup()}
                className="min-h-[42px] px-4 rounded-xl bg-mm-income text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Ekspor Cadangan JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[42px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Pulihkan dari JSON</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateSubView('data_pwa')}
                className="min-h-[42px] px-4 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-text cursor-pointer"
              >
                Buka Halaman Cadangan &amp; PWA
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => void handleRestoreFile(e)}
                className="hidden"
              />
            </div>

            <div className="pt-3 border-t border-mm-border flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  await onLoadSampleData();
                  setDataMessage('Data simulasi MY MONEY berhasil dimuat.');
                }}
                className="min-h-[40px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text cursor-pointer"
              >
                Muat Data Simulasi
              </button>

              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="min-h-[40px] px-4 rounded-xl bg-mm-expense/15 hover:bg-mm-expense/25 border border-mm-expense/30 text-xs font-semibold text-mm-expense inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Kosongkan Data Transaksi</span>
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearAllData();
                      setConfirmClear(false);
                      setDataMessage('Seluruh data transaksi, dompet, anggaran, dan target telah dikosongkan.');
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-mm-expense text-xs font-semibold text-white cursor-pointer"
                  >
                    Ya, Kosongkan Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[40px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-muted cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 6: NOTIFIKASI & PEMBARUAN */}
      {activeSection === 'notifications' && (
        <div className="space-y-4">
          {notifMessage && (
            <div className="rounded-xl bg-mm-brand/15 border border-mm-brand/30 px-4 py-3 text-xs text-mm-text">
              {notifMessage}
            </div>
          )}

          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-mm-text">Pengingat Harian &amp; Notifikasi Lokal</h2>
              <p className="text-xs text-mm-muted">
                Atur preferensi pengingat pencatatan transaksi tanpa ketergantungan server luar.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-xl bg-mm-bg border border-mm-border p-3.5 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-mm-text">Aktifkan Pengingat Harian</p>
                  <p className="text-xs text-mm-muted">Pengingat lokal untuk mencatat pengeluaran hari ini</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.dailyReminderEnabled}
                  onChange={(e) => updatePreferences({ dailyReminderEnabled: e.target.checked })}
                  className="w-4 h-4 accent-mm-brand"
                />
              </label>

              {preferences.dailyReminderEnabled && (
                <div className="rounded-xl bg-mm-bg border border-mm-border p-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-mm-text">Jam Pengingat Harian</span>
                  <input
                    type="time"
                    value={preferences.dailyReminderTime}
                    onChange={(e) => updatePreferences({ dailyReminderTime: e.target.value })}
                    className="min-h-[38px] px-3 rounded-lg bg-mm-surface border border-mm-border text-xs font-mono-num text-mm-text"
                  />
                </div>
              )}

              <div className="rounded-xl bg-mm-bg border border-mm-border p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-mm-text">Izin Notifikasi Browser</p>
                  <p className="text-[11px] text-mm-muted">
                    Status:{' '}
                    <strong className="text-mm-text">
                      {notifStatus === 'granted'
                        ? 'Diizinkan'
                        : notifStatus === 'denied'
                          ? 'Ditolak'
                          : notifStatus === 'unsupported'
                            ? 'Tidak didukung'
                            : 'Belum diminta'}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRequestNotification()}
                  className="min-h-[38px] px-3.5 rounded-xl bg-mm-brand/15 hover:bg-mm-brand/25 border border-mm-brand/30 text-xs font-semibold text-mm-text cursor-pointer"
                >
                  Aktifkan &amp; Uji Notifikasi
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-mm-brand/15 border border-mm-brand/30 flex items-center justify-center text-mm-brand shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-mm-text">Pembaruan Aplikasi (PWA)</h3>
                <p className="text-xs text-mm-muted">
                  Periksa pembaruan versi MY MONEY tanpa mereset data IndexedDB atau Local Storage.
                </p>
              </div>
            </div>

            {updateFeedback && (
              <div className="rounded-xl bg-mm-bg border border-mm-border px-3.5 py-2.5 text-xs text-mm-text">
                {updateFeedback}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={isCheckingUpdate}
                onClick={() => void onCheckUpdates()}
                className="min-h-[40px] px-4 rounded-xl bg-mm-bg hover:bg-mm-hover border border-mm-border text-xs font-semibold text-mm-text inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                <span>{isCheckingUpdate ? 'Memeriksa...' : 'Cek Pembaruan'}</span>
              </button>

              {needRefresh && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void onApplyUpdate()}
                  className="min-h-[40px] px-4 rounded-xl mm-btn-primary text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span>{isUpdating ? 'Memperbarui...' : 'Update Sekarang'}</span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* SECTION 7: TENTANG MY MONEY */}
      {activeSection === 'about' && (
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <img src="/icon.svg" alt="Logo MY MONEY" className="w-12 h-12 rounded-2xl shrink-0" />
            <div>
              <h2 className="text-lg font-extrabold text-mm-text">MY MONEY</h2>
              <p className="text-xs text-mm-muted">Take Control of Your Money · Personal Finance Manager</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="rounded-xl bg-mm-bg border border-mm-border p-3.5">
              <p className="text-mm-muted">Versi Aplikasi</p>
              <p className="mt-0.5 font-bold text-mm-text font-mono-num">2.0.0-stage1</p>
            </div>
            <div className="rounded-xl bg-mm-bg border border-mm-border p-3.5">
              <p className="text-mm-muted">Arsitektur Penyimpanan</p>
              <p className="mt-0.5 font-bold text-mm-text">Offline-First PWA (IndexedDB + Local Storage)</p>
            </div>
          </div>

          <p className="text-xs text-mm-muted leading-relaxed">
            MY MONEY dirancang untuk mengelola dompet, transaksi harian, anggaran 50/30/20, target tabungan, aset, utang, serta laporan keuangan secara akurat dalam Rupiah dan tetap bekerja penuh tanpa koneksi internet.
          </p>
        </section>
      )}
    </div>
  );
};
