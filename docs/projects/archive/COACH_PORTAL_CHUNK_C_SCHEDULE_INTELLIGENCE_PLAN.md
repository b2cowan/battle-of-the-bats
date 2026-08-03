# Coach Portal — Chunk C: Schedule Intelligence — Implementation Plan

> **Status:** planned 2026-07-30. **NO CODE WRITTEN.** Owner-mandated gate: plan + PM brief +
> approved mockups before any implementation. Mockups artifact + owner decisions D-C1…D-C9 are the
> blocking step.
> **PM brief:** `COACH_PORTAL_CHUNK_C_SCHEDULE_INTELLIGENCE_PM_BRIEF.md`
> **Mockups (binding on approval):** `claude.ai/code/artifact/81a33e54-42db-4fbb-bd73-c9007b4ab06b`
> **rev 4** — frame 4 revised three times at the owner's prompting: reordering leaves the grid and
> gets press-and-hold drag back (D-C10), the three views get honest names (D-C11), and a reorder
> persists across all three — which exposed a silent no-op in `nine_player` mode (D-C12).
> **Handoff prompt this executes:** `COACH_PORTAL_CHUNK_C_SCHEDULE_INTELLIGENCE_BUILD_PROMPT.md`
> **Ledger:** `PROGRAM_COACH_PORTAL.md` §1.1 — absorbs P1 #6, P1 #7, P1 #9, wow #2 remainder.

---

## 0. Ground truth — VERIFIED at pickup, 2026-07-30

Everything below was read from the live code / live dev DB, not inherited from the handoff.
Where the handoff guessed, the guess is marked and corrected.

### 0.1 What the handoff said, and what is actually true

