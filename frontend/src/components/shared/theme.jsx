import React, { useState, useLayoutEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// All light/dark mode code lives in this one file:
//   useTheme(portal)      – hook used by the 3 layouts
//   <ThemeToggle />       – sun/moon button in the portal top bar
//   <PublicThemeToggle /> – floating sun/moon button on login / register / forgot-password
// ─────────────────────────────────────────────────────────────────────────────

const LOGIN_KEY = 'onetake-login-theme';   // theme shown on the login form: "light|<timestamp>"
const LAST_KEY  = 'onetake-last-theme';    // last theme used inside any portal
const LOGIN_TTL = 30 * 60 * 1000;          // a login-form choice is only honoured for 30 minutes

const read  = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const clear = (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };

function getLastTheme() {
  return read(LAST_KEY) === 'light' ? 'light' : 'dark';
}
function setLoginTheme(theme) {
  write(LOGIN_KEY, `${theme}|${Date.now()}`);
}
function getLoginTheme() {
  const raw = read(LOGIN_KEY);
  if (!raw) return null;
  const [theme, ts] = raw.split('|');
  if (!['light', 'dark'].includes(theme) || Date.now() - Number(ts) > LOGIN_TTL) return null;
  return theme;
}

// Light/dark mode for one portal ('admin' | 'client' | 'freelancer').
// Whatever theme the person had on the login form wins when they enter their
// portal. After that, the portal remembers their choice for next time.
export function useTheme(portal) {
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

export function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === 'light';
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
  return (
    <button onClick={onToggle} title={label} aria-label={label}
      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
      {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}

// Whatever theme is showing here is the theme the user's portal opens with after login.
export function PublicThemeToggle() {
  const [theme, setTheme] = useState(getLastTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-portal', 'admin');   // neutral light palette (role isn't known yet)
    root.setAttribute('data-theme', theme);
    setLoginTheme(theme);
    return () => {
      root.removeAttribute('data-portal');
      root.setAttribute('data-theme', 'dark');   // leaving: public pages like the homepage stay dark
    };
  }, [theme]);

  const isLight = theme === 'light';
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <button onClick={() => setTheme(isLight ? 'dark' : 'light')} title={label} aria-label={label}
      className="fixed top-4 right-4 z-50 p-2.5 rounded-xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 backdrop-blur transition-colors">
      {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}