import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { CategoryDef, Transaction, TransactionType, Wallet } from '../types/finance';
import { formatDateID, formatIDR, formatMonthLabel } from '../utils/format';

interface TransactionsViewProps {
  selectedMonth: string;
  transactions: Transaction[];
  wallets: Wallet[];
  categories: CategoryDef[];
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  selectedMonth,
  transactions,
  wallets,
  categories,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [monthFilter, setMonthFilter] = useState<string>(selectedMonth);
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const walletMap = useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>([selectedMonth]);
    for (const t of transactions) {
      if (t.date && t.date.length >= 7) {
        set.add(t.date.slice(0, 7));
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (monthFilter !== 'all' && !t.date.startsWith(monthFilter)) return false;
      if (walletFilter !== 'all' && t.walletId !== walletFilter && t.toWalletId !== walletFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;

      if (q) {
        const wName = walletMap.get(t.walletId)?.name.toLowerCase() ?? '';
        const toName = t.toWalletId ? walletMap.get(t.toWalletId)?.name.toLowerCase() ?? '' : '';
        const match =
          t.note.toLowerCase().includes(q) ||
          t.categoryName.toLowerCase().includes(q) ||
          wName.includes(q) ||
          toName.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, monthFilter, walletFilter, categoryFilter, search, walletMap]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;
    for (const t of filteredTransactions) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      else transfer += t.amount;
    }
    return { income, expense, transfer };
  }, [filteredTransactions]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: Transaction[] }> = [];
    let currentDate = '';
    for (const tx of filteredTransactions) {
      if (tx.date !== currentDate) {
        currentDate = tx.date;
        groups.push({ date: currentDate, items: [tx] });
      } else {
        groups[groups.length - 1].items.push(tx);
      }
    }
    return groups;
  }, [filteredTransactions]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-mm-text">
            Riwayat Transaksi
          </h1>
          <p className="text-xs sm:text-sm text-mm-muted">
            Seluruh pemasukan, pengeluaran, dan transfer antar-dompet tercatat akurat.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewTransaction}
          className="min-h-[44px] px-4 rounded-xl mm-btn-primary text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Transaksi</span>
        </button>
      </div>

      {/* Ringkasan Hasil Filter */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Total Pemasukan</p>
          <p className="mt-1 text-lg font-bold text-mm-income font-mono-num">
            {formatIDR(summary.income)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Total Pengeluaran</p>
          <p className="mt-1 text-lg font-bold text-mm-expense font-mono-num">
            {formatIDR(summary.expense)}
          </p>
        </div>
        <div className="rounded-2xl bg-mm-surface border border-mm-border p-4">
          <p className="text-xs text-mm-muted">Volume Transfer</p>
          <p className="mt-1 text-lg font-bold text-mm-brand font-mono-num">
            {formatIDR(summary.transfer)}
          </p>
        </div>
      </section>

      {/* Filter & Pencarian */}
      <section className="rounded-2xl bg-mm-surface border border-mm-border p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-mm-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari catatan, kategori, atau nama dompet..."
            className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-mm-bg border border-mm-border text-sm text-mm-text focus:outline-none focus:border-mm-brand"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionType)}
            className="min-h-[40px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-text focus:outline-none focus:border-mm-brand"
            aria-label="Filter jenis transaksi"
          >
            <option value="all">Semua Jenis</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
            <option value="transfer">Transfer</option>
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="min-h-[40px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-text focus:outline-none focus:border-mm-brand"
            aria-label="Filter bulan"
          >
            <option value="all">Semua Bulan</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>

          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="min-h-[40px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-text focus:outline-none focus:border-mm-brand"
            aria-label="Filter dompet"
          >
            <option value="all">Semua Dompet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] px-3 rounded-xl bg-mm-bg border border-mm-border text-xs text-mm-text focus:outline-none focus:border-mm-brand"
            aria-label="Filter kategori"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="transfer">Transfer Antar-Dompet</option>
          </select>
        </div>
      </section>

      {/* Daftar Transaksi */}
      {groupedByDate.length === 0 ? (
        <section className="rounded-2xl bg-mm-surface border border-mm-border p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-mm-text">Tidak ada transaksi ditemukan</p>
          <p className="text-xs text-mm-muted">
            Ubah kata kunci pencarian, pilih bulan lain, atau catat transaksi baru.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <section
              key={group.date}
              className="rounded-2xl bg-mm-surface border border-mm-border overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-mm-bg/75 border-b border-mm-border flex items-center justify-between text-xs">
                <span className="font-semibold text-mm-text">{formatDateID(group.date)}</span>
                <span className="text-mm-muted">{group.items.length} transaksi</span>
              </div>

              <div className="divide-y divide-mm-border">
                {group.items.map((tx) => {
                  const sourceName = walletMap.get(tx.walletId)?.name ?? 'Dompet';
                  const destName = tx.toWalletId
                    ? walletMap.get(tx.toWalletId)?.name ?? 'Tujuan'
                    : '';

                  return (
                    <div
                      key={tx.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-mm-hover transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            tx.type === 'income'
                              ? 'bg-mm-income/15 text-mm-income'
                              : tx.type === 'expense'
                                ? 'bg-mm-expense/15 text-mm-expense'
                                : 'bg-mm-brand/15 text-mm-brand'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : tx.type === 'expense' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-mm-text truncate">
                            {tx.note || tx.categoryName}
                          </p>
                          <p className="text-xs text-mm-muted truncate">
                            {tx.type === 'transfer'
                              ? `${sourceName} → ${destName}`
                              : `${tx.categoryName} · ${sourceName}`}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono-num ${
                            tx.type === 'income'
                              ? 'text-mm-income'
                              : tx.type === 'expense'
                                ? 'text-mm-expense'
                                : 'text-mm-brand'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                          {formatIDR(tx.amount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => void onDeleteTransaction(tx.id)}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-mm-muted hover:text-mm-expense hover:bg-mm-expense/10 flex items-center justify-center cursor-pointer"
                          aria-label={`Hapus transaksi ${tx.note || tx.categoryName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
