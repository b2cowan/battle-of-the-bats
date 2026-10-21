/**
 * lib/colour-words.ts — A CLUB'S LOOK, SAID IN WORDS (Club Tier Stage 4c-1, the editor's Look card; drawings ~L1502–1508;
 * words CLUB_TIER_STAGE4C1_COPY.md §E).
 *
 * The Look card is read only: the logo, colours and font are set in Organization › Settings. It says them the way a
 * volunteer would ("Navy and gold · the default font"), says the site is readable, and says so when the platform had to
 * darken the club's colour to carry text (`clubColourRoles().darkened`). Plain names from hue and lightness — a word a
 * parent would use, never a hex code. Pure; tested in tests/unit/club-stage4c1.test.ts.
 */
import { clubColourRoles } from './club-colour-roles';
import { clubFace } from './club-site';
import { FONT_OPTIONS, resolveTheme } from './themes';

function hsl(hex: string): { h: number; s: number; l: number } {
  const v = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const r = v(1), g = v(3), b = v(5);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** "navy", "gold", "dark green", "pink" — a plain name for a #rrggbb colour. */
export function colourWord(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'your colour';
  const { h, s, l } = hsl(hex);
  if (l < 0.1) return 'black';
  if (l > 0.93) return 'white';
  if (s < 0.12) return l < 0.3 ? 'charcoal' : l > 0.75 ? 'light grey' : 'grey';
  if (h >= 330 || h < 12) {
    if (l < 0.4) return 'maroon';
    return h >= 330 && h < 350 ? 'pink' : 'red';
  }
  if (h < 38) return l < 0.35 ? 'brown' : 'orange';
  if (h < 55) return l < 0.3 ? 'brown' : 'gold';
  if (h < 70) return 'yellow';
  if (h < 160) return l < 0.3 ? 'dark green' : l > 0.7 ? 'light green' : 'green';
  if (h < 195) return 'teal';
  if (h < 255) return l < 0.36 ? 'navy' : l > 0.7 ? 'light blue' : 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** The font as Settings names it (`FONT_OPTIONS`); the club site's warm pair is "the default font". */
const FACE_WORD: Record<ReturnType<typeof clubFace>, string> = {
  warm: 'the default font',
  'dm-serif': FONT_OPTIONS['dm-serif'].label,
  inter: FONT_OPTIONS.inter.label,
};

export interface LookWords {
  /** The colour roles the words were said from (the Look card's swatches). */
  roles: ReturnType<typeof clubColourRoles>;
  /** "Navy and gold · the default font" */
  summary: string;
  /** "White text on navy, navy links. Readable on every page." */
  readable: string;
  /** "We made your pink a little darker on text and buttons so families can read it.", or null. */
  darkened: string | null;
}

export function lookWords(theme: { preset: string | null | undefined; primary: string | null | undefined; accent: string | null | undefined; font: string | null | undefined }): LookWords {
  const roles = clubColourRoles(theme.preset, theme.primary, theme.accent);
  const chosen = colourWord(resolveTheme(theme.preset, theme.primary, theme.accent).primary.toUpperCase());
  const accent = colourWord(roles.accent);
  const colours = accent === chosen ? capital(chosen) : `${capital(chosen)} and ${accent}`;
  const fillWord = colourWord(roles.fill);
  const text = roles.onFill.toUpperCase() === '#FFFFFF' ? 'White' : 'Dark';
  return {
    roles,
    summary: `${colours} · ${FACE_WORD[clubFace(theme.font)]}`,
    readable: `${text} text on ${fillWord}, ${colourWord(roles.ink)} links. Readable on every page.`,
    darkened: roles.darkened ? `We made your ${chosen} a little darker on text and buttons so families can read it.` : null,
  };
}
