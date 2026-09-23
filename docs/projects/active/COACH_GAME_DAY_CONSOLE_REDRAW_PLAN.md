# The bench console, re-drawn — game day at phone width

**Status:** Ruled 2026-09-22 · **BUILT ON DEV 2026-09-22** · walk owed (Owner QA Ledger §224)
**Hub (findings · before/after at true size · rulings · QA walk):** `COACH_GAME_DAY_CONSOLE_HUB.html` — https://claude.ai/artifact/48VgBmd2bGwJRY6Y8erSBZ
**PM brief:** `COACH_GAME_DAY_CONSOLE_REDRAW_PM_BRIEF.md`
**Migrations:** none. **New routes:** none. **Year parameters:** none (`HISTORY_ENDPOINTS` untouched).

---

## 0 · Why this existed

The game-day console shipped in three passes in August 2026 and was **never in the phone
re-evaluation's stage ladder** — that programme covered the shell, the Overview, the Schedule and
the lineup builder and stopped there. The owner opened it on a phone on 2026-09-22 and reported
the score block, the pinned Saved chip, the wasted space, the wake-lock chip and the back label.

Measuring it first turned up **two defects nobody had reported**, both of which made the screen
unusable for its one job. They are the reason this was worth doing immediately rather than queuing
behind the rest of the ladder.

## 1 · The two defects

**D-1 · Every action-bar button was covered by the phone's bottom navigation.**
`.stickyActionBar` pins to `bottom: 0` and knows nothing about the nav (`position: fixed`, 72px,
z-index 300). The console is that recipe's **only consumer**, so nothing else in the portal was
affected — and here it meant *Who's here*, *Note*, *Full grid* and **End game** were drawn
underneath the nav and untappable at every scroll position except the page's last pixel.

```
hit-test, 390×844, centre of each button       BEFORE            AFTER
  scrollY   0    → blocked by the nav (×4)     0/4 reachable     4/4
  scrollY 200    → blocked by the nav (×4)     0/4               4/4
  scrollY 400    → the button (page end)       4/4               4/4
  overlap 66.6px of a 66.6px bar
```

**D-2 · Every player on the field was a disabled control.** On-field rows were `disabled` unless a
bench player had already been selected, so the flow only ran backwards and a **field-to-field move
had no path at all** except the dropdowns inside the sideways-scrolling *Full grid* sheet.

## 2 · The rulings (owner, 2026-09-22 — "I agree with your recommendations")

| # | Question | Ruled |
|---|---|---|
| — | Scorekeeping | **Out.** A quiet *Update score* row under the board opens the same sheet. Settled before the rulings, on the owner's own re-frame. |
| G1 | The board's shape | **A** — the console keeps *On the field* / *Bench* and learns the builder's position sheet. Not the builder's batting-order list. |
| G2 | The action bar | **A** — keep it, fix the clearance, four buttons. |
| G3 | How scouting is reached | **A** — a door in the bar, and the opponent's name keeps its contextual door. |
| G4 | The wake lock | **A** — silent; the 2026-08-05 "must always say so" rule is retired. |

### 2.1 The owner's re-frame, which set the scope
> *"the main item here is for the things the coaches update in the dugout (game notes, scouting,
> and lineups mainly)"*

That is what moved scouting out of a dotted underline and into the bar, and it is what made
removing the score an improvement rather than a subtraction.

### 2.2 Why removing the score was safe — traced before it was drawn
Nothing in the product reads a mid-game score:

- the **season record refuses one by design** — the quiet write may not carry `result`, precisely
  so a half-finished "win" cannot reach it;
- the schedule, insights, opponents book, history and season-end all read a **finished** game;
- the recap's `W 6–4` badge is drawn by its own block, not this one;
- **End game carries its own two score fields and its own win/loss/tie badge**, and a coach can
  also record a score from the schedule without opening this screen at all.

So the running score fed a glance and a pre-filled field. It cost the most valuable 50px on the
page, and at 360 it was the thing that wrapped the inning stepper onto a second line.

## 3 · What was built

