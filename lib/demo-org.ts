/**
 * lib/demo-org.ts — the SINGLE hardcoded allow-list of sandbox ("demo") organizations.
 *
 * A demo org is a fictional organization we run ourselves so a prospect can walk into the real
 * product with no login and no email ("See it live"). Everything that makes the sandbox safe —
 * the session door, the central write block, outbound silence, directory/metrics/search
 * exclusion, the sandbox chrome — asks this module one question: **is this org a demo org?**
 *
 * Design rules, all load-bearing (ratified 2026-08-02, `BUSINESS_DECISIONS.md`):
 *
 *  1. **Hardcoded, never parameterized.** The list below is the whole truth. No env var, no DB
 *     flag, no request input can add an org to it. That is what bounds the blast radius of a
 *     shared no-login session: the door can only ever reach a fictional org listed here.
 *  2. **Org-agnostic by construction.** Nothing here knows what a tournament is. The coach
 *     sandbox (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`) registers its org in the same list and
 *     inherits every guarantee without a second implementation.
 *  3. **Keyed by SLUG, not id.** Slugs are stable, reviewable in a diff, and identical across
 *     dev and prod; row ids are not. Server code that holds an org id resolves it through
 *     `lib/demo-org-server.ts`, which caches slug → id.
 *  4. **Fail CLOSED for writes, fail OPEN for chrome.** If this module can't tell whether an org
 *     is a demo org, callers must treat "unknown" as *not* a demo org for cosmetic decisions
 *     (don't paint a sandbox banner on a real customer) but must never use "unknown" to permit a
 *     write it would otherwise block. See `lib/demo-guard.ts` for how that asymmetry is enforced.
 *
 * ⚠ Adding an entry here makes an organization permanently un-writable through the app. That is
 * the point, and it is why this file is short and boring on purpose.
 */

/** Which sandbox a demo org belongs to. Drives only presentation (chip lists, door copy). */
export type DemoOrgKind = 'tournament' | 'coach';

export interface DemoOrgDefinition {
  /** The org's URL slug — the first path segment, and the key everything else resolves through. */
  slug: string;
  kind: DemoOrgKind;
  /** The ONE account the demo door may establish a session for. Fictional, never a real inbox. */
  organizerEmail: string;
  /** Where the door lands a visitor. Fan-side first: it proves the demo is live within seconds. */
  landingPath: string;
  /** Human label for logs and platform-admin surfaces. Never customer-facing copy. */
  label: string;
}

/**
 * THE allow-list. One entry per sandbox.
 *
 * `riverdale-*` is the project's established fictional-world convention (it already names the
 * coaches-portal budget sample), so nothing here can be mistaken for a real association and both
 * sandboxes speak one invented world.
 */
export const DEMO_ORGS: readonly DemoOrgDefinition[] = [
  {
    slug: 'riverdale-minor-ball',
    kind: 'tournament',
    organizerEmail: 'demo-organizer@example.com',
    landingPath: '/riverdale-minor-ball/summer-classic',
    label: 'Riverdale Minor Ball Association (tournament sandbox)',
  },
  // The coach sandbox registers here when it builds. Do not add anything else.
];

/** Slug of the demo tournament event, used by the seed and the scheduled jobs. */
export const DEMO_TOURNAMENT_SLUG = 'summer-classic';

const BY_SLUG: ReadonlyMap<string, DemoOrgDefinition> = new Map(
  DEMO_ORGS.map(org => [org.slug, org]),
);

/** Every demo org slug. Useful for `.not.in()` style exclusions in list queries. */
export const DEMO_ORG_SLUGS: readonly string[] = DEMO_ORGS.map(org => org.slug);

/**
 * Is this slug a sandbox org? The primary question every caller asks.
 * Trims and lowercases because slugs arrive from URL segments, which are user-controlled.
 */
export function isDemoOrgSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return BY_SLUG.has(slug.trim().toLowerCase());
}

/** The full definition for a demo org slug, or null when it isn't one. */
export function getDemoOrgBySlug(slug: string | null | undefined): DemoOrgDefinition | null {
  if (!slug) return null;
  return BY_SLUG.get(slug.trim().toLowerCase()) ?? null;
}

/** The single demo org for a given sandbox, or null if that sandbox hasn't been built yet. */
export function getDemoOrgByKind(kind: DemoOrgKind): DemoOrgDefinition | null {
  return DEMO_ORGS.find(org => org.kind === kind) ?? null;
}

/**
 * Is this the ONE account the demo door may sign in?
 *
 * The door calls this with its own hardcoded constant, never with anything derived from the
 * request — the check exists so a future edit that *does* thread a value through still cannot
 * establish a session for a real user.
 */
export function isDemoOrganizerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return DEMO_ORGS.some(org => org.organizerEmail === normalized);
}
