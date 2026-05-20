import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { resolveTheme } from '@/lib/themes';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import TournamentNavSync from '@/components/TournamentNavSync';

export const dynamic = 'force-dynamic';

export default async function TournamentLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !org.isPublic) notFound();
  if (org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  const canUseAdvancedBranding = canUseAdvancedTournamentBranding(org);
  // Apply tournament-level preset overrides for all plans; custom values are Plus+.
  const hasTournamentTheme = !!(tournament.themePreset || (canUseAdvancedBranding && tournament.themePrimary));
  let tournamentCssVars: string | null = null;
  if (hasTournamentTheme) {
    const t = resolveTheme(
      tournament.themePreset,
      canUseAdvancedBranding ? tournament.themePrimary : null,
      canUseAdvancedBranding ? tournament.themeAccent : null
    );
    tournamentCssVars = [
      `--primary:       ${t.primary}`,
      `--primary-light: ${t.primaryLight}`,
      `--primary-rgb:   ${t.primaryRgb}`,
      `--primary-glow:  rgba(${t.primaryRgb}, 0.35)`,
      `--primary-faint: rgba(${t.primaryRgb}, 0.08)`,
      `--border:        rgba(${t.primaryRgb}, 0.25)`,
      `--glow:          0 0 32px rgba(${t.primaryRgb}, 0.4)`,
      `--glow-sm:       0 0 16px rgba(${t.primaryRgb}, 0.25)`,
    ].join('; ');
  }

  const cardStyle = canUseAdvancedBranding
    ? tournament.themeCardStyle ?? org.themeCardStyle ?? 'default'
    : org.themeCardStyle ?? 'default';

  // Light mode: override :root tokens so body background and all descendants flip.
  const lightModeVars = tournament.colorMode === 'light' ? [
    '--bg:              #F5F7FC',
    '--bg-2:            #EEF1F8',
    '--bg-3:            #E5E9F2',
    '--surface:         #FFFFFF',
    '--surface-2:       #F0F3FA',
    '--white:           #0F1123',
    '--white-90:        rgba(15,17,35,0.9)',
    '--white-80:        rgba(15,17,35,0.8)',
    '--white-70:        rgba(15,17,35,0.7)',
    '--white-60:        rgba(15,17,35,0.6)',
    '--white-50:        rgba(15,17,35,0.5)',
    '--white-45:        rgba(15,17,35,0.45)',
    '--white-40:        rgba(15,17,35,0.4)',
    '--white-35:        rgba(15,17,35,0.35)',
    '--white-30:        rgba(15,17,35,0.3)',
    '--white-10:        rgba(15,17,35,0.07)',
    '--border-2:        rgba(15,17,35,0.1)',
    '--shadow-sm:       0 2px 8px rgba(0,0,0,0.1)',
    '--shadow:          0 4px 24px rgba(0,0,0,0.12)',
    '--shadow-lg:       0 8px 48px rgba(0,0,0,0.16)',
    '--fl-text:         #0F1123',
    '--data-gray:       #4B5563',
    '--hud-surface:     #FFFFFF',
    '--nav-bg-scrolled: rgba(245,247,252,0.95)',
    '--nav-mobile-bg:   rgba(245,247,252,0.99)',
  ].join('; ') : null;

  return (
    <>
      <TournamentNavSync
        slug={tournament.slug}
        tournamentName={tournament.name}
        colorMode={tournament.colorMode ?? 'dark'}
        hiddenPages={tournament.publicHiddenPages ?? []}
      />
      {tournamentCssVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${tournamentCssVars} }` }} />
      )}
      {lightModeVars && (
        <style dangerouslySetInnerHTML={{ __html: `:root { ${lightModeVars} }` }} />
      )}
      <div data-card-style={cardStyle} data-color-mode={tournament.colorMode ?? 'dark'}>
        {children}
      </div>
    </>
  );
}