| Handoff claim | Verified? | Correction |
|---|---|---|
| Add Event modal lives inside the schedule page; recurrence gated by event type | ✅ exact | `RECURRABLE_TYPES = ['practice','league_game','team_event']`, `needsRecurrence()` at [page.tsx:164-165](app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx#L164-L165) |
| One `opponent` field stamps every generated game | ✅ exact | Server-side: the occurrence `.map()` writes `opponent: isGame ? opponent?.trim() : null` onto **every** row — [events/route.ts:213](app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts#L213) |
| Preview line is honest about dates, silent about the opponent problem | ✅ exact | [page.tsx:1061](app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx#L1061) |
| Recurring EDITS have a this/future/all scope chooser | ✅ exact | [page.tsx:1293-1296](app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx#L1293-L1296), chooser UI ~L2977 |
| Recurrence isn't re-editable on an occurrence | ✅ exact | `isRecurring: false` in `eventToForm`; checkbox hidden when `editingEventId` |
| "Check whether the Add Event modal has a discard guard yet — if bare, it belongs in this chunk" | ⚠️ **WRONG — it is NOT bare** | It has a **hand-rolled** guard: `formBaseline` (a `JSON.stringify` string) + `formDirty` + an inline `confirm()`. It is not `useDiscardGuard`/`snapshotEqual`, and its copy is the **banned** generic — *"You have unsaved changes to this event."* Chunk A rule 4 requires stake-naming copy. So this is a **migration**, not a build. |
| "The schedule's export surface — does one exist to round-trip against?" | ✅ **YES, and it is a good target** | `SCHEDULE_EXPORT_COLS` — **Date · Time · Arrival · Event Type · Name · Opponent · Location · Address · Field · Uniform · Home/Away** — served as XLSX / CSV / ICS through the shared `ExportMenu`. This is the importer's column vocabulary, per H2 rule 4. |

### 0.2 Lineup touch targets — the measured numbers

Declared in `coaches.module.css`, all inside the `@media (max-width: 640px)` block except where noted:

| Control | Declared | Effective | Standard |
|---|---|---|---|
| `.lineupMoveBtn` (reorder ▲▼) | `width:18px; height:18px; padding:0` | **18 × 18** | 44 |
| `.lineupPositionSelect` (per-inning cell) | `width:58px; min-height:32px; padding:.25rem .35rem; border:1px` | **≈71 × 42** (content-box) | 44 |
| `.lineupRemoveBtn` | `22 × 22` | **22 × 22** | 44 |
| `.lineupOrderInput` | `width:48px; min-height:32px` | ≈**59 × 42** | 44 |

⚠ **The same screen family has two different standards, and that is the actual root cause.** The
portal's tap floor is `--tap-min: 44px` (used by the tryout check-in rows, `.onePrimary`,
`.cardActionCell`). But `coaches.module.css` L3586 bumps the attendance controls to **36px** with a
comment calling 36 "the touch-target floor". Two reviewers found the lineup grid independently
because the grid is the worst instance, not the only one. **Fixing sizes without fixing the
disagreement re-opens this finding later.**

⚠ Exact rendered values will be **re-measured in Chromium at 360×740** in the build pass
(computed styles, never screenshots) and asserted in the probe — the numbers above are read from
declared CSS + box model and are the *floor* of the problem, not the QA evidence.

⚠ The lineup grid also uses a **bare scroller** (`.lineupTableWrap` + a hand-rolled
`.lineupScrollHint` that is `display:block` unconditionally at ≤640 and never retires on scroll) —
the exact shape Chunk A rule 2 retired in favour of `CoachScrollX`. It is **not** a free adoption:
the grid has three sticky lead columns driven by `--lineup-lead`, and Chunk A rule 3 requires the
pin gutter to be passed via `--scrollx-pin-gutter`. Treated as its own work item with its own risk.

### 0.3 Arm care — what the data can honestly support

| Fact | Where | Shape |
|---|---|---|
| Per-player per-game innings cap | `rep_roster_players.lineup_profile → pitcher.maxInnings` | integer or null |
| Season default cap | `rep_program_years.lineup_settings.pitcherMaxInningsDefault` | integer or null |
| Innings pitched, games pitched, over-cap games | `computeSeasonLineupAnalytics().armCare` ([lib/lineup-season-analytics.ts](lib/lineup-season-analytics.ts)) | pure, unit-testable, derived from **saved lineups only** |

⚠ **There is no rest-day tracking and no season cumulative cap in the model.** Every cap is
*per game*. So the only two warnings this product can make honestly are:

- **(a) "Today's saved lineup puts {player} over their cap"** — already knowable; the generator
  respects caps but a hand-edited lineup can exceed one, and nothing says so on the Overview.
- **(b) "{player} pitched {n} on {date} — {d} days ago"** — real arm care (rest between outings),
  derivable from saved lineups + `starts_at`, but a **new** pure computation.

Anything framed as a *season* innings ceiling would be inventing a rule the product does not have —
the D-G1 family ("never ship an invented figure") applies to thresholds exactly as it does to
dollars. **Decision D-C7 below.**

### 0.4 The game-day anchor as built (Chunk I) — what "richer chips" extends

`.oneReady` on the anchor currently carries exactly two facts:
`"N of M in"` (or *"Attendance not taken"*) and `"Lineup ready"` / `"Lineup not set"`.
Above it: kicker (`● Game day · Today`), headline (`vs {Opponent}`), meta
(`{tournament name} · {time} · {field or location}`), and the scoreline once entered.
Arm care and any new chip join `.oneReady` **inside the existing resolver's card** — no new band.

### 0.5 ⚠⚠ NEW FINDING — coach event times are stored as if the coach's wall clock were UTC

**Not in the handoff. Found by reading the write path against the column type. This is a live
defect on a shipped surface, and it is the precondition for everything else in this chunk.**

The chain:

1. `rep_team_events.starts_at` is **`timestamp with time zone`** (verified in
   `schema-dump-columns-dev.json`).
2. The client writes a **naive** wall-clock string — `isoFromInputs(date, time)` returns
   `` `${date}T${time}` `` with no zone ([page.tsx:316-318](app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx#L316-L318)).
   The recurrence generator does the same server-side (`` `${dateStr}T${startTime}:00` ``).
3. Postgres resolves a naive literal in the **session** zone; Supabase's session zone is **UTC**.
4. Every display path converts back to the **browser's** zone —
   `new Date(iso).toLocaleTimeString('en-CA', …)` in `fmtTime`, and the Overview's `nextTimeLabel`.

**Net: a Toronto coach types 6:00 PM, and the portal shows 2:00 PM.**
And because `toLocalInput()` converts UTC→local when the edit form opens, **re-saving an untouched
event shifts it by another offset** — the error compounds per edit.

**Evidence (live dev DB, `rep_team_events`):**

```
2026-07-01T22:00:00+00:00   "vs Falcons"                     ← 6:00 PM EDT — seeded, converted correctly
2026-07-08T18:00:00+00:00   "League Game vs Durham Diamonds" ← 2:00 PM EDT — app-written, NOT converted
```

The second row's name is exactly `deriveGameName()`'s output (`{prefix} vs {opponent}`), which is
the app's own auto-naming — the fingerprint of the form path. Had the session zone been Toronto,
an 18:00 naive literal would have stored as `22:00+00`. It stored `18:00+00`. **The interpretation
is proven UTC, and the display is proven runtime-local. The round trip is asymmetric.**

**Same platform, two conventions — and the correct one already exists.** House League converts
properly through `zonedWallClockToUtc()` on every write
([practices/route.ts](app/api/admin/house-league/seasons/[seasonId]/practices/route.ts),
`schedule/generate`, `schedule/[gameId]`). The rep coach schedule never adopted it.

**Blast radius beyond the form:** the Batch 4 tournament-game mirror writes naive too —
`tests/unit/tournament-game-mirror.test.ts:101` asserts `starts_at: '2026-05-17T14:00'` — so
**mirrored organizer-owned games are shifted by the same offset**, which is worse: the coach's
calendar disagrees with the tournament they are playing in, the exact thing Batch 4 rule 2 exists
to prevent.

**Why this gates the chunk:** import writes times in **bulk**. Shipping import on top of a broken
time convention multiplies a 4-hour error across a whole season in one tap, and the coach's own
spreadsheet becomes the evidence that the product is wrong. **Decision D-C1.**

### 0.6 Date-correctness guardrail — what it does and does not catch

`scripts/check-date-correctness.mjs` ratchets two patterns: `new Date().toISOString().slice(0,10)`
and `.setHours(0,0,0,0)`. It does **not** catch `someLocalDate.toISOString().slice(0,10)`, which is
the shape used by `generateOccurrences` ([route.ts:63](app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts#L63))
and the month grid ([page.tsx:1779](app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx#L1779)).
Both are currently benign for Canadian zones (all west of UTC) and both are the banned idiom.
**New code in this chunk uses pure `YYYY-MM-DD` string math and never constructs a `Date` to get a
calendar day.** The baseline stays at ZERO and the check gates the commit.

### 0.7 Reuse inventory (what NOT to rebuild)

| Need | Already exists | Notes |
|---|---|---|
| File → rows (CSV / XLSX) | `lib/import/{csv,xlsx,tabular,types}.ts` | `parseCSV`, `matrixToParsedRows`, `getCell`, `normalizeHeader` |
| Verdict-per-row preview model | `lib/coach-budget-import.ts` (`RowOutcome`, `RowVerdict`, `committable`) | H2's contract in code |
| Preview sheet UI | `components/coaches/BudgetImportSheet.tsx` · `RosterBulkAddSheet.tsx` | two precedents, same idiom |
| Preview + commit route pair | `budget-plan/import/{preview,commit}` · `roster/bulk/{preview,·}` | shape to copy |
| Strict date cell parsing | `parseDateCell()` in `coach-budget-import.ts` | ISO-only, refuses ambiguity — **already correct** |
| Wall-clock → UTC | `zonedWallClockToUtc()` in `lib/timezone.ts` | the House League standard |
| Sideways scroll + honest hint | `components/coaches/CoachScrollX.tsx` | Chunk A rule 2 |
| Modal discard guard | `components/coaches/useDiscardGuard.ts` + `snapshotEqual` | Chunk A rule 4 / Chunk E |

⚠ **`lib/import/tournament-schedule*.ts` is NOT reusable** — different domain (tournament games
between registered teams, with divisions, venues and team IDs) and it is gated on
`bulk_data_imports`, a **Tournament-Plus ORG** feature. Reusing that gate would paywall a premium
coach behind an unrelated organisation's plan — the precise trap H2 rule 5 names. The coach
schedule importer gates on **`schedule: write`** and nothing else.

---

## 1. The shape of the chunk

Five work items. The first is a precondition; the middle two are one surface; the last two are
independent.

```
C0  Time truth          ── precondition for C2, fixes a live defect
C1  Recurrence that     ─┐
    knows its opponents  ├─ ONE preview component, two ways to fill it
C2  Schedule import     ─┘
C3  Lineup touch targets ── independent
C4  Game-day card       ── independent, lands inside Chunk I's anchor
```

### The unifying idea (this is the design, not a convenience)

**A recurring series and an imported file are the same thing: a set of proposed events the coach
reviews before any of them exist.** Today recurrence commits blind from a summary sentence and
import does not exist at all. Both become **one preview table with a verdict per row**, editable in
place — H2 rule 2, applied to generated rows as well as pasted ones.

That is what makes P1 #6 and P1 #7 one chunk rather than two: the fix for "one opponent for twelve
games" is not a twelfth opponent field, it is **letting the coach see the twelve games before they
are written.**

---

## 2. C0 — Time truth (precondition)

**Goal:** an event's time means the same thing when it is typed, stored, displayed, edited and
exported.

1. **Write** — every coach-event write converts wall clock → UTC through `zonedWallClockToUtc()`
   (org zone), the House League standard. Covers the single-event POST, the recurrence generator,
   the events PATCH, and the Batch 4 mirror's owned-field writes.
2. **Read/display** — every render formats the stored instant **in the org zone**, not the
   browser's. `fmtTime`, `fmtDate`, the Overview's `nextTimeLabel`, the day/week/month keys and the
   ICS export all move to one helper. A coach travelling, or a grandparent in Vancouver, must see
   the game's local start time, not their own.
3. **Edit** — `toLocalInput` becomes `utcToZonedInputs()` (the shipped inverse), so opening and
   re-saving an untouched event is a no-op instead of another shift.
4. **Existing rows** — see **D-C1**. Rows written by the app carry the wall clock *as if* UTC;
   rows written by the seeds carry the true instant. A backfill must not "correct" rows that are
   already right. The build pass determines the exact population from live data before writing
   anything, and the correction is a **one-shot script with a dry-run**, not a migration.

**Verification:** a unit pack over the conversion in both directions across a DST boundary
(America/Toronto, March and November), plus a probe that creates an event at a known time through
the UI and asserts the rendered time matches — the round trip that is broken today.

---

## 3. C1 — Recurrence that knows its opponents (P1 #6)

**Today:** *Repeat weekly* → day, time, first date, last date, and **one opponent** stamped onto
every generated game. The preview is a sentence. For a 12-game round robin it is worse than
useless, because the coach must then open and correct 12 events.

**After:** *Repeat weekly* generates the dates and then shows them **as rows**. Practices commit as
they do now. Games get an opponent field per row, plus per-row location/home-away where the coach
wants it. Nothing is written until the coach commits, and every row carries a verdict.

**Click math for a real 12-game round robin** (interactions, not keystrokes):

| Path | Interactions | Notes |
|---|---|---|
| Today — 12 one-off events | **≈120** | menu → type → date → time → opponent → save, twelve times |
| Today — recurrence, then fix 12 opponents | **≈130** | strictly worse; this is the review's finding |
| **C1 — recurrence with a per-date opponent list** | **≈23** | set the pattern once (~10), type 12 opponents, commit |
| C2 — import a league sheet | **≈5** | but only if the coach *has* a sheet |

**Binding behaviour**

- Recurrence stays available for **practices, league games and team events** (unchanged types).
  For non-game types the preview is a date list with no opponent column — same component, fewer
  columns. **Recurrence is not narrowed to practices** (see D-C3).
- A row may be **removed** from the preview before commit (the league's bye week), which today
  forces a delete after the fact.
- The series anchor / `recurrence_parent_id` model is **unchanged**, so the shipped
  this/future/all edit and delete scopes keep working exactly as they do.
- The generator moves to **pure `YYYY-MM-DD` string math** (§0.6) and the times convert through
  C0.
- ⚠ Generation must **skip nothing and touch nothing** that already exists — it only proposes new
  rows. Mirrored events are not in its input by construction, but the commit route asserts it.

---

## 4. C2 — Schedule import (P1 #7)

Inherits the **H2 importer contract wholesale**. Deltas that are specific to a schedule:

1. **The parser never guesses a date or a time.** `03/04/2026` is refused with
   *"We can't tell if this is 3 April or 4 March — write it as 2026-04-03"*, not resolved.
   `parseDateCell()` already behaves this way and is reused. Times accept what spreadsheets emit
   (`6:00 PM`, `18:00`, `6pm`) and hand junk back verbatim.
2. **The round trip must close against our own export.** The reader understands
   `SCHEDULE_EXPORT_COLS` exactly (§0.1), including `Event Type` as the app spells it
   (*Practice*, *League Game*, *Scrimmage*, *Tournament*, *Game (Tournament)*, *Team Event*) and
   `Home/Away`. Export → edit in Excel → import is a supported loop, and a probe asserts it.
3. **Templates carry structure, never content** (Chunk G rule 1 / H2 rule 1): headings and the
   event-type vocabulary, with every date, time and opponent cell **blank**. A probe asserts no
   template cell contains a digit.
4. **⚠ Mirrored events are untouchable.** An imported row that looks like a mirrored tournament
   game is **surfaced, never merged and never written over** — the Batch 4 duplicate-confirm
   pattern, with *Keep both* as a real remembered answer. The commit route filters
   `source_tournament_game_id IS NOT NULL` out of every update path and asserts zero mirrored rows
   changed. A data-level probe asserts the same after a commit.
5. **Gate: `schedule: write` only.** Never `bulk_data_imports` (§0.7).
6. **Zero writes is an error, not a quiet success** (H2 rule 2).
7. **Writes go through the same event writer the form uses**, so C0's conversion cannot be
   bypassed by the bulk path.

---

## 5. C3 — Lineup touch targets (P1 #9)

- **Reordering leaves the grid entirely** (D-C10, rev 2): a third tab beside the shipped
  `Lineup / Playing time` toggle — a plain vertical list with **press-and-hold drag restored on
  touch** (the horizontal-scroll conflict that disabled it does not exist in a list), ▲▼ per row at
  full size as the precision + accessible path, and remove living there too.
- **The three views get honest names** (D-C11, rev 3): **Batting order · Positions · Playing time**.
  With three views, "Lineup" cannot be one of them — all three *are* the lineup, and the page keeps
  that name. Left-to-right is the true order of work (and the order auto-fill consumes); the page
  still **opens on Positions**, the surface coaches already know and where readiness is answered.
  ⚠ **The order tab's label is sourced from the Sport Pack, not typed in** — the pack carries
  `periodLabel`/`periodLabelPlural` but has **no order noun**, so a hard-coded "Batting order" would
  be a NEW §1.7 debt instance on the exact surface this chunk must not deepen. Add one vocabulary
  field; softball/baseball render "Batting order" unchanged.
- **The three views are windows onto ONE row list** (owner requirement, rev 4). The order tab must
  not hold its own working copy: a reorder is already present when the coach lands on Positions.
  Switching tabs is never a save, never a discard, never a prompt.
  - **Positions travel with the PLAYER, never with the batting slot** — they live on the row, so
    moving the row moves them. The inverse (slot-owned positions, so whoever lands in row 2 inherits
    row 2's innings) silently rewrites a finished lineup → **asserted in a test, not assumed.**
  - **No playing-time figure may change as a result of a reorder** — reordering changes who bats
    when, not who plays where. Playing time also keeps its own sort (most-benched first); it answers
    a different question and does not re-sort to match.
  - A reorder is **unsaved work** — it already flows through the one mutation path that snapshots
    for undo and marks dirty; the leave-guard names it ("You've changed the batting order").
- ⚠ **D-C12 — the trap this requirement exposed.** `renumberBattingOrder` numbers rows by walking
  the list and assigning `1..9` **only to rows with `starter === true`**; every non-starter gets
  `battingOrder: ''`. `starter` is an independent checkbox — it is derived from position **only** at
  the moment the coach switches mode (`changeMode` sets `starter: i < 9`). **So in `nine_player`
  mode, dragging a bench player to the top today is a silent no-op:** they get no number, and the
  player batting first stays first. Shipping a drag affordance over that behaviour would be the exact
  "worse than not using it" failure this chunk exists to remove. `everyone_bats` is unaffected
  (`starter: true` for all, numbered `1..n`).
- The per-inning position cell and the batting-order input reach the **44px** family standard at
  ≤640. The grid keeps **no** reorder or remove controls, so the 3.4rem pinned column narrows and a
  360px screen shows one more inning than today.
- **Resolve the 36 vs 44 disagreement** (§0.2) rather than adding a third number — the attendance
  controls and the lineup grid answer to one token.
- ⚠ **§1.7 carry:** this is a **sizing** pass. It must not add a new diamond-sport assumption; the
  existing debt is documented and stays documented. Any period/position noun that has to be touched
  goes through `lib/sports.ts`.
- The bare `.lineupTableWrap` / `.lineupScrollHint` pair → **`CoachScrollX`**, with the pin gutter
  passed through `--scrollx-pin-gutter` (Chunk A rule 3) so the three sticky lead columns do not
  lurch on the first swipe. **Highest-risk item in the chunk**; if it does not come out clean it
  ships as its own follow-up rather than compromising the touch-target fix.
- Growing the arrows costs width in a 3.4rem sticky column — the layout answer is in the mockups
  (D-C6), not improvised at build time.

---

## 6. C4 — The fuller game-day card (wow #2 remainder)

Lands **inside Chunk I's anchor**, in the existing `.oneReady` row. No new band, no second card,
board-tile suppression rules intact.

- **Richer chips:** arrival/call time and uniform where set — the two facts a coach re-checks on a
  game morning that currently require opening the event.
- **Arm care:** warn-only, never blocking, never auto-changing a lineup (D-G1 family). Presentation
  and threshold are **D-C7**.
- Chips gate on **capability to complete**, per Chunk I rule 4 — a coach without lineup access sees
  no lineup-derived chip, and the card never yields its slot.
- Period vocabulary through the Sport Pack — "innings" only via the pack.

---

## 7. C5 — Event modal discard guard (correction, not a build)

The hand-rolled guard (§0.1) migrates to `useDiscardGuard` + `snapshotEqual`, ONE baseline mapping,
with **stake-naming copy** replacing *"You have unsaved changes to this event."*
The new preview surfaces (C1/C2) are long-lived forms and get the same guard from birth — a
half-typed 12-row opponent list is exactly the work Chunk A rule 4 exists to protect.

---

## 8. Decisions to ratify (D-C1…D-C12)

Recommendations are stated, not hedged. See the PM brief for the plain-language framing.

> ## ✅ ALL TWELVE RATIFIED · MOCKUPS REV 4 APPROVED (owner, 2026-07-30 → "looks good, go ahead")
>
> **D-C1** fix the time defect **and correct the events already saved** (reviewed dry run with
> counts, announced in-product, C0 goes first) · **D-C2** per-date editable list · **D-C3**
> recurrence keeps league games · **D-C4** two templates + our own export · **D-C5** paste *and*
> file · **D-C6** mirrored look-alikes surfaced, never merged · **D-C7** arm care claims **only what
> we can prove** (the coach's own per-game cap + days since last outing; **no invented season
> ceiling**) · **D-C8** shared scroller adopted, severable · **D-C9** **no** outward-facing send ·
> **D-C10** reordering leaves the grid into its own tab with press-and-hold drag · **D-C11** tabs
> named `Batting order · Positions · Playing time`, order label from the Sport Pack · **D-C12**
> dragging across the cut line promotes the player and drops the ninth to the bench.
>
> **Approved mockups are the binding visual spec, including every UNCHANGED region.**

| # | Decision | Recommendation |
|---|---|---|
| **D-C1** ✅ | **Does Chunk C absorb the time-truth fix (§0.5), and are existing rows corrected?** | **RATIFIED — yes to both, and it goes first.** It is a live defect on a shipped surface, it is the precondition for import, and the correct helper already exists in-house. Correct existing rows by **one-shot dry-run script**, scoped from live data, not a migration — the app-written population is identifiable and small (premium coaches are few and the portal is young). |
| **D-C2** ✅ | **The recurrence fix shape.** | **RATIFIED — per-date rows in an editable preview**, shared with the importer. Not "recurrence for practices only" — that removes a feature to avoid fixing it, and the click math (§3) says the editable list wins on its own merits. |
| **D-C3** | **Does recurrence stay available for league games?** | **Yes.** Narrowing it to practices would make import mandatory for anyone without a spreadsheet — most first-season coaches. |
| **D-C4** | **Import v1 templates.** | **Two: a games sheet and a practice block** — plus the app's own export as a third de-facto shape (round trip). A "full mixed" template is a column superset nobody fills; the export already covers that case honestly. |
| **D-C5** | **Paste, file, or both?** | **Both**, matching the roster precedent. Paste is how a coach moves rows out of a league email; file is how they move a season out of Excel. |
| **D-C6** | **Tournament-sourced rows inside a pasted league sheet.** | **Surfaced as a possible duplicate, never merged, never written over** (Batch 4 rule 5). "Keep both" is a real answer, remembered per device. |
| **D-C7** ✅ | **Arm-care presentation and threshold.** | **RATIFIED — warn on what we can prove and nothing more:** (a) today's saved lineup exceeds a pitcher's own per-game cap, and (b) days since that pitcher's last outing. **No invented season ceiling** (§0.3) — a fabricated threshold is the D-G1 error in a place where the cost is a child's arm. Copy is fair-to-the-kid and addressed to the coach's judgement, never a verdict. |
| **D-C8** | **Does the lineup grid adopt `CoachScrollX` in this chunk?** | **Yes, but severable.** It is the right home for the rule; if the three sticky columns fight it, the touch-target fix ships and the scroller becomes a follow-up. Flagged so a partial outcome is a known result, not a silent cap. |
| **D-C9** ✅ | **Does the schedule grow an outward-facing "notify families" send?** | **RATIFIED — no, not in this chunk.** If it is wanted, it follows D-E9: **opt-in, default off, riding the individual write**. Raised now because the idea will come up during import ("tell everyone the season is up"). |
| **D-C10** | **How does a coach reorder the batting order on a phone?** *(added at the mockup round; **REVISED at rev 2 after owner pushback** — the rev-1 answer, a row menu holding Move up / Move down, cleared the size standard but made a repetitive job worse: building an order is many moves, and a menu round-trip per move is the wrong trade)* | **Give reordering its own tab, and give it back press-and-hold drag.** Drag is already built (dnd-kit grip) and works on desktop; `.lineupGrip { display: none }` at ≤640 exists because the grid scrolls horizontally and a drag is indistinguishable from a swipe at gesture start. A plain vertical list has **no horizontal scroll**, so the conflict disappears and a press-delay touch sensor is unambiguous — one drag replaces up to seven arrow taps. ▲▼ stay per row at full size for a single nudge and as the accessible path. **The grid then carries no reorder controls at all** (▲ 18px, ▼ 18px and ✕ 22px all leave it), so its 3.4rem pinned column narrows and a 360px screen shows **one more inning** than today. Third tab joins the shipped `Lineup / Playing time` tablist; disabled while the lineup is empty, matching Playing time. |
| **D-C11** | **What are the three lineup views called?** *(raised by the owner at rev 2 — with a third view, "Lineup" can no longer be one of the tabs)* | **`Batting order · Positions · Playing time`.** Each tab names the question it answers; the **page** keeps the name *Lineup*, because all three are the lineup. Left-to-right is the real order of work and the order auto-fill consumes; the page still **opens on Positions** (today's default surface, where readiness is answered). ⚠ **The order label comes from the Sport Pack** — it has `periodLabel`/`periodLabelPlural` but no order noun, so hard-coding "Batting order" would be a NEW §1.7 debt instance. Softball/baseball render identically to today. |
| **D-C12** | **In `nine_player` mode, what does dragging a bench player into the order do?** *(surfaced while specifying the owner's cross-tab persistence requirement — today it is a silent no-op, see §5)* | **Dragging across the cut line PROMOTES the player and drops the ninth to the bench.** The Batting order tab renders two sections (the nine who bat · the bench) with a visible cut line, so the consequence is seen as it happens rather than discovered later in Positions. The Starter tick survives as the explicit control. *Smaller alternative:* refuse the drag and explain ("Tick Starter to put Ava in the batting nine") — less to get wrong, but refusing a gesture the coach obviously meant is the failure mode this chunk exists to remove. `everyone_bats` has no cut line and no complication. |

---

## 9. Definition of done

- [ ] Plan + PM brief + **approved mockups** (labelled NEW / RESTYLED / UNCHANGED) — **before code**
- [ ] D-C1…D-C12 ratified
- [ ] Built in one pass → `/simplify` → `/review` (**high-risk tier** — bulk schedule writes) → `/docs`
- [ ] `npm run typecheck` · `npm test` · focused lint green
- [ ] `npm run verify:changed` fully green, **all baselines unchanged** (six colour + date at ZERO)
- [ ] New `tests/uat/scenarios/coach-schedule-smoke.spec.ts` passing, minimum coverage:
      recurrence generating N games with N **different** opponents · an import preview refusing an
      ambiguous date · an import skipping a mirrored duplicate · **a data-level assertion that no
      mirrored row changed** · lineup targets ≥ standard at 360×740 by computed style ·
      the read-only assistant sweep (no write door anywhere) · **a time round-trip assertion**
      (type 6:00 PM, read back 6:00 PM)
- [ ] Fresh dev restart (stop → `rm -rf .next` → `npm run dev` → login 200, no `EACCES`)
- [ ] Owner QA
- [ ] Committed on `dev`, explicit `:(literal)` pathspecs, per-action owner OK
- [ ] `PROGRAM_COACH_PORTAL.md` §1.1 ticked (P1 #6, #7, #9, wow #2) + `memory/design_decisions.md`
      entry + `lib/help-content/coaches.tsx` updated in the same unit of work

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| **The time fix changes what existing events say.** A coach who learned to read their schedule 4 hours off will see every event move. | The correction is announced in-product, not silent. Dry-run first, reviewed row counts, reversible. **D-C1.** |
| Import multiplies any write-path defect by a whole season. | C0 lands first; import writes through the same writer as the form; zero-writes is an error; mirrored rows asserted untouched at the data level. |
| `CoachScrollX` fights the lineup grid's three sticky columns. | **D-C8** makes it severable up front. |
| The preview component serving both recurrence and import becomes a god-component. | It is a **table with a verdict per row**; generation and parsing stay outside it. `/simplify` runs before `/review`. |
| Arm care reads as medical advice. | Warn-only, coach-addressed, no invented threshold, Sport-Pack vocabulary. **D-C7.** |
| Shared `dev` tree is busy. | Diff every shared file before staging; `:(literal)` pathspecs; `git show --stat HEAD` audit; `memory/design_decisions.md` checked for foreign hunks. |
