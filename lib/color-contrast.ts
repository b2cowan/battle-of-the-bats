/**
 * lib/color-contrast.ts
 * Single source for WCAG relative-luminance + ink-picking. Consolidated two prior
 * hand-copies of the sRGB-linearize luminance formula into one implementation.
 *
 * pickInk() PARAMETERIZES the crossover on purpose: 0.42 suits arbitrary full-range
 * brand hex (lib/themes.ts); a fill from a narrow lightness band needs its own (the team
 * palette needed 0.20 — see lib/team-color.ts). Do not "simplify" the crossover into one
 * constant: merging naively under-contrasts warm golds.
 */

export const INK_DARK = '#0F1123';
export const INK_WHITE = '#FFFFFF';

/** sRGB channel linearization (WCAG). Input + output normalized 0–1. */
function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance from normalized 0–1 sRGB channels. */
function relativeLuminance01(r: number, g: number, b: number): number {
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

/** WCAG contrast ratio between two `#rrggbb` colours (1 to 21, order-independent). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
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
