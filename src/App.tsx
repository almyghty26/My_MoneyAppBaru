import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Database,
  Home,
  Landmark,
  Lock,
  Menu,
  PiggyBank,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Wallet as WalletIcon,
} from 'lucide-react';
import { AuthGate, type LegacyCountSummary } from './components/AuthGate';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { TransactionModal } from './components/TransactionModal';
import { UserAvatar } from './components/UserAvatar';
import { useTheme } from './contexts/ThemeContext';
import {
  DEFAULT_ACCOUNT_ID,
  addGoalContribution,
  authenticateLocalAccount,
  clearAllData,
  copyBudgetsFromPreviousMonth,
  countLegacyUnclaimedData,
  createDefaultUserProfile,
  deleteAssetDebt,
  deleteBudgetItem,
  deleteGoal,
  deleteTransaction,
  deleteWallet,
  exportBackupJSON,
  getAllCategories,
  listLocalAccounts,
  loadAllData,
  loadLocalSession,
  loadSampleSimulationData,
  loadUserProfile,
  registerLocalAccount,
  removeUserAvatar,
  restoreBackupJSON,
  saveAssetDebt,
  saveBudgetItem,
  saveGoal,
  saveLocalSession,
  saveTransaction,
  saveUserProfile,
  saveWallet,
  updateAccountAutoLock,
  updateAccountPassword,
  updateAccountPin,
  verifyAccountPassword,
  verifyAccountPin,
  type FullAppState,
} from './db/indexedDb';
import { usePWAUpdate } from './hooks/usePWA';
import type {
  LocalAccount,
  LocalAuthSession,
  NavTab,
  SubView,
  Transaction,
  UserProfile,
} from './types/finance';
import { getCurrentMonthISO } from './utils/format';
import { DashboardView } from './views/DashboardView';
import type { SettingsSectionId } from './views/SettingsView';

