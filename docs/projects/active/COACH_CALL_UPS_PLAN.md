# Call-ups — a player who is in the game but not on the team

**Status:** DRAWN 2026-09-22 · **RULED 2026-09-22** ("I agree with your recommendations" — R1–R6 all
as recommended) · **PHASE 1 BUILT ON DEV 2026-09-22** · **owner browser reads 2026-09-22 — 4 defects fixed (§12) + 2 design fixes (§13) + the pill-is-the-action ruling (§14) · **/simplify + /review DONE — 10 confirmed defects fixed (§16)** · walk owed · UNCOMMITTED
**Hub (the case · what the code does today · before/after · rulings · plan · QA walk):** `COACH_CALL_UPS_HUB.html` — https://claude.ai/artifact/KmaWXBMTLHjoetMAfxtXdR
**PM brief:** `COACH_CALL_UPS_PM_BRIEF.md`
**Migration:** 309 — applied to dev 2026-09-22, **PROD-OWED** (registered `pending` in `MANUAL_PROD_STEPS.json`; apply BEFORE the code promote). · **New routes:** 2. · **Year parameters:** none — `HISTORY_ENDPOINTS` is untouched.

---

## 0 · The ask, as it came in

> *"we need to have the ability to add 'call up' in our games to see them in lineups and such. we
> don't want them cluttering up our screens that have roster lists where it is not applicable (i.e.
> player dues, skills and goals, etc.) but also need them available for things like making rosters
> and what not. at a minimum they need to be available for lineup construction"*

A call-up (also *affiliate player*, *AP*, *pick-up*) is a player borrowed for a specific game because
the team is short. They are not on the roster: no dues, no evaluation, no development plan, no award,
no rollover, no place in the team's count.

## 1 · What the code does today — measured, not assumed

Everything below was read out of the working tree and the live dev schema snapshot on 2026-09-22.

**1.1 There is exactly one roster table, and everything hangs off it.**
`rep_roster_players` is the only player identity in the coach portal. **24 tables carry a foreign key
to it** — attendance, lineup entries, game moments, dues schedules and installments, payments,
payouts, credits, fundraiser entries and credit plans, awards, documents, measurables, notes,
observations, development goals and their reviews, evaluation exclusions, tryout baselines, continuity
links, refund adjustments, expenses, family links. Any model that puts a call-up somewhere else has to
answer all 24.

**1.2 Every roster read in the portal already filters for `status = 'active'`.**
`status === 'active'` appears **120 times** across the tree; the roster-scoped subset is ~59 and it
covers *every* consumer that matters here — lineups (GET and PUT), attendance (GET and PATCH), the
game console, game moments, awards, development board / continuity / sessions, dues, the budget plan's
installment generator, practice plans and their sends, lineup templates, tryout baselines and reports,
the season roster, the insights digest, the opponent card, the season recap, Season Wrapped, the
settlement, and the rollover.

**1.3 A handful of writes go further and REJECT a non-active id.**

- the lineup PUT builds an `activePlayerIds` set and refuses anything outside it;
- the attendance PATCH returns `400 "Attendance can only be saved for active roster players"`.

So today a non-active player cannot reach a lineup or an attendance sheet even by a crafted request.
That is the guard we will be deliberately opening a hole in, and it must be opened *narrowly*.

**1.4 `status` is a two-value column with a three-value type — the enum has been half-widened before.**

```
live dev constraint   rep_roster_players_status_check
                      status = ANY (ARRAY['active'::text, 'inactive'::text])
lib/types.ts:1044     export type RepRosterStatus = 'active' | 'inactive' | 'released'
```

`'released'` **cannot be written**. Nothing writes it; two surfaces read it —
`season-end/page.tsx:813` labels it *"Left during the season"*, and the admin program-year page lists
it as a known status. It is a dead branch, and it is the exact failure this plan must not repeat:
**a status value added to the type without the constraint migration is a value the product can render
and the database can never produce.** Cleaning it up rides with this work (§8.3).

**1.5 The sites that do the OPPOSITE test — these are the ones that fail open.**
Seven roster-scoped places branch on `status !== 'active'`, i.e. *"show me the ones who aren't on the
team"*. Under any model where a call-up is a non-active roster row, every one of these picks up
call-ups unless it is told not to:

| Where | What it does today | What a call-up would wrongly do |
|---|---|---|
| `roster/page.tsx:526` | `offRoster` list | appear under "off the roster" beside departed players |
| `roster/page.tsx:252` | reorder tail | be re-ordered as though departed |
| `roster/[playerId]/page.tsx:450` | not-active banner on a profile | wear a banner written for a departed player |
| `season-end/page.tsx:809,814` | archive roster shelf | appear in the closed season's roster, labelled *"Not active"* |
| `development/sessions/[sessionId]/route.ts:126` | departed players who have readings | — (a call-up never has readings; safe, but assert it) |
| `coach-season-settlement.ts:278,297` | `departed: p.status !== 'active'` | — (the loop is over dues rows; a call-up has none; safe **by accident**) |

**1.6 55 raw queries touch the table directly; only 10 carry a status filter.** The other 45 are
single-row reads by id, or writes. They are not a hazard on their own, but they are the audit surface
(§9.2).

