import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter, Barlow_Condensed, DM_Serif_Display, DM_Sans } from 'next/font/google';
import { getOrganizationBySlug } from '@/lib/db';
import { resolveTheme } from '@/lib/themes';
import { OrgNavProvider } from '@/components/OrgNavContext';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return {};
  return {
    title: org.name,
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
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const theme = resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);

  const cssVars = [
    `--primary:       ${theme.primary}`,
    `--primary-light: ${theme.primaryLight}`,
    `--primary-rgb:   ${theme.primaryRgb}`,
    `--primary-glow:  rgba(${theme.primaryRgb}, 0.35)`,
    `--primary-faint: rgba(${theme.primaryRgb}, 0.08)`,
    `--border:        rgba(${theme.primaryRgb}, 0.25)`,
    `--glow:          0 0 32px rgba(${theme.primaryRgb}, 0.4)`,
    `--glow-sm:       0 0 16px rgba(${theme.primaryRgb}, 0.25)`,
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
    <OrgNavProvider logoUrl={org.logoUrl ?? null} orgName={org.name}>
      {/* Sets vars on :root so globally-mounted components (Navbar, BottomNav) inherit the org theme */}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${cssVars} }` }} />
      <div
        className={fontClasses}
        data-card-style={org.themeCardStyle ?? 'default'}
      >
        {children}
      </div>
    </OrgNavProvider>
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