const TransactionsView = lazy(() =>
  import('./views/TransactionsView').then((m) => ({ default: m.TransactionsView }))
);
const BudgetsView = lazy(() =>
  import('./views/BudgetsView').then((m) => ({ default: m.BudgetsView }))
);
const WalletsView = lazy(() =>
  import('./views/WalletsView').then((m) => ({ default: m.WalletsView }))
);
const GoalsView = lazy(() =>
  import('./views/GoalsView').then((m) => ({ default: m.GoalsView }))
);
const AssetsDebtsView = lazy(() =>
  import('./views/AssetsDebtsView').then((m) => ({ default: m.AssetsDebtsView }))
);
const ReportsView = lazy(() =>
  import('./views/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const HealthScoreView = lazy(() =>
  import('./views/HealthScoreView').then((m) => ({ default: m.HealthScoreView }))
);
const MoreMenuView = lazy(() =>
  import('./views/MoreAndDataView').then((m) => ({ default: m.MoreMenuView }))
);
const DataPWAView = lazy(() =>
  import('./views/MoreAndDataView').then((m) => ({ default: m.DataPWAView }))
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const INITIAL_STATE: FullAppState = {
  wallets: [],
  transactions: [],
  budgets: [],
  goals: [],
  assetsDebts: [],
  customCategories: [],
};

const DESKTOP_NAV: Array<{
  id: string;
  label: string;
  tab: NavTab;
  sub?: SubView;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'beranda', label: 'Beranda', tab: 'beranda', icon: Home },
  { id: 'transaksi', label: 'Transaksi', tab: 'transaksi', icon: ArrowLeftRight },
  { id: 'anggaran', label: 'Anggaran', tab: 'anggaran', icon: PiggyBank },
  { id: 'dompet', label: 'Dompet & Rekening', tab: 'lainnya', sub: 'dompet', icon: WalletIcon },
  { id: 'target', label: 'Target Keuangan', tab: 'lainnya', sub: 'target', icon: Target },
  { id: 'aset_utang', label: 'Aset & Utang', tab: 'lainnya', sub: 'aset_utang', icon: Landmark },
  { id: 'laporan', label: 'Laporan & Grafik', tab: 'lainnya', sub: 'laporan', icon: BarChart3 },
  { id: 'kesehatan', label: 'Kesehatan Finansial', tab: 'lainnya', sub: 'kesehatan', icon: ShieldCheck },
  { id: 'data_pwa', label: 'Cadangan & PWA', tab: 'lainnya', sub: 'data_pwa', icon: Database },
  { id: 'pengaturan', label: 'Pengaturan & Tema', tab: 'lainnya', sub: 'pengaturan', icon: Settings },
];

export default function App() {
  const { setAccountScope } = useTheme();
  const {
    needRefresh,
    dismissed,
    isUpdating,
    isCheckingUpdate,
    checkFeedback,
    applyUpdate,
    dismissUpdate,
    checkForUpdates,
  } = usePWAUpdate();

  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [session, setSession] = useState<LocalAuthSession>(() => loadLocalSession());
  const [state, setState] = useState<FullAppState>(INITIAL_STATE);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => createDefaultUserProfile());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthISO());
  const [activeTab, setActiveTab] = useState<NavTab>('beranda');
  const [subView, setSubView] = useState<SubView>('menu');
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('appearance');

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [legacySummary, setLegacySummary] = useState<LegacyCountSummary | null>(null);
  const [settingsUnsaved, setSettingsUnsaved] = useState(false);
  const lastActivityBumpRef = useRef<number>(0);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === session.activeAccountId) ?? null,
    [accounts, session.activeAccountId]
  );

  // When no local accounts exist yet, run seamlessly in 'local_default' mode.
  // Once >= 1 local account is registered, require explicit activeAccount session.
  const effectiveAccountId: string | null = useMemo(() => {
    if (accounts.length === 0) return DEFAULT_ACCOUNT_ID;
    return activeAccount ? activeAccount.id : null;
  }, [accounts.length, activeAccount]);

  const categories = useMemo(
    () => getAllCategories(state.customCategories),
    [state.customCategories]
  );

  const loadAccountWorkspace = useCallback(
    async (accountId: string) => {
      setAccountScope(accountId);
      const [loaded, profile] = await Promise.all([
        loadAllData(accountId),
        loadUserProfile(accountId),
      ]);
      setState(loaded);
      setUserProfile(profile);
    },
    [setAccountScope]
  );

  const refreshActiveData = useCallback(async () => {
    if (!effectiveAccountId) return;
    try {
      await loadAccountWorkspace(effectiveAccountId);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membaca database lokal.');
    }
  }, [effectiveAccountId, loadAccountWorkspace]);

  // Initial bootstrap: read accounts, check session & inactivity auto-lock, load workspace
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [accList, currentSession, legacyCounts] = await Promise.all([
          listLocalAccounts(),
          Promise.resolve(loadLocalSession()),
          countLegacyUnclaimedData(),
        ]);
        if (!active) return;
        setAccounts(accList);
        setLegacySummary(legacyCounts);

        if (accList.length === 0) {
          await loadAccountWorkspace(DEFAULT_ACCOUNT_ID);
        } else {
          const matched = accList.find((a) => a.id === currentSession.activeAccountId) ?? null;
          if (matched) {
            const timeoutMs =
              matched.autoLockMinutes > 0 ? matched.autoLockMinutes * 60_000 : 0;
            const expired =
              timeoutMs > 0 && Date.now() - currentSession.lastActiveAt >= timeoutMs;
            const nextSession: LocalAuthSession = {
              activeAccountId: matched.id,
              locked: currentSession.locked || expired,
              lastActiveAt: Date.now(),
            };
            saveLocalSession(nextSession);
            setSession(nextSession);
            await loadAccountWorkspace(matched.id);
          } else {
            const clearedSession: LocalAuthSession = {
              activeAccountId: null,
              locked: false,
              lastActiveAt: Date.now(),
            };
            saveLocalSession(clearedSession);
            setSession(clearedSession);
            setAccountScope(DEFAULT_ACCOUNT_ID);
          }
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat aplikasi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadAccountWorkspace, setAccountScope]);

  // Auto-lock inactivity monitor when logged into a local account with autoLockMinutes > 0
  useEffect(() => {
    if (!activeAccount || activeAccount.autoLockMinutes <= 0 || session.locked) {
      return;
    }

    const timeoutMs = activeAccount.autoLockMinutes * 60_000;
    let timerId = window.setTimeout(() => {
      setSession((prev) => {
        const lockedSession: LocalAuthSession = { ...prev, locked: true };
        saveLocalSession(lockedSession);
        return lockedSession;
      });
    }, timeoutMs);

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityBumpRef.current < 4000) return;
      lastActivityBumpRef.current = now;
      window.clearTimeout(timerId);
      setSession((prev) => {
        if (prev.locked) return prev;
        const next: LocalAuthSession = { ...prev, lastActiveAt: now };
        saveLocalSession(next);
        return next;
      });
      timerId = window.setTimeout(() => {
        setSession((prev) => {
          const lockedSession: LocalAuthSession = { ...prev, locked: true };
          saveLocalSession(lockedSession);
          return lockedSession;
        });
      }, timeoutMs);
    };

    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [activeAccount, session.locked]);

  const navigateTab = useCallback((tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'lainnya') {
      setSubView('menu');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateSubView = useCallback((sub: SubView) => {
    if (sub === 'pengaturan') {
      setSettingsSection('appearance');
    }
    setActiveTab('lainnya');
    setSubView(sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToSettings = useCallback((section: SettingsSectionId = 'appearance') => {
    setSettingsSection(section);
    setActiveTab('lainnya');
    setSubView('pengaturan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openNewTransaction = useCallback(() => {
    setEditingTx(null);
    setTxModalOpen(true);
  }, []);

  const openEditTransaction = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setTxModalOpen(true);
  }, []);

  const handleOpenRegisterModal = useCallback(async () => {
    const counts = await countLegacyUnclaimedData();
    setLegacySummary(counts);
    setRegisterModalOpen(true);
  }, []);

  const handleLoginPassword = useCallback(
    async (username: string, password: string) => {
      const acc = await authenticateLocalAccount(username, password);
      const list = await listLocalAccounts();
      setAccounts(list);
      const nextSession: LocalAuthSession = {
        activeAccountId: acc.id,
        locked: false,
        lastActiveAt: Date.now(),
      };
      saveLocalSession(nextSession);
      setSession(nextSession);
      setActiveTab('beranda');
      await loadAccountWorkspace(acc.id);
    },
    [loadAccountWorkspace]
  );

  const handleLoginPin = useCallback(
    async (accountId: string, pin: string) => {
      const acc = await verifyAccountPin(accountId, pin);
      const list = await listLocalAccounts();
      setAccounts(list);
      const nextSession: LocalAuthSession = {
        activeAccountId: acc.id,
        locked: false,
        lastActiveAt: Date.now(),
      };
      saveLocalSession(nextSession);
      setSession(nextSession);
      setActiveTab('beranda');
      await loadAccountWorkspace(acc.id);
    },
    [loadAccountWorkspace]
  );

  const handleRegisterAccount = useCallback(
    async (params: {
      displayName: string;
      username: string;
      password: string;
      pin?: string;
      claimLegacyData: boolean;
    }) => {
      const { account } = await registerLocalAccount(params);
      const [list, legacyCounts] = await Promise.all([
        listLocalAccounts(),
        countLegacyUnclaimedData(),
      ]);
      setAccounts(list);
      setLegacySummary(legacyCounts);
      const nextSession: LocalAuthSession = {
        activeAccountId: account.id,
        locked: false,
        lastActiveAt: Date.now(),
      };
      saveLocalSession(nextSession);
      setSession(nextSession);
      setRegisterModalOpen(false);
      setActiveTab('beranda');
      await loadAccountWorkspace(account.id);
    },
    [loadAccountWorkspace]
  );

  const handleLockApp = useCallback(() => {
    if (!activeAccount) return;
    const nextSession: LocalAuthSession = {
      activeAccountId: activeAccount.id,
      locked: true,
      lastActiveAt: Date.now(),
    };
    saveLocalSession(nextSession);
    setSession(nextSession);
  }, [activeAccount]);

  const handleUnlockPassword = useCallback(
    async (password: string) => {
      if (!activeAccount) return;
      await verifyAccountPassword(activeAccount.id, password);
      const nextSession: LocalAuthSession = {
        activeAccountId: activeAccount.id,
        locked: false,
        lastActiveAt: Date.now(),
      };
      saveLocalSession(nextSession);
      setSession(nextSession);
    },
    [activeAccount]
  );

  const handleUnlockPin = useCallback(
    async (pin: string) => {
      if (!activeAccount) return;
      await verifyAccountPin(activeAccount.id, pin);
      const nextSession: LocalAuthSession = {
        activeAccountId: activeAccount.id,
        locked: false,
        lastActiveAt: Date.now(),
      };
      saveLocalSession(nextSession);
      setSession(nextSession);
    },
    [activeAccount]
  );

  const handleLogoutAccount = useCallback(() => {
    const nextSession: LocalAuthSession = {
      activeAccountId: null,
      locked: false,
      lastActiveAt: Date.now(),
    };
    saveLocalSession(nextSession);
    setSession(nextSession);
    setState(INITIAL_STATE);
    setUserProfile(createDefaultUserProfile());
    setSettingsUnsaved(false);
    setTxModalOpen(false);
    setErrorMsg(null);
  }, []);

  const handleSaveProfile = useCallback(
    async (patch: {
      displayName: string;
      username: string;
      avatarDataUrl?: string | null;
      bio?: string;
    }) => {
      const targetId = effectiveAccountId ?? DEFAULT_ACCOUNT_ID;
      const saved = await saveUserProfile(patch, targetId);
      setUserProfile(saved);
      const updatedAccounts = await listLocalAccounts();
      setAccounts(updatedAccounts);
      return saved;
    },
    [effectiveAccountId]
  );

  const handleRemoveAvatar = useCallback(async () => {
    const targetId = effectiveAccountId ?? DEFAULT_ACCOUNT_ID;
    const updated = await removeUserAvatar(targetId);
    setUserProfile(updated);
    return updated;
  }, [effectiveAccountId]);

  const handleChangePassword = useCallback(
    async (currentPw: string, newPw: string) => {
      if (!activeAccount) throw new Error('Belum ada akun lokal yang aktif.');
      const updated = await updateAccountPassword(activeAccount.id, currentPw, newPw);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    },
    [activeAccount]
  );

  const handleUpdatePin = useCallback(
    async (newPin: string | null) => {
      if (!activeAccount) throw new Error('Belum ada akun lokal yang aktif.');
      const updated = await updateAccountPin(activeAccount.id, newPin);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    },
    [activeAccount]
  );

  const handleUpdateAutoLock = useCallback(
    async (minutes: number) => {
      if (!activeAccount) throw new Error('Belum ada akun lokal yang aktif.');
      const updated = await updateAccountAutoLock(activeAccount.id, minutes);
      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    },
    [activeAccount]
  );

  const handleExportBackup = useCallback(async () => {
    const targetId = effectiveAccountId ?? DEFAULT_ACCOUNT_ID;
    const payload = await exportBackupJSON(targetId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-money-backup-${getCurrentMonthISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [effectiveAccountId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-bg text-mm-text flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-extrabold tracking-tight text-mm-brand">MY MONEY</p>
          <p className="text-xs text-mm-muted">Memuat data keuangan lokal Anda...</p>
        </div>
      </div>
    );
  }

  // Gate 1: Accounts exist, but no active logged-in session -> Show Login / Register screen
  if (accounts.length > 0 && !activeAccount) {
    return (
      <AuthGate
        variant="login_register"
        initialTab="login"
        accounts={accounts}
        legacyDataSummary={legacySummary}
        onLoginPassword={handleLoginPassword}
        onLoginPin={handleLoginPin}
        onRegister={handleRegisterAccount}
        onUnlockPassword={handleUnlockPassword}
        onUnlockPin={handleUnlockPin}
        onSwitchAccountFromLock={handleLogoutAccount}
      />
    );
  }

  // Gate 2: Logged-in account is currently locked (App Lock) -> Require PIN or Password
  if (activeAccount && session.locked) {
    return (
      <AuthGate
        variant="locked"
        accounts={accounts}
        lockedAccount={activeAccount}
        lockedAccountProfile={userProfile}
        onLoginPassword={handleLoginPassword}
        onLoginPin={handleLoginPin}
        onRegister={handleRegisterAccount}
        onUnlockPassword={handleUnlockPassword}
        onUnlockPin={handleUnlockPin}
        onSwitchAccountFromLock={handleLogoutAccount}
      />
    );
  }

  const currentAccountId = effectiveAccountId ?? DEFAULT_ACCOUNT_ID;

  return (
    <div className="min-h-screen bg-mm-bg text-mm-text flex flex-col lg:flex-row transition-colors duration-150">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-mm-bg2 border-r border-mm-border p-5 justify-between overflow-y-auto">
        <div>
          <div className="px-2 pb-5 border-b border-mm-border flex items-center gap-3">
            <img src="/icon.svg" alt="Logo MY MONEY" className="w-9 h-9 rounded-xl shrink-0" />
            <div>
              <p className="text-base font-extrabold tracking-tight text-mm-text">MY MONEY</p>
              <p className="text-[11px] text-mm-muted">Take Control of Your Money</p>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewTransaction}
            className="mt-4 w-full min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Transaksi</span>
          </button>

          <nav className="mt-4 space-y-1" aria-label="Navigasi utama">
            {DESKTOP_NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.tab === 'lainnya'
                  ? activeTab === 'lainnya' && subView === item.sub
                  : activeTab === item.tab;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.sub ? navigateSubView(item.sub) : navigateTab(item.tab))}
                  className={`w-full min-h-[40px] px-3 rounded-xl flex items-center gap-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-mm-brand/15 text-mm-brand border border-mm-brand/30'
                      : 'text-mm-muted hover:text-mm-text hover:bg-mm-hover border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-mm-border space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToSettings('profile')}
              className="flex-1 min-w-0 rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border p-2.5 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
            >
              <UserAvatar
                displayName={userProfile.displayName}
                avatarDataUrl={userProfile.avatarDataUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-mm-text truncate">
                  {userProfile.displayName.trim() || 'Atur Profil Saya'}
                </p>
                <p className="text-[11px] text-mm-muted truncate">
                  {userProfile.username
                    ? `@${userProfile.username}`
                    : activeAccount
                      ? `@${activeAccount.username}`
                      : 'Profil lokal offline'}
                </p>
              </div>
            </button>

            {activeAccount && (
              <button
                type="button"
                onClick={handleLockApp}
                title="Kunci Aplikasi"
                aria-label="Kunci Aplikasi"
                className="min-h-[46px] min-w-[42px] rounded-xl bg-mm-surface hover:bg-mm-hover border border-mm-border text-mm-muted hover:text-mm-brand flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
          <PWAInstallButton />
        </div>
      </aside>

      {/* Header Mobile (Ringkas) */}
      <header className="lg:hidden sticky top-0 z-30 h-12 bg-mm-bg/90 backdrop-blur-md border-b border-mm-border px-4 flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          {activeTab === 'lainnya' && subView !== 'menu' ? (
            <button
              type="button"
              onClick={() => setSubView('menu')}
              className="min-h-[36px] min-w-[36px] -ml-1.5 rounded-lg text-mm-muted hover:text-mm-text flex items-center justify-center cursor-pointer"
              aria-label="Kembali ke menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <img src="/icon.svg" alt="MY MONEY" className="w-6 h-6 rounded-lg" />
          )}
          <span className="text-sm font-extrabold tracking-tight text-mm-text">MY MONEY</span>
        </div>

        <div className="flex items-center gap-1">
          <PWAInstallButton compact />
          {activeAccount && (
            <button
              type="button"
              onClick={handleLockApp}
              className="min-h-[36px] min-w-[36px] rounded-lg text-mm-muted hover:text-mm-brand hover:bg-mm-hover flex items-center justify-center cursor-pointer"
              aria-label="Kunci Aplikasi"
              title="Kunci Aplikasi"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateSubView('pengaturan')}
            className={`min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'lainnya' && subView === 'pengaturan'
                ? 'bg-mm-brand/15 text-mm-brand'
                : 'text-mm-muted hover:text-mm-text hover:bg-mm-hover'
            }`}
            aria-label="Buka Pengaturan"
            title="Pengaturan & Tema"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Konten Utama */}
      <main className="flex-1 lg:pl-64 pb-24 lg:pb-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <OfflineBanner />

          {errorMsg && (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-mm-expense/15 border border-mm-expense/30 px-4 py-3 flex items-center justify-between gap-3 text-xs text-mm-expense"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="font-semibold text-mm-expense cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          <Suspense
            fallback={
              <div className="rounded-2xl bg-mm-surface border border-mm-border p-8 text-center text-xs text-mm-muted">
                Memuat halaman...
              </div>
            }
          >
            {activeTab === 'beranda' && (
              <DashboardView
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                userProfile={userProfile}
                wallets={state.wallets}
                transactions={state.transactions}
                budgets={state.budgets}
                goals={state.goals}
                assetsDebts={state.assetsDebts}
                categories={categories}
                onOpenNewTransaction={openNewTransaction}
                onEditTransaction={openEditTransaction}
                onNavigateTab={navigateTab}
                onNavigateSubView={navigateSubView}
                onOpenProfileSettings={() => navigateToSettings('profile')}
                onLoadSampleData={async () => {
                  await loadSampleSimulationData(currentAccountId);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'transaksi' && (
              <TransactionsView
                selectedMonth={selectedMonth}
                transactions={state.transactions}
                wallets={state.wallets}
                categories={categories}
                onOpenNewTransaction={openNewTransaction}
                onEditTransaction={openEditTransaction}
                onDeleteTransaction={async (id) => {
                  await deleteTransaction(id, currentAccountId);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'anggaran' && (
              <BudgetsView
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                budgets={state.budgets}
                transactions={state.transactions}
                categories={categories}
                onSaveBudget={async (payload) => {
                  await saveBudgetItem(payload, currentAccountId);
                  await refreshActiveData();
                }}
                onDeleteBudget={async (id) => {
                  await deleteBudgetItem(id);
                  await refreshActiveData();
                }}
                onCopyPreviousMonth={async (targetMonth) => {
                  const count = await copyBudgetsFromPreviousMonth(targetMonth, currentAccountId);
                  await refreshActiveData();
                  return count;
                }}
              />
            )}

            {activeTab === 'lainnya' && subView === 'menu' && (
              <MoreMenuView onSelectSubView={navigateSubView} />
            )}

            {activeTab === 'lainnya' && subView === 'dompet' && (
              <WalletsView
                wallets={state.wallets}
                onSaveWallet={async (payload) => {
                  await saveWallet(payload, currentAccountId);
                  await refreshActiveData();
                }}
                onDeleteWallet={async (id) => {
                  await deleteWallet(id);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'lainnya' && subView === 'target' && (
              <GoalsView
                goals={state.goals}
                wallets={state.wallets}
                onSaveGoal={async (payload) => {
                  await saveGoal(payload, currentAccountId);
                  await refreshActiveData();
                }}
                onDeleteGoal={async (id) => {
                  await deleteGoal(id);
                  await refreshActiveData();
                }}
                onContributeGoal={async (goalId, amount, deductWalletId) => {
                  await addGoalContribution(goalId, amount, deductWalletId, currentAccountId);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'lainnya' && subView === 'aset_utang' && (
              <AssetsDebtsView
                accountId={currentAccountId}
                items={state.assetsDebts}
                onSaveItem={async (payload) => {
                  await saveAssetDebt(payload, currentAccountId);
                  await refreshActiveData();
                }}
                onDeleteItem={async (id) => {
                  await deleteAssetDebt(id);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'lainnya' && subView === 'laporan' && (
              <ReportsView
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                wallets={state.wallets}
                transactions={state.transactions}
                assetsDebts={state.assetsDebts}
                categories={categories}
              />
            )}

            {activeTab === 'lainnya' && subView === 'kesehatan' && (
              <HealthScoreView
                selectedMonth={selectedMonth}
                wallets={state.wallets}
                transactions={state.transactions}
                budgets={state.budgets}
                goals={state.goals}
                assetsDebts={state.assetsDebts}
                categories={categories}
              />
            )}

            {activeTab === 'lainnya' && subView === 'data_pwa' && (
              <DataPWAView
                needRefresh={needRefresh}
                isUpdating={isUpdating}
                isCheckingUpdate={isCheckingUpdate}
                updateFeedback={checkFeedback}
                onCheckUpdates={checkForUpdates}
                onApplyUpdate={applyUpdate}
                onExportBackup={handleExportBackup}
                onRestoreBackup={async (raw) => {
                  const res = await restoreBackupJSON(raw, currentAccountId);
                  await refreshActiveData();
                  return res;
                }}
                onLoadSampleData={async () => {
                  await loadSampleSimulationData(currentAccountId);
                  await refreshActiveData();
                }}
                onClearAllData={async () => {
                  await clearAllData(currentAccountId);
                  await refreshActiveData();
                }}
              />
            )}

            {activeTab === 'lainnya' && subView === 'pengaturan' && (
              <SettingsView
                initialSection={settingsSection}
                profile={userProfile}
                onSaveProfile={handleSaveProfile}
                onRemoveAvatar={handleRemoveAvatar}
                activeAccount={activeAccount}
                accounts={accounts}
                onOpenRegisterAccount={() => void handleOpenRegisterModal()}
                onLockApp={handleLockApp}
                onLogoutAccount={handleLogoutAccount}
                onChangePassword={handleChangePassword}
                onUpdatePin={handleUpdatePin}
                onUpdateAutoLock={handleUpdateAutoLock}
                onUnsavedStateChange={setSettingsUnsaved}
                counts={{
                  wallets: state.wallets.length,
                  transactions: state.transactions.length,
                  budgets: state.budgets.length,
                  goals: state.goals.length,
                  assetsDebts: state.assetsDebts.length,
                }}
                needRefresh={needRefresh}
                isUpdating={isUpdating}
                isCheckingUpdate={isCheckingUpdate}
                updateFeedback={checkFeedback}
                onCheckUpdates={checkForUpdates}
                onApplyUpdate={applyUpdate}
                onExportBackup={handleExportBackup}
                onRestoreBackup={async (raw) => {
                  const res = await restoreBackupJSON(raw, currentAccountId);
                  await refreshActiveData();
                  return res;
                }}
                onLoadSampleData={async () => {
                  await loadSampleSimulationData(currentAccountId);
                  await refreshActiveData();
                }}
                onClearAllData={async () => {
                  await clearAllData(currentAccountId);
                  await refreshActiveData();
                }}
                onNavigateSubView={navigateSubView}
              />
            )}
          </Suspense>
        </div>
      </main>

      {/* Bottom Navigation Mobile (5 Item: Beranda, Transaksi, +, Anggaran, Lainnya) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-mm-bg2/95 backdrop-blur-md border-t border-mm-border pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-16 px-2">
          <button
            type="button"
            onClick={() => navigateTab('beranda')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'beranda' ? 'text-mm-brand' : 'text-mm-muted hover:text-mm-text'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Beranda</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('transaksi')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'transaksi' ? 'text-mm-brand' : 'text-mm-muted hover:text-mm-text'
            }`}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] font-medium">Transaksi</span>
          </button>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={openNewTransaction}
              className="w-12 h-12 -mt-4 rounded-2xl mm-btn-primary shadow-lg flex items-center justify-center cursor-pointer"
              aria-label="Catat transaksi baru"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigateTab('anggaran')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'anggaran' ? 'text-mm-brand' : 'text-mm-muted hover:text-mm-text'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[10px] font-medium">Anggaran</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTab('lainnya')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'lainnya' ? 'text-mm-brand' : 'text-mm-muted hover:text-mm-text'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Lainnya</span>
          </button>
        </div>
      </nav>

      {/* Modal Tambah / Edit Transaksi */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        wallets={state.wallets}
        categories={categories}
        initialTransaction={editingTx}
        onSave={async (payload) => {
          await saveTransaction(payload, currentAccountId);
          await refreshActiveData();
        }}
        onDelete={async (id) => {
          await deleteTransaction(id, currentAccountId);
          await refreshActiveData();
        }}
        onOpenWalletManager={() => navigateSubView('dompet')}
      />

      {/* Modal Buat Akun Lokal Baru (dari Mode Lokal Bawaan atau Tambah Akun) */}
      {registerModalOpen && (
        <AuthGate
          variant="modal_register"
          accounts={accounts}
          legacyDataSummary={legacySummary}
          prefillProfile={accounts.length === 0 ? userProfile : null}
          onLoginPassword={handleLoginPassword}
          onLoginPin={handleLoginPin}
          onRegister={handleRegisterAccount}
          onUnlockPassword={handleUnlockPassword}
          onUnlockPin={handleUnlockPin}
          onSwitchAccountFromLock={handleLogoutAccount}
          onCloseModal={() => setRegisterModalOpen(false)}
        />
      )}

      {/* PWA Update Banner */}
      <PWAUpdateBanner
        visible={needRefresh && !dismissed}
        isUpdating={isUpdating}
        onUpdateNow={applyUpdate}
        onDismiss={dismissUpdate}
      />

      {/* Suppress unused state warning if future global logout shortcut needs settingsUnsaved */}
      {settingsUnsaved ? null : null}
    </div>
  );
}
