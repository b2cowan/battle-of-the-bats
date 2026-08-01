/**
 * lib/org-public-sections.ts — the ONE statement of "which named section of an org's public site
 * is this path in?" (Nav Unification Stage E.3).
 *
 * The org's public pages all render through one shared navbar, which knows only the pathname. This
 * maps that pathname to the breadcrumb the identity row shows beside the org's name:
 * `Cedarvale Ravens › League`.
 *
 * SECTION names, not entity names (owner ruling 2026-08-01, mockup-reviewed). A season page reads
 * `› League`, not `› Spring 2026` — the crumb's job is getting back UP, and the page's own heading
 * already names the thing you opened one line below. The alternative required four more pages to
 * publish their names into the shared nav context, which is the exact plumbing that blanked an
 * org's identity earlier in this project (the OrgNavSync restore fix), and it needs a truncation
 * rule long season/team names would keep tripping.
 *
 * DELIBERATELY PARTIAL: only the three sections Stage E covers are named. Anything else — the
 * tournament-shim routes (`/schedule`, `/standings`, `/results`, `/rules`, `/register`, `/news`)
 * and any future section — returns null and renders today's plain identity. A crumb that guesses
 * a label is worse than no crumb.
 */

/** Path segment → the crumb's label. Order is irrelevant; the first URL segment is an exact key. */
const SECTION_LABELS: Record<string, string> = {
  league: 'League',
  teams: 'Teams',
  archives: 'Archives',
};

/**
 * The crumb label for an org public pathname, or null at the org root / on any unnamed section.
 *
 * Depth-insensitive by design: `/{org}/league` and `/{org}/league/spring-2026/standings` both read
 * "League", so the trail stays the same width and the same word however deep the visitor goes.
 */
export function orgSectionCrumb(pathname: string, orgSlug: string): string | null {
  if (!orgSlug) return null;
  const base = `/${orgSlug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const section = pathname.slice(base.length).replace(/^\//, '').split(/[/?#]/)[0];
  if (!section) return null; // the org root keeps today's plain identity
  return SECTION_LABELS[section] ?? null;
}
