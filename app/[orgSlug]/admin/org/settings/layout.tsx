import { headers } from 'next/headers';
import { redirectPremiumOffOrgPage } from '@/lib/coach-portal-request';

/**
 * Organization › Settings and its PDF settings: a Premium Coaches Portal's name, web address and birthday date live in Team
 * settings › Organization, and its print options in Team settings › How your documents look (Session 2), so each old address
 * opens its section before the page mounts (Settings in both workspaces, Session 3 — `lib/premium-org-pages.ts`). Clubs and
 * leagues pass; a Tournament plan never reaches here (the org layout), and its own Settings & access › PDF settings imports
 * the page, not this layout.
 *
 * One layout for both pages, told apart by the address the proxy names (`x-pathname`, set on every request — never the
 * browser's): two layouts nested here would race each other's redirect. Without the header it reads as Settings.
 */
export default async function OrgSettingsLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const raw = (await headers()).get('x-pathname') ?? '';
  // The proxy's path is not percent-decoded; the router's match is (`/settings/p%64f` serves PDF settings).
  let pathname = raw;
  try { pathname = decodeURIComponent(raw); } catch { /* a malformed escape reads as written */ }
  await redirectPremiumOffOrgPage((await params).orgSlug, /\/settings\/pdf\/?$/.test(pathname) ? 'pdf' : 'settings');
  return <>{children}</>;
}
