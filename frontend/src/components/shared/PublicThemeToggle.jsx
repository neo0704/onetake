import React, { useState, useLayoutEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getLastTheme, setLoginTheme } from '../../hooks/useTheme';

// Floating light/dark button for the login, register and forgot-password pages.
// Whatever theme is showing here is the theme the user's portal opens with after login.
export default function PublicThemeToggle() {
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