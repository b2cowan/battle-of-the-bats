// Single source of truth for which theme a public tournament page resolves to. (The old light-mode CSS variable
// block that the dark-ground pages injected went with the preview switch, Public tournament pages Stage 8 Part 4a:
// the frame is light on its own tokens.)
//
// Deliberately free of server-only imports: the setup wizard's live preview
// (components/admin/TournamentCreationPreview.tsx) resolves the same theme in the
// BROWSER, so it can show an organizer the colours their page will actually publish
// in. lib/tournament-preview.ts cannot be imported there (it pulls in auth + routing).
import { resolveTheme, type ResolvedTheme } from './themes';
import { canUseAdvancedTournamentBranding } from './tournament-branding';
import type { Organization, Tournament } from './types';

type ThemeOrg = Pick<Organization, 'planId' | 'themePreset' | 'themePrimary' | 'themeAccent'>;
type ThemeTournament = Pick<Tournament, 'themePreset' | 'themePrimary' | 'themeAccent'>;

/**
 * Does this tournament carry a theme of its own that overrides the org's?
 *
 * True whenever the org's plan does NOT include advanced branding — those tournaments
 * always publish on the platform theme, ignoring any stale branding values left on the
 * row — and, for plans that do, only once the tournament has actually been given one.
 */
export function hasOwnTournamentTheme(
  org: ThemeOrg,
  tournament?: ThemeTournament | null,
): boolean {
  if (!canUseAdvancedTournamentBranding(org)) return true;
  return !!(tournament?.themePreset || tournament?.themePrimary);
}

/**
 * The theme a public tournament page renders in: the tournament's own where it has one,
 * the FieldLogicHQ platform theme on plans without advanced branding, and the org's
 * theme otherwise (a branded org that has not themed this particular event).
 *
 * The ONE copy of that rule. It used to be typed out separately in the tournament
 * layout and in buildPublicThemeCssVars; a third copy in the wizard preview would have
 * been the copy that quietly disagreed.
 */
export function resolvePublicTournamentTheme(
  org: ThemeOrg,
  tournament?: ThemeTournament | null,
): ResolvedTheme {
  const advanced = canUseAdvancedTournamentBranding(org);
  if (!hasOwnTournamentTheme(org, tournament)) {
    return resolveTheme(org.themePreset, org.themePrimary, org.themeAccent);
  }
  return resolveTheme(
    advanced ? tournament?.themePreset : 'platform',
    advanced ? tournament?.themePrimary : null,
    advanced ? tournament?.themeAccent : null,
  );
}
