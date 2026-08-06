# Build prompt — Masthead A2 (status line) + Option C rail round · run in a FRESH chat

**Standing start:** read `docs/projects/active/COACH_PORTAL_DESKTOP_SHELL_PLAN.md` (the shipped
chunk: commit `ffe39a43`, dev only, NOT prod), the 2026-08-01/02 entries in the design decisions
log, and mockup artifact `claude.ai/code/artifact/949c4e72-05f7-47b5-bceb-63d5c9b7a8ed`
(sections 08–09 = the masthead spec; section 06 = the ranked Option C rail candidates).

## Step 0 — /docs sync rider (10 min, do first)
The shipped chunk changed screens the guides may describe: the pinned masthead (new chrome on
every team page), the player profile (quick-facts rail + collapsible deep-linkable sections —
`?section=` deep links now WORK and help links could use them), Season's End side-by-side. Run
`/docs` scoped to those; no terminology changed; skip if the guides prove layout-agnostic.

## A2 — the masthead status line (DECIDED by owner 2026-08-02; scope is set, design is set)
The masthead's meta line gains, beside the season year: the team's **record** and the one thing
that matters today — **"Game day — {opponent}, {time}"** when a game is today, else
**"Next: {weekday} {time} {event type}"**, else nothing (quiet weeks add no chrome). Archive
seasons instead show the year-only Complete chip + **final record** (see section 08's archive
frame). Constraints that are already rulings:
- ONE cached feed for the whole masthead (it renders on every team page — no per-page refetch;
  follow the SSR-seeding precedent used for assignments/onboarding prefs, or a request-cached
  server read passed as props). Zero extra round trips on pages that already load these numbers
  is the bar to beat.
- Record = the canonical record rule (`WRAPPED_RECORD_EVENT_TYPES` — league + tournament +
  external, scrimmage excluded) — never a third tally. Respect the coach's remembered game-type
  scope only where the shipped record surfaces do (`lib/coach-season-record.ts` is the seam).
- Sport-neutral wording (no "first pitch"); times via `lib/timezone.ts` org-zone helpers, never
  raw UTC math (guardrail at ZERO).
- Game-day precedence mirrors the Overview anchor's phase logic — do NOT re-derive a rival
  "is it game day" predicate; reuse `lib/coach-rep-phase.ts`'s.
- The masthead stays presentational: no menus, no second season switcher (a /review-confirmed
  a11y ruling — the page-title chip is THE switcher).
- Phone collapse hides the meta line (already shipped behavior — status must tolerate that).

## Option C rails (owner interest confirmed; needs picks + mockups BEFORE any code)
Present the ranked list (artifact section 06) for selection: 1 Overview "this week + waiting on
you" rail (⚠ must respect the chunk-I "one thing" anchor ruling — rail is reference, never a
second voice; needs its own mockup round), 2 lineup-builder bench/attendance rail, 3 Dues pinned
totals. Mockups → ratify → build only what's picked. Player profile's rail is DONE (this chunk).

## Guardrails
Shared `dev` branch, explicit `:(literal)` pathspecs, no commit without per-action OK. The tree
is shared with active sessions — `coaches.module.css` and the practice pages carry foreign
uncommitted hunks; partial-stage if co-edited (this chunk's commit has the recipe). The archive
is OPT-IN (CLAUDE.md ruling — the masthead status line must NOT add live-data reads to archived
seasons; final record for archives comes from the season's own frozen numbers). Probe with REAL
input (wheel/window scroll — scripted scrollTop on the wrong element passes and lies; see the
scroll-model finding in the plan). Not on prod: this rides the accumulating dev release.
