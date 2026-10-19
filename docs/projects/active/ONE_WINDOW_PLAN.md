# One Window — implementation plan

**Status:** all sixteen asks ruled as recommended 2026-10-18 (owner paste-back; hub version 1). Plan written
2026-10-18. Stage 1 width audit published 2026-10-18 (hub version 3); its five calls S1–S5 ruled as recommended the
same day. Stage 1 committed `992243fb` 2026-10-18 after /simplify and /review; **owner walk ✅ passed 2026-10-19**
(30 of 30, no notes; hub QA tab, QA ledger §339). Windows that changed width on a click were ruled 2026-10-19 (the
two flows keep one width; a census found five more: a bill's tasks open over it, an allocation keeps its own width)
and built and committed `6e3222f8` the same day after /review; **owner walk 2 ✅ passed 2026-10-19** (14 of 14, no
notes; hub QA tab, QA ledger §339). Stage 1 is closed but for the layout check below. **Stage 2's gate was published
2026-10-19** (census, before-figures, asks A–D open on the hub; "Stage 2 gate" below); nothing built. Still open: the layout
check on the screens Stage 1 touched (runs on staging at the promote).
**Hub (walk, proposal, rulings):** https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48 · source
`docs/projects/active/ONE_WINDOW_HUB.html`
**PM brief:** `docs/projects/active/ONE_WINDOW_PM_BRIEF.md`
**Stage 1 build prompt:** `docs/projects/active/ONE_WINDOW_STAGE1_BUILD_PROMPT.md` (written 2026-10-18)
**Design log:** `memory/design_decisions.md`, entry "2026-10-18 — ONE WINDOW FOR THE WHOLE PRODUCT".
**Origin:** the Feedback window hub's F08 (https://claude.ai/artifact/6GmRQkQ6HgdCKKwEPMwGmU). That project builds
the feedback window on each portal's window, so it follows this one.

## 1. Problem

The admin's form window (`components/admin/kit/club/KitDialog.tsx`, built for Club Tier Stage 1 and adopted by the
tournament admin redesign) and the coaches portal's form window (`components/coaches/QuestionShell.tsx` over the
`.modal*` recipe in `app/[orgSlug]/coaches/coaches.module.css`) were built separately. The 2026-09-27 ruling put both
on the portal's `useDialogFloor`, which unified behaviour but not look. An older confirm (`components/FeedbackModal.tsx`
via `components/coaches/ConfirmProvider.tsx`) serves the coaches' asks, three tournament screens and thirteen club
notices. ⚠ It takes the COACH skin inside the admin, because `adminKitAttr` (`lib/admin-kit-marker.ts`) carries
`data-coach-warm-enabled` as well as `data-admin-kit`. House league and a few others were never moved onto either.

## 2. Census (2026-10-18, read from the code)

| Family | Club | Tournament | Coaches |
|---|---:|---:|---:|
| KitDialog `form` | 57 | 27 (8 record-style) | — |
| KitDialog `question` | 29 | 25 | — |
| QuestionShell | — | — | 32 |
| Hand-built `.modalOverlay` + `.modal` | — | — | ~44 (~17 without `useDialogFloor`) |
| FeedbackModal (via useConfirm or direct) | 13 (mostly notices) | 3 screens (~20 messages) | ~43 asks + 6 direct |
| House league bespoke modals | 17 | — | — |
| Global `.modal` / `.modal-overlay` | — | 4 | — |
| `window.confirm` | 3 | — | — |
| Other one-offs | LeagueCapUpgrade, 2 onboarding | NewRoomDialog | CloseSeason / StartNextSeason inline colours |

The admin has no `ConfirmProvider`; `useConfirm()` there would resolve true. Sheets (BottomSheet, SheetFrame), side
panels (Help, chat, plan) and menus are not windows here (Sheet Frame governs them).

## 3. Rulings (2026-10-18, all as recommended)

