import { notFound } from 'next/navigation';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';
import { getTournamentBySlug } from '@/lib/db';
import { canUseAdvancedTournamentBranding } from '@/lib/tournament-branding';
import { resolvePublicTournamentTheme } from '@/lib/public-tournament-theme';
import type { Organization, Tournament } from '@/lib/types';

// The light-mode CSS var block is shared with the live public layout so the two
// can never drift. Re-exported here for the preview layout's existing import.
export { buildPublicLightModeCssVars } from '@/lib/public-tournament-theme';

export async function getTournamentPreviewContext(orgSlug: string, tournamentSlug: string): Promise<{
  org: Organization;
  tournament: Tournament;
}> {
  // `allowSuspendedOrg: true` so a cancelled org gets a clean 404 below instead of an uncaught
  // throw rendering an error boundary. It does NOT mean "let them through" — see the next check.
  const ctx = await getAuthContextWithScope({ orgSlug, allowSuspendedOrg: true });
  if (!ctx || ctx.org.slug !== orgSlug) notFound();

  // ⚠ SERVER-SIDE billing stop, and it must stay here. These preview pages are true Server
  // Components that read tournament data with `{ admin: true }` (service-role, bypassing the
  // public visibility gates). CancellationGuard cannot cover them: it is a client component whose
  // redirect fires in a useEffect AFTER mount, so the full admin-only HTML — schedule, standings,
  // registration fields — is rendered and sent before any redirect, and is never redirected at all
  // for a client that doesn't run JS. Same server-side `notFound()` shape the public archive and
  // tournament pages already use for a cancelled org. (/review 2026-08-06.)
  if (isOrgBillingSuspended(ctx.org)) notFound();

  const tournament = await getTournamentBySlug(ctx.org.id, tournamentSlug);
  if (!tournament) notFound();

  if (ctx.assignedTournamentIds !== null && !ctx.assignedTournamentIds.includes(tournament.id)) {
    notFound();
  }

  return { org: ctx.org, tournament };
}

export function buildPublicThemeCssVars(org: Organization, tournament?: Tournament | null): string {
  const theme = resolvePublicTournamentTheme(org, tournament);

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
