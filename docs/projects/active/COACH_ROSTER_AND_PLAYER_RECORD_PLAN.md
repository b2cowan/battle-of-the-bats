# Coach Roster + Player Record — the list stops filing and starts telling you things

**Status:** ruled 2026-08-26, build in progress
**Origin:** owner, reviewing QA §88 — *"this status of active vs. inactive is not really useful anywhere
in the product to my knowledge and yet it has a pretty dominant presence on these screens."*
**Mockups (the spec):** https://claude.ai/code/artifact/fe469a92-5808-4974-8e3a-00b0e1a7c452
**PM brief:** `COACH_ROSTER_AND_PLAYER_RECORD_PM_BRIEF.md`

---

## 0. The premise was wrong, and the conclusion was right anyway

The opening question assumed Active/Inactive drives nothing. **It drives more than any other field on a
player**, and this was verified in code before a line was changed:

1. **It is the delete.** `deleteRepRosterPlayer` has no caller anywhere in the app. Removing a player
   from a team *is* `status='inactive'`. The record survives, so attendance, dues and development
   history are never orphaned — the right model, and not up for review here.
2. **It is the master gate on every downstream tool.** An inactive player is filtered out of:
   lineups + the auto-fill, saved lineup templates, the depth chart, the game console, game moments,
   attendance (the attendance **save is rejected outright** — the whole batch 400s — if one player in
   it has gone inactive), practice plans, the development board, season-to-season carry-forward,
   awards, tryout baselines, dues generated from the budget plan, per-player cost splits, the money
   summary, fundraiser entries, announcement + dues-reminder recipients, the season roster, Season
   Wrapped and the register book.

**So the field stays. What was wrong was its presentation**, for a reason the original question did not
name: on a healthy team every row reads `ACTIVE`, so a column with one value on every row costs a full
column of the portal's widest table and returns nothing — while the *destructive* action sits as a
row-level ghost button repeated twelve times down the right edge, one mis-tap from removing a child
from all of the above. And the badge is only needed at all because inactive players are currently
listed **inline among active ones**, in batting order, told apart by nothing but a grey pill.

---

## 1. Owner rulings taken 2026-08-26 (binding for this build)

| # | Question | Ruling |
|---|---|---|
| 1 | Wording of removal | **"Take off the roster"** / shelf reads **"Off the roster (n)"** / **"Add back"**. The stored value stays `active`/`inactive` — this is copy, not a migration. |
| 2 | Dues on the roster list | **No dues on the roster.** Money stays on the money screens. |
| 3 | Player record shape | **Three tabs** — glance card, then *This season* / *Details* / *Family & paperwork*. |
| 4 | Sequencing | **Both in one pass.** |

⚠ **Ruling 2 reversed my own mockup.** The published spec drew a Dues column with figures; the owner's
instinct across the whole session was *less on this page, not more*, and the roster is a screen a coach
opens standing beside a parent. The column is out. **Do not reintroduce it** — a later "just a small
Owing chip" is the same decision wearing a smaller coat.

---

## 2. ⚠ What the code refused to give us: the "on the family app" chip

The mockup drew a **Family** column showing guardian name + one of `App` / `Email` / `No contact`.
**The `App` half cannot be built today**, and this was found before building, not after:

- Team **family access** followers are attached to the **team**, not to a child — the payload carries
  `{id, email, relationship, approvedAt}` and no player. It cannot answer "is *this* player's family
  connected".
- The per-player answer lives in the **guardian tier**, which is **shipped switched off**
  (`GUARDIAN_TIER_ENABLED` defaults false, the whole route 404s while off) pending PIPEDA/CASL counsel
  review. No real coach has per-player guardian links today.

**So the Family column ships as: the guardian's NAME, with the email and phone as tap-to-contact
beneath it, and a quiet "Add a contact" where there is neither.** That is still the change worth
making — it replaces a 40-character string with a person — and it needs **no new data at all**: every
field is already on the roster row the page has fetched.

⚠ When the guardian tier is switched on, the `App` chip drops into this column. Written so that is an
addition, not a rebuild.

---

## 3. Roster list — what changes

### Out
- **The Status column**, header and cells, at every width.
- **The row-level Deactivate/Activate button** and the whole trailing action cell.
- **The player count** (`12 active players`) — already phone-dropped 2026-08-24, now gone entirely.
- **The nudge line** (`12 without a position · 1 without guardian contact`) — already phone-hidden
  2026-08-26, now gone entirely.

⚠ Rulings 3 and 4 are the owner's *"it's not a lot of players to count, the user can see them all on
one screen"*. **No filter chips replace them.** A control that hides nine of twelve rows to show three
is slower than reading twelve. The gaps move back into the rows they belong to.

### In
- **Family column** replaces the raw Guardian-email column (§2).
- **Quiet in-row prompts** where a value is missing — a dim, dashed *Add a position* / *Add a contact*
  sitting where the value would be, linking into the player.
  ⚠ **Dim, not amber.** On a fresh roster every row is missing a position; twelve amber warnings about
  a roster that is merely *new* is an alarm that teaches coaches to ignore alarms.
- **Name-cell markers**, all from data already on the row: A-squad star, pitcher rank, medical-notes
  flag. These are what a coach scans a roster *for*.
- **The off-roster shelf** — a collapsed line at the foot of the list, `▸ Off the roster (2)`, opening
  to those players with one **Add back** each. They stop being interleaved with the team, which is what
  made the status badge necessary in the first place.