### 3.1 The two defects
- The footer reads `--coach-foot-clear` (the `.saveBar` precedent) inside `@media (max-width:900px)`,
  as `.gdFooter.gdFooter` so the override does not rest on 11,950 lines of source order. Its
  `padding-bottom` is declared unconditionally because the token already contains the safe-area inset.
  ⚠ **THE CLEARANCE IS GEOMETRIC — no z-index.** It was first built with `z-index: 301` "so a
  future nav taller than the token can never re-bury it", and that single line **reintroduced the
  exact defect it was fixing, one layer up**: the bar went over `.gdSheet` too, and every sheet on
  this screen is opened *from* the bar, so the End-game wrap's two buttons hit-tested as BLOCKED.
  See §7.
- On-field rows are live at rest. The row is a **container** now: `.gdRowMain` is the swap tap
  area (rendered as a `<span data-static>` when the swap is not on offer — never a disabled
  button, which is the defect this screen came out of) and the position beside it is its own control.

### 3.2 The head, which now scrolls
- The 47px top strip is deleted from the LIVE screen. `.gdBar` and `.gdBack` stay declared — the
  **recap and the error state still wear them**, and `.gdBack` now says *Back* (the destination)
  rather than *Schedule* (the page), with the word dropped at ≤640.
- Back moved onto the head's first line as a full **44px** `.gdBackBtn`.
  ⚠ Built as 38px first; the layout sweep measures the ELEMENT's rect, so a 38px box with a 44px
  pseudo-element halo reads as a 38px control. With the score gone there is room for the honest size.
- `GAME DAY` → `.gdLiveDot`. The badge's real cargo is *writes are open*, which matters because the
  same address serves a read-only recap outside the window.
- The standalone **Home/Away word is gone, rule and all** — `matchupTitle` already says it (`vs` /
  `@`). The head was stating one fact twice in two grammars, and it was the fourth chip's worth of room.
- `.gdOpp` / `.gdOppDoor` take `min-width: 0` + ellipsis so a long opponent gives way to the two
  controls beside it rather than pushing them off the row.
- The wake chip and `button.gdChip` are gone; `gameDayAwakeKey` deleted from `lib/coach-game-day.ts`.

### 3.3 The pinned slot
`data-sticky="head"` **moved from the header card to `.gdInningBar`** — deliberately kept, because
it is the layout sweep's readiness selector for this screen and is rendered only in live mode, so
it still proves both things the sweep needs. The bar is the builder's stepper: two 44px arrows, the
inning chip, and a row of status dots (done / open / clash / untouched, a ring on the current one),
with an `srOnly` sentence for anyone who cannot see them.

### 3.4 The board
Every row's position is a control: `LineupPositionSheet` at ≤640, a native `<select>` above it.
⚠ **The sheet is phone-only by necessity, not preference** — its positioning rules live entirely
inside the nav module's ≤900px block, so above that width it would lay out in the document flow.
The desktop `<select>` is what the builder's own grid has always used.

On the bench the same control is the one-tap way to send somebody in, which is why the row's own
tap can stay the swap. An **absent** player's control is locked (`positionControl(r, isOut)`) — they
are never put on the field from here. The bench keeps its frozen longest-sitting-first order and its
streak chips; the field keeps its pitch-count and absence warnings.

### 3.5 Deleted
The **Full grid** sheet and its `.gdGridTable` / `.gdGridName` rules — the only sideways-scrolling
table on a screen read one-handed at a fence. Correcting a later inning is the pinned stepper now.
Its last line, the door to the full builder, survives as a row under the board.

### 3.6 The autosave word
The hand-rolled `.saveStatus` span is replaced by the shared `SaveStatusPill`, and the console is
**added to `coach-save-pill-guard`'s SURFACES list** — it was never on it, which is exactly how the
console kept the retired always-on tick for two days after the word moved on 2026-09-20. The pill
rides above the action bar via `--gd-foot-h`.

