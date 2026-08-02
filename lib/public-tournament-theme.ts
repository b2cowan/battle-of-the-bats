// Single source of truth for the public tournament light-mode CSS variable block
// AND for which theme a public tournament page resolves to.
//
// Both the live public tournament layout (app/[orgSlug]/[tournamentSlug]/layout.tsx)
// and the admin preview layout (via lib/tournament-preview.ts) inject this exact
// block into :root when colorMode === 'light'. Keeping it here prevents the two
// from drifting — previously the preview carried a stale copy whose muted-text
// tokens were ~0.12 too light, so light-mode previews looked washed out vs prod.
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

/**
 * Light-mode token overrides: flip the dark-first :root scale so the body
 * background and every descendant render on bright surfaces.
 */
export function buildPublicLightModeCssVars(): string {
  return [
    '--bg:              #F5F7FC',
    '--bg-2:            #EEF1F8',
    '--bg-3:            #E5E9F2',
    '--surface:         #FFFFFF',
    '--surface-2:       #F0F3FA',
    '--bracket-card:    #FFFFFF',
    '--white:           #0F1123',
    '--white-90:        rgba(15,17,35,0.9)',
    '--white-85:        rgba(15,17,35,0.85)',
    '--white-80:        rgba(15,17,35,0.8)',
    '--white-75:        rgba(15,17,35,0.75)',
    '--white-70:        rgba(15,17,35,0.7)',
    '--white-65:        rgba(15,17,35,0.65)',
    '--white-60:        rgba(15,17,35,0.6)',
    // Muted-text tokens run darker in light mode than a literal alpha port of the
    // dark scale: on bright (white) surfaces 40–50% black washes out, so secondary
    // text (round labels, dates, metadata) is lifted ~0.12 for a readable contrast
    // floor without losing the "muted" read. Structural faints (-35/-30/-10) unchanged.
    '--white-55:        rgba(15,17,35,0.55)',
    '--white-50:        rgba(15,17,35,0.62)',
    '--white-45:        rgba(15,17,35,0.58)',
    '--white-40:        rgba(15,17,35,0.52)',
    '--white-35:        rgba(15,17,35,0.35)',
    '--white-30:        rgba(15,17,35,0.3)',
    '--white-20:        rgba(15,17,35,0.2)',
    '--white-10:        rgba(15,17,35,0.07)',
    '--white-8:         rgba(15,17,35,0.06)',
    '--white-5:         rgba(15,17,35,0.04)',
    '--white-03:        rgba(15,17,35,0.025)',
    '--black-20:        rgba(15,17,35,0.04)',
    '--black-30:        rgba(15,17,35,0.06)',
    '--black-40:        rgba(15,17,35,0.08)',
    '--border-2:        rgba(15,17,35,0.1)',
    '--shadow-sm:       0 2px 8px rgba(0,0,0,0.1)',
    '--shadow:          0 4px 24px rgba(0,0,0,0.12)',
    '--shadow-lg:       0 8px 48px rgba(0,0,0,0.16)',
    '--fl-text:         #0F1123',
    '--data-gray:       #4B5563',
    '--hud-surface:     #FFFFFF',
    '--nav-bg-scrolled: rgba(245,247,252,0.95)',
    '--nav-mobile-bg:   rgba(245,247,252,0.99)',
    // Accent text uses the (dark) org primary on light surfaces — the pale
    // dark-mode tint would be unreadable on white.
    '--primary-light:   var(--primary)',
  ].join('; ');
}
