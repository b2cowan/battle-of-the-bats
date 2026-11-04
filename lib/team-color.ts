/**
 * lib/team-color.ts
 * Single source for a team's auto-generated identity colour + monogram, so the
 * schedule avatars, scorebug, dock, broadcast card, and the team-profile page all
 * agree on what colour/initials a given team gets. Pure (name → deterministic).
 *
 * `teamInk` (dark-or-white text ON a teamColor() fill, crossover 0.20 — warm golds fail white at ~2.9:1) had two
 * callers, the old Teams list and the old team page; both were deleted in Public tournament pages Stage 8 Part 3a.
 * Restore it from that commit's parent rather than re-deriving the threshold.
 */

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
