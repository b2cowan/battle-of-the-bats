/**
 * lib/club-frame-data.ts — WHAT THE CLUB'S FRAME SHOWS (its bar, tabs, notice and footer), read once for its two readers
 * (server only): the org layout, around every club page (Club Tier Stage 4b-1 / 4c-1), and the editor's preview
 * (Public site builder, A1/A2, ruled 2026-10-21). One function, so the preview's frame is the frame families see.
 *
 * Read only while the club's site is open and its plan carries the public site: a club on a plan without it shows its
 * name and logo only, and a closed site reads nothing. The preview hands in the club AS IF OPEN — that is its whole
 * point (A2: the owner and admins see their offline site) — and it alone may: it sits behind the editor's own rule.
 */
import { clubFace, clubSocials } from '@/lib/club-site';
import { orgHref } from '@/lib/club-base';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { getLiveClubNotice } from '@/lib/db';
import { closureStrip, noticeSmallLine } from '@/lib/club-notice';
import { closuresShowing } from '@/lib/place-closures-server';
import { clubAboutPageShows } from '@/lib/club-about';
import { resolveOrgSections } from '@/lib/org-section-availability';
import { isFreePlan } from '@/lib/plan-config';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isPublicClubSiteOpen } from '@/lib/public-club-access';
import type { ClubFrameClub } from '@/components/public/ClubFrame';
import type { Organization } from '@/lib/types';
import { previewFootText } from './preview-org';

/** `base` (Stage 4e): `{ ownHost: true }` on a club's own web address, so the About link reads `/about`. Left out = our host. */
export async function loadClubFrame(org: Organization, orgSlug: string, base?: { ownHost: boolean }): Promise<ClubFrameClub> {
  const clubSiteOn = isPublicClubSiteOpen(org) && hasModuleEntitlement(org, 'module_public_site');
  // The club's site content (tagline, contact, social links) feeds both the tabs and the bar and footer: one read.
  const siteContentRead = clubSiteOn ? getClubSiteContent(org.id) : Promise.resolve(null);
  // The club notice (Stage 4c-1, Ask 16) rides the same gate: a club page shows it under the bar until it ends. One small
  // indexed read; a failed read is no notice, never a broken page.
  const nowIso = new Date().toISOString();
  // The closed places (Club Website Stage 2, K4) ride the same gate and the same rule: the closures showing now, said in
  // the club's day; a failed read is no strip, never a broken page (the read throws: the page decides, and this is it).
  const [siteContent, sections, liveNotice, closures] = await Promise.all([
    siteContentRead,
    resolveOrgSections(org, siteContentRead),
    clubSiteOn ? getLiveClubNotice(org.id, nowIso) : Promise.resolve(null),
    clubSiteOn ? closuresShowing(org.id, new Date(nowIso)).catch(() => []) : Promise.resolve([]),
  ]);
  return {
    slug: orgSlug,
    name: org.name,
    logoUrl: org.logoUrl ?? null,
    tagline: siteContent?.tagline?.trim() || null,
    sections,
    contactEmail: siteContent?.contactEmail?.trim() || null,
    socials: clubSocials(siteContent),
    // A preview club (Track P) carries the credit though it is on the free start: the band and this credit are the only
    // FieldLogicHQ words on its pages (drawing tab 5), and the footer repeats the band with the removal route.
    showCredit: !isFreePlan(org.planId) || org.isPreview === true,
    previewFoot: org.isPreview ? previewFootText(org.name) : null,
    face: clubFace(org.themeFont),
    notice: liveNotice ? {
      notice: liveNotice.notice,
      detail: liveNotice.detail,
      smallLine: noticeSmallLine(liveNotice, nowIso),
      endsAt: liveNotice.endsAt,
    } : null,
    closures: closureStrip(closures, nowIso),
    aboutHref: clubAboutPageShows(siteContent) ? orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, '/about') : null,
  };
}
