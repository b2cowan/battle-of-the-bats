/**
 * lib/club-colour-roles.ts — a club's colour, made safe on its light site (Club Tier Stage 4b-1; End state 9 of the
 * Stage 4 drawings, https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k, ruled 2026-10-19).
 *
 * A club picks a main colour and, optionally, an accent (or a preset that sets both). Its public pages sit on ONE light
 * ground for every club, and from the main colour they derive four roles:
 *   · FILL     — the bar, the footer, buttons.
 *   · ON FILL  — the text on the fill: white or near-black, whichever is clearer.
 *   · INK      — the colour darkened until it reaches 4.5 : 1 on the page ground (the darkest ground it sits on; a white
 *                card is lighter, so it clears there too): links, the selected tab, Up next.
 *   · EDGE     — what keeps a light button and the Open now callout visible on the ground: the fill when it already
 *                reaches 3 : 1 there, otherwise the ink.
 * The ACCENT is decoration only (the rule under the bar and over the footer, the logo tile). No tints anywhere.
 * A colour that fails 4.5 : 1 with BOTH texts has its fill darkened, a step at a time, until white text clears it.
 *
 * Derived when the page renders, from the colour already saved — every existing club gets it without doing anything.
 * Why not lib/themes.ts's `primaryLight`: that recipe LIFTS the colour toward white, which is right on the old dark
 * ground and wrong on a light one (a lifted gold is invisible on #F6F5F2). Tournament pages keep that recipe.
 */
import { contrastRatio } from './color-contrast';
import { resolveTheme, PRESETS } from './themes';

/** The club site's ground and card (the drawings' `--g-bg` / `--g-card`), the same for every club. */
export const CLUB_GROUND = '#F6F5F2';
export const CLUB_CARD = '#FFFFFF';
/** The site's near-black ink (the drawings' `--g-ink`) — the dark choice of text on a light fill. */
export const CLUB_NEAR_BLACK = '#1F1B16';
const WHITE = '#FFFFFF';
/** FieldLogicHQ's own lime, the default preset's accent — never decoration on a club's site. */
const PLATFORM_LIME = PRESETS.platform.accent;

export interface ClubColourRoles {
  fill: string;
  onFill: string;
  ink: string;
  edge: string;
  accent: string;
  /** The selected desk tab's underline: the accent where it shows on the fill (3 : 1), else the text on the fill — so a
   *  club whose accent IS its fill (the drawings' pink) still sees which tab it is on. */
  mark: string;
  /** The logo tile behind the initials (a club with no logo): the accent when the club chose one, else the text on fill. */
  tile: string;
  tileInk: string;
  /** True when the club's own colour had to be darkened to carry text (the Look card's sentence is 4c). */
  darkened: boolean;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Scale every channel toward black by `factor` (1 = unchanged). The drawings' pink: 0.93 of #E0457B is #D04072. */
function scale(hex: string, factor: number): string {
  const ch = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0');
  return `#${ch(1)}${ch(3)}${ch(5)}`.toUpperCase();
}

/** The lightest darkening of `hex` (1 % steps) that reaches `ratio` against `against`. Black always does. */
function darkenUntil(hex: string, against: string, ratio: number): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = scale(hex, 1 - step / 100);
    if (contrastRatio(candidate, against) >= ratio) return candidate;
  }
  return '#000000';
}

export function clubColourRoles(
  preset: string | null | undefined,
  customPrimary: string | null | undefined,
  customAccent: string | null | undefined,
): ClubColourRoles {
  const theme = resolveTheme(preset, customPrimary, customAccent);
  const chosen = theme.primary.toUpperCase();

  const clearer = (fill: string) =>
    contrastRatio(WHITE, fill) >= contrastRatio(CLUB_NEAR_BLACK, fill) ? WHITE : CLUB_NEAR_BLACK;

  let fill = chosen;
  let onFill = clearer(fill);
  const darkened = contrastRatio(onFill, fill) < 4.5;
  if (darkened) {
    fill = darkenUntil(chosen, WHITE, 4.5);
    onFill = WHITE;
  }

  const ink = darkenUntil(fill, CLUB_GROUND, 4.5);
  const edge = contrastRatio(fill, CLUB_GROUND) >= 3 ? fill : ink;

  const accentChosen = !!customAccent && HEX_RE.test(customAccent);
  const customColour = !!customPrimary && HEX_RE.test(customPrimary);
  // A named preset's accent was tuned as a light tint on the old dark ground; as DECORATION on the club's fill it still
  // reads. A custom colour with no accent takes the edge (the drawings' sky and pink) — and so does a club that never
  // chose at all: the default preset's accent is FieldLogicHQ's own lime, and a club's pages advertise nothing.
  const usesPresetAccent = !customColour && !!preset && preset !== 'platform' && theme.accent !== PLATFORM_LIME;
  const accent = (accentChosen ? customAccent! : usesPresetAccent ? theme.accent : edge).toUpperCase();
  const mark = contrastRatio(accent, fill) >= 3 ? accent : onFill;

  // The initials' tile: the accent with whichever of fill / text-on-fill reads on it; if neither does, the text on fill
  // with the fill on it (the pair the darkening already guarantees at 4.5 : 1).
  let tile = accentChosen ? accent : onFill;
  let tileInk = contrastRatio(fill, tile) >= contrastRatio(onFill, tile) ? fill : onFill;
  if (contrastRatio(tileInk, tile) < 3) {
    tile = onFill;
    tileInk = fill;
  }

  return { fill, onFill, ink, edge, accent, mark, tile, tileInk, darkened };
}

/** `r, g, b` of a `#rrggbb`, for the few rules that need the ink with an alpha (focus rings, hairlines). */
export function hexChannels(hex: string): string {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');
}
