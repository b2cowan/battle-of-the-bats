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
/**
 * The coach sandbox's five teams — one per season moment — with FIXED ids.
 *
 * Hardcoded (like the slugs, unlike every other row id) because the coach portal addresses teams
 * by row id in the URL: a stable id is what lets the demo door's landing path, the phase dock's
 * links, and the seed all name the same team across reseeds and across environments. The seed
 * inserts these ids verbatim; `lib/demo-coach.ts` builds each team's world around them.
 */
export const DEMO_COACH_TEAM_IDS = {
  /** Riverdale Ridge 11U — tryout day, evaluations mid-flight. */
  tryoutDay: '5eed0c0a-c111-4d3e-9a01-000000000011',
  /** Riverdale Ridge 14U — off-season: the books are open, the season isn't (Phase 2). */
  offSeason: '5eed0c0a-c114-4d3e-9a01-000000000014',
  /** Riverdale Ridge 10U — two weeks into its season, the year laid out ahead (Phase 2). */
  seasonStart: '5eed0c0a-c110-4d3e-9a01-000000000010',
  /** Riverdale Ridge 12U — mid-season, game this Saturday. The landing team. */
  midSeason: '5eed0c0a-c112-4d3e-9a01-000000000012',
  /** Riverdale Ridge 13U — last year's team, season closed, Wrapped ready. */
  seasonsEnd: '5eed0c0a-c113-4d3e-9a01-000000000013',
} as const;

/**
 * The one ROSTER row the demo addresses by name (Phase 3, the guided tour).
 *
 * Every other person in the demo world gets a generated id, because nothing points at them. The
 * tour's "read what a parent gets" step is the exception: the family-recap preview lives on ONE
 * player's page, two taps behind a collapsed card, so the step needs a durable address the way the
 * dock needs durable team ids. Same reasoning, same shape — and a fixed id makes the seed's upsert
 * safer rather than riskier, because a reseed lands on the same row instead of minting a new one.
 *
 * ⚠ It is deliberately the mid-season team's playing-time outlier (jersey 30). The step before it
 * names the number — fewest innings on the team, six back-to-back sits — and this one shows the page
 * that player's family opens. Owner call, 2026-08-05: the demo is more persuasive admitting the
 * uncomfortable number than hiding it behind a tidier player.
 */
export const DEMO_COACH_SHOWCASE = {
  /** Riverdale Ridge 12U — the family-recap step's player. */
  midSeasonPlayerId: '5eed0c0a-c112-4d3e-9a01-0000000000f0',
  /**
   * Riverdale Ridge 14U — the player the pitch deck's development slide is photographed on
   * (`lib/marketing-shots.ts`, added 2026-08-20). Same reasoning as the one above: a marketing
   * capture addresses this player's page by URL, so the id has to survive a reseed.
   *
   * ⚠ Not any player. He is the one who carries BOTH halves of what that screen claims — an
   * active focus area (`OFFSEASON_DEVELOPMENT_GOALS`) and a reading at both testing days
   * (`OFFSEASON_TESTING_SESSIONS` — he is absent from neither). A player missing either half
   * photographs as an empty card under a sentence promising a full one.
   */
  offSeasonPlayerId: '5eed0c0a-c114-4d3e-9a01-0000000000f1',
} as const;

export const DEMO_ORGS: readonly DemoOrgDefinition[] = [
  {
    slug: 'riverdale-minor-ball',
    kind: 'tournament',
    organizerEmail: 'demo-organizer@example.com',
    landingPath: '/riverdale-minor-ball/summer-classic',
    label: 'Riverdale Minor Ball Association (tournament sandbox)',
  },
  {
    slug: 'riverdale-ridge',
    kind: 'coach',
    organizerEmail: 'demo-coach@example.com',
    // The phase dock's default moment: the mid-season team's Overview (owner-approved 2026-08-04).
    landingPath: `/riverdale-ridge/coaches/teams/${DEMO_COACH_TEAM_IDS.midSeason}`,
    label: 'Riverdale Ridge Baseball (coach sandbox)',
  },
];

/** Slug of the demo tournament event, used by the seed and the scheduled jobs. */
export const DEMO_TOURNAMENT_SLUG = 'summer-classic';

/**
 * Phase 2 (the moments dock): the SAME demo org runs two more events in other lifecycle states.
 * These are tournament slugs under `riverdale-minor-ball`, NOT new demo orgs — the allow-list
 * above stays exactly as short as it is, and every org-level guarantee covers all three events.
 */
export const DEMO_OPENER_SLUG = 'season-opener';        // finished yesterday — "the morning after"
export const DEMO_INVITATIONAL_SLUG = 'invitational';   // three weeks out — "registration week"

/**
 * The moments dock ↔ admin tournament-context contract (Phase 2).
 *
 * The sandbox chrome mounts ABOVE the admin's tournament provider, so the two talk through
 * `<html>` dataset + window events instead of React context. The names live HERE — the one
 * sandbox module the provider already imports — so the shared provider never has to import
 * from the demo chrome's own module (the dependency would otherwise point the wrong way).
 * All three are inert for real customers: the provider installs nothing unless the org is in
 * the allow-list above.
 */
/** `document.documentElement.dataset` key carrying the admin half's current tournament slug. */
export const SANDBOX_TOURNAMENT_DATASET_KEY = 'sandboxAdminTournament';
/** Fired by the tournament provider whenever the admin's editing selection changes. */
export const SANDBOX_TOURNAMENT_CHANGED_EVENT = 'flhq-sandbox-admin-tournament';
/** Fired by the chrome when the dock (or a tour step) asks the admin half to switch events. */
export const SANDBOX_SELECT_TOURNAMENT_EVENT = 'flhq-sandbox-select-tournament';

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
 * Drop every demo-org team from a platform sweep list (the Insights digest and the dues-reminder
 * sweep enumerate "every team the platform serves" and then email people — a sandbox's fictional
 * teams must never be on that list). Slug-keyed on purpose: the enumerator already carries each
 * team's org slug, and the allow-list above IS slugs, so this is pure, synchronous and cannot
 * fail — no id resolution, no availability risk to the platform-wide sweep, no partially-seeded
 * environment to reason about. A new consumer of the enumerator must apply the same filter.
 */
export function excludeDemoOrgTeams<T extends { orgSlug: string }>(teams: readonly T[]): T[] {
  return teams.filter(team => !isDemoOrgSlug(team.orgSlug));
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
