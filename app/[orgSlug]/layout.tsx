import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter, Barlow_Condensed, DM_Serif_Display, DM_Sans } from 'next/font/google';
import { getOrganizationBySlugForServer } from '@/lib/server-organizations';
import { resolveTheme } from '@/lib/themes';
import { resolveOrgSections } from '@/lib/org-section-availability';
import { ORG_SECTION_TABS_MIN } from '@/lib/org-public-sections';
import { OrgNavSync } from '@/components/OrgNavSync';
import OrgSectionTabs from '@/components/public/OrgSectionTabs';

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
  const org = await getOrganizationBySlugForServer(orgSlug);
  if (!org) return {};
  // (An `getActiveTournamentByOrg` call sat here with its result unused — a per-request query on
  // EVERY route under /{orgSlug} that fed nothing. Removed while making this layout's Stage F
  // lookups cheap; the metadata below never referenced it.)
  return {
    title: {
      default: org.name,
      template: `%s | ${org.name}`,
    },
    openGraph: org.logoUrl ? { images: [{ url: org.logoUrl }] } : undefined,
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
  const org = await getOrganizationBySlugForServer(orgSlug);
  if (!org) notFound();

  const theme = resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);

  // ── Stage F: the org's section tabs ────────────────────────────────────────────
  // Tier-gated and deliberately CHEAP (see lib/org-section-availability for why it can't be
  // pathname-gated: this layout also wraps admin/coaches/scorekeeper and every tournament page,
  // and a Server Component has no pathname here — proxy.ts intentionally doesn't run on public org
  // routes, which is what keeps an anonymous page free of session work). Two `head:true` counts.
  const sections = await resolveOrgSections(org);
  // Fewer than two sections means there is nowhere else to go — a row holding only "Home" is
  // chrome that says nothing, so it doesn't render.
  const showSectionTabs = sections.length >= ORG_SECTION_TABS_MIN;

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
      <OrgNavSync logoUrl={org.logoUrl ?? null} orgName={org.name} />
      {/* Sets vars on :root so globally-mounted components (Navbar, ConsumerNav) inherit the org theme */}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      {/* Stage F — the org's own section nav. Mounted here because which sections exist is SERVER
          data; the component itself decides WHERE to render, because this layout also wraps
          `/admin`, `/coaches`, `/scorekeeper` and every tournament page and cannot read the
          pathname. It carries NO identity, so it is safe in SW-cached anonymous HTML. */}
      {showSectionTabs && <OrgSectionTabs sections={sections} />}
      <div
        className={fontClasses}
        data-card-style={org.themeCardStyle ?? 'default'}
      >
        {children}
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