**1.7 The lineup builder's shape, which is where this lands.**
`_LineupEditor` renders the unplaced roster as **"Not in the lineup · N"** with an *Add to lineup*
button per row. The same component serves the game builder and the template editor (*"Not in the
template"* / *Add to template*). That heading is the natural home for a **Call-ups** group.

## 2 · The load-bearing find: the season report would lie

This was not in the ask and it is the most expensive thing here.

`lib/team-season-analytics.ts:212` and `lib/lineup-season-analytics.ts` roll a season's **saved
lineups** into fair play, bench balance, position variety and arm care. The roll-up is driven by
lineup ENTRIES; the player list it prints against is filtered `status === 'active'`.

A call-up who plays one game and sits two innings, admitted naively, lands in the fair-play table
showing **1 game, 4 field innings, 2 bench innings** beside teammates showing 14 games. The report's
whole job is to catch a kid being short-changed. A coach acting on that row would be acting on a lie.

**The rule this sets, and it is the binding one in this plan:**

> **A call-up counts INSIDE a game and never ACROSS the season.** Per-game checks — everyone bats,
> position coverage, the pitching cap, *Mark ready* — must count them, because they are physically on
> the field occupying a slot. Every season-long figure — fair play, bench balance, position variety,
> season arm care, Season Wrapped, the insights digest, the player recap — must not.

Under the model in §3 this is free (those readers already filter active). It still gets an explicit
test, because "free today" is how `'released'` happened.

## 3 · Three models, and why one wins

### Model A — a call-up is a roster entry of a different KIND (`status = 'callup'`) ✅ RECOMMENDED

One new value on the existing column. A call-up is a `rep_roster_players` row that is not active.

- **All ~59 active-filters exclude them the day the migration lands.** Dues, skills & goals, awards,
  documents, tryouts, family emails, rollover, settlement, Wrapped, the season report — correct with
  no code touched.
- **It fails safe.** A surface we forget hides a call-up. A surface built next year hides one too.
- **All 24 foreign keys keep working.** A call-up can be in a lineup, on an attendance sheet, and
  tagged in a game note with no schema change anywhere but the one constraint.
- **Cost:** the seven fail-open sites in §1.5 need a deliberate answer; `status` starts carrying a
  *kind* as well as a *lifecycle*, so "this call-up is inactive" is not expressible. It does not need
  to be — you remove a call-up, you do not retire one.

### Model B — a flag on an otherwise-active player (`is_callup`, status stays `'active'`)

Semantically tidier and **wrong on the only axis that matters**. Every one of the ~59 active-filters
would *include* call-ups from the moment the column lands — in dues, in skills & goals, in awards, in
family emails, in the fair-play report, in next season's rollover — which is precisely the clutter the
ask is about. It **fails open**, and every screen built after it fails open too. Rejected.

*(Variant B2 — keep the flag but have the shared roster read exclude call-ups by default — recovers
the safe default, but only for the 10 raw queries that go through it; the other 45 bypass it, and the
59 status filters stop meaning what they say. It buys tidiness at the price of a second rule nobody
can see. Rejected.)*

### Model C — a separate call-up table

A call-up is not a roster player at all. Truly clean identity, and it breaks the one thing the ask is
about: **lineup entries, attendance, game moments, the grid, the generator, the analysis, the caps,
the printed card and the bench console all key on a single player id.** Model C means a nullable second
reference or a polymorphic id, and every one of those readers merging two lists. Large, invasive,
bug-prone, for a feature whose entire point is "appears in lineups". Rejected for v1; revisit only if
call-ups ever need their own money or development record, which they never should.

## 4 · The second decision: a call-up belongs to a GAME, not to the season

Model A alone leaves a call-up in the available list of **every** game for the rest of the season. Add
four across a season and every lineup builder carries four extra names forever — the clutter walks back
in through the door we just closed, and the coach has to remember which one is actually coming Saturday.

The owner's own words were *"add call up in our **games**"*. So:

- **The primary object is an appearance** — *Jamie is called up for Saturday's game.* A call-up is
  offered in a game's builder only if they are linked to that game.
- **The pool is a convenience** — the call-ups you have used before, so you do not retype Jamie every
  week. It is a list, not a roster.
- **The appearance count comes free**, and several leagues cap how many games an affiliate may play,
  so it is worth surfacing.

### 4.1 The default, stated plainly (owner, 2026-09-22 — this is the shape)

> *"if we have 3 call ups in our system, default the lineup builder does not show me any but shows me
> the add call up button, I can add an existing call up or create a new one"*

**Confirmed, and it is binding.** Calling someone up is an explicit act **per game**, every time:

1. A new game's builder shows **no call-ups at all**, however many are saved. *Not in the lineup*
   counts rostered players only, and reads `· 0` when they are all placed.
2. The only call-up affordance at rest is the **Call up a player** button.
3. Tapping it opens a sheet with **everyone called up this season**, each with their games-played
   count, plus **Someone new**. One tap re-uses a name; nothing is retyped.
4. Someone already called up to this game shows with a **tick instead of an Add** — not hidden, which
   would read as a lost name.
5. **An empty pool skips the list entirely** — the first-ever call-up goes straight to the new-call-up
   form rather than an empty list with a button under it.
6. A **Call-ups** group appears under *Not in the lineup* only for call-ups linked to **this** game who
   are not yet placed — normally transient, since you call someone up in order to use them.

⚠ **The first draft of the hub's Proposed frame drew this wrong** — it showed a standing
`Call-ups · 1` list in the builder, i.e. the season-pool behaviour this section rejects. Corrected on
the hub 2026-09-22. The rule to hold: **the saved list lives behind the button and in the roster
page's Call-ups section, and nowhere else.** A builder that lists the pool is the failure mode this
whole section exists to prevent.

### 4.2 The pool does not cross seasons

A call-up is a roster entry inside one season, so next season's pool starts empty and the rollover
carries none of them (§5). That is deliberate: a name borrowed in 2026 is not evidence about 2027, and
carrying stale names forward re-creates the clutter at the top of every new season. Coaches who borrow
the same player year after year are served by **Phase 3** (pick from the club's other team), not by a
pool that never empties.

This is one small join table (§8.2) and it is what makes the feature feel right rather than merely
present. A cheaper v1 without it is possible (§7, Phase 1 fallback) and is not recommended.

## 5 · The map — every surface, in or out

**A call-up APPEARS in:**

| Surface | Shape |
|---|---|
| Lineup builder, for a game they are called up to | own **Call-ups** group under *Not in the lineup*, marked |
| Batting order, field grid, per-inning list | an ordinary row, wearing a call-up mark |
| The per-game lineup check + *Mark ready* | counted — everyone bats, coverage, clashes |
| Per-game pitching cap / arm care | counted (§6, R2) |
| Printed lineup card · game sheet · poster · PDF | listed, marked |
| The bench console (on the field / bench / swap) | an ordinary row, marked |
| Game notes / moments | taggable — they made the play |
| That game's attendance | present; no other event's |
| The roster page's own quiet **Call-ups** section | name, number, games played, remove |

**A call-up NEVER appears in:**

Player dues · the budget plan and its installment generator · fundraiser credit · payouts, refunds and
the season settlement · skills & goals · development sessions, observations, evaluations, continuity ·
awards · documents · measurables · tryouts and baselines · family emails, practice-plan sends and the
family portal · the roster count and any "your team has N players" figure · **every season-long
playing-time figure** · the insights digest · the player season recap · Season Wrapped · the closed
season's roster shelf · next season's rollover.

**The one deliberate exception:** a **saved lineup card from a game they played keeps their name**,
including in the closed-season archive. An archive that quietly drops a player who was on the field
rewrites the season, which is the one thing it must never do (the standing rule behind
`season-end/page.tsx`'s "Left during the season" branch).

## 6 · Rulings needed — owner, before anything is built

| # | Question | Options | Recommended |
|---|---|---|---|
| **R1** | **The word.** One spelling, everywhere, gated by `check:spelling`. | **A** *Call-up* · **B** *Affiliate* / *AP* · **C** *Pick-up* · **D** *Guest* | **A — "Call-up"**, capital C, hyphenated, sport-neutral. *Affiliate* reads as hockey/baseball governance; *AP* is jargon; *guest* understates it. Plural *Call-ups*. Verb in copy: *"Call up a player"*. |
| **R2** | **Arm care for a call-up who pitches.** | **A** per-game cap warning yes, season arm-care row no · **B** both · **C** neither | **A.** You are responsible for their arm *that day*, so the per-game cap must warn. Their innings are not your season's arm-care record. |
| **R3** | **Season-level or per-game?** (§4) | **A** per-game appearance + a saved pool · **B** season pool only, shown in every game | **A.** B re-creates the clutter the ask is about. |
| **R4** | **Attendance.** | **A** a call-up appears on that game's attendance sheet only · **B** call-ups are never on an attendance sheet | **A.** A call-up who no-shows is the same problem as a player who no-shows, and it is one game's list. |
| **R5** | **Who may add one?** | **A** anyone with lineups access · **B** head coach and standalone only · **C** anyone with roster-write | **A.** It is a lineup decision made at a field, often by an assistant running the game. It creates no money and no record. |
| **R6** | **Guardian contact on a call-up.** | **A** optional phone only, never emailed · **B** full guardian block · **C** none | **A.** You may need to reach someone at the field. They must never enter a family audience — that is a v1 hard rule regardless. |

## 7 · The build

### Phase 1 — the floor (the ask, in full)

1. Migration 309 (§8): widen the status constraint, add the appearances table, retire `'released'`.
2. The roster read learns call-ups; `RepRosterStatus` gains `'callup'`.
3. Two routes: the call-up pool (list / create / remove) and a game's call-up links (add / remove).
4. Lineup builder, to the §4.1 shape: **no call-ups on offer at rest**, a *Call up a player* button,
   a sheet carrying the season's pool (with games-played counts, a tick on anyone already in this
   game, and **Someone new**), a **Call-ups** group under *Not in the lineup* only for call-ups linked
   to this game and not yet placed, and the call-up mark on every row that is one.
5. Lineup GET/PUT: admit exactly the call-ups linked to **this** event — not the pool, not all
   non-active rows. The PUT's id set becomes `active ∪ calledUpToThisEvent`.
6. Printed card / PDF / poster: call-ups listed and marked.
7. The seven fail-open sites in §1.5 each get their answer.

### Phase 2 — game day

Bench console, game notes, that game's attendance, and the appearance counter on the pool.

### Phase 3 — the club

When the club runs both teams here, pick a call-up from the other team's roster instead of retyping
them, via the existing person/continuity layer, so a real kid does not become a duplicate record.

**Phase 1 fallback if R3 goes to B:** skip the appearances table; call-ups are season-scoped and the
builder shows the whole pool under its own heading, collapsed. Cheaper, and it degrades as the season
goes on. Not recommended.

## 8 · Data

**8.1** Widen the constraint to `('active','inactive','callup')` — **and only in a migration**, which
is the lesson of `'released'` (§1.4).

**8.2** `rep_team_call_up_appearances` — `(event_id, player_id)` unique, both `ON DELETE CASCADE`,
with `team_id` / `program_year_id` / `org_id` carried the way every other coach table carries them, plus
RLS matching `rep_team_lineup_entries`.

**8.3** Retire `'released'`: remove it from `RepRosterStatus`, and keep the archive's *"Left during the
season"* wording only if a real released state is ever built. Two readers change.

**8.4** Data dictionary + both snapshots refresh in the same unit of work; `check:dictionary` gates it.

## 9 · Gates

**9.1 New unit guards.**

- a call-up is absent from: dues, the installment generator, development/skills, awards, documents,
  tryouts, family audiences, rollover, settlement, Wrapped, the insights digest, the player recap, and
  the closed-season roster shelf — **one assertion per surface, by name**, because §2's rule being
  free today is not the same as it being held tomorrow;
- a call-up is **absent from every season-long playing-time figure** and **present in the per-game
  check** — the §2 rule, asserted from both sides;
- the lineup PUT admits a call-up linked to *this* event and rejects one linked to another event;
- `RepRosterStatus` and the live check constraint agree — the guard that would have caught `'released'`.

**9.2** Audit the 45 raw roster queries without a status filter; each is by-id, a write, or gets one.

**9.3** `check:spelling` gains the R1 word once ruled. Help content updated in the same unit of work
(`/docs`), including the `keywords` arrays.

**9.4** Layout sweep on the builder and the roster page; `npm test`; `verify:changed`; `typecheck`.

## 10 · QA walk

Owner QA Ledger § to be assigned. The walk is on the hub's **QA walk** tab — the pool, the per-game
add, the builder's group, the printed card, and then the negative half, which is the point: open dues,
skills & goals, awards, the season report and the roster count and confirm the call-up is **not there**.

---

## 11 · What was built (2026-09-22) — and the four things it turned up

Migration **309** applied to dev 2026-09-22. **PROD-OWED, registered in `MANUAL_PROD_STEPS.json` as
`pending`** — it is flagged there for its RLS policies, which `check:migrations` cannot see. Apply
to prod **before** the code promote: every part is additive and nothing reads it until the code
ships, but the code reads it the moment it lands (the migration-040 lesson). No ordering constraint
against 306/307/308.

### 11.1 The shape, as built

- **The builder offers nothing at rest.** One *Call up a player* button; *Not in the lineup* counts
  rostered players only. The sheet behind it carries the season's pool with each name's games-played
  count, a tick (not a hiding) for anyone already on this game, and **Someone new**. An empty pool
  goes straight to the form.
- **Calling someone up also puts them in the order**, because that is why you did it. Taking them
  back out of the order keeps them on the game; a second control takes them off the game entirely.
- **The mark travels with the row** — desktop batting order, the phone's inning list, the bench
  console (field *and* bench), and the printed sheet. One predicate (`isCallUp`) and one label
  (`CALL_UP_LABEL`).
- **The roster page grew a collapsed Call-ups shelf** below the roster and below the departed, with
  the games count and a Remove that is offered only before a call-up's first game (§11.3).
- **Amber, never the portal's olive**, on every surface — olive means *your team* everywhere else,
  so a borrowed player wearing it would read as one of your own at a glance.

### 11.2 Four defects found while building, none of them in the ask

| # | What | Where it would have shown |
|---|---|---|
| **B1** | **The bench console silently deleted call-ups from a saved lineup.** It filters saved entries down to the players in its payload (on purpose — a mid-season deactivation must not poison its full-replace PUT with a 400), and call-ups were not in that payload. So the console dropped them on load and the next substitution wrote the lineup back without them. | Mid-game, no error, a real player gone from the card |
| **B2** | **Player dues would have listed every call-up at $0.** That route deliberately reads the WHOLE roster — a departed player can still owe money — so it inherited none of the free exclusion. Found by the new guard, not by reading. **This is the exact screen the owner named first.** | The first screen the ask mentions |
| **B3** | **A saved lineup's call-ups resolved to `undefined` on load** — the builder's lookup was built from the active roster alone, so re-opening a game saved with a call-up in it dropped them, leaving a hole in the batting order. | Every re-open of a game with a call-up |
| **B4** | **The player profile would have offered to move a borrowed player onto the roster.** That page carries the *Take them off the roster* control, which flips `status`. Its route now 404s on a call-up, and the roster PATCH refuses `'callup'` outright. | One tap from a screen that has no idea what a call-up is |

### 11.3 Two rulings the build itself forced

**Removal is offered only before a call-up's first game.** Almost every table referencing a roster
row cascades, `rep_team_lineup_entries` included, so deleting a call-up who has played would take
their lineup row with it — a card printed last month would stop matching the card printed today.
Removal therefore answers only the case it is actually for (a typo, someone added and never used),
both of which have no games. A coach who wants a name gone afterwards takes them off each game
first, which returns the count to zero through the ordinary door. The route refuses with a 409 that
says so.

**The pool does not cross seasons** (§4.2) — unchanged from the plan, now enforced by the rollover's
own active-only filter and asserted.

### 11.4 The word is gated by a CONSTANT, not by `check:spelling`

R1 settled **Call-up**, and it was added to the shared spelling gate on the day — then removed again
with evidence. That gate matches whole words **case-insensitively**, and the identifier forms
(`callUps`, `isCallUp`, `CallUpSheet`) plus the stored value `'callup'` produced **41 hits with no
customer prose among them**. Gating it would have meant ~41 `spelling-ok` waivers on correct code,
which trains people to spray the escape hatch.

The rule moved somewhere stronger: the word has **one definition** (`CALL_UP_LABEL`), and
`coach-call-ups-guard.test.ts` runs a **case-sensitive** variant scan over every surface that prints
it — case-sensitively `Callup ≠ CallUp` and `callups ≠ callUps`, so the collision that defeats the
shared gate does not exist. The reasoning is written into `check-spelling-consistency.mjs` so the
next word of this shape gets the same treatment rather than repeating the experiment.

### 11.5 Green

`npm test` **4,558 pass / 0 fail** · `typecheck` clean · `check:css-selectors` · `check:spelling` ·
`check:dictionary` · `check:index-coverage` · `check:snapshots` · `check:manual-migrations` ·
`check:demos` · `check:export-catalog` · `check:observability` · `check:org-context` · `check:css-purity` · `check:contrast` · `check:text-contrast` · `check:tokens`.

**`check:parity` fails, correctly and expectedly**: dev has migration 309 and prod does not. Not
re-baselined — re-baselining would hide a genuinely pending migration, which is the failure that
gate exists to prevent. It clears when 309 reaches prod.

**The layout sweep RAN** (the other session handed the server over; restarted first, as new files
plus shared modules require). **Every surface this work touches is clean at 361 / 390 / 768 / 1440**:
`coach-roster`, `coach-lineup-builder`, `-new`, `-setup`, `-inning`, `-position`, the new
`-callup`, and `coach-game-console`. Memory low-water 6,636 MB against a 1,536 floor — no abort.

**It found one defect in this work, and that is the point of running it.** The call-up form's four
inputs rendered at **35px** against the 44px floor at 361, 390 and 768 — the shared `.input` recipe
carries no minimum height, so the drawer's buttons had a floor from the first draft and its fields
did not. Fixed. This is a form a coach fills in at a field, one-handed, an hour before first pitch.

**A new sweep screen: `coach-lineup-builder-callup`.** The drawer is a layout the resting page never
shows, so nothing else in the list could see it — the same reason Setup and the position sheet have
their own entries. Without it the 35px fields would have shipped.

**⚠ SIX FINDINGS ON A SCREEN THIS WORK DID NOT TOUCH, left unrecorded on purpose.**
`coach-finished-roster-shelf` — the closed-season page with the roster shelf open — has **never been
in the baseline**, so touching that page pulled it into scope for the first time and every
pre-existing defect on it reads as new. They are page chrome, none of it added or changed here: a
**29px _Share your season_ button** at 361/390/768, a 34px _Help_ button at 768, and the team
switcher spilling 76px at 1440. Two of the six are **already accepted on the sibling screen**
`coach-season-end`, which is the proof they predate this work.

They were **not** `--init`-ed away. Recording them would mark real tap-floor defects as accepted
decisions, and a baseline written to make a sweep green records the product as cleaner than it is —
the documented failure mode. They are the owner's call: the share button in particular is a genuine
phone-width defect and a small fix, but it belongs to the closed-season page rather than to
call-ups. `verify:changed` does not run the sweep, so nothing is blocked.

### 11.6 New guards

- `tests/unit/coach-call-ups-guard.test.ts` — the exclusions **by name, one per surface**; the F1
  rule from both sides; the narrow write hole; the R5 gate; games-only; the profile 404; the mark on
  every surface; the builder's ignorance of the pool; the R6 no-email rule at both the route and the
  database; and the case-sensitive one-spelling scan.
- `tests/unit/roster-status-constraint-guard.test.ts` — **the guard that would have caught
  `'released'`**: the `RepRosterStatus` union and the live check constraint must describe the same
  set, asserted in both directions.
- `tests/unit/roster-delete-guard.test.ts` — the new table acknowledged as a deliberate
  non-guarded cascade, with the reasoning.
- `tests/unit/coach-lineup-phone-guard.test.ts` — the builder's drawer count 3 → 4 (the call-up
  sheet reuses the same recipe rather than bringing its own shell).

---

## 12 · Owner's first browser read, 2026-09-22 — four defects, all fixed

Three reported, one found while fixing them. **Every one was invisible to the whole gate stack** —
suite, typecheck, CSS gates and the layout sweep were all green through all four.

### 12.1 The drawer never appeared on a phone (the page just dimmed)

> *"hitting 'add callup' just dims the page and I don't see any add modal or drawer"*

`.lineupCallUpMenu` — the desktop anchoring override — sat **~900 lines LATER** in
`coaches.module.css` than the `@media (max-width: 900px)` block that turns `.lineupAutoMenu` into
the phone drawer, at **identical specificity (0,1,0)**. So at phone width *it* won, replacing the
drawer's `bottom: var(--coach-foot-clear)` with `bottom: calc(100% + 6px)`. On a `position: fixed`
element that percentage resolves against the **viewport**, so the sheet was parked a full
screen-height above the top of the screen. The scrim is a separate element, so the page dimmed
correctly and the drawer was simply not where anyone could see it.

⚠⚠ **The comment written above that rule asserted the opposite cascade order** — "the ≤900 block
wins over these (later in the file)" — and it was never checked. The repo already carries this exact
lesson (*same-specificity module rules resolve by bundle order*). **Fixed by scoping the override in
`@media (min-width: 901px)`**, so it cannot reach the drawer at any width, rather than by relying on
where it happens to sit in the file.

### 12.2 The submit button said "Adding…" for a second, before anything was typed

> *"why does the button say 'adding' for the first second or so before changing to 'call up'?"*

One `busy` flag covered both *fetching the saved list on open* and *the coach's own add*. **Split
into `loading` and `saving`.** While the list is on its way the sheet now shows *"Loading your
call-ups…"* and renders neither half — a control must never describe an action nobody has started.

### 12.3 The button spanned the whole screen on a desktop

> *"on desktop do we intend that call up player button to be so big across the screen?"*

No. Full width is a phone shape; stretched across a 1440 panel it was the loudest thing on the page,
louder than Auto-fill, for an action taken a handful of times a season. **Now sized to its words on
desktop** (measured: 131px at 1440), full width at ≤900 where it is a drawer trigger.

⚠ `display: inline-flex`, not `width: auto` — the base rule is `display: flex`, which is
block-level, so `width: auto` alone would have left it full width and the fix would have looked like
it did nothing.

### 12.4 Found while fixing: the sheet opened on the blank form even with saved call-ups

`useState(pool.length === 0)` was seeded from the **empty array the sheet mounts with**, because the
pool arrives a moment later and `useState` keeps only its first argument. So a team with three saved
call-ups still opened straight to a blank form — **the entire point of the sheet was unreachable**,
and it would have read as "the saved list doesn't work". Now a third state (`null` = nobody has
chosen yet, let the pool decide), resolved only once loading finishes.

### 12.5 What this says about the gates

**The layout sweep passed through all of it, including the invisible drawer** — it measured the
sheet's controls happily because they were attached with real box sizes; they were just painted
off-screen. Re-running it could never have caught this, and re-reading the CSS is how the bug was
written.

So the fix is verified by **measuring the rendered rectangle against the viewport**:
`.probe/callup-drawer-position.mjs` (gitignored). Result at all four widths:

```
361   sheet y=569  139px on screen        trigger 305px  full-width
390   sheet y=633  139px on screen        trigger 334px  full-width
768   sheet y=813  139px on screen        trigger 712px  full-width
1440  sheet y=545 x=264 w=360             trigger 131px  sized to its words
```

⚠ The probe itself needed two corrections worth keeping: it waited on the `h1` rather than on the
trigger (the lineup loads after the shell paints), and it opened **a context per width** — the third
replay of the stored session came back 401, the editor never rendered, and it reported "button not
found" as though the feature were missing. One context, resized, and it is stable.

**Still green after the fixes:** `npm test` 4,558 · typecheck · CSS purity, selectors, contrast,
text-contrast, spelling · layout sweep clean on the builder, its Setup panel and the call-up drawer
at all four widths.

---

## 13 · Owner's second browser read, 2026-09-22 — two design defects, both fixed

Both are cases where a decision that read well in the source was wrong on a real screen.

### 13.1 The call-up mark was starving the name on the phone

> *"the call up label is taking over the name cell"*

The mark shipped **beside** the name with the name truncating, on the reasoning that a shortened
name is recoverable (tap the row) and a missing "borrowed player" mark is not. That trade was real
but it was resolved the wrong way, and only a phone showed it: the batting-order row's other columns
are fixed — 44px handle, 38px previous inning, 64px position pill, 38px next — leaving roughly
**134px** for name + mark at 390. A ~60px chip cut **"#56 bob test" down to "#56…"**.

**A name nobody can read identifies nobody**, so the mark had won an argument it should not have
been in. It now sits **on its own line under the name**, unboxed, in the sub-line the portal already
uses for a row's secondary fact — both are whole, and the row keeps its height.

⚠ The opposite trade is still correct in the *unplaced* list further down the page, where the row is
short and has room to spare: there the whole chip is tinted amber instead, which says "borrowed"
without spending any of the name's width. Same rule, two shapes, because the constraint differs.

### 13.2 Two mostly-empty panels stacked under the grid

> *"I don't like the way these are aligned under the main lineup table, lots of empty space"*

Two separate problems, one appearance:

- **Call-ups shipped in a dashed panel of their own**, below the existing *Not in the lineup* panel.
  Two frames, each mostly empty, made the foot of the builder look like an afterthought. They answer
  the same question — *who can I still put in?* — so they are now **one panel** with a heading and
  count per group. The panel renders whenever the game builder is mounted, because the *Call up a
  player* button must be reachable even when every rostered player is already in the lineup; the
  template editor passes no call-ups, so there it still appears only when somebody is out.
- **The list was a column of full-width rows** with the name hard left and *Add to lineup* hard
  right. With one unplaced player that drew a **~1,100px rule of nothing** across a desktop, and the
  taller the panel got the emptier it looked. It is now a **wrapping row of chips**: names are
  short, so they sit together and wrap onto a second line only when there are many. Measured, the
  name→button gap went from most of the panel's width to **6px**. On a phone a single chip still
  fills the width, so the phone reads as it did.

⚠ That list is shared with the **template editor**, which had the same gap and gets the same fix —
swept at all four widths alongside the builder, no new findings.

### 13.3 Measured, not argued

`.probe/callup-row-and-panel.mjs` (gitignored), after the change:

```
phone 390     panels under the grid 1 (want 1)
              names clipped in the batting order: 0     ← was "#56 bob test" → "#56…"
              call-up marks still rendered: 1
              widest name→button gap in a chip: 6px
desktop 1440  panels under the grid 1 (want 1)
              widest name→button gap in a chip: 6px
```

**Green:** `npm test` 4,558 · typecheck · CSS purity, selectors, contrast, text-contrast, tokens ·
layout sweep clean at 361/390/768/1440 across the builder, its four panel states, the call-up drawer,
the template editor and the bench console.

---

## 14 · The pill is the action (owner ruling, 2026-09-22)

> *"on mobile can we extend these players the width of the screen? or would it make them like this
> budget item group where we have an 'out of lineup' group and '+ Player' pills? thoughts?"*

**Ruled: the pill group.** The unplaced list is now `+ #11 Kai Test` — one control per player, no
separate *Add to lineup* button.

### 14.1 Why, and why not full width

The ragged right edge was the symptom. The actual problem was that **the per-entry button repeated
on every row and said the same thing every time**, directly under a heading that had already said
these players are not in the lineup — where adding them is the only thing the list can do. The
button was the furniture; the name was the content. Folding them together roughly halves each entry
and fits two or three names on a phone line.

Full width would have tidied the edge and kept both problems: the redundant button, and **a whole
line per player** — worst exactly when the list is longest, which is when a coach is short-handed
and scanning it under pressure.

### 14.2 The one asymmetry, and how it is handled

A call-up pill carries a second action — *take them off this game* — which is the money hub's pill
shape (`+ Registration revenue ×`) that the ruling was taken from. But **our × is heavier than the
budget's**: it removes them from the GAME and clears the lineup row they hold, not merely their
place in the order. So it is not a glyph floating at the chip's edge — it has its own hairline
division and a full 44px target at ≤900, so a thumb reaching for the name cannot catch it.

It stays on the pill rather than moving into the call-up sheet, because that is where a coach looks
for it and the alternative is an extra trip while standing at a field.

### 14.3 Not extracted into a shared component, deliberately

The money hub's pills are built inline in their own panel, not as a component. Two call sites with
genuinely different actions do not earn a shared one, and the budget group would have to be
refactored into it for the extraction to be worth anything. This uses the coaches kit's chip idiom;
if a third surface wants the shape, that is when it earns a component.

⚠ `.lineupAddBackBtn` was **deleted** with the button it styled — verified to have no remaining
`.tsx` callers first, which is the check this repo's own trap note asks for (a deleted rule with a
live caller throws nothing and silently renders unstyled).

