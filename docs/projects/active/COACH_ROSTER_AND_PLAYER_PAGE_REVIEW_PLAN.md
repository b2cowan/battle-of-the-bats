# Coach Roster + Player Page — full evaluation and redesign plan

**Status:** BUILT on dev 2026-09-13 (uncommitted) — owner accepted Q1–Q10 as recommended and R2-1..7 the same day; migration 296 applied to dev (PROD-PENDING, order-critical after 295); help synced; coach demo reseeded; Owner QA §182 owed (hub QA Walk tab). ⚠ Q7 DEFERRED — the Observations view was built and committed by Phase 2 first and the owner paused §180 for a holistic re-evaluation; the trim belongs there.
**Origin:** owner, 2026-09-13 — *"do a full evaluation of the roster page and player pages within
them … are we making this visually appealing? … showing the right things? … using our table/colour/
font styles? … linking into player pages consistently? … is a back link enough? … this family
season recap seems to be thrown in a random place, so many stacked drop downs …"*
**Hub (mockups · PM brief · this plan · decisions · QA walk):** `COACH_ROSTER_AND_PLAYER_PAGE_REVIEW_HUB.html`
(published as an Artifact: https://claude.ai/code/artifact/b6e9645a-e34b-4a28-b84d-7624482d2504)
**PM brief:** `COACH_ROSTER_AND_PLAYER_PAGE_REVIEW_PM_BRIEF.md`
**Predecessor:** `COACH_ROSTER_AND_PLAYER_RECORD_PLAN.md` (ruled 2026-08-26, built 2026-08-27). That
plan's *reasons* were re-tested here on merit — see §2. Nothing below is kept or changed "because it
was ruled"; where a prior reason still holds it is cited, where it no longer holds that is said.

---

## 0. How this was evaluated

Three read-only code maps (roster page, player page, app-wide list→detail conventions) plus a
Playwright pass against the running dev server at 1440 and 390, signed in as the UAT coach, taking
full-page screenshots of the roster and of every player-page tab and dumping the DOM outline,
computed type/ink/padding of table cells and the open/closed state of every fold. Every finding
below cites what the code does, not what a plan says it does. Measured facts used:

| Fact | Value |
|---|---|
| Roster rows (UAT) | 12 active, 40px each, first row at y=270 (desktop) / y=193 (phone) |
| Roster cell type | headings Barlow Condensed 12px/700 uppercase (on the ladder); body cells Inter **13.6px** on `#`, Positions, Family (inline `0.85rem` — **off the ladder**); name link 14px/600 |
| Row affordance | no row hover, cursor `auto`, name is the only link, no chevron |
| Phone card | one line: name + flags + `#n` badge; Positions and Family cells hidden at ≤640 |
| Player page tabs | 3, `useState` buttons, no URL address; phone labels `Season / Details / Family` |
| "This season" folds | Development **open** (698px tall), then recap panel, Attendance / Awards / Dues **closed** (55px each) |
| "Details" folds | one fold, "Player", open, 777px — a tab holding a single accordion |
| "Family & paperwork" folds | Guardian contact **open**, Safety / Documents **closed** (Guardians hidden — guardian tier off) |
| Dues fold header | `$-945.15` on Avery (over-credited), `$943.83` on Devon; the tile above reads `Paid` for Avery |
| Pitcher chip | roster shows bare `P`, glance card shows `Pitcher · rank ` — rank is null on the fixture's pitcher |
| Prev/next player | none anywhere in the coach portal; no precedent for record-to-record stepping |

---

## 1. The verdict in one paragraph

The August rework got the *shape* right — glance card, three tabs, removal named and moved, status
column gone — and the owner's instinct then ("less on this page") still holds. What it left behind
is a set of seams: **the roster's two right-hand columns are dashed prompts on every row of a new
team, three of its cells mint their own type size, its phone card lost the contact line the plan
promised, and a pitcher reads "Add a position" forever.** On the player page the three tabs are
right but **everything inside them is folded a second time** — a tab is a grouping, and a fold
inside a tab hides the thing the tab was opened for; **the Details tab is one accordion with nothing
to fold against**; the four glance tiles say Attendance, Dues, Awards, Family and **open nothing**,
so attendance appears three times on one tab and none of the three is a door; the family recap
sits mid-list in a different visual language because it is a preview of an *output*, not a record;
tabs have **no address**, so "Add a contact" on the roster lands on the wrong tab; and a coach
working through twelve players one at a time has **no way to step to the next one**. None of this
needs new data. Every fix below reads fields the two pages already fetch.

---

## 2. The predecessor's reasons, re-tested

| 2026-08-26 reason | Still true? | What this plan does |
|---|---|---|
| No Dues column on the roster: *"a page a coach opens standing beside a parent"* | **Yes.** A parent looking over a shoulder should not read another family's balance. | Keeps money off the roster list. Keeps the Dues tile + section on the *player* page, which is one family's own record. |
| No Attendance column: *"one front door in Reports; a second door sent coaches 'back' to a page they had never visited"* | **Partly.** The door problem was a back-link bug, not an argument against the figure. But the standard's own test applies: a column earns its place if a coach scans the roster *for* it, and attendance is scanned per player, not down a list. | Not added. Recorded as an open question (Q2) rather than a ruling. |
| No filter chips / counts: *"twelve rows on one screen — filtering is slower than reading"* | **Yes.** | Nothing added. |
| Three tabs on the player page | **Yes** — the three jobs (this season / the April form / who to call) are the right split. | Kept. What changes is *inside* the tabs. |
| Quiet in-row prompts, *dim not amber* | **Yes** for the colour. **No** for the dashed underline: one dashed prompt is quiet; twenty-four are a texture. | Restyled (F03). |
| Reorder desktop-only | Not re-opened. | Unchanged. |

---

## 3. Findings — Roster list

### F01 — The name is the door, and nothing says so
**Today:** the name renders as bold body text with no underline, no colour shift and no row hover;
the row's cursor is `auto`. The table standard (§3.6) is explicit — *a row that navigates has the
name as the link, never a row-level click* — so the roster is **compliant**, and the only
row-tappable rows in the portal (Player Dues, the dues drill-down) are *expanding* rows, a different
thing. But compliant is not the same as legible: the standard says where the link goes, not that it
must look like one, and this is the one list in the portal where every row is a door.
**Proposal:** keep name-as-link (do not make the row clickable — the Family cell holds `mailto:`
and `tel:` anchors and a row click would swallow them; the 2026-08-15 affordance table says the same:
*go somewhere else → the name is the link, never a row-level onClick*). Give the name the portal's
quiet-link treatment **at rest**, not only on hover: primary ink, weight 600, a 1px underline in
`--home-line-strong` that goes solid ink on hover. **No chevron column** — but the table standard's
K-08 ("every list table's last column is one chevron") has no register row excusing the roster, and
the register's preamble says a difference is registered or it is a bug. So this pass **writes the
register row**: *Roster — no action column; the name is the door (§3.6); the trailing cell is
Family, which holds tap-to-contact links a chevron would compete with.* Same shape as admin
Families. (Q1.)

### F02 — Three cells mint their own type size and ink
**Today:** `#`, Positions and Family cells carry inline `font-size: 0.85rem` (13.6px) and `#` an
inline `--home-ink-soft` colour. The ladder has no 13.6 and the ink system has three named tiers.
This is the F-01 defect the table standard retired in September, in inline style where the CSS
guard cannot see it. **Proposal:** cells on `--type-body`; `#` in `--font-data`, tabular, secondary
ink — the same number treatment the off-roster shelf and the depth chart already use, so one roster
family has one way of writing a jersey number. Add the three inline declarations to the recipe
guard's known-debt list until removed.

### F03 — On a new team, half the table is dashed prompts
**Today:** Positions and Family both fall back to a dashed-underlined "Add a position" / "Add a
contact" link; on a fresh twelve-player roster that is twenty-four dashed underlines, two thirds of
the table's width. The reason for the prompt (the gap lives in the row it belongs to, not in a
summary line) holds; the *dashed* treatment is what turns it into texture.
**Proposal:** the prompt becomes tertiary-ink text with a leading `+` glyph and **no underline at
rest** (underline on hover/focus, like every other quiet door in the portal). Same words, same
place, same link. On a mature roster where one row is missing a contact, it still reads.

