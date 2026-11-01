'use client';
/**
 * components/public/NotOnFocusedPage.tsx — the event chrome a focused page does not wear (Public tournament pages Stage 7,
 * Ask 6; lib/public-focused-page.ts is the one rule). The tournament layout wraps each piece that simply goes away there —
 * the desk rail, the my-team dock, the follow / alerts / install prompts and the free plan's badge and banner — so none
 * of them has to know which pages are focused. The band and the footer change shape instead, and ask the rule themselves.
 *
 * Frame-only: the layout uses it in its switch-on branch, so the switch-off page is unchanged. The path resolves during
 * the server render, so a focused page paints without the chrome from the first frame (nothing appears and then goes).
 */
import type { ReactNode } from 'react';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { isFocusedPublicPage } from '@/lib/public-focused-page';

export default function NotOnFocusedPage({ orgSlug, tournamentSlug, children }: {
  orgSlug: string; tournamentSlug: string; children: ReactNode;
}) {
  const pathname = usePublicPathname() ?? '';
  return isFocusedPublicPage(pathname, orgSlug, tournamentSlug) ? null : <>{children}</>;
}
