# The closed money book — P4 of history-in-place

**Status:** APPROVED 2026-08-17 (owner), from the P4 design session. **Nothing built yet.**
**Parent:** `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` §5 P4 — the last gated shelf phase
(ruling §1.6: every history shelf gets its own mockup session, and the current season stays the
primary focus).
**Decision record:** mockup artifact
`https://claude.ai/code/artifact/3cbb9ecd-beb3-4306-941f-4251b6f2afb0` — owner accepted the
recommendation and the ruling in §4 below.
**PM brief:** `COACH_MONEY_PAST_SEASON_BOOK_PM_BRIEF.md`.
**Precedent:** P3, `COACH_PRACTICE_PLANS_SHELF_PLAN.md` — same page, same shape, same gate.

---

## 1. What the session found, and why this phase is smaller than its plan line

The parent plan's P4 line reads *"read-only closed book: budget vs actual + money story;
money-capability only"*, which implies a missing capability. **Read against the code, most of it
ships.** Four findings, each read out of the shipped source:

1. **The entire money book already renders for a finished season.** All seven tabs — Budget, Dues,
   Fundraisers, Transactions, Payables, Club and Budget vs Actual — render read-only with every
   write control gone, and the membership smoke walks exactly that. A team BETWEEN seasons has the
   complete book today.
2. **Every past season already carries three money figures.** The compare list at the bottom of the
   results report shows dues collected, dues outstanding and total spent per season, money-gated
   server-side, for any year the team has played.
3. **Budget vs Actual is already the season's statement**, and as of 2026-08-17 (`14af00f0`) its
   three views read ONE set of figures — the statement, the Months grid and the cumulative chart
   had been three independent walks of the same records, two of which disagreed.
4. **The rollover is what breaks it.** No money route can be handed a year — `HISTORY_ENDPOINTS`
   holds exactly `wrapped`, `season-practices` and the practice-plan read. Every money screen
   resolves the team's working season, so the day the next season opens, last year's money is
   unreachable except for finding 2's three figures.

**The gap, stated precisely:** not *"there is no closed money book"* — the book exists and renders
in full, right up to the moment the next season starts. **What is missing is reaching it
afterwards.** One screen wide, exactly like P3.

---

## 2. ⚠ The finding that decides the shape: six of seven tabs are INSTRUMENTS

This is where P4 stops resembling P3, and it is the reason the build is a fraction of the plan line.

A practice plan is inert — it is words a coach wrote, and reading it changes nothing. The money hub
is not. It is mostly a set of **controls** that happen to render read-only because the season they
are pointed at has ended:

| Tab | What it is | Verdict |
|---|---|---|
| Payables | where a commitment is **marked paid** | instrument |
| Club | where a payment request is **created / withdrawn** | instrument |
| Dues | where a payment is **recorded** and a reminder **sent** | instrument |
| Fundraisers | where an amount is **logged** | instrument |
| Budget | the plan **editor** | instrument |
| Transactions | the spending **editor** | instrument |
| **Budget vs Actual** | **what was planned, and what happened** | **RECORD** |

**Exactly one tab is a record.** That is the closed book. Making the other six addressable by year
would be the deleted season dial wearing a money hat — six instruments pointed at a year that
cannot be written to, each with its own drill-ins, which is precisely the shape whose expensive
defects all lived one level below a door that looked correct.

---

## 3. The shape approved

**One collapsed section on Season's End — the statement, flattened — and nothing else.** It sits
below the practices shelf, on the page that is already about one named season.

### C1 — The statement route learns a year (one `HISTORY_ENDPOINTS` entry)

`budget-vs-actual` moves from `resolveCoachTeamRead` to `resolveCoachHistoryReadFromRequest`.

⚠ **REUSED, NOT REBUILT, and that is the load-bearing decision.** A second "season statement"
endpoint would be a second walk of the same records — which is exactly the defect `14af00f0` fixed
two days ago, when three independent walks disagreed about what a season spent. There is one
arithmetic (`lib/coach-budget-rollup.ts`) and it stays one.

The route qualifies on its own terms, verified in source rather than assumed:
- **GET-only** — no write verb in the file at all.
- **Writes nothing** — zero insert/update/upsert/delete calls.
- **Already money-gated** on `canViewMoney`, which is the grant the plan line names.
- **Already returns a slimmed payload** — the raw lines and costs behind each row are deliberately
  withheld; the shelf needs less still.

**The three questions, answered in full** (required before the allow-list entry):

1. **Record or instrument? RECORD.** It computes over money records a closed season can no longer
   change. It moves no money, bills nobody and configures nothing. The other six tabs fail this
   question, which is why they stay behind.
2. **Does the whole subtree carry the year? ONLY IF FLATTENED — and this is a build constraint, not
   a detail.** The live statement is not a leaf: its rows expand, its Months cells link into the
   budget editor, and its "no date yet" figure opens a chooser. **Two of those links were dead for
   two days this week** (`14af00f0`) and nobody noticed. The shelf renders the statement FLAT —
   figures, no drill-ins — so there is no second level for a Chunk-F-class defect to hide on.
