/**
 * lib/team-color.ts
 * Single source for a team's auto-generated identity colour + monogram, so the
 * schedule avatars, scorebug, dock, broadcast card, and the team-profile page all
 * agree on what colour/initials a given team gets. Pure (name → deterministic).
 */
import { hslChannels01, relativeLuminance01, pickInk } from './color-contrast';

/**
 * Stable hue (0–359) derived from the team name, shifted out of the lime band
 * (80–155) so generated avatars never clash with the logic-lime follow accent.
 */
export function teamAvatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return hue < 80 ? hue : hue < 155 ? hue + 75 : hue;
}

/** Concrete avatar/identity colour for a team (default mid-tone fill). */
export function teamColor(name: string, saturation = 58, lightness = 45): string {
  return `hsl(${teamAvatarHue(name)}, ${saturation}%, ${lightness}%)`;
}

/**
 * Text ink for content sitting ON a teamColor() fill. Warm hues (0–79 pass the
 * lime-shift untouched) land light enough that white text fails WCAG AA — same
 * problem lib/themes.ts solves for org primaries with onPrimaryColor(), same
 * luminance threshold here so the two guards agree.
 */
export function teamInk(name: string, saturation = 58, lightness = 45): string {
  const [r, g, b] = hslChannels01(teamAvatarHue(name) / 360, saturation / 100, lightness / 100);
  // 0.2 = the equal-contrast crossover between white and near-black ink
  // ((L+0.05)² = 0.05·1.05) — NOT themes.ts's 0.42, which is tuned for arbitrary
  // full-range brand colors; teamColor()'s fixed 45% lightness tops out at
  // L≈0.43, so 0.42 would leave warm golds (e.g. hue 44 ⇒ L≈0.31) on white
  // text at ~2.9:1. Above the crossover, ink always contrasts better.
  return pickInk(relativeLuminance01(r, g, b), 0.2);
}

/**
 * Up-to-two-letter monogram. Parentheticals (e.g. coach surnames) are stripped
 * first, otherwise "Halton Hawks (Johnstone)" → "H(".
 */
export function teamInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * What a collapsed sidebar's picker tile shows for a team or tournament name (Sidebar Strip & Grid Width,
 * Stage 2 — the hub's "13U" and "SC" tiles). A DIFFERENT rule from `teamInitials` on purpose: an age-group
 * first word stands as it is ("13U AAA" → "13U", "U11 Blue" → "U11" — on a coach's team it IS the identity),
 * otherwise the initials of the first two LETTERED words ("Spring Classic 2027" → "SC", where `teamInitials`
 * reads "S2"). Never more than four characters, which is what a 40 tile holds.
 */
export function stripTileText(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (first.length <= 4 && /\d/.test(first)) return first.toUpperCase();
  const lettered = words.filter(w => /^[\p{L}]/u.test(w));
  const initials = (lettered.length ? lettered : words).slice(0, 2).map(w => w[0]).join('');
  return (initials || first.slice(0, 2)).toUpperCase();
}
