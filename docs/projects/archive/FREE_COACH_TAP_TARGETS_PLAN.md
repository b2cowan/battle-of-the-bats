# Free coach tap targets — plan

> Hub (mockup · brief · plan · rulings · QA walk): https://claude.ai/artifact/Rne2oGZjtLyKp2S74MXfJS
> (source `docs/projects/archive/FREE_COACH_TAP_TARGETS_HUB.html` — republish the SAME path).
> PM brief: `FREE_COACH_TAP_TARGETS_PM_BRIEF.md`. Prompt: `FREE_COACH_TAP_TARGETS_PROMPT.md`.
> Stage 0 drawn 2026-10-19 against `f1618c02`. **Q1–Q7 RULED by the owner 2026-10-19, all as recommended** (the hub's
> paste-back). Stage 1 built the same day — see §8. **✅ CLOSED 2026-10-19: owner walk §347 PASSED, 15 of 15, no notes; archived.**

## 1. Problem

The layout upkeep (`db628a34`, 2026-10-19) put the free coaches portal into the layout sweep (12 `free-coach-*`
ids, the UAT free coach on `scripts/seed-free-coach-fixture.mjs`). Everything measures clean except touch-target
size: **334 findings** at 361 / 390 / 768, none at 1440. They are not in the baseline, so every release sweep lists
them as NEW.

**Re-measured on staging 2026-10-19** (`UAT_BASE_URL=https://dev.fieldlogichq.ca`, 12 ids, 48 pairs,
`--dump=.probe/free-tap/stage0.json`): 334 findings, **0 unmeasured, identical key for key** to
`.probe/layout-upkeep/proof-free-2.json`. None of the target files changed between `7dc48b31` and `f1618c02`.

## 2. Census (grouped from the dump)

| # | Control | Today | Screens | Findings | Reach |
|---|---|---|---|---|---|
| 1 | Row Edit / Remove (`.iconBtn`) | 38×38 | Roster 144 · Schedule 60 · Fees 24 | 228 | free only |
| 2 | Roster "Drag to reorder" (`.handle`) | 30×38 | Roster | 6 | free only |
| 3 | Add player / event / fee (`.addBtn`) | 37 tall | Roster · Schedule · Fees | 9 | free only |
| 4 | Page help "?" (HelpButton in `.sectionHeadEnd` / `.headRow`) | 32 (≤760) / 34 | 5 tool pages + Notifications @768 | 31 | shared button, free holder |
| 5 | "Upgrade to Premium — free →" (`ScopeShelf .footerLink`, `CoachExploreCatalog .premiumCta`) | 40 | 5 tool pages + Explore | 18 | free only |
| 6 | "⇄ Fan view" (`components/shared/FanViewLink`) | 23 (41 wrapped @361) | Overview · Tournaments · All tournaments | 9 | **shared** with paid |
| 7 | See all → (`TeamHQ .hqTileLink`) 24 · Open → (`CoachExploreCatalog .openBtn`) 32 · Express interest (global `btn btn-ghost btn-sm`) 36 | | Overview · Explore · Teams | 9 | free only |
| 8 | Mark paid (`.markPaidBtn`) 32 · Undo (`.undoBtn`, aria "Mark … unpaid") 15 | | Fees | 9 | free only |
| 9 | Announcement subject 40 · Refresh 42 · Send 42 | | Announcements | 9 | **shared** (`AnnouncementEditor.module.css`) |
| 10 | Help "What's New" 19 · **"Search this guide" 42** | | Help | 6 | **every help page** |
| 11 | **The form behind every row** — inputs 40, Cancel/Save 42, Practice·Game·Event segments 34, "+ Add …" toggles ~22 | | Roster · Schedule · Fees, form open | **not counted** | free only |

228 + 6 + 9 + 31 + 18 + 9 + 9 + 9 + 9 + 6 = 334. Row 10's search box and row 11 are not in the prompt's table:
the search box is in the dump; row 11 was found reading the editors (`RosterEditor.module.css` :214 / :342,
`ScheduleEditor.module.css` :298 / :343 / :409, `FeeEditor.module.css` :530 / :603). The sweep never opens a form.

