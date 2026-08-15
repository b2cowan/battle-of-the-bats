/**
 * THE SCREEN LIST for the layout-invariant sweep.
 *
 * ⚠ THIS IS THE FILE YOU EDIT. Adding a screen to the sweep is ONE entry here — not a new spec
 * file. That is the whole point: the house rules in `scripts/check-layout-invariants.mjs` are
 * product-wide, so a new surface should inherit them by being listed, not by someone remembering
 * to re-derive them after a bug.
 *
 * Entry shape:
 *   id       stable slug — it keys the baseline, so RENAMING AN ID ORPHANS ITS BASELINE ENTRIES
 *   session  which signed-in role opens it ('coach' | 'orgOwner' | 'orgAdmin' | 'platformAdmin' | 'anon')
 *   path     (ctx) => url path; ctx = { orgSlug, teamId, practiceEventId, ... }
 *   ready    playwright selector that proves the screen actually RESOLVED (not an error state)
 *   scope    optional CSS selector to confine element rules to this screen's own content;
 *            defaults to the whole document
 *   skip     optional array of rule ids this screen is genuinely exempt from — each needs a reason
 *   note     why anything unusual above is true
 *
 * ⚠ SESSION MATTERS. The coach portal resolves org context before coaching assignments, so opening
 * a coach screen with the org-owner session lands on "Not assigned to any teams" — a page that
 * renders fine and measures fine and is telling you nothing. The sweep treats that as a hard
 * failure rather than a pass; see LANDING_FAILURES in the runner.
 */

/** @typedef {{orgSlug:string, teamId:string, practiceEventId:string}} Ctx */

const team = (c) => `/${c.orgSlug}/coaches/teams/${c.teamId}`;

