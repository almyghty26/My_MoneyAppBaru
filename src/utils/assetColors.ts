import { PRESET_COLORS } from '../constants/categories';
import type { AssetSubtype, AssetTypeDef } from '../types/finance';

const ASSET_TYPES_STORAGE_KEY = 'my_money_asset_types_v1';
const CUSTOM_COLORS_STORAGE_KEY = 'my_money_custom_colors_v1';

export function getAssetTypesStorageKey(accountId?: string): string {
  return !accountId || accountId === 'local_default'
    ? ASSET_TYPES_STORAGE_KEY
    : `${ASSET_TYPES_STORAGE_KEY}:${accountId}`;
}

export function getCustomColorsStorageKey(accountId?: string): string {
  return !accountId || accountId === 'local_default'
    ? CUSTOM_COLORS_STORAGE_KEY
    : `${CUSTOM_COLORS_STORAGE_KEY}:${accountId}`;
}

export function copyLegacyAssetColorsToAccount(accountId: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const targetTypesKey = getAssetTypesStorageKey(accountId);
    const targetColorsKey = getCustomColorsStorageKey(accountId);
    const legacyTypes = window.localStorage.getItem(ASSET_TYPES_STORAGE_KEY);
    if (legacyTypes && !window.localStorage.getItem(targetTypesKey)) {
      window.localStorage.setItem(targetTypesKey, legacyTypes);
    }
    const legacyColors = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    if (legacyColors && !window.localStorage.getItem(targetColorsKey)) {
      window.localStorage.setItem(targetColorsKey, legacyColors);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

export function isPresetColor(color: string): boolean {
  const normalized = normalizeHexColor(color);
  if (!normalized) return false;
  return PRESET_COLORS.some((c) => c.toUpperCase() === normalized);
}

export const ASSET_SUBTYPE_LABELS: Record<AssetSubtype, string> = {
  liquid: 'Aset Likuid',
  investment: 'Investasi',
  fixed: 'Aset Tetap',
};

export const DEFAULT_ASSET_TYPES: AssetTypeDef[] = [
  {
    id: 'type_liquid',
    name: 'Aset Likuid (Deposito / Emas Likuid)',
    subtype: 'liquid',
    color: '#10B981',
    isBuiltIn: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_investment',
    name: 'Investasi (Reksa Dana / Saham / SBN)',
    subtype: 'investment',
    color: '#8B5CF6',
    isBuiltIn: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'type_fixed',
    name: 'Aset Tetap (Properti / Kendaraan)',
    subtype: 'fixed',
    color: '#3B82F6',
    isBuiltIn: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export function loadAssetTypesFromStorage(accountId?: string): AssetTypeDef[] {
  const storageKey = getAssetTypesStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_ASSET_TYPES;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      window.localStorage.setItem(storageKey, JSON.stringify(DEFAULT_ASSET_TYPES));
      return DEFAULT_ASSET_TYPES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_ASSET_TYPES;
    }
    return parsed.map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Jenis Aset'),
      subtype:
        item.subtype === 'liquid' || item.subtype === 'investment' || item.subtype === 'fixed'
          ? item.subtype
          : 'liquid',
      color: normalizeHexColor(String(item.color || '')) ?? '#10B981',
      isBuiltIn: Boolean(item.isBuiltIn),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }));
  } catch {
    return DEFAULT_ASSET_TYPES;
  }
}

export function saveAssetTypesToStorage(types: AssetTypeDef[], accountId?: string): void {
  const storageKey = getAssetTypesStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(storageKey, JSON.stringify(types));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function loadCustomColorsFromStorage(accountId?: string): string[] {
  const storageKey = getCustomColorsStorageKey(accountId);
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique: string[] = [];
    for (const c of parsed) {
      const normalized = normalizeHexColor(String(c));
      if (normalized && !isPresetColor(normalized) && !unique.includes(normalized)) {
        unique.push(normalized);
      }
    }
    return unique;
  } catch {
    return [];
  }
}

export function rememberCustomColorInStorage(color: string, accountId?: string): string[] {
  const storageKey = getCustomColorsStorageKey(accountId);
  const normalized = normalizeHexColor(color);
  const existing = loadCustomColorsFromStorage(accountId);
  if (!normalized || isPresetColor(normalized)) return existing;
  const next = [normalized, ...existing.filter((c) => c !== normalized)].slice(0, 12);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function resolveAssetTypeForItem(
  item: { assetTypeId?: string; subtype: string; color?: string },
  assetTypes: AssetTypeDef[]
): AssetTypeDef {
  if (item.assetTypeId) {
    const byId = assetTypes.find((t) => t.id === item.assetTypeId);
    if (byId) return byId;
  }
  const bySubtype = assetTypes.find((t) => t.subtype === item.subtype);
  if (bySubtype) return bySubtype;
  return {
    id: `type_${item.subtype}`,
    name:
      item.subtype === 'investment'
        ? 'Investasi'
        : item.subtype === 'fixed'
          ? 'Aset Tetap'
          : 'Aset Likuid',
    subtype:
      item.subtype === 'investment' || item.subtype === 'fixed' ? item.subtype : 'liquid',
    color: normalizeHexColor(item.color || '') ?? '#10B981',
    updatedAt: new Date().toISOString(),
  };
}
