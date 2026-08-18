# Closing the season — one page, and the end of read-only-everywhere

**Status:** APPROVED 2026-08-18 (owner), from the design session. **BUILT 2026-08-18 — all three
steps, on `dev`, awaiting owner QA.** See §8 for what shipped and what the build corrected.
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

**⚠ CORRECTED AT BUILD TIME (2026-08-18) — this section's premise was wrong, and the code won.**
The line below said the dialog "never says the old season stops being editable". It did: an amber
caution at the very bottom, under two checkboxes and a bullet list — *"Once you start, {season}
locks as read-only. You can always look back — its Season's End page keeps the wrap-up, and the
Insights archive keeps every result and money record."* Two things were actually wrong with it, and
both are what got built:

1. **It was last.** The one fact that prevents the mistake this plan cannot undo (§3.4) sat below
   everything a coach scrolls past. It is now the FIRST thing in the form, above the carry list —
   which is what the original line was reaching for.
2. **Half of it had stopped being true.** It promised "the Insights archive keeps every result and
   money record". This change deletes that archive; a closed season is one page. The sentence now
   says what that page actually holds.

It is also no longer styled as a warning. Rolling forward is the ordinary end-of-year thing to do,
and an amber alert box around the common case teaches coaches to scroll past the box.

~~The existing dialog explains what carries forward. **It never says the old season stops being
editable** — the one sentence that would prevent the mistake this plan otherwise cannot undo (§3.4).
Add it, plainly, above the carry list.~~

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

---

## 8. What was built (2026-08-18)

All three steps, in the order §7 required. **No migration** — closing is a status a season already
has.

### 8.1 The two doors, and the two warnings

- **`PATCH /seasons` — `close` and `reopen`.** Head coach, standalone team, and the SAME predicate
  the rollover already used, named once (`mayManageSeasons`) so the three doors cannot disagree
  about who holds this power. Both are a status flip on one row; nothing is created, moved or
  deleted. ⚠ Every condition is re-asserted in the `WHERE` — two coaches on one team can close and
  roll forward in the same second, and a flip decided from a row read a moment earlier would close
  the season the rollover had already closed.
- **`GET /seasons` — the close preflight.** Names what is outstanding (families still owing, money
  waiting to go back) and returns nothing that could refuse. ⚠ Money-gated and ABSENT rather than
  zeroed for a coach without the books: "0 families still owe" from a screen that cannot see the
  money is a confident wrong answer.
- **`CloseSeasonModal`** — the mockup's copy, warnings and both buttons, including "Not yet — take
  me to Money" as a real navigation.
- **The Overview cue** now offers *Start next season* as its primary (under its real name — §1) and
  *"No next season — just close {year}"* beside it. Both ride `canManageSeasons`, so a club-run
  team is offered neither, as before.
- **Reopen** is on the closed-season page, quiet, and requires BOTH no live season AND that the page
  is showing the team's own closed season — offering it while an older year is on screen would act
  on a different season from the one being read.

### 8.2 The page

The closed-season page **names its season in its own title** (the mockups show "2025 Season", not
"Season's End") — load-bearing, because the page-title season chip died with the season dial and
this is now the whole answer to "which year am I reading?".

Two new shelves join the two that shipped: **Results** and **The roster**, both collapsed, both
FLAT. Two new history endpoints (`season-results`, `season-roster`) were added to `HISTORY_ENDPOINTS`
with their three questions answered at the list. ⚠ The roster read emits names and numbers and **not
one guardian, medical or emergency-contact field** — player names are baseline (owner 2026-08-03),
and that ruling covers names and stops there; a source guard now holds it to that.

### 8.3 The deletion — what actually made 29 special cases collapse into 1

⚠⚠ **The plan listed the branches to remove but did not say what a coach sees when their team has no
live season and they tap Roster or Money.** Answering that is what the deletion cost: if those
screens stay reachable, removing the read-only branch does not tidy anything — it shows write
controls over a season the server will refuse.

So the rule is: **a team with no live season has one destination, and its other doors do not open.**
`CoachTeamSeasonGate` (mounted by the team layout, decided on the SERVER from the two lookups the
masthead already needed) renders `children` or sends the coach to the closed-season page. It never
renders a live screen "read-only", because a live page that mounts issues its fetches and offers its
controls whatever it looks like.

With that in place:

- `isReadOnly` and `canWrite()` are **deleted from `CoachSeasonPage`**; `resolveWorkingSeason`
  splits into `resolveLiveSeason` + `resolveClosedSeason`.