3. **Could the coach tell which season they are reading? YES, STRUCTURALLY.** Season's End is a page
   about one named season and titles itself that way — the same answer the practices shelf relies
   on, and the reason both shelves belong on this page rather than anywhere else.

### C2 — "How the season added up" on Season's End

One collapsed section below the practices shelf.

- **Closed by default**, with a summary on its shut face (*"$110 under"* / *"$240 over"*), so a coach
  who only wants the headline never opens it. Binding: the current season is always the primary
  focus, and a shelf that makes the live screen noisier is a failed design.
- **Gated on money access**, matching the route. A coach without it does not see the section — the
  server refuses them regardless; this is the door, not the lock.
- **Flat.** Category rows with planned / actual / difference, and the season total. **No cell is a
  link.** No expand, no month grid, no chart.
- One quiet line of context under it: dues collected, fundraising, sponsorship — the figures the
  compare list already publishes, so the shelf and the list cannot disagree.

---

## 4. ⚖ The ruling this phase needed, and got

**Should a past season's figures be CORRECTED, or preserved as the coach saw them?**

Budget vs Actual is *derived*, and its arithmetic changed on 2026-08-17 — three coach-visible figures
moved. So a 2024 statement opened today shows different numbers than the coach saw in 2024. That is
the exact objection that made **playing-time analytics live-season-only permanently**: a derivation
cannot promise "what the coach saw at the time".

**Owner ruling 2026-08-17: CORRECTED.** The distinction from playing time is what the derivation is
over. Playing time re-interprets lineups, and its rules are genuinely contested; this is arithmetic
over money records that a closed season cannot change. A corrected total is not a different story
about the season — it is the same story, added up properly. **Money should be right, not faithful to
a bug.**

⚠ This does NOT reopen playing time. That ruling stands, for its own reason, and the guard test's
decided-absence block is untouched.

---

## 5. What was rejected, and why (recorded so it is not re-proposed)

**A season-aware money hub** — all seven tabs addressable by year. Rejected on §2: six of them are
instruments, and pointing an instrument at a closed year is the archive-as-a-place the owner
deleted. It also fails question 2 outright — the money subtree is the deepest in the portal.

**A second "season statement" endpoint.** Rejected on §3 C1: it would be a second walk of the same
records, re-creating the defect fixed two days earlier.

**Also out of scope, deliberately:** the compare-list money row is left exactly as it is (the
session offered adding the plan total to it as a cheaper alternative; the owner took the statement
instead — it remains available as a small follow-up, not part of this build); the season settlement
flow is an instrument and untouched; Season Wrapped still carries no money, by standing ruling.

---

## 6. Costs

| Change | Live screen | Season's End | Where it costs |
|---|---|---|---|
| C1 route learns a year | 0px | 0px | One resolver line; no new query |
| C2 collapsed section | 0px | ~90px | A page no live season renders |
| ~~Season-aware money hub~~ (rejected) | — | — | Six instruments on a closed year |

---

## 7. Risk

1. **⚠ The flattening is the whole build risk.** The statement's own cells are doors into the live
   budget editor. Rendering the shelf from the same payload without stripping those links is how a
   past season becomes an entrance to a live instrument — and it would look correct.
2. **⚠ The route now serves two callers with different needs.** The live panel wants the full
   payload (grid, chart, drill-ins); the shelf wants the statement alone. The route already sends a
   slimmed payload; the shelf must not grow it back.
3. **The money gate is the narrow one here** — `canViewMoney`, not `hasRecordAccess`. An assistant
   with attendance but no money access reads the practices shelf and must NOT read this one. Two
   shelves on one page with two different gates is the thing to get right.

---

## 8. Tests

- `coach-history-endpoint-guard.test.ts`: `HISTORY_ENDPOINTS` gains `budget-vs-actual`, with the
  three answers written at the list. The decided-absence blocks are untouched — in particular
  playing time stays live-season-only, and this phase must not read as a precedent for it.
- `coach-finished-season-surfaces.test.ts`: the shelf is collapsed by default; it is gated on money
  access and NOT on record access; it renders no link into the budget editor.
- The membership smoke: a coach with record access but **no money access** is refused the statement
  route and does not see the section; a rolled-forward team reads the season it has left behind.
- ⚠ The layout fixture's *UAT Between Seasons* team has finished seasons, games and practices but
  **no budget lines or spending** — seed them, or the shelf renders empty and a green sweep proves
  nothing (the same trap P3 documented).

---

## 9. Verification & sequencing

- One chunk; it is too small to split usefully. `npm run verify:changed`; `npm run typecheck`
  (touches a shared read module); `/review` after.
- **No migration.** Every figure comes from records that already exist.
- Owner QA: one new ledger section, walked on a between-seasons team **and** on a team that has
  rolled forward — the second is the case the phase exists for — with a money-less coach as the
  third sign-in.
