import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === 'light';
  const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
  return (
    <button onClick={onToggle} title={label} aria-label={label}
      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
      {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}