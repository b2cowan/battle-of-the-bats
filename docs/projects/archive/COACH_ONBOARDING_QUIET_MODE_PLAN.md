# Coach Onboarding — Quiet Mode

**Status:** Active — **code COMPLETE, all three phases committed on `dev`, ✅ owner QA PASSED 2026-07-29.**
Remaining is release only: **⚠ migration 209 is DEV-ONLY — apply to prod BEFORE promoting** (see §B4/§C2),
then promote. Kept in `active/` rather than archived because nothing is on production yet.

> §B4's held-back set is now resolved: the other session's tournament-games work landed
> (`13e2c021`), and its follow-up commit (`0c744a81`) carried the chip removal, the Schedule
> teaching copy and all of Phase C in with it. Verified present in `HEAD`: `DISCOVERY_SECTIONS`
> gone, `.discover*` rules gone, Schedule payoff copy + "Add Event" capability gate landed, tour
> registers with the overlay signal.
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

### B2 — Build outcome (2026-07-29)

Both tranches shipped together after the audit showed every section could be done in one pass.

**The contract became structure, not convention.** `CoachEmptyState` gained two optional props —
`payoff` (what it unlocks elsewhere) and `blocker` (the honest prerequisite) — so a later copy
rewrite cannot quietly collapse a teaching empty back into a feature blurb. `description` keeps
its old meaning (what this is).

**Help destinations had to be written first.** Four of the twelve sections had no guide to link
to. New sections in `lib/help-content/coaches.tsx`: `premium-lineups`, `premium-development`,
`premium-insights`, `premium-staff`. The five lineup FAQs were **moved** out of
`recipe-attendance` — where "How does Auto-fill decide who plays where?" had been filed under
*Taking attendance* — into the new Lineups section, with the season-analytics one going to
Insights. Search is unaffected (keywords/`searchText` travel with the FAQ).

**A permanent Help control was added to the 9 headers that had none** — Lineups, Development,
Insights, Roster, Schedule, Money, Announcements, Documents, Staff. This is what lets the
no-action sections (Insights, Chat, and every "not turned on for you" state) satisfy the
"one quiet link into the guide" half of the contract without violating the addendum's rule that
the `quiet` variant carries no CTA.

**Capability defects found and fixed while gating the CTAs** — the same class Phase A's review paid
for, in five more places:

1. **Lineups → "Add a game"** was ungated. Creating an event is the `schedule` grant (the events
   POST 403s without it), and Lineups is visible on its own `lineups` grant — so an assistant with
   lineups but Schedule turned off was sent to a page they cannot act on.
2. **Schedule → "Add Event"** in the empty state, same grant, same shape.
3. **Announcements** told every coach to "add a guardian email on your Roster" when the recipient
   list was empty. Roster write is head-coach-only in V1, so an assistant granted
   `announcementsSend` was pointed at a read-only roster. Now the copy forks on `rosterWrite`
   (new `canEditRoster` prop, fails open).
4. **Tryouts had no client capability gate at all** — `canWrite` was hard-coded `true` and the
   page fetched unconditionally. The sidebar hides Tryouts without the grant, so this was the
   direct-URL case; it now shows a quiet teaching empty instead of write controls that 403.
5. **Documents' "Upload Template" button and its whole modal were dead** — there is no `POST`
   handler on `documents/templates`, so every coach who filled it in got "Upload failed"
   regardless of role. **Owner-approved removal 2026-07-29**; the page is now honestly
   download-only (org admins publish templates; signed copies attach per player on the roster).
   Restore the button the day the endpoint exists.

**Sport-neutrality.** Lineups copy takes its period word from the Sport Pack
(`periodLabel` → "inning by inning"). The plan's own mockup said "batting order"; there is no
Sport Pack field for that vocabulary, so real copy says "playing order and field positions".
"Batting order" survives only in help **keywords**, where a coach searching their own sport's word
should still find the page.

**Chips retired.** `DISCOVERY_SECTIONS`, the "Also in your portal" row, and the four
`.discover*` CSS rules are gone, plus the now-unused `isCoachNavItemVisible` import on Overview.
Removed only after every section carried its teaching copy, so no discovery window opened.