- The **17 read-only branches** are gone, including two whole screens (the practice hub's
  between-seasons state, the staff page's finished-season note) and nine past-tense sentences on
  the Insights hub.
- The **12 "comes back next season" notices** are gone — one component's second branch, deleted
  once. `CoachNotOnTeam` now says the one true thing and no longer reads the season at all.
- The **nav special case** changed shape: `withLandingSlot` (swap the landing slot, keep fourteen
  doors into a finished season) became `withClosedSeasonNav` (the menu IS that page).
- ⚠ **The two decided absences are untouched and their guard moved rather than went**: playing-time
  analytics and the opponent book were asserted absent on the Insights hub, which no longer renders
  for a finished season; they are now asserted absent from the CLOSED-SEASON PAGE, the only surface
  a finished season is read on.

### 8.4 A defect found on the way past

The rollover's success view offered **"See {season}'s Season Wrapped"** with no year — and by the
time it is pressed the rollover has made the NEW season the team's working one, so that page
resolved the new year and said it was still under way. The season the coach had just finished was
one field away on the payload the whole time. Fixed in the same change.

### 8.5 Gates

`npm test` — 2138 pass, 0 fail (the two guard files re-aimed, never reduced: five assertions that
described the read-only copy are deleted with the feature, and the properties that MOVED are
re-asserted against the gate). `npx tsc --noEmit` clean. `npm run verify:changed` — lint 0 errors;
its one failure is the **pre-existing dev/prod schema divergence from migrations 252–254** (the
Families Book), untouched by this change, which carries no migration.

---

## 9. The long shelves (owner design gate 2026-08-18, mockup artifact `bed11050`)

**Built the same day, on top of §8.** The seeded fixture has four games and two practices, so the
flat lists looked fine and were not: a real season is **26 games and 44 practices**, and practice
rows are two lines each — between them the longest thing on a page whose whole promise is that it is
quiet.

### 9.1 One pattern, both shelves

Three layers, each a place a coach can stop:

1. **The shut face** — the headline. Unchanged.
2. **The answer** — a summary strip, so opening a shelf is rewarded rather than met with a wall.
   Results: the record split **by competition** (a league record and a tournament record are
   different claims about a team), home/away, and scoring. Practices: **what the season was spent
   on**, from the focus tags that were already on every row.
3. **The season by month** — four to six rows, each opening to its own nights. A month row carries a
   fact a date-sorted list cannot: that month's record, or what it was about.

⚠ **Nothing is hidden.** Months organise the list; they never shorten it, and the truncation notices
are unchanged.

⚠ **A season inside two months skips the month layer.** Two rows that each need a click to reveal
four nights is worse than a list of nine.

### 9.2 The three things this got right that are easy to get wrong

- **⚠⚠ The summary is computed over EVERY row, never the page of rows shown.** Both routes cap their
  list; a record derived from the rows that happened to fit is a different season's, and wrong in
  the direction nobody checks. This is why the arithmetic is server-side. Build-enforced.
- **⚠ Months are grouped in the ORG's timezone.** Slicing the stored instant files the last night of
  July under August — a defect this repo has shipped on three screens before. Build-enforced.
- **⚠⚠ "44" was a small lie.** The shut face read as *the season held 44 practices*. It does not:
  this shelf holds nights a coach **wrote something about**, and a night nobody wrote up never
  reaches it. A team that ran sixty and planned forty-four was being told they ran forty-four. The
  summary now says **"44 nights written up"**. Found while drawing the mockup, not by a test —
  nothing contradicts a number that is merely under-qualified.

### 9.3 The marks

The Results rows and the competition split carry the **schedule's own** icons and colours — shield
for a league game, trophy for a tournament, swords for a scrimmage. They were a local constant on
the schedule page and are now one shared module, because a second copy drifts on exactly the axis a
coach reads fastest and drifts silently. Build-enforced: no coach surface may declare its own.

⚠ **The colour never carries the meaning alone** — league-green and tournament-amber are close to a
coin-flip for a red-green colour-blind coach, so the word stays beside every mark and each row keeps
its opponent, score and result. Same rule the money shelf follows with "under" / "over".

⚠ **Practices carry no per-row mark.** Every row on that shelf is the same type, so it would be
decoration. Owner's call, 2026-08-18.

### 9.4 Still open

The month layer adds a third level of opening (page → shelf → month → night). The answer strip is
what pays for it — a coach who came for "how did we do?" now stops one level earlier than they used
to. Worth watching on the QA walk: if coaches open months routinely, the strip is not answering.
