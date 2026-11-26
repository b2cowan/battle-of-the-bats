import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter, Barlow_Condensed, DM_Serif_Display, DM_Sans } from 'next/font/google';
import { resolveTheme } from '@/lib/themes';
import { clubColourRoles, hexChannels } from '@/lib/club-colour-roles';
import { clubDescription } from '@/lib/club-site';
import { getClubBySlug, getClubSiteContent } from '@/lib/club-page-meta';
import { loadClubFrame } from '@/lib/club-frame-data';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import ClubFrame from '@/components/public/ClubFrame';
import PreviewBand from '@/components/public/PreviewBand';
import { PublicClubProvider } from '@/components/public/PublicClubContext';
import { isPublicClubSiteOpen } from '@/lib/public-club-access';
import { bareHost, isOwnHost } from '@/lib/own-hosts';
import { requestHost } from '@/lib/request-host';
import { previewBandText, previewTitle } from '@/lib/preview-org';
import { readEndedPreview } from '@/lib/preview-ended-server';
import { ENDED_WORDS } from '@/lib/preview-ended';
import PreviewEnded from '@/components/public/PreviewEnded';

// Pre-load all font options at module level (next/font requirement).
// Each uses a unique CSS variable so they don't conflict with the root layout fonts.
const interFont = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

const barlowFont = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-barlow',
});

const dmSerifFont = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
});

const dmSansFont = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
});

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getClubBySlug(orgSlug);
  if (!org) {
    // A removed preview's old link (Track P Session P4, T12): titled as ended and kept out of search, for its 90 days.
    const ended = await readEndedPreview(orgSlug);
    return ended ? { title: { absolute: ENDED_WORDS.pageTitle(ended.name) }, robots: { index: false, follow: false, nocache: true } } : {};
  }
  // The club describes itself in its own words (End state 8; S4-02: never FieldLogicHQ's sales line). Tournament pages
  // set their own description, so this reaches the club's pages.
  const siteContent = isPublicClubSiteOpen(org) && hasModuleEntitlement(org, 'module_public_site')
    ? await getClubSiteContent(org.id)
    : null;
  // A preview club (Track P, T1) is kept out of search results by this tag, and NEVER by a robots.txt line: that file is
  // public, and a line per preview would list our prospects. (No response header: the request gate never sees a public
  // club page; the non-page routes a preview could serve are refused for it instead, Track P Session P2.)
  const previewRobots = org.isPreview
    ? { robots: { index: false, follow: false, nocache: true } }
    : {};
  // On a club's own web address (Club Tier Stage 4e) every relative address in the metadata (a preview card, say) resolves
  // against THAT host, not www's (the root layout's metadataBase). The Host header is the one the edge verified.
  const host = await requestHost();
  const clubBase = isOwnHost(host) ? {} : { metadataBase: new URL(`https://${bareHost(host)}`) };
  // (An `getActiveTournamentByOrg` call sat here with its result unused — a per-request query on
  // EVERY route under /{orgSlug} that fed nothing. Removed while making this layout's Stage F
  // lookups cheap; the metadata below never referenced it.)
  return {
    ...clubBase,
    // The club's own pages set an ABSOLUTE "page · club" title (lib/club-page-meta.ts); this template is what
    // tournament pages, which title themselves with a bare name, still read — unchanged by the club's frame.
    // A preview club (Track P): "(preview)" in every title this template makes, and the band's words as the description.
    title: {
      default: org.isPreview ? previewTitle(org.name) : org.name,
      template: org.isPreview ? `%s | ${previewTitle(org.name)}` : `%s | ${org.name}`,
    },
    description: org.isPreview ? previewBandText(org.name) : clubDescription(siteContent, org.name),
    // No preview image here (Club Tier Stage 4b-2b): the club's generated card (app/[orgSlug]/opengraph-image.tsx) carries
    // its logo in its colours, and every page under the club inherits it unless it names its own. An image set HERE would
    // silently replace that card — Next skips a segment's generated image when the same segment's metadata names one.
    ...previewRobots,
  };
}

