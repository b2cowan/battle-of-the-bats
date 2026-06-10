import { notFound } from 'next/navigation';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { getTournamentBySlug } from '@/lib/db';
import { resolveTheme } from '@/lib/themes';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import type { Organization, Tournament } from '@/lib/types';

// The light-mode CSS var block is shared with the live public layout so the two
// can never drift. Re-exported here for the preview layout's existing import.
export { buildPublicLightModeCssVars } from '@/lib/public-tournament-theme';

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

export function getPreviewCardStyle(org: Organization, tournament?: Tournament | null): string {
  if (!canUseAdvancedTournamentBranding(org)) return 'default';
  return tournament?.themeCardStyle ?? org.themeCardStyle ?? 'default';
}

export function getPreviewColorMode(org: Organization, tournament?: Tournament | null): 'dark' | 'light' {
  if (!canUseAdvancedTournamentBranding(org)) return 'dark';
  return tournament?.colorMode === 'light' ? 'light' : 'dark';
}