| # | Ruling |
|---|---|
| Q1 | Field labels are **sentence case everywhere a field is labelled** — windows and pages, both portals (ClubKit label: 12px, 650, secondary ink). |
| Q2 | Fields: paper tone (`--white-05`, which is `--home-paper` in Warm and a 5% white wash in Dark), 36px on a computer, 6px corners. |
| Q3 | Widths: 520 a form · 640 with side-by-side fields · 800 holding a table. |
| Q4 | 24px inside the window. |
| Q5 | The dimmed page is `--home-scrim` everywhere (not black at 60%). |
| Q6 | A tinted edge (`rgba(var(--blueprint-blue-rgb), .3)`), no shadow. |
| Q7 | No form closes on a stray tap; with something typed, ×, Cancel, the scrim or Back asks in the foot first (Keep writing / Discard). |
| Q8 | A sentence slot at the foot's left in every window (`footerStart`). |
| Q9 | A refusal line beside the button in every window (`.footReason`). |
| Q10 | 44px fields and foot buttons in every window on a phone, **measured** before and after (the 2026-08-19 rule). The windows' half of the owed tap-floor ruling only. |
| Q11 | One "are you sure" window: title, one sentence naming what happens, the answers; no icon, no ×. Three answers, a typed confirmation or a reason field use the same window. |
| Q12 | On a phone the question is a small centred card. |
| Q13 | Notices stop being windows: a bare Saved / Done → the save pill (`NoticePill`); news → the page notice (`PageNotice`, fades after 8s); an error stays until read. |
| Q14 | The strays join in stage 4. |
| Q15 | Rooms (`RoomShell`) and record windows (KitDialog `record` / `steps`) are out; they take the one window's fields and foot later. |
| Q16 | Coaches get their changes in the same release as the admin. |

**Amendments to Q2 (2026-10-18; committed `a4968498` the same day, owner walk §338 ✅):**
- **36px is exact, not a floor.** The club kit's one-line field is `height: 36px` (the phone's 44 still wins). As a
  floor only, nothing rendered at 36: a dropdown came out 39, a text box 40 and a date 42, so New allocation's Pay by
  date never sat level with the dropdown beside it (owner's screenshot). Compact boxes keep their own heights.
- **A box on a form table's raised ground is white, in Warm only** (owner, A Team's Own Payments ask A2, as
  recommended — https://claude.ai/artifact/VvKhccp22P49pzHdNMoZFa). On an open row, a group heading row, an open phone
  record or a group band, the paper-tone field IS the ground, so it showed only as its outline; there a box takes
  `--home-card`. A box on a white row keeps the paper tone. Dark is unchanged (a lighter wash on a darker row already
  stands off). Precedent: the toolbar select's card fill.

## 4. Stages

### Stage 1 · One look
What changes on screen: every admin form and question takes the paper-tone fields, the narrower widths, 24px spacing
and the tinted edge; every labelled field in the coaches portal (pages included) takes sentence case; coach windows dim
the page in the themed tone.

- `KitDialog.module.css`: `.form` max-width 40rem → 32.5rem (520); a new medium size 40rem (640) for side-by-side
  fields; `wide` stays 50rem (800, "a form whose body is a table" — already its documented meaning). Head, body and
  foot side padding 1.25rem → 1.5rem. Panel border → `rgba(var(--blueprint-blue-rgb), .3)`; drop `--shadow-lg`. Scrim
  unchanged (`--home-scrim`). Question kind keeps 26rem.
- `ClubKit.module.css` fields: `.input/.select/.textarea` → `--white-05` fill, `--home-line-strong` border, 6px radius,
  36px min-height on a computer (44 at ≤768 stays). `.label` unchanged (already the ruled label).
- `coaches.module.css`: `.label` → sentence case (no uppercase, no tracking), 650, `--text-secondary`;
  `.modalOverlay` background → `var(--home-scrim)`.
- House league's `.label` (uppercase) and any other field-label class found in the build's census follow Q1.
- **Per-window width audit:** every KitDialog form caller is checked at 520; those with side-by-side fields take 640,
  those holding a table keep `wide`. The audit list goes in this plan when done.
- ⚠ The club kit's `.required` paints the asterisk red (`--home-live`), against the 2026-08-25 ruling (feedback hub
  F06). Bringing it in line belongs here; **confirm with the owner at stage start** (it touches page forms too).

