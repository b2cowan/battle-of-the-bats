'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'public-color-mode';

function applyMode(mode: 'dark' | 'light') {
  if (mode === 'light') {
    document.documentElement.setAttribute('data-color-mode', 'light');
  } else {
    document.documentElement.removeAttribute('data-color-mode');
  }
}

export default function PublicThemeToggle() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null;
    const initial = saved ?? 'dark';
    setMode(initial);
    applyMode(initial);
  }, []);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        borderRadius: '6px',
        border: '1px solid var(--border-2)',
        background: 'var(--white-10)',
        color: 'var(--white-60)',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--white-30)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--white)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--white-10)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--white-60)';
      }}
    >
      {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
