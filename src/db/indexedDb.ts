import { DEFAULT_CATEGORIES } from '../constants/categories';
import type {
  AssetDebtItem,
  BudgetItem,
  CategoryDef,
  FinancialGoal,
  LocalAccount,
  LocalAuthSession,
  Transaction,
  UserProfile,
  Wallet,
} from '../types/finance';
import { copyLegacyAssetColorsToAccount } from '../utils/assetColors';
import {
  hashSecret,
  validatePasswordStrength,
  validatePinFormat,
  verifySecret,
} from '../utils/cryptoAuth';
import { generateId, getCurrentMonthISO, getTodayISO, shiftMonthISO } from '../utils/format';
import { validateUsernameFormat } from '../utils/imageCompress';
import { copyLegacyThemeAndPrefsToAccount } from '../utils/theme';

const DB_NAME = 'my_money_db';
const DB_VERSION = 2;

export const DEFAULT_ACCOUNT_ID = 'local_default';
const SESSION_STORAGE_KEY = 'my_money_session_v1';

const STORES = {
  WALLETS: 'wallets',
  TRANSACTIONS: 'transactions',
  BUDGETS: 'budgets',
  GOALS: 'goals',
  ASSETS_DEBTS: 'assetsDebts',
  CUSTOM_CATEGORIES: 'customCategories',
  META: 'meta',
  ACCOUNTS: 'accounts',
} as const;

export interface FullAppState {
  wallets: Wallet[];
  transactions: Transaction[];
  budgets: BudgetItem[];
  goals: FinancialGoal[];
  assetsDebts: AssetDebtItem[];
  customCategories: CategoryDef[];
}

interface MetaRecord<T = unknown> {
  key: string;
  value: T;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser ini tidak mendukung IndexedDB untuk penyimpanan lokal.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      for (const storeName of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          const opts = storeName === STORES.META ? { keyPath: 'key' } : { keyPath: 'id' };
          db.createObjectStore(storeName, opts);
        }
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(new Error('Gagal membuka IndexedDB.'));
    };
  });

  return dbPromise;
}

function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error(`Gagal membaca ${storeName}`));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaksi database gagal'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaksi database dibatalkan'));
  });
}

export function belongsToAccount(
  record: { accountId?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): boolean {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return !record.accountId || record.accountId === DEFAULT_ACCOUNT_ID;
  }
  return record.accountId === accountId;
}

function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function recomputeWalletBalances(wallets: Wallet[], transactions: Transaction[]): Wallet[] {
  const balances = new Map<string, number>();
  for (const w of wallets) {
    balances.set(w.id, w.initialBalance);
  }
  for (const t of transactions) {
    if (t.type === 'income') {
      balances.set(t.walletId, (balances.get(t.walletId) ?? 0) + t.amount);
    } else if (t.type === 'expense') {
      balances.set(t.walletId, (balances.get(t.walletId) ?? 0) - t.amount);
    } else if (t.type === 'transfer') {
      balances.set(t.walletId, (balances.get(t.walletId) ?? 0) - t.amount);
      if (t.toWalletId) {
        balances.set(t.toWalletId, (balances.get(t.toWalletId) ?? 0) + t.amount);
      }
    }
  }
  return wallets.map((w) => ({
    ...w,
    balance: balances.get(w.id) ?? w.initialBalance,
  }));
}

export function getAllCategories(customCategories: CategoryDef[]): CategoryDef[] {
  return [...DEFAULT_CATEGORIES, ...customCategories];
}

export async function loadAllData(accountId: string = DEFAULT_ACCOUNT_ID): Promise<FullAppState> {
  const db = await openDB();
  const [walletsAll, transactionsAll, budgetsAll, goalsAll, assetsDebtsAll, customCategoriesAll] =
    await Promise.all([
      getAll<Wallet>(db, STORES.WALLETS),
      getAll<Transaction>(db, STORES.TRANSACTIONS),
      getAll<BudgetItem>(db, STORES.BUDGETS),
      getAll<FinancialGoal>(db, STORES.GOALS),
      getAll<AssetDebtItem>(db, STORES.ASSETS_DEBTS),
      getAll<CategoryDef>(db, STORES.CUSTOM_CATEGORIES),
    ]);

  const wallets = walletsAll.filter((w) => belongsToAccount(w, accountId));
  const transactions = transactionsAll.filter((t) => belongsToAccount(t, accountId));
  const budgets = budgetsAll.filter((b) => belongsToAccount(b, accountId));
  const goals = goalsAll.filter((g) => belongsToAccount(g, accountId));
  const assetsDebts = assetsDebtsAll.filter((a) => belongsToAccount(a, accountId));
  const customCategories = customCategoriesAll.filter((c) => belongsToAccount(c, accountId));

  const syncedWallets = recomputeWalletBalances(wallets, transactions);
  return {
    wallets: syncedWallets,
    transactions: sortTransactions(transactions),
    budgets,
    goals,
    assetsDebts,
    customCategories,
  };
}

