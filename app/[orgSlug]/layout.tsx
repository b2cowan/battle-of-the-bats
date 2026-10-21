import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Inter, Barlow_Condensed, DM_Serif_Display, DM_Sans } from 'next/font/google';
import { resolveTheme } from '@/lib/themes';
import { clubColourRoles, hexChannels } from '@/lib/club-colour-roles';
import { clubDescription, clubFace, clubSocials } from '@/lib/club-site';
import { getClubBySlug, getClubSiteContent } from '@/lib/club-page-meta';
import { resolveOrgSections } from '@/lib/org-section-availability';
import { isFreePlan } from '@/lib/plan-config';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { OrgNavSync } from '@/components/OrgNavSync';
import ClubFrame from '@/components/public/ClubFrame';
import { getDemoOrgBySlug } from '@/lib/demo-org';
import { getAuthUserCached } from '@/lib/supabase-server';
import { SandboxProvider } from '@/components/sandbox/SandboxProvider';
import SandboxChrome from '@/components/sandbox/SandboxChrome';
import { PublicClubProvider } from '@/components/public/PublicClubContext';
import { isPublicClubSiteOpen } from '@/lib/public-club-access';
import { getCoachStartHref } from '@/lib/start-menu';

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
  if (!org) return {};
  // The club describes itself in its own words (End state 8; S4-02: never FieldLogicHQ's sales line). Tournament pages
  // set their own description, so this reaches the club's pages.
  const siteContent = isPublicClubSiteOpen(org) && hasModuleEntitlement(org, 'module_public_site')
    ? await getClubSiteContent(org.id)
    : null;
  // Sandbox ("See it live") orgs are kept out of search results entirely. Their fan pages are
  // real public tournament pages, so without this they could be indexed and surface in a search
  // for a genuine event — or be mistaken for a real association. `robots.txt` asks crawlers not to
  // fetch these paths at all; this stops one that fetched anyway from listing the page. Applies to
  // the whole subtree, because this layout wraps every page the org owns.
  const demoRobots = getDemoOrgBySlug(orgSlug)
    ? { robots: { index: false, follow: false, nocache: true } }
    : {};
  // (An `getActiveTournamentByOrg` call sat here with its result unused — a per-request query on
  // EVERY route under /{orgSlug} that fed nothing. Removed while making this layout's Stage F
  // lookups cheap; the metadata below never referenced it.)
  return {
    // The club's own pages set an ABSOLUTE "page · club" title (lib/club-page-meta.ts); this template is what
    // tournament pages, which title themselves with a bare name, still read — unchanged by the club's frame.
    title: {
      default: org.name,
      template: `%s | ${org.name}`,
    },
    description: clubDescription(siteContent, org.name),
    // No preview image here (Club Tier Stage 4b-2b): the club's generated card (app/[orgSlug]/opengraph-image.tsx) carries
    // its logo in its colours, and every page under the club inherits it unless it names its own. An image set HERE would
    // silently replace that card — Next skips a segment's generated image when the same segment's metadata names one.
    ...demoRobots,
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
  if (!org) notFound();

  const theme = resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);
  // Club Tier Stage 4b-1 (End state 9): the club's colour as the four roles its light site needs, derived from the colour
  // already saved. Written beside today's vars (tournament pages keep reading those); only the club's frame reads these.
  const roles = clubColourRoles(org.themePreset, org.themePrimary, org.themeAccent);
  const siteOpen = isPublicClubSiteOpen(org);

  // ── Stage F: the org's section tabs ────────────────────────────────────────────
  // Tier-gated and deliberately CHEAP (see lib/org-section-availability for why it can't be
  // pathname-gated: this layout also wraps admin/coaches/scorekeeper and every tournament page,
  // and a Server Component has no pathname here — proxy.ts intentionally doesn't run on public org
  // routes, which is what keeps an anonymous page free of session work). Two `head:true` counts.
  // The club's site content (tagline, contact, social links) feeds both the tabs and the club's bar and footer: one read.
  // Read once, alongside the section checks rather than before them — this layout wraps every route under the club.
  // The club's own words and contact (tagline, contact email, social links) are the public-site module's: a club on a
  // plan without it shows its name and logo only, as its pages always did — and its routes skip the read entirely.
  const siteContentRead = siteOpen && hasModuleEntitlement(org, 'module_public_site')
    ? getClubSiteContent(org.id)
    : Promise.resolve(null);
  const [siteContent, sections] = await Promise.all([siteContentRead, resolveOrgSections(org, siteContentRead)]);

  // ── The sandbox hat ────────────────────────────────────────────────────────────
  // Mounted HERE because this one layout wraps both halves of the product for an org — the public
  // tournament pages and the admin shell — which is exactly the span the sandbox chrome has to
  // cover. The lookup is a hardcoded allow-list (lib/demo-org.ts), so it costs no query and every
  // real customer takes the `null` branch and renders precisely what they render today.
  const demoOrg = getDemoOrgBySlug(orgSlug);

  // Is this visitor actually holding the demo organizer's session? The tour uses it to decide where
  // its operator step POINTS: straight at the dashboard for the demo organizer, and at the door for
  // anyone else — the door is what knows how to get an anonymous visitor or a signed-in customer
  // there, and the admin shell would simply bounce them.
  //
  // The session lookup is INSIDE the demo branch on purpose. Resolving a session on every public
  // org render is exactly the cost this layout is careful to avoid (see the Stage F note above);
  // paying it on one fictional org, whose whole traffic is people looking at invented teams, is
  // free in the way that matters.
  //
  // The demo's start button opens the sign-up its own story is about (The first look, rule 8 / F14, owner
  // 2026-10-19: one door per thing): the coach demo the one "Coach a team" rule (it opened the organization
  // sign-up), the tournament demo Run a tournament. Only the coach demo reads gating; the two lookups are
  // independent, so they run side by side.
  const [demoUser, demoStartHref] = await Promise.all([
    demoOrg ? getAuthUserCached() : null,
    demoOrg?.kind === 'coach' ? getCoachStartHref().catch(() => '/start') : '/start/tournament',
  ]);
  const isDemoOrganizer = !!demoOrg && demoUser?.email?.trim().toLowerCase() === demoOrg.organizerEmail;

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
    <SandboxProvider
      value={{
        isSandbox: demoOrg !== null,
        kind: demoOrg?.kind ?? null,
        slug: demoOrg?.slug ?? null,
        landingPath: demoOrg?.landingPath ?? null,
      }}
    >
      <OrgNavSync logoUrl={org.logoUrl ?? null} orgName={org.name} />
      {/* Sets vars on :root so globally-mounted components (Navbar, ConsumerNav) inherit the org theme */}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      {demoOrg && (
        /* Suspense: the chrome reads useSearchParams (Money-hub tabs are query-addressed), which
           Next requires a boundary for if this tree is ever statically prerendered. */
        <Suspense fallback={null}>
          <SandboxChrome
            kind={demoOrg.kind}
            slug={demoOrg.slug}
            landingPath={demoOrg.landingPath}
            isDemoOrganizer={isDemoOrganizer}
            startHref={demoStartHref}
          />
        </Suspense>
      )}
      <div
        className={fontClasses}
        data-card-style={org.themeCardStyle ?? 'default'}
      >
        {/* Club Tier Stage 4a — the club's "not found" (app/[orgSlug]/not-found.tsx) receives no params, so this
            layout hands it the club: its name, and whether its public site is open (the switch on, not cancelled).
            ⚠ This layout still refuses ONLY a club that does not exist: tournament pages stay up when the site is off
            (BUSINESS_DECISIONS 2026-07-22); each club page asks the one rule itself (lib/public-club-page.ts). */}
        {/* `teamsPage`: the Teams tab is up exactly when the club has a Teams page to send a lost visitor to (4b-2a). */}
        <PublicClubProvider club={{ slug: orgSlug, name: org.name, siteOpen, teamsPage: sections.some(s => s.key === 'teams') }}>
          {/* Club Tier Stage 4b-1 — the club's site (its bar, its footer, its light ground and type) around every club
              page. The frame decides WHICH pages wear it (this layout also wraps tournament pages and the signed-in
              tools, and cannot read the address); it carries no identity, so it is safe in SW-cached anonymous HTML. */}
          <ClubFrame
            club={{
              slug: orgSlug,
              name: org.name,
              logoUrl: org.logoUrl ?? null,
              tagline: siteContent?.tagline?.trim() || null,
              sections,
              contactEmail: siteContent?.contactEmail?.trim() || null,
              socials: clubSocials(siteContent),
              showCredit: !isFreePlan(org.planId),
              face: clubFace(org.themeFont),
            }}
          >
            {children}
          </ClubFrame>
        </PublicClubProvider>
      </div>
    </SandboxProvider>
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
