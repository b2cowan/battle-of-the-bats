# Design Decisions Log

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-08-20 — Pitch slides: ONE fixed picture frame, contain-never-fill — and the picture leads on a phone

**Decision (/design review of the slide format, ahead of the slide library build):** every pitch slide is one layout — a mono kicker, the pain, a second kicker, the answer, and a **single fixed 16:10 picture stage**. The picture is *contained* inside that stage, never stretched to fill it. At phone width the stage moves **above** the words and takes the full column.

**Rationale:**
- **A fixed stage is what lets three different kinds of picture share a deck.** The library carries raw captures (tall, phone-shaped), cropped-and-marked captures (wide, short) and drawn explainers (arbitrary). Sized to their own content they produce three different rhythms and the deck reads as assembled from parts. Contained in one frame, they read as one system — and the full dues table stays legible precisely *because* it is contained rather than stretched.
- **The phone rule is not new; it is an existing principle applied to an image.** The 2026-08-08 day-of toolbar ruling already binds: when a layout wraps into a stacked column, elements take the full row rather than keeping their desktop intrinsic width. A picture squeezed into a phone-width column beside text is the same defect as a lone narrow select in a column of full-bleed siblings. Measured on the shipped coach walkthrough at 390px: both captures render at **~16% scale and are illegible**. This rule is the fix.
- **Body copy is set in the sans face, not the data face.** Mono at paragraph length is a large part of why the first slideshow attempt read as cramped. The mono kickers stay — they are the established single labelling convention (2026-07-14 G4).

**⚠ SYSTEM EXTENSION, FLAGGED AS SUCH.** No fixed aspect-ratio convention exists anywhere else in the platform. This introduces one, scoped to pitch surfaces only. It is not a token change and adds no custom property.

**⚠ RIDER — RAISED, NOT RULED: lime is overspent on the shipped walkthrough panel.** The binding rule (2026-07-06, generalised) is that **lime marks exactly one recommended action**. The shipped panel currently puts lime on five elements: Start free, the demo door, the "With FieldLogicHQ" kicker, "See this screen live", and the printed address. On a **slide** this is defensible — a slide carries no call to action at all, so lime can mean "this is the answer" without competing with anything. On the **scroll page** it competes with the ask. The format is ratified as-is; the page's lime spend is left as an open question for the owner to judge on the real page rather than in the abstract.

**Applies to:** the pitch-slide format (the slide library build, and `components/marketing/WalkthroughPage.tsx` which will render from it). Library + decks: `docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md`.

---

### 2026-08-20 — Pitch artifacts print DARK, one slide per page — the leave-behind is an emailed PDF, not paper

**Decision (/design review, ratifying an undocumented build-time choice):** the print rendering of a pitch surface keeps the dark ground and forces background printing, lays out **one slide per page**, keeps every picture at full size, hides all interactive furniture (buttons, demo doors, the present-mode trigger), and prints the page's own web address at the end so a reader can find their way back.

**Rationale:**
- **The artifact is a PDF that gets emailed after a meeting, not a sheet someone runs off.** On the realistic artifact the dark ground is correct; the alternative — inverting to a light ground — would mean the pictures (warm product screens on a dark page) sit on a third ground they were never composed against.
- **Without forced backgrounds the page prints near-white text on white and is simply blank.** That is the failure this rule prevents, not a stylistic preference.
- **Recorded now because 21 slides are about to inherit it.** This behaviour was decided mid-build for the tournament walkthrough on 2026-08-20 and existed nowhere in this log — there is no print decision on record anywhere in the platform. A convention that only exists as one build's CSS is a convention that the next build re-invents differently.

**Known and accepted:** the site's global navigation prints on the first page and the footer on the last. Hiding them needs a global print rule with shared-chrome blast radius; deferred until the PDF is actually put in front of a buyer (recorded in QA §65 Part B and §66).

**Applies to:** pitch/leave-behind surfaces (the walkthrough pages today, the slide library next). Not a platform-wide print rule — no other surface has one, and this entry deliberately does not create one.

---

### 2026-08-20 — ONE CONTROL SHAPE ACROSS THE REPORTS, AND A RULE STRUCK THAT WAS NEVER THE OWNER'S

**Supersedes the "two or three fixed options → pills stay" bullet in the 2026-08-19 entry below.
That bullet was never an owner ruling.** It was written into `COACH_PAYABLES_REBUILD_PLAN.md` §7
underneath the owner's actual instruction, copied into this log as though it carried the same
authority, and then — on 2026-08-20, during the Payables P3 design pass — **quoted back to the owner
as his own standing rule.** He did not recognise it: *"I don't remember explicitly saying this…
you can remove it."*

⚠⚠ **The failure is the one `AGENCY_RULES.md` already names: argue from what the code does, never
from what a plan claims it does.** A plan quoting itself back as a ruling is that same failure with
better manners, and this log is exactly where it becomes load-bearing — an invented bullet sitting
in a file headed "binding in future sessions". **When recording a convention here, record what the
owner said and mark everything else as the agent's inference.**

**The convention, as the owner actually left it:**

- **One control shape across every reporting surface:** a labelled pill that opens a small list.
  A narrowing is multi-select with **counts on every option**, computed before the current selection
  narrows further; its summary reads **"2 selected"** when a real default is in force, never "All".
  An arrangement is single-select.
- **An ARRANGEMENT is not a filter.** It says `Group by` (or `View`), sits **first**, and carries the
  accent, so it can never read as another narrowing.
- **Short lists are a judgement, not a rule** (owner, verbatim): *"for small lists we can review on a
  case by case basis but no need for a hard rule. There is value to less clutter too — 5 pills of 2
  each shows 10 items vs. 5 dropdowns might look cleaner."* **Count what is on screen, not what is
  behind a click.** Payables' `Group by` has exactly two options and is a dropdown for that reason,
  not in spite of it.
- **Never a tab row where a filter would do** — unchanged, and still the defect the whole Payables
  rebuild came out of.

**Adopted:** Transactions (08-19) · Payables and Budget vs. Actual's `View` / `Showing` (08-20 —
seven segmented buttons became two pills). **Next:** Player Dues, Fundraising, Club, the Reports
portal. The family is `MultiSelectDropdown`, `SingleSelectDropdown` and `DateRangeDropdown` — one
look, three jobs; do not hand-roll a fourth.

---

### 2026-08-19 — A REPORTING FILTER IS A DROPDOWN AT FOUR OPTIONS, AND `Group by` IS NOT A FILTER

> ⚠ **PARTLY SUPERSEDED 2026-08-20 (entry above).** The `Four or more → dropdown`, counts-before-
> narrowing, arrangement-first and never-a-tab-row rules all stand. The **"two or three fixed,
> permanent options → pills stay"** bullet below is **STRUCK** — it was an agent's invention
> recorded as an owner ruling. Left in place rather than deleted so the next reader can see what
> was wrong and why.

**Owner instruction**, given while walking QA §27 on the coach Payables screen: *"not a fan of the
paid/unpaid/all toggle, I like what we did with the dropdown options in the transactions view… I
would like this to be the convention on reporting going forward unless there is a good reason for
something else."*

The standing convention, binding on every reporting surface:

- **Four or more options, or a list that will grow → a multi-select dropdown** (`MultiSelectDropdown`).
  Counts on every option, computed **before** the current selection narrows further — the rule the
  retired Overdue chip already followed, so the numbers never chase their own tail. When a real
  default is in force the summary reads **"2 selected"**, never "All": a considered starting
  narrowing is a fact worth stating, and pretending nothing is filtered is how a coach comes to
  distrust a count.
- **Two or three fixed, permanent options → pills stay.** A dropdown over two things is a click tax.
  The test is *fixed and permanent*: three options that will become five are already a dropdown.
- **⚠ A control that chooses an ARRANGEMENT is not a filter.** It is labelled `Group by`, and it sits
  **first** in the control strip, ahead of every narrowing control — otherwise it reads as another
  filter and a coach believes rows were removed when they were only re-ordered.
- **⚠⚠ Never a tab row where a filter would do.** Two tabs over the *same* records teach a coach that
  they are two different reports. That is the defect this decision came out of: Payables'
  `Schedule | Commitments` toggle presented a parent and its children as two views, and the
  confusion it caused is what surfaced three further defects underneath it.

**Where it came from and where it goes.** Transactions established the shape in the register
reading-order work (the `Show` / `Status` / `Item` dropdowns, owner calls 2026-08-19 and before);
Payables is the second screen to adopt it, which is what turns it from a local choice into a
convention. Sweeps next: **Player Dues, Fundraising, Club, and the Reports portal when it is built**.

Related: `project_coach_payables_rebuild.md`, `reference_collapsible_card.md` (the dropdown is a
native `<details>` disclosure — free keyboard support, no portal code).

---

### 2026-08-19 — A SUPPORT READ MAY NOT RANK CHILDREN, AND A CEILING MAY NOT BE INVENTED

Three owner calls taken before a line of Insights P2 was written. Two of them **reverse an approved
mockup**, and that is the part worth keeping: in this repo mockups are the spec, so a mockup that
contradicts a standing rule is a contradiction to escalate, never one to settle by reading the newer
artefact.

#### 1. The attendance table keeps roster order and badges nobody

**Owner decision.** The approved mockup drew the per-player attendance table **sortable**, with an
amber *"Missed most practices"* chip on a named child. The panel already carried the opposite as a
standing ruling: *"NO sort affordance on any column, ever. Roster order is the only order — this is
a support read to inform playing-time decisions, and a sortable column is a leaderboard however
neutrally it is drawn."*

The ruling stands. **What ships instead is a drill-in on EVERY row** — the same affordance
everywhere, so a coach can look into anyone without the screen nominating anyone. A chevron shown
only where absences exist would have been the badge again, drawn as an affordance rather than a
label. Naming the least-reliable player remains the job of **one sentence** in *What stands out*,
which fires only above a tracked-sessions bar.

⚠ This is the same family as `decision_playing_time_vocabulary.md` (measurement in context, never a
verdict) and the Development report's "checklist, never a ranking". **Three surfaces, one rule:** a
coach tool may show a coach what happened; it may not rank children by it.

⚠⚠ **A BEHAVIOURAL TEST CANNOT HOLD THIS.** "Worst first" is one `.sort()` in a pure module whose
unit tests would all still pass, one layer below anything a screen review looks at. So the rule is
asserted **against the source** in `tests/unit/coach-attendance-receipts.test.ts`: the module may
hold exactly one sort and it must order by calendar day, and the panel may hold no sort control and
no flag class.

#### 2. Arm care shows no innings budget, because the product has none

**Owner decision.** The mockup drew *"16 of 18 · 2 left"* as a progress bar filling toward **this
week's cap**, and the Dashboard finding beside it said *"2 innings from his weekly pitching cap"*.

**There is no weekly cap. There is no season cap.** Every ceiling this product stores is **per game**
and is a number **the coach set** — and `lib/coach-arm-care.ts` states in its own header why it must
stay that way: inventing one would be *the product proposing a figure as though it were a rule, in
the one place where the cost is a child's arm*. (The mockup also compared a **season** innings total
to a **per-game** cap — the same conflation, one row up.)

So the panel was redrawn against records that exist: season workload, **rest** since the last outing,
and the coach's own per-game cap with a flag only where the coach's own number was passed. The
sentence under it — *"there is no weekly or season limit here; the only ceiling shown is the cap you
set yourself"* — **is the section**, not a footnote to it: without it the figures above read as a
budget being spent down.

⚠ **A real weekly cap is a project, not a phase.** It needs a setting, and `lib/lineup-caps.ts` and
the game-day console's chip must move with it — three surfaces may never quote a child different
ceilings.

#### 3. A rate may only be named after something that is actually recorded

**Owner decision.** The mockup's fourth attendance tile read **"RSVP reply rate · replied before
event day"**. Nobody replies: RSVP here is a status the **coach** sets on the schedule screen, there
is no family reply channel, and no reply timestamp exists anywhere. Shipping that label would have
credited families for a reply they never sent and blamed them for silence that is actually a
half-finished sheet.

The same arithmetic honestly measures the coach's **own** record-keeping, so the tile is now
**"Recorded"** — the share of marks that got a definite in-or-out. It earns its place because
`known` is the denominator of every other percentage on the screen: a low *Recorded* means those
percentages rest on less than they look like.

⚠ **The general form:** before naming a rate after an actor, check that the actor performs the act.
A plausible label over real arithmetic is harder to catch than a wrong number, because nothing
disagrees with it.

---

### 2026-08-19 — THE TAP FLOOR IS A TOUCH RULE, AND A RECORD IS SPELLED WITH A HYPHEN

Two rulings from the Insights reports portal's follow-up calls. Both are small; the first one's
*evidence* is the durable part.

#### 1. 44px applies at touch widths only (≤768px). Above that, the rule is not asked.

**Owner decision.** 44px is a **fingertip** measurement. The layout sweep was applying it at 1440 and
failing every row of the coach sidebar on every coach screen — home link 22px, notifications 28px,
account 30px, team switcher 33px, the five group headings 26px, nav rows 39px. Raising them all adds
~250px to the rail and partly reverses the chrome slimdown that shipped days earlier (`fb8345cf`).
The rule was failing a design that was deliberately correct.

So the floor now stops at `TAP_FLOOR_MAX_WIDTH` in `scripts/check-layout-invariants.mjs`, argued
**once**, where the rule is defined. Nothing moved on screen.

⚠ **This does not say the desktop rail is beyond criticism** — it says 44px is the wrong instrument
for judging it. A pointer-width minimum is a real thing to want; it is a **different number**, argued
separately.

⚠⚠ **THE DURABLE LESSON IS THE NUMBER NOBODY HAD LOOKED AT.** The brief that raised this — and the
owner mockup built from it — described "about **twenty-five** desktop controls already recorded as
accepted exceptions." The real figure was **1,928 accepted `tap-floor` entries, 1,524 with no reason
written down.** Off by roughly sixty-fold, in the direction that hides work.

And the miss was not evenly spread. **753 of them were at PHONE AND TABLET widths** — where everyone,
including the recommended option, believed the floor was being enforced. **156 measurements — 70
distinct controls — under 24px**; the smallest is **13px**. (⚠ Count entries and count controls are
DIFFERENT numbers and this entry got it wrong on the first pass: 753 measurements cover 345 distinct
controls, because the same control is measured at several widths and on several screens. Say which
one you mean, every time.) The option as written ("keep the floor for touch, except desktop")
described a state that **did not exist**: the floor was not being enforced anywhere in the coach
portal. Answering the question as asked would have written one tidy desktop exception and left 653
unargued phone failures untouched, while reporting the guardrail as "made honest again".

> **A baseline count is evidence; a sentence about a baseline count is not.** Two documents and a
> mockup carried "about twenty-five" without anyone opening the file. Read the artifact, not the
> summary of it — the summary is where the order-of-magnitude goes missing.

⚠ **AND THE NUMBER IS A FLOOR, NOT A TOTAL — proved the same day.** `/review` reseeded the UAT
fixture before verifying; the team then had games, the season-record widget rendered for the first
time since the baseline was captured, and its "Season insights →" link measured **21px on a phone**.
Always broken, never seen. 753/653 became 755/655. **The empty-fixture trap runs in REVERSE too:**
the standing warning is that an empty screen hides GREEN falsely — it also HIDES RED. A baseline
built against a thin fixture records the product as cleaner than it is.

The touch debt is now named and sized in
`docs/projects/active/COACH_TOUCH_TARGET_DEBT_PLAN.md` (+ PM brief). ⚠ **Do not close it by
bulk-writing reasons onto the entries** — the check counts unexplained entries on purpose. Writing a
sentence onto 653 of them converts a visible problem into an invisible decision, which is precisely
how the number reached 1,928.

Also retired with the desktop rule: 1,175 baseline entries, **304 of which carried individually
written reasons that all said the same thing.** That is the shape to notice — when the same sentence
has been written 304 times into a data file, the decision belongs in the rule, not the data.

#### 2. A win–loss record is spelled with a HYPHEN: `12-4-2`.

**Owner decision**, choosing against the recommendation. The portal spelled a record two ways — en
dash on the masthead, Overview, Season's End and opponent chips; hyphen on the Insights Dashboard,
the Results tab and the public club site — and the reports portal put both on **one screen**, the
masthead's `12–4–2` an inch above the Dashboard's `12-4-2`.

Hyphen wins: it is how a coach types a record, and it is what the public site already showed, so a
team's season now reads identically everywhere **in the coach portal**. ⚠ The FAMILY portal was NOT
swept (the player recap and the family team page still hand-roll an en dash) and is an OPEN CALL, not
a decided exclusion — the player recap is doubly awkward because a COACH previews that very component
from the player page. Decide it deliberately rather than by omission, which is how this entry's own
problem started.

**The implementation note is the reusable part.** The brief framed "hyphen everywhere" as *changing
four surfaces and abandoning the shared formatter*. That was backwards: the formatter is **one
function**, so changing its dash updated all four at once, and the two local copies were deleted
**into** it. The non-recommended option turned out to be the smaller change *and* the one that
strengthened the single source of truth. ⚠ **Check whether a "more work" objection is counting
surfaces or counting definitions** — they are not the same number.

⚠ **A SCORE IS NOT A RECORD.** `W 5–3`, `Biggest win 6–1`, `worst loss 2–4` keep the en dash. This
ruling is about win–loss records only.

⚠⚠ **THE AUDIT FOUND TWO COPIES. THERE WERE SEVEN, AND IT TOOK THREE PASSES TO GET THERE.** The
brief named the two Insights `recStr` helpers. **Pass 1** — sweeping for the dash character — found
three more: `CoachStandingsSnapshot` (Overview's "Where you stand"), `SeasonWrappedCard` (two
spellings), and the playing-time panel. Those three were invisible to a search for the helper's
*name*, and being JSX-inline (`{wins}–{losses}`) rather than template literals, invisible to a search
for the *template* shape too. **Pass 2** — `/review`, told to assume one had been missed — found two
more, and they were the worst of the seven:

1. **`lib/wrapped-share-card.ts`** draws the record onto the **downloadable PNG**. The on-screen
   Wrapped card had been fixed; the image a coach *shares out of the app* had not. Same feature,
   same data, two spellings — and the one that reaches families and social media was the stale one.
2. **The coach Overview's "Last season" card** hand-rolled an en dash **in a file that already
   imported `formatRecord` and called it 400 lines further down.** One screen, two spellings, from
   one file that knew better.

All seven now call `formatRecord`.

> **Search for the OUTPUT, not the abstraction** — a duplicate is only findable by its name if
> whoever wrote it used the name; the dash character was the one thing all seven had in common.
> **And scope the sweep by BEHAVIOUR, not by folder.** Pass 1 searched `components/coaches`,
> `app/[orgSlug]/coaches` and `lib/coach-*.ts` — a naming convention. `lib/wrapped-share-card.ts`
> renders a coach-portal feature and does not carry the prefix, so the tidiest-looking scope was
> exactly the one that hid the highest-consequence copy.

⚠ **ONE KNOWN INCONSISTENCY LEFT DELIBERATELY UNFIXED.** `TeamHQ` renders `{wins}-{losses}-{ties}`
and therefore prints `12-4-0` where every other surface prints `12-4`. Correct dash, different
*content* — dropping the `-0` changes what a coach sees, which is beyond this ruling. Flagged for a
decision, not silently changed.

The public club site was **not** swept in — different audience, its own conventions, still an open
call. It happens to already agree.

---

### 2026-08-19 — THE IDENTITY BAR STAYS PUT. Space comes from making things SMALLER, not from making them vanish

**Owner ruling, on sight, the morning after it shipped to dev:** *"I want to revert one thing, I like
the size changes we made but you can leave this header as is when scrolling."*

⚠⚠ **THIS OVERRIDES DIRECTION A OF THE 2026-08-18 ENTRY BELOW.** The desktop team masthead does **not**
collapse on scroll. The phone still does, exactly as ruled 2026-08-02 — that behaviour is untouched and
was never in question. Restored: the `matchMedia('(max-width: 900px)')` gate and the breakpoint listener
beside it, and every `.teamHeaderCollapsed` rule back inside the ≤900px media query where it started.

**The direction A experiment is now DATA, not a proposal.** It was built, measured (−34px of pinned
chrome, 74→40px while scrolling), reviewed, and it worked. It was rejected anyway, because a coach's
identity bar disappearing and returning is worth more than the pixels it costs. **Do not re-propose a
desktop collapse as a space saving.** The distinction the owner drew is the durable part and it
generalises past this bar:

> **Space you take by making a thing SMALLER is kept. Space you take by making a thing DISAPPEAR AND
> COME BACK is borrowed.** The pixels that survived this pass — the bar going from three lines to two,
> the page-title band going 80px → 52px — are the first kind. The collapse was the second kind, and it
> was the one direction that read as motion in a bar whose whole job is to sit still.

**What the pass therefore delivers (measured after the revert):** chrome above a coach's first line of
content **234px → 190px** at 1440×900 and **208px → 188px** at 390×844, at rest AND while scrolling.
Pinned chrome while scrolling on desktop is 106px (48 + 58), down from 122 — all of it from the bar
being two lines instead of three.

⚠ **TWO THINGS THE REVERTED EXPERIMENT LEFT BEHIND, BOTH KEPT.** A reversal is not an undo of what the
work taught:
1. **The focus repair stays.** A collapse that hides the focused control drops focus to `<body>`; the
   bar is now the landing spot. **That was always a PHONE bug** (live since 2026-08-02) — the desktop
   version is merely what made a reviewer look at it. Reverting the thing that exposed a bug does not
   unfix the bug.
2. **The nested-header cascade fix stays** (see the entry above) — found in the same review, unrelated
   to the collapse, and it repairs a shape that had never once rendered correctly.

**Applies to:** `CoachTeamHeader` + the `.teamHeader*` block in `app/[orgSlug]/coaches/coaches.module.css`.
Directions B (two lines), C (the rail's role heading deleted) and E (page-title density) are **unchanged
and stand**. [[design-principles]]

---

### 2026-08-19 — AN OVERRIDE DECLARED ABOVE THE RULE IT OVERRIDES IS NOT AN OVERRIDE — and the one that worked hid the two that didn't

**Found by `/review` on the header vertical-space pass** (see the 2026-08-18 entry below). Plan §11.

⚠⚠ **THE COACH PORTAL'S "NESTED" DRILL-IN HEADER HAS NEVER RENDERED SMALLER THAN ITS HUB HEADER** —
not once since the shape shipped 2026-08-14. `.headerIconNested` and `.pageTitleNested` were declared
**above** `.headerIcon` / `.pageTitle`. `CoachPageHeader` puts BOTH classes on the same element, the
two selectors tie on specificity (0,1,0), and a tie is broken by source order — so the base rule, being
later, won every overlapping property. Measured on a rendered page: the hub `<h1>` and the drill-in
`<h2>` both computed to **22.4px / weight 900 with a 36×36 tile**. Identical. The whole point of that
shape — "so the two read as parent and child rather than two page titles arguing" — never happened.

**Decision:** the three nested rules move BELOW the base rules, and the trap is written into the
stylesheet at the site so a fourth nested override cannot repeat it. Fixed: `17.6px / 800 / 28×28`
against the hub's `22.4px / 900 / 36×36`.

⚠ **WHY IT SURVIVED FIVE DAYS AND A DESIGN RULING: one of the three overrides worked.**
`.pageHeaderNested`'s margin happened to sit below `.pageHeader`, so the nested shape was visibly
*half* right — tighter spacing, same type — and half-right reads as "styled", not as "broken".
**Generalise: when a group of overrides is written together, they share a fate. If one lands and two
do not, the one that lands is camouflage.** Check the whole group, not the property you happened to
look at.

⚠⚠ **AND THE SECOND LESSON IS ABOUT EVIDENCE.** The pass that retuned these numbers added a comment
asserting *"the step between them is preserved, one size smaller"* — false, and it immediately
propagated: one review lens **read that comment, believed it, and computed a 27% size gap that did not
exist**, reporting the hierarchy as healthy. A second lens read the cascade and called it dead. The
disagreement was settled by rendering the page and reading `getComputedStyle`. **A comment is a claim,
not evidence. A rendered measurement is evidence.** This is the same shape as the token-guardrail
lesson (a green gate that measured the wrong thing) — say out loud what your evidence actually is.

**Two more from the same review, both about a bar that now changes height while you read it:**
- **A collapse that hides the focused control silently drops focus to `<body>`.** `display:none`
  removes an element from the accessibility tree AND from focus, and a keyboard user can scroll (space,
  Page Down, arrows, a screen reader's own scrolling) while focus sits on the public-site flip or the
  nudge's dismiss button. The bar itself is now the landing spot (`tabIndex={-1}`, `preventScroll`);
  focus outside the bar is never stolen, and focus on content that survives the collapse is kept — all
  three proven in a browser. ⚠ This was live on PHONES from 2026-08-02 and never caught; extending the
  collapse to desktop is what made it worth fixing, not what caused it.
- ⚠ **TWO SAFE-LOOKING CHANGES IN ONE PASS CAN DELETE THE LAST COPY BETWEEN THEM.** The rail's
  "Assistant Coach" heading was deleted *because* the masthead chip states the role — while the same
  pass taught that chip to hide on scroll. Neither change is wrong alone; together an assistant's role
  is stated nowhere on a scrolled desktop. **When you remove a duplicate, check what the survivor is
  doing in the SAME diff.** Put to the owner with the correction that the justification given ("the
  chip is always visible") was stronger than the facts; **owner ruling 2026-08-19: no change —
  *"users know what role they have and don't need to be reminded every day."*** [[design-principles]]

---

### 2026-08-18 — THE CHROME SHRINKS WHILE YOU READ — and "these two rows duplicate each other" was false

**Owner trigger:** *"can we reclaim vertical space by consolidating the team-identity header into the
FieldLogicHQ top strip… or otherwise reduce the space it takes up."* Mockup (approved, binding for the
four directions built): `claude.ai/code/artifact/ccc08606-fcc2-41b4-b56f-627a8967a7cd`. Plan:
`docs/projects/active/COACH_HEADER_VERTICAL_SPACE_PLAN.md`. Ledger §59.

⚠⚠ **THE PREMISE WAS FALSE, AND CHECKING IT WAS THE WHOLE VALUE OF THE SESSION.** The top strip and the
team masthead share **not one word**: strip = wordmark · "COACHES PORTAL" · bell/account/workspaces;
masthead = club · team · role · season · record · live status · flip · nudge. The org name *had* been
printed twice, and the **2026-08-17 shell slimdown already deleted that copy** — so the consolidation
the ask proposed had, in substance, already happened. **Generalise: before merging two surfaces to
remove duplication, list what each one actually says. "They look like two of the same thing" is a
layout observation, not a duplication finding.** The three real duplicates were elsewhere, and two of
them cost no vertical space at all (team name vs. the rail switcher; role vs. the rail label).

⚠⚠ **PART (1) BELOW — THE DESKTOP COLLAPSE — WAS REVERTED BY THE OWNER ON 2026-08-19.** See the
entry above: the desktop bar does NOT collapse; the phone still does, as it always has. Parts (2), (3)
and (4) stand unchanged. The numbers in this entry are the as-built ones from 08-18 and are superseded
by the post-revert figures above (234→190px at rest on both, 122→106px pinned while scrolling).

**Decision, four parts, all measured on the running build rather than estimated.** Chrome above a
coach's first line of content: **234px → 190px** at 1440×900, and **122px → 88px** of permanently
pinned bars once scrolling. (1) **The masthead collapses at EVERY width**, not just on a phone — the
width gate is gone and the breakpoint listener with it. Collapsed, a phone still shows the bare team
name; **a desktop keeps the status line beside it**, because there is room and status is the bar's most
perishable content. That is the one thing the two collapsed states disagree about, and it is deliberate.
(2) **The masthead is TWO LINES, not three**: the club's eyebrow folds into the meta line as its first
segment — team + role over club · season · record. Nothing left the bar. (3) The rail's **"Assistant
Coach" heading is deleted** — the masthead chip is the survivor (it sits beside the team the role
belongs to, and it is the only one that exists on a phone). (4) **The page-title band is 80px → 52px**:
36px tile, 1.4rem heading, 1rem gap, with the nested shape stepped down to match.

**This ADJUSTS the 2026-08-02 masthead ruling** (`eyebrow → name → meta`, three levels) to two levels,
and the same date's "desktop keeps the full masthead" call. **It does NOT touch the 2026-08-11
page-header ruling**: part (4) is geometry only — every slot, every position, the phone grid and the
"no subtitle slot exists" construction are exactly as that ruling left them. ⚠ **The tile is what drives
the title row's height at every heading size**, so shrinking the heading alone would have reclaimed
nothing; the same arithmetic is why the PHONE's title band barely moved (its height is set by the 44px
tap floor on the help "?", not by the tile) and why its three mobile overrides — 40px tile, 1.35rem
title, 1.25rem margin — were **deleted as now-larger-than-desktop**.

**⚠⚠ THE "SINGLE-LINE IDENTITY STRIP" IS BACK ON THE TABLE — owner ruling, same day.** Asked to confirm
the 2026-08-02 *"do not re-propose"*, the owner instead said: ***"don't close D forever, I am
reconsidering… not opposed to revisiting moving to the single header."*** So that bar is **lifted,
pending how this build feels in use**. It is legitimate to propose again; it is NOT legitimate to
propose without the five costs the plan records (the phone has no strip at all, so it saves 0px there;
the status feed is SSR'd once per team-section entry from the team layout, which the strip sits above;
the canonical-record rule; the homeless game-day console link + scouting nudge; and pages with no team).
And it now has to beat **88px**, not 122px. Note for whoever picks it up: **A proved identity fits in
40px**, so a merged bar at THAT height is a different proposal from the one rejected in August.
⚠ Unrelated to the 2026-08-17 **Variant B** decision (an org whisper in the rail on non-masthead pages),
which none of this touches.

**Applies to:** `CoachTeamHeader` + `CoachPageHeader` + `CoachesSidebar` and their blocks in
`app/[orgSlug]/coaches/coaches.module.css` — the premium org coach portal, both widths. Side effect
worth keeping: deleting `.sidebarSectionLabel` also removed a **stale trailing comma** left by the
2026-08-18 semantic-ink sweep, which had joined that selector to `.sidebarItem:hover` and was painting
the rail's role heading with a warm hover background it never asked for. [[design-principles]]

---

### 2026-08-18 — TEXT NAMES A ROLE, NOT A SHADE — and "zero hardcoded colours" was never the same claim

**Trigger:** owner, on the coach rail — *"can you do something about this blue on blue text? hard to
read"*, then, on being told the follow-up sweep was ~170 edits: ***"why aren't these colors
centralized so we don't have to update 170 colors? shouldn't this be a very small set of colors that
permeate across the app?"*** He was right, and the second question is the decision below.

**WHAT WAS ACTUALLY WRONG (measured on the grounds the portal paints, not estimated):**
- `--blueprint-blue` — a FILL navy — used as TEXT at **1.65:1**, on the sidebar's active row. Not
  "a bit low": unreadable, and it was the one row a coach must be able to read.
- The dark dim tier: `--white-35` 3.22, `--white-40` 3.79, `--white-45` 4.48. **Warm already passed**
  (5.39–5.91), which is the tell — the dark values were never measured, only eyeballed.
- `--home-dim` resolves to `--white-45` **in dark**, so 124 further declarations failed while looking
  like they belonged to the warm palette.

**BINDING RULES:**

1. **The dim tier was DRIFT, not hierarchy.** *Stat labels* render at all three values depending on
   which screen was built that week. Three steps chosen by eye is not a hierarchy; it collapses.
2. **`color:` in the coach portal takes `--text-primary` / `--text-secondary` / `--text-tertiary`.**
   The semantic ladder ALREADY EXISTED and was ALREADY theme-aware — it had simply lost, **149 uses
   to 1,605**. Retuned in dark only (14.46 / 9.13 / 6.92); warm needed no change at 15.06 / 9.03 /
   5.39. Retuning a tier is now ONE line, in both themes.
3. **The alpha ladder keeps borders, dividers, tints and fills.** Three punctuation-only holdouts are
   named in `tests/unit/coach-semantic-ink.test.ts`; that guard fails the build on new shade-named
   text. Blue-as-ink is `--blueprint-light` (theme-aware), never `--blueprint-blue`.

4. **⚠⚠ WHY THE JULY TOKEN GUARDRAIL DID NOT PREVENT ANY OF THIS — and why its green number is
   dangerous.** `check:public-tokens` centralizes colour **by VALUE, never by ROLE**. Its goal is
   *"a rebrand is a single edit"*, which it genuinely delivers. But it **deliberately does not flag
   `rgba(255,255,255,A)`** — the alpha ladder is its DESTINATION, not its debt — so a stylesheet
   reaches zero the moment its literals become `--white-45`, and is never examined again.
   **Both were true from July: every colour came from a token, AND every text colour was a separate
   hand-managed decision.** A rebrand was one edit; making meta text readable was 1,176. The
   fingerprint is still in the code — 65 declarations carried `var(--white-45, rgba(255,255,255,
   0.45))`, the literal kept as a fallback beside its replacement.
   **The lesson generalises past colour: a metric reporting zero answers the question it asks, and
   reads as if it answered the one you assumed.** Before trusting a green gate, say out loud what it
   does not look at. (Its `tsx` scope has also never reached zero — 410 inline literals.)

**Applies to:** all coach CSS modules (done — 1,176 declarations, 38 files). **NOT done:** the admin
portal has the identical gap and the identical ladder, and it is where four one-off promotions to a
readable grey were already made without anyone naming the rule. Public/consumer surfaces are out of
scope until measured — different grounds, different type sizes.

### 2026-08-18 — WHO A CLUB MAY EMAIL: transactional mail is exempt, and the exemption is PAID FOR by naming the sender

**Owner decisions, binding.** A family can unsubscribe from their club's email. An audit found ten
senders put mail in a guardian's inbox and **three honoured it** — the other seven predate the shared
guard and never moved. Two rulings settle what the promise means:

1. **Dues reminders and tryout offer/waitlist/release mail are TRANSACTIONAL and skip the opt-out.**
   A family cannot mute a bill by unsubscribing from announcements, and suppressing a tryout offer
   would cost a child a roster spot because a parent unsubscribed two seasons ago. ⚠ **The exemption
   is conditional on identification** — these mails MUST name the club, the team, and say plainly why
   an unsubscribe did not stop them. Before this they signed off `FieldLogicHQ`, the software vendor,
   which is the one signature a parent has no relationship with. **An exempt sender that does not
   name itself is not exempt, it is just unaccountable.**
2. **Announcements are NOT exempt, whoever sends them.** The house-league season broadcast is now
   guarded (it carried no unsubscribe link at all). `leagueBroadcastHtml` was DELETED rather than
   kept — a second family-email template with no compliance footer is exactly what made the gap.

**⚠ THE DESIGN LESSON, which is the durable half:** P2 closed the former-address hole with a
`personEmails` argument each caller passed. That protected **the one door that remembered**. The fix
moved the expansion INTO the shared suppression list (`getFamilySuppressionList`), so every sender —
including ones written later by someone who never reads this — gets it without knowing the concept
exists. **Compliance carried in a parameter is compliance that lapses; put it in the thing nobody can
route around.** Same shape as the `sendFamilyEmail` choke point itself, one level down.

**⚠ Known and DELIBERATELY still open:** the **free-tier** coach's "Email families" honours no
opt-out while the paid coach's identical announcement does — a family's unsubscribe is respected or
not **depending on what their club pays**. It is NOT fixable by routing it through the guard:
`basic_coach_teams` has no `org_id`, and both the opt-out list and the unsubscribe token are
org-keyed. Needs its own per-team opt-out record — a migration and an owner decision.

**Separately, the household ruling:** a household is **CONFIRMED, not inferred**, before any money
feature acts on it. The family page assembles children from programme ROWS, so one child enrolled in
two programmes counts as two — fatal for a sibling discount and invisible on screen. A human confirms
which rows are one child; money features refuse to run on an unconfirmed household. This answers the
"what identifies a child" question by replacing it.

Plan: `docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md` §5.5. QA: ledger §56.

---

### 2026-08-18 — A HAIRLINE IN A FLEX COLUMN NEEDS `flex-shrink: 0`, and the air around it is not free

**Owner trigger:** *"a little too much space between the dropdown and overview."* Measured, not
eyeballed (Playwright computed styles, 1440×900): 36.8px between the team switcher and Overview,
against 21.6px above the switcher — 70% more air below the control than above it.

⚠⚠ **THE DIVIDER THAT WAS SUPPOSED TO FILL THAT SPACE DID NOT EXIST.** `.sidebarDivider` is an empty
1px `div`, and the premium coach rail is a flex column with `overflow-y: auto`. An empty flex item's
automatic minimum size is **zero**, so on every rail tall enough to overflow — i.e. every laptop
viewport; the rail wants ~1004px and a 1440×900 screen gives it 852 — **both** dividers were crushed
to 0px. The rail rendered two structureless ~37px holes, and the owner reported the symptom (too much
space) rather than the cause (the line was gone). **Standing test: a zero-content spacer or hairline
that is a direct child of a flex container must declare `flex-shrink: 0`, or it silently vanishes
exactly when the container is full — which is when a divider matters most.** It survived a rendered
48-screen sweep because no invariant asserts that a decorative element still has its declared height.

**Decision.** (1) `flex-shrink: 0` on `.sidebarDivider`. (2) Its margins drop `0.5rem → 0.15rem`, and
the switcher select gives up its stray `0.1rem` / `0.3rem` verticals: the two `.sidebarSection`
paddings already put 8px of clear space on each side of the line, so the old margins were stacking a
second helping of air on top of air that was already there. Result — 21.8px switcher→Overview (was
36.8), 10.4px clear on each side of a line the coach can now actually see, and 8px above the switcher.

**Rationale:** the fix the ask implies (delete space) and the fix the evidence demands (restore the
line) are the same edit, and doing only the first would have left a rail whose two structural breaks
are invisible forever. **Applies to:** `.sidebarDivider` + `.teamSwitcherSelect` in
`app/[orgSlug]/coaches/coaches.module.css` — the premium coach rail, both breaks (switcher→nav and
nav→Help/Sign out). The basic portal's `.railDivider` is immune: it is a `border-top`, not a height,
which is why this never showed there. Follows the 2026-08-17 shell slimdown, which made the switcher
the rail's first element and put the gap under a spotlight. [[design-principles]]

---

### 2026-08-17 — The coach strip owns identity, the sidebar owns navigation (bell moves up, header deleted)

**Owner trigger:** *"wasted space on the side nav… we show the org name in large print even though it is
in the top nav… move notifications to one of the top navs and maybe even the words 'coaches portal' to
the very top nav."* Mockup (approved, binding): `claude.ai/code/artifact/aebdd43d-d020-4735-a6ca-41213ba8c395`.

**Decision, three parts.** (1) The premium coach portal's **top strip gains the portal's identity**:
wordmark · hairline divider · "COACHES PORTAL" in the sidebar's own quiet uppercase micro-label voice.
(2) The **NotificationBell moves into the strip's door corner** (bell · account · Workspaces —
byte-for-byte AdminTopStrip's Zone 3, `panelPlacement="topStrip"`). (3) The **sidebar header block is
deleted outright** — portal label, bell and org name all leave the rail; the team switcher (2+ teams
only) becomes the rail's first element with no "My Teams" label (the accessible name stays on the
control), and the rail's top padding tightens so the reclaimed space is spent on nav.

**This SUPERSEDES one clause of the 2026-07-31 strip ruling** ("NO bell — the portal's NotificationBell
stays in the sidebar header"). That clause was never a principle about bells — the principle was **no
duplicate doors** (it killed the chat door), and the bell's home stays singular; the move CONVERGES the
two operator strips, since admin's has carried its bell in that corner all along. The chat-door half of
the ruling is untouched and still binding.

**Why the org name can leave the rail:** the masthead eyebrow already names the club on every team
page, so the rail printed it twice within two inches. Accepted tradeoff, flagged in the mockup: portal
pages without the masthead (Notifications, the team-picker hub) carry no org line on desktop. Variant B
(a one-line quiet org whisper above the switcher) was offered and NOT chosen.

**Applies to:** `CoachTopStrip` (+ its module CSS), `CoachesSidebar` + `coaches.module.css` (premium
org portal shell). The basic portal's rail (`CoachPortalShell`) keeps its own header — its eyebrow is
that surface's only "Coaches Portal" and its rail has no org stutter. Phones untouched: the More sheet
already owns mobile notifications (Chunk B P1 #4). [[design-principles]]

---

### 2026-08-17 — A WEIGHT IS SHOWN AS ITS SHARE, never as its raw number — and the reset is the toggle

**Owner trigger:** *"it is not clear that the 1's represent the weight of each category."* Mockup
(approved, binding, all recommendations): `claude.ai/code/artifact/a43106bf-9b2a-4f5a-b7c1-ae9ee37a182d`.

⚠⚠ **NAMING THE FIELD WOULD HAVE FIXED THE SENTENCE AND LEFT THE PROBLEM.** The tryout composite is a
weight-**normalised** mean (`Σ(avg × w) / Σw`), so only a category's *share of the total* ever reaches
a player's score — **six 1s and six 3s are the identical scorecard**, and "Weight: 1" beside "Weight: 1"
still says nothing about the ranking. The raw weight is the wrong half of the fraction. **Generalise:
before labelling a number a user cannot read, check whether the number they need is the one you are
showing.** Every row now prints its share as whole percents summing to exactly 100 (largest remainder —
a footer should never have to explain 99%).

**Decision, four parts.** (1) A **"Count every category equally"** switch, ON by default, hides the
weight controls entirely on the common path and prints the even split; its state is **DERIVED from the
stored weights** (all equal and > 0), so the switch needs no column and no migration. (2) Switch off →
a **stepper + proportion bar + live percent** per row. (3) **What the screen shows is what gets saved:**
while the switch is on the even split is displayed *whatever the rows are carrying*, and saving writes
it. The first cut displayed the remembered tuning under an "equal" switch and was corrected — that is
the exact class of lie this entry exists to remove. (4) A zero share is named in words — **Notes only ·
not ranked** — because it is a real, useful behaviour (scored by helpers, excluded from the ranking)
that was reachable only by typing `0` into an unlabelled box.

⚠ **TWO SILENT BEHAVIOURS BECAME SENTENCES.** All-zero weights fall back to an even mean — the coach
believed they had switched ranking off; now warned at the moment it becomes true. And **reweighting
after scoring silently re-orders the board** a coach may have been reading all morning; the builder now
says so, shown only when scores actually exist (a new `hasScores` flag on the read). The route already
refused to *delete* a scored category; this is the same protection for the change it cannot refuse.

⚠ **THE FIELD HAD NO ACCESSIBLE NAME AT ALL** — a `title` tooltip and nothing else, so assistive tech
announced "spin button". Not a preference, a defect. **Standing test: a control whose only label is
`title` is unlabelled.**

**OWNER RULING (same day) — THE TOGGLE IS THE RESET, AND IT DISCARDS.** Turning weighting off, tuning,
then back on is the fastest way to **start over from an even split**, so the product treats it as
exactly that rather than as an accident to recover from: the tuning is discarded, not remembered. The
dialog says so in its own words (*"Start over with an even split?"* / **Reset to equal** / **Keep my
weighting**) and fires **only when there is real shaping to lose** — an uneven split or a notes-only
row. **All-equal-but-not-1 flips straight through**, because resetting it changes nothing the coach can
see and *a dialog with nothing at stake is how users learn to dismiss dialogs unread.* It goes through
the shared coach-skinned `useConfirm()` → `FeedbackModal` (the ruling directly below), `tone: 'warning'`
so the confirm is lime — this is a tool, not a delete.

**Four more, from the same screen:** the note collapses to *+ Add a note for evaluators* (six
always-open inputs were most of the modal's height, which is why Save fell below the fold at four
categories); rows gain **move up / move down**, because that order *is* the order evaluators tap through
on a phone in glare; the scale picker becomes a real **segmented control** with a consequence line,
having been two dashed `.addBtn` "add something" affordances with an inline-style selected border; and
head/foot **pin** with a running summary beside Save. A **live helper preview** sits beside the fields
(≥900px) — the coach is authoring a form somebody else fills in, once a year, and it is also the only
thing that makes the "note for evaluators" field explain itself.

⚠⚠ **AND THE PREVIEW SENT US TO A DEFECT ON THE LIVE FIELD SCREEN.** Owner, on seeing the 1–10
preview: *"would it make sense to make these buttons an even 5 on each row?"* — and the honest answer
was that the **real** scorer had the worse version of the same problem. `TryoutScorerSurface` laid its
scale out with `flex-wrap` + `flex: 1 1 auto`, so a 1–10 card gave a volunteer **six thin buttons then
four stretched ones** — tap targets of different sizes carrying no information — **at a wrap point that
moved with the viewport**, so a coach's phone and an evaluator's phone disagreed about the layout of
the same scorecard, outdoors, in glare. Both surfaces are now `repeat(5, minmax(0, 1fr))`: 1–5 is one
row, 1–10 is an even 5 + 5, every number the same target on every device (five columns clear the 44px
tap floor to a 280px viewport, so the `min-width` that could overflow a narrow grid came off).
**Two rules out of one question:** a *preview must never tidy up a layout the real screen does not
produce* — a flattering preview is worse than none; and **"wrap and stretch" is not a layout decision,
it is the absence of one.** Where the count is known, say the columns. ⚠ The field scorer is **in no
rendered sweep at all**, which is why this survived — it was never measured by anything but eyes.

⚠⚠ **`/review` (high-risk, 5 lenses) THEN FOUND THAT TWO OF THE ABOVE DID NOT ACTUALLY WORK** — both
invisible to every gate, both in this ruling's own headline work, and the whole detail is in the plan's
§7. (1) **A normalisation applied on READ became a WRITE.** The builder rounded stored weights when
opening; a stored weight is free-form (the API takes any non-negative number and the old `step={1}`
input never stopped a decimal being *typed*), so a legal 1.3/1.4 split rounded to 1/1, derived the
equal switch **ON**, and a coach who opened the form to fix a typo silently rewrote their split on
Save — **no dirty state, no confirm, because from the form's view nothing had changed.** The comment
above it reasoned carefully about not *capping* and never noticed it was rounding. (2) **The all-zero
warning this ruling added did not fire**, because every derived figure counted rows that `save()`
deliberately drops: one unnamed row's weight kept "1 ranked" true, so the warning stayed silent and the
save stored exactly the all-zero rubric it exists to catch. **Two rules: a value normalised on read is
a value rewritten on save; and a guard must reason over the rows that will actually be SAVED, not over
the draft.** Also fixed: a **second** confirm on a screen that already had one could overwrite the
first's resolver (single-slot provider, no Tab trap) — the modal body is now a disabled `<fieldset>`
while any dialog is pending.

**Applies to:** `components/rep-teams/TryoutRubricCard.tsx` + its **new** `.module.css` (registered in
the token guardrail's `operator` scope, fully tokenised — that scope is at 0 grandfathered literals and
stayed there), the tryout-rubric GET, and the coaches help guide. **BUILT on dev 2026-08-17**; owner QA
§50. ⚠ **`check:layout` was NOT re-baselined and proves nothing here** — the builder exists only inside
a modal the rendered sweep never opens, beneath a checklist row collapsed by default. The team-settings
lesson arriving one level deeper. [[design-principles]]

---

### 2026-08-17 — The coach portal's confirm dialogs stop wearing the tournament-admin skin

**Owner finding:** *"the css for these 'are you sure' modals match the tournament admin and not the
coaches portal."* Every branded confirm in the product (`ConfirmProvider` → `FeedbackModal`) rendered
the ADMIN idiom — global `.modal` classes, `--font-data` mono message, `btn-data` mono/uppercase
buttons — including inside the coach shell, where every other modal is the sentence-case,
14px-radius, `#141414` recipe (TryoutDayCard's).

**Decision:** ONE dialog, skinned per shell. The admin look stays byte-identical (it lives in the
global classes); a new `FeedbackModal.module.css` carries the **coaches-portal skin**, scoped on the
shell's `[data-coach-warm-enabled]` marker — which is present in BOTH dark and warm (the warm gate
is the marker AND `html[data-user-theme="warm"]`), so one scope covers both skins, with warm
overrides (`--home-card`/`--home-ink`) on top. Dialog: `#141414`, 14px radius, hairline border.
Title: sentence case, 1.05rem/800. Message: sans 0.88rem. Buttons: sentence case, 8px radius —
colours (danger red / lime confirm) unchanged. **The admin Rep Teams panel renders the same
components with no marker and is untouched.**

**The generalizable rule:** a shared dialog that serves two shells carries each shell's skin keyed
on the shell's own marker — never a fork of the component, and never one shell's idiom imposed on
the other. **Applies to:** `components/FeedbackModal.tsx` + new `.module.css` (registered in the
token-guardrail `shared` scope) — every `useConfirm()` ask and feedback dialog in the coach portal:
discard guards, evaluator revoke/reissue, reveal names, decision passes. [[design-principles]]

---

### 2026-08-17 — A date-time field seeds to ROUND HOURS, never to "now"

**Owner ruling** (on the Add-session picker opening at the current wall-clock minutes — "not sure
we will ever have a user use the current time to set this, especially the minutes").

**Decision:** an empty date-time field is SEEDED before the native picker opens: start times seed
to the **next full hour** (`:00` minutes), and a dependent end time seeds to **start + 2 hours**.
**Both seed ON OPEN** — the first cut seeded the end on focus, and the owner's walk showed why
that's wrong twice over: the coach expects the default to be *visible* when the form opens, and a
baseline that moves mid-flight is how a seeded, untouched form ended up tripping the discard guard.
Never leave a scheduling field empty for the native picker to default to the current minutes —
"9:56 PM" is a value no coach will ever mean. Any minute stays *selectable*; only the default moves
(never restrict `step` to enforce round hours — 6:30 tryouts are real).

**And the end FOLLOWS the start (owner, same day, on seeing 6:00 PM start above a stale 5:00 PM
end):** changing the start shifts a set end time by the same amount, preserving the session length
— the calendar convention (a 6–8pm session moved to 4pm becomes 4–6pm). An empty end never
materializes from a start change, and a start reverted to its seed carries the end back with it,
so the untouched-seed silent close still holds.

**Three riders that make seeding safe:** (1) the seed sets the discard-guard BASELINE too — a
prefill is not the coach's work, so an untouched seeded form still closes silently (the Chunk G
rider); (2) **clearing a seeded value back to empty is not work either** and must not trip the
guard — in ADD mode only; clearing a SAVED value in edit mode is a real change and stays guarded;
(3) validation nudges keyed on the date (the tryout-window heads-up) stay QUIET on an untouched
seed — a warning about a date the coach never chose is noise.

**Applies to:** the tryout Add/Edit-session modal now; the standing default for any future
date-time field in coach/admin forms. [[design-principles]]

---

### 2026-08-17 — Tryouts: the guide owns "Do this next", and Step 1 is ONE checklist card

**Decision (owner accepted mockup `claude.ai/code/artifact/7b578986-adb0-4212-b996-f09c365297f1`):**
1. **"Do this next" moves INSIDE the collapsible "How tryouts work" guide**, rendered AFTER the four
   steps — the guide reads "whole journey → your next move on it" — with a lime ring on the current
   step's number ("you are here"). The collapsed default is one quiet line: title + toggle + tab bar,
   no banner. ⚠ This hides the prompt at EVERY phase, not just the empty one; the tab bar's
   checkmarks + current-step dot are the always-visible progress carriers now — watch that in QA.
2. **Step 1 (Set up) replaces its three stacked cards** (Tryout Day sessions / Evaluation scorecard /
   Evaluators) **with ONE "Get set up" checklist card**: three rows, each with a done-mark,
   REQUIRED/OPTIONAL tag (lime 12% fill vs white 7%), and a one-line status; the card header counts
   "N of 2 required done". Rows expand in place to the full existing managers (the CollapsibleCard
   pattern — the three cards' UIs move one level down, unchanged). Done rows collapse to one-line
   receipts ("Sat Aug 29 · 9:00 AM + 1 more").
   ⚠ **Receipts, the "N of 2" counter, and the tags speak the PORTAL's type — sans with
   `tabular-nums` — NOT `--font-data`** (owner, same day: "looks more like tournament admin"). The
   mono data face is the ADMIN shell's idiom; the coach portal sets times/figures in its own face
   with tabular numerals (the scoreboard's `.composite`/`.bib` precedent), and its micro-labels
   follow the sans `.nextLabel` recipe with `--radius-sm`, never the admin's mono 2px-radius
   badge. The first build shipped mono and was corrected; mockup updated to match.
   ⚠ **Revised after first live look (owner, same day): action buttons live INSIDE the expanded
   row, never on the collapsed bar** — the collapsed bar is just a row (tick, title, tag, status,
   chevron), and expanding it is how you reach its actions. The mockup's inline-CTA variant is
   superseded; artifact updated to match.
3. **Stage actions return to their stages:** "Open day-of check-in" → Tryout day tab; "Reveal names"
   → Decide. The step-1 hierarchy defect was a solid-blue STEP-2 button outshouting step 1's own
   primary action. The blind-evaluation note stays in the dates row (it explains what "Add session"
   leads to).

**Rationale:** with nothing created, three voices said "add your dates" (banner, tab, card) and
"Take me there" pointed at the tab already on screen; three equal-weight islands hid required vs
optional and spent three screen-heights on three sentences. Alternative considered and rejected:
three-up grid (keeps equal weight, goes ragged when populated).

**RULED (owner 2026-08-17, after seeing mockup §5): tabs 2–4 stay CLICKABLE — guide, don't gate.**
Owner asked whether later tabs should be disabled until required setup exists; answer is no. The
tabs are the map the once-a-year coach learns from, dead controls can't say why they refuse, and a
strict gate blocks legitimate paths (tryout-morning check-in with no scorecard; registration before
dates). Instead, a tab opened ahead of the tryout's actual stage LEADS with a compact prompt in the
same lime voice ("Do this first" — a smaller cousin of the "Do this next" recipe: lime left edge,
one sentence with the honest reason, one outline-lime jump button), with the tab's own content still
visible below it, and the stage tab the tryout is actually on keeps its small lime current-dot.
Stage-specific copy: Tryout day → "You haven't set your tryout dates yet — that's step 1" (or the
scorecard variant); Decide → "Nothing to decide yet — scores come in on tryout day"; Build team →
"No offers out yet — decisions happen in step 3."

**Applies to:** `components/rep-teams/TryoutFlowHeader.tsx` + `.module.css` (guide + peek-ahead
prompt), new `TryoutSetupChecklist.tsx` + `.module.css` (the one card; the three managers are its
row bodies now, reporting {done, summary} up), new `TryoutRevealControl.tsx` (reveal on Decide),
the tryouts page, the tryout-overview API (reveal step now anchors Decide), help guide copy, and
the coach-tryouts UAT smoke spec. Warm skin keeps the TH-5 sunlight-floor recipes (solid lime
fills for the done-marks + "Take me there"). **BUILT on dev 2026-08-17** — lint/typecheck/token/
contrast/purity gates green; ⚠ check:layout NOT re-baselined (collapsed rows also hide their
managers from the rendered sweep — the team-settings lesson), owner QA owed. [[design-principles]]

---

### 2026-08-16 — THE SEASON DIAL IS DELETED: history is delivered in place, and a year parameter is a DECISION

**Owner ruling (Design A on M1, artifact `aa758bcb` §10), and it OVERRIDES the archive rulings below.**
The coaches portal had a second mode: a `<select>` in the sidebar, a season list in the phone's More
sheet, and a "2025 · Complete" chip beside every page title, any of which pointed the whole product at
a past year — and replaced the coach's menu with a shorter, differently-ordered one while it did.
That place is gone. A coach sees the season their team is **on**: the live one, or the newest finished
one when the team is between seasons.

**What this supersedes, explicitly:** D-F3 (where the season switcher lives — there is none), D-F4
(the "2025 · Complete" page-title chip — deleted; the masthead's own presentational chip is the only
place a finished season is named), the "archive is opt-in" allow-list pair
(`APPROVED_ARCHIVE_DOORS` / `APPROVED_SEASON_AWARE_ROUTES`), and Chunk F's **governing rule 1**
("what the coach could see AT THE TIME"), which M1 had already retired — capabilities are the
member's current ones, in every season, because only current staff hold access at all.

**What replaces it, and where the teeth are.** `HISTORY_ENDPOINTS` in
`tests/unit/coach-history-endpoint-guard.test.ts` is the whole look-back layer — today exactly
`wrapped` (Season Wrapped, and the payload behind Season's End), reached from the **Past seasons**
compare list at the foot of Insights → "How are we doing?". The build fails when a route *or a page*
learns to read a year. ⚠ **That page-side half was impossible to write before**: while ~24 pages
legitimately carried `?year=` there was nothing to assert, and the client half of the contract went
unguarded for the whole life of the archive.

⚠ **ONE NAV, ALWAYS — the design decision inside the deletion.** A team between seasons keeps its
whole menu, in its usual order; only the landing slot swaps (Overview ⇄ **Season's End**). The
second, shorter menu was the confusing part, not the read-only-ness. This is only honest because P1
had already built `CoachNotOnTeam` — *"this screen is part of running a live season, and it comes
back when the next one starts"*, with a Season's End link — so the live instruments explain
themselves instead of dead-ending, and CLAUDE.md's "hide the entry point" rule does not apply to
them.

⚠ **The two hidden Insights tiles are NOT the same rule, and both survive.** Playing time is hidden
on a finished season because its figures are **recomputed** from saved lineups (a derivation cannot
promise what the coach read that year); the scouting book is hidden because it is an **instrument**
(today's notes, not a snapshot). Attendance is the counter-case and its tile **stays** — a record of
who turned up, and since it is in neither nav, that tile is the report's only door in the product.

**Applies to:** `lib/coach-team-read.ts` (the renamed season-read rail — minus its year it is the
shared working-season resolver ~23 routes depend on, so it was renamed rather than deleted),
`lib/coach-season-view.ts`, `lib/coach-nav-visibility.ts`, `lib/coaches-context.tsx`,
`CoachesSidebar`/`CoachesBottomNav`/`CoachPageHeader` (`CoachSeasonChip` deleted), ~24 coach pages,
the coach demo's tour step 7 + dock line, and CLAUDE.md's binding section. Built on dev 2026-08-16;
owner QA ledger §40. [[design-principles]]

---

### 2026-08-15 — A STRUCTURAL BRAND TOKEN IS THEME-INVISIBLE IN THE WARM PORTAL: sponsor blue is `--info`, never `--blueprint-blue`

**Trigger:** the rendered sweep, on the coach Money hub's Fundraising tab — the **Sponsor** kind chip
measured **4.18:1** against the card ground at 361/390 (AA floor 4.5). Two defects shared one line.

⚠ **THE CHIP WAS NEVER BLUE.** `.badgeSponsor` was written as `--blueprint-blue`, and the coach warm
gate remaps `--blueprint-blue → --home-olive` (`app/globals.css`, alongside `--logic-lime` and
`--primary-light`). So the "blue" sponsor chip rendered **olive #57651E** — the same hue family as the
green drive chip beside it, on an **olive-tinted** card ground. Both halves of the failure follow from
that one remap: an AA miss (a fill on a ground tinted with its own hue — the **2026-07-30** ruling,
which measured the same shape at 5.8:1 and generalised *never put a filled CTA on a panel tinted with
the CTA's own hue*), and a **ruling that was silently not delivered** — the owner's "blue dot for
sponsorships, green for drives, matching the tab's chips" could not be true while both rendered olive.

**Decision:** `.badgeSponsor` and `.railDotBlue` use **`--info`** (warm `--home-blue #134FD3`, already
carrying `--evt-scrimmage`; unchanged `#3B82F6` in dark). Chip fill drops 0.15 → **0.12**. Re-measured
on the served page: the contrast finding is **gone at both 361 and 390**, and `coach-sponsor @390` is
fully clean.

⚠ **THE TOKEN WAS NOT THE LEVER — THE RECIPE THAT CONSUMES IT WAS.** Repointing `--blueprint-blue`'s
warm mapping would have moved every structural use in the portal. This is the third instance of one
pattern (`--logic-lime-fixed`, 2026-07-27; the Staff panel's segmented "on" fill; now this), so state
it as a rule: **in the coach warm portal, `--blueprint-blue`, `--logic-lime` and `--primary-light` all
resolve to olive. Any surface that means *blue* must say `--info`; any surface that means *green* must
say `--success`. A structural brand token used for MEANING is a bug that only the warm skin shows.**

⚠ **AND THE SWEEP COULD ONLY SEE IT ONCE THE FIXTURE HAD A SPONSOR IN IT.** `coach-fundraisers` had
been green for months over a fixture that contained two drives and no sponsor — the chip had never
been rendered, so it had never been measured. This is the *green sweep over an empty fixture* trap
arriving in its useful direction. **Seeding a new record TYPE into the UAT fixture is a coverage
change, not test housekeeping.**

**Known and left:** the layout baseline is keyed on an element's visible LABEL, so seeding a third
record produced a "new" `a·Northside Physio` tap-floor finding that is the *same accepted decision* as
the baselined `a·Chocolate sale` / `a·Bottle drive` (24px name links at 361). Not re-baselined here —
`--init` rewrites the whole file and a concurrent session is mid-change in it.

**A DOT IS THE COLOUR OF THE CHIP YOU'LL SEE WHEN YOU ARRIVE (owner ruling 2026-08-15, accepting the
recommendation).** Now that both actually render blue, the Money rail carries **Sponsorships and
Allocations on the same dot**, adjacent in the `more` variant. That forced a choice the rail had never
had to make: its own header comment describes dots as *money-direction lanes* (green = in, rust = out,
blue = the org's side), under which sponsorships would be GREEN — but the two-row ruling ties the dot
to the chip of the tab it opens. Both were defensible; they cannot both be the rule.

**Ruled: the chip-match wins, and the lane comment is superseded.** A coach can learn "the dot matches
what I'll see when I get there" from the screen itself; "direction of money" appears nowhere on it. The
shared hue is accepted rather than worked around, because the binding deutan ruling (2026-08-13, ΔE 1.0
olive↔danger) already forbids colour from being the sole carrier — **the row NAME is the information
and the dot only reinforces it**, which is exactly why two rows may share one.

**Applies to:** `app/[orgSlug]/coaches/coaches.module.css` (`.badgeSponsor`),
`app/[orgSlug]/coaches/teams/[teamId]/accounting/overview-dashboard.module.css` (`.railDotBlue` — also
corrects the Allocations dot, which had the same invisible remap). Plan:
`docs/projects/active/COACH_SPONSORSHIPS_PLAN.md` §8b. [[design-system]] [[design-principles]]

---

### 2026-08-15 — A COLUMN HEADING IS NEVER THE FAINTEST TEXT IN ITS OWN TABLE; and an overloaded token is not the lever

**Trigger:** owner, on the Money hub's Expenses tab — *"can we look at our dark mode styling rules for
this blue? it is hard to read. I hope this is centralized so if we make a change it permiates across
the app and doesn't leave any straglers."* Mockup (approved, binding, all recommendations):
`claude.ai/code/artifact/c0eb7e26-ead7-44ac-9340-936c335680b0`.

⚠ **THE DEFECT WAS A RELATIONSHIP, NOT A THRESHOLD — WHICH IS WHY EVERY GATE WAS GREEN.** Measured on
the served page (computed styles, composited through the full paint stack — the heading's own tint is
translucent over two further layers, so declared values prove nothing here): the heading read
**6.70:1**, a comfortable AA pass, beside data rows at **15.94:1** in the same table. A heading **2.4×
fainter than the rows it labels**, sitting on the brightest and most saturated surface on the page, is
unreadable however well it scores. `check:contrast` and `check:text-contrast` both passed before and
after — they hold each token to a floor, and no floor was ever breached. **Standing test for any
heading, label or caption: state its ratio AND the ratio of the content it introduces. The gap is the
finding.** Now ~9:1 in both skins; gap 1.75× dark, 1.52× warm.

⚠ **IT WAS REPORTED AS A DARK-MODE BUG AND WAS NOT ONE.** Warm measured **worse** — 5.13:1 against
15.06:1, a **2.9×** gap. Fixing only the branch the owner was looking at would have left the larger
half in place. **A themed portal has two answers to every colour question; measure both before scoping
the fix**, even when the report names one.

⚠ **THE GROUND WAS THE HALF THE 2026-08-14 CALL LEFT BEHIND.** That ruling matched `.th` to
`.moneyGrid thead th` on size and ink. The GROUNDS still differed: the grid heading sat on plain
`--card-bg`, the list heading on `--home-olive-soft` — which is not the quiet wash its name suggests
on a dark ground (accent at 18%, stacking on the navy `--surface-2` that globals.css paints on every
`thead tr`, composited **#121D3B**). `.th` now takes `--card-bg` too. **When unifying two recipes,
enumerate ground, ink, size and face — matching three of four leaves a visible difference and the
appearance of a closed issue.**

⚠⚠ **AN OVERLOADED TOKEN IS NEVER THE LEVER — CHANGE THE RECIPE THAT CONSUMES IT.** `--home-olive-soft`
looked perfectly centralised (one definition per skin) and was the obvious fix. It is also row hover,
active chip fills, and — via `.tableAsCards` — the ground of every table on a phone: **198 uses across
54 files, four unrelated jobs.** Moving it would have repainted all four to fix one. This is the
2026-08-03 "a tinted surface is not a hairline" lesson one job further on. **Centralised and safe-to-
change are different properties; count the jobs before pulling.**

⚠ **THE STRAGGLERS WERE THE OTHER HEADINGS, NOT THE TOKEN.** Four column-heading recipes had drifted
apart — `.th` and `.moneyGrid thead th` (0.78rem/--white-60), `.ppGrid thead th` (0.68/--white-45) and
`.insightsTable th` (**0.65rem/--white-35**, the faintest text in the portal labelling columns of
--white-90 data). All four now carry **0.78rem / 700 / 0.05em / uppercase / --white-70**. Both folded
grids sit in `overflow-x:auto` wrappers; an A/B on one server (new state, then old sizes restored by
in-page override) measured **zero** page-level overflow introduced and **zero** tables newly needing
their scroller at 361/390/768/1440.

⚠ **TH-3a WAS SILENTLY OPEN, AND ONLY AN ORG OVERRIDE COULD SHOW IT.** The dark gate defined the tint
as `rgba(var(--primary-rgb), 0.18)` — the **org-overridable** token — inside a selector that is
operator chrome (the coaches shell marker + the help reading surface). TH-3a (2026-07-21) pins
operator chrome to `--platform-primary` precisely so a club's brand cannot bleed in. A club with a red
brand got a red portal: row hover, chip fills, every stacked table card. **Invisible in every review
because every org ever measured uses the platform default** — proved by injecting a red override and
confirming the tint no longer follows. Now `--platform-primary-rgb`. **A token wired to the wrong
source is untestable on default data; assert it by overriding the source, not by reading the value.**
**Sister instance deliberately NOT changed:** `ConsumerShell.module.css`'s dark nav gate carries the
same line on a consumer-facing surface where org colour may be intended — it needs its own call.

**Status:** design ruling + binding mockup, 2026-08-15. **BUILT on dev the same day**, verified by
reading computed styles on the served page rather than screenshots.

⚠ **A NEAR-MISS WORTH THE PARAGRAPH — THE 2026-08-08 SWEEP HAPPENED AGAIN, THEN UNDID ITSELF.** This
session staged its hunks; a concurrent agent ran `git commit` in the window before they were verified
and swept them into `630b965c`, a docs commit ("two plans for the money forms") saying nothing about
them. That agent then **amended** its own commit (`630b965c` → `edc451e0`), which silently took the
swept CSS back OUT of history while leaving it in the working tree — so the change was briefly
committed under someone else's message, then briefly committed nowhere at all, with no signal either
time. It is committed properly here only because the reference was re-checked rather than trusted.
**Three lessons, all cheap:** staging explicit pathspecs does not close the window and cannot — the
hazard is the gap between staging and committing, so do both in ONE step; a commit hash written into
a doc is a claim that expires the moment a neighbour amends, so **verify a hash is still an ancestor
before publishing it** (this entry cited `630b965c` for several minutes and was wrong); and
`git status` showing a file as clean means it matches HEAD, **not** that your change is safely in
history — after an amend upstream those are different statements.

Gates green: `check:contrast`,
`check:text-contrast`, `check:tokens` (all 6 scopes), `check:css-purity`. ⚠ **`.insightsTable` was NOT
measured** — the UAT fixture renders no insights table, so its fold is reasoned from the shared recipe
and is the one part of this change owner QA must look at directly. Owner QA still owed.
[[design-system]] [[design-principles]]

---

### 2026-08-15 — A row's trailing cell has THREE affordances, chosen by what the action does — and "edit" is a pencil plus the row

**Trigger:** owner, on a proposed "⋯" menu for Edit/Delete on the expenses rows: *"looking at how our
tables act in budget and player dues, I don't want to add a third edit option. I want consistency
here — budget has pencil, payables has chevron, you are proposing a full text button."*

**A survey of every Money-hub table found FIVE idioms doing the same job, and no recorded rule.**
Pencil + whole-row click (Budget Plan → edit modal). A bare decorative chevron with the row clickable
(Player Dues roster → drawer). Chevron + hidden label (Payables, Payment requests → expand in place).
A plain text button (Mark Paid, Recategorize, Cancel). Icon-only pencil beside an unstyled trash with
no shared class and no accessible name (Dues drawer payments/credits). The proposed kebab would have
been a **sixth** — and no coach surface has ever used one.

**DECISION — three affordances, chosen by INTENT, not by table:**

| The action means | Affordance |
|---|---|
| *Open this record to edit it* | **`RowEditButton`** (pencil, icon-only, required `label`) **+ `.rowTappable` on the row** |
| *Show me more of this row, here* | a **chevron** with `aria-expanded` (unchanged — Payment details, Details) |
| *Do this one specific thing, now* | a **labelled text button** (unchanged — Mark Paid, Recategorize) |
| *Go somewhere else* | the **name is the link** (unchanged — Fundraisers; never a row-level onClick) |

**Riders, all binding:**

1. **DELETE IS NOT A ROW ACTION.** It lives in the edit form's footer, opposite Save, behind a
   confirmation — the pattern Budget Plan set in 2026-08-13. This is *why* a row needs only one
   control, and therefore why no overflow menu is required. **A "⋯" kebab is not an approved
   affordance in the coaches portal.**
2. **The pencil is the SEMANTIC control; the row is the pointer/touch shortcut.** Ignore a click that
   ends a text selection — copying an amount is not tapping a row.
3. **≤640 the pencil becomes a LABELLED button — it is never hidden.** Give it a `.cardActionLabel`
   span ("Edit"), exactly like "Payment details": icon-only on a desktop, icon + word once the row
   stacks into a card. The row stays a shortcut on top of it.

   ⚠ **Do NOT copy Budget Plan's clip-to-zero treatment into a `.tableAsCards` list.** Budget's rows
   are the ledger grid, which the card rules never touch. In a card table,
   `.tableAsCards td.cardActionCell > button` sets `width: 100%` to make trailing controls real
   touch targets — and a `position: absolute` button has no positioned ancestor there, so that 100%
   resolves against the PAGE. The result was a 361px-wide invisible button pushing the document 30px
   sideways: the coach-expenses page-overflow finding, 2026-08-15. **Two idioms, two treatments; the
   fact that both are "a pencil" is not enough to share a rule.**

   ⚠⚠ **It took three attempts because a stale bundle lied.** Two experiments "proved" the cause lay
   elsewhere — both ran after a dev-server child had been hard-killed, so the browser was served old
   CSS and never tested the code being edited. **When a rendered finding contradicts the source you
   are reading, restart the dev server before believing either.** The measurement is only evidence on
   a healthy server.
4. **An icon-only control's `aria-label` IS its name.** `RowEditButton` is a component rather than a
   class precisely because a shared class stops STYLE drifting and does nothing about MARKUP — and
   markup is where this control actually failed (three Dues trash buttons shipped with no name at
   all). The prop is required; there is no way to render one without it.
5. **A chevron means "expand in place" and nothing else.** Where a chevron opens a drawer or
   navigates (the Dues roster), that is tolerated legacy, not a pattern to copy.

**Why the pencil won over the kebab:** these tables carry one or two row actions, not four or five. A
menu would cost a click on every edit and introduce an idiom the portal has never used, to hold a
single item. Consistency was available for free — Budget Plan was already right, one tab away.

**Still to adopt:** Budget Plan keeps its own local copy of the pencil (`budget.module.css`
`.actionBtn`/`.editBtn`); it is behaviourally identical and should move to `RowEditButton` on the
next pass through that file.

---

### 2026-08-14 — A hint that explains a CONSEQUENCE is content, not chrome — and a scroll container needs a visible end, not just a reachable one

**Trigger:** owner, on the Add Expense modal: *"the padding around this 'counts as…' message is too
much and the tags are slightly hidden behind the bottom nav."*

**BOTH SYMPTOMS WERE ALREADY WRITTEN DOWN — ONE AS A WARNING, ONE AS A FIX APPLIED ONE LEVEL TOO
SHALLOW.** That is the durable part of this entry.

⚠ **`.muted` CLAIMED ANOTHER FOUR.** The class is an EMPTY-STATE BLOCK carrying `padding: 2rem`, and
its name advertises a colour. `coaches.module.css` has carried a ⚠⚠ banner about this since three
earlier bugs traced back to it — and the Expenses panel alone still held **seven** callers using it
to grey inline text, six of them invisible in review because 32px of air reads as "generous
spacing" rather than as a bug. The Paid-by hint was the one that finally looked wrong, because its
32px LEFT padding broke alignment with the select it belongs to. *A documented trap is not a closed
trap; the warning stops the next author, never the existing callers.* All seven are now
`.mutedInline` or the form-hint pair.

**DECISION — `.formHintConsequence`, a second rung on the form-hint ladder.** `.formHint`
(0.72rem / `--white-45`) is sized for microcopy — *"optional"*, *"max 200 characters"*. A sentence
that states **what the form is about to do** ("no cash leaves the team — the team owes this family
instead") is the coach's reason for choosing that option at all, and demoting it to microcopy while
fixing the padding would have traded one defect for a quieter one. The modifier takes 0.78rem /
`--white-55`, with the bolded outcome at `--white-90`. **Fixing a spacing bug is not licence to
also shrink the thing you were unindenting.**

⚠ **THE SCROLL BODY NOW ENDS 0.75rem BELOW ITS LAST FIELD.** `.modalScrollBody` already made the
footer static so nothing overlaps — the earlier fix was correct and the Tags field genuinely was
*not* behind anything. But at maximum scroll the input's bottom border landed **exactly on the clip
line**, which the eye reads as tucked-under regardless of what the box model says, and which really
does shave the focus ring off the last control. *A user reporting "hidden behind the nav" may be
reporting a boundary with no margin, not an overlap — check before re-fixing an overlap that isn't
there.*

**Applies to:** `.formHint` / `.formHintConsequence` / `.modalScrollBody` (portal-wide),
Add Expense + Add Payable modals, Expenses panel. Built on dev 2026-08-14.
[[design-principles]] [[design-system]]

---

### 2026-08-14 — A status that grades COMPLETION cannot answer "who do I chase?" — every label must answer one question, and it has to be the coach's

**Trigger:** owner, on the Player Dues table: *"can we make these statuses more clear? I don't like
partial, I prefer if parents are paid to-date then it should say 'paid' or 'up-to-date'… those that
are 'past due' should clearly say so instead of just '3 overdue' at the bottom."*

⚠ **THE DEFECT, AND IT IS A CLASS OF DEFECT: THE STATUS COULD NOT SEE TIME.** It graded SEASON
COMPLETION — how much of the year's dues had arrived — while the coach reading it was asking
something entirely different: *is this family behind?* So a family paying every installment on the
day it fell due read **"Partial"**, and a family who had paid nothing with a bill a month late read
**"Partial"** too. **One word for the model family and the delinquent one.** The only hint that
anybody was behind was a *"3 overdue"* line under the whole table — a count with no names, which
makes a coach re-scan every row to find them.

**DECISION — six labels, and every one answers "does this family owe us anything RIGHT NOW?"**
`Not set` · `In credit` · `Fully paid` · `Settled` · **`Past due`** · **`Up to date`**.
`Partial` and `Unpaid` are retired.

⚠ **"UP TO DATE" DELIBERATELY COVERS A FAMILY WHO HAS PAID NOTHING**, when their first bill has not
come due. They owe nothing today; calling that "Unpaid" cried wolf on families who had done nothing
wrong, and a status column that cries wolf gets ignored — the same reasoning that quieted the
never-paid alarm in 2026-08-03. *How far through the season a family is* is what the Paid and
Balance columns are for; *who needs chasing* is what the status column is for. One column, one job.

⚠ **THE COLUMN IS QUIET EXCEPT WHERE ACTION IS NEEDED.** "Up to date" is the commonest state on a
healthy roster, so it takes ORDINARY INK, not green: **a column that is mostly green has no colour
left to spend on the row that matters.** Green stays with the season's finished states; danger is
spent only on `Past due`, which also carries a ⚠ glyph — colour never states a verdict alone.

⚠ **ONE PREDICATE FOR THE ROW AND THE FOOTER.** The table's "N overdue" count and the row's "Past
due" are answers to the same question, and it WAS answered twice — the footer hand-rolled a loop
while the status column knew nothing about time. `hasPastDueInstallment` is now the single
definition both read. *A screen that answers one question two ways is a screen nobody trusts.*

⚠ **LATENESS IS JUDGED ON THE REMAINDER, NEVER THE PAID STAMP.** Credits settle bills and `paid_at`
deliberately never stamps a credit-covered row (Paid stays cash), so a bill fundraising has covered
is not late for anyone.

**Also removed: the mode-blind fallback branch**, which graded off `rollingBalance` alone and once
read a keep_separate team's unapplied credit as "Settled" while the family still owed every cash
dollar (a /review Critical). The derived figures are now required — a compile error is the right
answer for any caller that cannot supply them.

**Status:** design ruling + built on dev, 2026-08-14. The export reads the same word list, so the
spreadsheet says "Past due" wherever the screen does. Help guide gained a plain-language
"What each status means" list. [[design-principles]]

---

### 2026-08-14 — A row whose only correction is Delete forces destruction to fix a typo

**Trigger:** owner, on the built ledger: *"can you just add a confirmation modal after clicking it?
also, can we add edit buttons to the payments and fundraising so we don't only have the delete
option?"*

**THE DEAD END.** A payment row offered one correction: remove it. Fixing a wrong amount therefore
meant destroying a receipt and re-typing all four fields — amount, arrival date, method, note —
with the real arrival date and the note the likeliest casualties. *Delete-as-the-only-correction
is not a safety feature; it is a data-loss feature wearing one.*

**DECISION — Edit is a UI affordance over a void-and-re-post.** The binding accounting rule stands
untouched (**a posted ledger entry is NEVER rewritten; corrections void and re-post**). An edit
voids the old entry and posts a fresh one. **The coach experiences an edit; the books keep the
correction trail.** The two are not in conflict once you stop treating "edit" as a database verb.

⚠ **THE ORDER IS CHOSEN ON WHICH FAILURE IS SAFER, not on which reads better.** With no transaction
available, one of these happens on a mid-flight failure:
- *record-then-remove* → a **duplicate**: the books overstate cash received and nothing on screen
  says which row is real.
- *remove-then-record* → a **missing** receipt: the books understate, the row visibly disappears,
  and the coach still has every value in the form.
**Understating cash is the safer error and the visible one**, so removal goes first and the failure
message says outright that the original has already gone.

⚠ **EDIT ONLY WHAT THE USER AUTHORED.** A credit created BY another record — a fundraiser rebate
(raised × rate), an overpayment (a payment's excess), a reimbursement (an out-of-pocket expense) —
has its amount stated by that record. Typing over it here leaves two disagreeing numbers with no
way to tell which is true, and the next reconcile silently overwrites the correction. Those rows
now say **where they came from** (*from fundraiser* / *from expense* / *auto*) instead of offering a
pencil. **Provenance is not a label to be retyped**, so the credit's TYPE is locked while editing
too: a contribution that becomes a fundraiser rebate by retyping is a credit whose story matches no
record anywhere.

⚠ **AN EDIT INHERITS ITS DELETE'S HAZARDS.** Lowering a credit strands paid-out cash exactly as
deleting it does, so the edit door repeats the delete door's refusal verbatim. *When you add an
edit path beside a delete path, re-read every guard the delete has and ask which of them the edit
has just walked around.*

**And the confirmation dialog is what makes an icon-only money button honest.** The same pass shrank
the record control to a 28px tick; a tick that writes a payment the instant it is touched asks the
coach to trust a glyph. The dialog is where the three facts the button no longer has room for get
stated — how much, what day, and that it can be undone. It costs a click on the hub's fastest path,
deliberately. *Shrinking a control's chrome moves its explanation somewhere else; it does not
remove the need for one.*

**Status:** design ruling + built on dev, 2026-08-14; help guide updated in the same unit of work.
[[design-principles]]

---

### 2026-08-14 — Two controls whose mis-taps cost wildly different things must not share a target

**Trigger:** owner, on the built ledger: *"can we make the button smaller and nicer looking? any ideas
on a way to mark it paid without this big 'record as paid' button?"* — then, choosing option B from
the four drawn at real size: *"I like the quiet tick. on mobile, should we include it on the main bar
or still only when it is open?"* Mockup (binding):
`claude.ai/code/artifact/e73e9842-300d-484c-808e-f3c76bacf780#button`.

**DESKTOP — a 28px icon button replaces the three-word filled one.** It had wrapped to two lines in
its column and was drawn on every row that owed something — up to twelve times in one schedule.
Same rule as the export-menu chips: **anything drawn beside every item in a list is drawn as many
times as the list is long**, and collectively it out-shouted the numbers it decorated.

⚠ **THE GLYPH IS NEVER A CHECKMARK ON A ROW THAT ALSO REPORTS STATUS.** The Note column beside it
uses ✓ to mean *settled*; the same mark inside a button forty millimetres away reads as a state
rather than an action — an expensive confusion on a control that writes money. A banknote says
"money in" without borrowing the status vocabulary.

⚠ **ICON-ONLY OBLIGES A REAL NAME, AND IT QUOTES THE AMOUNT** — "Record as paid: $150.00, dated
today". An icon button with no accessible name is not a button to a screen reader; one that doesn't
say what it is about to record is a leap of faith.

**PHONE — the words stay, and the control lives INSIDE THE OPEN CARD, never on the collapsed bar.**
That was the owner's question, and the answer generalises:

⚠ **THE COLLAPSED BAR IS ALREADY A TAP TARGET — IT TOGGLES THE CARD.** Nesting a money-WRITING
control inside a harmless one, at the right edge where thumbs land, makes the two compete, and
**the costs of missing are wildly unequal**: miss the small one and a card opens (nothing
happened); miss the big one and a payment is recorded. *Two controls whose mis-taps cost that
differently must not share a target.*

**And the second tap is a feature, not a toll:** opening the card is the confirmation a desktop
doesn't need — it shows the $150.00 about to be recorded before the tap that records it. A phone is
used for one family at practice, not a reconciliation session.

**A hover-reveal was drawn and rejected on sight** (option D), for the reason this repo has already
caught once: a hover-only control is unreachable by keyboard, invisible to a screen reader, and
does not exist at all on a phone.

**Status:** design ruling + built on dev, 2026-08-14. Touch pointers get the 44px floor via
`@media (pointer: coarse)`; a mouse does not, and the row does not grow for nothing.
[[design-principles]] [[design-system]]

---

### 2026-08-14 (build) — When a summary and a totals row are the same four figures, the one that survives a collapse is the one that stays

**Trigger:** owner, on the player ledger: *"it would also be nice if we saw 4 columns… for mobile,
make this a collapsable card… can the note be in another column? … the labels in the totals at the
bottom are unnecessary."* Binding mockup: `claude.ai/code/artifact/e73e9842-300d-484c-808e-f3c76bacf780`
(source `COACH_PLAYER_LEDGER_COLUMNS_MOCKUP.html`). Built on dev the same day.

**THE SHAPE — four money columns per installment, each totalling to a tile at the head of the
drawer:** `installment − credit = after fundraising`, `after fundraising − paid = owing`. The summary
stops being four unrelated facts and becomes one sentence read left to right.

⚠ **THE TABLE CARRIES NO TOTALS ROW, AND THAT WAS DECIDED BY THE PHONE.** Removing the captions
(as asked) exposed that the footer and the four tiles were the same four figures — one had to go.
The tiles won because **every installment collapses on a phone**: a totals row under eight closed
cards is the same answer, further away, while the tiles stay where the eye lands. *Generalises: when
two summaries of one dataset compete, keep the one that survives the most collapsed state of the
view.*

⚠ **`Credits −$250` BECAME `After fundraising $550` — the RESULT, not the deduction.** A negative in
a row of positives is the one tile a treasurer has to stop and decode; stating the result makes
every neighbouring pair relate. The credit is not lost: the strip below still names it and offers
the payout.

**THE NOTE COLUMN — "Paid ⟨date⟩" and "$50 covered — ⟨effort⟩" are the same kind of thing.** Both
EXPLAIN the row rather than measure it, and a row is almost never both (cash settled it, or
fundraising did). One column carries whichever applies — **which is the entire reason eight columns
still fit on one line each**. The money columns then hold nothing but money.

**PHONE — ONE COLLAPSIBLE CARD PER INSTALLMENT**, closed on a date and one value: the amount owing,
or *Paid*, or *Covered* (never "Paid" for fundraising — that stays a cash word). Reuses the
By-installment lens's card idiom; one collapsible-card language in this hub, not two.

⚠ **`tableAsCards` HAD TO BE REMOVED FROM THIS FRAME, AND THIS IS THE DURABLE LESSON.** Reflowing a
table into stacked label/value cards is correct at four columns and *catastrophic* at eight — a
twelve-installment season became ~100 stacked lines. **The reflow idiom does not scale with column
count; past about five columns a phone needs a DIFFERENT view, not the same one stacked.** Hiding
the table under 640 is only safe because that purpose-built list exists.

⚠ **DERIVED ONCE, RENDERED TWICE.** The desktop table and the phone cards read one derivation. Two
renderers each doing their own arithmetic off the same payload is the shape of every "the phone said
something different" defect this hub has had.

Also: the drawer widened to a third size (1040px) — eight columns sideways-scrolled at the standard
720, which is the defect the Money-hub table pass closed everywhere else. [[design-principles]]
[[design-system]]

---

### 2026-08-14 — A confirmation that names only the consequence which ISN'T at risk reads as "nothing is at risk"

**Trigger:** owner, on the bulk dues re-run: *"do these manual modifications get overwritten if I
redo the full team payment schedule? should we lock updating the team payments schedules at a
certain point as it seems like it might break things if a user does this mid season, thoughts?"*
Verified against the running product: **yes, silently.**

**THE DEFECT.** "Set dues for all players" gave every player the identical schedule, flattening
every per-player arrangement on the roster — a hardship plan, a deposit-then-balance schedule, a
mid-season joiner's prorated dates. The confirmation screen said *"Recorded payments are kept"*,
which is TRUE and was the ONLY consequence it named. **Money was never the thing at risk.** So a
screen that was factually accurate read as a reassurance about the wrong subject, and the coach was
told nothing about the thing they were about to lose.

⚠ **THE GENERAL RULE: A CONFIRMATION MUST NAME WHAT IT DESTROYS, NOT WHAT IT PRESERVES.** Listing
preserved things is comfort; the coach can only weigh the decision against the losses. And a count
does not weigh — *"3 players have dues"* is arithmetic, *"Priya, Sam and Alex have a schedule you
set by hand"* is a decision.

**DECISION — name them, then offer to keep them.** The refusal returns the affected players **by
name**, plus a count of families whose **due dates would move** (reminders start quoting the new
ones). **"Keep the 3 I set by hand" is the PRIMARY button; "Apply to everyone" is the quieter
one** — the destructive answer stays one click away for the coach who means it, and stops being the
only one *and* the default.

⚠ **DELIBERATELY NOT A MID-SEASON LOCK, which is what the owner proposed.** Re-running mid-season is
legitimate and common (the budget changed, a tournament was added, the fees were wrong) and the help
guide promises it works. A date-based lock would block the honest case while missing the damaging
one: the damage lands on the FIRST re-run after any hand-edit, which can happen in week one. *When a
destructive action is also a necessary one, the answer is a better question, not a locked door.*

**Status:** design ruling + built on dev, 2026-08-14; help guide updated in the same unit of work.
[[design-principles]]

---

### 2026-08-14 — A date is ONE token and never breaks. A column of them starves when the column beside it is prose

**Trigger:** owner, on the player ledger modal (Player Dues → a player): *"the rows are high due to
the date spilling over, can we make better use of this space?"*

**The mechanism, and it generalises to every table in the portal:** auto table layout distributes
width by content demand, so a column of long prose — a credit source, an expense note, a
description — takes its width from whatever is least able to argue. The date column loses, `Sep 15,
2026` folds after the comma, and **every row in the table then stands at two lines' height to
accommodate a value that is always the same width.** Three of the four rows in the owner's
screenshot were tall for no reason at all.

**DECISION — `.tdDate` (nowrap + tabular figures) on any date cell in a list table.** The date is
the one column whose content is fixed-width, so it is the one column that can be pinned without
cost, and pinning it hands the freed width to the prose that actually wanted it.

⚠ **NOWRAP IS SAFE HERE ONLY BECAUSE THE CONTENT IS FIXED-WIDTH.** Do not reach for it on a name or
a note — there it buys row height by truncating meaning, and a cut name stops naming anyone (that
is what `.wrap640` exists to undo).

**Two other things went with it, both applications of the wordiness ruling below:**
- **A fully-credit-covered installment's note lost its dollars.** The row already prints the amount
  in its own column and "Covered by fundraising" beside it, so `$200.00 covered — Bottle Drive`
  stated both again; it now names only the SOURCE. A **part**-covered row keeps its figure — the
  split between covered and still-to-send is the one fact nothing else on the row carries.
- **The status cell stacks on a phone only when it has a note** (the conditional `cardStackCell`
  the totals row already uses); three items in one flex line was the alternative.

**Status:** design ruling, 2026-08-14, **BUILT on dev the same day.** Found and fixed in the same
pass: the modal was rendering the literal words **"Paid Invalid Date"** — see the entry below.
[[design-principles]] [[design-system]]

---

### 2026-08-14 (correctness, surfaced by a design review) — One formatter, both stored shapes: a money row mixes a `date` column and a `timestamptz` column and the caller cannot tell them apart

**Trigger:** the owner's ledger screenshot, sent about row height, also showed **"Paid Invalid
Date"** on both paid rows.

**Not a one-off — three screens, three hand-rolled formatters, three wrong,** each in the way its
own local shortcut invited:
- `new Date(s + 'T00:00:00')` — right for a `date` column, but a **timestamp already carries a
  time**, so the concatenation produced a doubled string and printed the words "Invalid Date". This
  hit the **player ledger** and the **By-installment grid** (`completedOn ?? paidAt` — correct
  until it fell back).
- `new Date(s)` — right for a timestamp, but a bare `YYYY-MM-DD` parses as **UTC midnight** and
  renders the PREVIOUS day in any zone behind UTC. The **admin allocation schedule** was showing
  every due date one day early.

⚠ **THE TRAP IS THAT BOTH SHAPES APPEAR IN THE SAME ROW.** `due_date` is a `date`; `paid_at` is a
`timestamptz` (and a PROJECTION since mig 232). A formatter written while looking at one column is
handed the other by the next feature, silently.

**DECISION — `formatStoredDate()` in `lib/timezone.ts` is the ONE formatter for a stored date a
user reads.** It takes both shapes, resolves a timestamp through the **org zone** (never a raw
slice — a payment recorded after 8 PM Eastern is stored on the next UTC day), returns `—` rather
than ever emitting "Invalid Date", and drops the year on request for a column whose heading already
carries the season. Regression tests live with the date-correctness guardrail suite, which was at
zero and is back at zero.

**Status:** shipped on dev 2026-08-14 with the ledger layout pass; all three call sites converted.
[[design-principles]]

---

### 2026-08-14 — A card headline is the subtraction. A row that repeats it is the longest phrase on the card saying the least

**Trigger:** owner, on the Money Overview Budget card: *"this card is too wordy, we don't need the
1930 left or 3700 still out, don't need the word 'scheduled' (2700 of 6400 is sufficient)."*

⚠ **THIS AMENDS THE 2026-08-14 BUDGET-CARD RULING**, which specified that each plan-vs-actual row
*"states its delta in words"* (`$650.00 left` / `$1,200.00 still out` / `✓ $250.00 past goal`). The
bars, the shared dollar scale, the headroom headline, the chip, the stripe-not-colour rule and the
empty states are all untouched.

**The defect the render exposed:** the Spending row's delta was **the headroom headline verbatim,
one line down** — `$1,930.00 headroom` above, `· $1,930.00 left` below. Every row then had to
carry a third clause to match, so the widest, most-punctuated text on the card was the part that
added nothing. **A delta between two numbers printed side by side is arithmetic the card is doing
out loud.**

**DECISION — a plan-vs-actual row states TWO figures, `actual of planned`, and nothing else.** No
remaining-amount, no "still out", no "to go", and no noun after the second figure (`$2,700.00 of
$6,400.00` — "scheduled" was labelling a number whose label is already the row's own name).

**Three exceptions, all of them verdicts rather than arithmetic:**
- **`▲ over plan` on an overrun — a word, never the amount** (the amount is in the headline). The
  striped segment still must not carry that verdict on colour alone (measured ΔE 1.0 deutan), and
  this is what keeps that guard standing.
- **`✓ all in` / `✓ goal met` / `✓ past goal`** — good news a reader will not infer from two
  numbers that happen to be equal. The dollars beside `past goal` went; the ✓ stayed.
- **`no goal set` / `no installments yet`** — these explain why the SECOND figure is missing.
  Absent is not derivable.

**Generalises past this card:** *when a headline is a difference, the rows beneath it are the
operands.* Any row restating the headline's own number is decoration wearing a number's clothes.

**Status:** design ruling, 2026-08-14, **BUILT on dev the same day**; the in-app Money guide's
Budget-card sentence was corrected in the same unit of work (it promised "what's left, still out,
or to go"). [[design-principles]] [[design-system]]

---

### 2026-08-13 (placement, final) — IMPORT is hub-wide; EXPORT never is. If the answer changes with what the coach is looking at, the button belongs beside what they are looking at

**Trigger:** owner, on Budget vs. Actual: *"we have 2 exports in budget vs actual, how do you propose
we resolve this?"* — then, on being shown the options: *"I am reconsidering this export now that I
realize how many variations of money exports we seem to have in the application, it is going to make
this universal one too complicated and not relevant to what they are viewing on the screen."*
Mockup (approved, binding): `claude.ai/code/artifact/96675523-ec03-4431-9e67-ffef4ce1c69a`
(source `docs/projects/active/COACH_MONEY_EXPORT_PLACEMENT_MOCKUP.html`).

⚠ **THIS REVERSES DECISION 1 OF THE 2026-08-13 ACTION RULING FOR EXPORT ONLY.** That ruling gave the
Money hub two hub-wide dataset menus, `Import ▾` and `Export ▾`. Import was right. Export was not,
and the screen said so out loud: **Budget vs. Actual grew a SECOND Export button**, because the hub
menu could only offer a generic category table while the page could offer the month grid at the
reading the coach had actually chosen. Two buttons, same word, different files, forty millimetres
apart.

⚠ **THE GOVERNING DISTINCTION, worth carrying to any surface: THE TWO ARE NOT THE SAME KIND OF
DOOR.**
- **Import has one right answer per dataset, wherever the coach is standing.** Bringing in budget
  lines does not depend on which tab is open or how anything is filtered. Genuinely hub-wide.
- **Export never does.** Every Money tab carries view state a header cannot see — two shapes and
  four readings on Budget vs. Actual, List/By period on the plan, three sub-tabs and a tag filter
  on Expenses. A hub-wide export can only be honest for a dataset with ONE shape, and almost none
  of them have one.

**DECISION — Export moved into each tab's own control row; Import stayed in the header.** Seven of
eight tabs gained one (Overview is a dashboard, not a dataset, and keeps carrying no actions). It
exports what is on screen, arranged the way the coach arranged it, so "which shape did you mean?"
stops existing rather than being answered. The **file-type dialog is unchanged** and is now the one
place that question is asked anywhere in the hub.

**Not five placements — one placement, five times.** Every tab already had the same control row from
the action pass; Export joins it as the right-most item. That was the owner's stated worry
("different places depending on the page") and the row is what answers it.

⚠ **THE PHONE RULE GOT SIMPLER, WHICH IS USUALLY THE SIGN A PLACEMENT IS RIGHT.** It read "the phone
header drops imports and spreadsheet exports" — tied to the header. It now reads: **a phone is
offered an export only where the file is something a coach can READ, SHOW or SEND.** Player Dues and
Budget vs. Actual keep one, as PDF; the rest do not. That is what it always meant.

⚠ **EXPORT IS NOT WRITE-GATED — reading is not writing.** A read-only money assistant sees Export on
every tab and no create buttons. Moving a control must never quietly change who can use it.

**Accepted costs, both real and both the owner's call:** the hub no longer has one place listing
everything exportable (the original complaint was "only 2 of 7 tabs have an export", and the fix for
that is every tab having one in a predictable spot); and "which datasets make a PDF?" is no longer
answerable from one screen, so the in-app Money guide names them.

**Status:** design ruling + binding mockup, 2026-08-13. **BUILT on dev the same day.**
`MoneyDataMenus` became `MoneyImportMenu`; `MoneyExportButton` is the one Export control, owning
the dialog, the PDF plan gate and the phone rule so none of it is re-decided per tab; the shared
export module became PURE BUILDERS over data the caller already has, because a module that fetched
its own data was the hub-wide assumption in disguise. [[design-principles]] [[design-system]]

---

### 2026-08-13 (file type, superseded in placement only) — Anything drawn beside every item in a list is drawn as many times as the list is long: the file type moved into a Save-As dialog

**Trigger:** the owner rejected TWO in-menu attempts on sight, in the same session. First format
chips on every row (12 buttons for 3 file types); then a quieter shape — a muted default label plus
a "···" overflow — which they also declined: *"I don't like this option, doesn't look good. let's
remove the 3 dots, the title, and the excel tags and just when a user clicks they can click which
format they want in a new modal. this is normal experience that users are familiar with in other pc
apps when they want to print or save a file."* Mockup that framed the choice:
`claude.ai/code/artifact/6dfb7890-184f-4141-ae96-2fd5ce09f591`.

⚠ **THE GENERAL RULE, and the reason two builds failed before this one landed: ANYTHING YOU DRAW
BESIDE EVERY ITEM IN A LIST IS DRAWN AS MANY TIMES AS THE LIST IS LONG.** At five datasets, one
extra token per row is five tokens; three is twelve. It does not matter how quiet each one is —
collectively they out-shout the names they decorate, which are the only thing the coach is choosing
between. **Both failed attempts were variations on "put the format on the row"; the fix was to stop
putting anything on the row.**

**DECISION — the Export menu is FIVE NAMES AND NOTHING ELSE. Picking one opens a dialog asking
which file type.** No heading, no format tags, no overflow control. The dialog is the Save As /
Export dialog every desktop application already has, so it needs no teaching — and it is the one
place with room to say what each file type is FOR ("Excel — best for working with the numbers",
"PDF — a printable document you can share") rather than assuming a volunteer treasurer reads file
extensions.

**Accepted costs, both real:**
- **Two clicks instead of one** for every export. Judged worth it: the menu is now scannable, and
  the second click is the one that removes doubt about what you are getting.
- **"Which datasets can I print?" is no longer answerable from the menu** — a coach must open a
  dataset to find out. The in-app Money guide names the two that offer PDF, because the menu no
  longer can.

**Kept:** a dataset left with only ONE format after plan-gating skips the dialog and downloads —
a dialog whose only answer is already known is a click nobody needed.

**Status:** design ruling, 2026-08-13, **BUILT and probed on the live page the same day** (menu
rows carry no tags; the dialog opens, names each format, and Escape closes it; PDF verified absent
on a `tournament`-plan org — absent, not locked). This supersedes the Export half of the amendment
directly below, which is kept only for the reasoning that led here. [[design-principles]]
[[design-system]]

---

### 2026-08-13 (superseded, kept for the reasoning) — A format is a property of the COACH, not of the dataset: the row is the spreadsheet, everything else is one step in

**Trigger:** owner, on the shipped Export menu: *"do we need all of these repetitive buttons? is
there a better way to organize this? perhaps after clicking what I want to export I select the
format?"* Mockup (approved, binding): `claude.ai/code/artifact/6dfb7890-184f-4141-ae96-2fd5ce09f591`
(source `docs/projects/active/COACH_MONEY_EXPORT_MENU_MOCKUP.html`) — today's render, three options
drawn full-size, and the trade-offs counted.

⚠ **THIS AMENDS THE ENTRY BELOW, WHICH SPECIFIED FORMAT CHIPS ON EVERY ROW.** That was drawn to
avoid a nested menu, and the reasoning was sound in the abstract. Rendered, it was wrong: five
datasets × three file types produced **twelve buttons**, with "XLSX" and "CSV" each printed five
times down a five-item column. **The repeated part read louder than the dataset names — the only
part a coach is actually choosing between.** Nothing else in that entry is reopened.

**DECISION — clicking a dataset gives the SPREADSHEET; the rest sit behind a "···" on that row.**
Twelve controls become five. The common case stays one click. This is not a new invention: it is
the tournament admin's export convention and the platform's own written export standard
(spreadsheet on the primary click, everything else one step in), so the coach and admin halves of
the product now agree rather than each having their own idea.

⚠ **THE OVERFLOW OPENS ON CLICK, NOT HOVER — and the approved render showed hover.** A hover-only
reveal cannot be reached by keyboard and does not exist for a screen reader, so the single
affordance carrying CSV and PDF would have been invisible to anyone not using a mouse. Same
affordance, same one step; it is a real button with a real expanded state. **Generalises: a mockup
can draw an interaction that only works for a pointer, and the build is where that gets caught —
"revealed on hover" in a drawing means "unreachable for some people" in code.**

**Two options were drawn and declined, both for reasons worth keeping:**
- **Format picked once, at the head of the menu** (the strongest rival, and the recommendation the
  owner overruled). Twelve controls → three, and it answers "what can I print?" outright. Declined
  because it needs a DISABLED row: only two of five datasets make a PDF, so choosing PDF leaves
  three rows with nothing to give, and the portal otherwise avoids disabled states.
- **Pick the data, then the format** (the owner's own opening proposal). Declined on the count: two
  clicks for the thing coaches do most, and which datasets can be printed stays invisible until
  you have already committed to one — "what can I print?" would take five openings to answer.

**Kept from the declined pair:** the second panel's insight that file types read better as WORDS
than extensions. The overflow says "Excel", "CSV", "PDF" — and the menu's heading names what a
plain click gives ("Take out of Money — as Excel"), so a bare dataset name still says what it
produces.

**Status:** design ruling + binding mockup, 2026-08-13. **BUILT on dev the same day.** Amends the
Export half of the entry below; the Import menu, the menus' placement, the phone rule and every
tab-toolbar decision are untouched. [[design-principles]] [[design-system]]

---

### 2026-08-13 — A button belongs to the nearest chrome that NAMES what it acts on; a hub header names the container, not the thing

**Trigger:** owner, on the Money hub's Budget Plan tab: *"can we move all import/export buttons next
to the help button in the coaches portal headers for consistency? it seems to be there sometimes and
not other times… perhaps an overall review of all pages should be taken first, inventory the buttons
and their types."* Mockup (approved, binding visual spec):
`claude.ai/code/artifact/44162825-32ef-4744-90dc-7939ee635e9e` (source
`docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_MOCKUP.html`). Plan + PM brief:
`COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md`.

**The literal request was declined and the observation behind it granted.** The help "?" is chrome
and owns the top-right corner alone (2026-08-11 rule 3); actions may not move into its slot. On the
ten screens that already have header actions, Import/Export are *already* immediately left of it —
so the ask was largely true where it applied, and the real faults were elsewhere.

⚠ **THE GOVERNING RULE, and the one worth carrying to any other surface: a button belongs to the
NEAREST CHROME THAT NAMES WHAT IT ACTS ON.** This supplies the answer the 2026-08-11 ruling could
not, because that ruling was written for pages whose header names the page. A **hub** header names
the *container* — "Money" — so a create button parked up there is orphaned by construction and
becomes three different buttons as the coach changes tab. The rule explains why standard pages pull
their stray actions UP into the header while hub tabs push their creates DOWN into content: both are
moving toward the label that describes them. **It also predicts the non-changes** — Lineups' "New
template" already sits in the templates card, so Lineups needed nothing.

**DECISION 1 — a hub's header carries only hub-wide doors, as DATASET MENUS.** Money gets constant
`Import ▾ / Export ▾`, identical on all seven tabs, each listing what to move (budget lines, dues,
expenses, fundraisers, budget vs. actual) with format chips on the row so there is no second menu.
This is the tournament admin's Data Tools pattern brought across, not a new invention. It answers a
question the old design could not: a coach wanting the season's money in a spreadsheet no longer has
to guess which tab hides the export (2 of 7 had one).

**DECISION 2 — the tab bar stays PURE NAVIGATION; every tab-scoped action drops into that tab's own
toolbar.** Five of the seven tabs already have a control row (List/By period, the category filter,
the lens picker), so this REMOVES a band on net rather than adding one. It also retires the
"shorten the tab labels to make room" trade-off entirely. **Player Dues resolves itself:** its two
bulk actions act on the dues list, not on Money, so the header that was going to run four buttons
wide runs two.

**DECISION 3 — the header cap is TWO buttons plus help, lowered from three DURING the review.** The
three-button Plan templates render was drawn to spec and rejected on sight by the owner as
"jumbled". It was: three buttons plus a long title plus help is unreadable below ~900px. ⚠ **The
lesson generalises past the number — "move stray actions into the header" was never the rule, and
treating it as one is what produced the bad render.** Each button must earn the header on its own.
Two consequences, both now rules: **two ways to create one thing is ONE button with a choice inside
it** (`New template ▾` = blank | from a past season; same fold for Drills), and **a library control
that outlives the page goes to the list toolbar** (Plan templates' "Your tags", matching the
identical call already made for Expenses' "Manage tags" — an inconsistency introduced and caught
inside the same review).

**DECISION 4 — phones get OUTPUTS, not files.** The phone header offers only exports a coach can
read, show or send: PDF, and add-to-calendar (which on Schedule becomes the most useful button on
the screen at 390px). All imports and every spreadsheet export drop out. Keyed on **what the export
PRODUCES**, not on which screen it sits on, so the rule is one sentence rather than a per-screen
list. Accepted cost: PDF is plan-gated, so a free-plan coach on a phone sees no export at all on
Roster / Dues / Budget vs. Actual — nothing to offer beats a locked button.

⚠ **DECISION 4 RETIRES A DELIBERATE ACCOMMODATION, AND THE MITIGATION IS NOT OPTIONAL.** Both
importers carry a paste-a-block mode built *specifically because phones have no file picker* (it is
documented in the sheet headers). Hiding Import in the phone header makes that path unreachable. So:
**every empty state that can accept an import keeps offering it at 390px.** Import is offered where
the need is felt and not carried around the rest of the time. **Generalises: before removing an
affordance from a breakpoint, read why it was built — an accommodation for that exact breakpoint
looks like clutter from every other one.**

**DECISION 5 — an icon-only secondary is legal only where the coach would have met its LABEL on a
wider screen.** Import, Export and Attendance qualify; "Your tags" never does. A button that exists
*only* as an icon is a guessing game and goes to the list toolbar with its words on. This is the
missing half of the 2026-08-11 phone rule, which said secondaries collapse to icons without saying
which ones may.

**DECISION 6 — a contextual export stays with its context.** Awards' "Print N certificates" prints
the *chosen* award type, so it lives beside the type filter, never in the header.

**Also ruled (same pass):** one name and one weight per idea — "Import payables" → "Import"; every
page's main create is the **filled lime** button (Add Line and Add Expense stop being outlined while
New Fundraiser is filled, one tab apart today); header actions survive the empty state and every
view mode (Roster's whole group, Export included, currently vanishes in Depth-chart view);
navigation is not an action (Roster's "Attendance" becomes a link in the roster count line); and
Overview's setup ring stops travelling through the actions slot, because it is a state display.

**The one real defect found, as opposed to drift:** **Roster bulk-add is unreachable once a single
player exists** — offered only in the empty state and as a second door inside the Add Player modal.
A coach entering fifteen players after tryouts has no way to find a feature that shipped.

**A Data Tools DESTINATION was considered and declined.** Tidiness argues for one, and the
tournament admin has it. Declined for coaches on three grounds: a volunteer between innings is not
in a back-office frame of mind; a destination moves the button away from the moment of need (you
want to import a budget while staring at an empty budget); and coach grants are per-area, so one
page would be half-locked for a coach with roster write and money read. **The useful half was taken
without the page:** "Recent imports" sits at the foot of the Import menu.

**Enforced by a build failure, not discipline** (per the `APPROVED_ARCHIVE_DOORS` idiom): a unit
test pins per screen how many header actions exist and of what kind, so a third button fails the
build until the list is edited — which is the decision point.

**Status:** design ruling + binding mockup, 2026-08-13. **PHASE 1 (the Money hub) BUILT on dev
2026-08-13**; Phases 2–4 (Roster/Schedule → the folds → shared classes + the guard) open. Extends
the 2026-08-11 page-header ruling; reopens nothing in it.

⚠ **THREE THINGS THE BUILD SETTLED THAT THE RULING DID NOT SAY.**
1. **A hub tab and its standalone route are ONE panel, and the doors differ by which chrome is on
   screen.** The `/accounting/{tab}` routes still exist and are still linked. Inside the hub the
   header's menus own Import/Export; on the standalone route there is no such menu, so the panel
   keeps its own plain Import/Export button (rule 8's "single-dataset screens keep plain buttons").
   The CREATE lives in the tab's toolbar in both. Without this the importer and the dues export
   would have become unreachable outside the hub — a silent removal wearing a tidy-up's clothes.
2. **A view-dependent export does NOT fold into the hub menu.** Budget vs. Actual's month grid
   exports what the coach's chosen view and lens show, which a hub-wide menu cannot see; the hub
   row exports the canonical CATEGORY table instead, and the grid's export moved beside the lens
   picker (rule 12). Folding it in would have swapped one export for a different one under the
   same words.
3. **The hub's Import needed a refresh SIGNAL, not a remount.** Panels stay mounted so a
   half-filled form survives a tab switch — so an import fired from the header while another tab
   is on screen would have left a stale budget in memory. Mounted panels re-read; nothing
   remounts. Generalises: when a page-level action reaches past the surface that owns the data,
   ask what the mounted-but-hidden copy of that data now believes.

**Also built, and it is the reason rule 11 is honest:** the empty **payables** list had no import
door at all, so hiding the header menu on phones would have made the paste path unreachable there.
It has one now. [[design-principles]] [[design-system]]

---

### 2026-08-12 — "Everything in Money" folds into TWO columns when its CARD is wide — the trigger is the container, never the viewport

**Trigger:** owner, on the setup Overview shipped hours earlier (entry directly below): *"given the screen
size that we have to work with, is this a good size for these tiles?"* Mockup (approved, binding visual
spec): `claude.ai/code/artifact/b4f5898b-0202-4379-9763-ee080fb1f0b2` (source
`docs/projects/active/COACH_MONEY_RAIL_WIDTH_MOCKUP.html`) — today's render annotated, the two-column
proposal, the capped-measure alternative recorded as **rejected**, and the phone pair.

**The diagnosis was not "the rows are too big."** The rows are the right height; a single full-width
column is the wrong SHAPE for a seven-item index at 1156px. Measured in the browser: the rail ran
**464px tall** with a name and its number at opposite ends of a 1039px cell, while ~800px of horizontal
space carried nothing — vertical scroll paid for on a screen with room to spare across.

**DECISION 1 — two columns, and the season's order survives as down-then-across.** Plan and Collect
left, Spend and Review right. Measured after: **277px** (−40%), the whole rail above a 1440×900 fold,
each row 544px wide. Drawn with **multi-column, not a two-column grid**: a grid forces the top of
Collect to align with the bottom of Spend, opening dead space under a one-row group. Groups carry
`break-inside: avoid` so a step never splits from its rows — keyed on **the presence of a step marker**
rather than on the variant, because the operate rail is one UNLABELLED group and forbidding a break
inside that one would pack every row into column 1 and leave column 2 empty. Markup order is
unchanged, so reading and tab order still follow the season, not the columns.

⚠ **THE TRIGGER IS THE CARD'S OWN WIDTH, AND A VIEWPORT MEDIA QUERY WOULD HAVE BEEN A BUG.** The same
component renders in two very different holes **on the same desktop**: the setup Overview and an
ARCHIVED season give it the full ~1156px page column, while a LIVE operating season puts it in the 1fr
slot of `.row2` beside the Next-30-days ledger — measured at ~362px, where the row shape is already
right and two columns would mean two ~175px columns. No viewport query can tell those apart. A
container query can, so the live dashboard's rail is spared **by construction** rather than by an
exception someone has to remember. **Generalises: when a component's correct layout depends on the
space it was GIVEN rather than the space the window has, the query belongs on the component's own box.
Ask "does this thing render in more than one width of hole?" before reaching for a breakpoint.**

⚠ **THE THRESHOLD IS 940px OF CARD WIDTH, RAISED FROM 720 BY `/review`, AND THE RAISE IS THE MOST
IMPORTANT THING IN THIS ENTRY.** At 720 the rule was measurably wrong twice over, and neither fault
was visible in the mockup, in the approved spec, or in a single-width check:

1. **The card's width is NOT MONOTONIC in the viewport.** Measured on dev, a full-width rail's card
   content goes `786→718 · 800→732 · 900→832 · 940→620 · 1024→704 · 1100→780 · 1280→960 · 1440→1120`.
   The dip at 940 is the portal's own sidebar appearing and taking the width back — so the card is
   **wider at a 900px window than at a 1000px one**. A 720 threshold crossed that curve THREE times,
   and the rail folded, unfolded and folded again as a window was dragged wider.
2. **It broke the very guarantee this design rests on.** `.row2` collapses at ≤860px, so between ~788
   and 860 the LIVE operate rail is full-width too — and at 720 it folded there, into two ~354px
   columns on an iPad Pro portrait (834px), where the `white-space: nowrap` stat squeezes the row name
   into wrapping. "The live dashboard is spared" was false in exactly that band. Two independent
   reviewers reached the same band, one by arithmetic from the three stylesheets and one by
   measurement; they agreed to within 2px.

**940 fixes both with one number:** the no-sidebar band tops out at 832 so it can never fire there,
and the sidebar band only reaches 940 at ~1260px of viewport. Measured after: one column at 390, 768,
800, 834, 860, 900, 940, 1024, 1100, 1180 and 1240; two columns at 1280, 1440 and 1536. **Monotonic —
one switch on the way down, at ~1250.** Every folded column is ≥454px, which is the width the rows
actually needed. The operate rail now never folds at any width, so the guarantee is true rather than
nearly true. **The floor is "two columns must each be worth having", not "the card is biggish"** —
and the cost, accepted: a 1024–1180 laptop keeps the single wide column.

⚠ **Generalises, and this is the transferable lesson: A CONTAINER QUERY IS ONLY AS HONEST AS THE
CONTAINER, AND A SHELL WITH A SIDEBAR BREAKPOINT MAKES CONTAINER WIDTH NON-MONOTONIC IN VIEWPORT
WIDTH.** Choosing the threshold from one wide screenshot is not enough; sweep the width range and look
for the curve doubling back. The fix is never to reach for a viewport breakpoint — that is the bug the
container query exists to avoid — it is to set the threshold above the local maximum of the smaller
band. Do not lower this number.

**DECISION 2 — the group hairline is a SINGLE-COLUMN device and is dropped in the two-column state.**
Across two columns "first group" stops meaning "top of the list", so a rule above a column reads as a
dangling line. The step marker plus the space around it carries the grouping — the hairline never was
what communicated it. It stays wherever the rail is one column. **The unlabelled (operate) rail has no
marker to open a column with, so there its rows keep a hairline on EVERY row including the first** —
otherwise column 1 opens bare and column 2 opens with a rule, and the asymmetry is the same dangling
line by another route.

**DECISION 3 — the step markers step one shade darker (`--home-ink-soft`, 0.6rem) once the hairlines go.**
At `--home-dim` a marker was the same face, casing, tracking and colour as the card's own eyebrow one
line above (0.58rem against 0.62rem), so "PLAN" and "EVERYTHING IN MONEY" read as siblings rather than
as label-and-contents; the hairlines had been papering over it. Verified rendered: `#4A4235` (9.90:1 on
the white card), `--white-70` on dark.

⚠ **AMENDMENT MADE DURING THE BUILD, disclosed not silent: the approved mouse-only 34px row floor is
NOT built. `(pointer: fine)` DOES NOT MEAN "no finger."** A Windows touchscreen laptop reports a fine
primary pointer, so the rule would have served 34px rows to a hand at 1440 — a real device class,
silently regressed, and no media query separates it out. It was also buying the last ~40px of a 187px
win (the "mostly air" complaint was mostly a WIDTH problem: a 44px row in a 544px column is an
ordinary list row, not the object it was at 1156px), and would have added seven NEW sub-floor entries
to the rendered tap-target baseline on a screen about to be QA'd. **Generalises: a pointer-media query
is a guess about the DEVICE, not a fact about the hand; do not trade a touch target for it unless the
height it buys is the point of the change.**

**Closes** the "two-thirds empty" half of the shape question the entry below opened, and supersedes
nothing in it: row wording, row order, which surfaces appear, the step grouping, the tiles and the
anchor card are all untouched. **Also corrected:** the in-app Money help said *"reading down the list
is reading your season in the order it happens"* — true in one column, half-true in two; it now names
both shapes.

**Also ruled by review (same pass):** the labelled groups carry **no `:last-child` margin reset**.
`:last-child` is DOM order and multicol fragments by COLUMN, so the reset zeroed the gap under whichever
group happened to be last in the source and left the two columns asymmetric at their feet. **Generalises:
in a fragmented layout (multicol, print, `columns`), spacing that must look identical in every fragment
cannot be keyed on a position in the source order.** Dropping the reset costs no height — measured 277px
either way, because fragmentation truncates a trailing margin at a column's foot instead of adding it. And a note now sits on `.railCard` because
`container-type: inline-size` silently makes the card a containing block for absolutely-positioned
descendants — inert today, a trap for the first tooltip or badge added inside the rail.

**Status:** built on dev 2026-08-12; **`/review` run (standard tier, 3 lenses) and it earned its keep —
the 720px threshold was a real defect on real hardware, found by two lenses independently.** Verified by
measurement, not screenshot: typecheck ✓, full `verify:changed` ✓, 1,636 tests ✓, and Playwright probes
reading computed styles and geometry across **fourteen** widths — because a layout change that silently
no-ops passes every file-reading gate, and because one width cannot see a non-monotonic curve. ⚠ The
first `check:layout` run after the fix **ABORTED on the memory floor** (a partial sweep is a failure, not
a pass — the exit code seen through a pipe was `tail`'s, not the script's; read the output, never the
code). Re-run on a fresh server. `@container` is this codebase's **first** container query, and the
production build uses webpack + cssnano where dev uses Turbopack + Lightning CSS, so its survival was
proven against a real production build rather than assumed. Owner QA pending, ledger §11.
**Applies to:** the coach Money hub's Overview rail, both shapes. [[design-principles]] [[design-system]]

---

### 2026-08-12 — The Money Overview keeps ONE shape all season: the journey-card stack leaves the setup stages too, and the tiles wait until money has moved

**Trigger:** owner, looking at the Money Overview on a team with nothing set up: *"didn't we plan on
getting rid of these sections now that we have the header tabs and the metric cards? this seems like
additional scrolling for no real added value."* Mockup (approved, binding visual spec):
`claude.ai/code/artifact/f28ebd03-06b8-4c97-9649-fff303da581d` (source
`docs/projects/active/COACH_MONEY_SETUP_OVERVIEW_MOCKUP.html`) — today's render, three options
(A anchor+rail, B prune-the-empties, C anchor-only), a phone pair, and the budget-built stage.
Owner picked **A plus all three follow-on asks** ("go with your recommendations").

**The carve-out being closed.** The Money Overview redesign (2026-08-11) removed the
1·Plan → 4·Review card stack for exactly this reason — *"two navigation systems on one screen"* —
but scoped the removal to `stage === 'operate'` and wrote **"plan | collect keeps today's guided
layout exactly … it is good onboarding."** That sentence is now retired. It reads plausibly and
survives review, because "keep the onboarding" always sounds like the careful choice; it does not
survive the screenshot. ⚠ **This is the second time in two days that a deliberate one-screen
exception, carved for a defensible reason, was rejected on sight by the owner within a day** (the
first: the Overview's iconless page header, entry directly below). The pattern is worth naming: *an
exception scoped to one state is invisible to the person who made it and obvious to the person who
meets the states in sequence.*

**DECISION 1 — the 1·Plan → 4·Review stack is gone from the Overview at EVERY stage.** On a
brand-new team it rendered four section headings and six drill-in cards whose entire content was
*Not started · Not set · None yet · None logged · None assigned · None pending* — the emptiest
possible team getting the longest possible page, below four tiles reading $0 · $0 · $0 · — and a
30-day payables panel saying "nothing due" in three columns. The journey itself was told **three
times on one screen**: in the anchor card's "Plan → Collect → Spend → Review" sentence, in the tab
bar, and again as the four headed sections.

**DECISION 2 — both Overview shapes now end in ONE shared rail.** The setup stages get it as
**"Everything in Money"** — all seven surfaces, one live stat each, grouped under four quiet step
markers so the season's order survives as **row order** rather than as four headings competing with
the tab bar one line above. The operating season keeps it as **"More in Money"** (the surfaces the
three story cards don't already own), unchanged in content and row order. Same component; the
variant decides which rows and whether the step markers show. The Overview therefore keeps one
shape from a team's first day to its last game, and the stage decides only what sits above the rail.

**DECISION 3 — the four headline tiles, and the cash-basis sentence that qualifies them, wait until
money has actually moved.** `$0 · $0 · $0 · —` is four cards restating what the anchor card directly
above them already says, and a caveat about "cash received, not what's owed" qualifies numbers that
don't exist yet. Keyed on money in/out being non-zero — deliberately **not** on the budget:
**a plan is not cash.** They return the moment there is something to report.

**DECISION 4 — the "What's coming up" payables panel waits until something could fall due**, and
**the panel itself decides that, from its own fetch.** ⚠ **Scoped to the setup Overview only.** The
operating dashboard's Next-30-days ledger keeps its all-clear line: on a season with money moving,
"nothing falls due in the next 30 days" is a real answer to a real question, where on a team that
has never entered a number it is noise. Extending the gate there was considered and declined, not
overlooked.

⚠ **ONLY THE THING THAT FETCHES THE LANES MAY DECIDE THEY ARE EMPTY** — this rule cost a Critical
finding to learn, and it generalises. The first implementation inferred emptiness at the CALLER,
from three counts already sitting in the money summary: no round trip, no flash, and a
compiler-checked lane map so a fourth lane could not be added without updating it. Every one of
those arguments was true. The bug was upstream of all of them: the payables route's
org-allocation lane is scoped by ORG with no date floor, while the summary's `allocations.count`
is scoped by PROGRAM YEAR — so **a team carrying an unpaid allocation from a previous season had
real money owed, a count of zero, and a panel that never rendered.** A saved fetch is a cosmetic
win; a hidden debt is a money bug. The panel now carries `hideWhenEmpty` and answers the question
itself. **Generalises: when a component's emptiness gates whether it renders at all, that decision
belongs to whatever loads its data — never to a caller reading a proxy for it.**

**Also ruled (same pass):** the anchor card's second paragraph (the dues/reminders/tryouts value
sentence) is **desktop-only** — on a phone it pushed the lime CTA, the one thing that card exists
for, below the fold. Same trim the Overview's One Thing card took the day before.

⚠ **A CHEVRON MADE OF TEXT IS TEXT, and may not wear a hairline token.** The rendered sweep caught
the rail's `›` at `--white-30` measuring **1.44:1** on the white card, at all four widths. It had
been there since the operate dashboard shipped and no gate had caught it — because the journey
cards it now replaces drew their chevron as an **SVG**, which the contrast checker exempts, and the
rail only reached this screen's sweep once it started rendering at the setup stage. Now
`--home-dim` (5.91:1 — the muted ink corrected in 2026-08-02 *precisely so quiet things still
read*), which also closes the latent failure on the operating dashboard. **Generalises:** swapping
an icon for a typographic glyph is a contrast change even when the colour is untouched — the
exemption travelled with the element, not the token. Only a RENDERED sweep finds this; every
file-reading gate passed the whole way.

**Closes** the standing audit candidate named in the 2026-07-09 "grid or tabs — never a stack"
ruling further down this file: *"the Money hub landing (summary grid + stacked groups)"*. The stack
is gone and the landing is a grid-and-index at every stage.

**Enforced by absence, not discipline:** every `.moneyGroup*` / `.moneyCard*` / `.moneyStat*` class
is **deleted** from `coaches.module.css` with zero consumers left, so the stack cannot return one
card at a time — the same move that made the page-header ruling stick.

**A rail row carries the MONEY first; an alert qualifies it, never replaces it.** Review caught
three rows (dues, expenses, allocations) swapping their dollar figure for a bare count the moment
anything was overdue or due soon — so a coach who had collected $400 of $900 saw only "2 overdue".
The drill-in cards these replaced always showed both. Fixed on all three, which also changes two
rows on the already-QA'd operating dashboard; disclosed rather than shipped quietly. Same disclosure
for the Budget vs. Actual row, whose null state reads **"Needs a budget"** instead of an em-dash on
both shapes — a dash reads as missing data, and this row's emptiness has a cause the coach can act
on. **The Overview also re-reads itself when a coach returns to that tab** (quietly — a loud
refresh would evict half-filled forms on the panels the hub keeps mounted): its facts all come from
one payload fetched per SEASON, so generating installments on the Budget tab used to leave the
Overview telling you to generate installments for the rest of the session.

**Applies to:** the coach Money hub. After `/simplify` the two Overview shapes are **symmetric
siblings** — `accounting/SetupOverview.tsx` (new) and `accounting/OverviewDashboard.tsx`, both
ending in `accounting/MoneyRail.tsx` (new), with `page.tsx` reduced to picking one. Their shared
contract moved to `lib/coach-money-summary.ts`, where a **rail row IS a destination key** (derived
from `DashboardHrefs`, so a row can never name an unaddressable tab). The in-app Money help had two
passages describing the deleted sections; corrected in the same unit of work. **Status:** built on
dev 2026-08-12; `/simplify` (4 lenses) and `/review` (high-risk tier, 5 lenses) both run — owner QA
pending, ledger §11. [[design-principles]]

---

### 2026-08-12 — The Overview's icon exception is retired, and the Overview anchor stops paying for its height in stacked rows

**Trigger:** owner, looking at the shipped Pass-2 Overview: *"why doesn't the overview header have an
icon like the rest? also, I don't like how big this 'next event' banner is and it pushes down all of
the more useful dashboard cards."* Mockup:
`claude.ai/code/artifact/a9cd5b53-2303-4961-8523-cb4046161a10` (source
`docs/projects/active/COACH_OVERVIEW_ANCHOR_MOCKUP.html`).

**DECISION 1 — Overview gets a section icon like every other screen.** The 2026-08-11 page-header
mockup deliberately drew Overview title-only, and the shared component recorded the exception. The
reasoning was that an icon marks a SECTION and the hub's front door has no sibling to be
distinguished from. **That reasoning assumes the screens are seen side by side; a coach meets them
one after another**, and in sequence what registers is the title jumping 44px left and back.
Consistency was the entire point of the ruling, so one exception in forty reads as an oversight —
which is exactly how the owner read it, unprompted, within a day. ⚠ The exception is RETIRED, not
merely unimplemented: it was tried, shipped and rejected on sight. Do not restore it.
(The Pass-2 plan had also contradicted itself here — its inventory listed Overview among the seven
iconless pages to fix while §3.3 and the component said title-only. The contradiction survived a
`/simplify` and a `/review`; the owner's eye found it.)

**DECISION 2 — the anchor card ("the One Thing") is arranged in three rows, not five.** The card's
height was never its information: six situations each rendered their own kicker/headline/meta
markup, so the *structure* was repeated six times and nobody could see the structure was the cost.
Measured before: **228px desktop, 267px phone — a third of the viewport — pushing the
Dues/Budget/Record row past the fold on the screen coaches open most.** The primary action now sits
on the headline's row and the answers sit on the meta's row. Measured after (the everyday
next-event case): **144px desktop, 199px phone**, and on a real coach's 390px phone the first tile
row moved from 40px BELOW the fold to 14px above it.

- **The date STAYS on the card**, though the sticky team bar also shows it. The mockup proposed
  dropping it as a duplicate; the bar's right slot is `display:none` once the phone header collapses
  on scroll, so the "duplicate" vanishes exactly when a scrolling coach would need it. **A duplicate
  that disappears is not a duplicate** — the de-duplication argument was checked and withdrawn.
- **Game day keeps whatever height it earns.** The scoreline, the readiness row and the arm-care
  warnings are what a coach opens the portal FOR on a game morning; they still render in full below.
- **The six situations now share ONE arrangement by construction** (named text slots, one renderer),
  the same move that fixed the page headers a day earlier. Copy is byte-for-byte unchanged — every
  one of those sentences was ruled on separately and this was a layout pass.
- **The resolver is untouched.** Which card appears, and when, is tested, ruled logic; only how much
  room its answer takes has changed.

**Status:** built on dev 2026-08-12 (`8247ae03`); ✅ **owner QA PASSED 2026-08-12** — both of these
came OUT of that QA walk and were re-checked in it. Ledger §10 is closed.

---

### 2026-08-11 — NO new muted-grey token: the third text tier is the WHITE ALPHA LADDER, capped at /50 — fading `--data-gray` is banned

**Decision:** The request was for a new mid-tone grey token, to restore the three-tier text hierarchy
that the 2026-08-11 contrast sweep (`b569536a`) flattened when it dropped 22 sub-AA usages onto the
solid `--data-gray`. **Declined — and the flattening should NOT be reversed by adding a palette
value.** Three rulings:

1. **Fading `--data-gray` with an opacity modifier is banned outright for text.** Measured on all
   three dark grounds: `/70` = 4.24:1, `/60` = 3.39:1, `/50` = 2.69:1, `/40` = 2.12:1 — *every* rung
   fails the 4.5:1 AA floor, and `/40` fails even the 3:1 non-text floor. `--data-gray` starts at
   only 7.72:1, so it has no headroom to dim; there is no safe rung on that ladder. This is now
   machine-enforced by `scripts/check-text-contrast.mjs` in `verify:changed`.
2. **When a third, dimmer tier is genuinely wanted, use the WHITE ALPHA LADDER — already in the
   design system (`--white-90` … `--white-05`) — and stop at `/50`.** White composited on a
   near-black ground loses contrast far more slowly than a mid-grey does, so it stays legible much
   further down: `/60` = 7.30:1, **`/50` = 5.33:1 (the floor rung — AA on all three grounds with
   margin)**, `/45` = 4.50:1 (borderline; large text only), `/40` = 3.77:1 (fails). And `white/50`
   reads *visually dimmer* than `--data-gray` while still clearing AA — which is exactly the effect
   the faded grey was reaching for. **`/45` and below are large-text-only; never body copy.**
3. **A new solid mid-grey hex would have been the wrong instrument.** `#7C8BA1` measures 5.72 /
   5.12 / 5.16 and would have worked *in dark mode only* — it is theme-blind, so it would need a
   hand-maintained light-mode twin, which is the precise trap `tailwind.config.ts` already documents
   for `--blueprint-light`. The `--white-*` scale inverts automatically (`--white` remaps to
   `#0F1123` in light mode). Adding a token to duplicate a ladder that exists, minus its
   theme-awareness, is a net loss.

⚠ **One sharp edge, because the two spellings are not the same colour.** The CSS var `--white-50`
IS theme-aware. The Tailwind utility `text-white/50` is **not** — Tailwind's `white` is literal
`#FFFFFF` and never remaps. So: in CSS modules on any theme-aware surface use `var(--white-50)`;
the Tailwind spelling is acceptable **only** on the dark-only marketing pages (which hardcode
`bg-pitch-black`), and is a latent light-mode bug anywhere else.

**Rationale:** the sweep's flattening is acceptable as it stands — size, weight and tracking were
already carrying most of the hierarchy, and the marketing pages read fine without a third ink. So
this is not a gap that needs filling today; it is a rule for the next time someone reaches for one.
The governing heuristic is the design-review standard already on record: *use existing custom
properties before adding new visual primitives*. The palette did not need a new value — it needed
the existing ladder to be the obvious answer, which is what this entry makes it.

**Applies to:** global — every text colour choice on a dark ground; `scripts/check-text-contrast.mjs`
(which permits `text-white/50` and above and refuses the faded-`data-gray` rungs, so the rule is
enforced rather than remembered). [[design-system]] [[design-principles]]

---

### 2026-08-11 — Coach portal page headers: nothing under the title; the masthead owns season AND role; actions right of the title on every screen

**Trigger:** owner asked for a consistent approach to the per-page sub-headers (screenshots: Overview
"2026 Season - Head Coach", Money "2026 Season", Roster "12 active players · 2026 Season season" —
that last one a live bug: the code appends the word "season" to a season already named "2026 Season").
Inventory of all 48 team-hub pages found four subtitle dialects, no shared header component, two
hand-forked copies of the header CSS (one had already drifted and broken layout once), five back-link
styles, two breadcrumb dialects, and a 20px/22px icon split. Owner picked **Option A, amended**
(2026-08-11). Mockup (v2 = decided state, binding visual spec):
`claude.ai/code/artifact/1ae95cd8-8bc2-4500-b024-1f6f0bc78f3a`, source at
`docs/projects/active/COACH_PAGE_HEADER_CONSISTENCY_MOCKUP.html` (Options B/C renders preserved in
the artifact's version history).

**DECISION (four rules):**
1. **Nothing under the title.** No page under `/coaches/teams/{teamId}/` renders a subtitle line —
   no season, team, org, role, or feature-blurb text in any page header. Live facts formerly in
   subtitles move INTO the body they describe (roster count leads the list toolbar); framing lines
   REQUIRED by prior rulings (the coverage board's "Roster order — a coverage view, not a ranking")
   move into the card they frame. **Relocated, never deleted** — the blurbs go to empty states.
2. **The masthead owns the season AND the role.** The viewer's role renders as a **TAG beside the
   team name** ("Head Coach" / "Assistant Coach" — owner: role belongs "in the main header if
   anywhere", refined same day from meta-line text to a name-line chip). Chips are this portal's
   identity/state vocabulary (Premium, Complete), so a role tag fits it; quantities still don't.
   On the phone's collapsed scroll bar the tag folds away with everything else — the "bare team
   name" collapse ruling stands untouched. The masthead also shows an org's NAMED season when
   richer than a bare year ("Fall Ball 2026"); a bare-year name renders "{year} season" as today.
   No guard regexes on pages — the fact lives at the source.
3. **Actions sit RIGHT of the title, one row, every screen — and only ACTIONS.** The Roster pattern
   becomes the rule, with two owner refinements from the phone render (same day): **a view switcher
   is not an action** — it rides the body it switches (Roster's List|Depth-chart already does;
   Schedule's List|Week|Month joins it at ALL widths), so Schedule's header carries Import / Export /
   Add Event / help only. **At phone width, secondary buttons go icon-only** — the standing
   mobile-admin pattern (hidden label + aria-label) extends to the coach portal — while the ONE lime
   primary keeps its label and help stays an icon; every header row then fits a 390px phone on one
   line. Narrow-screen wrap stays right-pinned as the fallback, never a designed second row.
   **The help "?" is chrome, not an action** (owner, same day): it anchors the top-right corner
   beside the title on EVERY page at EVERY width — on phones the actions row drops below while the
   "?" stays on the title line — one findable home for help portal-wide.
4. **One shared page-header component** (icon 22px · title · archive chip | actions · help) replaces
   40 hand-rolled copies; retires the budget/bva CSS forks. Archive "{year} · Complete" chip stays
   inside the `<h1>` (screen-reader page name), unchanged in meaning.

**Also ruled (same pass):** division chip ("12U") renders only when the team name does NOT already
contain it; hub breadcrumbs retire (masthead + title state every crumb); "Team Calendar" retitles to
"Schedule" — the nav LABEL does not change (it keys the access gate); the Insights coverage report
retitles to question voice ("Is everyone getting attention?") and Tryouts history to "Tryout history"
to break the duplicate-title pairs; help "?" fills its sibling gaps; one back-link treatment for
drill-ins.

**Supersedes:** the subtitle half of the same-day Overview-header entry directly below — BOTH its
named-season print AND its kept role line (role moves to the masthead; the season name moves there
too). That entry's masthead-nudge rulings (#2, #3) stand untouched.

**Status:** design ruling + binding mockup, 2026-08-11. **BUILT IN FULL on dev the same day** —
Pass 1 `ad43cae1`, Pass 2 alongside it; owner QA rides `OWNER_QA_LEDGER.md` §10. All ~40 team-hub
screens now render `components/coaches/CoachPageHeader.tsx`, which has **no subtitle slot by
construction**; `.pageSub` and `.breadcrumb` are deleted from `coaches.module.css` with zero
consumers left, so rule 1 is now enforced by the absence of a mechanism rather than by discipline.
`components/coaches/CoachBackLink.tsx` does the same job for rule "one back-link treatment" —
collapsing the five styles to one class proved insufficient because the markup was still hand-copied
into 27 files. **Two rendered defects surfaced only once a browser laid the pages out** (a
slide-over spacing rule baked into a bar three pages also used → 24px of desktop sideways scroll;
a 21px tap target) — both fixed, and both are the argument for keeping the rendered sweep in the
gate rather than trusting screenshots.

---

### 2026-08-11 — Coach Overview's header stops repeating the sticky masthead, and the scouting nudge stops floating between the two

**Trigger:** owner screenshot of the mobile Coach Overview — disliked the scouting-book notification
sitting above the header, and asked whether the page's own team-name header is needed at all given
the top nav already carries it. Mockup (approved): `claude.ai/code/artifact/2f4f2d3d-4a14-473e-8864-660a10efc127`,
source at `docs/projects/active/COACH_OVERVIEW_HEADER_MOCKUP.html`.

**DECISION:**
1. **The Overview page titles itself "Overview," not the team name.** The sticky masthead
   (`CoachTeamHeader`) already carries the team name and season; the Overview's own `<h1>` was the
   only page under `/teams/{teamId}/` that repeated the team name instead of naming itself — every
   sibling (Roster, Money, Team Calendar, Tryouts, Documents…) already used a page-specific title.
   This was the standing "chrome rule" (2026-08-02, reaffirmed 2026-08-07: chrome may only carry
   data the page doesn't already show) unapplied to this one page. Premium/tier badges and the
   Season-setup chip stay — they're the genuinely new information on that line. The subtitle drops
   the season UNLESS an org has actually named it something more specific than a bare year (a plain
   `/^\d{4}$/` season label is exactly what the masthead already says; a real season name like
   "Fall 2026" is new information and stays).
2. **The scouting-book nudge is now a row of the sticky masthead, not a floating card beneath it.**
   It used to render as a separate, non-sticky, bordered card directly under a `position: sticky`
   bar — which read as a stray notification wedged between two headers, especially once #1 made the
   page header thinner. It's now an attached second row inside `<header>` (hairline divider, no
   card chrome), so it scrolls and pins as one unit with the bar it's about, and folds away with the
   rest of the detail on the phone-collapsed state.
3. **The nudge's copy leads with the new fact only.** When the masthead's own status is already the
   Game-day line (opponent + "today" both stated one row up), the nudge trims to "N observations in
   the book ›" instead of re-stating the opponent and day. When the status is the further-out "Next"
   line (which does NOT name an opponent), the nudge keeps its fuller "You play {opponent} {day} —
   N observations ›" phrasing, because that IS new information there.

**Applies to:** `CoachTeamHeader` (+ `coaches.module.css` masthead/nudge rules), the Overview page
header (`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`). Built on dev 2026-08-11, uncommitted,
owner QA pending. [[design-system]] [[design-principles]]

---

### 2026-08-10 — Demo doors on the marketing pages: proof one step after every claim, never competing with the ask

**Trigger:** the production doors flipped on 2026-08-10 with only the tournament demo advertised (two spots) and the coach demo reachable by URL alone. Owner approved the placement set and, in the follow-up on "browsing both," the Club-page block + reroutes. Mockups (approved, all sections incl. §5): `claude.ai/code/artifact/2d646e07-1bef-48ef-8fd9-1a883bd56eea`.

**BINDING RULES:**
1. **The door is always SECOND.** "Start free" stays the primary action on every surface; the demo door is the quieter sibling beside it — hero persona cards use the twin-door stack (shared label "See it live — no sign-up", the card title names the world), persona pages use the lime-OUTLINE + live-dot button in second position (hero AND bottom CTA), and the pricing grid uses a text-weight "Not ready? See … first" line UNDER the two paid live cards' CTAs (product-specific wording there only, because both doors share one screen). Marketing layout only; never in the in-app plan wizard.
2. **NO standalone chooser page and NO nav item.** The hero's side-by-side doored cards ARE the browse experience. The one future exception: a campaign needing a single URL may get a tiny unlisted chooser — deferred until a campaign asks. **⟶ AMENDED 2026-08-11: the exception FIRED and the chooser is built. "No nav item" stands. See the amendment note below rule 5.**
3. **A door renders only where its demo exists.** League Plus and Club surfaces get no door pattern (it would promise a demo that doesn't exist) — with ONE deliberate exception: `/for-clubs` carries the **"Both halves are live today"** block (two doors), because the club executive is the one persona genuinely interested in both, and their coming-soon page becomes proof-by-parts.
4. **Route to a page when the page has proof; route to a form only when it doesn't.** All Club touchpoints (pricing segment card, both persona-page cross-sells, the coaches org-bridge link) now NAVIGATE to `/for-clubs` — the interest form waits there. League Plus touchpoints stay form-first on purpose; the asymmetry is the principle working, not an inconsistency.
5. **Every door is gated on the doors flag** (`sandboxDoorsVisible()`) — nothing hand-writes door visibility, matching the availability contract. **⟶ ONE CARVE-OUT 2026-08-11 for the two doors ON `/demos`; see the amendment note below.**

---

#### ⟶ AMENDMENT, 2026-08-11 — the chooser exists: `/demos`

Rule 2's own exception fired. The owner asked for one address to send to industry contacts who
should walk BOTH worlds — *"I want a page that has that so I can send to people in the industry for
them to try all demos… we can put a simple link in the marketing pages footer for now."* Shipped as
**`/demos`** (commit `f66c473b`, on dev). The business ruling is logged in `BUSINESS_DECISIONS.md`
("2026-08-11 — The chooser's revisit trigger FIRED"); this note records only what changes VISUALLY.

**What still holds, unchanged:** the hero's twin-doored persona cards remain THE browse experience
for a cold prospect — `/demos` is the landing pad for an OUTBOUND link, not a funnel surface, and
nothing on-site routes a prospect to it in preference to a persona door. **"No nav item" stands**:
one footer link ("Live Demos", Product column), never the top nav, never the mobile bottom nav.

**Three departures, each deliberate:**

1. **"Unlisted" is now split in two, and only half of it survives.** The chooser is *listed* to
   people (a footer link) but remains *unlisted to search* — `/demos` is deliberately absent from
   `app/sitemap.ts`, which is an explicit allow-list. That is the distinction to carry forward: the
   original "unlisted" instinct was protecting against the demo competing with the funnel in
   ORGANIC discovery, and that protection is intact. Being reachable from the footer of a page
   someone is already reading costs the funnel nothing.
2. **Rule 5 carve-out: the two doors ON `/demos` are not flag-gated, and must not be.** The page
   follows the same contract as the doors themselves — *the door is always live wherever the sandbox
   is seeded; the flag governs whether the marketing site ADVERTISES it.* Gating the page would kill
   a link already emailed to a named person, which is the single failure this page exists to
   prevent. **The footer link is what the flag governs** (`surface === 'marketing' &&
   sandboxDoorsVisible()`), so with the doors off the whole thing collapses back to precisely rule
   2's original "tiny unlisted chooser". The rule's intent is honoured; only its literal reading
   bends. The footer link is additionally scoped to the marketing surface so it never renders in the
   signed-in consumer app — rule 1's "marketing layout only" clause reaching a shared component.
3. **Rule 1 is scoped, not broken: on `/demos` the door IS the primary action.** Every other surface
   puts "Start free" first and the door second, because the demo must not compete with the ask.
   `/demos` carries no ask at all, and its two doors are solid-lime primaries of equal weight. That
   is correct *because there is no ask on this surface to compete with* — the visitor arrived having
   been sent the demo link, and answering a question they did not ask would be the actual error. Two
   equal primaries are right here for the same reason: they are genuinely parallel choices, which is
   the page's whole purpose. **The ask lives one step later, inside the sandbox chrome's own
   "Start free →" CTA** — so "proof, then ask" still holds across the journey, just not within this
   one screen. Read rule 1 as governing surfaces that CARRY an ask.

**The page belongs in the system as built.** Bordered cards with no fill, `--blueprint-blue` at low
alpha for the border and a `--logic-lime` border on hover — the homepage persona-card pattern
exactly; mono type throughout, `--logic-lime` eyebrows, `--fl-text` headings, `--data-gray` body.
One trap avoided and worth repeating: the eyebrows deliberately **do not** use the global
`.hud-label` class with a colour utility, because `.hud-label` sets its own ink and is declared
after `@tailwind utilities`, so it silently wins and the label renders blue (the same cascade bug
`app/error.tsx` documents). Spell the eyebrow's type out, or use `.hud-label` bare.

**Also fixed in the build:** the `/for-clubs` coaches cross-sell was still an express-interest trigger for the live Coaches Portal (the same stale trap as the tournament page's, cured 2026-08-08) — flips with the coach checkout gate now; and the Club hero note names all three live products, gate-aware.

**Follow-up owed (its own build):** the in-demo cross-door — "that's the tournament half, walk a coach's season →" at each tour's end — catches the proven browser at peak interest. **Copy pass owed to /marketing** on all door labels.

**Applies to:** `app/page.tsx`, `app/for-coaches/*`, `app/for-tournament-organizers/page.tsx`, `app/for-clubs/*`, `app/pricing/page.tsx`, `components/PricingSection.*`.

---

### 2026-08-08 — Marketing surfaces: LIVE PRODUCTS LEAD; coming-soon compresses to strips — and no surface hand-writes availability

**Trigger:** owner screenshot of the homepage modules section still badging the Coaches Portal "Coming soon" two weeks after launch — found in the SAME session that had just documented this exact trap on the persona cards one section up. The owner then asked for a full marketing sweep against the actual business state (Tournament Plus + Premium Coaches Portal live and promoted, both free until Jan 1 2027; League Plus + Club genuinely coming soon). Mockups (approved, all sections): `claude.ai/code/artifact/b4a4c981-d77d-4e49-95cd-9aaf9597872b`.

**BINDING RULES:**
1. **LIVE PRODUCTS LEAD, EVERYWHERE ON MARKETING SURFACES.** A product someone can buy today gets a full card/deep-dive at full weight; a not-yet-purchasable product compresses into a quiet strip — named, priced, linked, capturing express interest, but never a peer of what's on sale. Applied in one unit of work to: the homepage hero (2 live cards + "On the roadmap" strip), the homepage modules section (2 deep-dives + 2 one-line strips), the pricing grid on BOTH the homepage and /pricing (3 live cards incl. a real Premium Coaches Portal card + one coming-soon strip; the old below-grid coaches callout is retired), the /pricing segment picker order, and the marketing nav (Tournaments · Coaches · Leagues · Clubs · Pricing). This closes the "should the buyable products lead the grid?" question left open on 2026-08-07.
2. **⚠ NO MARKETING SURFACE MAY HAND-WRITE WHETHER A PRODUCT IS AVAILABLE.** Every availability statement (badge, section intro, FAQ, footer CTA, cross-sell card) must read the plan-gating map or be structurally unable to go stale. The 2026-08-07 persona-card fix cured ONE surface; this sweep found FIVE more hardcoded "coming soon"s for the live coach product (modules badge, modules intro, homepage coaches callout — which quoted $29 and diverted a free-signup coach into an interest form — /pricing "Coming next" panel, /pricing bottom CTA) plus a sixth on /for-tournament-organizers' cross-sell. The strip/card split itself is gate-driven, so launch promotion is automatic — but a card only presents as live once someone has WRITTEN its live copy (`liveBadge` non-null), and whoever does that owns making the destination page gate-aware in the same unit of work (unchanged from the persona-card contract).
3. **THE FOUNDING SEASON SPEAKS FOR BOTH PROMOS OR FALLS BACK — AND ITS SURFACES ARE PROMO ARTIFACTS, NOT PERMANENT CHROME.** Hero badge, Founding Season callout, /pricing notes and FAQs name Tournament Plus AND the Premium Coaches Portal together only while both promos are active and the coach checkout is open; otherwise they fall back to the Tournament Plus-only line. Half-telling the promo was ruled a Medium defect, not a nicety. **/review rider (same day, fixes applied):** the first build's fallback branches were themselves hand-written date claims that would have read "free through Dec 31, 2026" AFTER Jan 1, 2027 — so the hero badge row, the Founding Season callouts/notes now render ONLY while the promo is active (they disappear on their own), the plan cards' promo wording moved into a `promoNote` that expires with the promo (CTA falls back to "Start now"), and the /pricing "Coming next" list regains the Coaches Portal if its gate ever re-closes. The pre-promo January runbook item for these surfaces is thereby retired; only genuinely editorial copy remains for January.
4. **Structural riders:** the Premium Coaches Portal card in the shared pricing grid NEVER takes the org-operator CTA overrides (its purchase lives in the coach start flow, not an org's billing screen) and is NOT in `RENDERED_PLAN_KEYS` (it can never be an org's "current plan"). The in-app callers of the pricing grid (onboarding wizard, billing) are untouched — `marketingLayout` is opt-in.

**Tradeoffs accepted by the owner:** the "first tournament → full club" ladder gets quieter in the hero (survives in the comparison table + coming-soon deep-dive); express-interest touchpoints consolidate (volume may dip, intent quality should rise); League Plus's launch will require deliberately re-promoting it (writing its live copy), which is the intended decision point.

**Applies to:** `app/page.tsx` + `page.module.css`, `components/PricingSection.tsx` + module CSS (`marketingLayout`), `app/pricing/page.tsx` + `ViewerAwarePlans.tsx`, `app/for-tournament-organizers/page.tsx`, `components/Navbar.tsx`. Plan: `docs/projects/active/HOMEPAGE_TRUTH_AND_ENTRY_POINTS_PLAN.md`.

---

### 2026-08-08 — The scorekeeper's score field was 29px wide on every phone: an affordance that crushed the field it served

**Trigger:** owner screenshot of the score-entry sheet on a phone, with two questions — do we still need the −/+ steppers if the score is entered *after* a game, and how do we force the numeric keypad. Both instincts were right, and the screenshot understated the defect. Mockups (approved, Option A): `claude.ai/code/artifact/f4bedded-de30-421f-b46c-89f35a674bed`.

**BINDING RULES:**
1. **⚠ MEASURE THE FIELD, NOT THE CONTROL AROUND IT.** The J8-007 steppers laid `48px | 1fr | 48px` around the score input. Each team's column is **~138px** at 390px, so the steppers and their gaps took **108.8** and left the input **~29px** — for a numeral drawn at 38px. It only stops being crushed above a **~470px viewport**: no phone in circulation. It shipped broken for every user of the surface because nobody subtracted the chrome from the column. **Standing test for any control placed beside an input: state the input's remaining width in pixels at 390.**
2. **⚠ AN AFFORDANCE'S PREMISE EXPIRES AND THE AFFORDANCE DOESN'T ANNOUNCE IT.** The steppers' stated reason — *"a volunteer can tap −/+ without a keyboard"* — was written in the code, so it read as settled. Every device here has a keypad, and the sheet **saves once** (its own copy says the score is final immediately), so there was never a running tally to step. **A stepper is an instrument for a live tally; a post-game result is a record written after the fact.** Removed.
3. **⚠ `type="number"` IS THE WRONG INPUT FOR A NUMBER YOU CARE ABOUT.** It does not reliably raise the 0-9 keypad (iOS renders numbers-and-punctuation; Android keyboards inside an installed PWA fall back to the full layout), and it carries three hazards on a screen whose next button is *Finalize*: a **laptop scroll wheel changes the score** under the cursor; **spinner arrows** render inside the field; and a stray character makes the browser report the value as **empty string**, so a `replace(/\D/g,'')` sanitiser never sees it and the score **silently blanks**. Canonical markup platform-wide: `type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"`.
4. **⚠ SANITISE FIRST, CAP SECOND.** `maxLength` is enforced by the browser on the **raw edit, before React sees it** — pasting `ab27` was truncated to `ab2`, stripped to **2**, and would have finalized a 2 for a 27 with no error. The cap belongs in the same function as the strip, after it. **An attribute-level and a handler-level constraint on the same field are not additive: the attribute runs first, on input the handler was written to clean.**
5. **THE KEYBOARD IS PART OF THE LAYOUT.** On a 375×667 phone with a ~260px pad there is ~375px usable; the old sheet was **370** — it cleared the keypad **by five pixels**. `position: fixed; inset: 0` measures the LAYOUT viewport, which iOS never shrinks: pin to the globally published `--vvh` / `--vv-offset-top` (the tournament chat composer's idiom), scroll the middle, and make **both** the header and the action row `flex: none` — a dismiss control that scrolls off the top is one the volunteer must already know is elsewhere.
6. **⚠ COUNT THE EXITS BEFORE DEFENDING ANY ONE OF THEM — THE FIRST TO GO IS THE INVISIBLE ONE.** Owner, on the ✕: *"do we need the X if clicking off removes the modal?"* There were **three** (✕, Cancel, backdrop-click), and the one to cut was neither of the two being compared. **Backdrop-dismiss on a form holding unsaved input is all cost:** it is the only exit that destroys work by accident, it is a *convention rather than an affordance* so it never carried the "how do I get out" job, and on an autofocusing sheet the keypad reduces it to a **~30px sliver** where a one-handed thumb rests. Ruled: backdrop inert, ✕ retired, **Cancel is the only way out**, Escape added as its keyboard twin. `role="dialog"` added but **`aria-modal` deliberately NOT** — there is no focus trap, and announcing modality to a screen reader that focus can still leave is a promise the component does not keep.
7. **⚠ A MOCKUP THAT RE-DECLARES A PROPERTY THE PRODUCT INHERITS IS NOT A RENDER OF THE PRODUCT.** The approved mockup set `font-size: 0.78rem` on the sheet's action buttons; the product declares **none**, so they inherit **16px**. The mockup showed a comfortable row over a product row that overflowed at 320px and cleared every other width by **~4px**. Same family as the warm-vs-dark masthead lesson, but subtler: a *colour* mismatch is visible, an *inherited* one is not. **Before mocking up an existing surface, list what the real element inherits and inherit it too.** Settled by measuring the real font on a **served** page (`--font-data` only resolves where next/font has run), not by arithmetic.
8. **⚠ THE RENDERED GATE CANNOT SEE THIS SCREEN.** `check:layout` visits **no scorekeeper route** (volunteer login), and `--changed` reports *"no listed screen is affected by this diff."* The one tool built to find exactly this class of defect was blind to it, and reporting it green would be false comfort. A game-day operating surface with zero rendered coverage is a gap, not an oversight.

**Consistency sibling:** the same-day day-of toolbar entry below governs the other half of these two shells — the scorekeeper and gate check-in remain geometry siblings.

**Applies to:** `app/[orgSlug]/scorekeeper/page.tsx` + `scorekeeper.module.css`, and the two UAT specs that selected the fields by the `spinbutton` role. Owner QA passed twice (before and after the `/review` fixes and the dismissal ruling); on dev, **not on production**. ⚠ Committed inside `3aeda5fd`, a concurrent agent's docs commit — `git log` will not lead anyone to this change. Plan: `docs/projects/active/SCOREKEEPER_SCORE_ENTRY_MOBILE_PLAN.md`.

---

### 2026-08-08 — Day-of toolbar controls at phone width: full-row, 44px — a wrapped control never keeps its desktop intrinsic width

**Trigger:** owner, reading the gate check-in board at 361px — "why do we make the division dropdown so narrow if nothing is next to it?" The division select was sized for its desktop seat beside the search box; when the wrapping toolbar stacked at phone width, it landed alone on its row still at content width. Nobody chose that — it was a wrap artifact, and it sat one shell away from the scorekeeper rendering the identical "All divisions" filter at `width: 100%`.

**BINDING RULES:**
1. **When a day-of toolbar wraps into a stacked column, every control takes the full row.** A lone narrow control in a column of full-bleed siblings (event picker, search) reads as broken and wastes tap area. Desktop keeps intrinsic/shared-row sizing — the rule binds the wrapped state, not the wide one.
2. **44px is the day-of touch height at phone width.** The gate and scorekeeper serve gloved volunteers; the check-in search + select now match the scorekeeper's 44px minimum at ≤640px. The admin shell's 38px `--admin-control-h` stands on desktop — this is a phone-breakpoint override, not a token change.
3. **The two day-of shells (scorekeeper, gate check-in) are consistency siblings.** One filter appearing on both must share geometry; divergence between them is drift, not variety.

**Applies to:** `components/admin/CheckInBoard.module.css` (≤640px block); pattern applies to any future day-of volunteer surface with a wrapping filter toolbar.

---

### 2026-08-02 — The warm palette's muted ink and live red are AA-corrected; R1-4's original values are superseded

**Trigger:** the layout-invariant sweep (`npm run check:layout`, 28 coach-portal screens × 4 widths)
measured text contrast against the **composited** background actually painted behind each string —
something the source-scanning colour guardrail structurally cannot do, because the tokens were being
used *correctly* everywhere. Owner approved the fix 2026-08-02 against mockup artifact `aa2e9415`
(= binding visual spec). Full reasoning: `docs/projects/active/LAYOUT_INVARIANT_SWEEP_PLAN.md` §7.1.

**BINDING RULES (R1–R4):**

1. **R1 — `--home-dim` is `#6A635C`, not `#8A8177`.** The old value measured 3.83:1 on a white card,
   3.49:1 on paper, 3.31:1 on a tinted panel and **2.93:1 on the bottom nav** — under the 4.5:1 AA
   floor on every ground it lands on, across 1,835 places. It failed even the 3:1 large-text floor
   on the nav, so no size exception or per-surface carve-out could rescue it. The new value is the
   same hue taken down until the darkest ground clears: 5.91:1 / 5.39:1 / 5.11:1 / **4.53:1**.
2. **R2 — `--home-live` is `#B03A22`, not `#D9482B`** (4.28:1 on white → 6.04:1; 3.27:1 on the nav →
   4.63:1). Deliberately **not** the lightest passing value `#B33B23`, which clears the nav by 0.01
   — that ground is a composite, so any change behind it would drop it back under. As a *fill* the
   darker red only improves, because the badges pair it with a light glyph (`--home-on-live`).
3. **R3 — The two palette copies move together.** `app/globals.css` (coaches) and
   `components/consumer/warmTheme.module.css` (consumer shell) are declared mirrors; changing one
   alone is drift. ⚠ The consumer surfaces were **not** covered by the sweep — they were corrected
   for parity and still want their own measured pass.
4. **R4 — The three-step ink hierarchy is the constraint, not just the ratio.** `--home-ink`
   (16.52:1) → `--home-ink-soft` (9.90:1) → `--home-dim` (5.91:1) must stay visibly distinct. Any
   future proposal to lighten the muted ink back toward "quieter" must clear 4.5:1 **on the nav
   ground**, which is the binding surface — not on white, which is the easy one.

**Supersedes:** the `dim #8A8177` and `Live = warm red #D9482B` values in the 2026-05 **R1-4 warm
consumer shell** entry below. Everything else in that ruling stands.

**What this cost:** every muted label in both shells is one step darker. That is the visible price
of the fix and it was accepted knowingly.

**Prior art worth noting:** three separate sessions had already hit this wall and patched *locally*
— forcing `--home-ink-soft` in place of the muted token on the system screens and the Team HQ "not
switched on" line, and hand-darkening the red with a `color-mix` on the crash-screen eyebrow. Each
comment recorded the failing ratio and moved on. **A token that three surfaces privately route
around is a broken token, not three unlucky surfaces** — the local fix is the smell.

---

### 2026-08-02 — Tryout Insights (Report · Baseline · Memory): evaluation data may travel, but only coach-eyes-only, only confirmed, and never through the blindfold

**Trigger:** Tryout Insights plan + mockups v1, both owner-approved 2026-08-02
(`docs/projects/archive/COACH_TRYOUT_INSIGHTS_PLAN.md`; mockup artifact `3b8bf1f9` = binding visual
spec). These rulings govern all three phases; full text with rationale = plan §2.

**BINDING RULES (R1–R8):**

1. **R1 — Two audiences, two documents.** The printable Tryout Report defaults to the board-safe
   summary (aggregates + roster names only). The full candidate table (names × scores × decisions)
   exists only behind an explicit per-export confirm naming the consequence.
2. **R2 — Evaluator bias flags ("runs hot/cold") are screen-only.** Never in any export or print.
3. **R3 — Tryout evaluation content is coach-eyes-only, PERMANENTLY.** No score/composite/note on
   any family-facing surface, ever. The recap may state the fact ("earned a roster spot at tryouts
   {date}") — never a number. Guarded by tests, not convention.
4. **R4 — The baseline snapshot is CONTEXT, not a measurable.** It renders as a clearly labeled
   artifact on the development page (dashed-border treatment, frame 05) and never enters the
   measurables timeline or any trend computation. No surface may treat tryout-composite →
   in-season-measurable as a trend.
5. **R5 — Focus suggestions are coach-confirmed, never auto-written.** No focus tag/goal/vocabulary
   entry is minted without explicit confirmation; "Don't add" is a first-class answer. Protects the
   one-word-for-one-thing vocabulary discipline (18f05650).
6. **R6 — Memory never breaks the blindfold.** Prior-year evaluation data appears ONLY at Decide
   post-reveal (and on the report). Never on the scorer, live scoreboard, or check-in while blind.
   Probes assert the ABSENCE at the DOM. (Check-in's identity-only returning marker is unchanged —
   identity ≠ scores.)
7. **R7 — Present, don't judge.** Prior/current snapshots side-by-side always; a delta only when
   scales match (5↔5, 10↔10); category deltas only on matched keys; incomparable pairs show both
   cards + "different scorecards" note, no arithmetic. Report aggregate ("returning candidates
   improved +X") only at ≥3 comparable pairs — otherwise ABSENT (silence beats a confident lie).
8. **R8 — The archive read is a made decision, not a side effect.** Phase 3's prior-season score
   read into the live decision board is authorized: a new season-aware read route joins
   `APPROVED_SEASON_AWARE_ROUTES` citing R8. NO new archive door; nav untouched.

**Applies to:** the tryout hub Build stage, `tryout-overview`/new report route, `lib/export/*`,
the player development page (Phase 2), the decision board (Phase 3),
`tests/unit/coach-season-write-guard.test.ts` (Phase 3 only).

---

### 2026-08-02 — A TEMPLATE is scaffolding; a DRILL is an identity. Both rules are right, they sit one screen apart, and unifying them breaks one

**Trigger:** Practice Plans Phase 3, frame 06 of the signed-off mockups — a fully editable practice plan with one read-only station inside it. The owner was asked to judge whether that divide reads as coherent or as a bug, and approved it.

**BINDING RULES:**

1. **A loaded TEMPLATE is fully editable from the first keystroke, and its provenance SURVIVES every edit.** Of course a coach adapts a practice — adapting it is the point. *"This plan started from Standard Tuesday"* stays true however much they change, so `PracticePlan.templateId` is never cleared.
2. **A loaded DRILL stays read-only, and its provenance is CLEARED the moment a word changes.** A drill is a claim that you ran *that* drill, so "in 8 plans" has to mean eight of the same thing. "Edit just for this practice" keeps every word and detaches.
3. **⚠ Loading a template MUST preserve each station's `drillId` and `drillTags`.** Stripping them would make every drill-backed station in a loaded template arrive editable and would silently break every drill's count — **and nothing would fail loudly.** This is the highest-value invariant in the feature and it has a unit test named after it.
4. **A template carries NO PEOPLE** — no players, no staff, no rotation groups, no "just for tonight". It keeps the rotation's SHAPE (how often groups move) but never its groups. Same D20 divide a drill draws, one level up: the template supplies the shape and the teaching, the practice supplies the people and the moment. It is what lets one template work in April with twelve and July with nine.
5. **ONE editor serves both.** `PracticePlanEditor` takes a `withoutPeople` flag; there is no second template editor. Building one would have split the behaviour of every block, station, rotation and drill-picker control in two, and the copies would have drifted within a season. ⚠ `withoutPeople` REMOVES controls; it never disables them — a control that exists only to refuse should not exist.

**Do not "make these consistent."** A future session reading the two rules side by side will be tempted to unify them; unifying them destroys either the coach's ability to adapt a practice or the meaning of a drill's count.

**Applies to:** `lib/rep-plan-templates.ts`, `lib/rep-drills.ts`, `app/[orgSlug]/coaches/teams/[teamId]/practice/_PracticePlanEditor.tsx`, `tests/unit/rep-plan-templates.test.ts`.

---

### 2026-08-02 — The coverage answer names children, so it shows a FLAG or a BLANK — never a comparable number, and never at all when it cannot answer honestly

**Trigger:** Practice Plans Phase 3, frames 08–09 — the first surface in the product that names a child who has been missed.

**BINDING RULES:**

1. **Roster order only. No sort affordance on any column, ever** — and emphatically not "least covered first". A probe asserts this at the DOM, not in a comment.
2. **A flag or a quiet ✓, never a comparable number.** No count, percentage, streak or average beside a child's name; no team average and no percentile on the row. The wire format carries **one boolean** for exactly this reason — a number cannot leak through a field that does not exist.
3. **The vocabulary is coverage of the COACH'S ATTENTION, not assessment of a player.** The column reads **"In a plan"** — never "worked on", "covered" or "did". The flag reads **"— not in a plan yet"**.
4. **⚠ SILENCE BEATS A CONFIDENT LIE.** Assigning players to blocks is OPTIONAL — a coach whose practice is "everyone rotates through four stations" names nobody. So the question is only *answerable* once the season holds at least three plans **and** at least one names someone; otherwise the column, the flag and the finding are all **ABSENT**. Flagging a whole roster would be the product misreading its own data as a coaching failure.
5. **The finding is COUNT-ONLY AND NAMELESS**, in place rather than as a seventh Insights tile (explicitly cut). It counts by INTERSECTING with the current roster — never `rosterCount − namedCount`, which under-counts when a plan names a departed player and goes negative on a team with enough departures, silently deleting the very warning it exists to give.
6. **An UNTAGGED focus area is never reported as uncovered.** Absence of data must not read as absence of need — the same rule that keeps an untagged area at full strength in the focus rail.
7. **TWO TRUTH STATUSES ON ONE SCREEN, DELIBERATELY KEPT APART** (the §10.2 "Recorded here" precedent). Coverage says *planned*. "Practices you've run" is the one section allowed to describe reality, and it earns that because a coach sat down afterwards and wrote it. **A recap existing does NOT license coverage to claim the plan happened.**

**Applies to:** `lib/rep-practice-coverage.ts`, `app/[orgSlug]/coaches/teams/[teamId]/history/development/page.tsx`, `app/api/coaches/[orgSlug]/teams/[teamId]/development/board/route.ts`, `tests/unit/rep-practice-coverage.test.ts`.

---

### 2026-08-02 — "How it went" is about the PRACTICE, never about a child — and there is deliberately no per-player equivalent

**Trigger:** Practice Plans Phase 3, D17, frame 07.

**BINDING RULES:**

1. **One free-text note per practice**, written at home afterwards. *"Tees were too crowded, run four next time"* is the whole value.
2. **⚠ NO PER-PLAYER VERSION MAY EVER BE ADDED.** Per-child commentary would drift into behavioural profiling on minors. There is no column for it, and the absence is the design. The placeholder and the helper line both steer away from names.
3. **This does NOT reopen D4.** An unhurried note written at home is a different act from an abandoned tick-box mid-drill. Nothing at the field records anything, and there are still no per-block "we ran it" ticks.
4. **Silence is STATED, never rendered blank** — *"Nothing written down for this one."* A practice with no note must not read as a practice where nothing happened.
5. **Coach-facing only.** Families never see it, and the UI says so on screen.

**Why it gets written at all:** because plans carry tags, a coach filters past practices to "Hitting" and gets every one they have run, what was in it, and what they said afterwards. That reframes the recap from a diary (which a coach stops writing by June) into a body of experience they mine before planning — the first surface in this project that gets *better* the longer the product is used.

**Applies to:** `rep_team_events.practice_recap` (mig 221), the practice plan page, the Development report's "Practices you've run".

---

### 2026-08-02 — The admin rail carries NO identity and NO status: both were second copies of what the page header already says

**Trigger:** owner, reading the tournament admin rail at 1440px — "the org name in the nav bar, do we need that? it is also in the headers"; then, one screenshot later, "do we need both of these LIVE pills?" Two separate looks at the same rail, landing on the same defect.

**The defect (one shape, twice):** `AdminEventHeader` already renders, on **every** admin screen, the org name (as the eyebrow above a tournament name; as the title itself on org-level screens) and the phase chip (Draft / Open / Live / Completed / Archived, off `resolvePhase()`). `AdminSidebar` rendered its own copy of **both**, a few hundred pixels away in the same upper-left quadrant. The status copy was the worse of the two: it re-derived `status === 'active'` + `isWithinEventDates()` **by hand** rather than calling the shared resolver, so the day the phase rules change the rail and the header would disagree and neither would look wrong.

**BINDING RULES:**
1. **The admin rail is NAV. It is not a nameplate and it is not a status board.** Its job is where-can-I-go. Whose place this is and what phase the event is in are the **page header's** job — one surface, so they cannot drift and cannot contradict.
2. **Status renders once per screen, from `resolvePhase()` + `PHASE_LABEL`.** No surface re-derives phase from `status` + dates locally. The header's chip earns the spot: it sits beside the date range that *explains* the phase, carries the pulsing game-day dot, and is sticky and never collapses on desktop — so it survives scroll.
3. **Multi-org orientation belongs to the `WorkspacesPill`, not to rail copy.** For a Tournament/Tournament-Plus customer (one org, often one event) a rail org label is zero information every time they look at it.
4. **This narrows Stage C of Nav Unification, which is otherwise intact.** Stage C moved the FieldLogicHQ wordmark up into `AdminTopStrip` and had the rail open with "whose place this is" — the right instinct on the wrong surface. Zone-2 identity is still expressed exactly once; it is just expressed in the header. **Do not restore either block as a "consistency" fix.**

**Cost/benefit:** ~62px of rail head returned to the nav list (about one and a half nav rows — on a laptop, one or two more destinations above the fold). The rail now opens on its first real block — the tournament switcher, a section header, or the back link — with a small scroll-container pad standing in for the retired border, so all three variants share one top edge.

**Mobile is untouched by construction:** the rail is `display: none` ≤900px, so it never showed either block on a phone. Mobile already had exactly one org name and one status chip; **desktop now matches mobile**, which is the direction of travel, not a regression.

**Supersedes:** the sidebar half of *2026-06-05 — density toggle removed; sidebar LIVE indicator uses `isWithinEventDates`*. That entry's **reasoning still stands and is now served better** — it fixed a rail that mislabelled a 40-days-out event as LIVE, by teaching the rail the game-day rule. Deleting the rail's chip retires the second implementation that had to be taught at all. Note that *2026-06-15 — Schedule publish: dual-state header control* cites "mirrors the sidebar's ● Live / ● Open indicators" as rationale; the **dot-not-pill treatment it chose is unaffected**, only that cross-reference is now historical.

**Applies to:** `components/admin/AdminSidebar.tsx` + `.module.css` (head block, status chip, and the now-unused `isWithinEventDates` import all removed), `docs/projects/active/NAV_UNIFICATION_PLAN.md` (Stage C amended).

---

### 2026-08-01 — T1: ONE nav-label spec and ONE pill silhouette across all five top bars; plus the four top-nav micro-rulings

**Trigger:** the top-nav consistency audit (`TOP_NAV_CONSISTENCY_FINDINGS.md` §6b) measured the five bars at 1440px and found the MATERIALS already consistent — IBM Plex Mono labels over an Inter base everywhere including marketing, fully-round pill radius everywhere, one icon-door size — but the FINE METRICS doing one job three ways with no written reason. Owner ruled T1 "per REC" the same day. This is Stage G's scoped-but-never-built third ("nav type scale + pill silhouette").

**What was measured (the defect):** nav labels at **11.52px/600** (org identity row), **12px/400** (marketing) and **12.48px/600** (consumer + tournament strips), across **three** letter-spacings. Sign-in pill **32px** (marketing, org row) vs **34px** (consumer, tournament). And the **SAME shared `WorkspacesPill`** rendered **26px** in the two operator strips vs **30px** in the consumer bar — because the trigger inherits its host bar's `.pill` class and each host sized it locally.

**BINDING RULES:**
1. **Canonical spec = the consumer strip's, whole.** `--nav-label-size: 0.78rem` (12.48px), `--nav-label-weight: 600`, `--nav-label-tracking: 0.03em`. The consumer strip is the highest-traffic bar and already the reference for `--chrome-bar-h`. **Taking size from one bar and tracking from another would rebuild the exact defect** — one bar, one whole spec.
2. **SIZE and TRACKING bind every nav label. WEIGHT binds plain nav LINKS.** Pills and CTAs keep **700** — that is emphasis carrying a role difference, not drift. (The audit's "two weights for one job" was 600 vs 400 on the *same* job across two bars.)
3. **A nav label's type spec is a MATERIAL, not a dimension — so MARKETING JOINS.** R5 ruled that marketing's *height* may differ because a bar's height is the room's proportion; materials were already shared across all five bars. Marketing's own room is expressed by its ratified 64px `--marketing-bar-h`, its bottom link bar and its lime CTA — not by a 0.48px type difference nobody chose. **Visible on marketing:** labels go 400 → 600 and tracking tightens 0.1em → 0.03em.
4. **`--nav-pill-h: 30px`, deliberately EQUAL to `--icon-door-size`.** A pill and an icon door share a row, so they share one silhouette. Pills declare `min-height` + zero vertical padding to land on it exactly, rather than hoping a padding pair adds up — which is how 32/34/26px happened in the first place.
5. **A shared control must not be sized by its host.** `WorkspacesPill` inherits the host `.pill` class by design (colour is what carries family); its GEOMETRY now comes from the token, so the same control cannot render at two sizes again.

**Applies to:** `globals.css` (token block, beside `--chrome-bar-h` / `--icon-door-*`), `ConsumerShell.module.css` (`.topLink` `.utilLink` `.utilCta` `.utilCoach`), `Navbar.module.css` (`.actionLink` `.actionCta` `.actionPill` + new `.marketingLink` `.marketingCta`), `AdminTopStrip.module.css` + `CoachTopStrip.module.css` (`.pill`).

---

**The four micro-rulings (bundled with T1 — one sentence each, per the repair plan):**

**(a) Rail vs phone org-name — adopt the PHONE rule everywhere.** The org NAME always renders above an event's identity; it is a **link only when the org's public page is a real destination**. The desktop rail used to drop the name entirely when the page wasn't real while the phone eyebrow kept it as inert text — the same signal rendered two ways, and the desktop version lost *information*, not just a door. Whose event this is stays true whether or not there is a page to visit. **The chevron goes with the link** — a trail marker pointing nowhere is a dead affordance, the exact class this pass closes. *(Code: `TournamentSideRail.tsx`.)*

**(b) The consumer variant's phone wordmark bar — ratified as-is.** The base app has no other identity anchor at phone widths, whereas the tournament and coach variants each substitute their own (a branded event header, a team/event header). The asymmetry has a local reason on each surface and needs no unifying principle. *(No code.)*

**(c) Day-of shells keep INERT wordmarks — deliberate, now written down.** Scorekeeper, gate check-in and platform-admin render the FieldLogicHQ mark as text, not a door. A gloved volunteer mid-game should not be one mis-tap from the consumer app, and Sign Out is the intended exit; platform-admin is an internal console for a different audience entirely. Each file now carries a one-line "ruled exception" comment so an eager unification pass stops at the door. *(Code: comments only, in the three shells.)*

**(d) Check-in gets NO flip door — considered and DECLINED, not overlooked.** Scorekeeper has one because a live event has a public twin to flip to; a gate check-in board has no public counterpart, so there is nothing on the other side. Recorded so the asymmetry reads as a decision rather than a gap. *(No code; comment in the check-in layout.)*

---

### 2026-08-01 — Practice Plans Phase 2 (the drill library): IDENTITY is read-only, SCAFFOLDING is editable — and a count may only claim what the data actually records

**⚠ THE LOAD-BEARING RULE, and the one a later session will be tempted to "make consistent".** A
loaded **drill's own words are READ-ONLY**; a loaded **plan template's are fully editable** (D14).
Both are correct and they will shortly sit one screen apart. The distinguishing question is
**whether the thing's name is a claim about what happened**:

- A **drill is an IDENTITY** — a named thing a coach says they ran, and its count has to mean the
  same thing eight times. Owner: *"if I load a drill and completely change everything about it, then
  I didn't run the same drill."* **This OVERRIDES the D14 copy-on-load precedent**, which was cited
  in favour of editable and does not bind here.
- A **template is SCAFFOLDING** — a starting point for a practice. Of course you adapt it; adapting
  it is the point.

**Do not unify them.** Do not make templates read-only for symmetry, and do not "fix" the drill rule
because a template beside it behaves differently.

**How the read-only half is drawn (all three parts matter):**
1. **The locked half renders as TEXT, not disabled inputs.** A stack of greyed boxes reads as broken
   on a phone; text makes a drill-backed station visibly a shorter, *different shape* — the divide
   explains itself without a tooltip. Locked: name, `description`, `goal`, `coachingPoints`, `setup`,
   `equipment`.
2. **Everything the PRACTICE owns stays editable** — who runs it, who's at it, the block's length,
   and **"Just for tonight"**, which absorbs most one-word-different cases with no detaching at all.
   The escape hatch is only reached by coaches who genuinely changed the drill.
3. **"Edit just for this practice" DETACHES** — keeps every word, drops the provenance, stops
   counting toward the drill. **The edit breaking the link is what keeps the count honest**;
   detaching is the honest act, not a workaround. "Swap drill" falls out of the same shape for free.

⚠ **Provenance is stored but NOTHING renders from it.** Every word is COPIED into the plan at add
time, so a plan never depends on the library to display: editing a drill later cannot rewrite a
practice already written, a retired drill keeps reading for ever, and there is no dangling-id failure
of the kind §10.3 refused for staff tags. The id answers "in 8 plans", and it is cleared on detach.
**A future phase that loads a template containing drill-backed stations must PRESERVE that
provenance** — silently stripping it would quietly break every drill's count.

**⚠ A COUNT MUST NAME WHAT IT ACTUALLY COUNTED.** *"Used 8×"* and *"Ran 6×"* were claims the data
cannot support — nothing records what was actually run (D4), and a coach may have planned a drill and
skipped it in the rain. Now **"In 8 plans" / "Not in a plan yet" / "last planned"**, and the field is
named `planCount` so the honest word is in the **type** as well as on screen. **Generalises: when a
metric's obvious English name overstates the record, rename the metric — and rename the field too, so
the next reader of the code cannot reintroduce the claim.** Applies to every future count in this
feature, including a template's *"Started 8 plans"*.

**Dim, never hide, and never reorder.** The focus rail filters by the categories of the drills in the
plan: off-type focus areas go **faint but stay exactly where they are**. Nobody disappears, nothing
reorders, and a player with no category set stays at full strength. **A filter that removes a child
from a roster-order list is a ranking wearing a filter's clothes.**

**A drill is ONE activity — one station's worth.** Picking a second drill into the same block is what
produces two stations, and therefore a rotation. There is no nested station list and no second kind
of block. **There is no "how many of it" count** — it would be 1 almost every time, and three of
something is three adds or a line in "just for tonight". ⚠ This retired the station-level `count`
that slice 1a had already shipped.

**The archive: a library is an INSTRUMENT, so it is live-season only** and its door is HIDDEN in a
completed season. ⚠ **A TEAM IS PERMANENT — only its program year turns over** — so a team-scoped
library survives a season rollover with nothing to migrate. What is genuinely season-locked is the
practice PLANS, so **"Add drills from a past season"** reads those and copies them forward; that is
the single deliberate cross-season read in the feature, it writes nothing into a finished season, and
`tests/unit/coach-season-write-guard.test.ts` asserts the library stays OFF the season-read rail so a
later session cannot assume the question was already answered.

**Two smaller rules worth keeping:**
- **A door must be gated on what lies BEHIND it, not on the room it sits in.** The Drills door rides
  `schedule`, not just the season — Development is reachable by an assistant granted `notes` alone,
  who would otherwise be shown a door that answers "you do not have access to the schedule". Same
  dead-end the archive rule forbids, wearing a different wall.
- **Same codebase, opposite sanitiser rules, both right.** The autosaving **plan** never discards a
  row for being empty (autosave + discard-incomplete-data is data loss), but a **library item**
  created by an explicit submit *does* reject an empty name. The distinguishing fact is whether a
  human pressed a button.

**Applies to:** `lib/rep-drills.ts`, `lib/rep-drill-usage.ts`, `PracticeStation` in `lib/types.ts`,
`_PracticePlanEditor.tsx`, `_PracticeStationView.tsx`, the Drills room, and the org shared-library
screen. Full build record + the two gate rulings: `COACH_PRACTICE_PLANS_PLAN.md` §10.7.

---

### 2026-08-01 — Practice Plans 1b: the field clock RE-ANCHORS on every tap; a screen that shows one thing must own the case where that thing is half-written; and the archive dead-end closes by HIDING the door (owner ruled both open questions at the recommendations; mockup rounds 1/4/5 binding)

**THE CLOCK — owner ruling, and it generalises.** A countdown on an operating screen can be anchored to the SCHEDULE or to the USER'S LAST ACTION, and the two disagree the moment reality slips. Ruled: **both, in sequence.** Opening the run screen lands the coach on the block the *planned* clock says is running, with the true time left — which is the whole value of pulling a phone out mid-practice. **The moment they tap, that stop re-anchors to now and gets its full planned length.** A practice that starts eight minutes late therefore does not spend the rest of the night declaring every block overdue. **Generalises: anchor to the plan for ORIENTATION, to the tap for DURATION.** Anchoring purely to the schedule is the version that looks correct in a spec and is useless on a field.

**⚠ A SCREEN THAT SHOWS ONE THING MUST OWN THE HALF-WRITTEN CASE.** The run screen had two mutually-exclusive-looking bodies: a rotation carousel and a plain block. They were gated on *different questions* — `step.round != null` versus `!blockRotates(block)` — and a block that is *configured* to rotate but has no *computable* carousel yet (two stations added, groups not drawn: the normal intermediate state) fell between them and rendered **neither**, silently hiding the description, goal and coaching points the coach had typed. **The rule: when two branches are meant to partition a space, gate them on ONE predicate and its negation, never on two predicates that merely look complementary.** Caught by `/review`; the fix keys both on the same derived fact.

**⚠ A TIE IN A CURSOR LOOKUP GOES TO THE STOP THAT OWNS THE INSTANT.** `runStepAt` picks which block is running now. Two blocks share a start instant exactly when the first cannot advance the clock — a "rest of practice" block on an event with no end time, or a block with no minutes. Those are precisely the stops that ARE still running (unbounded, not zero-length), so taking the last of the tie skipped the coach past the block in front of them. **Generalises: when scanning a timeline for "what is current", a tie means the earlier item has indefinite length — prefer it.**

**ARCHIVE DEAD-END (the plan's §11.1 closing task) — owner chose HIDE.** In a completed season the practice-plan section is now absent from the schedule slide-over, rather than offering "Open the plan →" (which 404'd) and "Plan this practice →" (which invited a write into a finished season). One condition, no new plumbing. This is the binding **"the archive is OPT-IN"** ruling applied to its first new feature since it was made, and it closed an existing defect instead of doubling it — the new "Run practice" door would otherwise have inherited the same break.

**Two deliberate deviations from the round-5 mockup, both recorded so nobody "restores" them:**
1. **"My station" gets the advance control the mockup omitted.** That frame drew no buttons, but the person the screen exists for is standing at a station — without it they must back out to the station list, tap, and come back in, three gloved taps a practice. Same tap, same handler, records nothing.
2. **Tonight's note is NOT attributed** ("Note for tonight", not "Note from Brett"). The model stores the note, not who typed it; inventing an author on the one line a coach is most likely to act on would be a fabrication. Attribution is a model change, not a label change.

**⚠ VOCABULARY — the past tense hides in arithmetic.** `/review` caught one string, `"everyone's been through here"`, which is a claim about what HAPPENED derived from what was PLANNED — and it could render before the group on screen had even started. Now "every group is due here by the end." **The "planned, never done" rule bites hardest where a computed fact reads like an observed one.**

**Also: the UAT probe harness was fixed, and the fix is a lesson.** Two sessions blamed an "orphaned `rep_teams` row"; both were wrong. The cause was **one missing `organization_members` row** — the portal resolves org context *before* coaching assignments, so an assigned coach who is not an org member resolves no org. Compounding it, coach specs inherit the **org-owner** session unless they say otherwise. ⚠ **And the mis-diagnosis itself has a rule: an unchecked supabase-js `select` naming a column that does not exist returns an ERROR, not rows — `data?.length ?? 0` then reads as "zero", which is how "the coach has no assignment" was invented twice.** Always check `error` before believing an empty result. Repaired idempotently by `scripts/seed-uat-coach-fixture.mjs`; this unblocks Playwright probes portal-wide.

---

### 2026-08-01 — Nav Unification D1/F/G: the club page gets a phone frame, a section row, and one frame geometry

**D1 RULED (owner, from a two-device mockup): PHONE ONLY.** An org's public pages take the app's bottom bar ≤900px and **no platform chrome above it at any width**. The gap was real and inverted against the price ladder — a free-tier tournament family kept the app throughout while a League/Club family lost it the moment they left Home — but full parity would have sandwiched a paying club's branded page between two FieldLogicHQ bars, the one thing every design lens marked that option down for. Phone-only keeps the club owning the top of the screen (their identity row, the part that reads as theirs) and puts ours at the bottom. **Do not add the desktop strip here later without re-opening this decision** — a second wordmark above the club's name IS the rejected option. Gated by `showsOrgPublicChrome`; operator/day-of shells are excluded via an audience-split section list, so the two chrome predicates are provably mutually exclusive (unit-tested).

**STAGE F APPROVED WITH THREE CHANGES:**
1. **A TAB ROW AT EVERY WIDTH — NOT the tournament's desktop left rail.** The rail is a fixed 248px full-height column, justified for an event with six sections and live operational content. An org root is a directory page (hero + a few cards); a permanent quarter-viewport column holding three words fights the hero and commits a paying club's page to navigation furniture. Narrows the plan's "reuse the rail/tab-row pair" to the tab row only.
2. **LEAGUE/CLUB ONLY** (gated on `module_public_site`), not a raw "2+ sections" count. On tournament tiers the only possible entries are Home and Archives — a whole chrome layer for two words, on the tier whose platform-plain org page is correct by design (D3, BUSINESS_DECISIONS 2026-07-31).
3. **WHERE THE ROW RENDERS, THE STAGE E CRUMB RETIRES.** `Org › League` and a row highlighting League answer the same question and the row answers it better; stacking both is how a page reaches capacity. ONE wayfinding device per page. The crumb stays the answer on tournament-tier org pages. Implemented as a CSS handshake (`--org-crumb-display`) driven by the SAME single condition that mounts the row — deliberately NOT nav-context plumbing, the channel that blanked an org's name and logo earlier in this project.

**Scope finding that changed the build:** `teams` ships as a CRUMB label but NOT a tab. There is no rep-teams index page — `/{org}/teams` is a redirect shim (the org home's "Tryouts Are Open" card pointing at it is a known broken link). A tab needs a real destination; a crumb only needs a name. Hence ONE section table with a `tabbable` flag rather than two lists. **Teams becomes a tab the day that index page exists — one edit, both consumers.**

**STAGE G APPROVED WITH CHANGES:**
- **The coach portal's dark-mode gap was a BUG, not polish, and is fixed at the source.** `--home-*` was defined only under `html[data-user-theme="warm"] [data-coach-warm-enabled]`; under an explicit Dark preference the whole palette was UNDEFINED inside the coaches shells while they kept consuming it. The Workspaces popover had been patching this one property at a time with hand-written fallbacks. globals.css now carries a `html[data-user-theme="dark"] [data-coach-warm-enabled]` block beside the warm one (the consumer shell's proven single-injection pattern), and the popover's fallbacks are DELETED — a fallback there would only mask the next gap instead of surfacing it.
- **Do NOT rename the two strip-height vars into one `--operator-strip-h`.** They are read by a dozen sticky headers with a `, 0px` fallback, so a missed rename does not error — it silently tucks a toolbar under the strip. Instead the VALUE is stated once (`--operator-strip-h` in globals) and each shell's local var derives from it; the shell-local zeroing (≤900px, focused shells) stays local.
- **ONE platform chrome-bar height, `--chrome-bar-h: 48px`** (owner-spotted 2026-08-01 while crossing surfaces: "why is the height and width of the header different than on the main app and admin pages?"). The consumer app strip was 48px and the operator strips 44px — the same KIND of bar (platform identity + personal doors) at two heights nobody chose. **Unified UP to 48:** the consumer bar is higher-traffic and already carries a search field, so growing the operator strip is the safer direction. This also absorbs a SECOND drifting copy — the tournament layout seeded `--desktop-strip-h: 48px` inline while ConsumerShell hard-coded a matching 48px fallback under a comment that literally read "keep the two in sync"; both now read the token, so that note is obsolete. Admin/coach shells keep their local vars (each zeroes its own per shell) but derive the value.
- **The BRANDED bar stays 72px and is deliberately NOT unified with it.** An org/tournament public identity row carries a customer’s 44px logo and their name at display size; platform chrome carries a wordmark and icons. TWO heights, both intentional — do not collapse them into one.
- **Nav WIDTH differs by design and must NOT be "fixed":** each nav aligns to ITS OWN page’s content. App and admin are full-width tools, so their chrome is full-bleed; org/tournament public pages are centred 1200px documents, so their nav wears the same container — the club’s name then sits directly above the club’s own hero. Making the branded nav full-bleed would misalign a paying customer’s identity with their own page. (Same rule fixed the Stage F tab row, which had pinned itself to the viewport edge.)
- **The icon door is TWO shapes, not three.** All three were already 30px and the two operator variants already identical; they differ only in colour, which is correct because colour is what carries family. Now `--icon-door-size` everywhere + `--icon-door-radius` for the operator squircle; consumer keeps 50%. One size, two radii.
- **Door order RATIFIED as already built** (audited, no code change): wordmark · … · bell (where the hub has one) · account · Workspaces, outermost. Scope increases left to right — the bell is about *this place*, account about *you*, Workspaces about *everywhere else*.
- ⚠ **The plan text was STALE** ("chat before account") and is corrected: the chat door was removed from operator strips by binding ruling. **The consumer strip KEEPS its chat icon and must NOT be "fixed" to match** — chat is a top-level destination for a fan and a section of the work for an operator. Same icon, different job. This is the distinction a tidy-up would break.
- **Pill vocabulary needs no new decision**: ⇄ = SIDE, plain = ENTER, already ratified — enforce only.

**Explicitly NOT done, still open:** the org-page light/dark setting. Every org page is dark on every tier, so a club with a light tournament page still hard-flips to dark going up. F does not worsen the seam but does not close it; it needs a settings screen + stored preference (product work, not navigation).

**Applies to:** `lib/consumer-routes.ts`, `lib/org-public-sections.ts`, `components/public/OrgSectionTabs.*`, `components/consumer/ConsumerNav.tsx`, `components/Navbar.module.css`, `app/globals.css`, both operator strips, `WorkspacesPill.module.css`, `app/[orgSlug]/layout.tsx`. Mockups: D1 `claude.ai/code/artifact/eef5768d-d2f4-4775-9194-03d23a5e39b2` · crumb `claude.ai/code/artifact/cd6b24d2-28c1-448c-add4-792d595a004c`.

---

### 2026-08-01 — THE ARCHIVE IS OPT-IN: new coach-portal functionality is NOT viewable in past seasons unless someone says so (owner ruling, binding)

**Owner, in their words:** *"any new features, windows, etc. in the coaches portal default to not be
viewable in archived seasons and we can explicitly add them if needed — that way we aren't opening up
new functionality to historical seasons without explicitly saying so."*

**Why it is the right default, from what Chunk F actually cost:** the expensive defect in that chunk
was not a feature missing from the archive — it was a feature *reachable* from the archive that
hadn't been built for it. Money sub-pages resolved the LIVE season with full write controls one click
inside a 2025 view; Development showed live data under a "2025 · Complete" chip; Staff's remove
button deleted a LIVE assignment. **Every one of those was a surface that arrived in the archive
without anyone deciding it should.** Opt-in makes the failure mode "a section is missing from history"
(visible, cheap, fixable) instead of "a section is lying about which season it is showing" (invisible,
and it edits real data).

**How it is ENFORCED, not just documented** — `tests/unit/coach-season-write-guard.test.ts`:
1. `APPROVED_ARCHIVE_DOORS` — the exact door set a finished season offers. Adding a door fails the
   build until the list is edited, which is the decision point.
2. `APPROVED_SEASON_AWARE_ROUTES` — the exact set of coach API routes permitted to serve a past
   season. Everything else resolves the ACTIVE year and cannot address history at all.
The architecture already fails closed (a route that doesn't opt into the season-read rail simply
can't see a past season); these lists turn that accident into a contract with a name on it.

**The three questions to answer before adding anything to either list:**
1. Is it a **RECORD or an INSTRUMENT**? Instruments — anything that moves money, runs a tryout,
   messages families, or configures the team — stay live-season-only (D-F7).
2. Does its page carry the season through **every link and every fetch**, all the way down? An
   archive is a container; the unit of work is the whole reachable subtree, not the door.
3. Does it show what the coach could see **AT THE TIME** (governing rule 1), not today?

**Corollary for a surface that is NOT archive-ready:** hide its entry point in an archive rather than
letting it dead-end. A link that 404s is the same bug wearing a politer face.

---

### 2026-08-01 — Read-only is a property of the SEASON, never of the team — and three "already shipped" claims that were false (Chunk F, the frozen past season)

**The load-bearing rule, stated once:** a coach portal surface decides "can this be edited?" from **the season being viewed**, never from the team's state. `resolveClosedAssignment` (the Batch 3 predicate every nav and the Overview share) returns **null whenever the team has ANY active assignment** — so a **rolled-forward** team (2026 live, 2025 finished) is never itself "closed". Keying read-only off it would have left that team's 2025 archive quietly **writable**. `lib/coach-season-view.ts` holds the rule; `resolveClosedAssignment` keeps its own narrower job ("which of my TEAMS has finished") and was deliberately NOT widened.

**Three claims in the plan of record were wrong. They are corrected here because the docs still read as if they were true elsewhere:**
1. ❌ *"capabilities resolved from the SEASON'S OWN assignment row — rule 1 falls out of this design."* `lib/coach-season-read.ts` took **no year parameter at all** and returned the team's active assignment, else the **newest closed** one. Opening 2023 handed the coach their 2025 grants. Making governing rule 1 true was the centre of this chunk, not a freebie. **Fixed** — the rail now resolves the season first and takes capabilities from that season's row.
2. ❌ *"`resolveCoachContext` — the ~49 write routes' resolver."* There is **no shared resolver**: it is a locally-declared function copy-pasted into ~53 route files. There is no chokepoint; portal-wide rules must be enforced by a rail routes opt into **plus a test that proves they did**.
3. ⚠ *"the read-only write guards already exist."* Closed-season writes were refused **by accident, not by a guard** — write handlers resolve through the active-only assignment lookup (403) and then `getActiveRepProgramYear` (404), so a past season was simply unaddressable. **Chunk F makes past seasons addressable, which dissolves that accident.** The guard is now stated as a rule over the source tree (`tests/unit/coach-season-write-guard.test.ts`): no write handler may read `?year=` or import the season-read rail. One declared exception — Staff, governing rule 3.

**Generalises — when safety is structural rather than stated, adding a capability removes the safety.** Before extending reach (a new parameter, a new door, a new id space), find out *why* the old thing was safe. If the answer is "it couldn't be addressed", you are not extending a guarded system; you are removing the guard.

**⚠ The opposite correction, banked so it isn't re-feared:** the DB layer was *already* fully `programYearId`-keyed (`getRepRosterPlayers`, `getRepTeamEvents`, `getRepTeamAttendanceReliability`, `getRepTeamSeasonLineups`, `getRepPlayerDuesSummary`, `getRepTeamStaffForYear`). The handoff called this "genuinely new plumbing for ~8 sections". It wasn't — the gap was only that each ROUTE hardcoded `getActiveRepProgramYear(teamId)` then passed `programYear.id` down. **Re-size against what you read, in both directions.**

**Owner rulings (2026-07-31 → 2026-08-01), binding:**
- **D-F1 — tryout history is IN** (owner overruled the recommendation to cut it): turnout year-over-year, decisions, and evaluations. Delivered as **one dedicated archive read**, not `?year=` on the six live tryout endpoints — those are *instruments* (check-in, evaluator links, decisions, offer emails), and teaching them to address a past season would put a year parameter one typo from a write path. **Records in, instruments out** is now the line for money AND tryouts.
- **D-F4 — no per-screen read-only banner.** A `2025 · Complete` chip beside the page title, an amber season switcher in the shell, and the year in the breadcrumb carry it. Owner: coaches learn the convention within a screen or two, and a banner on thirty-odd screens is noise. **ONE exception, owner-approved:** the Staff screen keeps a sentence, because it is the one place the chip is misleading — the season *is* complete and those buttons *do* work.
- **D-F3 — the season switcher is NOT on the phone's pages.** Sidebar on desktop, **More sheet** on a phone (mirroring the tournament switcher in `AdminBottomNav`), because a coach checks history a few times a season and that row was charging rent on every screen. The chip doubles as the way back out on a phone, where the switcher is buried — it shares the title line, so the exit costs no vertical space.
- **D-F2** Season's End is the archive's front door; **Chunk I's one-anchor Overview resolver is untouched** and gains no closed-season state. **D-F5** no cut-off. **D-F6** rolled-forward teams in scope, and they are the primary case.

**⚠ Sensitivity, recorded as a decision rather than something that happened:** tryout evaluations are written judgements about other people's children, often children who were told no, now surfaced across years. Two constraints keep it proportionate and **must be preserved**: only coaches who held `tryouts` **at the time** can read them, and they open **in place beside a live candidate**, never as a standalone browsable dossier. Do not add a cross-season "candidate dossier" surface without a fresh owner ruling.

**⚠ THE LESSON FROM THIS CHUNK'S OWN REVIEW (2026-08-01) — an archive is a CONTAINER, and a
container is only as true as its deepest room.** Chunk F opened eleven doors on a past season and
made the first room of each one season-aware. Every hub was correct; every page *beneath* a hub still
resolved the live season, several with full write controls. A coach could switch to 2025, open
Money → Expenses, and be logging a real expense against 2026 with nothing on screen saying so.
Generalises: **when you add a dimension (a season, a tenant, a version) to a section, the unit of
work is the whole reachable subtree from every door you opened — not the door.** The cheap test is to
walk each new door two levels deep as the user and ask what the second screen thinks it is showing.

Two Criticals from the same review, both worth remembering as shapes:
- **A mechanical conversion that touches a fetch URL must also touch its dependency array.** Four
  pages interpolated the season into the request and omitted it from the deps, so switching seasons
  repainted the label and kept the data. The one page written by hand had it right. ⚠ **And every
  probe passed** — because they all navigated with a full page load, which remounts and hides it. A
  test suite that only hard-navigates cannot see a client-state bug; the probe now drives the real
  switcher.
- **A write endpoint that resolves "the active year" is not season-aware just because its READ is.**
  The archive's Staff screen offered "Remove access" against a route that matched the target to the
  team's ACTIVE year: on a rolled-forward team it deleted the assistant's LIVE assignment while the
  copy promised it only affected who could view the archive. Fixed by resolving the TARGET'S own
  season and checking head-coach authority against that season. **Rule 3 also now refuses capability
  EDITS on a closed year (409)** — the stored grants are the record rule 1 reads back, so changing
  them rewrites the past rather than changing who can look at it.

**Also fixed in passing:** the Insights archive gated per-season money on ONE boolean — an assistant granted money this year saw every past season's totals. It now resolves the gate per season (`resolveCoachSeasonCapabilityMap`).

---

### 2026-07-31 — The premium coach strip carries NO chat door: a door that EJECTS you from the workspace loses to one that keeps you in it (owner ruling, "I am good with that approach") — amends Nav Unification Stage H.1

**Trigger (owner, seeing both at once):** *"do we need chat on the side nav now that we have the top nav universal chat?"* On a desktop portal the coach had **two chat doors visible simultaneously** — the new strip's icon and the sidebar's "Chat". (No duplication on a phone: the strip is >900px only, so the bottom-nav Chat tab stands alone.)

**The justification for keeping both was FALSE, and that is the finding.** `CoachTopStrip` documented its icon as *"the APP's /chat (your own conversations); the portal's bottom-tab 'Chat' keeps the word for the team's chat."* The portal's chat screen is **per-USER, not per-team** — `CoachChatView` resolves from the same `chat_room_members` membership, carries the same staff **and** tournament rooms, and heads itself *"Your chats"*. The published help says the same thing (the staff room appears in the portal list *and* on the app's Chat tab). Two labels, one room set; the only difference is presentation (app tab groups by event, portal is flat).

**Decision (owner): remove the chat door from the coach strip; the sidebar/bottom-nav Chat stays.**
The portal's door won on one concrete ground: **the strip's door ejected the coach into consumer chrome** — the exact trip that already needed a *"Back to your Coaches Portal"* rescue link bolted on at A3 QA because first-time coaches landed there and could not find their way home. **A door that needs a rescue link to undo itself is the weaker of two doors to the same place.**

**Generalises — the rule for the operator strip on any shell:** the strip carries **only genuine leave-this-place doors** (wordmark → Home · account · workspaces). A **section of the work is not an exit** and does not belong there, however app-wide its content happens to be. Reach for the strip when the answer to *"where does this take me?"* is *another place*; reach for the place's own nav when the answer is *another part of this place*.

**Rejected alternative (named so it is not re-proposed):** keep both and make the distinction real by scoping the portal's Chat to the current team. Declined — a coach with two teams would lose the single list showing everything, which is what makes the portal chat useful; it would also be a behaviour change dressed as a naming fix.

**Side effect worth banking:** the strip no longer mounts a chat-unread pipeline, retiring the *"THIRD always-mounted chat-unread pipeline"* KNOWN COST that file shipped with. The sidebar + bottom-nav pair still double-mount theirs — a documented pre-existing duplication, still to be hoisted **together**, never one alone.

**⚠ Provenance:** this REVERSES a detail of an approved Stage H.1 mockup, so the mockup is no longer the authority on this one element — **this entry is.** `NAV_UNIFICATION_PLAN.md` Stage H.1 amended in the same unit of work. `CoachTopStrip` was untracked/in-flight in a concurrent session when this landed; if the icon reappears, it was re-added from the stale mockup and should be removed again.

**Applies to:** `components/coaches/CoachTopStrip.{tsx,module.css}` (chat door + `.doorBadge` + the unread hook removed), `docs/projects/active/NAV_UNIFICATION_PLAN.md` §Stage H.1. No migration. [[design-principles]]

---

### 2026-07-31 — A REDACTION IS ONLY AS STRONG AS THE WEAKEST DOOR ON THE SAME SCREEN — and when a capability spans two kinds of thing, the gate must be the union of what BOTH kinds require (owner: "include it now" + "commit staff work first")

**Decision (owner ratified both approved fixes plus the DB door found en route).** Spun out of the
Coaching-staff layout `/review`. Built on dev, uncommitted.

1. **⚠⚠ BINDING: per-player documents require BOTH `documents` and `rosterPii`
   (`canViewPlayerDocuments` / `canManagePlayerDocuments`); team templates keep gating on
   `documents` alone.** The `documents` capability silently spanned two unrelated things — blank
   team forms (`rep_document_templates`, no `player_id`) and completed forms signed for one child
   (`rep_player_documents`). Gating both on the weaker of the two requirements meant a default
   assistant saw guardian email/phone/DOB/medical-notes **blanked out by `redactRosterPlayer`**, and
   directly beneath them that same child's "Medical Consent" PDF by filename with a working Download
   button. **The redaction was defeated from the very surface that performs it.** *Generalises: when
   one capability covers two kinds of object, the gate is the UNION of what each kind requires — and
   the tell is a screen that hides a fact in one component and ships the document containing it in
   the next.*
2. **Rejected (again, and recorded so it is not re-proposed): flipping `ASSISTANT_DEFAULTS.documents`
   to `'off'`.** That reverses the locked 2026-06-25 ruling and takes blank templates from assistants
   who legitimately need them. Requiring both makes **both** June rulings true simultaneously —
   "documents view-only by default" AND "guardian PII off by default" — with no migration. A
   dedicated capability was also rejected: a migration, new grid UI and a fourth grant to reason
   about, to say what two existing grants already say together. *Generalises: a UI or route lying
   about a decision is a bug in the UI or route, not grounds to reverse the decision.*
3. **⚠⚠⚠ THE FINDING THAT MATTERED MORE THAN THE BUG WE WERE SENT TO FIX — the app-layer gate was
   never the only door.** Prod grants `anon`/`authenticated` the default SELECT on public tables, and
   `rep_roster_players` + `rep_player_documents` each carried two permissive SELECT policies keyed on
   **assignment, never on capability** ("coaches can read assigned team roster", "org members can
   read …"). The browser ships an anon-key client holding the coach's own session. So **any assigned
   assistant could read the full unredacted roster — guardian email/phone, DOB, medical notes,
   internal notes — from the browser console, bypassing the entire `rosterPii` model.** Fixing only
   the routes would have closed the door and left the window. Migration **212** drops all four,
   leaving RLS enabled with no policies (the standard service-role posture); every caller in the app
   uses `supabaseAdmin`, so it is a no-op for the product. *Generalises: **when you gate something at
   the app layer, enumerate every OTHER route to the same rows before calling it closed** — RLS
   policies written as "defense in depth" become the primary door the moment the app layer starts
   making finer-grained decisions than they do.*
4. **⚠ DEV STRUCTURALLY CANNOT REPRODUCE THIS CLASS OF DEFECT.** Impersonation on dev returns
   `permission denied` because dev's `authenticated` lacks the SELECT grant that prod holds. A clean
   dev result is **not evidence**. Confirms and sharpens `reference_supabase_rls_grants.md`: read
   posture from **live prod**, and treat dev as incapable of falsifying a grant-dependent claim.
5. **⚠ SECOND INSTANCE OF THE FALSE-GREEN SHAPE: migration 212 is POLICY-only, and
   `refresh-db-snapshots` reports `rls: 0` divergence with dev at 0 policies and prod still at 4.**
   The drift gate cannot see policy changes, exactly as it could not see function-only mig 211. *The
   drift gate is a COLUMN/CONSTRAINT parity gate — it is not a security-posture gate, and a green
   drift report must never be read as "prod matches dev".*
6. **Every member of the Sensitive group now prompts — behaviour fixed, sentence untouched.** The
   group promised "You'll be asked to confirm before granting these" while only 3 of 6 did.
   **Documents left the group** (it now grants blank team forms only, so it no longer warrants a
   speed bump) and **Tryouts + Internal notes gained prompts** — Tryouts was the widest gap, handing
   over guardian contact details for children *not yet on the team*, silently. `sensitiveGrantCount`
   now derives from the SENSITIVE_* arrays instead of naming `documents` explicitly, so moving a
   control between groups can't leave a stale term counting something the group no longer shows.
   *Generalises: when copy promises a protection, add the protection; softening to "some of these"
   trades a real safeguard for a tidy sentence and tells the reader nothing about which.*
7. **Timing is the whole risk story, and it was checked before scheduling rather than after.** Prod
   runs the defective code but holds **0 rep teams, 0 coaches, 0 roster players, 0 player
   documents** — no org has built a rep team yet. So this removes access from nobody, needs no notice
   to head coaches, and lands before the first real family's medical form rather than after.
   *Generalises: for a live privacy defect, count the exposed ROWS before deciding severity — "live
   in code" and "live in data" are different questions and they set different deadlines.*

**Also found, NOT fixed (out of scope, flagged):** `storage.objects` carries `"Allow public update"`
with `USING = null` and `WITH CHECK = bucket_id = 'resources'`, so a row in the private
`rep-team-documents` bucket satisfies USING and the check would permit rewriting it *into* the
public `resources` bucket. Unproven through the Storage API and unexploitable today (zero objects).
Worth a hardening pass. The bucket itself is correctly private with no read policy — signed URLs
really are the only read route, verified live.

**Applies to:** `lib/coach-capabilities.ts` (two new predicates), the four
`…/roster/[playerId]/documents/**` route gates, the player detail page (section no longer renders
when it can't be opened), `components/coaches/CoachStaffPanel.tsx`, new
`supabase/migrations/212_rep_roster_docs_rls_service_role_only.sql` (**dev only — NOT prod**), new
`tests/unit/coach-capabilities.test.ts` (9 cases incl. the redaction invariant). Head coaches and org
admins verified unaffected. Plan: `docs/projects/active/COACH_PLAYER_DOCUMENTS_PII_PLAN.md`.
[[design-principles]]

---

### 2026-07-31 — The strip's chat-door removal generalizes to ALL admin hubs (owner: "that should probably be the case for all admin screens")

**Decision.** The coach-strip chat-door removal (entry above/nearby, another session) applies to the
ADMIN top strip too, and to any future operator strip: **the frame strip carries only genuine
leave-this-place doors — wordmark · (bell where the hub has one) · account · Workspaces. Chat is a
section of the work, not an exit.** A /chat door on an operator strip duplicates the shell's own
Chat surface and ejects the operator into consumer chrome. Applied same-day to `AdminTopStrip`
(chat door + its unread pipeline removed; the sidebar's tournament Chat badge self-serves again).

---

### 2026-07-31 — The operator frame strip generalizes to EVERY admin hub: FieldLogicHQ branding applies to the premium Coaches Portal exactly as to tournament admin (Nav Unification D2 RATIFIED — reverses the premium portal's no-wordmark ruling)

**Owner's words:** *"the fieldlogichq branding applies to coaches portal just like tournament admin,
those surfaces from a product perspective are the same, admin hubs."*

**Decision.** The thin operator frame strip (Nav Unification Stage C: wordmark→Home top-left; the
person's own doors top-right; desktop >900px only) is the standard chrome of every ADMIN HUB — the
tournament/org admin shell AND the premium Coaches Portal — each in its own skin (admin dark, coach
warm/dark via the existing theme marker). This **reverses the "no platform wordmark anywhere in the
premium portal" clause** of the operator-HQ ruling. **What it does NOT reverse:** the two-FAMILY
chrome split stands (free coach = consumer chrome "companion"; premium = operator shell), the warm
skin stands, the contextual ⇄ flip rules stand, and the phone portal is untouched — mobile doors
remain gated on the More-sheet overflow check (Stage H mobile pass).

**Build shape (mockup-faithful):** the coach strip carries wordmark · chat (icon-only — the portal's
own "Chat" tab keeps the word) · account · Workspaces popover, per the approved rev-2 mockup panel.
**The notification bell deliberately STAYS in the sidebar header** — the approved mockup shows no
bell in the coach strip, and its notifications are portal-scoped; revisit in the mobile pass.

**Applies to:** new `components/coaches/CoachTopStrip.tsx` (+ module css), `app/[orgSlug]/coaches/layout.tsx`
mount, `coaches.module.css` shell top padding (`--coach-topstrip-h`), WorkspacesPill warm-skin
fallbacks. [[design-system]] [[design-principles]]

---

### 2026-07-31 — Coach Portal Chunk B: a navigation control is named by its AUDIENCE when a sibling shares its category; help belongs to DOORS, not pages; and a welcome is an anchor STATE, never a banner beside one (mockups `claude.ai/code/artifact/96e4a359-7966-4f1c-9105-3ddbb85dd969` rev 1 = binding; D-B1–D-B4 ratified at the recommendations, "I agree with all of your recommendations")

**Decision (owner ratified all four).** Findability chunk — P1 #1, #4, #17, and #12 narrowed. Four
binding rules, plus the corrections that reshaped the chunk before a line was written.

1. **⚠ A door renamed without its DESTINATION is a half-applied decision.** `Announcements` → **`Email families`** (names both audience and medium; `Chat` kept — it is the app-wide word for a conversation, the consumer bottom bar uses it, and the page already heads itself "Your chats", so renaming it would fracture a platform vocabulary to fix a local problem). **The screen it opens was renamed too**: leaving the page titled "Announcements" would have re-broken the 2026-07-31 destination-naming ruling one step further in. "Announcement" stays the noun for an individual sent item; only the place is renamed. **The FREE portal keeps "Announcements"** — separate tool catalog, two-family ruling intact. **Generalises: when two nav items sit under one category header, disambiguate by AUDIENCE, not by adding a description — a category header over two similar labels is what makes them read as interchangeable.**
2. **⚠⚠ `isCoachNavItemVisible` is keyed by DISPLAY LABEL, so renaming a nav item silently opens its capability gate.** A missed case falls through to `default: return true` and hands an ungranted assistant the door. The new label was added as a case and **the old label kept as a fallthrough** — belt-and-braces for any surface a future rename misses, and the portal tour still asks by the old name. **Generalises: before renaming any nav label in this portal, grep the gate. A label is not just copy here — it is a lookup key.**
3. **Help belongs to DOORS, not pages: every nav destination carries a help icon; a page reached by drilling INTO one inherits its parent's guide and carries none.** The review's "3 of ~25 pages" (12 of 41 by the time of the build) was the wrong denominator — all 12 existing icons were already nav destinations and every drill-in correctly had none, so the promise was **12 of 17 kept and the gap was five doors**: Attendance (nav home since Batch 4, help never added), Chat, Settings, Season's End, and Insights-on-a-closed-season (`/history/results` — the hub that carries the icon is unreachable there). **A page with no guide gets NO icon — and the guide gets written.** An icon that opens the help hub is a broken promise dressed as help: the coach taps "?" expecting an answer about *this screen* and gets a table of contents. Settings had no guide, so one was written in the same unit of work; the rule now has zero exceptions. **Chat is the documented shape exception**: deliberately full-bleed with no `.pageHeader`, so its trigger sits in the header of whichever surface is on screen — the room list when nothing is selected, the conversation header otherwise (exactly one door in all five states; a single room auto-selects and never renders the list at all).
4. **A welcome is an anchor STATE at the top of the ordered resolver, never a banner beside it.** A cold-signup coach **is** a pre-season coach plus two extra facts — the same superset relation as `season_check`→`lull` — so the specific state REPLACES the general one and **inherits its door** ("Add your players instead"). A welcome band beside the anchor would have re-created the exact nine-independent-bands defect Chunk I exists to remove. Pre-season only: an introduction must never outrank a game today.

**⚠ THE REVIEW CATCH WORTH GENERALISING (confirmed).** The welcome gated on `tourDismissed` + "no activity" — and **`hintsOff` and `tourDismissed` are INDEPENDENT account preferences**: `turnOffHints` never sets `tourDismissed`. So a coach who explicitly switched onboarding hints off on one team, then picked up a second, would have been met by an onboarding card — the precise interruption Quiet Mode exists to remove, delivered through the ONE card on the page. **Generalises: a welcome is a hint and obeys the hint switch; when two preferences can both mean "leave me alone", a new surface must honour BOTH, and independence between them is the thing to check, not assume.**

**Ground truth the handoff got wrong — three corrections, verified at pickup:**
- **Chat is no longer only the organizer channel.** Project 2A gave every team a standing **staff room** (own staff, all season, no tournament). Any naming that called Chat "the organizer line" would have been wrong — and the shipped portal-tour copy said exactly that, so a coach reading it never learned their staff room existed. Corrected in the same pass.
- **P1 #12 was already half-built.** Quiet Mode shipped a good portal tour, but offered from inside ONE card — so a coach whose Overview resolved to a game, a lull, or nothing was never offered it at all.
- **P1 #2 was genuinely closed** (verified rather than assumed) and its empty state is correctly scoped to the entitlement edge case.

**Also worth keeping:** the mobile bell answer was **already shipped next door** — admin solved it 2026-07-22 (a More-sheet row opening the FULL page, count badging the More tab). Reused wholesale rather than designed again. It opens the **page, not the bell's panel**, because the panel's phone rules anchor it at `top: 48px` to sit under the *admin* top bar, which this portal does not have at any width. **Generalises: before designing portal chrome, check whether the sibling shell already solved it — and check that the destination you are pointing at works at the width you are pointing from.** Rejected and drawn as rejected: a 6th bottom-bar tab (~60px per door at 361px, below the tap floor, evicts Roster or Chat) and a page-header bell (three pages have no header; that slot belongs to help).

**A probe that asserts a LIST is not asserting a RULE** (caught at `/simplify`): the help-coverage probe first hardcoded the door list, so a nav item added later without help would simply not be tested. It now walks the **rendered** sidebar, with a length guard so a selector matching nothing fails instead of passing vacuously.

**Applies to:** `lib/{coach-nav-visibility,coach-overview}.ts` (+ tests), `components/coaches/{CoachesSidebar,CoachesBottomNav,CoachPortalTour}.tsx`, `components/coaches/CoachesBottomNav.module.css` (the chat unread badge's nine inline declarations retired onto a shared class — a literal outside the stylesheet is invisible to the colour guardrail and the warm gate), `components/chat/CoachChatView.{tsx,module.css}`, the team Overview + attendance/settings/season-end/history-results/announcements pages, `lib/help-content/coaches.tsx` (new `premium-team-settings` section + two premium FAQs), `tests/uat/scenarios/coach-findability-smoke.spec.ts` (new). **NO migration. No write path. `coaches.module.css` deliberately untouched** — a concurrent stream held uncommitted hunks in it, and the welcome inherits `.oneThing`'s base accent, so no rule was needed. [[design-system]] [[design-principles]]

---

### 2026-07-31 — Pinning something to the bottom of the screen is a change to a SHARED BUDGET, not to one element: everything already down there must be re-derived, and its height must be DECLARED rather than assumed

**Decision (owner-directed sweep after three symptoms in a row traced to one cause).** Docking the
lineup builder's Undo/Redo/Print bar above the bottom nav broke four separate things, none of which
were touched by that change. All four are the same mistake: **a fixed offset hand-composed from what
happened to be pinned at the bottom on the day it was written.**

1. **⚠ A bar with no declared height is a lie every consumer repeats.** The coach bottom nav set
   padding and let content decide its height — measured **70.31px** — while `--bottom-nav-height:
   72px` is what ~15 consumers reserve against. Everything pinned to the token floated a **1.69px**
   hairline clear of it (the reported symptom), and everything spacing against it over-reserved.
   **The fix is to make the token TRUE — `min-height` on the bar — never to retune the consumers.**
   The consumer shell's bar already did this; the coach one was the outlier.
2. **⚠⚠ The same omission hid the bar behind the nav on every notched phone.** The bar's offset
   carried the nav's height but not `env(safe-area-inset-bottom)`, so on a 34px inset it sat **32px
   BEHIND the nav** — and at z-index 250 vs 300 the nav won and covered most of it. **Undo was
   unreachable on the exact devices most coaches use**, which is the defect docking the bar existed
   to fix. It was only ever correct on phones with no home indicator. **Generalises: an offset that
   clears fixed chrome needs BOTH terms — the chrome's height AND the inset — every time.**
3. **A popover positioned before the bar existed cannot know about it.** Both lineup popovers
   (`.lineupAutoMenu`, one class serving Auto-fill AND Templates; `.lineupPdfMenu`) carried
   `bottom: 5.75rem` — the nav's height plus a gap, correct when the nav was the only thing down
   there. The new bar's band swallowed their tails, including Auto-fill's **Generate** button.
   **Measured broken on 6 of 8 viewport/inset combinations — only tall phones escaped.** Fixed by
   COMPOSING the offset from `--bottom-nav-height` + `env()` + a new `--lineup-dock-h`, so a fourth
   pinned thing means declaring it once, not re-deriving a constant a fourth time.
4. **Raising the z-index alone would only have moved the bug** — the panel would paint over the bar
   but still run off a short screen, under the nav. The height budget must be **subtracted from the
   viewport**, not guessed from the anchor: `100dvh − nav − inset − dock`.

**Two rules that made the fix safe, both worth reusing:**
- **`--lineup-dock-h` defaults to `0rem` on `.page` and is raised only on `.lineupDockedPage`**, so
  ONE formula serves pages with and without a docked bar and the no-bar geometry is bit-identical to
  before (72 + 0 + 20 = 92px = the old 5.75rem, exactly). A shared formula must reduce to the old
  behaviour in the old case, or it is a rewrite wearing a refactor's clothes.
- **A fallback should describe where the element actually LIVES.** `.lineupAutoMenu` falls back to
  `0rem` (it appears on pages with no bar); `.lineupPdfMenu` falls back to `3.5rem` (it only ever
  exists INSIDE the bar, so zero would silently park it back on the Undo button if the variable ever
  stopped reaching it). Identical fallbacks would have been the easy, wrong choice.

**Also fixed in the sweep:** the three lineup view tabs (`Batting order · Positions · Playing time`)
wrapped to two lines — the strip was sized for the TWO-button toggle it used to be and Chunk C added
a third without revisiting it. Full width + tighter padding + smaller type + `white-space: nowrap`
makes a second line structurally impossible. **⚠ The wrap was accidentally holding those tabs above
the tap floor** — on one line they compute to ~34px, so the fix REQUIRED `min-height: var(--tap-min)`
or it would have traded a cosmetic bug for an accessibility one. **Generalises: before removing a
wrap, check whether the second line was carrying the element's height.** One more instance of the
same drift class hardened en route: `.saveBar` restated the nav height as a `4.5rem` literal.

**Method note, and the reason all four were found:** every claim here is a **measured** computed-style
probe across viewport widths, viewport heights and both safe-area states — not a screenshot and not
spec reasoning. Two probes initially reported failures that were the HARNESS's fault (a nav rendered
without its real font; a footer nested as a sibling of `.page` instead of a child, which silently cut
off custom-property inheritance). **A probe that mis-nests is not measuring the page — reproduce the
real DOM ancestry before believing a red result**, which is the sibling of the existing "when a probe
measures a control, it is not measuring the layout".

**Applies to:** `components/coaches/CoachesBottomNav.module.css`, the lineup builder + its popovers
and view tabs, `.saveBar`, and `--lineup-dock-h` (new). CSS only, no migration. Owner QA pending.
[[design-system]] [[design-principles]]

---

### 2026-07-31 — In a row that runs out of width, the thing that IDENTIFIES the row is the LAST thing allowed to shrink — never the first (mockup `claude.ai/code/artifact/8c0a52de-8f18-46d3-819b-2813f969ff5c`; owner "I agree with your proposals, go ahead")

**Decision (owner ratified all seven + all three calls at the recommendations).** The Lineups → Games
cards truncated the opponent name on every phone. The cause is a shape, not a value: **the row was
flex with every element except the title at `flex-shrink: 0`**, so the entire width deficit landed on
the one string that says which game this is. Measured at 390px, of a 326px row: date tile 44 · gaps
41 · status chip 102 · arrow 14 — leaving the name **125px** (95px at 360px). The chip and the tile
together outweighed the game's own name.

1. **BINDING, generalises to every list row: a fixed-size ornament must never out-rank the row's
   identifier for width.** Before pinning anything `flex-shrink: 0`, ask what absorbs the deficit
   when the row is narrow. If the answer is "the name", the layout is wrong — reflow it. The
   diagnostic that made this obvious is worth reusing: **write out the row's width budget in pixels
   at 390 and 360 and see which segment is paying.**
2. **Truncation that erases the DISTINGUISHING part of a label is a correctness bug, not a polish
   one.** Two games against the same club rendered identically once cut ("vs Durham …" / "vs Durham
   …"), so the card stopped answering its own question. **The name wraps; the furniture shrinks.**
   Clamped at two lines with the ellipsis retained — unlimited wrap lets one pathological entry make
   a five-line card, and a clamp with no ellipsis would be the 2026-07-30 "silently deletes it"
   defect.
3. **This was the UN-MIGRATED instance of the 2026-06-29 schedule ruling** ("line 2 = the untruncated
   name"), in the same portal, on the same opponent names, and the schedule CSS still carries that
   comment. **Confirms the 2026-07-31 Chunk C generalisation** — when a rule is written for one
   surface, grep the sibling surfaces before assuming it landed. The transferable part was the RULE,
   not the code: the schedule row is a wrapping flex chip, this is a date-tile card, so it took a
   grid.
4. **A fact stated twice on one card is stated once too often, at EVERY width.** The tile said "8 /
   JUL" and the meta line repeated "Wed, Jul 8" beside it — and the repeat is what pushed the time
   onto a second line. Meta is now `Wed · 2:00 p.m.`; the weekday earns its place because the tile
   has no room for it. Applied on desktop too: **redundancy is not a width problem**, and offering
   two strings by breakpoint would have been two truths to keep in sync.
5. **A trailing chevron on a card that is already one tap target is decoration, and it is charged to
   the name.** Its label was already hidden below 640px, so what survived was a bare glyph plus its
   gap — ~9% of the contested track carrying nothing the card's own tap behaviour doesn't. Hidden on
   phones, kept on desktop where width is free. **Rider: when a class's ONLY rule was the mobile
   hide, the class and its wrapper spans go with it** rather than surviving as `styles.X` resolving
   to `undefined`.
6. **A primary action does not compete for a shrink-proof corner.** The pane's one lime "Build
   lineup" left the name ~40px and sat under the tap floor; on phones it now spans the card on its
   own row at `var(--tap-min)`.
7. **A raw numeric `rgba()` of a semantic colour is theme-invisible.** The "Lineup set" chip's text
   was `var(--success)` (warm gate → forest `#3E7A32`) over a hard-coded cool mint
   `rgba(74, 222, 128, .12)` — warm ink on a cold ground. **⚠ The colour-token guardrail was GREEN
   before and after this fix**: it matches hex and *brand*-rgba literals, so a raw numeric `rgba()`
   of a status colour passes untracked. Handed to `/review` as a guardrail gap, not fixed here.

**Two implementation rules worth keeping.** `display: contents` on a title+meta wrapper is the clean
way to let its children take grid areas without a second nesting level (the same wrapper renders in
the apply-template picker, so both lists are fixed by one block). And the clamp uses `-webkit-`
**only**: the standard `line-clamp` needs `display: block`, and a minifier treating the pair as
aliases keeps the LAST one — the documented backdrop-filter prefix-order gotcha — which would
silently unclamp it.

**Result:** the name goes 125px → **269px** (2.15×) at 390px, and wraps rather than vanishing.

**Explicitly NOT changed:** the "p.m." time format (platform-wide via `formatInOrgZone`, changing it
here alone would fork the Schedule), the row's warm card treatment, and the desktop layout.

**⚠ Flagged, deliberately untouched, in the `/review` handoff:** this page formats dates and times
through bare `new Date(...).toLocale*()` with no zone, while the Schedule tab was migrated to the
org's zone in the Chunk C pass — the J3-047 class reaching one more surface. **The date-correctness
guardrail's green tick is a FALSE NEGATIVE here**: its two rules both match date *arithmetic*
(`toISOString().slice(0,10)`, `setHours(0,0,0,0)`), and it has no rule for display formatting at all.
**⚠ CORRECTED BY THE `/review` PASS, same day — do not repeat the original claim.** This entry first
said rule 4 "raises the stakes" because the tile became the only place the date appears. **That is
false.** The tile (`getDate()` + `toLocaleDateString({month:'short'})`) and the retired meta string
(`toLocaleDateString({weekday, month, day})`) both derived from the SAME instant in the SAME device
zone, so they were always mutually consistent — the meta duplicated a possibly-wrong value, it never
cross-checked one. **The timezone risk is exactly unchanged by this diff.** Generalises, and it is
why the claim is worth recording rather than deleting: **two renderings of one value through one
code path are not a cross-check, however differently they are formatted.** Removing a duplicate
never "unmasks" the original.

Also pre-existing and unchanged: the apply-template picker has no visible busy feedback on phones
(its "Applying…" label was already hidden at this width, and `.lineupFrontRow` carries no `:disabled`
styling at any width). What the change DID remove there is the static trailing arrow — the picker's
rows now have no trailing affordance on phones at all.

**Applies to:** the Coach Portal Lineups → Games list and the apply-template picker
(`app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx`, `app/[orgSlug]/coaches/coaches.module.css`).
Rules 1, 2, 4 and 5 are general to every list row on the platform. Owner QA pending.
[[design-principles]] [[design-system]]

---

### 2026-07-31 — A single-section page does not get a second section header; and a no-CTA teaching block is `quiet`

**Trigger (owner, on the premium Coaching staff screen):** "anything we can do about the layout of objects on this page?" Diagnosis: the screen wrapped one message in three containers — the page header, a tinted `.setupPanel` whose eyebrow + title *repeated the page header verbatim* ("Coaching staff" → "COACHING STAFF" → "Assistant coaches"), and a centred 560px `CoachEmptyState` floating inside it. Nothing shared a left edge, the intro ran ~135ch, and the same promise ("nothing sensitive until you grant it") appeared twice, 400px apart.

**Decisions (owner-approved via mockups, binding):**

1. **When a page renders exactly ONE section, the page header IS the section header.** The section drops its own eyebrow/title/decorative icon. `.setupPanel`'s header exists for screens that stack SEVERAL sections (Settings, Season-end) and must not be used to frame a lone section — a border around the whole viewport has no contrast partner, and the repeated title is the first thing the eye has to discard. Generalises to any coach/admin page whose body is a single panel.
2. **A no-CTA teaching block uses the `quiet` empty-state variant** — flat, left-aligned, full-width, neutral medallion, no lime wash. This EXTENDS `COACH_SURFACE_DESIGN_ADDENDUM §iii`, which previously reserved `quiet` for empties the coach *cannot act on*. New rule: **the trigger is the absence of a CTA on the block, not the absence of an action on the page.** Where the action lives directly above (as here — the invite form), a glowing centred illustration competes with the control it's explaining. Action empties that carry their own CTA keep the full/compact glow.
3. **A decorative icon may not sit in a section header.** The retired `ShieldCheck` read as a *status* ("secure", "verified") while carrying no information, ~1000px from the heading it belonged to.
4. **Standing reference beats a first-run message.** The access primer (what an assistant gets by default, what stays off) was an empty state, so it disappeared the instant the first invite landed — exactly when a head coach starts granting. It is now a persistent right rail. Its "off until you turn it on" list is DERIVED from the same constants that build the grant grid, so the rail can never claim something different from the controls beside it. ≤1023px the rail moves last (below the staff), because with assistants present the people are what the coach came for, and on an empty team the list row is only the short teaching block.
5. **Fixed grid, not auto-fill, for a capability grid.** `repeat(auto-fill, minmax(200px, 1fr))` re-flowed the same team's ten access controls differently at every width; a fixed 2-column grid (1-col ≤560px) keeps a coach's spatial memory of where a toggle lives.
6. **This screen drops `--home-olive-soft`** for a plain `--home-card` + hairline, consistent with the 2026-07-30 ink/lime ruling (a lime CTA on an olive ground never separates from its own hue). Scoped to Staff only — Settings and Season-end still use the tinted panel; sweeping them is a separate call.

**Fixed en route (real defects, not restyling):** the segmented "on" state used a raw `var(--logic-lime)` **fill**, which the coach warm gate remaps to olive — the exact E3 violation the 2026-07-27 `--logic-lime-fixed` decision exists to prevent; it now carries the `--home-lime` warm override that `.btnPrimary` already had. The invite field was placeholder-only (no label). Off-scale radii (8px/10px literals) moved onto `--radius`/`--radius-sm`.

**Also:** the panel's ~40 inline style objects moved into `components/coaches/CoachStaffPanel.module.css`. Every save, confirm-on-grant, optimistic-update and capability behaviour is byte-identical — this was a layout change only.

**Known, NOT fixed (pre-existing, portal-wide):** an open `CoachFormDisclosure` renders `.formSection` on `--home-olive-soft`, so a lime-filled segment inside the Sensitive group still sits on an olive inset. Unchanged from before this pass; belongs to a portal-wide sweep, not one screen.

**Applies to:** `components/coaches/CoachStaffPanel.tsx` + new `.module.css`. Mockups: `claude.ai/code/artifact/e0090415-0fa6-4b36-97bb-37f84a67e7ee`. Owner QA pending. [[design-system]] [[design-principles]]

**/review pass, same day — 1 Critical + 2 High + 5 Medium confirmed and fixed. The headline is a rule, not a bug:**

**BINDING — a UI that states a security posture must READ that posture, never re-describe it.** The rail's "off until you turn it on" list was derived from `SENSITIVE_*` group membership. **Sensitive and off-by-default are different questions.** `documents` is sensitive but ships `'view'` (locked owner decision 2026-06-25), and `coach-nav-visibility` opens the Documents door at `!== 'off'` — so the rail told head coaches that waivers and team files were locked while every new assistant could already read them. Both lists now derive from `ASSISTANT_DEFAULTS` itself, so a default change moves the rail with it. The finder's alternative fix (flip the default to `'off'`) was **rejected** — that silently reverses an owner ruling; a UI lying about a decision is a UI bug, not a reason to change the decision. Same pass killed the empty state's "sees only the areas you switch on for them", which was false for the same reason and contradicted the corrected rail beside it.

⚠ **Surfaced for the owner, not changed:** new assistants can view Documents (waivers) by default. That is the June ruling working as designed — but this screen now says so out loud for the first time, and the sensitive-group note still promises "you'll be asked to confirm before granting these" when only money / contacts / announcements actually prompt (Documents and Tryouts do not). Pre-existing copy; worth a ruling.

**Accessibility — the rewrite's own regressions, fixed:** retiring the visible `<h2>` also deleted it from the OUTLINE (h1 → h3/h4, loose headings tied to nothing) → restored as a `.srOnly` `<h2>`; **the design rule is about the visible header, never the document outline.** The new rail's lists were `div`/`span` with `aria-hidden` check/lock glyphs, so on-vs-off reached assistive tech only as reading order → real `<ul>`/`<li>` under real headings. Hardcoded element ids → `useId()`.

**Pre-existing, fixed because this pass touched the markup:** the segmented access controls had **no accessible name at all** — a screen-reader user heard "Hidden, pressed" with no idea whether it governed Roster or Team money (`role="group"` + `aria-labelledby`), and their focus ring was clipped by the group's own `overflow: hidden` (`outline-offset: -2px` draws it inside). "Saving…"/"Saved" — the only confirmation a money/PII grant landed — was never announced (persistent `role="status"` region).

**Deliberately NOT done:** a full `radiogroup` pattern for the tri-state segments (`aria-pressed` is the wrong state for a 1-of-N choice, but half a radiogroup — roles without roving tabindex and arrow keys — is worse than a named group; logged as follow-up). Raising the 1023px rail breakpoint: at 1024px the working column computes to ≈428px, tight but nothing overflows, and moving an approved breakpoint is an owner call. `.quiet` still caps `.description`/`.payoff` at 42ch inside a full-width block — pre-existing and shared with two other live call sites, including this same route's non-head-coach branch.

**Refuted:** "the visible section heading was dropped by accident" (it is the approved decision; the page `<h1>` carries it), "the five retired shared classes are orphaned" (Settings + Season-end still use all five), "collapsed sensitive controls stay focusable" (`.discHidden` is `display: none`).

---

### 2026-07-31 — Navigation controls are named by their DESTINATION, and a screen has ONE operator door, in the nav

**Decisions (owner, binding):**

1. **No "Back to …" wording anywhere in navigation.** A control is labelled by where it GOES — **"Public site" / "Admin" / "Coaches Portal" / "Scorekeeper"** — never by where you came from. The link is no less intelligent: return-memory still lands you on the exact page you left, query string included; it just stops narrating the trip. Retired: "⇄ Back to Dashboard" (return-memory), "Back to Site" (admin sidebar), "Back to admin" (both coach navs). The label is derived from the destination URL at READ time, deliberately not from the stored label, so a snapshot written by an earlier build cannot surface the old vocabulary during its 20-minute freshness window. `flipOriginLabel` (screen names) → `flipSurfaceLabel` (surface names).
2. **ONE operator door per screen; on the public side it lives in the platform strip.** A public event page previously showed two on desktop — the strip’s global pill AND the event header’s Flip. The strip’s single slot now fills in precedence order: **the Flip** (page-matched, event-scoped, multi-hat "Roles" popover) → **the global operator pill** (an operator who is a plain fan of THIS event) → **the "Run a tournament" menu** (fans/anonymous). This also stops an operator being shown an acquisition CTA on an event they run.
3. **Amends the 2026-07-25 "Flip is always header-right at every width in both families" rule — public tournament page only.** ≥901px the door is in the strip; ≤900px it stays in the branded event header (the strip is hidden there). Every other surface is unchanged. Rationale: within the CONSUMER family the operator door is now always in the nav bar; within the OPERATOR family it stays in the shell header. Each family is internally consistent, which is what the two-family ruling is for.

**/design pass, same day — the moved control gets a `strip` variant.** Reviewed against its new neighbours (`.utilLink`/`.utilCta`/`.utilCoach`/`.stripIcon`): (a) that row is all-caps mono and the pill rendered sentence-case, which reads as a bug — **BINDING: the FlipPill follows ITS ROW’s typography** (event headers keep sentence case beside a sentence-case event name; the strip gets uppercase). Identity is carried by the pill shape, the ⇄ glyph and the popover, none of which change. Narrowly amends the 2026-07-23 "renders identically on every surface" note, for this container only. (b) Sizing matched to the sibling pills — it was the smallest thing in a row where it is the most important. **Kept deliberately:** neutral tokens (`--border-2`, not the org-tinted `--border` its siblings use) per the 2026-07-23 "never the event brand" ruling, and the 5% fill — slightly heavier for the one actionable door among icons is honest hierarchy.

**⚠ THE REVIEW CATCH WORTH GENERALISING (HIGH, confirmed).** The first cut had the strip run its OWN readiness probe beside the hook that resolves the door — two independently-gated async chains that merely shared a cache key. The strip’s gate read route params (available first render); the flip’s read `OrgNavContext.tournamentSlug`, which `TournamentNavSync` sets an effect LATER. On a warm cache — the admin→public flip, i.e. the commonest operator trip — the probe finished FIRST, cleared the placeholder while the resolution was still null, and reproduced the exact CTA flash the placeholder existed to prevent. **Generalises: never derive a "still loading?" flag from a second call to the same data — expose it from the hook that owns the resolution.** Fixed by `usePublicFlip` returning `{resolution, resolving}`; it now also keys off ROUTE params rather than context, and holds until `tournamentId` is known whenever an admin hat is present (that id is what makes the admin href land on THIS event — a latent wrong-destination bug the same fix closes). Second confirmed defect: the pending placeholder hardcoded `inner('Public site')`, so the strip — which resolves to Admin/Coaches Portal/Roles — reserved the wrong width and jumped on arrival; it is now sized from the passed resolution, including the chooser’s caret.

**Observation, pre-existing, not a regression:** the strip is root-mounted OUTSIDE the wrapper carrying `data-color-mode`, so it stays dark-tokened even on a light-mode branded event. Applies to every item in that row equally.

**Applies to:** `lib/flip-twins.ts` (+ tests), `lib/use-public-flip.ts`, `components/shared/FlipPill.{tsx,module.css}`, `components/public/TournamentFlipPill.{tsx,module.css}`, `components/consumer/ConsumerNav.tsx`, `components/admin/AdminSidebar.tsx`, `components/coaches/Coaches{Sidebar,BottomNav}.tsx`. Help guides re-synced (`lib/help-content/{org,coaches}.tsx`). Owner QA pending. [[design-principles]] [[design-system]]

---

### 2026-07-31 — Coach Portal Chunk C: a stored time is an INSTANT and a displayed time is that instant in the ORG'S zone; a recurring series and an imported file are the same thing (proposals reviewed before commit); a blank cell means "not in this sheet", never "clear it" (mockups `claude.ai/code/artifact/81a33e54-42db-4fbb-bd73-c9007b4ab06b` rev 4 = binding; D-C1–D-C12 ratified "looks good, go ahead")

**Decision (owner ratified all twelve, incl. three raised BY the owner mid-review):** seven binding rules from the schedule-intelligence chunk.

1. **A stored event time is an INSTANT; a displayed one is that instant in the ORG'S timezone — never the reader's.** `rep_team_events.starts_at` is `timestamptz`, but every coach-side writer handed Postgres a NAIVE literal, which it resolved in the UTC session zone: a coach typed 6:00 PM, it stored 18:00Z, and the portal showed them **2:00 PM**. Because the edit form converted UTC→local before the next naive write, **every re-save shifted it again**. The Batch 4 mirror wrote naive too, so organizer-owned games were shifted as well — the coach's calendar disagreeing with the tournament they're playing in, the exact thing Batch 4 rule 2 exists to prevent. This is the **J3-047 bug class** reaching one more surface; `lib/timezone.ts`'s own header documented it and House League already converted correctly. **Generalises: when a module's header names a bug class, grep for un-migrated instances of it before assuming the class is closed.** The fix is a chokepoint (`wallClockStringToUtc`) at the DB writers + the mirror's assembly seam, idempotent-safe by passing through anything that already names a zone. Existing rows corrected by a **reviewed dry-run script**, not a migration: the population is not "every row" (seeds converted correctly), so it needs judgement about live data — a script refuses any correction that would land outside 06:00–21:00 local, which is the signature of a row that was already right. Dev: 17 corrected, 8 correctly refused.
2. **A recurring series and an imported file are the SAME THING — a set of proposed events reviewed before any exist.** "Repeat weekly" took ONE opponent and stamped it onto every game, making a 12-game round robin *more* work through the feature than without it (≈130 taps vs ≈120). The fix was not a twelfth opponent field: it was showing the occurrences as rows. **Generalises: when a feature is "more clicks than not using it", the missing thing is usually the preview, not the field.** Both previews carry a verdict per row and commit nothing until asked; the button names the real count (a removed bye week means eleven, not twelve). ONE pure generator is called by both the client preview and the commit route, which regenerates and **refuses a date it cannot produce** — never silently drops or writes an unreviewed one.
3. **⚠ On a bulk UPDATE, a blank cell means "not in this sheet", never "clear it".** Caught by this chunk's own review: the import commit wrote `null` for every absent column, so a league sheet of dates+times would have silently wiped location, address, arrival, field and uniform on every matched game — on a screen that promised only *"time changes from 2:00 PM to 6:00 PM"*. A blank time cell likewise resolved `startsAt` to midnight. **Generalises to every importer: an update sets only what the source actually carries, and "nothing changed" is an honest outcome, not a failure.**
4. **Reordering LEAVES a horizontally-scrolling grid rather than fighting it (D-C10, owner-raised).** Drag was built and works on desktop; it is off on touch because a drag and a sideways swipe are indistinguishable at gesture start, and the substitute was an **18px** arrow pair against a 44px floor. The first answer — a row menu — cleared the size standard but made a repetitive job worse (9th→2nd is seven moves; seven menu round-trips is worse than seven taps). **The right fix removed the conflict instead: a plain vertical list has no competing gesture**, so press-and-hold drag simply works. The grid then carries no reorder controls at all, its pinned column narrows, and a 360px screen shows **one more inning**. **Generalises: when an affordance is disabled because two gestures collide, move the affordance to a surface where they don't — don't shrink it.**
5. **With three views, "Lineup" cannot be one of their names (D-C11, owner-raised).** All three ARE the lineup. Tabs became **`Batting order · Positions · Playing time`** — each naming the question it answers — and the page keeps the name. Left-to-right is the real order of work (and the order auto-fill consumes); the page still OPENS on Positions, today's surface. **The order label is sourced from the Sport Pack** (`orderLabel`, new): this surface carries documented §1.7 diamond debt and a hard-coded "Batting order" would have been a NEW instance of it. **Generalises: adding a sibling to a named thing renames the sibling that was carrying the parent's name.**
6. **A silent no-op is the failure a new affordance exposes (D-C12).** Specifying the owner's "the order must persist across tabs" requirement surfaced that batting numbers are handed only to rows flagged `starter` — so in 9-player ball a drag from the bench did **nothing visible**. Shipping the drag over that would have been the same "worse than not using it" defect. The order view now renders the batting nine above a cut line with the bench below, and crossing it promotes (the ninth steps down). Riders, all asserted: the three views are windows onto ONE row list (tab switching is never a save, discard or prompt); **a player's positions travel with the PLAYER, never with the batting slot**; and no playing-time figure may move as a result of a reorder.
7. **Arm care claims ONLY what the coach's own settings and saved lineups prove (D-C7).** Every cap in this product is **per game** — there is no season innings ceiling — so the warning states their own cap and days since their last outing, and **stays silent when no cap exists anywhere**. Inventing a threshold would be the D-G1 error where the cost is a child's arm. Warn-only, coach-addressed, never a verdict, period noun from the Sport Pack. Its own review caught that skipping same-day outings made it **silent on a double-header** — the single case it exists for.

**Two layout defects caught at owner QA, both worth generalising:**
- **A pinned column's OFFSET and the preceding column's WIDTH must have one owner.** Narrowing the lineup grid's Bat column left the player column parked at its old offset — passed in from the component as a hard-coded rem value computed from the *old* width — so it rendered on top of two innings. Every sticky `left` is now derived from width tokens declared once on the table, and the component passes only the MODE. **The probes passed the whole time**: they measured control *sizes*, not whether columns *collided*, so a geometry assertion (columns abut, nothing renders underneath the pinned column) is now permanent. **Generalises: when a probe measures a control, it is not measuring the layout.**
- **`position: sticky` on an element whose containing block ends where it does is not sticky at all — it is a footer.** The lineup builder's Undo / Redo / Print bar was marked sticky and read as sticky in review, but its container ends at exactly its own bottom edge, so it had ZERO travel. Measured at four scroll depths on a 12 × 7 grid: **completely invisible until the page was scrolled to the very bottom of ~1700px** — putting Undo out of reach on the portal's most tap-heavy screen, at the moment a coach needs it after a mis-tap. Now DOCKED above the bottom nav on phones (fixed, `bottom: var(--bottom-nav-height)`, under the nav's z-index so the nav always wins a tap), its icons raised to the 44px floor, and the grid padded to scroll clear. Asserted permanently: same position at every scroll depth, nothing covering Undo, last row clear of the bar. The schedule slide-over keeps the un-docked base class — inside its own scrolling panel, sticky genuinely works. **Generalises: a sticky element needs a containing block TALLER than itself, and "it's marked sticky" is not evidence that it sticks — scroll it and look.**
- **Reserving for a fixed nav TWICE leaves a band of dead space on every page** (owner-reported, pre-existing since the portal's founding commit, folded in at the owner's call). The coaches shell nests its own `<main>` inside the app layout's `<main>`, and **both** reserved for the 72px fixed bottom nav — the outer via `main { padding-bottom: var(--bottom-nav-height) }` in globals (correct), the inner via a further 6rem on top. Measured at 361px: 102px of dead space under Roster, 74px under the lineup builder. **The value is now set by arithmetic, not taste**, because the portal's one page-level sticky footer (`.attendanceFooter`) carries `margin-bottom: -1.5rem` and pulls itself 24px up out of that padding: *gap under the lineup's action bar = padding − 24px; gap under an ordinary page = padding.* At 2rem that is 8px and 32px. Swept across nine pages, nothing negative; the tightest page is asserted permanently. **Two generalisations: before adding a spacer for fixed chrome, check whether a shared rule already reserves it — and when a nested container duplicates an ancestor's reservation, the inner one is breathing room, not chrome clearance.**

**Also shipped under existing rules:** the event modal's discard guard moved off hand-rolled plumbing and the banned "unsaved changes" copy onto `useDiscardGuard`/`snapshotEqual` with stake-naming detail ("11 league games, 9 opponents, 1 removed date"); the **36 vs 44 touch-target disagreement settled onto one token** (the attendance controls said 36 and called it "the floor" while `--tap-min` governed everywhere else — two standards in one screen family is why two reviewers found the lineup grid independently); the event-type vocabulary extracted to `lib/coach-schedule-vocab.ts` so the export, the importer and the recurrence writer share one copy (H2 rule 4); a practice on a tournament day is no longer mis-flagged as the organizer's game.

**Applies to:** `lib/{timezone,coach-recurrence,coach-schedule-import,coach-schedule-vocab,coach-arm-care}.ts`, `lib/db.ts` (event writers), `lib/basic-coach-teams.ts` (mirror assembly), `lib/sports.ts` (`orderLabel`), `lib/team-season-analytics.ts`, `lib/coach-tournament-games.ts`, `components/coaches/ScheduleImportSheet.{tsx,module.css}` (new), the events POST + the new import preview/commit routes, the coach schedule page, the team Overview anchor, `_LineupEditor.tsx`, `coaches.module.css`, `lib/help-content/coaches.tsx`, `scripts/fix-coach-event-times.mjs` (new), `tests/unit/coach-schedule-intelligence.test.ts` + `tests/uat/scenarios/coach-schedule-smoke.spec.ts` (new). **NO migration.** [[design-system]] [[design-principles]]

---

### 2026-07-30 — Coach Portal Chunk E: family emails are OPT-IN per decision write; a coach scores through the SAME scorer as a volunteer, never a second one; a lost link is re-keyed on the SAME identity (mockups `claude.ai/code/artifact/82b6eac7-89b0-4c28-9d75-777e54e7f86d` rev 2 = binding; D-E1–D-E8 ratified at the recommendations + D-E9 owner-directed, 2026-07-30)

**Decision (owner ratified all eight + directed D-E9 "can they turn the emails off (default off)"):** seven binding rules from the tryouts tidy-up.

1. **Outward-facing side effects are OPT-IN and ride the individual write, never a stored mode.** Decision emails default OFF; the "Email families my decisions" switch is device-remembered PRESENTATION, but the server only ever emails when the decision request itself carries the flag — so the failure direction is always "no email", never an unwanted one. The switch sits directly above the buttons it governs (what a tap does is visible at the moment of decision). **The shared side-effects helper takes the flag as REQUIRED** — a defaulted direction would be a trap for the next caller. Durable cleanup (killing a stale offer link on any non-offered transition) always runs, whatever the flag says. Rider: **response badges render only for offers actually EMAILED** — a record-only offer has nothing to await, and the client mirrors the server's link-truth on every transition so badges can't go stale mid-session. **AMENDED same day (owner-directed): the ADMIN applicant surface now follows the SAME opt-in rule** — its own switch (default OFF, same device key as the coach board so one device + one team gives one answer on both doors), decline-with-email confirms first, toasts state whether a family was actually emailed, and the welcome-on-accept follows the switch. The earlier "admin always notifies" scope line is retired; D-E9 now covers every surface that decides.
2. **One scorer, two doors.** The coach's "Score players" door and the volunteer token link render the SAME extracted surface against the same shared context/write contract — a second scorer was the forbidden shape. The surface is **fixed-dark by design** (identical under the public root and the warm coach shell — the Season Wrapped token-exempt posture), because its tokens would otherwise resolve differently per shell.
3. **A deterministic prefixed key gives a tokenless identity WITHOUT a migration.** The coach's self-scoring session is a normal evaluator-session row keyed `token_hash = 'self:' + sha256(tryoutId:userId)` — same row every visit, every device. Safe with no secret: the public route hashes the PRESENTED 43-char token (always 64 plain hex), so a `self:`-prefixed value is unreachable from any URL by construction. The prefix is a shared constant with the link-vs-self split applied at the DB-query level (`getRepTryoutEvaluatorLinkSessions`), so a future surface can't forget the filter. **The coach's own scores count like anyone's — same mean, same runs-hot flag — labelled "(you)"** (D-E2: no second scoring model).
4. **A lost/expired link is re-keyed on the SAME row, never re-minted as a new identity** — a second "evaluator" for one person double-counts their opinion in the per-category means (verified). Reissue clears revocation; **reissuing a deliberately revoked link confirms first** (silent reactivation from a "new link" icon is a lie of omission). Every credential states its lifetime where its holder can see it, and a mid-session lockout is a full-screen explanation, never taps that silently stop counting.
5. **A decision surface names who it CANNOT reach and who was never there.** "No email on file — notify by phone" on walk-ups; "didn't check in" distinct from "not scored yet" on the board AND scoreboard (a family emergency must not read as a low score); the family's registration note surfaced where the coach decides — blind-SAFE (family-authored context renders only after names are revealed).
6. **The guard lock engages BEFORE any awaited dialog.** `decide()` sets its re-entrancy lock before `await confirm(...)` — the shared ConfirmProvider holds a single resolver, so a second action slipping in while a dialog is open would orphan the first's promise forever. Generalises: in a component whose confirm gate precedes its busy flag, swap them.
7. **Rubric save may drop only a row that is genuinely EMPTY** — no label AND no key AND no instructions AND default weight. An existing category's `key` counts as substance (evaluators may have scored it; dropping it severs those scores), so blanking a label blocks save with the row named. And **the client gate for a page family lives in ONE hook** (`useTryoutAccess`): fail open only WHILE assignments resolve; once loaded, no assignment = no access (the old inline `? … : true` failed open permanently — WI-11's actual defect).

**Also shipped under existing rules:** discard guards on all five tryout forms (Chunk A D4 contract; `snapshotEqual` joined `touched()` as the ONE structured-baseline idiom); depth chart = `.pageWide` via the Schedule's view-conditional shape + `CoachScrollX` with a new `scrollerClassName` prop (callers must never reach into its structure by position); the Development doors now ask two different questions ("coverage" appears on exactly one); "History linked" → "Returning player" (a column must answer its report's own question); the offer email's respond-by date formats in the org timezone; rollover warns (never blocks) on a tryout still awaiting outcomes, gated on the team's own tryout signal. **Practice-plans card KEPT (D-E4)** — discovery found it honest, demoted, unclickable; not a dead-tab violation.

**Applies to:** `lib/tryout-score-session.ts` + `components/rep-teams/TryoutScorerSurface.{tsx,module.css}` (new), the tryout-self-score route (new), the reissue POST, `lib/tryout-notifications.ts`, `lib/tryout-evaluator-token.ts`, all six tryout cards, the tryouts hub + check-in + score pages, `components/coaches/{useTryoutAccess.ts,useDiscardGuard.ts,CoachScrollX.tsx,DepthChartBoard.*,StartNextSeasonModal.tsx,TestTypesManager.tsx}`, the decisions/accept/scoreboard/evaluators/rubric/overview routes, the roster page's depth view, `history/{awards,development}` pages, `lib/help-content/coaches.tsx`, `tests/uat/scenarios/coach-tryouts-smoke.spec.ts` (new, 10 probes). NO migration. [[design-system]] [[design-principles]]

---

### 2026-07-30 — The FREE coach Overview does NOT get a one-thing resolver — it had a REDUNDANCY defect, not a contradiction. A surface may state a fact ONCE; a page must never duplicate a tab it links to. (DF-1…DF-7 ratified "take all seven"; mockups `claude.ai/code/artifact/8efbb388-a58c-40b9-8377-62b36f140bde`; shipped `a0f56d34`)

**Decision (question closed — do not re-open when the tiers are compared).** The Chunk I handoff asked
whether the free coach Overview needs its own "one thing" pass. **It does not.** All seven of its
conditional blocks were walked: no pair can issue conflicting instructions, and "one prose card per
surface" already holds (the setup card and the roster invite are mutually exclusive by construction).
**Premium's defect is genuinely absent, so no ordered anchor resolver, and `lib/coach-overview.ts` is
NOT to be generalised** — it reasons about assistant-coach capabilities the free tier does not have,
and a shared module only one caller's inputs make sense for is worse than two honest ones.

The free page had a *different* defect, and the distinction is the reusable part:

> **Premium said two things at once. Free said ONE THING FOUR TIMES** — the same tournament as a list
> row, again as an event card built from the same array, again as a tile value, again in the sticky
> header — **and ranked the team's own numbers below all four repetitions.**

Five rules generalise out of the fix:
1. **A page must not duplicate a tab it links to.** The free Overview's lead section was a verbatim
   copy of the Tournaments tab (same component, same source, same order), which is permanently one tap
   away. An overview names the ONE item that matters and links out for the rest.
2. **"Which item is current" is decided by LIFECYCLE, never by insert/registration order.** Applies to
   both tiers. Publication status (`active`) is not a lifecycle claim.
3. **…and never by lifecycle alone where STANDING exists.** Anything the user is still in outranks
   anything they were turned away from; a rejection is featured only when it is the only entry.
4. **When one surface's ordering rule changes, every other consumer of the same array changes with
   it.** Half-applying it is its own defect: the tile and the card named two different tournaments as
   current, on one screen — the exact contradiction the pass existed to remove.
5. **An empty tile states what the tool would give, never "0"** — but only when it is genuinely empty.
   A real figure, or money owed to a third party, always outranks the "Not on" face.

**Also binding from this pass:** a phone is not the width that gets the *sparsest* grid (the free strip
was 1-up on phone and 2-up from 701px — inverted); a new affordance must not be placed inside a
line-clamped container (a hard cut with no ellipsis silently deletes it); a separator's job needs no
link; and under the warm default the whole `--white-35…65` band collapses onto ONE token, so
`--white-70` is the first tier that is actually darker — check contrast against the resolved warm
value, not the dark one.

**Rationale:** verified by reading the page rather than trusting the handoff, and **measured in
Chromium at 390×844 / 360×740** rather than eyeballed: the duplicated tournament filled 44% of the
first screenful (53% at 360px), and a brand-new team's setup card sat 82–186px below the fold under
474px of zeros — premium's finding #3 with the tiers swapped. After: page 1600→1302px, "At a glance"
y672→y521, four of five tiles on the first screen instead of one clipped one, setup card at y340.

**Explicitly NOT changed, and not re-litigated by a layout pass:** the pressure ladder and the Premium
shelf on the Overview (an enumerated permitted ask surface), "tournaments lead the free Overview"
(owner call, A3 QA 2026-07-27), the two-family companion voice, and the free sections' existing
empty-state copy.

**Applies to:** the free coach team Overview and its Tournaments tab; rules 2–4 reach the premium
Overview's tail through the shared picker. Full record + owner QA matrix:
`docs/projects/active/FREE_COACH_OVERVIEW_COHERENCE_PLAN.md`.

---

### 2026-07-30 — Coach Portal Chunk I: the Overview may show exactly ONE prose card, chosen by an ORDERED rule; a more specific state REPLACES the general state it is a superset of and inherits its door; CTAs gate on "can complete", never "can see" (mockups `claude.ai/code/artifact/5ae1c9e4-c31e-4f83-a098-3fbaa0ae15cd` rev 3 = binding; owner picked Option C and ratified D1–D15, 2026-07-30 — "looks good, go ahead")

**Decision (owner-reported defect → owner-approved direction):** the premium team Overview rendered NINE independent bands, each testing its own predicate, in source order, with no priority between them. Two of them shipped opposite instructions off the SAME state: the in-season lull card (`in_season && !nextEvent` → "Add an event") and the winding-down cue (that predicate PLUS four more facts → "Close out the season"). The cue's predicate is a **strict superset**, so whenever it can render the lull card is already wrong — and both drew. Every other symptom the owner reported (full-width tournament strip vs. small tiles, the record floating at `width: fit-content`, "at a glance" pushed below the fold, "Add an event" said three times) is downstream of the same missing priority model. Eight binding rules:

1. **ONE anchor slot, resolved by an ORDERED rule — not by each card testing its own condition.** game day → next event → season check → in-season lull → pre-season next step; first match wins, the rest do not render. **Generalises: when one state's predicate is a superset of another's, the specific one REPLACES the general one — never stacks on it.** This is the actual defect; the layout complaints are symptoms.
2. **A state that replaces another INHERITS the replaced card's door.** The season check carries "Add an event instead" as a secondary answer, so suppressing the lull card costs the coach nothing. Suppression without inheritance is how a resolver silently removes a door.
3. **The one thing has THREE shapes, one slot:** *question* (a decision only this coach can make), *working card* (a job due now — game day carries opponent/time/attendance/lineup readiness + Build lineup), *next step* (season not started). The desktop artifact's "always a question" framing was **corrected at the mobile pass** — it would have regressed game day, the portal's highest-value moment, into a prompt.
4. **State proposes, capability DISPOSES.** A card may only be the one thing if this coach can *complete* its action; otherwise the resolver yields to the next candidate, or the card keeps its sentence and drops its button (the shipped season-cue behaviour for non-closers). Never a disabled control, never an action that 403s. **CTAs gate on `lib/coach-capabilities` ("can complete"), never on `lib/coach-nav-visibility` ("can see")** — that seam already exists and its header records the exact defect it was created for (setup steps sending assistants to a read-only roster). With ONE action on the page that class of defect goes from cosmetic to fatal. Game day steps down Build lineup → Take attendance → informational and never yields (opponent/time/place matter to every coach on staff). Rider: **a board-only Overview is a VALID state** — when nothing is actionable, no card renders.
5. **The board is a FIXED set of six tiles in a VARIABLE order** — never a variable set — so the coach keeps spatial memory across states. **The anchor's subject drops out of the tile row** (a schedule-shaped anchor suppresses the Schedule tile), killing the say-it-three-times repetition. Slots 5–6 are a **season-health pair resolved once by capability**: money access → Dues + Budget; no money access → **Attendance + Playing time** (fallback Playing time → Development → a five-tile board). Rationale: dues/budget answer the head coach's two questions (*who owes me* / *am I overspending*); attendance/playing-time answer the assistant's (*is my squad showing up* / *is everyone getting a fair share*) — same altitude, and both feeds already exist and are already gated correctly. Resolved once per coach, never a ranked list that reshuffles week to week.
6. **Width encodes importance.** Full width is reserved for the anchor and the board. The record widget drops `width: fit-content` (it floated at half width with dead space beside it while a name + date range took the full 960px) and becomes tile 1; the tournament stops being a full-width band.
7. **No state is never a state.** `CoachLiveEventCard` draws a Live/Upcoming chip and NOTHING once the event ends — so a finished tournament occupied a live tournament's slot silently. It gains a **Finished** chip and moves to the tail. **Generalises: the absence of a chip must never be how a surface says "over".**
8. **An un-set tile is MUTED, not dashed** (Chunk G rule 3 — the portal has exactly ONE dashed frame, the Money sample), and says what it would give the coach; six tiles reading "not set" would tell a first-week coach the product is broken. **Everything that isn't today's work is ONE tail** — finished tournament, last season, this week, announcements nudge, acquisition banner — a tappable list on mobile, a single ruled line on desktop. **Mobile action shape is fixed: one full-width 44px primary + a single row of text answers**, never a stack of buttons (a stack costs ~140px and pushes the board under the fold).

**D16 (owner ruling at the recommendations, 2026-07-30) — the money pair COLLAPSES while it is wholly empty.** A coach with money access but **neither** dues nor a budget set up gets **one** "Set up your team's money" tile in slot 5 and **Attendance** in slot 6; the Dues + Budget pair returns the moment either exists. Two muted tiles side by side spent a third of a phone screen saying "not set" and read as a broken product to the exact coach least able to judge. This is a **documented single exception** to rule 5's fixed-set rule and it is deliberately keyed on *"has this team started using money at all"* — a once-per-season transition, not week-to-week data — so the board still cannot reshuffle underneath a coach mid-season. **Generalises: a fixed-set rule may take an exception keyed on a lifecycle transition, never on a fluctuating value.** Also ruled: head coaches do **not** gain a seventh tile (they reach attendance/playing-time from Insights), and the season-record scope chips move to the record page (a configuration control is not a glanceable fact).

**Consequence worth budgeting for:** two coaches on one team on one morning can now CORRECTLY see different anchors, so the Overview needs a six-persona permission matrix at QA (head, default assistant, money-read, money-off, no-lineups, no-schedule) rather than the single happy-path check a page of many actions could survive on.

**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (resolver + board + tail), `components/coaches/CoachLiveEventCard.tsx` (finished state — benefits the free tier too), `SeasonRecordWidget` (retires from the Overview into tile 1; its League/Tournament/Scrimmage scope chips move to the record page), `coaches.module.css` (`.wltWidget` fit-content, `.snapshot*`, the retired `.setupLine`/`.seasonCue`/`.nowCard` bands). Feeds: the existing attendance + lineup-analytics routes. **NO migration.** Free portal overview OUT of scope this chunk (the two-family ruling stands). Plan: `docs/projects/active/COACH_PORTAL_CHUNK_I_ONE_THING_PLAN.md` + `_PM_BRIEF.md`. Options A (one anchor + reordered bands) and B (desktop status rail) are recorded in `claude.ai/code/artifact/bc2f7f45-406d-4fec-b963-cd62801064dc` and are **NOT to be built**. [[design-system]] [[design-principles]]

---

### 2026-07-30 — The consumer primary CTA is the INK chip; lime is now RESERVED for conversion (owner ruling on mockups `claude.ai/code/artifact/387ba6a1-6e93-415f-b486-b1e8817e4a59`)

**Trigger (owner, looking at Scores in light mode): "I don't like the olive button."** Diagnosis found two causes and only one was the colour: (1) the button sat **on an olive-tinted panel** (`--home-olive-soft`) — its own hue, 5.8:1 apart — so it never separated from its own ground; (2) the treatment had **split from Account**, which uses the lime chip. Third fact worth keeping: under an explicit Dark preference `--home-olive` resolves to `--primary-light` (true lime), so **olive-fill and lime-fill are the same button in dark mode** — this was only ever a warm-LIGHT question.

**BINDING — three roles, no overlap:**
1. **Ink chip** (`--home-ink` fill / `--home-paper` text) — the main action on a screen the user is already using (browse, claim, apply). This is the emphasis device the warm screens ALREADY use for the active filter pill, so it introduces no new vocabulary. Flips to a white chip under Dark. Measured 15.1:1 light / 19.8:1 dark, and 16.5:1 against its panel.
2. **Lime chip** (`--home-lime` fill / `--home-lime-ink` text) — **reserved** for the moments that grow the business: create an account, upgrade, start a tournament, chat Send. Identical in both themes (14.2:1). Account's "Create free account" is deliberately UNCHANGED.
3. **Olive** — unchanged where it always belonged: links, active tabs, the followed star.

The point is not that ink looks better than olive — it is that **two primary treatments must mean different things or they are drift**. After this ruling the difference carries information, so both survive.

**Also decided:** the Scores nudge and Following claim panels lose their `--home-olive-soft` tint for a plain `--home-card` white card + hairline. The tint is what made *any* green CTA read muddy; those panels are noticed on border + copy alone. **Generalises: never put a filled CTA on a panel tinted with the CTA's own hue.**

**Rejected — a new deep-forest green.** It looked good and cleared contrast, but a dark green cannot flip with the theme, so it needed a **second permanent non-flipping ink token** purely to keep one button's label legible under Dark. Real permanent weight for a hue used nowhere else in the system.

**Applies to:** `ScoresClient.module.css` (`.nudge`, `.nudgePrimary`), `FollowingList.module.css` (`.claim`, `.btnPrimary`, `.emptyCta`). Hover moved off `filter: brightness()` — invisible on a near-black fill — to `--home-ink-soft`. Contrast + panel separation verified live in both themes; all six colour-token baselines still ZERO.

### 2026-07-30 — Coach Portal Chunk H2 (import): a preview with a VERDICT per row, templates that carry structure and never a figure, and a reader that re-reads our own export
**Decision (built directly against the approved chunk-H mockups, frame 6 — owner ratified D-H8 "all three templates" + the view/import split):** five binding rules for any future importer in this product.

1. **A template ships STRUCTURE, never amounts (D-G1 extended to files).** The downloadable templates carry column headings plus category/line NAMES drawn from the coach's own taxonomy — every amount cell is blank. An example dollar in a downloadable file is a dollar the product proposed. A probe downloads each template and asserts **no cell anywhere contains a digit**; the unit pack asserts the same at the generator.
2. **Preview-first means a VERDICT per row, editable in place.** Every row reads as Adds / Updates (naming the matched record and its old figure) / Can't import (with the reason in the coach's words). The preview re-reviews on every keystroke against data the client already holds, and the commit route reviews **again, independently** against live data — so a row the client called an add can become an update at write time. Never all-or-nothing, and **never a quiet "0 imported"**: zero writes is an error, not a success.
3. **Names and numbers only — the parser never guesses.** An unrecognised category is handed back, not filed somewhere plausible. An ambiguous `03/04/2026` is refused rather than resolved: a wrong due date chases a family or misses a deposit. Money cells accept what spreadsheets actually emit (`$1,200.00`, `1 200`, `(450)`) and hand junk back verbatim so the coach sees what they typed.
4. **A round trip must actually close.** The month-grid reader understands the app's OWN export — its combined "Category / line" column with indented line rows, its derived prior-season/Total columns, and its Total / Money in / Running balance rows, all skipped as derived. Bare month names carry a year that rolls forward on a wrap (Sep…Jan), which is how a season sheet reads left to right. **Generalises: an exporter and an importer that don't share a column vocabulary are two features, not one.**
5. **Import writes through the SAME writers the forms use**, and its own gate: `money: write` only — never the admin Data Tools gate (`bulk_data_imports`, a Tournament-Plus ORG feature), which would paywall a premium coach behind an unrelated organisation's plan. Payables always ADD (a commitment has no identity to overwrite; a look-alike is flagged, never merged), sort order is written explicitly continuing from the plan's end, and an imported month becomes a readable period label ("Mar '26"), not a machine key.

**Applies to:** `lib/coach-budget-import.ts` + `components/coaches/BudgetImportSheet.{tsx,module.css}` (new), the budget-plan import preview/commit routes (new), the budget + expenses pages' import doors, `lib/help-content/coaches.tsx`, the Money probe suite. NO migration. [[design-system]] [[design-principles]]

---

### 2026-07-30 — Coach Portal Chunk H (view half): the month grid NAVIGATES and never edits; undated budget gets a column, never a smear; "Scheduled" is a lens that never merges into the plan (mockups `claude.ai/code/artifact/ab72877e-c0e7-4a46-a1ce-89e6982c104e` rev 1 = binding; D-H1–D-H10 + the sequencing call ratified at the recommendations)
**Decision (owner ratified all ten plus the split, 2026-07-30 — "agree with your recommendations"):** six binding rules from the Money-by-Month chunk. Import (the H2 half) is planned and mocked but deliberately not in this pass, so the new write path gets its own undivided review.

1. **A grid that shows money is a NAVIGATION surface, not a second editor.** A budget cell deep-links to the budget-line form that already exists (`?line=<id>&periods=1`, the shipped `?generate=1`/`?starter=1` one-shot recipe); an Actual or Scheduled cell opens a read-only list of what made it up. Nothing about a ~400-line form is duplicated into a cell. **Rider (discard-guard):** opening the period split on the coach's behalf is OUR doing, so the forced state becomes the BASELINE too — an untouched deep-linked form still closes silently. This retired the memoised `editingLine ? formFromLine(...) : addBaseline` derivation in favour of ONE `formBaseline` state set by every path that opens the modal; `formFromLine` remains the single form↔record mapping.
2. **Undated plan money gets a column of its own — never an even smear.** The BvA route used to distribute period-less lines evenly across every month (invisible in a cumulative chart, a plain untruth in a grid: budget appears in months the coach never chose). The grid gets a leading **"No date yet"** column and the chart on the SAME PAGE was corrected to match, naming the excluded amount in one line. **Generalises: when two surfaces on one page describe the same dollars, fixing one obliges you to fix the other in the same pass.** Out-of-window money is bucketed the same way and still counts in the row total — never dropped.
3. **"Scheduled" is a fourth lens, never a write into the budget column, and cash flow follows the lens on screen.** No payable↔line link, no migration. The cash-flow strip (Money in · Money out · Running balance, three rows INSIDE the same grid) projects with whichever lens is selected and says which — Budget projects the plan, Scheduled the commitments, Actual the real run. Blending them is the double-count the ruling exists to prevent, and following the lens removes every guess. **Money in is player dues ONLY** (fundraiser rebates already credit dues; counting both counts one dollar twice) and the strip states that.
4. **"Difference" is silent about months that have not happened.** Budget − Actual, elapsed months only; a future month renders an em dash. A month nobody has spent in is not a saving, and calling it one flatters a coach into a shortfall.
5. **The season's month range is DERIVED, contiguously, from the team's own dated money** — `rep_program_years` stores a year and a name, no date span. Earliest to latest, always including the month the coach is standing in, extended forward to six columns only when the range is degenerate (a real five-month season keeps five — padding invents a month nothing lives in), capped at 24 with an honest "showing the first N months" note. **No fixed Sep–Aug assumption:** the platform is Canada-wide and multi-sport.
6. **Payables were never tournament-specific — only the words were.** "Expenses & Tournament Payables" → **"Expenses & Payables"**; the stored `expense_type` value `tournament_payable` is UNCHANGED (renaming it is a migration for zero user benefit). The full commitment list is a **third tab on that page**, not a new Money section, and is money-OUT only (dues are money in and stay on Dues, where the reminders live). The hub's 30/60/90-day panel gains a link to it rather than growing.

**Caught by this chunk's own review, both worth generalising:** (a) a "compare to last season" column must sum the DISTINCT prior records matched, never the per-row figures — two rows matching one prior record silently inflated the total; (b) the month view initially omitted the **non-itemized buffer**, so a team with a season total above its itemized sum saw two different budget totals on one page — the same failure mode as rule 2, and the reason rule 2 is written as a general obligation rather than a chart fix.

**Also folded in, both shared-primitive fixes:** the **line PATCH** gained the taxonomy-ownership check its POST sibling got in Chunk G's review (a crafted PATCH could relink a line to another org's custom category and echo its name back) — probe-asserted. And the desktop sticky-footer overlap is now **one shared `.modalFlushFooter`** in `coaches.module.css`, retiring three private copies (the event modal's and both Chunk G sheets' `footerFlush`); it is a DESCENDANT selector on purpose, so a footer inside a conditional wrapper can't silently fail to satisfy it.

**Applies to:** `lib/coach-budget-months.ts` + `components/coaches/MoneyMonthGrid.{tsx,module.css}` (new), the budget-vs-actual page + route + `bva.module.css`, the budget page, the expenses page, `upcoming-payables`, the budget-line PATCH, the Money hub, `coaches.module.css` (primitives header + the new modifier), `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts`. NO migration. Chunk H2 (import/export templates) inherits Chunk G rule 1 wholesale — **template amount cells ship EMPTY**. [[design-system]] [[design-principles]]

---

### 2026-07-30 — Coach Portal Chunk G: the budget starter never proposes a dollar; "still to price" is DERIVED, never stored; the sample is fenced and uncopyable (mockups `claude.ai/code/artifact/77f5175e-7e5b-4f18-ba24-0a0eabc46729` rev 1 = binding; D1–D6 ratified at the recommendations)
**Decision (owner ratified all six, 2026-07-30 — D-G1/D-G2 logged Decided in BUSINESS_DECISIONS.md):** five binding rules from the budget-starter chunk.

1. **No product-supplied dollar figure anywhere in Money — enforced at three levels.** UI: no numeric placeholder (a `placeholder="1500.00"` is a suggestion; the starter's amount inputs carry none), no prefill, no benchmark copy (help docs included). Data: `budget_items.suggested_amount` stays NULL for every platform default — the probe suite asserts this against the live DB. The one sanctioned calculation: multiplying two numbers the coach themselves typed (entry fee × their tournament count), with the arithmetic always shown and stored on the line as its note ("4 × $600"). A coach-typed number is theirs; reintroducing product figures needs a new BUSINESS_DECISIONS entry.
2. **An unpriced budget item is NEVER a stored row — the checklist is derived.** `rep_budget_lines.total_amount` is CHECK'd `> 0`, and that constraint is load-bearing design: "not in your plan yet" = team-scope default taxonomy items minus (item-linked or name-matched) lines minus device-remembered dismissals (localStorage per team+season, the Moved-marker/winding-down pattern). Zero storage, always current, serves season-3 coaches identically. Do not invent checklist storage ($0 sentinel rows, a dismissals table).
3. **The sample is another team's page, by construction.** Named fictional team (Riverdale 12U) · fenced (the portal's ONE dashed frame in Money, `--logic-lime` border/eyebrow → olive under the warm gate per E3) · invented-numbers disclaimer · amounts as plain text with zero inputs and zero use/copy affordances inside the fence (probe-asserted) · content is a code constant, never data. Visible to read-only coaches (education ≠ write). Its BvA tab keeps the comparison-stays-a-grid idiom (CoachScrollX, pinned first column, honest hint) and deliberately shows one line over budget.
4. **Write surfaces gate on write; education doesn't.** Starter sheet, checklist strip, chip→prefilled-Add-Line are `money === 'write'` only; the sample and the honest read-only empty state ("building it is the head coach's job") render for `read`. A checklist chip prefills category+item with the amount EMPTY, and the prefill is the discard-guard's baseline (our prefill is not the coach's work — closing untouched stays silent; the one-mapping rule extended).
5. **The starter retires; the checklist stays; the manual path is never walled.** Questions render only on the empty page (+ `?starter=1` deep-link, write+empty only — the `?generate=1` recipe); once lines exist the strip is the permanent "what am I forgetting?" door. Add Line survives on every page state. The starter writes through the EXISTING lines POST, sequentially — write order IS display order (sort_order defaults 0, read path has no tiebreaker) — with per-row outcomes.

**Build deviations from the mockups (all flagged in the plan header):** question chips = the shipped `.segChoice` segmented control (not bespoke pills — inherits warm treatment); done-tick = rounded square on success tint (circles are banned; mock drew a lime circle); SAMPLE eyebrow = olive text on tint (solid olive fills are out of bounds); ×N helper only at count ≥2; both empty states render through the shared `CoachEmptyState` (its contract names "first-run banner" — a hand-rolled parallel card would be the portal's one empty state global tweaks can't reach).

**Applies to:** `components/coaches/BudgetStarterSheet.{tsx,module.css}`, `components/coaches/SampleBudgetSheet.{tsx,module.css}` (new), the coach budget + budget-vs-actual pages, the Money hub plan anchor, `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (now 18 tests). Chunk H (month grid / payables generalization / import templates) inherits rule 1 wholesale — import templates ship with amount cells EMPTY.

---

### 2026-07-30 — Coach Portal Chunk A: a LIST becomes cards, a COMPARISON stays a scrolling grid; the scroller and its swipe hint are ONE component; a modal discard guard is a different primitive from the route guard (mockups `claude.ai/code/artifact/dc2eb969-1f4d-4743-9bfc-d1cd55575e3d` rev 1 = binding; D1–D5 ratified at the recommendations)
**Decision (owner ratified all five, 2026-07-29):** five binding rules from the Money-on-a-phone chunk.

1. **A LIST becomes cards; a COMPARISON stays a grid.** The `.tableAsCards` reflow is for tables where one row is one record read top-to-bottom (expenses, payables, allocation installments, a fundraiser leaderboard, unbudgeted expenses). It is **not** for a table read *across*: Budget vs. Actual puts Budgeted / Actual / Variance on one line and that adjacency **is** the report — card-stacking it would remove the horizontal scroll and remove the feature with it. A genuine 2-D grid keeps its shape, scrolls inside its own frame with the first column pinned, and says so. **Test before reaching for either: does a coach compare two numbers on the same row? Grid. Does a coach read one record? Cards.**
2. **The scroller and its affordance are ONE component — `CoachScrollX` (components/coaches).** `.scrollX`/`.scrollXSticky` carried the rule "never a silent sideways scroll, always pair with a visible hint" from 2026-06-29 with **no hint class to pair with, and consequently zero adopters** — an unsatisfiable contract. Bundling them makes the rule structural: a future adopter gets the affordance whether or not they remember it. **The hint must stay honest** — rendered only while the content genuinely overflows and retired once the coach scrolls — which is what lets one component serve a surface that overflows on a phone and fits on a desktop. Do not re-introduce a bare `.scrollX` div.
3. **A pinned first column owns its own leading gutter.** `left: 0` is measured from the SCROLLER's edge, not the row's, so a row that keeps its own `padding-left` makes the pinned label start inset and snap flush on the first swipe — a visible lurch of exactly the padding. Adopting rows zero their `padding-left` and pass it down via **`--scrollx-pin-gutter`**, *including any hierarchy indent*, so nesting still reads while the label stays put. The pin background must be **opaque** (`--card-bg`, or `--scrollx-pin-bg` to override) — a translucent row wash lets the scrolled columns read through the label.
4. **A modal discard guard is a DIFFERENT primitive from the route guard, and the phone's loss mode is the BACK ARROW.** `UnsavedChangesGuard` protects route changes (`beforeunload` + intercepted link clicks) and suits edit *pages*; a modal loses work on dismiss, which no route guard can see — hence `useDiscardGuard` (components/coaches), routed through the shipped `ConfirmProvider`. Two binding riders: **(a)** at ≤640 a portal modal is a full-height sheet with **no backdrop**, so the dismiss that destroys work is the back arrow — which reads as *navigation*, making it more dangerous than a desktop backdrop tap, not less; guard back-arrow, X and Cancel together, never Save. **(b)** A **clean** form closes silently — a confirmation with nothing to protect is friction, not safety — and the copy **names what is at stake** ("an amount and 3 payment periods"), never "unsaved changes". An edit form's dirty baseline is the **loaded record**, and it must share ONE mapping with the code that opens the form, or the guard drifts into nagging or missing.
5. **The portal's 960px reading column is not widened to fix one grid.** `.page { max-width: 960px }` is portal-wide with a shipped `.pageWide` (1200px) opt-in for structured layouts (the Schedule's week/month views). Budget vs. Actual is a structured layout and takes the opt-in; the shared default is untouched. A page that wants more width states why — it does not change everyone else's.

**Riders, also binding:** an empty table cell must not draw a blank card line (`.tableAsCards td:empty { display: none }`) — the table keeps square rows, the card just doesn't draw the empty ones, which matters most for a **read-only** money coach whose every action cell is empty. A trailing card action becomes a **full-width** control at a real touch size (`.cardActionCell`, `.block640`); a cell holding a nested form stacks instead of squeezing into a label/value line (`.cardStackCell`). One documented flex utility, **`.stack640`**, replaces per-page `1fr 1fr` grids that had no phone handling. **Money's headline numbers state their accounting basis ONCE above the row**, not as a caveat bolted onto whichever tile happened to get one.

**Applies to:** `app/[orgSlug]/coaches/coaches.module.css` (the primitives), `components/coaches/CoachScrollX.tsx`, `components/coaches/useDiscardGuard.ts`, all seven Money surfaces + the Money hub, `budget.module.css` and `bva.module.css` (which had **zero** media queries before this).

---

### 2026-07-29 — Coach Portal Batch 4: a real tournament game is a MIRRORED team event whose facts the organizer owns; no provenance badge on the row; Attendance gets a Squad nav home (mockups `claude.ai/code/artifact/66c2fc6b-cea1-45fa-90ee-fa2effe620d6` rev 2 = binding; D1–D6 ratified at the recommendations)
**Decision (owner ratified all six, 2026-07-29):** five binding rules from the tournament-games batch.

1. **A team's real platform tournament games are MIRRORED into `rep_team_events` rows** tagged `source_tournament_game_id` (mig 207), not modelled as a second kind of game the tools must learn. *Rationale:* six independent constants across the portal, Insights, Wrapped and the admin side already accept `event_type='tournament_game'`, so mirroring makes all of them work untouched — including surfaces nobody would have remembered to update. The alternative (polymorphic attendance/lineup keys) needed two migrations and ~12 branch points where one arm can silently be missed. The reconcile rules are PURE and unit-tested (`lib/tournament-game-mirror.ts`), the IO is a thin assembly half (`lib/rep-tournament-game-mirror.ts`) — the season-wrapped/rep-season-wrapped precedent.
2. **The organizer owns the facts; the coach owns the preparation.** Binding field split on a mirrored event — ORGANIZER: `starts_at`, `location`, `opponent`, `home_away`, `name`, `team_score`, `opponent_score`, `result`, `status` (overwritten every sync; the events PATCH returns **409**, DELETE is refused). COACH: `arrival_time`, `uniform`, `field_number`, `description`, `resources`, tags, **attendance**, **the lineup** (never touched by a sync). A coach must not be able to make their own calendar disagree with the tournament they're playing in; everything they genuinely own stays fully editable.
3. **The mirror never destroys a coach's work.** When a source game disappears: **re-point** to a recognisable replacement first (same tournament + opponent, preferring same day, and only when unambiguous from BOTH sides — organizers reschedule by delete-and-recreate, and bracket regeneration re-identifies wholesale); else **cancel** when attendance / a lineup / any coach-owned field exists (cancelled rows already drop out of the record and attendance rollups, so nothing double-counts and nothing is lost); else **delete**, so a mistaken game leaves no phantom. Ambiguity is never resolved by guessing.
4. **NO provenance badge on a schedule row** (owner call at approval, superseding the rev-1 mockup's "Tournament" chip). The event-type colour rail already codes a tournament game and the tournament's own name is the row text — a badge cost phone width for information present twice. **Trailing chip space on a schedule row is reserved for STATE that changes**: lineup readiness, score/result, Moved, Cancelled. Apply this rule to any future row affordance.
5. **"Moved" is DEVICE memory, not a column.** The honest question is "has this moved since *I* last looked" — per-person, not global — so a coach who never saw the old time sees no marker. `localStorage` per team, first sight recorded silently, cleared when the coach opens the game; the re-check-attendance nudge appears only when the calendar DAY changed, and attendance is never wiped. Same pattern as the Batch 3 winding-down cue. Also binding: **duplicates are surfaced, never auto-merged** — a coach's hand-entered copy may hold real attendance and a lineup, so the confirm counts what would go with it and "Keep both" is a real, remembered answer.

**Applies to:** `lib/tournament-game-mirror.ts`, `lib/rep-tournament-game-mirror.ts`, `lib/coach-tournament-games.ts`, the coach events routes, the coach Schedule/Attendance/Overview pages, `lib/coach-nav-visibility.ts` + both nav components. Attendance's nav entry sits in **Squad** between Roster and Lineups (the order a coach works in on game day) behind the shared `isCoachNavItemVisible` gate, so sidebar and bottom-nav gain it together; the CLOSED-season door list is untouched.

---

### 2026-07-28 — Coach Portal Batch 3: closed seasons are a READ-ONLY Season's End surface (never a wall, never a writable portal), Wrapped shares as an IMAGE, and the winding-down cue is quiet by construction (mockups `claude.ai/code/artifact/ddf75f7e-02b9-4ba9-af1f-304c2db5c11b` = binding; D1–D5 ratified at the recommendations)
**Decision (owner ratified all five, 2026-07-28):** four binding rules from the Season's End batch.

1. **A coach with only CLOSED (completed/archived) seasons is never walled out — and never sees a writable portal for a dead season.** Closed assignments are a SEPARATE lookup and a separate `closedAssignments` array end-to-end (`getClosedCoachingAssignmentsForUser`, the assignments API, `useCoaches()`); they must never be merged into `assignments` — the active list feeds ~49 write-capable routes that all assume "visible = writable". Closed seasons get exactly three surfaces: **Season's End** (`/season-end`, the landing), the **results archive** (`/history/results`), and the season-READ API resolver (`lib/coach-season-read.ts`) behind them — GET-only by contract; any future route using that resolver in a write is a defect. Nav for a closed team collapses to those doors (sidebar + bottom nav); closed teams sit in a quiet "Season complete" switcher/hub group, one entry per team, never mixed with active. **Deviation from the approved mockup, deliberate:** the closed-team nav drops the mockup's Settings tab (nothing in Settings is actionable for a closed season — a dead tab is dishonest) and the Insights door goes straight to the results archive, not the hub (the hub's live-season tiles read as errors with no active year).
2. **Season Wrapped is a FIXED-COLOR artifact and the canonical season record.** Team-color gradient + white ink + true-lime accents in BOTH themes (like the share image it becomes) — its literals are `token-exempt` by design because warm-gate token remaps would put ink on the dark gradient. The record rule (in `lib/season-wrapped.ts`, unit-tested) counts league + tournament + legacy external_tournament, excludes scrimmages — ending the three-way tally drift. **Honesty rule:** every stat has an earned-it threshold (streak ≥3 wins; closest game needs ≥4 decided; lineup fact = reused ≥3×, ≥2 scored wins, 0 losses; award tile needs ≥1 award, ties named) — a sparse season renders fewer tiles, never padded superlatives. **Share-safe rule:** first name + jersey number only, NO money data in the payload, and sharing is an IMAGE via the OS share sheet (D3) — a no-login family link would be the portal's first public surface and needs its own project.
3. **The winding-down cue (f5-1) is one quiet dashed card, never a modal/toast, and silent unless the evidence is strong (D5):** ≥1 finalized game · nothing scheduled · ≥14 quiet days · no upcoming registered tournament. One dismiss silences it for the season (localStorage, like setup skips); any new event clears it. The coach who can actually close the season gets the door (standalone head coach → the rollover sheet); club coaches get the expectation, never a dead button.
4. **Closing a season tells the truth at the moment of action.** Admin "Mark Completed" now confirms first, naming coach impact (read-only + Season's End access + next season's empty coach list). The rollover sheet names what was silently omitted (f5-7): development history stays (open-goals "bring forward" offer; measurements never carry) and awards are all-time team history. Rider rule from the same batch: **"read-only past season" holds per-ROW, not just per-team** — roster edits and new development goals/measurables now verify the target row belongs to the active year (awards deletion stays all-time by intent, documented in-route).

**Owner ruling at QA (2026-07-29) — the FUTURE past-season access model (binding scope for the follow-up project, `PROGRAM_COACH_PORTAL.md` §1.5):** a closed season eventually stays **as if live but read-only** — every coach on that season's staff (head or assistant, org-owned or standalone) keeps read access to exactly what their capabilities showed them while it was live; everything renders view-only; the ONE live write surface is staff/entitlement management, which the head coach (or club admin) can still use on a closed season — but it only governs who can READ it (revoking an assistant removes their archive access). Supersedes Batch 3's D1 middle-cut as the END-STATE (Season's End + archive remains the shipped interim). Don't re-litigate scope at pickup — decisions left for build are presentation-level only.

**Owner ruling at QA (2026-07-29): the Wrapped card STAYS a fixed-color keepsake in both themes** (asked when a colorless team's near-black card read as a dark-theme leak on light; options were keepsake / theme-on-page / theme-everywhere — owner picked keepsake). Refinement shipped with the ruling: the card's color chain is now **team color → org `theme_primary` → platform primary `#1E3A8A`** (route passes the org fallback into `assembleSeasonWrapped`; `shadeHex`'s literal fallback is the platform blue — canvas can't read CSS vars and page/PNG must match). A colorless team now reads as deliberate FieldLogicHQ branding, never as a theme bug. Coach-side team-color editing doesn't exist yet — noted as a future item (the nudge idea was dropped so we don't link to a dead end).

**Owner call at QA (2026-07-29): the multi-team coach NEVER lands on a hub — `/coaches` is a pure redirector.** Landing order: the LAST team the coach was in (remembered per org in localStorage `flhq-coach-last-team:{orgSlug}`, written by the sidebar on every team visit) → first active team → first closed team's Season's End. The My Teams card grid is RETIRED; desktop team switching is a **dropdown in the sidebar matching the admin tournament switcher** (`#coach-team-select`, closed teams in a "Season complete" optgroup opening on Season's End); mobile keeps the More-sheet rows. **The sidebar's "Back to {org}" link (→ the org PUBLIC page) is REMOVED** (owner: doesn't belong; public surfaces are reached via the Flip doors; admin-coaches keep "Back to admin"). Rider: the tournament-awareness acquisition banner's only surface was the hub — relocated to the quiet bottom of the team Overview (same self-gating + dismiss). Readiness-review note: this supersedes finding f0-5 ("multi-team hub thin onboarding") — the hub no longer exists to onboard.

**Owner catch at QA (2026-07-29): the "run tournaments here too" banner (`CoachTournamentAwarenessBanner`) was a DARK ISLAND on the warm hub** — its "Open setup" CTA used raw `--logic-lime` (→ solid OLIVE fill under the warm gate) and its body/dismiss inks were raw white rgba (washed out on cream). It had never been seen on warm: it only renders on the multi-team My Teams hub, and until Batch 3's closed-team work most test coaches auto-skipped the hub. Fixed with a warm-gated block in `tournament-growth.module.css` (card ground, ink text, ink-on-lime CTA, olive-tint icon; the public/tournament dark impressions untouched — the gate marker only exists in coach shells). Probe-verified: CTA `rgb(217,249,157)` + ink. Same rule as below: raw `--logic-lime` fills and raw white inks must never reach a warm-gated surface.

**Owner catch at QA (2026-07-29): the season-record scope chips (League/Tournament/Scrimmage, `SeasonRecordWidget`) rendered their ACTIVE state as an OLIVE chip on warm** — `.wltToggleActive` used raw `--logic-lime`, which the warm gate remaps to olive (the frozen-alias/E3 family, and the exact "olive is never a fill" violation). Fixed by adding `.wltToggleActive` to the existing warm lime-FILL restore group (`.titlePremiumBadge`/`.moneyFilterChipActive`/`.wltPip[data-r="win"]`) → true lime + dark ink, verified by computed-style probe (chips now `rgb(217,249,157)`). Rule reinforced: **any new "on"-state chip fill must join that restore group or use `--home-lime` directly — never raw `--logic-lime` as a fill inside the portal.**

**Owner call at QA (2026-07-29): the My Teams hub cards drop their status pill.** The ACTIVE pill read as a drab olive "button" on the warm ground and collided with the role text ("ACTIVE Head Coach"). Rule extended from the Overview header to the hub cards: **an active team needs no status label anywhere** — the role rides the season meta line ("2026 Season · Head Coach"), closed cards rely on their "Season complete" group heading (+ "· read-only"), and only a DRAFT season still shows a pill.

**Applies to:** `lib/coach-season-read.ts` + `lib/season-wrapped.ts` + `lib/rep-season-wrapped.ts` + `lib/wrapped-share-card.ts` (new), `getClosedCoachingAssignmentsForUser`/`getLatestClosedRepProgramYear` (lib/db.ts), `components/coaches/SeasonWrappedCard.tsx` (new), `season-end/page.tsx` (new), CoachesSidebar/CoachesBottomNav/coaches hub/layout, StartNextSeasonModal, admin program-year page, the `/wrapped` + widened `/history` + seasons-recovery routes, `.wrapped*`/`.seasonCue*`/`.seasonDoor*`/`.closedTeam*` CSS. Built on dev 2026-07-28 inside Coach Portal Launch Batch 3. [[design-system]] [[design-principles]]

### 2026-07-28 — Coach Portal Batch 2: one disclosure primitive for every heavy form, sensitive grants confirm, and the setup checklist gains a five-step trail (mockups `claude.ai/code/artifact/c52d7d67-dfeb-4727-b122-40d5ad73afec` = binding; D1–D5 ratified at the recommendations)
**Decision (owner ratified all five at the recommendations, 2026-07-28):** three binding patterns come out of the "first week" batch.

1. **Progressive disclosure is ONE shared control, and the field split is a rule, not a per-form taste call.** New `components/coaches/CoachFormDisclosure.tsx` — collapsed it's a dashed accent line (`＋ Add …`), open it's a `.formSection` with a title, an optional one-line "why", and a Hide control. Binding contract: **children stay mounted while collapsed** (form state, validation, and `UnsavedChangesGuard` keep working), **`defaultOpen` is a mount-only hint** (same rule as `CollapsibleCard` — a controlled prop would re-collapse a group the coach just opened on the next parent render), and a collapsed group that holds data or a blocking error must say so via `meta`, so a disabled Save always has a visible reason. **Rule going forward: any coach-portal sheet over 8 fields gets a disclosure; 8 or fewer is left alone.** Applied to Add Player (11), Add/Edit Event (13), Add Tournament Payable (11); the 2026-07-28 audit found every other converted sheet already at or under 8 (Add Expense 7, Payment Request 5, Fundraiser 5, Fundraiser Settings 6, Budget line 6, Documents upload 3, each dues sub-form ≤5) — left untouched. **D2: essentials on Add Player are First / Last / Jersey # / Primary position** (not the free tier's #/First/Last) because positions are what make lineups, the depth chart, and game sheets fill themselves in — the paid tier's reason to exist.
2. **Instant-save survives; only sensitive GRANTS confirm (D3).** The assistant capability grid keeps its auto-save (a readiness-review top-5 strength) and splits into "Everyday coaching" (schedule, attendance, lineups, roster view — always visible) and "Sensitive access" (money, documents, contacts & birthdates, notes, send-announcements, tryouts — behind the disclosure, with a live `N granted` count so a collapsed group never hides a live grant). **Granting** money, contacts & birthdates, or send-announcements asks once; **revoking is never confirmed** — a head coach taking access back is always in a hurry. The native `window.confirm()` for removing an assistant is replaced by the portal's `ConfirmProvider` (closes review finding f7-5).
3. **The momentum ring IS the setup checklist, drawn twice — never a second widget.** `SetupItem` gains a `milestone` flag; the five first-week steps (Roster · Schedule · Lineup · Families · Money) render as a five-column trail in the slot the old `.setupSegments` bar occupied (that bar is deleted), and the remaining steps render as the existing rows beneath. One list, one source of truth, no step twice. Dots are lit / next / open / skipped and each is a live link into its section. **Consequential behaviour change (D4):** the panel now recedes only once all five are done **or skipped** — the old rule receded it the moment one player existed, which would have made the trail visible only at 0-of-5. Per-step Skip and the panel's Hide both still work. The `preseason` anchor does not render while the panel is up (same sentence); `in_season`/`game_day`/`result` anchors keep priority **above** it — a game today always outranks onboarding. **D5:** Staff and Documents become skippable steps (they have real completion signals); Chat, Development, Insights and Tryouts are named in an "Also in your portal" chip row and never get a fake "done" — pretending otherwise rebuilds the false "you're all set" the finding is about. Chip visibility routes through the SAME `isCoachNavItemVisible` rule as the sidebar so a coach is never pointed at a section their capabilities hide.

**Also binding, from the same batch:** pasted free text is parsed for **names and jersey numbers only** — never emails, phones, birthdates, or positions. Guessing personal data out of prose produces confident wrong answers about real families; labelled spreadsheet columns are the only bulk path for contact details. And bulk writes report **per-row outcomes**, never a silent all-or-nothing rollback.
**Applies to:** `components/coaches/CoachFormDisclosure.tsx` (new), `RosterBulkAddSheet.tsx` (new), `CoachStaffPanel.tsx`, `app/[orgSlug]/coaches/coaches.module.css` (`.disc*`, `.bulk*`, `.ring*`, `.discover*`; `.setupSegment*` deleted), the Overview / Roster / Schedule / Expenses pages, `lib/coach-roster-bulk.ts` + `lib/db.ts` `getCoachTeamMilestones`. Built on dev 2026-07-28 inside Coach Portal Launch Batch 2. [[design-system]] [[design-principles]]

### 2026-07-28 — Premium roster rows drop the per-player initials avatars (owner call); reinforces "no circular monograms"
**Decision (owner: "do we need those initial images next to the names? I thought we were getting rid of those"):** the premium roster list's colored initials chip next to each player name is REMOVED (desktop table + mobile cards — one shared cell renders both). Rationale: it encoded nothing real (the color is a name-hash, not team or player identity), it spent ~40px of a ~361px mobile card row, and it was the coach portal's only **circular** monogram — violating the standing 2026-06-03 rule (monograms are rounded-squares, NEVER circles). Verified single call site in the portal before removal; chat message avatars and consumer account avatars are separate systems and are untouched.
**Rule going forward:** roster/list rows identify players by NAME + jersey-number chip only — do not reintroduce per-player initials chips on list surfaces. If a future surface genuinely needs a player identity mark (e.g. player photos), it follows the rounded-square monogram rule.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx` (avatar span + `lib/teamBadge` import removed — teamBadge now has public-only consumers, relevant to cleanup finding B29), `app/[orgSlug]/coaches/coaches.module.css` (`.avatar` rule deleted). Built on dev 2026-07-28 inside Coach Portal Launch Batch 1 (uncommitted). [[design-system]]

### 2026-07-27 — System screens (404 / crash) legibility pass — and TWO global cascade traps that were failing silently app-wide
**Decision (owner-flagged: "these error screens are hard to read, both light and dark"):** the root 404 + root crash boundary were repaired in both themes. Two of the six findings were **not screen-local** — they are project-wide cascade traps that this screen merely exposed, and both were fixed at the source:

1. **Tailwind preflight is disabled, and nothing in the reset replaces it.** Two consequences, both live everywhere, not just here:
   - `button` had no `background` reset, so any `<button>` that styled only its border + text rendered the UA's opaque **ButtonFace chip** — this is why the crash screen's "Retry Request" was a *white box* on a near-black HUD. Fixed globally: `button { … background: transparent; }` in the reset. Buttons that set their own background are unaffected; the only ones this changes are ones that were already wrong.
   - Tailwind's `border` utility emits **`border-width` only** (preflight normally supplies `border-style: solid` on `*`), so on a `<div>`/`<a>` the computed style is `border-style: none` and **the border draws nothing**. The crash card, the "Return to Root" link and the 404's lime CTA were all silently edgeless. Fixed **locally** in `system-screens.module.css`, NOT in the global reset — a blanket `border-style: solid` on `*` needs a matching `border-width: 0` (what preflight does), which would disturb modules that set style or colour alone. **Rule: when using Tailwind's `border` utility in this codebase, you must supply `border-style` yourself.**
2. **`--blueprint-light` is now THEME-AWARE.** Its single value `#3B5FC4` was tuned for a white ground (5.9:1) but is used almost exclusively on dark ones, where it is 3.4:1 on `--pitch-black` and 3.0:1 on `--structural-slate` — under AA for the 10px labels that consume it. `:root` now carries a lightened blueprint tint **`#859BD5`** (same hue/sat, L 33%→68%; 6.4–7.2:1 on dark), and `[data-color-mode="light"]` restores `#3B5FC4`. `tailwind.config.ts` stopped freezing a copy and now points `'blueprint-light': 'var(--blueprint-light)'` so the two can't drift (no consumer uses an opacity modifier, the one thing a `var()` colour can't support).
3. **`.hud-label`'s ink moved from `--blueprint-blue` to `--blueprint-light`.** The deep navy on `--pitch-black` is **~1.8:1** — below even the 3:1 non-text floor — and this eyebrow only ever renders on dark grounds. Affects all 12 surfaces using it (dashboard, archives, admin hub, scorekeeper/check-in, footer, marketing home): every one improves, none regresses.

**Screen-local fixes:** the crash eyebrow rendered **blue, never red** in either theme — `text-red-400` ties with the global `.hud-label` and lost (globals.css is emitted after `@tailwind utilities`), and under Warm `.errLabel` lost again to `.page .hud-label` (0,3,0). Now `.page .errLabel` outranks both, deterministically: `--danger` on dark, `color-mix(in srgb, var(--home-live) 78%, var(--home-ink))` on paper (raw `--home-live` is only 3.9:1 on cream — just under AA at 10px; the mix clears 5.3:1 with **no new token**). The dev error block was the one element with **no warm rule at all** (`bg-black/40` punched a near-black slab through the cream page) and `overflow-auto` with no wrapping forced horizontal scrolling of the exception text — now warm-gated to a white card and `white-space: pre-wrap` + `overflow-wrap: anywhere`. The crash card itself warm-gates to `--home-card` + a real red hairline (its `bg-red-500/5` wash is invisible over cream, so on paper the screen had lost every signal it was an error). Warm `.body` and the warm `.hud-label` moved off `--home-dim` (3.3:1 — it is the *meta* ink) onto `--home-ink-soft`; "Return to Root"'s `white/10` edge (~1.3:1, imperceptible) → `--white-40` (3.7:1) / `--home-dim` on paper.

**Note:** `system-screens.module.css` is no longer 100% warm-gated. Its "Dark stays byte-identical" contract is retired and the file header says so — several defects were present in BOTH themes, so the base rules are ungated by design. `global-error.tsx` was reviewed and left alone: it is inline-styled, dark-only on purpose (globals.css may not have loaded at that failure point), and its own contrasts already pass.

**Applies to:** `app/globals.css` (`--blueprint-light` + light-mode override, `.hud-label`, `button` reset), `tailwind.config.ts`, `app/system-screens.module.css`, `app/error.tsx`. Verified: tsc clean, lint clean, all six colour-token baselines still ZERO, Tailwind confirmed emitting `.text-blueprint-light { color: var(--blueprint-light) }`. [[design-system]] [[design-principles]]

---

### 2026-07-23 — Auth screens FOLLOW the user theme (supersedes the R1-4 "auth stays dark" carve-out) — the whole `/auth` group + the consumer install banner are pref-gated warm
**Decision (owner-flagged: warm-theme user hit a dark sign-in screen on mobile):** the sign-in family — `/auth/login`, signup, forgot/reset password, signup-confirm, suspended, accept-invite, accept-assistant-invite — follows the account theme exactly like the four consumer tabs: **warm by default, dark only for explicit Dark choosers (pixel-identical to the pre-change screens).** R1-4's "sign-in / select-org / suspended stay DARK" was ratified when dark was the platform default; once warm became the default (2026-07-22 entry above), a hard-dark auth flow was a jarring island in the middle of a warm app. The nav chrome (top bar + bottom tabs) and the OS status-bar tint on auth routes are pref-gated the same way (`/auth` joined `CONSUMER_SHELL_PREFIXES`).
**Mechanism (consumer twin of the coach-gate vocabulary remap):** auth pages nest inside a `warmTab` surface via a new `app/(consumer)/auth/layout.tsx`; an inner `.authSurface` wrapper remaps the dark vocabulary tokens the stylesheet + inline styles consume (`--fl-text→--home-ink`, `--data-gray→--home-dim`, `--text-tertiary→--home-dim`, `--logic-lime→--home-olive` per E3, `--danger-light→--home-live`, `--blueprint-blue→--home-olive`) under `html[data-user-theme="warm"]` ONLY, plus explicit warm rules for the raw navy-rgba structures. **The remap wrapper must be a DESCENDANT of the `warmTab` capture element, never the same element** — remapping `--logic-lime` where `--home-lime: var(--logic-lime)` is declared would collapse the captured true lime to olive. Sign-in CTA = ink-on-lime (the one warm primary language). The consumer-shell `InstallAppPrompt` instance gains `followsUserTheme` (warmVars + pref-gated skin) — it floats OUTSIDE the pages' warm wrapper and was a dark island on the warm tabs; tournament/operator instances are untouched.
**Applies to:** `lib/consumer-routes.ts` (`/auth` in `CONSUMER_SHELL_PREFIXES`), `app/(consumer)/auth/layout.tsx` (new), `auth.module.css` warm block, `components/InstallAppPrompt.{tsx,module.css}`, `app/(consumer)/layout.tsx`. Marketing pages, org-branded tournament pages, platform-admin login, and the operator shells stay dark by design (M2 unchanged).
**Extension 2026-07-24 (owner-directed):** the platform-neutral SYSTEM screens follow the theme under the same rule — root 404 (`app/not-found.tsx`) + root crash boundary (`app/error.tsx`) via `warm.warmVars` + warm-gated `app/system-screens.module.css` (dark byte-identical; outline CTAs go olive-on-paper per E3, hover = olive-soft wash), and `public/offline.html` (inline `fl_user_theme` read, warm default, SW cache v9). `global-error.tsx` stays dark by design (globals.css may not have loaded at that failure point).

### 2026-07-23 — Warm gate: every `:root` ALIAS token must be re-declared inside the gate (frozen-alias gotcha) — fixed `--text-*` + `--*-strong` (owner-flagged: illegible "How to pay" / "That's a wrap" on the coach tournament record)
**Decision:** a `:root` alias like `--text-primary: var(--white)` resolves its `var()` **at `:root`, against the dark ramp**, and descendants inherit that already-resolved value — so the warm gate's `--white*` remaps (which live on the NESTED `[data-coach-warm-enabled]` marker, unlike public light mode whose overrides land on `:root` itself) never reach it. Under warm this rendered every `--text-primary/-secondary/-tertiary` consumer as white-ish ink on cream: the tournament record's **How to pay** panel (`TournamentStatusBlock`), the **That's a wrap** card copy, the free-portal home/tournaments-list empty states. **Rule going forward: any `:root` token defined via `var()` of a token the warm gate remaps must get its own re-declaration line inside the gate block** (the gate already did this for `--white-05`/`--border-subtle`; `--text-*` and the four `--*-strong` status aliases were missed). Fixed centrally in the gate: `--text-primary→--home-ink`, `--text-secondary→--home-ink-soft`, `--text-tertiary→--home-dim`, `--success/warning/danger/info-strong→--home-win/-amber/-live/-blue` (role-mapped, not alpha-mapped, per the Stage-2 technique). Also fixed in the same sweep — remaining ink-on-lime dark-islands the Stage-6 sweep missed (all per-element warm-gated ink-on-lime restores, dark byte-identical): free-portal lifecycle chips LIVE/GAME DAY (`coaches-portal.module.css`), the new `CoachLiveEventCard` `.chipLive`, the shell `ChatUnreadBadge` (coach shells only; AdminSidebar has no marker), premium `.titlePremiumBadge` + `.moneyFilterChipActive` + `.wltPip[data-r="win"]`; plus two both-theme pip bugs (ghost `--white-15` → `--white-20`; loss pip `--white` ink → `--on-team-color` so the glyph stays light on the red fill both themes; warm tie pip → `--on-team-color`, base pip → ink).
**Rationale:** same family as the `next/font` :root-override and Turbopack-composes gotchas — token indirection breaks silently across scope boundaries. Central re-declaration fixes every consumer at once (module CSS + inline TSX styles) with zero dark-mode change; the lime-fill chips can't be centrally fixed (E3: `--logic-lime`→olive is correct for text, only FILLS restore true lime) so those stay per-element.
**Applies to:** `app/globals.css` (warm gate block), `app/coaches/coaches-portal.module.css`, `components/coaches/CoachLiveEventCard.module.css`, `components/chat/ChatUnreadBadge.module.css`, `app/[orgSlug]/coaches/coaches.module.css`. Generalizes to any future nested theme gate: re-declare aliases, or define aliases with the `var()` at point of USE.

### 2026-07-23 — "The Flip" P3 RATIFIED (rev-3 mockups `claude.ai/code/artifact/564697a9-6622-4511-9815-07a3a7c24508` = binding): coach flip is CONTEXTUAL — corner pill on the tournament record ONLY; Overview + lists carry per-event ⇄ links; scorekeeper gets the constant header pill + chooser
**Decision (owner approved rev 3 after two adjustment rounds):** the coach portals get NO shell-wide pill. Exactly ONE coach page carries the top-right corner FlipPill — the **tournament record** (both tiers), because that page IS one event (pill only when the event is publicly visible; draft/hidden = nothing). Everywhere else the flip rides the **event surface itself** as a quiet in-content `⇄ Fan view — public schedule & live scores` link with ONE placement rule: **the flip link sits on its own line directly beneath the event card/row it belongs to** (rev-3 correction — rev 2 had it inside the Overview card; the owner asked for consistency with the list rows, where the card is itself a button so the link must sit below). Surfaces: **Team Overview** (both tiers) — link under the live-event block, ONLY while a live/upcoming (status `active`) public event exists; a finished event's flip lives on its record page + list row only (owner rejected an Overview header pill outright: "the flip belongs to the event, not the page"). **Tournaments lists** — per-row links for publicly-visible rows: free per-team list REROUTED through the resolver (+ icon honesty fix: the old open-in-new-tab glyph replaced by ⇄ — these were always same-tab), premium per-team list + the free portal-wide cross-team registrations list ADDED (owner call). Links restyled accent-colored (`--logic-lime` → olive under the warm gate) + weight 600. **Scorekeeper**: constant header pill on every screen (the shell is tournament-scoped like admin) — 1 publicly-visible event in view → direct to its public Schedule; 2+ → the shared `multi` chooser popover (one row per event, sublabel "Public schedule"); none loaded → org public site (pill never absent). Pill fed from the page's own score fetch via a client context (never a second query) so the pill and game board can't disagree. **All flip hrefs — pill and in-content links — resolve through `lib/flip-twins.ts`** (coach/official hat → that event's public Schedule; no-tournament fallback → org root, fixing the latent `//schedule` bug); return labels: "⇄ Back to Coach view" / "⇄ Back to Scorekeeper".
**Rev 6 (owner call, at browser QA): every COACH flip door lands on the event's public FRONT PAGE (Overview), not the Schedule** — record-page pill, the Overview card's ⇄ link, and all list-row links (one resolver rule; this also restores where the pre-Flip Fan-view links pointed). The OFFICIAL/scorekeeper hat keeps its Schedule landing (scores are the volunteer's whole job — chooser rows + sublabel unchanged). Amends the ratified §1 table's "coach shells → public schedule" line; resolver tests updated (27 pass).
**Rev 5 (owner call, at browser QA): the coach overview's one-tap "Get alerts for your team" row is REMOVED — on BOTH tiers, component deleted.** Rationale (owner): follow/alert affordances already exist in plenty of public-side places; the portal must not push follow at the coach from every surface. This consciously AMENDS the P2 N3b relocation decision ("coach one-tap alerts row → relocates into the coach shells' overview … no coverage gap") — coverage now = the public fan surfaces (follow strip / Teams tab / alert prompts / Account → Notifications), reachable via the ⇄ Fan view door; the coach guide FAQ points there. `CoachGameAlertsRow` (+css) deleted; `pickAlertRegistration`/`AlertRegistration` removed from `lib/coach-alert-registration.ts` (which now only feeds the event-card context); `CoachLiveEventCard` = event card + ⇄ link only. Related QA find, fixed platform-wide in `lib/push-client.ts`: every push opt-in hung forever on dev (unguarded `serviceWorker.ready` await with the SW deliberately unregistered in dev) — now fails honestly; device push is QA-able on prod builds only.
**Rev 4 (owner call, at browser QA of the built rev 3):** the Overview's floating ⇄ link read as context-free when the page's phase card wasn't about the tournament ("Nothing on your schedule") — the Overview block is now **self-contained**: a NEW shared `components/coaches/CoachLiveEventCard.tsx` (+css) opens with a compact event card — **lifecycle chip in the SAME language as the Tournaments-list chips (ink-on-lime LIVE with pulsing dot / info-tint UPCOMING — not the mockup's placeholder red) + event name + dates** — with the ⇄ Fan view link beneath it and the game-alerts row attached below (children). Both tiers render the identical block near the top of the Overview; the free tier's old under-history link slot is REMOVED (one door, not two). `pickFanViewRegistration` now carries name/startDate/endDate for the card. Artifact updated to rev 4.
**Applies to:** `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` §3/§5 (P3), `CoachTournamentRecord.tsx` (pill + single-sourced public links via exported `publicHref`/`publicGamePageHref`/`publicTeamPageHref`), both overviews (rev-4 `CoachLiveEventCard` block), all three tournaments lists, `components/volunteer/ScorekeeperFlip.tsx` (provider/pill), the score API select (+`slug`, NO migration), `resolveScorekeeperFlip`/`flipOriginLabel` in `lib/flip-twins.ts`, record-aware public→coach hats in `lib/tournament-viewer-hats.ts`. Built on dev, uncommitted (owner reviews first). Refines the 2026-07-22 ratification's P3 slice (the "premium slim mobile top bar" is DEAD — never build it).

### 2026-07-22 — "The Flip" P1 REVISED: a shared collapsing ADMIN HEADER replaces the floating desktop pill (owner-approved mockup `ebc24a16-51db-4393-bd60-6c43127481ac`)
**Decision (owner, 2026-07-22 at P1 browser QA):** the Phase-1 floating desktop corner pill is REJECTED (it collided with each page's own action buttons — Export/Add Team). Replace it with a **persistent shell-level admin header on every admin screen** (desktop + mobile). **Binding visual spec = mockup artifact `claude.ai/code/artifact/ebc24a16-51db-4393-bd60-6c43127481ac` (rev 1, owner-approved).** The header shows event identity (icon + tournament name + **Live/Open/Draft/Completed** state pill + a meta line = date range), with the FlipPill anchored top-right; it **collapses on scroll** to a slim name+state+pill strip and expands at the top — mirroring the public event header (one-product feel). **Two-level chrome is accepted:** the shell header owns event identity + the flip; every page keeps its own UNCHANGED section header (Teams/Schedule…) + action buttons below. This header **retires BOTH the P1 floating desktop dock AND the mobile top bar** (folded in); the mobile notification badge stays in More (P1 unchanged). Admin is a **dark-only** surface — the header is dark HUD, neutral (never event-branded) pill.
**Off-tournament target (owner call):** on tournament screens the pill flips to that tournament's public twin (mapped page, else the event's Overview/front page — the "never absent, never a wrong guess" fallback, labeled `⇄ Public · Overview`, staying inside THAT tournament's public site). On non-tournament admin screens (org admin, house league, rep teams, accounting, public-site editor) the header shows the ORG identity and the pill reads `⇄ Public site` → `/{org}` (the org's main public site). Focused shells (onboarding/help/preview) render no header — the draft preview keeps its own Exit-preview pill.
**Applies to:** `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` (REVISION 2026-07-22 section) + `_PM_BRIEF.md`; new `components/admin/AdminEventHeader.tsx`, retiring `components/admin/AdminMobileTopBar.tsx` + the `AdminChrome` floating dock; `lib/use-admin-flip.ts` extended for the org-site target. Built into the uncommitted P1 unit on dev (one commit). Supersedes the P1 slice of the 2026-07-22 "The Flip RATIFIED" entry that placed the desktop pill as a floating content-corner control.

### 2026-07-22 — "The Flip" RATIFIED: one top-right FlipPill on EVERY surface for role⇄public navigation; account sheet RETIRED; mobile admin bell → More; public header share → Overview row (amends the 2026-07-20 §4 door map + 2026-07-21 chip entry)
**Decision (owner ratified rev 2 of artifact `23f4dbce-60dd-42c1-b9ec-7ca6597651e7` — the binding visual spec):** operators (admin/coach/official on THIS event) get ONE FlipPill in the top-right corner of every surface — public tournament pages (replaces the initials chip in its slot), admin shell (mobile top bar + desktop content header), both coach shells (premium gains its FIRST slim mobile top bar, warm-native), scorekeeper. It flips **same-tab, page-matched both directions** (Schedule⇄Schedule, game⇄Results w/ highlight, Standings→Results w/ "standings come from these scores" sublabel, Teams⇄Registrations, News⇄Communication), reads `⇄ Back to {origin}` right after a hop (sessionStorage, stateless twin fallback), shows a compact roles popover for multi-hat, `⇄ Preview` on drafts, and falls back to `Public · Overview` on unmapped admin screens — **never absent in a shell, never rendered for fans**. All `target="_blank"` in this loop is REMOVED (desktop included; ctrl-click still works). AdminContextStrip gains a post-finalize `✓ Score saved — See it live ›` nudge.
**Displacements:** TournamentAccountSheet RETIRED (hat rows → pill; coach one-tap alerts → coach overviews, same phase; fan rows were duplicates — follow strip / Teams tab / alert prompts / install prompt / Account tab). Mobile admin notification BELL → "Notifications" row in More + unread count badge on the More tab (desktop sidebar bell unchanged). Public header SharePageButton → share row on Overview (game/champions content shares unchanged). "View Site" retires from admin sidebar footer; a page-matched same-tab mirror row stays in mobile More for one transition release.
**Explicitly NOT amended:** 4-tab consumer bar (fans byte-identical; R1 intact), P0-2 chrome budget (pill = slot swap, zero net height), P0-3 preview identity-chrome rule (companion "Exit preview → Dashboard" pill is navigation, not identity), consumer red-badge policy (the More notification count is admin-shell-internal, mirroring today's bell count). Alternative "Operate tab" (bottom-nav slot-2 swap) documented in the artifact as a phase-2 escalation only — do NOT build without a new owner decision.
**Applies to:** `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` (phases P1–P4, no migration) — new `lib/flip-twins.ts` resolver as the single mapping source, shared `FlipPill` component (client-fed on public via the existing anonymous-SW-safe viewer flow; server-fed in shells), reserved-width no-CLS mount. Closes seam findings B1/B3/B4/B5/B10 (item 8) + A8/A18/A19 + coach half of B21; companion-closes B14.

### 2026-07-22 — Warm is now the PLATFORM DEFAULT theme (owner) — OVERRIDES the TH-1 split default (coaches portal was dark-by-default); the warm coaches portal is publicly released
**Decision (owner, 2026-07-22 at Stage 6 release):** Warm is the default app theme for everyone. A user who has never chosen a theme now sees **warm on both the consumer app AND the coaches workspace** (previously the coaches portal defaulted DARK per TH-1). Dark becomes a pure opt-out: only an explicit stored `dark` preference renders dark. **This OVERRIDES the TH-1 nuance** ("consumer shell defaults warm, coaches portal defaults dark") — both shells now default warm; the single account-wide preference (TH-1 RIDER) is unchanged.
**Mechanism:** the root no-flash script sets `data-user-theme='warm'` for everyone except an explicit stored `'dark'` (was: attribute absent for non-choosers). Safe by construction — **no non-coach CSS keys off `[data-user-theme="warm"]`** (only the coach-marker gate does, and it's scoped by `[data-coach-warm-enabled]`; the consumer's dark override keys off `[data-user-theme="dark"]`), so admin/tournament/scorekeeper are byte-identical and the consumer stays warm exactly as before. The warm coaches portal's dev preview flag (`NEXT_PUBLIC_COACH_WARM_PREVIEW`) is RETIRED — the coach shells emit the warm marker unconditionally (the single public release, TH-5 §4). M2 unchanged: org-branded tournament pages still ignore the personal theme.
**Applies to:** `lib/no-flash-script.ts`, `lib/coach-warm-preview.ts`, `lib/user-theme.ts`, `components/consumer/AppearanceCard.tsx` (picker copy now names the coaches workspace). Committed to dev `c23feb82`. ⚠ mig 195 (`user_preferences`) is on dev but PROD-PENDING — must ride the prod bundle. Deferred: PWA status-bar tint on coach routes (mobile-only). Reverses the coaches-dark half of [[project-warm-coaches-portal-followup]] TH-1.

### 2026-07-22 — Warm portal: olive is a TEXT/BORDER/tint accent ONLY, NEVER a button FILL — the warm primary button is ink-on-lime everywhere (owner-reinforced at Stage 5 review)
**Decision (owner, 2026-07-22 during Stage 5 browser review):** In the warm coaches portal, `--home-olive` may be used for text, borders, focus rings, and faint background *tints* (`--home-olive-soft`), but **never as a solid button fill.** A solid olive button was tried on the tryouts primary CTA ("Open day-of check-in") and the owner rejected it ("don't like this olive color"). **The single warm primary-button language is ink-on-lime** (`--home-lime` fill + `--home-lime-ink` text) — shared by `.btn-lime`, the coaches `.btnPrimary` CTA, and now the global `.btn-primary` warm override. A secondary/outlined action that must sit apart from a solid-lime element uses an olive **outline** (olive-soft tint + olive border + olive text), e.g. the tryout "Accept to roster" button beside the solid-lime "Offer" chip. This is a specific application of the E3 rule (lime-as-text darkens to olive; lime-as-FILL stays true lime) extended to make explicit that olive-as-fill is out of bounds for buttons.
**Rationale:** olive fills read muddy/unappealing on cream and collapse the button hierarchy; ink-on-lime is the bright, glare-legible, on-brand warm primary already ratified for CTAs. One primary language keeps the portal coherent.
**Applies to:** `app/globals.css` warm gate (`.btn-primary` override), any future warm-portal button work; status fills (amber/live) for waitlist/cut chips keep their solid semantic hue + white text (not affected). Part of Warm Portal Stage 5 (`WARM_PORTAL_STAGE5_6_BUILD_PROMPT.md`), dev-gated, uncommitted.

### 2026-07-21 — TH-1 RIDER (owner-explicit): the theme preference is ONE ACCOUNT-WIDE setting — never per-workspace/per-shell toggles; every surface that gains theme support reads the SAME preference
**Decision (owner, 2026-07-21):** A user's theme choice is a single account-level setting that follows them across every platform-neutral surface — the consumer app today, the coaches portal when its warm leg completes (TH-5 full-coverage rule), and the tournament-admin screens if/when the toggle extends there (still deferred; when it joins, it READS the same account preference — it never gets its own control). **The Account → Appearance card is the ONLY home for the control** (single-home rule) — no per-portal/per-workspace theme toggle may ever be added. Confirmed against the build: mig 195 `user_preferences` is keyed on `user_id` alone (identity-scoped; the migration's own comment states "NOT membership-scoped, so a multi-org user carries ONE theme everywhere and never forks it per org") — the built storage already satisfies this rider; this entry makes the PRODUCT rule binding so no future surface introduces a second control or per-workspace fork.
**Nuance preserved (unchanged from TH-1):** per-shell behavior differs only in the *default* for users who never chose — consumer shell defaults warm, coaches portal defaults dark — and an explicit pick overrides the default on every governed surface. M2 unchanged: org-branded public surfaces ignore the preference entirely (org brand always wins there).
**Applies to:** the shipped Appearance card (no change needed), `WARM_PORTAL_THEME_OPTION_PLAN.md` (portal reads the same preference at its full-coverage release), any future admin-theming proposal (must consume the same preference, no new control).

### 2026-07-21 — Nav-merge refinement (owner, at build QA): the tournament header account chip is HAT-GATED — a coach/admin/official TOOLS door only, REMOVED for fans (amends the 2026-07-20 + 2026-07-21 nav-merge door maps §4)
**Decision (owner ratified 2026-07-21 during Phase 5 browser testing):** On public tournament routes the top-right header **identity chip renders ONLY for a signed-in coach / admin / official** — a viewer who holds a hat on THIS event. It is their event-scoped **tools door** (Coach view / Open admin / Scorekeeper), the sole in-page jump back to their own workspace. It is **removed for plain fans** — signed-out visitors and signed-in fans with no hat here get **no header chip** at all. The desktop coach still gets the labeled "· Coach" pill; on mobile it's the plain initials circle (unchanged for hat-holders).
**Rationale:** the persistent global bar (Home · Scores · Chat · **Account**) now sits on every tournament page, and the "Follow this tournament" strip sits directly under the event header, so for a fan the chip **duplicated** sign-in/account (→ the global **Account** tab) and follow (→ the strip + **Teams** tab) while eating scarce header width beside Share on the SE-class header (owner flagged it as redundant clutter). The chip's one genuinely-unique value is the hat rows, which the Account tab can't reach (it lands on the fan account, not the event's coach/admin/scorekeeper view) — so it is kept exactly, and only, where it is not redundant.
**Amends** the **2026-07-20 "Tournament Nav Unification (Unified Home IA Phase 5)"** entry (§4: "keep the event-scoped identity doors … the fan **alerts bell**, follow-a-team, and sign in/out in a **small header identity chip**") and the **2026-07-21 "Nav Merge Phase 0 ratified (P0-1…P0-4)"** door map: the **fan-facing scope** of the header chip (fan sign-in / sign-out / follow-a-team / bell) is **withdrawn** — the chip is a **tools door only**. Fans reach those doors elsewhere: the bottom **Account** tab (sign-in/out, account), the follow strip + **Teams** tab (follow), and **Account → Notifications** (score alerts). Does NOT touch the persistent global bar, the venue-following skin, the top-tab row, or any other Phase-5 decision.
**Applies to:** `components/public/TournamentAccountSheet.tsx` (chip render gated on `viewer.hats.length > 0`; the signed-out person-icon button removed) + `TournamentAccountSheet.module.css`. Built + verified 2026-07-21 (Playwright, anonymous 390px: header = event title + Share only, `accountChipPresent=false`); in-app help (`lib/help-content/tournaments.tsx`) synced to describe the chip as the coach/admin tools door, not a fan affordance. Part of the Unified Home IA Phase 5 nav-merge build (`UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PLAN.md`) — on dev, uncommitted.

### 2026-07-21 — TH-5: Warm-portal ROUND-2 hard frames RATIFIED (artifact `bb6c9b81-6148-4808-aa52-288ec993409f` rev 1 = binding, joins the round-1 artifact as the visual spec) + both carve-outs resolved (chat follows the theme; tryouts warm WITH the sunlight floor) — the warm-portal BUILD gate is now OPEN
**Decision (owner approved the round-2 artifact + answered both carve-outs 2026-07-21):**
1. **Round-2 frames binding:** Schedule add/edit modal (warm ink scrim, paper inputs, olive focus ring, 6-type dot-chip row) + detail slide-over (score editor w/ deep-green W chip; RSVP editor — In=olive/Late=amber/Out=live/No-reply=dim; amber lineup-mismatch banner) + Month grid & mobile day sheet (≤3 dots, "+N more" → white sheet, today = ink ring) + the **warm drag-and-drop affordances** (dim-ink grip, in-flight row at 60% opacity + card shadow, mobile up/down chevrons + sticky lead columns unchanged) + the warm Depth Chart board + the two boundary handoff frames (warm portal → dark admin; warm portal → branded tournament — deliberate full-theme change at the door, never mid-page).
2. **Four NEW warm decisions ratified with it:** ① **unified clash color** — in the WARM lineup builder both clash cues (column-header number + prose warning) render warm live-red `#D9482B`, and clashing cells tint; amber stays for soft warnings (couldn't-fill, uneven bench). The dark builder's current red-header/amber-prose mix is UNCHANGED (fixing dark is a separate call). ② **olive-alpha heat ramp** — playing-time heat cells use `rgba(--home-olive-rgb, α)` on paper instead of lime-alpha; zero = dim dot. ③ **warm 3-tint Best/Okay/Never** for the depth chart: Best = olive tint w/ the rank number in INK (not white, not lime), Okay = `--home-blue` tint w/ ✓, Never = live-red tint w/ ✕; the DARK board keeps its 2026-07-02 pinned palette untouched. ④ **gold-strong A-squad star on warm** — the star renders `#856611` (the gold-strong value) with no glow on white; dark keeps pastel gold + glow.
3. **Carve-outs resolved:** **Coach Chat follows the theme** — a warm portal shell makes warm "the shell's existing chat skin," the sanctioned R3-3 reading (one engine, per-shell presentation); includes a warm pass on the coach chat's own room-list/master-detail chrome. **Tryout-day surfaces go warm WITH the sunlight floor enforced** (solid fills + bold weight + explicit text labels, never color-alone, pale accents out of the signal path — the floor is a hard design constraint inside the warm variant, and light-on-paper is the glare-friendlier ground).
4. **Release rule (half-warm trap, toggle level):** the coaches portal joins the theme toggle **only when its warm coverage is COMPLETE** — until then the portal renders dark regardless of preference (build stages land behind an internal dev flag; one public release). The Appearance picker copy must not promise the coaches workspace before that release.
**Applies to:** `docs/projects/active/WARM_PORTAL_THEME_OPTION_PLAN.md` + `_PM_BRIEF.md` (the build plan this ratification unlocks; build sequenced after the Theme Toggle Foundation ships + coaches-segment debt tranches). Binding visual spec = round-1 artifact `f503dfc9…` + round-2 artifact `bb6c9b81…`; build labels every element NEW/RESTYLED/UNCHANGED against them.

### 2026-07-21 — TH-3a RESOLVED (at the Theme Toggle cleanup build): operator chrome PINNED to a platform constant, NOT org-brand-following
**Decision (owner, 2026-07-21 during Phase 1 of the Theme Toggle Foundation build):** the TH-3a open flag is resolved in favour of **pinning** operator chrome to the platform blue — a custom org's brand colour must NOT reach the coaches portal or admin. Rationale (owner): org brand is a *public-presence* promise; internal operator surfaces aren't public, and the platform blue drives ~887 structural refs (borders, focus rings, panel glows, labels) with **no contrast-guard**, so letting arbitrary org hues in risks illegible/clashing operator chrome for zero brand-consistency benefit. **Implementation:** a new `--platform-primary` / `--platform-primary-rgb` constant in `app/globals.css`; BOTH the default `--primary` family AND the operator `--blueprint-blue` family derive from it, while the per-org `[orgSlug]` layout overrides ONLY `--primary` (public surfaces). Net: **zero visual change for every org today** (byte-identical), org brand stays public-only, and a FieldLogicHQ platform rebrand is a single-line edit (`--platform-primary`) that moves the default primary + all blueprint-blue operator refs together. **Rebrand checklist:** to move the platform structural blue everywhere, edit `--platform-primary`/`-rgb` in `app/globals.css`; org brand never touches operator chrome. **Supersedes** the analysis's TH-3a "leaning (a) follow-org-brand" note.
**Applies to:** `app/globals.css` (token reconciliation), `THEME_TOGGLE_FOUNDATION_PLAN.md` Phase 1. Operator token-debt now ratcheted separately (`--scope=operator`, baseline `scripts/.operator-token-baseline.json`, report `docs/projects/active/OPERATOR_VISUAL_TOKEN_DEBT.md`).

### 2026-07-21 — Theming ratification round (TH-1…TH-4, owner-decided in-chat; artifact `f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e` rev 1 = the ratified DIRECTION): user-theme vs org-brand precedence (M2), warm coaches portal = a THEME OPTION, build order, round-2 hard-frame gate
**Decision (owner ratified all four at the recommendations, 2026-07-21; source analysis: `docs/projects/active/WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md`):**
1. **TH-1 — Precedence model M2: org brand always wins on org-branded surfaces.** Public tournament pages, org home, and public team pages opt OUT of any personal theme entirely — a visitor/coach always sees the organizer's branding there. A personal theme preference governs ONLY platform-neutral chrome (consumer shell now; the coaches operating portal once its warm leg exists; admin deferred; scorekeeper excluded — guest-link sessions have no account to carry a preference; org-branded public pages never). Mechanism: a NEW `data-user-theme` attribute on `<html>` (never reuse `data-color-mode`, which stays the org/tournament authority; the two domains are architecturally non-overlapping today and must stay that way — one authority per token, the discipline this repo has relearned three times). Persistence: account-level source of truth (new user-level preference field — prerequisite `/db` migration) + localStorage fast path + the proven root-layout no-flash script pattern (consolidate the density script's dead exported constant while there, don't add a third hand-copy). Preference values include a `default` state = each shell's current default (consumer shell defaults WARM as today; coaches portal defaults DARK) so non-choosers see no change. Generalizes R1-2 (venue handoff) + nav-merge P0-1 (bar follows the venue). **Consistency note vs P0-1:** on tournament routes the global bar follows the VENUE (org/event theming), never the personal theme — M2 and P0-1 compose, no conflict.
2. **TH-2 — The warm OPERATING coaches portal ships as a THEME OPTION behind the toggle (dark stays default), never a permanent unconditional reskin.** All warm-portal CSS is written scoped to `[data-user-theme="warm"]` from day one — no retrofit. Rev-1 artifact frames 1–9 are the ratified direction (warm chrome, Team Overview, the NEW warm dense-table primitive on Roster, Schedule list w/ tokenized warm-legible event-type palette, Dues ledger + warm money colors, mobile card reflow, warm More sheet replacing the hard-coded dark sheet, team-color guards incl. near-white hairline + live-red hue exclusion, Appearance picker, 3-theme comparison). **The portal BUILD itself is NOT yet ratified** — gated on round-2 hard frames: Schedule add/edit modal + detail slide-over (RSVP editor) + Month grid, the Lineups drag-sortable batting order + per-inning grid, the Depth Chart board (bespoke pinned palette), a warm→dark boundary transition (portal→admin/tournament), and the Light theme if pursued. Carve-outs stay carved: Tryouts/day-of surfaces keep the sunlight floor as their own decision; warming Coach Chat requires the explicit R3-3 reading (a warm portal shell makes warm "the shell's existing chat skin", satisfying per-shell presentation) to be confirmed at portal-build ratification plus a pass on the coach chat's own chrome.
3. **TH-3 — Build order: cleanup first, then the consumer switcher.** (a) ~2-day cleanup: alias `--blueprint-blue`/`-rgb` to the `--primary` family (887 refs/70 files today miss every brand change) + extend the token ratchet to the operator segments (new scan roots + a SEPARATE operator baseline/report — small script work, not a config flip) + wire into `verify:changed`. **Open flag to resolve AT cleanup build, not silently:** after the alias, a custom-branded org's `--primary` would start reaching coaches-portal accents (today pinned to platform blue via `--blueprint-blue`) — decide follow-org-brand vs pin-portal-to-a-platform-token before the alias ships. (b) Consumer shell **Dark⇄Warm switcher**: Appearance card on the Account tab (rev-1 picker frame = the spec), the `/db` preference migration, no-flash script, pref-aware warm gating for the four consumer tabs (the S1-1/S1-2 warm sign-up JOURNEY stays always-warm — an acquisition surface, not preference-governed), dynamic `theme-color` meta so the OS status bar follows the theme. **Light is deferred** — no neutral-light theme exists anywhere; it's net-new design, a fast-follow candidate, never a blocker.
4. **TH-4 — Round-2 mockups run as the next design round** (parallel with the cleanup/switcher build), so the warm-portal build decision is ready when the owner is.
**Rationale:** building the warm portal as a permanent reskin first would mean redoing ~27–29k lines of styling the moment a toggle needs it conditional; as a theme option it is pure coach-side upside with dark preserved for everyone else. M2 is the only precedence model safe by construction (zero authority collision) and protects the paid branded-space promise.
**Applies to:** `docs/projects/active/THEME_TOGGLE_FOUNDATION_PLAN.md` + `_PM_BRIEF.md` (cleanup + switcher build), the round-2 mockup round, and any future warm-portal build plan (which gets its own `_PLAN`/`_PM_BRIEF` + `/design` + `/review`). Analysis + corrections log: `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md`.

### 2026-07-21 — Nav Merge Phase 0 ratified (P0-1…P0-4): venue-following bar skin (amends 2026-07-20 D-B), 39%/26% chrome floor + collapse matrix, preview mirrors live, champions pages keep the bar
**Decision (owner ratified all four at the recommendations on the Phase 0 artifact `claude.ai/code/artifact/bba366b6-…` — the binding Phase 0 spec; Phase 0 of the nav merge is COMPLETE, build may start):**
1. **P0-1 — Bar skin inside tournaments = "follows the venue" (V3). AMENDS the 2026-07-20 nav-merge entry's "platform-neutral dark" item**, which was overtaken by the Unified Home Phase 5 build warming the consumer bar (`.warmVars` + `.topbarWarm`/`.bottomNavWarm` — the bar's skin already follows the surface). Binding rule: on tournament routes the global bar renders in its **default token skin with NO warm classes** — the tournament's existing unscoped `:root` overrides then drive it (dark event → dark bar; `colorMode:'light'` event → light bar via `buildPublicLightModeCssVars`, exactly how the tournament's own `BottomNav` themes today), and the active tab tints via the event's `--primary-light`. **Rejected:** V1 warm-bar-everywhere (paper slab on branded-dark pages = the seam we're removing) and V2 hard-held-dark (black band on light events). Consumer routes keep the warm bar untouched — warm still means "your space"; the skin switch at the tournament door is the same deliberate theme-handoff moment as R1-2.
2. **P0-2 — Chrome floor + collapse matrix (binding build constraint):** total fixed chrome ≤ **39% at rest / 26% while scrolling** on a 667px SE-class viewport. Matrix: event header 116→48 collapse (G3, unchanged) · **TopTabs 40px pinned always** (never scrolls away — it's the nav) · ScoreTicker 40→24 (unchanged) · Schedule sticky day-label re-anchored beneath the tabs · MyTeamDock keeps G1 minimize rules · global bar 64px pinned, occupying the retired tournament bar's slot (net-zero new bottom chrome). **Rider (new rule):** the free-plan `TournamentAcquisitionBanner` folds into the `PoweredByBadge` corner chip while the ScoreTicker is live — game day is the worst moment to pitch organizers.
3. **P0-3 — Admin tournament PREVIEW mirrors the live layout:** same TopTabs row (basePath-driven), the tournament BottomNav's preview mode retires with the live one; preview stays identity-chrome-free (no account/chat/bell state). J6-057's hide-Home safeguard is moot for a scrolling row.
4. **P0-4 — Champions/celebration takeover pages KEEP the global bar** (quiet — the takeover art owns the hero; recap links are the most-shared URLs an event produces, never strand a first-time visitor).
**Applies to:** Unified Home IA **Phase 5** build (`docs/projects/active/UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PLAN.md` §2 carries the amended D-B + matrix verbatim; build kickoff prompt `UNIFIED_HOME_TOURNAMENT_NAV_MERGE_BUILD_PROMPT.md`). Sequencing precondition (Unified Home Phases 0–6 committed on dev) verified met 2026-07-21.

### 2026-07-20 — Phase 6 build refinement (owner, at build QA): whole-event follow strip is MOBILE-ONLY — desktop tournament pages omit it
**Decision (owner, 2026-07-20 during Phase 6 browser QA):** The "Follow this tournament" whole-event affordance (the under-header strip + the More-sheet "Follow this tournament" row) shows **only on phones (≤900px)** — desktop tournament pages omit it entirely. Rationale: following a whole event is a phone/QR-in-the-bleachers behavior; the warm consumer app is mobile-first, and a desktop tournament page is a lean-back/scout view. Follow **management** (seeing + unfollowing on Home, Scores, All following) stays at **every width**, so a desktop user still sees what they followed on their phone (with an account) — only the *create-a-follow* affordance is mobile-scoped. This also resolves a desktop layout problem: the desktop tournament layout doesn't apply the mobile unified-event-header clearance, so a top-of-page strip overlapped the header.
**Refines F1** (2026-07-20 Phase 6 mockup round): F1 placed the strip under the mobile unified event header and explicitly kept the follow OUT of the header (G5 "header keeps only Share" holds — the rejected alternative here was a desktop header follow icon, which would have violated G5). This refinement scopes the strip to mobile rather than adding a desktop equivalent. The **org-hero Follow button** on `/{orgSlug}` is UNCHANGED (shows at all widths — it's a separate public-org surface, not the tournament page, and org-follow is the year-round relationship).
**Applies to:** `components/public/FollowTournamentStrip.module.css` (`@media (min-width:901px){display:none}`), `TournamentAccountSheet` (`.eventFollowRow` mobile-only). Verified: strip renders inside `.page` on mobile (below the header clearance), hidden ≥901px.

### 2026-07-20 — S1-2 DECIDED: the WARM consumer look + the app's warm chrome extend to the ENTIRE Coaches Portal Premium sign-up JOURNEY (supersedes R1-4 "consumer-shell-only" for this flow; pulls S1-1 /start warm forward into the Founding Season Phase 3 launch)
**Decision (owner ratified 2026-07-20 — chose "Both: warm look + continuity"):** The Coaches Portal Premium sign-up **journey** becomes a first-class part of the warm mobile app. The seam is drawn around the **in-app acquisition journey**, NOT the coaches shell and NOT the marketing site. **Fully warm** (paper ground, white 14px cards, ink/olive, mono kickers, ink-on-lime CTA, olive-tint promo/Free pills — the R1-4 `--home-*` system): the `/start` "Coach a team" card, the in-app team/premium **signup** (`/start/team` + `/coaches/start`), the new **$0 comp confirm** screen, and the Premium **success** state. **Bounded warm insert:** the in-portal Basic→Premium upgrade prompts (Explore tab, per-page nudges, plan-detail panel) render the upsell *card* warm (the doorway into the journey) while the operating portal around them keeps the coaches-portal theme. **NOT warmed — `/for-coaches` stays the MARKETING theme (copy/CTA flip only):** it's a public marketing page whose siblings (`/for-tournament-organizers`, etc.) are all marketing-dark and it's reached via marketing/SEO, not from the app; warming only it would seam the marketing set. It gets the Phase-3 "coming soon → Start free / $0 until Jan 1" copy flip, not the warm reskin. **Unchanged:** the operational coaches portal itself (roster, schedule, fees, dues) stays its existing theme — deliberately NOT warmed (avoids the half-warm interactive-chrome trap that deferred `/account/notifications`; and would be a massive off-scope reskin).
**Continuity:** the warm journey wears the **consumer shell's warm chrome** (bottom tab bar Home/Scores/Chat/Account on mobile, warm top strip on desktop) rather than the coaches portal's own chrome — a coach entering from the app never loses the back-to-app anchor; signed-out shows app identity (wordmark + Sign in); nav shape never varies by auth state (R1 holds).
**Handoff:** the warm success screen's "Open your season workspace →" hands off into the operating portal in its own theme — the SAME deliberate seam as **R1-2** (warm = your space; the operating tool = walking into the venue), not a new inconsistency.
**Seam-avoidance (the `/account/notifications` lesson):** no paper-tint-over-dark; every warm surface warms ground + cards + form inputs + status banners + CTA together. Confirm/signup form fields use the warm input treatment (paper input, ink text, olive focus ring); reassurance/status banners use the warm status set (`--home-live`/`--home-amber`/olive), never the dark semantic tokens. The "$0" hero uses the mono data face in ink/olive (it's data) — raw `--logic-lime` never renders as text on warm (E3/R1-4 rule).
**Rationale:** owner wants the coaches sign-up to feel like the same polished mobile app a fan/coach already knows, not a drop into a differently-skinned surface. Scoping warmth to the *journey* (a decision moment, display-heavy, few inputs → cleanly warm-able) rather than the *operating portal* (dense interactive tool) delivers that without the half-warm seam. Reuses existing `--home-*` tokens — no new primitives.
**Applies to:** Founding Season Coaches-Free **Phase 3** build (`FOUNDING_SEASON_COACHES_FREE_PLAN.md`). Supersedes **R1-4**'s "warm = consumer shell ONLY; coaches portal keeps its theme" **for this journey only** (the operating portal is explicitly still excluded). Pulls **S1-1**'s deferred `/start` warm restyle FORWARD to ship with Phase 3 (start.module.css warm rewrite + sub-pages, per S1-1's own restyle scope). Refreshed warm mockups must be owner-ratified before build. **Flag at build start:** verify the coaches portal's current theme tokens so the warm-insert boundary + success→portal handoff land cleanly.

### 2026-07-20 — S1-1 DECIDED: get-started (/start) family goes WARM (Option A, as amended) — compact cards at every width; League/Club withheld from the chooser until ready (artifact `c6f4c1e1-32b6-43fb-b17a-e9fae1e59ad0` rev 2 = binding spec)
**Decision (owner ratified 2026-07-20):** The /start chooser + sub-pages (incl. the signed-out tournament heads-up screen) adopt the consumer-shell warm language — paper ground `--home-paper`, white `--home-radius` (14px) cards, ink type, mono kickers, `--home-olive` accents, olive-tint Free pills — extending R1-4's warm scope beyond the four tabs to the get-started family (this round was the explicit ratification vehicle). **Rider 1 (structure):** the compact three-column card (icon | text | arrow chip) applies on MOBILE too — the old ≤640px full-width bottom arrow-button variant retires (owner: "I like the new more compact structure"). **Rider 2 (content):** the chooser promotes ONLY what's live — League and Club cards removed until each is ready; League's card auto-returns (Free pill) when `LEAGUE_STARTER_BETA` opens; Club returns via its own decision; their /start sub-pages stay URL-reachable, unpromoted. Option B (warm Account-tab organizer sheet) NOT selected — remains a possible future layer.
**Rationale:** one consistent warm acquisition surface for every arrival; the compact structure keeps the whole chooser inside one phone viewport; not-yet-launched tiers on the front door dilute the free story ("promote what we currently have to offer").
**Applies to:** app/(consumer)/start/** (chooser, tournament heads-up, team/league/club pages). Admin console + coaches portal themes untouched (R1-4 boundary). Quiet-organizer-door principle unchanged.
**Sequencing:** Riders 1+2 SHIPPED immediately with the Phase 2 funnel fixes (dark chooser, live now). The warm restyle builds AFTER the coaches launch (FOUNDING_SEASON_COACHES_FREE_PLAN Phase 3) — not a launch blocker.

### 2026-07-20 — Unified Home Phase 6 mockup round (F1–F6) RATIFIED: free-first follow affordances, Home Organizations section, org page kept + button only, one-org-tile Scores rollup, current-state status vocab, full follow independence (artifact `d6a7c08b-9058-4533-9a2e-7cf989260848` rev 3 = the binding visual spec)
**Decision (owner ratified all six 2026-07-20 — F1 in its free-first form; app-faithful-colors rider applied same day):**
1. **F1 — Follow affordances:** “Follow this tournament” = a compact ≥44px strip **directly under the unified event header on the tournament Home tab** (NEVER a header icon — the G5 “header keeps only Share” rule stands) + a **More-sheet row** beside the follow-a-team door (rides wherever those doors move in the nav-unification project) + an **org-hero “Follow” button** on `/{orgSlug}`. **Instant, account-free follow** (free-first business decision, BUSINESS_DECISIONS.md 2026-07-20): signed-out taps follow immediately; one quiet dismissible nudge afterward offers sign-in (“every device, plus score alerts”) — never a wall, no auto-follow on return. States: ghost star “Follow this tournament” → dimmed saving beat → **ink-on-lime “★ Following”** (standard pillOn); tap again unfollows. The **claim-on-sign-in offer extends to all three follow types** (explicit, never silent) and **renders WARM** — it appears in the consumer shell post-sign-in; on-event affordances render in the event’s branded dark.
2. **F2 — Home “Following · Organizations”:** new section **directly below Following·Tournaments** (§3c order; absent sections omitted). Org card = round monogram + name + ONE context line, priority **live (“LIVE NOW · {event}”) → “NEXT · {event} · {dates}” → “{n} upcoming tournaments” → quiet off-season line** — **org cards persist off-season** (the year-round promise; sub-line “Off-season — their next event will show up here”). Whole-event follows reuse the tournament card with the event status as the context line (no team line). Both render signed-out from device follows. **All-following page STAYS** (owner question, clarified at ratification): the “All following ›” section-header link → the flat manage list, which gains an **Organizations group** + a **whole-event row type** (“Whole event · {dates}”); star=unfollow; Past events unchanged.
3. **F3 — Org landing page:** keeps its existing branded public look + content on every branch (public-site module page AND the simple selector page); Phase 6 adds ONLY the hero Follow button. Warm stays consumer-shell-only (R1-4 scope holds; the venue-handoff principle of R1-2 extends to org pages). Single-active-tournament orgs without a public site keep their existing redirect-to-the-event — fans follow the EVENT there; no new org profile surface.
4. **F4 — Scores org rollup = ONE tile per followed org** (option A): round org monogram + “Following” chip + one mono rollup fragment (“● N LIVE · {event}” / “N GAMES TODAY” / “N EVENTS THIS WEEK” / “NEXT · {date} · {event}”); tap → the org’s page (which self-routes when exactly one event is on). Tile present ONLY while the org has something live/upcoming/within the 1-week completed grace — Home holds the durable card. Never auto-spreads an org’s events into separate tiles (R2-2 concision holds); an org the user works for never gets an org tile (roles already surface its events). Whole-event follows add event tiles (“Following” chip) and NEVER add My-Games rows.
5. **F5 — Status vocabulary (current-state only):** tournament-follow lines = dates/starts-in → REGISTRATION OPEN → FIRST PITCH · {day/time} → “● N LIVE NOW” / “N GAMES TODAY” → PLAYOFFS ARE SET → CHAMPIONS CROWNED · {champ} → COMPLETED · {date} (dims to Past); org lines per #2. All computable from already-public data; **no activity history, no new push in v1** (2026-07-14 account-scoped alerts unchanged).
6. **F6 — Full independence:** a tournament/org follow **never seeds a my-team pin** (no dock/highlight fabrication); an org follow never auto-follows its events; team + whole-event follows in one tournament = ONE Home card (team context wins) and unfollowing one never touches the other; a role/workspace always outranks Following (dedupe).
**Colors rider (owner, same day):** the mockup dark frames were repainted to the REAL platform dark (`#0A0A0A` ground, lime `#D9F99D` default accent, `--danger`-family live chips, `--nav-mobile-bg` bar) — noting a real event wears its organizer’s brand accent; the claim sheet moved to the warm consumer look per #1.
**Applies to:** Unified Home IA Redesign **Phase 6** build — `docs/projects/active/UNIFIED_HOME_PHASE6_FOLLOWS_PLAN.md` + PM brief. Artifact rev 3 is the binding visual spec; the build labels every element NEW/RESTYLED/UNCHANGED against it. Free-first supersession of the plan’s “account-only for v1” is logged in BUSINESS_DECISIONS.md (2026-07-20).

### 2026-07-20 — Tournament Nav Unification (Unified Home IA Phase 5): global app bar persists on tournament pages, tournament pages move to scrolling TOP tabs; neutral bar; SUPERSEDES the "never two nav bars stacked" rationale
**Decision (owner ratified 2026-07-20; PLANNED — Phase 0 mobile vertical-space budget + mockup approval gate any build. Interactive proposal/mockups: the 2026-07-20 nav-unification artifact):**
1. **Persistent global nav on tournament pages + tournament pages → scrolling TOP tabs.** On public tournament routes (`/{orgSlug}/{tournamentSlug}/*`), the global consumer nav (Home · Scores · Chat · Account) becomes **persistent** (bottom bar on mobile, thin top strip on desktop), and each tournament's own pages move into a **horizontally-scrolling top tab row** directly under the branded event header (GameChanger pattern). The tournament's OWN mobile bottom bar (today's Home/Schedule/Standings/Teams/More) is **retired** — the two `position:fixed; bottom:0; z-index:200` bars cannot coexist, so the top-tabs move is what avoids a literal collision. New top-tabs component needs partial-tab peek + edge-fade mask + scroll-snap + active-tab auto-center (no public-shell primitive exists; do NOT adapt the admin segmented control). Desktop keeps its existing 248px `TournamentSideRail` — do not build a new desktop top-tabs component; only add the slim global strip above it.
2. **Bar-skin: platform-neutral, accent-tinted active tab only.** The persistent global nav renders in the shared **platform-neutral dark token system** (`--bg`/`--nav-mobile-bg`/`--white-45`/`--border`) — **NOT** the `.warm` consumer-body layer, and **NOT** a full per-tournament reskin. Only its **active tab** borrows the tournament's `--primary-light` accent (the tournament's unscoped `:root` brand override cascades to a root-mounted nav automatically — lean on that mechanism, add no literal hex). The tournament header + tabs + page body keep **full brand theming** exactly as today. `.warm` cream tokens are never ported onto the bar. Rationale: keeps the bar reading as "the app" (GameChanger's own bar never adopts a team's colours), sidesteps the warm-on-branded legibility problem by construction, and is the free/default path since the consumer nav chrome is already dark-token-based.
3. **Landing tab renamed Home → "Overview"; nested-context active states.** The tournament's landing tab is **"Overview"** (matches `TournamentSideRail` language), avoiding a two-Home collision on one screen. While inside a tournament, the global **Home/Scores tabs render in a NEUTRAL (not-active) state** — signalling a nested context, never falsely claiming the literal Discover/Scores page.
4. **News + Rules return as real tabs; More-sheet doors redistribute by type.** The scrolling row removes the 5-slot ceiling that pushed News/Rules into the More sheet (G5), so both come **back as ordinary top tabs**. The More sheet dissolves; its doors redistribute: **retire** the four now-redundant platform doors (Following, Your FieldLogicHQ, Browse tournaments, Live scores — the always-present global bar covers them); **keep** the event-scoped identity doors (Coach view / Open admin / Scorekeeper, hat-gated), the fan **alerts bell**, follow-a-team, and sign in/out in a **small header identity chip** (reuse the existing top-right `navActions` anchor). Register stays CTA-only (never a tab).
5. **Explicit supersession + amendments (record, don't delete).** This **supersedes** the prior "the tournament nav fully replaces the consumer nav on entry, so there are never two nav bars stacked" rationale (`UNIFIED_APP_CONSUMER_LAYER_PLAN` §8 — which itself deferred the fix to a dedicated design round; this IS that round). It **amends** **G3** (2026-07-14 unified mobile event header — KEPT, gains the tab row beneath it; the header's scroll-collapse + `--chrome-top-h`/`--chrome-top-static-h` composition must absorb the new tab-row height so the sticky Schedule day-label doesn't render under it) and **G5** (2026-07-14 More-sheet bottom nav — the More sheet and the tournament bottom bar are retired; doors redistribute per #4). It does **NOT** reopen **R1-2** (2026-07-18 clean theme handoff): this changes WHICH CHROME persists across the consumer→tournament boundary, **not** tournament colour theming — the "do not warm-theme tournament pages" instruction **still holds**. The bar is neutral-dark, not warm.
**Rationale:** Closes the deliberately-deferred §8 gap (no in-app path back to the directory once a fan drills into a tournament) and makes the product feel like one app with a guaranteed exit, while protecting the paid branded-space promise by keeping the shared bar visually quiet/neutral rather than hiding it or letting it compete with the organizer's brand. Two of the owner's original three goals (hidden pages drop a tab; chat reachable) were already met today — the load-bearing new win is one-app coherence + orientation. Source: 2026-07-20 12-agent nav-unification analysis (both nav shells, branding machinery, follow/chat model, prior ratified nav decisions).
**Applies to:** Unified Home IA Redesign **Phase 5** (tournament nav merge) — `docs/projects/active/UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PLAN.md` + PM brief. Phase 0 (mobile vertical-space budget matrix on an iPhone-SE floor + mockup approval) is the gate before any code; sequence AFTER the in-flight Unified Home phases commit + owner-test. Tier/packaging side (global bar universal, no plan-gated hide) logged separately in `BUSINESS_DECISIONS.md` (2026-07-20). Related tokens to reconcile at build: the `ConsumerShell` `4rem` vs `--bottom-nav-height:72px` drift, and extending `check-public-tokens.mjs` `PUBLIC_DIRS` to cover the nav CSS files it currently misses.

### 2026-07-18 — Unified Home Round 3 (Chat; R3-1…R3-3 owner-decided on artifact `claude.ai/code/artifact/a8622786-ea67-4063-a3d6-667d266dbbf7` — the binding Chat spec; MOCKUP PHASE COMPLETE, Account folds into the build spec with no Round 4 per owner acceptance)
**Decision (owner accepted all three at the recommendations):**
1. **R3-1 — Consumer Chat inbox composition:** rooms grouped by EVENT (mono kicker headers), newest activity first; per-room unread badge (olive fill `#57651E`, paper text) + rolled-up count on the Chat tab icon (red `#D9482B` nav badge); sender-prefixed one-line previews ("Organizer:" / "Coach Dana:" / "You:"); muted rooms show the slash-bell, dim, and are EXCLUDED from all unread counts. Tap → conversation; back → inbox. Warm inbox rows = white 14px cards, monogram tile, name sans-700 + preview dim.
2. **R3-2 — Safety sheet ships IN THE SAME RELEASE as the tab:** long-press any message → bottom sheet ("Message · {sender} · {time}" kicker): **Report to organizers** (danger-red row; lands as a queue item in the organizers' existing moderation panel) + **Mute this room** + Cancel. This is the launch bar for making chat permanently discoverable; member-only read/post rules unchanged.
3. **R3-3 — Rooms opened from the consumer app render WARM** (no skin-switch mid-flow): warm room = paper ground, incoming bubbles white w/ 4px-tucked top-left corner, outgoing bubbles olive-tint right-aligned, mono sender kickers ("Coach Dana · Chatham Storm"), pill composer + lime send button. The SAME rooms opened inside the coaches portal or admin keep those shells' existing chat skin — one engine, per-shell presentation.
4. **Logged-out + fan states (rendering sign-off of the ratified static-preview decision):** logged-out = "Example — not a real conversation" amber chip over a fictional 3-message thread + dual coach/organizer pitch cards (olive/blue accent family) + "Already on a team's staff? Sign in" row. Signed-in fan = honest empty state ("Chat opens up once you're on a team's staff") + the same two doors; NEVER implies fans/parents get chat.
**Applies to:** Unified Home IA Redesign Phase 4 (Chat tab build). Mockup Phase M is COMPLETE — Rounds 1 (Home, rev 4), 2 (Scores, rev 4), 3 (Chat) are the binding specs; the trimmed Account tab follows the plan's §3g content list + these established warm conventions without a separate mockup round (owner-accepted).

### 2026-07-18 — Unified Home Round 2 (Scores; R2-1…R2-3 owner-decided on artifact `claude.ai/code/artifact/63ec5baa-61fc-4ebf-8475-e44460def31a` rev 4 — the binding Scores spec)
**Decision (owner accepted R2-1/R2-2 at the recommendation; R2-3 grid chosen after strip-vs-grid comparison):**
1. **R2-1 — Two-lane Scores composition:** "My events" grid on top, "My Games" below with **Live pinned first always**, then Today / dated day groups / Yesterday backward; capped history behind a ghost "Show earlier results" button (no infinite scroll). Quiet days lead with a "Next up" list — never a dead page. Signed-out / zero-follows = platform-wide "Live around FieldLogicHQ" board + quiet sign-in pitch (S1 copy family). Union data source rendered per the ratified plan decision: coached/administered teams appear WITHOUT a follow, marked with quiet role chips ("Coach"/"Staff"; "Following" = fan follows); a team both coached and followed shows ONCE — role chip wins.
2. **R2-2 — Event cards NEVER expand into game rows on Scores:** tapping an event card deep-links to that event's own schedule page. A whole tournament/league is always ONE card here — this is the load-bearing concision rule; do not re-propose inline accordions.
3. **R2-3 — "My events" = two-column GRID** (GameChanger-familiar), **capped at two rows**; overflow becomes a dashed "+N more" tile that **expands the grid IN PLACE** (tile flips to "Show fewer"; tap-triggered, never navigates off Scores — All following on Home stays the *manage* surface). **Event lifecycle:** cards self-sort by timeline — live first, upcoming by next-game date, **completed always LAST** (dimmed ~0.6, mono "Completed · {date}" fragment, tap → event results/recap); completed events are the first tucked behind "+N more" and can never displace live/upcoming from the default four cells. **Grace window: a completed event stays in the grid ONE WEEK after end, then leaves Scores entirely** (remains followed; lives under All following → Past events).
4. **Warm Scores row conventions (rev 4 frames are the spec):** game rows = white 14px-radius cards; two stacked team lines, own team sans-bold, leading score ink `#241E15` / trailing dim mono; live meta line = red dot + "Inn N" + event · diamond in mono; finals collapse to one line + W/L chip (`#3E7A32` tint W / `#D9482B` tint L); filter row = `[All]` `[Live · N]` pills only, ink-filled active.
**Applies to:** Unified Home IA Redesign Phase 3 (Scores restructure); artifact rev 4 binding.

### 2026-07-18 — Unified Home Round 1 (R1-1…R1-4, owner-decided on artifact `claude.ai/code/artifact/de1c87a1-1b81-4026-b697-7406d63435c0` rev 3): WARM-LIGHT consumer-shell theme; tournament-first Following cards; tap→tournament home; All-following back pattern
**Decision (owner calls 2026-07-18; rev 3 of the artifact is the binding visual spec for the Home build):**
1. **R1-4 — The consumer shell (Home/Scores/Chat/Account + sub-pages) adopts a WARM-LIGHT theme** ("Option C"): warm paper ground `#F8F4ED`, white cards `radius 14px` with soft warm shadows, ink `#241E15`, dim `#8A8177`, hairlines `rgba(70,55,30,.1–.2)`. **Type softens:** entity names/labels/nav render in the sans face, normal case; the mono data face (`--font-data`) is RETAINED for scores, records, section kickers, and status fragments — game data must still read "sport". Brand carry-over: the wordmark and ink-on-lime chips survive; **raw `--logic-lime` never renders as text on the warm ground — it darkens to the olive family (`#57651E` accents, active-tab color, filled follow star)**, same principle as the public light theme's darkened-lime rule (E3 rationale). Live = warm red `#D9482B`; upcoming = amber `#A16207`; admin-blue chips keep `#2563EB`. Filter chips: pill-radius, active = ink-filled (`#241E15` bg, paper text). **Scope is BINDING: consumer shell ONLY** — tournament public pages, coaches portal, admin, and scorekeeper keep their existing themes; extending warmth anywhere else is a separate future decision. All subsequent consumer mockup rounds and builds render in this theme.
2. **R1-1 — superseded by R1-4:** the Discover blueprint seam-grid retires from the consumer app (browse/search results become rounded warm cards). This CLOSES the long-open "seam-grid vs shell-card reconcile later" inconsistency for the consumer surface.
3. **R1-2 — Tapping a followed-tournament card on Home lands on the TOURNAMENT HOME page** (existing page, unchanged): it already leads with the followed-team card and pins the score dock at the bottom (G5/G1 conventions). **The theme handoff is deliberate:** warm consumer app = "your space"; entering an event switches to the tournament's own branded/dark theme — reads as walking into the venue. Do not re-propose warm-theming tournament pages to "fix" this seam.
4. **R1-3 — Home composition approved:** Search ("Find a Tournament, Team, or Organization") → Pending invitations → Workspaces (existing context cards relocated, full role-chip fidelity) → **Following · Tournaments** (tournament-first cards per the two-tier follow model: tournament identity leads, "Your team · {name}" + live/next/last status line rides the card; Past events collapse) → Browse directory. Absent sections are omitted, never rendered empty; nav shape never varies by auth state.
5. **All-following sub-page (Mockup 4):** back link reads **"← Home" — the back affordance names the DESTINATION** (owner call), with the page title **"All following · N" right-aligned ON THE SAME ROW** as the back link (owner space-saving call, rev 4) rather than its own title line. Star = unfollow (filled olive on warm ground; the ink-on-lime chip stays the standard elsewhere). Score alerts are never managed here — one quiet pointer row to Account → Notifications (single-home rule, 2026-07-14). Entity-type groups (Tournaments now; Organizations/Teams later) + Past events.
**Applies to:** Unified Home IA Redesign Phase 1 build (`docs/projects/archive/UNIFIED_HOME_IA_REDESIGN_PLAN.md`); new warm-theme tokens to be introduced as consumer-shell-scoped CSS (naming at build time), never by overriding the global dark tokens.

### 2026-07-18 — Game-detail + team-page mobile package (GD-1…8 / TP-1…6, owner-accepted mockups; adversarially verified)
**Decision (owner accepted all 14 on artifact `claude.ai/code/artifact/3ae75916-2222-4e95-a6a0-e7cbb0c9c820`; each item except GD-7 survived a 35-agent two-lens verify — code accuracy + canon compliance; BUILT same day):**
1. **GD-1 card frame:** `.gameDetailCard` joins the sitewide card recipe — `border-radius: var(--radius)` + `box-shadow: var(--shadow-sm), var(--highlight-top)` — unconditionally (all states). **The broadcast marquee shell (danger glow/border) stays OFF this page**: the verify pass established the 2026-06-03 marquee exists to make one live game win against many rows; a single-game page has no crowd, so ambient glow is decoration and the "ONE soft chip" LIVE signal + score motion carry liveness. Do not re-propose a `detailCardLive` glow variant.
2. **GD-2 score:** score digits render through the shared `RollingNumber` odometer (`.detailScoreNum` carries the 2.75rem/950 marquee sizing; 2.1rem ≤640px). While live, the leading side wears `.bcLead`'s recipe verbatim (`--primary-light` + 18px primary glow → `.detailScoreLead`), trailing side `--white-70`; finished games keep W/L/T colours (now classes, not inline styles). Cascade guard: the outcome pill shell is attribute-scoped `span[data-outcome]` so it can never bleed into RollingNumber's spans; pill radius converged 999px → `var(--radius-sm)`, L text → `--danger-strong`.
3. **GD-3 avatars:** team monogram tiles appear above the team names **while live only** (finished/scheduled stay text-only) — the broadcast card's exact derivation (`hsl(teamAvatarHue(name), 58%, 42%)`, full display name) and recipe scaled to 36px/32px-mobile, `--radius-sm`, mono 900, #fff + text-shadow. Gated on the RESOLVED team object like the follow star (post-review) — a live window over an unresolved bracket slot must not mint a monogram for "Winner QF1"; the mobile avatar carries 0.5rem bottom clearance so the label row's 44px star tap box lands on whitespace, never the avatar.
4. **GD-4 one LIVE chip:** the duplicate `.liveBadge` above the score band is deleted — the top-rail chip plus score motion is the whole live signal.
5. **GD-5 pre-game:** the "Score TBD" slot renders the shared `Countdown` ("First pitch in …" / whenPast "Starting soon") inside the existing `.detailScorePending` wrapper — gated (post-review hardening) to `status === 'scheduled' && date && time && isGameUpcoming(game)` so cancelled/forfeited games and expired never-scored windows fall back to "Score TBD" instead of a contradictory countdown. While `isGameLive`, the score band renders unconditionally with running scores from 0–0 (`score ?? 0`, broadcast-card precedent) — a live page never shows "Starting soon". Time normalized `.slice(0,5)` per the Countdown time-format rule.
6. **GD-6 facts panel:** Stage/Status rows deleted (verbatim duplicates of the rail badges); panel = Division + **Game length** (`durationMinutes ?? default` min).
7. **GD-7 gold finale (owner-accepted flourish, not verify-covered):** `.detailStakesGold` — the championship stakes line wears the champion-gold warning-tint recipe (border .4 / bg .12 / `--warning-strong`); advancement/consolation/3rd stay blueprint-blue. `getPlayoffStakes` now returns `{text, gold}`.
8. **GD-8 follow stars (owner-flagged):** the per-team `TeamFollowStar` moves from its own row under each name onto the AWAY/HOME side-label line (`.detailTeamSide` is now inline-flex; star size 13). The 44px tap box is preserved via negative margins (`.detailSideStar`, ≤640px) so the label line stays ~16px — computed box stays ≥44px for the tap-floor harness. **Followed-state refinement (owner call, 2026-07-18):** on this surface the followed state is a **plain filled star, no chip** — `.detailSideStar[aria-pressed="true"]` kills the component's lime-chip background and fills the glyph with `var(--primary-light)`, the same theme-managed accent as the page's meta icons/panel headings, which stays legible in both colour modes (the standalone star's ink-on-lime pillOn chip — binding E3 — remains everywhere else; it exists because raw `--logic-lime` fails on the light theme, a problem `--primary-light` doesn't have). Rationale: the label line never moves with name length, so the two stars always align; placement beside the name was rejected (wrapping names drag an inline star). `TeamFollowStar` gained a `className` pass-through for host-surface variants.
9. **TP-1 order:** on the team profile, the live/next-game card renders directly under the hero. **TP-2:** the RUNS FOR / RUNS AGAINST stat tiles are DELETED (not relocated) — RD in the hero strip summarizes them, full RF/RA live in Standings; the verify pass rejected folding them into the hero strip because Round 3 locked it at exactly RECORD/POOL RANK/PTS/RUN DIFF, four cells, no scroll. **TP-3:** inside the card, the LIVE/next row renders before the Recent-results pips (forward-looking first).
10. **TP-4 contrast guard:** new `teamInk()` in `lib/team-color.ts` feeds `--team-ink` on `.profile`; `.heroAvatar` and `.followHeroBtnActive` use `var(--team-ink, #fff)` so warm auto-hues (e.g. "Bears U11" → hsl(44)) get ink text instead of failing-AA white. **Threshold = 0.2** (the white-vs-ink equal-contrast crossover), NOT themes.ts's 0.42 — the review proved 0.42 is unreachable at teamColor()'s fixed 45% lightness (max L≈0.43), which would have left the guard returning white for ~98% of hues.
11. **TP-5 one Following language:** the Teams-list `.followBtnActive` drops the org-primary tint for the team's own colour — `--team-color` set inline per button (full team name, matching the card avatar's hue), soft-tint via the same color-mix accent recipe as the profile (62% + white 38% dark / 80% + black 20% light).
12. **TP-6 housekeeping:** `.upcomingBadge` 20px → `var(--radius-sm)`; W/L/T chips + Recent-results pips + `.playoffTag` all converge on **`var(--radius-sm)` as the small-chip family radius** (pill 999px stays reserved for hero-header chips); the italic `vsLabel` becomes upright mono uppercase (`--font-data`, .62rem, `--white-35`) — italics stay out of this page; `.heroStats`/`.heroStatDivider` literals → `var(--white-8)`/`var(--white-10)`; `.gameRowLive` bg literal → `rgba(var(--danger-rgb), 0.05)`; the page's two local LIVE-chip recipes (`.liveTag`, duplicate `.liveBadge`, local `livePulse`) are DELETED — it imports the canonical `.liveBadge`/`.liveDot` from `schedule.module.css` cross-module (Playoff Picture precedent), restoring the pulse the copies dropped.
**Also rejected by the verify pass (do not re-propose):** `text-transform: capitalize` safety net on venue names (mangles legitimate casing; organizer-data issue), and re-chroming the game-detail back button (it already carries the ghost-chip treatment).
**Applies to:** `app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx`, `app/[orgSlug]/schedule/schedule.module.css` (detail* block), `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx`, `app/teams/[id]/team-profile.module.css`, `app/[orgSlug]/teams/teams.module.css` + `components/public/TeamsContent.tsx` (follow button), `components/public/TeamFollowStar.tsx`, `lib/team-color.ts` (`teamInk`).

### 2026-07-17 — Player Development 3D package: SIXTH Insights doorway tile "Development" (owner-sanctioned ceiling exception, D4 Option B) + `/history/development` report page + hub Insights door + previous-seasons archive rows + carry-forward banner (M5/D4 frames on the accepted mockup artifact)
**Decision (/design routing at 3D build start per the plan; mockups accepted and binding: `claude.ai/code/artifact/01f4f7a8-410b-4b68-b521-f9888a9d9d8e`):**
1. **Insights hub grows to SIX doorway tiles — a logged owner exception to the 5-tile hub ceiling (D4 Option B, owner 2026-07-17).** The new door is the LAST tile: question-titled **"Is everyone getting attention?"**, same `.insightsDoor` chrome as its five siblings, href `…/history/development`. Gate = `canViewMeasurables` (the board's identity rule: listing every minor's name requires roster visibility — notes-only assistants never see the tile). Summary line with data: "N of M players have a measurable · K active focus areas"; soft state (`insightsDoorSoft`): an invitation, never zeros; fetch is self-contained (awards-tile precedent) riding the board GET. This exception does NOT reopen the ceiling — a SEVENTH tile requires its own owner decision.
2. **Report page `/history/development`** = drill-in with its own "← Insights" back-link (breadcrumb is globally hidden); compact operating header (icon + "Development", sub carries the coverage framing); body = the **board's data face verbatim** (`.tableWrap.tableAsCards` + `devBoardTable`, phone reflows to cards): PLAYER · ACTIVE FOCUS · LAST MEASURABLE · HISTORY LINKED, **ROSTER ORDER ONLY, no sort affordances ever** — a coverage checklist, not a leaderboard. "History linked" renders the confirmed link's season label + ✓, honest — for the rest. Player cells link to profiles. Page is structured as stacked report SECTIONS (the coverage table is section one) so future player-vs-self analytics land as new sections without restructuring — any future section obeys the multi-domain rule (grid/tabs, never a long heterogeneous stack) and the scrapbook rule (no cross-season deltas). Empty states: no season → board-parity honest line; no data → one invitation sentence + where to start. Companion: `InsightReport` gains `'development'` (chip "Development"), and ONE conservative findings-engine rule — count-only, never names ("N players don't have a measurable yet this season — one session covers everyone"), `tone: 'info'`, silent until the team has real usage (≥3 players with a measurable) AND a real gap (≥2 without any).
3. **Development hub gains its Insights door** (the door deliberately omitted in 3B — no doors to nowhere): a whole-card `.insightsDoor` link to `/history/development` asking the SAME question "Is everyone getting attention?" (one learnable phrasing for one destination), ghost chrome — CP-1 holds, the hub's single lime stays "+ New session".
4. **Previous-seasons archive on the player-profile Development card (M5):** a "Previous seasons" `miniListLabel` section placed AFTER Measurables and BEFORE Context (this season leads; the archive is the shelf below it) — the M5 frame is abridged, not an ordering spec. Each confirmed prior season = one `miniRow`: bold "{season label}" + quiet summary ("2 focus areas (1 achieved) · 8 measurables · attendance 92%" — attendance QUOTED from the attendance summary, never recomputed) + a gray **"Archive"** pill (`badgeDraft` — parked-gray per M5; never success/gold). Rows **expand in place** (the measurable-row expand idiom) to read-only focus areas w/ status pills + per-test dated readings — plain rows, NO sparkline in archives (scrapbook density) and NEVER any cross-season delta/arrow; the section carries M5's framing line ("Shown as a record — never a computed better/worse than last year"). Chain-linked earlier seasons render oldest→newest. Deliberate: the archive never navigates to the prior season's editable profile page — viewing history must not put a coach one mis-tap from editing last year's record.
5. **Carry-forward banner (M5, head coach only, one-time):** blueprint-blue banner family (M5's `.banner`: `--blueprint-blue` border + low-alpha blue fill — the info/offer voice; amber stays continuity-verify, per the M4/M5 split), rendered directly under the confirmed-link audit line. Lead line + count-honest offer ("Bring forward the N focus areas they were working on?"), three actions per the mockup: ghost "View {season} record" (expands + scrolls to that archive row — no navigation), **lime "Yes, bring forward"** (the card's one-time lime moment, per the accepted frame), ghost "No, start fresh". Decided-once state persists server-side; the banner never re-renders after either answer.
**Rationale:** every element reuses an accepted convention (insightsDoor family, board data face, miniRow/expand idiom, badge family, G4 kickers, back-link rule); the only novel judgments are the ceiling exception (owner-decided), the archive's expand-not-navigate call, and the one-phrasing rule for the two doors to the report.
**Applies to:** Player Development 3D — `history/page.tsx` (sixth door), new `history/development/page.tsx`, `development/page.tsx` (hub door), `PlayerDevelopmentSection.tsx` (archive + banner + print), `lib/insight-findings.ts` (`'development'` report + rule).

### 2026-07-17 — Player Development 3B package: "Development" nav item (Squad group, primary — not Explore), hub = section-card GRID on desktop (M7's stack is the phone rendering), Evaluation-Session grid + Team board conventions
**Decision (owner accepted mockups M7–M9 2026-07-17 on artifact `claude.ai/code/artifact/01f4f7a8-410b-4b68-b521-f9888a9d9d8e`; /design routing at 3B build start per the plan):**
1. **Nav:** new **"Development"** item in the **Squad** group of the Premium coach nav (both `CoachesSidebar` and the mobile More-drawer), gated through the shared `lib/coach-nav-visibility.ts` switch on `canViewMeasurables(caps) || canViewDevelopmentGoals(caps)`. It enters as **primary, NOT Explore-state** — unlike Tryouts/Tournaments this is an owner-declared growth pillar being promoted, and its Evaluation-Sessions job exists before any usage signal could accrue (an Explore burial would strand the feature's first use). This is the owner-sanctioned consolidating exception to the IA rubric (Lineups-landing precedent: a front door for team-wide work, not a stack-on).
2. **Hub layout = the Insights-hub section-card idiom, NOT a stack.** Per the BINDING 2026-07-09 multi-domain layout rule, the hub composes as a dashboard card grid on desktop (`repeat(auto-fit, minmax(340px,1fr))`, dashboard-card chrome: `--white-8` bg, blueprint border, `--radius`, `--shadow-sm`/`--highlight-top`, hover glow+lift): **Evaluation sessions** card (the working card: "+ New session" + past-sessions list — the list may grow freely inside its card) · **Team board** whole-card link · **Test types** whole-card link/manage · **Development coverage → Insights** whole-card link · **"Practice plans — coming"** slot (dashed border, `--white-45`, non-interactive — reserves the Phase-4 room). Phones stack by physics = exactly M7's frame. **CP-1:** the hub's single lime = "+ New session"; every other card action is ghost/outline.
3. **Session run screen** (drill-in, so it carries its own "← Development" back-link — the coach breadcrumb is globally hidden): operating tool, no hero header; test picker = the worded select-one chip convention (lime-tint active + check, never solid primary); roster rows ≥44px (`--tap-min`), **ROSTER ORDER ONLY — never sort-by-result** (the supportive-not-ranking rule now has its first many-kids-numbers-side-by-side surface); progress = quiet mono "N of M entered" kicker; per-cell autosave with the quiet ✓ idiom; values in `--font-data` with `tabular-nums`; skipped/absent players show an honest dash, never a fabricated 0.
4. **Team board** (drill-in, own back-link): desktop = data-face table (mono kickers for column heads, `tabular-nums` values, sparklines via the shared `components/charts/Sparkline.tsx`); phone = per-player cards (the tables-reflow-to-cards rule); roster order only; read-only (no lime); gold stays reserved for the A-squad star if identity chips ever join the board.
**Rationale:** every element reuses an accepted convention (Insights grid, chip family, mono data face, tap floor, CP-1, back-link rule) — the only novel judgment is primary-vs-Explore for the nav item and the grid reconciliation of M7, both resolved above. No new tokens.
**Applies to:** Player Development 3B (docs/projects/active/COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md) — new `…/coaches/teams/[teamId]/development` hub + session + board routes, `lib/coach-nav-visibility.ts`, `CoachesSidebar.tsx`, `CoachesBottomNav.tsx`.

### 2026-07-16 — Tournament Mobile Polish ROUND 3 package (G1 + R3-1/2/3 accepted + built): dock auto-minimizes to a score pill on Schedule + team pages; compact team-page header w/ alerts bell; Teams tab joins the data face; team rows re-skinned; "Form" → "Recent results"
**Decision (owner accepted all four as recommended 2026-07-16 on the Round 3 artifact `claude.ai/code/artifact/0d4161cc-0583-4167-9bc6-78683508e3b9`; BUILT same day in the same chat):**
1. **G1 — dock overlap policy = auto-minimize (option b).** On the two routes that already tell the followed team's live story inline — the Schedule (pinned My Team card) and any team detail page (its own live row) — the My Team dock renders as a **compact right-anchored ★ + LIVE + score pill** (≥44px, the ticker's minimize idiom); tap restores the full bar for that visit (plain state, resets on navigation). Everywhere else the full 52px bar is unchanged; the expand panel (share/alerts/venue/unfollow) is untouched. The dock **never disappears** — it minimizes. The wrap stays full-width for the `--dock-clearance` publisher with `pointer-events:none` so the empty side never blocks page taps.
2. **R3-1 — compact team-page header (C7 + F4).** ONE ≥44px action row: Follow keeps its label (the page's primary act) and flexes; Calendar + Share collapse to 44px icon circles on ≤640px (labels stay on desktop — the icon+label-desktop/icon-only-mobile convention; labels in `aria-label`/`title`); the **score-alerts bell joins the row** (F4) — `FollowAlertsToggle` gains a `variant="icon"` (44px circle; ON = solid lime fill + ink glyph per the pillOn/E3 rule), gated by `useOrgNav()`'s `fanAlertsEnabled && !tournamentFinished` (the More sheet bell's gate); desktop mounts the labeled default variant. Stat strip, playoff chip, back link unchanged. The Recent-results live row gains the running score (team-first) — the page's own live teller under G1.
3. **R3-2 — Teams tab one data face (D5 + D7 + D11).** `.cardRecord` gains `tabular-nums` (completes the record convention); pool headings become G4 mono kickers with a right-aligned team count; rank · pts / next-game / live-opponent / pool-done lines join the data face (mono, uppercase, tracked — sans stays for identity/names); the coach qualifier renders as the quiet mono second line via the shared `splitTeamQualifier` (D3 convention; `team.coach` wins and renders "Coach: X", the raw qualifier is the fallback with no "Coach" prefix — a qualifier isn't always a coach). **No bell per team card** — alerts entry lives on the team page. **D11:** BottomNav `.label` joins `--font-data` (checked: Round 1's nav rebuild had NOT covered it).
4. **R3-3 — team-page Schedule & Results rows re-skinned to the schedule-row language (D10).** Mobile: one quiet mono context line (date · time, venue mono below the sans opponent), tabular mono score right-aligned, ~112px cards → ~82px rows; ordering = **live first (with running score, 0–0 before the first run), then upcoming soonest-first, then finished most-recent-first**; section title = G4 mono kicker + "N played · N live" count. Outcome letters stay gated to finished games — a live 5–3 shows LIVE, never W. **W/L/T chips (rows + Recent-results pips) move to the soft badge family** (success/danger tint + `-strong` text, both breakpoints) — solid green/red tiles retired, same family as the standings chips.
5. **Copy rider:** the team page's "FORM" label renames to **"Recent results"** — "form" is soccer/broadcast jargon for the softball/baseball audience; the W/L pips are unchanged.
**Rationale:** captures on the live seeded event showed the dock rendering the identical LIVE 5–3 directly over the team page's own live row and beside Schedule's pinned card; the team hero spent ~40% of the first screen on 3 stacked pills; the Teams tab was the last surface where a W-L-T record wore a different outfit. Everything reuses accepted conventions (G4 kickers, D8 chip family, tap-min floor, pillOn lime rule) — no new tokens.
**Applies to:** `components/public/MyTeamDock.tsx/.module.css` (pill state), `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx` + `app/teams/[id]/team-profile.module.css`, `components/public/TeamsContent.tsx` + `app/[orgSlug]/teams/teams.module.css`, `components/BottomNav.module.css`, `components/public/FollowAlertsToggle.tsx/.module.css` (new icon variant), `components/public/SharePageButton.tsx` (label wrapped in a span for responsive hiding). Verified: typecheck + verify:changed green; Playwright computed-style probes at 390/360 + light org + followed/anonymous (pill on schedule+team detail, full bar on home; mono faces + tabular-nums computed; no overflow). Desktop layouts untouched. This closes the plan's Round 1–3 design scope; Round 4 (day-first schedule) is the remaining build.

### 2026-07-14 — Tournament Mobile Polish ROUND 2 package (R2-1/2/3 accepted; built 2026-07-15, committed 2026-07-16 `94ccc8a1`): standings bracket embed folds off playoff day; Playoff Picture de-heroed to "Seeding & Matchups"; phone standings = TEAM · REC · RD · PTS
**Decision (owner accepted all three as recommended 2026-07-14 on the Round 2 artifact `claude.ai/code/artifact/a92fc65c-60a0-4439-a7f7-f388c929241c`; logged here at build close-out — the mockup chat's charter didn't write to this file):**
1. **R2-1 — Standings bracket embed folds outside playoff day (F3).** During pool play the embed collapses to a one-row "PLAYOFF BRACKET" `<details>` disclosure after the pool tables (children stay mounted, zoom state preserved; the bracket lays out on first open per division — a closed `<details>` measures zero width). Playoff-day/completed `bracketOnTop` auto-expand unchanged; Schedule's embed untouched.
2. **R2-2 — Playoff Picture de-hero (C2 + A7).** Under the unified header the page retitles to a quiet "Seeding & Matchups" kicker (never echoes Home's headline); keeps seeding list + opening matchups + ONE stat strip; narrative trims to a single lede; an unresolved final renders an honest "pending tonight" block (real time + diamond, plain feeder copy via numbered round labels — decided finals enter the matchup list via a teamId-aware unresolved gate, so the championship never vanishes when it goes live).
3. **R2-3 — Phone standings columns.** Mobile-only merge of W/L/T into one REC column so TEAM · REC · RD · PTS all fit with no horizontal scroll at 360 (PTS — the ranking column — was off-screen at every phone width); RF/RA stay behind the existing swipe; desktop keeps all seven columns. Capped-RD tournaments stack the cap under the true value on phones.
**Companion conventions shipped with it:** standings result chips joined the badge family with per-meaning colors (D8); ONE mono card-header idiom (D9); the trailing "(Coach)" qualifier became a quiet mono second line via the new shared `lib/utils.splitTeamQualifier` (D3 — reused by Round 3's Teams surfaces); all stat columns wear the data face with tabular numerals (D4); the pending marker compacts to the amber clock on phones.
**Applies to:** `components/public/StandingsContent.tsx` + `app/[orgSlug]/standings/standings.module.css`, `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx` + `components/public/PlayoffPicture.module.css`, `lib/playoff-picture.ts`, `lib/utils.ts`. Owner phone-tested 2026-07-15/16 with three test-driven refinements; /simplify + /review (6 fixes) + /docs ran before commit.

### 2026-07-14 — Schedule DAY VIEW package (Mobile Polish Round 4, D1–D7 accepted; BUILT 2026-07-17 as accepted, uncommitted): one day at a time behind the day selector, smart landing, day-first inside the day
**Decision (owner accepted all recommendations, 2026-07-14):** the public Schedule renders **one day at a time** (the fix for both test tournaments' game-day feedback: fans only cared about that day and scrolled too much). Bindings: **smart landing** = first game date ≥ today in tournament timezone (pre-event → first day, post-event → last day, gap day → next date with games; replaces scroll-to-today); **pool identity = a quiet mono tag in the row's meta line** beside diamond/venue ("9:00 AM / D2 · POOL A"), self-hiding for single-pool divisions (a beside-the-time tag was rejected — competes with the time column); **desktop gets the same day view + selector** (no mobile-only fork); **strict start-time order** within a day (no pool clustering); **whole-day progress count** across pools; **the "All" chip stays** (day-first grouped overview for planning/screenshots/review); **search + My Games auto-expand to all days** (never a false "no games today"); **the Pool Play/Playoffs stage toggle STAYS** — the merged pool+playoff single-timeline day view is rejected as the Round 4 baseline, reopenable only via the Round 1 control-stack work (C3/G5) — ⚠ relay this default to the review chat so its control-stack decisions don't assume a merge.
**Applies to:** the public tournament Schedule (Round 4 — docs/projects/active/DAY_FIRST_SCHEDULE_TIMELINE_PLAN.md; builds after Rounds 1–3). Companion selector-scaling entry below (D8).
**Copy rider (owner-accepted 2026-07-17, during the Round 4 phone pass):** playoff games are NUMBERED and slot references read in plain language everywhere on the public schedule surfaces — round badges use the numbered game label ("SEMIFINAL 1"/"SEMIFINAL 2", Championship rename kept; shared `lib/playoff-bracket.fanGameLabel`), and raw Winner/Loser-code placeholders render via the new shared `fanSlotLabel` (strict pattern only — custom organizer placeholder text passes through untouched). ONE wording on every surface (owner unified it same day after seeing both forms): **"Semifinal 1 winner" — identity first** — on schedule rows, the followed-card next-opponent line, AND the bracket diagram (LogicSyncBracket → schedule bracket view + standings embed); identity-first exists because card tail-truncation cut the number in the reference-first form (probe showed "Winner of Semifinal…" ellipsized identically for both semis). Sole per-surface split that remains: dashed multi-round codes (WB2-1 …) stay raw codes on `compact` bracket cards (kickers carry that mapping) and read "Winner of Winners Bracket, Game 1" on roomy rows. Rationale: both semis wore identical unnumbered "SEMIFINAL" badges, so "Winner SF1" pointed at nothing a fan could find. Matches the Playoff Picture's numbered-feeder vocabulary (R2). Candidate later adoption: the ticker's ambiguous "Final · time" label (Track A flag) could reuse fanGameLabel.

### 2026-07-14 — Schedule day selector (Mobile Polish Round 4, D8; BUILT 2026-07-17 as accepted, uncommitted — threshold constant 5): ONE selector, TWO presentations — roomy day chips while the whole event fits on screen (≈ ≤5 game dates), compact swipeable DATE RAIL beyond; selector entries = DISTINCT GAME DATES, never the calendar span
**Decision (owner-accepted 2026-07-14, Round 4 rev 2.2):** the public Schedule's day selector (single-day view + smart landing: first game date ≥ today in tournament timezone; pre-event → first day, post-event → last day, gap day → next date with games) scales by presentation, not by pattern swap. At the 3–4-day norm it renders as roomy weekday+date chips — whole event visible, nothing scrolls, segmented-control read. Past ≈5 game dates it renders as a **compact date rail** (the FIFA/ESPN month-long-event pattern): narrow "MON 15" cells ~7 visible at 390px, horizontal swipe with snap, landed day auto-centered, month label at the rail edge, today dotted even when unselected, and a "⋯" jump cell opening a plain date list grouped by week (bottom sheet mobile / dropdown desktop). Entries are built from **distinct game dates only** — a 6-week Saturday series is 6 cells, not 42. **Rejected:** week tabs (a hierarchy fans don't think in and the data doesn't model) and prev/next-arrows-only (hides the event's shape; multi-day hops = repeated taps). The switch threshold is a tuning constant.
**Rationale:** owner feedback from both test tournaments — game-day fans only cared about that day's games and scrolled too much to find them; the World Cup stress-test showed wide labeled chips are the wrong garment for a dense date axis while a scrolling date rail is the proven industry spine for exactly that case.
**Applies to:** the public tournament Schedule (Tournament Mobile Polish Round 4 — docs/projects/active/DAY_FIRST_SCHEDULE_TIMELINE_PLAN.md; builds after Rounds 1–3). Round 4's remaining decisions D1–D7 (pool-tag placement, desktop parity, time order, whole-day count, "All" chip, filter expansion, stage merge) stay open until build.

### 2026-07-14 — Public tournament mobile G5: bottom nav = Home · Schedule · Standings · Teams · MORE (one-tap flat sheet); bell + account doors live in the sheet; mobile header keeps only Share
**Decision (owner-accepted, Tournament Mobile Polish Round 1 rev 3):** the public tournament mobile bottom nav becomes **Home · Schedule · Standings · Teams · More** (More rightmost). **More opens a one-tap flat bottom sheet — never a page of sub-pages** (nesting an Account page inside More would put "Coach view" three taps deep; flat keeps every door ≤2 taps and reuses the coaches-portal More-drawer interaction). Sheet sections: **YOU** — identity/sign-in row, "You coach here → Coach view", "You run this event → Open admin", Scorekeeper (officials on assigned events), Following, **Notifications** (the fan bell RELOCATES here from the header — owner call; alerts are account-gated since Unified App Phase 2 Slice 3, so the header bell had become a sign-in pitch), Your FieldLogicHQ; **THIS EVENT** — News, Rules (both keep their own pages; News/Rules leave the tab bar). Signed-out fans: sign-in row + this-device follows + News + Rules — the sheet is never empty. **The Phase-3 account/initials chip is REMOVED from the mobile header** (header utility = Share only); the chip becomes **desktop-only**.
**Rationale:** owner wanted bottom-nav consistency with the consumer shell and one predictable place for coach/admin doors + notifications; the flat sheet preserves Phase 3's ≤2-tap connective-tissue goal and an established in-house pattern.
**Applies to:** public tournament BottomNav + Navbar utilities + the Phase 3 tournament account sheet (relocates its mobile trigger into this tab). **⚠ Supersedes the Phase 3 rev-2 "account chip on mobile tournament chrome" decision — relay to the Unified App Phase 3 work (built, uncommitted) before either ships.** Build = Round 1 of docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md.

### 2026-07-14 — Public tournament mobile G3: ONE unified event header (navbar + hero MERGE) on all public tournament pages
**Decision (owner-accepted, Tournament Mobile Polish Round 1 rev 3):** the mobile Navbar title bar and the per-page hero merge into a single compact event header: org eyebrow (quiet mono kicker) → event title (single statement of the name — no page repeats it) → ONE mono meta line (dates · venue/diamonds · teams) with a stage "pulse" pill (`REG OPEN` / `● LIVE NOW` / `CHAMPIONS CROWNED`), utility icon(s) floating top-right inside the header. On scroll it condenses to a slim pinned bar (title + Share) with the ScoreTicker pinned beneath — nothing load-bearing disappears. The Home hero poster branches (default / playoffs-set / completed) are RETIRED in favor of this header plus a stage-led body (before = countdown + Register CTA; during = Live Now block first; after = gold champion card + podium). Rev 1's "identity band stacked under the existing navbar" was explicitly REJECTED by the owner as a double header — never reintroduce a second name-bearing bar.
**Header utilities (owner direction same day):** the notification bell and the Phase-3 account/initials chip LEAVE the mobile header — notifications and account doors live in the bottom-nav More sheet (see G5 pending entry); the header keeps only Share on mobile. Phase 3's account chip becomes desktop-only.
**Rationale:** measured 565px (67% of a 390×844 viewport) hero + the tournament name rendered twice ~180px apart; the Phase 3 mockup frames carry the whole event identity in ≈100px. Mobile never showed event dates at all (desktop-only status slot) — the meta line fixes that.
**Applies to:** all `app/[orgSlug]/[tournamentSlug]` public pages (Navbar + page heroes). Build = Round 1 of docs/projects/active/TOURNAMENT_MOBILE_POLISH_PLAN.md (covers findings C1/C2/C8).

### 2026-07-14 — Public tournament pages G4: quiet-label convention = uppercase mono kicker (single labeling system)
**Decision (owner-accepted, same review):** ONE label convention across public tournament pages: uppercase `--font-data` kickers (small, tracked, `--white-45`/`--data-gray`-class muted color) for day headers ("TODAY · TUESDAY · JULY 14" — weekday-led, TODAY leads and newest day first during a live event), section kickers ("LIVE NOW", "TOURNAMENT DAY"), and row context lines ("SEMIFINAL 1 · DIAMOND 1"). This replaces (a) the bare `.eyebrow` spans that today match NO CSS rule and render as full-size body text on Standings/Schedule/News/game-detail, and (b) the competing display-font kicker family — migrate stragglers when touched (plan findings D2/D14).
**Rationale:** the review measured the eyebrow rule dead on every tab (16px/400 plain text doubling the tournament name under the navbar) and two kicker families side by side; the mockup baseline's quiet mono kickers are the established data-face language.
**Applies to:** public tournament pages (globals + module CSS). Companion Track A conventions accepted with the plan: LIVE always wears the soft chip (`rgba(var(--danger-rgb),.15)` fill, `--danger` text/dot, `--font-data`) — never a solid danger fill with white text — and the public `--tap-min: 44px` token implements the existing 44px consumer floor.

### 2026-07-13 — BINDING CSS RULE: `-webkit-backdrop-filter` FIRST, standard `backdrop-filter` LAST — the minifier keeps only the last of the alias pair, and standard-first shipped `none` (unfrosted ghosting chrome) platform-wide
**Decision (owner-accepted after the /discover mobile /design review):** the CSS minifier (LightningCSS via Turbopack) dedupes `backdrop-filter` + `-webkit-backdrop-filter` as aliases keeping the **last** declaration; the codebase's standard-first ordering therefore shipped ONLY the `-webkit-` line, which Chromium does not apply → every frosted bar rendered with no blur and its semi-transparent background ghosted sharp, legible content during scroll (3% linear bleed ≈ 20% perceptual lightness after sRGB gamma — visible even through a 0.97-alpha bar). Fixed by swapping to canonical order (prefixed first, standard last) at all 18 sites: consumer shell (topbar/bottomNav), discover filter bar, then a 15-swap sweep across Navbar, BottomNav, ScoreTicker, MyTeamDock, AdminBottomNav, BottomSheet, TournamentAdminUI, CoachesBottomNav, CoachPortalShell, schedule + org-settings page bars. Verified via Playwright computed styles (blur(16–20px) now computes on all bars; before/after screenshots confirmed the ghosting gone).
**Rationale:** the frost was silently broken everywhere; nobody caught it because near-opaque backgrounds mostly masked it — the discover filter bar's 0.9 alpha made it visible. Screenshots alone had previously caused wrong fixes; the computed-style probe found the true cause.
**Applies to:** ALL CSS declaring backdrop-filter, forever. Write `-webkit-backdrop-filter` immediately BEFORE `backdrop-filter`; verify frost by reading the element's computed `backdrop-filter` (must not be `none`), never by eyeballing a screenshot. Companion gotcha memory: auto-memory `reference_backdrop_filter_prefix_order.md`.

### 2026-07-13 — Consumer-surface mobile input/touch conventions (set on /discover): 44px touch floor, 16px input text (iOS anti-zoom), icon-only Filters toggle, chips one row to 360px, status badges on the semantic token family
**Decision (owner accepted the /design recommendations wholesale):** on consumer surfaces at ≤640px: (1) **44px min-height touch floor** for filter chips, icon toggles, view-switcher buttons, and text inputs (platform floor was ≥40; consumer surfaces target 44). (2) **Focusable text inputs and selects get 16px font-size on mobile** — anything smaller triggers iOS Safari's auto-zoom on focus; the discover search placeholder was shortened to "Search tournaments…" to fit 16px mono down to 360px (behavior still searches orgs; a placeholder is a hint, not documentation). (3) The **Filters toggle goes icon-only on mobile** (label span hidden, `aria-label` carries the name, lime activity dot stays) per the established icon+label-desktop/icon-only-mobile action-button pattern. (4) The three timeframe chips + icon-only toggle must share **one row down to 360px** (mobile chip x-padding 0.55rem, letter-spacing 0.07em) so the sticky filter block stays 2 rows (~127px stuck vs 149–179 before, under a 48px top bar); on mobile the **chips flex to fill the row edge-to-edge** with the fixed-width toggle at the right end (owner iterated 2026-07-13 through right-anchored → left-grouped → **fill**: no dead space anywhere; the row matches the search bar's full width above it). (5) The "Upcoming" status badge moved off raw hex `#93C5FD` onto the global badge-info recipe (`rgba(var(--info-rgb),0.12)` fill, `var(--info)` text/border tint) — statuses always draw from semantic token families.
**Rationale:** the sticky chrome consumed ~44% of a small phone screen with sub-40px targets; DevTools emulation hides the iOS zoom jolt entirely, so the 16px rule must be enforced at authoring time. Verified via Playwright at 400×611 and 360×640: one chip row, all controls 44px, no horizontal overflow.
**Applies to:** `app/(consumer)/discover/` (page.module.css + DiscoverClient.tsx). **Generalises:** all consumer-app surfaces (scores/following/account tabs) adopt the 44px floor + 16px mobile input text; deferred owner-call option remains open — un-stick the search row (keep only the chip row sticky) if the filter block still feels heavy in real use.

### 2026-07-09 — Season-over-season COMPARISONS are RETIRED from coach analytics (owner): youth seasons aren't comparable — "improving?" is answered WITHIN the season; past seasons are an archive, not a scoreboard
**Decision (owner-stated 2026-07-09, during the Insights V3 mockup review):** youth teams age up divisions, change competition levels, and turn over rosters between seasons (a dominant U11-senior team may deliberately challenge itself in U13-junior), so cross-season deltas (win% vs last year, roster-size vs last, dues/expenses trend arrows) are misleading signals — **no season-over-season comparison metric or visual anywhere in coach Insights**. Retired: the "This season vs last" TrendStat panel (win%/roster/dues/expenses deltas — removed in the Insights V3 build) and the planned "Win% vs last year" scoreboard block (replaced by a **close-games record**: "3-1 in one-run games", margin threshold via the Sport Pack). **Past seasons remain a plain ARCHIVE** — per-year records listed inside the "How are we doing?" report (a scrapbook, not a scoreboard); the Overview "Last season" tile is archive display and stays. The honest "are we improving?" vocabulary is **within-season**: form pips, streak, close-games record, and findings-engine rules like home/away splits ("All 3 losses came on the road — 6-0-1 at home"), momentum ("won 5 of your last 6"), and milestones. The help FAQ "How do I see if my team is improving year over year?" gets rewritten to this framing at the V3 build.
**Rationale:** a metric that compares incomparable contexts fails the data-honesty rule in spirit even when the arithmetic is right — the number is real but the implied meaning ("you got worse") is false. Within-season signals share one context and stay truthful.
**Applies to:** the Insights V3 dashboard + its "How are we doing?" report (plan: docs/projects/active/COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md Phase 2b); mockup `public/mockups/insights-dashboard.html` updated. **Generalises:** never ship a delta/trend between two datasets whose contexts differ structurally (different division, different competition pool, different roster era) — compare within one context or present the eras side-by-side as archive facts without arrows.

### 2026-07-09 — BINDING LAYOUT RULE (owner): page scroll is for ONE long homogeneous list — never for travelling between content domains; multi-domain pages compose as a side-by-side grid or tabs. Insights hub reworked from a stack to a dashboard card grid
**Decision (owner-stated 2026-07-09, rejecting the stacked V1 of the coach Insights hub):** "scrolling shouldn't lead to completely different pages; scrolling should only occur for long single-page items (e.g. activity feed, schedule)." Codified: a page holding MULTIPLE heterogeneous domains must NOT stack them vertically on desktop — compose them as a **dashboard grid** (the Overview snapshot idiom) or split them behind tabs/sub-pages; reaching a different domain must never require scrolling past other domains. Page scroll is reserved for one long HOMOGENEOUS list (schedule, feed, roster) — including a list INSIDE one grid card, which may grow freely. Phones stack by physics, but every domain card must stay glance-compact so the whole page map ≈ 1–2 screens.
**Applied to the Insights hub:** its four domains became four compact cards in `.insightsGrid` (`repeat(auto-fit, minmax(340px,1fr))`, `align-items:start`) — **Results & records** (this-vs-last trend stats + past seasons COMPACTED from fat year-cards to one-line expandable `<details>` rows: name · record · status chip → expands to players/tryout/money stats) · **Playing time & lineups** (honesty line + the five expandable read-outs, in-card) · **Attendance** and **Money reports** (whole-card links: in-card kicker + icon/title/desc/chevron, hover glow+lift). Card chrome = the elevated dashboard treatment (`--white-8`, blueprint border, `--radius`, `shadow-sm`+`highlight-top`). Per-domain capability gates unchanged; a hidden card just leaves a smaller grid (auto-fit degrades 4→1 cleanly). All four domains visible in one desktop viewport.
**Rationale:** the stacked V1 buried Money reports below every other domain on a large viewport — repeating, on the consolidation page itself, the exact stacking disease the consolidation existed to cure. The grid restores "one glance = the whole map," matches the proven Overview tile idiom, and costs no depth (expand-in-place / one tap deeper).
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` + the `.insights*` classes in `coaches.module.css`. **Generalises (BINDING, portal-wide):** before laying out any multi-domain page, choose grid or tabs — never a stack. Audit candidates when next touched: the Money hub landing (summary grid + stacked groups) — incl. the separate in-flight Money-hub redesign, which must honor this rule.

### 2026-07-09 — Tournament dashboard guidance rail: pre-event stage gets the same collapse-to-strip affordance as game day (owner-accepted, no hard dismiss)
**Decision:** owner felt the "what's next" card (`components/admin/tournament/GuidanceRail.tsx`) was too large/heavy on repeat dashboard visits during the pre-event stage. Considered and rejected a hard dismiss — the card is stage-aware status (draft → pre → live → ready → post → done), not a repeating reminder, so dismissing it would also lose it during game day and closeout. Instead extended the collapse-to-one-line-strip pattern already built for the live stage to the `pre` stage too (new `collapsible` prop, defaults to `live` for back-compat). `pre` starts **expanded** by default (unlike `live`, which starts collapsed) since first visibility matters more before an event than during it; the collapsed/expanded choice is then remembered per tournament via the existing `flhq-help-guiderail-{tournamentId}` localStorage key. `ready` stays never-collapsible per the 2026-07-06 decision (a call to act must not hide).
**Rationale:** individual type/icon tokens on the card were already conservative by the system's own scale (18px icon, 0.92rem headline) — the bulk came from stacking (headline+CTA, nudge, tasks toggle), not oversized values, so shrinking tokens further risked legibility for no real space win. Reusing the proven live-stage collapse primitive solved the actual complaint (repeat visits shouldn't keep spending the same vertical space) without inventing a new visual pattern.
**Applies to:** `components/admin/tournament/GuidanceRail.tsx`, `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (caller passes `collapsible={guidanceStage === 'live' || guidanceStage === 'pre'}`).

### 2026-07-09 — Collapsed guidance-rail strip: expand chevron trails the CTA as its own button; mobile stacks to 2 rows instead of truncating the headline
**Decision (owner-flagged from a screenshot, same-day follow-up to the collapse-affordance decision above):** two fixes to the collapsed one-line strip. (1) The expand chevron previously sat immediately before the CTA button with the same gap used everywhere else in the row, making it look like a dropdown arrow attached to "Message your teams" rather than the row's own disclosure control. Reordered to message → CTA button → chevron, with the chevron rendered as its own small ghost button (matching the expanded state's `.collapseBtn` treatment) grouped with the CTA in a `.compactActions` wrapper — the extra button chrome (padding + border-radius + independent hover colour) reads as a standalone control instead of an arrow glued to the button. (2) On mobile the same row was cramming icon + headline + CTA + chevron onto one line, truncating the headline to unreadable ellipsis ("Your event i…"). Fixed at `max-width: 640px` (this project's standard mobile breakpoint) by giving the toggle (icon + headline) `flex-basis: 100%` so it claims its own full-width row, and letting `.compactActions` (CTA + chevron) wrap to a right-aligned row below.
**Rationale:** a disclosure chevron immediately adjacent to an action button reads as a split-button dropdown, not a row-level expand toggle — some visual/structural separation (own button chrome + grouping) is needed regardless of screen size. On mobile there simply isn't room for all four elements on one line, and truncating the actual status message is worse than reflowing to two rows.
**Applies to:** `components/admin/tournament/GuidanceRail.tsx`, `components/admin/tournament/GuidanceRail.module.css` (collapsed-strip markup + `.compactActions`/`.compactChevronBtn` + the 640px media query).

---

### 2026-07-08 — Coach Lineups page = in-page TABS (Games | Templates) + a Games filter-chip bar (owner-chosen Option B, reconciled with the same-day Insights consolidation)
**Decision (owner accepted 2026-07-08 — D1 of docs/projects/active/COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md, chosen from the `public/mockups/lineups-ia-options.html` browser mockup):** the coach Lineups landing becomes a **tabbed page** — segmented control (reuse the Roster list⇄depth `.segChoice` idiom), **two tabs: Games (default) | Templates**. The mocked third "Insights" tab was DROPPED in reconciliation with the same-day Insights-hub decision: the five season read-outs move to Season → Insights (one deep home, no mirroring); the Games tab carries a quiet blueprint-blue "Season insights →" link instead. Tab state is deep-linkable (query param) so Overview CTAs land on Games and template links land on Templates.
1. **Games tab gains a filter bar (owner ask; treatment iterated via /design same day — **v2 ACCEPTED by owner 2026-07-08**):** two composable dimensions instead of one flat single-select pill row. (a) **Scope chips**: worded select-one chips `All · League · Tournament · Scrimmage`, **NO leading label** (owner call 2026-07-08 — a list-filter chip bar is label-less like the attendance bar, because "All" + placement above the list already read as a filter; a leading label like WLT's "Counting:" is reserved for stat-scope toggles that change a NUMBER's meaning, not list filters) — no counts, active = lime tint + 12px check (the WLT check-chip convention; "All" active = the attendance All-lime convention), and a type chip HIDES when the team has zero games of that type. (b) **One "⚠ Needs lineup" TOGGLE chip**, right-aligned on desktop: warning icon always `--warning`, selected = warning-tint fill (the attendance "selected fills its own status colour" convention), carries the bar's ONE live count (scoped to the selected type), composes with the scope (e.g. Tournament + Needs lineup), and hides when the season has nothing to triage. **Filter chips never take solid `--primary`** — that's the segmented tab control's active state; v1 looked wrong precisely because chips and tabs matched (chips must read as the lighter species: smaller tinted fills). Filters span Upcoming + Recent (kickers hide when emptied); empty results stay honest ("No games match" / "All caught up — every game here has a lineup." when the toggle is on). "Needs lineup" doubles as an analytics backfill tool — it surfaces past games with no saved lineup, and saving those grows the Insights honesty basis. On ≤640 the bar wraps: scope row + toggle row — never a horizontal scroll row (owner rejected clipped chips + a visible scrollbar 2026-07-08). Extensible later (home/away, month).
2. **Readiness data goes bulk.** The Not-set chip (and readiness chips on recent rows) needs lineup-existence for every listed game → return a bulk lineup-existence flag on the events read (mirror the existing `lineupMismatchEventIds` pattern, gated on `caps.lineups`) and RETIRE the N+1 per-game readiness probes (today one fetch per upcoming game, capped 20, recent never probed).
3. **CP-1 is interpreted per VISIBLE TAB PANE:** Games pane's single lime = "Build lineup" on the nearest upcoming game without a saved lineup (no qualifying game → no lime; lime is earned); Templates pane's single lime = "New template" (moves there from the page header, which loses its header action). Only one pane is visible at a time, so the surface still shows exactly one lime moment.
**Rationale:** owner preferred one destination with visible sub-jobs over the recommended front-door/sub-page split; with analytics consolidated away the tab count stays at two, and the filter bar restores game-day speed ("what still needs a lineup?" = one tap). Reusing the attendance chip idiom + the existing segmented idiom adds no new visual language.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/lineups/page.tsx` (+ chip/segment styles in `coaches.module.css`), the coach events GET (bulk readiness flag). **Generalises:** when a page's jobs split into tabs, CP-1 applies per visible pane; list-triage filters split ORTHOGONAL dimensions into scope chips (worded, no counts, lime-tint active) + status toggle chips (status-tinted, count-bearing) rather than one flat single-select row; filter chips never share the segmented control's solid-primary active state; worded chips wrap on phone rather than scroll; a per-row readiness probe should graduate to a bulk server flag the moment a filter or count depends on it.

### 2026-07-08 — Coach season analytics consolidate into ONE "Insights" destination (Season group): Season Review evolves into it; money reports stay federated in Money (owner-accepted)
**Decision (owner accepted 2026-07-08 — D2+D3 of docs/projects/active/COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md):** the Premium coach portal gets ONE Review-rubric destination: **Season Review (`/history`) evolves into "Insights" and moves nav groups Team admin → Season** (Season = Schedule · Insights · Tournaments-conditional; Team admin becomes Staff · Documents · Settings). Insights is a **section-carded hub landing** (the Money-hub idiom — one honest headline per section + drill-in, NEVER a new long stack): **Results & records** (open to any assigned coach) · **Playing time & lineups** (`caps.lineups`; the five lineup season-analytics collapsibles MOVE here from the Lineups page, honesty line intact) · **Attendance & reliability** (`caps.roster!=='off'`; links the existing `/attendance` report, which finally gains a nav home + a "← Insights" back-link; Roster keeps its in-context button) · **Money reports = a gated CROSS-LINK card only** (`caps.money!=='off'`) — money analytics deliberately STAY inside the Money hub because reports and operations (mark-paid / remind) are one workflow there and the tri-state gate stays in one fortress. Sections whose capability fails NEVER render; per-section data-honesty thresholds stay as implemented at each source (no zeros-as-content).
**Principles locked with it:** every number gets exactly **one deep home + at most one glance** (Overview record widget/tiles stay and deep-link in); **label ≠ route** (route stays `/history`; precedent Money→`/accounting`); help-doc aliases must keep "History"/"Season Review" searchable after the rename; future analytics (player stats, opponent scouting) land as new Insights sections, not new nav items.
**Rationale:** season-level read-outs had scattered across five corners behind four different gates — including a season attendance-reliability report reachable ONLY from a button on the Roster page (in no menu at all) — and Season Review sat in Team admin as an acknowledged rubric compromise (IA review §5.2). One Season-group destination answers "how is my season going?", repairs both debts, gives upcoming stats features an address, and needs no migration.
**Applies to:** `lib/coach-nav-visibility.ts` + the `TEAM_NAV_GROUPS`/`MORE_SECTIONS` arrays in `CoachesSidebar.tsx`/`CoachesBottomNav.tsx`, `app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx` (becomes the Insights landing), `/attendance`, and the Lineups landing (analytics zone moves out, replaced by a quiet "Season insights →" link). NOT yet built — the companion Lineups-page IA choice (D1) is being decided from the `public/mockups/lineups-ia-options.html` browser mockup (throwaway; delete after the decision). **Generalises:** to consolidate scattered read-outs, evolve the existing Review destination rather than minting a new nav item; federate operations-coupled reports behind a gated cross-link instead of absorbing them; and structure any hub as section cards + drill-ins so consolidation doesn't recreate the stack it cures.

### 2026-07-08 — Coach-portal breadcrumb is GLOBALLY HIDDEN (`display:none`, no show rule) → a drill-in sub-page must carry its OWN visible one-level "← {parent}" back-link; keep contextual cross-links as quiet blueprint-blue links
**Gotcha:** `.coaches.module.css .breadcrumb` is `display:none` with **no** media query that ever unsets it — the coach portal navigates via the sidebar/bottom-nav, so the `<nav className={styles.breadcrumb}>` renders **nothing on any viewport**. Do NOT rely on it for "up" navigation.
**Decision:** A drill-in coach **sub-page not present in the sidebar/bottom nav** (e.g. the Lineups builder `/lineups/[eventId]`) must render its **own visible one-level back-link** — "← {parent}" (here "← All lineups") as a quiet **`--blueprint-blue`, no-underline** link on its **own full-width row ABOVE the icon+title identity row** (NOT nested inside the text column beside the icon — nesting floats the icon to the vertical middle of the stack and indents the back-link past the icon). The `headerIcon` then sits next to the title on the row below. Padding + negative-x margin give a ≥40px tap target while keeping the link text aligned to the content edge (`.lineupBackLink`). Any additional **contextual** cross-link to a destination that back-link doesn't cover (here "View on schedule" → the game's schedule detail) is the SAME quiet blueprint-blue treatment, sitting with the date/time in a **flex-wrap meta row** (gap-separated, **NOT a literal "·" join** — a hard dot orphans at the end of the date line when it wraps on mobile), never an underlined `--white` pseudo-button, never a second heavy `btn-secondary`. Net for the builder: two consistent blue links — "← All lineups" (up) + "View on schedule" (lateral) — no duplicate button.
**Rationale:** The original header stacked three nav affordances (invisible breadcrumb + an underlined white pseudo-button link + a `btn-secondary`) with mismatched weights. First correction wrongly removed the visible back-button assuming the breadcrumb covered "up" — it doesn't (hidden), which broke mobile back-nav. Correct model: one visible up back-link + consistent quiet contextual link. Honors 2026-06-29 "no hero headers in operating tools" + mobile header-compaction; keeps CP-1 (lime never spent on navigation).
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx` (`.lineupBackLink` + `.lineupOnScheduleLink` in `coaches.module.css`); generalizes to any coach drill-in sub-page. If a full breadcrumb is ever wanted, it must be explicitly un-hidden first.

### 2026-07-06 — Premium Coaches Portal NAV REBUILD (IA/UX Review Phase 3): plain-language groups + "Explore graduation" for optional items + Lineups front door + one shared gate
**Decision (Phase 3 of the Coaches Portal IA/UX Review — owner accepted decisions #4–#8 at the recommended answers; built on `dev`):** the Premium coach nav (desktop `CoachesSidebar` + mobile `CoachesBottomNav` More-drawer) is regrouped from build-order into five plain-language groups: **Squad / Season / Money / Communication / Team admin** (Overview stays ungrouped at top). Labels renamed **Accounting→"Money"** and **History→"Season Review"** — **labels only, routes unchanged** (`/accounting`, `/history`); the destination page titles + breadcrumbs were updated to match so nav→page reads coherently.
1. **"Explore graduation" pattern for optional/rarely-used items.** Tryouts + Tournaments are `conditional`: an item computes a three-way `itemState` = **hidden** (capability gate fails — wins over everything) → **explore** (permitted but no usage signal yet) → **primary** (permitted + signal present). Explore-state items render under a dim **"Explore"** group at the bottom of the sidebar and a matching "Explore" section in the mobile More-drawer, so a hidden item is **never a dead end** — it's rediscoverable and **graduates up into its real group automatically once the team uses it**. Signals are two cheap read-only per-assignment booleans (`hasTryoutSignal` = a tryout workspace row exists; `hasTournamentHistory` = the team has a tournament registration), computed batched at assignment-load. **Generalises:** to declutter a nav without stranding rare features, hide-until-used INTO a labelled "Explore" bucket (not out of existence), keyed on a cheap usage signal, with capability gating taking precedence over the usage gate.
2. **Front door for a buried tool = a list page that deep-links into the existing editor — never a rebuilt editor.** The flagship lineup builder had no menu item (buried in a game's slide-over). Phase 3 adds a **Lineups** nav item + a landing page listing upcoming/recent games, each row deep-linking to `/schedule?event=<id>&tab=lineup` — a new one-shot deep-link the schedule page reads to open that game's slide-over on the lineup tab. The Overview "Build lineup"/"Take attendance" CTAs use the same deep-link (capability-gated). The builder itself is untouched (reuse, not rebuild). The Lineups page is an **operating tool → no hero header** (compact `pageHeader`), uses the warm dashboard-card tokens (`--white-8` bg, blueprint-blue border, `--radius`, `--shadow-sm`/`--highlight-top`, hover `--glow-sm`+translateY(-1px)), and keeps **CP-1** (one lime action) — its only lime is the empty-state "Add a game".
3. **One shared gate, not duplicated.** The `navVisible` capability switch (was byte-for-byte duplicated in both nav components, a drift risk) is extracted to **`lib/coach-nav-visibility.ts` (`isCoachNavItemVisible(caps, label)`)** consumed by both — single source of truth, with the new `Lineups`→`caps.lineups` rule and `Money`/`Season Review`→`caps.money!=='off'` (same gate as the old Accounting/History). Fail-open when caps absent (server still enforces). **Generalises:** when a gate MUST stay identical across two components, extract it to a shared pure function rather than trusting copy-paste discipline.
**Constraints honoured:** the 4 primary mobile tabs (Overview/Schedule/Chat/Roster) are untouched; every More item sits under a section header; no migration; no free-portal change; guardian PII stays behind its per-coach grant (never a module gate). **Money-gated "Last season" tile** on the Overview (record/dues/expenses → Season Review) uses the same dashboard-card language and only renders for a coach with money access. **Two pre-existing issues surfaced by review (NOT introduced by the nav rebuild): (1) mobile primary tabs are capability-filtered (an assistant with schedule/roster revoked loses that tab) — owner chose to LEAVE AS-IS (consistent with the gating model); (2) the org-invite Overview banner co-rendered a 2nd lime CTA alongside the phase anchor — FIXED by demoting "Review invite" to `btn btn-outline btn-sm` so the phase anchor keeps the single lime action (CP-1). Generalises: a notification/banner action on a surface that also has a phase-primary lime CTA must NOT be lime — outline/ghost it so CP-1 holds.** A separate pre-existing Medium (assistant without `rosterPii` sees a false "N missing email" count on the Overview) is flagged for its own fix.

### 2026-07-06 — Public fan NOTIFICATION BELL: top-bar icon (matched to Share) + popover/bottom-sheet panel, reusing the admin bell + fan-alert families
**Decision (/design pass for Rain Delay / Day-of Ops Phase A2 — owner agreed to all recs):** the anonymous fan's tournament-wide notification opt-in lives as a **bell icon in the public `Navbar` right-actions group (`styles.actions`), immediately LEFT of Share**, on every public tab, mobile + desktop. It is **assembly of existing pieces, not a new visual language** — it borrows the admin `NotificationBell`/`NotificationPanel` bell-in-a-bar + portal + outside-click mechanics and the `FollowAlertsToggle`/`AlertsNudge` fan-alert visual family.
1. **Bell button** reuses Share's chrome (`btn btn-outline btn-sm`, icon-only ~32px) so the two read as a matched pair. **Icon vocabulary reused from `FollowAlertsToggle`:** `Bell` (resting `--white-70`), `BellRing` tinted `--lime` (opted in / any category on), `BellPlus` (iOS-not-installed), `BellOff` (blocked). Push unsupported OR free-tier tournament (no `fan_score_alerts`) ⇒ **no bell rendered.** **No numeric badge** — this is an opt-in control, not a feed; a count would manufacture false urgency; the lime `BellRing` IS the "you're covered" signal.
2. **Panel = desktop popover (~320px, right-aligned under the bell, `--surface-2`/`--border-subtle`/`--radius-lg`, portaled to `<body>`, outside-click + Esc close) / mobile bottom-sheet (full-width, `--radius-xl` top, dim backdrop, `env(safe-area-inset-bottom)`, swipe/backdrop/X close)** — the `.sheetOnMobile` idiom. Category rows = label (`--white-90`) + one-line desc (`--white-55`) + a toggle **switch** (track `--white-10`→`--lime` on, white thumb) referencing the existing `TryoutDayCard` `.switch/.switchOn` pattern (no shared switch primitive exists — this is a small local pattern, not a new token).
3. **Two categories now, room for a 3rd:** "Tournament messages" (rain delays / day-of) + "Score alerts" (teams you follow); leave vertical room for "Schedule changes" (arrives with Feature B). **First-run = a single lime "Turn on notifications" CTA** (echoes `AlertsNudge`'s "Get alerts") because the browser permission prompt needs one in-gesture trigger; after grant the CTA is replaced by live switches + a quiet `✓ Notifications on` + ghost "Turn all off". **Score-alerts with no team followed** stays ON with an inline "Follow a team to start these →" hint (not greyed out). iOS-not-installed shows the existing "Share → Add to Home Screen" explainer (+ a "Show me how" that dispatches `flhq:show-install`); blocked shows the existing "notifications are blocked" copy.
**Rationale:** the bell is the ONE surface visible on every tab that lets a fan opt into tournament messages **without first adopting a team** (the gap the existing team-welded toggles leave). Reusing the admin bell mechanics + the fan-alert icon/lime family means additive classes only — no new primitives, tokens, or visual language — and keeps the on/off read instant. No badge follows the platform "don't manufacture urgency" posture. The existing team `FollowAlertsToggle`s stay as shortcuts that write the SAME shared fan-alert state (via the existing `fl-fan-alerts-change` event) so the bell and team toggles never diverge.
**Applies to:** new `components/public/FanNotificationBell.tsx` (+ `.module.css`), `components/Navbar.tsx` (mount in `.actions`), harmonized with `components/public/FollowAlertsToggle.tsx` + `AlertsNudge.tsx` + `lib/fan-alerts.ts`. **Generalises:** a bell-in-a-bar opt-in reuses the admin `NotificationBell` portal/outside-click; fan-facing push controls share the `Bell/BellRing(lime)/BellPlus/BellOff` vocabulary; opt-in controls get NO count badge; multi-category preference panels use label+desc rows with a right-aligned switch; browser-permission opt-ins use one in-gesture CTA on first run, then live switches.

### 2026-07-06 — Sign-up screen "You've been invited" branch: positive = LIME accent + blueprint-framed panel (never amber/danger); lime reserved for the ONE recommended action; existing-account notice stays field-level
**Decision (/design pass feeding a /plan for the invite-seam preventive fix — see HELPDESK_GAPS.md top entry + the /ux flow):** the org-creation sign-up screen (`app/auth/signup/page.tsx`, owner mode) gains three adaptive states after the email is entered, styled within the existing blueprint auth card (`app/auth/auth.module.css`), **no new tokens**.
1. **Invited state = the hero.** Org-name + credentials + "Create Organization" CTA are REPLACED by an `.invitePanel` (blueprint-framed: `background rgba(30,58,138,0.06)`, `border 1px rgba(30,58,138,0.4)`, radius 0, padding 1.25rem) holding "You've been invited to {Org}" (`.inviteOrg`, `--fl-text`/700), an OUTLINED (not lime-filled) role pill (`.inviteRole`, `--data-gray` + thin blueprint border), and reassurance body (`.inviteBody`, `--data-gray`, 0.78rem). The card header adapts too: icon → `MailCheck` tinted `--logic-lime`, title → "YOU'VE BEEN INVITED". Primary CTA "EMAIL ME MY INVITATION LINK" REUSES `.submitBtn` (lime) → "SENDING…" via existing `.submitBtn:disabled`.
2. **Lime is spent on exactly one action.** The primary CTA is the only lime element; the "Not you? Create a new organization instead" escape hatch is deliberately GREY (`.linkMuted`, `--data-gray`→hover `--fl-text`, underlined) so it can't compete. The escape-hatch confirm is an INLINE reveal (no modal system on this screen): blueprint `.confirmBox` with a compact lime "Keep my invitation" (recommended) + a ghost/outlined `.btnGhost` "Create new org anyway" — lime stays on the safe choice.
3. **Success + existing-account states reuse established patterns.** After send, show the screen's EXISTING lime verification-success visual (`.inviteSent`: `bg rgba(163,230,53,0.08)`, `border rgba(163,230,53,0.28)`, `color --logic-lime`) — "Check your inbox — open the email and click Accept Invitation." The existing-account case is a FIELD-LEVEL `.inlineNotice` under the email input (neutral blueprint tint, `--data-gray`, with a lime "Sign in" link) — NOT a full-form takeover, because the user may have typo'd; the Create button disables while it shows. The inline "checking…" affordance is a 12px `Loader2` in the password-eye slot (`right:0.75rem`, `pointer-events:none` so it never blocks typing).
**Rationale:** an invitee reaching this screen is a positive recognition moment, not an error — so it takes the lime accomplishment accent, matching the binding 2026-07-06 rule that a positive lifecycle milestone uses lime (not amber `--warning` = attention/late, not `--gold` = champion/A-squad, not danger-red). Framing the panel in the card's own blueprint-blue language keeps it reading as the same screen adapting. Reusing `.submitBtn`/`.footerLink`/the verification-success box means only additive classes, no new primitives or tokens. The role pill is OUTLINED (not a lime fill) to keep the panel calm and sidestep the ink-on-lime rule. Existing-account stays field-level so a typo is correctable.
**Applies to:** `app/auth/signup/page.tsx` (adaptive states + header swap), `app/auth/auth.module.css` (new `.invitePanel`/`.inviteOrg`/`.inviteRole`/`.inviteBody`/`.inviteSent`/`.inlineNotice`/`.linkMuted`/`.btnGhost`/`.confirmBox`/`.confirmActions`/`.emailField`/`.checkingSpinner`/`.spin`). **Generalises:** a "we recognized you / good news" auth state uses the blueprint-framed panel + a single lime CTA with grey secondaries; corrective-but-not-error field feedback stays a field-level inline notice, never a full-form takeover; inline async affordances live in the field (absolute, `pointer-events:none`) so they never block input.

### 2026-07-06 — New `--gold-strong` token: gold TEXT/GLYPHS darken to a deep goldenrod on light surfaces (pastel `--gold` washed out on white); fills stay `--gold`
**Decision (owner-reported: gold labels on the champion banner were "hard to read" on the light Milton page):** the pastel `--gold` (`#F5C451`) is legible as text on DARK surfaces but washes out as small labels on white/light. Added a companion token **`--gold-strong`** (design-system extension): base `:root` value = `var(--gold)` (bright gold, unchanged on dark), light-mode override `[data-color-mode="light"] { --gold-strong: #856611 }` — a deep goldenrod that stays clearly "gold" while hitting ~5:1 contrast on white. **Rule:** gold **text/glyphs use `--gold-strong`**; gold **fills/borders/tints keep `--gold` / `--gold-rgb`** (pastel is correct as a background wash in both modes). The light override MUST sit after the `:root` that defines `--gold-strong` (equal specificity → later source wins; same ordering trap as the next/font `:root` gotcha). Applied to every gold label/icon on the two public champion surfaces: the completed-home banner (division kickers, tier badges, crown icons, hero-takeover badge) and the `/champions` recap (hero eyebrow, division kicker, tier badge, crown). The A-squad coach gold stars (`DepthChartBoard.module.css`) were intentionally left on `--gold` — they sit on dark coach surfaces and carry a glow, out of scope. The OG image keeps its hardcoded gold (dark background, already legible).
**Rationale:** mirrors the platform's existing light-mode override pattern (e.g. the section-header eyebrow) and the "light pastel needs dark ink as text" rule proven for `--logic-lime`. One token keeps every gold label legible without darkening the decorative gold fills, and single-sources the fix across banner + recap so they can't drift.
**Applies to:** `app/globals.css` (`--gold-strong` token + light override), `app/[orgSlug]/Home.module.css` + `components/public/ChampionsRecap.module.css` (gold `color:` → `--gold-strong`). **Generalises:** for any pastel accent used as text, add a `-strong`/ink companion that darkens on light surfaces; never place a light pastel as small text directly on a light surface.

### 2026-07-06 — Completed-home champion banner shows EVERY crowned tier winner (not just the top tier); recap page moved to `--gold` to stay matched; `tierBadgeLabel` shared so wording can't drift
**Decision (owner-approved, follow-on to the champion-hero pass):** the public Overview completed-tournament champion banner (`components/public/TournamentHomeContent.tsx` + `app/[orgSlug]/Home.module.css`) now lists **all** decided bracket winners, because a lower-tier winner "technically medalled" — it won its own bracket. Behaviour:
1. **Banner data source switched from top-tier-only to all-tier.** The banner now derives from `deriveTierChampions` (every decided tier/group), grouped by division; the auto **hero takeover keeps `deriveChampions` (top tier only)** — the hero is one celebratory headline, the banner is the full podium.
2. **Layout is state-adaptive.** Exactly one crowned team in the whole event (one division, one bracket) → the centred single-champion card from the prior pass (big name + labelled runner-up). Anything else (tiers OR multiple divisions) → a per-division podium: division kicker, then a stack of tier cards top-tier-first. Each tier card = a gold crown chip + tier badge (`Tier 1 · Champion` / `Tier 2 Champion` / plain `Champion` for a single bracket) + team name + `def. {runner-up} {score}`. Top tier is gold-forward + larger; lower tiers are the neutral carded treatment — mirrors the `/champions` recap card language exactly.
3. **Recap page moved off `--warning` onto `--gold`.** `ChampionsRecap.module.css` used amber and literally documented itself as "matching the completed-home champion banner"; the banner having moved to `--gold` (2026-07-06 prior entry) meant leaving the recap amber was drift. Converted (incl. the #1-seed `rankFirst` standings chip). The OG share image was already a hardcoded gold (`#EFC44D`) and headline-only, so it is intentionally left unchanged.
4. **`tierBadgeLabel(tierLabel, isTopTier)` extracted to `lib/champions.ts`** and consumed by both the banner and the recap so the tier wording is single-sourced.
**Rationale:** owner: lower-tier winners medalled and should be visible on the Overview, not only on the deeper recap page. Reusing the recap's proven crown+badge card language keeps the two champion surfaces coherent; single-sourcing the badge label + finishing the gold migration removes the amber/gold split the prior pass would otherwise have left between the banner and the recap.
**Applies to:** `components/public/TournamentHomeContent.tsx`, `app/[orgSlug]/Home.module.css` (new `.championDivisions`/`.championDivisionBlock`/`.championTierCard`/`.championTierTop`/`.championTierCrown`/`.championTierBadge`/`.championTierName`/`.championTierMeta`), `components/public/ChampionsRecap.module.css` (amber→gold), `lib/champions.ts` (`tierBadgeLabel`), `app/[orgSlug]/[tournamentSlug]/champions/page.tsx` (uses the shared label). **Generalises:** champion/podium surfaces show every bracket winner grouped by division; the top tier leads visually; all champion surfaces share `--gold` + the shared tier-badge label.

### 2026-07-06 — Text on the light lime fill is `#0f1123` (dark ink); `var(--black)` is NOT a token — never use it
**Decision (owner-reported: champion chips on the post-event Summary were unreadable "white on lime"):** the post-event Summary's `.championChip` (Champions band) and `.championBadge` (Division Recap) set `color: var(--black)` on a `var(--logic-lime)` fill. **`--black` is not a defined custom property** — only `--black-10 … --black-40` (transparent variants) exist — so the declaration was invalid and the text **inherited the page's white**, producing unreadable white‑on‑lime. Fixed both to `color: #0f1123`, the exact dark ink `.btn-lime` already uses for text on the lime fill. **Rule going forward:** `--logic-lime` (`#D9F99D`) is a LIGHT pastel — any text/glyph placed on a lime fill must be the dark ink `#0f1123` (matching `.btn-lime`), never white and never `var(--black)`. Lime as *text* (on a dark surface) stays `var(--logic-lime)`; this rule is only for the inverse (dark-on-lime fills).
**Rationale:** an undefined-token silent failure (invalid `var()` → inherited colour) is easy to miss in review because the CSS *looks* intentional. Matching `.btn-lime`'s established `#0f1123` keeps every "dark thing on a lime fill" consistent without inventing a new token. (A future `--on-lime`/`--ink` token could DRY up the shared literal, but btn-lime already hardcodes it, so matching it is the low-risk consistent fix.)
**Applies to:** `app/[orgSlug]/admin/tournaments/summary/summary.module.css` (`.championChip`, `.championBadge`). **Generalizes:** never write `var(--black)` (it doesn't resolve); text/icons on a `--logic-lime` (or any light-accent) fill take dark ink `#0f1123`; and treat an unreadable light-on-light result as a likely **undefined-token** bug (invalid `var()` inheriting a parent colour), not just a wrong colour choice — grep the token name to confirm it's actually defined.

---

### 2026-07-06 — Champion hero: de-duplicate the winner name, elevate the runner-up to a labelled row, and EXTEND `--gold` (medal token) to the champion surfaces (owner-approved scope broadening)
**Decision (owner-approved /design pass on the public completed-tournament champion banner):** three coordinated changes on the public tournament Overview champion treatment (`components/public/TournamentHomeContent.tsx` + `app/[orgSlug]/Home.module.css`).
1. **Kill the duplicate winner name.** The single-champion banner rendered the team name twice — once in the `section-header` `h2` (`"{team} — Champion"`) and again as the big `.championName` card. Drop the `h2` entirely for the single-champion case (the `eyebrow` "🏆 Tournament Champions" is the section label; the card owns the name once). The multi-division `h2 = "Champions"` is retained (not redundant there).
2. **Elevate the runner-up into a real, labelled result row.** Was `0.82rem` at `--white-40` (40%-opacity dark text on a pale-gold surface — low-contrast, skippable). Now a two-line block: an uppercase `RUNNER-UP` label (`.runnerUpLabel`, `0.7rem/800/0.1em`, `--white-60`) above the team name at `1.05rem/600` in `--white-70`, separated from the champion by a hairline divider (`border-top: 1px solid rgba(var(--gold-rgb), 0.25)`). In the centred single card the divider spans full width via `align-self: stretch` while text stays centred. Applied to BOTH the single card and the multi-division grid cards so they can't drift.
3. **EXTEND `--gold`/`--gold-rgb` (medal token) to the champion surfaces.** The champion banner + the auto champions hero-takeover previously tinted with `--warning` (amber); both now use `--gold` (`#F5C451`) — tints/borders/fills via `--gold-rgb` (opacity, mode-safe), solid accent (division chip, hero badge text/border) via `--gold`. Both champion surfaces converted together (no one-surface-leads drift). Winner/runner-up NAME text stays `--fl-text`/`--white-70` (full contrast) — gold is decoration only, never load-bearing body text.
**Rationale:** a tournament champion is the platform's single most literal "gold-medal" moment, so it is the one place beyond A-squad where the medal semantic genuinely applies. **This deliberately BROADENS the `--gold` scope** set on 2026-07-02 ("reserved strictly for the A-squad/gold-medal-starter meaning") and reaffirmed earlier on 2026-07-06 (GuidanceRail entry: "`--gold` is NOT used"). New scope: `--gold` = the **gold-medal / championship-achievement** semantic — A-squad (top-squad starter) AND tournament champions — still NOT a general-purpose accent. Amber `--warning` remains the Late/game-day/attention signal; keeping champions on amber conflated "attention" with "victory". De-duplication reduces net text weight while the runner-up becomes legible for the first time.
**Applies to:** `components/public/TournamentHomeContent.tsx` (champion banner markup + header), `app/[orgSlug]/Home.module.css` (`.championSection`/`.championCard`/`.championDivision`/`.championRunnerUp` + new `.runnerUpLabel` + `.championsHero`/`.championsHeroBadge`). **Generalises:** `--gold` now spans two first-class "gold-medal achievement" surfaces; any future champion/medal/podium treatment should reuse `--gold` (tint via `-rgb`) rather than re-purposing `--warning`, and must keep gold off load-bearing text on light surfaces.

### 2026-07-06 — Push/PWA icon fix: transparent white CHEVRON silhouette for the Android status-bar badge (own source), borderless corner-clean MASKABLE source, `pwa-192` stays the tray fallback, branded `payload.icon` is the real notification-branding fix
**Decision (P0 of the Notification Center Rework; /design pass on the "square push icon on phones"):** the phone push icon showing as a plain square is TWO defects, fixed as follows. Root cause: `badge-72.png` is generated from `logo-C.svg`, whose OPAQUE `#0a0a0f` bg + `#1E3A8A` border flatten to a solid white square because Android's status-bar badge uses ALPHA ONLY.
1. **Status-bar badge = a dedicated transparent silhouette, NOT a stripped logo-C.** Add a NEW source `public/brand/logo-badge.svg`: viewBox `0 0 96 96`, **no bg rect / no border / no grid / no dots / no "HQ"** (all of logo-C's decoration would survive into the alpha mask as white clutter). One **centered** chevron, `#FFFFFF`, polyline `34,20 66,48 34,76`, `stroke-width 13`, `stroke-linecap square` + `stroke-linejoin miter` (on-brand square/miter matching logo-C, but re-centered — the brand chevron sits left-of-center which looks off standalone — and slightly heavier for ~24dp legibility). ~20% safe padding (content in the central ~60–66%). Drives `badge-72.png` at the SAME path (transparent SVG → transparent PNG via the existing sharp SVG path; do NOT composite it on the opaque BG). Keep the chevron over inventing a new glyph — consistency with the favicon/Concept-C mark beats disambiguating from a "play/next" arrow.
2. **Maskable = a dedicated borderless source.** `logo-B.svg` bakes a 10px border frame at the canvas edge + a corner "HQ" — both sit where Android's ~80% circle mask clips (the "looks broken" symptom). Add `public/brand/logo-B-maskable.svg`: full-bleed `#0a0a0f` bg (matched-bg = the seamless principle from 2026-06-24), **centered FL monogram + lime accent bar ONLY**, drop the border + corner "HQ" + corner triangle/lime-corner accents. Keep the established ~56% safe box (288/512). Drives `pwa-512-maskable.png`.
3. **`pwa-192`/`pwa-512` ("any") are UNCHANGED, and `pwa-192` stays the notification tray fallback.** Do not repaint the app identity to chase notification-shade contrast; the tray icon must stay consistent with the installed home-screen icon. On iOS the border + "HQ" read as intentional framing (iOS rounds corners, never circle-crops — per 2026-06-24). The "square" the owner sees is ~90% the collapsed-view white badge (defect 1); fixing that resolves the complaint.
4. **The real notification-branding fix is branded `payload.icon`, a FOLLOW-UP (flag to eng, not a P0 asset).** `sw.js` already honors `payload.icon` and we already generate per-tournament branded icons (2026-06-24); the notification dispatch should pass the tournament/org logo as the large `icon` for org-scoped notifications, falling back to `pwa-192` only for platform events — a Milton fan should see the Milton crest. NOT a lime-filled fallback tile (would fork the platform identity).
**Rationale:** Android badges are alpha-only, so a badge must be a clean transparent silhouette or it becomes a white block; logo-C/logo-B carry decoration/borders that break at badge + circle-mask sizes, so each small-format icon needs a purpose-built source rather than a runtime strip. Keeps the two-mark system (Concept-B monogram / Concept-C chevron) intact and adds badge + maskable variants. Installed devices only pick up the new badge after a service-worker `CACHE_VERSION` bump (icons are cache-first + precached).
**Applies to:** `public/brand/logo-badge.svg` (new), `public/brand/logo-B-maskable.svg` (new), `scripts/generate-pwa-icons.js` (badge + maskable source wiring), `public/icons/badge-72.png` + `public/icons/pwa-512-maskable.png` (regenerated), `public/sw.js` (`CACHE_VERSION` bump); follow-up in `lib/notify.ts`/`lib/web-push.ts` (`payload.icon` branding).

### 2026-07-06 — Tournament-dashboard guidance rail gains a "ready to finalize" state: LIME frame (not amber-live), full prominent card (never collapsed), lime CTA, `--success` "Playoffs complete" footer
**Decision (pre-build /design pass for the DASHBOARD_COMPLETION_GUIDANCE work):** the tournament admin dashboard's `GuidanceRail` (`components/admin/tournament/GuidanceRail.tsx` + `.module.css`) gets a NEW lifecycle state between LIVE and DONE — "ready to finalize" — shown when a still-`active` tournament has every non-cancelled game resolved (bracket built + all pool/playoff games terminal). Visual treatment:
1. **Accent = `--logic-lime`, NOT the amber `--warning` live tone.** Add a `.railReady` modifier that ONLY swaps `border-color: var(--logic-lime)` (mirrors how `.railLive` only swaps to `var(--warning)`). The base `.icon` is already `--logic-lime`, so do not apply `.railLive` and do not override the icon color. Amber is the "game day / attention" signal this state is specifically replacing, so reusing it would undercut the fix. `--gold` is NOT used (reserved strictly for A-squad, 2026-07-02); `--success` is not used for the frame (success-green is the status color; lime is the brand milestone/CTA accent).
2. **Full prominent card, never collapsed.** The live strip collapses because it's a passive view behind the board; "ready to finalize" is a call to ACT and must not hide. Render expanded + non-collapsible — drive it with a SEPARATE `ready`/`tone` signal, NOT `live={true}` (which triggers both the amber tone and the collapse machinery). It sits above the still-rendered game-day board (now a results recap).
3. **Primary CTA = `btn btn-lime btn-data`; the complete-confirm button is ALSO lime, not `btn-danger`.** Marking complete is a positive, reopenable milestone (status can return to Active) — not a destructive delete — so red mis-signals on both the card and the modal. `btn-danger` stays reserved for **Archive** (the truly destructive action). The gravity ("this locks scores/standings/registrations read-only") lives in the confirm modal BODY copy, with an optional warning-toned header.
4. **"Playoffs complete" footer (By-Division panel) = `var(--success)`**, swapped off the `var(--warning)` used for "Playoffs underway." Small inline STATUS label → success-green (matches `GaugeBar` turning `var(--success)` at 100%), not lime. Keep the Trophy glyph.
5. **Icon stays `Compass`** — every lifecycle stage uses it as the rail's "what's next" identity; swapping only here breaks consistency and the lime accent + copy already carry the moment. Optional celebratory swap, if ever wanted, is `CheckCircle2` (reads ready/done) — NOT `Trophy` (already heavily used in By-Division rows + the wrap-up card; reusing it dilutes it).
**Rationale:** the dashboard was showing the amber "It's game day — enter & review scores" rail on a tournament whose games were all complete and champion crowned, because the stage was calendar-driven. The new lime, prominent, non-collapsing card reads as a positive "you're done — lock it in" milestone distinct from both the amber live state and the DONE wrap-up. State = border-color swap keeps the established rail pattern; lime-not-danger keeps "complete = good milestone" while the modal body carries the lock warning.
**Applies to:** `components/admin/tournament/GuidanceRail.tsx` (+`.module.css`: new `.railReady`), `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (guidance-stage derivation, complete-confirm modal reusing the Activate/Archive modal shell with a lime confirm, By-Division "Playoffs complete" footer), `lib/tournament-guidance.ts` (the `ready` card content). No new tokens, no migration. **Generalizes:** a positive lifecycle-milestone card uses the lime accomplishment accent (not the amber attention/live tone and not danger-red); a call-to-act rail state renders full/expanded (only passive live views collapse); a state change on the rail is a border-color swap on a `.railX` modifier, not a restructure; and a finished-status label takes `--success` (matching the 100% gauge convention), reserving lime for the action/accent.

---

### 2026-07-05 — Followed-team bracket spotlight is PURELY ADDITIVE: every game stays at 100% — highlight the followed team (ring + glow), never dim the others AT ALL
**Decision (owner-flagged /design pass on the public playoff bracket — "when I follow a team I can barely see the other games"; then, after a first pass: "still make it more clear — 100%, just highlight our games, don't dim the others"):** the `MatchNode` spotlight in `components/bracket/LogicSyncBracket.tsx` originally created emphasis by *suppression* — non-followed nodes rendered at `opacity: 0.25` **plus** `filter: saturate(0)` (full greyscale), unreadable on the dark canvas. **Final resolution: remove all de-emphasis.** Every game renders at full opacity/colour; the spotlight is applied ADDITIVELY to the followed team's cards only — the existing 2px `--primary-light` highlight ring **plus** the soft primary halo (`url(#glow-primary)`, the same filter live games use). Removed: the group-level `opacity`/`saturate(0)` dimming, the `isHighlighted` prop, and the `highlightPresent` guard (no longer needed — nothing is ever dimmed, so a followed team that's absent/eliminated/other-tier simply gets no ring, with zero effect on the rest).
> Supersedes the intermediate same-day "dim the others to 0.7" step — owner explicitly rejected ANY dimming. The prior "lift the target, don't crush the field" instinct (binding **2026-06-26**) is now taken to its endpoint: emphasis is added to the target and the field is left completely untouched.
**Rationale:** owner wants maximum legibility of the whole bracket while still being able to spot their team; the ring + glow are a strong enough identity cue on their own that suppressing context adds nothing but harm. No new tokens (reuses `glow-primary` + `--primary-light`), no data/schema touched; flows through every bracket surface (Schedule tab, Standings, Playoff Picture) via the one shared component.
**Applies to:** `components/bracket/LogicSyncBracket.tsx` (`MatchNode` spotlight); general rule — team/entity spotlights in FieldLogicHQ should highlight the target additively, NOT dim the surrounding context.

---

### 2026-07-04 — Team names in fixed-width / pinned columns must never collapse to a per-character wrap (two regressions fixed: mobile Standings + Playoff Picture matchups)
**Decision:** any team-name cell that lives in a fixed-width, pinned, or fixed-slot layout must be guaranteed enough width to wrap on word boundaries (≈2 lines max), never mid-word. `overflow-wrap: anywhere` is a last-resort safety net for a single unbroken token — it must NOT be relied on as the only thing sizing a name, because as soon as its container is starved to ~0 width it shreds the name one letter per line. Two concrete fixes logged here:
1. **Mobile Standings (`app/[orgSlug]/standings/standings.module.css`, ≤640px):** the table was `width:100%`, so it was capped at the viewport and never overflowed → nothing scrolled and the pinned Team column collapsed. Fix = `.standingsTable { width: max-content; min-width: 100% }` so the stat columns spill past the screen and scroll inside the frame's `overflow-x:auto`, **plus** the pinned `.stickyCol` (Team) gets a fixed `min-width: 9.5rem; max-width: 9.5rem`, and the name overrides the desktop `overflow-wrap: anywhere` back to `overflow-wrap: normal; word-break: normal`. This restores the binding **2026-06-01** intent (Team pinned left, ALL stats scroll horizontally beside it — no hidden columns). Font size unchanged (owner: "previous size was fine").
2. **Playoff Picture opening-matchup cards (`components/public/PlayoffPicture.module.css`):** the row grid is `1.4rem [seed] · minmax(0,1fr) [name] · auto [score]`, but seed AND score are conditionally rendered — on unplayed matchups (no seed, no score) the name auto-placed into the narrow 1.4rem seed column and collapsed. Fix = **explicit `grid-column` on all three cells** (`.matchupSeed{grid-column:1}` / `.matchupName{grid-column:2}` / `.matchupScore{grid-column:3}`) so the name always occupies the flexible middle column regardless of which siblings render.
**Rationale:** both bugs looked identical (letter-per-line names) but had different causes — one was a table-width/scroll failure, the other a CSS-grid auto-placement trap when optional cells are absent. Generalizable rule for reviews: whenever optional cells share a fixed grid/flex track with a name, pin the name's track explicitly; whenever a name sits in a pinned column, give that column a real min-width and let the rest scroll.
**Applies to:** mobile Standings table; public Playoff Picture matchup cards; and as a general guardrail for any pinned/fixed-slot team-name cell (bracket cards, lineup pinned column, schedule scorebugs).

---

### 2026-07-04 — Premium Coaches Overview: phase-adaptive "Right now" anchor (port the phase LOGIC of TeamHQ, NOT its hero SKIN) + Season Record moved up + gracefully-receding setup
**Decision (pre-build /design pass for Phase 1 of the Coaches Portal IA/UX Review; owner-accepted Decision #9 = full phase anchor):** the Premium team Overview (`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`) replaces its fixed single-column stack (setup panel → stat strip → tiles → week strip → Season Record LAST) with a **phase-adaptive top anchor** that answers "what do I do right now?" and changes by rep-season phase.
1. **Port the phase LOGIC, not the hero SKIN.** The phase-adaptivity is borrowed from `TeamHQ.tsx` (its `pending/accepted_prep/schedule_live/game_day/result` model), but the anchor is rendered in the **existing dashboard-card language** (the 2026-07-01 elevated coach tile: `--surface` bg, `rgba(var(--blueprint-blue-rgb),0.25)` border, `--radius`, `box-shadow: var(--shadow-sm), var(--highlight-top)`, `--font-display` WHITE numbers), **NOT** the TeamHQ tournament hero (monogram watermark, team-hue celebration wash, big "You're in!" headline). This honors the binding **2026-06-29 "no hero headers inside operating tools"** rule — the Premium Overview is an operating tool. Parallels the 2026-07-01 "transplant the clarity mechanisms, not the admin HUD skin" ruling.
2. **Four rep-season phases** (derive from `programYearStatus` + roster count + game count + next upcoming event; new small deriver, e.g. `lib/coach-rep-phase.ts` — do NOT reuse the tournament-registration phase model): **PRE-SEASON** (roster missing / setup incomplete) · **IN-SEASON** (roster set, a game scheduled ahead, not today) · **GAME DAY** (next game is today, or a game is live) · **RESULT/AFTERGLOW** (season completed/archived, or last game done with nothing upcoming).
3. **Anchor per phase:** PRE-SEASON = compact setup nudge (eyebrow "GET YOUR TEAM READY · N of 6", one-line next action, the page's single lime CTA). IN-SEASON = **Next-game card** (`Countdown` "in 3 days" → date → opponent · field → a stats row "12 of 15 in · ⚠ Lineup not set" → primary action → blueprint-blue secondary links "Take attendance / see game" → a **reserved standings-rank slot** filled in Phase 2). GAME DAY = today's game, sunlight-safe (`--success`/`--white-90` labels, solid fills, bold; `--danger` "● LIVE"), a `RollingNumber` scorebug slot (reuse the `CoachLiveSchedule` live pattern; pre-game shows a countdown), "Open game day →". RESULT = big `--font-display` final record + last result, a **Share** action (lime), and — afterglow ONLY — the single earned upsell (org-data-sharing bridge, pressure-ladder compliant, never price).
4. **Season Record moves UP.** `SeasonRecordWidget` renders **immediately below the anchor, ABOVE the snapshot tiles** (it self-hides until a finalized game exists, so pre-season shows nothing). This **supersedes the 2026-06-29 position** ("below the snapshot tiles / bottom of page") but KEEPS the 2026-07-01 visual treatment. The anchor does NOT repeat the record in IN-SEASON (widget owns it right below); in RESULT the anchor leads with the record as the afterglow headline (intentional emphasis, not duplication).
5. **Setup gracefully recedes (not a binary panel).** PRE-SEASON: the anchor is the setup nudge + the full checklist below. Once the required step (roster) is done but optional steps remain: the anchor flips to IN-SEASON and the setup collapses to a **thin one-line strip** (`.setupStripCollapsed` — "Finish setting up · 3 optional left · Review →", expandable). All done/skipped → nothing. Supersedes the current all-or-nothing `.setupPanel` show/hide.
6. **Tiles phase-ordered** (most time-sensitive first): PRE-SEASON = Roster, Next up, Dues, Budget, Tournaments. IN-SEASON/GAME DAY = Dues, Roster, Budget, Tournaments (the anchor owns "next game"). RESULT = Tournaments (placement), Dues (settle up), Roster, Budget. Tile set + treatment unchanged.
7. **Money "who hasn't paid".** The Dues tile gains a distinct zero-paid flag ("N unpaid", `--warning`) computed from per-player `paidAmount===0`, separate from the existing overdue count; the IN-SEASON anchor surfaces a one-line money alert only when something is overdue.
8. **Lime = ONE moment (CP-1).** Exactly one lime action on the whole Overview: the anchor's single primary action (PRE-SEASON "Add players" / IN-SEASON "Build lineup" / GAME DAY "Open game day" / RESULT "Share"). Everything else = blueprint-blue links / ghost. Retire the run-mode `.statStrip` — the anchor's meta line carries the relevant counts, so the separate stat strip is redundant.
9. **Assistant gating preserved:** the Dues/money alert + tiles stay hidden when `capabilities.money==='off'` (already live); the anchor never renders guardian PII.
**New classes (in `coaches.module.css`, no new tokens):** `.nowCard` + phase modifiers (`.nowPreseason/.nowInSeason/.nowGameDay/.nowResult` for the left-accent: blueprint / blueprint / `--success` / `--gold`), `.nowEyebrow` (`--font-data` uppercase `--white-45`), `.nowHeadline` (`--font-display`), `.nowMeta` (`--white-55`), `.nowStatsRow`, `.nowChip`, `.nowScorebug` (reuse existing scorebug/`RollingNumber` styles), `.nowActions`, `.nowBridge` (afterglow), `.setupStripCollapsed`. All colors from existing tokens.
**Rationale:** the current Overview does two contradictory jobs in one scroll (setup wizard + run dashboard) with the emotionally-resonant record stranded last and no "what matters now" anchor. A phase anchor in the operating-tool card language fixes clarity without importing a hero; moving the record up fixes the strand; the receding setup replaces a jarring binary flip. Standings (the highest-value glance) is a reserved slot so Phase 1 ships IA-only with no new route, and Phase 2 fills it.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx`, `app/[orgSlug]/coaches/coaches.module.css`, a new `lib/coach-rep-phase.ts`; reuses `SeasonRecordWidget`, `Countdown`, `RollingNumber`, `CoachLiveSchedule` (live-score pattern), the 2026-07-01 tile treatment. No new tokens, no migration. **Generalizes:** to make an operating-tool dashboard "phase-aware," port the phase-derivation LOGIC into the surface's own card language — never import another surface's decorative hero into an operating tool; keep the single-lime-moment (CP-1) rule by concentrating it on the one phase-primary action; and when a resonant summary (season record) is "stranded at the bottom," move the component up rather than duplicating it into the anchor (let the anchor carry the forward-looking glance — next game, standings rank — and the widget carry the accumulated record).

---

### 2026-07-03 — MyTeamCard refinements (owner testing pass): slim the card (drop the on-card unfollow star), keep the game-day dock on ALL pages incl. Schedule/Standings, remove the Schedule auto-scroll, relocate Schedule unfollow to the quick-actions row
**Decision (owner review of the built `MyTeamCard` on the mirrored Battle of the Bats):** four adjustments that supersede the relevant parts of the unify entry below.
1. **Drop the unfollow STAR from the card.** The strip layout's trailing filled-star (unfollow) was squeezing the team name onto two lines on Schedule mobile, making that card visibly TALLER than the (star-less) Standings card. Owner preferred the shorter Standings look. Removing the star widens the name column so it reads on one line and **both pages now render the same short card** (`onUnfollow` prop + `.stop` styles removed from `MyTeamCard`). The **desktop rail keeps its separate worded "✕ Unfollow {team}" button** (unchanged).
2. **Unfollow lives on the TEAM PAGE, not on the card or in the action row.** A first attempt put an "Unfollow" chip in the Schedule quick-actions row, but the owner found it cluttered the row — removed. Both cards already **link to the team page** (chevron affordance), and the team page has a prominent **Follow/Following toggle** (`.followHeroBtn` — filled star + "Following", tap to unfollow). So the discoverable path is: tap your team on the card → team page → tap "Following" to unfollow. Unfollow also remains available via the game-day **dock** (in-progress + mobile) and the **desktop rail's** worded "✕ Unfollow" button. No on-card star, no quick-actions chip on either page.
3. **Keep the game-day dock (`MyTeamDock`) on ALL tournament pages including Schedule + Standings** (owner chose NOT to hide it there). This re-accepts a deliberate top-card + bottom-dock overlap on those two pages: the owner weighed it and wants the always-present live score/countdown everywhere, with the slim card small enough that the overlap is tolerable. (Rejected the earlier "hide dock on card pages" option AND a "dock-only, remove the card" idea — the dock is game-day-only, mobile-only, and shows no record/rank, so it can't replace the always-on card.)
4. **Remove the Schedule auto-scroll-to-today on load.** It jumped the page past the header + the new My Team card (disorienting) and the card already surfaces the team's next game up top. Today's games keep the `.todayGroup` highlight; NO "jump to today" button (owner chose the plain removal). **This supersedes the 2026-06-15 "Schedule auto-scrolls to today on load" decision.**
**Rationale:** owner testing surfaced (a) the two cards looked different (star-induced 2-line wrap), (b) top-card + bottom-dock felt redundant, and (c) the auto-scroll was disorienting. Resolution keeps ONE slim card look across both pages, preserves the dock's always-on game-day value everywhere (owner's call, overlap accepted), keeps unfollow reachable, and stops the jarring auto-jump.
**Applies to:** `components/public/MyTeamCard.tsx` + `.module.css` (removed `onUnfollow`/star + `.stop`), `components/public/ScheduleContent.tsx` (removed the auto-scroll effect + `didAutoScrollRef`; strip card no longer passes `onUnfollow`; no unfollow chip — unfollow via the linked team page + dock + desktop rail). No dock/layout change; team page unchanged (already had the Follow/Following toggle). **Generalizes:** a game-day/live overlay (in-progress + mobile only, minimal fields) is NOT a substitute for an always-present summary card — keep the card; if a persistent live bar duplicates it on some pages, that overlap is a product call, not an automatic removal. When a compact card carries a destructive control that steals width, move it to a **labeled** action chip rather than shrinking the identity; auto-scroll-on-load is a smell once a top card already answers "what's next."

### 2026-07-03 — Followed-team card unified into ONE shared `MyTeamCard` across the public fan surfaces (Standings + Schedule mobile strip + Schedule desktop rail); lime→org `--primary`; home card + dock stay separate
**Decision (owner: "bite the bullet, make the single card now"; scope = "compact trio"):** the public tournament "your followed team" at-a-glance card is consolidated from three drifted implementations — the Standings `MyTeamStandingsStrip`, the Schedule **mobile** `.scorebugBar` strip, and its Schedule **desktop** `.railCard` twin (both inline in `ScheduleContent.tsx`) — into **one shared presentational component (`MyTeamCard`)**. The **home-page `MyTournamentCard`** (richer layout, own kicker/actions) and the **game-day `MyTeamDock`** (persistent bottom bar, different interaction) are **explicitly OUT of scope** and stay separate. The unified card is a **scorebug twin**: colored `teamInitials`/`teamAvatarHue` avatar (40px/4px) → 3-tier `--font-data` body (name 900-wt full-strength · `record · rank · rankScopeLabel` at `--white-55` · `vs opponent` at `--white-40`) → right rail with three labeled states **LIVE** (`--danger` badge + `RollingNumber` score) / **NEXT UP** (date + `--primary-light` time) / **FINAL** (last score under a `--white-45` micro-label). Container = `rgba(var(--primary-rgb),0.07)` bg + `0.3` border + `--radius-sm`, NO `flex-wrap` (fixed three-zone flex, `min-width:0` + ellipsis, name `-webkit-line-clamp:2`). **The Standings card thereby switches OFF `--logic-lime` onto the org `--primary`** (visible color change — intended: it was off-brand vs every other fan-surface followed-team treatment and broke per-org theming, e.g. Milton purple). Inherits the binding **2026-06-25** followed-team patterns: identity area links to the team page (trailing `ChevronRight`, name-underline on hover, `aria-label="{team} — view team page"`); any unfollow control is the **filled star, danger-on-hover, separated sibling — never a bare ✕**; who/when only (no venue). **Per-surface differences are passed in, not forked:** an `actions` slot renders each page's own quick-action row (Schedule: My Games / Calendar / Score alerts; Standings: **"View my division"** jump), and `rank`'s scope label differs (Schedule = pool, Standings = division). **Standings-specific calls:** rank is **division-scoped**; the "View my division" jump lives in the actions row (not the rail); and the second unfollow control is **omitted** on Standings (unfollow already lives on Schedule + the dock — a duplicate risks accidental taps). Mobile strip + desktop rail are two responsive layouts of the one component. Data the card needs but Standings doesn't pass today (opponent name, W-L-T record) is threaded in from the standings side. **No new tokens, no literal hex.**
**Rationale:** the same concept was drawn four ways and drifted (Standings fell to a flat, wrapping, single-tier, lime, non-`--font-data` strip with no avatar/opponent/hierarchy — hard to scan); owner reported it directly. A token-locked "twin" was considered and rejected as deferred debt — owner chose to unify now. Scorebug is the decision-backed pattern (2026-06-25), so the unified card reuses its visual language verbatim rather than inventing a variant; the one accepted cost is touching the Schedule page the owner likes (regression risk — verify the schedule strip + rail render pixel-identical before sign-off). Aligns with the active **Standings Remodel** plan.
**Applies to:** new `components/public/MyTeamCard.tsx` (+ CSS module or shared scorebug classes); `components/public/StandingsContent.tsx` (thread opponent + record, render `MyTeamCard` with the division-jump action) retiring `MyTeamStandingsStrip.tsx`/`.module.css`; `components/public/ScheduleContent.tsx` + `app/[orgSlug]/schedule/schedule.module.css` (mobile `.scorebugBar` + desktop `.railCard` re-expressed through `MyTeamCard`, actions passed as the slot). **a11y/overflow:** verify the low-opacity micro-labels (`NEXT UP`/`FINAL` near `--white-45`) hit AA on the **light** public surface — bump to `--white-55` if faint; body `min-width:0` + single-line ellipsis on meta/opponent; right rail `flex-shrink:0`; touch targets ≥34px; confirm the Standings card renders inside the same public-theme token scope so `--white`/`--white-55` resolve identically to Schedule (reason about token parity, not literal colors). **Generalizes:** when one concept is drawn by ≥2 drifting surfaces, prefer ONE presentational component parameterized by data + an `actions` slot over per-page forks (or token-locked twins, which are deferred debt); reuse the decision-backed surface's visual language verbatim rather than a new variant; push per-surface differences (rank scope, actions, whether an unfollow control shows) through props; and when consolidating, snap any off-brand accent (lime) onto the themeable org `--primary` so the followed-team card respects per-org theming everywhere.

### 2026-07-02 — Coaches Portal Depth-chart board (P5) — mobile reflows to a per-player ACCORDION (a considered deviation from the 2-D-grid→scroll default), NOT a horizontal-scroll grid
**Decision (owner-approved, pre-build /design pass on the P5 mockup `public/depth-chart-mockup.html`):** the team Depth-chart board (players × positions, plus a Pitcher column and an A-squad column) keeps the **wide matrix on desktop/tablet** (its whole reason to exist is team-at-a-glance depth), but at **≤640px it reflows to a per-player accordion card list**, NOT the default "genuine 2-D grid → `.scrollXSticky` horizontal scroll" treatment from the 2026-06-29 mobile-conventions decision. Each player is one collapsed card (name + their Best-position chips + a pitcher badge + the A-squad star as a read-only summary); tapping expands the **existing `PositionProfileEditor`** (built P1) + the pitcher toggle/rank/cap + the A-squad star, inline. **This is a narrow, logged deviation** from the 2-D-grid rule, justified by two things the lineup/week grids don't have: (a) **10 columns** (8 fields + Pitcher + A-squad ≈ 2× the lineup's ~6–7 innings), so on a ~375px phone a ~150px sticky name column leaves room for only ~4 field cells and **strands Pitcher + A-squad at the far-right scroll extreme** — the two most important columns; and (b) a **per-player editor already exists** (the player page) to reuse, so each ROW is genuinely one record → the portal's list-shaped-→-stacked-cards idiom fits. Desktop also **reorders Pitcher + A-squad to sit immediately right of the sticky player column** (a second identity cluster) so they're reachable first even in the desktop scroll. Other mockup corrections folded in: **auto-save + Undo/Redo + quiet "✓ Saved" status, NO Save button** (conforms to the 2026-06-29 coach-editing model — the board edits the same class of data); the season caps render as a **compact read-only summary line** with an "Edit in Settings →" link (NOT three boxed inputs — the editable copy stays single-source on the Settings "Lineup rules" card, per the 2026-07-01 "don't box a number adjacent prose states" rule); the Never cell drops its redundant line-through (tint + ✕ suffices); Best cells number in **pick order** (matching the player-page ranked `morePreferred`, not visual left-to-right); the per-pitcher arm-care cap is an editable affordance (not a dangling read-only value); and the whole surface re-skins from the mockup's bespoke hex to coach tokens (`--surface`/`--surface-2`, `rgba(var(--blueprint-blue-rgb),0.25)` border, `--shadow-sm`+`--highlight-top`, `--radius`/`--radius-sm`, `--white-90/45`, `--font-display` numbers).
**Rationale:** owner asked whether a phone should get the grid or an accordion/per-position view; the far-right-strand analysis + the existing reusable editor make the accordion clearly better than pushing a 10-wide grid through a straw, and it keeps mobile editing first-class. Reuses `.scrollXSticky`/`.lineupScrollHint` only for any retained desktop scroll; the per-position (pick a position → players ranked) view is noted as a possible later *secondary* desktop lens, out of scope for V1.
**Applies to:** the future P5 board `app/[orgSlug]/coaches/teams/[teamId]/**` + `coaches.module.css`; reuses `components/coaches/PositionProfileEditor.tsx` and the `buildLineupProfileWrite` write path. **Generalizes:** the default "2-D grid → sticky-col horizontal scroll" rule has an escape hatch — when a matrix has **many columns (≈≥8)** AND **each row is genuinely one editable record** AND **a per-record editor already exists to reuse**, reflow mobile to a per-record accordion instead (log the deviation); pull the highest-priority columns adjacent to the sticky label; and any new editing surface adopts the auto-save+Undo/Redo model + single-source setting summaries, never a re-introduced Save button.

### 2026-07-02 — A-squad / "gold-medal starter" gets a deliberate NEW `--gold` (medal) token — the one sanctioned categorical hue beyond lime/amber/success/danger, applied to BOTH the depth board and the player-page toggle
**Decision (owner-approved design-system extension):** the **A-squad = "gold-medal starter"** concept earns a single, deliberately-added **`--gold`/`--medal` token** (a warm gold ≈ `#f5c451`, plus `--gold-rgb` for tinting) — the first sanctioned categorical hue added beyond the established `--logic-lime` / `--warning` / `--success` / `--danger` set. A **filled gold star** marks an A-squad player; non-A-squad is an outline star in `--white-45`. This is logged as an **intentional token extension** (not incidental drift): the A-squad/gold-medal semantic is genuinely new and is NOT reusable from the existing palette without overloading it — `--logic-lime` is the CTA/done accent, `--warning` (amber) is the Late/uneven/warning signal, `--success` and `--danger` are status. The gold star is applied consistently in **both** places the concept lives: the new depth-chart board **and** the already-shipped player-page A-squad control (which currently renders as a plain checkbox with no visual mark) — so the two surfaces share one treatment and can't drift. Reserve `--gold` strictly for the A-squad/gold-medal-starter meaning; it is not a general-purpose accent.
**Rationale:** owner asked whether A-squad should introduce a new hue or reuse white filled/outline; the "gold medal" metaphor is strong and universally read, the alternative (white filled-vs-outline star) is a weak binary signal, and the semantic is genuinely first-class — so a single deliberate token, logged and scoped, is the right call over either silent drift or a washed-out white treatment.
**Applies to:** `app/globals.css` (add `--gold` + `--gold-rgb` in both light/dark blocks at P5 build time), the future P5 depth-chart board, and `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx` (upgrade the A-squad toggle to carry the gold star). **Generalizes:** a NEW categorical token is added only when a semantic is genuinely first-class and can't be expressed by the existing lime/amber/success/danger set without overloading it — and when added it is logged, scoped to that one meaning, given a `-rgb` companion for tinting, and applied to every surface the concept appears on at once (never one surface leading the other into drift).

---

### 2026-07-01 — Coaches Announcements: collapse the two stat cards to one recipient line + align its cards to the elevated dashboard treatment
**Decision:** The team Announcements editor (`components/coaches/RepAnnouncementEditor.tsx` + `AnnouncementEditor.module.css`, shared by free + Premium coach portals) dropped its **two oversized stat cards** ("On roster N" / "Recipients M") — big empty boxes for two numbers the sentence beneath already stated — in favour of **one compact neutral recipient line** ("Sending to **3** families with a guardian email on file."), with the amber missing-email warning still owning the gap and the amber zero-state unchanged. Its compose card + log card were brought to the same **definition** as this session's elevated dashboard tiles: `box-shadow: var(--shadow-sm), var(--highlight-top)` (real elevation, not just the inner top-highlight) + a `rgba(var(--blueprint-blue-rgb), 0.25)` coach-blue border, keeping the `--surface` solid card surface (appropriate for input-bearing cards; the platform card surface). No new tokens, no literal hex.
**Rationale:** The stat cards were the same "big empty box for a single metric" problem the dashboard just fixed, and they triple-stated the recipient count (two cards + the note). A `/ux` + `/design` pass agreed. This **supersedes the 2026-06-17 note** that the compose card be a strictly *neutral* `--border` card "no glow" — the coach-portal-consistency goal (all coach cards read as one system) now wins, so it takes the same blue-tint border + `--shadow-sm` elevation as the dashboard; the "lime accent only on the Send button" rule still holds (a structural blue border is not the lime action accent).
**Applies to:** `components/coaches/RepAnnouncementEditor.tsx` (summary block + verbose note → `.recipientBar`), `components/coaches/AnnouncementEditor.module.css` (`.recipientBar*` added; `.summary`/`.summaryItem*`/`.recipientNote*` removed; `.form` + `.logCard` elevation + blue border). **Generalizes:** don't render a standalone stat *card* for a single number that adjacent prose already states — a one-line recipient/summary bar carries it; when a surface predates a card-system elevation, bring its cards to the same `--shadow-sm + --highlight-top` + blue-tint-border definition so the portal reads as one system (not the older `--border`/highlight-only treatment).

### 2026-07-01 — Coaches Overview dashboard: elevate the metric tiles toward the admin-dashboard polish WITHOUT adopting the admin HUD skin
**Decision:** The Premium Coaches Portal team-Overview snapshot tiles + Season card were elevated to read as crisp, defined "dashboard" cards, benchmarked against the tournament-admin dashboard the owner finds cleaner — but staying inside the **warm/rounded coach identity** (the 2026-06-26 "keep coach warmth" decision), NOT the admin's sharp HUD skin. Concrete changes (no new tokens, no literal hex): (1) `.snapshotCard` gains **depth-at-rest** `box-shadow: var(--highlight-top)` (the same inner-top-highlight the global `.card` uses) + a hover **lift** (`transform: translateY(-1px)` + `var(--glow-sm)`) — this is the single biggest "defined vs flat box" win; (2) **radius token fix** `10px`→`var(--radius)` (12px) on the tiles and `8px`→`var(--radius)` on `.wltWidget` (was a literal-value drift); (3) rest-state **border strengthened** to `rgba(var(--blueprint-blue-rgb),0.25)` so a tile reads as a card at rest, hover `0.55`; (4) **uniform `min-height:116px`** so the tile row aligns (a run-mode metric grid, distinct from the 2026-06-26 *setup checklist* which stays a single-column list); (5) `.snapshotValue` **1.45→1.55rem + `letter-spacing:-0.01em`** for more "metric" presence; (6) the **Season card (`.wltWidget`) adopts the identical tile treatment** (blueprint-tint border + `--radius` + `--highlight-top` + `--white-5`) so the "at a glance" and "Season" bands read as one system; (7) kept the earlier same-session additions: headline **stat strip** (`.statStrip`, display-font white numbers, dot-separated) and a **header "→" affordance** (`.snapshotHeadArrow`, blueprint-blue, brightens/slides on hover) as the coach-warm analogue of the admin's lime "VIEW →".
**Rationale:** The admin dashboard's cleanliness comes from card **definition + depth + number hierarchy**, not its specific HUD *skin* (square `border-radius:0`, `--font-data` **lime** numbers, solid blueprint-blue borders, blue/lime glows). Copying that skin would violate the binding 2026-06-26 "coach warmth" decision and the lime-is-accent-not-body convention. So we transplanted the *clarity mechanisms* (depth shadow, defined border, uniform height, tighter big numbers, one-system banding) while the coach surface keeps rounded corners, `--font-display` **white** numbers, and blueprint-blue as the structural accent. HELD (recommend, not applied): a left icon-chip per tile (admin `.statIcon` idiom) — it unbalances the compact small-label header of the coach's *vertical* stat-card archetype (admin cards are icon-left *horizontal*), so it needs a device look before committing.
**Applies to:** `app/[orgSlug]/coaches/coaches.module.css` (`.snapshotCard`(+`:hover`), `.snapshotValue`, `.wltWidget`, `.statStrip*`, `.snapshotHead`/`.snapshotHeadLabel`/`.snapshotHeadArrow`), `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (stat-strip render, header-arrow markup). **Generalizes:** to make a warm/rounded surface read as "admin-dashboard clean," transplant the *definition mechanisms* — `--highlight-top` depth at rest + hover lift/glow, a real (not near-invisible) border, uniform card `min-height` for a run-mode metric grid, tighter/larger display-font numbers, and one shared card treatment across every band — NOT the other surface's skin (corner radius, number font/colour, glow palette). Fix literal-value radius drift to `--radius*` tokens whenever a card is touched.

### 2026-06-30 — Coaches Portal Tryout Day (Phase 2A) UI direction (design pass; pre-build, owner-approved)
**Decision (4 sub-decisions, all reuse — no new tokens/primitives):**
1. **"Tryout" event-kind on the schedule = the existing EventChip vocabulary, not a one-off.** A tryout session renders as a **read-only** chip using the established left-border-accent + badge idiom: a "Tryout" eyebrow badge + clipboard glyph, a **distinct non-game accent mapped to an existing token** (picked at build; NOT a new hex), and **no score/result** — tapping opens the tryout workspace, not the event editor. Rejected the sketch's one-off "⬡" hexagon (don't invent a shape; distinct datum via existing vocabulary — generalizes the 2026-06-29 bracket-card decision).
2. **Blind mode is an unmistakable MODE, not a subtle flag.** When ON: a **persistent "Blind · names hidden" chip** (neutral/info treatment, **not** alarm-amber — it's a normal mode), rows lead with the **big bib number as identity**, and the name area is simply absent/masked (**never a faked name**). The (Phase-2B) one-way reveal is a deliberate **confirmed-irreversible** action via `ConfirmProvider` ("can't be undone"), after which the chip flips to "Names revealed · <time>".
3. **Field-side touch exception (scoped to day-of check-in):** check-in rows **~56px / control ≥48px**, above the portal's 40px mobile floor — justified by outdoor, one-handed, gloved/cold use. The check-in **control is color-never-alone**: whole-row tap with a filled-vs-outline structure + check/empty-circle icon + a text label ("Checked in" / "Tap to check in") + a lime left-border on the checked state, with a brief **Undo** on mis-tap (accidental taps are the #1 field risk; matches the portal's auto-save+undo ethos). Generalizes the attendance segmented-pill logic to a **binary** toggle.
4. **Lime is fills/borders/CTAs only here.** `--logic-lime` is poor as small text and weak in sunlight — use `--success`/`--white-90` for the "Checked in" label; prefer **solid fills + bold weight** over subtle tints for the primary state so it survives glare. Progress shows the **numeric fraction `12/23` alongside** the bar (never bar-only). Provincial-window notice = **HelpCallout `warning`** (amber, non-blocking, inline) — not a modal, not danger-red.
**Rationale:** owner asked for mockups + an on-system check before building Phase 2A. The sketches were ~80% on-system; these corrections keep everything inside the Coaches Portal mobile system (CollapsibleCard/EventChip/sheetOnMobile/safe-area sticky bars/the Registration `[●ON]` toggle/branded PDF export) and the 2026-06-29 mobile conventions, while adding a justified field-side touch exception and a color-blind/sunlight-safe check-in control.
**Applies to:** the Phase 2A tryout-day surfaces — the program-year Tryouts "Tryout Day" setup card, the mobile day-of check-in view, the walk-up bottom-sheet, the schedule tryout-chip projection, and the candidate-sheet PDF (`app/[orgSlug]/coaches/teams/[teamId]/**`, `coaches.module.css`). See `docs/projects/active/COACHES_PORTAL_TRYOUTS_EVAL_PHASE2A_PLAN.md`.

---

### 2026-06-29 — Coaches event Result: W/L/T is always DERIVED from the score (manual override dropped); the score moves to the event header and the Result tab is retired
**Decision (owner-driven mobile pass; no migration):**
1. **No manual Win/Loss/Tie override — the result is a computed property of the two scores.** The Result entry dropped its `Auto / Win / Loss / Tie` dropdown; W/L/T is now always derived (`team > opp → win`, `< → loss`, `= → tie`). The old dropdown let a coach store "Loss" on a visible 5–3 game, and that stored result feeds the **Season Record (W–L–T)** widget and the schedule-row badges — so a contradicted result silently corrupted an aggregate the coach trusts. No forfeit concept was attached, so the override was pure footgun. The live editor shows a small **derived result badge** next to the two number inputs (confidence cue that the numbers decide) instead of a picker. **Forfeits, if ever wanted, must be an explicit labelled control** (a "Forfeit" toggle that sets a clear forfeit state and annotates the badge, e.g. "W · FF") — never a silent W/L/T picker that contradicts the numbers.
2. **The final score lives in the event HEADER, not behind a tab.** A played game's score is its headline fact, so it now renders as a compact line in the slide-over header identity zone (under the date/venue meta), game events only — reusing the EventChip discipline of **neutral numerals + a single colour-coded result badge** (`.eventScoreValue` white-90 + `.resultBadge`). The **Result tab is removed**; game events now show **Attendance · Lineup** only (Result was two numbers + a badge — far under-weight for tab parity with a 12-row attendance list and the lineup grid). Entry/edit is inline on that header line: played → score + a quiet "Edit score"; **not-yet-played → a single "+ Add final score" ghost CTA** (never a placeholder `0–0`, which would read as a real nil-nil result and pollute the record — parity with EventChip showing no badge until a result exists).
**Rationale:** owner flagged a 5–3 game stamped "LOSS" — a single-source-of-truth violation (result stored independently of, and disagreeing with, the score it derives from). Removing the override fixes the integrity gap; moving the score to the header matches every sports app + our own EventChip/scorebug idiom and removes an oversized tab. All existing tokens/classes; the result-status hexes stay inline in JSX (consistent with EventChip), none added to the CSS module.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (slide-over header score line, dropdown-free inline editor, derived result on save, `slideTab`/`scoreForm` types, Result tab + push removed), `app/[orgSlug]/coaches/coaches.module.css` (new `.eventScoreLine`/`.eventScore`/`.eventScoreValue`/`.eventScoreEdit`/`.eventScoreAdd`/`.scoreFieldLabel`/`.scoreFormSep`/`.scoreFormActions`; removed orphaned `.scoreSection`/`.scoreDisplay`/`.scoreNum`/`.scoreSep`). No new tokens, no migration. **Generalizes:** a derived status (W/L/T from a score, a pass/fail from a number) is **computed, never separately editable** — storing both and letting them disagree corrupts any aggregate built on it; if a real override is ever needed it must be explicit and self-explaining (labelled, annotated on the badge), never a silent picker. And the headline fact of a record (a final score) belongs in the header identity zone, not behind a tab that's under-weight next to its peers — show it neutral-numerals + colour-badge, edit inline, and render a quiet "add" CTA (not a zero placeholder) before the value exists.

---

### 2026-06-29 — Public playoff bracket card: live venue FIELD on the meta line (yields to status badge), whole-card link, Standings⇄Schedule parity
**Decision (/ux + /design pass on the public bracket; no migration):**
1. **Venue on the card.** Each SVG match card (`LogicSyncBracket`, 220×104) now shows the game's FIELD/diamond appended to the existing date·time meta strip ("Jul 5 · 9:00 AM · Diamond 2"). Rules: **short field label only** (the facility name, e.g. "Diamond 2", NOT the full "Venue — Facility" — on a single-event bracket the venue is constant and the diamond is the differentiator a fan needs), resolved **live** via the new `resolveGameFieldLabel` (facility → venue name → `game.location` fallback) so a facility rename propagates immediately. **Text-only, no icon** (the meta strip has no icons; an 8.5px MapPin reads as mud at SVG scale), `fontSize 8.5` / `var(--white-45)` matching the date·time text, sliced to 18 chars. **Venue yields to the status badge** — on finished/cancelled games the right-aligned badge owns the strip and the score is the focus, so the venue is dropped to avoid collision (shown only when there's no badge, i.e. upcoming games — the wayfinding case).
2. **Whole card is a link.** When the tournament slugs are passed, each card wraps in a native SVG `<a href>` to the public game-detail page (`/{org}/{tourn}/schedule/{gameId}` — the same destination the List view uses), keyboard-focusable with an `aria-label`. **Affordance:** a transparent `.hoverRing` rect lights up to the full `var(--primary)` border on `:hover`/`:focus-visible` (reuses the live-node border in the card's own vocabulary). **No transform** (a scale would desync the SVG connectors/layout). The drag-to-pan click-swallow also `preventDefault`s so a pan across a card never navigates.
3. **Standings⇄Schedule parity.** The pool→tier→single split logic was extracted into a shared `components/bracket/TieredBracket.tsx` used by BOTH the Schedule tab and the Standings page (Standings previously dumped all playoff games into one diagram → duplicate finals / merged tiers). Pool attribution centralized in `lib/playoff-bracket.ts` `inferGamePool`.
**Rationale:** owner asked for venues on bracket games, clickable cards, and Standings-bracket parity with the (better) Schedule bracket. The field-not-venue choice keeps the compact card legible while showing the datum that actually varies; live resolution fixes a facility-rename staleness the owner hit ("Diamond 2" showing as old "2"); one shared component keeps the two surfaces locked together.
**Applies to:** `components/bracket/LogicSyncBracket.tsx` (+`.module.css`: `.clickableNode`/`.hoverRing`), new `components/bracket/TieredBracket.tsx`, `lib/venue-label.ts` (`resolveGameFieldLabel`), `lib/playoff-bracket.ts` (`inferGamePool`), `lib/types/bracket.ts` (`venueLabel`), `components/public/ScheduleContent.tsx` + `StandingsContent.tsx`. No new tokens, no literal hex. **Generalizes:** on a compact card, append the most-specific varying datum (field, not full venue) to the existing meta line text-only rather than adding an icon or a second strip; resolve denormalized venue/facility labels LIVE everywhere (a stored snapshot goes stale on rename); make an SVG node clickable via a native `<a>` + a border-ring hover/focus affordance (never a transform inside a connector-bearing SVG); and when two surfaces render the same diagram, drive both from ONE shared component so they can't drift.

---

### 2026-06-29 — Coaches Lineup + Attendance: auto-save (no Save button), lineup Undo/Redo, icon-only footer tools
**Decision (owner-driven; no migration):**
1. **Auto-save, no Save button.** The lineup auto-saves ~0.9s after the last change (debounced); attendance auto-saves ~0.7s after a status tap. A quiet right-aligned status replaces the Save button: "Saving…" → "✓ Saved" → "Couldn't save · Retry" (the only error surface). **Race guard:** a save only marks state clean if a signature of the latest edited state still matches what it persisted — an edit made *during* a save is never silently dropped; the post-save server re-sync (which stomped concurrent edits) was removed (client is authoritative).
2. **Lineup Undo/Redo.** Snapshot-based history (per-event, reset on event change) captured at the start of each user mutation (position, reorder, starter, mode, innings, auto-fill, clear, template). Undo/redo arrows in the footer; the safety net for "auto-save persisted a mis-tap."
3. **Footer = icon-only tools** (mobile-first: "symbols not words"): Undo / Redo / Clear (eraser) / Print (printer) as 40px icon buttons in a left cluster; the Print menu, which ran off-screen, now spans the modal width just above the footer on mobile.
**Generalizes:** a frequently-edited mobile surface auto-saves (debounced) with a quiet status + a signature-guarded dirty flag (never clear dirty if state changed mid-save; don't re-sync from the server over a concurrent edit), pairs auto-save with Undo/Redo as the mis-tap safety net, and uses icon-only footer tools with any overflowing popover re-anchored to the viewport/modal width on mobile.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (lineup + attendance save model, undo/redo, footer), `coaches.module.css` (`.lineupFooterTools`/`.footerIconBtn`/`.saveStatus`/`.saveRetry`, mobile `.lineupPdfMenu`).

---

### 2026-06-29 — Coaches Attendance refinement: status control = ONE connected segmented pill; filter chips = icon + count (one row)
**Decision (owner-driven, mobile pass; no migration):**
1. **Per-player status = a single connected segmented control**, not four separate outlined boxes. One border frames the group, thin dividers split the four segments (In / Late / Out / No-reply icons), and only the chosen status fills with its colour (`--success`/`--warning`/`--danger`/muted); active segments drop their own border. Calms a 12-row list. The note glyph stays a separate borderless icon with the lime has-note dot. Builds on the earlier 2026-06-29 attendance entry.
2. **Filter chips fit one row**: the four status chips drop text labels → **colour-coded icon + live count** only (`title`/`aria-label` carry the name); "All N" keeps its label.
3. **Full-screen modal covers the bottom nav** (z-index above nav) so the sticky Save bar sits at the true bottom; back arrow (←) exits. Owner-confirmed intentional. Modal **side gutters trimmed** 24px→~14px on mobile (horizontal only).
**Generalizes:** a roster-marking row uses ONE segmented control for the primary status (joined pill, active-fills-colour) not N separate buttons; metric/filter chips shed text for icon+count when width is tight (name in tooltip/aria).
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`, `coaches.module.css` (`.attendanceStatusGroup`/`.attendanceStatusBtn`).

---

### 2026-06-29 — Admin "Now Playing" tile: status badge is a top eyebrow line, not inline before the matchup
**Decision:** In the admin dashboard "Now Playing" live strip, the LIVE / IN REVIEW badge moves to its own full-width eyebrow line above the matchup (new `.liveStatusRow`), and the matchup + score share the next row (`.liveRowMain`). Previously badge + matchup + score sat on one inline row with the badge `flex-shrink:0`, so the wider two-word "IN REVIEW" badge stole leading width and forced the team-name column (200px-min tile, `overflow-wrap:anywhere`) to wrap into a tall squished column — while short "LIVE" tiles looked fine.
**Rationale:** Variable badge width should never drive matchup layout. An eyebrow line gives every tile full matchup width regardless of badge length, so LIVE and IN REVIEW tiles align and long names wrap cleanly. Reuses the existing "status eyebrow on its own line" pattern (`.bracketMatchupStatus`); no new tokens, the lime/amber border-left + badge colour cue is unchanged.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (renderNowPlayingPanel) + `dashboard.module.css` (`.liveStatusRow`, `.liveRowMain`).

---

### 2026-06-29 — Coaches Schedule mobile round 2: full-screen modals, Lineup⇄Playing-time toggle, per-game reorder, settings grid, event-row wrap, compact Add, record→Overview
**Decision (owner-driven, from a 7-screenshot mobile pass; all on `dev`, no migration):**
1. **Full-screen modals on mobile.** The event **detail** slide-over AND the add/edit **form** cover the full viewport edge-to-edge at ≤640px (no rounded bottom-sheet), scroll internally, and the page behind is **scroll-locked** (JS sets `body overflow:hidden` while either is open). The header X is replaced by a leading **back arrow (←)** on mobile (`.modalBackBtn` shown, `.modalCloseBtn` hidden, header `justify-content:flex-start`). Inner padding stays 1.5rem so the sticky-footer edge-bleed math is unchanged. Generalizes: a mobile modal on this portal is full-screen with a back arrow + background scroll-lock, not a partial sheet.
2. **Lineup tab = a Lineup ⇄ Playing-time TOGGLE, not a stack.** A segmented control (`.lineupViewToggle`, blueprint-blue active) switches the editable grid (with its settings + notes) and the playing-time summary; the old collapsible "▸ Playing-time summary" is retired. Applies desktop + mobile.
3. **Per-game batting order, reorderable on mobile.** The lineup keeps its own order (can differ from roster for that game). Desktop = drag grip; mobile = up/down arrows in the batting-number column (`.lineupMoveControls`, dense-grid exception ~18px). Hint corrected to "Starts from your roster order — drag (or use ↑↓ on mobile) to set this game's batting order."
4. **Lineup settings = 2×2 grid on mobile** (Format | Innings / Auto-fill | Templates) instead of a wrapping row with an over-wide Innings select.
5. **Event rows wrap on mobile** (`.eventChip` flex-wrap + order): line 1 = time … score/result; line 2 = the full untruncated name — so opponent + score + result all show.
6. **Add Event collapses to a compact "+"** on mobile (label hidden, `aria-label` kept).
7. **Season Record (W–L–T) moved to the Overview** dashboard (glanceable team metric) and off the Schedule top — **DONE 2026-06-29**: extracted to shared `components/coaches/SeasonRecordWidget.tsx`, removed from Schedule, rendered below the Overview "Your team at a glance" snapshot (Overview already fetches the team's events). Renders nothing until a game is finalized; per-team include-toggles + breakdown unchanged.
**Rationale:** owner mobile review — modals felt partial and let the background scroll, lineup + summary were stacked and long, reorder didn't work by touch, settings/Innings were awkward, event text truncated, and the record cluttered the Schedule top.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` + `coaches.module.css`; record-move also `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (pending).

---

### 2026-06-29 — Coaches event form: NAME is a demoted optional override, not a headline; + Schedule mobile polish pass
**Decision (owner-approved during the mobile design review):**
1. **Event Name is no longer the headline field.** It moved from the top of the add/edit event form to the **bottom (just above Notes), labelled "Name · optional"**, with an "Auto: …" placeholder and a "leave blank to use the default" hint. Every event already resolves a name on save (`f.name.trim() || deriveGameName(type, opponent) || EVENT_NAME_PREFIX[type]`), so games/practices/events auto-name by default and a custom label is a deliberate override — it should not occupy prime "title" real estate or read as a required main field. Applies to all event types (the auto-name fallback covers each). No schema change (name still stored).
2. **Mobile page-header compaction (portal-wide).** At ≤640px the coach `.pageHeader`/`.pageTitle`/`.headerIcon` shrink (title 1.75→1.35rem, icon 48→40px, tighter margin) so an operating tool's records start near the top instead of behind a hero header (design heuristic: no hero headers inside operating tools).
3. **Lineup drag-handle hidden on mobile.** The batting-order drag grip is hidden at ≤640px — drag inside a horizontally-scrolling pinned column is impractical by touch, and the batting order follows the roster (the on-grid hint already says so). Consistent with disabling Roster card drag on touch (use up/down there). Desktop keeps the grip.
4. **Lineup grid name is jersey-free.** The pinned name column drops the "#NN " jersey prefix (the batting-number column already labels the row) so names stay on one line in the narrow sticky column; jersey numbers remain in attendance/roster/summary.
5. **Pinned-column header opacity fix.** Sticky Player/Start **header** cells were bleeding the scrolling inning number through ("P2AYER") because the base `.lineupTable th` translucent fill out-specified the sticky background; fixed by prefixing the sticky rules with `.lineupTable`. Body cells were already opaque.
6. **Name-part hardening.** A literal `"null"`/`"undefined"` first/last name (bad seed/import) is treated as blank in the coach name builders, so a player like "Madonna" never renders as "Madonna null".
7. **Event-detail action cluster** drops its `margin-left:auto` push at ≤640px so Cancel/Delete group tightly with Edit instead of leaving an orphaned-looking gap.
**Rationale:** the mobile Schedule review (owner, 6 screenshots at 400px) found the name field wasted prime space, the page header read as a hero, the lineup grips conflicted with the "reorder in roster" hint and were unusable by touch, long names wrapped, and the pinned header bled. All fixes use existing tokens/patterns; no new primitives, no migration.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` + `app/[orgSlug]/coaches/coaches.module.css` (header compaction is portal-wide).

---

### 2026-06-29 — Coaches Portal mobile conventions (portal-wide system for the focused mobile pass)
**Decision (owner-approved kickoff of a focused mobile pass; sweep order Schedule → Roster → Overview → rest):** the Premium Coaches Portal standardizes on ONE small mobile system. Key finding: the portal was already partly mobile-built (Roster reflows to cards @640, event slide-over → bottom-sheet @600, lineup grid horizontal-scrolls + summary chip-swaps @640, week grid scrolls, form grid 1-col @520, Overview snapshot is `auto-fit`, sticky bars use `env(safe-area-inset-bottom)`) — so this is **standardize + fill gaps + audit**, NOT build-from-scratch.
1. **Two canonical breakpoints (collapse the ad-hoc 900/640/600/520):** **`900px` = shell only** (sidebar → bottom nav; main bottom-padding for the nav). **`640px` = ALL content reflow** (tables→cards, multi-col→stack, overlay→sheet, form-grid→1-col, segmented controls wrap). **Retire 600 + 520** — fold the slide-over sheet 600→640 and the form-grid 1-col 520→640. No other content breakpoints.
2. **Touch targets:** ≥**40px** for primary/standalone controls on mobile; 32–34px allowed ONLY inside dense grids (lineup selects, attendance icons) where spacing disambiguates — bump those borderline ones to ≥36 on mobile.
3. **Wide data — cards vs controlled scroll:** list-shaped tables (≤~5 cols, one record/row) → **reflow to stacked cards** @640 via the Roster idiom (`thead{display:none}`, rows = bordered cards, `td` flex with `::before{content:attr(data-label)}`). Genuine 2-D grids (lineup rows×innings, the 7-day week) → **controlled horizontal scroll** with a **sticky first column** (player/day stays visible) + a **visible scroll affordance** (right edge-fade + one-time "swipe →" hint).
4. **Week view:** don't sideways-scroll on mobile — **reflow to a vertical day-stack** (day header + its event-chip rows; empty days a thin "—"). Month stays a grid (≥40px day cells); List already works.
5. **Overlays → bottom-sheet @640:** both the event detail slide-over (done) AND the add/edit event form modal become full-width top-rounded sheets (`max-height ~92vh`, flush bottom). Generalize `.slideOverScrim` into a shared `sheetOnMobile` modifier any overlay opts into.
6. **Sticky action bars:** `position:sticky; bottom:0`, edge-bleed, `padding-bottom: calc(<pad> + env(safe-area-inset-bottom))` — shared utility; save bars + the recurring-edit scope chooser follow it.
7. **Filters/segmented controls:** chips already `flex-wrap` (keep); equal-width `.segChoice/.segBtn` (Home/Away, view toggle) wrap or go full-width-stacked @640 rather than squashing text.
8. **Forms:** `.formSectionGrid` 2-col→1-col @640; the event Links rows (label+url side-by-side) stack @640.
**Shared primitives to extract (vs per-surface):** (a) `tableAsCards` reflow (Roster idiom) for all list-tables (Accounting next); (b) `scrollX` wrapper (overflow-x + edge-fade + sticky-first-col) for 2-D grids; (c) `sheetOnMobile` overlay modifier; (d) `stickyActionBar` safe-area footer; (e) the two documented breakpoints (900 shell / 640 content) so nobody re-invents 600/520. Per-surface stays per-surface: the week day-stack, lineup sticky-column, and each surface's audit fixes.
**Per-surface:** Schedule — week→day-stack, slide-over sheet (bump 600→640), lineup sticky player col + scroll hint, attendance icon/note touch ≥36 + chip-row wrap, event form → sheet + Links rows stack. Roster — AUDIT the existing card reflow (touch drag-reorder usability — consider up/down move buttons or disable drag on touch; action buttons ≥40px). Overview — AUDIT (snapshot auto-fit + single-col setup already responsive; confirm full-width tap-friendly, no overflow). Chat already has its own mobile lock (2026-06-25) — leave it. **Generalizes:** a portal gets ONE shell breakpoint + ONE content breakpoint; wide data is either a card-reflow (list-shaped) or a sticky-first-col+affordance horizontal scroll (2-D) — never silent sideways scroll; overlays are bottom-sheets on mobile; action bars respect the safe area; extract the reflow/scroll/sheet/sticky patterns as shared primitives so each surface is a small diff.
**Applies to:** `app/[orgSlug]/coaches/**` + `app/[orgSlug]/coaches/coaches.module.css` (portal-wide). Plan: `docs/projects/active/COACHES_PORTAL_MOBILE_PLAN.md` (+ PM brief).

---

### 2026-06-29 — Coaches event Attendance: compact one-line rows + a metric/filter chip bar (GameChanger-inspired, on our palette)
**Decision (owner-approved /design):** the event slide-over Attendance tab is rebuilt from tall stacked cards (name → 4 full-width status buttons → full-width note) into a dense, organized list.
1. **Metric chips that double as filters** (`.attendanceFilters`/`.attFilter`). One pill row: `All (n)` + four status pills `In / Late / Out / No reply`, each showing its **icon in the status colour + a live count** (so the row is always a metric). Tapping a pill filters the list; tapping the active one clears to All. **Selected pill fills its own status colour** (`rgba(var(--success/warning/danger-rgb), .14–.16)` + that colour border/text); **All selected uses the lime convention**. Distinct from the Attendance/Lineup/Result underline-tabs above (pills, not a second tab strip). Default filter = All.
2. **Four states kept as four chips, not forced into GameChanger's 3 tabs** — Late is a real tracked state (and used by the lineup), so it stays first-class. **Brand tweak vs the GameChanger example: No-reply is MUTED grey** (`CircleHelp` + `--white-45`), not blue — blue would add a 5th categorical colour we don't use (palette = `--success`/`--warning`/`--danger` + muted).
3. **Compact one-line row** (`.attendanceRow` flex-wrap): name (truncates) · an **icon-only segmented status control** (`.attendanceStatusGroup` inline, 34×32 buttons, one tap to set, `aria-label`/`title` per icon) · a **note glyph** (`.attendanceNoteToggle`). The per-player note is **on-demand**: collapsed by default, a **lime dot on the glyph signals an existing note**, tapping expands a full-width note input as a second line for that row only (`flex-basis:100%`). Roughly doubles players-per-screen.
4. **Bulk All-in / Reset stay top-right** in the header; a bulk set resets the filter to All so the result is visible (a status filter would otherwise empty out). Optional future: a contextual "mark all shown" when a status filter is active (not built v1).
**Rationale:** the row, not the list, was the bloat (three stacked full-width elements per player). Compact icon control + on-demand note is the real scroll fix; the metric/filter chips add the at-a-glance organization the owner wanted without a second tab strip or a new colour. Token cleanup: the `unknown` active state moved off a literal slate to `--white` tokens.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (Attendance block → metric/filter chips + compact rows + note toggle; `attendanceFilter`/`expandedNotes` state; `setAllAttendance` filter reset; `ATTENDANCE_OPTIONS` reordered In/Late/Out/No-reply with a "No reply" label), `app/[orgSlug]/coaches/coaches.module.css` (`.attendanceFilters`/`.attFilter*`, `.attendanceRow` flex, icon-only `.attendanceStatusBtn`, `.attendanceNoteToggle`, full-width `.attendanceNoteInput`). No new tokens, no literal hex (status colours via existing `--success/--warning/--danger(-rgb)`). **Generalizes:** for a roster-marking list, keep ONE line per row — an icon-only segmented control for the primary action + on-demand disclosure for secondary fields (a glyph with a presence-dot), never stacked full-width controls; surface the aggregate as colour-coded metric chips that double as filters (count always visible, selected fills the status colour) rather than a separate read-only summary + tab strip; keep a tracked state first-class rather than collapsing it to fit a borrowed 3-bucket model; map status colours to `--success/--warning/--danger`, reserve a borrowed brand's extra hue.

---

### 2026-06-29 — Coaches Schedule: Season Record gets a scope caption + labelled check-chip filters; list game rows show score + opponent on one enriched line
**Decision (owner-approved /design pass on the Premium Coaches Schedule):** two refinements.
1. **Season Record (`WLTWidget`).** Reads as a clear hierarchy instead of label→big-number→loose-pills. The **W–L–T number sits baseline-aligned with an auto-generated scope caption** (`.wltScope`, `--white-45`) naming exactly what's counted — `League + Tournament` / `League only` / `All games` / `No categories selected`. This is the fix for the "0–0 next to a visible WIN" confusion (a scrimmage excluded by default): the caption states the scope rather than leaving the number ambiguous. The filter chips get a leading **`Counting:`** label (`.wltCountLabel`, `--white-35`) so they read as include/exclude controls, and **active chips carry a lucide `Check` (12px)** on top of the established lime tint (`rgba(var(--logic-lime-rgb),0.16)` + `--logic-lime` border/text); inactive = `--white-05`/`--white-45`. The expandable **Breakdown** marks included categories with a **lime dot** (`.wltBreakdownDot`) and drops the dot + dims (opacity .5) excluded ones — dot+dim, not the literal "(excluded)" text (opacity alone is too weak a signal).
2. **List/week game rows (`EventChip`).** One enriched line, not a second row. The **final score** (`teamScore–opponentScore`, team-relative/your-team-first, `.eventChipScore` `--white-90` tabular) renders in a fixed trailing cluster (`.eventChipTrail`, `flex-shrink:0`) **before** the existing WIN/LOSS/TIE badge (badge keeps the only colour cue — score stays neutral to avoid double-encoding). **Opponent safety-net:** games auto-name "League Game vs Lady Jays" (opponent already in the name), so a `· vs/@ {opp}` suffix (`.eventChipOpp`, `--white-45`, `homeAway`-aware) is appended **only when the opponent is set but NOT already in the name** — no duplication on the common path. `.eventChipName` gains `min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` so a long name truncates instead of pushing the score/badge off-row.
**Rationale:** Owner: the record format "could be improved" and wanted score + opponent visible per game. The scope caption removes the ambiguous-zero read; `Counting:` + check chips make the filters legible as include/exclude; the score lives in the trailing cluster (calm, badge carries colour) and opponent rides the existing auto-name (suffix only as a fallback) so single-line scan density is preserved.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (`WLTWidget` scope/caption/Check chips/dot breakdown; `EventChip` score + opponent suffix + trailing cluster), `app/[orgSlug]/coaches/coaches.module.css` (`.wltMain` baseline, `.wltScope`, `.wltCountLabel`, `.wltToggle` flex+gap, `.wltBreakdownDot`, `.eventChipName` truncation, `.eventChipOpp`, `.eventChipTrail`, `.eventChipScore`). No new tokens, no literal hex (existing event-status hexes in the chip left as-is). **Generalizes:** a filtered aggregate (a record/total with include/exclude toggles) needs a **scope caption** stating what's counted so a legitimately-zero value never reads as broken; filter chips need a lead label + a check on active so they read as include/exclude, and an expandable breakdown marks in/out with a dot+dim, not parenthetical text; an at-a-glance row surfaces a NEW datum (score) in a fixed-width trailing cluster with the existing badge as the sole colour cue, and avoids duplicating data already in an auto-derived label (append a fallback suffix only when genuinely missing), with the flexible label truncating so fixed trailing data never gets pushed off.

---

### 2026-06-28 — Coach lineup "Playing-time summary": heat-grid on desktop, position chips on mobile, sharing one fairness header + "on field" gauge (no new palette)
**Decision:** The collapsible playing-time summary in the lineup builder presents per-player metrics with a **responsive A/C split** off one component: a shared **team fairness verdict line** ("Bench: 1–2 innings each · Balanced", `.lineupFairPill`, amber `Uneven` when bench spread > 1) + a shared per-player **"on field" gauge** (the `.snapshotBar`/admin `.gaugeWrap` idiom — track + lime fill = on-field/innings, `--warning` fill when the player sits back-to-back). **Desktop (≥640px):** the rows×positions table with **lime "heat" cells** — `background: rgba(var(--logic-lime-rgb), α)`, α = `min(0.55, 0.1 + count*0.09)` — so concentration/gaps read at a glance; zeros are `·` at `--white-25`, white text stays legible (α capped). **Mobile (≤640px):** the grid is hidden and each player renders as a **chip row** (name, gauge, position chips `P×3` tinted by the same heat α). Single lime hue throughout — **no new categorical palette** (Option B's 4-colour stacked bar was rejected on the no-new-token rule). Collapsed by default; label `--white-50`.
**Rationale:** Owner: make it read like the tournament-admin dashboard metrics. A 9–10 column heat grid is dense+scannable on the wide lineup slide-over but unreadable on a phone, so it swaps to reflowing chips — our standard "table needs a card/alternate pattern on mobile" rule. One shared header+gauge keeps it DRY and keeps the visual language identical across breakpoints (same lime intensity = same meaning). Reuses the exact gauge idiom the 2026-06-26 Coaches Overview decision established, so the two coach surfaces stay one system.
**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` (lineup tab summary: `heatStyle`, `onFieldGauge`, bench min/max, desktop grid + mobile chips), `app/[orgSlug]/coaches/coaches.module.css` (`.lineupFairness/.lineupFairPill(+Warn)`, `.lineupGauge*`, `.lineupHeatCell`, `.lineupZero`, `.lineupSummaryDesktop/.lineupSummaryMobile` 640px swap, `.lineupChip*`). No new tokens, no literal hex. **Generalizes:** present per-row metric matrices as a heat grid on wide surfaces (lime-alpha intensity via `--logic-lime-rgb`, white text, α-capped for legibility) and swap to reflowing chips on mobile, sharing a verdict header + the track/fill gauge idiom; avoid categorical multi-hue charts unless a palette is added to the token system deliberately.

---

### 2026-06-28 — Global marketing footer: brand block (6/12) + two labelled link columns (3/12 each), not one tall stack
**Decision:** The site-wide marketing footer (`components/Footer.tsx`) splits its links into **two labelled columns** instead of one. Layout: brand wordmark + tagline at `col-span-12 md:col-span-6`, then two link columns at `col-span-6 md:col-span-3` each — **Product** (Discover, Pricing, What’s New) and **Get started** (Start Free, Coaches, Sign In). On mobile the brand block is full-width and the two link columns sit side-by-side (`col-span-6`). Keeps existing idioms: `hud-label` column headers, `font-mono text-xs text-data-gray` links, `hover:text-logic-lime`, wordmark + tagline + copyright row unchanged. The per-page "hide the link for the route you're on" filter is applied **per column**, and a column with zero remaining links hides its heading. No new tokens, no literal hex.
**Rationale:** The prior 8/12 brand + 4/12 single "Platform" column left a large empty middle and read as one tall narrow ribbon, worsening as links were added (it hit 6 with the new What’s New link). Two balanced columns fill the width, group links by intent (browse vs. act), and scale to a future third "Company/Legal" column without another reflow.
**Applies to:** `components/Footer.tsx` (global — every marketing/static-root page: `/`, `/discover`, `/pricing`, `/for-*`, `/coaches*`, `/changelog`, `/auth*`).

### 2026-06-27 — Coaches Portal setup panel, refinement: status bar tracks ALL steps with skip-as-checkoff, and the setup-guide link opens the in-context help DRAWER (not a page nav) — SUPERSEDES parts of the 2026-06-26 entry

**Decision (owner follow-up on the post-upgrade Premium Coaches Portal team Overview):** two refinements to the same-day required/optional setup model.

1. **The progress bar/% now tracks EVERY step (required + optional); a step is "checked off" when it's done OR skipped.** Owner: "the status bar [should] show all items (including optional) and they need to mark 'skip' to check it off — clearer for their setup status." So the segmented bar renders all 6 steps (not just the 2 required), `%` = (done or skipped) / total, and the panel **retires only at 100%** — i.e. once the coach has decided (done or skipped) on every step. Required (roster) still can't be skipped. **Segment legend:** lime `--logic-lime` = actually done; muted `--white-45` (`.setupSegmentSkipped`) = skipped/acknowledged; empty `--border-2` = still to decide — so the bar honestly distinguishes done vs skipped vs undecided rather than treating skip as a fake completion. Header: while roster missing → roster guidance; once roster done → kicker stays "Get set up · X of Y", title "Finish your setup", context reassures "your team is ready to run — tick off or skip each optional step (skipping counts)". The optional group label is now "Optional — set up or skip". This **supersedes** the prior entry's "% = required-only / 100% at roster-done / persistent 'You're all set' header / panel persists until optional done-or-skipped" — the bar is now all-steps and the retire gate is all-satisfied. Skip persistence (per-team `localStorage`) is unchanged.
2. **"Open the setup guide →" opens the in-context HelpDrawer, not a page navigation.** Owner: "can we have a help drawer open from the side rather than navigating to the whole help pages and auto-scrolling?" The footer is now a `<button>` (`.setupGuideLink`, styled as the link it replaced) calling `useHelpDrawer().openHelp({ module:'coaches', sectionIds:['premium-portal-tour','premium'], label:'Setup guide', fullGuideHref })` — the same drawer the header "?" already uses (the org-scoped coach layout mounts `HelpDrawerProvider`). So the guide opens as a side panel over the coach's current context; the full-guide page link survives as the drawer's footer "Open full guide". No new route, no auto-scroll.

**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (`isSkipped`/`isSatisfied`/`satisfiedCount`/`requiredDone`/`allSatisfied`, bar over all `setupItems`, header copy, `useHelpDrawer` footer button), `app/[orgSlug]/coaches/coaches.module.css` (`.setupSegmentSkipped`, `.setupGuideLink`). No new tokens, no literal hex. **Generalizes:** when a checklist mixes required + optional, let the status bar count **every** step with **skip-as-checkoff** (done vs skipped shown in distinct fills, undecided empty) so "setup complete" means "every decision made", and gate panel-retire on all-decided; and an in-app "guide" link inside a shell that mounts the help drawer should **open the drawer** (pull help, keep context) rather than navigate to the standalone guide page and auto-scroll.

---

### 2026-06-26 — Premium Coaches Portal team Overview: setup checklist is a single-column LIST (not a card grid) + a segmented per-step progress bar + snapshot mini-gauges

**Decision (owner-flagged /design review of the post-upgrade Premium Coaches Portal team Overview — "lots of empty space, chunky tiles, squeezed-in text; any graphs/visuals for these statuses? the tournament admin dashboard looks great"):** three fixes, all reusing the tournament-admin visual vocabulary, no new tokens.

1. **Checklist grid → single-column list (root-cause fix).** The "Get set up" `.setupList` had drifted to a multi-column card grid (`grid-template-columns: repeat(auto-fit, minmax(220px,1fr))`), which caused ALL three complaints at once: short DONE rows stretched to the tallest card in their row (empty bands, amplified by `align-items:center`), and the `1fr` text column was crushed inside a ~220px card so bold labels wrapped 2–3 lines ("Add jerseys & / positions", "Set a / budget"). Reverted to `display:flex; flex-direction:column` — full-width rows that **mirror the admin `.checklistList`/`.checklistRow`** the same-day v2 decision said it was already mirroring. Titles stop wrapping, descriptions sit on one line, DONE rows collapse compact, dead space gone. `.setupItem` (`grid auto 1fr auto`) unchanged — it just gets full width now.
2. **Segmented per-step progress bar in the panel header.** Added `.setupSegments` — one `.setupSegment` block per CORE step (6 here), `--logic-lime` when complete / `--border-2` when not, rounded `999px` to match coach warmth. Placed below the header (kicker "N of M done" + the `67%` pill kept), it maps 1:1 to the checklist so it reads as a **status graph, not a duplicate %** — the "visual for these statuses" the owner asked for, echoing the admin `.progressTrack`/`.gaugeFill` lime-fill idiom.
3. **Snapshot mini-gauges ("Your team at a glance").** The flat number cards gain an optional `.snapshotBar` (track + fill + ratio caption — the admin `.gaugeWrap` idiom in the coach rounded style): **Roster** shows jersey+position readiness (positioned/active), **Dues** shows paid/total installments and turns `--danger` when any are overdue (reuses the card's existing `data-tone="danger"`). "Next up" (a date) gets no bar. Bars only render once data has loaded and the denominator > 0; each carries a `title` for the exact ratio.

4. **Required vs OPTIONAL setup steps + skippable rows (owner decision: "Roster only" required).** The 6-step checklist no longer treats every step as gating. **Required (drives the % / segments): Confirm season (auto) + Add your roster** — `group:'core'`. **Optional (own "Optional — set up anytime" group, never counts, skippable): Build schedule, Add jerseys & positions, Prepare game lineups, Set a budget** — `group:'optional'`. So 100% is reached once the roster exists; a coach is never stuck at "67%" for declining to use budgeting/positions. Optional rows: still point to their destination, still auto-check when actually done, and carry a quiet **"Skip · Undo"** (button, `.setupItemSkip`/`.setupItemSkipUndo`; skipped row dims via `data-skipped`). **Panel-retire rule changed:** the panel persists *after* required is complete (header flips to a no-nag "You're all set · Optional next steps", required list hidden) so the optional pointers stay visible, and only fully retires once every optional step is done-or-skipped — the coach controls when it goes away, not an auto-hide on roster-add (which would strand the optional pointers). Skips are remembered **per team in `localStorage`** (`coach-setup-skipped:{teamId}`) — a deliberate lean V1 (per-device; cross-device server persistence is a noted follow-up). Control labelled **"Skip"** not "Mark complete" on purpose — faking "complete" on an unused budget would let downstream surfaces read a false state.

**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (segmented bar render, dues paid/total install count → `duesProgress`, snapshot `progress` field + mini-gauge render, `SetupItem.key`, required/optional split, `skippedSteps` + `toggleSkip` localStorage, two-mode setup header + `showSetupPanel`), `app/[orgSlug]/coaches/coaches.module.css` (`.setupList` flex, `.setupSegments/.setupSegment/.setupSegmentDone`, `.snapshotBar*`, `.setupItemOptActions/.setupItemSkip/.setupItemSkipUndo`, `.setupItem[data-skipped]`). `lib/coach-guidance.ts` `getCoachGuidanceStage` no longer called from the page (roster is the sole gate). No new tokens, no literal hex. **Generalizes:** a short setup checklist is a single-column LIST, never a multi-column card grid (card grids strand whitespace on short rows and crush text on the rest); represent multi-step progress with a per-step **segmented** bar (1 block = 1 step) so the bar is informative, not a second copy of the %; give status/snapshot tiles a small track+fill gauge (admin `.gaugeWrap` idiom) rather than bare numbers; and split onboarding into **required (gates completion)** vs **optional (pointed-to, auto-checked, skippable, never blocking)** — keep the panel alive to host the optional pointers until each is done-or-skipped, and label the dismiss "Skip", never "Mark complete", so no surface reads a faked-complete state. **Builds on / refines** the same-day "Premium Coaches Portal landing v2" entry (which introduced the snapshot + merged setup panel).

---

### 2026-06-26 — Platform-admin confirm-modal button colour = the action's PERMANENT nature, not the org's state (red is reserved for destructive/irreversible; routine/reversible confirms are lime; cancel is always neutral ghost)

**Decision (owner-flagged platform-admin QA walkthrough, finding B.1 — the org-detail → Billing & Access plan-change "Apply Change" button was danger-red, identical to Cancel Subscription / Delete Org / Ban User):** a console-wide rule for confirm-modal primary buttons.

1. **🟢 Lime (affirmative confirm)** — routine, additive, or self-reversible operational changes: plan change (BOTH upgrade and downgrade), grant override, unban, revoke sessions, edit user info, submit-for-review, publish matrix, bulk operation, any save. Uses the lime fill/tint idiom (`btn-lime` family; module analogues e.g. `.applyBtn`, `.saveBtn`, `.modalConfirm`, `.activateBtn`, `.primaryBtn`).
2. **🔴 Red (destructive confirm)** — and ONLY these: actions that destroy data, revoke access, or can't be undone from the UI: cancel subscription, delete org, delete user, ban user, remove platform user, revoke override, delete note, reject change request, transfer ownership (demotes existing owners). The truly irreversible subset (delete org/user) additionally arms via a typed slug/email match. (`btn-danger` family; module analogues `.confirmBtn`, `.modalConfirmDanger`, `.removeBtn`, `.dangerBtn`.)
3. **⚪ Ghost (neutral)** — Cancel / Dismiss / back-out. ALWAYS. Never lime, never red.

**Governing principle:** colour encodes **what the action does to the world — a fixed property of the action TYPE — not the org's current state.** So NO context-aware red (rejected the "red for downgrades / red for active-Stripe orgs" idea): dynamic red appears unpredictably and trains operators to ignore it just like overuse does. **The safeguard for a "scary but reversible" action is FRICTION, not colour** — surface the consequence in the modal body (e.g. a downgrade archives tournaments over the new cap; a bulk op hits N orgs; a manual plan change on a Stripe-billed org won't change what Stripe bills) and/or require a two-click/typed confirm, while the button stays lime. Precedent the rule generalises: the customer-users Ban/Unban/Revoke modal already picks red for *ban* vs lime for *unban/revoke* off one modal — correct; we extended that discipline to org-detail, whose five confirm modals had been sharing ONE red class.

**Audit outcome (15 platform-admin confirm flows):** most already conformed. Two fixes shipped: (a) **Plan Change "Apply Change"** red→lime (new size-matched `.applyBtn` in org-detail, paired cleanly with the neutral `.cancelBtn`); (b) **Remove Platform User** modal's Cancel button lime→neutral (was inverted; its red "Remove User" confirm was already correct — added a neutral `.cancelBtn` to the users module). Left correct as-is: Cancel Subscription, Revoke Override, Delete Note, Transfer Ownership (red); Ban (red)/Unban/Revoke Sessions/Edit User (lime); Delete User & Delete Org (red + typed confirm); Submit-for-Review, Publish Matrix, Bulk Operation (lime, keep their two-click/consequence friction). **Optional follow-up (not done):** add a consequence-summary line to the Publish-Matrix / Bulk-Op confirm states so the live second click reads as higher-impact — friction, not red.

**Applies to:** `app/platform-admin/orgs/[id]/OrgDetailClient.tsx` + `orgDetail.module.css` (new `.applyBtn`), `app/platform-admin/users/CompanyUsersClient.tsx` + `users.module.css` (new neutral `.cancelBtn`). No new tokens, no new primitives — reuses the existing lime/danger/ghost vocabulary. **Generalises:** in any admin confirm modal, choose the primary-button colour from the action's destructiveness (red = data-loss/access-revoke/irreversible; lime = routine/additive/reversible), keep Cancel a neutral ghost, and never re-colour by transient state — push risk into copy + confirm friction instead.

---

### 2026-06-26 — Platform-admin wide data tables: fill the content area (not the 900px form column), auto-layout with no-wrap cells, address fields in monospace, low-priority long values truncate with tooltip

**Decision (owner-flagged /design review of the Platform Users table — "not a lot of info, why can't we fit it on screen?" then "Invited By text too big — should match the email column"):** the platform-admin **Platform Users** table is corrected and the pattern generalized to all wide platform-admin data grids.

1. **Don't cap a data grid at the form-width column.** The page was boxed at `max-width: 900px` (a form-page holdover), so on a wide window the table was squeezed into a narrow strip and the right-most **Deactivate/Remove** action buttons overflowed into hidden scroll — reading as "empty space on the right + missing buttons." Raised to `max-width: 1200px` so the table uses the room that's already there. Wide record tables fill the available `.main` width; the 900px cap is for forms/reading columns, not grids.
2. **Auto layout + no-wrap cells, not hand-tuned `table-layout: fixed` percentages.** A prior attempt pinned 7 columns to fixed `%` widths (Name 12%, Email 17%, Actions 22%) tuned for the wrong container width — starving Name (3-line wrap) and Email (mid-word shatter via `overflow-wrap: anywhere`) while Actions had dead space. Removed the `<colgroup>` + `table-layout: fixed`; cells are `white-space: nowrap` so each row is one clean line and the column sizes to content. Action buttons need a fixed px footprint, which `%` columns fight — auto layout lets them take natural width and right-align (`justify-content: flex-end`).
3. **Address/identifier fields use the monospace email treatment.** "Invited By" holds an email/system string (`env:PLATFORM_ADMIN_EMAILS`) but rendered in the chunkier `--font-data` display face, reading oversized next to the Email column. Match it to the email column: `monospace`, `0.72rem`, kept `--data-gray` (dimmer than email's `--fl-text`) since it's secondary.
4. **Low-priority long values truncate, never stretch the table.** The one long "Invited By" value was forcing the whole column wide. Wrap it in an inner span with `max-width` + `overflow:hidden` + `text-overflow:ellipsis` + a `title` tooltip for the full text — so a single outlier value can't blow out the grid (a `max-width` on a `<td>` itself is ignored in auto layout; constrain an inner block element instead).

**Applies to:** `app/platform-admin/users/users.module.css` + `CompanyUsersClient.tsx`. No new tokens, no literal hex. **Generalizes:** a wide platform-admin record table fills the content area (reserve the ~900px cap for forms/reading); use content-driven auto layout with no-wrap cells and a horizontal-scroll fallback (not fixed `%` columns, which clash with fixed-width action buttons); render email/address/identifier columns in the monospace treatment; and truncate-with-tooltip any low-priority long value via a constrained inner element so one outlier can't widen the grid.

### 2026-06-26 — Premium Coaches Portal landing v2: merge guidance into the setup panel, replace quick-links with a real snapshot, converge to shared tokens (keep coach warmth), relocate Link-Org (REFINES the v1 entry below)

**Decision (owner-approved /design + /ux follow-up — "still cluttered; fonts/colours half-coach half-admin; premium label still off; do we even need Link-org here?"):** four changes layered on the same-day v1 landing.

1. **Kill the duplication / clutter.** The **quick-links grid is removed** — it just re-listed the left sidebar's destinations. The standalone admin **GuidanceRail is removed** from the coach page and its "what's next" content is **merged into the Season-setup panel header** (kicker `Get set up · N of M done`, the stage headline as the panel `<h2>`, the context line, one lime CTA, then the checklist, then an "Open the setup guide →" footer). Setup is now ONE block, not rail-over-checklist.
2. **Real run-mode snapshot.** A new **"Your team at a glance"** section replaces the grid with three data cards — **Roster** (active count), **Next up** (next scheduled event date + opponent/name), **Dues** (outstanding $, "All paid", danger-toned when overdue) — each linking into its section. The **setup panel retires at 100% core complete**, flipping the page from setup-mode to run-mode.
3. **Converge to the shared design system, keep coach warmth (owner's pick).** Dropping the admin rail removes the monospace `--font-data` headline that made the page read half-admin. New surfaces use shared tokens (`--white-5/8`, `--border-2`, `--blueprint-blue`, `--danger`) + the coach **display/sans** headings (`--font-display`) — no monospace. Full portal-wide literal→token convergence is a tracked follow-up, not done here.
4. **Premium label + Link-Org placement.** The **awkward sidebar Premium pill is removed**; the lime title-row pill is the single Premium signal. **"Link a parent organization" is de-surfaced** (was shown 3×: sidebar + mobile More + setup checklist): removed from the checklist and primary nav; it now lives in **team Settings → Organization**, and the Overview shows a **contextual invite banner only when an org has actually invited the team** (`team-links` row with `status:'invited'`). Rationale: a self-serve Premium coach either arrived through their org or has none to link; adoption is org-initiated, so coach-side linking is on-demand, not a default.

**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx` (snapshot + merged setup + invite banner; dues/next-event fetch; dropped GuidanceRail + quick-links), `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` (Organization panel), `components/coaches/CoachesSidebar.tsx` + `CoachesBottomNav.tsx` (removed Link-Org nav + sidebar Premium pill), `app/[orgSlug]/coaches/coaches.module.css` (`.snapshot*`, `.orgInvite*`, `.setupNext*`, `.sectionKicker`). `lib/coach-guidance.ts` content reused for the merged header. No new tokens, no literal hex in new CSS. **Generalizes:** don't duplicate the sidebar as on-page link cards — give the dashboard *data* (a snapshot), not a second menu; a "what's next" cue belongs merged into the panel it describes; a component reused from another shell must not drag its host's font system across (drop it or restyle); surface an org-initiated action on-demand (Settings + a real-event banner), not as a permanent nav/checklist item. **Supersedes** the v1 entry's standalone-rail-on-coach-page + the setup-checklist "Link parent org" item.

### 2026-06-26 — Premium Coaches Portal landing adopts the admin help system (GuidanceRail + HelpTooltip + HelpButton) and a title-row lime Premium pill

**Decision (owner-approved /design + /ux review of the post-upgrade Premium Coaches Portal team Overview — the first screen a paying coach lands on):** the coach portal now shares the admin shell's three-layer help system instead of having none, and the "Premium" signal moves onto the page title.

1. **"What's next" orientation rail.** The admin `GuidanceRail` (help Layer 3) is reused verbatim on the coach Overview, fed by a new coach analogue of `tournament-guidance` (`lib/coach-guidance.ts`). Stage-aware off setup progress (roster → schedule → budget → ready): one `--font-data` headline, one context line, one **in-app** primary CTA (same tab), a dismissible "Did you know?" nudge, and collapsible "how do I…" shortcuts that deep-link to the coach **help guide** (open in a new tab — correct for a guide link, and it surfaces the otherwise-buried guide). Uses the rail's default (non-live) tone: `--border-2` / `--white-03` / lime icon — no amber.
2. **Richer checklist rows (mirror admin `.checklistRow`).** Each season-setup row gains a one-line description (`--white-50`, not structural-faint `--white-35`), a concept `HelpTooltip` "?", and a right-aligned verb action link (`--blueprint-blue`) while open / a quiet `--success` "Done" once complete. Row is a `<div>` with the **label as the link** so the tooltip `<button>` and action link aren't nested in an anchor (same rule as the admin dashboard). The optional "Link a parent organization" item is split into its own **"Optional"** group and excluded from the setup %.
3. **`HelpButton iconOnly` anchored top-right of the team header band** (`margin-left:auto`), matching the 2026-06-25 free-portal decision — one stable help spot per team page; the org-scoped coach layout now mounts `HelpDrawerProvider` (lazy drawer, as admin does).
4. **"Premium" pill moves to the team-name `<h1>` row** as a **lime FILL / `--pitch-black` text** pill (extends the lime-is-a-fill rule), so the paid signal sits on the element the coach actually reads — not only in the faint sidebar eyebrow (the sidebar keeps its own small lime pill).
5. **Tournament-history panel demoted** below the quick-links and hidden until there's history (no empty "none yet" panel greeting a fresh team). Quick-link icon token cleaned to `var(--blueprint-blue)` (dropped the `#4fa3e0` literal fallback).

**Rationale:** Owner: the landing "can be more step-by-step and informational like the tournament setup dashboard," and "we don't seem to have any help pages or tool tips anywhere." Root cause: the coach portal never adopted the admin help layers and buried its (good) guide behind one sidebar link. Reusing the proven admin components keeps the two shells one system; the CTA-in-app / shortcuts-to-guide split fixes the rail's new-tab behavior for coach nav while doubling as guide discovery.

**Applies to:** `app/[orgSlug]/coaches/teams/[teamId]/page.tsx`, `app/[orgSlug]/coaches/layout.tsx` (HelpDrawerProvider), `app/[orgSlug]/coaches/coaches.module.css` (`.titlePremiumBadge`, `.identityHelp`, `.setupItemHead/.setupItemDesc/.setupItemAction/.setupItemDone/.setupGroupLabel`, `.setupItemLabel` link), new `lib/coach-guidance.ts`, reused `components/admin/tournament/GuidanceRail.tsx` + `components/help/{HelpButton,HelpTooltip,HelpDrawerProvider}`. No new tokens, no literal hex. **Generalizes:** the coach portal is a first-class help surface — use the same GuidanceRail (Layer 3) + HelpTooltip (concept) + HelpButton/drawer (guide) layers as admin, never a bare checklist; a premium/plan signal belongs on the title the user reads (lime fill), not only in chrome; an orientation rail's primary CTA is the in-app action (same tab) while its "common tasks" are guide deep-links (new tab). **Follow-up for /docs:** the coach help guide's getting-started sections describe the FREE "turn tools on from Explore" model — author a Premium-specific path (tools already on) so a Premium coach following the guide isn't sent to an Explore that isn't there.

---

### 2026-06-26 — Public playoff bracket: fix dark-on-dark elevation collapse (recess the canvas, lift the cards, graduate the labels)

**Decision (owner-flagged /design review of the public Standings playoff bracket on a dark org theme — "how dark the playoff brackets are"):** the bracket read as a flat charcoal void because of a token collapse, not just theme darkness. **Root cause:** the matchup cards (`.bracketMatchup` = `--bg-card`) resolve to the SAME value as the panel they sit in (`.bracketSection` = `--surface`) — `#111827` in the dark theme, `#FFFFFF` in the public light theme — so the cards had zero elevation and were held together only by a 25%-opacity brand border; layered with `--white-35` round labels (~2.3:1) and a `--white-03` status strip, the whole tree disappeared. Four fixes, all bracket-scoped and correct in BOTH the dark org theme and the white public light theme:

1. **Recess the canvas** — `.bracketTreeOuter` (desktop) + `.bracketList` (mobile) get `background: var(--surface-2)`, giving the cards a darker/greyer bed to float on in both modes.
2. **Lift the cards** — `.bracketMatchup` background becomes `linear-gradient(0deg, var(--white-5), var(--white-5)), var(--bg-card)` + `box-shadow: var(--highlight-top)` (the same top-inner-highlight the Champion card uses), so a card whose base colour equals the panel still reads as a raised tile.
3. **Graduate the section labels** — `.bracketRoundLabel`, `.bracketThirdLabel`, `.bracketListRoundLabel` go `--white-35 → --white-50`. They're real `--font-data` headings (QUARTERFINALS/SEMIFINALS/FINALS), so this is the same rule as the 2026-06-25 light-mode decision ("real labels use `--white-50`/`--data-gray`, never the structural-faint `--white-35`"), applied to dark.
4. **Surface the status eyebrow** — `.bracketMatchupStatus` background `--white-03 → --white-5` so the date/Final-pill band is visible.

**Rationale:** The fix targets the elevation collapse at its root (card vs panel sharing a colour) rather than recolouring one element, and because it leans on `--surface-2` / `--white-5` / `--highlight-top` it improves both themes at once. No per-theme overrides, no new tokens, no literal hex.

**Applies to:** `app/[orgSlug]/standings/standings.module.css` (`.bracketTreeOuter`, `.bracketList`, `.bracketMatchup`, `.bracketMatchupStatus`, `.bracketRoundLabel`, `.bracketThirdLabel`, `.bracketListRoundLabel`). **Generalizes:** a "card on a panel" pattern breaks wherever `--bg-card` and `--surface` resolve to the same value (true in both dark and light here) — such cards need an explicit lift (`--white-5` overlay + `--highlight-top`) AND/OR a recessed parent canvas (`--surface-2`) to register as elevated; never rely on a faint brand border alone, and keep real `--font-data` section headings on `--white-50`/`--data-gray`, not `--white-35/-30`.

---

### 2026-06-25 — Followed-team scorebug strip (public Schedule): unfollow = filled star (never a bare ✕), identity links to team page, venue dropped from the compact strip

**Decision (owner-flagged /design + /ux review of the public Schedule followed-team banner, mobile + desktop rail):** three fixes to the `.scorebugBar` strip and its desktop `.railCard` twin.

1. **The unfollow control is a FILLED STAR, never a bare ✕.** The strip's trailing control called `stopFollowing()` (unfollow + lose score alerts) but rendered a bare `X` — which universally reads "dismiss this banner," so a fan tidying their screen would silently unfollow. Replaced with a filled `Star` (`fill="currentColor"`, `--primary-light`) matching the canonical `TeamFollowStar` metaphor used elsewhere; hover/`focus-visible` flips to `--danger` to signal removal. Touch target bumped 26→34px, box border dropped (`1px solid transparent` at rest, danger-tinted on hover). A star never reads as "close," so the dismiss/unfollow confusion is gone. (The desktop rail's unfollow was already a worded `✕ Unfollow {team}` button — unambiguous — so it was left as-is.)
2. **The identity area links to the public team page.** Avatar + name/record/opponent + the next-up block are wrapped in a `next/link` → `/{orgSlug}/{tournamentSlug}/teams/{id}`, with a small trailing `ChevronRight` (`--white-35`) after the team name as the tap affordance + name-underline on hover. The unfollow star stays a **sibling** button (can't nest interactive-in-anchor) with a touch of left margin so it isn't mis-tapped. Applied to both the mobile strip and the desktop rail identity for parity.
3. **Venue removed from the compact strip.** The next-up column's venue line was hard-capped (`max-width: 7rem` / `8rem`) and chronically truncated ("Lions Sports Field — …"), starving the opponent line — two columns truncating at once. The strip is an at-a-glance **who + when**; **where** is a heading-there detail that still lives in the game-detail page, team page, and the expanded mobile dock. Dropping it collapses the right column to 3 clean lines and frees width for the opponent. The now-dead `getVenueLabel` helper + `venues` state were removed from this component.

**Rationale:** Owner: the banner cut off text, the ✕ "implies I am removing just this banner but it makes me not follow the team," and asked whether the field was needed + whether the banner could open the team page. Root cause of the truncation was two truncating columns fighting for width with the lowest-value one (venue) capped narrow; the ✕ was a destructive action wearing a dismiss icon. Reserve the at-a-glance strip for who/when, make the one control honestly say "unfollow" via the platform's star language, and make the informational area navigable.

**Applies to:** `components/public/ScheduleContent.tsx` (mobile `.scorebugBar` + desktop `.railCard`; new `.scorebugLink`/`.scorebugNameText`/`.scorebugGo`, `.railIdentityLink`/`.railTeamNameText`; star-for-X; removed venue render + `getVenueLabel` + `venues` state/`Venue` import) and `app/[orgSlug]/schedule/schedule.module.css` (new link/name/chevron classes, restyled `.scorebugStop` as a star toggle, removed `.scorebugNextVenue`/`.railNextVenue`). No new tokens, no literal hex. **Generalizes:** a follow/unfollow control is the platform's filled-star toggle (filled = following, tap = unfollow, danger on hover) — **never a bare ✕**, which reads as "dismiss this surface" and turns an unfollow into an accidental tap; an at-a-glance status strip carries who/when, not where (venue belongs in detail surfaces); and the informational area of such a strip should link to the entity's own page (chevron affordance, name-underline on hover), with any destructive control kept as a separated sibling target.

### 2026-06-25 — Retire the gradient button: `.btn-primary` / `.tab-btn.active` / `.segment.active` flatten to solid `--primary`

**Decision (owner: "retire the gradient button"):** the three functional controls that shipped a `linear-gradient(135deg, var(--primary), var(--primary-light))` fill are flattened to a **solid `var(--primary)`** background. This enforces the long-standing principle (design_principles.md → "What We Deliberately Avoid": *gradients on functional UI elements — decorative use only; never on buttons or form inputs*), which `.btn-primary` had been violating.

- **`.btn-primary`** — rest = flat `var(--primary)` + `--glow-sm`; the old gradient-swap hover is replaced by a token-clean lift: keep `var(--primary)`, raise to `--glow`, `translateY(-1px)`, `filter: brightness(1.08)`. (The previous hover swapped to `--primary-light` first — logic-lime by default, on which `--white` text fails contrast — so flat `--primary` is also the more legible state.)
- **`.tab-btn.active`** and **`.segment.active`** — same gradient → flat `var(--primary)` (kept `--white` text + `--glow-sm`).
- **Left alone (decorative, allowed):** `.public-page-header` (180° bg wash) and `.divider` (90° hairline fade).

**Rationale:** A gradient on the primary action competed with the established brand CTA (`btn-lime`, flat lime fill + dark text), and broke the no-gradient-on-functional-UI rule. A flat per-org `--primary` fill reads cleaner, keeps multi-tenant theming intact, and recreates the hover "press" with shadow + translate + brightness rather than a colour-stop swap.

**Applies to:** `app/globals.css` (`.btn-primary` + `:hover`, `.tab-btn.active`, `.segment.active`). Token-only, no new tokens, no literal hex. Affects every primary button, active tab, and active segment platform-wide. **Generalizes:** primary/active controls use a flat `var(--primary)` fill — never a `--primary → --primary-light` gradient; hover lift comes from shadow/translate/brightness, not a gradient swap. Reserve gradients for decorative surfaces (headers, dividers) only.

---

### 2026-06-25 — Public Schedule mobile controls: search is a plain search (no native datalist), playoff display toggle off the search row

**Decision (owner-flagged /design+/ux review of the public tournament Schedule, mobile — "is it a search or a dropdown?" + "Playoffs shrinks it too small; move the bracket/list toggle"):** two fixes to `ScheduleContent` mobile controls.

1. **The team filter is now a plain free-text search — the native `<datalist>` is removed.** The mobile search input carried `list="schedule-mobile-team-options"` + a `<datalist>` of team names; browsers decorate that with their own ▼ caret + OS option popup, which collided with our `Search` icon and read as a *dropdown*. Removing the datalist (the desktop input never had one) makes it unambiguous: 🔍 + "Search team or coach…" = type-to-filter. Live filtering already worked off `teamSearch`; only the autocomplete decoration is gone.

2. **Mobile controls re-stacked into three rows so nothing squeezes** (mirrors the desktop logic where stage + display toggle live together and search is on its own line). Previously: row 1 `[Division] [Pool|Playoffs]`, row 2 `[search][List|Bracket]` — so in Playoffs the display toggle crushed the search to "Search te…". Now: **row 1 = Division alone**; **row 2 = `[Pool|Playoffs]` (grows, `flex:1 1 auto`) + `[List|Bracket]` icons (fixed, `flex:0 0 auto`, right)** — stage toggle anchored left so the display toggle *grows in* to its right when Playoffs is chosen, nothing jumps; **row 3 = full-width search** (still hidden in the bracket-diagram view). List/Bracket stays **icon-only on mobile** (owner picked the compact side-by-side over a dedicated labeled row) with `aria-label`/`title` so it remains labelled. New `.mobileStageRow`/`.mobileSearchRow`; retired `.mobileSearchBracketRow`.

**Rationale:** A search box with a native datalist presents two competing affordances (search vs menu) — drop the menu when it's genuinely a filter. A dependent/secondary control (display mode) must not share a row with, or shove, the primary control (stage) or a flexible field (search); anchor the primary left and let the dependent grow in to the right, on a row that isn't the search's.

**Applies to:** `components/public/ScheduleContent.tsx` (mobile control block), `app/[orgSlug]/schedule/schedule.module.css` (`.mobileStageRow`, `.mobileSearchRow`; removed `.mobileSearchBracketRow`). Desktop unchanged (already separates these). No new tokens, no literal hex. **Generalizes:** a free-text filter is a search box, not a `<datalist>` combobox — don't bolt a native menu onto a search-icon input; and a secondary toggle that depends on a primary choice grows in beside the primary (primary left/anchored, secondary right/fixed), never on the row of a field that needs to breathe.

---

### 2026-06-25 — Public light-mode legibility: lime is a FILL not text, real labels use `--data-gray`/`--white-50` not `--white-35`

**Decision (owner-flagged /design review of the public tournament Schedule in light mode — "much of the text is very hard to read"):** three token fixes, all rooted in the same gap. The public light theme (`lib/public-tournament-theme.ts`) remaps `--primary-light → --primary` (org accent reads on white) and lifts `--white-40/45/50` darker, but it **does NOT remap `--logic-lime`** and **deliberately keeps `--white-35/-30` faint** ("structural faints unchanged"). So any component using lime as *text* or `--white-35` for *real content* is unreadable on the white public surface.

1. **The "Alerts on" pill now FILLS lime instead of tinting lime text.** `FollowAlertsToggle.module.css` `.pillOn` was `color: var(--logic-lime)` on `rgba(--logic-lime-rgb,0.14)` — pale-lime text on near-white = invisible (read fine on the dark app shell, which is why it shipped). Now solid lime fill + `var(--pitch-black)` text, lime border (mirrors the global `btn-lime` brand-on treatment). Readable in BOTH modes and a stronger switched-on signal; hover deepens the lime to `0.85`.
2. **Date-rail eyebrow ("JUN 8") → `--data-gray`** (was `--white-35` ≈2.3:1). It's a real `--font-data` uppercase section heading, so the data-label token is on-brand and clears the floor.
3. **Game venue line → `--white-50`** (was `--white-35`); keeps the muted-metadata read while passing AA (the public theme runs `--white-50` at `0.62` black).

Scoped to those specific classes, NOT a global lift of `--white-35` (the theme intentionally keeps `-35` faint for genuinely structural/decorative use). Verified the public bottom-nav inactive labels (`--white-45` → `0.58` black ≈4:1) already pass — left unchanged.

**Rationale:** A token tuned for the dark-first shell (`--logic-lime` text, faint `--white-35`) leaks onto the white public surface unless the light theme remaps it. The fix is per-use: lime becomes a fill (dark text on it always reads), and content labels graduate off the structural-faint tokens onto `--data-gray`/`--white-50`.

**Applies to:** `components/public/FollowAlertsToggle.module.css` (`.pillOn`), `app/[orgSlug]/schedule/schedule.module.css` (`.dateLabel`, `.gameVenueLine`). Token-only, no new tokens, no literal hex. **Generalizes:** on the public (light) surface, lime is a FILL with dark text — never lime-coloured text; and any token tuned faint for the dark shell (`--white-35/-30`, raw `--logic-lime`) must be re-checked before it carries real content on white — graduate content labels to `--data-gray`/`--white-50`, reserve `-35`/`-30` for structure.

### 2026-06-25 — Coach-portal chat: standalone desktop = centered contained card; ALL chat routes = page-scroll-locked (two-marker split)

**Decision (owner-flagged review of the coach-portal chat, desktop + mobile):** two fixes to the shared `CoachChatView` chat surface, kept cleanly separated by **two independent markers** so each portal opts into only what it should.

1. **Standalone (org-less) coach portal, DESKTOP = centered contained card.** The chat no longer renders as an edge-to-edge slab with the 820px reading column (`--chat-max`) floating in dead left/right bands and the header title pinned to the far edge. At `≥1024px` the conversation `.host` becomes a centered card: `height: calc(100dvh - 3rem)`, `max-width: var(--chat-shell-max, 960px)`, `margin: 1.5rem auto`, `border-radius: var(--radius)`, `box-shadow: var(--shadow)`. The empty space becomes intentional symmetric page margin; header/messages/composer align to the same card edges. Scoped via a NEW `[data-chat-contained]` marker set **only** on the standalone route — the league/club (org-based) portal keeps its deliberate desktop full-bleed.

2. **ALL coach-portal chat routes (standalone + league/club), MOBILE = page-scroll locked.** Root cause of the "chat moves up / header slides under the top bar + dead space above the bottom nav": the chat's earlier fix only pinned its own `.content` to `100dvh`, but the actual scroll container is an **ancestor** — `body { min-height: 100vh }` (100vh > 100dvh while the mobile address bar shows) plus the root `<main>`'s mobile bottom-nav gutter (`padding-bottom`) make the *page* taller than the dynamic viewport, so it scrolls behind the fixed bars. Fix = neutralize the whole ancestor chain on the route via the existing `[data-chat-fullbleed]` marker: `html:has(...)`, `body:has(...)` → `min-height:0; height:100dvh; overflow:hidden`, and **`#main-content:has(...)`** (id-scoped to the ROOT `<main>`, NOT a bare `main:has()` — that would also match the league/club portal's nested `<main>` and override its tuned padding/negative-margin composition) → same + `padding-bottom:0`. The conversation then owns exactly the chrome-bounded dynamic viewport and only its message list scrolls. The league/club portal has no mobile top bar (so its symptom was milder — composer-lift, not header-hide) but shares the same susceptibility; it now carries `[data-chat-fullbleed]` (lock) but **not** `[data-chat-contained]` (card).

**Rationale:** Owner saw the desktop chat "cover the whole window but with padding left/right" (the slab-with-floating-column mismatch) and the mobile chat "move up" across browsers/devices AND on prod — ruling out the dev service-worker stale-cache trap and proving a real layout bug. Splitting the two behaviors onto two markers lets the standalone portal get the focused-card treatment while the league/club portal keeps its full-bleed, and both get the robust page-lock. The `:has()` ancestor approach is the same mechanism the shell already used; it degrades to today's behavior where `:has()` is unsupported.

**Applies to:** `app/globals.css` (`html/body/#main-content:has([data-chat-fullbleed])` scroll lock), `components/chat/CoachChatView.module.css` (`:global([data-chat-contained]) .host` desktop card), `app/coaches/team/[basicTeamId]/chat/page.tsx` (both markers), `app/[orgSlug]/coaches/teams/[teamId]/chat/page.tsx` (`data-chat-fullbleed` only). No new tokens, no literal hex. Admin tournament chat is a different shell that already self-locks its mobile viewport — untouched. **Generalizes:** a full-screen app route inside a shell with `min-height:100vh` ancestors must lock the **whole ancestor scroll chain** (`html`/`body`/root-`#main-content`) on that route — pinning only the inner content element leaves the page able to scroll behind fixed chrome; and when one shared component serves two shells that want different chrome treatments, drive each treatment from its own data-marker (id-scope ancestor selectors so a nested same-tag element is never collateral). Verify CSS viewport results in-browser — static review can't prove the pixel result.

### 2026-06-25 — Coaches Portal team band: help "?" anchored in the identity band (icon-only) + watermark moved left behind the identity

**Decision (owner-flagged /design review of the free standalone Coaches Portal):** the in-context help trigger now lives in **one stable spot across every team page**, and the oversized team-initials watermark no longer collides with it.

1. **Single home for help = the identity band, top-right corner.** Previously the Overview rendered `HelpButton` inside the identity band while the section sub-routes (Roster/Schedule/Fees/Announcements via `TeamSectionShell`) rendered it down in the section sub-header next to the meta count — so the pill visibly *jumped* from the hero into a lower row as the coach navigated. The band is the one element shared by every team page, so it's the correct stable anchor: `TeamSectionShell` now puts help in the band (matching Overview) and the section header keeps only its title + meta. Both surfaces use a shared `.identityHelp` class (`position:relative; margin-left:auto; align-self:flex-start; flex-shrink:0`) instead of Overview's old inline style.
2. **Hero help is icon-only (compact round "?").** New `iconOnly` prop on the shared `HelpButton` → 34px round `btn-ghost` with no "Help" word and a slightly larger 15px glyph; smaller footprint suited to a band corner. The labeled "? Help" pill is unchanged everywhere else (admin work-page headers).
3. **Watermark anchored LEFT, behind the identity.** The 7rem/0.07-opacity team-initials watermark moved from `right:-0.5rem` to `left:-0.75rem`, so it sits behind the monogram + name (echoing the team identity) instead of hanging off the right edge under the help button — which is what made the faint "TJ" letters bleed *through* the help pill.

**Rationale:** Owner spotted two things: the help pill changed location page-to-page (inconsistent), and the giant faint initials ran straight through it (messy). Anchoring help in the constant band kills the jump; pulling the watermark to the opposite corner and shrinking help to a bounded icon kills the collision. Owner picked this over (b) a solid chip floating over the texture and (c) dropping the watermark entirely.

**Applies to:** `components/help/HelpButton.tsx` (+`iconOnly`) + `help.module.css` (`.helpButtonIconOnly`), `components/coaches/TeamSectionShell.tsx` (help → band, removed from section header), `app/coaches/team/[basicTeamId]/page.tsx` (Overview → shared class + `iconOnly`), `team.module.css` (`.identityWatermark` left-anchored, new `.identityHelp`). No new tokens, no literal hex. **Generalizes:** a per-page help/affordance belongs in the one element repeated across those pages (here the identity band) so it never reflows position; a decorative oversized watermark and an interactive control must not share a corner — anchor the watermark behind the page's identity, opposite the control, and bound the control (icon-only) so faint texture can't read through it.

---

### 2026-06-24 — App Icon: custom home-screen NAME field (defaults to event name; fixes the under-icon truncation)

**Decision (owner-requested, extends the App Icon control below):** the App Icon section gains an **"App name"** text field above the Background control. Blank (the default) = derive the label from the tournament name as before; a custom value (e.g. "BoB") becomes the label under the installed icon on **both** platforms — the Android manifest `short_name` and the iOS `apple-mobile-web-app-title`. The full tournament name still drives the manifest `name`, the in-app install-prompt headline, and the browser `<title>` — only the cramped under-icon label is shortened. The live preview's name line reflects the field and **truncates exactly like a home screen** (existing `.iconAppName` ellipsis at ~96px), so the organizer can see whether their label fits; a hint reads "Shown under the icon. About 12 characters fit — try initials if your name is long. Leave blank to use the event name." Field uses the global `form-input` (light/dark aware), `maxLength 30`, trimmed server-side (≤30, blank→null), Plus-gated + `manage_branding` like its siblings.

**Rationale:** Owner noticed the preview label cut off ("Battle of the Ba…") and, as a user, would want to shorten it to initials. The under-icon label is genuinely space-constrained (~12 chars, OS-truncated), and it's a *different* string from the full event title used elsewhere — so a dedicated short-label field (defaulting to the name, so nothing changes unless they opt in) is the right fix. Surfacing it right beside the preview that already demonstrates the truncation closes the loop: they see the problem and the fix in one place.

**Applies to:** `tournaments.app_name` (text, nullable; mig 153), `lib/types.ts` + `lib/db.ts` (`appName`), `manifest.webmanifest/route.ts` (`short_name`), `[tournamentSlug]/layout.tsx` (`apple-mobile-web-app-title`), `tournament-branding` GET/PATCH (`appName`, added to `PLUS_VISUAL_FIELDS`, 30-char cap), `branding/page.tsx` + `.module.css` (`.iconNameField`, `form-input`). DATA_DICTIONARY updated. **Generalizes:** when a single displayed string is reused in a space-constrained spot (an icon label) and a roomy spot (a title), give the constrained spot its own optional short-label field that defaults to the long one — don't truncate blindly — and put it next to a preview that shows the truncation.

---

### 2026-06-24 — App Icon control on the branding page: live home-screen preview + Auto/White/Dark/Brand/Custom background (override the auto-match)

**Decision (owner-requested, builds on the same-day auto-match icon decision below):** the Public Site → Advanced Branding accordion gains a new **"App Icon"** section (between Tournament Logo and Theme), Plus-gated like its siblings (free tier sees the standard Locked card).

1. **Live home-screen preview.** A rounded-square tile (`84px`, `19px` radius ≈ iOS squircle, `--shadow-sm`, `--border-2`) shows the logo at `80%` `object-fit: contain` on the chosen background, with the event name beneath — a faithful mock of the installed icon. Updates instantly as the colour changes (pure client state; no image round-trip).
2. **Background control = Auto + 3 shortcuts + custom.** A labelled chip-button row (`.iconBgOption`, reusing the recessive-ghost → lime-active idiom): **Auto** (default; chip shows the server-sampled colour, `iconBg === null`), **White**, **Dark** (`#0a0a12`, mirrors server `ICON_DARK`), **Brand** (the resolved theme primary), plus a native `<input type=color>` "Custom colour" and a **Back to auto** ghost button shown only when an override is set. The auto-detected colour is computed server-side (same `detectBackgroundHex` the icon uses) and returned by the branding GET + freshly by the logo upload (so the suggestion refreshes the moment a new logo lands).
3. **Persistence + framing.** Stored as a per-tournament override (`tournaments.icon_bg_color`, mig 152; `'#rrggbb'` or null = auto), saved with the rest of the branding form, HEX-validated + Plus-gated server-side. Copy frames it honestly: "We match the background to your logo automatically — override below for a different colour or a border," and an inherit-note: "A colour that contrasts with your logo shows as a border. Leave on Auto to match seamlessly" — naming the owner's "border colour" mental model while keeping the accurate term (tile background).

**Rationale:** Owner wanted to *see* the icon and control its "border colour" on the branding page, with our auto-detect as the editable default. A live preview + an Auto-default-with-override is the right shape: zero-effort correct result for the 90% case, full control for the rest, and the "contrasting = border" line turns what could read as a bug (a mismatched frame) into an intentional choice. Reuses the page's existing swatch/colour-input/preview vocabulary so it feels native to the accordion.

**Applies to:** `app/[orgSlug]/admin/tournaments/branding/page.tsx` + `branding.module.css` (`.iconLayout`/`.iconPreview`/`.iconTile`/`.iconTileImg`/`.iconAppName`/`.iconControls`/`.iconBgOptions`/`.iconBgOption`/`.iconBgOptionActive`/`.iconBgChip`/`.iconCustomRow`), `app/api/admin/tournament-branding/route.ts` (GET returns `iconBgColor` + sampled `iconBgSuggested`; PATCH accepts `iconBgColor`, added to `PLUS_VISUAL_FIELDS`), `app/api/admin/tournament-logo/route.ts` (POST returns `iconBgSuggested`), `lib/pwa-icon.tsx` (`sampleBackgroundHex(Buffer)` + `ICON_HEX_RE`; override-wins in `resolveBrandedLogo`), `lib/types.ts` + `lib/db.ts` (`iconBgColor`), mig 152 + DATA_DICTIONARY. `#0a0a12` mirrored as a UI const (server module can't import into the client page). **Generalizes:** an auto-derived visual property gets a settings control shaped as **Auto (default, shows the derived value) + named shortcuts + custom**, with a live preview and a Back-to-auto escape — never force the user to either accept the magic blindly or hand-set everything.

---

### 2026-06-24 — Tournament Plus custom app icon: paint the tile the logo's OWN sampled background colour (seamless field, no postage-stamp)

**Decision (owner-chose the approach from a 4-option /design comparison):** the per-tournament PWA / home-screen icon (Tournament Plus+ advanced branding) no longer composites the org/tournament logo onto a fixed near-black square. Instead the icon tile is painted the logo's **own background colour, sampled at runtime from its edge pixels**, so the logo reads as one seamless field — the edge-to-edge "real app icon" look a competitor screenshot showed we lacked.

1. **Root cause fixed = the double background.** Grassroots sports logos are overwhelmingly opaque dark-ink-on-white (or on a brand colour). Pasting such a logo (with `objectFit: contain`) onto a dark tile produced a small white "card" floating in a dark frame — two competing backgrounds, reading as a screenshot of a logo, not an icon. Matching the tile to the logo's background collapses it to a single field: white logo → white tile, purple-bg logo → purple tile (verified: a synthesized `#ffffff`-bg logo samples `#ffffff`; a Milton-purple-bg logo samples `#8b2fc9`).
2. **Sampling** (`detectBackgroundHex` in `lib/pwa-icon.tsx`, via `sharp`): downscale to 64px, read the border ring (top/bottom rows + left/right cols) of RGBA; if >50% of the border is transparent → return null (a wordmark meant for a dark backing) → caller falls back to `ICON_DARK` (prior behaviour, so the icon **never regresses**); else average the opaque border pixels → `#rrggbb`. Wrapped in try/catch returning null, so if `sharp` is ever unavailable at runtime the icon still renders on the dark tile.
3. **iOS logo enlarged.** The Apple touch icon is NOT circular-cropped (iOS only rounds the corners), so its inset was wasted — the logo went 138→**156** of 180 (≈87%), near edge-to-edge. The Android **maskable** keeps its `LOGO_BOX` 288/512 (≈56%) safe zone (Android DOES crop to a circle — a real constraint, not a bug); matching the tile colour makes that safe-zone padding **invisible** and means the circular crop only eats matched background, never a visible frame.

**Rationale:** Owner compared our downloaded icon (Battle of the Bats — boxed white card on black) against a competitor (Whitby Eagles — clean white tile, logo edge-to-edge) and asked how to improve. Auto-matching the tile to each logo's own background is the only option that produces a seamless field for ANY logo (light, dark, or coloured) with zero customer setup, vs a fixed white tile (breaks white-on-transparent wordmarks) or a fixed brand-colour tile (an opaque logo still cards on it). This is a paid-feature value signal, so "looks unmistakably theirs" matters.

**Applies to:** `lib/pwa-icon.tsx` (new `detectBackgroundHex`; `resolveBrandedLogoDataUrl`→`resolveBrandedLogo` now returns `{ src, bg }`), `app/[orgSlug]/[tournamentSlug]/apple-icon.tsx` (tile `branded.bg ?? DARK`, logo 156), `app/[orgSlug]/[tournamentSlug]/icon-maskable/route.tsx` (tile `branded.bg ?? ICON_DARK`). No new tokens, no literal hex in component CSS (the sampled colour is a runtime value). **⚠ Deploy note:** `sharp` is currently a `devDependency` but is now imported in a runtime server route — promote it to `dependencies` (regenerate both lockfiles) before this ships, or the colour-match silently falls back to the dark tile in production (graceful, but the feature won't actually engage). **Generalizes:** an icon/avatar tile that hosts a user-uploaded logo of unknown background must become a single seamless field — either a transparent mark on a brand/dark field, or (for opaque logos) the tile painted the logo's own sampled background — never an opaque logo letterboxed on a contrasting tile.

---

### 2026-06-23 — Coach tournament hero head: status chip on the title row (pinned right) + tournament-over-org stacked identity

**Decision (owner-flagged, /design-reviewed; SUPERSEDES the same-day "status badge stays content-width on mobile" + "badge wrapper drops to its own row" entries for the head layout):** the coach tournament hero (`TeamHQ`) head is restructured.

1. **The status chip lives on the headline row, pinned right.** The headline (`You're in!` / `Registration submitted` / `Not selected for this event` / `That's a wrap!`) and the status `.badge` now share a `.heroTitleRow` flex row inside `.heroHeadText`; the chip is pushed to the right edge with `margin-left: auto` and `flex-shrink: 0` (never shrinks). This is **stable at every width** because both the headline and the status word are **fixed phrases** independent of tournament/org name length — so there is **no squeeze and no wrap-below logic** (the prior approaches all fought a narrow flex column; this sidesteps it). Verified in Playwright at 360/400/600/1100px: headline one line, chip same row + right-aligned, at all widths.
2. **Identity is stacked: tournament name over org name.** For the accepted/result phases the old joined `"{tournament} · {org}"` sub line is split into two lines — `.heroSub` (tournament, `--white-60` 0.85rem) then `.heroSubOrg` (org, **demoted** `--white-45` 0.8rem) — reading as "{event} / hosted by {org}". Splitting **guarantees each fits on one line** even on a 360px phone (the combined line was the thing most likely to wrap). Pending/rejected keep their single `statusDesc` sub line (a sentence, not splittable).
3. **Removed:** the `.badgeWrap` element + the entire `@media (max-width: 1023px)` head-wrap block (flex-wrap / basis gymnastics) — no longer needed once the chip rides the title row.

**Rationale:** Owner: "better alignment is 'You're in' and 'Accepted' on the same row with the pill right-aligned (the words are always the same, no need to adjust for org/tournament names), then tournament name below the headline and org name below that." Correct instinct — anchoring the row on the two FIXED strings removes the whole class of name-length wrapping bugs that the earlier content-width/wrap-below attempts kept hitting, and stacking the two variable-length names one-per-line makes them self-fit.

**Applies to:** `components/coaches/TeamHQ.tsx` (`.heroTitleRow` wrapping headline+badge; `splitIdentity` → stacked `tournamentName`/`orgName`; removed `.badgeWrap`) + `components/coaches/TeamHQ.module.css` (`.heroTitleRow` + `.heroTitleRow > :global(.badge)` margin-left:auto; new `.heroSubOrg`; removed `.badgeWrap` + the ≤1023 head-wrap media block). No new tokens, no literal hex. **Generalizes:** when a header row mixes FIXED labels (headline, status word) with VARIABLE-length content (names), anchor the row layout on the fixed pieces (chip pinned right via `margin-left:auto` + `flex-shrink:0`) and give each variable-length string its own line — don't try to fit a fixed chip beside variable text in one shrinking column. **Process note:** this row of fixes was finally nailed by MEASURING the real compiled component in Playwright (throwaway route + `getBoundingClientRect`) rather than eyeballing user screenshots — and the persistent "won't update" symptom was the **dev service worker serving stale cache-first `/_next/static` CSS** (clear site data / InPrivate to bust it), not the code. See [[feedback_iterate_visual_with_playwright]].

---

### 2026-06-23 — Teams page payments roll-up: adopt the Schedule Health collapsible register + meaning-line per metric

**Decision (owner-flagged review of the admin Teams/registrations payment strip):** the per-division money strip is rebuilt from a static 5-tile box-grid into the **same collapsible `<details>/<summary>` panel pattern as the Schedule Health card** (`ScheduleHealthPanel`), with three substantive changes.

1. **Collapsible + glance chip.** The strip is now a `<details>` with a **Hide/Show** toggle (chevron rotates; the "Hide/Show" word drops on mobile, chevron stays) and its open/closed state **persists per tournament** in the existing `flhq-teams-{id}` localStorage view-settings object. A right-aligned **glance chip** survives collapse and *escalates*: **`$ past due`** (the overdue dollar total, danger) → `$ outstanding · due` (warning) → `All collected` (good) — so collapsing never hides the one number that needs action (mirrors the Health panel's score chip).
2. **Progress-bar headline + meaning line under every number** (the Health-panel `label / value / detail` KPI shape: `--font-data`, value `1.05rem`, `<small>` detail `0.62rem` `--white-50`). The body leads with a **collected-progress bar** (`--success` fill on a `--white-8` track) labelled `$collected of $expected · N%` — the eye-pleasing headline that carries the two $ totals + %, so Expected/Collected don't need their own tiles. Below it a **4-up KPI grid**: **Paid in full** (`paid/scheduled` + `N% of teams`, good tone at 100%), **Deposits in** (`done/required` — rendered **only when a deposit step exists**), **Outstanding** ($ still owed), **Past due** (now a **dollar amount** + `N teams overdue`, danger). A quiet **due-dates footer** lists `Deposit due {date}` / `Balance due {date}` (`CalendarClock` icon; an overdue date flips `--danger` via `[data-overdue]`). Grid is 4-up desktop / **2-up mobile** — fixes the prior 1-wide stacked-boxes mobile blow-up. The old ambiguous **"With a fee" / "Expected"** bare-number tiles are gone (count → the progress label + Paid-in-full denominator; Expected → the progress bar's `of $X`).
3. **Tokens/register match Health exactly:** `--surface` card on `rgba(--blueprint-blue-rgb,0.22)` border, `4px` radius, `--white-5` KPI tiles, `data-tone` good/danger colouring the value. Retired the old square-cornered `--hud-surface` `min-height:64px` boxes.

**Rationale:** Owner asked twice: first the strip couldn't be dismissed like the Schedule one, was formatted heavier, looked "too big and stacked" on mobile, and "with a fee" / "expected" were unclear (total vs to-date); then for *richer* content — teams-paid vs expected with %, deposits paid vs expected, $ outstanding / $ expected / $ past due, and the deposit/final due dates. Root cause of the first pass: the strip predated and never adopted the Schedule Health collapsible-panel register. Final design reuses that register **and** turns the panel into a real payments dashboard (progress headline + team-progress counts + overdue $ + due dates), so the organizer reads collection status at a glance without bouncing to the dashboard, and the two admin summary panels feel like one system.

**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (payments block → `<details>`; `paymentsOpen` state persisted via the existing view-settings localStorage; `paymentSummary` extended with `paidInFull`/`depositRequired`/`depositComplete`/`pastDueAmount`; per-division effective fee resolved inline for due dates) + `teams-admin.module.css` (`.payPanel`/`.paySummary`/`.payHeader`/`.payGlance`/`.payToggle`/`.payBody`/`.payProgress*`/`.payGrid`/`.payKpi`/`.payDueDates`/`.payDueItem`; retired `.paymentPanel`/`.paymentMetrics`/`.paymentMetric`). No new tokens, no literal hex. **Generalizes:** an admin summary metric strip is a collapsible `<details>` panel with a persisted open-state, a glance chip that survives collapse (escalating to the most-actionable number), a progress-bar headline carrying the hero totals, and a `<small>` meaning line under every value — never a bare label+number that leaves "is this a total or to-date?" ambiguous; counts that only contextualize a money total live in the progress label / a tile's detail line, and a conditional metric (deposits) is hidden entirely when its step doesn't exist rather than shown as `0 / 0`.

---

### 2026-06-23 — Coach tournament hero: status badge stays content-width on mobile + de-duplicated past-due Fee

**Decision (owner-flagged review of the accepted-phase coach tournament hero `TeamHQ`, mobile):** three fixes.

1. **The registration status badge (e.g. `ACCEPTED`) no longer stretches full-width on mobile.** At ≤640px the badge wraps to its own row under the title (the text column already claims all of row 1); it previously did so via `flex-basis: 100%`, which — because `.badge` is `inline-flex` — stretched the pill edge-to-edge so a *status* read as a tappable CTA **button**. Now `flex: 0 0 auto` + `align-self: flex-start`: it wraps to its own line but stays **content-width**, keeping the indent that aligns it under the headline. Direct application of the binding **"status = quiet label, action = button"** rule (schedule publish-status decisions 2026-06-15, Clear-Bracket 2026-06-12).
2. **The past-due Fee is no longer stated twice.** The red fee **glance strip** (`.heroFeeStrip`, `role="alert"`) owns the alarm — amount + "Was due {date}". The **checklist** Fee row was independently rendering a filled `badge-danger` "Past due" pill **plus** a second red "Was due {date}" line — duplicating the date and spiking the one row taller/louder than its plain-text siblings. The checklist Fee row now renders a **plain right-aligned red "Past due"** state (new `.checkStateDanger` tone on `.checkState`), uniform with the other rows; the pill + micro-note are retired. The strip owns urgency; the checklist stays a calm progress tracker.
3. **Acceptance-signal redundancy resolved by #1, not by deletion.** "You're in!" + the badge + the checklist "Accepted/Confirmed" row + the green celebration wash all assert the same fact. The badge is kept as the **single cross-phase status anchor** (it's the only consistent status element across pending/waitlist/rejected/accepted, where the neutral phases need it most) and the checklist "Accepted" milestone is kept (it's part of the Registered→Accepted→Fee→Roster→Check-in narrative). Fix #1 makes the badge *quiet*, so the three signals no longer compete — no element removed.

**Rationale:** Owner asked whether the `ACCEPTED` and `PAST DUE` pills were "the proper sizes and locations." The badge size was the genuine bug (a full-width outlined pill mimics a button); the past-due pill's *location* was fine but it was a redundant, over-loud duplicate of the alert strip. Reserve the loud red treatment for the one alert strip; keep the checklist uniform and calm; keep status quiet.

**Applies to:** `components/coaches/TeamHQ.tsx` (`ChecklistItem.badge`→`stateTone`, Checklist render, Fee row) + `components/coaches/TeamHQ.module.css` (`.heroHead > :global(.badge)` flex; `.checkNote`→`.checkStateDanger`). Token-only, no new tokens, no literal hex. **Generalizes:** a status badge that wraps to its own line must use `flex: 0 0 auto` (never `flex-basis: 100%`) so it stays a content-width label, not a full-width CTA; when a glance strip already owns an alarm + its date, the parallel checklist/progress row must NOT re-render the same alarm as a pill + duplicate date — demote it to plain toned state text and let the rows stay uniform.

---

### 2026-06-23 — Admin tournament mobile bottom nav: draft phase = "getting ready" (Setup · Teams · Schedule · Site)

**Decision (owner-approved, /design-reviewed):** The lifecycle-aware admin bottom nav (`AdminBottomNav.tsx`, ≤900px) gets a **draft-phase-specific** set of 4 primary tabs. Previously draft showed **Teams · Divisions · Schedule · Chat**; it now shows **Setup · Teams · Schedule · Site**. The live/after ("results phase") bar is **unchanged** (Results · Check-in · Schedule · Chat).

- **Setup** = Event Settings (`settings/event`, `Settings2` sliders icon, bar label shortened to "Setup" via a new `withBarLabel()` helper). It's the draft home (the "Finish Tournament Setup" CTA target) and was previously the *deepest* surface to reach (More → Setup → Event Settings). **Role-gated:** Event Settings is owner/admin-only, so for roles that can't open it (staff/official/treasurer) the lead slot **falls back to Divisions** (a build step they can use) — never show a tab that points at a page the role can't edit.
- **Site** = Public Site (`branding`, label shortened to "Site", **icon swapped `Paintbrush`→`Globe`** — reads as "your public page," not "branding/customize"). Lets organizers check the customer-facing registration page pre-launch.
- **Divisions dropped from the bar** = treated as a do-once step; safe because the draft setup guidance (`lib/tournament-guidance.ts`) already makes "at least one division" a required-to-launch item with a primary "Set up divisions" CTA + progress + an "I want to…" shortcut. It stays under More → Setup.
- **Chat dropped from the bar in draft** (it was previously *always* promoted) = no audience pre-launch. **Its unread badge bubbles up to the "More" tab** (lime `.tabCount` pill + an `aria-label` on the More button) **and to the Chat row inside More** (new `.dropCount` lime pill), so a pre-launch coach message is never invisible. Chat auto-returns to the bar at go-live (already primary in the results phase).
- **Schedule holds the same (third) slot in both the draft and live bars** = the one constant anchor, so the bar doesn't feel like a different app at the go-live transition.

**Rationale:** A bottom bar should reward *revisit-often* surfaces, not one-time setup steps. In draft the organizer lives in Event Settings and wants to check the public page; both were buried. Divisions is a do-once step (backed by the checklist), and Chat has no audience until live. Mental model: **draft bar = "getting ready" (configure → fill → arrange → present); live bar = "running it."** Keeps the established **4 primary + More** pattern (2026-06-16) and its rule that nothing reachable is silently dropped — enforced here by the Chat-unread bubbling + the Divisions checklist backstop.

**Applies to:** `components/admin/AdminBottomNav.tsx` (`withBarLabel()` helper; draft `primaryDefs`; role-gated `draftLead`; `chatIsPrimary`/`moreChatUnread`; More-button + dropdown-row unread badges; `Globe` import) + `AdminBottomNav.module.css` (`.dropCount`). No new tokens; reuses `.tabCount` lime/`--pitch-black` badge style. **Generalizes:** a lifecycle-aware primary nav should weight tabs by revisit-frequency per phase (not by setup-order); when a notification-bearing tab (Chat) is demoted to overflow, its unread signal must bubble to the overflow trigger; promoting a role-gated destination to a primary tab must carry the same role check (with a usable fallback), never just inherit the icon/label.

---

### 2026-06-23 — Standalone coach portal chat: shell-tailored full-bleed + labeled multi-room list

**Decision (owner-approved, /design + /ux reviewed):** The **standalone (org-less) Coaches Portal** chat route (`app/coaches/team/[basicTeamId]/chat`) gets a full-bleed treatment **tailored to `CoachPortalShell`, NOT a copy of the org-based portal's `chatWrap`**. The org portal's wrapper cancels its shell's 2rem content inset with negative margins and zeroes `--coach-topbar-h`; **`CoachPortalShell` is different** — it already offsets the fixed chrome via `.content` padding (`--coach-topbar-h: 56px` / `--coach-bottomnav-h: 64px` mobile; `--coach-rail-w: 248px` desktop) and `CoachChatView`'s height calc reads those same vars, so there is **nothing to cancel**. The only fix: the shell's `.content { min-height: 100vh }` exceeds the **dynamic** viewport on mobile (`100vh` includes the browser bar; the chat sizes to `100dvh`), opening a phantom page-scroll / dead space ("pressed up at the top"). Solution: the chat page wraps `CoachChatView` in a `[data-chat-fullbleed]` marker; the shell drops the page-minimum for that route via **`.content:has([data-chat-fullbleed]) { min-height: 0 }`**, so the chat owns exactly the chrome-bounded dynamic viewport. Separately, the shared `CoachChatView` multi-room sidebar gains an eyebrow heading **"Your tournament chats"** (`--font-data` uppercase `--white-40`) so a list of 2+ rooms reads as navigation, not a second conversation stacked beside the open one.

**Rationale:** Owner reported the standalone-portal chat looked cramped and "there are 2." Root causes: (1) the route never got the full-bleed wrapper the org portal has, and a naive copy would have been wrong because the two shells differ; (2) an unlabeled master-detail room list reads as duplicate chats. The `:has()` opt-out is the minimal, additive way for a child route to tell the shared shell "I own the viewport" without forking the shell layout. Degrades gracefully where `:has()` is unsupported (the minor phantom scroll returns; no breakage).

**Applies to:** `app/coaches/team/[basicTeamId]/chat/page.tsx` + new `chat.module.css`, `components/coaches/CoachPortalShell.module.css` (`.content:has([data-chat-fullbleed])`), `components/chat/CoachChatView.tsx` + `.module.css` (`.sidebarHead`). Tokens only, no new tokens, no literal hex. **Generalizes:** a full-screen route inside a shared shell that imposes `min-height: 100vh` should opt out via a `data-*` marker + `.content:has(...)` rather than fighting it with child CSS; and a master-detail list always carries a heading so it can't be mistaken for a second detail pane. **Do NOT** copy the org coach portal's negative-margin `chatWrap` into `CoachPortalShell` routes — the chrome models differ.

---

### 2026-06-23 — Tournament Chat polish: icon-only Members on mobile, recessive composer icons, flush control heights, phantom-scrollbar fix

**Decision (owner-flagged mobile/desktop review of the admin Tournament Chat):** four fixes to the shared `ChatPanel` + the organizer chat page.

1. **Members button collapses to icon + count on mobile** (`@media (max-width: 900px)`, the panel's full-bleed breakpoint). The full `👥 MEMBERS (7) ›` pill (uppercase `btn-data` + word + chevron ≈ 150px) was starving the flex-1 header title, truncating "Battle of the Bats 2026 — Coaches" to "… —". Mobile now shows `👥 7` (label + `ChevronRight` hidden via `.manageBtnLabel`/`.manageBtnChevron`; a `.manageBtnCount` tabular-nums count shows only when the label is hidden); desktop keeps the full pill. Button carries an `aria-label`/`title` so the icon-only state stays labelled. This is the established admin "drop the word, keep the icon on mobile" convention.
2. **Emoji + poll composer buttons → recessive ghost icons.** They previously reused a filled `--white-5`/`--white-10` treatment identical to the input, so three equal-weight boxes competed and the text box didn't read as primary. Now `background: none` + `1px solid transparent` at rest, revealing `--white-8` fill + `rgba(--logic-lime-rgb,0.4)` border on hover/focus/expanded — same recessive-at-rest pattern as the message reaction dots and the toolbar Clear-Bracket control. 44px touch target preserved; glyphs trimmed 20→18 toward the send icon's 16.
3. **Composer control heights made flush.** The single-row textarea (~40px) was shorter than the 44px emoji/poll/send buttons, so with `align-items:flex-end` the buttons stood proud. `.input` gains `min-height: 44px` + equal `0.7rem` vertical padding (optically centers one line at 44px), matching all controls.
4. **Phantom scrollbar on the right edge of the textarea fixed** (the "strange line", desktop + mobile). Root cause: the autosize effect set `height = scrollHeight` while global `box-sizing: border-box` means that height includes the 1px borders, leaving the content ~2px short → `overflow-y: auto` painted a permanent thin scrollbar. Fix: `.input` defaults to `overflow-y: hidden`; the autosize effect captures the natural scrollHeight before clamping and flips to `auto` only when content exceeds the 140px max.

**Rationale:** Owner mobile screenshot review — header cut off, oversized Members button, emoji/poll out-weighing the text box with inconsistent heights, and a mystery vertical line in the composer. Reserve the composer's visual weight for the text box and the one lime Send action; everything else recedes until intent (CP-1 holds).

**Applies to:** `components/chat/ChatPanel.tsx` + `ChatPanel.module.css` (`.emojiBtn` ghost, `.input` height/overflow, autosize overflow toggle, icon sizes), `app/[orgSlug]/admin/tournaments/chat/page.tsx` + `chat-admin.module.css` (`.manageBtnLabel`/`.manageBtnCount`/`.manageBtnChevron` + mobile media). No new tokens, no literal hex. **Shared-engine note:** fixes 2–4 live in `ChatPanel`, so they improve every chat surface (Tournament now, Coach/Parent later); fix 1 is organizer-surface-local. **Generalizes:** a composer reserves its filled-surface weight for the input + one primary action and recedes secondary tools to ghost; any `box-sizing:border-box` autosize textarea must gate `overflow-y` on the real max or it shows a phantom scrollbar; a header action pill collapses to icon + count on mobile so the flex-1 title keeps its room.

---

### 2026-06-17 — CoachEmptyState gains a "Quiet" tier for no-action "waiting" empties

**Decision (owner-driven, on the accepted coach tournament page):** the shared `CoachEmptyState` gets a fourth tier — **Quiet** (`quiet` prop) — between Compact and a text-only `<p>`. It's for a section that needs a card body but where the coach can do **nothing but check back** (waiting on the organizer): the tournament Schedule **"not published yet"** and **"no games scheduled yet"** states. Treatment: a calm **flat panel** — drops the radial lime wash (flat `--surface`), the `--highlight-top` shadow, AND the medallion glow halo; the medallion shrinks to `36px` and its icon goes **neutral `--white-40` (never lime)** on a `--white-05`/`--border` shell; **left-aligned, full-width** (no `560px` centering), tighter padding (`1.15rem 1.25rem`) + gap (`0.55rem`), section-weight headline (`0.95rem/700`). Applied to both schedule empties on `/coaches/tournaments/{teamId}` (icon dropped to 18px to suit the smaller medallion). **Opt-in only** — the Full/Compact action empties (first-run "Add your first fee", etc.) keep the lime glow untouched.

**Rationale:** Owner: the unpublished-schedule card "could be the same size as the rest and lighter on the brightness of the icon." Root cause: a no-action waiting state was wearing the **action** treatment (glowing lime medallion + radial wash + centered hero), so it out-weighed the Payment panel right above it and pulled the eye to a place with nothing to do. The glow should signal "there's something to press" — when there isn't, the empty should read as a quiet placeholder. This is the same **flat-note register** already established for `purposeNote`/`recipientNote`/the dashboard metric strip (no box-shadow + neutral non-lime icon + left-aligned = a *note*, not a *card*), now applied as a formal empty-state tier.

**Applies to:** `components/coaches/CoachEmptyState.tsx` (+ `quiet` prop) + `CoachEmptyState.module.css` (`.quiet` + `.quiet .medallion` + `.quiet .headline`), `app/coaches/tournaments/[teamId]/page.tsx` (schedule empty `compact`→`quiet`), `docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md` §iii (4-tier rule). No new tokens, no literal hex. **Generalizes:** an empty whose only "action" is to wait gets the Quiet tier (flat, no glow, neutral `--white-40` icon, left-aligned, section-weight) — match the surrounding data panels, don't out-shout them; the lime glow is reserved for empties that carry a real CTA.

---

### 2026-06-17 — Real logo mark in both shells + coach upsell as a quiet page-footer

**Decision (owner-driven revisions to the COACH_PORTAL_GROWTH Phase-1 quick wins):**

1. **The real brand mark replaces the typed "FL" square in BOTH shells.** The coach `CoachPortalShell` `.brandMark` (solid lime "FL" text square) and the admin `AdminSidebar` `.brandSquare` are both replaced by the actual logo asset — **`/favicon.svg` (the ">" "logic mark": lime chevron on a dark blueprint square)** rendered at 30px via a decorative `<img alt="" aria-hidden>` (accessible name comes from the wrapping link/wordmark), **identical in both shells** (the logo is the cross-shell continuity anchor — exempt from the per-shell radius dialect). Owner chose the ">" logic mark over the FL lettermark (the FL lettermark assets are font-dependent / detailed and don't render crisply at 30px; the favicon is pure geometry, font-independent, the official app icon). New `.brandLogo` class (30×30 block) in both modules; the old text-square rules (incl. their `#0f1123`) removed.

2. **The per-page coach upsell (`ScopeShelf`) is a quiet page-FOOTER, not a card or a one-line footnote.** Evolution this session: dismissible card → one-line footnote → (final) a divider-separated **page-footer zone** at the bottom of each Tier-2 section page (Roster/Schedule/Fees/Announcements). Treatment: `border-top: 1px var(--border-2)` + `2rem` top margin (**not** viewport-pinned — avoids a stranded footer on short pages); three muted tiers — `--font-data` uppercase `--white-40` eyebrow **"Premium Coaches Portal"** → `--white-40` 0.8rem body (`max-width:72ch`) carrying the section value + a whole-team teaser + **"Your free tools stay free."** → a quiet `--white-40`→`--logic-lime`-hover link **"See everything it includes →"** (`/for-coaches?source=coach_footer_{section}`). **Info-first, NOT "express interest"** — the lead-capture ask lives on the `/for-coaches` marketing page; the in-product footer only routes to info. No icon, no card, no button, no dismiss; lime reserved to the link hover (CP-1). Stays per-page, content-gated; now a plain server-renderable component (no `'use client'`/localStorage).

3. **Naming canon enforced** (per the Brand Strategy Coaches Portal Unification Addendum 2026-05-25): the paid tier is **"Premium Coaches Portal"** (Premium as prefix, mirroring "Basic Coaches Portal"), the product is **"Coaches Portal"** — never "Coaches Portal Premium" / "Coach Portal" / "Team plan". Recorded in `docs/agents/brand/PRICING_PAGE_COPY.md`.

**Rationale:** Owner: the typed "FL" wasn't the real logo; "express interest" implied an ask when the goal is to lead coaches to *information*; and the upsell should be a non-intrusive page footer that "can include more information." Using the official mark gives true cross-shell brand identity; routing the in-product upsell to the `/for-coaches` explainer (info-first) with the ask deferred to that page is the correct funnel split; a divider-separated footer reads as the page's end without competing with the working content.

**Applies to:** `components/coaches/CoachPortalShell.tsx` + `.module.css` (`.brandLogo` replaces `.brandMark`), `components/admin/AdminSidebar.tsx` + `.module.css` (`.brandLogo` replaces `.brandSquare`), `components/coaches/ScopeShelf.tsx` + `.module.css` (card → `.footer`/`.footerEyebrow`/`.footerBody`/`.footerLink`), `docs/agents/brand/PRICING_PAGE_COPY.md` (naming canon). No new tokens; no literal hex in our CSS (favicon's hex lives in the asset). **Generalizes:** the logo is the one device that stays identical across shells (continuity anchor, exempt from dialect rules); an always-present informational upsell is a divider-separated footer zone (eyebrow + capped-width muted body + quiet info link → marketing explainer), distinct from a dismissible nudge card, and routes to *info* not an *ask*.

---

### 2026-06-17 — Coach Fees: two-type model (Everyone / One player) + atomic bulk-create + one add button

**Decision (model + flow redesign on `components/coaches/FeeEditor.tsx`; supersedes the same-day "whole-team fee type" framing):**

1. **Two fee types only, via a segmented "Who owes this?" control** in the add form (reuses the established `.segmented`/`.segmentBtn` lime-active pattern from `ScheduleEditor` EventForm — selection-state lime, distinct from the submit action, CP-1 holds): **Everyone** (default) bulk-creates one independent per-player fee for every roster player; **One player** reveals a player picker. The old "whole team / one shared amount" type is **dropped from the add flow**. A quiet `.assignNote` **impact-preview** states the blast radius ("Adds a $200 fee to all 15 players — $3,000 total"); the lime submit label is **dynamic** ("Add fee for N players"). Edit mode hides the segmented control (edits label/amount/notes; keeps the existing assignment). The `.form` is **de-glowed** to neutral.
2. **Bulk-create is a new atomic write path** — `createBasicCoachTeamFeesForAllPlayers` (single N-row `.insert`, owner-guarded `POST .../fees/bulk`, player_ids server-derived so no cross-team smuggling, capped at 200). Client add paths **de-optimized** to match `ScheduleEditor` (await POST → append real rows; removed the `Date.now()` that newly tripped `react-hooks/purity`).
3. **Existing player-less fees survive in a demoted, conditional "Other fees" section** (`.legacyBlock` top-divider + `.legacyTitle` `--white-60`/0.86rem + cleanup note), only when such fees exist — never hide recorded money; self-retires when cleared.
4. **One add button per page.** The top "Add fee" is the single add entry; the "Roster fees" empty/remainder prompts are **explain-only text** (no buttons) that point at "Add fee" above — fixes "two buttons doing the same thing." Copy reframed to "Charge everyone at once or one player at a time."

**Rationale:** Owner: the common case (every player owes the same season fee/installment) had no option — you'd add it N times by hand; "whole team" was confusing (sounded like an expense); and two add buttons did the same thing. Naming exactly two who-owes choices, defaulting to the common "Everyone" with a per-player bulk-create + impact preview, demoting the deprecated type to a self-retiring legacy section, and collapsing to one add button resolves it without expanding scope into debit/credit (Premium).

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (`.segmented`/`.segmentBtn`/`.fieldLabel`/`.legacyBlock`/`.legacyTitle`; de-glowed `.form`; `.remainderRow`/`.playerFeesEmpty` → text-only; removed `TEAM_WIDE`), `lib/basic-coach-fees.ts` (`createBasicCoachTeamFeesForAllPlayers` + error constants), new `app/api/coaches/teams/[basicTeamId]/fees/bulk/route.ts`. No new tokens; `#0f1123` is the established dark-on-lime literal. **Generalizes:** a small fixed choice set uses the established segmented control (not a select); a fan-out action shows a quiet impact-preview + a blast-radius-naming submit label (no modal) and bulk-creates atomically server-side; deprecating a data type keeps existing records in a demoted self-retiring legacy section; and a page has exactly one button per action (contextual empties explain + point at it, they don't duplicate it).

### 2026-06-17 — Coach Fees ledger: single-direction framing + legible paid-action + shared delete modal

**Decision (operability + clarity pass on `components/coaches/FeeEditor.tsx`, building on the same-day purpose-strip/gating decision):**

1. **Single-direction money model, made explicit.** The free coach Fees tool tracks **money owed TO the coach only** (player dues/jerseys + whole-team fees the coach collects) — NOT a debit/credit ledger and NOT team expenses (those are the paid accounting module). Copy reframed to state this: purpose strip leads "Track what your **team** owes you" (covers per-player AND whole-team) with an aside "Everything here is money owed *to you* — your private record of what to collect." The ambiguous **"Team-wide charges" → "Whole-team fees"** ("charges" read as an expense/bill); subline "A shared amount the whole team owes you — tracked once, not split between players." Assignment select: "The whole team (one shared fee)" + helper ending "Either way, it's money owed to you."
2. **Mark-paid is a labelled control, not a bare icon.** Unpaid row → neutral `.markPaidBtn` ("✓ Mark paid", lime on hover only); paid row → lime `.paidPill` ("Paid · {date}") + quiet `.undoBtn`. The cryptic leftmost dashed-check toggle is retired. Lime stays reserved (one solid-lime "Add fee" primary; paid is the established status tint) — CP-1 holds across N rows.
3. **Zero-fee players never render $0 rows** (they implied a phantom split of a whole-team fee). Players with ≥1 fee → cards; the rest → either a quiet `.remainderRow` (count + a real `btn btn-ghost` "Add a player fee") when some players have fees, or a left-aligned `.playerFeesEmpty` inline prompt (real ghost button) when none do. **No centered empty-state card nested under a left-aligned section heading** (reads floaty) and **no two stacked gray text lines**. Section subline shows only when player-fee cards exist.
4. **Destructive deletes use the shared `FeedbackModal` (`type='danger'`), not native `confirm()`** — across all three coach editors (fee/player/event); the modal body names the item. `FeedbackModal` gained Escape-to-close + focus-the-Cancel-on-open + focus-restore-on-close + `role="dialog"`/`aria-modal`/`aria-labelledby`; its focus effect keys on `[isOpen]` with `onClose` via an effect-synced ref (callers pass inline-arrow onClose; keying on it caused focus churn on every re-render-while-open — caught in `/review`).

**Rationale:** Owner used the page and still hit confusion: couldn't find "mark paid", couldn't tell if a whole-team "charge" was owed-to-them or an expense they pay, saw $0 player rows implying a split, and the add-affordance "didn't look like a button." Root cause was an unnamed money model + an invisible core verb. Naming the direction everywhere, making the verb a labelled control, suppressing misleading zero rows, and using the app-standard modal + buttons resolves it without expanding scope into debit/credit (which stays Premium).

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (`.markPaidBtn`/`.paidPill`/`.undoBtn`/`.blockSub`/`.assignNote`/`.remainderRow`/`.playerFeesEmpty`; retired `.statusPaid`/`.statusUnpaid`/`.collapsedPlayers`), `components/coaches/RosterEditor.tsx` + `ScheduleEditor.tsx` (delete modals), `components/FeedbackModal.tsx` (a11y). No new tokens, no literal hex. **Generalizes:** name a non-obvious money/data DIRECTION in persistent copy (not just labels); a list's recurring core action is a labelled neutral control (accent reserved for status + the one primary); never render zero-value rows that imply a false relationship; reuse the shared modal + global `btn` classes for cross-surface consistency; and a shared modal's focus effect must key on open-state with callbacks via refs to avoid re-render churn.

### 2026-06-17 — Coach Fees page: persistent purpose strip + purpose-led empty gating

**Decision:** The org-less coach Fees page (`components/coaches/FeeEditor.tsx` + `.module.css`; route `/coaches/team/{id}/fees`) gets a persistent orientation strip + three-stage empty-gating, because a first-time coach couldn't tell what the page was for or which direction money flows.

1. **Persistent purpose strip (`.purposeNote`)** under the hero, on all stages — flat-note register: `--surface` / `--border` / `--radius`, **no `box-shadow`** (the missing highlight is what keeps it a *note*, not a *card*), `Wallet` 18px `--white-40` icon (quiet — never lime, never amber). Three-level type: bold `--white` lead ("Track what your players owe you") → `--white-60` continuation (dues/jerseys/cost-split + "record & check off") → demoted `--white-40` aside ("Your private tracker — no payments run through FieldLogicHQ, and it's not where you pay a tournament's entry fee"). The aside is the critical money-direction disambiguation and lives in the persistent strip because the empty state vanishes after the first fee but the misconception doesn't.
2. **Three-stage body gating:** (a) no players → existing **compact** `CoachEmptyState` "No roster to bill yet"; (b) players + no fees → one **full** `CoachEmptyState` "No fees yet" with a single lime "Add your first fee" primary (the one earned lime moment); (c) players + ≥1 fee → today's full ledger. The Owed/Paid/Unpaid summary strip, per-player $0.00 rows, and standalone Add-fee button are all **suppressed until ≥1 fee exists** — machinery never precedes purpose. Page header "{n} unpaid" meta also suppressed at zero fees.
3. **Money-visibility guard (from /review):** the first gate is `!hasPlayers && !hasFees` (not `!hasPlayers`) so a **team-wide charge stays visible when the roster is empty** — a tracked charge must never disappear behind the no-roster empty state. The per-player "Roster fees" block additionally gates on `hasPlayers` so it doesn't render an empty heading in that rare state.

**Rationale:** Owner: "it doesn't tell me what these fees are for… is this how I pay for tournaments? is this what I charge my players?" The page opened with dollar totals + machinery and zero orientation. A persistent flat-note (the 2026-06-05 metric-strip "small info doesn't warrant box weight" register, same family as the 2026-06-15 pending-portal strip) answers whose-money / what-for / track-only / what-it's-NOT durably; purpose-led empty-states defer the ledger until there's real data; lime stays reserved for the single first-action primary. The /review guard prevents the restructure from hiding a recorded team-wide charge on a money surface.

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (new `.purposeNote`/`.purposeIcon`/`.purposeText`/`.purposeLead`/`.purposeAside`; `hasPlayers`/`hasFees` gating), `app/coaches/team/[basicTeamId]/fees/page.tsx` (conditional header meta). No new tokens, no literal hex. **Generalizes:** a coach section whose purpose or money-direction is ambiguous gets a persistent flat-panel orientation note (not a card/banner, neutral non-lime icon, three-level type with the disambiguation as a demoted aside); machinery (stat strips, per-row ledgers) is suppressed behind a purpose-led **full** empty-state until real data exists; and empty-gating on a money surface must never hide already-recorded data (gate on data-presence, not just the precondition).

### 2026-06-17 — Coach Announcements: form-first single-accent layout + recipient-clarity caption

**Decision:** The org-less coach Announcements section (`components/coaches/AnnouncementEditor.tsx` + `.module.css`) is restructured from four competing container idioms (two glowing) into two surface families, and the recipient stats are made legible:

1. **No-contacts state → text-note, not a card.** The full `CoachEmptyState` medallion card is replaced by a slim `--warning`-hued inline row under the stat strip (`rgba(var(--warning-rgb),0.08)` bg + `0.25` border + `--radius-sm`, `TriangleAlert` 16px, ~46px tall) with a quiet ghost "Refresh contacts" action pinned right. Per addendum §iii the section's content is the compose form, so the missing contacts are a *prerequisite warning* (text-note tier), not actionable content that IS the section.
2. **Compose form promoted above the fold + de-glowed.** It loses its lime border + `--glow-sm` and becomes a neutral `--surface`/`--border` card. The primary working surface earns prominence by *position*, not glow. The lime accent (CP-1) is spent only on the Tier-1 `btn-lime` Send button — one earned moment per surface.
3. **"Recent announcements" gains a real `--surface` card** (`.logCard`); its inner `.row` items flatten to `--surface-2`/`--border-2`/`--radius-sm` to avoid a card-on-card double box.
4. **Skipped stat tile hidden when 0** (`data-cols` switches the strip 3-col→2-col).
5. **Recipient clarity:** the "Will email" tile relabels to **"Will receive"** (the old label read as an action, not a count), and a quiet text-note caption sits under the strip — `--white-40`, 0.78rem, 13px `Users` icon (icon matches text, **never lime**), no surface — naming the send rule + restating the count in words: *"Sent to the contact email on file for each player on your Roster — N person/people will receive this."* Shown only when `recipientCount > 0` (the amber warning owns the zero state, no duplication). Copy via `/marketing`; labels "On roster"/"Skipped" unchanged.

**Rationale:** Owner: "everything is just stacked and the shapes change as we go; the no-contacts message is very big and pushes the main part of the page down" + later "Will email / On roster aren't clear — who actually gets this?" Four surface idioms with two competing glows gave the eye no anchor and buried the actual job (compose) below the fold. Demoting the precondition to a text-note, de-glowing the form, and carding the log collapses to flat-metadata-strip + neutral-cards with zero competing glows. The recipient caption applies the 2026-06-05 metric-strip register ("small info doesn't warrant box weight") to answer "who gets this" without surface weight; the bare stat number that drives a consequential action (who is emailed) gets a one-line plain-language caption rather than relying on the label alone — caption carries meaning, tile carries the glance.

**Applies to:** `components/coaches/AnnouncementEditor.tsx` + `AnnouncementEditor.module.css` (new `.recipientsWarn`/`.recipientsWarnAction`/`.recipientsWarnIcon`, `.recipientNote`/`.recipientNoteIcon`, `.logCard`, `.formHint`, `.summary[data-cols]`; removed `.empty`/`.refreshBtn`/`data-muted`; `.row` flattened; `.form` de-glowed). No new tokens, no literal hex. **Generalizable pattern for coach editor sections:** the primary working surface earns prominence by position not glow (reserve glow/lime for the single most-important action); precondition warnings are `--warning` text-notes not full empty-state cards; a consequential bare stat gets a one-line metric-strip-register caption that explains the rule + restates the count in words.

---

### 2026-06-16 — Coaches Portal mobile shell: adopt the admin "4 primary + More" bottom-nav pattern

**Decision:** The org-less Coaches Portal mobile shell (`CoachPortalShell.tsx`, ≤1023px) is realigned to the established `AdminBottomNav` pattern. (1) **TOP BAR** becomes a team-first context strip — team color-dot + team name (full width, `--white` `0.95rem` `700`) + lifecycle chip; the "Coaches Portal" wordmark is dropped on mobile (optional small "FL" mark only), and the standalone email-initial account chip is removed. (2) **BOTTOM NAV** is fixed at 4 primary tabs (Overview, Tournaments, + first two activated Tier-2 / Explore) + a 5th **"More"** tab (`MoreHorizontal`/`X`). (3) **"More"** opens a single sheet holding: the team switcher (>1 team, "Current team" label, mirroring the admin `tournamentBlock`), ALL overflow sections ("Sections" label), and account utilities (All workspaces, Send feedback, Sign out). `isMoreActive` highlights More when the route is inside it. The previous account bottom-sheet behind the "B" chip is retired (its contents move into More).

**Rationale:** The coach shell invented its own mobile model and hit three failures: the bottom nav capped at 4 and silently dropped activated sections (functional dead-end), the brand outranked the truncated team name (inverted priority), and a bare-letter "B" chip created an opaque second nav home competing with the bottom bar. The admin shell already solved unbounded-section overflow with "4 primary + More" and keeps switcher+account inside More (one overflow home). Adopting it fixes all three, scales to any number of activated Tier-2 sections, puts the team identity first, and gives users the same mobile convention across admin and coach surfaces.

**Applies to:** `components/coaches/CoachPortalShell.tsx` + `CoachPortalShell.module.css` (mobile top bar, bottom nav, account sheet → More sheet). Reuses `AdminBottomNav` conventions (`moreWrap`/`dropdown`/`dropSectionLabel`/`tournamentBlock` equivalents). No new tokens.

---

### 2026-06-16 — Coach schedule: differentiate event types (game vs practice vs event) by colour + icon + row accent

**Decision:** The coach team Schedule list (`components/coaches/ScheduleEditor.tsx`) previously distinguished event types only by a 2-letter lime monogram (`GM`/`PR`/`EV`) — identical colour for all three, so games and practices blurred together. Now differentiated on three reinforcing axes, all reusing existing tokens:
1. **Per-type chip colour** (`.typeChip[data-type]`): **game = `--logic-lime`** (the marquee event keeps the brand accent), **practice = `--info-rgb`** (blue — the platform's "scheduled/routine" status colour), **event = neutral** (`--white-50` text / `--white-05` fill / `--border-2`).
2. **Icon instead of letters** (`TYPE_ICON` map): game = `Trophy`, practice = `Dumbbell`, event = `CalendarDays` (16–17px lucide, `aria-label` carries the type name for SR).
3. **Left status-strip row accent** (`.row[data-type]`): game = `border-left: 3px solid var(--logic-lime)` (strong), practice = `rgba(var(--info-rgb),0.5)` (faint), event = default border (quietest) — same convention as the admin/public schedule rows.

**Rationale:** Owner: games and practices should "stand out as different a little more." The one element meant to distinguish them (the chip) was visually identical across types. Colour is the fastest scan axis; icon reinforces it language-free; the row-edge strip makes games "pop" as the list scans (the established status-strip trick). Game = lime because it's the marquee event; practice = `--info` blue because that's the platform's routine/scheduled colour (pairs cleanly against lime, and avoids amber which already means "submitted/needs-attention" on schedule status-strips). No new tokens.

**Applies to:** `components/coaches/ScheduleEditor.tsx` (`TYPE_ICON`, row `data-type`, icon chip), `components/coaches/ScheduleEditor.module.css` (`.typeChip[data-type='game'|'practice'|'event']`, `.row[data-type='game'|'practice']`). Pattern for any future event/type list: colour + icon + optional left status-strip, keyed off the existing status-colour RGB tokens; reserve lime for the primary/marquee type.

---

### 2026-06-15 — Coach pending portal: status-hero + persistent "what happens next" strip + demoted manage zone

**Decision:** The coach pending tournament page (`/coaches/tournaments/{teamId}`, pending/waitlist phase) is restructured from a flat build-order card stack into three tiers: **(1)** the `TeamHQ` status hero (the answer — unchanged except the pending checklist "Registered" state now reads **"Submitted {date}"** to kill the ambiguous bare date); **(2)** a NEW persistent, non-dismissible **"What happens next"** 3-step strip (`components/coaches/CoachNextSteps.tsx` — borderless numbered rows on `--surface`/`--border`/`--radius`, lime step markers reusing the `CoachWelcomeBanner` `.iconWrap` recipe at `1.5rem`; NOT a `card`, NOT the lime banner — it carries the forward-orientation the dismissible welcome banner used to own, so it survives dismissal); **(3)** a visually-demoted **"Manage your entry"** zone (Head Coach in a `CollapsibleCard`, `defaultOpen={false}` while pending → `true` once accepted; a `.zoneNote` "Optional for now…" line). The dismissible `CoachWelcomeBanner` slims to a one-line lime greeting + resource links (body paragraph + "What happens next" block removed). The **Registration Details card is deleted on the pending phase** (fully duplicated by the hero; kept for accepted+). The "Back to Coaches Portal" breadcrumb is removed. New pending order: **hero → what-happens-next strip → manage-your-entry (collapsed) → announcements.**

**Rationale:** This is the first place a brand-new coach lands and they know nothing about the platform. The only orientation lived in a dismissible banner; the rest was equal-weight cards in build order (head coach → reg details → announcements) including a verbatim-duplicate details card. A persistent quiet strip — same register as the 2026-06-05 dashboard metric-strip decision ("small info doesn't warrant box weight") — gives durable "what now" orientation; `CollapsibleCard` demotes optional-while-pending prep without removing it; deleting the duplicate card removes redundancy. Reserve the lime wash for the celebratory dismissible greeting only, so the persistent strip (neutral) and the greeting (lime) don't compete.

**Applies to:** `app/coaches/tournaments/[teamId]/page.tsx`, `app/coaches/tournaments/[teamId]/detail.module.css` (`.zoneNote`; removed `.breadcrumb`), `components/coaches/TeamHQ.tsx`, `components/coaches/CoachWelcomeBanner.tsx` (+ module CSS), new `components/coaches/CoachNextSteps.tsx` (+ module CSS). Reuses `CollapsibleCard`. No new tokens; no literal hex (lime `rgba(217,249,157,…)` values match existing banner usage). Pattern: phase-adaptive coach pages lead with a status hero, carry forward-orientation in a persistent borderless strip (not a card), and demote optional-while-pending actions via `CollapsibleCard`. **Companion decision STAGED (separate session):** team-scoped coach shell nav mirroring tournament-admin (team name + status chip at rail top, dropdown only when >1 team; drop the "My Teams" nav link + team-list section; add a portal subtitle).

---

### 2026-06-15 — Schedule toolbar (rev 7): dropdown-overlap bug fixed; narrower division select; actions stay pinned right

**Decision:** Two real fixes + one reverted experiment, all MEASURED in Playwright.
1. **Dropdown menus were visually broken (rows overlapping).** Root cause MEASURED: the rev-5 height rule `.scheduleEndGroup :global(button){height:28px}` is a *descendant* selector, so it also clamped the **dropdown `[role=menuitem]` buttons** (Auto / Unpublish menus render inside `.scheduleEndGroup`) to 28px — crushing each item's two-line title+subtitle (measured 28px, overlapping). Fix: scope both the desktop (28px) and mobile (34px) height rules to `:global(button:not([role="menuitem"]))` so only trigger buttons are pinned; menu items size to content (measured 48px after). Also widened the Auto menu to `minWidth:250px` + `whiteSpace:nowrap` so its short titles ("Round-Robin Generator") stop wrapping. **Binding rule: never use a bare descendant `:global(button)` height/size rule on a container that also holds a dropdown menu — exclude `[role=menuitem]`.**
2. **Division select was gratuitously wide** (shared `ToolbarSelect` defaults `min-width:13rem` ≈ 208px; with label ≈ 270px). Added `className={styles.scheduleDivisionSelect}` to the Division select and `@media (min-width:769px) .scheduleDivisionSelect :global(select){ min-width:9rem }` — fits the longest realistic division name, tightens the left group, reduces premature wrapping.
3. **Reverted:** an experiment to cluster all controls left (drop `space-between`, `margin-left:0` on the action group, `flex:0 1 auto` on the left group). It closed the middle gap but moved the emptiness to the right edge. Owner chose **actions pinned right** (original `space-between`) — the middle gap reads as intentional "what you're viewing" (left) vs "actions" (right) separation. So the toolbar keeps `space-between` + grown left group + right-aligned action cluster.

**Rationale:** Owner: dropdowns "look visually broken" (the overlap bug — real, fixed) and "weird spacing" (the wide select + the gap). Turned out the gap itself was wanted; the wide division select was the avoidable part. The dropdown bug was a self-inflicted regression from the rev-5 height fix — caught only by measuring menu-item heights, not by eye.

**Applies to:** `schedule-admin.module.css` (height rules now `:not([role=menuitem])`; new desktop `.scheduleDivisionSelect` min-width), `page.tsx` (Auto menu `minWidth`/`nowrap`; `className` on the Division `ToolbarSelect`). The rev-6 `align-items:flex-start` stands; the rev-7 clustering experiment is NOT in the codebase.

---

### 2026-06-15 — Schedule toolbar (rev 6): top-align groups so the action cluster doesn't float between wrapped left rows

**Decision:** `.scheduleToolbar.scheduleToolbar { align-items: flex-start }` (desktop; double-class for specificity over the shared `.toolbar { align-items:center }`). MEASURED root cause via Playwright (y-centers, not eyeballed): the left toolbar group (Division + Stage + View) wraps to **two rows** on a narrow desktop / with devtools open — Division+Stage at y-mid 98, View toggle at y-mid 134 (group height 64px). The right action cluster (Build Bracket / Publish / Auto, 28px) was centered by the parent's `align-items:center` to y-mid **116** — exactly halfway between the two left rows, so it visually floated in the gap (user: "the buttons on the right are in between the 2 sets of buttons on the left"). Top-aligning pulls the cluster to y-mid **98**, level with the FIRST left row (Division/Stage). Verified before/after by measurement + screenshot; mobile unaffected (its `@media` `align-items:flex-end` rule still wins).

**Rationale:** Six revisions in, the persistent "not aligned" complaint was never about button *height* (rev 5 fixed that) — it was vertical *anchoring* against a wrapping multi-row sibling. `align-items:center` + a wrapping neighbor = the classic "short element floats to the centroid of the tall element" trap. flex-start is the correct anchor whenever a toolbar's groups can wrap to differing row counts.

**Applies to:** `schedule-admin.module.css` (`.scheduleToolbar.scheduleToolbar` align-items). No page.tsx change. Pattern: any space-between toolbar whose groups can wrap to different heights should top-align, not center.

---

### 2026-06-15 — Schedule toolbar (rev 5): button-height consistency, MEASURED via Playwright

**Decision:** Pinned consistent button heights in the schedule toolbar, verified by driving the page in Playwright and reading computed `getBoundingClientRect().height` (not by eye). Measured before/after:
- **Mobile Row 2** (Publish + wrench Tools, beside search): were **32px (Publish, `.mobileIconButton`) vs 24px (Tools, default `.btn-data`)**. The old `.scheduleEndGroup :global(button){height:38px}` rule only hit the desktop group (hidden on mobile), so the mobile controls had no shared height. Fixed: `@media (max-width:768px) .scheduleMobilePublish :global(button), .scheduleMobileTools :global(button) { height:34px }` — matches the 34px division select + stage toggle. After: **all 34px.**
- **Desktop Row 1 action cluster** (Build Bracket / Publish / Auto): were **22–25px ragged** (`.btn-data` ~22–23px, ghost dropdown triggers ~25px). Fixed: `@media (min-width:769px) .scheduleEndGroup :global(button){ height:28px }` — matches the adjacent venue button + filter chips (28px). After: **all 28px.** The Stage/View segmented toggles stay 22px deliberately — a distinct control family in their own zone, reads as grouping not misalignment.

**Process note (binding for future visual work):** stop iterating blind on screenshots. The repo has a Playwright UAT harness (`tests/uat/`, saved sessions in `.auth/`); a throwaway spec that loads a session, sets the viewport, drives the control, and dumps computed heights + a screenshot gives exact numbers to fix against and confirms the fix landed. Several prior revs missed the height bug because it was eyeballed. Measure, fix, re-measure, then delete the temp spec.

**Applies to:** `schedule-admin.module.css` (mobile `.scheduleMobilePublish`/`.scheduleMobileTools` height; desktop `.scheduleEndGroup` button height; retired the stale mobile 38px rule). No page.tsx change.

---

### 2026-06-15 — Schedule toolbar (rev 4): mobile publish = sibling beside Tools (not inside); bracket actions join the right action cluster

**Decision:** Two corrections to rev 3 after testing.
1. **Mobile Publish/Unpublish is a standalone button BESIDE the Tools menu**, not a section inside it. Rendered as `.scheduleMobilePublish` (a sibling on Row 2, `order:2`, just left of the wrench Tools menu `order:3`; `margin-left:auto` pushes the publish+tools pair to the right edge). The Publish section was removed from `MobileToolsMenu` again (its publish props dropped) — the Tools menu now holds only Playoffs + Generate. Reuses the lime `.publishButton` / `UnpublishControl`, both icon-collapsing via `.mobileIconButton`.
2. **Bracket actions (Build / Edit + Clear) live in the RIGHT action cluster**, not the left view group. In rev 3 they sat in the grown left group and **wrapped to a second line** in desktop Playoffs (3-option View toggle + 2 bracket buttons exceeded the row), orphaning them. They're now the lead of the right `align="end"` cluster: `[Edit][Clear] · [Publish/Unpublish] · [Auto]`, all right-aligned in one `nowrap` group. This matches the Round Robin look the owner approved (right-aligned action cluster) and removes both the mid-row gap and the wrapping. The left group reverts to just Division + Stage + View.

**Rationale:** Owner: "didn't want publish inside Tools on mobile — put it beside it"; and desktop Playoffs alignment "still off" because the bracket buttons had wrapped below. One coherent right-aligned action cluster in both stages is the consistent, non-wrapping answer; mobile keeps publish as a visible peer of Tools rather than buried a tap deep.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`.scheduleMobilePublish` sibling, bracket `.bracketActions` moved into the right `ToolbarGroup`, `MobileToolsMenu` publish section removed again), `schedule-admin.module.css` (`.scheduleMobilePublish` show/hide + order, `.scheduleMobileTools` margin removed, `.bracketActions` mobile-hide dropped since it now lives in the mobile-hidden `.scheduleEndGroup`). Supersedes rev 3's "bracket actions in left group" and rev 1/rev 3's mobile-publish placement. Header `meta` status + "Published / · names hidden" wording (rev 2) still stand.

---

### 2026-06-15 — Schedule toolbar (rev 3): publish ACTION back in toolbar, bracket actions grouped left, mobile Tools = wrench-only

**Decision:** Final layout after browser testing rev 2. The split is now: **status = header meta (left, under subtitle)**; **action = toolbar Row 1**, not the header actions row.
1. **Publish/Unpublish ACTION moved back to the toolbar Row 1 right group** (with the Auto menu). The header actions row carries only Export + Add Game. The published *status* (dot + "Published" / "· names hidden") stays in the header `meta` slot from rev 2 — status and action are now in different rows, which is fine: status orients (left, under title), action sits with the other toolbar actions (right).
2. **Mobile: publish lives in the Tools menu again.** The desktop Row-1 group is `display:none` on mobile, so the Publish section was restored to `MobileToolsMenu` (sits next to search on Row 2). This reverses rev 1's "header-only / not in Tools" call — owner preferred publish next to Tools on mobile.
3. **Mobile Tools trigger = wrench icon only.** Dropped the "Tools" word from the `MobileToolsMenu` button (kept the chevron + `aria-label`/`title`) to save row space. The menu only renders on mobile, so this is mobile-only by construction.
4. **Bracket actions (Build / Edit + Clear) grouped with the view controls (left), not the right action group.** They're contextual to the playoff view; wrapped in a desktop-only `.bracketActions` flex group placed immediately after the View toggle. This removes the large empty gap that appeared in desktop Playoffs view — previously they sat in the right `align="end"` group and got stranded across the `space-between` gap from the grown left group. Mobile reaches bracket build/edit via the Tools menu's Playoffs section (unchanged); `.bracketActions` hides on mobile.

**Rationale:** Owner, after testing rev 2: wanted the publish action back with the toolbar button cluster (not header); the mobile Tools button label wasted space; and desktop Playoffs showed "a lot of empty space" between the view controls and the stranded Edit/Clear/Auto buttons. Grouping bracket actions with the view they belong to (left) collapses the gap and reads as a coherent cluster.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (toolbar Row 1 publish action, `.bracketActions` wrapper in left group, `MobileToolsMenu` publish section + wrench-only trigger restored), `schedule-admin.module.css` (`.bracketActions` + its mobile hide). Amends rev 2 (action is in the toolbar, not header actions) and rev 1 (publish IS in the mobile Tools menu). The header `meta` status (rev 2) and "Published / · names hidden" wording stand.

---

### 2026-06-15 — Schedule publish (rev 2): status moved to header meta (left), "Published / · names hidden" wording, full-width mobile stage toggle

**Decision:** Same-day follow-up after browser testing the rev-1 control (below). Three fixes:
1. **Status moved OUT of the actions row into the header `meta` slot** (`TournamentAdminHeader meta`, rendered in `.headerMeta` under the subtitle, left-aligned). It was sharing the actions row with the Export / Unpublish / Add Game buttons, where a height-less text span never aligned cleanly with the ~34–38px buttons. The actions row now carries **only the action** (Publish button when unpublished, `UnpublishControl` when published); status is pure orientation on the left. Fixes the desktop + mobile alignment complaint outright.
2. **Wording: drop "Teams".** Published status now reads **`● Published`** in the common (real-names) case, and **`● Published · names hidden`** only in `published_generic` mode (`.publishStatusFlag`, `--white-40`, lighter weight). "Teams" was unclear and only the matchups-hidden state actually warrants a flag. Full meaning stays in the `title` tooltip on both modes.
3. **Locked tournament:** actions render nothing (read-only); if published, status still shows in meta. The old locked "Not Published" pill in actions was removed.
4. **Mobile stage toggle is now full-width** on its own row (`.mobileStageToggle { flex: 1 1 100% }`, buttons `flex: 1 1 0`), and `.scheduleStartGroup` wraps with the division select at `flex: 1 1 100%`. Eliminates the dead space that sat to the right of the Round Robin/Playoffs toggle when it hugged its content width.

**Rationale:** User-reported after rev 1: status "looks like a button / takes too much space," misaligned with adjacent buttons on both breakpoints; "why Teams?"; empty space beside the mobile stage toggle. Putting status in the orientation layer (left, under title) and keeping only actions on the right is the clean separation the 2026-06-01 decision intended; the meta slot already exists for exactly this.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`TournamentAdminHeader meta`, simplified `actions`), `schedule-admin.module.css` (`.publishStatusText` no longer flex-shrink-pinned, new `.publishStatusFlag`, retired `.publishGroup`, full-width `.mobileStageToggle`/`.mobileStageBtn`, `.scheduleStartGroup` wrap). Amends the rev-1 entry below: status lives in header meta (not the actions row), wording is "Published / · names hidden" (not "Published · Teams/Placeholder").

---

### 2026-06-15 — Schedule publish: dual-state header control, plain-text status, both stages, single mobile home

**Decision:** Reworked the schedule publish control into a single dual-state element in `TournamentAdminHeader.actions` (left of Export), shown in **both** Round Robin and Playoffs stages (publish is division-scoped — it covers the whole division's schedule, so hiding it in Playoffs was misleading):
1. **Unpublished → the control IS the action:** a lime `.publishButton` (Globe + "Publish"). On a locked tournament it falls back to the read-only `.publishStatusDraft` "Not Published" pill (no action).
2. **Published → plain text + leading dot, NO box** (`.publishStatusText` + `.publishStatusDot`): a 6px lime dot followed by neutral `--data-gray` uppercase "Published · Teams / · Placeholder", with the existing `UnpublishControl` chevron beside it. Mirrors the sidebar's `● Live / ● Open` indicators. Lime is carried only by the dot — the lime *fill/border* pill (`.publishStatus`) is retired for the published state so status never reads as a CTA next to real buttons.
3. **Visible on mobile.** The old `.publishStatus { display:none }` mobile rule left no published signal in the visible chrome (user couldn't tell if a division was published); `.publishStatusText` stays shown on mobile (slightly smaller), so state is always glanceable.
4. **Single action home on mobile.** Publish/Unpublish is header-only on every breakpoint. The **Publish section was removed from `MobileToolsMenu`** (and its now-dead props dropped) — that menu carries only Playoffs + Generate. No more two-paths-to-publish.
5. **Stage toggle de-duplicated.** The **Stage (Round Robin / Playoffs)** section was removed from the mobile view-settings bottom sheet; the always-visible on-screen `.mobileStageToggle` is the single home. Stage is the primary context switch, not passive view config (the sheet keeps View / Venue / Game Status).

**Rationale:** User-reported: published pill "looks like a button and takes up too much space" on desktop; "can't see if it's published or not" on mobile; publish appeared in both header and Tools menu; Stage toggle appeared twice. Confirms the standing "status = quiet orientation / action = lime button" hierarchy (dashboard metric-strip + 2026-06-01 publish-status decisions). Publish being division-scoped means it must appear in both stages.

**Supersedes / amends:** the 2026-06-01 "publish status moved to header" entry (status is now plain dot+text, not the lime `.publishStatus` pill, and is visible on mobile) and the 2026-06-01 "mobile Tools menu" entry's Publish section (publish is now header-only on mobile, not in the Tools menu — Generate/Playoffs remain).

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (header dual-state control, `MobileToolsMenu` signature + body, bottom-sheet Stage removal), `schedule-admin.module.css` (`.publishStatusText`, `.publishStatusDot`, `.publishGroup`; mobile `.publishStatusText` override). Pattern for any future per-division publish control: dual-state header element, plain dot+text status, single action home across breakpoints.

---

### 2026-06-12 — Schedule toolbar: destructive "Clear Bracket" de-emphasized vs neutral "Auto" menu

**Decision:** In the Schedule admin toolbar's Row 1 right action group, the new **Clear Bracket** button (shown in Playoffs view once a bracket exists, beside the **Auto ▾** tools menu) drops `btn-ghost` and adopts a new recessive/tertiary treatment (`.clearBracketBtn` in `schedule-admin.module.css`): transparent fill + `var(--data-gray)` text/icon at rest, with a danger reveal on hover (`rgba(var(--danger-rgb),0.12)` bg, `0.3` border, `--danger` text). It keeps `btn-data` sizing **and a 1px transparent border** so its box height matches the bordered `.btn-ghost` Auto trigger exactly (a borderless button would render 2px shorter — `.btn` is `border:none`, `.btn-ghost` adds 1px). Double-class selector (`.clearBracketBtn.clearBracketBtn`) for specificity over the global `.btn`/`.btn-ghost`. Auto stays the neutral ghost pill, unchanged. Establishes a 3-tier action hierarchy in this cluster: **create = prominent** (Build Bracket `btn-lime`), **everyday tool = secondary** (Auto `btn-ghost`), **destroy = recessive** (Clear Bracket transparent→danger-on-hover).

**Rationale:** Adding Clear Bracket put two visually identical gray ghost pills side by side, giving a rare destructive "delete the whole bracket" action the same resting weight as the everyday Auto menu and letting them blur together. Pairs with the binding rule "status = label vs action = button" and the admin convention "btn-lime/ghost/danger/data only." Destructive, infrequently-used actions should recede at rest and only signal danger on intent (hover), not compete with neutral tools. Transparent border preserves height parity so the pair still reads as a clean, aligned group.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (Clear Bracket button className), `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css` (`.clearBracketBtn`). Pattern is the standard for any future inline destructive action sitting beside a neutral peer in an admin toolbar cluster: recessive at rest, danger on hover, keep a transparent border for height parity.

---

### 2026-06-08 — Public registration form: de-duplicated header + inline payment panel (height reduction)

**Decision:** The public tournament registration form (`app/[orgSlug]/[tournamentSlug]/register/page.tsx` + `app/[orgSlug]/register/register.module.css`) was compacted to fit one screen:
1. **Removed the page-level `.public-page-header`** (eyebrow "Register" + h1 "Team Registration" + paragraph). Tournament identity is already carried by the shell's desktop top-context bar **and** the card `.formHeader` ("Register Your Team" + tournament sub-line — that sub-line stays, it's the only on-form identity at mobile widths). The removed paragraph's two claims (confirmation email; organizer-handled payment) are already stated in the payment panel + success screen, so no information is lost.
2. **Fee/deposit render as inline data rows, not boxed cards** (`.paymentDetails`): label (uppercase `--white-40`, fixed `5.5rem` min-width) · value (`--font-data` `1rem` `--white`) · due (`--white-50`); flex-column, no inner `border`/`background`/box padding. Direct application of the 2026-06-05 dashboard metric-strip decision — two numbers don't warrant bordered-box weight.
3. **Tightened chrome:** `.steps margin-bottom 2.5rem → 1.5rem`; `.formHeader margin-bottom 1.75rem → 1rem` + `padding-bottom 1.25rem → 0.85rem`; `.formIcon 48px → 40px`.
4. **Footer copy trimmed:** *"FieldLogicHQ records registration and payment status for the organizer, but payments are made outside the platform."* → *"Payments are made directly to the organizer, outside the platform."*

Net ≈230px recovered (fits a 1366×768 laptop viewport). **Field spacing deliberately left alone** — the bloat was redundant chrome, not the inputs. The green→amber→red availability bar is unchanged.

**Rationale:** The form announced the tournament/intent three times (shell top bar + page header + card header) before the first input, and the payment panel repeated the "heavy box for a small number" anti-pattern the dashboard already retired. User reported the form exceeded one viewport for very little information.

**Applies to:** `app/[orgSlug]/[tournamentSlug]/register/page.tsx`, `app/[orgSlug]/register/register.module.css`. Establishes: on transactional public forms inside the tournament shell, don't repeat the identity header the shell + card already provide; render small numeric summaries as inline data rows, not boxed cards.

---

### 2026-06-07 — Public bracket: mouse drag-to-pan + edge fades for horizontal scroll

**Decision:** `LogicSyncBracket` now wraps its SVG in a `BracketScroller` (in-file) instead of a bare `<div style={{ overflowX: 'auto' }}>`. It adds: (1) **mouse click-drag-to-pan** with a `grab`/`grabbing` cursor (pointer events, mouse-only via `e.pointerType === 'mouse'`; a >3px move sets pointer capture and a capture-phase click-swallow so a pan never reads as a tap); (2) **soft left/right edge fades** (`ScrollEdge`, `linear-gradient(... var(--surface) 88%)`) shown only when there's hidden content that way; (3) `overscroll-behavior-x: contain` + `scrollbar-width: thin`. A `ResizeObserver` on both the viewport and the inner content tracks overflow/scroll position. Touch/trackpad keep native momentum scrolling (drag-pan is mouse-only). The inner `width: fit-content; margin: 0 auto` (centers when it fits, left-aligns when it overflows) is preserved.

**Rationale:** On a tall double-elim fork the native horizontal scrollbar sits **below the fold** — unreachable without scrolling the whole page past the bracket — and a mouse wheel only scrolls vertically, so mouse users had no way to reach the Losers bracket / Grand Final (user-reported "can't scroll horizontally"). Nothing was clipping; the affordance was just undiscoverable. Drag-to-pan (Figma/Trello/maps pattern) + a visible edge fade makes the hidden content reachable and obvious without hijacking page scroll. Bracket nodes have no click/navigation behaviour, so drag-pan is safe.

**Applies to:** `components/bracket/LogicSyncBracket.tsx` (`BracketScroller`, `ScrollEdge`). The bracket renders only on public Schedule (Playoffs → Bracket) and Standings. Pattern is the standard for any future wide, scroll-region visualization.

---

### 2026-06-07 — Light mode: lift muted-text tokens (-40/-45/-50) for contrast on bright displays

**Decision:** In the tournament light-mode token override (`app/[orgSlug]/[tournamentSlug]/layout.tsx` `lightModeVars`), the mid muted-text tokens were darkened ~0.12: `--white-50` 0.5→0.62, `--white-45` 0.45→0.58, `--white-40` 0.4→0.52 (alpha of `#0F1123` on white). The brighter structural faints (`--white-35/-30/-10`, used for dividers/placeholders) are unchanged, as are the already-strong `--white-60`→`-90`. A literal alpha port of the dark scale washes out on white surfaces; these tokens drive secondary text (bracket round labels, dates, metadata) which was low-contrast (~3.6:1) on bright laptop panels.

**Rationale:** User on a new (bright/vivid) laptop reported the light theme "very bright and hard to read." Body text was already fine (near-black `--white: #0F1123` on white ≈ 18:1) — the genuine issue was washed-out *muted* text. This is a targeted contrast-floor lift, not a surface change: the raw glare of pure-white surfaces is a monitor-brightness matter (Night Light / lower brightness / the platform's dark-first default), deliberately not "fixed" by dimming surfaces. Scoped to light mode only (dark mode untouched). Pairs with the 2026-06-01 accent-contrast-floor decision.

**Applies to:** `app/[orgSlug]/[tournamentSlug]/layout.tsx` (`lightModeVars`). Any future light-mode token tuning lifts muted *text* alphas rather than dimming `--surface`/`--bg`.

---

### 2026-06-07 — Install app prompt: solid-primary Install button replaces blue→lime gradient

**Decision:** The `InstallAppPrompt` "Install" CTA (the dismissible add-to-home-screen banner on public/fan tournament pages) no longer uses the global `btn btn-primary btn-sm`, which rendered the banned `linear-gradient(135deg, var(--primary), var(--primary-light))` blue→lime gradient. It now uses a self-contained module class `.install`: **solid `var(--primary)` fill, `#FFFFFF` text, `box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.35)`**, uppercase `--font-data` (matching the banner's `.title` treatment), `var(--radius-sm)`. Hover = `color-mix(in srgb, var(--primary) 88%, #000 12%)` + slightly lifted shadow + `translateY(-1px)`. The class is fully self-contained (does not rely on `.btn`) so it can never inherit the global `.btn-primary` gradient regardless of whether `[data-color-mode]` is present on the surface.

**Rationale:** Same blue→lime gradient the user rejected on the schedule segmented toggles (2026-06-01). Violates the binding principle *"gradients on functional UI elements (decorative use only; never on buttons or form inputs)"* and the *"btn-primary is banned outside overlay modals"* audit rule. Solid `var(--primary)` is the established **public-page** primary-CTA convention and matches the banner's existing `border-top: 2px solid var(--primary)` accent, so the banner reads as one cohesive branded unit. Using `var(--primary)` (not lime) keeps the button branded per-tournament for Plus orgs with custom accents; the theming layer's accent contrast floor (2026-06-01 #4) keeps white-on-primary legible.

**Applies to:** `components/InstallAppPrompt.tsx`, `components/InstallAppPrompt.module.css` (`.install`). This is the fan-app/member-app install banner used on public tournament pages and authenticated shells. Any future install/PWA prompt CTA follows the same solid-primary pattern.

---

### 2026-06-05 — Dashboard: metric strip replaces stat cards; game-day board is card-free

**Decision:** The four stat cards (Teams / Scheduled / Completed / Days Away) are replaced by:
1. **A compact inline metric strip** (`renderMetricStrip`) on active pre/post-event and completed states: lime tabular numerals + tiny uppercase labels, separated by faint mid-dots, underscored by a single blueprint hairline. Pre-event: Teams · Scheduled · Days Away (hidden when ≤0). Completed: Teams · Scheduled · Completed.
2. **No strip at all on game day** (`isGameDay`). The game-day board (Games Progress, Team Check-in, Schedule Health, By Division) provides full operational context — a stat strip would be redundant noise.
3. The Customize button is gated to `(isActive && !isGameDay) || isCompleted` — hidden entirely on game day (nothing to customize in the fixed game-day layout).
4. **7-day registration sparkline** added to the Registration panel header (72×22px SVG polyline, lime stroke, no library). Derived from existing `acceptedTeams.registered_at` in the dashboard API — no additional DB query. Only renders when at least one non-zero day exists. Hidden ≤640px.

**Rationale:** Three large card boxes for three numbers was a disproportionately heavy container — ~130px of vertical space for minimal information. Game-day operators need the board immediately on load; pre-event admins need the registration and payment panels; the metric strip gives orientation context in one line. The sparkline adds trend intelligence that a raw count doesn't provide, answering "is registration picking up or stalling?"

**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `dashboard.module.css`, `app/api/admin/tournament-dashboard/route.ts`. Stat card drag/sort/icon code left in place (panel zone customization still uses the same `isCustomizing` flow).

---

### 2026-06-05 — Shared admin chrome: density toggle removed from UI; sidebar LIVE indicator uses `isWithinEventDates`

**Decision:** (1) **Density toggle removed** from both the desktop sidebar footer and the mobile More sheet "Display" section. The auto-detection (`pointer: coarse` → comfortable default on touch, compact on desktop) does the right thing for most users; exposing a manual override produced a toggle whose effect was imperceptible (8px row height, 10px control height) and confused users who clicked it and saw nothing obvious change. The density tokens and `useAdminDensity` context remain — auto-detection still fires — only the two UI toggle blocks were removed. (2) **Sidebar "● Live" now gated on `isWithinEventDates()`** — previously any `status === 'active'` tournament showed "● Live" in the sidebar even if it was 40 days away. Now: within dates → "● Live"; active but pre-event → "● Open"; draft/completed/archived unchanged. Matches the resolved-phase logic the mobile top app-bar already used.

**Rationale:** The density toggle was discovered to be "barely noticeable" in browser testing — a toggle that produces no perceived change has negative UX value (confusion > benefit). The LIVE sidebar mislabel was flagged visually: "Battle of the Bats 2026" (40 days out) showed LIVE alongside "Live Demo — Game Day" (actually live today) — identical labels for different states.

**Applies to:** `components/admin/AdminSidebar.tsx`, `components/admin/AdminBottomNav.tsx` (Display section removed, `useAdminDensity` import removed from both). `AdminSidebar.tsx` now imports `isWithinEventDates` from `@/lib/tournament-phase`.

> ⚠ **SUPERSEDED in part (2026-08-02):** the density-toggle half stands. The sidebar LIVE indicator is **gone entirely** — the rail no longer shows status at all, and the `isWithinEventDates` import is removed with it. This entry's reasoning is honoured, not reversed: it fixed a rail that had to be taught the game-day rule separately; the fix now is that only the page header ever computes phase. See the 2026-08-02 entry at the top.

---

### 2026-06-05 — Dashboard mobile: in-header status chip removed; Customize button hidden on mobile

**Decision:** The `.statusChipMobile` block (status dot + colored status text + sub-label row, mobile-only, rendered in the page header below the tournament name) was removed from the dashboard JSX. The mobile top app-bar pill (`AdminMobileTopBar`) already communicates the phase; the in-header chip duplicated it with a different label ("PRE-EVENT" vs "OPEN") creating both redundancy and inconsistency. The `statusBlockDesktop` hide breakpoint was extended from `max-width: 640px` to `max-width: 900px` to match the full shell mobile threshold (both representations were showing between 641–900px). The Customize button is now `display: none` at ≤900px — on mobile the Customize action is deprioritized (game-day operators, the primary mobile use case, should reach operational content without navigating edit mode).

**Rationale:** Two status indicators on the same screen with different labels is worse than one. The Customize button on mobile game day was occupying ~36px of precious above-fold space for an admin utility that mobile operators don't need mid-event.

**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (statusChipMobile JSX removed), `dashboard.module.css` (new `max-width: 900px` block).

---

---

### 2026-06-03 — Venue/facility select: full label in closed state
**Decision:** Facility `<option>` elements inside a venue `<optgroup>` must include the parent venue name in their text: `{venue.name} — {facility.name}` (e.g. "Milton Diamond — diamond #1"). The `<optgroup label>` is invisible when the `<select>` is closed; facility names alone (e.g. "diamond #1") are not self-identifying. When open, the optgroup still groups by venue name — minor redundancy, standard grouped-select pattern.
**Rationale:** User-reported: "diamond #1" with no venue name is not specific enough and wastes the available width.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` venue/facility select. Apply the same pattern to any other grouped facility selects added in future (Generator date-slot venue select, if it ever becomes a `<select>` instead of checkboxes).

---

### 2026-06-02 - Tournament admin export placement: header actions

**Decision:** Page-level tournament admin exports belong in `TournamentAdminHeader.actions`, immediately to the left of the primary add/create button when one exists. Applied to Teams, Schedule, Results, and already-matching Venues. Toolbars should retain context selectors, filters, publish/generate tools, mobile action overflow, and multi-select controls, but not the main page export dropdown.

**Rationale:** Exports are page-level utilities, not view/filter controls. Keeping them in the header creates a consistent scan path across Teams, Schedule, Results, and Venues, and avoids each page placing Export in a different toolbar cluster. On mobile, the shared `ExportMenu` already collapses to icon-only, so Schedule no longer needs a duplicate Export section inside `MobileToolsMenu`.

**Supersedes:** The 2026-06-01 Schedule toolbar mobile decision that placed Export inside the mobile Tools menu, and older Results reformat notes that moved Export into the toolbar.

---

### 2026-06-02 — Schedule Generator: full density + compliance overhaul

**Decision:** Applied comprehensive design system alignment to the Schedule Generator modal (`Generator.tsx` + `schedule-admin.module.css`):

1. **Modal header** — `.generatorHeader h3` changed from `1.25rem sans-serif` to `font-data 0.82rem 800 uppercase letter-spacing:0.08em`, matching the binding `.modal-header h3` HUD standard.
2. **Mode toggle** — replaced `btn btn-sm btn-primary / btn-ghost` pair with a `.generatorSegmented` control: `border: 1px solid blueprint-blue`, no-gap inline buttons, active state = `var(--primary)` solid fill + `#fff` text. (`btn-primary` outside a modal is banned by prior decision.)
3. **Date slot rows** — stripped the double-boxed card structure (container `1rem padding bg-2` + per-row `0.75rem border card`). New layout: `.dateSlotList` = a bordered wrapper with no internal padding; `.dateSlotRow` = a flat 5-column grid (`1fr auto auto auto auto`) at `0.35rem 0.6rem` padding. Inputs (`.dateSlotSelect`, `.dateSlotTime`) are 28px compact, same visual weight as the inline edit form. Separator is `–` plain text not a full-width center div.
4. **Priority limits** — replaced two `.priorityField` card-boxed inputs with a `.limitsRow` inline row: `MAX / DAY [52] per team  ·  MIN REST [60] min between games`. Inputs are 52px wide, `font-data 0.82rem 700`. No cards, no labels inside boxes.
5. **Preference checkboxes** — replaced `.priorityCheck` card cells (border + bg + `min-height:100%` stretch) with `.prefChecks` + `.prefCheck`: a flex-wrap row of simple inline `[☑] label` pairs. No boxes, no borders, no height matching. Effort select moved to a compact `.effortRow` with an inline hint.
6. **Number inputs** — `gamesPerTeam`, `gameLength`, `breakLength` now use `.compactNumberInput` (`max-width: 80px; text-align: center`) so 1–3 digit values don't span half the modal width.
7. **Generate button** — changed from `btn btn-primary btn-lg` (two violations: btn-primary banned outside modals; btn-lg not admin standard) to `btn btn-lime btn-data` + `.generateBtn` (full-width, `min-height: 34px`).
8. **Mobile overlay** — at ≤540px the generator becomes a bottom sheet: `padding:0; align-items:flex-end`; modal gets `border-radius: 12px 12px 0 0; max-height:93vh`. At ≤680px overlay padding reduces to 1rem.

**Rationale:** The generator violated five separate binding design decisions simultaneously. The date slot double-boxing wasted ~120px of vertical space per row. The preference checkbox cards grew to match the Effort select height, making three simple toggles look like a decision matrix. btn-primary + btn-lg on the generate button were both violations; the lime data button is both brand-correct and proportional to the form.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx`, `schedule-admin.module.css` (new classes: `.generatorSegmented`, `.generatorSegBtn`, `.generatorSegBtnActive`, `.dateSlotList`, `.dateSlotRow`, `.dateSlotSelect`, `.dateSlotTime`, `.dateSlotSep`, `.dateSlotDel`, `.compactNumberInput`, `.limitsRow`, `.limitItem`, `.limitLabel`, `.limitInput`, `.limitUnit`, `.effortRow`, `.effortHint`, `.prefChecks`, `.prefCheck`, `.generateBtn`). Pattern is binding for any future generator-style wizard modal.

---

### 2026-06-02 — Team names reflow (2-line wrap) instead of truncating in matchup rows

**Decision:** Long team names (30+ chars) must never be cut off with an ellipsis where games/teams are listed. The fix pattern, applied everywhere a matchup or score pair renders:
1. **Reflow, don't split rigidly.** The two sides of a matchup use `flex: 0 1 auto` (admin) / drop `flex: 1` (public) inside a `justify-content: center` matchup cell, so a long name borrows the slack a short opponent isn't using and the pair stays anchored around the centred "VS".
2. **Wrap to 2 lines, never truncate.** Team-name elements use the venue-cell clamp pattern — `overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.2–1.25` — replacing `white-space: nowrap; text-overflow: ellipsis`. A name reflows to a second line (row grows only for that row) rather than hiding characters.
3. **`title` tooltip safety net** on the dense admin/public schedule matchup names for the rare >2-line case.
Page width kept at 1100px (no widening) — reflow handles it within the existing layout.

**Rationale:** Equal `flex: 1` halves truncated a long name even when its opponent was short and there was free space (the "Halton Hawks U11 Jr (…" screenshot). Truncation also violates the principle *"never hide critical admin data — reflow, stack, or scroll instead."* Two 30-char names can't co-exist on one line at any realistic matchup-column width, so wrapping is the only thing that guarantees the 30-char requirement. Standings `.teamCell` and the public Teams card already wrapped — this brings the matchup/score surfaces in line.

**Applies to:** `schedule/components/GameList.tsx` (planning + scoring matchup — admin Schedule AND admin Results, which reuses GameList) + `schedule-admin.module.css` (`.planningTeamAway/.planningTeamHome` base rules, new `.scoringTeamName`); public `schedule.module.css` (`.matchSide`, `.matchTeam`) + `ScheduleContent.tsx` (title attrs); `standings.module.css` (`.scoreTeamName`) and legacy `results.module.css` (`.scoreName`); `teams-admin.module.css` (`.registrationNameCell` hardened with `overflow-wrap: anywhere`). Pattern is binding for any future matchup/score-pair rendering.

---

### 2026-06-01 — Rules admin mobile: data-density pass (cards + section headers)

**Decision:** Comprehensive mobile tightening of `RulesAdmin.tsx` at `≤720px`:
- **Section header**: row layout (no column flip), `border-bottom: none`, `padding-bottom: 0.15rem`, `gap: 0.35rem` to first card — eliminates the visual dead-zone the border + gap created.
- **Section title**: demoted to `0.62rem --font-data uppercase white-30` — reads as a quiet label, not a structural heading.
- **Card title**: switched from `--font-display 1rem 800` to `--font-data 0.82rem 700` on mobile — matches the operational data-density scale used across all other admin list pages.
- **Card header padding**: `0.85rem → 0.5rem 0.65rem`, `align-items: flex-start → center`.
- **Rule items list**: padding `0.85rem → 0.45rem 0.65rem`, gap `0.4rem → 0.2rem`.
- **Textarea font**: `0.9rem → 0.82rem`, `line-height: 1.5 → 1.45`.
- **Applies-to row**: padding `0.5rem 0.85rem → 0.3rem 0.65rem`, label font `0.8rem → 0.75rem`.
- **Section save bar**: padding `0.75rem 1.25rem → 0.5rem 0.65rem`.
- **Rules stack gap**: `1.5rem → 0.65rem` between cards.
- **Section-to-section gap**: `2.5rem → 1.75rem`.
**Rationale:** The page needs to show rule point text efficiently — a tournament may have 5–10 sections with multiple points each. The `--font-display` card title and generous padding were inherited from a desktop-first edit flow; mobile is a review/scan context where data density is the priority.
**Applies to:** `RulesAdmin.tsx` inline `<style jsx global>` `@media (max-width: 720px)` block.

---

### 2026-06-01 — Divisions: flat-row table matching Schedule/Results/Teams pattern

**Decision:** Replaced the card-flip responsive table with the standard admin flat-row pattern used by all other admin list pages:
1. **`mobileActionsInline={true}`** added to `TournamentAdminHeader` + local CSS `flex-wrap: nowrap` override at ≤760px forces the "+" button to stay on the same line as the "DIVISIONS" title. Previously the flex-wrap caused the button to orphan on its own row below the header.
2. **Flat-row table with column hiding** replaces the card-flip system. Five columns: Division / Age Range / Teams / Pools / Status / Actions. Pools hides at ≤768px; Age Range and Teams hide at ≤640px. Actions (edit + delete icon buttons) are always visible in a right-aligned `.rowActions` flex cluster.
3. **`.divisionMeta` sub-line** inside the Division cell shows age range + team count at ≤640px only (compensates for the two hidden columns), rendered in `--white-40 0.68rem font-data` beneath the `badge-primary` name. No data is lost on mobile — it's just compacted.
4. **Previous card-flip CSS removed** — no more `@media (max-width: 720px)` card block in `admin-page.module.css`.
**Rationale:** Cards were inconsistent with every other admin list page; the flat-row + column-hiding pattern is the established platform standard. The orphaned "+" button was a layout bug from the un-gated `flex-wrap` on the header.
**Applies to:** `app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css`, `app/[orgSlug]/admin/tournaments/divisions/page.tsx`.

---

### 2026-06-01 — Divisions mobile: card layout remediation

**Decision:** Six mobile-specific fixes applied to the Divisions admin page:
1. **Removed `max-width: 900px`** from `.page` — enforces the global "no page-level max-width in admin shell" rule.
2. **Fixed undefined CSS tokens** — `var(--bg-surface)` → `rgba(255,255,255,0.02)`, `var(--border-subtle)` → `var(--border-2)`, `var(--text-tertiary)` → `var(--white-40)`. All three were undefined in the design system.
3. **Division name as card title** — on mobile, the `badge-primary` chrome (border, background, padding) is stripped; the name renders at `0.95rem var(--logic-lime) font-weight:700` as a full-width card heading with no label column (`grid-template-columns: 1fr`). Matches the pattern of treating the first data row as a card title rather than a styled badge.
4. **Action buttons moved to top-right corner** — `td[data-label="Actions"]` is `position: absolute; top: 0.85rem; right: 0.85rem` on mobile; the `tr` is `position: relative`. The "ACTIONS" pseudo-label is suppressed. Each button is a 36×36px square icon (`flex: none; padding: 0`). The `tr` has `padding-right: 5.75rem` to keep card content from sliding under the buttons. Status row gets explicit `border-bottom: 0` since it's now the visually last row in flow.
5. **Add Division collapses to icon-only on mobile** — below 760px, a `.addDivisionLabel` span is hidden and the button shrinks to 32×32px, matching the `addTeamButton` / `addGameButton` pattern on Registrations and Schedule.
6. **"No pools" muted color** — `var(--white-20)` → `var(--white-30)` for minimum readable contrast on the dark card surface.
**Rationale:** Three undefined tokens were causing unpredictable rendering. The full-text Add button and the ACTIONS row were inconsistent with all other admin mobile pages. The absolute-positioned action buttons eliminate a ~50px wasted row at the bottom of every card.
**Applies to:** `app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css`, `app/[orgSlug]/admin/tournaments/divisions/page.tsx`.

---

### 2026-06-01 — Public schedule: "matchups TBA" notice for placeholder-published divisions

**Decision:** When a division's `scheduleVisibility === 'published_generic'` (published with placeholder/TBD names — times, fields, and scores are real but matchups are withheld), the public schedule shows an **info-tinted notice** above the games: *"Game times and locations are set — matchups will be announced soon."* (`.tbaNotice`, `Info` icon, `rgba(--info-rgb,…)` border/bg matching the "scheduled" status-strip colour). This sets expectations so a TBD grid isn't mistaken for a finalized schedule.
**Rationale:** Owner raised that TBD games could give a false sense of a settled schedule. Truly `unpublished` divisions already show **no games** (existing empty state) — so the only gap was the deliberate `published_generic` state, which had no signal that names/matchups were still pending. A notice is preferred over hiding the grid because the times/fields ARE committed and useful (teams know when/where to show up); the org controls full secrecy by keeping a division `unpublished`. Confirms the three-state model: unpublished = nothing public; generic = committed grid + TBA notice, names withheld; teams = full names.
**Applies to:** `components/public/ScheduleContent.tsx` (notice above main content, gated on `activeVisibility === 'published_generic'`), `app/[orgSlug]/schedule/schedule.module.css` (`.tbaNotice`).

---

### 2026-06-01 — Public schedule: drop ICS export, always-on team search, no TBD in team filters

**Decision:** (1) **Removed the iCal/Calendar export** from the public schedule controls — `handleExportICS`, the `Calendar`/`Team Calendar` button (`.calendarButton`), and the `@/lib/export` import are gone. (2) **Team search is now always available** when the division is published — the gate dropped from `activeVisibility !== 'published_generic' && !== 'unpublished'` to just `!== 'unpublished'`. (3) **Team filters (search + "My Team Games") never surface unresolved "TBD" matchups.** `teamFiltered` now matches on the *displayed* names via `getTeamDisplay` (not the hidden underlying `team.name`), excludes any game where both slots display `TBD`, and for the followed-team path returns true only when the followed team's own slot resolves to a real (non-TBD) name. The old loose `homePlaceholder/awayPlaceholder` substring matching was dropped (placeholders already flow through `getTeamDisplay`).
**Rationale:** Owner removed the calendar export and wanted a visible team search + "My Team Games" that doesn't list placeholder/TBD games. **Consequence (by design):** in `published_generic` ("placeholder names") mode every slot displays `TBD`, so name search and "My Team Games" return nothing — you can't filter a team by name when the org has chosen to hide names. The filters become meaningful once a division is published with real team names (`published_teams`). Flagged to owner.
**Applies to:** `components/public/ScheduleContent.tsx` (`teamFiltered`, controls block, imports). `.calendarButton` CSS now unused (left in place).

---

### 2026-06-01 — Results scoring rows: date · time on one line (match planning mode)
**Decision:** In `GameList.tsx`, the scoring-mode (Results) date cell now renders **`{date} · {time}` as two inline spans in a single `white-space: nowrap` div**, identical in structure to planning mode (Schedule). Previously it stacked the time in a separate block `<div>` under the date, so on mobile the row read "Jul 15" / "2:00 PM" on two lines — out of step with the Schedule rows ("Jul 15 · 9:00 AM"). The mobile status sub-line (`.scoringMobileStatus`: ✓ FINAL / ⚠ REVIEWING / SCHEDULED) stays below the date·time line; `.scoringDateCell` is now `flex-direction: column; gap: 0.12rem` on mobile to mirror `.planningDateCell`'s spacing. Applies to both desktop and mobile (the 130px desktop date column fits the inline format; planning already proved this).
**Rationale:** User flagged the Results mobile rows looked "messed up" vs Schedule — the stacked date/time was the cause. Scoring and planning rows share `GameList` and should present date/time identically; the only legitimate difference between the two modes is the score inputs / status semantics, not the date format.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` (scoring date cell), `schedule-admin.module.css` (`.scoringDateCell` ≤768px). Mirrors the planning-mode date cell.

---

### 2026-06-01 — Public schedule: adopt admin flat-row layout (SUPERSEDES "tightened cards, not a list")

**Decision:** After seeing both rendered, the owner chose the admin schedule/results **flat row** over the card treatment. This **overrides** the earlier same-day "tightened card rows (density), not a list" decision — the public schedule is now a list, matching the admin `GameList` anatomy. Row structure (desktop grid `76px 188px 1fr 116px`): **left status color-strip → time → location → matchup → status**. Specifics:
- **Status color-strip** = `border-left: 3px solid` keyed off `data-status`, same mapping as admin: scheduled `rgba(--info-rgb,0.5)`, submitted `rgba(--warning-rgb,0.55)`, completed `rgba(--success-rgb,0.5)`, cancelled `rgba(--danger-rgb,0.55)`.
- **Time** only (date lives in the date-group header), `--font-data`.
- **Location** via `LocationLink`.
- **Matchup** = `[awayScore] awayTeam  VS  homeTeam [homeScore]` — away on the left, home on the right (per owner spec), team names `--font-data`, scores shown only when present and colored by outcome (win `--success` / tie `--warning` / loss `rgba(--danger-rgb,0.7)`). **W/L/T letters dropped** — colour alone conveys outcome.
- **Status** = `Final`/`Pending`/`Cancelled` badge (none for scheduled), plus a small lime follow-star and any playoff bracket badge.
- Rows are **flat** (no `.card`): `border-bottom: 1px solid var(--border-2)`, `min-height: 2.85rem`, hover = `--white-03` bg (no translateX). Followed game = `rgba(--primary-rgb,0.07)` row tint. Mobile (≤768px) uses `grid-template-areas` so time/status flank a stacked matchup-over-location.
**Rationale:** Owner found the flat admin row "cleanest" once both were live. Consistency between admin and public schedule reduces cognitive load and reuses the established status-strip + matchup language.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard`), `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow` + `.timeCell/.locationCell/.matchupCell/.matchSide/.matchTeam/.matchScore/.matchVs/.statusCell/.followStar`). Mirrors `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`. The earlier card-density entry and the `.scoreChip/.outcomeLetter/.teams/.teamA/.teamB/.vsChip` classes are now obsolete (left in CSS, unused).

---

### 2026-06-01 — Public schedule rows: removed per-row clock icon + even single-line rhythm

**Decision:** (1) **Clock icon removed** from `.gameTime` (`<Clock>` and its lucide import). It was decorative and rendered inconsistently — on two-digit-hour times ("10:00 AM") the 80px time grid track + no `flex-shrink:0` caused flexbox to collapse the SVG to ~0 width, so it appeared as a "dot" on some rows and vanished on others. Time text stands alone (admin results has no per-row clock either). (2) **Score chip flattened to a single row** — `.scoreChip` `flex-direction: column → row` so the FINAL/Pending badge sits inline beside the numbers instead of stacked above them; this makes scored rows the same height as unscored "VS" rows (the stacked badge was the real cause of uneven vertical rhythm, not padding). (3) **`.gameRow` gets `min-height: 2.75rem`** (and padding `0.45rem → 0.4rem`) for a steady ~44px row baseline + comfortable tap target. (4) **Matchup cap `max-width: 520px → 480px`** to group the team names a touch tighter.
**Rationale:** The "can we do better with spacing" complaint was really row-height unevenness from the stacked score badge; flattening it + a min-height baseline gives even rhythm. The "dot on some times" was the clock icon clipping — removed rather than patched since it's decorative and off-pattern with admin.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard`, lucide import), `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow`, `.scoreChip`, `.teams`).

---

### 2026-06-01 — Schedule toolbar mobile: Publish/Auto/Export collapse into one "Tools" menu
**Decision:** On mobile (`≤760px`) the three Row-1 action controls — Publish/Unpublish (incl. the split "all published" option), the Auto/Generate menu, and the Export menu — are hidden (`.scheduleEndGroup { display: none }`) and replaced by a single **`Tools ▾`** dropdown (`MobileToolsMenu`, local to `schedule/page.tsx`) rendered on **Row 2, right of the search field**. The menu has three labelled sections — **Publish · Generate · Export** — each item wired to the same handlers the desktop controls use (no duplicated behaviour or new endpoints). Plan gating is preserved: locked Generate/PDF items show a `Lock` glyph + upgrade tooltip; the publish section mirrors desktop (Publish when unpublished; Unpublish this division / Unpublish all (N) when published, gated to round-robin view). With the action cluster gone from Row 1, the **division selector now reclaims the full first row** on mobile (it was previously squished sharing the row with three fixed-width buttons). Search drops from `flex: 1 1 100%` to `flex: 1 1 auto` so the Tools button sits beside it. Desktop is unchanged — the three separate controls remain.
**Rationale:** The division `<select>` is the primary context control on this page; on a ~380px screen it was getting only `viewport − (3 buttons)` ≈ 180px and truncating long division names. Add Game (the top CTA) already lives in the header, so Publish/Auto/Export are all secondary on mobile and don't each need a visible button — a single overflow menu is the correct mobile pattern. Kept distinct from the existing view-settings bottom sheet (Stage/Grouping/Venue/Status), which is for passive view config; actions and view-settings stay separate surfaces. Establishes: when a dense admin toolbar's action cluster crowds the primary control on mobile, collapse the actions into one labelled Tools menu rather than shrinking the primary control.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`MobileToolsMenu`), `schedule-admin.module.css` (`.scheduleMobileTools`, `.scheduleEndGroup`/`.scheduleSearch` ≤760px).

---

### 2026-06-01 — Public schedule scores: color-coded W/L/T, no trophy (match admin results)

**Decision:** The public schedule's scored-game rows drop the trophy icon and loser-dimming in favour of the admin results color model. Each score is flanked by a **W/L/T letter**, and both the letter and score are coloured by outcome: **win `var(--success)`**, **tie `var(--warning)`**, **loss `rgba(var(--danger-rgb), 0.65)`** (muted red). Team names stay neutral white (no dim, no trophy). Layout: `[W/L/T] [homeScore] – [awayScore] [W/L/T]` inside the existing centered score chip, with the FINAL/Pending badge above. New `.outcomeLetter` class (`font-data`, 900, 0.82rem); colours applied inline per game. The old `.winTeam/.loseTeam/.scoreWin/.winIcon` classes are now unused (left in CSS, harmless).
**Rationale:** User asked the public results to read like the admin results page (`GameList` scoring rows), which uses exactly these semantic colours + W/L/T letters. Color-coding communicates outcome faster than a trophy and is consistent across admin + public.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard` scored branch), `app/[orgSlug]/schedule/schedule.module.css` (`.outcomeLetter`). Mirrors `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` scoring rows. Standings' 1st-place trophy is a leader indicator (different semantic) and was left unchanged.

---

### 2026-06-01 — Public schedule: tightened card rows (density), not a list

**Decision:** The public schedule keeps its **card-row** layout but is compacted — a stacked/striped "list" was explicitly rejected. Rationale: public pages are consumer surfaces (parents/coaches) and must stay on the card visual language used across the rest of the public site; a dense list reads as an admin tool, its density win is mostly desktop-only (mobile columns collapse anyway), and it would force rework of the score chip / "My Team" highlight / winner + cancelled treatments. Compaction in `schedule.module.css`: `.gameRow` padding `0.625rem 1.25rem → 0.45rem 1rem`, gap `1.5rem → 1rem`; `.gamesList` gap `0.75rem → 0.5rem`; `.dateGroup` margin-bottom `1.75rem → 1.25rem`; `.dateLabel` margin/padding `1rem/0.5rem → 0.65rem/0.4rem`; and the key fix — **`.teams` is capped to `max-width: 520px; margin: 0 auto`** so the matchup groups in the center instead of spreading to the row's far edges (the wide dead zone on desktop). Net ≈2× games per screen. Search (team/coach) + Follow My Team remain the per-user scroll reducers; the team search only renders when a division is published with real names (generic/"placeholder" mode has nothing to filter).
**Rationale:** Solves the "rows too big / too much scrolling" complaint while preserving consumer brand feel, touch ergonomics, and existing badge/score/highlight styling at low regression risk.
**Applies to:** `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow`, `.gamesList`, `.teams`, `.dateGroup`, `.dateLabel`). Any future public schedule density work stays card-based, not list-based.

---

### 2026-06-01 — Schedule Unpublish: split-button with "All published (N)" bulk option
**Decision:** The toolbar Unpublish control is now a split button (`UnpublishControl`, local to `schedule/page.tsx`, mirroring the `ScheduleToolsMenu` dropdown pattern). When exactly **one** division is live it stays a plain `Unpublish` button (direct action, unchanged). When **2+** divisions are live it becomes `Unpublish ▾`, opening a menu with **"This division"** (current division name as sub-label) and **"All published (N)"**. Bulk unpublish (`handleUnpublishAll`) loops the existing per-division `set-visibility` API (no new endpoint) and confirms via `FeedbackModal` with an `items` list of the affected division names. The page's `feedback` state type gained an `items?` field to support that list.
**Rationale:** Publishing is already a bulk operation (the Publish modal multi-selects divisions), but Unpublish was single-division only — an asymmetry that forced N round-trips to pull a multi-division tournament off the public page. Unpublish has no options (no name-mode/notify) and is reversible, so a full multi-select modal would be overkill; the split button adds the bulk path exactly where the per-division action already lives and self-hides when only one division is live (≤1 published → no dropdown). Establishes: paired publish/unpublish actions should have symmetric bulk capability; a split-button menu is the chosen pattern for "this one vs all" on a toolbar action.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`UnpublishControl`, `handleUnpublishAll`, `feedback` state).

---

### 2026-06-01 — Public tournament pages: mobile remediation direction (from deep design review)

Four owner-confirmed decisions from the public-pages design evaluation. These govern the remediation work; see `docs/projects/active/PUBLIC_TOURNAMENT_MOBILE_POLISH_PLAN.md`.

1. **Home page is state-dependent.** Before the event (`status !== 'active'`) the home page may keep a hero/landing treatment; once the tournament is **live/active** it must lead with data (today's / next games) and the oversized `display-xl` + `min-height: 100vh` hero must collapse on mobile. The marketing hero is a pre-event affordance, not a game-day one. Aligns the home page with the 2026-06-01 sub-page header-compaction decision (which called `display-lg`/hero sizing "inappropriate for operational lookup pages").
2. **Standings stays a TABLE on mobile — no card layout.** Cards were tried and abandoned in past sessions for consuming too much vertical space on mobile; this is now binding for standings. The mobile fix: retain `<table>`, add a compact `≤640px` breakpoint (reduced cell padding/font), keep the **Team column frozen left**, and **freeze the PTS column right** (two sticky anchors) so the two numbers that matter — team and points — are always visible while W/L/T/RF/RA/RD scroll between them. Do NOT replace the table with stacked cards.
3. **Schedule auto-scrolls to "today" on load** (all users, not only followed-team users), so the core game-day job is a glance, not scroll-and-hunt. The existing `.todayGroup` highlight stays.
4. **Enforce a contrast floor on custom org accents.** Rather than expecting Tournament Plus customers to understand WCAG ratios, the platform guards accent luminance so a poorly-chosen custom `--primary` / `--primary-light` can't render as low-contrast (brand-damaging) text on light or dark surfaces. Implemented in the theming layer (`lib/themes.ts` / light-mode token overrides), not left to the customer.

**Applies to:** `components/public/{TournamentHomeContent,StandingsContent,ScheduleContent}.tsx`, `app/[orgSlug]/{Home,standings,schedule}/*.module.css`, `app/globals.css` (`.empty-state` contrast), `lib/themes.ts`, `app/[orgSlug]/[tournamentSlug]/layout.tsx` (light-mode vars).

---

### 2026-06-01 — Schedule publish status: moved to header, renamed "Live · Generic" → "Published · Placeholder"
**Decision:** The per-division publish-status pill (`.publishStatus`) was removed from the schedule toolbar's Row 1 action group and moved into the page header `actions`, positioned **left of the Add Game button**. The toolbar retains only the Publish/Unpublish *button* (the action); the read-only status no longer sits among the view/action controls. Wording changed from `Live · Teams` / `Live · Generic` to **`Published · Teams`** / **`Published · Placeholder`**: (1) "Placeholder" matches the publish modal's own "Placeholder names" radio option, eliminating the unexplained "Generic" term; (2) "Published" (not "Live") avoids semantic collision with the sidebar's tournament-level `● LIVE` activation dot, which means a different thing. The pill stays `display:none` below the mobile breakpoint as before.

**Unpublished state added (same session):** The header now also reports the unpublished state with a muted neutral pill — **`Not Published`** (EyeOff icon, `.publishStatusDraft`: `--border-2` border, `--white-5` bg, `--data-gray` text). Lime stays reserved for the live "Published" states; the resting/default state must read quiet, not as an alert. The pill is suppressed when no single division is selected (`filterGroup === ''` / "All Divisions") since there's no single publish state to report. Net model: header always names the selected division's state (Not Published / Published · Placeholder / Published · Teams); toolbar carries only the matching action (Publish / Unpublish).
**Rationale:** A read-only status rendered in lime (`--logic-lime`, the reserved CTA colour) inside a row of clickable controls inverted the visual hierarchy and pulled the eye to a non-actionable element. Status belongs in the header (orientation layer); actions belong in the toolbar. "Generic" was undocumented anywhere else in the UI and confused the user. Establishes: status displays move to the header; only actions live in the toolbar; status wording must match the dialog that produces the state.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`TournamentAdminHeader` actions + Row 1 publish group).

---

### 2026-06-01 — Schedule segmented toggles: solid primary fill replaces blue→lime gradient

**Decision:** The `.segmentActive` state (Pool Play/Playoffs, List/Bracket) no longer uses `linear-gradient(135deg, var(--primary), var(--primary-light))` + `var(--glow-sm)` + `var(--bg)` text. It now matches the established public-page `[data-color-mode] .btn-primary` convention: **solid `var(--primary)` fill, `#FFFFFF` text, tight `box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.35)`**. Supporting changes in `schedule.module.css`: container `.segmentedControl` bg `--white-10` → `--white-5` + `1px solid var(--border-2)` for a defined edge; inactive `.segmentButton` text `--white-60` → `--white-70` with a new `:hover` (`--white` text + `--white-5` bg); removed the obsolete mobile `box-shadow: none` override.
**Rationale:** The diagonal blue→lime gradient read as muddy/faded (user-reported), and gradients on functional controls violate the design principle "gradients on functional UI elements (decorative use only; never on buttons or form inputs)." `#FFFFFF` literal is intentional — the `--white` token flips to near-black in light color mode, but the active button always sits on the saturated org primary, mirroring the existing `[data-color-mode] .btn-primary` rule.
**Applies to:** `app/[orgSlug]/schedule/schedule.module.css` — and any future public segmented control should follow the same solid-primary pattern, not a gradient.

---

### 2026-06-01 — Public tournament pages: compact header + tightened section rhythm

**Decision:** Reduced the oversized hero-style header on all public tournament pages and centralized it.
1. **New global `.public-page-header` class** (`globals.css`) replaces the per-module `.pageHeader` block that was duplicated identically across 6 public modules. Spec: `padding: 1.25rem 0` (was `2rem 0 2.5rem`); `h1 { font-size: clamp(1.5rem, 3.5vw, 2.25rem); line-height: 1.15; margin: 0.25rem 0 }` (was `display-lg` = `clamp(2.25rem, 6vw, 4rem)`, up to 64px); `p { color: var(--white-60); max-width: 640px }`. The `display-lg` class was removed from every public page `<h1>`.
2. **Duplicated `.pageHeader` blocks deleted** from `schedule/standings/teams/rules/news/register` modules. Components/pages switched from `styles.pageHeader` → literal `className="public-page-header"`: `ScheduleContent`, `StandingsContent`, `TeamsContent`, `[tournamentSlug]/teams/[id]/page.tsx`, `rules/page.tsx`, `news/page.tsx`, `register/page.tsx`.
3. **Register header folded into the neutral global** — previously had a distinct primary-tinted gradient (`rgba(--primary-rgb,0.12)`) and larger `4rem 0 3rem` padding; now consistent with all other public pages.
4. **Global `.section` padding tightened**: desktop `2rem 0 4rem` → `1.5rem 0 3rem`; mobile (≤768px) `3rem 0` → `1.25rem 0 2.5rem` (mobile top padding was previously *larger* than desktop — backwards).
5. **Schedule segmented controls** (`schedule.module.css`): `.segmentButton` min-height `40px → 34px` (desktop), `44px → 40px` (≤640px); padding `0.45rem 0.85rem → 0.4rem 0.8rem`; `.calendarButton` min-height `40 → 34`. `.segmentActive` `box-shadow` dropped at ≤640px.
6. **Schedule spacing**: `.dateGroup` margin-bottom `2.5rem → 1.75rem`; unpublished/empty-state inline padding `4rem 0` / `3rem 0` → `2.5rem 0`.

**Rationale:** `display-lg` is a marketing-hero size inappropriate for operational lookup pages (review heuristic: "avoid oversized hero-style treatments inside operational tools"). Combined with double-stacked header+section padding, ~130–150px was wasted above the fold on desktop, and two full-width glowing filter buttons dominated mobile. Centralizing the header also removes the 6-way duplication and prevents future drift. Root-level legacy single-tenant pages (`app/schedule`, `app/teams`, etc.) import their own co-located modules and were intentionally left untouched.
**Applies to:** `globals.css`; all `app/[orgSlug]/{schedule,standings,teams,rules,news,register}/*.module.css`; `components/public/{Schedule,Standings,Teams}Content.tsx`; `app/[orgSlug]/[tournamentSlug]/{rules,news,register,teams/[id]}/page.tsx`.

---

### 2026-05-30 — Teams page: compact dropdown filter menus in Row 2 (desktop); mobile keeps bottom sheet

**Decision:** Desktop Row 2 uses two compact dropdown buttons matching the Schedule page's `VenueFilterMenu` pattern: (1) **Status** button ("All statuses" / active status label / "N statuses") opens a checkmark panel with Pending/Accepted/Waitlist/Rejected + counts; default is P+A+W so button shows "All statuses" in that state. (2) **Payment** button ("All payments" / label / "N payments") opens a panel with Unpaid/Deposit paid/Paid in full/Past due + counts; only shown when `paymentToolsAvailable`. Panel header shows "Reset" when non-default. Active state (lime) fires when filter deviates from default. Component is `RegistrationFilterMenu` at bottom of `page.tsx`; styles are `regFilter*` classes in `teams-admin.module.css`. Both buttons live in `.desktopFilterChips` (hidden ≤640px). Mobile is unchanged — bottom sheet handles all filters.
**Rationale:** Compact buttons match the venue filter aesthetic — one button per filter type, no chip sprawl. The panel checkmark model is more explicit about multi-select state than chips, especially for the status filter where the default is 3-of-4 selected. Mirrors an established pattern already in the codebase.
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx`, `registrations/teams-admin.module.css`.

---

### 2026-05-29 — Teams page: attention panel and drawer removed
**Decision:** The "Needs Attention" banner strip and its associated bottom-sheet drawer have been removed from the Teams/Registrations admin page. The dashboard-level registration metrics (unpaid counts, waitlist counts by division) are the correct and sufficient surface for this aggregate view. The filter chips and payment filter on the Teams page give admins everything they need once they are in operational mode.
**Rationale:** The banner was redundant — the page is already filtered by division, every team's status is visible inline, and the filter chips serve the same "show me problem teams" function the drawer was trying to provide. Aggregate cross-division metrics belong on the dashboard, not embedded in an operational list page. Removing the drawer also eliminates a broken UX path (the drawer opened a "CHOOSE DIVISION" picker that duplicated the division filter already at the top of the page).
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx` — `attentionPanel`, `attentionDrawerOpen` state, and all associated computed values removed. URL param deep-linking from dashboard (`?attention=unpaid&division=...`) is preserved.

---

### 2026-05-29 — Table wrappers with tooltips: use overflow: visible, not overflow: hidden
**Decision:** Table wrapper divs (`.tableWrap` pattern) must use `overflow: visible` rather than `overflow: hidden`. `overflow: hidden` clips absolutely positioned tooltip balloons (`.tooltipPopover`) when they extend above the table header row, hiding the top portion of the popup. The tooltip's `z-index: 60` handles stacking over non-positioned `<th>` cells once clipping is removed. The `border-radius: 2px` wrapper border is unaffected visually at that small radius.
**Rationale:** First discovered on the org Members page: top-row role tooltips were clipped by `.tableWrap { overflow: hidden }`. The same pattern would affect any table wrapper that uses this convention.
**Applies to:** All `.tableWrap`-style wrappers globally — `app/[orgSlug]/admin/org/members/members.module.css` fixed; audit any other page using `overflow: hidden` on a table wrapper that also hosts `HelpTooltip`.

---

### 2026-05-27 — Tournament Notifications page: 6 fixes from design review
**Decision:** (1) `pageHeader margin-bottom` corrected to `1.25rem` (was `1.75rem`) — matches binding standard. (2) `.headerLeft align-items` corrected to `flex-start` (was `center`) — matches binding icon-box alignment decision. (3) `.channelItem cursor` corrected to `pointer` (was `default`) — `<label>` elements wrapping interactive toggles must use pointer cursor. (4) `.channelItemLabel font-size` reduced to `0.82rem` (was `0.85rem`) — matches the data body range (0.72–0.82rem) used in all other admin shell data text. (5) `.muteCardActive .muteSub` gets `color: var(--white-60)` — `--white-40` is low-contrast against the danger-tinted surface in the active/muted state. (6) `.muteCard background` changed from `var(--surface)` to `rgba(255,255,255,0.02)` — matches the channelCard background for surface parity between the two adjacent cards.
**Rationale:** Fixes 1–2 enforce the binding page-header standard from the 2026-05-25 dashboard audit. Fix 3 is a basic interactive affordance. Fix 4 enforces data density. Fix 5 is a contrast improvement in an important destructive-state indicator. Fix 6 removes a surface token inconsistency between neighbouring cards.
**Applies to:** `app/[orgSlug]/admin/tournaments/settings/notifications/notifications.module.css`.

---

### 2026-05-26 — Public Site (Branding) page: accordion, locked-card redesign, renames, button fixes

**Decision:** (1) **Rename** — sidebar nav item `Branding` → `Public Site`; page h1 → `Public Site`. The old name was too generic and didn't communicate that this controls the public-facing tournament website. (2) **Locked cards — compact row pattern** — when a feature requires Tournament Plus, the card renders only its title row + LOCKED badge + a one-line description of the feature (`.lockedHint`). No disabled form controls, no disabled swatches, no disabled grids. The `.lockedHint` is hidden on mobile (≤600px) since the consolidated upsell block covers it. (3) **Single consolidated upsell block** — one `CompactUpsell` component placed above all locked sections replaces the five individual per-card upgrade paragraphs. Free tier sees one CTA; not five. This uses the existing `CompactUpsell` component from `@/components/admin/tournament`. (4) **Mobile accordion** — on ≤600px, each section card collapses to its title row + chevron. Public Pages opens by default; all Advanced Branding sections start closed. On desktop (≥601px) all sections are always expanded. The `.accordionTrigger` button uses `pointer-events: none; cursor: default` on desktop so it behaves as a plain block wrapper. (5) **`TournamentAdminHeader`** replaces the hand-rolled header (48px icon, `margin-bottom: 2rem`, oversized title). Back link removed for consistency with Venues page migration. (6) **Background toggle active state** — `.modeToggleBtnActive` changed from `var(--primary)` navy to `var(--logic-lime)` + `#0f1123` text, matching all other segmented controls in the admin shell. (7) **Logo square** — `.logoPreview border-radius: 50%` → `2px`, matching the sharp-corner HUD aesthetic. Border changed from `2px solid var(--primary)` to `1px solid rgba(var(--primary-rgb), 0.35)`. (8) **Button fixes** — Save Changes: `btn-primary` → `btn btn-lime btn-data`; Upload/Remove buttons: `btn btn-outline btn-data` / `btn btn-ghost btn-data`. Mobile full-width override on `.modeToggle, .modeToggleBtn` removed.
**Rationale:** Locked disabled UI creates a bad free-tier experience by showing features the user can't touch — overwhelming and scroll-heavy. The compact locked row + single upsell block is calmer and more effective. Accordion addresses ~2400px mobile scroll. All button and token fixes enforce prior binding decisions.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/page.tsx`, `branding.module.css`, `components/admin/AdminSidebar.tsx`.

---

### 2026-05-26 — Mobile bottom nav More dropdown: every item belongs under a section header
**Decision:** No nav item in the More dropdown exists outside a section header (Operations / Setup / Admin). Even a single-item section retains its header. The structural rule is: items always live under a subheader.
**Rationale:** Retrofitting section labels when new items are added is avoidable friction. A consistent header-first structure keeps the dropdown scannable regardless of item count.
**Applies to:** `components/admin/AdminBottomNav.tsx` — More dropdown section structure.

---

### 2026-05-26 — Mobile bottom nav: full design system alignment + 5-tab layout
**Decision:** (1) **Color system** — all purple accent values (`#c084fc`, `rgba(139,47,201,...)`, `#1A1530`) replaced with design system tokens. Active tabs now use `var(--logic-lime)` + `rgba(var(--logic-lime-rgb), 0.12)` icon background + lime `activeDot` glow — matching the desktop sidebar active state exactly. Borders use `rgba(var(--blueprint-blue-rgb), ...)`. Nav bar background changed to `rgba(17,24,39,0.97)` (= `--hud-surface` at 97%, preserving `backdrop-filter` frosted-glass). Dropdown background changed to `var(--hud-surface)`. (2) **setLiveBtn** (inactive tournament CTA in dropdown) restyled from purple to lime ghost: `rgba(--logic-lime-rgb, 0.08)` background, `rgba(--logic-lime-rgb, 0.35)` border, `var(--logic-lime)` text. (3) **5-tab layout** — Dashboard added to `PRIMARY_KEYS` at position 0 (order: Dashboard → Registrations → Schedule → Results → More); removed from `OPERATIONS_MORE`. (4) **Preview Site** moved from `tournamentBlock` (prominent top position) to the dropdown footer — a muted `.dropUtilItem` link positioned between the last section divider and Logout, mirroring its placement in the desktop sidebar footer.
**Rationale:** The purple accent predated the multi-org platform pivot and was never part of the design system. Mobile and desktop admin now share a single active-state color. 5 tabs is the mobile nav convention; Dashboard is the tournament command center and earns a primary slot. Preview Site is a utility action, not a primary workflow step — footer placement matches its priority.
**Applies to:** `components/admin/AdminBottomNav.tsx`, `components/admin/AdminBottomNav.module.css`.

---

### 2026-05-26 — Results + Registrations: mobile toolbar standardized to Schedule model
**Decision:** Both pages now match the Schedule 5-row mobile stack: (1) Division, (2) Round Robin | Flat [native selects], (3) action buttons, (4) Search, (5) Status chips. Specifics: **Results** — new `results-admin.module.css` with `mobileModePair` + `desktopModeControl` pattern (same as Schedule); start group reordered to Division → RR|PO → Flat|Pools on desktop; `ToolbarMenu (Tools)` added containing "Open Scorekeeper View" (moved out of header, header now bare like Schedule); fullWidth row swapped to Search then chips; chip touch targets 34px. **Registrations** — fullWidth row DOM order swapped: `ToolbarSearch` before chips div (fixes both desktop and mobile ordering simultaneously since `flex-direction: column` on mobile means DOM order = display order); chip touch targets 28px → 34px; multi-select icon buttons 28px → 32px; Add Team icon button 28px → 32px.
**Rationale:** Consistent 5-row mobile order across all three pages reduces cognitive friction for admins switching between pages. Swapping DOM order is cleaner than CSS `order` hacks when flex-direction already controls stacking.
**Applies to:** `app/[orgSlug]/admin/tournaments/results/page.tsx`, `results/results-admin.module.css`, `registrations/page.tsx`, `registrations/teams-admin.module.css`. Commit `07b4e25`.

---

### 2026-05-26 — Schedule admin: mobile touch targets, division label, publish live state
**Decision:** (1) **Touch targets** — primary filter controls (mode selects, venue filter button) bumped from `28px` → `34px` height on mobile; secondary icon buttons (publish/export/tools, add game) bumped `28px` → `32px`. (2) **Division label** — `.scheduleDivisionSelect > span` color changed from `rgba(148,163,184,0.58)` to `var(--white-50)` — the faint slate tint was barely perceptible against the toolbar background; `--white-50` matches the `controlLabel` convention used elsewhere. (3) **Toolbar bottom margin** — `margin-bottom` bumped `1rem` → `1.25rem` on mobile to give breathing room between the 5-row toolbar and the game list below. (4) **Publish live state indicator** — `data-live="true"` attribute added to the publish button when `isPublished`; CSS rule `.publishButton[data-live]:disabled` overrides the gray disabled style to retain lime coloring (`rgba(--logic-lime-rgb, 0.35)` border, `0.07` background, `0.65` text), making the live state visible on mobile where the "Live · Teams" text badge is hidden.
**Rationale:** 28px touch targets are below comfortable thumb-tap size for an admin operating on mobile. The lime live-state indicator closes a visibility gap where admins had no way to confirm a schedule was published without checking the public page. Division label at `--white-50` matches established toolbar label standards.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx`. The `34px` filter control / `32px` icon button pattern should be adopted on other mobile admin toolbars (registrations, results) in future sessions.

---

### 2026-05-26 — Schedule admin: mobile toolbar row order (mobileModePair)
**Decision:** The two mobile mode selects (Round Robin/Playoffs and Flat/Pools or List/Bracket) are wrapped in a `div.mobileModePair` that is `display:none` on desktop and `display:flex; flex: 1 1 100%; order:1` on mobile. This gives them their own dedicated full-width row within `scheduleActionsGroup`, cleanly separating them from the venue filter and action buttons row below. Mobile toolbar now stacks: (1) Division, (2) Round Robin | Flat, (3) Venue | buttons, (4) Search, (5) Status filters.
**Rationale:** Previously the mode selects relied on flex `order` alone, causing inconsistent rendering — Round Robin sometimes appeared full-width instead of 50%/50% beside Flat. The wrapper is an unambiguous full-row boundary.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Select optgroup labels: white-50 on hud-surface
**Decision:** Native `<select>` `<optgroup>` group headers globally use `color: var(--white-50)`, `background: var(--hud-surface)`, `font-style: normal`, `font-weight: 700`. Applied via `globals.css` alongside the existing `select option` rule. Blueprint-blue was tried first but lacked contrast on the dark surface.
**Rationale:** Browser default optgroup rendering produces a light-gray background and italic gray text — near-invisible on the dark HUD surface. `--white-50` is legible as a dimmed label/header while being clearly distinct from selectable options (`--white`). `font-style: normal` overrides the browser-default italic.
**Applies to:** All `<optgroup>` elements globally (`app/globals.css`); most visible in schedule admin venue/slot selects.

---

### 2026-05-25 - Schedule admin: filter row alignment follow-up
**Decision:** Schedule admin filter controls were refined after desktop/mobile review: (1) Desktop Row 2 is `ToolbarSearch` -> venue filter -> right-aligned status chips, so empty space sits between venue and filters instead of after the filters. (2) Desktop shows the Division label and hides mobile mode selects with stronger CSS specificity, preventing duplicate segmented/select controls. (3) Mobile uses a labeled full-width Division row, schedule-local native mode dropdowns that bypass the shared `ToolbarSelect` mobile `width: 100%` rule so they can sit side by side, Venue stretching beside compact icon actions, then Search and status filters. (4) Planning rows always render the venue column on desktop; empty venue cells are hidden visually but still reserve column space, preventing matchup drift between rows with and without venues. Empty venue cells are fully hidden on mobile to avoid a blank third row.
**Rationale:** The filtering workflow should read as a single cluster, and game row columns must remain stable regardless of optional venue data.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Registrations: payment panel typography + toolbar layout
**Decision:** (1) **Payment input fields**: `border-radius: 6px → 2px` (HUD sharp corners), `background: var(--hud-surface) → var(--bg-2)` (matches textarea, avoids lighter-than-panel artifact on `rgba(0,0,0,0.2)` expanded row), `font-family: var(--font-data)` added (mono numbers), `font-size: 0.88rem → 0.82rem` (standard data body size), `:focus { border-color: var(--blueprint-blue); outline: none }` added (matches textarea). (2) **Payment field labels** (`.paymentField span`): `font-family: var(--font-data)` added — without this they fell back to sans-serif despite uppercase/tight-letter-spacing treatment. (3) **"Deposit due" line** (`.paymentDue`): `font-family: var(--font-data)` added, `font-size: 0.8rem → 0.72rem` (tighter data density). (4) **FLAT|POOLS segmented control moved to context group**: Was in `align="end"` group alongside EXPORT/SELECT MANY/TOOLS. Moved to `grow` context group alongside DIVISION select. View mode is context, not utility — grouping it with Division closes the large dead-space gap on desktop between the single Division select and the action cluster. (5) **Filter row search right-aligned**: Added `justify-content: space-between` to `.registrationFilterGroup` so status filter chips stay left and search sits at the far right edge.
**Rationale:** Input background using `var(--hud-surface)` (solid `#111827`) against an `rgba(0,0,0,0.2)` transparent expanded row panel produced a visually lighter floating box. `var(--bg-2)` (`#0F172A`) gives a consistent dark inset feel matching the textarea. Toolbar Row 1 had a single Division select stretching a `flex: 1` grow group, creating a wide empty middle zone on desktop. Moving FLAT|POOLS to the left group mirrors the schedule page layout standard where all context selectors live left, all utility actions live right.
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css` (`.paymentField span`, `.paymentField input`, `.paymentField input:focus`, `.paymentDue`, `.registrationFilterGroup`); `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (toolbar group restructure).

---

### 2026-05-25 — Tournament Venues: Export in header (exception), inline edit, Navigation icon for Maps
**Decision:** (1) **Export back in header** — for setup pages with no filter controls (Venues), Export lives in the header alongside Add Venue as a secondary ghost button. The "Export in toolbar" rule applies to operational pages (Registrations, Schedule) where export is filter-state-aware. No filters = no toolbar needed. (2) **Inline edit** — clicking the pencil icon on a venue card switches the card header to an inline edit form (Name, Address, Notes), auto-expanding to show the facilities panel simultaneously. Modal edit is removed for this surface; `AddVenueModal` is now Add-only. (3) **`Navigation` icon for Maps button** — replaces `ExternalLink`. The navigation arrow communicates "get directions / open in Maps" far more clearly than a generic new-tab icon. (4) **`venueCard.editing` border** — lime border (`rgba(--logic-lime-rgb, 0.35)`) on cards in edit mode; consistent with the lime active-state pattern used on segmented controls and active chips. (5) **`btn-primary` in `AddVenueModal` fixed** — replaced with `btn-lime btn-data` per the global ban on btn-primary outside modals (and then the broader btn-primary ban).
**Rationale:** Removing the toolbar eliminates a full row of vertical dead space. Inline edit reduces modal proliferation and follows the schedule game row editing pattern already established. Navigation icon is universally understood as maps/directions. Editing border gives clear feedback without disrupting surrounding UI.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `venues-admin.module.css`, `components/admin/AddVenueModal.tsx`.

---

### 2026-05-25 — Setup section pages: Export exception to toolbar rule
**Decision:** Setup-section admin pages (Venues, Branding, Event Settings etc.) that have no filter controls may place ExportMenu in the `TournamentAdminHeader` actions alongside the primary CTA. The "Export belongs in toolbar" rule only applies when there is at least one filter control (division select, status chips, search) that makes the export filter-state-aware. A toolbar solely to hold Export creates a full row of dead space and is not justified.
**Rationale:** The original toolbar-placement rule was written for Registrations and Schedule. Those pages have 3–7 filter controls; Export contextualises with them. A setup page with no filters has no filter context to preserve — the toolbar row is pure waste.
**Applies to:** All setup-section admin pages globally.

---

### 2026-05-25 — Tournament Venues page: migrated to TournamentAdminHeader + toolbar; venue list max-width 860px
**Decision:** (1) The tournament venues page (`app/[orgSlug]/admin/tournaments/venues/page.tsx`) was migrated from a hand-rolled custom header (`styles.pageHeader` / `styles.headerLeft`) to the shared `TournamentAdminHeader` + `TournamentAdminToolbar` components, matching Registrations and Schedule. (2) **Export and "Import from Library" moved to toolbar** (`ToolbarGroup align="end"`) — these are utility actions, not primary CTAs. (3) **"Add Venue" remains the sole lime CTA in the header** — one primary action only. (4) `.venueList { max-width: 860px }` — venues is a setup/config page with few items; the full-width list felt sprawling on wide monitors. This is an inner content constraint (not the `.page` wrapper), consistent with how branding.module.css constrains `.settingsContent`. (5) `venueCard border-radius: 8px → 4px` — sharpened toward HUD aesthetic. (6) `facilityEmptyNote` italic removed; `font-family: var(--font-data)` added. (7) `ImportFromLibraryModal` inline styles extracted to CSS classes (`.libraryNote`, `.libraryVenueList`, `.libraryVenueItem`, `.libraryVenueItemSelected`, `.libraryVenueName`, `.libraryVenueAddress`, `.libraryVenueFacilities`, `.libraryEmpty`) in `venues-admin.module.css`.
**Rationale:** Header standardisation makes venues visually consistent with all other admin pages. The smaller `TournamentAdminHeader` (30px icon, 1.05rem lime monospace title, 0.5rem bottom margin vs the old 48px/1.25rem/1.25rem) directly addresses the "too big" space complaint. The `max-width: 860px` on the venue list follows the Event Settings pattern — setup-section pages with few items benefit from a contained width. The toolbar placement rule for Export is established and was violated.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `app/[orgSlug]/admin/org/venues/venues-admin.module.css`. Note: the org venues page (`app/[orgSlug]/admin/org/venues/page.tsx`) still uses the old header classes (they remain in the CSS for backward compat) and is a candidate for the same migration in a future session.

---

### 2026-05-25 — btn-primary is banned from modals; modal confirm uses btn-lime
**Decision:** `btn-primary` (navy gradient) is **banned everywhere** — including inside `.modal` wrappers. The earlier rule permitting it in modals is superseded. Modal confirm/destructive actions use `btn-lime btn-data` (positive/neutral confirms) or `btn-danger btn-data` (destructive confirms). Cancel/close actions use `btn-ghost btn-data`. The navy gradient is invisible on `--hud-surface` dark backgrounds and has no place in the platform's visual language.
**Rationale:** The Activate Tournament confirmation modal made this explicit — `btn-primary` rendered as a near-invisible dark button on the dark modal background. `btn-lime` is the platform's single confirm action colour across all contexts.
**Applies to:** All `.modal` wrappers globally. Supersedes all prior `btn-primary` modal permissions. Audit: grep for `btn-primary` anywhere in the codebase and replace.

---

### 2026-05-25 — Dashboard: ACTIVATE button intentionally compact
**Decision:** The `.activateChip` button on the draft dashboard retains its original compact size (`padding: 0.35rem 0.7rem`) on all viewports including mobile. A 44px min-height override was tried and reverted — the larger size dominated the checklist header and felt visually out of proportion.
**Rationale:** The button sits inline with the "Draft Launch Checklist" heading; a full-height touch target there over-weights a secondary action. The checklist item cards are the primary interaction surface.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — `.activateChip`

---

### 2026-05-25 — Modal buttons use btn-data; FeedbackModal fully audited
**Decision:** All buttons inside `.modal` wrappers use `btn-data` as the size modifier — this overrides the earlier rule that said modal footer buttons use "default size." Confirmed preference after seeing both rendered. Specifically in `FeedbackModal.tsx`: (1) × close → `btn-ghost btn-data`, X icon reduced 16px → 14px. (2) Close/Cancel footer → `btn-ghost btn-data`. (3) Confirm footer → `btn-${type} btn-data`. (4) Header icon reduced 24px → 16px to match the 0.75rem h3 title. (5) Message body div set to `font-data 0.82rem --white-70 line-height:1.55` — message text was a bare string in a div, not a `<p>`, so the `.modal p` global rule didn't reach it. (6) Items list `borderRadius: 8` → `0` (sharp corners).
**Rationale:** Default-size `.btn` is proportioned for standalone CTAs and page-level actions. Inside a compact HUD modal, `btn-data` keeps buttons consistent with the operational density of the admin shell. The size contrast between the small monospace title and a large default button was jarring.
**Applies to:** `components/FeedbackModal.tsx` and all future modal implementations globally — `btn-data` is the standard size for all buttons inside `.modal` wrappers.

---

### 2026-05-25 — Global modal: full HUD rebrand
**Decision:** The global `.modal`, `.modal-header`, `.modal-header h3`, `.modal p`, and `.modal-footer` rules in `globals.css` were updated to match the admin shell HUD aesthetic: (1) `border-radius: var(--radius-lg)` (20px) → `border-radius: 0` — sharp corners are mandatory everywhere in the admin shell. (2) `background: var(--bg-2)` → `background: var(--hud-surface)` — canonical dark admin surface. (3) `border: var(--border)` → `border: 1px solid rgba(var(--blueprint-blue-rgb), 0.4)` — standard admin blueprint-blue border. (4) `box-shadow` changed to use `var(--glow-blue)` instead of `var(--glow-sm)` — blue glow is the admin shell standard. (5) `padding: 2rem` → `1.5rem` — tighter for data-dense context. (6) `.modal-header` gains `border-bottom: 1px solid rgba(var(--blueprint-blue-rgb), 0.25)` and `padding-bottom: 0.75rem`; `margin-bottom: 1.5rem` → `1rem`. (7) `.modal-header h3` changed from `font-display sans-serif 1.5rem 800` to `font-data monospace 0.75rem 700 uppercase letter-spacing:0.1em color:var(--fl-text)`. (8) `.modal p` baseline added: `font-data 0.82rem var(--white-70) line-height:1.55` — prevents body text defaulting to browser sans-serif. (9) `.modal-footer` `border-top` updated to `rgba(var(--blueprint-blue-rgb), 0.25)` matching header separator; margin/padding tightened.
**Rationale:** The pre-existing modal styles used design tokens from a generic light-mode component library (`--radius-lg`, `--bg-2`, `--border`, `--font-display`). Every one of these violated established HUD conventions. The fix is global and applies to all `.modal` usage platform-wide.
**Applies to:** `app/globals.css` — all `.modal` usages globally, including admin shell, platform-admin, and coaches portal.

---

### 2026-05-25 — Dashboard: full design system audit applied (Draft state)
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` and `dashboard.module.css` (Draft state review): (1) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (2) `h1` reduced from `text-2xl` (1.5rem) → `text-xl` (1.25rem) — page title binding standard. (3) Header `mb-8` (2rem) → `mb-5` (1.25rem) — page header margin-bottom binding standard. (4) Status badge `hidden md:block` wrapper removed — status chip now always visible on all screen sizes; mobile admin operating mode requires status visibility. (5) `.activateChip` hardcoded `color: #ccff66` and `::before background: #ccff66` replaced with `var(--logic-lime)` — no raw hex values for platform brand tokens. (6) Activate confirmation modal converted from `.card` to `.modal` + `.modal-header` + `.modal-footer` — `btn-primary` is only valid inside a `.modal` wrapper. (7) All `btn-sm` removed from both modals: modal ×-close buttons → `btn-ghost btn-data`; modal footer confirm/cancel buttons → default size (no modifier). (8) Dead CSS block (`.setupLinks`, `.setupLink`, `.setupLinkIcon`, `.setupLinkBody`, ~55 lines) deleted — these classes were never referenced in JSX. (9) Optional items accordion toggle inline styles (~12 properties) extracted to `.optionalToggle` CSS class.
**Rationale:** All rules enforce existing binding decisions. The modal `.card` → `.modal` fix is particularly important as `btn-primary` inside `.card` is non-compliant with the btn-primary isolation rule.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css`.

---

### 2026-05-25 — Venues admin: full design system audit applied
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/org/diamonds/` (the shared Venues page used by both the org-level and tournament-level venues routes): (1) `btn-primary btn-sm` on Add Venue → `btn btn-lime btn-data`. (2) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (3) `.pageTitle` font-size reduced `1.75rem` → `1.25rem`. (4) `.pageHeader` margin-bottom reduced `2rem` → `1.25rem`. (5) `.headerLeft` align-items changed `center` → `flex-start` (icon top-aligns with title). (6) `flex-shrink: 0` added to `.headerIcon` to prevent shrinkage. (7) All row action buttons (`Maps` link, Edit pencil, Delete trash) changed from `btn-sm` → `btn-data`. (8) Delete modal close `×` changed from `btn-ghost btn-sm` → `btn-ghost btn-data`. (9) Passive table-row empty state replaced with `.empty-state` block (MapPin icon, "No venues added yet" title, description, `btn btn-lime` CTA) rendered outside the table conditionally. (10) Inline `style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}` on address/notes cells extracted to `.cellMuted` CSS class. (11) Removed now-unused `.emptyTableCell` mobile override rules from the CSS. Added `.cellMuted` and `.emptyCta` classes.
**Rationale:** Every rule above was a binding decision from prior sessions applied consistently to a page that predated those decisions.
**Applies to:** `app/[orgSlug]/admin/org/diamonds/page.tsx`, `app/[orgSlug]/admin/org/diamonds/diamonds-admin.module.css` (also affects `app/[orgSlug]/admin/tournaments/venues/page.tsx` which re-exports this page).

---

### 2026-05-25 — Schedule admin: toolbar restructure matches registrations pattern
**Decision:** Schedule admin toolbar rebuilt to exactly match the registrations layout template: (1) **Add Game button** in `TournamentAdminHeader` with `mobileActionsInline` — keeps button top-right on mobile, same as Add Team in registrations. (2) **Toolbar Row 1** split into `ToolbarGroup grow` (Round Robin/Playoffs segmented + Division select + Flat/Pools or List/Bracket segmented) and `ToolbarGroup align="end"` (Publish control + ExportMenu + Tools menu). All utility buttons in the same end group. (3) Publish control: unpublished state shows a ghost `Globe` icon button (`btn-ghost btn-data`) labeled "Publish" (mobileIconButton collapse); published state shows a compact lime badge ("Live · Teams" or "Live · Generic") + Update + Unpublish (`btn-ghost btn-data`). The badge uses `0.62rem` text and `Live ·` prefix for compactness. (4) **Toolbar Row 2** is a `ToolbarGroup fullWidth` with status filter chips (`s.statusFilters + styles.scheduleStatusFilters`) + ToolbarSearch on the same row. On mobile the fullWidth group stacks below Row 1.
**Rationale:** The previous structure put five independent control groups in the start group (segmented × 2, division select, publish status, publish action), causing overflow and inconsistency. The registrations pattern (grow context group + end utility group + fullWidth filter row) is the established admin shell standard.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Schedule admin: mobile row density, status filters, and button audit
**Decision:** (1) **Venue column hide breakpoint** raised from `680px` to `768px` in `admin-common.module.css` — frees the venue column space (≈120px) at all standard mobile viewports; location is still accessible in the expanded inline panel. (2) **Game-row mobile override** (`.gameRowMain`) added to `schedule-admin.module.css` — overrides admin-common's `@768px` rule that wraps rows and pads `1rem`; game rows now stay single-line with `0.35rem 0.75rem` padding and `min-height: 40px`. Applied to both planning-mode and scoring-mode rows in `GameList.tsx`. (3) **Desktop badge / mobile compact marker** — planning-mode status area replaced with `.planningStatusCell` class (96px desktop → auto on mobile); full badge text wrapped in `.desktopStatusBadge` (hidden on mobile); a `.gameStatusMarker` 18px square initial (`✓` for Final, `✕` for Cancelled) shown on mobile via `data-status` variants matching the registrations `mobileStatusMarker` pattern. (4) **Game status filter chips** — four chips (All / Scheduled / Cancelled / Final) with colour-coded `::before` dots added to the second toolbar row alongside search; chips use the existing `.filterChip` / `.chipActive` admin-common class system with four new variants (`chip_all`, `chip_scheduled`, `chip_cancelled`, `chip_completed`). `filterStatus` state added to `ScheduleAdminPage`; `divisionGames` + `statusCounts` computed for chip counts; filter resets on division or view-mode change. Clicking an active non-all chip toggles it back to "All". (5) **Add Game icon-only on mobile** — `.addGameButton` + `.addGameLabel` classes collapse the header CTA to `32×28px` icon-only below 760px, matching the registrations `addTeamButton` pattern. (6) **Inline form footer btn-sm purge** — all `btn-ghost btn-sm`, `btn-danger btn-sm`, and `btn-lime btn-data btn-sm` in `GameList.tsx` inline form footer replaced with `btn-data` variants; inline `fontSize: '0.72rem'` overrides removed. (7) **Publish toolbar btn-sm purge** — two `btn-ghost btn-sm` buttons (Update / Unpublish) replaced with `btn-ghost btn-data`; inline height/font overrides removed.
**Rationale:** Porting the registrations mobile pattern to schedule: compact rows, status markers, and filter chips are now consistent across both admin list pages. btn-sm is banned in the admin shell; btn-data is the uniform size standard.
**Applies to:** `admin-common.module.css` (breakpoint + chip variants), `schedule-admin.module.css` (all new classes), `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`.

---

### 2026-05-25 — Event Settings page: layout, spacing, and button audit
**Decision:** (1) `.page` max-width removed — the branding.module.css shared by Event Settings and the Branding admin page had `max-width: 720px` which caused large wasted whitespace on the right. Removed entirely per the global "no page-level max-width in admin" rule. (2) `pageTitle` font-size reduced from `1.75rem` to `1.25rem` — the large monospace heading was an oversized hero-style treatment inconsistent with operational admin pages. (3) `.pageHeader` and `.settingsTitleRow` margin-bottom both reduced from `2rem` to `1.25rem` — stacked 2rem margins created 4rem of vertical dead space before the first content card. (4) `btn-primary` on the Save Changes footer button replaced with `btn-lime btn-data` — `btn-primary` is banned outside `.modal` wrappers. (5) `btn-outline btn-sm` on the upsell "Review Tournament Plus" link replaced with `btn-outline btn-data` — `btn-sm` is not the admin shell size standard. (6) `.segmentButtonActive` background changed from `var(--blueprint-blue)` to `var(--logic-lime)` with `color: #0f1123` — logic-lime is the platform's interactive accent; blueprint-blue active state was inconsistent with the layout-toggle pattern already using lime.
**Rationale:** Rules 1–5 enforce existing binding decisions. Rule 6 consolidates segmented control active-state to the single correct accent color across all admin components.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/branding.module.css` (shared by Branding + Event Settings pages), `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`; segmented control lime active state applies globally to any component using this pattern.

---

### 2026-05-25 — Rules/Resources public page layout toggles
**Decision:** Rules and Resources sections on the public rules page each have an independent admin-controlled layout: Rules = `'columns'` (2-col grid, default) | `'single'` (full-width); Resources = `'list'` (stacked, default) | `'grid'` (2-col). Stored in `tournaments.settings` JSONB. Defaults preserve current behaviour for all existing tournaments. Toggle UI in each `section-header` uses two adjacent `icon-btn` buttons in a `.layout-toggle` pill; active state uses `--logic-lime`/`rgba(--logic-lime-rgb, 0.08)` background. Both layout variants collapse to 1 column at ≤768px on the public page.
**Rationale:** Two-col rule cards look good for 2–4 short sections but squish at 6+. A full-width option serves content-heavy orgs. Resources grid aids scanability for 4+ links. Separate control per section because content volume differs. JSONB settings avoids column sprawl for future small preferences.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`, `app/[orgSlug]/rules/rules.module.css`; `tournaments.settings` JSONB for future per-tournament prefs.

---

### 2026-05-24 — Public pricing page: eyebrow + label colour, featured segment card, section order
**Decision:** (1) All eyebrow labels, table category headers, and "from→to" bridge labels on public pages use `var(--logic-lime)`, not `var(--blueprint-blue)`. Blueprint blue on a near-black surface fails contrast and reads as dark-blue-on-dark — lime is the correct readable accent. (2) The `segmentCardFeatured` lime highlight was removed from the Coach/Team Manager segment card. Featured styling is reserved for plans that can be purchased; coming-soon products get neutral (muted opacity) treatment. If any segment card needs a highlight in future, it must be the top-revenue live plan (Tournament Plus). (3) Page section order: Hero → Segment picker → **Org plans** (moved up) → Coaches Portal callout → Compare table → Upgrade bridges → Coming soon → FAQ → CTA. The live plan cards must appear before any coming-soon product sections. (4) Coaches Portal feature list condensed from 7 bullets to 3 high-level pillars to reduce text volume. (5) Comparison table converted to a client component (`ComparisonTable.tsx`) with per-category accordion collapse; only the first 2 categories (Tournaments & Scheduling, Registration Operations) are open by default. (6) Page background remains `--pitch-black` (#0A0A0A) for public/marketing pages; `--hud-surface` (#111827) is the admin shell surface and should not be used as the base background for public pages.
**Rationale:** Contrast failure on eyebrows was a direct readability issue across all sections. The featured card misdirected visitors toward a product they couldn't buy. Section order misaligned with visitor intent (most arrive wanting to see plan prices). Table was 48+ rows always-visible; collapsing reduces scroll fatigue without losing information.
**Applies to:** `app/pricing/page.tsx`, `app/pricing/page.module.css`, `app/pricing/ComparisonTable.tsx`; eyebrow-colour rule applies globally to all public-facing pages.

---

### 2026-05-24 — Rules page: btn-purple eliminated, all buttons normalised to design system
**Decision:** `btn-purple` was a phantom class (no CSS definition anywhere) used on 4 buttons in both `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` and `app/admin/rules/RulesAdmin.tsx`. Replaced globally: "Save Changes" (dirty state) → `btn-lime btn-data`; "Save Changes" (clean) → `btn-ghost btn-data`; "Seed Default Data" → `btn-outline btn-data`; "Add Section" → `btn-lime btn-data`; "Upload File" → `btn-lime btn-data`; "Add Link" → `btn-outline btn-data`; resource inline Save → `btn-lime btn-data`; resource inline Cancel → `btn-ghost btn-data`. `btn-purple` is now completely absent from the codebase.
**Rationale:** Phantom classes silently fail — buttons rendered with no colour modifier, looking like unstyled `.btn`. The btn-data + btn-lime/btn-outline/btn-ghost pattern is the correct admin shell standard. Every design review should grep for `btn-purple` (and any other non-system modifier) to catch this category of error.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/admin/rules/RulesAdmin.tsx`, and globally (btn-purple is banned)

---

### 2026-05-24 — AUDIT RULE: btn-primary is banned outside overlay modals — replace with btn-lime btn-data
**Decision:** `btn-primary` (navy gradient) is **only** permitted inside a `div.modal` (true overlay dialog with backdrop). Every other primary action in the admin shell — page headers, inline panels, compose forms, drawers, toolbars, inline CTAs — must use `btn-lime btn-data`. This has come up repeatedly across sessions (Announcements, Communications, and others); the root cause is that `btn-primary` is the React/form default and gets used by mistake on new components. **Every design review must grep for `btn-primary` and audit each hit against this rule.**
**Rationale:** The admin shell's brand identity is the logic-lime / dark HUD aesthetic. Navy gradients belong to the modal confirm pattern only. Consistency across pages requires an explicit audit step, not per-page corrections.
**Applies to:** All admin shell pages globally. Audit command: search for `btn-primary` in `app/[orgSlug]/admin/` and verify each is inside a `.modal` wrapper.

---

### 2026-05-24 — btn-data is the standard size modifier for all admin shell action buttons
**Decision:** All buttons in the admin shell use `btn-data` as their size modifier unless a specific exception applies. This covers: page header CTAs, toolbar buttons, inline panel action bars (compose, edit, filters), and inline form submit/cancel buttons. The two documented exceptions are: (1) empty state CTAs — use `btn btn-lime` with a local size class instead; (2) true modal confirm/cancel buttons — use `btn btn-primary` or `btn btn-ghost` at default size. Do not use `btn-sm`, `btn-lg`, or unsized `btn` for admin shell action buttons.
**Rationale:** The platform's operational/terminal aesthetic requires compact, monospace, uppercase buttons throughout the admin shell. Using default `.btn` sizing creates large buttons that look out of place next to data tables and toolbars. `btn-data` enforces: 0.62rem monospace font, uppercase, 2px radius, tight padding.
**Applies to:** All admin shell pages and components globally. See `app/globals.css` `.btn-data` for the definition.

---

### 2026-05-24 — Compose panel: max-width 860px centered, btn-data on all action buttons
**Decision:** The communications compose panel uses `max-width: 860px; margin: 0 auto` so all sections (templates, fields, channels, actions) share the same width and are centered in the content area. The page header remains full-width. All three action buttons (× Cancel, Save Draft, Post to Site/Send) use `btn-data` to match the operational data-density aesthetic of other admin pages (Registrations, Schedule). `channelDesc` needs no `max-width` because the panel's own constraint prevents over-stretching.
**Rationale:** Consistent width across all compose sections avoids the "narrow fields, wide channels" mismatch. btn-data aligns the form's button aesthetic with the rest of the admin shell.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/communication.module.css`, compose panel pattern

---

### 2026-05-24 — .empty-state svg selector must be direct-child only
**Decision:** The global rule targeting SVGs inside `.empty-state` must use the direct-child combinator: `.empty-state > svg`, not `.empty-state svg`. The descendant form matches SVG icons inside buttons nested within the empty state, applying `opacity: 0.4` and `margin-bottom: 1rem` to button icons — causing visual misalignment.
**Rationale:** The rule was written for the decorative icon only. Any `.empty-state` that contains a button with a Lucide icon would be broken by the broad selector.
**Applies to:** `app/globals.css` — global fix affecting all empty states platform-wide

---

### 2026-05-24 — Branded checkbox: global platform style for all input[type="checkbox"]
**Decision:** All checkboxes across the platform use a custom branded style: `appearance: none`, 16×16px, 2px border-radius, `--blueprint-blue-rgb` border (unchecked), `--logic-lime` checkmark via `::before` pseudo-element, `--logic-lime-rgb` border + tint background (checked). Applied globally via `input[type="checkbox"]` in `globals.css`. The 18×18px `.selectionCheckbox` variant in `teams-admin.module.css` is the reference; the global uses 16px for standard form checkboxes. All `accent-color` overrides have been removed from module CSS files and inline TSX styles — they have no effect once `appearance: none` is set. The `--logic-lime-rgb` fallback is `217, 249, 157` (matching the global token, not the incorrect `194, 255, 74` used in old fallbacks).
**Rationale:** Standard browser checkboxes clash with the dark HUD aesthetic. The lime-on-dark brand palette makes checked states immediately readable and on-brand. A global rule ensures no new checkboxes are accidentally left unstyled.
**Applies to:** All `input[type="checkbox"]` globally; the 18px `.selectionCheckbox` class in `teams-admin.module.css` is the reference for larger table-row selection variants.

---

### 2026-05-24 — Page header icon box: align-items flex-start not center
**Decision:** `.headerLeft` (the icon + title/subtitle flex row in the page header) uses `align-items: flex-start` so the icon box top-aligns with the title text. `align-items: center` caused the 48px icon box to float ~4px below the title start when the text block was taller — visually misaligned.
**Rationale:** Icon boxes should anchor to the title, not to the midpoint of the entire text group.
**Applies to:** `communication.module.css`, any page header using the icon-box + title/subtitle layout

---

### 2026-05-24 — Empty state CTAs must not use btn-data
**Decision:** Buttons inside `.empty-state` must use `btn btn-lime` (or `btn btn-outline`) without `btn-data`. `btn-data` enforces 0.62rem monospace uppercase, which is correct for header/table CTAs but creates an undersized, stiff appearance as a centered page-level call-to-action. The empty state CTA gets its own padding via a local `.emptyCta` class.
**Rationale:** `btn-data` is the "operational terminal" aesthetic for data-dense contexts. An empty state is an invitation, not an action bar row. The size and weight need to match the informational hierarchy of the surrounding text.
**Applies to:** Communications page empty state; empty state CTA pattern globally

---

### 2026-05-24 — Communications page replaces Announcements + old Communications pages
**Decision:** The unified `/admin/tournaments/communication` page supersedes both the old Announcements page and the previous Communications page. It handles site posts and email sends from one compose panel with a shared history log. Template chips use a pill style (`--bg-inset`, `--border-subtle`, 20px border-radius). A "× Clear" text button (`.draftClear` style) appears inline at the end of the template row only when title or body has content — preferred over a "Blank" template chip, which is semantically awkward.
**Rationale:** Consolidating site posts and emails into one place reduces context switching. The inline Clear affordance reuses the existing draft-clear pattern for consistency.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/page.tsx`, template clear pattern globally

---

### 2026-05-24 — Admin pages use full width, no page-level max-width
**Decision:** Tournament admin pages must not set a `max-width` on the `.page` wrapper. The shared admin shell provides its own container constraints. Page-level max-width creates inconsistent layout where the header button appears stranded far from the right edge.
**Rationale:** All pages (Registrations, Schedule, Results) stretch full width. Announcements had a leftover `max-width: 860px` that was removed.
**Applies to:** All tournament admin pages, global

---

### 2026-05-24 — btn-lime for primary admin shell CTAs, btn-primary for modal actions
**Decision:** Primary action buttons in the admin shell page header (Add Team, Add Game, New Post, etc.) use `btn-lime btn-data`. `btn-primary` (navy gradient) is reserved for modal save/confirm buttons.
**Rationale:** The global CSS comment at `.btn-lime` is explicit about this convention. Mixing btn-primary into the admin header produces the wrong brand color (dark navy vs. logic-lime).
**Applies to:** All tournament admin page headers, global convention
**⚠ Extended:** See newer entries "AUDIT RULE: btn-primary is banned outside overlay modals" and "btn-data is the standard size modifier" — those entries supersede the page-header-only scope of this one and apply the rule to all admin shell contexts.

---

### 2026-05-24 — Export button belongs in the toolbar (align="end"), not the page header
**Decision:** ExportMenu always lives in a `ToolbarGroup align="end"` on the first toolbar row, before the Tools menu. It must not live in `TournamentAdminHeader` actions. The header is reserved for one primary lime CTA (Add Team, Add Game) and secondary outline actions (Open Scorekeeper View). Export is a utility/data-extraction action contextually tied to the current filter state.
**Rationale:** Export respects current filter state (division, status), so it belongs near the filters. The header should have one clear primary action. Well-established admin tool pattern: filters + export in the toolbar row, primary create action in the header.
**Applies to:** All tournament admin pages with export (Registrations, Schedule, Results), global convention

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-05-24 — News Posts: remove delivery note banner
**Decision:** Removed the "Public post only / Email Teams" banner from the News Posts list page entirely.
**Rationale:** The page subtitle ("This does not send email") already communicates the key distinction. Communication is adjacent in the nav. The banner was pure redundancy that added visual weight before users could see their posts.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`

---

### 2026-05-24 — News Posts: action-oriented empty state
**Decision:** Empty state now shows an icon, a "Keep teams informed" title, a one-line description, and an inline "Publish First Post" CTA button — replacing the passive "No posts yet. Create one above." pattern.
**Rationale:** Empty states should be self-contained action prompts, not pointers to other parts of the UI. Removes the awkward "above" reference when the header button is not in the user's focus area.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, empty state pattern globally

---

### 2026-05-24 — Upgrade upsells must not interrupt active task flows
**Decision:** The Tournament Plus locked-targeting upsell was removed from the New/Edit Post modal. The `NEWS PAGE VISIBILITY` section only renders when `canTargetAnnouncements` is true (Plus/League/Club). Free orgs see a clean Title → Body → Pin → Publish flow.
**Rationale:** Free org posts are all-divisions by default — there is no decision to make, so showing a locked feature block mid-form adds friction to every create/edit action without enabling any task. Upsells belong on plan/subscription pages, not inside creation modals.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, upgrade gate placement globally
