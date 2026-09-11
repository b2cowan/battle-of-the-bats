# PM Brief — Awards Join the One Tag Idiom

> Plan: `COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md` · Hub (mockup · brief · plan · decisions): https://claude.ai/code/artifact/630ebe17-e71d-4917-b49c-3d7398eb14d0 · Owner rulings 2026-09-11

**What it does:** A coach can fix or take back an award right where they gave it, and the award
chips themselves (MVP, Best Hitter, the ones the coach invents) get the same manage door, drawer
and shelf every other tag in the portal already has — including merging duplicates.

**Why it matters:** Two dead ends today. An award given from a game can't be edited anywhere and can
only be removed from a different page. And a mis-typed or duplicate award chip can be created inside
the Give window but never fixed there — the only manager is a link buried on the season report, and
it can only rename or hide, never delete or merge. When you ratified how tags work on 2026-09-01
("applies to every tag surface"), awards were the one vocabulary the review never inventoried. This
closes that gap with the pattern coaches already know rather than a third way of managing words.

**Who benefits:** Every coach with the awards capability (head coaches, and any staff role granted
awards). Club-shared award chips stay the club admin's to manage, listed read-only for the team —
unchanged. No plan gating changes: awards are a coach-portal feature on every tier that has it today.

**What changes for the coach:**
- **On a scored game** — each award in the "Awards given" list gains Edit and Remove. Edit opens the
  same Give window, pre-filled, titled *Edit award*: change the player, the award, the note; Save.
  Remove asks once, then it's gone. Which game the award is for doesn't change (remove and re-give
  for that, same as a tag on the wrong event).
- **In the Give window** — beside "+ New" the Award field gains **Manage awards…**. It opens the
  side drawer over the form: every award with how many times it's been given, rename (name and
  icon together), merge one into another, remove. Shared club awards list below, read-only.
- **Removing a used award is honest** — the dialog says how many times it's been given and offers
  *Merge instead* (those players keep an award under the other name) or *Retire* (it leaves the
  picker, stays on their record). An award never given just deletes. Nothing a player received is
  ever silently erased, and nothing is stuck forever either.
- **A player holds an award once per occasion.** Giving Blake MVP for a game he already has MVP for
  is refused with a plain sentence — same on Edit. Today nothing stops that double; it was possible
  all along, and merging would only have made it visible. When a merge would leave someone with the
  same award twice for one game, it keeps the one given first and says so before you confirm:
  *"4 awards become MVP. 1 is dropped — Blake would hold MVP twice for the Apr 16 game."* The same
  award on a *different* game is still fine — "2× MVP this season" stays real.
- **Team settings → Tags** gains an **Awards** row, so there's a home for them that isn't a link on
  a report. The report page's old "Manage award types" link goes — one way in.
- **The season report** (Who's earning it?) gains Edit beside its existing Print and Remove on every
  history row.
- Everything that *reads* awards — a player's profile, Season Wrapped, certificates, the family
  recap — picks up a rename or merge automatically. A closed season stays a record; none of these
  tools reach it.

**Expected impact:** Duplicates ("MVP" and "MVP (2)") become a ten-second merge instead of a
permanent picker; a mis-given award is a two-tap fix at the game instead of a trip to the report to
delete and re-give; a new coach learns nothing new — it's the tag drawer, holding awards.

**Trade-offs made:**
- The award picker stays a chip row (you tap one of five), not the searchable dropdown tags use —
  the list is short and carries icons, and budget items and test types kept their own shape under
  the same ruling.
- An award can't be moved between games in place.
- The three starter awards a new team gets will stop re-appearing if a coach deletes them (today's
  seed re-runs whenever a team has none); whether a new team still gets a starter set at all is the
  one open call in the plan.
- Before the once-per-occasion rule reaches production, any award a real coach has already doubled
  is collapsed to the earlier one — a data step that has to be counted on the live database first,
  never assumed.

**Priority:** Medium-high. Small in scope (two contained phases on a pattern that already exists),
and it removes a genuine "the product won't let me fix my mistake" moment on a feature that is in the
demo's shop window and the marketing shots. Part A is a half-day contained fix; Part B needs one
migration (a merge function) and rides the next release's migration order.

**Success criteria:**
- A coach can edit and remove an award from the game drawer and the report page; the schedule's
  trophy count updates the moment they do.
- Two same-meaning award chips can be merged from the Give window, and every award already given
  under the loser reads under the winner on the game, the report, the player profile and Season
  Wrapped — with no record lost.
- Removing a used award never orphans or cascades; the dialog states the count and offers merge or
  retire; an unused one deletes.
- No player can hold the same award twice for one game — Give and Edit refuse it, a merge collapses
  it to the earlier award and says how many it dropped before the tap.
- The Tags shelf lists Awards; the report page has no "Manage award types" link; help and the
  marketing shot say what the screen does.
- Owner QA walk passes on the hub's QA tab; `check:demos` still green on both worlds.
