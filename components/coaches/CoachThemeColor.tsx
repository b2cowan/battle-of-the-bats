'use client';

/**
 * CoachThemeColor — mounted once in each coaches shell (org-embedded Premium layout + standalone
 * Basic CoachPortalShell). Renders nothing; keeps the mobile PWA status-bar tint (the
 * `theme-color` meta) in sync with the active app theme while a coach is inside the portal, so a
 * warm portal doesn't sit under a dark status bar. Mirrors the consumer shell's theme-color effect
 * (ConsumerThemeManager) but for coaches routes.
 *
 * Warm is the platform default (getEffectiveTheme() is null only before the no-flash script runs on
 * a brand-new device), so a non-chooser gets the warm paper tint. Restores the platform default on
 * unmount — i.e. when the coach leaves the portal for a dark/branded surface.
 */

import { useEffect } from 'react';
import { getEffectiveTheme, THEME_CHANGE_EVENT, THEME_COLORS } from '@/lib/user-theme';

// The root-layout default (dark); restored when leaving the coaches portal.
const DEFAULT_THEME_COLOR = '#0a0a0f';

export default function CoachThemeColor() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const apply = () => {
      const active = getEffectiveTheme() ?? 'warm'; // warm is the default
      meta.setAttribute('content', THEME_COLORS[active]);
    };
    apply();
    window.addEventListener(THEME_CHANGE_EVENT, apply);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, apply);
      meta.setAttribute('content', DEFAULT_THEME_COLOR);
    };
  }, []);

  return null;
}