### 14.4 Shared with the template editor

Same list, same fix. Swept alongside the builder at all four widths, no new findings.

### 14.5 Measured

`.probe/callup-row-and-panel.mjs`:

```
phone 390     1 panel · 0 clipped names · widest pill 138px = 35% of the line · shortest 44px tall
desktop 1440  1 panel · widest pill 138px = 10% of the line
              pills: "+#11 Kai Test | +#12 Logan Test"
```

⚠ The probe needed a fix of its own first: `[class*="lineupAddPill"]` also matched the **"+" span**
(`lineupAddPillPlus`), and its 15px height was reported as the shortest pill — a tap-floor failure
that did not exist. A substring selector over CSS-module class names will collect a child whose
class is a prefix of its parent's. Narrowed to `button[class*=...]`.

**Green:** `npm test` 4,558 · typecheck · CSS purity, selectors, contrast, text-contrast, tokens ·
layout sweep clean at 361/390/768/1440 across the builder, its four panel states, the call-up
drawer, the template editor and the bench console.

### 14.6 White, like the money hub's — the same token, not a matched colour

> *"can we make them white like our other ones?"*

The pills shipped on `--white-05` / `--white-10`, the portal's translucent **overlay** tokens. Over
this panel's own tint those came through **beige**, so pills modelled on the money hub's item chips
did not look like them.

