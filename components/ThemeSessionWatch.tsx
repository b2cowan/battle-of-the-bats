'use client';

import { useEffect } from 'react';
import { applyNoFlashAttributes } from '@/lib/no-flash-script';
import { createClient } from '@/lib/supabase-browser';
import { getActiveTheme, THEME_CHANGE_EVENT } from '@/lib/user-theme';

/**
 * Keeps the page's theme honest when a session starts or ends WITHOUT a page load — browser-only,
 * renders nothing. Mounted once by the root layout.
 *
 * Signed out is warm everywhere (owner 2026-10-23). The no-flash script decides that at first paint
 * from the presence of a session cookie, but a page already open does not re-run it: a sign-out by
 * a client-side navigation, a session that expires, or a sign-out in another tab (supabase-js
 * broadcasts it to every tab) would leave the old Dark on screen. This re-runs the SAME rule —
 * the script's own function, theme part only — on every auth event that can change the answer, and
 * tells the theme listeners (the status-bar tint) when the answer moved.
 *
 * It never writes the device's stored choice: Dark stays saved, so signing back in finds it, and
 * SIGNED_IN flips the live page back to Dark with no reload.
 */
export default function ThemeSessionWatch() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createClient().auth.onAuthStateChange(event => {
        if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') return;
        const before = getActiveTheme();
        applyNoFlashAttributes(true);
        const after = getActiveTheme();
        if (after !== before) {
          try {
            window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: after }));
          } catch { /* older browsers without the CustomEvent constructor — the attribute still moved */ }
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* no Supabase client here (unsafe environment guard) — the first-paint rule still stands */
    }
    return () => unsubscribe?.();
  }, []);
  return null;
}
