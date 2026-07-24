'use client';

/**
 * ConsumerThemeManager — mounted once in the consumer shell (Theme Toggle Foundation, TH-1/TH-3).
 * Renders nothing; runs two effects:
 *
 *  1. Account reconcile (account wins, cross-device): the consumer layout resolved the signed-in
 *     account's theme server-side and passes it here; adopt it if it differs from what the device
 *     fast-path applied (one repaint — the density precedent). null (signed-out / no explicit
 *     choice) leaves the device preference untouched.
 *
 *  2. Dynamic `theme-color` meta: the OS status bar follows the active theme on consumer routes
 *     (warm journey always warm; the four tabs AND the auth group follow the preference — /auth
 *     is in CONSUMER_SHELL_PREFIXES since 2026-07-23). Restores the default when leaving the
 *     consumer shell.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  applyTheme,
  getActiveTheme,
  getEffectiveTheme,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  type UserTheme,
} from '@/lib/user-theme';
import { isConsumerShellPath, isWarmJourneyPath } from '@/lib/consumer-routes';

// The root-layout default (dark); restored whenever no consumer-route rule applies.
const DEFAULT_THEME_COLOR = '#0a0a0f';

export default function ConsumerThemeManager({ accountTheme }: { accountTheme: UserTheme | null }) {
  const pathname = usePathname();

  // 1. Account reconcile (account wins): adopt the account's explicit theme when it differs from
  // what the device fast-path applied. Keyed on `accountTheme` — NOT `[]` — because signing in
  // INSIDE the app is a client transition (router.push + refresh) that swaps this prop on the
  // already-mounted manager without remounting; `[]` would miss it and the theme wouldn't apply
  // until a hard reload. Re-running when the value matches the active theme is a cheap no-op.
  useEffect(() => {
    if (accountTheme && accountTheme !== getActiveTheme()) applyTheme(accountTheme);
  }, [accountTheme]);

  // 2. Dynamic theme-color for consumer routes; re-evaluates on route change AND theme change.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const compute = () => {
      const active = getEffectiveTheme();
      let color = DEFAULT_THEME_COLOR;
      if (isWarmJourneyPath(pathname)) color = THEME_COLORS.warm;               // journey = always warm
      else if (isConsumerShellPath(pathname)) color = active === 'dark' ? THEME_COLORS.dark : THEME_COLORS.warm;
      meta.setAttribute('content', color);
    };
    compute();
    window.addEventListener(THEME_CHANGE_EVENT, compute);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, compute);
      meta.setAttribute('content', DEFAULT_THEME_COLOR); // restore when leaving the route/shell
    };
  }, [pathname]);

  return null;
}
