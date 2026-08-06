# Masthead A2 — the status line (record + today's one thing)

**Date:** 2026-08-02 · **Status:** ✅ **BUILT + OWNER QA PASSED 2026-08-03** — uncommitted, awaiting the
owner's per-action commit OK. (Owner decided the scope + the record rule 2026-08-02; design is set by
mockup artifact `claude.ai/code/artifact/949c4e72-05f7-47b5-bceb-63d5c9b7a8ed` §08).
**Parent:** `COACH_PORTAL_DESKTOP_SHELL_PLAN.md` (A1 shipped, commit `ffe39a43`, dev only).
**Build prompt:** `COACH_PORTAL_MASTHEAD_A2_BUILD_PROMPT.md`.

## What ships

The pinned masthead's mono meta line gains two facts beside the season year:

| Season | Meta line |
|---|---|
| Live, game today | `2026 season · 12–4–1 · Game day — Lions, 6:30 p.m.` |
| Live, something ahead | `2026 season · 12–4–1 · Next: Thu 6:00 p.m. practice` |
| Live, quiet week | `2026 season · 12–4–1` |
| Live, no games played yet | `2026 season · Next: Sat 10:00 a.m. game` |
| Archive | `2025 · Complete · final 18–6–2` |

Rules the copy obeys:
- **Never render a zero record.** `0–0` is omitted entirely, not shown as a score of nothing.
- **Weekday only inside a week.** Beyond 6 days ahead the line uses a short date
  (`Next: Aug 23, 10:00 a.m. game`) — "Thu" three weeks out is a lie of implication.
- **Sport-neutral, lowercase type words** (`game`, `practice`, `tournament`, `scrimmage`,
  `team event`). No "first pitch". The export's `EVENT_LABELS` cannot serve — those strings are a
  spreadsheet column contract (`Game (Tournament)`), so a short display form joins the same module.
- Phone collapse already hides the meta line; the status must tolerate that (no new behaviour).

## Where the numbers come from

**One SSR feed on a new team-segment layout** — `app/[orgSlug]/coaches/teams/[teamId]/layout.tsx`.
The masthead's mount MOVES there from the portal layout (it renders a Fragment, so the DOM under
`<main>` is byte-identical and the sticky/negative-margin geometry is untouched).

Why the layout and not a fetch: a segment layout renders once per team entry and is **not**
re-rendered when the coach moves between pages inside that team, so the whole masthead costs zero
round trips on every page after the first, and the status never pops in after paint. It is also
where the `teamId` first exists server-side — the portal layout has no team param, which is why A1
had to resolve the team from the pathname on the client.

Two indexed reads, both wrapped so a query blip costs the status line and never the page
(the `resolveOrgHomeHref` lesson from the A1 `/review`):
1. **Records** — `rep_team_events` for every program year of this team the coach may open, tallied
   by the CANONICAL rule (`WRAPPED_RECORD_EVENT_TYPES` — league + tournament + legacy external,
   scrimmage separate). One query serves the live season AND every archive's final record.
2. **Next event** — the single next scheduled event on the **ACTIVE** year only. Skipped entirely
   for a team with no live season.

Request-scoped `cache()` wrappers (`lib/coach-portal-request.ts`) let the new layout share the
portal layout's auth + assignment reads on a hard load, so the pair costs **less** than today, not
more. On a soft navigation only the team layout runs, so there is nothing to share.

### The archive rule this respects
The masthead adds **no live-data read to an archived season**. The next-event query addresses the
active year and nothing else; a past season's number is its own frozen final record — the same
figure Season's End and the history page already show, i.e. what the coach could see at the time.
No API route is added, so the opt-in archive contract lists are untouched.

### Capability gating
Record + status ride the season's **`schedule`** capability — the same gate the Overview's own
record tile and next-up tile ride (their events fetch is `canSchedule`-gated). An assistant without
it sees identity only, exactly as they do one screen down. For an archive, the capability comes from
**that season's** assignment row (Chunk F governing rule 1), never the coach's current grants.

## Correctness seams (reuse, do not re-derive)

- **Game day** = `deriveRepPhase()` from `lib/coach-rep-phase.ts`, asked for `phase === 'game_day'`.
  No rival "is it game day" predicate. Roster count is passed as `1` (unknown ≠ empty — the
  Overview's own documented convention where the roster isn't readable), so the masthead never
  needs a roster query and can never disagree about game day for a capability-limited coach.
- **Record** = `WRAPPED_RECORD_EVENT_TYPES`. Never a third tally.
- **Dates/times** = `lib/timezone.ts` org-zone helpers (`calendarDaysBetween`, `formatInOrgZone`).
  No raw UTC math — the date-correctness guardrail stays at ZERO.
- **Season on screen** = the existing `resolveSeasonView(seasons, teamId, ?year)`. The masthead
  stays presentational: no menus, no second switcher (a `/review`-confirmed a11y ruling).
- Selection logic lands in a pure, unit-tested module; copy stays in the component (the Chunk I
  resolver rule).