**Measured name room on staging @390** (probe `.probe/free-tap/real.mjs`): roster name column 156px; schedule 192px;
a fee name gets **112px on an unpaid row and 52px on a paid row**, against the 154px "Spring tournament fee" needs.

**What the paid portal does** (verified): roster — the name is the door, the whole row at ≤640
(`coaches.module.css` :4559), grip 44 at ≤768 (:4333) and hidden at ≤640 (:4542), removal is "Take off the roster"
inside the player; schedule — `CoachRow as="button"` opens `ScheduleEventSheet`, Remove (`GuardedDelete`) in its
foot; dues — "Record as paid" 44 at ≤768, a payment is removed from the receipt book; header primary + "?" 44 at
≤768 (:1498–1531, the "?" only 34 wide at 641–768 = F-21).

## 3. Rulings asked (recommendations on merit; the owner decides)

**Q1 — row actions (228).** **Recommend C:** the row's main area becomes one button that opens the in-place form
the pencil opens today; pencil and trash leave the row; Remove player / event / fee moves to the form's foot behind
today's confirmation; a chevron marks the door. A = keep the icons at 44 (no flow change; the name column shrinks —
roster 156 → ~130, a paid fee's name 52 → ~10). B = a real record per row (reads first, one pencil, autosave,
Remove in the foot, full screen on a phone): the house standard in full, but three new record windows plus
`CoachRowList`, which imports the whole 16k-line paid `coaches.module.css` into the free bundle, and a help rewrite.
**C's two said-out-loud gaps:** (1) §3.10 and the 10-19 One Window ruling D say a form fills the phone; C keeps
today's in-place fold (the free forms are named for One Window's later stages). (2) C drops the 2026-08-15
money-table idiom ("edit is a pencil plus the row", the pencil labelled "Edit" at ≤640) on these three free lists
for §3.10's row-list door (the row is a real button, chevron last).

**Q2 — roster reorder on a phone.** **Recommend the 10-12 ruling** ("the handle is the row's number where the list has
one, 44px at touch widths"): at ≤768 the jersey number is the 44×44 handle (hold 250 ms to drag via
`lib/hooks/useReorderSensors.ts`; tap → Move up · Move down · Cancel); desktop keeps today's grip. Alternative: hide at ≤640 like the paid roster (a phone-only coach can then
never reorder).

