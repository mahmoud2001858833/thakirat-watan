'use client';
import { useSyncExternalStore } from 'react';

type Mode = 'light' | 'dark';
const read = (): Mode => {
  const d = document.documentElement.dataset.theme;
  if (d === 'light' || d === 'dark') return d;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };

export function ThemeToggle({ label }: { label: string }) {
  const mode = useSyncExternalStore(subscribe, read, () => 'light' as Mode);
  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    listeners.forEach((l) => l());
  };
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} aria-pressed={mode === 'dark'}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    </button>
  );
}