### Deliberately NOT added
**Attendance.** It reads like an obvious column and it is the one to refuse. The attendance report has
exactly **one** front door in Reports, and a second door on this page was removed once already because
it kept sending coaches "back" to a page they had never been on. Per-player attendance stays on the
player record and in the report.

---

## 4. Player record — what changes

Nine equal collapsible drawers ordered by the data model: Player · Guardian contact · Safety ·
Guardians · Documents · Development · Attendance · Awards · Dues.

**The real fault is that it is two pages wearing one coat.** Half is a **form** filled in once in April
(name, birthdate, jersey size, bats, throws, emergency contact); half is a **record** read all season
(development, attendance, dues, what the family sees). Stacked flat, the weekly thing sits under the
once-a-year thing — and the first control under the child's name is the delete.

### The glance card (always first, never scrolls away)
Jersey · positions · age, then the flags that matter (A-squad, pitcher rank, medical notes), then four
tiles: **Dues**, **Attendance**, **Family**, **Awards**. (The name is already the page title one line
above; repeating it in the card would be the second of two.)

⚠ **The fourth tile is Awards, not Documents, and that changed during the build.** Documents needed a
count this page does not fetch — and "outstanding" needed a per-team required-documents list that does
not exist anywhere in the product, so a tile showing it would have been inventing a policy inside a
summary. Awards is real, already fetched, and answers the same question the other three do. Documents
are counted honestly on the Family & paperwork tab. **Every tile reads data the page already had — the
glance card costs no extra call.**

### Three tabs
| Tab | Holds | Why |
|---|---|---|
| **This season** | Development (focus areas, measurables), playing time + attendance, awards, family season recap | The reason a coach opens a player mid-season |
| **Details** | Identity, positions + lineup profile, pitching, bats/throws, jersey size, private notes | The April form |
| **Family & paperwork** | Guardian contact, guardians / family access, safety + emergency, documents | "Who do I call" |

### Removal moves, and gets named
Off the status strip at the top of the page — where the very first control under a child's name was
"Deactivate" — and down to the foot of **Details**, as a quiet destructive action reading **Take off the
roster**, with a confirmation that states the consequence rather than the state:

> *They stop appearing in lineups, attendance, dues and team emails. Everything recorded is kept, and
> you can put them back any time.*

---

## 5. Already shipped ahead of this plan (2026-08-26, same session)

These landed as live-defect fixes while the plan was being ruled, and are **not** part of the redesign:

- Nudge line hidden on phones (kept on desktop until §3 lands).
- **List / Depth chart pills made equal width** — and the wrap was never a space problem. A phone rule
  written for *form fields* was forcing the two pills to split their box in half, so the longer label
  wrapped inside its own pill with a hand's width of empty toolbar beside it. Fixed with
  `grid-auto-columns: 1fr` (equal **by construction**, sized to the longest label) rather than `flex: 1`
  (equal **by division**, which is what squeezes).
- **Reorder arrows removed from phones** — ⚠ reordering is now **desktop-only**; drag was already
  disabled on touch, so nothing replaces them. Owner's call: a coach sets the order once, at a desk.
  The arrow markup is CSS-hidden, not deleted — a one-line put-back.
- **Phone card cut from three lines to two** — positions fold into the name row; guardian keeps its own
  line. `ACTIVE` no longer drawn on a card; **`INACTIVE` still is** — the default says nothing, the
  exception must not be missed.
- **Header corner action re-aligned with the toolbar's Export.** ⚠ Portal-wide: inside the team layout
  the masthead draws the "?", so the header renders no help button — but its grid **column stayed
  declared**, and a grid draws the gap beside an empty track exactly as beside a full one. Every one of
  the **seven** team pages using the title-row action variant sat 8px in from the true right edge.
  Gaps are now margins between items, so an unrendered element contributes no space.

⚠ **Cascade lesson, third instance in this stylesheet:** the first attempt at the nudge hide was written
*above* the rule it overrode, at equal specificity — a silent no-op, no error, page simply unchanged.
See `.segChoiceFull` and the toolbar `.segBtn` note for the other two.

---

## 6. Risks

| Risk | Handling |
|---|---|
| Reordering writes an explicit `0..n` to every **shown** row; the list now shows only active players | Verify the reorder write does not disturb off-roster rows' `display_order` |
| Positions are **free text** (no CHECK, no Sport Pack enforcement at write) | Every surface rendering them truncates rather than widening — already done on the phone chip |
| Assistant coaches without `rosterPii` | The Family column must redact exactly as the Guardian column did; the API already enforces it, the UI must not draw an empty column |
| A coach on a **closed season** reading the roster | Read-only path is unchanged; the shelf's Add back and the Take-off action are both behind roster-write |
| ⚠ **Reorder was position-keyed** and the table now renders a FILTERED list | **Found and fixed during the build.** An index into the visible rows is not an index into the full set, so the arrows would have moved the wrong player as soon as a team had someone off the roster sorting above an active one — silently, no error. Both handlers are now id-keyed and operate on the visible list, with the off-roster rows appended to the write so nobody keeps a stale order. Same trap that once rewrote a paid installment on Payables. |
| `check:layout` baseline | The list loses a column and the record page gains tabs — expect baseline churn and read it rather than re-recording it blind |