export default async function OrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  const org = await getClubBySlug(orgSlug);
  if (!org) {
    // Track P Session P4 (T12): a removed preview's address — and every page under it — says "This preview has ended" for
    // 90 days after the removal, then the ordinary not-found. Asked only when no club holds the address, so a live club
    // always wins. Nothing under the frame is drawn: the club is gone.
    const ended = await readEndedPreview(orgSlug);
    if (ended) return <PreviewEnded ended={ended} />;
    notFound();
  }

  const theme = resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);
  // Club Tier Stage 4b-1 (End state 9): the club's colour as the four roles its light site needs, derived from the colour
  // already saved. Written beside today's vars (tournament pages keep reading those); only the club's frame reads these.
  const roles = clubColourRoles(org.themePreset, org.themePrimary, org.themeAccent);
  const siteOpen = isPublicClubSiteOpen(org);

  // ── Stage F: the org's section tabs, and the club's frame ──────────────────────
  // Tier-gated and deliberately CHEAP (see lib/org-section-availability for why it can't be
  // pathname-gated: this layout also wraps admin/coaches/scorekeeper and every tournament page,
  // and a Server Component has no pathname here — proxy.ts intentionally doesn't run on public org
  // routes, which is what keeps an anonymous page free of session work). Read by the one function the
  // editor's preview shares (lib/club-frame-data.ts): the site content once, the tabs, the live notice.
  const frameClub = await loadClubFrame(org, orgSlug, { ownHost: !isOwnHost(await requestHost()) });

  const cssVars = [
    `--primary:       ${theme.primary}`,
    `--primary-light: ${theme.primaryLight}`,
    `--primary-rgb:   ${theme.primaryRgb}`,
    `--primary-glow:  rgba(${theme.primaryRgb}, 0.35)`,
    `--primary-faint: rgba(${theme.primaryRgb}, 0.08)`,
    `--border:        rgba(${theme.primaryRgb}, 0.25)`,
    `--glow:          0 0 32px rgba(${theme.primaryRgb}, 0.4)`,
    `--glow-sm:       0 0 16px rgba(${theme.primaryRgb}, 0.25)`,
    `--on-primary:    ${theme.onPrimary}`,
    `--club-fill:     ${roles.fill}`,
    `--club-fill-rgb: ${hexChannels(roles.fill)}`,
    `--club-on-fill:  ${roles.onFill}`,
    `--club-ink:      ${roles.ink}`,
    `--club-ink-rgb:  ${hexChannels(roles.ink)}`,
    `--club-edge:     ${roles.edge}`,
    `--club-accent:   ${roles.accent}`,
    `--club-mark:     ${roles.mark}`,
    `--club-tile:     ${roles.tile}`,
    `--club-tile-ink: ${roles.tileInk}`,
    ...buildFontVars(org.themeFont),
  ].join('; ');

  // Apply all font class names to the wrapper so their CSS variables are in scope,
  // then the :root override picks which one to activate via --font-sans / --font-display.
  const fontClasses = [
    interFont.variable,
    barlowFont.variable,
    dmSerifFont.variable,
    dmSansFont.variable,
  ].join(' ');

  return (
    <>
      {/* Sets vars on :root so globally-mounted components (Navbar, ConsumerNav) inherit the org theme */}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      <div
        className={fontClasses}
        data-card-style={org.themeCardStyle ?? 'default'}
      >
        {/* A preview club (Club Website Track P, Session P2): the band above the club's own bar on EVERY page under the
            club, tournament pages included, because this layout wraps them all. Session P2 owns this line; Stage 1
            owns the home. */}
        {org.isPreview && <PreviewBand clubName={org.name} slug={org.slug} />}
        {/* Club Tier Stage 4a — the club's "not found" (app/[orgSlug]/not-found.tsx) receives no params, so this
            layout hands it the club: its name, and whether its public site is open (the switch on, not cancelled).
            ⚠ This layout still refuses ONLY a club that does not exist: tournament pages stay up when the site is off
            (BUSINESS_DECISIONS 2026-07-22); each club page asks the one rule itself (lib/public-club-page.ts). */}
        {/* `teamsPage`: the Teams tab is up exactly when the club has a Teams page to send a lost visitor to (4b-2a). */}
        <PublicClubProvider club={{ slug: orgSlug, name: org.name, siteOpen, teamsPage: frameClub.sections.some(s => s.key === 'teams') }}>
          {/* Club Tier Stage 4b-1 — the club's site (its bar, its footer, its light ground and type) around every club
              page. The frame decides WHICH pages wear it (this layout also wraps tournament pages and the signed-in
              tools, and cannot read the address); it carries no identity, so it is safe in SW-cached anonymous HTML. */}
          <ClubFrame club={frameClub}>
            {children}
          </ClubFrame>
        </PublicClubProvider>
      </div>
    </>
  );
}

function buildFontVars(themeFont: string | undefined): string[] {
  switch (themeFont) {
    case 'inter':
      return ['--font-sans: var(--font-inter)', '--font-display: var(--font-inter)'];
    case 'barlow':
      return ['--font-sans: var(--font-barlow)', '--font-display: var(--font-barlow)'];
    case 'dm-serif':
      return ['--font-sans: var(--font-dm-sans)', '--font-display: var(--font-dm-serif)'];
    default:
      return [];
  }
}
