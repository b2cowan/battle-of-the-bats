# Practices: the room opens on the next practice, and becomes the home for templates and drills

**Product brief · 14 September 2026 · stages 0 and 1 of a seven-stage re-evaluation · stage 0 ruled, built, walked (QA §186 passed 24/24) and committed; stage 1 ruled and built on dev 2026-09-14, walk owed (§188)**
Companions: [plan](COACH_PRACTICES_REEVALUATION_PLAN.md) · [the walk and every stage's proposal](https://claude.ai/code/artifact/5c3d2f1b-5159-4d99-bad7-c48b2820da28) (one artifact: the walk, each stage's before/after, the decisions, the plan, this brief, the QA walk)

## Why

A coach opens Practice plans to answer one question — *what do I still need to do before the next practice?* — and the room did not
answer it. It opened on a filter chip and a list of eight rows; the chip counted practices that had already happened (in September it
said three needed a plan, all in May); a past practice was offered "Plan this practice"; and the coach's library lived in another room
named for player development, where the drill library's only door had just been removed. The wider re-evaluation found a bigger shape
problem on the plan page itself (a form where a document should be) — that is stages 1–3. Stage 0 fixes the front door.

## What changes (stage 0)

| Change | What the coach sees and does | Benefit |
|---|---|---|
| The next practice is a card | Practice plans opens on one card — when, where, the practice's name, whether it has a plan — carrying the room's one lime button: **Plan this practice**, **Open the plan**, or on the day **Run practice**. | The one row a coach came for is the first thing on the screen, with the one thing to do. |
| The count means what's still to come | "Needs a plan" counts upcoming practices only, and disappears at zero. | The room stops nagging about May. |
| The past reads as a record | A past practice with no plan says "No plan written · Open" (never "Plan this practice"); a practice the coach wrote up shows the first line of "How it went" on its row. | Looking back over the season stops being a click per row. |
| The row says how the plan fits | "3 blocks · 60 of 90 min" when the practice has an end time. | A 20-minute plan on a 90-minute practice no longer reads like a full one. |
| One room, three tabs | Practices · Templates · Drills. The two libraries move under Practice plans exactly as they were; Skills & Goals keeps metrics, goals and sessions. Old links land in the right place. | The library lives where it is used; drills get their door back. |
| A shorter first screen | A new team reads one headline, one sentence, the arc *Schedule it → Plan it → Print it or run it → Write how it went*, and one button that opens the Add Practice form directly. | Half the words, one tap fewer. |
| The Overview knows | When the next event is a practice, the Overview's card offers Plan / Open / Run by state; attendance stays as the quiet link. | The first screen a coach sees points at the right thing. |

## Who sees what

Writing a plan, a drill or a template needs *Schedule: View + edit* (unchanged). Everyone with schedule access sees the Practices
tab and can open and print a plan. An assistant with schedule view only sees no Templates or Drills tab — the libraries would refuse
them, so the doors are absent rather than dead. Nothing here changes what is included in Premium.

## Tradeoffs and calls made

- The no-plan card carries **one** action. A "Start from a template" link was drawn beside it; building it means changing the plan
  page, which is stage 1's work. Dropped for now, easy to add then.
- The card takes the shape of the Overview's existing "one thing" card so the two look like one thing.
- A past practice's row now says "record", but the page behind it is still today's editor until stage 1 draws its read-only face.

## Success criteria

- A coach opening Practice plans sees the next practice and its one action without scrolling, on desktop and phone.
- "Needs a plan" never counts a practice that has passed.
- No past practice anywhere on the hub is offered "Plan this practice".
- Templates and Drills are reachable from Practice plans in one tap; every old link redirects; a schedule-view-only assistant sees neither tab.
- The Overview's card for a practice offers the plan (or the run screen on the day), not attendance, whenever the coach can act on it.

## Stage 1 — The blank page: the plan page is a document