**Help-docs drift fixed as part of the same unit of work.** `faq-first-week-trail` still described
the five-step trail and the chip row that Phase A and Phase B respectively removed; it is now
"What is the Season setup chip in my Overview header?" and names the fact that every section
explains itself. `faq-setup-required-optional` lost its "the panel shrinks to a single line".

**Gate:** typecheck clean, focused lint 0 errors (16 pre-existing `set-state-in-effect` warnings),
472/472 tests, all token and date ratchets at zero. `check-schema-parity` fails on another
session's in-flight `game_change_notices` / `rep_team_events.source_tournament_game_id` dev-only
drift — no migration in this phase.

### B3 — `/simplify` + `/review` outcome (2026-07-29)

`/simplify` (4 lenses: reuse, simplification, efficiency, altitude) then `/review` (high-risk tier,
4 lenses: correctness, security/capability, regression/blast-radius, data/contract).

**`/simplify` — 5 fixed:**
1. **Named the "can COMPLETE the action" predicates.** `canManageSchedule` / `canManageTryouts`
   added to `lib/coach-capabilities.ts`; lineups, schedule and tryouts now call them instead of
   reading `caps.schedule` / `caps.tryouts` raw in four places. This is the open-vs-complete
   distinction Phase A's review paid for, expressed once instead of per page. `rosterWrite`
   deliberately gets NO wrapper (its name already says "write" — no ambiguity to resolve), and the
   module comment records that as a decision rather than an oversight.
2. **Redundant `label` dropped from 6 help requests** — `HelpButton` already falls back to its own
   `label` prop, so the string was typed twice per page. The 4 pages whose request object ALSO goes
   straight to `openHelp()` keep it (no button to fall back to) and now carry a comment saying so,
   so the next cleanup pass doesn't "fix" it into a generic "Help" drawer header.
3. **`.payoff` no longer hand-copies `.description`'s type scale** — they share one grouped rule
   (they are meant to read at identical weight); only margins differ. `.blocker` keeps its own rule
   since it genuinely differs on 3 of 4 properties. `composes` deliberately avoided — CSS-module
   composition has burned this repo before.
4. **Development's 3-level nested `blocker` ternary** → a named `sessionsBlocker()` with sequential
   guards, so the priority (no tests beats no write access) is readable.
5. **The design addendum §iii now documents the teaching contract** — the three ordered body slots
   and their type scales, that `quiet` + `blocker` is a correct pairing (prose, not a CTA, so it is
   not an exception to the no-CTA rule), and where the guide link goes in each tier. The addendum is
   what `/design` loads as canonical; the props existed without it knowing.

