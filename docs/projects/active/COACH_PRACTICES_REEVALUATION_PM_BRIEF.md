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

## Stage 3 · Stations and the rotation — RULED 2026-09-15 (D4 as revised) · BUILT ON DEV 2026-09-15 · §192 walk COMPLETE 2026-09-15 · commit owed

**What a coach sees now.** A block with **one** station stops being a list of one: the drill's words sit right under the clock
row with *Edit just for this practice · Swap drill* beside the provenance line, Players reads *Whole team · Choose players…*, and
Staff, Just for tonight and Stations wait as doors — no "Stations" heading, no numbered card, no second bin. A circuit's stations
stand **side by side as columns** (name · who runs it · an amber "Tonight: …" · the first line · *Open ›*), with "+ Add a station" the
last column; three fit at a glance, the rest wrap, and on a phone they stack as rows. Above them the rotation is **one line** — a
pressed **Groups rotate** chip, *every 15 min*, and the honest arithmetic ("3 rounds of 15 = 45 min", or "45 does not divide by 20 —
2 rounds and 5 min over") — with the draw as **one control**: "3 groups ▾ · from who replied · Draw". Under the columns the grid
**turned**: rounds as rows with their clock, the stations as columns, so reading down a column is that station's whole evening;
the groups are listed under it with an *edit* into the same picker. **Tap a column and the station opens as a modal** (the D4
revision — the owner's read of the built draw showed that "see where you are in the sequence" is a reason that holds for blocks,
which run in order, and not for stations, which only share a clock), with every field on one sheet and a **stepper in the foot** —
"‹ Footwork ladder · 2 of 3 stations · Finishing ›" — the money room's own Prev/Next, stopping at the ends; ← / → step too; Escape
closes and puts the coach back on the column. Coaching points are **one field** on a station and in the drill library, as on the
block. And **nothing typed vanishes**: name six players on a block and add a station — they move onto it; turn rotating on — they are
dealt into the first groups; turn it off — each group lands on the station it started at; remove the last station — they come home.

**Why it matters.** The circuit's open block was 4,083px tall on the fixture — a panel of controls above three stacked cards above a
grid nobody scrolled to. It is 1,140 now with the grid AND the groups on the block, and the whole evening reads in one screen. The
one silent delete the sanitiser still had is gone.

**Measured on the build:** the drill-placed block 618px open (drawn 567); four 180px columns at desktop, three 168px at 768 with the
add column wrapping, stacked rows at 390; the modal 640 wide on a desktop and a full-screen sheet on a phone. **Two things for the
walk:** a block's only station cannot be removed on its own (as ruled — the block's bin is the bin; say if it should keep a quiet
Remove after all), and the strip wraps onto several lines on the phone's 240px block. The walk is the hub's "QA walk · 3" tab
(30 steps, nine parts), ledger §192; no migration, no new key on the plan.

## What comes next

The stage 3 commit on the owner's word. **The §192 walk is complete (2026-09-15) and sent one thing forward:** a block the
coach wrote without stations — a title, what you're doing, what you're watching for, coaching points, equipment; the most
common kind — has no *Save to my drills…* door, because the door lives on a station. That block is a drill in everything but
name, so the library stage decides whether the door comes to it (recommended: yes). Also open: the groups board drawn on the
stage-3 tab after the build (where groups are edited, drag between groups, a "Not in a group" row, one draw menu — D9–D12,
to rule), and whether a lone station keeps a quiet Remove (G1). **Next: stage 4 · The library — planned and drawn first,
then ruled, then built** (kickoff prompt `COACH_PRACTICES_STAGE4_PLANNING_PROMPT.md`): browsable rows for drills and
templates, the library beside the plan on desktop, the owner's ruling on drag (S.4 — ruled together with the groups board's
D10, one reason at two scales), empty templates no longer offered as starts, and the drill editor's shape.

## Stage 4 · The library — RULED 2026-09-16 (L1–L8 as drawn; L9 in words) · BUILT ON DEV 2026-09-16 · COMMITTED `34bb88f5` · walk owed (§195)

