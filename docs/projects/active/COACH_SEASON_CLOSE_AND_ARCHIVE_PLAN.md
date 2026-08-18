# Closing the season — one page, and the end of read-only-everywhere

**Status:** APPROVED 2026-08-18 (owner), from the design session. **Nothing built yet.**
**Decision record:** mockup artifact
`https://claude.ai/code/artifact/57e9bfd3-ebcc-47a1-a241-ce6eab56182e` — the mockups ARE the spec.
**PM brief:** `COACH_SEASON_CLOSE_AND_ARCHIVE_PM_BRIEF.md`.
**Parent:** `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` §9 — this is the trim that section anticipated,
and it supersedes §9's open questions.

⚠⚠ **THIS CHANGES A STANDING RULING, DELIBERATELY, AND THAT IS THE POINT OF THIS PARAGRAPH.**
Design A (2026-08-16) said history is delivered **in place** — a finished season renders through the
ordinary screens, which is why it is complete for a team between seasons and unreachable once the
next season starts. This plan replaces that with: **a season is fully live until it is CLOSED, and a
closed season is ONE PAGE, reachable for ever.** Design A's actual target — no season dial, no second
nav, no thirty screens learning a year — is untouched and in fact strengthened. What changes is the
answer to *"what does a finished season look like?"*, which was previously "all of it, read-only".

---

## 1. What is wrong today, read from the code

1. **⚠ "Close out the season" does not close the season.** The Overview's winding-down cue offers a
   button with exactly that label; pressing it opens the **Start next season** dialog. There is no
   other coach-facing way for a season to end — the only status change to `completed` comes from the
   rollover, or from an org admin editing the program year. A coach whose group has aged out cannot
   finish their season at all.
2. **⚠ The moment a season IS finished, the whole portal becomes a read-only copy of itself.**
   Verified by count on 2026-08-17: **17 coach screens carry a finished-season branch**
   (`isReadOnly` / `isRecord`) and **12 carry a "this season has finished" notice**
   (`CoachNotOnTeam`). That is 29 places whose only job is to describe a state nobody chose.
3. **The work does not stop when the games do.** Money settlement, awards, documents, family emails
   and next year's tryout all happen after the last game — and today they are inside a portal that
   has already gone read-only if the season was marked finished.

**The insight the session turned on:** the product had no answer to *"when does a season end?"* other
than "when someone marks it finished", and it then punished that state across 29 screens.

---

## 2. The model approved

**Two states, and the middle one is deleted.**

| State | What it is |
|---|---|
| **Live** | The full app, unchanged, for as long as the coach needs it. The last game does not end the season. |
| ~~Winding down~~ | **Deleted.** No half-state, no partial restrictions, nothing to explain. |
| **Closed** | One page. The same page for every finished season, reachable for ever. |

**The coach decides when the change happens**, through exactly two doors:

- **Start next season** (primary) — closes this one and rolls forward. Already exists; gains a
  warning (§3.2).
- **Close the season** (quiet) — for the aged-out team, or a coach not ready to plan next year. New.

⚠ **A club-owned team sees neither.** Its club manages seasons; the page says so, as it already does.

---

## 3. What gets built

### 3.1 A real "close the season" action

New, coach-facing, head-coach only, standalone teams only (mirroring who may start a season today).
It sets the season to completed and nothing else — no data is created, moved or deleted.

**⚖ It WARNS about unsettled money and never blocks** (owner ruling 2026-08-18). The dialog names
what is outstanding — families still owing, money still to go back — and offers a way to Money. The
coach may close anyway. Blocking would make the product the arbiter of a real-world debt it cannot
see the whole of, and a coach who settled in cash would be stuck.

⚠ This is the home for the settlement-completeness check logged as unbuilt in the parent plan §8
("books can seal with money outstanding today"). It arrives as a **warning**, not a gate.

### 3.2 "Start next season" says what it costs

The existing dialog explains what carries forward. **It never says the old season stops being
editable** — the one sentence that would prevent the mistake this plan otherwise cannot undo (§3.4).
Add it, plainly, above the carry list.

### 3.3 The closed-season page

One page per finished season: the Season Wrapped card, **four collapsed shelves**, and the compare
door. Nothing else.

| Shelf | Status |
|---|---|
| Results | **new** |
| The roster | **new** |
| The practices you ran | ships (P3) |
| How the season added up | ships (P4) |

- **All four collapsed by default**, each with a summary on its shut face. The binding constraint
  from the shelf rulings survives: the page must stay quiet.
- **Reachable whether or not the team has a live season** — the change the owner asked for. This is
  what makes it an archive rather than a between-seasons landing.
- **When there is no newer season**, one card at the top offers **Start next season** (and, quietly,
  reopen — §3.4). Otherwise it is the same page.
