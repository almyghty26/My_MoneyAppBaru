import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { LocalAccount, UserProfile } from '../types/finance';
import { validatePasswordStrength, validatePinFormat } from '../utils/cryptoAuth';
import { validateUsernameFormat } from '../utils/imageCompress';
import { UserAvatar } from './UserAvatar';

export interface LegacyCountSummary {
  wallets: number;
  transactions: number;
  budgets: number;
  goals: number;
  assetsDebts: number;
  total: number;
}

interface AuthGateProps {
  variant: 'login_register' | 'locked' | 'modal_register';
  initialTab?: 'login' | 'register';
  accounts: LocalAccount[];
  lockedAccount?: LocalAccount | null;
  lockedAccountProfile?: UserProfile | null;
  legacyDataSummary?: LegacyCountSummary | null;
  prefillProfile?: UserProfile | null;
  onLoginPassword: (username: string, password: string) => Promise<void>;
  onLoginPin: (accountId: string, pin: string) => Promise<void>;
  onRegister: (params: {
    displayName: string;
    username: string;
    password: string;
    pin?: string;
    claimLegacyData: boolean;
  }) => Promise<void>;
  onUnlockPassword: (password: string) => Promise<void>;
  onUnlockPin: (pin: string) => Promise<void>;
  onSwitchAccountFromLock: () => void;
  onCloseModal?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  variant,
  initialTab = 'login',
  accounts,
  lockedAccount,
  lockedAccountProfile,
  legacyDataSummary,
  prefillProfile,
  onLoginPassword,
  onLoginPin,
  onRegister,
  onUnlockPassword,
  onUnlockPin,
  onSwitchAccountFromLock,
  onCloseModal,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(
    variant === 'modal_register' ? 'register' : initialTab
  );

  // Login form state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [loginUsername, setLoginUsername] = useState<string>(accounts[0]?.username ?? '');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'pin'>('password');
  const [showLoginPw, setShowLoginPw] = useState<boolean>(false);

