/**
 * lib/team-color.ts
 * Single source for a team's auto-generated identity colour + monogram, so the
 * schedule avatars, scorebug, dock, broadcast card, and the team-profile page all
 * agree on what colour/initials a given team gets. Pure (name → deterministic).
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
 * Text ink for content sitting ON a teamColor() fill. Warm hues (0–79 pass the
 * lime-shift untouched) land light enough that white text fails WCAG AA — same
 * problem lib/themes.ts solves for org primaries with onPrimaryColor(), same
 * luminance threshold here so the two guards agree.
 */
export function teamInk(name: string, saturation = 58, lightness = 45): string {
  const h = teamAvatarHue(name) / 360;
  const s = saturation / 100;
  const l = lightness / 100;
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
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance =
    0.2126 * lin(channel(h + 1 / 3)) + 0.7152 * lin(channel(h)) + 0.0722 * lin(channel(h - 1 / 3));
  return luminance > 0.42 ? '#0F1123' : '#FFFFFF';
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