#### Stage 1 width audit — ruled 2026-10-18 (calls S1–S5, all as recommended; hub "Stage 1 · widths")
- **S1** The twelve red `ck.required` stars go plain (`color: inherit`), like the ~71 `repKit.req` stars already were.
  Reach: Invite someone 3, Message a family 2, Settings 2, tournament Teams 3, Web address 1, a question's choices 1.
  The families' sign-up forms (`register.module.css`) and the platform console keep their own red star unless ruled.
- **S2** A short table that fits at 640 keeps 640 (not the rule's 800): Manage a member, Ask the coaches, Payees, a
  sent email, New tournament in steps.
- **S3** Two panes side by side keep 800 with no table: both schedule generators, Close the year.
- **S4** Record windows (`steps` / `record`, and the read-first pencil `edit`) keep today's width on every path they
  open from: `medium` (640), or `wide` where they are today. Their edge, spacing and fields change with the rest.
  Guarded: `tests/unit/one-window-stage1-guard.test.ts`.
- **S5** The rest as listed. Totals — club 58: 520 ×23, 640 ×20, 800 ×9, kept ×6 (the Families record, found in /review); tournament 32: 520 ×13, 640 ×8,
  800 ×2, kept ×9. The per-window list with reasons lives on the hub (`S1CLUB` / `S1TOUR` in the hub's script).
  - **640 (`medium`):** Add a team · Manage a member · Add a permit, and the permit's loading / failed frames · Start
    the next season · The first season · Add an applicant · Add venue · Ask the coaches · Add an entry · Transfer · An
    entry (editing and read-only) · Payees · Add a line, and a budget line's loading / not-found frames · A payment
    received · Confirm received / Approve and pay · New message / Edit post · A sent email · Add division · Add game ·
    Rain delay · Import teams / games · New tournament from a past one · New tournament in steps.
  - **800 (`wide`):** Words your teams use (grows: its 620px table scrolled sideways at 640) · Close the year · New
    allocation · An allocation and its frames · New schedule · A bill (both) · Round-robin and playoff generators.
  - **Kept (records, `medium` unless already `wide`):** a permit, a venue (club and tournament), a team's bill, a budget
    line, the fiscal year, a game, a division (and New tournament's), a team, a link or file, a section, a question, a
    tournament.
  - **520:** every other form window (one column).
- **Found on the way.** Nothing reacts to a window's own width (every two-across row collapses by viewport), which is
  why side-by-side forms must say `medium`. Words your teams use carries its page spacing into the window (~56px and a
  rule above its first sentence): drawn as built, not changed. **Fixed 2026-10-18 after the owner flagged the
  space:** the band and rule are gone and its sentence runs the full window width (its 62ch page cap left a blank
  column beside it) at the Categories window's hint size and tone; its retired page heading went with them. Seven fields have rules of their own; in the build only
  the web address box drew its own colour and corners, and it now takes the kit field (paper, 36px, 6px; 44 at ≤768).
  The other six already wear `ck.input` / `ck.select` and only size it (the rain delay note, Import's toolbar select,
  `shareInput`, `countInput`, the tie-breaker cap, a hint styled as a label), so they took the paper tone with it.

#### Stage 1 — as built 2026-10-18
- **After /simplify and /review (same day):** the width is ONE prop, `size?: 'medium' | 'wide'` (the `wide` boolean
  retired with it, ~54 callers; BillRoom `size={wide ? 'wide' : 'medium'}`); the label recipe lives once, in
  `components/shared/FieldLabel.module.css`, composed by every single-class label (ClubKit, coaches, rep-teams, house
  league, onboarding, branding, bracket Home / Away, the handout's next step, the public site editor; the practice
  `.ppFieldLabel` composes it DIRECTLY — `composes` is not transitive under Turbopack); child-selector / `legend` /
  global labels and the coach budget's `.label` (re-inked by `.labelBad`) restate it. /review caught the Families
  record window, whose props come from a spread `shell` (`wide: true`, missed by the census and the guard): now
  `size: 'wide'`, and the S4 guard reads spread objects. Also brought to the 36px field: the permit window's multi-pick
  button, its remove ✕, and RepKit's read-only value box; the club toolbar select keeps the card fill (a toolbar
  control, not a form field); the aside's reserve and the save pill follow the 24px. Three more Title Case labels fixed
  (Contact email, Category & item, Period breakdown); the guard now fails on any Title Case label in either portal.
  Shared test helpers `filesUnder` / `openingTags` / `parseProps` in `tests/unit/_source-code.ts`.
- **⚖ Ruled 2026-10-19 (owner, at the walk): one flow keeps one width, the widest its steps need** — "I do agree but
  also want to test when it is ready". Two flows widened on a click, as the ruled list had them: a payment request
  (520) → Approve / Confirm received (640) in place, and New tournament's chooser (520) → its create or reuse step
  (640). Both now open at 640 (`RequestWindow` and the chooser take `size="medium"`). *Build call, not part of the
  ruling (put to the owner with the walk):* a question opened from a flow (Decline, Reverse) is its own window and
  keeps the question's width, as Q11's one "are you sure" window has it. Guarded in
  `tests/unit/one-window-stage1-guard.test.ts` ("One flow keeps one width"). Owner walk: the hub's QA tab, walk 2.
- **⚖ Ruled 2026-10-19, both as recommended (owner, by choice) — a census of every KitDialog the same day found five
  more windows that change width on a click**, of two kinds (verified at the swap sites):
  - *A small task on a big record* — a team's bill (`BillRoom`, 800 — always `wide` from `AllocationRecordWindow`) →
    Record / Confirm received (`RecordWindow`, 640) or Remind (`RemindersWindow`, 520) — **opens OVER the bill**,
    `raised`, mounted beside it; the bill stays behind at its own width. Built: `RecordWindow` is always raised (its one
    caller is the bill); `RemindersWindow` takes a `raised` prop (the Allocations tab's whole-club Send reminders stays
    on the form layer). Undo is a question and still hands off in the bill's place (not part of the ruling).
  - *Another record opened from inside one* — a budget line (640) → Allocate (New allocation, 800) or an allocation
    row; From the teams (520) → an allocation; a ledger line (640) → Open the allocation (800, or straight to a team's
    bill); a Budget vs. Actual statement row (520) → an allocation — **each record keeps its own width** (unchanged):
    the title, the back link and everything inside change, so the width change says "somewhere else".
  - Not in scope: stacked windows (Payees → New payee, a family → Message a family, New tournament → New venue are
    drawn over the window beneath, which stays), and a form ↔ question swap.
  - Guarded in the same test: no task window returns in the bill's place, Record and Remind are raised, and every
    allocation window is `wide`. Owner walk 2 (14 steps) on the hub's QA tab covers all three rulings.
  - **/review 2026-10-19 (owner: "review and commit")** — two lenses. Caught: on the **Allocations tab** (the one door
    that writes the window's place into the URL), closing a raised window steps Back onto the bill's addressed entry;
    Next's router reads that entry's `?allocation=…&bill=…` into the search, and the page took it for a new ask —
    the whole window would close and reopen (a loading flash, the "recorded" pill lost). This was `useBackStep`'s
    "owed" note ("until their pages tell their own address from a new ask"). Fixed in the page: an address naming
    the allocation already open is its OWN (`ownAsk`), so the window stays and the address is never
    `router.replace`d while it is open; the close's Back clears it. Other doors pass no address, so they were never
    exposed. Guard: `club-stage3d-screens-guard`. Also tightened: the bill guard now reads RemindersWindow's own
    `raised={raised}`, rejects `raised={false}`, and catches a task window returned or ternaried in the bill's place
    (mutation-checked: four regressions, all caught). **Follow-up, not built (Low):** after a payment is recorded the
    row's Record button becomes a chip, so focus returned to it lands on the page body — Tab is pulled back into the
    bill and Esc still works, but a screen reader loses its place (the old in-place swap remounted the bill, which
    focused its panel).
- `KitDialog`: `.form` 32.5rem; `size` prop (`medium` 40rem, `wide` 50rem); `--kit-dialog-side` 1.5rem on a computer and
  the 1.25rem it had at ≤640 (a phone form already fills the screen; the ruled drawing does not widen it); `.progress`
  shares the variable; tinted edge, no shadow on the panel and on the `aside` preview card.
- `ClubKit` fields: `--white-05`, `--home-line-strong`, 6px, 36px (44 at ≤768 kept); `.required` plain.
- Coaches: `.label` sentence case (650, secondary); `.modalOverlay` `var(--home-scrim, rgba(0,0,0,0.6))` (the
  fallback covers a missing theme attribute, where the token is undefined).
- **Q1 label census — changed:** house league `.label` (its kit layer folded into the base rule), rep-teams `.label`,
  branding `.label`, onboarding `.fieldLabel`, the bracket editor's Home / Away (`.teamLabel`, folded; column 35px →
  2.5rem), the admin `.form-label` re-skin (PDF settings), coaches `.ppFieldLabel`, `.lineupControlLabel > span`,
  `.gdMomentTag > span`, the development handout's legend and next step. **Copy:** 45 field labels written in Title Case
  in those classes were rewritten to sentence case (House league 23, team rename 1, coaches portal 21), plus one help
  answer that quoted "Best Position". Labels whose words come from a constant were not swept (the walk checks them).
- **Q1 census — left, with the reason:** the award window's field headings (`.formSectionTitle`, shared with twelve
  real section headings; the window moves in Stage 2); the bill room's facts (`.commitFields dt`, a room — Q15); chat's
  New room (paused; Stage 4); the feedback window (its own project); `TournamentAdminUI` `.label` (never rendered); the
  mock billing portal (a stand-in for Stripe's page); branding's Dark / Light group heading; every section label, table
  heading, eyebrow and stat caption; and outside the two portals — sign-in, sign-up, public registration, marketing,
  the platform console.

### Stage 2 · One behaviour
What changes on screen: coach forms stop closing on a stray tap, gain the foot sentence and refusal line, and get 44px
fields and foot buttons on a phone.

- `KitDialog` becomes the one window piece for both portals; its admin-only convention ends (a guard says so).
- `QuestionShell` becomes a thin wrapper over it. ⚠ The move must keep what the coach shell does today: its discard
  guard (`useDiscardGuard`, 24 callers), hiding the phone bar and locking scroll (`useOverlayOpen`). KitDialog renders
  in place (not portalled); check every coach mount for a containing-block ancestor.
- The ~44 hand-built coach windows move onto the shell (the ~17 without `useDialogFloor` first: they lack the Tab trap
  and the phone Back step).
- Tap floor (Q10): measure every window's fields and foot buttons at 390 before and after (`check:layout --changed`),
  record the figures here.
- ⚠ Naming: "Question" already names the coach FORM shell; the yes/no window takes another name in code.
- A foot sentence must be short at 520px, or it takes its own line above the buttons (drawn on the hub).

#### Stage 2 gate — census, before-figures and four questions (2026-10-19; nothing built)
Run from `ONE_WINDOW_STAGE2_BUILD_PROMPT.md`. Published on the hub, Proposal › "Stage 2 · windows": every window as a
call the owner rules by number (W1–W83, the hub's `S2ROWS`; not "B1…", because B is a question), the before-figures,
and asks A–D with a paste-back. **Open: A–D.** Build waits for them and for Toolbar Rules Stage 3's commit (shared files).
- **Census** (four helpers, the floor and scrim columns spot-checked in the code): 32 `<QuestionShell` renders in 24
  files; 51 hand-built windows (46 coach `.modalOverlay`, the desktop lineup setup included, and 5 tryout `.scrim`); 20
  coach + 5 tryout without `useDialogFloor`. **76 move** (2b 32 · 2c 23 · 2d 21) and **7 stay out**: the dues family
  drawer, the schedule event slide-over, the phone day list, the depth-chart player sheet, the practice station and
  block sheets, the groups room. **42 of the 76 hold typed words, and 16 of those close with nothing asking today** —
  shell: New payee (a `leaveGuard` only: ×, Cancel and Esc drop the name), Change a payment
  (`InstallmentScopeSheet`), the club proposal's "Ask for a change" (`ClubReviewCard`), `SessionSheet`, link-org's
  typed confirmation; hand-built: `GiveAwardModal`, `StartNextSeasonModal`, `RosterBulkAddSheet`,
  `BudgetItemManagerModal`, the dues settlement window, Set refund, `SentWindow`, `PromoteDialog`,
  `SaveAsTemplateDialog`, `DrillSheet`, `AwardIconPicker`. Staying out but a loss: the dues drawer's inline payment form
  is not counted in `drawerFormDirty` (W77; a small fix offered for 2d).
- **Corrections to the build prompt and this plan:**
  1. Q7 is not "the admin's behaviour": no `KitDialog` caller asks before closing except `MessageFamilyWindow` (in its
     foot) and `TournamentSetupWizard`, which asks in a SECOND question window ("Leave setup?" · Keep working · Leave,
     `lib/tournament-setup-words.ts`). The ask is built into the piece (ask A).
  2. The tap-outside wording collides (hub legend "with nothing typed it closes at once" vs Q7) → ask B.
  3. Q14 (design log: "the coach hand-built windows" join in stage 4) vs this plan's Stage 2 → ask C.
  4. Counts: `useDiscardGuard(` 28 sites in 23 files (13 in shell windows); `KitDialog` 147 renders in 69 files (club
     40 files / 89, tournament 29 / 58); hand-built without the floor 20 (the plan's ~17).
  5. `DrillSheet` HAS the floor (the prompt's 2c "high-risk" list misfiles it); its scrim and Esc still drop typed words.
  6. The dues settlement window is a statement and one decision, like the club's Close the year (a `KitDialog` form):
     recommended to move (W58), where the prompt had it out.
  7. Three wordings of one answer: Keep editing (`useDiscardGuard`), Keep working (New tournament), Keep writing (ruled;
     `lib/families-words.ts`). The foot ask says Keep writing; New tournament's stays until the admin forms join (A).
  8. The stakes sentence: `useDiscardGuard`'s `detail` names what is lost ("an amount and 3 payment periods"); the
     drawn foot says only "What you typed won't be kept." Default unless the owner says otherwise: the foot ask's
     sentence keeps each window's stakes where it has one.
  9. More guards key on `.modalOverlay` than the prompt lists: also `coach-award-edit`, `coach-schedule-phone-guard`,
     `coach-schedule-sheet-guard`, `one-window-stage1-guard`.
  10. No guard forbids a coach file importing `components/admin/kit` (coaches already import `components/admin`:
      `CoachPortalShell`, the attendance panel). `kit-dialog-foot-text-guard` already scans every `.tsx`, so each coach
      caller is held to "no sentence in `footer`" the moment it arrives.
  11. No shell window has a docked `alertdialog`; the docked confirms live in hand-built windows (Record money, the club
      request, dues).
- **Step 0 · before-figures — a SAMPLE, not every window.** The machine was shared with the release's layout check,
  another session's typecheck and a Club probe; a full pass through the shared dev server tripped the memory floor
  three times (each abort discarded, never read as a pass). Measured by a probe on the UAT coach team, Warm, never
  typing or saving: 12 windows at 1280 and 9 at 390, covering the shell, hand-built with and without the floor, and a
  tryout window. The shell's fields and buttons come from one shared rule (`.input` / `.btn`), so its figures stand for
  all 32; every window is measured after its move (the figure Q10 asks for). Raw figures: `.probe/ow2-gate/before.json`
  (gitignored).
  - **Phone (390):** one-line fields 35 (text, number) to 38.7 (dates, times; selects 37); 8 of 9 windows have a field
    under 44. Foot buttons 31.4–33.4 (Add player 41); 8 of 9 under 44. Define a metric already meets 44 throughout.
  - **Computer (1280):** text and number fields 35; selects 37; dates and times 38–38.7; the budget line's fields 36.6;
    the tryout session window 38.2–41.2 (its own stylesheet). Foot buttons 34 (a ledger line's links 38.8; Add player
    and tryouts 41). Q2's exact 36 is therefore a visible 1–3px change inside coach windows.
  - **A tap outside closed all 12 windows tested** (nothing typed).
  - **Widths off the ladder** (not in the prompt): the hand-built budget line form is 720 and the tryout session window
    460; each takes 520 / 640 / 800 when it moves, so 2c and 2d need a width call per hand-built window (the shell's
    are already 520 or 640).

### Stage 3 · One question
What changes on screen: every "are you sure" in all three areas looks the same; no browser grey boxes; Saved / Done
fade on their own.

- `ConfirmProvider` renders the question window; the coaches' ~43 `confirm()` calls keep their wording.
- Tournament: Schedule (~12 messages), Results, the bracket editor → questions, pills or page notices.
- Club: the 13 FeedbackModal mounts → `NoticePill` (bare saves) or `PageNotice` (news, e.g. `planUpdatedMessage`),
  the house-league delete-game confirm → question.
- `window.confirm` ×3 (rep-teams assistant coaches; shared library ×2) → question.
- Delete `FeedbackModal.tsx` + `.module.css`.

### Stage 4 · Strays join
- House league's 17 windows → KitDialog (forms and questions), losing the banded head and foot, the grey Cancel and the
  stray-tap close.
- Tournament: Registrations' two global-modal forms, Resolve facilities, Resolve locations (→ `wide`), chat's New room.
- LeagueCapUpgrade → question; the onboarding windows → KitDialog (the wizard chrome is not a window);
  Close season / Start next season inline colours → tokens; `PlayerDocumentsSection` gets a real dialog.
- The volunteer score sheet's desk card is checked against the one window.

## 5. Guards
- No `window.confirm(` anywhere (after stage 3).
- No import of `FeedbackModal` (after stage 3).
- `modal-overlay` / bespoke overlay class names only on an allow-list that shrinks to zero by stage 4.
- The coaches' `.label` carries no `text-transform` (stage 1).
- Existing guards stay: `kit-dialog-foot-text-guard`, `kit-dialog-floor-guard`, `admin-overlay-guard` (rows updated).

## 6. Verification
Per stage: `npm run verify:changed`, `npm run typecheck` (shared components change), `check:layout --changed` on the
screens the stage touched (the whole-product sweep runs on staging, per the dev-server rule). An owner walk per stage
(Warm and Dark, computer and phone), published as a checkable QA walk on the hub.

## 7. Rollout
- Ships with the Club release; coach-visible changes ride the same release (Q16). Coaches have no switch.
- No database change. Help articles describe what windows ask, not how they look; a help change is needed only if a
  window's words change (none planned). Demo tours point at screens; the build's demo-anchor check covers them.

## 8. Out of scope
Rooms and record windows (Q15). Sheets, side panels, menus. In-place foot confirms (the coaches' guarded delete row).
What any window asks, says or does.
