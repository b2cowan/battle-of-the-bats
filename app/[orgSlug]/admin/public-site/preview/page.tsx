import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { OrgBillingSuspendedError } from '@/lib/org-billing-access';
import { getClubBySlug } from '@/lib/club-page-meta';
import { isPublicClubSiteOpen } from '@/lib/public-club-access';
import { mayOpenSiteEditor, mayWriteSite } from '@/lib/public-site-rules';
import { loadClubFrame } from '@/lib/club-frame-data';
import { loadClubHome } from '@/lib/club-home-data';
import ClubFrame from '@/components/public/ClubFrame';
import ClubSiteHome from '@/components/public/ClubSiteHome';
import PreviewClicks from './PreviewClicks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Preview', robots: { index: false, follow: false } };

/**
 * THE EDITOR'S PREVIEW OF THE CLUB'S HOME (Public site builder, A1 + A2 + A9, ruled 2026-10-21).
 *
 * The club's real home — the same frame and the same sections, read by the same two loaders the public pages call
 * (lib/club-frame-data.ts, lib/club-home-data.ts) — drawn at an ADMIN address, so:
 *   · it is for this club's owner and admins only, asked here on the server (the editor's own rule) — never a flag on a
 *     public address, which would be one bug away from showing an offline site to everyone;
 *   · it shows the club's site WHILE IT IS OFFLINE (A2) — read as if open, which only this page may do;
 *   · nothing caches it: the server renders it per request, and the service worker never stores an admin page.
 * The editor shows it in a frame at a computer's or a phone's width, so the club's own breakpoints decide the layout.
 * Inside that frame a click opens the editor row that sets the part clicked, and no link is followed (A9).
 *
 * The frame's chrome (no rail, no bars) is AdminChrome's focused shell for this address.
 */
export default async function ClubSitePreviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  // A cancelled club's billing rail throws here (lib/org-billing-access.ts); its preview is simply not there — the
  // editor around it already shows the cancelled state.
  // Only that throw is meant: any other failure is a real error and says so (it is not a quiet 404).
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true }).catch(e => {
    if (e instanceof OrgBillingSuspendedError) return null;
    throw e;
  });
  // The editor's own rule (lib/public-site-access.ts): the owner or an admin who has the editor.
  if (!ctx || !mayWriteSite(ctx.role) || !mayOpenSiteEditor(ctx)) notFound();

  const org = await getClubBySlug(orgSlug);
  if (!org) notFound();
  // As if the switch were on — and still never for a cancelled club, whose pages are the refusal whatever the switch says.
  const asOpen = { ...org, isPublic: true };
  if (!isPublicClubSiteOpen(asOpen)) notFound();

  const [club, home] = await Promise.all([loadClubFrame(asOpen, orgSlug), loadClubHome(asOpen, orgSlug)]);
  return (
    <>
      <PreviewClicks />
      <ClubFrame club={club} preview>
        <ClubSiteHome {...home} />
      </ClubFrame>
    </>
  );
}
