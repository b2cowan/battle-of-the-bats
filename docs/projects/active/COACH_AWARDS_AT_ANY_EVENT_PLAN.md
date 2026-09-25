# Awards at any event — implementation plan

**Hub (mockup · brief · plan · decisions · QA walk on one URL):** https://claude.ai/artifact/SbdfdYBKa2rxd35xXRmXTe —
source `docs/projects/active/COACH_AWARDS_AT_ANY_EVENT_HUB.html` (republish the same path). PM brief:
`COACH_AWARDS_AT_ANY_EVENT_PM_BRIEF.md`. QA: ledger §235.

**Owner ask (2026-09-25):** "I should be able to assign awards at any event, including practices."

## Problem / context

The award record already points at any event (`rep_player_awards.event_id` → `rep_team_events`), but
three gates and five labels assume a game:

| Where | Today |
|---|---|
| `scheduleDrawerDoors` (`lib/coach-schedule-doors.ts`) | `awards: ev.isGame && canManageAwards(caps)` |
| Schedule event window (`schedule/page.tsx`, `awardsBlock`) | renders only when `isGameEvent` |
| `POST /api/coaches/[orgSlug]/teams/[teamId]/awards` | an event-linked award needs `teamScore` + `opponentScore` — a practice can never pass |
| `getRepTeamPlayerAwardsHydrated` (`lib/db.ts`) | reads only `opponent` → `eventOpponent` |
| Awards report "For" (`history/awards/panel.tsx`) | `vs {eventOpponent}` else label else "General" → a practice award reads **"General"** |
| Report edit form + schedule give form | "For: vs {opponent ?? 'opponent'}" |
| `describeAwardOccasion` (`lib/rep-award-occasion.ts`) | "for this game" for every event |
| `PATCH /awards/[awardId]` | "This award is linked to a game — …" |

The only recorded reason for the gate (archived `COACH_TAGS_AWARDS_PLAN.md`) is "can't award a game
that hasn't been played". No ruling excluded practices — the feature was framed as player-of-the-game.

## Rulings

- **R1 (2026-09-25) — every event:** practices, team events and whole tournaments (`external_tournament`).
  Games keep the final-score rule.
- **R2 (2026-09-25) — a non-game event unlocks at its start time.** An award records something that
  happened; keeps an empty awards box off every upcoming practice. Banquet awards recorded ahead stay on
  the Awards report (general award + typed label).
- **R3 (2026-09-25, revised the same day) — a started non-game event's awards sit ABOVE attendance at both
  widths**, where a started game's already sit. First approved below attendance on a phone with the mockup;
  the owner on the first look at the build: *"why is give awards in a different place in practices vs.
  games?"*
- **Deferred to the schedule deep dive (next project):** attendance as a button that opens its own screen
  instead of the inline list (owner's idea, 2026-09-25). Notes for that project: every event, not practices
  only; it revisits C3 (2026-09-21, ten players on screen one); the summary row should name who is out or
  has not replied; three "Take attendance" doors deep-link to `?event=…&tab=attendance` and must open the
  new screen directly; the lineup warning says "fix the attendance below".

## Scope

1. **One unlock rule, pure.** `awardUnlockState(event, nowMs)` in `lib/rep-award-occasion.ts`:
   cancelled → `cancelled`; game kinds (`COACH_GAME_EVENT_TYPES`) → `needs-score` until both scores
   exist; any other kind → `not-started` until `startsAt`; else `open`. POST route and window both read it.
2. **The door.** `scheduleDrawerDoors.awards = canManageAwards(caps)` — the door is permission, the
   unlock is event state. Update the doc comment and its unit test.
3. **The window.** Games: exactly as today. Any other event: render only when `open` (no locked box, no
   cancelled sentence — the 2026-09-04 anti-clutter rule). Desktop: after description / resources /
   practice plan, directly above the action row. Phone: after the practice plan, above attendance
   (revised — R3). Empty-state copy: "No awards given for this practice yet." / "…this event…".
4. **One occasion label.** `awardOccasionLabel(event | null, tournamentLabel)`: game kinds →
   `vs {opponent}` (falls back to the event `name`); any other kind → the event's `name` (what the
   schedule shows — "Practice", "Batting cages", "Team pizza night", the tournament's name); no event →
   typed label or "General". Hydration selects `event_type, name` and returns `occasionLabel`,
   replacing `eventOpponent` (its only reader is the report panel). The schedule give form builds its
   "For:" line from the same helper.
5. **The sentences.** `describeAwardOccasion` takes the event kind: "for this game / practice /
   tournament / event". PATCH reads the award's event to phrase its collision refusal; its label
   refusal says "linked to an event on your schedule".
6. **Note example.** Game keeps "e.g. Diving catch to end the game"; any other event "e.g. Ran every
   drill at full speed".
7. **Help (`lib/help-content/coaches.tsx`).** Retitle "Awards (games only, once a final score is in)";
   update the "How do I give a player an award?" FAQ (answerText, JSX, keywords: practice award,
   banquet award); fix existing drift — both say the form "clears right away" for the next award, but
   Save has closed it since the owner's 2026-07-12 correction; Premium summary "MVP given out after games".
8. **Dictionary.** `rep_player_awards.event_id` meaning widens from "the game" to "the event" — a
   field-meaning change → `DATA_DICTIONARY.md` in the same unit.
9. **Tests.** Pure tests for unlock state, label and sentence across every event kind; doors test flips
   the non-game case; source-scan tests pinning "for this game" / "linked to a game" updated.

## Out of scope

- Tags on practices (a game-results vocabulary — "record by tag").
- A "For" picker on the report's Give form listing schedule events (the natural next step for
  banquet-ahead).
