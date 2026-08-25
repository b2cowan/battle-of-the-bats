# Fresh-chat prompt — the coach portal's page-title band, on a phone

**Paste everything below the line into a new chat. Run `/design` first.**
**This is a REVIEW + PLANNING session. Do not build anything in it.** It ends in an owner ruling and
a plan, or in a decision to leave the band alone — which is a legitimate outcome.

---

Run `/design`. Then read, in this order, before proposing anything:

- `memory/design_decisions.md` — the top three entries especially (2026-08-24 phone identity bar,
  2026-08-24 pinned column, 2026-08-19 chart palette)
- `docs/projects/active/COACH_ROSTER_PHONE_CHROME_PLAN.md` — the pass that raised this question
- `docs/projects/active/COACH_PAGE_HEADER_CONSISTENCY_PLAN.md` — the ruling that created the band
- `docs/projects/active/COACH_HEADER_VERTICAL_SPACE_PLAN.md` — the pass that already shrank it, and
  the reverted experiment
- `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` §0 — the four house rules for what
  sits in that band
- `components/coaches/CoachPageHeader.tsx` — read the docblock in full; it is the spec

## The question

**On a phone, does the coach portal's page-title band earn its height — and if not, what replaces
it?** It is the largest remaining piece of chrome on every coach screen, and the 2026-08-24 Roster
pass deliberately did not touch it because changing it is a decision about **all ~40 coach screens**,
not one.

## Measured facts — these are real, taken 2026-08-24 from the running build

| screen | 390px | 1440px |
| --- | --- | --- |
| Roster / Money / Schedule | **60px** (44 box + 16 margin) | 52px (36 + 16) |
| **Overview** | **116px** (100 + 16) — its actions wrap to a second row | 52px |

- The help **?** measures **44px on a phone**, 34px on desktop.
- **⚠⚠ THE PHONE BAND'S HEIGHT IS THE TAP FLOOR ON THE "?", NOT THE TITLE.** The box is 44px because
  the "?" is 44px. **Deleting the title text saves nothing.** Any real saving comes from moving or
  removing the **?** and the **+**, or from removing the band entirely. This is the single most
  important fact in this document, and it is why the 2026-08-18 pass moved the phone band by only
  −4px while taking desktop from 80px to 52px.
- The 16px bottom margin is separate from the tap floor and *is* freely reducible.
- ⚠ An earlier estimate of "~72px" (quoted in the Roster plan's §4 and in QA §93) was **high**. The
  real figure is 60px typical / 116px on Overview. Correct those two documents if this session
  proceeds.

## ⚠⚠ The fact that kills the obvious answer

The tempting argument is *"the bottom nav's active pill already names the screen, so the title is a
duplicate."* **That is true for exactly four screens.** The phone bottom bar carries **Overview,
Schedule, Chat, Roster** and then **More**. Every other coach screen — Money, Lineups, Practice
plans, Tryouts, Insights, Documents, Staff, Settings, Tournaments, Skills & Goals, Email families —
is reached *through the More sheet* and has **nothing on screen naming it** except this band.

So "delete it" is not one proposal. It is a proposal to delete a duplicate on 4 screens and to
delete **the only label** on ~35. Any option that removes the band must say what names those 35.

## Constraints that are binding — do not reverse them by accident

1. **All forty screens open the same way** (owner ruling 2026-08-11, built in two passes, QA passed,
   on prod). Whatever is proposed applies to the whole portal or it is not a proposal.
2. **There is no subtitle slot, by construction.** `.pageSub` and `.breadcrumb` were deleted with
   zero consumers so rule 1 has no mechanism left to break. Do not reintroduce one.
3. **The four action house rules (2026-08-23)**: create sits in the band beside the "?" and goes
   first; export never sits in the band; import never on a phone; words become symbols on a phone.
4. **A page needs a heading.** `CoachPageHeader` renders the `<h1>`, and drill-ins render an `<h2>`
   under it. **A screen with no `h1` is an accessibility regression**, not a tidy-up. Any option that
   removes the visible title must say where the accessible heading goes — a visually-hidden `h1` is a
   legitimate answer, but it has to be stated, not assumed.
5. **Space taken by making a thing smaller is kept; space taken by making it disappear and come back
   is borrowed** (owner, 2026-08-19, after a desktop collapse was built, measured and rejected on
   sight). Do not propose a scroll-away band.
6. **The desktop masthead does not collapse on scroll.** Built, measured, rejected. Do not revisit.

## ⚠ Do not conflate this with direction D

**Direction D** is merging the desktop `CoachTopStrip` into the team masthead. It is a *desktop*
saving — the strip is `display: none` below 900px, so D saves **0px on a phone** — and it carries
five conditions listed in `COACH_HEADER_VERTICAL_SPACE_PLAN.md` that any proposal must satisfy.

**This question is a different thing**: the page-title band, which is phone-heaviest. A third option
below (folding the page name into the masthead) *resembles* D and is not D. Name which one you mean
every time.

## What is newly available

The 2026-08-24 pass emptied **the entire right half of the phone masthead** — it is now identity on
the left and nothing on the right, at 56px. That is real estate that did not exist when this question
was last considered. Whether it *should* be filled is exactly what the owner needs to see drawn.

## Draw at least these, and say plainly which you recommend

1. **Leave it alone.** The honest baseline. If the tap floor means the saving is 16px of margin, the
   right answer may be "reduce the margin and stop."
2. **Fold the page name into the masthead on a phone** — identity left, page name right, one bar
   instead of two. Saves the most. Must answer: what happens to the **+** and the **?**, what a
   drill-in looks like, and how a coach knows the difference between the team name and the page name.
3. **Keep the band, move the chrome out of it.** If the "?" and "+" leave the band, it can be a
   short text row instead of a 44px control row.
4. **Anything you think is better.** These three are a floor, not a menu.

## Mockups — required, and this is how

**Publish as Claude Artifacts** and hand over the links; do not describe options in prose alone and
do not write a static file the owner has to open locally. The owner rules from drawings, and the
mockup is the spec once approved.

Each option must be drawn at **390px and 1440px**, and — because "all forty screens" is the binding
constraint — each must be shown on **all five shapes the header actually takes**, which are the
component's own variants, not a sample:

- a hub with a create action and the "?" (**Roster**)
- a hub with **no actions** (a read-only assistant's view)
- **Overview** — the 116px worst case, where the actions already wrap
- a **drill-in** (Money → Fundraisers → one drive) — smaller tile, `h2`, no "?"
- an **embedded** hub tab (a Money tab) — actions only, no identity

Make it interactive where that helps the owner judge (a width switch, an option switch), include the
warm and dark skins since warm is the portal default, and **measure the bands in the drawing itself
rather than asserting numbers in prose**.

## What good looks like

An owner ruling, a plan + PM brief pair in `docs/projects/active/`, a TODO line, and a decision-log
entry. **No code.** If the honest recommendation is "leave it", say so and write that down — a
measured "no change" is a real result here, and the 44px tap floor makes it a live possibility.
