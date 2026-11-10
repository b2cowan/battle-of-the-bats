/**
 * When a logo is shown as a logo and when the club's initials stand in (navigation Phase 1 Part B, E10 + B5, owner
 * 2026-11-09). Pure — the server and the browser read the same rule.
 *
 * A logo is shown only when its stored shape (`organizations.logo_aspect`, width / height) is within 1 : 2 … 2 : 1. A
 * wordmark wider than that, or a banner taller than that, is a sliver at 24 and 40 pixels. An UNKNOWN shape (no
 * logo, or one not measured yet) shows initials: the rule is decided from stored facts, so the server's first paint is
 * the last — an image that was measured after it loaded would swap logo for initials once the page was on screen.
 */
const LOGO_ASPECT_MIN = 0.5;
const LOGO_ASPECT_MAX = 2;

export function logoFitsTile(aspect: number | null | undefined): boolean {
  return typeof aspect === 'number' && Number.isFinite(aspect) && aspect >= LOGO_ASPECT_MIN && aspect <= LOGO_ASPECT_MAX;
}