export async function saveWallet(
  input: Omit<Wallet, 'id' | 'balance' | 'createdAt' | 'updatedAt'> & { id?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<Wallet> {
  const db = await openDB();
  const [walletsAll, transactionsAll] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
  ]);

  const wallets = walletsAll.filter((w) => belongsToAccount(w, accountId));
  const transactions = transactionsAll.filter((t) => belongsToAccount(t, accountId));

  const now = new Date().toISOString();
  const existing = input.id ? wallets.find((w) => w.id === input.id) : undefined;
  const wallet: Wallet = existing
    ? {
        ...existing,
        accountId,
        name: input.name,
        type: input.type,
        initialBalance: input.initialBalance,
        color: input.color,
        updatedAt: now,
      }
    : {
        id: generateId('wal'),
        accountId,
        name: input.name,
        type: input.type,
        initialBalance: input.initialBalance,
        balance: input.initialBalance,
        color: input.color,
        createdAt: now,
        updatedAt: now,
      };

  const nextWallets = existing
    ? wallets.map((w) => (w.id === wallet.id ? wallet : w))
    : [...wallets, wallet];
  const synced = recomputeWalletBalances(nextWallets, transactions);

  const tx = db.transaction(STORES.WALLETS, 'readwrite');
  const store = tx.objectStore(STORES.WALLETS);
  for (const w of synced) {
    store.put(w);
  }
  await txDone(tx);
  return synced.find((w) => w.id === wallet.id) ?? wallet;
}

export async function deleteWallet(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.WALLETS, 'readwrite');
  tx.objectStore(STORES.WALLETS).delete(id);
  await txDone(tx);
}

export async function saveTransaction(
  input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<Transaction> {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error('Format tanggal transaksi tidak valid.');
  }
  const db = await openDB();
  const [walletsAll, transactionsAll] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
  ]);

  const wallets = walletsAll.filter((w) => belongsToAccount(w, accountId));
  const transactions = transactionsAll.filter((t) => belongsToAccount(t, accountId));

  const now = new Date().toISOString();
  const existing = input.id ? transactions.find((t) => t.id === input.id) : undefined;
  const record: Transaction = existing
    ? {
        ...existing,
        ...input,
        id: existing.id,
        accountId,
        updatedAt: now,
      }
    : {
        ...input,
        id: generateId('tx'),
        accountId,
        createdAt: now,
        updatedAt: now,
      };

  const nextTxs = existing
    ? transactions.map((t) => (t.id === record.id ? record : t))
    : [...transactions, record];
  const syncedWallets = recomputeWalletBalances(wallets, nextTxs);

  const tx = db.transaction([STORES.TRANSACTIONS, STORES.WALLETS], 'readwrite');
  tx.objectStore(STORES.TRANSACTIONS).put(record);
  const wStore = tx.objectStore(STORES.WALLETS);
  for (const w of syncedWallets) wStore.put(w);
  await txDone(tx);
  return record;
}

export async function deleteTransaction(
  id: string,
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<void> {
  const db = await openDB();
  const [walletsAll, transactionsAll] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
  ]);
  const wallets = walletsAll.filter((w) => belongsToAccount(w, accountId));
  const transactions = transactionsAll.filter((t) => belongsToAccount(t, accountId));

  const nextTxs = transactions.filter((t) => t.id !== id);
  const syncedWallets = recomputeWalletBalances(wallets, nextTxs);

  const tx = db.transaction([STORES.TRANSACTIONS, STORES.WALLETS], 'readwrite');
  tx.objectStore(STORES.TRANSACTIONS).delete(id);
  const wStore = tx.objectStore(STORES.WALLETS);
  for (const w of syncedWallets) wStore.put(w);
  await txDone(tx);
}

export async function saveBudgetItem(
  input: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<BudgetItem> {
  const db = await openDB();
  const all = await getAll<BudgetItem>(db, STORES.BUDGETS);
  const existingList = all.filter((b) => belongsToAccount(b, accountId));
  const now = new Date().toISOString();
  const existing = input.id
    ? existingList.find((b) => b.id === input.id)
    : existingList.find((b) => b.month === input.month && b.categoryId === input.categoryId);

  const item: BudgetItem = existing
    ? {
        ...existing,
        accountId,
        group: input.group,
        categoryId: input.categoryId,
        categoryName: input.categoryName,
        limitAmount: input.limitAmount,
        updatedAt: now,
      }
    : {
        ...input,
        id: generateId('bdg'),
        accountId,
        createdAt: now,
        updatedAt: now,
      };

  const tx = db.transaction(STORES.BUDGETS, 'readwrite');
  tx.objectStore(STORES.BUDGETS).put(item);
  await txDone(tx);
  return item;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.BUDGETS, 'readwrite');
  tx.objectStore(STORES.BUDGETS).delete(id);
  await txDone(tx);
}