### 3.7 Help
`premium-gameday-attendance` describes the behaviour instead of the chip (and says the power button
still works); the score article describes the *Update score* row and names End game's own fields.
Search terms lose the control names that no longer exist and keep what a coach actually types
("screen keeps turning off", "phone keeps sleeping"), gaining "cannot tap a player on the field",
"where did the full grid go", "move a player already on the field".

### 3.8 Leaving a sheet — Escape, tap-away and Back (owner, 2026-09-22, after the review)

> *"I can't escape or click out of these modals, only the X allows me to leave"*

Every `.gdSheet` on this screen declared `role="dialog"` and offered exactly **one** way out. Six
surfaces: score, Who's here, Note, the scouting book, the End-game wrap **and the substitution
confirm**. No Escape, no tap-away — and no phone Back either, because §219 gave a history entry to
every dialog *floor* and these six never had one, so Back walked out of the game entirely.

They stay **non-modal by design** — no scrim, the board readable behind them, because a bench
decision is made while looking at the bench. So the fix is `useDismissable` (pointer-down outside,
plus Escape) and `useBackStep`, **not** `useDialogFloor`, whose focus *trap* would contradict a
surface you are meant to be able to look and tap past.

⚠ Both overlay states are cleared together, which also closed a hole nobody had reported: `sheet`
and `pendingSwap` were supposed to be mutually exclusive and nothing enforced it, so with a sheet
open a coach could still tap a bench row and then a field row and have the swap confirm render
**on top of** the open sheet.

Verified in the browser at 390: for all four footer sheets, Escape closes · tap-away closes · Back
closes **and stays on the console** · the X still closes; and tapping a position pill while a sheet
is open swaps cleanly to the position sheet with no second overlay left behind.

**Open for the owner, not built:** this screen still speaks two overlay languages — the position
sheet is a true drawer with a scrim, these six are floating cards with none. That is the same split
the owner ruled on for the lineup builder the same day (D12/D13: four floating panels became
drawers, because one screen should not speak two). The "board visible behind" rationale in the
stylesheet was written for the **substitution confirm**, where it is load-bearing, and inherited by
five sheets where it is not — the score pad, an attendance list, a note being typed, a book being
read. Making those five drawers is a coherent follow-up; it is a design change, so it is a ruling,
not a tidy-up.

### 3.9 The five sheets become drawers (owner ruling 2026-09-22)

> *"go ahead and make them drawers"*

Score, Who's here, Note, the scouting book and the End-game wrap now rise from the bar's top edge
on a phone: **full width, flush, rounded at the top only, a grab line, and the page dimmed behind**
— the same shape as the position sheet and the More sheet. The screen had been speaking two
overlay languages, which is the argument the owner had already accepted for the lineup builder
(D12/D13) the same day.

**Done in CSS, not with a new component.** The five already shared one `sheetHead()`, so the grab
line rides with it and the carve-out is a single `:not([data-card])` — (0,2,0), so it beats the
base rule on specificity rather than on source order. No new abstraction, nothing for the other
three sheet components in the portal to drift from.

⚠ **The scrim is a REAL ELEMENT, and the first attempt was wrong in a way worth recording.** It
was built as a pseudo-element on the sheet with a negative `z-index`, on the reasoning that a
negative child paints behind its parent's background. That is only true when the parent does *not*
form a stacking context — and the sheet does (fixed + z-index), so within that context the order is
background → negative children → content, and **the scrim dimmed the drawer itself**, leaving its
text on a grey ground. The owner caught it on the phone: *"looks like you are dimming the whole
thing, drawers too."*

The pseudo-element version also had to be `pointer-events: none` (a tap on a pseudo reports its
PARENT, which would have read as a tap *inside* the sheet and defeated the tap-away close added in
§3.8) — which meant taps fell **through** the dimmed page to whatever sat behind, so tapping a
dimmed position pill both closed the sheet and opened the picker. **A scrim that dims without
blocking is a lie.** The real element is a SIBLING of the sheet, so a tap on it is still "outside"
to `useDismissable` and closes without a handler of its own, while the page under it stays inert.
At 259 it covers the page, the action bar (2) and the autosave pill (250) — the pill deliberately,
so an error pill can never intercept a tap on the sheet, the same reason `.sheetAnchor` gives — and
sits under the sheet (260) and the nav (300), which stays lit and tappable.