**What a coach sees and does differently.** The Drills and Templates tabs become tables you can actually browse: a drill row
reads its name, its tags, how long it usually runs, "In 8 plans" and the first line of what you're doing; a template row
reads its name, its tags, the titles of its blocks and its length. Click a row and the thing opens — there are no Edit and
Retire buttons on every row any more; Retire lives inside the drill's sheet, beside Cancel and Save. On a phone a row is as
tall as its words (today every row is 267px, even an empty template — twenty templates are 5,300px of scroll). On a wide
desktop the library sits beside the plan: the sheet returns to its letter width, the panel takes the rest, and a drill is
dragged onto the page — between two blocks to become a new block, or onto the open block's "+ Add a station" to become a
station — while "Add" on every row and the sheet still do the same for a keyboard, a tablet or a phone. A block the coach
wrote can be kept: *Save to my drills…* appears at the foot of a written block with no stations, and the drill takes the
block's minutes as how long it usually runs. An empty template is no longer offered as a start (making one is still
allowed — the template editor is a good blank page). The drill sheet is the station modal's shape with the library's two
facts first. The provenance line is one sentence. The hub's past list loses its six-row cap behind one quiet door;
Practice review stays under Insights.

**Why.** Week three: Tuesday should start from last Tuesday, and the ladder drill written once should be there next time.
The library moved under Practice plans at stage 0; this stage makes it readable, reachable from the page, and complete —
the §192 walk's finding (the bare block with no door) was a coach doing the most ordinary thing and finding the product
had no answer. Drag was ruled first, on the groups board (D10 — people between groups, in the Groups room) — one question
at two scales, one reason: a plan is written at a desk; the field and the phone keep their buttons.