export async function copyBudgetsFromPreviousMonth(
  targetMonth: string,
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<number> {
  const db = await openDB();
  const all = (await getAll<BudgetItem>(db, STORES.BUDGETS)).filter((b) =>
    belongsToAccount(b, accountId)
  );
  const prevMonth = shiftMonthISO(targetMonth, -1);
  const prevItems = all.filter((b) => b.month === prevMonth);
  const existingTargetCats = new Set(
    all.filter((b) => b.month === targetMonth).map((b) => b.categoryId)
  );
  const toCopy = prevItems.filter((b) => !existingTargetCats.has(b.categoryId));
  if (toCopy.length === 0) return 0;

  const now = new Date().toISOString();
  const tx = db.transaction(STORES.BUDGETS, 'readwrite');
  const store = tx.objectStore(STORES.BUDGETS);
  for (const item of toCopy) {
    store.put({
      ...item,
      id: generateId('bdg'),
      accountId,
      month: targetMonth,
      createdAt: now,
      updatedAt: now,
    });
  }
  await txDone(tx);
  return toCopy.length;
}

export async function saveGoal(
  input: Omit<FinancialGoal, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<FinancialGoal> {
  const db = await openDB();
  const existingList = (await getAll<FinancialGoal>(db, STORES.GOALS)).filter((g) =>
    belongsToAccount(g, accountId)
  );
  const now = new Date().toISOString();
  const existing = input.id ? existingList.find((g) => g.id === input.id) : undefined;
  const item: FinancialGoal = existing
    ? { ...existing, ...input, id: existing.id, accountId, updatedAt: now }
    : { ...input, id: generateId('goal'), accountId, createdAt: now, updatedAt: now };

  const tx = db.transaction(STORES.GOALS, 'readwrite');
  tx.objectStore(STORES.GOALS).put(item);
  await txDone(tx);
  return item;
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.GOALS, 'readwrite');
  tx.objectStore(STORES.GOALS).delete(id);
  await txDone(tx);
}

export async function addGoalContribution(
  goalId: string,
  amount: number,
  deductWalletId?: string,
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<void> {
  const db = await openDB();
  const goals = (await getAll<FinancialGoal>(db, STORES.GOALS)).filter((g) =>
    belongsToAccount(g, accountId)
  );
  const target = goals.find((g) => g.id === goalId);
  if (!target) throw new Error('Target keuangan tidak ditemukan.');

  const now = new Date().toISOString();
  const updatedGoal: FinancialGoal = {
    ...target,
    accountId,
    currentAmount: target.currentAmount + amount,
    updatedAt: now,
  };

  if (deductWalletId) {
    await saveTransaction(
      {
        type: 'expense',
        amount,
        walletId: deductWalletId,
        categoryId: 'cat_tabungan',
        categoryName: 'Setor Tabungan',
        budgetGroup: 'savings',
        date: getTodayISO(),
        note: `Setor target: ${target.name}`,
      },
      accountId
    );
  }

  const tx = db.transaction(STORES.GOALS, 'readwrite');
  tx.objectStore(STORES.GOALS).put(updatedGoal);
  await txDone(tx);
}

export async function saveAssetDebt(
  input: Omit<AssetDebtItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<AssetDebtItem> {
  const db = await openDB();
  const existingList = (await getAll<AssetDebtItem>(db, STORES.ASSETS_DEBTS)).filter((i) =>
    belongsToAccount(i, accountId)
  );
  const now = new Date().toISOString();
  const existing = input.id ? existingList.find((i) => i.id === input.id) : undefined;
  const item: AssetDebtItem = existing
    ? { ...existing, ...input, id: existing.id, accountId, updatedAt: now }
    : { ...input, id: generateId('ad'), accountId, createdAt: now, updatedAt: now };

  const tx = db.transaction(STORES.ASSETS_DEBTS, 'readwrite');
  tx.objectStore(STORES.ASSETS_DEBTS).put(item);
  await txDone(tx);
  return item;
}

export async function deleteAssetDebt(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.ASSETS_DEBTS, 'readwrite');
  tx.objectStore(STORES.ASSETS_DEBTS).delete(id);
  await txDone(tx);
}

export async function exportBackupJSON(accountId: string = DEFAULT_ACCOUNT_ID) {
  const state = await loadAllData(accountId);
  return {
    app: 'MY MONEY',
    version: 2,
    accountId,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

export async function restoreBackupJSON(
  rawText: string,
  accountId: string = DEFAULT_ACCOUNT_ID
) {
  const parsed = JSON.parse(rawText);
  const data = parsed?.data ?? parsed;
  if (!data || !Array.isArray(data.wallets) || !Array.isArray(data.transactions)) {
    throw new Error('Format file cadangan JSON MY MONEY tidak valid.');
  }

  const db = await openDB();
  const [
    existingWallets,
    existingTxs,
    existingBudgets,
    existingGoals,
    existingAssetsDebts,
    existingCustomCats,
  ] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
    getAll<BudgetItem>(db, STORES.BUDGETS),
    getAll<FinancialGoal>(db, STORES.GOALS),
    getAll<AssetDebtItem>(db, STORES.ASSETS_DEBTS),
    getAll<CategoryDef>(db, STORES.CUSTOM_CATEGORIES),
  ]);

  // Prevent ID collisions against records owned by OTHER local accounts
  const otherWalletIds = new Set(
    existingWallets.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );
  const otherTxIds = new Set(
    existingTxs.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );
  const otherBudgetIds = new Set(
    existingBudgets.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );
  const otherGoalIds = new Set(
    existingGoals.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );
  const otherAdIds = new Set(
    existingAssetsDebts.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );
  const otherCatIds = new Set(
    existingCustomCats.filter((i) => !belongsToAccount(i, accountId)).map((i) => i.id)
  );

  const walletIdMap = new Map<string, string>();
  const wallets: Wallet[] = (data.wallets as Wallet[]).map((w) => {
    const nextId = otherWalletIds.has(w.id) ? generateId('wal') : w.id;
    walletIdMap.set(w.id, nextId);
    return { ...w, id: nextId, accountId };
  });

  const transactions: Transaction[] = (data.transactions as Transaction[]).map((t) => ({
    ...t,
    id: otherTxIds.has(t.id) ? generateId('tx') : t.id,
    walletId: walletIdMap.get(t.walletId) ?? t.walletId,
    toWalletId: t.toWalletId ? (walletIdMap.get(t.toWalletId) ?? t.toWalletId) : undefined,
    accountId,
  }));

  const budgets: BudgetItem[] = (Array.isArray(data.budgets) ? data.budgets : []).map(
    (b: BudgetItem) => ({
      ...b,
      id: otherBudgetIds.has(b.id) ? generateId('bdg') : b.id,
      accountId,
    })
  );

  const goals: FinancialGoal[] = (Array.isArray(data.goals) ? data.goals : []).map(
    (g: FinancialGoal) => ({
      ...g,
      id: otherGoalIds.has(g.id) ? generateId('goal') : g.id,
      accountId,
    })
  );

  const assetsDebts: AssetDebtItem[] = (
    Array.isArray(data.assetsDebts) ? data.assetsDebts : []
  ).map((a: AssetDebtItem) => ({
    ...a,
    id: otherAdIds.has(a.id) ? generateId('ad') : a.id,
    accountId,
  }));

  const customCategories: CategoryDef[] = (
    Array.isArray(data.customCategories) ? data.customCategories : []
  ).map((c: CategoryDef) => ({
    ...c,
    id: otherCatIds.has(c.id) ? generateId('cat') : c.id,
    accountId,
  }));

  const syncedWallets = recomputeWalletBalances(wallets, transactions);

  const storeNames = [
    STORES.WALLETS,
    STORES.TRANSACTIONS,
    STORES.BUDGETS,
    STORES.GOALS,
    STORES.ASSETS_DEBTS,
    STORES.CUSTOM_CATEGORIES,
  ];
  const tx = db.transaction(storeNames, 'readwrite');

  // Delete ONLY records belonging to the target accountId
  for (const item of existingWallets) {
    if (belongsToAccount(item, accountId)) tx.objectStore(STORES.WALLETS).delete(item.id);
  }
  for (const item of existingTxs) {
    if (belongsToAccount(item, accountId)) tx.objectStore(STORES.TRANSACTIONS).delete(item.id);
  }
  for (const item of existingBudgets) {
    if (belongsToAccount(item, accountId)) tx.objectStore(STORES.BUDGETS).delete(item.id);
  }
  for (const item of existingGoals) {
    if (belongsToAccount(item, accountId)) tx.objectStore(STORES.GOALS).delete(item.id);
  }
  for (const item of existingAssetsDebts) {
    if (belongsToAccount(item, accountId)) tx.objectStore(STORES.ASSETS_DEBTS).delete(item.id);
  }
  for (const item of existingCustomCats) {
    if (belongsToAccount(item, accountId)) {
      tx.objectStore(STORES.CUSTOM_CATEGORIES).delete(item.id);
    }
  }

  for (const w of syncedWallets) tx.objectStore(STORES.WALLETS).put(w);
  for (const t of transactions) tx.objectStore(STORES.TRANSACTIONS).put(t);
  for (const b of budgets) tx.objectStore(STORES.BUDGETS).put(b);
  for (const g of goals) tx.objectStore(STORES.GOALS).put(g);
  for (const a of assetsDebts) tx.objectStore(STORES.ASSETS_DEBTS).put(a);
  for (const c of customCategories) tx.objectStore(STORES.CUSTOM_CATEGORIES).put(c);
  await txDone(tx);

  return {
    wallets: syncedWallets.length,
    transactions: transactions.length,
    budgets: budgets.length,
    goals: goals.length,
    assetsDebts: assetsDebts.length,
  };
}

export async function clearAllData(accountId: string = DEFAULT_ACCOUNT_ID): Promise<void> {
  const db = await openDB();
  const [wallets, txs, budgets, goals, assetsDebts, customCats] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
    getAll<BudgetItem>(db, STORES.BUDGETS),
    getAll<FinancialGoal>(db, STORES.GOALS),
    getAll<AssetDebtItem>(db, STORES.ASSETS_DEBTS),
    getAll<CategoryDef>(db, STORES.CUSTOM_CATEGORIES),
  ]);

  const storeNames = [
    STORES.WALLETS,
    STORES.TRANSACTIONS,
    STORES.BUDGETS,
    STORES.GOALS,
    STORES.ASSETS_DEBTS,
    STORES.CUSTOM_CATEGORIES,
  ];
  const tx = db.transaction(storeNames, 'readwrite');
  for (const i of wallets) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.WALLETS).delete(i.id);
  for (const i of txs) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.TRANSACTIONS).delete(i.id);
  for (const i of budgets) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.BUDGETS).delete(i.id);
  for (const i of goals) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.GOALS).delete(i.id);
  for (const i of assetsDebts) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.ASSETS_DEBTS).delete(i.id);
  for (const i of customCats) if (belongsToAccount(i, accountId)) tx.objectStore(STORES.CUSTOM_CATEGORIES).delete(i.id);
  await txDone(tx);
}