**Above the drawer breakpoint nothing changed** — the sheets stay the centred 30rem card they were,
because the phone sheet system's positioning rules exist only inside the nav's ≤900px block.

**Measured:** at 390×844 and 390×667 the drawer is 390 wide, flush to the nav's top to within a
pixel, `18px 18px 0 0`, grab line shown, scrim at `rgba(13,17,26,.45)` covering the page but NOT the drawer (the drawer
samples pure white), and a tap on the dimmed area closes without reaching what is behind it; at 1440×900 it is the unchanged 480px card with no grab and no scrim.
Escape, tap-away and Back all still close at both phone heights.

**⚠ ONE SURFACE IS DELIBERATELY STILL A CARD, and it is an open question, not a decision.** The
**substitution confirm** keeps `data-card`, because the board behind it is the thing the question
is about. I now think that reasoning is weaker than it looked: with a decision pending, the board
behind should arguably *not* be tappable, and "visible" survives a scrim anyway. Making it the
sixth drawer is a one-line change. **Left for the owner** — the ruling named the five, and widening
a ruling without asking is not a tidy-up.

### 3.10 The Note sheet — a dropdown, and the CTA's colour (owner, 2026-09-22)

> *"can we make 'about a player' a dropdown so we can keep the save button on the screen? also,
> why is the save button black? that seems inconsistent with our theme"*

**Two unrelated things, both right.**

**The player tag was a chip per player**, so the control grew with the roster — on a 12-player team
it pushed `Save note`, the one action the sheet exists for, off the foot of the drawer. It is a
`<select>` now: one 44px row whatever the roster does, and the portal's ruled form idiom besides.
The native `<label>` wraps the control, so the visible text *is* the accessible name.

**The primary button was `--home-ink` on `--home-paper` — a near-black fill.** `.btnPrimary`, ten
thousand lines up, is documented as *THE shared coaches CTA (every form/modal submit)*, is lime
with dark ink, and carries its own warm-theme rule so its fill stays **true lime** rather than the
olive the global lime→olive accent remap would give it. The console was built with its own palette
and never got that memo. Same pair and the same warm override now, so all of this screen's
deliberate acts read as the CTA they are: *Save note*, *Confirm & notify families*, the
substitution's *from here on*, *Start from a template*.

**Found on the way, pre-existing:** the tag control printed the player's number twice —
`playerDisplayName()` already prefixes `#2`, and the chip added the bare number in front of it, so
it read *"2 #2 Blake Test"*. Invisible at chip size; not at 14px in a dropdown row. Removed.

**Measured (390×844 and 390×667):** the sheet is 376px and does **not** scroll at either height;
the select is 44px with 13 options; `Save note` sits inside the drawer without scrolling at both;
the button renders `rgb(217,249,157)` on `rgb(36,30,21)` — the warm lime pair, not the ink.

**Three refinements on the owner's next look, same session:**

- **The dropdown inherited the MONO data face.** Its wrapper carried `font-family: var(--font-data)`
  for the label, and the portal's form controls set no font-family of their own — so the select
  rendered in the label's mono at the label's size, which is what "not consistent with our portal
  font/size" was pointing at. The font now lives on the label span; the wrapper is a plain column;
  and the control **composes the portal's shared `.select`** (ground, border, 6px radius, body
  size, focus ring) plus only the 44px thumb minimum the field floor needs. Stacked label-above-
  field, the portal's form idiom — side by side, the uppercase tracked label and the control were
  fighting for one row at 390. Measured: **the select and the textarea resolve the same font
  stack**, 14px, 44px tall, full width.
- **The closing "families are never notified" paragraph is gone.** The sheet already says it in the
  meta line under the textarea ("For you and your staff"), and a drawer that must stay short should
  not spend two lines repeating its own caption.
- **The footer button is just `Who's here`.** "11 HERE · 1 OUT" wrapped to two lines inside a 56px
  button and squeezed its three neighbours; the count moved into the drawer that owns it.