**Measured (true size on the hub).** The Drills table of five rows 285px against 88px per card today; the Templates table
309px; the docked pair at 1440 — the sheet 816 wide at 576px, the panel 320 wide at 738px (the pair is exactly the
header's 1,156 column); the drill sheet 653px against 867 today; the bare Warm-up block open with its door 507px; five phone
cards 395px against 267px per row today.

**Decisions to rule (L1–L8, printed D1–D8 in the paste-back).** The bare block's door · drag as an addition on desktop ·
the rows as tables (with the row-actions call inside it) · empty templates kept but not offered · the docked panel (A
recommended; B, a drawer, drawn) · the drill sheet's shape · the one-sentence provenance line · no fourth tab, the past list
uncapped. Then the build prompt, then the build.

**Ruled 2026-09-16 (owner, in chat: "so this mockup looks great, I approve everything as designed thus far") — L1–L8 as
drawn.** On the ruling the owner asked for the one thing still missing between a drill and a template: **a saved circuit** — a
block with stations a coach can keep and drag onto another practice, alongside each station saved as a drill. Drawn as L9
the same day and ruled in words: the block's foot door reads by shape (*Save to my drills…* on a plain block, *Save to my
circuits…* on one with stations); the save asks two optional questions — tags, and "also save its written stations as drills"
(the saved circuit then points at those drills; tonight's block is left exactly as it is); a fourth tab, **Practices ·
Templates · Circuits · Drills** (a size ladder); the docked panel switches Drills · Circuits; a circuit drags into a gap and
lands as a whole, editable block — its stations and rotation, never its people — with "Started from Skills circuit · changes
here stay here". A circuit follows the template's rule (scaffolding), not the drill's. It is the stage's one migration.

**Built on dev 2026-09-16, as ruled.** What a coach has now: the three library tabs are tables where the row is the door
(a drill row: name · tags · the first line · how long it usually runs · which plans; a template row: name · tags · its
blocks' titles · length · how many plans it started; a circuit row: name · tags · its stations' names · usually · plans),
with retired things under "Show retired" and Retire moved into the drill's sheet and the template's and circuit's own
header; the drill sheet is the station's shape; a written block keeps as a drill with its minutes, a block with stations
keeps as a circuit with two optional questions (the tick makes the drills first and points the circuit at them; tonight's
block is untouched); on a wide desktop a **Library** button beside the plan docks the drills and circuits next to the sheet
(remembered on that computer) and, with a mouse, a row drags into a gap or onto the open block's stations and a block
drags by its start-time cell — while every drop has a button that does the same, and nothing lifts on a phone; a circuit
placed on a plan is editable and says where it started; an empty template is not offered as a start; the provenance line
is one sentence; the hub's past list is six with "Every practice this season ›" under it. **Measured against the frames:**
the docked pair at 1440 is the sheet 816 · a 20px gap · the panel 320 — exactly the header's 1,156 column; the library
rows 88–89px on desktop, phone cards 97–116px against the 267px rows they replace; the drill sheet 640 × 744. Simplified,
reviewed (five lenses; the one High — a press on a reorder arrow that drifted became a drag — fixed and proven) and the
help synced (a new Circuits article; the drills article no longer promises "four taps"). **What is owed:** the owner's
walk on the hub's "QA walk · 4" tab (32 steps; ledger §195) — the build is committed (`34bb88f5`, 2026-09-16) — and
migration 302 on prod before the code that reads it.

## Follow-up on the stage-4 build · the library's columns — RULED and BUILT 2026-09-17 · walk owed (§199, part J of QA walk · 4)

**What a coach sees and does differently.** Every library table — Drills, Templates, Circuits — now has **a "Last
planned" column** (the date of the newest practice the thing is in) and its **count column reads the figure** ("8
plans", "1 plan") with a dash where there is nothing to count, instead of "Started 1 plan · last May 19, 2026" in one
cell. **Every column heading sorts on a click** — names A–Z, minutes shortest first, counts most first, dates newest
first — and a second click turns it round; the arrow marks the column in charge; rows with nothing to sort by sit at
the foot whichever way it points; the choice is remembered on that computer, per tab. The tab still opens the way it
did — names A–Z, club drills first — and says nothing on its own until the coach asks. On a phone, where a table is a
stack of cards with no headings, a **Sort** menu sits beside the Tags filter with the same choices and reads its own
choice ("Sort · Plans"). Tags stay beside the name, as built.

**Why.** The owner's ask on the built Templates tab: "the most recent, frequently used, hitting items" — and the
honest answer was that the count was already there, the date was welded to it, a drill had no date at all, and
nothing sorted. Sorting a coach's own library by how often they planned something is the coach asking a question, not
the product ranking their ideas — the "never by use" line the build carried was the no-ranking rule (which is about
children) stretched one level too far, and the past-season import had ordered by plan count since it was built. The
word is still **planned**, never *used*: nothing records what was actually run, which is also why the count says
plans.

**Two reconsiderations on sight, both the owner's.** The count cell lost the word "Started" (the heading already says
it; a dash at zero, like Length). And the Tags column, drawn first, came out: it took about 170px from the line under
the name — the stations' names, the blocks' titles, a drill's first line — which is the fact that makes a row worth
browsing, and "which of these are hitting" is the Tags filter's job. Five columns per tab, not six.

**Also fixed on the way.** A drill placed at two stations of the same practice used to count "In 2 plans"; it is one
plan now, which is what the words always claimed.

**Success criteria.** A coach on a laptop can click *Last planned* and see what they planned most recently at the
top and the never-planned at the foot, click *Plans* and see their staples first, and come back tomorrow to the same
order; on a phone the Sort menu does the same; nothing on the page ranks anything until they click. **What is
owed:** the owner's walk (part J on the hub's "QA walk · 4" tab), then the commit on the owner's word.

## Follow-up on the stage-4 build · "Save to my circuits" chooses its stations — RULED and BUILT 2026-09-17 · walk owed (§200, part K of QA walk · 4)