- ⚠ Every shelf is FLAT — no cell is a link into a live tool. The money shelf already establishes
  this rule and its reason; results and roster inherit it.

⚠ **Kept deliberately minimal.** Every record is retained in the database in full, so anything
missing can be added later without having lost anything now.

### 3.4 Reopening — the safe half only

**Offered when the team has NO live season.** A status flip; nothing is deleted. This covers the
common mistake by a wide margin: *"I pressed close and I should not have."* Head coach only, worded
as an undo rather than as a way of working, and absent for club-owned teams.

**⚠ NOT BUILT, and logged so it is not re-argued:** undoing an accidental *rollover* (reopen the old
season AND remove the newly started one). The rule, decided and recorded now:

- Offer it only while the new season holds **nothing real** — nothing beyond what the rollover itself
  created. Roster copies, carried budget lines and an unpaid dues schedule are still "untouched"; a
  game, attendance, a recorded payment, a lineup, a tryout or a document is not.
- **Never a clock.** A coach can do a season's damage in an hour or none in a fortnight.
- If the new season has real work: **no button**, a sentence. Never offer a destructive path when
  there is something to destroy.

**Why not now:** starting a whole season by mistake is far rarer than closing by mistake, it is
recoverable by hand today, and it means writing a delete path — the most dangerous kind of code — for
a mistake nobody has reported. §3.2's warning is what keeps the gap small.

**⚠ The trade, stated so it is not discovered later:** a coach who closes by mistake *and* starts the
next season is stuck until this is built.

### 3.5 The deletion — the actual prize

With a closed season reduced to one page, the finished-season branches have nothing left to describe:

- the **17** `isReadOnly` / `isRecord` branches across coach screens,
- the **12** `CoachNotOnTeam` "comes back next season" notices,
- the between-seasons special case in the navigation,
- and the standing tax on every future feature: *"and what does this do for a finished season?"*

⚠ **This is the measure of success, not the page.** A change that adds the page and leaves the 29
branches in place has done the expensive half and skipped the valuable one.

---

## 4. What does NOT change

- **Every live screen, for as long as the season is open.** Money, awards, documents, families and
  tryouts keep working after the last game — that is the whole reason the middle state is deleted.
- **Every record in the database.** Nothing is deleted, ever; this is a presentation change.
- **Insights and the season-by-season comparison** — comparison stays where it is.
- **The look-back layer's guard.** `HISTORY_ENDPOINTS` remains the mechanism, one surface at a time
  with its three questions answered. Results and roster join it as decisions, not as a blanket
  restoration of `?year=` across the record screens.
- **The decided absences.** Playing-time analytics stay live-season-only (recomputed); the drill and
  plan-template libraries, the opponent book and the club book stay instruments.

---

## 5. Risk

1. **⚠ The deletion is where the defects will be, not the page.** Removing a read-only branch from 17
   screens means 17 chances to remove the wrong half. The membership smoke's "no write control on a
   finished season" probes are the safety net and must be re-aimed, not deleted, as the surfaces they
   walk stop existing.
2. **⚠ Tryouts require a season.** Next year's tryout runs before next season would naturally start,
   so **Start next season is the first real step of the year**, not an end-of-year formality. The
   nudge's wording has to carry that without becoming pushy.
3. **A season can now sit live indefinitely.** A coach who never closes and never rolls forward keeps
   a live season for ever. That is acceptable — it is their team — but the Overview's winding-down
   cue is the only prompt, so its predicate matters more than it did.
4. **Reopening changes what "current" means mid-session.** A team's working season moves; anything
   cached client-side must not paint the old one. The stale-guard lessons from the practices shelf
   apply directly.

---

## 6. Tests

- The history-endpoint guard gains the results and roster reads, each with its three answers at the
  list. The decided-absence blocks are untouched.
- A new unit guard for the closed-season page: four shelves, all collapsed, no cell a link.
- The membership smoke: re-aimed rather than reduced — a closed season shows the one page and no
  live tool; a live season is untouched after the last game; closing warns and does not block;
  reopening is offered only with no live season, and only to a head coach.
- ⚠ The UAT fixture already has both shapes (a rolled-forward team and a between-seasons one) after
  the 2026-08-17 repair. It will need a **closed season with no next one** to walk the reopen path.

---

## 7. Sequencing

One phase, but built in this order so the product is coherent at each step:

1. **Close + reopen + the two warnings** — the season can end, and be un-ended.
2. **The page** — results and roster shelves join the two that ship.
3. **The deletion** — the 29 branches, once the page is proven.

⚠ **Do not start with the deletion.** Removing the read-only branches before the page exists leaves
a finished season with neither.

**No migration.** Closing is a status a season already has.
