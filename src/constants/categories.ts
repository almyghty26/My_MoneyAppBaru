import type { BudgetGroup, CategoryDef, GoalCategory, WalletType } from '../types/finance';

export const PRESET_COLORS: readonly string[] = [
  '#8B5CF6',
  '#EC4899',
  '#10B981',
  '#F59E0B',
  '#3B82F6',
  '#06B6D4',
  '#F43F5E',
  '#14B8A6',
];

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  bank: 'Rekening Bank',
  ewallet: 'E-Wallet',
  cash: 'Uang Tunai',
  savings: 'Tabungan',
  other: 'Dompet Lainnya',
};

export const BUDGET_GROUP_META: Record<
  BudgetGroup,
  { label: string; description: string; color: string; recommendedPct: number }
> = {
  needs: {
    label: 'Kebutuhan',
    description: 'Makan, tempat tinggal, tagihan & transportasi harian',
    color: '#8B5CF6',
    recommendedPct: 50,
  },
  wants: {
    label: 'Keinginan',
    description: 'Hiburan, jajan, hobi & gaya hidup',
    color: '#EC4899',
    recommendedPct: 30,
  },
  savings: {
    label: 'Tabungan',
    description: 'Dana darurat, investasi & target masa depan',
    color: '#10B981',
    recommendedPct: 20,
  },
};

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  emergency: 'Dana Darurat',
  vehicle: 'Membeli Kendaraan',
  item: 'Membeli Barang',
  gift: 'Hadiah Keluarga',
  longterm: 'Tabungan Jangka Panjang',
};

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'cat_makan', name: 'Makan & Minum', type: 'expense', budgetGroup: 'needs', color: '#8B5CF6' },
  { id: 'cat_belanja', name: 'Belanja Harian', type: 'expense', budgetGroup: 'needs', color: '#6366F1' },
  { id: 'cat_transport', name: 'Transportasi', type: 'expense', budgetGroup: 'needs', color: '#3B82F6' },
  { id: 'cat_tagihan', name: 'Tagihan & Utilitas', type: 'expense', budgetGroup: 'needs', color: '#0EA5E9' },
  { id: 'cat_kesehatan', name: 'Kesehatan', type: 'expense', budgetGroup: 'needs', color: '#14B8A6' },
  { id: 'cat_hiburan', name: 'Hiburan & Jajan', type: 'expense', budgetGroup: 'wants', color: '#EC4899' },
  { id: 'cat_gaya', name: 'Belanja Pribadi', type: 'expense', budgetGroup: 'wants', color: '#F43F5E' },
  { id: 'cat_keluarga', name: 'Keluarga & Sosial', type: 'expense', budgetGroup: 'wants', color: '#F59E0B' },
  { id: 'cat_tabungan', name: 'Setor Tabungan', type: 'expense', budgetGroup: 'savings', color: '#10B981' },
  { id: 'cat_investasi', name: 'Investasi', type: 'expense', budgetGroup: 'savings', color: '#22C55E' },
  { id: 'cat_cicilan', name: 'Bayar Cicilan / Utang', type: 'expense', budgetGroup: 'needs', color: '#EF4444' },
  { id: 'cat_lainnya', name: 'Pengeluaran Lainnya', type: 'expense', budgetGroup: 'wants', color: '#64748B' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: 'inc_gaji', name: 'Gaji & Upah', type: 'income', color: '#10B981' },
  { id: 'inc_bisnis', name: 'Usaha & Freelance', type: 'income', color: '#22C55E' },
  { id: 'inc_bonus', name: 'Bonus & THR', type: 'income', color: '#14B8A6' },
  { id: 'inc_invest', name: 'Hasil Investasi', type: 'income', color: '#06B6D4' },
  { id: 'inc_hadiah', name: 'Hadiah & Lainnya', type: 'income', color: '#8B5CF6' },
];

export const DEFAULT_CATEGORIES: CategoryDef[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
