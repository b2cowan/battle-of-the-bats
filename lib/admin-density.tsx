'use client';

/**
 * Admin density preference (Phase A foundation).
 *
 * Two modes, a user choice on both desktop and mobile (design decision 2026-06-02):
 *  - `compact`     — today's dense terminal layout (default on fine-pointer desktop)
 *  - `comfortable` — larger rows/controls + ≥44px touch targets (default on coarse pointer)
 *
 * The resolved mode is written to `data-density` on <html> so the `--admin-*`
 * size tokens (globals.css) cascade to the shell, toolbar, rows, and any
 * portaled sheets. A no-flash inline script in the admin layout sets the
 * attribute before first paint; this provider keeps React state in sync and
 * lets the sidebar + bottom-nav toggles read/write the preference.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Density = 'comfortable' | 'compact';

const STORAGE_KEY = 'fl_admin_density';

export function resolveDensity(): Density {
  if (typeof window === 'undefined') return 'compact';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'comfortable' || stored === 'compact') return stored;
  } catch {
    /* localStorage unavailable (private mode / blocked) — fall through */
  }
  return window.matchMedia?.('(pointer: coarse)').matches ? 'comfortable' : 'compact';
}

type DensityContextValue = {
  density: Density;
  setDensity: (next: Density) => void;
};

const DensityContext = createContext<DensityContextValue | null>(null);

export function AdminDensityProvider({ children }: { children: ReactNode }) {
  // Start compact to match SSR; reconcile to the real preference after mount
  // (the inline no-flash script has already set the <html> attribute).
  const [density, setDensityState] = useState<Density>('compact');

  useEffect(() => {
    const current = document.documentElement.dataset.density;
    setDensityState(current === 'comfortable' || current === 'compact' ? current : resolveDensity());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failure — the in-memory + attribute state still applies */
    }
  }, []);

  return (
    <DensityContext.Provider value={{ density, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useAdminDensity(): DensityContextValue {
  return useContext(DensityContext) ?? { density: 'compact', setDensity: () => {} };
}

/** Inline script body for the admin layout — sets data-density before first paint. */
export const DENSITY_NO_FLASH_SCRIPT =
  "(function(){try{var k='fl_admin_density',v=null;try{v=localStorage.getItem(k);}catch(e){}" +
  "if(v!=='comfortable'&&v!=='compact'){v=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)?'comfortable':'compact';}" +
  "document.documentElement.setAttribute('data-density',v);}catch(e){}})();";
