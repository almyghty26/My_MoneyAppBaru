import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppPreferences, ThemeColorTokens, ThemeConfig } from '../types/finance';
import {
  applyThemeToDocument,
  DEFAULT_APP_PREFERENCES,
  DEFAULT_THEME_CONFIG,
  getSystemPrefersDark,
  loadPreferencesFromStorage,
  loadThemeFromStorage,
  resolveEffectiveTheme,
  savePreferencesToStorage,
  saveThemeToStorage,
} from '../utils/theme';

interface ThemeContextValue {
  accountScope: string;
  setAccountScope: (scopeId: string) => void;
  savedTheme: ThemeConfig;
  activeTheme: ThemeConfig;
  effectiveColors: ThemeColorTokens;
  isDark: boolean;
  isPreviewing: boolean;
  systemPrefersDark: boolean;
  setPreviewTheme: (draft: ThemeConfig | null) => void;
  applyAndSaveTheme: (next: ThemeConfig) => void;
  resetThemeToDefault: () => void;
  preferences: AppPreferences;
  updatePreferences: (patch: Partial<AppPreferences>) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialAccountScope(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'local_default';
    const raw = window.localStorage.getItem('my_money_session_v1');
    if (!raw) return 'local_default';
    const parsed = JSON.parse(raw) as { activeAccountId?: string | null };
    return typeof parsed.activeAccountId === 'string' && parsed.activeAccountId
      ? parsed.activeAccountId
      : 'local_default';
  } catch {
    return 'local_default';
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accountScope, setAccountScopeState] = useState<string>(() => getInitialAccountScope());
  const [savedTheme, setSavedTheme] = useState<ThemeConfig>(() =>
    loadThemeFromStorage(accountScope)
  );
  const [previewTheme, setPreviewTheme] = useState<ThemeConfig | null>(null);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => getSystemPrefersDark());
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    loadPreferencesFromStorage(accountScope)
  );

  const setAccountScope = useCallback((nextScope: string) => {
    const scope = nextScope || 'local_default';
    setAccountScopeState(scope);
    setSavedTheme(loadThemeFromStorage(scope));
    setPreferences(loadPreferencesFromStorage(scope));
    setPreviewTheme(null);
  }, []);

  const activeTheme = previewTheme ?? savedTheme;

  // Listen to OS Dark/Light preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply CSS custom properties whenever active theme or OS mode changes
  useEffect(() => {
    applyThemeToDocument(activeTheme, systemPrefersDark);
  }, [activeTheme, systemPrefersDark]);

  const resolved = useMemo(
    () => resolveEffectiveTheme(activeTheme, systemPrefersDark),
    [activeTheme, systemPrefersDark]
  );

  const applyAndSaveTheme = useCallback(
    (next: ThemeConfig) => {
      const stamped: ThemeConfig = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      saveThemeToStorage(stamped, accountScope);
      setSavedTheme(stamped);
      setPreviewTheme(null);
    },
    [accountScope]
  );

  const resetThemeToDefault = useCallback(() => {
    const fresh: ThemeConfig = {
      ...DEFAULT_THEME_CONFIG,
      colors: { ...DEFAULT_THEME_CONFIG.colors },
      updatedAt: new Date().toISOString(),
    };
    saveThemeToStorage(fresh, accountScope);
    setSavedTheme(fresh);
    setPreviewTheme(null);
  }, [accountScope]);

  const updatePreferences = useCallback(
    (patch: Partial<AppPreferences>) => {
      setPreferences((prev) => {
        const next: AppPreferences = {
          ...prev,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        savePreferencesToStorage(next, accountScope);
        return next;
      });
    },
    [accountScope]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      accountScope,
      setAccountScope,
      savedTheme,
      activeTheme,
      effectiveColors: resolved.colors,
      isDark: resolved.isDark,
      isPreviewing: previewTheme !== null,
      systemPrefersDark,
      setPreviewTheme,
      applyAndSaveTheme,
      resetThemeToDefault,
      preferences,
      updatePreferences,
    }),
    [
      accountScope,
      setAccountScope,
      savedTheme,
      activeTheme,
      resolved.colors,
      resolved.isDark,
      previewTheme,
      systemPrefersDark,
      applyAndSaveTheme,
      resetThemeToDefault,
      preferences,
      updatePreferences,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      accountScope: 'local_default',
      setAccountScope: () => {},
      savedTheme: DEFAULT_THEME_CONFIG,
      activeTheme: DEFAULT_THEME_CONFIG,
      effectiveColors: DEFAULT_THEME_CONFIG.colors,
      isDark: true,
      isPreviewing: false,
      systemPrefersDark: true,
      setPreviewTheme: () => {},
      applyAndSaveTheme: () => {},
      resetThemeToDefault: () => {},
      preferences: DEFAULT_APP_PREFERENCES,
      updatePreferences: () => {},
    };
  }
  return ctx;
}
