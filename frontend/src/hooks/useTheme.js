import { useState, useEffect, useCallback } from 'react';

// Light/dark mode for one portal ('admin' | 'client' | 'freelancer').
// The choice is remembered per portal in this browser. While a layout is mounted
// it tags <html> so the CSS can pick that portal's palette; when the layout
// unmounts (logout, public pages) everything goes back to the default dark look.
export default function useTheme(portal) {
  const storageKey = `onetake-theme-${portal}`;

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-portal', portal);
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(storageKey, theme); } catch { /* storage unavailable */ }
    return () => {
      root.removeAttribute('data-portal');
      root.setAttribute('data-theme', 'dark');
    };
  }, [theme, portal, storageKey]);

  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), []);

  return { theme, toggle };
}