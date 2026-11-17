export type WalletType = 'bank' | 'ewallet' | 'cash' | 'savings' | 'other';

export interface Wallet {
  id: string;
  accountId?: string;
  name: string;
  type: WalletType;
  initialBalance: number;
  balance: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export type BudgetGroup = 'needs' | 'wants' | 'savings';

export interface CategoryDef {
  id: string;
  accountId?: string;
  name: string;
  type: 'income' | 'expense';
  budgetGroup?: BudgetGroup;
  color: string;
  isCustom?: boolean;
}

export interface Transaction {
  id: string;
  accountId?: string;
  type: TransactionType;
  amount: number;
  walletId: string;
  toWalletId?: string;
  categoryId: string;
  categoryName: string;
  budgetGroup?: BudgetGroup;
  date: string; // YYYY-MM-DD (local date)
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  accountId?: string;
  month: string; // YYYY-MM
  group: BudgetGroup;
  categoryId: string;
  categoryName: string;
  limitAmount: number;
  createdAt: string;
  updatedAt: string;
}

export type GoalCategory = 'emergency' | 'vehicle' | 'item' | 'gift' | 'longterm';

export interface FinancialGoal {
  id: string;
  accountId?: string;
  name: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetSubtype = 'liquid' | 'investment' | 'fixed';

export interface AssetTypeDef {
  id: string;
  name: string;
  subtype: AssetSubtype;
  color: string; // #RRGGBB
  isBuiltIn?: boolean;
  updatedAt: string;
}

export interface AssetDebtItem {
  id: string;
  accountId?: string;
  kind: 'asset' | 'debt';
  subtype: 'liquid' | 'investment' | 'fixed' | 'debt' | 'installment';
  assetTypeId?: string;
  color?: string;
  name: string;
  amount: number;
  monthlyInstallment?: number;
  dueDateDay?: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type NavTab = 'beranda' | 'transaksi' | 'anggaran' | 'lainnya';

export type SubView =
  | 'menu'
  | 'dompet'
  | 'target'
  | 'aset_utang'
  | 'laporan'
  | 'kesehatan'
  | 'data_pwa'
  | 'pengaturan';

export interface HealthScoreFactor {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  metricLabel: string;
  formulaDesc: string;
  status: 'baik' | 'cukup' | 'perlu_perhatian';
}

export interface FinancialHealthResult {
  totalScore: number;
  grade: 'Sangat Sehat' | 'Sehat' | 'Cukup' | 'Perlu Perbaikan';
  hasEnoughData: boolean;
  factors: HealthScoreFactor[];
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type ThemePresetId =
  | 'midnight'
  | 'graphite'
  | 'ocean'
  | 'forest'
  | 'ivory'
  | 'minimal_light'
  | 'custom';

export interface ThemeColorTokens {
  bgPrimary: string;
  bgSecondary: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  income: string;
  expense: string;
  warning: string;
  success: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  presetId: ThemePresetId;
  colors: ThemeColorTokens;
  updatedAt: string;
}

export type DateDisplayFormat = 'relative' | 'short' | 'slash' | 'iso';

export interface AppPreferences {
  dateFormat: DateDisplayFormat;
  budgetAlertThresholdPct: number;
  notificationsEnabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  avatarDataUrl: string | null;
  bio?: string;
  updatedAt: string;
}

export interface LocalAccount {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  iterations: number;
  pinHash?: string | null;
  pinSalt?: string | null;
  autoLockMinutes: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface LocalAuthSession {
  activeAccountId: string | null;
  locked: boolean;
  lastActiveAt: number;
}
