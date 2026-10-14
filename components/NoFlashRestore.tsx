'use client';

import { useLayoutEffect } from 'react';
import { applyNoFlashAttributes } from '@/lib/no-flash-script';

/**
 * Puts the no-flash attributes back on <html> after React rebuilds the document — browser-only,
 * renders nothing. Mounted once by the root layout.
 *
 * When hydration fails at the root (there is no Suspense boundary to contain it), React
 * client-renders the whole document and re-acquires <html> from the root layout's props, removing
 * every attribute first — so the theme and density the no-flash script set before first paint are
 * gone. Found 2026-10-13: a countdown that disagreed with the server turned a Warm coach's portal
 * Dark under a white top bar. The countdown is fixed; this is the net for the next mismatch,
 * wherever it comes from.
 *
 * A layout effect runs after that commit and before paint, so the attributes are back before the
 * screen shows the wrong look. It acts only when the theme attribute is MISSING: on a normal load
 * the script already set it, and re-running would only re-read the same stored choices.
 */
export default function NoFlashRestore() {
  useLayoutEffect(() => {
    if (!document.documentElement.hasAttribute('data-user-theme')) applyNoFlashAttributes();
  }, []);
  return null;
}