**Ruled 2026-09-14 (all nine as drawn) · built on dev the same day · QA walk owed (§188, the artifact's "QA walk · 1" tab)**

### Why

A coach opening Tuesday's practice for the first time met a form: three questions (goal, tags, equipment) before a minute of
practice was written, no sign of how long the practice was, a rail of twelve "Nothing set yet", a box for how it went before it
went, and "Add a block" as one secondary button among four. A three-block practice was 6,627 pixels tall and fifty-nine inputs.
A practice plan is a document — the product already drew one, on paper. The screen now has the sheet's shape.

### What changes (stage 1)

| Change | What the coach sees and does | Benefit |
|---|---|---|
| The page is a sheet | A letter-wide white page with a rule under its head, a time gutter down the left, blocks as rows. | What the coach prints is what they are looking at. |
| The first line is when, and how long | "Tue, Oct 27 · 6:00 p.m.–8:00 p.m. · 120 min", then "0 of 120 min planned · 120 unplanned" — the unplanned figure in amber, "10 over" when the plan overruns, "no end set · Set it on the schedule ›" when the practice has no end. | The one number every block is built against is the first thing on the page. A coach filling ninety can see they have filled sixty. |
| The goal is one line; tags and equipment fold away | "Tonight: …" above the timeline; "About this practice" is a shut line that reads the tags and equipment once set. | The first-time coach is no longer asked to classify a plan before writing it. Nothing is removed. |
| The first block is the page's one lime | A ghost row at the start time: **+ Add the first block**, with "start this plan from…" and "a drill from your library" as quiet alternatives beside it. Pressing it writes the block, open in place, ready to type. After that, a quiet "+ Add a block" at the next time. | One earned action per screen; one tap to writing. |
| A block is a row that opens in place | Shut: title, its first line, who, how many coaching points. Open: the block as it was, on the paper ground. One open at a time. | Three blocks read as three lines, not three cards. The block's insides are stage 2's. |
| The rail is a fold, shut | "What everyone's working on · 1 of 12 has a focus area · Open ›" — opens to the same rail. | The rail stops being the loudest empty in the portal; nobody is hidden. |
| "How it went" waits | Absent until the practice has started; one italic line says so. | The page stops asking how it went before it went. |
| The way back is Practice plans | The back arrow returns to the room; "View on schedule" stays in the sheet's head. | The room is the front door (stage 0). |
| A practice needs an end time | The Add Practice form's **Ends** is required for a practice (**End time** on a repeating series); an end before the start is refused in words. Games are untouched. | The sheet's first line, the unplanned figure and the hub's "60 of 90 min" all rest on it. |
| A template is the same sheet | No people, no clock — the gutter shows each block's length. | One editor, one shape. |

### Who sees what

Unchanged: writing needs *Schedule: View + edit*. A coach with schedule view only gets the sheet read-only — rows that open to
read, no ghost row, no "Save as template…"; Run practice and Print the sheet stay. The players' goals stay readable on the plan
page (folded) and on the printed sheet, for whoever could see them before.

### Tradeoffs and calls made

- **The title stays in the page header** with the back arrow, rather than inside the sheet as drawn — the portal has one page
  header per page; the sheet opens on the when-line instead.
- **The lime writes a block directly.** "Add a block" used to open the drill picker first; the picker is now the quiet link beside it.
- **"Start this plan from…" is offered on the blank page only** — it used to replace a written plan silently.
- **The toolbar** (Run practice · Save as template… · Print the sheet) appears once a block exists; the blank page has none.
- **A past practice with no plan still opens the editor** — stage 6 draws the record's face. **Print is still the PDF** — stage 5.

### Success criteria

- A coach opening a blank practice sees when, how long, and one lime, above the fold on desktop and phone.
- The first line's arithmetic follows every block edit; a plan that overruns says so.
- Nothing about a block's insides, the drill rule, autosave or people-at-one-level changes.
- No practice can be added without an end; no game gains a requirement.
- "How it went" never renders on a practice that has not started.

## Stage 2 · The block — RULED 2026-09-15 (all eleven as drawn) · BUILT ON DEV the same day · walk owed (§190)

**What changes for a coach.** Opening a block today means eight questions, every time — minutes, rest-of-practice, description,
goal, staff, players, coaching points, stations — so a written warm-up stands 743px tall whether or not it will ever have staff or
points. The proposal: a block opens to **four things** — its title, a clock row, *What you're doing* and *What you're watching
for* — and everything else waits as a quiet door at its foot (*+ Coaching points · + Staff · + Players · + Stations*), appearing
the moment it holds something. The clock row carries five quick lengths (5 · 10 · 15 · 20 · 30), *Rest of practice*, and the
consequence — "ends 6:15 p.m." A block asks for the same three things a station does, in the same words, so the plan, the field
screen and the drill library stop calling one idea two names. The shut row loses its coaching-points count and its "Who:
everyone" (the row says who only when it isn't everyone). A block placed from a drill stops showing three empty questions above the
drill's own text. And Escape closes every sheet on the page — the one logged defect this stage can fix cheaply.

**What does not change.** The words a coach has already typed (the two fields stay two — the "watching for" line is the one the
field screen shows in bold at arm's length, and that stays); autosave and "emptiness discards nothing"; a drill's read-only rule;
reorder by arrows; the printed sheet (one word: its block line says "Watch for:" as its station lines already do) and the run
screen. No migration. Stations, the rotation and the groups grid are stage 3's; the library and drag are stage 4's. **Eleven
decisions** are put to the owner in plan §5.3, each drawn before/after at true size on the hub’s "2 · The block" tab with a
recommendation — the tenth, added when the drawings were measured, makes coaching points one field (one per line) because the
doors alone took a written warm-up from 691px only to ~600. Two owner calls on 15 Sep are drawn in: every block says who it is for — **Whole team** until names are chosen, never a number (attendance already answers "how many are here"); and kit lives at exactly one level, the activity's (on a block with no stations; on each station once it has them — the same rule as players), with the practice's list at the top reading as the bag — everything below plus extras. Code follows the rulings.

**Built, 15 September — what the coach sees now.** Open a block and it is four things: the title, one clock row, *What you're doing*,
*What you're watching for*, and a Players line that reads **Whole team** until names are chosen. Under them one quiet line of doors —
*+ Coaching points · + Staff · + Equipment · + Stations* — each becoming the field when pressed; whatever the block already holds is
always shown. The clock row: quick lengths as chips (15 pressed on a new block), the minutes, *Rest of practice* as a chip that is
simply absent while another block holds it, and "ends 7:15 p.m." / "runs to 8:30 p.m." Coaching points are one box, one per line.
The shut row: title · first line · "3 stations" · Whole team or "6 players" — nothing else. A block placed from a drill opens straight
onto the drill's words. Equipment lives at one level: on the block while it has no stations, and the moment a station arrives the
coach **watches the kit move** onto it (or up into the practice's own list when the station is a drill) — nothing vanishes; the
practice's equipment line under About is the bag (everything below, plus what the coach adds at the top). Escape closes every
sheet and puts the coach back where they were — and fixing that surfaced a bug in the shared dialog floor that every dialog with
an autofocused field had. **Measured on the build:** the fixture's written warm-up 682px open at desktop (drawn 579 — the
fixture carries a Staff line the frame did not); the drill-placed block 1,033 (drawn 922). **Two things to look at on the walk:**
the block is 240px wide on a phone, not the frame's ~290, and its title field is narrow beside the three head buttons — both stage
1's sheet, one line each to change. The walk is the hub's "QA walk · 2" tab (34 steps, eight parts), ledger §190.

## Stage 3 · Stations and the rotation — DRAWN 2026-09-15 · not ruled

**The question first:** a block with one station — does it flatten into the block (the drill's words as the block's body; recommended,
567px against 922 today) or keep its card? Then: stations side by side as columns under their block (rows on a phone), each showing
its name, who runs it and tonight's note and opening for the rest; the rotation as **one line** (rotates · every N min · the rounds
that makes · the draw as one control); the grid under the columns **in the same columns**, so reading down is one station's evening;
coaching points as one field on a station and in the drill library; and people moving the way kit does when a station arrives,
never silently deleted. The circuit block measures 4,083px on the fixture today; the drawing is 835. Eight decisions with
recommendations on the hub's "3 · Stations and the rotation" tab.

## What comes next

The stage 2 walk (§190) and its commit on the owner's word; the stage 3 rulings on the hub; then the stage 3 build in a fresh chat.