  // Register form state
  const [regName, setRegName] = useState<string>(prefillProfile?.displayName ?? '');
  const [regUsername, setRegUsername] = useState<string>(prefillProfile?.username ?? '');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirm, setRegConfirm] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('');
  const [claimLegacy, setClaimLegacy] = useState<boolean>(
    Boolean(legacyDataSummary && legacyDataSummary.total > 0)
  );
  const [showRegPw, setShowRegPw] = useState<boolean>(false);

  // Lock screen state
  const [lockMethod, setLockMethod] = useState<'pin' | 'password'>(
    lockedAccount?.pinHash ? 'pin' : 'password'
  );
  const [unlockSecret, setUnlockSecret] = useState<string>('');
  const [showUnlockPw, setShowUnlockPw] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    if (variant === 'modal_register') {
      setTab('register');
    } else {
      setTab(initialTab);
    }
  }, [variant, initialTab]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
      setLoginUsername(accounts[0].username);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    setLockMethod(lockedAccount?.pinHash ? 'pin' : 'password');
    setUnlockSecret('');
    setErrorMsg(null);
  }, [lockedAccount]);

  const selectedLoginAccount = accounts.find(
    (a) => a.id === selectedAccountId || a.username === loginUsername.trim().toLowerCase()
  );

  const handleSelectAccountChip = (acc: LocalAccount) => {
    setSelectedAccountId(acc.id);
    setLoginUsername(acc.username);
    setLoginPassword('');
    setLoginPin('');
    setErrorMsg(null);
    if (!acc.pinHash) {
      setLoginMethod('password');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (loginMethod === 'pin' && selectedLoginAccount?.pinHash) {
        await onLoginPin(selectedLoginAccount.id, loginPin);
      } else {
        await onLoginPassword(loginUsername, loginPassword);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk ke akun lokal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regName.trim()) {
      setErrorMsg('Nama tampilan wajib diisi.');
      return;
    }
    const uCheck = validateUsernameFormat(regUsername);
    if (!uCheck.valid) {
      setErrorMsg(uCheck.error || 'Format username tidak valid.');
      return;
    }
    const pCheck = validatePasswordStrength(regPassword);
    if (!pCheck.valid) {
      setErrorMsg(pCheck.error || 'Password tidak valid.');
      return;
    }
    if (regPassword !== regConfirm) {
      setErrorMsg('Konfirmasi password tidak cocok.');
      return;
    }
    if (regPin.trim().length > 0) {
      const pinCheck = validatePinFormat(regPin);
      if (!pinCheck.valid) {
        setErrorMsg(pinCheck.error || 'Format PIN tidak valid.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onRegister({
        displayName: regName.trim(),
        username: uCheck.normalized,
        password: regPassword,
        pin: regPin.trim() || undefined,
        claimLegacyData: Boolean(legacyDataSummary && legacyDataSummary.total > 0 && claimLegacy),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mendaftarkan akun lokal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (lockMethod === 'pin' && lockedAccount?.pinHash) {
        await onUnlockPin(unlockSecret);
      } else {
        await onUnlockPassword(unlockSecret);
      }
      setUnlockSecret('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verifikasi kunci aplikasi gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== APP LOCK SCREEN ====================
  if (variant === 'locked' && lockedAccount) {
    return (
      <div className="fixed inset-0 z-50 bg-mm-bg/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-md rounded-2xl bg-mm-surface border border-mm-border p-6 shadow-2xl space-y-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <UserAvatar
              displayName={lockedAccountProfile?.displayName || lockedAccount.displayName}
              avatarDataUrl={lockedAccountProfile?.avatarDataUrl}
              size="lg"
            />
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-mm-brand/15 border border-mm-brand/30 text-[11px] font-semibold text-mm-brand mb-2">
                <Lock className="w-3.5 h-3.5" />
                <span>MY MONEY Terkunci</span>
              </span>
              <h1 className="text-lg font-extrabold text-mm-text">
                {lockedAccountProfile?.displayName || lockedAccount.displayName}
              </h1>
              <p className="text-xs font-mono-num text-mm-muted">@{lockedAccount.username}</p>
            </div>
          </div>

          {lockedAccount.pinHash && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-mm-bg border border-mm-border">
              <button
                type="button"
                onClick={() => {
                  setLockMethod('pin');
                  setUnlockSecret('');
                  setErrorMsg(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  lockMethod === 'pin'
                    ? 'bg-mm-surface text-mm-text border border-mm-border'
                    : 'text-mm-muted hover:text-mm-text'
                }`}
              >
                Buka dengan PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setLockMethod('password');
                  setUnlockSecret('');
                  setErrorMsg(null);
                }}
                className={`min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  lockMethod === 'password'
                    ? 'bg-mm-surface text-mm-text border border-mm-border'
                    : 'text-mm-muted hover:text-mm-text'
                }`}
              >
                Buka dengan Password
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2.5 text-xs text-mm-expense"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={(e) => void handleUnlockSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">
                {lockMethod === 'pin' ? 'Masukkan PIN Keamanan (4–6 digit)' : 'Masukkan Password Akun'}
              </label>
              <div className="relative">
                <input
                  type={lockMethod === 'pin' ? 'password' : showUnlockPw ? 'text' : 'password'}
                  inputMode={lockMethod === 'pin' ? 'numeric' : 'text'}
                  maxLength={lockMethod === 'pin' ? 6 : 128}
                  value={unlockSecret}
                  onChange={(e) =>
                    setUnlockSecret(
                      lockMethod === 'pin' ? e.target.value.replace(/\D/g, '') : e.target.value
                    )
                  }
                  placeholder={lockMethod === 'pin' ? '••••' : 'Password Anda'}
                  autoFocus
                  className={`w-full min-h-[46px] px-4 pr-11 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand ${
                    lockMethod === 'pin' ? 'text-center font-mono-num tracking-[0.4em] text-base' : ''
                  }`}
                />
                {lockMethod === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowUnlockPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mm-muted hover:text-mm-text cursor-pointer"
                    aria-label="Tampilkan atau sembunyikan password"
                  >
                    {showUnlockPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !unlockSecret}
              className="w-full min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-50 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{submitting ? 'Memverifikasi...' : 'Buka Kunci'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-mm-border text-center">
            <button
              type="button"
              onClick={onSwitchAccountFromLock}
              className="text-xs font-semibold text-mm-muted hover:text-mm-text cursor-pointer"
            >
              Keluar &amp; Ganti Akun Lokal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== LOGIN / REGISTER SCREEN OR MODAL ====================
  const isModal = variant === 'modal_register';

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto'
          : 'min-h-screen bg-mm-bg text-mm-text flex items-center justify-center p-4 sm:p-6'
      }
    >
      <div
        className={`w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-mm-surface border border-mm-border p-5 sm:p-6 shadow-2xl space-y-5 ${
          isModal ? 'max-h-[92vh] overflow-y-auto' : ''
        }`}
      >
        {/* Header Brand */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="MY MONEY" className="w-10 h-10 rounded-xl shrink-0" />
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-mm-text">MY MONEY</h1>
              <p className="text-xs text-mm-muted">
                {isModal
                  ? 'Buat Akun Lokal Offline Baru'
                  : 'Masuk atau buat akun lokal offline di perangkat Anda'}
              </p>
            </div>
          </div>

          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="min-h-[40px] min-w-[40px] rounded-xl text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Switcher (only when login is available) */}
        {!isModal && accounts.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-mm-bg border border-mm-border">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                tab === 'login'
                  ? 'bg-mm-surface text-mm-text border border-mm-border'
                  : 'text-mm-muted hover:text-mm-text'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk ({accounts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMsg(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                tab === 'register'
                  ? 'bg-mm-surface text-mm-text border border-mm-border'
                  : 'text-mm-muted hover:text-mm-text'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Buat Akun Baru</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-3.5 py-2.5 text-xs text-mm-expense"
          >
            {errorMsg}
          </div>
        )}

        {/* TAB: LOGIN */}
        {tab === 'login' && !isModal && (
          <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-4">
            {accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-mm-muted">Akun Tersedia di Perangkat Ini</p>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((acc) => {
                    const selected =
                      acc.username.toLowerCase() === loginUsername.trim().toLowerCase();
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccountChip(acc)}
                        className={`px-3 py-2 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                          selected
                            ? 'bg-mm-brand/15 border-mm-brand text-mm-text'
                            : 'bg-mm-bg border-mm-border text-mm-muted hover:text-mm-text hover:bg-mm-hover'
                        }`}
                      >
                        <UserAvatar displayName={acc.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-mm-text truncate max-w-[120px]">
                            {acc.displayName}
                          </p>
                          <p className="text-[11px] font-mono-num text-mm-muted">@{acc.username}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono-num text-mm-muted">
                  @
                </span>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) =>
                    setLoginUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                  }
                  placeholder="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="w-full min-h-[44px] pl-8 pr-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>
            </div>

            {selectedLoginAccount?.pinHash && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-mm-muted">Metode verifikasi:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod((m) => (m === 'password' ? 'pin' : 'password'));
                    setErrorMsg(null);
                  }}
                  className="font-semibold text-mm-brand hover:underline cursor-pointer"
                >
                  {loginMethod === 'password' ? 'Gunakan PIN Cepat' : 'Gunakan Password'}
                </button>
              </div>
            )}

            {loginMethod === 'pin' && selectedLoginAccount?.pinHash ? (
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  PIN Keamanan (4–6 digit)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  required
                  className="w-full min-h-[44px] px-4 rounded-xl bg-mm-bg border border-mm-border text-center font-mono-num tracking-[0.4em] text-base text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password akun"
                    required
                    className="w-full min-h-[44px] px-3.5 pr-11 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mm-muted hover:text-mm-text cursor-pointer"
                    aria-label="Tampilkan password"
                  >
                    {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-50 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'Memverifikasi...' : 'Masuk Offline'}</span>
            </button>
          </form>
        )}

        {/* TAB: REGISTER */}
        {(tab === 'register' || isModal) && (
          <form onSubmit={(e) => void handleRegisterSubmit(e)} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Nama Tampilan <span className="text-mm-expense">*</span>
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  maxLength={60}
                  placeholder="Contoh: Budi Santoso"
                  required
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Username Unik <span className="text-mm-expense">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono-num text-mm-muted">
                    @
                  </span>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) =>
                      setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                    }
                    maxLength={30}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="budi.santoso"
                    required
                    className="w-full min-h-[44px] pl-8 pr-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Password (min. 6 karakter) <span className="text-mm-expense">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPw ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    className="w-full min-h-[44px] px-3.5 pr-10 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mm-muted hover:text-mm-text cursor-pointer"
                    aria-label="Tampilkan password"
                  >
                    {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-mm-muted mb-1.5">
                  Konfirmasi Password <span className="text-mm-expense">*</span>
                </label>
                <input
                  type={showRegPw ? 'text' : 'password'}
                  value={regConfirm}
                  onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder="Ulangi password"
                  required
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-mm-muted mb-1.5">
                PIN Keamanan Cepat (Opsional, 4–6 digit angka)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Kosongkan jika tidak perlu PIN"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-mm-bg border border-mm-border text-sm font-mono-num text-mm-text focus:outline-none focus:border-mm-brand"
              />
            </div>

            {legacyDataSummary && legacyDataSummary.total > 0 && (
              <label className="rounded-xl bg-mm-brand/10 border border-mm-brand/30 p-3.5 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={claimLegacy}
                  onChange={(e) => setClaimLegacy(e.target.checked)}
                  className="mt-0.5 rounded accent-mm-brand"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-mm-text">
                    Hubungkan data keuangan lokal saat ini ke akun baru ini
                  </p>
                  <p className="text-mm-muted">
                    Mencakup {legacyDataSummary.wallets} dompet, {legacyDataSummary.transactions}{' '}
                    transaksi, {legacyDataSummary.budgets} anggaran, {legacyDataSummary.goals}{' '}
                    target, &amp; {legacyDataSummary.assetsDebts} aset/utang tanpa menghapus apa pun.
                  </p>
                </div>
              </label>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[46px] rounded-xl mm-btn-primary disabled:opacity-50 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{submitting ? 'Membuat Akun...' : 'Buat Akun Lokal & Masuk'}</span>
            </button>
          </form>
        )}

        {/* Transparent Security & Offline Notice */}
        <div className="rounded-xl bg-mm-bg border border-mm-border p-3 flex items-start gap-2.5 text-[11px] text-mm-muted leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-mm-income shrink-0 mt-0.5" />
          <p>
            Password dan PIN di-hash secara lokal dengan <strong className="text-mm-text">PBKDF2 SHA-256</strong> di browser Anda. Tidak ada data yang dikirim ke server mana pun; seluruh data akun terisolasi per profil di perangkat ini.
          </p>
        </div>
      </div>
    </div>
  );
};