**Re-measured:** all four footer buttons are **one line** at 390 (84px each) and 360 (76px); the
Note sheet is **337px** and does not scroll at 390×844 or 360×640, with `Save note` inside it at
both; the attendance drawer carries "11 here · 1 out".

## 4 · Measured, on dev, read from the browser

| | Before 390 | After 390 | Before 360 | After 360 |
|---|---|---|---|---|
| Top strip | 47.2 | **0** | 47.2 | **0** |
| Chips | 74.8 (2 lines) | **25.2 (1 line)** | 74.8 | **25.2** |
| Pinned while scrolling | 215.8 | **76.2** | 267.8 | **76.2** |
| First player at | 368.7 | **286.7** | 420.7 | **286.7** |
| Action bar reachable | **no** | **yes** | **no** | **yes** |
| Tap targets under 44px | — | **none**¹ | — | **none**¹ |

¹ Besides the global "Skip to content" link, which is pre-existing and not this screen's.

## 5 · Verification run

- `tsc --noEmit` clean · focused lint **0 errors** (the 10 warnings all pre-existing, none on new lines).
- `npm test` — **4,482 pass, 0 fail**, including the save-pill guard with the console now in its list.
- `verify:changed` green end to end; `check:css-selectors` clean after removing `.gdLivePill`,
  `.gdScoreVal` and `.gdHa` (the gate caught all three, and corrected a comment of mine that had
  claimed `.gdScoreVal` survived).
- `check:layout --only=coach-game-console` — **✓ no new findings** at 361 / 390 / 768 / 1440.
- Real-browser probes: hit-test of all four bar buttons at scrollY 0 / 200 / 400 at both phone
  widths; stepping the inning moves the board; the position sheet opens on the right player and
  inning ("Inning 2 of 6 · playing SS · Bench in the 1st, 3B in the 3rd"); 11 selects and 0 sheet
  buttons at 768 and 1440, 11 sheet buttons and 0 selects at 390/360.
- A read-only helper is correct **by construction**: the footer is gated on `!readOnlyViewer`, the
  position control returns a plain span when `!boardInteractive`, and the save pill needs a grant.
  Still worth walking (step 22).

## 6 · Not done, and deliberately

- **The recap is untouched.** It is a finished-game read and was out of scope; it keeps `.gdBar`.
- **The *Who's here* sub-label wraps to two visual lines** inside its 56px button at 390. It fits
  and the height holds. Tightening it means changing the count copy, which is the owner's call.
- **The score sheet itself is unchanged** — same +1 buttons, same correction, same families note.

---

## 7 · /review — high-risk funnel, 2026-09-22 (after the build, before any commit)

Five non-overlapping Sonnet lenses (correctness · regression/blast-radius · accessibility ·
CSS/rendered · permissions), Critical and High adjudicated in the main loop against a real browser.
**Nine findings confirmed and fixed, two dropped as pre-existing, one accepted as a tradeoff.**

### 7.1 The two that mattered most — both my own fixes biting back

**C-1 · The footer fix reintroduced its own defect one layer up.** `z-index: 301`, added so a
future taller nav could not re-bury the bar, also put it above `.gdSheet` (45). Every sheet on this
screen is opened *from* that bar, so the bar was always stuck on screen when one opened.
Hit-tested on the End-game wrap: **"Keep coaching" and "Confirm & notify families" both BLOCKED**,
68.2px of the sheet buried. It also outranked `.sheetAnchor` (260), which every other phone surface
in the portal deliberately sits under. **Fix: no z-index at all.** The clearance is geometric — the
bar sits above the nav's box, so it never overlaps it and needed no stacking help. Re-tested: both
sheet buttons reach, all four bar buttons still reach at three scroll positions × two widths.

