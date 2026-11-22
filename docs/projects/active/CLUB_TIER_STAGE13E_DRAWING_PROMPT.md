# Club Tier Stage 13e · Numbers open their lines (DRAWING session first, build prompt after)

> Written 2026-11-16 on the owner's request, after 13d closed (hand-offs walk §528 PASSED 47/47 on 2026-11-14). Paste into a
> **fresh chat on `dev`**: `execute @docs/projects/active/CLUB_TIER_STAGE13E_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is:
> - one published drawing (a Claude Artifact);
> - the owner's rulings on whatever is genuinely open;
> - then a **build prompt** for 13e.
>
> Recommended model: Opus. Run `/ux` and `/design` before the hand-off. It touches no code, so it can run beside any build,
> including the Board Ready Stage 2 drawing.
>
> **Plan of record:** [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md):
> - the ladder at ~L208;
> - §11.2 at ~L930–940;
> - the status log through the 13d closeout at ~L890–901.
>
> **Hub of the earlier drawings:** https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY (source
> [CLUB_TIER_STAGE13_JOURNEYS_HUB.html](CLUB_TIER_STAGE13_JOURNEYS_HUB.html), content in
> `.probe/nav-journeys/hub/content.cjs`). The walk notes behind each finding are in `.probe/nav-journeys/walks/*.md`.
>
> **Standing rules:** `docs/agents/design/NAV_STANDARD.md`. Mark each fact **[V]** (you opened it this session, with
> file:line or the shot's name) or **[H]** (handed to you here, unverified). Branch `dev`; explicit pathspecs; ask before
> committing; never push.
>
> The facts below were gathered by a helper on 2026-11-16. The writer spot-checked the ladder row (content.cjs L243–246),
> the several-permits sequencing line, and F-R3-1 / F-R5-4 in the walk notes. **Everything else is a lead, not evidence.**

## What 13e is

The ladder's line (hub `content.cjs` L243–246), verbatim:

> Still owing rows open the registration; one "who owes" door; a figure on two screens says which it is; Budget vs. Actual's Not filed and Off-plan open their lines; registrations search every tab; "find a child" from the registrar's landing; the phone schedule opens on the next event.

- **Size:** Small.
- **Dependency:** 13a (done).
- **Asks on the hub:** none.
- **Theme 4's rule** (content.cjs ~L117): **every figure opens its lines, and a figure on two screens has one definition
  or says which** ("includes 2025–26").

**Why it matters:** the Club tier's go/no-go list (Stage 8 of the readiness plan) waits on Stage 13. 13e, 13f and 13g are
the rungs that can run now. 13h waits on the several-permits walks.

## What 13e covers (verify each; severity and direction from the walk notes)

| ID | Sev | What is wrong | Direction in the walk |
|---|---|---|---|
| F-R3-1 | Med | Money's "Still owing" list is read-only; the registrar who finds the 14 names must go elsewhere, filter again and work there | Rows open the registration, plus an "Email these families" button |
| F-R3-6 | Med | "Who owes" has two answers (Still owing 14 vs Registrations' Owing filter) and neither links to the other | One door |
| F-O6-5 | Med | One team shows two "Outstanding" totals | **Corrected: labelling, not money.** 13d was told not to touch it |
| F-O6-2 | Low | "Installments due 12 … 7 overdue" doesn't say whether the 7 are inside the 12 | Say it |
| F-T3-8 | Med | Budget vs. Actual's Off-plan and Not filed have no door to their lines | Not filed opens the Ledger filtered. Hub ruling ALSO T3: **no month control yet, just the lines** |
| F-O5-6 | Med | A club tournament's book opens on "this month", so the window is empty under a non-zero balance | Open on All time or the event's dates |
| F-R5-1 | Med | Registrations search covers only the open tab | Search all tabs, or say "1 match in Active" |
| F-R5-2 | Med | No "find a child" on the registrar's landing | Add it |
| F-R5-4 | Med | The phone Schedule opens on today's week, not the next event | Open on the next event |

## Conflicts to settle (recommend a home for each, out loud)

- **F-R5-4 has two homes.** It is in 13e's row and in hub theme 8 (13g, the phone), but not in 13g's row. Recommend one.
  It is a coach-or-registrar phone schedule question, so find out **which portal** first.
- **Theme 4 lists F-T3-1, F-T5-1 and F-T3-5, which are not in 13e's row.** The helper reports all three settled:
  - F-T3-1 and F-T5-1 by 13d Session B (decision 13d-5): "Owed to the club" on the treasurer's Overview through the one
    shared owed reader, doors to each house-league season's Money page, and Revenue's "includes …" caption;
  - F-T3-5 by the earlier "Find" work (BC3a).

  Confirm each in the code, and say so. Don't redraw them.
- **Three known lows bear directly on "a figure on two screens says which it is"** (plan ~L821, ~L836–837). Say whether
  13e takes them:
  - the tournament row is all-time while its "includes" caption is the year's;
  - "Owed" on a closed year is today's figure and doesn't say so;
  - the board export has no "includes" line.
- **F-R3-1's "Email these families".** That is family mail, which has its own path, rules and guards. Recommend whether it
  belongs in 13e or whether the rows only open the registration, and the existing Email families window takes a pre-set
  audience. **Never build a second family sender.**

## What is already built: do NOT redraw

- **13a:** the "not yours" screen, the Organization hub, house league leading for the league admin and registrar.
- **13b:** the club band; the registrar's This morning, including its "Still owing" tile (13e's door may start from it).
  "Find a child" was not built.
- **13c:** the Permits place, the Bill tile.
- **13d** (walk §528 passed):
  - "Owed to the club" on the treasurer's Overview;
  - the doors to house-league Money;
  - "Being billed (draft)";
  - the hand-off notices.
- **13i and the Admin header:** the sidebar's shape and the pinned bar.
- **Drawn already as specimens** (hub content `draw.cjs` / `build.cjs`): reuse them, re-measured against today's frame.
  - **Tab 12 · Homes:** the registrar's "Find a child or a parent" searching every tab.
  - **Tab 16 · Phone:** "To review 15" as a door to the queue.

## Rulings and guards that bind

- **One definition of "owed."** The one-owed-query rule lives in `lib/club-band-read.ts` (~L24–63). These guards must stay
  green:
  - `tests/unit/club-money-one-definition-guard.test.ts` ("do not add a third owed query");
  - `club-stage13d-money-handoff.test.ts`;
  - `bva-figure-doors-guard.test.ts` (every figure on a Budget vs. Actual row opens what's behind it; 13e's Off-plan and
    Not filed doors extend it, not replace it);
  - `money-one-arithmetic-guard.test.ts`;
  - `club-accounting-teams-guard.test.ts`.
- **D1, coach books stay the team's:** a club sees one cash figure per team (`docs/agents/strategy/BUSINESS_DECISIONS.md`
  ~L98, ~L105–109). A door from a club figure must never open a coach's own book.
- **The Budget vs. Actual band is Collected · Spent · Off-plan · Cash on hand, never a season-end forecast** (auto-memory
  `decision_bva_band_collected_spent_cash`).
- **No month control on Budget vs. Actual yet** (hub ALSO T3).
- **Several permits** (`CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` L613): "13e (numbers) … don't touch it." Hold that line.
  If an Off-plan door would open the schedule's Bill window or a "being billed" line, it overlaps work whose owner walks
  (§531, §532) are still owed. That work also re-prices the bill. Say so and stop at the line, or route the door around it.

## Disagree out loud

- **Is 13e still Small?** Nine findings across the registrar, the treasurer, a club tournament and the phone, in at least
  two portals. Count the screens each touches and say the real size and how many build sessions.
- **"One who-owes door"** could mean merging two lists or linking them. Recommend linking first; one definition already
  exists, so a merge is a redesign.
- **Don't widen by accident.** F-O5-6 is the club tournament's book. Find out whether that screen is the tournament admin
  portal or the club's Accounting, and say which. F-R5-4's phone schedule may be the Coaches Portal: if so, it is outside
  13e's club scope. Recommend handing it to the portal's own list.

## Steps

1. **Read** the plan entries above and §11.2's rows, the hub's tabs 12 and 16 and theme 4, the walk notes for R3, R5, O5,
   O6 and T3, `NAV_STANDARD.md`, and the 13d build and closeout prompts' "not in 13d" lists.
2. **Settle the facts from the code** before drawing:
   - what Money's Still owing list and Registrations' Owing filter each read, and whether they agree today;
   - what the Off-plan and Not filed figures are made of, and what the Ledger can filter by;
   - what the tournament book's default window is and where it is set;
   - how registrations search works across tabs;
   - what the registrar's landing holds since 13b;
   - which portal the phone Schedule in F-R5-4 is.
3. **Re-open the evidence** on a **local production build**:
   - `node .probe/p5-prodbuild.cjs start`, port 3100, never the :3000 dev server;
   - build from an upper-case `C:\` path (a lower-case `c:\` build fails hydration on every page);
   - use a fresh Harbourtown copy: `node --env-file=.env.local .probe/nav-journeys/seed.mjs navj-club-13e`;
   - put real counts in the drawing, and remove the copy at the end.

   The `navj-club-13d` copy is still waiting on the owner's word to tear down. Leave it alone.
4. **Draw** as a Claude Artifact, not the design canvas. Use the house layout:
   - sticky numbered tabs, minimal scroll, an *Everything / Show only what differs* toggle;
   - a whole-screen before and after at true size;
   - controls drawn from their shipped components;
   - NEW / RESTYLED / UNCHANGED tags, and every highlight clickable.

   One tab per finding group:
   - Still owing → the registration, and the who-owes door;
   - the Outstanding labels and the installments line;
   - Off-plan and Not filed opening their lines;
   - the tournament book's opening window;
   - search across tabs, and "find a child" on the registrar's landing;
   - the phone schedule, if it stays in 13e.

   Draw desktop and 390 for the registrar and the treasurer.
5. **Asks** for the owner, only what is genuinely open: F-R5-4's home, the three lows, "Email these families", link vs
   merge, the tournament book's opening window. Give each a recommendation and the alternative, numbered for a short
   paste-back.
6. **Run `/ux`, then `/design`**, and apply what they find before publishing. Say what each changed.
7. **Publish** the Artifact once. Do not edit product code.
8. **Hand off in product-owner voice:** what the registrar and treasurer see and do differently, on a phone too, the asks,
   and where 13e sits (after 13d; beside 13f and 13g; before 13h). Record one status-log entry in the plan with the
   Artifact link, and add a 13e line to the TODO Stage 13 entry.

## After the owner rules

Write `CLUB_TIER_STAGE13E_BUILD_PROMPT.md`. It covers:
- the screens, sequenced by portal;
- the guards (the five above stay green; a guard per new door);
- the help articles and demo-tour anchors that name a changed figure or label;
- one QA walk with its own Owner QA Ledger section;
- the staging layout sweep.

Say how many sessions it takes and which screens each touches.

## Do not

- Build or edit product code. Redraw 13a–13d, 13i or the header bar.
- Add a third "owed" query, a month control on Budget vs. Actual, or a door from a club figure into a coach's book.
- Touch the schedule's Bill window or the several-permits work.
- Invent a number. Counts come from the captures or the database.
- Record the owner's answers as anything but what they said.
