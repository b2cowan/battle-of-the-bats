/**
 * ⚖ ONE HOME PER SETTING (navigation Phase 2 Part B, P2, owner 2026-11-10 — "if only the club sets it it should only live in
 * the club portal … I don't think we should have a settings button make them navigate to the club"). No tournament overrides
 * a club's setting (PDF settings is the organization's one `pdf_settings`; Members is one page, a member's tournament scope
 * set inside it), so in a club Settings & access, Members, the audit log, PDF settings, Payouts, Web address and Plan & billing
 * live only in the club portal and nothing on the tournament side points at them (the event's sidebar and the phone's
 * tournament More sheet have no Settings & access row there). These tournament addresses survive only as old links and
 * bookmarks: for a club they open the club's own page. The Tournament plans keep them here (their organization has no club
 * portal — `admin/org/layout.tsx` sends it away), the one rule `orgSettingsOnTournamentSide`. A one-team workspace keeps its
 * Organization too (that layout's own exception), so it is sent there like a club; its Plan & billing page then goes on to the
 * Coaches Portal's, as it always did. A suspended organization is not read here (the billing rail's own rule), so its one page
 * is left exactly as it was.
 */
import type { ComponentType } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { orgSettingsOnTournamentSide } from '@/lib/billing-urls';

/** For a club, go to `clubPath` (under `/{org}/admin/`), the address's own search kept: a checkout that started on a
 *  Tournament plan returns here with its success flag after the plan became a club's, and billing emails carry `?plan=` /
 *  `?keep_plan=1` (the proxy forwards the search as `x-search` on every admin address; a layout has no searchParams). */
export async function openClubHome(orgSlug: string, clubPath: string): Promise<void> {
  // A suspended organization's read throws (the rail): the page then renders exactly as it did before this rule.
  const ctx = await getAuthContextWithRole({ orgSlug }).catch(() => null);
  if (!ctx || orgSettingsOnTournamentSide(ctx.org)) return;
  const params = new URLSearchParams((await headers()).get('x-search') ?? '');
  params.delete('_rsc'); // a client navigation's own request marker, never the address's
  const search = params.toString();
  redirect(`/${orgSlug}/admin/${clubPath}${search ? `?${search}` : ''}`);
}

/** A Tournament-plan Settings & access page whose club home is `clubPath`: the page as it is, or, for a club, its own page. */
export function tournamentSideOnly(Page: ComponentType, clubPath: string) {
  return async function TournamentSidePage({ params }: { params: Promise<{ orgSlug: string }> }) {
    await openClubHome((await params).orgSlug, clubPath);
    return <Page />;
  };
}