Efficiency lens found nothing: the ~110 lines of new guide content stay inside the dynamically
imported help-drawer chunk (verified against the repo's deliberate lazy-load split), and no empty
state added a fetch to decide its copy.

**`/review` — 1 High + 1 Medium confirmed and fixed, 0 refuted:**

- **[High] Roster header layout broke.** `.pageHeader > *:last-child:not(.pageHeaderLeft)` pins only
  the LAST child right. Adding `HelpButton` as a third sibling stole that pin, so the
  Attendance / Export / Add Player cluster dropped from the header's right edge to sitting beside the
  title — on the DEFAULT list view, i.e. every coach. Fixed by wrapping the toolbar and the Help
  button in one trailing group. **Roster was the only 3-child header**; the other 8 were verified to
  have exactly 2, and schedule already nested Help inside its toolbar.
- **[Medium] Sport-neutrality violation in new copy** — the staff empty state said "take attendance
  at the diamond". `CoachStaffPanel` has no Sport Pack context, so it now says "on game day".
- **[Advisory] Orphaned chat CSS** — `.emptyIcon`/`.emptyTitle`/`.emptyBody`/`.emptyLink` died with
  the hand-rolled chat empty state; removed. `.empty` stays (still centres error + loading).

Correctness and security lenses returned **no findings**. Two useful confirmations from them worth
recording: (a) the coaches layout seeds assignments server-side, so `loading` is already false on
first render — the fail-CLOSED CTA defaults cannot flash a wrong "no access" state; (b) every client
gate was checked against its route's `denyUnless` and they agree, and tryouts' hard-coded
`canWrite` on its child cards is now unreachable behind the new page-level gate.

**Two pre-existing defects fixed because this phase made them visible/contradictory:**
- The schedule toolbar's persistent **"Add Event" button was never capability-gated** — a button that
  could only ever 403. Left alone it would now sit directly above an empty state saying "adding
  events needs schedule access". Gated on the same grant.
- The tournaments page passed a **FAQ id in `sectionIds`**, which `getHelpSections` silently drops
  (it only walks top-level sections), so that drawer always opened one section short. The FAQ lives
  inside the `tournaments` section already listed, so the dead entry was simply removed.

**Gate after all fixes:** typecheck clean · focused lint 0 errors · 473/473 tests · all token and
date ratchets at zero · dev server clean-restarted and serving 200s.

### B4 — Commit split (concurrent-session hazard, 2026-07-29)

Phase B was committed **in two parts**, because three files carrying Phase B edits were also carrying
another session's in-flight tournament-game-mirroring / game-change-notice work in the same working
copy, and `AGENCY_RULES` forbids sweeping that into this commit:

- `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` — the chip removal (file also holds a foreign
  `isMirroredEvent` import + usages)
- `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` — the schedule teaching copy + the
  "Add Event" capability gate (file is ~64 lines of foreign tournament-game rendering)
- `app/[orgSlug]/coaches/coaches.module.css` — deletion of the `.discover*` chip rules (file holds
  foreign `.sourceNote` / `.movedNote` / `.dupeNotice` rules)
- `TODO.md` — heavily edited by other sessions this same day

**The held-back set is internally consistent**: the chips and their CSS stay together, so nothing is
half-removed. Everything else — the teaching empty states, the four new guides, the capability
predicates, the addendum — landed. The chips come out with the second commit, once those files can
be separated or their owner lands their work.

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

## Phase C build outcome (2026-07-29)

**Doc-drift note RESOLVED first, as instructed.** The dictionary marked migration 195
(`user_preferences`) "⚠ PROD-PENDING"; the live prod column snapshot carries all four of its
columns, so **the table has been on prod since the theming bundle shipped 2026-07-22** and project
memory was right. The dictionary entry is corrected. This mattered: writing `ALTER TABLE` against a
table that didn't exist on prod would have failed at release, not at authoring time.

### C2 — account-level preferences (migration 209)

Two columns added to the existing `user_preferences` table, per the plan's "join as columns, not new
tables" contract:

- `coach_tour_dismissed_at` (tstz, NULL = never decided). A **timestamp, not a bool**, so "skipped in
  week one" stays distinguishable from "skipped a year later" without a second column.
- `coach_setup_hints_off` (bool NN default false). No third "unset" meaning exists here, unlike
  `theme`'s nullable tri-state, so the read path needs no null-coalescing.

Both are identity-scoped — never forked per org or per team. Per-team **step skips stay device-local**:
they record a fact about a season, not a preference about a coach.

Read/write goes through `lib/user-preferences.ts` → `/api/coaches/onboarding-preferences`, which is
deliberately **not** under `/api/coaches/[orgSlug]/…`: neither preference is about a team, and a
coach with three teams must dismiss once. The read **fails toward showing guidance** on any error —
including a missing column, i.e. an environment where mig 209 hasn't been applied. That is the same
direction the Phase A review had to fix device-side, where a storage exception permanently
suppressed the tour for anyone in a locked-down browser.

**Migration status: applied to DEV only.** `check-prod-migration-drift` correctly reports both
columns as prod-pending. Apply to prod BEFORE promoting this code to master, or the write path 500s
there (the read path degrades to re-offering the tour, which is survivable but wrong).

### C0 — the shared primitive (scope: coach portal only, owner call 2026-07-29)

`useDismissable(open, ref, onDismiss)` — outside pointer-down + Escape, listeners only while open.
A **hook, not a wrapper component**: the two consumers render completely different chrome (an
anchored popover vs. a full-height side drawer) and share only the behaviour. A component would have
had to own their markup too, which is exactly what let the earlier copies diverge.

`useViewportFit(open, ref)` carries the capability the plan demanded and the hand-rolled version
lacked: it measures real available space and publishes `--panel-shift-x` / `--panel-max-h` for CSS
to apply, so a panel can no longer open with its footer — including the hints off-switch — below the
fold. The static CSS values remain as the pre-measurement fallback, so first paint is never wrong.

First consumers: the season-setup popover (converted) and the tour drawer. **The three copies in the
admin-tournament bundle and the export menu are deliberately NOT converted** — owner chose to keep
this pass inside the coach portal so an admin regression can't muddy the still-outstanding QA of
Phases A and B. The design rationale ("designed against two real requirements, not guessed from
one") is satisfied by the two coach-side consumers. Follow-up remains logged in the cleanup backlog.

#### C0 remainder — the three admin copies, CLOSED 2026-07-29

Executed once coach QA had passed, per the deliberate ordering above. Build prompt:
`ADMIN_DROPDOWN_CONSOLIDATION_PROMPT.md`. Nothing user-visible changed.

**The blocking pre-step was solved rather than worked around.** The hooks now live at
`lib/overlay-hooks.ts`. Done as an isolated rename-only step with the two coach-side imports updated
and typecheck green *before* any admin file was opened, so at no point did an admin file import from
`components/coaches/`. The absence of that neutral home is exactly what deferred this twice; it is no
longer a reason to defer anything.

The first attempt put it in `components/shared/`, which the build prompt named as one of two options.
`/simplify` overturned that with file-layout evidence (see the outcome section below): `lib/` is where
this repo's hook modules already live, `components/shared/` holds cross-shell things you *render*, and
`lib/coaches-overlay.tsx` — the "is any overlay open?" signal — is a near neighbour these hooks should
be discoverable beside. Corrected before commit.

**A second hook, not an extended `useViewportFit`.** `useAnchoredMenu(open, triggerRef, panelRef, opts)`
returns the `CSSProperties` the two menus were each computing privately. The distinction now
documented on both: `useViewportFit` *nudges* a panel CSS has already anchored; `useAnchoredMenu`
*places* one relative to a trigger that could be anywhere on a wide toolbar, and flips it above when
there's no room below. Those are different jobs and one hook doing both would have been worse.

**The two copies were 85 duplicated lines that differed in three ways, not two.** The prompt named
the minimum width (240 vs 220) and alignment. Diffing them surfaced a third: the floor applied once
the *viewport* is narrower than the panel's minimum (180 vs 160). Only reachable under ~205px, but it
is parameterised (`narrowMinWidth`) rather than silently normalised to one of the two — consolidating
two copies is not the pass in which to change what either one did.

The flip math is **transcribed, not rewritten**. Two known non-improvements are deliberate and
commented in place: placement state is not cleared on close (both originals kept it, so a reopen
paints at the last spot for one frame), and `scroll`/`resize` still re-place un-coalesced (unlike
`useViewportFit`, which `/simplify` rAF-coalesced). Both are real candidates — for a pass whose
premise isn't "nothing on screen moves".

Result: `-92` lines in `ExportMenu.tsx`, `-110` in `TournamentAdminUI.tsx`, zero hand-rolled
outside-click / Escape / positioning code left in either. Diff-audited for JSX, copy, and a11y
changes: none — `aria-haspopup` / `aria-expanded` / `role="menu"` / `role="dialog"` / `aria-label` /
`data-keep-label` / `data-align` all intact, and no CSS module was touched. Typecheck 0, focused lint
0 errors, 482 tests, every token and date baseline at zero, schema parity 0.

⚠ **The one thing owner QA has to cover: the above/below flip.** Open the tournament-admin ⋯ menu,
the status legend, and an Export dropdown with the trigger low in the window — each should open
*upward*. It is the single behaviour a careless consolidation drops and it is invisible from the top
of a page.

#### `/simplify` outcome on the C0 remainder (4 lenses, 2026-07-29)

Reuse, simplification, efficiency, altitude. **4 applied, 4 skipped with reasons, 1 spun out.**

**Applied — the one that mattered: the module was filed in the wrong drawer.** Reuse and altitude
reached this independently, both from file-layout evidence rather than taste. `components/shared/`
held three cross-shell **components** (JSX, default exports, always rendered); this would have been
the first headless hook module in it. `lib/` already holds ~24 hook modules including a `lib/hooks/`
subdirectory, `lib/use-visual-viewport-vars.ts` is the structural twin of `useViewportFit` (measure
geometry → publish CSS custom properties), and `lib/coaches-overlay.tsx` already owns the word
"overlay" for a multi-hook module. Moved to `lib/overlay-hooks.ts` with a cross-reference to that
neighbour, since "is any overlay open" and "how does this overlay behave" are easy to confuse.

Applied, all documentation: the `narrowMinWidth` doc stated two different thresholds as if they were
one (it named the `minWidth + 2·margin` breakpoint, 264/244, then illustrated it with the
`narrowMinWidth + 2·margin` figure, 204 — a reader doing the arithmetic would have found them
irreconcilable); the "hook not component" rationale predated the admin consumers and now records that
the convergence *was* re-checked and why it's still insufficient (the two menus diverge either side of
the shared panel — single vs. split trigger, generic slot vs. plan-gated items, delegation vs. explicit
close); and `minWidth` now warns that each panel's CSS module carries a second width for the same
concept, with the toolbar menu's (288) already disagreeing with its 240 — pre-existing, harmless
because CSS only governs the pre-measurement frame, but a trap for anyone treating the four hook
numbers as the source of truth.

**Skipped, with reasons.** Collapsing `minWidth`/`narrowMinWidth` into one knob via the `-60`
relationship both call sites happen to share — it isn't `2·margin` or anything else principled, so
that would bake a two-point coincidence in as policy. Merging `useDismissable` into `useAnchoredMenu`
— they always co-occur at these two call sites but the module's other consumers use dismiss with no
placement at all, so they are independent axes. Generalising the two fit hooks into one — the flip
replaces what `top` *means* and needs the trigger's rect, which `useViewportFit` never reads, so a
union would be a mode flag over two algorithms. And the un-coalesced scroll re-place, which efficiency
confirmed byte-for-byte identical to both originals: a preserved status quo, not a regression, and out
of bounds for a pass whose premise is that nothing moves.

**Efficiency verdict worth recording:** no regression. Layout reads are batched before the single
state write, the relocation changes no bundle behaviour (the coach page already imported this module
statically, so the lazy tour never isolated it), and per-open work is unchanged for all three panels.
The only new cost is one property write per render from `useDismissable`'s ref-sync — the price of the
stale-closure fix a previous pass made deliberately.

#### `/review` outcome on the C0 remainder (high-risk tier, 4 lenses, 2026-07-29)

Tier = **high-risk** (the diff adds a shared `lib/**` module consumed across two shells; highest tier
wins). Deterministic gate green first: `verify:changed` 0 errors, `typecheck` 0, focused lint 0 errors,
482 tests, all token/date ratchets zero, schema parity 0, no migration in scope.

Lenses: exact-transcription correctness · regression/blast-radius · concurrency/effect-lifecycle ·
visible-behaviour preservation. **Security/multi-tenant and data/contract lenses were deliberately not
run** — this diff touches no data, no auth, no org scoping and no migration, so they would have been
paid confirmation of an empty set.

**0 Critical · 0 High · 0 Medium · 1 Advisory · 4 pre-existing advisories. Nothing promoted to
adversarial verification** (nothing reached the ≥High-or-uncertain bar).

The transcription audit compared every expression against both originals token-for-token and
specifically confirmed the flip threshold was **not** wired to `narrowMinWidth` — that mistake would
have silently moved ToolbarMenu's flip point from 160 to 180 and is invisible to every test we have.
It wasn't. Blast-radius walked all ~25 `ExportMenu` consumers plus both usages of each admin menu,
confirmed the barrel's 13 exports intact, confirmed `useDismissable`/`useViewportFit` byte-identical so
the already-shipped coach portal is untouched, and confirmed the abandoned `components/shared/` path
left no orphan. Visible-behaviour confirmed from repo state (not from the diff) that neither CSS module
is modified and every a11y attribute is byte-identical.

**The one Advisory — worth recording because it makes "zero behavioural difference" imprecise by
exactly one expression.** The old `ToolbarMenu`/`StatusLegendPopover` wrote
`if (!rootRef.current?.contains(target))`, which **dismisses** when the ref is null; shared
`useDismissable` writes `if (ref.current && !ref.current.contains(target))`, which does **not**. Two
lenses independently failed to construct a reachable path: the root div renders unconditionally, so the
ref is only null before the listener exists or after its cleanup ran, and in the one theoretical window
(unmount mid-flush) the resulting `setOpen(false)` lands on an unmounting component and is discarded.
`ExportMenu` already used the new form, so it has no change at all. **Deliberately not "fixed"** — the
shared form is the safer of the two, and matching the old optional-chaining semantics would mean
choosing to dismiss on a null ref, which is worse.

**Pre-existing, verified against the originals, all left alone:** the stale-placement single-frame
flash when reopening after a resize-while-closed; the missing equality check before the placement state
write; the CSS-vs-JS width mismatch; and one genuine minor UX quirk — a **keyboard**-activated trigger
fires `click` with no preceding `mousedown`, so tabbing to a second menu and pressing Enter can leave
two menus open at once, after which one Escape closes both. All four are identical in the pre-change
code. The keyboard quirk is folded into the spun-out sweep below, which is the right altitude to fix
dismiss semantics repo-wide rather than in one panel.

**Bonus coverage found:** an existing Playwright UAT spec already drives `ToolbarMenu` end-to-end
(opens the Import menu, asserts its items, closes with Escape), so one of the three panels has
automated regression cover for the dismiss path. It needs a dev server, so it stays in the owner's
browser-testing lane.

**Spun out, NOT done here: 12 more hand-rolled dismiss copies.** Seven are mechanically convertible
(four menus in the tournament schedule page, the registrations filter, the schedule scope picker, and
`components/shared/FlipPill.tsx` — whose own comment admits it mirrors the admin More-menu pattern).
Five more are the same shape but **missing Escape-dismiss entirely**, so converting them would close a
real keyboard gap rather than just deduplicate: both bottom navs, the platform-admin customer-users
menu, the schedule timeline, and the accounting payee combobox. Four are not mechanical — the chat
emoji picker refocuses its trigger and checks two refs, the chat reaction popovers have no container
ref at all (they rely on ~10 scattered `stopPropagation` calls), the coach team switcher refocuses on
every close, and the notification bell is portaled to `<body>` so "outside" needs a `closest()` test.
Deliberately left alone: the approved scope was three named panels, and a 12-consumer sweep across
chat, both bottom navs and platform admin is a different QA surface that deserves its own approval.

### C1 — the offered tour

A **non-modal right-edge drawer**: no dimming backdrop, no focus trap, no `aria-modal`. The tour's
job is to describe the sidebar, so the sidebar has to stay visible and reachable behind it — a
centre modal would re-commit the exact interruption this project exists to remove. Focus moves into
the panel on open; Escape and outside-click dismiss.

Four cards keyed to the sidebar groups (Squad → Season → Money → Communication), each filtered
through the SAME `isCoachNavItemVisible` gate the sidebar uses, and the progress dots count the
**filtered** set — a coach without money access sees three dots, never a phantom fourth step. A
coach whose capabilities filter every card away gets no tour rather than an empty shell.

Card copy is the Phase B empty-state copy, per the plan's "written once, surfaced twice".

**What retires the offer — a correction made during the build.** The plan says skip is permanent.
Implemented as: **Skip** and **Done** record the decision; **opening** the tour does not (a coach who
opens it and hits Escape is still offered it); and **following a card's deep link does not either**.
Killing the tour when someone taps "Open Roster" on card 1 would mean they never learn cards 2–4
exist — going to look at the thing a card describes is engagement, not completion.

The setup popover footer now carries both doors permanently: the tour AND "Open the full guide",
so a coach who skipped the tour can still reach the written version.

### C3 — `/simplify` + `/review` outcome (2026-07-29)

`/simplify` (4 lenses) then `/review` (high-risk tier, 4 lenses: correctness, security/multi-tenant,
regression/blast-radius, migration-safety).

**`/simplify` — 6 fixed.** The one that mattered:

1. **The prefs are now SSR-seeded, not client-fetched.** They were read by the Overview page on
   mount — an extra round-trip on every visit AND an identical repeat on every team switch, for
   data that cannot differ by team. They now ride the coaches layout's existing parallel lookup
   (the same place assignments are seeded) and reach the page through the coaches context. Zero
   added latency, no loading flash, no per-team repeat.
2. PATCH returns **204** instead of re-SELECTing the row to echo a body its only caller never read.
3. `useViewportFit` no longer write-resets the DOM then re-reads it (a forced layout on every
   pass) — it backs the applied shift out arithmetically — and coalesces scroll/resize through
   `requestAnimationFrame`. The capture-phase scroll listener also sees scrolls *inside* the
   popover, which is exactly the interaction the height cap creates on a phone.
4. **`useDismissable`'s comment claimed a ref it didn't have.** It kept listeners stable by omitting
   a dependency instead, which means a consumer whose `onDismiss` reads current-render state would
   silently get a stale closure — while the docstring told them it was safe. Now genuinely
   ref-based, so the comment and the code agree and the next consumer isn't misled.
5. `useMemo` over a 4-item static array removed; file renamed `overlay-hooks.ts` since it holds two
   hooks, and `useViewportFit`'s doc no longer implies it has the two consumers `useDismissable`
   has (it has one — the tour drawer is fixed-height and needs no fit math).
6. **The C0 follow-up was under-scoped and is now documented as such.** The three remaining
   hand-rolled copies (two admin-tournament menus, the export menu) compute *trigger-relative
   fixed positioning with an above/below flip*. `useViewportFit` only nudges a CSS-anchored panel.
   Retiring them needs the hook extended or a second one — it is not a drop-in, and the hook's
   header now says so.

**`/review` — 2 High + 2 Medium + 1 Low confirmed, 0 refuted:**

- **[High] The tour never registered with the portal's shared overlay signal.** Every other coach
  sheet calls `useOverlayOpen`. Without it the fixed bottom nav (z-index 300) renders *on top of*
  the drawer (z-index 60) on a phone — covering Skip / Back / Next / Done, i.e. the coach's only
  way forward or out — and the page behind kept scrolling. Fixed by registering, which is what
  hides the nav and locks body scroll. Being non-modal about *focus* is deliberate; being
  non-modal about the nav bar was not.
- **[High] Release-ordering hazard, confirmed accurate rather than fixed.** With mig 209 unapplied
  on prod the READ path degrades safely (the layout still renders; the tour is just re-offered),
  but the WRITE path 500s and the client swallows it — a coach sees their choice "take" and is
  silently reverted on next load. This is why the migration must reach prod BEFORE the code.
- **[Medium] The migration's own header contained a false claim** — that `check:migrations` can't
  detect missing *columns*. It can: the drift script diffs `information_schema.columns` per table
  and fails on them. A future engineer trusting that comment would have skipped the one gate that
  does catch this. Corrected, with the read/write asymmetry above spelled out.
- **[Medium] The fail-open read logged with `console.error`, not `captureError`** — so it never
  reached the error store or the alert pipeline, exactly the blindness the comment claimed to be
  preventing. A real ongoing fault would have surfaced only as "everyone keeps getting offered the
  tour". Now captured as a warning.
- **[Low] The lazily-imported tour was rendered unconditionally**, so `next/dynamic` fetched the
  chunk for every coach anyway — silently defeating the optimization the comment described. Now
  render-gated, matching how the help drawer does it.
- **[Low] The migration had no rollback note.** Dropping either column erases every coach's
  dismissal choice. Stated in the file now.

Correctness and security/multi-tenant lenses returned **no findings**. Worth recording from them:
a partial upsert cannot null the sibling column, a first write still satisfies the NOT NULL default,
the SSR seed cannot leak between users (the org layout is already `force-dynamic` and the auth
context reads cookies), and the request body cannot smuggle extra columns into the write.

**Gate after all fixes:** typecheck clean · focused lint 0 errors · 482/482 tests · all token and
date ratchets at zero · dictionary coverage OK · dev server clean-restarted and serving the route.
`check:migrations` reads RED by design until mig 209 reaches prod — that is the guardrail working,
not a regression.

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