Fixed by taking the two tokens that chip actually uses — `--home-card` and `--home-line` — rather
than picking a colour that matched today. Measured after the change: `rgb(255, 255, 255)`, true
white, and it will follow the warm palette the next time it moves.

⚠ **A call-up pill is now marked by its EDGE and its INK, not by a tinted fill.** Filling it amber
made it a different kind of object on the shelf; it is the same kind of object, about a borrowed
player. Same white card, amber border, amber name. Hover recolours the ink rather than washing the
fill — which is the money hub's behaviour too, and a translucent wash over a white card is exactly
what made these read beige to begin with.

⚠ The colour probe had to move into `.probe/` to run at all: a script in the session scratchpad
cannot resolve `node_modules`, so `import { chromium } from 'playwright'` fails there. The repo's
own note says the same thing — probes live in `.probe/`, which is gitignored.

---

## 15 · Owner's third browser read, 2026-09-22 — three subtractions

All three take something away. Nothing was added.

### 15.1 The phone's interaction hint is gone

> *"we don't need this message"* — "Hold a number to move a player · ‹ › for the innings"

Both halves had become self-evident on that screen: the stepper directly above the list is a
labelled *Inning 1 of 6* with two arrows, and every row's number carries a visible grip. It spent a
line of the phone's most contested space narrating controls that already read.