**C-2 · The new autosave pill draws over this screen's sheets.** The pill is new here (the word was
an inline span before) and is `z-index: 250` with a comment reading *"over the sheet and the
slide-over"* — which meant the **schedule's** slide-over, not these. Its offset lands it inside the
band a populated sheet occupies; in the `error` state it takes `pointer-events: auto` and could
intercept the tap outright — a save failure being exactly what happens in the field conditions this
screen is built for. **Fix: `.gdSheet` → z-index 260**, the same value and the same reasoning
`.sheetAnchor` already carries, so the portal now has one answer to this.

### 7.2 Confirmed and fixed

| | Finding | Fix |
|---|---|---|
| High | The desktop `<select>` cleared **no** swap state; a hand-picked position was silently overwritten by a swap still pending behind it | One `abandonSwap()`, three call sites |
| High | The phone position button cleared `subInId`/`coverFor` but **not** `pendingSwap` — a confirmed swap card survived behind the sheet's scrim and came back live, still actionable | `beginPositionEdit()` clears all of it, and closes any open sheet (the sheets are scrim-less, so the pills behind them are tappable) |
| High | **Focus landed on `<body>`** after any pick that moved a row between the two groups — the sheet's restore held a node that had just unmounted. Measured, not theorised | Rows ask for focus back **by player** (`data-pos-for`), re-seated in a ref-driven effect. Re-measured: focus lands on that player's new control |
| High | An explicit `aria-label` on the row buttons **replaced** the name computed from content, silently dropping the warning chips — "3 of 5 innings pitched", "OUT" — from what a screen reader says, at the moment they decide the swap | The action is a hidden prefix `<span>`; the name is now action **and** facts |
| High | The `srOnly` inning summary reported clash **or** open, never both — an ordinary mid-game state told a screen-reader user only half of what the dots show | Reports both, and names the innings |
| High | Hiding the back word at ≤640 left `.gdBack` a **15 × 44** target on the recap and the error state — the opposite of what `.gdBackBtn` got in the same change | 44px floor in both dimensions at that width |
| Medium | **Score visibility regression** — gating the door on `can.score` hid the score from an assistant with lineups but not schedule-manage, who could always read it before, and who still sees the final in the recap seconds later. The sheet's own "kept by your coaching staff" branch had become unreachable, which was the tell | The door renders for everyone; the label turns on capability; the sheet's three-way answer does the rest |
| Medium | Rows grew **56 → 65.8px** — two 44px controls inside 0.62rem padding overran the declared `min-height`, giving back ~1.5 rows of the space this re-draw was for | Vertical padding to 0.35rem; rows measure 57.2 |
| Low | The `::after` chevron was inside the truncating box, so a long opponent clipped the door's own affordance | The name truncates in its own span; the chevron never shrinks |
| Advisory | The `.gdFooter` override rested on source order alone, ~11,950 lines apart | Doubled class, per the file's own `.inlineField.inlineField` precedent |
| Advisory | `aria-label` on a bare `<span>` (the live dot) is inert — generic role takes no name from it | Removed; the visible word says it |

### 7.3 Dropped, and why

- **The absent-player lock is blind without `can.attendance`** (Low). Real, but **pre-existing** —
  the old bench button had the identical blind spot, because attendance is withheld at the source
  for a coach without the grant. Extending the same signal to a second control does not make it
  this change's defect, and fixing it is a data-gating decision, not a UI one.
- **A lineup save can land after the live window closes** (Advisory). Pre-existing and by design —
  the standalone builder is always available, so the PUT has no window check. The *score* path does
  check, on both sides.
- **The inning summary is not a live region** (Medium). Accepted as a tradeoff, not fixed:
  announcing on every edit would talk over a coach mid-substitution. Noted for the walk.

### 7.4 Re-verified after the fixes
`tsc` clean · focused lint **0 errors** · `npm test` **4,483 pass / 0 fail** · `check:css-selectors`
clean · `check:layout --only=coach-game-console` **✓ no new findings** at 361/390/768/1440 ·
browser: the four bar buttons reach at scrollY 0/200/400 at 390 **and** 360; the End-game sheet's
two buttons reach; rows 57.2px; every interactive element ≥44px except the pre-existing global skip
link; focus lands on the moved player's control; no page errors.