### F04 — A pitcher reads "Add a position" forever
**Today:** the Positions cell shows the top-two *field* Best positions. The mound is excluded from
the position picker by design, so a player whose only job is pitching has no field positions and
the cell prompts "Add a position" — on the roster's ace. (Avery Test on the UAT fixture.)
**Proposal:** the Positions cell leads with the pitching chip when the player pitches (`P · Ace`,
`P2`…), then the Best field positions; the prompt only when there is neither. The chip is the same
one the name cell carries today, moved to the column that is *about* positions (F05).

### F05 — Name-cell markers: a bare "P", and a pitcher marker in the wrong column
**Today:** the name cell carries ★ (A-squad), `P{rank}` and ✚ (medical). On the fixture the rank
is null, so the chip renders a bare `P` and its accessible name reads "Pitcher, rank ". The glance
card has the same hole: `Pitcher · rank `.
**Proposal:** (a) a rank fallback everywhere the profile is read (the depth chart already defends
with `?? 1`); (b) the pitcher marker moves into the Positions cell (F04) and reads the way the
editor names it — `Ace` for rank 1, `P2`…`P5` otherwise — so the card, the row and the form say the
same word; (c) ★ and ✚ stay beside the name (they are about the *player*, not a position).

### F06 — The phone card has no way to reach a parent
**Today:** at ≤640 the card is one line — name, flags, `#n` — and the Family cell is hidden
outright. The August plan says *"guardian keeps its own line"*; the stylesheet hides it. A coach
at the field who needs a parent's number opens the player, switches to Family & paperwork, finds
the Call link: three taps, on the one device where a phone number is most useful.
**Proposal:** two changes, and the register already names the first. **(a)** Register row F-23
says the phone card's 19–22px name link is below the tap floor and offers two exits — raise the
link, or *make the card the door*. Take the second: the **whole card is the link**, the way the
practice-plan and scouting rows already are, so a thumb anywhere on the row opens the player.
**(b)** A second card line — positions chip (when set) on the left, and a **corner-pinned 44px
call button** on the right when a phone is on file (the standard's "icon-only action is corner-
pinned" rule, K-09; PII-gated exactly as the desktop cell). No email on the card. Rows with neither
stay one line — density by content, as the desktop already does.

### F07 — "Add a contact" and "Add a position" open the player on the wrong tab
**Today:** both prompts link to the bare player URL, which always opens **This season**. The
contact lives on Family & paperwork; positions on Details. The coach lands on Development and has to
find the tab. Cause: the player page's tabs are `useState` buttons with no address (see F13).
**Proposal:** once tabs are addressable, the prompts link to `?tab=family&section=guardian` and
`?tab=details`. The help article's deep links and the Family tile (F10) get the same.

### F08 — Small type-and-touch debt
- The drag handle is ~23px with no floor; it renders in the 641–768 touch band. → `--tap-min`.
- The heading rule is `--home-line`; the standard says `--home-line-strong` under a heading row.
- The help article "How to build your roster" still says *use the pencil to edit and the trash icon
  to remove* — true of the free-tier editor, false of this page. → `/docs` pass.
- Code comments in three places assert "Add Player keeps its word on a phone"; the CSS renders a
  bare `+`, which is what house rule 3 (words → symbols on a phone) wants. Fix the comments.

---

## 4. Findings — Player page

### F09 — Folds inside tabs: the thing the tab was opened for is behind a second click
**Today:** every tab is a stack of `<details>` cards. This season: Development open, then the recap
panel, then Attendance / Awards / Dues closed. Family & paperwork: Guardian contact open, Safety /
Documents closed. **Details: a single fold, "Player", with nothing to fold against.** A coach who
taps "Family & paperwork" to check an allergy has picked the tab *and* must open Safety. The
measured page is not long enough to need this — the whole This season tab with every fold open is
about two screens on desktop.
**Proposal:** **no folds inside tabs.** Each tab is a flat page of sections, each section its own
card with the same `h3` heading the fold used, minus the chevron. Long sections (Development) keep
their internal structure unchanged. The page's index is the glance card (F10). The `?section=`
scroll-and-flash behaviour is kept — it was the only good thing the folds did.

### F10 — The four glance tiles open nothing
**Today:** Dues, Attendance, Family, Awards tiles are plain `<div>`s. The Family tile's foot
literally says *"Add one on Family & paperwork"* — the product knows the destination and writes it
as prose. Consequence: attendance appears three times on This season (tile, Development's Context
line, the Attendance fold) and none of the three is a door.
**Proposal:** every tile is a door. Dues → the Dues section; Attendance → the Attendance section;
Awards → the Awards section; Family → the Family & paperwork tab, Guardian contact section. Same
mechanism the Overview's tiles use. The medical-notes chip becomes a door to Safety (F15).

### F11 — The family season recap is a preview of an output, filed among the records
**Today:** between "Moments you logged" and Attendance sits a tinted olive panel with a blue border
and a small-caps title — a different visual language from every card around it — holding one
sentence and a "Preview" button. It is the coach's preview of what the *family* will read at
season's end; it is not a record of the season and it is not something a coach reads weekly.
**Proposal:** it leaves the middle of the list and becomes a single quiet row at the **foot of This
season**: an eye glyph, *"Preview what Avery's family will read at season's end"*, opening the same
preview in place. Same fetch-on-open, same component, same gate. The tinted box goes.

### F12 — One figure, two readings: "Paid" above, "$-945.15" below
**Today:** the Dues *tile* reads `Paid` for any balance ≤ 0; the Dues *fold header* prints the raw
signed balance through a formatter with no negative branch, so an over-credited family reads
`$-945.15` (dollar sign before the minus), and inside the fold the same figure is tinted *good*.
"Manage dues →" also renders when there is no schedule at all.
**Proposal:** one currency treatment for the whole page — negative balances read as a credit:
tile `Paid` / foot `$945.15 credit held`; section heading meta `$945.15 credit`; positive
balances unchanged. The Manage dues door renders only when there is a schedule. (The house
formatter in `lib/utils.ts` should gain the negative branch so no page writes this ternary again.)

### F13 — Tabs have no address
**Today:** tab state is local; reload returns to This season; Back does not undo a tab switch; a
link cannot name a tab; `?section=guardian` from anywhere lands on the wrong tab silently because
the fold it targets is not in the DOM. The Money hub, Insights and Skills & Goals all use the shared
tab bar, whose tabs are links with real `?section=` addresses for exactly this reason.
**Proposal:** the player page uses the shared coach tab bar with `?tab=season|details|family`
(default season), and `?section=` continues to scroll within the tab. One tab component in the
portal, not two; the underline turns olive like its siblings.

### F14 — A coach opening a player one at a time has no next
**Today:** the header has the back arrow and nothing else. There is no record-to-record stepping
anywhere in the coach portal. The workflow that wants it is real and weekly: log a measurable for
every player after practice; check every family has a contact before the season email; read
twelve development records before an evaluation.
**Proposal:** a **player stepper** in the header's trailing slot — `‹` `4 of 12` `›` — in the
coach's own roster order (the drag order), active players only, wrapping at the ends, **keeping the
current tab** in the URL so "log a measurable for each player" is ‹ › ‹ › without re-finding the
tab. Desktop shows the count; phone shows the two arrows beside the `?`. The stepper reads the
roster the page already fetches for the depth chart's sibling list; no new endpoint. Off-roster
players are reachable from the shelf only, as today.

### F15 — Safety is a fold, and the red chip that points at it is not a door
**Today:** the one warning chip on the glance card (`⚠ Medical notes`) is inert, and the notes it
warns about sit behind the closed Safety fold two clicks away.
**Proposal:** the chip is a door to Safety (F10 mechanism); Safety is flat (F09).

### F16 — The Details form is editable for coaches who cannot save
**Today:** every field on Details and Family & paperwork is a live input for every coach with
record access; only the head coach can save. An assistant sees editable inputs, types, gets a save
bar, and the server refuses. PII fields redacted for that assistant render as *blank editable
inputs*, which reads as "nobody filled this in".
**Proposal:** for a coach without roster-write, Details and Family render as read-only definition
rows (label / value, "—" for empty, *hidden* for redacted with a one-line note "Contact details are
kept to the head coach"), no save bar. The head coach keeps inline editing exactly as today.

### F17 — Awards can only count
**Today:** the payload aggregates awards to `{ total, byType }`, so the Awards section can list
"🏆 Player of the game ×2" and nothing else, though every award has a date and a game.
**Proposal:** list each award with its date and game (the rows already exist server-side). Small,
and it is the difference between a count and a record a coach would show a parent.

### F18 — Minor, recorded
- `adminNotes` is returned and writable but has no field; leave it out (a second private notes box
  is a question for the owner, not a bug).
- Attendance "unknown" sessions are excluded from the rate and the five boxes; the section should
  say *"n not recorded"* so the denominator is honest.
- "Moments you logged" shows the last N with no way to see all; add *"All n moments →"* to the
  Game-day log when the list is truncated.
- The recap's gate is `notes` alone; Development's is `notes || hasRecordAccess`. Not this project.

---

## 5. What the two screens look like after (the mockups are the spec)

**Roster (desktop):** `#` in data face · Player (name underlined-quiet, ★ ✚ beside it) ·
Positions (`Ace` / `P2` chip then field positions, or a `+ Add a position` prompt) · Family (name,
email, phone as today, or `+ Add a contact`). Same five columns, same toolbar, same off-roster
shelf. Cells on the ladder. **Roster (phone):** two-line cards — name + `#n`; positions chip + tap-
to-call phone.

**Player page:** header gains `‹ 4 of 12 ›`. Glance card unchanged in shape; tiles and the medical
chip become doors. Shared tab bar with addresses. **This season** flat: Development · Attendance ·
Moments you logged · Awards · Dues, then the quiet recap row. **Details** flat: the form (or the
read-only record for non-writers), then Take off the roster. **Family & paperwork** flat: Guardian
contact · Safety · Guardians (when on) · Documents.

---

## 6. Open questions for the owner (Decisions tab on the hub)

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should the roster row carry a right-hand chevron so the row *reads* as a door, in addition to the underlined name? | **No.** The Family cell holds tap-to-contact links; a chevron invites a row click that would compete with them. Underlined name only. |
| Q2 | Attendance % on the roster list? (Re-opened on merit, not on the 08-26 reason.) | **No.** It is scanned per player, not down a list; the tile + section on the player page are one tap away via the stepper. |
| Q3 | Age / birth year on the roster? (Rep eligibility; the field is already fetched; PII-gated.) | **Not now.** Nobody has asked; add it if a coach does. |
| Q4 | Stepper order — roster (drag) order or alphabetical? | **Roster order.** It is the coach's own order and the list they just left. |
| Q5 | Dues section on This season, or tile → Money hub only? | **Keep the section.** The per-player ladder is the one place a coach reads one family's whole arithmetic. |
| Q6 | Read-only Details for non-writers (F16) in this pass, or later? | **This pass.** It is the same tab being rebuilt. |

---

## 7. Build sequence

1. **Roster list** — F02, F03, F04, F05(a)(b), F06, F08. No migration. Recipe-guard debt entry.
2. **Player page shell** — F13 (shared tab bar + `?tab=`), F14 (stepper), F10/F15 (tiles + chip as doors), F07 (roster prompts target the tab). No migration.
3. **Player page tabs** — F09 (flatten), F11 (recap to the foot), F12 (one currency treatment; formatter gains a negative branch), F16 (read-only record), F17 (award rows in the payload).
4. **Docs + demos** — `/docs` on the roster article and the player-record guide; the coach sandbox tour's player-page step narrates the folds — re-read and true up; `check:demos`.
5. `/simplify` → `/review` → owner QA walk on the hub.

**Layout baseline:** the roster loses no columns but the player page loses every `<details>`; expect
`check:layout` churn on `coach-roster` and `coach-player` and read it rather than re-record blind.

## 8. Risks

| Risk | Handling |
|---|---|
| Flattening makes This season long for a player with many measurables | Development's own expand-in-place rows are unchanged; the tiles are the index; measured today at ~2 desktop screens fully open |
| The stepper reads roster order from a second fetch | Reuse the roster GET the depth chart already calls; one request, cached per team |
| `?tab=` in the URL changes every existing deep link | Default stays `season`; every existing producer (`playerDevelopmentHref`) still lands where it did |
| The demo tour narrates the recap panel's position | Tour step text re-read in step 4 of the sequence |
| Read-only Details hides redacted fields | Says so in one line rather than rendering blanks |

---

## 9. Round 2 (2026-09-13) — five tabs, and Notes

**Owner rulings on reading round 1:** Development becomes its own tab ("that is where their
metrics will be and coach notes … can become pretty data intensive"); **Details is the first tab**;
a per-player **Notes** section exists as **its own tab**, and a general "Add a note" is allowed
(my recommendation, accepted). Tab name **Skills & Goals** (owner), matching the sidebar item.

**The rail:** Details · This season · Skills & Goals · Notes · Family & paperwork. Each tab answers
one question: who is this · what happened · how are they developing · what have we noticed · who
do I call. Default tab = Details; the glance card stays the index on every tab, which is what lets
Details land first without losing the mid-season answer; the stepper keeps the current tab.

### F19 — Development outgrows This season
**Today:** 698px on a light fixture, one of five things on a summary tab; Phase 2 of the
development lifecycle (`COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §"Player profile → Development", in
build this week by another session) adds attempts per test, observed skills, goal reviews and a
four-way view switch (Goals · Results · Observations · Previous seasons) INSIDE that section.
**Proposal:** a tab of its own named Skills & Goals; the view switch gets the tab's full width;
the "Context" block leaves (playing time → its own section on This season, Q9; attendance already
has one). Everything else inside Development moves unchanged. This season becomes the record tab:
attendance · playing time · awards · dues, recap row at the foot.

### F20 — Four places to write about a player, none to read them
**Today:** game moments (`rep_team_game_moments`, read on This season as "Moments you logged"),
skill observations (`rep_player_observations`, mig 295) and goal reviews
(`rep_development_goal_reviews`, mig 295) inside Development, and the undated
`rep_roster_players.notes` box ("Notes (private)") on Details. `admin_notes` has no UI and stays
that way.
**Proposal — the Notes tab:**
- One timeline, newest first, grouped by month: every dated entry about the player, each with a
  source chip that names and opens its origin (Game · vs Milton → the schedule; Skill · … →
  Skills & Goals; Goal · … → the goal; Note) and its author.
- **Written once, at its source.** Observations/reviews are recorded on Skills & Goals, moments at
  the bench, the general note here. The timeline is a merged READ of four tables; no duplication.
- **The pinned About note** = `notes`, moved from Details to the top of Notes. Same column, same
  1,000-char limit, same gate. No migration.
- **One general door:** "Add a note" — `observed_on` (default today), body (≤600 like an
  observation), optional `goal_id` / `event_id`. **One new table** (`rep_player_notes`, author,
  season-scoped like moments), RLS on the Development grant per mig 292's pattern; reads ride
  `notes`. Families never see the tab; the recap never reads it. The only migration in the project.
- Access: writes need the Development grant + `notes` (the goals rule); reads need `notes`.

**Trims to lower complexity (open questions):**
| # | Trim | Recommendation |
|---|---|---|
| Q7 | No separate Observations view in the player's Skills & Goals; observations read under their goal/skill and in Notes | Trim. **Needs the Phase 2 session's agreement** — drawn, not built; their plan currently lists four views |
| Q8 | `notes` box leaves Details → pinned About on Notes | Yes; no migration |
| Q9 | Playing time → own section on This season | Yes; it is a season fact, not a judgement |
| Q10 | No filter / search on Notes in v1; month groups + source chips | Yes; add on evidence |
| — | "Moments you logged" section retires; moments unchanged in capture/storage | Part of F20 |

**Privacy posture, stated once:** `DATA_DICTIONARY.md` records that development content stays
skill/goal-oriented (PIPEDA posture, no behavioural profiling). A dated free-text log is the surface
most likely to drift. Mitigations = the goals rules (grant, no family read, no recap read) + one
line on the tab + a help article saying what the log is for.

**Build sequence additions:** step 2 gains F19 (coordinate with the Phase 2 session on where its
view switch lands); step 3 gains Q9; a new **step 4 — Notes** (timeline read across four tables,
the general note's table + route, the About move); docs step covers five tabs + Notes, and the
demo seed gains two general notes so the sandbox's Notes tab is not empty.

**Round 2 hub screens:** 5 Details (landing) · 6 This season · 7 Skills & Goals · 8 Notes ·
9 Family & paperwork · 10 phone (This season today vs the Notes tab proposed). Decisions tab:
R2-1..3 accepted, Q7–Q10 open, Q1–Q6 still open.

### F21 — The view switch sits at the wrong end of its row (owner, round 2)
**Today:** List / Depth chart is right-aligned inside `.listToolbarEnd` beside Export; the left of
the toolbar is empty since the count was removed (08-26). Standard §3.9 puts the arrangement
control left and only the export pinned right; Schedule, Money and Insights already do.
**Proposal:** the toggle moves to the left end of the toolbar at every width (phone already reads
toggle-left / export-right via `.listToolbarEndSpread`). Export stays pinned right (house rule 2).
Recorded as R2-4 (accepted) on the hub.

### Round 2 revisions (owner, 2026-09-13, second pass)
- **F14 revised — R2-5:** the header control is `‹ 1 of 12 ▾ ›`: arrows step the roster in the
  coach's order (the sequential pass); the label between them is a dropdown of the same names in
  the same order (the jump). Phone: arrows only. The dropdown follows the "form selects are
  dropdowns" ruling — a trigger button opening a listbox, since the trigger must read the position
  while the options read names.
- **F17 revised — R2-6:** Awards is flat and shaped like the other summaries — award + count (the
  `byType` the page already receives) — with one door, "When each was given →", to the Insights
  awards log at this player. No dates carried on the page; **no payload change** (the earlier
  proposal to ship award rows is withdrawn).
- **F14 revised again — R2-5 final:** **dropdown only.** The combined `‹ 1 of 12 ▾ ›` was drawn and
  withdrawn (owner: "it goes left/right and is a drop down?"). The control is a *Switch player*
  dropdown in the header's trailing slot — roster order, active only, current player marked, keeps
  the tab — the same shape as the sidebar's team switcher; icon-only 44px on a phone.
- **R2-7 — Previous seasons is OUT OF SCOPE.** The Skills & Goals switch is drawn as Goals ·
  Results only; the archive is Phase 2 / history-in-place work and is untouched here.


---

## 10. What was built (2026-09-13) — verify against the code, not this

- **Roster list** (`roster/page.tsx`, the roster + listToolbar CSS blocks): the toggle leads its row (`.listToolbarView`, with its own ≤640 rules — the bare class lost to the base `.segChoice` form rule on source order until scoped as `.listToolbar .listToolbarView`); `.rosterNumTd` in the data face; `.playerNameLink` underlined at rest; prompts without the dash, with a leading +, linking `?tab=details&section=player` / `?tab=family&section=guardian`; the pitching chip in Positions via `pitcherRankLabel()` (new export in `lib/lineup-profile.ts`: "Ace" / "P2"…, rank fallback); `.rosterGripBtn` with a ≤768 floor; the phone card = the name link stretched over the card + a corner `.rosterCallBtn` rendered only with a phone on file (`tr:has(.rosterCallBtn)` makes room). Stale "Add Player keeps its word" comments corrected. `.rosterFlagPitch` and `.listToolbarEndSpread` deleted.
- **Player page** (`roster/[playerId]/page.tsx`, rewritten): tabs from `lib/coach-player-tabs.ts` (`PLAYER_TABS`; `resolvePlayerTab` — `?tab=` wins, else `tabForSection(?section=)`, else Details; `playerTabHref` keeps `return`), rendered by the shared `CoachTabBar` (which gained an optional `short` label and the `.coachTabShort/Long` swap at ≤640); every section is `CoachPageSection` (new: the collapse section's card + h3 + `?section=` scroll-and-flash, no fold; `title` optional); tiles are `Link.playerTileDoor`s and the medical chip a `.chipDoor`; the Switch player `<select className={playerSwitch}>` in the header's actions slot (guard entry re-pinned, `from: 'switchPlayer'`), its names riding the player GET (`roster: {id, name}[]`, active players in the coach's order — no second roster request); This season = Attendance (+ "n not recorded") · Playing time (fetched only when the tab opens, from the existing `lineup-analytics` route's `analytics.fairPlay` row for this player, lineups-gated; nothing on the player GET) · Awards (×count + `insightsSectionHref(base, 'awards')`) · Dues (credit wording; `formatMoney` in `lib/coach-register.ts` gained the negative branch "−$…"; Manage dues only with a schedule) · the recap row (`PlayerRecapPreview` restyled to `.recapRow`); Skills & Goals = `PlayerDevelopmentSection` unchanged inside `sectionId="development"`; Family = Guardian contact · Safety · Guardians · Documents, flat; non-writers get `RecordRow` definition lists (`.recordList`), "Kept to the head coach" where `rosterPii` is off. The bench moments left the player GET payload.
- **Notes** (F20): `296_player_notes_read_in_one_place.sql` (`rep_player_notes` + 5 RLS policies on the mig-292 predicate — registered in MANUAL_PROD_STEPS; dictionary entry written; snapshots at watermark 296); `RepPlayerNote`; db readers/writers beside `getOrgMemberDisplayNames`; `readPlayerNoteInput` in `lib/development-input.ts`; routes `roster/[playerId]/notes` (GET = the merged timeline via `lib/player-notes-timeline.ts` + authors + goal/event pickers; POST) and `notes/[noteId]` (PATCH, DELETE), gated on `canViewDevelopmentGoals` / `canWriteDevelopmentGoals` through `resolveDevelopmentPlayerContext(…, 'goals')`; `PlayerNotesTab` (the About note bound to the page form's `notes`; Add / Edit / Remove; months; chips; the foot line). Unit tests: `player-notes-timeline.test.ts`, `coach-player-tabs.test.ts`.
- **Around it:** four `coach-player-*` tab screens in the layout sweep; the demo tour's step 7 addresses `?tab=season` with re-narration (the recap row is not a `?section=` address); `MIDSEASON_PLAYER_NOTES` (two notes on the showcase player, dated by their games) seeded, re-anchored (`rep_player_notes.noted_on` shifts with the schedule) and asserted by `check-demo-coach`; help synced (§11).
- **Deviations from the mockups, flagged:** (1) the phone Switch player control is the native select under the title, not an icon-only button — a native select cannot be icon-only, and the sidebar's team switcher is the same shape; (2) Playing time carries no "by position" line — the fair-play rows carry no per-position counts; the report door covers it; (3) Q7 deferred (status line).
- **Layout sweep:** clean on the six screens for everything this pass touched. Pre-existing controls the sweep had never seen (they lived inside folds) are baselined with a written reason: Details' position-picker chips (30px), the A-squad star (26px) and three selects (37px) at 768; Documents' file input (35px) and Upload (38px) at 361/390/768. Named for `COACH_TOUCH_TARGET_DEBT_PLAN`.

### 10.1 The /simplify pass (2026-09-13, four lenses: reuse · simplification · efficiency · altitude)

Applied: the player GET stopped computing the whole season's lineup analytics for one player (the page asks `lineup-analytics` only when This season opens) and stopped shipping moments; the Switch player names ride the player GET instead of a second full-roster request; the page's local `clean`/`formatShortDate`/`tel:` copies became `cleanNamePart`/`playerName`/`telHref` (`lib/coach-roster-name.ts` — `telHref` is new, one stripping rule for the five places that had it inline and the one that had none) and `formatShortDate`/`formatShortInstant`/`todayLocal` (`lib/measurable-format.ts`); the tab gate is one table (`TAB_GATE`) read by both the tab resolution and the tab list; `pitcherSummary()` in `lib/lineup-profile.ts` says the pitching profile once for the chip and the record row, and `dropLegacyLineupProfileKeys` normalises `pitcher.rank` at the read boundary so no caller needs a fallback; `readPlayerNoteInput` gained create/patch overloads; the Notes tab is one section with the months inside it (`.notesMonthGroup`), the form is not a `?section=` address, months are memoised, an author the org no longer has reads "a coach"; `RecordRow` renders one `dd`; the Dues tile rides the money gate with its section (no "None set" for a coach who cannot see dues); `.playerNameLink`, the recap row and the notes' Edit/Remove compose one `.quietUnderline`; `.pageSection`/`.pageSectionBody` compose the collapse section's card; `.pageSectionBodyBare` replaces an inline padding; the tap floors are one ≤768 block on the page's own surfaces and the header's floor list gained `select`; the toolbar's view-switch rules moved onto `.listToolbarView` (the `.listToolbarEnd .segChoice` rules had no caller left) and the duplicate block went; the `.playerTabRail` wrapper went (the tab bar carries its own margins). The rendered sweep then found the roster's `+ Add a …` prompts and the off-roster shelf under the floor in the 641–768 band — both raised (F-23 / K-12) and the eight retired baseline keys pruned.

Skipped, with the reason: `.rosterPitchChip` and `.recordList` were NOT composed from `.playerPosChip` / `.commitFields` — both bases are declared later in the file, and at equal specificity the later declaration wins, so the olive would have lost to the grey and the label lane to the commitment grid; the copies stay, each with a comment saying why. A page-wide `.pageSectionBody button` floor was tried and withdrawn: it would have reached into the Skills & Goals section, which is the Development hub's component and carries its own baselined chips.

### 10.2 The /review funnel (2026-09-13 — tier high-risk: shared modules, a migration, coach write routes)

Deterministic gate: typecheck ✓ · lint ✓ (two pre-existing effect warnings, no errors) · check:css-selectors ✓ · unit tests ✓ (106 + the timeline's new case) · check:layout ✓ on the six screens (`coach-roster`, `coach-player`, `-season`, `-skills`, `-notes`, `-family`) · check:migrations / verify:changed stop at the standing dev-ahead schema parity (migs 292–296 pending on prod). Five finder lenses (correctness · security & multi-tenant · data & contract · concurrency & state · regression & blast radius): 10 findings → 10 after dedup → 4 confirmed and fixed, 4 refuted, 2 skipped.

- **Confirmed · High — a bench moment was dated by the UTC day.** The timeline sliced the moment's instant, so a 9:00 p.m. game filed its moment under tomorrow (and sorted and month-grouped it there). Now `orgDayKey()`; a unit case crosses the boundary.
- **Confirmed · High — Switch player dropped unsaved edits without a word.** The unsaved-changes guard intercepts anchor clicks and the browser's leave, and a `<select>` is neither. The dropdown now asks ("Leave without saving?") when the form is dirty.
- **Confirmed · Medium — a second tap on Save note could post twice** before React committed `disabled`. An early return on `saving`.
- **Confirmed · Low — a note could not be unlinked on edit.** The About picker on an edit offered only "Leave as is"; a note tied to the wrong goal had to be deleted and retyped. "Nothing in particular" on an edit now clears the link (the route already accepted `null`).
- **Refuted (4, concurrency lens):** a stale load / stale playing time / stale arrival / a lingering "Saved" flash after a player switch — all assumed the page keeps its state across `/roster/A → /roster/B`. It does not: the app router keys the page subtree by the dynamic segment's cache key (`layout-router.js`, `createRouterCacheKey(activeSegment)`), so a player switch remounts the page. Verified in the framework source, not the docs.
- **Skipped (2):** the shared confirm dialog's single resolver (a second `confirm()` before the first is answered orphans it) — pre-existing shared-component behaviour, not this diff's; the goal FK on `rep_player_notes` scoping to `(goal_id, team_id)` rather than the player — the app asserts the player (`assertGoalBelongsToPlayer`), the same precedent as mig 295's observations and reviews.
- **Not covered:** the rendered check was not re-run after the four fixes (a select option, a confirm dialog and two guards change no layout).

## 11. Help synced (the /docs pass, same unit of work)

`lib/help-content/coaches.tsx`: `recipe-add-player` step 4 distinguishes the free roster (pencil / trash) from the Premium roster (the name opens the page; removal is Take off the roster); `faq-premium-player-profile` now describes the glance card as doors, the five tabs, Switch player and the Notes tab (old vocabulary kept in `keywords`); `faq-premium-player-development` and `premium-development-player` say "open the Skills & Goals tab" and send attendance/playing time to This season; `premium-family-recap` and `faq-family-recap-preview` describe the preview line at the foot of This season; two new FAQs — `faq-premium-player-notes` and `faq-premium-switch-player`.

- **Commit-order note (2026-09-13):** the development lifecycle Phase 3 session re-took the coach-development marketing shot while this rebuild was in the working tree, so the PNG reflects the five-tab page. Whichever of the two commits second confirms the shot still matches HEAD (`npm run capture:marketing-shots -- --check`). Their ledger entry is §183.
