import type {
  AppPreferences,
  ThemeColorTokens,
  ThemeConfig,
  ThemeMode,
  ThemePresetId,
} from '../types/finance';
import { normalizeHexColor } from './assetColors';

export const THEME_STORAGE_KEY = 'my_money_theme_v1';
export const PREFS_STORAGE_KEY = 'my_money_prefs_v1';

export function getThemeStorageKey(accountId?: string): string {
  return !accountId || accountId === 'local_default'
    ? THEME_STORAGE_KEY
    : `${THEME_STORAGE_KEY}:${accountId}`;
}

export function getPrefsStorageKey(accountId?: string): string {
  return !accountId || accountId === 'local_default'
    ? PREFS_STORAGE_KEY
    : `${PREFS_STORAGE_KEY}:${accountId}`;
}

export function copyLegacyThemeAndPrefsToAccount(accountId: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const targetTheme = getThemeStorageKey(accountId);
    const targetPrefs = getPrefsStorageKey(accountId);
    const legacyTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (legacyTheme && !window.localStorage.getItem(targetTheme)) {
      window.localStorage.setItem(targetTheme, legacyTheme);
    }
    const legacyPrefs = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (legacyPrefs && !window.localStorage.getItem(targetPrefs)) {
      window.localStorage.setItem(targetPrefs, legacyPrefs);
    }
  } catch {
    // Ignore storage errors
  }
}

