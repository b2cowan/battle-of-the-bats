import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getOrganizationBySlug, getActiveTournamentByOrg } from './db';
import { orgLinks } from './org-links';

/**
 * THE SHORTCUT ADDRESSES (Club Tier Stage 4a; Ask 9 ruled 2026-10-19) — `/{org}/teams`, `/news`, `/results`, `/rules`,
 * `/schedule`, `/standings`, `/register`. They began as short links into the club's running tournament, and printed
 * links and QR codes still rely on them, so they keep forwarding there. With no tournament running they used to go
 * SILENTLY to the club home (and `/teams` showed a tournament's visiting teams as "the club's teams", S4-07); now they
 * are the club's "not found" — the refusal when its site is closed, "not found" inside the club when it is open.
 *
 * Tournament pages are not gated by the site switch (BUSINESS_DECISIONS 2026-07-22), so the forward does not ask the
 * club rule; the "not found" face reads the club's site state itself (`app/[orgSlug]/not-found.tsx`). `/teams` follows
 * this rule until Stage 4b makes it the club's Teams page.
 */
export type ClubShortcut = 'teams' | 'news' | 'results' | 'rules' | 'schedule' | 'standings' | 'register';

/** The whole page for one shortcut address: `export default clubShortcutPage('news');`. */
export function clubShortcutPage(shortcut: ClubShortcut) {
  return async function ClubShortcutPage({ params }: { params: Promise<{ orgSlug: string }> }) {
    return forwardClubShortcut((await params).orgSlug, shortcut);
  };
}

export async function forwardClubShortcut(orgSlug: string, shortcut: ClubShortcut): Promise<never> {
  // `/results` goes straight to the tournament's Results & Standings page (its own /results address only forwards there).
  await forwardToRunningTournament(orgSlug, shortcut === 'results' ? 'standings' : shortcut);
  notFound();
}

/** Redirect to `path` inside the club's running tournament, if one runs; otherwise return and let the caller decide. */
export async function forwardToRunningTournament(orgSlug: string, path: string): Promise<void> {
  const org = await getOrganizationBySlug(orgSlug);
  const active = org ? await getActiveTournamentByOrg(org.id) : null;
  // Spelled for the address the visitor is on (a club's own address has no club name in its paths).
  if (active?.slug) redirect((await orgLinks(orgSlug))(`/${active.slug}/${path}`));
}