export const SCREENS = [
  // ── The portal's own front doors ────────────────────────────────────────────
  {
    id: 'coach-overview',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches`,
    ready: 'h1',
  },
  {
    id: 'coach-team-hub',
    session: 'coach',
    path: team,
    ready: 'h1',
  },
  {
    id: 'coach-notifications',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches/notifications`,
    ready: 'h1',
  },
  {
    id: 'coach-help',
    session: 'coach',
    path: (c) => `/${c.orgSlug}/coaches/help`,
    ready: 'h1',
  },

  // ── The week ────────────────────────────────────────────────────────────────
  { id: 'coach-schedule',    session: 'coach', path: (c) => `${team(c)}/schedule`,    ready: 'h1' },
  { id: 'coach-attendance',  session: 'coach', path: (c) => `${team(c)}/attendance`,  ready: 'h1' },
  { id: 'coach-roster',      session: 'coach', path: (c) => `${team(c)}/roster`,      ready: 'h1' },
  { id: 'coach-lineups',     session: 'coach', path: (c) => `${team(c)}/lineups`,     ready: 'h1' },
  { id: 'coach-depth-chart', session: 'coach', path: (c) => `${team(c)}/depth-chart`, ready: 'h1' },

  // ── Player development (restructured 2026-07-31, QA pending) ────────────────
  { id: 'coach-development',           session: 'coach', path: (c) => `${team(c)}/development`,           ready: 'h1' },
  { id: 'coach-development-drills',    session: 'coach', path: (c) => `${team(c)}/development/drills`,    ready: 'h1' },
  { id: 'coach-development-board',     session: 'coach', path: (c) => `${team(c)}/development/board`,     ready: 'h1' },
  { id: 'coach-development-templates', session: 'coach', path: (c) => `${team(c)}/development/templates`, ready: 'h1' },

  // ── Practice plans (Phase 4 slice 1a/1b/2, QA pending) ──────────────────────
  {
    id: 'coach-practice-plan',
    session: 'coach',
    path: (c) => `${team(c)}/practice/${c.practiceEventId}`,
    // The builder loads its world in one fetch; a block title existing proves the plan resolved.
    ready: 'textarea, input[aria-label*="Block 1 title"], h1',
  },
  {
    id: 'coach-practice-run',
    session: 'coach',
    path: (c) => `${team(c)}/practice/${c.practiceEventId}/run`,
    ready: 'h1',
    skip: ['tap-floor'],
    note: 'The field screen sets its OWN, HIGHER floor (56px) and is held to it by practice-run-layout.spec.ts. Re-checking the 44px floor here would be weaker, not stronger.',
  },

  // ── Game day (P1–P3) ────────────────────────────────────────────────────────
  {
    id: 'coach-game-console',
    session: 'coach',
    path: (c) => `${team(c)}/game/${c.gameEventId}`,
    // The console has NO <h1> — it is a phone-first instrument, not a document. This sticky header
    // strip is rendered ONLY in live mode, so it proves two things at once: the screen resolved,
    // and it resolved as the console rather than the read-only recap the same URL serves outside a
    // live window. `resolveUatContext()` keeps the probe game live so that stays true.
    ready: '[data-sticky="head"]',
    note: 'The portal\'s only genuinely phone-first screen — a coach holding a phone one-handed at a fence in daylight. Tap floor and contrast matter here more than anywhere, and P1/P2/P3 all shipped before it could be rendered at all.',
  },

  // ── Money ───────────────────────────────────────────────────────────────────
  /* ⚠ Every Money tab needs its OWN screen entry, addressed as `?section=…`. The hub keeps every
     visited panel MOUNTED but `display: none` while inactive, so a hidden panel has zero geometry
     and the sweep measures nothing in it — the bare `/accounting` screen proves only the Overview.
     Addressing a section makes THAT tab the visible one, which is the only way its tables can be
     rendered and measured (2026-08-13: the standalone /accounting/<tab> routes are permanent
     redirects into these URLs now — never point a screen at one, or every Money screen silently
     measures the redirect target's default state instead). */
  { id: 'coach-accounting',        session: 'coach', path: (c) => `${team(c)}/accounting`,                              ready: 'h1' },
  { id: 'coach-budget',            session: 'coach', path: (c) => `${team(c)}/accounting?section=budget`,           ready: 'h1' },
  { id: 'coach-budget-vs-actual',  session: 'coach', path: (c) => `${team(c)}/accounting?section=budget-vs-actual`, ready: 'h1' },
  { id: 'coach-expenses',          session: 'coach', path: (c) => `${team(c)}/accounting?section=expenses`,         ready: 'h1' },
  { id: 'coach-dues',              session: 'coach', path: (c) => `${team(c)}/accounting?section=dues`,             ready: 'h1' },
  /* ⚠ THE SETTLEMENT SHEET IS A DISCLOSURE, so `coach-dues` above measures it CLOSED — a pot
     card, a five-column table, two honesty strips and a payout sheet, all with zero geometry.
     That is precisely the "green sweep over an empty screen proves nothing" trap this project
     has hit twice. `?settlement=open` is the same URL a coach gets when they open it, so this
     entry sweeps the real thing rather than a fixture-only mode. */
  { id: 'coach-dues-settlement',   session: 'coach', path: (c) => `${team(c)}/accounting?section=dues&settlement=open`, ready: 'h1' },
  { id: 'coach-fundraisers',       session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers`,      ready: 'h1' },
  /* ⚠ THE DRILL-IN IS ITS OWN SHAPE, and it was never swept while it was a page of its own: a
     six-column leaderboard with an inline edit form in the trailing cell, under a NESTED header
     (h2 + smaller icon tile) that exists nowhere else in the portal. `coach-fundraisers` above
     measures the list and would stay green through anything that happened one level in. */
  { id: 'coach-fundraiser',        session: 'coach', path: (c) => `${team(c)}/accounting?section=fundraisers&fundraiser=${c.fundraiserId}`, ready: 'h1' },
  { id: 'coach-payment-requests',  session: 'coach', path: (c) => `${team(c)}/accounting?section=payment-requests`, ready: 'h1' },
  { id: 'coach-allocations',       session: 'coach', path: (c) => `${team(c)}/accounting?section=allocations`,      ready: 'h1' },

  // ── The season around it ────────────────────────────────────────────────────
  { id: 'coach-announcements', session: 'coach', path: (c) => `${team(c)}/announcements`, ready: 'h1' },
  { id: 'coach-documents',     session: 'coach', path: (c) => `${team(c)}/documents`,     ready: 'h1' },
  { id: 'coach-staff',         session: 'coach', path: (c) => `${team(c)}/staff`,         ready: 'h1' },
  { id: 'coach-settings',      session: 'coach', path: (c) => `${team(c)}/settings`,      ready: 'h1' },
  /* ⚠ TEAM SETTINGS IS SIX CLOSED GROUPS, so the entry above measures the page chrome and
     nothing else — every control lives inside a shut <details> with zero geometry, and the
     sweep skips zero-size elements rather than flagging them. A green `coach-settings` would
     therefore prove only that the page still has an <h1>: the same "green sweep over an empty
     screen" trap the settlement sheet above documents, arriving here the day the page learned
     to collapse. `?section=` is the real arrival URL a coach gets from the dues page and the
     depth chart, so these sweep the genuine open state, not a fixture-only mode.
     Two entries, not six: `money` carries the new row grammar and `lineup-rules` the numeric
     inputs and the save row — between them every widget shape on the page is measured. */
  { id: 'coach-settings-money',   session: 'coach', path: (c) => `${team(c)}/settings?section=money`,        ready: 'h1' },
  { id: 'coach-settings-lineups', session: 'coach', path: (c) => `${team(c)}/settings?section=lineup-rules`, ready: 'h1' },
  { id: 'coach-tryouts',       session: 'coach', path: (c) => `${team(c)}/tryouts`,       ready: 'h1' },

  // ── The archive (Chunk F — opt-in by ruling; these are the approved doors) ───
  { id: 'coach-history',             session: 'coach', path: (c) => `${team(c)}/history`,             ready: 'h1' },
  { id: 'coach-history-development', session: 'coach', path: (c) => `${team(c)}/history/development`, ready: 'h1' },
  { id: 'coach-history-results',     session: 'coach', path: (c) => `${team(c)}/history/results`,     ready: 'h1' },
];

/** Widths under test. 361 is the narrowest phone the portal supports; 900/640 are its breakpoints. */
export const WIDTHS = [
  { name: '361', width: 361, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];
