# Coach Onboarding — Quiet Mode

**Status:** Active · **Phase A BUILT on dev 2026-07-29 (uncommitted, owner QA pending)** · Phases B and C open
**Owner decision date:** 2026-07-29
**Surfaces:** Premium coach team Overview, every coach portal section, help drawer
**Related:** `PREMIUM_COACHES_PORTAL_WALKTHROUGH_PM_BRIEF.md` (archived), `COACH_PORTAL_LAUNCH_BATCH2_PLAN.md`, `HELP_SYSTEM_REDESIGN_PLAN.md` (archived)

---

## Problem

The Premium coach team Overview leads with a full-width setup panel that consumes roughly the
entire first viewport (~640px). A coach's actual dashboard — the "Your team at a glance" tiles,
the next event, dues, tournaments — begins below the fold. The first thing a paying coach sees
is a chore list, not their team.

Four concrete defects, ranked by user impact:

1. **Two unrelated jobs in one container.** The panel is simultaneously a *task list* (five
   milestone dots + optional checklist rows) and a *product-education surface* ("Also in your
   portal" chips, per-row help tooltips, a setup-guide footer link). A checklist is a poor
   teacher — it demands action before understanding. A coach cannot decide whether they care
   about Development from an unlabelled chip.

2. **No exit during setup.** The "Hide" control renders only when the collapsed strip is
   expanded — i.e. only *after* all five milestones are done or skipped. Before that, the only
   escape is skipping steps one at a time, and only the step currently designated "next" offers
   a Skip button. Clearing the panel therefore takes five separate interactions. This is the
   root of the owner's "forced on each coach" complaint.

3. **Duplication of the snapshot tiles.** "Set up dues", "Add a game", "Add players" already
   exist as empty states on the tiles directly below. The panel is a second copy of the same
   prompts, stacked on top of the first.

4. **No role or multi-team awareness.** Every coach on every team gets the panel. A coach with
   three teams gets three panels. An assistant coach without roster capability still sees a
   panel framed around roster setup (individual steps are capability-filtered, but the panel
   itself, its progress maths, and its headline are not).

Additionally, the vocabulary sets a deadline the product cannot keep: **"Your first week"**
persists until every step is done or skipped, which can take a month — and in a coach's second
season it reappears and claims to be their first week again.

---

## Decision (owner-ratified 2026-07-29)

Three coordinated changes. All three approved; sequence is A → C → B.

| | Change | Nature |
|---|---|---|
| **A** | Progress moves off the canvas into a header chip; one slim next-action line remains | Persistent, ambient |
| **B** | Each section's empty state teaches that section | Persistent, in-context |
| **C** | A one-time, *offered* portal tour with a permanent skip | One-shot, opt-in |

**Owner's framing:** the tour is the one-time product introduction with a real exit; A and B are
the persistent, non-cannibalising layer that carries ongoing guidance until the coach finishes
or dismisses setup.

### Vocabulary decision — "Season setup"

"Your first week" is retired. Replacement is **"Season setup"**, chosen because it is the only
candidate that is *true*: these steps are scoped to the active program year and reset when the
coach starts a new season. It sets no clock and reads correctly at day 2, week 6, and year 3.

Considered and rejected:

| Option | Rejected because |
|---|---|
| Getting started | Patronising to a returning coach on their third season |
| The essentials | Doesn't explain why it reappears next season |
| Your first week | Sets an unenforceable deadline; factually wrong in year two |
| Sports metaphors ("your starting five") | Basketball vocabulary in a softball/baseball product; violates the sport-neutral rule |

Second-tier group label: **"When you're ready"** replaces "Finish setting up", which implied the
coach was incomplete when skipping a budget is a legitimate way to run a team.

---

## Phase A — Progress off the canvas

**No migration. Contained to the team Overview page + its stylesheet.**

The underlying step definitions, completion detection, skip logic, capability filtering and
progress maths are **unchanged**. Only the rendering and the copy change.

### A1 — The header chip

A compact control in the page header, beside the existing help button:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dev Standalone U13 Bats  PREMIUM  U13         ◔ Season setup 1/5 ▾ ⓘ│
│  2026 Dev Standalone Season · Head Coach                            │
└─────────────────────────────────────────────────────────────────────┘
```

Opens a popover containing the existing content, restructured:

```
                          ┌────────────────────────────────────┐
                          │  SEASON SETUP · 1 of 5             │
                          │  ●━━━○━━━○━━━○━━━○                 │
                          │                                    │
                          │  ESSENTIALS                        │
                          │  ✓  Season confirmed               │
                          │  ○  Roster      Add players · Skip │
                          │  ○  Schedule    Add a game  · Skip │
                          │  ○  Lineup      —           · Skip │
                          │  ○  Families    —           · Skip │
                          │                                    │
                          │  WHEN YOU'RE READY                 │
                          │  ○  Jerseys & positions     · Skip │
                          │  ○  Assistant coaches       · Skip │
                          │  ○  Team documents          · Skip │
                          │  ──────────────────────────────────│
                          │  Take the 2-minute portal tour →   │
                          │  Turn off setup hints              │
                          └────────────────────────────────────┘
```

Requirements:
- **Every skippable step exposes its own Skip**, not only the step currently designated "next".
  This is the direct fix for defect 2. Roster stays non-skippable individually — nothing in the
  portal works without it, so a per-step "skip" there would be a lie; its exit is the global
  off-switch below, which is one click either way.
- Milestone steps keep their trail rendering (the dots) *inside* the popover; the trail is not
  deleted, it is relocated.
- Skipped steps show an Undo affordance, as today.
- The popover is dismissible by outside click, Escape, and a close control. Keyboard-reachable;
  the chip is a real button with `aria-expanded`.
- The footer carries two links: the tour (Phase C; until C ships this opens the existing
  `premium-portal-tour` help section in the drawer) and "Turn off setup hints".

### A2 — The next-action line

One row beneath the header, replacing the panel. It carries the same "what's next" sentence and
the same lime CTA the panel's `setupNext` block carries today:

```
├─────────────────────────────────────────────────────────────────────┤
│  ▸ Start here — add your players. Schedule, dues, and lineups all   │
│    build on the roster.                                             │
│    [ Add players → ]      New here? Take the 2-minute tour       ✕  │
├─────────────────────────────────────────────────────────────────────┤
```

- The tour link appears **only** on the coach's first visit and only until the tour is taken or
  skipped (Phase C wires the persistence; until then it points at the help drawer section).
- The ✕ turns off setup hints — same action as the popover's "Turn off setup hints".
- The line is *not* a card: no panel background, no border box that reads as a container. Target
  height ≈ 56px versus the current ≈ 640px.

### A3 — State machine

| Coach state | Chip | Next-action line | Notes |
|---|---|---|---|
| Essentials open | `◔ Season setup · N/5` | Shown, with CTA | The only nagging state, and it is one line |
| Essentials done, optional remain | `✓ Season setup` (quiet) | Hidden | No count, no %, no "3 optional steps left" strip |
| All done or skipped | Chip hidden | Hidden | Tour + guides remain on the ⓘ button |
| Hints turned off | Chip quiet (`◔`, no count) | Hidden | Reopenable; nothing is destroyed |
| Assistant with no completable steps | Chip hidden | Hidden | Fix for defect 4 |

The existing collapsed "First week done — N optional steps left" strip is **removed**. Its job
(quietly signalling remaining optional work) is now the chip's quiet state.

### A4 — Copy changes

| Location | Was | Becomes |
|---|---|---|
| Panel kicker | `Your first week · 1 of 5` | `Season setup · 1 of 5` |
| Trail aria-label | `First week: 1 of 5 done` | `Season setup: 1 of 5 done` |
| Optional group label | `Finish setting up` | `When you're ready` |
| Milestone group label | *(none)* | `Essentials` |
| Collapsed strip | `First week done — N optional steps left.` | *(removed — chip quiet state)* |
| Completion headlines | `Nice — you're running` / `Finish your setup` | *(removed — no panel to head)* |
| Discovery chips | `Also in your portal` + chips | *(removed — Phase B replaces)* |

### A5 — What also changed while building A

- **"Confirm season" is no longer a setup step.** It was a row that could only ever read "Done"
  (it auto-completes), and the page subtitle already names the active season. It stays in the
  underlying item list — `requiredDone` still depends on it — it is simply not rendered.
- **The preseason anchor lost its `N of M` eyebrow.** Setup progress is now reported in exactly
  one place, so the two counters cannot drift.
- **Dead CSS removed**: the momentum-ring block, the collapsed-strip block, the progress pill,
  and the panel's `setupNext`/`setupGuideFooter` rules. `setupPanel`/`setupHeader`/`setupKicker`/
  `setupTitle` are retained — Settings and Season's End use them as generic panel styles.
- **"Also in your portal" chips were moved into the popover, not deleted.** Deleting them before
  Phase B ships would open a discovery regression window.

### A6 — Preference storage (interim)

Setup-step skips remain device-local per team, as today. The new "setup hints off" preference is
stored device-local but **keyed per coach, not per team**, so a coach with three teams dismisses
once. Cross-device sync is deferred to Phase C, which introduces the account-level store.

---

## Phase B — Teach in place

**No migration. One section at a time; independently shippable.**

Each portal section's empty state becomes the teaching surface, on the principle that a coach is
curious about Lineups *when they open Lineups*, not when reading a chip on Overview.

```
┌─ Lineups ───────────────────────────────────────────────────┐
│                        ⊞                                    │
│         Build a batting order and field positions           │
│         once, then reuse it game to game.                   │
│                                                             │
│         Game sheets and attendance fill in from it          │
│         automatically, and Insights uses it to track        │
│         playing time fairness across the season.            │
│                                                             │
│         You'll need players on your roster first.           │
│                                                             │
│         [ Add players → ]      [ How lineups work ⓘ ]       │
└─────────────────────────────────────────────────────────────┘
```

The three-sentence contract for every section:
1. **What it is** — one sentence, plain language.
2. **What it unlocks elsewhere** — the cross-section payoff. This is the sentence the chip
   could never carry and the reason discovery currently fails.
3. **What's blocking it** — the honest prerequisite, if any.

Then exactly one primary action and one drawer link into the existing help content.

Sections in scope: Lineups, Development, Insights, Chat, Announcements, Documents, Staff,
Money/Budget, Tournaments, Schedule, Roster, Tryouts.

The per-section copy written here is **the same copy Phase C's tour cards use** — written once,
surfaced twice.

### B1 — Sequencing

Ship in two tranches so the highest-confusion sections land first:
- **B1a** — Lineups, Development, Insights, Chat (the four the readiness review flagged as
  invisible; these are what "Also in your portal" was failing to explain).
- **B1b** — the remainder.

Sections not yet rewritten keep their current empty states; there is no intermediate broken
state.

---

## Phase C — The offered tour

**Requires a migration (see C2).**

### C0 — Extract the shared popover primitive (carried over from the Phase A review)

The tour drawer needs the same open / dismiss / outside-click / Escape behaviour the setup chip's
popover already has. Build it **once** here, with those two as its first consumers, and retire the
duplicated implementations in the admin-tournament bundle (menu, status legend) plus the export
menu's third copy. Doing it now — rather than during Phase A — means the API is designed against
two real requirements instead of guessed from one.

Must carry the thing the hand-rolled version lacked: **viewport-aware positioning**, so a panel
can't open with its footer below the fold.

### C1 — Behaviour

- Surfaced as a **link**, never auto-launched. Entry points: the next-action line's "New here?
  Take the 2-minute tour", the setup popover footer, and the ⓘ help button — permanently.
- Opens as a **side drawer, not a centre modal**, so the sidebar stays visible behind it while
  the tour describes the sidebar. A centre modal would re-commit the exact interruption this
  project exists to remove.

```
│  SQUAD                          ┌──────────────────────────────┐
│    Roster        ←──────────────│  Portal tour            ✕    │
│    Lineups                      │  ● ○ ○ ○                     │
│    Development                  │                              │
│                                 │  SQUAD — your players        │
│  SEASON                         │                              │
│    Schedule                     │  Roster, lineups, and player │
│    Insights                     │  development live here.      │
│                                 │  Everything else in the      │
│  MONEY                          │  portal reads from your      │
│    Money                        │  roster — that's why it's    │
│                                 │  the one thing to do first.  │
│  COMMUNICATION                  │                              │
│    Chat                    3    │  → Open Roster               │
│    Announcements                │                              │
│                                 │  Skip tour        [ Next → ] │
│  TEAM ADMIN                     └──────────────────────────────┘
│    Staff
```

- Four cards, one per sidebar group: **Squad → Season → Money → Communication**. Each names the
  group it highlights and carries a deep link into that group's landing page.
- **Skip tour ends it permanently for that coach, across every team they hold** — not per team,
  not per season. Owner requirement, stated explicitly. It never re-offers itself. It remains
  reachable on demand from the ⓘ button and the setup chip.
- Cards are capability-aware: a coach with no money access does not get the Money card, and the
  progress dots reflect the reduced count.

Content largely exists already as the `premium-portal-tour` help section — this phase adapts and
paginates it rather than authoring from scratch.

### C2 — Account-level preference store

The "permanent, across every team" requirement cannot be met by device-local storage: a new
device would re-offer a tour the coach explicitly killed. Phase C therefore adds two typed
columns to the existing account-keyed `user_preferences` table (the table was deliberately built
general for exactly this — theme was its first column, not its only intended one):

- `coach_tour_dismissed_at` (tstz, nullable) — set when the coach finishes or skips the tour.
- `coach_setup_hints_off` (bool, default false) — the "Turn off setup hints" choice from A.

Both are account-scoped (`user_id` PK), never org- or team-forked, matching the table's existing
contract. Absent row / NULL = not yet decided.

Same unit of work: migration + `DATA_DICTIONARY.md` entry + `npm run refresh:snapshots`, per the
schema-is-dictionary rule.

**Doc-drift note:** the dictionary currently marks migration 195 (`user_preferences`) as
"⚠ PROD-PENDING", but project memory records the theming bundle including mig 195 as shipped
to prod 2026-07-22. Verify against live prod `information_schema` before writing the new
migration, and correct whichever record is wrong.

Once C2 lands, Phase A's interim device-local hints preference migrates to `coach_setup_hints_off`.

---

## Role and plan behaviour

| Role | Behaviour |
|---|---|
| Head coach (Premium) | Full experience: chip, next-action line, tour offer |
| Assistant coach | Chip renders **only** if at least one step is completable under their capabilities; otherwise nothing. Tour is offered but its cards are capability-filtered. **"Completable" means the capability that CLEARS the step, not the one that opens the page** — see the review fixes below |
| Assistant without money | No Money tour card; no budget/dues steps; progress denominator adjusts |
| Multi-team coach | "Hints off" and "tour skipped" are **per coach**, not per team. Step skips stay per team (they are per-season facts, not preferences) |
| Free-tier coach | Out of scope this project — the free portal has its own onboarding family per the two-family ruling |
| Closed/archived season | Unchanged — those teams redirect to Season's End and never reach this surface |

---

## Phase A review outcome (2026-07-29)

`/simplify` (4 lenses) then `/review` (3 lenses: correctness, regression/blast-radius, capability
gating). Gate green throughout: typecheck, focused lint (0 errors), 437/437 tests, all token and
date ratchets at zero.

### Confirmed and fixed

1. **Setup steps gated on "can you open the page" instead of "can you clear the step."** The
   roster and jerseys/positions steps had no capability gate at all, and assistants never receive
   roster write in V1 — so every assistant on a team with an unbuilt roster was told to "Add
   players" and sent to a read-only page. Roster is a `core` step, so it also carried no per-step
   Skip: the global off-switch was their only escape. The schedule step had the same shape against
   the `schedule` grant (the sidebar already hides Schedule without it, and the events API 403s).
   All three now declare the capability that **completes** them. Side effect, deliberate: an
   assistant's `requiredDone` now settles instead of being permanently false, so they reach the
   normal run-mode dashboard.
2. **Preseason card and next-action line swapped on load.** The card cleared as soon as the
   roster/events read landed, but the line additionally waits on the milestones read — so a
   returning coach in preseason saw the card render and get replaced a beat later. Both now wait
   for the same signal.
3. **The one-time tour offer failed closed on blocked storage.** "Already seen" was the default,
   and a storage exception left it there permanently — a first-time coach in a locked-down or
   private-mode browser would never be offered the tour. Now fails toward offering help.
4. **`role="dialog"` without focus management or `aria-modal`.** The popover is a disclosure, not
   a modal; it now describes itself as one rather than claiming semantics a screen reader would
   enforce against it.
5. **Dead style rule + stale comment** from the removed panel.

### Accepted, not fixed

- **Shared-device preference bleed** (Low). The two coach preferences are device-local and not
  user-keyed, so on a shared clubhouse browser coach B inherits coach A's dismissal. It is a UI
  preference, not data — nothing sensitive crosses — and it is self-correcting from the popover.
  **Phase C's account-level store is the real fix**; not worth a second interim mechanism.

### Follow-up item 1 — capability-blind dashboard reads — **FIXED (owner-approved scope widening)**

Investigation showed this was wider than first reported. The Overview fetched roster and events
unconditionally and treated any refusal as total failure, so **two** everyday assistant permission
settings broke the page — Schedule turned off (a common toggle), and Roster set to Hidden. Worse
than an error: the dashboard still rendered, with every tile reading empty, telling a coach with a
full squad and a full season they had "0 players" and "Nothing scheduled".

Part of this was introduced here: moving setup into the popover took the load-failure message off
the page, so the silent-wrong-data case lost its only warning.

Fixed, following the money guard's existing pattern in the same function:

1. **Don't request what this coach can't see.** Roster and schedule reads now gate on capability,
   exactly as the money reads already did, and only a *permitted* read that fails counts as failure.
2. **Tiles hide instead of showing confident zeros.** Every snapshot card now declares its own
   `visible` predicate (same shape as the setup steps), replacing the ad-hoc money-only filter. A
   tile whose source data wasn't fetched does not render.
3. **Schedule-derived surfaces are schedule-gated** — the "Right now" anchors, the winding-down
   cue, and the season record. Without event access these would announce "Nothing on your schedule"
   to someone merely not permitted to see it.
4. **Unknown roster ≠ empty roster.** A zero count short-circuits the phase to pre-season, so a
   roster-hidden coach was shown "set up your team" even on a game day. The phase now falls through
   to the schedule-driven branches it can actually answer from.
5. **The load-failure message is back on the page**, above the tiles it affects, with a retry —
   never only inside the popover (which a coach may never open, and which sometimes isn't there).

**Needs owner QA specifically:** one assistant coach with **Schedule turned off**, and one with
**Roster set to Hidden**. Capability combinations can't be verified without a browser.

### Follow-up item 2 — a third hand-rolled popover — **PARKED against Phase C**

The open / dismiss / outside-click / Escape behaviour here duplicates two existing implementations
in the admin-tournament bundle (and a third re-implementation in the export menu). No shell-neutral
home exists, so reuse means relocating shared code — touching admin screens for zero customer
benefit immediately before QA is a bad trade.

**Decision: extract it during Phase C, not before.** Phase C's tour drawer needs the same
mechanics, which makes it the first point where two genuinely new consumers prove what the shared
piece should look like — designed against real requirements rather than guessed from one example.
Also logged in the codebase-cleanup backlog so it survives if Phase C slips.

---

## Flow completeness checks

| Check | Handling |
|---|---|
| Happy path | Coach lands → sees their team, not a chore list → one line names the next action |
| Empty state | The snapshot tiles *are* the empty state and are now above the fold from minute one |
| Loading | Chip renders only after setup data resolves; no flash of a wrong count (preserves the existing `milestones !== null` guard) |
| Error | Setup fetch failure hides the chip silently; Overview never blocks on onboarding data (existing behaviour, preserved) |
| Recovery | Every dismissal is reversible: hints reopen from the chip, the tour reopens from ⓘ, skips undo per step |
| Confirmation | None needed — no destructive action in scope |
| Role/plan | Per the table above |

---

## Success criteria

1. A first-time coach sees their team's real data above the fold on first load.
2. Onboarding chrome on Overview occupies ≤ ~56px in its loudest state (from ~640px).
3. A coach can turn off all setup guidance in **one** interaction (from five).
4. Every portal section explains itself at its own empty state without the coach visiting Overview.
5. A coach who skips the tour is never offered it again on any team or any device.
6. No coach is shown a step, card, or chip for something their capabilities forbid.

---

## Out of scope

- Free-tier coach portal onboarding (separate family per the two-family ruling).
- Org-admin or platform-admin onboarding.
- Changing which steps count as setup, or how completion is detected.
- Reworking the phase-adaptive "Right now" anchor cards.