## The record rule — DECIDED by owner 2026-08-02

**Canonical always.** The masthead does NOT follow the per-device "count scrimmages" switch that
Insights and the Overview tile respect; it counts what Season's End, Wrapped and the season history
count. Reasoning accepted: shell chrome that reads differently on a phone than on a laptop is worse
than a rarely-flipped toggle disagreeing with one page. A coach who hits the difference is answered
by a new help FAQ (`faq-header-record-mismatch`).

Residual, named once and not fixed here: the legacy `external_tournament` type counts in the
canonical rule but is not in the Insights/Overview toggle list — a pre-existing disagreement between
those two surfaces, not created by this chunk.

## Verification

- `npm run typecheck` (new layout + shared modules) · focused lint · `npm test` (new pure-resolver
  spec) · `npm run verify:changed` token/date baselines (expect cross-session noise — report, don't
  re-baseline).
- Playwright probe @1920 + @360: masthead status renders on a page that does NOT load events
  (Roster, Documents), stays identical after a soft navigation between two team pages (proving the
  layout isn't re-fetching), shows the archive frame with the final record and NO next-event line
  under `?year=`, and the bar's pinned height is unchanged from A1 (no layout shift). Real input
  (`page.mouse.wheel`) for anything sticky.
- Clean dev restart before handoff (new files + shared modules touched).

## Risks

- A slow feed sits on every team page's SSR path → both reads are try/caught to `null` status and
  the masthead degrades to A1 exactly.
- Moving the mount is the one structural change — the Fragment keeps the DOM identical, and the
  probe asserts the pinned geometry did not move.
- A tab left open past midnight keeps yesterday's "Game day" (the Overview has the same property).
  Accepted, not fixed.

## Build result (2026-08-02)

✅ **Built on dev, uncommitted.** Gates: `typecheck` **0 errors project-wide** · focused lint 0 errors ·
unit suite **913/913** (including the archive opt-in contract, which the concurrent session's routes
had left red on the previous chunk's run and is now green) · **all six token ratchets ZERO** ·
date-correctness **ZERO** · snapshots fresh at migration #221. Schema parity is RED with the
concurrent sessions' dev-only family/drills/plan-template tables (migs 214–221) — this chunk ships
no migration and did not re-baseline.

**Playwright probe 9/9** (temp spec, deleted after; fixture torn down and the teardown asserted):
- `2027 season · 2–1 · Game day — Lions, 1:52 p.m.` — a scrimmage win AND a cancelled game carrying
  a result were both correctly excluded from the record (2–1, not 3–1 or 4–1).
- Identical meta line on **Roster**, a page that fetches players and never events — the feed really
  is shell-owned; and identical again after a **soft navigation**, proving the segment layout isn't
  re-rendering per page.
- Archive: `2026 · Complete · final 3–1–1`, with no "Game day", no "Next:", and never the live
  season's record.
- Assistant with `schedule: false`: `2027 season` and nothing else.
- Geometry unmoved: still exactly one `main.coachesMain > header[role=banner]`, pinned at **48px
  through 600px of REAL wheel scroll**, zero horizontal overflow from the longer line.

**Docs (`/docs`) synced in the same unit of work:** the "Getting around your Premium portal" guide
now opens by describing the bar (it described the sidebar as the topmost thing and never mentioned
the masthead at all), with search terms added and a new popular FAQ for the one question this ships
— "the record in the top bar doesn't match Insights". The player profile's collapsible sections were
checked and need NO doc change: they render open by default, so nothing became hidden.

## /simplify + /review (high-risk tier, 5 lenses) — DONE 2026-08-02

**/simplify — 5 fixed:** the masthead's hand-rolled W/L/T tally now calls the canonical
`tallyResults` (widened to a structural param so it can be) and reuses `WltTally` instead of a
second record type · the four attendance words moved to `lib/coach-schedule-vocab` and the Schedule
page now reads them from there · the Overview's `weekSummary` state is derived from one nullable
`weekEvents` instead of a second hand-synced state · the lineup rail's two attendance scans became
one · four hand-built `${railValue} ${cond ? warn : ''}` strings (one with a trailing space) became
a `[data-warn]` attribute selector, the board-tile idiom. **Skipped:** a shared `<RailRow>`
component (two reviewers disagreed; the underlying drift risk was removed instead) and an explicit
money-capability gate on the Dues page (real, pre-existing, outside this diff).

**/review — 2 Confirmed and fixed, 2 accepted, 3 lenses clean:**

⚠ **[Critical] The masthead could contradict the page below it for a whole session.** A segment
layout does not re-render on client navigation — which is exactly what makes the feed free after
the first page, and exactly why cancelling tonight's game left the bar still announcing
"Game day — Lions, 6:30 p.m." until a hard refresh or a team switch. Verified against the Next
layout/client-cache docs; no `router.refresh`/`revalidate*` existed anywhere in the team subtree.
Fixed at the one place every schedule mutation already funnels through: any reload of the schedule
**after the initial mount** now also refreshes the server layout (client state is preserved).
**NEW BINDING RULE: a server-rendered shell element must be paired with an invalidation trigger, or
"read once, ride down" becomes "wrong until you reload".**

⚠ **[High] A cancelled game kept its score and still counted — on the history page only.** The
season-history and current-season tallies never excluded cancelled events, while Wrapped, Season's
End and the new masthead do. So a game a coach scored and then called off showed one extra win on
history. Pre-existing, but this chunk made it user-facing by asserting parity in the new help FAQ.
Fixed both queries to the canonical predicate (filtered in JS, matching `computeSeasonWrapped`
exactly, rather than a SQL `.neq` that would also drop null-status rows).

**[Medium] Masthead could describe the wrong season** when a hand-typed `?year=` points at a
*second live* season mid-rollover (the layout cannot read search params, so the feed is always the
default season's). Fixed: the status now renders only when the season on screen is the one it was
computed for — saying nothing beats describing the wrong season.

**[Medium] Duplicate React keys** in the rail's birthday list (keyed by first name; two players can
share one). Fixed. **[Low] A `!loading` guard that was a tautology** behind an early return — removed,
with the real gate named.

**Accepted, not fixed (both documented in code):** an empty-roster team with a game today reads
"Game day" on the bar while the Overview shows a pre-season card — two true statements about
different things, and agreement would cost a roster query on every team page. And the archive
write-guard scans API routes only, so this new server-layout read pattern is outside its reach;
the masthead complies by construction and the guard now carries an explicit scope note.

**Clean lenses:** security/multi-tenant (foreign and cross-org team ids fail closed twice over;
per-season capability gating matches the Overview's; request-cached reads cannot leak across
users), regression/blast-radius (all seven renamed/moved/widened symbols traced to their callers),
and data/contract on everything except the cancelled-game finding above.

**Gate after fixes:** typecheck 0 · lint 0 errors · unit suite **927/927** · all six token ratchets
ZERO · date-correctness ZERO. Schema parity still red on other sessions' dev-only tables.

## Owner QA round 1 → Option B (2026-08-02, ratified + built)

Owner viewed the shipped bar on a **team-workspace** account: *"looks pretty bland and looked better
in the mockups."* Correct, for three separate reasons — options artifact `52ae26b7`, owner picked B.

1. **A real bug:** the meta line's `·` separators used `--white-25`, one of the few white inks the
   coach warm gate does **not** remap, so they painted near-white on cream and were invisible. The
   line read as three floating fragments. Fixed by inheriting the colour and dimming with opacity —
   theme-proof, and now the rule for any separator/decoration in the portal.
2. **The mockups never drew this persona.** A standalone team has no club, so the eyebrow fell back
   to "Coaches Portal" — verbatim what the sidebar beside it says, above the same team name — and
   with no public-site flip the right half was empty. **Option B:** no eyebrow when it could only
   repeat the sidebar (club orgs keep theirs), and today's status moves to the right as a **Game
   day** accent chip + opponent/time stack (or a **Next** stack, or the archive's **Complete** chip +
   final record). One slot, every season state; the flip pill sits beside it for club orgs. On a
   phone the whole right slot folds with the rest of the detail.
3. **On us:** the A1/A2 mockups were drawn on the DARK shell while this account renders warm/light.
   Dark chrome flatters thin small type. Half the gap was surface mismatch, not regression — future
   coach-portal mockups are drawn warm.

Also noted, **not** this chunk's to fix: the muted grey used for the eyebrow/quiet meta text already
fails contrast checks portal-wide (open item from the layout-invariant sweep). Every option above
improves if that grey is darkened.

## Owner QA — PASSED 2026-08-03

Verified live on `toronto blue jays5` (a standalone team workspace, warm skin):
- **Live season:** `toronto blue jays5` · *2026 season · 6–4* left, **Game day — Oakridge Owls,
  6:30 p.m.** right. Record correct at 6–4, excluding both a scrimmage win and a scored-then-
  cancelled game.
- **Archive:** switched to the 2025 season → *2025 season* left, **Complete · Final 8–3–1** right,
  no status line, sidebar in "Viewing archive" mode. 8–3–1 again correctly excludes a scrimmage win
  and a scored-then-cancelled win — the defect this chunk's `/review` found, proven fixed on screen.
- Copy fix during QA: `final` → **`Final`**.

⚠ **The QA fixture is RETAINED on that team by owner instruction** — everything seeded carries a
`[qa]` prefix (eight events on 2026 incl. a game today with attendance, plus the whole
`[qa] toronto blue jays5 2025` season). Do not clean it up without asking; it is now the standing
fixture for game-day, archive, and cancelled-game-record checks.

## Follow-ups not done here
- The probe was temporary by plan. If the capability gate and the archive frame deserve permanent
  regression cover, promoting that spec is a small, self-contained job.
- Option C rails: all three ranked candidates were picked for mockups (owner, 2026-08-02) — separate
  round, no code.
