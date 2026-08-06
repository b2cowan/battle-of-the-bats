# Opponent Scouting Book — Implementation Plan

**Status:** APPROVED — owner greenlit as the next project 2026-08-04 (v3 mockup).
**✅ PHASE 1 COMMITTED to dev at `72034c15` (2026-08-04) — owner QA = OWNER_QA_LEDGER.md §1.12 still owed.**
**✅ PHASE 2 BUILT on dev 2026-08-04 (owner cleared the mockup gate in-conversation by ordering
execution of the build prompt) — all five slices: merge/aliases ("Same team as…" + un-merge +
alias-aware schedule chips), auto-insights ("The numbers vs them" + "what worked" lineup join),
staff-chat game-plan snapshot share, drawer tag filters + game-week masthead nudge, and the
one-sitting capture polish. Owner QA = OWNER_QA_LEDGER.md §1.13. No new migration (P1's three
tables carry P2, as planned).**
⚠ Migration 225 is DEV-ONLY (apply to prod before promoting this code). Parity baseline
re-initialized to accept the three dev-only tables.
**✅ PHASE 3 BUILT on dev 2026-08-04 (owner cleared both gates in-conversation: mockup v3
stage 7 approved + QA gate waived by ordering the build) — two slices: the tournament-intel
block ("Their tournament so far", same-tournament only per §9 Q4, assembled through the real
tie-break engine + the mirrored-chip reveal rules, no-names payload pinned by unit test) and
the practice-week planner bridge (game ≤6 org-days after the practice, alias-aware via the
book's key resolution). The Game-Day handoff slice was SKIPPED — Game-Day Mode is still
Proposed; it remains the cross-plan integration point. Owner QA = OWNER_QA_LEDGER.md §1.14.
No new migration (P1's three tables still carry everything).**
Ratified with that approval (all three were shown in the approved mockups): the INSTRUMENT
ruling (§1 — live-only, no archive door), the open-contribution model (§4.5 — all
`schedule`-holders incl. Helpers log attributed observations; head coach removes any;
book line stays `notes`-gated), and sport-pack-fixed tag vocabulary. Q4/Q5 (§9) remain open.
**Date:** 2026-08-03 (proposed) · 2026-08-04 (approved)
**Tier:** Premium coaches portal (rides existing team access + per-coach capabilities; no new
billing gate — Insights-hub precedent)
**PM brief:** `COACH_OPPONENT_SCOUTING_BOOK_PM_BRIEF.md`
**Mockup:** Claude Artifact "Opponent Scouting Book" (see PM brief)

Prior art: explicitly deferred in `COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md` Phase 3
("Opponent notes/scouting section — own plan; depends on data model that doesn't exist yet").
Binding IA precedent (`memory/design_decisions.md` 2026-07-08): **new analytics land as
Insights sections, not new nav items.**

---

## 1. What this is

A per-opponent card: your history against them across every season (record, scores, last
meeting), the coach's scouting knowledge, and "what burned us last time" — surfaced in
three places: an **Opponents** section of the Insights hub, a **Scouting tab** in the schedule's
game drawer, and (once built) the Game-Day Mode header. Today this lives in coaches' phone
notes apps; nothing in the portal aggregates games by opponent at all.

### The workflow (owner-directed redesign, 2026-08-04)

The book is written **per game, in the moment the coach already touches every game** — right
after entering the final score — and read **in game week**, where the coach prepares. Three
beats, no separate destination to remember to visit:

1. **Capture (≈20s, right after the score).** Saving a final score for a game whose opponent
   has (or can mint) a book entry turns the "Saved" toast into a quiet door: *"Add to the book
   on Thunder?"* → a bottom sheet: one text line per observation (add several), each optionally
   tagged from a short sport-pack-supplied list (softball: Pitching · Hitting · Defense ·
   Baserunning · Coaching). Skippable forever; never a modal interrupt. The same sheet is
   reachable any time from the game drawer's Scouting tab ("Log an observation").
2. **Aggregate (automatic).** Observations are **dated, per-game entries** that pile up under
   the opponent via the name grouping — the coach never files anything. The card shows them
   nested under the meeting they came from (newest season first), filterable by tag. On top
   sits **The book line** — a short, coach-distilled summary (the "if you read one thing"
   field), editable in place, which is also what the schedule tab and Game-Day header show
   first.
3. **Report (game week).** The schedule row wears the record chip; the game drawer's Scouting
   tab shows the book line + last meeting + latest observations with an "everything we know"
   link to the full card; the masthead nudges once in game week when the book has content
   ("You play Thunder Saturday — 6 observations in the book").

So: **yes — logged by game, aggregated and reported later**, and **no separate scouting
section** — capture lives in the score-entry flow, reading lives in Insights + the schedule.
A standalone section was considered and rejected: it becomes a chore destination coaches
forget; the score toast is the one moment every coach already visits after every game.

### The hard problem, solved cheaply: opponent identity

There is **no opponent entity anywhere** (verified): `rep_team_events.opponent` is free text;
even organizer-side tournament `teams.id` is re-minted per registration, so no stable
cross-season key exists to join on. Rather than a heavyweight entity + FK backfill:

> **The book is an overlay keyed on normalized opponent names.** Games keep their free text
> untouched (mirrored rows stay organizer-owned; zero event migration). At read time we group
> the team's game events across ALL seasons by `normalizeOpponentName()` (casefold, collapse
> whitespace/punctuation, strip leading "the"). A coach-managed **alias merge** ("Thunder 12U"
> = "Oakville Thunder") handles the tail the normalizer can't. Notes attach to the opponent
> record, not to any game row.

This mirrors the player-continuity philosophy (identity is a coach-confirmed overlay, sides
stay immutable) with a fraction of its machinery — no DOB/email matching, no per-pair
tombstone lifecycle; opponent names are low-stakes, so auto-group + manual merge suffices.

### Record or instrument? (the archive ruling this plan must request)

**Recommendation: INSTRUMENT — live-season-only, like the drill library.** The book reads all
seasons but *feeds the live season's preparation*; notes update in place ("their ace graduated"
overwrites, history doesn't). Precedent: `development/drills/past-seasons` +
`plan-templates/past-seasons` — deliberate cross-season GETs kept OFF the season-read rail,
with a unit test asserting so. Consequences:
- **No** entries added to `APPROVED_ARCHIVE_DOORS` / `APPROVED_SEASON_AWARE_ROUTES`.
- Archived seasons show no scouting UI anywhere (the Insights hub's Opponents tile renders
  only for the live season; the schedule drawer tab likewise).
- The per-season *facts* the card shows (game log) remain reachable in archives through the
  already-approved Schedule/Insights doors — we duplicate no archive surface.

If the owner instead rules it a RECORD (frozen per-season scouting snapshots), the API grows a
season dimension and joins the allow-lists — materially different shape; decision needed
before build (§9 Q1).

---

## 2. Existing foundations (verified)

| Piece | Where | Role |
|---|---|---|
| Cross-season query precedent | `getRepTeamPracticePlansAcrossSeasons` (`lib/db.ts` ~7414): `rep_team_events` by `team_id`, no year filter | The aggregation query shape |
| Canonical game-type constants | `COACH_GAME_EVENT_TYPES` (incl. scrimmage) / `WRAPPED_RECORD_EVENT_TYPES` (record tally rule, excl. scrimmage) | Card shows both: official record via the wrapped rule, scrimmages listed but badged |
| Opponent name at render | schedule drawer `eventMeta` ("vs/@ opponent"), list chip `vs {opponentName}`, three merged sources (coach events / mirrored / unmirrored tournament games) | Resolution points for the card + glance chip |
| Drawer tabs system | `slideTabs` in `schedule/page.tsx` (Lineup tab pushed for lineup events) | "Scouting" tab pushed for `isGameEvent` |
| Insights hub | `/history` page (route name stays, label "Insights"), tile-per-report | New **Opponents** tile |
| Notes conventions | `practice_recap` (≤2000, written at leisure, NULL renders honestly, coach-only, never per-child) · `notes` capability gates coach notes (head-coach default, assistants opt-in) | Tendencies note follows all of it |
| Sport Pack | `sportPack.score.unit/for/against`, `startVerb` | "Runs for/against" vocabulary; no hard-coded baseball terms |

---

## 3. Data model

One migration (+ DATA_DICTIONARY + snapshot refresh, same unit of work):

```
rep_team_opponents
  id uuid PK
  team_id FK rep_teams          -- team-scoped: this team's book, not a global registry
  display_name text             -- as the coach wants it shown
  normalized_name text          -- normalizeOpponentName(display_name)
  summary text ≤500             -- "The book line": coach-distilled read, edited in place
  last_note_updated_at / updated_by
  UNIQUE(team_id, normalized_name)

rep_team_opponent_observations  -- the per-game capture log
  id uuid PK
  opponent_id FK rep_team_opponents (CASCADE)
  team_id FK rep_teams
  event_id FK rep_team_events nullable  -- the game it was learned in (null = logged from the card)
  body text ≤500 (app-enforced)
  tag text nullable             -- sport-pack-supplied vocab, app-validated (no DB CHECK)
  created_at / created_by
  -- append-only in spirit: no edit UI; author may delete own entries (mistake removal),
  -- following the game-moments convention from the Game-Day plan

rep_team_opponent_aliases
  id uuid PK
  opponent_id FK rep_team_opponents (CASCADE)
  team_id FK rep_teams
  normalized_alias text
  UNIQUE(team_id, normalized_alias)   -- an alias resolves to exactly one opponent per team
```

Rows are minted lazily: first time a coach opens a card or writes a note for a grouped name.
Unmerged names still render cards (aggregation-only, note CTA mints the row on save). Merging
moves the loser's normalized name into the winner's aliases and re-points/concatenates its
note; unmerge = delete alias (names regroup naturally next read). No FK from events — ever.

`normalizeOpponentName` lives beside the vocab helpers as a pure exported function
(unit-tested; also applied to alias writes so both sides of every comparison are normalized).

## 4. UX specification

### 4.1 Opponents section (Insights hub — the deep home)

Tile on `/history` → `/history/opponents`: list of grouped opponents sorted by most-recent
meeting — each row: name, all-time record chip (W-L-T via the wrapped rule), last meeting
line ("L 3-5 · Jun 14"), note-presence dot. Search-as-you-filter. Row → opponent card page
`/history/opponents/[opponentId|name]`:

- **Header:** name, record (official + "N scrimmages" sub-line), score.unit for/against totals,
  streak vs them.
- **The book line:** the ≤500 summary, autosave on blur + "Saved" pill, `notes` capability to
  write, honest empty state ("Nothing in the book yet — log what you'd want to remember next
  time.").
- **Tag filter chips:** sport-pack vocab + "All"; filters the observation log below.
- **Meetings timeline:** every game vs them across seasons (season-badged, newest first,
  scores, W/L/T, scrimmage badge), with that game's **observations nested under it** (dated,
  tag-chipped, author-shown when staff > 1). Observations logged from the card (no game)
  group under "General". Live-season meetings link to the game; past-season rows are
  facts-only, no links into archives — the drawer isn't season-aware.
- **Merge control** (head coach / `notes` cap): "Same team as…" picker → merge per §3.

### 4.2 Capture — the score-toast door + observation sheet

When a final score save succeeds for a game with a groupable opponent name, the existing
"Saved" confirmation gains a one-line action: **"Add to the book on {opponent}?"** (quiet
link, never a modal — ruled §9-2026-08-03). It opens a bottom sheet (`.sheetOnMobile`
conventions): the game header for context, an observation input (add multiple, one per
line-item), optional tag chips, and the book line shown beneath for quick touch-ups. Skipping
never re-prompts for that game; the sheet stays reachable from the game drawer's Scouting tab
("Log an observation") and the Game-Day end-wrap later. Observation writes mint the opponent
row lazily (§3).

### 4.3 Scouting tab (schedule drawer — the glance)

For game events with an opponent name: record chip + last-meeting line + **the book line** +
the 2 latest observations + "Log an observation" + "Everything we know ›" link to the card.
Unknown opponent (TBD placeholder / no name yet): tab absent — never a dead end. List rows:
append a small record chip to the existing `vs Thunder` chip (`2-1`, `--font-data`) when the
roll-up has ≥1 prior meeting; computed from the same one-shot aggregate the schedule read
already returns (no N+1). **Game-week masthead nudge** (one line, once per game): "You play
{opponent} {day} — {n} observations in the book."

### 4.5 Staff contributions & curation (owner deep-dive, 2026-08-04)

The best observations come from the bench, not the head coach — the assistant tracking their
pitcher, the helper keeping the book. So contribution is **open, attributed, and curated**:

- **Who can log observations:** any staff member whose grants include `schedule` — head
  coach, assistants, AND Helpers. Observations are about opposing teams (no roster records,
  no PII), so the Helper preset's "schedule-only, no record access" posture is not violated.
  The capture sheet shows "Logging as Sam (Helper)" so contributors know they're on the record.
- **Attribution everywhere:** every observation renders its author chip when the team has >1
  staff contributor. The card gets a **"New since you last opened this"** separator for the
  head coach (per-coach last-viewed marker, sessionStorage-class, not schema).
- **Curation, not moderation:** contributions appear immediately — no review queue (a
  visibility gate kills the 20-second habit, and bench staff are already trusted with the
  bench). The **head coach can remove any observation; authors can remove their own.** The
  book line — the program's curated voice — stays `notes`-gated (head coach + explicitly
  granted assistants). This mirrors the tryout-evaluators pattern: many people score, the
  coach owns the verdict.
