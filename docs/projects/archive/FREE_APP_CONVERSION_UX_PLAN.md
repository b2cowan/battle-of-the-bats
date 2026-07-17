# Free App Experience & Conversion — Plan

**Status:** ACTIVE (kicked off 2026-07-14, owner-approved process). Runs BEFORE Unified App Phase 4 (verified family).
**Goal:** iron out the end-to-end experience of fans, family, and coaches using the free app to follow teams/tournaments — and sharpen every moment where a free user becomes an account, a claimed coach, or a subscriber.
**Owner-ratified process (2026-07-14):** three steps, in order —
1. **Agent sweep first.** Walk every persona journey against real fixtures. Mechanical defects (dead ends, broken states, stale copy, inconsistencies) fixed silently; **judgment-level items only** go to the owner as a ranked report with labeled mockups (NEW / RESTYLED / UNCHANGED per the standing rule).
2. **Owner-directed journeys.** One-page persona scripts organized around the conversion ladder, run on a real phone (push/install/thumb-feel), with 2–3 taste questions at each conversion moment.
3. **Owner undirected wander,** last — free-roam on a polished surface so every find is real signal.

## Scope — the conversion ladder (and only the ladder)

| Journey | Persona | Path under test | Conversion moment |
|---|---|---|---|
| A | Anonymous fan (grandparent) | Discover → tournament → live scores → follow (device-only) | none — must stay frictionless |
| B | Fan → account | follow nudge sheet · alerts pitch · /auth/login · account-only signup · claim device follows | **sign-in for alerts** |
| C | Signed-in fan/parent | Following feed · Your FieldLogicHQ · alert prefs · multi-team/multi-event | retention (alerts on) |
| D | Coach (claim → free portal) | email-matched registration → claim flow → team page → Fan view round trip → account sheet doors | **claim the team** |
| E | Coach → Premium | free portal limits · upgrade surfaces · $29/mo pitch legibility | **Premium upgrade** |
| F | Organizer acquisition | public tournament acquisition banner → /start funnel → signup (org mode) | **run a tournament** |

**Explicitly OUT of scope:** tournament public-page INTERNALS (schedule/standings/bracket density + visuals) — owned by the concurrent Tournament Mobile project; this project's sweep covers those pages only as *waypoints* (can you get in/out/convert), not their content design. Also out: Phase 4 family features; any pricing/gating changes (pointing at existing gates is in; changing them routes through /strategy).
**Folded in:** the deferred §8 "return to Discover" navigation design round (UNIFIED_APP_CONSUMER_LAYER_PLAN.md §8) — a Step 1 judgment item with mockups.

## Fixtures (dev)

QA personas (created by the seeder; password recorded here for owner reuse: `FlhqQa!2026-test`):
- `flhq.qa.fan@outlook.com` — pure fan, follows 2 teams in the live-demo tournament
- `flhq.qa.coach@outlook.com` — claimed Basic team with a registration in live-demo
- `flhq.qa.coach.unclaimed@outlook.com` — registration in live-demo email-matches this account; NOT claimed (tests the claim funnel)
- Existing: owner's multi-hat account; `/dev-test-org/live-demo` seeded live tournament (re-seed via the standard script when stale).

## Deliverables
1. Silent mechanical fixes (committed with owner OK, listed in the report appendix).
2. **Judgment-calls report** — ranked, each with recommendation + labeled mockups (artifact).
3. **Step 2 journey scripts** — one page per persona A–F with taste questions.
4. §8 navigation recommendation with mockups.

## Standing rules
Dev branch; explicit pathspecs; no commit without owner OK; verify:changed + typecheck on shared modules; restart on file-adds; sw.js denylist check for any new authed route; product-owner voice in reports; coordinate with Tournament Mobile before touching tournament-page files.
