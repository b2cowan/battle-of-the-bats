# PM Brief — Accept-to-Roster + Fee Setup (Coaches Portal Tryouts, Phase 2B.4)

> **Created:** 2026-07-01 · **Status:** Planning (build-ready pending one key decision) · **Plan:** COACHES_PORTAL_TRYOUTS_EVAL_PHASE2B4_PLAN.md

**What it does:** Turns an accepted tryout player into a fully set-up roster player in one confirm — carrying over the details already on file and (optionally) applying the team's standard fee schedule so the player lands with their dues ready, all as a single all-or-nothing action.

**Why it matters:** Today, accepting a player creates a *bare* roster entry with **no fees**; someone then has to separately re-enter details and hand-build a dues schedule — double work. The current accept can also half-complete (a roster entry left with the wrong status). This closes the tryout→paid-roster loop and fixes a real reliability gap.

**Who benefits:** Premium head coaches (standalone) finalize their own accepts in the Coaches Portal; club admins/treasurers finalize in the org's Rep Teams area. Both share one atomic accept path. Same billing plan as today — no new gate expected.

**Expected impact:** Fewer manual steps, no fee-less or half-created players, consistent billing for every tryout-sourced player. Accept becomes a confident "add them and set their fees" in one tap.

**Priority:** Medium. Completes the tryout close-out loop; smaller and lower-risk than the scoring build — but the "standard fee schedule" needs a source decision first (there's no fee-template in the product today; recommended path derives it from what the team already charges, no new setup screen).

**Success criteria:**
- From an offered candidate, one confirm atomically creates the roster player **+ (optionally) their dues schedule**; on any failure, nothing half-lands.
- Both the standalone coach and the club admin have the flow.
- The existing manual dues path still works unchanged; **no card is charged** (dues record what's owed).
- The pre-existing (non-tryout) accept is now reliable too — no more roster rows stuck with a stale status.

**Key decision to confirm:** where "the team's standard fee schedule" comes from. Recommended (no new screens/schema): reuse the fee the rest of the team already pays, pre-filled and editable at accept time; fees are optional (accept-without-fees is allowed). Alternative is an explicit "set the team's standard fee" template, which is more setup for the same outcome.