- **"Numbers, not names" (privacy posture):** opposing players are other people's minors.
  Capture-sheet microcopy instructs "refer to opposing players by jersey number or position,
  never by name," and the help doc says why. Deliberately guidance + culture, not a text
  filter (unenforceable, and false positives would poison trust). No photo attachments, ever
  — images of opposing minors is a line the platform does not cross.

### 4.6 Auto-insights — "The numbers vs them" (no capture required)

Derived at read time from data already stored; renders on the card between the stats and the
book line, each line only when it clears a confidence floor (≥3 meetings, or ≥2 for the
lineup insight):

- **Splits:** home/away record vs them, this-season vs all-time, average score.unit
  for/against, "all N meetings decided by ≤2" closeness flag, biggest win / worst loss.
- **"What worked":** joins their meetings to OUR saved lineups (existing tables): "In both
  wins, {player} started at {pitcherPosition}; in the loss she didn't." / "You out-rotated
  them: 9 players saw the field in every win." Own-team data only — this is self-scouting
  against a specific opponent, and it makes saved lineups more valuable retroactively.
- Every insight line carries a "from {n} games" provenance chip — the Ask-the-Front-Office
  promise (every sentence provable) applies here too.

### 4.7 Tournament intel — the moat feature (only works because we run the tournament)

