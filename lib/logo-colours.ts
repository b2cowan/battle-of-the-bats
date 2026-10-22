/**
 * lib/logo-colours.ts — A CLUB'S COLOURS, READ FROM ITS LOGO (Public site builder A3, ruled 2026-10-21: "From your logo" is
 * offered first whenever there is an uploaded logo, ahead of the nine presets).
 *
 * Pure: the browser draws the logo onto a small canvas and hands its RGBA bytes here. Two colours come back, the fill and
 * the accent, as the colour fields store them (#RRGGBB) — the site's colour roles then make them readable exactly as they
 * do any custom colour (lib/club-colour-roles.ts darkens a fill that cannot carry text). Never offered: the logo's white
 * or near-white ground, its transparent edge, and greys (a grey logo offers nothing, so the chip stays away). The darker
 * of the two is the fill: a light fill would be darkened into mud, a dark one is what a club's bar looks like.
 *
 * A stock logo is MADE in the club's colour (lib/stock-logo-render.ts), so reading it back would only return the colour
 * already chosen — the editor never offers this for one (`isStockLogoUrl`).
 */

export interface LogoColours {
  primary: string;
  accent: string;
}

interface Bucket { n: number; r: number; g: number; b: number }

function hsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Is `c` a second colour of the logo, as against a shade of the first (shading, a gradient, anti-aliasing)? A different
 *  HUE counts once it holds a small share of the logo; a different LIGHTNESS of the same hue only when it holds a good
 *  share — a real two-tone logo (navy and sky) has both, a soft edge or a gradient step has a sliver. */
function isSecondColour(c: { h: number; l: number; n: number }, first: { h: number; l: number; n: number }): boolean {
  const dh = Math.min(Math.abs(c.h - first.h), 360 - Math.abs(c.h - first.h));
  const share = c.n / first.n;
  return (dh > 30 && share >= 0.05) || (Math.abs(c.l - first.l) > 0.25 && share >= 0.25);
}

/** The logo's fill and accent, or null when it has no colour worth offering. `rgba` is canvas ImageData's bytes. */
export function pickLogoColours(rgba: ArrayLike<number>): LogoColours | null {
  // 4 bits a channel: close shades of one ink (anti-aliasing, a JPEG's noise) fall in one bucket.
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (a < 128) continue;
    const { s, l } = hsl(r, g, b);
    if (l > 0.92 || l < 0.06 || s < 0.18) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const k = buckets.get(key);
    if (k) { k.n++; k.r += r; k.g += g; k.b += b; } else buckets.set(key, { n: 1, r, g, b });
  }
  if (buckets.size === 0) return null;

  // Each bucket as its average colour, ranked by how much of the logo it covers, a vivid ink counting a little more.
  const inks = [...buckets.values()]
    .map(k => {
      const r = k.r / k.n, g = k.g / k.n, b = k.b / k.n;
      const c = hsl(r, g, b);
      return { n: k.n, r, g, b, ...c, score: k.n * (0.6 + c.s) };
    })
    .sort((x, y) => y.score - x.score);

  const first = inks[0];
  const second = inks.find(c => isSecondColour(c, first)) ?? first;
  const [fill, accent] = second.l < first.l ? [second, first] : [first, second];
  return { primary: hex(fill.r, fill.g, fill.b), accent: hex(accent.r, accent.g, accent.b) };
}
