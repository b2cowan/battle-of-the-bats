/**
 * THE MARK — FieldLogicHQ's one filled shape: an F whose middle arm turns down into an L (owner ruling 2026-10-23, W:
 * "the refined Joined FL, olive leading, lime kept for actions"; spec `docs/agents/brand/VISUAL_IDENTITY.md` §4).
 *
 * ⚠ THESE PATHS ARE COPIED, NEVER REDRAWN. The source of record is the refinement page,
 * `docs/projects/active/PUBLIC_FACE_WARM_W_REFINEMENT.html` (`P.rf` and `P.rf16`), published at
 * https://claude.ai/artifact/9xDNVQyR3wJRcf7hCgiDBr. `tests/unit/public-face-s4-identity.test.ts` fails if either drifts
 * from that page. Both sit on a 64-unit grid.
 *
 *   • MAIN — 32 px and up. Codex's edges; the top-left shoulder a 12-unit curve, outer corners 3, inner corners 2.
 *   • SMALL — 16 px. On the 4-unit pixel grid: every stroke 3 px, the F/L gap 2 px, shoulder 3 px, corners 1 px. The
 *     main cut at 16 px is mush, so this cut is required wherever the mark is drawn that small.
 *
 * Lime is not in the mark anywhere: lime is the action colour. The tile is olive with the mark in paper.
 */

export const MARK_PATH_MAIN =
  'M24 12H45a3 3 0 0 1 3 3V19a3 3 0 0 1-3 3H24a2 2 0 0 0-2 2V26a2 2 0 0 0 2 2H37a3 3 0 0 1 3 3V40a2 2 0 0 0 2 2H49a3 3 0 0 1 3 3V49a3 3 0 0 1-3 3H33a3 3 0 0 1-3-3V40a2 2 0 0 0-2-2H24a2 2 0 0 0-2 2V49a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V24a12 12 0 0 1 12-12Z';

export const MARK_PATH_SMALL =
  'M24 12H48a4 4 0 0 1 4 4V20a4 4 0 0 1-4 4H24V28H40a4 4 0 0 1 4 4V40H52a4 4 0 0 1 4 4V48a4 4 0 0 1-4 4H32V40H24V52H12V24a12 12 0 0 1 12-12Z';

/** The glyph's bounding box on the 64 grid, for drawing the bare mark beside the name (no tile, no padding). */
export const MARK_BARE_VIEWBOX = '10 10 44 44';

/**
 * On a tile, a square or a maskable icon the glyph sits 1.5 units right of centre: its weight is on the left, so the
 * optical centre is not the geometric one. Never in the lockup, and never on the 16 px cut (it is on the pixel grid).
 */
export const MARK_TILE_NUDGE_X = 1.5;

/**
 * The identity's fixed colours. These are the warm palette's own values (`--home-olive`, `--home-paper`, `--home-ink`)
 * written out, because an icon file, an image renderer and an email cannot read a CSS variable;
 * `tests/unit/public-face-s4-identity.test.ts` holds them equal to the palette.
 */
export const BRAND_OLIVE = '#57651E';
export const BRAND_PAPER = '#F8F4ED';
export const BRAND_INK = '#241E15';

/** The mark on its olive tile, as SVG markup on the 64 grid. `rx` 12 is the rounded tab tile; 0 is a full square. */
export function markTileSvg({ size, rx = 12, small = false }: { size: number; rx?: number; small?: boolean }): string {
  const glyph = small
    ? `<path d="${MARK_PATH_SMALL}" fill="${BRAND_PAPER}"/>`
    : `<g transform="translate(${MARK_TILE_NUDGE_X} 0)"><path d="${MARK_PATH_MAIN}" fill="${BRAND_PAPER}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><rect width="64" height="64" rx="${rx}" fill="${BRAND_OLIVE}"/>${glyph}</svg>`;
}
