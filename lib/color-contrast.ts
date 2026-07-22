/**
 * lib/color-contrast.ts
 * Single source for WCAG relative-luminance + ink-picking, shared by lib/themes.ts
 * (org brand primaries, parsed from hex) and lib/team-color.ts (auto-generated team
 * colours, derived from HSL). Consolidates two prior hand-copies of the sRGB-linearize
 * luminance formula into one implementation.
 *
 * The two callers keep their own, individually-justified ink crossovers — 0.42 for
 * arbitrary full-range brand hex, 0.20 for the team palette's fixed 45%-lightness band
 * (see the note at each call site). This module PARAMETERIZES the crossover via
 * pickInk() rather than collapsing them to one constant; merging naively would
 * under-contrast warm team golds. Do not "simplify" the two thresholds into one.
 */

export const INK_DARK = '#0F1123';
export const INK_WHITE = '#FFFFFF';

/** sRGB channel linearization (WCAG). Input + output normalized 0–1. */
function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance from normalized 0–1 sRGB channels. */
export function relativeLuminance01(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG relative luminance from a `#rrggbb` hex string. */
export function relativeLuminance(hex: string): number {
  return relativeLuminance01(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}

/**
 * HSL → normalized 0–1 sRGB channels (h, s, l all 0–1). Same standard conversion
 * lib/team-color.ts used inline; extracted so the luminance formula has one home.
 */
export function hslChannels01(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/**
 * Pick legible ink (near-black vs white) for text/glyphs sitting on a coloured fill,
 * given the fill's relative luminance and the crossover luminance where white and
 * near-black contrast cross. The crossover is caller-supplied on purpose — it depends
 * on the fill colour's range (see module header).
 */
export function pickInk(luminance: number, crossover: number): string {
  return luminance > crossover ? INK_DARK : INK_WHITE;
}

// NOTE: the warm team-colour guards (near-white hairline fallback, olive text-lightness
// clamp, live-red hue exclusion) will live here too, but are added alongside their first
// caller in the Stage-4 lineup/accent work — not before, so their constants are validated
// by a real consumer rather than shipped speculatively.