**Q3 — fees.** **Recommend:** Mark paid 44 on the row (the page's one-tap job); a paid row shows the Paid pill + the
door; "Mark unpaid" (today's Undo) in the fee's form beside Remove fee. Alternative (pairs with A): a bordered 44px
Undo on the row.

**Q4 — Add buttons.** **Recommend** 44 tall in place at ≤768. The free section shell has no header-actions slot, so
the paid page-header primary is a redesign.

**Q5 — shared parts.** **Recommend:** Fan view fixed in `FanViewLink.module.css` (44 tall tap box borrowed from the
space below by a matching negative margin, `.rowTapLink`'s method — type and layout unchanged; **paid change** — the
bigger tap area on the paid Overview live-event card and every paid Tournaments card; Stage 1 checks all five call
sites for 21px of room below, and where a next card sits closer the gap grows there); the
"?" made 44×44 from the free holders only (`team.module.css` `.sectionHeadEnd` + the Overview `.headRow`, matching
`.teamHeaderHelp` / `.pageHeaderHelp`; HelpButton itself untouched; no paid change); Announcements fixed in its
shared stylesheet at ≤768 (subject, Refresh, Send, Refresh contacts → 44; **paid change** — the paid page's nine
reason-less entries stop reproducing; prune only on the owner's word from a warm staging run); the free Notifications
"?" @768 is the paid `CoachPageHeader` F-21 debt → recorded against F-21 with a reason (1 key). Alternatives: leave
Fan view alone and accept its 9 with a reason; or also fix the paid header's 641–768 min-width now.

**Q6 — help page.** **Recommend** accepting the 6 free-help findings (What's New 19, Search 42) with a reason pointing
to `COACH_TOUCH_TARGET_DEBT_PLAN.md` — they are every help page's, admin included. The keys carry no fixture name.

**Q7 — the forms behind the rows.** **Recommend** fixing them in the same pass at ≤768: inputs 44, Cancel/Save 44,
segments 34 → 40 (with the 0.2rem frame, the control clears 44), toggles a 44 tap box. Proof by probe (one row opened
per editor). Adding an open-form screen to `scripts/layout-screens.mjs` only on the owner's word.

**No ruling needed (free only):** Upgrade to Premium 40 → 44 (both places); See all → 24 → 44 tap box; Open → 32 → 44;
Express interest 36 → 44 via a local class beside the global `btn-sm` (the global is never touched).

## 3b. /design check on the drawings (2026-10-19) — applied to the hub, proposals until ruled

Changed: Remove ends the form's body, the foot is Cancel · Save alone (10-09 / 10-19 rare-door rule), in the delete
look; "Mark unpaid" in ink (undoable); the number is the handle at every touch width (≤768) with Move up · Move down ·
Cancel; Mark paid wears the row's worded-action olive (09-29); every small link borrows its 44px tap box by negative
margin (no layout change — Fan view no longer adds ~20px); the door is a real `aria-expanded` button named "Edit
{name}". Named, not changed: the Paid pill's olive status tint; the other rows dimming while one is open (today's
behaviour, no rule either way); the free rows as gapped cards; where Mark paid sits on a phone row (open portal
question A11). Recorded on the hub's Design check screen, not in the design log.

## 4. Out of scope — named findings, not fixed here

- **The free editors' Save / Cancel** on an EXISTING record is drift from the 09-24 ruling (editing autosaves,
  creating asks). A behaviour change, its own job.
- **The free lists are gapped cards**; §3.10 says a row is not a card on a desktop. A list-recipe job (B would take it on).
- **The paid roster hides its grip at ≤640**, against the 10-12 reorder ruling. Reported, not changed.
- **The paid header "?" at 641–768** (34 wide) — F-21, `COACH_TOUCH_TARGET_DEBT_PLAN.md`.

## 5. Stage 1 — build (after the rulings)

Fix in the free editors' own stylesheets; shared components only where Q5 says; never the global `.btn-sm` nor
HelpButton's own size. Under C: `RosterEditor` / `ScheduleEditor` / `FeeEditor` rows get a door button (accessible
name "Edit {name}", `aria-expanded`, chevron last — a corner chevron at ≤640), Remove ends each form's BODY above Cancel · Save (the 10-09/10-19 rare-door rule; `GuardedDelete`'s look — 13px trash + red words at body weight; Fees' "Mark unpaid" beside it in ink), the help copy changes (`lib/help-content/coaches.tsx` :341
"use the pencil to edit and the trash icon to remove", plus the schedule and fees lines) → `/docs`.

**Proof** on the local dev server (product changes are not on staging until pushed) — only after asking whether
another session is using it: `--only=<the 12 free ids> --workers=1`, all four widths; the paid ids the shared changes
reach (`coach-announcements`, the paid Overview and Tournaments ids — find with `--list`); zero unmeasured; a probe
that opens one row per editor and measures the form. Then `/simplify` → `/review` → `/docs`; a ledger § walk on the
hub (next free § at commit time — §343 and §344 are taken).

## 6. Baseline policy (binding, from the prompt)

Never `--init` to pass. Re-key only an identical finding. Anything left is reported and accepted only on the owner's
word with a written reason. `--prune` only on the owner's word, from a complete warm staging run. Expected after the
build, if Q5/Q6 go as recommended: **7 accepted keys** (6 free-help + 1 free Notifications @768), each with a reason;
the paid Announcements entries become prunable. Every baseline change is listed in the hand-off.

## 7. Commit

On the owner's word; `dev`; explicit pathspecs; product change and records in separate commits; shared files as HEAD
+ exact edits. No push.

## 8. As built (2026-10-19, Stage 1)

**Rulings:** Q1–Q7 all as recommended (owner paste-back, 2026-10-19). Built the same day.

- **Rows (Q1 = C):** Roster / Schedule / Fees rows are one door button (`EditorRow.module.css` `.rowDoor`, each editor's
  own padding/radius beside it) opening the existing in-place form; pencil + bin gone; Remove player / event / fee
  ends the form's body above Cancel · Save (`.recordLink`, the delete look), same confirm. The door's accessible name
  is the row's own words (a visually hidden "Edit …" first) — an `aria-label` would have hidden the amount, the Paid
  state and the when/where from a screen reader (/review). Tournament games stay read-only rows.