**What a coach sees and does differently.** The save dialog's tick — *Also save its N written stations as drills,
with these tags* — is unchanged until it is pressed. Pressed, the run of names under it becomes **a row per station
they typed, each with its own tick, all on**; untick the ones not worth keeping (the block that prompted this had three
keepers and three called *test*) and the master shows a dash; one press on the master turns everything on, or off.
Only the ticked stations become drills. **A typed station whose name is already one of their drills is shown, not
hidden** — its row carries a muted note, *already in your drills — the circuit uses that one, with its words*; kept
ticked, the saved circuit's station genuinely becomes that drill (its words, its tags), and unticked, tonight's words
stay as a plain station with no link. **One quiet line under the tick names the stations that came from the
library** — *Footwork ladder, Close control and Finishing came from your drills and stay linked.* — the answer to
"does it know which are already drills"; it is absent when every station was typed. Tonight's block is untouched
either way, as it always was.

**Why it matters.** Before, the tick was all or nothing: keeping three good stations meant saving three junk drills
too, or three more dialogs. And the dialog already knew which stations were drills — placed ones, and typed names it
already held — but said nothing, so names vanished from the list with no reason given; worse, a typed name that
matched a library drill was quietly pointed at that drill while keeping tonight's words, so the circuit's station
claimed to be a drill it did not read as. Now the coach chooses, the dialog says what it knows, and a linked station
is honestly its drill.

**Tradeoffs and calls made.** The dialog was built to ask one optional question; the rows are a third only for the
coach who ticks — the fast path (one tick, everything) and the untouched dialog are exactly as they were. Rows are
checkboxes, not toggling chips (a chip is the filter idiom, and a matched name needs room for its note). The matched
row defaults to *on* because that is what the tick asked for and what a save that failed midway needs on its retry.
A row is 36px on a desktop and takes the 44px floor on a phone or tablet. No migration; the help's circuits article
gained the rows and the two notes.

**Success criteria.** A coach with a six-station block keeps three as drills and leaves three; a coach who types a
name they already have sees it named on its row and decides; a coach who built the block from library drills reads
one line saying so and is asked nothing. **What is owed:** the owner's walk (part K on the hub's "QA walk · 4"
tab), then the commit on the owner's word.

## Stage 5 · Paper & the field — DRAWN 2026-09-17 · RULED 2026-09-17 (P1–P9 all as drawn) · BUILT ON DEV 2026-09-17 · walk owed (§201, the hub's "QA walk · 5" tab) · commit owed