export interface ThemePresetDefinition {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  description: string;
  baseMode: 'dark' | 'light';
  colors: ThemeColorTokens;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Charcoal gelap & zamrud klasik MY MONEY',
    baseMode: 'dark',
    colors: {
      bgPrimary: '#070B14',
      bgSecondary: '#0B1120',
      surface: '#0F1629',
      primary: '#7C3AED',
      secondary: '#EC4899',
      accent: '#10B981',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#1E293B',
      income: '#10B981',
      expense: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    description: 'Abu-abu gelap modern & aksen perak',
    baseMode: 'dark',
    colors: {
      bgPrimary: '#111317',
      bgSecondary: '#171A20',
      surface: '#1E222A',
      primary: '#6366F1',
      secondary: '#64748B',
      accent: '#E2E8F0',
      textPrimary: '#F1F5F9',
      textSecondary: '#9CA3AF',
      border: '#2D3340',
      income: '#22C55E',
      expense: '#F43F5E',
      warning: '#F59E0B',
      success: '#22C55E',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Biru laut dalam & biru elektrik',
    baseMode: 'dark',
    colors: {
      bgPrimary: '#050E1D',
      bgSecondary: '#0A1629',
      surface: '#0F203A',
      primary: '#2563EB',
      secondary: '#06B6D4',
      accent: '#38BDF8',
      textPrimary: '#F0F9FF',
      textSecondary: '#93C5FD',
      border: '#1E3A5F',
      income: '#10B981',
      expense: '#FB7185',
      warning: '#FBBF24',
      success: '#34D399',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Hijau hutan gelap & mint segar',
    baseMode: 'dark',
    colors: {
      bgPrimary: '#06130E',
      bgSecondary: '#0A1C15',
      surface: '#10281E',
      primary: '#10B981',
      secondary: '#14B8A6',
      accent: '#6EE7B7',
      textPrimary: '#ECFDF5',
      textSecondary: '#A7F3D0',
      border: '#1B4332',
      income: '#34D399',
      expense: '#F87171',
      warning: '#FBBF24',
      success: '#10B981',
    },
  },
  {
    id: 'ivory',
    name: 'Ivory',
    description: 'Putih hangat & krem lembut nyaman di mata',
    baseMode: 'light',
    colors: {
      bgPrimary: '#FAF7F2',
      bgSecondary: '#F2ECE1',
      surface: '#FFFFFF',
      primary: '#7C3AED',
      secondary: '#D97706',
      accent: '#0D9488',
      textPrimary: '#1F2937',
      textSecondary: '#57534E',
      border: '#E2D9CA',
      income: '#059669',
      expense: '#DC2626',
      warning: '#D97706',
      success: '#16A34A',
    },
  },
  {
    id: 'minimal_light',
    name: 'Minimal Light',
    description: 'Putih bersih & slate tegas profesional',
    baseMode: 'light',
    colors: {
      bgPrimary: '#F8FAFC',
      bgSecondary: '#F1F5F9',
      surface: '#FFFFFF',
      primary: '#4F46E5',
      secondary: '#0EA5E9',
      accent: '#7C3AED',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      border: '#CBD5E1',
      income: '#059669',
      expense: '#DC2626',
      warning: '#D97706',
      success: '#16A34A',
    },
  },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'dark',
  presetId: 'midnight',
  colors: { ...THEME_PRESETS[0].colors },
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  dateFormat: 'relative',
  budgetAlertThresholdPct: 80,
  notificationsEnabled: false,
  dailyReminderEnabled: false,
  dailyReminderTime: '20:00',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export interface ThemeColorFieldMeta {
  key: keyof ThemeColorTokens;
  label: string;
  hint: string;
  group: 'dasar' | 'merek' | 'teks' | 'semantik';
}

export const THEME_COLOR_FIELDS: ThemeColorFieldMeta[] = [
  { key: 'bgPrimary', label: 'Background Utama', hint: 'Latar belakang utama aplikasi', group: 'dasar' },
  { key: 'bgSecondary', label: 'Background Sekunder', hint: 'Sidebar, header & bilah navigasi', group: 'dasar' },
  { key: 'surface', label: 'Surface / Card', hint: 'Kartu ringkasan, modal & panel', group: 'dasar' },
  { key: 'border', label: 'Border', hint: 'Garis batas kartu & input', group: 'dasar' },
  { key: 'primary', label: 'Primary (Tombol Utama)', hint: 'Tombol utama & elemen aktif', group: 'merek' },
  { key: 'secondary', label: 'Secondary', hint: 'Gradien & tombol pendamping', group: 'merek' },
  { key: 'accent', label: 'Accent / Highlight', hint: 'Sorotan khusus & ikon aksen', group: 'merek' },
  { key: 'textPrimary', label: 'Teks Utama', hint: 'Judul, angka utama & teks pokok', group: 'teks' },
  { key: 'textSecondary', label: 'Teks Sekunder', hint: 'Subjudul, label & keterangan', group: 'teks' },
  { key: 'income', label: 'Income (Pemasukan)', hint: 'Nominal & grafik pemasukan', group: 'semantik' },
  { key: 'expense', label: 'Expense (Pengeluaran)', hint: 'Nominal & grafik pengeluaran', group: 'semantik' },
  { key: 'warning', label: 'Warning (Peringatan)', hint: 'Mendekati batas anggaran & status offline', group: 'semantik' },
  { key: 'success', label: 'Success (Berhasil)', hint: 'Status aman, target tercapai & konfirmasi', group: 'semantik' },
];

export function getPresetById(id: ThemePresetId): ThemePresetDefinition | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const norm = normalizeHexColor(hex);
  if (!norm) return null;
  const clean = norm.slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;
  const w = Math.max(0, Math.min(1, weightB));
  return rgbToHex(
    a.r * (1 - w) + b.r * w,
    a.g * (1 - w) + b.g * w,
    a.b * (1 - w) + b.b * w
  );
}

export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = getRelativeLuminance(hexA);
  const l2 = getRelativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableForeground(bgHex: string): string {
  const whiteContrast = getContrastRatio(bgHex, '#FFFFFF');
  const darkContrast = getContrastRatio(bgHex, '#0F172A');
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#0F172A';
}

export function isDarkColor(hex: string): boolean {
  return getRelativeLuminance(hex) < 0.36;
}

export interface ContrastWarning {
  id: string;
  label: string;
  ratio: number;
  required: number;
}

export function evaluateThemeContrast(colors: ThemeColorTokens): ContrastWarning[] {
  const warnings: ContrastWarning[] = [];

  const textOnBg = getContrastRatio(colors.bgPrimary, colors.textPrimary);
  if (textOnBg < 4.5) {
    warnings.push({
      id: 'bg_text',
      label: 'Teks Utama vs Background Utama terlalu rendah',
      ratio: textOnBg,
      required: 4.5,
    });
  }

  const textOnSurface = getContrastRatio(colors.surface, colors.textPrimary);
  if (textOnSurface < 4.5) {
    warnings.push({
      id: 'surface_text',
      label: 'Teks Utama vs Surface / Card terlalu rendah',
      ratio: textOnSurface,
      required: 4.5,
    });
  }

  const mutedOnSurface = getContrastRatio(colors.surface, colors.textSecondary);
  if (mutedOnSurface < 3.0) {
    warnings.push({
      id: 'surface_muted',
      label: 'Teks Sekunder vs Surface / Card kurang jelas',
      ratio: mutedOnSurface,
      required: 3.0,
    });
  }

  return warnings;
}

export function repairThemeContrast(colors: ThemeColorTokens): ThemeColorTokens {
  const darkSurface = isDarkColor(colors.surface);
  const next = { ...colors };

  if (getContrastRatio(next.surface, next.textPrimary) < 4.5 || getContrastRatio(next.bgPrimary, next.textPrimary) < 4.5) {
    next.textPrimary = darkSurface ? '#F8FAFC' : '#0F172A';
  }
  if (getContrastRatio(next.surface, next.textSecondary) < 3.5) {
    next.textSecondary = darkSurface ? '#94A3B8' : '#475569';
  }
  if (getContrastRatio(next.surface, next.border) < 1.15) {
    next.border = darkSurface ? mixHex(next.surface, '#FFFFFF', 0.14) : mixHex(next.surface, '#0F172A', 0.16);
  }
  return next;
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveTheme(
  config: ThemeConfig,
  systemPrefersDark: boolean = getSystemPrefersDark()
): { isDark: boolean; colors: ThemeColorTokens } {
  if (config.mode === 'system') {
    if (config.presetId !== 'custom') {
      const preset = getPresetById(config.presetId);
      if (preset && preset.baseMode === (systemPrefersDark ? 'dark' : 'light')) {
        return { isDark: systemPrefersDark, colors: { ...preset.colors } };
      }
      const fallbackPreset = systemPrefersDark ? THEME_PRESETS[0] : THEME_PRESETS[5];
      return { isDark: systemPrefersDark, colors: { ...fallbackPreset.colors } };
    }
    return {
      isDark: isDarkColor(config.colors.bgPrimary),
      colors: { ...config.colors },
    };
  }

  return {
    isDark: isDarkColor(config.colors.bgPrimary),
    colors: { ...config.colors },
  };
}

export function applyThemeToDocument(
  config: ThemeConfig,
  systemPrefersDark: boolean = getSystemPrefersDark()
): { isDark: boolean; colors: ThemeColorTokens } {
  const resolved = resolveEffectiveTheme(config, systemPrefersDark);
  const { isDark, colors } = resolved;

  if (typeof document === 'undefined') return resolved;

  const root = document.documentElement;
  const surfaceHover = isDark
    ? mixHex(colors.surface, '#FFFFFF', 0.06)
    : mixHex(colors.surface, '#0F172A', 0.05);
  const surfaceElevated = isDark
    ? mixHex(colors.surface, '#FFFFFF', 0.09)
    : mixHex(colors.bgSecondary, '#FFFFFF', 0.55);
  const primaryFg = getReadableForeground(colors.primary);
  const secondaryFg = getReadableForeground(colors.secondary);
  const chartGrid = isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(15, 23, 42, 0.10)';

  root.style.setProperty('--mm-bg-primary', colors.bgPrimary);
  root.style.setProperty('--mm-bg-secondary', colors.bgSecondary);
  root.style.setProperty('--mm-surface', colors.surface);
  root.style.setProperty('--mm-surface-hover', surfaceHover);
  root.style.setProperty('--mm-surface-elevated', surfaceElevated);
  root.style.setProperty('--mm-primary', colors.primary);
  root.style.setProperty('--mm-primary-fg', primaryFg);
  root.style.setProperty('--mm-secondary', colors.secondary);
  root.style.setProperty('--mm-secondary-fg', secondaryFg);
  root.style.setProperty('--mm-accent', colors.accent);
  root.style.setProperty('--mm-text-primary', colors.textPrimary);
  root.style.setProperty('--mm-text-secondary', colors.textSecondary);
  root.style.setProperty('--mm-border', colors.border);
  root.style.setProperty('--mm-income', colors.income);
  root.style.setProperty('--mm-expense', colors.expense);
  root.style.setProperty('--mm-warning', colors.warning);
  root.style.setProperty('--mm-success', colors.success);
  root.style.setProperty('--mm-chart-grid', chartGrid);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', colors.bgPrimary);
  }

  return resolved;
}

export function sanitizeThemeColors(
  raw: Partial<ThemeColorTokens> | undefined,
  fallback: ThemeColorTokens = DEFAULT_THEME_CONFIG.colors
): ThemeColorTokens {
  const pick = (val: unknown, fb: string): string => {
    if (typeof val !== 'string') return fb;
    return normalizeHexColor(val) ?? fb;
  };
  return {
    bgPrimary: pick(raw?.bgPrimary, fallback.bgPrimary),
    bgSecondary: pick(raw?.bgSecondary, fallback.bgSecondary),
    surface: pick(raw?.surface, fallback.surface),
    primary: pick(raw?.primary, fallback.primary),
    secondary: pick(raw?.secondary, fallback.secondary),
    accent: pick(raw?.accent, fallback.accent),
    textPrimary: pick(raw?.textPrimary, fallback.textPrimary),
    textSecondary: pick(raw?.textSecondary, fallback.textSecondary),
    border: pick(raw?.border, fallback.border),
    income: pick(raw?.income, fallback.income),
    expense: pick(raw?.expense, fallback.expense),
    warning: pick(raw?.warning, fallback.warning),
    success: pick(raw?.success, fallback.success),
  };
}

export function loadThemeFromStorage(accountId?: string): ThemeConfig {
  const storageKey = getThemeStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_THEME_CONFIG;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ThemeConfig>;
    const mode: ThemeMode =
      parsed.mode === 'dark' || parsed.mode === 'light' || parsed.mode === 'system'
        ? parsed.mode
        : DEFAULT_THEME_CONFIG.mode;
    const validPresetIds: ThemePresetId[] = [
      'midnight',
      'graphite',
      'ocean',
      'forest',
      'ivory',
      'minimal_light',
      'custom',
    ];
    const presetId: ThemePresetId = validPresetIds.includes(parsed.presetId as ThemePresetId)
      ? (parsed.presetId as ThemePresetId)
      : 'custom';
    const baseColors = getPresetById(presetId)?.colors ?? DEFAULT_THEME_CONFIG.colors;
    return {
      mode,
      presetId,
      colors: sanitizeThemeColors(parsed.colors, baseColors),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

export function saveThemeToStorage(config: ThemeConfig, accountId?: string): void {
  const storageKey = getThemeStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(storageKey, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadPreferencesFromStorage(accountId?: string): AppPreferences {
  const storageKey = getPrefsStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_APP_PREFERENCES;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_APP_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    const dateFormat =
      parsed.dateFormat === 'relative' ||
      parsed.dateFormat === 'short' ||
      parsed.dateFormat === 'slash' ||
      parsed.dateFormat === 'iso'
        ? parsed.dateFormat
        : DEFAULT_APP_PREFERENCES.dateFormat;

    const threshold = Number(parsed.budgetAlertThresholdPct);
    const budgetAlertThresholdPct =
      Number.isFinite(threshold) && threshold >= 50 && threshold <= 100
        ? Math.round(threshold)
        : DEFAULT_APP_PREFERENCES.budgetAlertThresholdPct;

    return {
      dateFormat,
      budgetAlertThresholdPct,
      notificationsEnabled: Boolean(parsed.notificationsEnabled),
      dailyReminderEnabled: Boolean(parsed.dailyReminderEnabled),
      dailyReminderTime:
        typeof parsed.dailyReminderTime === 'string' && /^\d{2}:\d{2}$/.test(parsed.dailyReminderTime)
          ? parsed.dailyReminderTime
          : DEFAULT_APP_PREFERENCES.dailyReminderTime,
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function savePreferencesToStorage(prefs: AppPreferences, accountId?: string): void {
  const storageKey = getPrefsStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors cleanly
  }
}
