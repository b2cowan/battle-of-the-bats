// Single source of truth for which theme a public tournament page resolves to. (The old light-mode CSS variable
// block that the dark-ground pages injected went with the preview switch, Public tournament pages Stage 8 Part 4a:
// the frame is light on its own tokens.)
//
// Deliberately free of server-only imports: the setup wizard's live preview
// (components/admin/TournamentCreationPreview.tsx) resolves the same theme in the
// BROWSER, so it can show an organizer the colours their page will actually publish
// in. lib/tournament-preview.ts cannot be imported there (it pulls in auth + routing).
import { resolveTheme, type ResolvedTheme } from './themes';
import { resolveTournamentLook, type LookOrg } from './tournament-look';
import type { Tournament } from './types';

type ThemeTournament = Pick<Tournament, 'themePreset' | 'themePrimary' | 'themeAccent'>;

/**
 * The theme a public tournament page's accents render in (`--primary` and its family: the Register steps, the follow
 * line, the share button, the My Team dock). It is the BAND's colour, read from the one look rule
 * (`resolveTournamentLook`): no tournament branding on the plan → FieldLogicHQ; Tournament Plus with nothing saved →
 * the plain FieldLogicHQ look (owner 2026-11-02: the leftover org look is kept, not read); a club → its rule
 * (*Always* = the club's colours even over a tournament's own).
 *
 * ⚠ It used to be its own rule (own colours, else the org's), which agreed with the band until the club rule and the
 * plain look arrived: a club on *Always* then wore its colours on the band and the tournament's on every button
 * (Stage 8 Part 6 review). One rule, so it cannot drift again.
 */
export function resolvePublicTournamentTheme(org: LookOrg, tournament?: ThemeTournament | null): ResolvedTheme {
  // Only the colours are read here; the type look and the logo are the band's business.
  const look = resolveTournamentLook(org, tournament ? { ...tournament, themeFont: null, logoUrl: null } : null);
  return resolveTheme(look.preset, look.primary, look.accent);
}