**What a coach sees and does differently.** The printed sheet becomes the print of the screen: the rotation grid
prints with the stations across the top and the group in each cell (two stacked when they share, a "Sitting out"
column only when someone sits a round out, turned on its side when the coach's station names cannot fit across the
page — which then reads "where is my station all night", the station coach's own question); each station is a
short labelled block an assistant can find and read — name and who runs it, then Setup, Equipment, Tonight, and the
points as a list — instead of one run of facts that wraps mid-item; "Whole team" prints where the paper printed
nothing; and "Arrive 5:45 p.m." prints where the paper printed "Arrive 17:45". On the field, the door to the run
screen follows one rule everywhere — three hours either side of the start, once there is a block — including the
Schedule's panel, which today offers it at any date (the next practice, five days out, currently reads "122:36:04 ·
LEFT OF 20 MIN"); outside that window the run screen says what it knows — "Planned for Tue, Sep 15 · 5:01 p.m." —
and stops counting the seconds. The plan page earns a lime *Run practice* back, inside the window only. A rotation
reads as one list keyed by station — the group letter, the station, who runs it, and the door to that station on
the same row — six rows where today there are six cards and then the same six names again; when the round runs
over, the head goes amber and each row shows the letter that arrives, never one sentence of six moves. A plain
block says who runs it. During the window, the running block's gutter on the plan page reads "now · 5:37", so a
tablet on the bench reads the sheet with the clock while the phone keeps the run screen.

**Why.** Two documents for one plan was the walk's headline; stage 1 made the screen the sheet, and the paper was
left to this stage. The screen turned its grid to stations on 15 Sep and the owner asked on the 16th why the paper
had not. The run screen is right in every way that matters and wrong in five small ones that add up at the field:
a door with no rule, a counter with no meaning outside the night, twelve chips for "everyone", nothing about who
runs a block, and a rotation that says every station twice.

**Measured.** The rotation panel at 390: 792px drawn against 1,319px today (913px in the amber state). The paper's
grid at letter width: six stations fit at 8pt on the fixture; about seven at 7pt for ordinary names; past that,
sideways. The stations as labelled blocks cost space — on the fixture's six-station circuit the last block moves
whole to a third page (the seeded three-station circuit stays on two) — stated on the tab, not hidden.

**Trade-offs and close calls.** Keeping one PDF renderer as "the print of the screen" (P2) rather than printing
the page itself — the page-print loses the team's paper, true page numbers and the rendered check that proves every
document on every commit. The plan page's door (P4) — argued for from where the coach actually stands at 5:45 p.m.,
against a fifth door and the stage-1 removal. The now-marker (P9) — small and honest, but it is the plan's now, not
the coach's taps, and a late start makes sheet and phone disagree by the minutes behind. One word for everyone is
the plan page's "Whole team", not the walk's "Everyone". "Planned for", never "Ran" — the product never says done.

**Priority.** Stage 5 of 6; next after the stage-4 walks. **Success criteria.** The sheet and the screen show the
same grid; an assistant finds their station on the paper without reading a paragraph; no screen offers the field
door outside the window and no run screen counts days; a six-station rotation fits one phone screen with the button
above the fold; a hand-arranged round reads the same on the sheet, the phone and the paper.

**Built 2026-09-17, as ruled.** What a coach sees now: the printed sheet is the print of the screen — the rotation
grid reads stations across the top with the groups in the cells (two stacked when they share, a dash for nobody, a
"Sitting out" column only when a round has one, a long station name wrapped onto two lines rather than running into
its neighbour, the grid on its side when the names cannot fit), each station a short labelled block (name · Run by;
Setup · Equipment · Tonight as lines; the points as a list), "Whole team" where nothing printed, "Arrive 5:45 p.m."
where "17:45" did. One rule for the field door everywhere — and, found by the review, that rule now runs to three
hours after the practice ENDS, not just after it starts, so a four-hour practice keeps its doors and its clock to the
last minute. The plan page's toolbar carries a green Run practice first, on the day only; the Schedule's panel offers
it on the day only. Outside the window the field screen stops counting and says "Planned for · Tue, Sep 15 ·
5:01 p.m." (before a practice, "The clock starts 2:21 p.m.") — never "ran" — and no clock survives anywhere on the
screen, the station view included. On the field a rotation is one list, a row per station, each row the door; a
plain block says who runs it and "Whole team" (or the few named, as chips); the station view's note is labelled "Just
for tonight". During the window the sheet's running block says "now" in its time gutter with the clock, the spine's
dot filled — the tablet on the bench reads the sheet while the phone runs the field screen.

**One visible difference from the frames, flagged before the build:** the gutter's marker is two lines — "now" over
"5:37 p.m." — not the drawn "now · 5:37": the clock keeps its period everywhere a coach reads one, and that does
not fit the gutter on one line. A one-line change if the owner prefers the bare clock.

**Found on the way and fixed in the same work:** the Overview's call-time chip and the game console's "Arrive" chip
carried the same raw "17:45"; the Schedule's game-day pill now reads a minute clock (a tab left open shows the door
when the window opens); the timeline's drag gap sat 12px off the spine on a phone. **The rendered check gained a rule
that fails any two runs printing over each other** — the class of defect that turning the grid could have introduced
and nothing caught — with two mutations that prove it bites. No migration, no new route, nothing written at the
field. Verified: 4,152 unit tests, the rendered check on 23 documents, the layout sweep on the four screens at four
widths, a Playwright probe on the fixture inside and outside the window; the printed sheet read back from the plan
page's own Print button. **Walk:** the "QA walk · 5" tab on the hub — 26 steps in six parts (the paper · the field
inside the window · outside it · the doors · the now-marker · the station's label) — ledger §201.
