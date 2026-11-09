import React, { useState, useLayoutEffect, useCallback, useSyncExternalStore } from 'react';
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

// ── Shared theme state ──────────────────────────────────────────────────────
// Every component that calls useTheme() (the layout AND the Profile page) must see
// the SAME theme. If each call kept its own copy, changing the theme on the Profile
// page would never reach the layout, and leaving the page would reset it to dark.
let sharedTheme  = null;   // null until the first useTheme() call in a portal session
let mountedCount = 0;      // how many components are currently using useTheme()
const listeners  = new Set();

const subscribe   = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => sharedTheme ?? 'dark';
const setShared   = (t) => {
  if (sharedTheme === t) return;
  sharedTheme = t;
  listeners.forEach(fn => fn());
};
const initialTheme = (storageKey) =>
  getLoginTheme() || (read(storageKey) === 'light' ? 'light' : 'dark');

// Light/dark mode for one portal ('admin' | 'client' | 'freelancer').
// Whatever theme the person had on the login form wins when they enter their
// portal. After that, the portal remembers their choice for next time.
export function useTheme(portal) {
  const storageKey = `onetake-theme-${portal}`;

  if (sharedTheme === null) sharedTheme = initialTheme(storageKey);
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  // useLayoutEffect applies the theme before the first paint (no dark flash after login)
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-portal', portal);
    root.setAttribute('data-theme', theme);
    write(storageKey, theme);
    write(LAST_KEY, theme);
    clear(LOGIN_KEY);   // login-form choice has been applied; don't reuse it later
  }, [theme, portal, storageKey]);

  // Reset to the dark public look only when the LAST component using the theme goes
  // away (i.e. the portal is left / logout) — not when a single page like Profile unmounts.
  useLayoutEffect(() => {
    mountedCount += 1;
    if (sharedTheme === null) setShared(initialTheme(storageKey));
    return () => {
      mountedCount -= 1;
      if (mountedCount === 0) {
        sharedTheme = null;
        const root = document.documentElement;
        root.removeAttribute('data-portal');
        root.setAttribute('data-theme', 'dark');
      }
    };
  }, [storageKey]);

  const toggle = useCallback(() => setShared(sharedTheme === 'light' ? 'dark' : 'light'), []);

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