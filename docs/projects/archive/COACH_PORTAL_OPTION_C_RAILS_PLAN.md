# Option C right rails — Overview, lineup builder, Dues

**Date:** 2026-08-02 · **Status:** ✅ **BUILT + OWNER QA PASSED 2026-08-03** — uncommitted, awaiting the
owner's per-action commit OK. Shipped shape is NOT what was first built: the Overview rail was cut
during QA and the other two were trimmed (see the QA round below).
Owner picked all three candidates, then **ratified the mockups and all three open questions**
("looks good, I agree with your recommendations", 2026-08-02).
**Mockups (binding spec):** `claude.ai/code/artifact/fa0d3bc3-32f1-4dee-b0f4-cbd6a7caf3cf`
**Source ranking:** desktop-shell review artifact `949c4e72` §06.

## Shared geometry — ONE definition, four surfaces

The player profile's shipped rail classes were **generalised** rather than copied: `.profileCols` /
`.profileRail` → `.railCols` / `.rail`, plus a small set of rail-content primitives (`.railGroup`,
`.railLabel`, `.railRow`, `.railValue`, `.railValueWarn`, `.railValueWrap`, `.railValueBig`,
`.railClear`). Four hand-copies of one grid is the drift the Budget↔BvA width split taught us to
avoid, so the names are surface-neutral.

- 300px at ≥901px, sticky below the pinned masthead; rail moves **last** below that (work first,
  reference after — the Staff-rail precedent). **No new breakpoints.**
- A rail is visually **flatter** than what it sits beside — hairlines and small labels, never a
  second column of equal weight.
- **Already-loaded data only.** No rail adds a request.
- **Empty group = removed**, never a heading with a zero under it.

## What each rail holds

### 1 · Team Overview — reference, never a second voice
- **This week:** the seven days ahead in schedule order (from the events the page already fetched
  for its counts), capped at five with a stated `+N more this week` link — the cap is on screen, not
  silent. Player birthdays ride the same group.
- **Waiting on you:** the ratified fixed floor — dues overdue, players with no guardian email, and
  the next game with no lineup. The whole group disappears when all are clear.
- ⚠ **The ruling it lives under:** the Overview answers one question at a time and the anchor card
  is the page's single voice. The rail therefore has **no buttons and no imperatives** — "Dues
  overdue · 1", never "Chase 1 overdue payment". Every line is a quiet link to the surface that
  already owns the action.
- **Deliberately NOT included: unread team chat.** This page never fetches it — the sidebar and
  bottom nav do, and each already shows its own badge — so putting it in the rail would have cost a
  third identical request for a signal that is on screen anyway. This is a knowing deviation from
  the ratified mockup, flagged rather than silently dropped.
- **Consequence:** the Overview adopts the 1200 width **only while the rail renders**. A brand-new
  team with nothing to reference keeps today's 960 reading measure rather than a stretched column
  beside an empty gutter.

### 2 · Lineup builder — the bench beside the grid
- **Not placed yet:** every unplaced player **with their own attendance answer** — the thing the
  editor's existing bottom list doesn't carry. When nobody is unplaced it says so in words
  ("Everyone on the roster is in the lineup"), because that absence is the answer a coach wants.
- **Attendance:** In (attending + late), **Out named, never counted**, and the no-reply count.
- **Read-only, as ratified.** The editor's own "Not in the lineup" list keeps the Add button, so
  exactly one place changes a lineup, and the rail is not a drag source (the gloves-and-phones
  ruling). Tap-to-place can follow once the rail is proven.
- ⚠ **Known overlap, owner-visible:** unplaced names now appear twice on a wide screen — in the rail
  as reference-with-status, and under the grid as the actionable list. Built as the ratified mockup
  showed; worth a look at QA, and a fair `/simplify` target.
- Vocabulary reuses the Schedule's four words (In / Late / Out / No reply) — a second vocabulary for
  the same four states is how "Out" and "Absent" end up on one screen.

### 3 · Dues — totals that don't scroll away
- **Season totals:** collected, outstanding, next due. **Needs a nudge:** overdue players and
  "paid nothing yet", both absent when clear.