- **Roster reorder (Q2):** the roster renders through the shared `ReorderList` / `ReorderRow` (the admin's reorder
  part — the portal's standard: hold 250 ms to drag, tap for Move up · Move down · Cancel, one move per open, focus
  back to the handle, a sheet ≤640 and a popover above), with a new optional `label` so the handle shows the jersey
  number. ⚠ **Visible desktop change, flagged:** above 768 the number sits beside the grip as plain olive figures,
  not in its tinted box (a one-player roster keeps the box — there is no handle). Its touch look is the portal's
  standard square (ink number, bordered), not the drawing's olive tint. `moveTo` lets only the LATEST order save
  revert, and reverts the order only (/review: a failed earlier save could undo a later move or drop a saved edit —
  a race that predates this build). ReorderList forgets a menu whose row left the list.
- **Fees (Q3):** Mark paid stays on the row, olive-outlined, 44 at ≤768; "Mark unpaid" (ink) + "Remove fee" (red)
  end the fee's form. **Found and fixed:** the Fee label field was squashed to 22px on every phone (a `flex: 1` basis
  in a stacked column) — now `flex: 1 1 auto`; staging before the change measured 304×22.
- **Q4/Q7:** Add buttons, fields, Save / Cancel, toggles 44 at ≤768. ⚠ The Practice · Game · Event (and Everyone / One
  player) pills are **44**, not the plan's 40: the sweep measures each pill, and a tap on the frame's padding misses.
- **Q5:** FanViewLink 44 min-height at ≤768 (the shared link knows nothing of its callers); `CoachRegistrationCard`
  drops its own 0.25rem gap at ≤768 (the free Overview / Tournaments lists and the paid Tournaments cards: the line
  under a card is ~17px taller); `CoachLiveEventCard`'s row borrows its own padding, so the paid Overview's live line
  keeps its height. The "?" sits in its own holder (`.sectionHelp`, `TeamSectionShell` + the Overview). Announcements
  44 at ≤768 in its shared sheet (the paid page's nine reason-less entries no longer reproduce — prunable on the
  owner's word from a warm staging run).
- **Free-only:** ScopeShelf + Explore Upgrade, Open →, See all → (borrowed overhang), Express interest (a local
  `.emptyAction` beside the global `btn-sm`).
- **Help:** the roster, schedule and fees lines rewritten (pencil / bin / Undo gone; hold the number, Move up / Move
  down, Remove at the bottom of the form, Mark unpaid in the fee).
- **Proof:** local dev server, 12 free ids + `coach-overview` + `coach-announcements`, 4 widths, workers 1 — 56/56
  pairs, 0 unmeasured, 334 → 7 (exactly Q5/Q6's accepted keys). `.probe/free-tap/forms-probe.mjs` opened one row per
  editor at 390/768 (nothing under 44) and drove the Move menu (closes on a move, focus home, order restored).
- **/simplify** (4 lenses): the shared reorder part instead of a fourth copy of the Move sheet; one door stylesheet;
  the tap-min token throughout; Fan view's caller-tuned margins moved to the callers; the label fix at its root.
  Skipped: a lazily-loaded sheet (negligible), padding rearrangements that would shrink the door.
- **/review** (standard; correctness · concurrency · blast radius): the door's accessible name (fixed), the reorder
  race (fixed), the stale menu (fixed), the paid live line growing (fixed), a stale test title (corrected). Left:
  a failed Remove from inside a half-edited form brings the form back with its saved values (pre-existing pattern);
  the reorder route writes row by row with no transaction (pre-existing, server); a 4-character jersey is tight in
  the 44px square.
- **Not done here:** the dev server needs a restart before browser testing (a new stylesheet; the restart was not
  permitted from this session).
- **Committed** `3e8f8950` (product, 23 files) + `cde47e21` (records) on `dev`, 2026-10-19, on the owner's word; not
  pushed. **Owner walk §347 ✅ PASSED 2026-10-19, 15 of 15 (W1–W4 all pass, no notes).**