export async function loadSampleSimulationData(
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<void> {
  const now = new Date().toISOString();
  const currMonth = getCurrentMonthISO();
  const prevMonth1 = shiftMonthISO(currMonth, -1);
  const prevMonth2 = shiftMonthISO(currMonth, -2);
  const today = getTodayISO();
  const prefix = accountId === DEFAULT_ACCOUNT_ID ? '' : `${accountId}_`;

  const sampleWallets: Wallet[] = [
    {
      id: `${prefix}w_bca`,
      accountId,
      name: 'Bank BCA',
      type: 'bank',
      initialBalance: 12500000,
      balance: 12500000,
      color: '#3B82F6',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}w_gopay`,
      accountId,
      name: 'GoPay',
      type: 'ewallet',
      initialBalance: 1250000,
      balance: 1250000,
      color: '#10B981',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}w_tunai`,
      accountId,
      name: 'Dompet Tunai',
      type: 'cash',
      initialBalance: 650000,
      balance: 650000,
      color: '#F59E0B',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}w_darurat`,
      accountId,
      name: 'Tabungan Darurat',
      type: 'savings',
      initialBalance: 18000000,
      balance: 18000000,
      color: '#8B5CF6',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sampleTxs: Transaction[] = [
    {
      id: `${prefix}tx_1`,
      accountId,
      type: 'income',
      amount: 9500000,
      walletId: `${prefix}w_bca`,
      categoryId: 'inc_gaji',
      categoryName: 'Gaji & Upah',
      date: `${currMonth}-01`,
      note: 'Gaji Bulanan',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_2`,
      accountId,
      type: 'expense',
      amount: 125750,
      walletId: `${prefix}w_gopay`,
      categoryId: 'cat_makan',
      categoryName: 'Makan & Minum',
      budgetGroup: 'needs',
      date: today,
      note: 'Makan siang & kopi',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_3`,
      accountId,
      type: 'transfer',
      amount: 9500,
      walletId: `${prefix}w_bca`,
      toWalletId: `${prefix}w_gopay`,
      categoryId: 'transfer',
      categoryName: 'Transfer Antar-Dompet',
      date: today,
      note: 'Top up saldo kecil',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_4`,
      accountId,
      type: 'expense',
      amount: 1250000,
      walletId: `${prefix}w_bca`,
      categoryId: 'cat_tagihan',
      categoryName: 'Tagihan & Utilitas',
      budgetGroup: 'needs',
      date: `${currMonth}-05`,
      note: 'Listrik, air & internet',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_5`,
      accountId,
      type: 'expense',
      amount: 650000,
      walletId: `${prefix}w_gopay`,
      categoryId: 'cat_hiburan',
      categoryName: 'Hiburan & Jajan',
      budgetGroup: 'wants',
      date: `${currMonth}-08`,
      note: 'Nonton & makan akhir pekan',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_6`,
      accountId,
      type: 'income',
      amount: 8750000,
      walletId: `${prefix}w_bca`,
      categoryId: 'inc_gaji',
      categoryName: 'Gaji & Upah',
      date: `${prevMonth1}-01`,
      note: 'Gaji Bulan Lalu',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_7`,
      accountId,
      type: 'expense',
      amount: 4200000,
      walletId: `${prefix}w_bca`,
      categoryId: 'cat_belanja',
      categoryName: 'Belanja Harian',
      budgetGroup: 'needs',
      date: `${prevMonth1}-12`,
      note: 'Kebutuhan rumah tangga',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_8`,
      accountId,
      type: 'income',
      amount: 8500000,
      walletId: `${prefix}w_bca`,
      categoryId: 'inc_gaji',
      categoryName: 'Gaji & Upah',
      date: `${prevMonth2}-01`,
      note: 'Gaji 2 Bulan Lalu',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}tx_9`,
      accountId,
      type: 'expense',
      amount: 3900000,
      walletId: `${prefix}w_bca`,
      categoryId: 'cat_belanja',
      categoryName: 'Belanja Harian',
      budgetGroup: 'needs',
      date: `${prevMonth2}-15`,
      note: 'Belanja bulanan',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sampleBudgets: BudgetItem[] = [
    {
      id: `${prefix}b_1`,
      accountId,
      month: currMonth,
      group: 'needs',
      categoryId: 'cat_makan',
      categoryName: 'Makan & Minum',
      limitAmount: 2000000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}b_2`,
      accountId,
      month: currMonth,
      group: 'needs',
      categoryId: 'cat_tagihan',
      categoryName: 'Tagihan & Utilitas',
      limitAmount: 1500000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}b_3`,
      accountId,
      month: currMonth,
      group: 'wants',
      categoryId: 'cat_hiburan',
      categoryName: 'Hiburan & Jajan',
      limitAmount: 1000000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}b_4`,
      accountId,
      month: currMonth,
      group: 'savings',
      categoryId: 'cat_tabungan',
      categoryName: 'Setor Tabungan',
      limitAmount: 2000000,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sampleGoals: FinancialGoal[] = [
    {
      id: `${prefix}g_1`,
      accountId,
      name: 'Dana Darurat 6 Bulan',
      category: 'emergency',
      targetAmount: 30000000,
      currentAmount: 18000000,
      deadline: `${currMonth.slice(0, 4)}-12-31`,
      note: 'Cadangan wajib keluarga',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}g_2`,
      accountId,
      name: 'Motor Listrik Harian',
      category: 'vehicle',
      targetAmount: 22000000,
      currentAmount: 8500000,
      deadline: `${Number(currMonth.slice(0, 4)) + 1}-06-30`,
      note: 'Hemat biaya transport',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sampleAssetsDebts: AssetDebtItem[] = [
    {
      id: `${prefix}ad_1`,
      accountId,
      kind: 'asset',
      subtype: 'investment',
      assetTypeId: 'type_investment',
      name: 'Reksa Dana Pasar Uang',
      amount: 14500000,
      note: 'Investasi jangka menengah',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}ad_2`,
      accountId,
      kind: 'asset',
      subtype: 'liquid',
      assetTypeId: 'type_liquid',
      name: 'Logam Mulia 5 Gram',
      amount: 7250000,
      note: 'Simpanan fisik',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${prefix}ad_3`,
      accountId,
      kind: 'debt',
      subtype: 'installment',
      name: 'Cicilan Laptop Kerja',
      amount: 3600000,
      monthlyInstallment: 600000,
      dueDateDay: 25,
      note: 'Sisa 6 bulan',
      createdAt: now,
      updatedAt: now,
    },
  ];

  await restoreBackupJSON(
    JSON.stringify({
      data: {
        wallets: sampleWallets,
        transactions: sampleTxs,
        budgets: sampleBudgets,
        goals: sampleGoals,
        assetsDebts: sampleAssetsDebts,
        customCategories: [],
      },
    }),
    accountId
  );
}

// ================================
// PROFIL PENGGUNA (TAHAP 2 & 3)
// ================================

export function createDefaultUserProfile(profileId = DEFAULT_ACCOUNT_ID): UserProfile {
  return {
    id: profileId,
    displayName: '',
    username: '',
    avatarDataUrl: null,
    bio: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export async function loadUserProfile(profileId = DEFAULT_ACCOUNT_ID): Promise<UserProfile> {
  try {
    const db = await openDB();
    const metaItems = await getAll<MetaRecord<UserProfile>>(db, STORES.META);
    const found = metaItems.find((item) => item.key === `profile:${profileId}`);
    if (!found || !found.value) {
      return createDefaultUserProfile(profileId);
    }
    return {
      id: profileId,
      displayName: String(found.value.displayName || ''),
      username: String(found.value.username || ''),
      avatarDataUrl:
        typeof found.value.avatarDataUrl === 'string' &&
        found.value.avatarDataUrl.startsWith('data:image/')
          ? found.value.avatarDataUrl
          : null,
      bio: typeof found.value.bio === 'string' ? found.value.bio : '',
      updatedAt: String(found.value.updatedAt || new Date().toISOString()),
    };
  } catch {
    return createDefaultUserProfile(profileId);
  }
}

export async function saveUserProfile(
  patch: {
    displayName: string;
    username: string;
    avatarDataUrl?: string | null;
    bio?: string;
  },
  profileId = DEFAULT_ACCOUNT_ID
): Promise<UserProfile> {
  const cleanName = patch.displayName.trim();
  if (!cleanName) {
    throw new Error('Nama tampilan tidak boleh kosong.');
  }
  if (cleanName.length > 60) {
    throw new Error('Nama tampilan maksimal 60 karakter.');
  }

  let normalizedUsername = '';
  if (patch.username.trim().length > 0) {
    const uCheck = validateUsernameFormat(patch.username);
    if (!uCheck.valid) {
      throw new Error(uCheck.error || 'Format username tidak valid.');
    }
    normalizedUsername = uCheck.normalized;
  }

  const db = await openDB();
  const [metaItems, accounts] = await Promise.all([
    getAll<MetaRecord<UserProfile>>(db, STORES.META),
    getAll<LocalAccount>(db, STORES.ACCOUNTS),
  ]);

  const linkedAccount = accounts.find((a) => a.id === profileId);
  if (linkedAccount && !normalizedUsername) {
    throw new Error('Akun lokal memerlukan username unik.');
  }

  // Enforce username uniqueness across local accounts and saved profiles
  if (normalizedUsername) {
    for (const acc of accounts) {
      if (acc.id !== profileId && acc.username.toLowerCase() === normalizedUsername) {
        throw new Error(`Username "@${normalizedUsername}" sudah digunakan oleh akun lokal lain.`);
      }
    }
    for (const item of metaItems) {
      if (!item.key.startsWith('profile:')) continue;
      const otherId = item.key.slice('profile:'.length);
      if (otherId === profileId) continue;
      if ((item.value?.username || '').toLowerCase() === normalizedUsername) {
        throw new Error(`Username "@${normalizedUsername}" sudah digunakan oleh profil lokal lain.`);
      }
    }
  }

  const existing = metaItems.find((item) => item.key === `profile:${profileId}`)?.value;
  const nextProfile: UserProfile = {
    id: profileId,
    displayName: cleanName,
    username: normalizedUsername,
    avatarDataUrl:
      patch.avatarDataUrl !== undefined
        ? patch.avatarDataUrl
        : existing?.avatarDataUrl ?? null,
    bio: patch.bio !== undefined ? patch.bio.trim().slice(0, 140) : existing?.bio ?? '',
    updatedAt: new Date().toISOString(),
  };

  const storesToWrite = linkedAccount ? [STORES.META, STORES.ACCOUNTS] : [STORES.META];
  const tx = db.transaction(storesToWrite, 'readwrite');
  tx.objectStore(STORES.META).put({
    key: `profile:${profileId}`,
    value: nextProfile,
  });

  if (linkedAccount) {
    tx.objectStore(STORES.ACCOUNTS).put({
      ...linkedAccount,
      displayName: nextProfile.displayName,
      username: nextProfile.username,
      updatedAt: nextProfile.updatedAt,
    });
  }

  await txDone(tx);
  return nextProfile;
}

export async function removeUserAvatar(profileId = DEFAULT_ACCOUNT_ID): Promise<UserProfile> {
  const current = await loadUserProfile(profileId);
  const nextProfile: UserProfile = {
    ...current,
    avatarDataUrl: null,
    updatedAt: new Date().toISOString(),
  };
  const db = await openDB();
  const tx = db.transaction(STORES.META, 'readwrite');
  tx.objectStore(STORES.META).put({
    key: `profile:${profileId}`,
    value: nextProfile,
  });
  await txDone(tx);
  return nextProfile;
}

// =======================================
// SISTEM AKUN LOKAL & OFFLINE LOGIN (TAHAP 3)
// =======================================

export function loadLocalSession(): LocalAuthSession {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { activeAccountId: null, locked: false, lastActiveAt: Date.now() };
    }
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { activeAccountId: null, locked: false, lastActiveAt: Date.now() };
    const parsed = JSON.parse(raw) as Partial<LocalAuthSession>;
    return {
      activeAccountId: typeof parsed.activeAccountId === 'string' ? parsed.activeAccountId : null,
      locked: Boolean(parsed.locked),
      lastActiveAt: Number.isFinite(parsed.lastActiveAt) ? Number(parsed.lastActiveAt) : Date.now(),
    };
  } catch {
    return { activeAccountId: null, locked: false, lastActiveAt: Date.now() };
  }
}

export function saveLocalSession(session: LocalAuthSession): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export async function listLocalAccounts(): Promise<LocalAccount[]> {
  try {
    const db = await openDB();
    const list = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
    return [...list].sort((a, b) => b.lastLoginAt.localeCompare(a.lastLoginAt));
  } catch {
    return [];
  }
}

export async function countLegacyUnclaimedData(): Promise<{
  wallets: number;
  transactions: number;
  budgets: number;
  goals: number;
  assetsDebts: number;
  total: number;
}> {
  const legacy = await loadAllData(DEFAULT_ACCOUNT_ID);
  const total =
    legacy.wallets.length +
    legacy.transactions.length +
    legacy.budgets.length +
    legacy.goals.length +
    legacy.assetsDebts.length;
  return {
    wallets: legacy.wallets.length,
    transactions: legacy.transactions.length,
    budgets: legacy.budgets.length,
    goals: legacy.goals.length,
    assetsDebts: legacy.assetsDebts.length,
    total,
  };
}

export async function claimLegacyDataToAccount(accountId: string): Promise<void> {
  const db = await openDB();
  const [wallets, txs, budgets, goals, assetsDebts, customCats, metaItems] = await Promise.all([
    getAll<Wallet>(db, STORES.WALLETS),
    getAll<Transaction>(db, STORES.TRANSACTIONS),
    getAll<BudgetItem>(db, STORES.BUDGETS),
    getAll<FinancialGoal>(db, STORES.GOALS),
    getAll<AssetDebtItem>(db, STORES.ASSETS_DEBTS),
    getAll<CategoryDef>(db, STORES.CUSTOM_CATEGORIES),
    getAll<MetaRecord<UserProfile>>(db, STORES.META),
  ]);

  const legacyProfile = metaItems.find(
    (m) => m.key === `profile:${DEFAULT_ACCOUNT_ID}`
  )?.value;
  const targetProfile = metaItems.find((m) => m.key === `profile:${accountId}`)?.value;

  const storeNames = [
    STORES.WALLETS,
    STORES.TRANSACTIONS,
    STORES.BUDGETS,
    STORES.GOALS,
    STORES.ASSETS_DEBTS,
    STORES.CUSTOM_CATEGORIES,
    STORES.META,
  ];
  const tx = db.transaction(storeNames, 'readwrite');

  for (const i of wallets) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.WALLETS).put({ ...i, accountId });
    }
  }
  for (const i of txs) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.TRANSACTIONS).put({ ...i, accountId });
    }
  }
  for (const i of budgets) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.BUDGETS).put({ ...i, accountId });
    }
  }
  for (const i of goals) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.GOALS).put({ ...i, accountId });
    }
  }
  for (const i of assetsDebts) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.ASSETS_DEBTS).put({ ...i, accountId });
    }
  }
  for (const i of customCats) {
    if (belongsToAccount(i, DEFAULT_ACCOUNT_ID)) {
      tx.objectStore(STORES.CUSTOM_CATEGORIES).put({ ...i, accountId });
    }
  }

  // Carry over legacy avatar/bio cleanly if target profile doesn't have an avatar yet
  if (legacyProfile && targetProfile) {
    tx.objectStore(STORES.META).put({
      key: `profile:${accountId}`,
      value: {
        ...targetProfile,
        avatarDataUrl: targetProfile.avatarDataUrl || legacyProfile.avatarDataUrl || null,
        bio: targetProfile.bio || legacyProfile.bio || '',
      },
    });
  }

  await txDone(tx);

  // Copy Local Storage theme, preferences, and custom asset colors cleanly
  copyLegacyThemeAndPrefsToAccount(accountId);
  copyLegacyAssetColorsToAccount(accountId);
}

export async function registerLocalAccount(params: {
  displayName: string;
  username: string;
  password: string;
  pin?: string;
  claimLegacyData?: boolean;
}): Promise<{ account: LocalAccount; profile: UserProfile }> {
  const cleanName = params.displayName.trim();
  if (!cleanName) {
    throw new Error('Nama tampilan tidak boleh kosong.');
  }
  if (cleanName.length > 60) {
    throw new Error('Nama tampilan maksimal 60 karakter.');
  }

  const uCheck = validateUsernameFormat(params.username);
  if (!uCheck.valid) {
    throw new Error(uCheck.error || 'Format username tidak valid.');
  }
  const normalizedUsername = uCheck.normalized;

  const pCheck = validatePasswordStrength(params.password);
  if (!pCheck.valid) {
    throw new Error(pCheck.error || 'Password tidak memenuhi syarat.');
  }

  let pinData: { hash: string; salt: string } | null = null;
  if (params.pin && params.pin.trim().length > 0) {
    const pinCheck = validatePinFormat(params.pin);
    if (!pinCheck.valid) {
      throw new Error(pinCheck.error || 'Format PIN tidak valid.');
    }
    const hashedPin = await hashSecret(params.pin.trim());
    pinData = { hash: hashedPin.hash, salt: hashedPin.salt };
  }

  const db = await openDB();
  const [accounts, metaItems] = await Promise.all([
    getAll<LocalAccount>(db, STORES.ACCOUNTS),
    getAll<MetaRecord<UserProfile>>(db, STORES.META),
  ]);

  if (accounts.some((a) => a.username.toLowerCase() === normalizedUsername)) {
    throw new Error(`Username "@${normalizedUsername}" sudah terdaftar di perangkat ini.`);
  }
  for (const item of metaItems) {
    if (!item.key.startsWith('profile:')) continue;
    const otherId = item.key.slice('profile:'.length);
    if (otherId === DEFAULT_ACCOUNT_ID && params.claimLegacyData) continue;
    if ((item.value?.username || '').toLowerCase() === normalizedUsername) {
      throw new Error(`Username "@${normalizedUsername}" sudah digunakan oleh profil lain.`);
    }
  }

  const hashedPw = await hashSecret(params.password);
  const now = new Date().toISOString();
  const accountId = generateId('acc');

  const account: LocalAccount = {
    id: accountId,
    username: normalizedUsername,
    displayName: cleanName,
    passwordHash: hashedPw.hash,
    passwordSalt: hashedPw.salt,
    iterations: hashedPw.iterations,
    pinHash: pinData?.hash ?? null,
    pinSalt: pinData?.salt ?? null,
    autoLockMinutes: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  const legacyProfile = params.claimLegacyData
    ? metaItems.find((m) => m.key === `profile:${DEFAULT_ACCOUNT_ID}`)?.value
    : undefined;

  const profile: UserProfile = {
    id: accountId,
    displayName: cleanName,
    username: normalizedUsername,
    avatarDataUrl: legacyProfile?.avatarDataUrl ?? null,
    bio: legacyProfile?.bio ?? '',
    updatedAt: now,
  };

  const tx = db.transaction([STORES.ACCOUNTS, STORES.META], 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(account);
  tx.objectStore(STORES.META).put({
    key: `profile:${accountId}`,
    value: profile,
  });
  await txDone(tx);

  if (params.claimLegacyData) {
    await claimLegacyDataToAccount(accountId);
  }

  return { account, profile };
}

export async function authenticateLocalAccount(
  usernameInput: string,
  password: string
): Promise<LocalAccount> {
  const normalized = usernameInput.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Masukkan username akun Anda.');
  }
  if (!password) {
    throw new Error('Masukkan password akun Anda.');
  }

  const db = await openDB();
  const accounts = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
  const found = accounts.find((a) => a.username.toLowerCase() === normalized);
  if (!found) {
    throw new Error('Username tidak ditemukan pada perangkat ini.');
  }

  const ok = await verifySecret(password, found.passwordHash, found.passwordSalt, found.iterations);
  if (!ok) {
    throw new Error('Password yang Anda masukkan salah.');
  }

  const updated: LocalAccount = {
    ...found,
    lastLoginAt: new Date().toISOString(),
  };
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}

export async function verifyAccountPassword(
  accountId: string,
  password: string
): Promise<LocalAccount> {
  if (!password) throw new Error('Masukkan password Anda.');
  const db = await openDB();
  const accounts = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
  const found = accounts.find((a) => a.id === accountId);
  if (!found) throw new Error('Akun lokal tidak ditemukan.');

  const ok = await verifySecret(password, found.passwordHash, found.passwordSalt, found.iterations);
  if (!ok) throw new Error('Password salah.');

  const updated: LocalAccount = { ...found, lastLoginAt: new Date().toISOString() };
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}

export async function verifyAccountPin(accountId: string, pin: string): Promise<LocalAccount> {
  const trimmed = pin.trim();
  if (!trimmed) throw new Error('Masukkan PIN keamanan.');

  const db = await openDB();
  const accounts = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
  const found = accounts.find((a) => a.id === accountId);
  if (!found) throw new Error('Akun lokal tidak ditemukan.');
  if (!found.pinHash || !found.pinSalt) {
    throw new Error('Akun ini belum mengaktifkan PIN keamanan.');
  }

  const ok = await verifySecret(trimmed, found.pinHash, found.pinSalt, found.iterations);
  if (!ok) throw new Error('PIN keamanan salah.');

  const updated: LocalAccount = { ...found, lastLoginAt: new Date().toISOString() };
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}

export async function updateAccountPassword(
  accountId: string,
  currentPassword: string,
  newPassword: string
): Promise<LocalAccount> {
  const found = await verifyAccountPassword(accountId, currentPassword);
  const check = validatePasswordStrength(newPassword);
  if (!check.valid) throw new Error(check.error || 'Password baru tidak memenuhi syarat.');

  const hashed = await hashSecret(newPassword);
  const updated: LocalAccount = {
    ...found,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    iterations: hashed.iterations,
    updatedAt: new Date().toISOString(),
  };

  const db = await openDB();
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}

export async function updateAccountPin(
  accountId: string,
  newPin: string | null
): Promise<LocalAccount> {
  const db = await openDB();
  const accounts = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
  const found = accounts.find((a) => a.id === accountId);
  if (!found) throw new Error('Akun lokal tidak ditemukan.');

  let pinHash: string | null = null;
  let pinSalt: string | null = null;
  if (newPin !== null && newPin.trim().length > 0) {
    const check = validatePinFormat(newPin);
    if (!check.valid) throw new Error(check.error || 'Format PIN tidak valid.');
    const hashed = await hashSecret(newPin.trim());
    pinHash = hashed.hash;
    pinSalt = hashed.salt;
  }

  const updated: LocalAccount = {
    ...found,
    pinHash,
    pinSalt,
    updatedAt: new Date().toISOString(),
  };
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}

export async function updateAccountAutoLock(
  accountId: string,
  autoLockMinutes: number
): Promise<LocalAccount> {
  const db = await openDB();
  const accounts = await getAll<LocalAccount>(db, STORES.ACCOUNTS);
  const found = accounts.find((a) => a.id === accountId);
  if (!found) throw new Error('Akun lokal tidak ditemukan.');

  const safeMinutes = Math.max(0, Math.min(120, Math.round(autoLockMinutes)));
  const updated: LocalAccount = {
    ...found,
    autoLockMinutes: safeMinutes,
    updatedAt: new Date().toISOString(),
  };
  const tx = db.transaction(STORES.ACCOUNTS, 'readwrite');
  tx.objectStore(STORES.ACCOUNTS).put(updated);
  await txDone(tx);
  return updated;
}