- Overdue reuses the **shared installment predicate**, so the rail can't disagree with the ⚠ flags
  on the rows beneath it. "Next due" is the soonest date still **ahead** — an overdue date is a
  debt, not a plan, and is already reported on its own line.
- **Read-only:** "Remind all" stays with the list it acts on; a send button beside a total invites
  nudging people you haven't looked at.
- **Correction to the ratified recommendation:** the premise was wrong. The Premium dues page has
  **no summary strip to replace** (the Owed/Paid/Unpaid summary the help guide mentions belongs to
  the *free* fees tool). So the rail introduces these totals rather than relocating them — strictly
  simpler than the ratified plan, and nothing is duplicated.

## ⚠ Owner QA round 1 — the Overview rail was CUT (2026-08-03)

Owner, seeing it built on a real team: *"the page is looking a little too crowded and the data is
somewhat duplicative… I at least think this should only be present in wide screens."* Correct on
every count, and the evidence was in their own screenshot:

| Board tile already said | Rail also said |
|---|---|
| This week — *1 game · 2 practices · 2 other* | the same five events, listed |
| Roster — *9 missing email* | *No guardian email · 9* |
| Dues — unpaid count | *Dues overdue · N* |

So **"Waiting on you" was 100% a restatement of tile flags**, in a second column beside those very
tiles, and only the week LIST carried anything the tiles couldn't. **Decisions taken:**

1. **The Overview rail is REMOVED entirely** (and with it the Overview's conditional 1200 width —
   the page returns to its 960 reading measure). The comment left in its place states the bar any
   future proposal must clear: *it has to hold something the six tiles cannot.*
2. **Dues rail: "Paid nothing yet" removed.** It repeated the "Haven't paid anything yet" card a
   few hundred pixels above, which names the families and carries Remind-all. **Overdue stays** —
   nothing else on the page totals it.
3. **Lineup rail: the "Not placed yet" list removed.** The editor's own "Not in the lineup" list
   already names them and carries the Add button. What survives is the attendance half — the part
   genuinely off-screen while placing players, with anyone **Out** still named rather than counted.
4. **NEW RULE — a reference rail does not exist below the wide breakpoint.** Moving it last was not
   enough: stacked under the page it stops being a margin note and becomes another block of what
   the coach just scrolled past (on the Overview it landed directly beneath the tiles it restated).
   Applied via an opt-in class. **The player profile's rail deliberately still stacks** — its
   guardian/safety/dues facts appear nowhere else on that page, and that behaviour already shipped.
5. **Page width unchanged** — owner reaffirmed the D1 ruling (960 reading / 1200 data-dense,
   centred). The mockup frames filled their own browser frame, which set a full-bleed expectation
   the product deliberately doesn't hold.

**The lesson worth keeping:** "fill the rail with data the page already loads" was the wrong test.
The right one is *data the page does not already SHOW*. Three of the four Overview rail lines passed
the first test and failed the second.

## Verification

- `typecheck` **0 errors** · focused lint **0 errors** (6 pre-existing warnings) · unit suite
  **913/913** · all six token ratchets **ZERO** · date-correctness **ZERO** · snapshots fresh.
- **`npm run check:layout`** (the new render-based invariant gate): **zero new findings on all four
  rail surfaces** — Overview, player profile, lineups and Dues each render clean at 361 / 390 / 768
  / 1440. The gate is red overall on **120 new findings belonging to another session's** practice-plan,
  practice-run and drill-template screens; this chunk did not touch them and did not re-baseline.
- Schema parity remains red on the concurrent sessions' dev-only tables (migs 214–221). No migration
  here.
- Visual/browser QA is the owner's per the standing division of labour.

## Follow-ups
- The lineup rail's name overlap (above) — kill it or keep it, owner's call at QA.
- Ranked-but-not-built: Schedule (mini month navigator) and Insights (season-at-a-glance) remain
  candidates 4 and 5; Roster list, Tryouts, Development, practice run and Chat stay railless by
  recorded rulings.
