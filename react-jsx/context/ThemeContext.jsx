import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '@services/api';

const THEME_STORAGE_KEY = 'navic-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

function resolveTheme(theme) {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return theme;
}

function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
  }
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('navic-theme');
  if (stored && VALID_THEMES.includes(stored)) {
    return stored;
  }
  return 'system';
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeValue] = useState(getInitialTheme);

  // Apply theme on initial load and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const currentTheme = localStorage.getItem('navic-theme') || 'system';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'navic-theme' && e.newValue !== null) {
        const newTheme = e.newValue;
        if (VALID_THEMES.includes(newTheme)) {
          setThemeValue(newTheme);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTheme = useCallback(async (newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) return;

    // Update local state immediately for instant UI feedback
    setThemeValue(newTheme);
    localStorage.setItem('navic-theme', newTheme);
    applyTheme(newTheme);

    // Persist to backend if user is authenticated
    try {
      await api.saveUserPreferences({ theme: newTheme });
    } catch {
      // Silently fail - theme is already applied locally
      console.warn('Failed to persist theme preference to backend');
    }
  }, []);

  const value = useMemo(() => ({
    theme,
    resolvedTheme: resolveTheme(theme),
    setTheme,
  }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { resolveTheme, applyTheme, getInitialTheme };