⚠ **The DESKTOP hint stays**, and its test still pins it. It says something the phone's did not —
that the grid scrolls sideways — which is the one thing about that surface a coach cannot see.

### 15.2 The notes moved up, under the order

> *"can you put the notes below the roster and above the add/callup players? that is what prints
> with the lineup so it would be good to see them together, kind of as they would print"*

The notes sat below everything on screen while printing **immediately under the grid**, so the
screen and the paper disagreed about what belonged with what. They now sit between the order and
the availability panel — the shape they print in.

⚠ Done as a **slot**, not as state the editor owns: the notes are the page's (they ride the same
save as the lineup, and the template editor has none), so the editor decides only *where* they sit.
Measured at 390 — batting list 543, notes 1210, availability panel 1304.

### 15.3 The position legend is off the printout

> *"let's remove this description from the bottom of the printout"*

`P Pitcher  C Catcher  1B First base …` plus `Blank = fill in at the field`, across the foot of
every poster, for an audience that has never needed it: the people who read this sheet are a coach
and a scorekeeper at a diamond, using exactly those codes out loud. **Its ~8mm goes to the grid**,
which is what a clipboard sheet is for — taller rows to write in (the page's bottom reserve drops
from 18mm to 10, the branding strip's share).

⚠ **`opts.legend` stays in the poster's options and is still supplied.** The same shape is built by
`abbreviateHeadings` for the roster and tryout exports, where a legend IS earned because the codes
there are column headings a parent may never have seen. Do not "tidy up" the unused field.

### 15.4 Three tests flipped rather than deleted

Each of the three removals had a test asserting the thing that went. All three were **turned into
assertions of the absence** and kept, because the reasons they existed did not go away:

- the phone hint's test now pins that it is gone **and** that the desktop's survives;
- the poster's legend test still guards the original defect it was written for — a legend naming a
  drawn box the poster does not draw — and now also refuses the legend's return;
- the portrait/landscape parity test loses one entry from its must-print list and keeps the rest,
  which are the things a sheet is useless without.

**Green:** `npm test` 4,558 · typecheck · `check:pdf` (23 documents → 112 files, 210 pages read
back) · layout sweep clean at all four widths across the builder, its panel states, the call-up
drawer and the template editor.

---

## 16 · `/simplify` then `/review`, 2026-09-22 — what they found

Both ran scoped to this work on a shared working copy. `/simplify` first, so correctness review ran
on the cleaned-up version.

### 16.1 `/simplify` — the deep fix it forced

Four lenses (reuse · simplification · efficiency · altitude). The altitude lens found the one that
mattered: **`lib/rep-season-wrapped.ts` and `lib/insights-digest.ts` read the roster UNFILTERED**, so
a call-up would have inflated Season Wrapped's roster count and entered the season analytics — the
precise defect §2 exists to prevent. The guard test missed it because it asserted a **hand-named list
of six screens** standing in for a claim about fifty-nine.

So the exclusion moved into the shared read: **`getRepRosterPlayers` and `getRepRosterPlayer` now
exclude call-ups at the query**, with one `includeCallUps` opt-in (the roster page, which manages the
list) and an inventory test that fails when a second surface opts in quietly. That also closed
**nine side doors** nobody had spotted — notes, documents, development, goals and measurables all
resolve a player the same way and none knew what a call-up was.

Also applied: the drawer registered neither the dismiss nor the back-step hook (Escape dead, Tab
escaping, the Android back gesture leaving the page — the §219 defect); its private footer had no
sticky rule, so its buttons scrolled under the bottom nav; the mark was styled twice and had already
drifted; the printed card hardcoded the word instead of `CALL_UP_LABEL`; the two pill groups were
near-copies; a duplicate index; a create-then-update that briefly made a call-up a real active roster
player; an extra round trip after every add; an unconditional request on every roster load.

**Skipped:** the two new routes each declare their own context resolver — ~60 routes do, it is the
house convention, and refactoring two of sixty makes the codebase less consistent.

### 16.2 `/review` — high-risk tier, five lenses

**Stage 0 caught one on its own:** removing the printed legend orphaned a helper with no other caller.

**Confirmed and fixed, worst first:**

| # | What | Why it mattered |
|---|---|---|
| 1 | **The bench console offered call-ups to controls that refused them.** Merging them into the console's player list also fed its *Who's here* drawer and its *About a player?* dropdown, while attendance and game-note writes still validated against the active roster alone. | Mid-game, tapping *Here* on a borrowed player flipped the toggle back with **no message at all**; a game note answered "Unknown player." A picker and its validator must agree. |
| 2 | **Undo after "take off this game" trapped the coach.** Undo restored a lineup row the server can no longer accept; the autosave retried the failing save ~once a second, forever, with navigation blocked. | Only a reload escaped. The history is now cleared — taking someone off a game is a server-side act undo cannot reverse, so offering the step was a promise the button could not keep. |
| 3 | **A failed removal could wipe the whole saved lineup.** It used the builder's delete-all-then-reinsert helper; a transient failure on the re-insert left the lineup empty while the coach was told only that one removal failed. | The emptiness would have surfaced at the field. Now one row is deleted and the batting order renumbered — which also fixed a gap (1, 2, 4, 5) that reached the printed card. |
| 4 | **The call-up list leaked a guardian phone number.** Hand-built projection, no redaction, gated on `lineups` — which the default **assistant** preset has and `rosterPii` it does not. | An assistant redacted out of guardian contacts everywhere else received the phone number of every borrowed child. Nothing read the field; the projection is now two columns. |
| 5 | **Six money routes could bill a call-up.** They prove a player with a raw query, so they inherited nothing from the hardened read. | Dues, a credit, a payout, a surplus adjustment or an expense could land on a borrowed player — money no money screen would then show, because they all exclude call-ups. |
| 6 | **The Families desk listed every call-up as a child with no family — permanently.** Its predicate is "not declined, not withdrawn", not `=== 'active'`. | The admin could never clear the row: no person link, the database forbids giving them an email, and the player page 404s on one. |
| 7 | **The RLS insert policy constrained only the team.** The sibling table gets away with that because it has no forgeable tenancy column; this one has four. | A coach could insert a row carrying another org's `org_id` — inflating a victim team's games-played count and making their call-up undeletable. |
| 8 | **A family link could be created for a call-up** — the one audience the no-email constraint cannot close, since it hangs off a player id. | Once claimed, that adult receives the team's game-change mail. |
| 9 | **The schedule's lineup peek ignored call-ups**, dropping the entry and renumbering. | A call-up batting 4th vanished and everyone below moved up — the coach read a different order there from the printed card. |
| 10 | **An unvalidated id reached a write** in the removal endpoint; **the migration was unwrapped** (a mid-file abort would leave the status column unconstrained) and its policies were not drop-guarded, so the file only *looked* re-runnable; the guard test's literal scan could pass while the type and database disagreed; the platform roster-size metric counted borrowed players; the Remove button read a different capability from the route behind it; a failed add closed the sheet silently. | — |

**Refuted / not acted on:** the local context resolvers (house convention, as `/simplify` also
concluded); the missing UPDATE policy (RLS denies by default, and nothing updates that table); a
create-then-link that is two writes (recoverable — no games, so Remove is offered); a create
idempotency gap reachable only by a lost response, noted rather than built.

### 16.3 Verification

`npm test` **4,575 pass / 0 fail** (up from 4,558 — twelve new guards) · typecheck · `lint:focused`
0 errors · CSS purity, selectors, contrast, text-contrast, spelling · dictionary, index coverage,
snapshot freshness, manual-prod-migrations, observability, org-context, demos, export catalog ·
layout sweep clean at 361/390/768/1440 on the builder, the call-up drawer, the template editor, the
roster, the console and the schedule · both probes re-measured.

**The migration was re-applied to dev to prove the drop-guards work** — it is now genuinely
re-runnable rather than only looking it.

⚠ `check:migrations` fails, correctly: dev has 309 and prod does not. Registered `pending`.

⚠ **Four findings on the closed-season page's chrome remain UNRECORDED**, as before — a 29px *Share
your season* button and a team-switcher overflow. Not this work's, and marking them accepted would
record real tap-floor defects as decisions.