- Awards on the practice review page.
- The games' final-score rule.
- Demo narration — the demo re-seeds itself; no tour anchor changes.

## Approach

Open the door by **event state**, not a list of kinds: a game proves it happened with a score,
everything else with its start time. A per-kind allow-list would need an edit the next time a kind is
added. The label lives in **one pure helper** every surface reads, because the defect otherwise shipped
is quiet: each surface reads fine alone while calling a practice award three different things.

## Season rules (CLAUDE.md)

No change. Award writes already require a live season (`resolveLiveCoachTeamContext`); nothing learns a
year, so `HISTORY_ENDPOINTS` is untouched.

## Build record (2026-09-25)

Built to the approved mockup on `dev`. Typecheck clean; `verify:changed` green (4,739 unit tests plus the
spelling, date, dictionary, layout and schema gates). Dev server restarted (shared modules changed).

**Found while building, fixed in the same unit:**
- **A sixth label.** `previewMergeRepTeamAwardTypes` said "for the {date} game" for every event-linked collision.
  Now `describeDatedAwardOccasion` — "for the Sep 21 practice", "for Team pizza night".
- **Awards were dated from the UTC day.** The POST route (`event.startsAt.slice(0, 10)`) and the schedule's Give
  form label did the same slice, so any event starting at 8 p.m. Eastern or later was dated the next day — games
  included, since awards shipped. Both now use `orgDayKey`. Dev: 23 event-linked awards, all games, none dated
  wrong. Prod not audited; no rows repaired (DATA_DICTIONARY `rep_player_awards` gotcha 3 records it).
- **Help drift.** Article + FAQ said the form "clears right away"; Save has closed it since 2026-07-12.

**Deviation from the mockup (flagged, not silent):** the mockup drew a rule between the practice plan and the
Awards section; the window stacks `formSection`s without rules (a game's score/tags/awards do the same), so the
build matches the window.

**What changed, by file:** `lib/rep-award-occasion.ts` (`awardEventKind`, `awardOccasionLabel`,
`describeAwardOccasion(o, eventType)`, `describeDatedAwardOccasion`, `awardUnlockState`) ·
`lib/coach-schedule-doors.ts` (door = permission) · `awards/route.ts` POST (unlock rule, kind-aware refusals,
`orgDayKey`) · `awards/[awardId]/route.ts` PATCH (kind-aware collision sentence, label refusal wording) ·
`lib/db.ts` (hydration returns `occasionLabel` + `eventType`, replacing `eventOpponent`; merge preview) ·
`lib/types.ts` · schedule `page.tsx` (block gate, placement both widths, Give form label) ·
`history/awards/panel.tsx` · `GiveAwardModal.tsx` (note example by kind; stale header comment) ·
`lib/help-content/coaches.tsx` · `DATA_DICTIONARY.md`.

**Tests:** `rep-award-occasion.test.ts` (+ kind, label, both sentences, unlock across every type) ·
`coach-schedule-doors.test.ts` (door on a practice) · new `coach-awards-any-event.test.ts` (wiring) ·
`coach-schedule-phone-guard.test.ts` (pinned expression updated).

**Closed 2026-09-25:** the §235 walk marked complete by the owner · `/review` (high-risk, four lenses) 0 Critical/High/Medium — one advisory applied (the PATCH route's event lookup re-checks `teamId`) · committed on dev 2026-09-25. Prod ships with the next promote (no migration).

## Rollout

No migration. The once-per-occasion partial unique index (mig 289) is keyed on `event_id`, so it
covers any event unchanged. Ships with the next promote; the QA walk joins the hub once built.
