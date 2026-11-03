/**
 * THE LOOK CARD'S DRAFT, PURE (Public tournament pages Stage 1a Part 3): what the draft reads as, and what it saves.
 *
 * The Branding page's save under the public pages' new frame (Public tournament pages Stage 1a Part 3). D7's rule, kept
 * and widened: the theme rides only once changed, and so does the TYPE (`typeLook`, the three looks, stored as picked —
 * null follows the club). What the page no longer shows never rides at all: the retired font list, the card style,
 * Dark/Light and the App name keep their saved values (the switch-off pages still read some of them). "The club's look"
 * writes the theme and the type null. Switch off, the page sends its own body (page.tsx `bodyOf`), unchanged.
 */
import { normalizeHiddenPublicPages, type PublicPageKey } from '../../../../../lib/public-pages';
import type { LookTournament } from '../../../../../lib/tournament-look';

/** The draft fields the Look card reads and writes (the page's Draft carries them). */
export type LookDraft = {
  /** The tournament carries colours of its own (a swatch or Custom chosen). False = it follows (A) / the plain look (D). */
  own: boolean;
  presetKey: string;
  customPrimary: string;
  customAccent: string;
  /** The type look's stored value (`system | dm-serif | inter`), or null to follow the club (Classic on Tournament Plus). */
  typeKey: string | null;
  publicHiddenPages: PublicPageKey[];
};

/** The draft as the tournament's saved look would read — what the one rule (lib/tournament-look.ts) is applied to. */
export function lookOfDraft(d: Pick<LookDraft, 'own' | 'presetKey' | 'customPrimary' | 'customAccent' | 'typeKey'>, logoUrl: string | null): LookTournament {
  const custom = d.presetKey === 'custom';
  return {
    themePreset: d.own ? (custom ? 'platform' : d.presetKey) : null,
    themePrimary: d.own && custom ? d.customPrimary : null,
    themeAccent: d.own && custom ? d.customAccent : null,
    themeFont: d.typeKey,
    logoUrl,
  };
}

export type FrameBodyDraft = LookDraft & {
  iconBg: string | null;
  iconScale: number;
  coachNamesShowOnPublic: boolean;
};

/** The App icon's logo size stored as null at its tuned default (the page's slider). */
export const ICON_SCALE_DEFAULT = 100;

export function frameBodyOf(d: FrameBodyDraft, advanced: boolean, themeChanged: boolean, typeChanged: boolean) {
  const pages = { publicHiddenPages: normalizeHiddenPublicPages(d.publicHiddenPages), coachNamesShowOnPublic: d.coachNamesShowOnPublic };
  if (!advanced) return pages;
  // The same encoding the preview reads (lookOfDraft), so what shows and what saves cannot drift.
  const { themePreset, themePrimary, themeAccent } = lookOfDraft(d, null);
  const theme = themeChanged ? { themePreset, themePrimary, themeAccent } : {};
  return {
    ...theme,
    ...(typeChanged ? { typeLook: d.typeKey } : {}),
    iconBgColor: d.iconBg,
    iconScale: d.iconScale === ICON_SCALE_DEFAULT ? null : d.iconScale,
    ...pages,
  };
}
