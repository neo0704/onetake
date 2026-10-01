import { useState, useLayoutEffect, useCallback } from 'react';

// ── Shared helpers (also used by PublicThemeToggle on the login pages) ─────────
const LOGIN_KEY = 'onetake-login-theme';   // theme shown on the login form: "light|<timestamp>"
const LAST_KEY  = 'onetake-last-theme';    // last theme used inside any portal
const LOGIN_TTL = 30 * 60 * 1000;          // a login-form choice is only honoured for 30 minutes

const read  = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const clear = (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };

export function getLastTheme() {
  return read(LAST_KEY) === 'light' ? 'light' : 'dark';
}
export function setLoginTheme(theme) {
  write(LOGIN_KEY, `${theme}|${Date.now()}`);
}
function getLoginTheme() {
  const raw = read(LOGIN_KEY);
  if (!raw) return null;
  const [theme, ts] = raw.split('|');
  if (!['light', 'dark'].includes(theme) || Date.now() - Number(ts) > LOGIN_TTL) return null;
  return theme;
}

// ── Light/dark mode for one portal ('admin' | 'client' | 'freelancer') ─────────
// Whatever theme the person had on the login form wins when they enter their
// portal. After that, the portal remembers their choice for next time.
export default function useTheme(portal) {
  const storageKey = `onetake-theme-${portal}`;

  const [theme, setTheme] = useState(() => {
    const fromLogin = getLoginTheme();
    if (fromLogin) return fromLogin;
    return read(storageKey) === 'light' ? 'light' : 'dark';
  });

  // useLayoutEffect applies the theme before the first paint (no dark flash after login)
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-portal', portal);
    root.setAttribute('data-theme', theme);
    write(storageKey, theme);
    write(LAST_KEY, theme);
    clear(LOGIN_KEY);   // login-form choice has been applied; don't reuse it later
    return () => {
      root.removeAttribute('data-portal');
      root.setAttribute('data-theme', 'dark');
    };
  }, [theme, portal, storageKey]);

  const toggle = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), []);

  return { theme, toggle };
}