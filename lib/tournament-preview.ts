import { notFound } from 'next/navigation';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { getTournamentBySlug } from '@/lib/db';
import { resolveTheme } from '@/lib/themes';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import type { Organization, Tournament } from '@/lib/types';

export async function getTournamentPreviewContext(orgSlug: string, tournamentSlug: string): Promise<{
  org: Organization;
  tournament: Tournament;
}> {
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx || ctx.org.slug !== orgSlug) notFound();

  const tournament = await getTournamentBySlug(ctx.org.id, tournamentSlug);
  if (!tournament) notFound();

  if (ctx.assignedTournamentIds !== null && !ctx.assignedTournamentIds.includes(tournament.id)) {
    notFound();
  }

  return { org: ctx.org, tournament };
}

export function buildPublicThemeCssVars(org: Organization, tournament?: Tournament | null): string {
  const canUseAdvancedBranding = canUseAdvancedTournamentBranding(org);
  const hasTournamentTheme = canUseAdvancedBranding
    ? !!(tournament?.themePreset || tournament?.themePrimary)
    : true;
  const theme = hasTournamentTheme
    ? resolveTheme(
        canUseAdvancedBranding ? tournament?.themePreset : 'platform',
        canUseAdvancedBranding ? tournament?.themePrimary : null,
        canUseAdvancedBranding ? tournament?.themeAccent : null
      )
    : resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);

  return [
    `--primary:       ${theme.primary}`,
    `--primary-light: ${theme.primaryLight}`,
    `--primary-rgb:   ${theme.primaryRgb}`,
    `--primary-glow:  rgba(${theme.primaryRgb}, 0.35)`,
    `--primary-faint: rgba(${theme.primaryRgb}, 0.08)`,
    `--border:        rgba(${theme.primaryRgb}, 0.25)`,
    `--glow:          0 0 32px rgba(${theme.primaryRgb}, 0.4)`,
    `--glow-sm:       0 0 16px rgba(${theme.primaryRgb}, 0.25)`,
    `--on-primary:    ${theme.onPrimary}`,
  ].join('; ');
}

export function buildPublicLightModeCssVars(): string {
  return [
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
  ].join('; ');
}

export function getPreviewCardStyle(org: Organization, tournament?: Tournament | null): string {
  if (!canUseAdvancedTournamentBranding(org)) return 'default';
  return tournament?.themeCardStyle ?? org.themeCardStyle ?? 'default';
}

export function getPreviewColorMode(org: Organization, tournament?: Tournament | null): 'dark' | 'light' {
  if (!canUseAdvancedTournamentBranding(org)) return 'dark';
  return tournament?.colorMode === 'light' ? 'light' : 'dark';
}