For a **mirrored tournament game**, the platform already hosts the opponent's OTHER results
in that same tournament (organizer-side `games` for their registration — the same public
data the tournament's standings pages show). The Scouting tab gains a **"Their tournament so
far"** block: their results today/this weekend, score.unit for/against, current standing —
assembled automatically, zero capture, refreshed on read. Honest constraint stated in-UI:
appears only when the tournament runs on FieldLogicHQ (external tournaments can't offer it).
This is the feature no standalone coach app can copy — the scouting book fills itself while
the coach's team is warming up. Public data only (what standings pages already publish);
never opposing rosters/names.

### 4.8 Game-plan share (staff chat bridge)

"Share to staff chat" on the card and Scouting tab posts a formatted game-plan snapshot
(matchup + book line + tagged observations + numbers block) into the existing team staff
room (`staffChat` capability, existing chat infra — no new channel). Assistants walk into
Saturday already briefed; the share is a snapshot message, not a live link, so later edits
don't rewrite chat history.

### 4.9 Practice-week bridge (P3, small)

When a practice plan is built in a week containing a booked opponent's game, the planner
shows a quiet one-line panel: book line + top observation + "full book ›". Closes the loop
from intelligence → preparation (they bunt first strike → Tuesday's bunt-defense block).

### 4.10 Game-Day Mode handoff (after that project ships)

Console header opponent name links to the Scouting tab content as a sheet. Listed as a
cross-plan integration point in both plans; neither blocks the other.

## 5. API surface

- `GET .../opponents` — grouped roll-up (aggregation across seasons + minted rows + aliases).
  Caps: `schedule` (read). Cross-season by construction; **stays off the season rail** (unit
  test alongside, drills-past-seasons pattern).
- `GET .../opponents/[id]` — card payload (meetings timeline + observations + summary +
  auto-insights block). Caps: `schedule` (read).
- `PUT .../opponents/[id]` — summary/display-name writes. Caps: `notes`.
- `POST .../opponents/[id]/observations` — caps: `schedule` (open contribution, §4.5).
  `DELETE .../observations/[obsId]` — head coach any; otherwise author-own only.
  Lazy-mint variant: `POST .../opponents/observations` with `{opponentName}`.
- `POST .../opponents/merge` / `DELETE .../opponents/aliases/[aliasId]`. Caps: `notes`.
- `GET .../events/[eventId]/tournament-intel` — mirrored games only; assembles the opponent
  registration's other results from organizer-side data already public on standings pages.
- `POST .../opponents/[id]/share-to-staff-chat` — caps: `staffChat`; posts snapshot message.
- Schedule events read: gains a per-opponent `{record, lastMeeting}` mini-aggregate for chips.

## 6. Phases

- **P1 — The loop:** normalizer + aggregation, capture sheet + score-toast door, Opponents
  tile + list + card (summary + observation timeline), schedule drawer Scouting tab, record
  chips on schedule rows, **staff attribution + head-coach/author-own deletion +
  numbers-not-names microcopy** (multi-staff teams exist day one — curation can't wait).
- **P2 — Identity + intelligence:** merge/alias UI, tag filter chips, game-week masthead
  nudge, auto-insights block ("numbers vs them" + "what worked"), staff-chat game-plan share.
- **P3 — The moat + bridges:** tournament-intel block on mirrored games, practice-week
  planner panel, Game-Day header sheet + end-wrap capture door.

## 7. QA / verification

- Unit: `normalizeOpponentName` table-driven; grouping with aliases; record tally matches the
  wrapped rule exactly (shared constant, not a fourth tally); merge/unmerge round-trip; the
  off-season-rail assertion test.
- Contracts kept green: coach-season-write-guard lists unchanged; mirrored-event field
  ownership untouched (we never write event rows).
- `npm run verify:changed`; typecheck (shared: db helpers, schedule read shape).
- Owner QA: rename-across-seasons case (merge two spellings, record unifies); TBD opponent
  shows no tab; scrimmage excluded from the record chip but present in meetings; archived
  season shows no scouting anywhere.

## 8. Rollout

No flag needed (additive, coach-only, no family exposure, no email). Ships dark by absence of
entry points until the tile + tab land in the same commit.

## 9. Open questions (owner)

1. **Ratify the INSTRUMENT ruling** (§1) — live-only overlay, no archive door. (Recommended.)
2. **Ratify the open-contribution model** (§4.5): all `schedule`-holders (incl. Helpers) log
   attributed observations, appear immediately, head coach can remove any, book line stays
   `notes`-gated, no review queue. (Recommended; raised by owner 2026-08-04.)
3. Tag vocabulary: sport-pack-fixed (recommended — keeps filters meaningful) vs
   coach-editable tags (drifts into taxonomy work at 10pm).
4. Tournament intel scope: same-tournament results only (recommended — clearly public data),
   or also the opponent's results in OTHER tournaments hosted on the platform (more edge,
   but crosses from "what the scoreboard showed" into cross-event profiling of a team —
   needs an explicit owner comfort call before widening).
5. Future (not in this plan's phases): org-level opt-in book sharing between a club's own
   teams ("your club's collective book") — compelling for Club-plan orgs; team-scoped
   boundaries are load-bearing, so this needs its own ruling if wanted.
   → **Grown into its own project 2026-08-04:** `COACH_CLUB_SHARED_BOOK_PLAN.md` (+ PM
   brief), Proposed, awaiting its §8 rulings.

(2026-08-03 Q2 resolved by §4.5: assistants and helpers read the book — bench staff are the
point. 2026-08-03 Q3 resolved by the workflow redesign: capture is a quiet toast link +
always-available sheet — never a modal.)
