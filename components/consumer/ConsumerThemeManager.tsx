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
 *     (the four tabs, the auth group and, since The first look 1d, the sign-up journey all follow
 *     the preference). Restores the default when leaving the consumer shell.
 */

import { useEffect } from 'react';
import { usePublicPathname } from '@/lib/use-public-pathname';
import {
  applyTheme,
  getActiveTheme,
  getEffectiveTheme,
  THEME_CHANGE_EVENT,
  THEME_COLORS,
  type UserTheme,
  DEFAULT_THEME_COLOR,
} from '@/lib/user-theme';
import { isWarmSkinPath } from '@/lib/consumer-routes';

// The root-layout default (lib/user-theme.ts DEFAULT_THEME_COLOR) is restored whenever no consumer-route rule applies.

export default function ConsumerThemeManager({ accountTheme }: { accountTheme: UserTheme | null }) {
  const pathname = usePublicPathname();

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
      if (isWarmSkinPath(pathname)) color = active === 'dark' ? THEME_COLORS.dark : THEME_COLORS.warm;
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
