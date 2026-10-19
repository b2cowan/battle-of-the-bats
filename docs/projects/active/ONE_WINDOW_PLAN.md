# One Window — implementation plan

**Status:** all sixteen asks ruled as recommended 2026-10-18 (owner paste-back; hub version 1). Plan written
2026-10-18. Stage 1 width audit published 2026-10-18 (hub version 3); its five calls S1–S5 ruled as recommended the
same day. Stage 1 committed `992243fb` 2026-10-18 after /simplify and /review (Stage 1 and windows-keep-width on prod 2026-10-19, master job 282); **owner walk ✅ passed 2026-10-19**
(30 of 30, no notes; hub QA tab, QA ledger §339). Windows that changed width on a click were ruled 2026-10-19 (the
two flows keep one width; a census found five more: a bill's tasks open over it, an allocation keeps its own width)
and built and committed `6e3222f8` the same day after /review; **owner walk 2 ✅ passed 2026-10-19** (14 of 14, no
notes; hub QA tab, QA ledger §339). Stage 1 is closed but for the layout check below. **Stage 2's gate was published
2026-10-19** (census and calls B1–B9 on the hub, before-figures; **asks A–D ruled as recommended 2026-10-19**); **part
2a (the one piece) committed `ada213b3` 2026-10-19** after /simplify and /review ("Stage 2a — as built" below); walked with 2b. **Part 2b (the
foot) built 2026-10-19, /simplify and /review run the same day** ("Stage 2b — as built" below); walk A (2a + 2b) on the
hub's QA tab — **owner walk A ✅ passed 2026-10-19 (20 of 20, no notes; QA ledger §346)**. Still open: the layout
check on the screens Stage 1 touched (warm-theme sweep of the whole product ran on staging at the 2026-10-19 promote, master job 282, owner accepted its findings; the dark-theme sweep was not run, owner accepted the skip, run it on staging).
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

**Amendments to Q7 and Q14 (2026-10-19, Stage 2 asks B and C, as recommended; owner paste-back):**
- **Q7 · a tap outside a form does nothing, typed or not.** Only ×, Cancel, Esc and Back close it, and with words typed
  those ask in the foot. Q7's words had a tap outside ask too.
- **Q14 · the hand-built coach windows move in Stage 2**, not stage 4. House league, the tournament's old windows and
  the one-offs stay in stage 4.

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

#### Stage 2 gate — census, before-figures, A–D (2026-10-19)
Run from `ONE_WINDOW_STAGE2_BUILD_PROMPT.md`. ⚠ **Two sessions ran this gate in parallel; the owner chose this
plan's census to carry Stage 2** (hub Proposal › "Stage 2 · windows", section `census2`, calls B1–B8; published in
hub version 13 by the other session, which then took its own W1–W83 section off; its rows stay in
`.probe/ow2-gate/census.cjs`, gitignored, as a cross-check). Commits `957b6eea` and `366ad8eb` carry the census section.

**A–D ruled 2026-10-19, all four as recommended** (owner, AskUserQuestion, this session; the other session put the
same four to the owner with its own wording of D, superseded by the choice above). Design log entry of the same date.
- **A** the ask is built into the one window and turned on in the coach windows that ask today, the hand-built ones as
  they move, and Message a family; the club and tournament admin's forms get it as a last part, **2e**, each with its
  own idea of what counts as typed.
- **B** a tap outside a form does nothing, typed or not (amends Q7's words, §3).
- **C** the hand-built coach windows move in Stage 2: those with no Tab trap or phone Back first (2c, the five tryout
  windows with them), then the rest (2d), the practice page's last; records and sheets stay out (amends Q14, §3).
- **D** Close the season and Delete a budget line become the small centred question. The other seven small-card windows
  (Choose an icon, Export, Start next season, Upload a document, the month grid's two figure windows, Subscribe in your
  calendar app) become forms that fill a phone — the owner's D as worded in the parallel session and in the design
  log; B5 on the hub restates it for a tick. No new window shape.

**The census calls B1–B9 — ruled 2026-10-19, all nine as recommended** (owner paste-back; hub version 15): B1 one
sentence for every window's ask (not each window's own stakes words, the other session's default); B2 the five shell
windows that hold typed words and never asked ask too (ClubReviewCard's change request, New payee,
InstallmentScopeSheet, SessionSheet, link-org's typed confirmation — built in 2a); B3 the eight hand-built windows that
never asked ask as they move; B4 the drill sheet moves as a form and asks; B5 all seven other small-card windows fill a
phone (the owner's D); B6 four read and manage windows move in 2c and 2d; B7 ten stay out; B8 the rest as listed;
**B9, six windows the two censuses classed differently:** the season settlement MOVES as an 800 form (a statement and one decision, like the club's
Close the year — the other census's reading, adopted); a staff member stays out (a record that saves as you go); lineup
setup on a computer stays out (the phone sheet's panel); Set refund is a question (one pick, over the settlement);
Categories & items gets the ask while a name is being typed; the list pickers (Apply a template, Start this plan from…,
Groups from another practice) are forms that fill a phone, and tryouts' Which session is a question.

- **Census** (helpers, every floor / scrim / typed claim spot-checked in the code): 32 `<QuestionShell` in 24 files
  (13 call `useDiscardGuard`); 51 hand-built windows — 45 coach `.modalOverlay` renders, the desktop lineup setup, 5
  tryout `.scrim` windows. Part 2c: 15 coach + 5 tryout with no floor, plus 3 read windows (B6). Part 2d: 13 with the
  floor, plus the drill sheet (B4) and 4 read windows (B5, B6). Out: 10 (B7). Hub tables list every window.
- **Corrections to the build prompt and this plan** (both censuses):
  1. Q7 is not "the admin's behaviour": no `KitDialog` caller asked before closing except `MessageFamilyWindow` (in its
     foot) and `TournamentSetupWizard`, which asks in a SECOND question window ("Leave setup?" · Keep working · Leave,
     `lib/tournament-setup-words.ts`). The ask is now built into the piece (A); New tournament's moves in 2e.
  2. Hub legend vs Q7 on a tap outside → B. Q14 vs this plan → C.
  3. Counts: `useDiscardGuard(` 28 sites in 23 files; hand-built without the floor 20, not ~17.
  4. `DrillSheet` HAS the floor (the prompt's 2c list misfiles it); × and a stray tap still drop typed edits (B4).
  5. Three wordings of one answer: Keep editing (`useDiscardGuard`), Keep working (New tournament), Keep writing (ruled,
     drawn). The one window says Keep writing; the other two go as their windows move (Stage 3 owns `useConfirm`).
  6. Guards keyed on `.modalOverlay` beyond the prompt's list: `coach-award-edit`, `coach-schedule-phone-guard`,
     `coach-schedule-sheet-guard`, `one-window-stage1-guard`.
  7. No guard forbade a coach file importing `components/admin/kit`; `kit-dialog-foot-text-guard` holds every caller.
  8. No shell window docks an `alertdialog`; the docked confirms live in hand-built windows (Record money, the club
     request, dues).
  9. The dues drawer's inline payment form is not counted in `drawerFormDirty` (stays out; a small fix offered for 2d).
  10. Widths off the ladder: the hand-built budget line form is 720, the tryout session window 460; each takes 520 /
      640 / 800 as it moves.
- **Step 0 · before-figures (the 32 shell windows, `.probe/ow2/measure.mjs`, re-runnable; 27 opened at 390 and 26 at
  1280 — the club practice asks, the club review card and link-org have no data on the UAT team, and Player progress
  is phone-only).** Fields: text 35px, menus 37, dates 38–38.5, at both widths; Define a metric already 44 on a phone.
  Foot buttons: 34 on a computer, 31.5–33.5 on a phone (a ledger line's and a dues read window's 39). × 26×28.5 on a
  computer; the phone's ← 44×44. Controls under 44 at 390: 0–10 a window. The other session's sample of hand-built
  windows: Add player 41, tryouts 38–41, the budget line 36.6 (raw: `.probe/ow2-gate/before.json`). A tap outside
  closed every window tested.

#### Stage 2a — as built 2026-10-19 (the one piece; committed `ada213b3` 2026-10-19)
- **`KitDialog` is both portals' window** (header: "ONE WINDOW FOR BOTH PORTALS"; the "admin only" line is gone).
  New props, kept small because the Feedback build starts from them: `dirty`, `discardAsk` (a window's own sentence —
  Message a family's "Close without sending?"), `headerExtra` (a status mark), `openOn="panel"` (the coach rule: no
  phone keyboard on open unless a field asks), `ownType` (the caller's content draws its own type), and `back.label`
  optional (an unnamed level: the phone's ← and Back go up). Export `DialogCancel` (a Cancel that closes through the
  ask); the drawn words live once in `lib/window-words.ts` (`WINDOW_ASK`).
- **The ask:** ×, ←, `DialogCancel`, Escape and Back all go through one `requestClose`: busy holds; while it asks, the
  same way out again is Keep writing (focus goes back where it was); `dirty` asks; otherwise it closes. The ask takes
  the foot's sentence slot and its buttons ("Close without saving? What you typed won't be kept." · Keep writing ·
  Discard), hides the reason line while it shows, and a window with no foot grows one while it asks. Not an
  `alertdialog`, so the floor's Back means Keep writing rather than holding. A tap outside a form does nothing; outside
  a question it is the "no", through the same closer.
- **One page lock:** `useOverlayOpenIfAvailable` now returns whether the coaches portal's provider is there; inside it
  the portal's counter is the only lock (and hides the phone bars), elsewhere KitDialog's own count. The panel says so:
  `data-coach-window`, plus `data-kind` and `data-asking`.
- **`QuestionShell`** keeps its name and props, renders `KitDialog` kind "form" (`wide` → 640, `subtitle` → identity,
  `onBack` → an unnamed level, `raised` → 405), keeps the route guard armed while `!open`, and wraps its form in
  `.windowBody`. `scroll` is a no-op. Re-exports `DialogCancel` as `QuestionCancel`.
- **Layers:** a coach form now stands at 400 at every width (it was 200 on a computer). Order: window 400 < raised room
  401 (`RAISED_OVERLAY_Z`, rooms only now) < raised window 405 < question 410 < the global confirm 1000. The save pill
  rises over a coach window on the one piece: over a full-screen coach form on a phone (above its foot), over any coach
  window above 640 (`body:has([data-coach-window])`, beside the `.modalOverlay` rules, which stay for the hand-built
  windows). The admin's windows are not marked, so the admin page's pill stays under them.
- **Q2 · Q10 inside a coach window** (`.windowBody`, page forms untouched): the portal's own fields (`.input`,
  `.select`) are 36px on a computer; on a phone every one-line field and the legacy foot's buttons are 44px (the one
  window's own foot buttons already were).
- **The 2a shim** (`.windowBody .modalFooter`, allow-listed): a consumer's own foot strip is laid out as the window's
  foot until 2b moves its buttons into `footer` — pinned to the body's bottom, edge to edge, at the screen's foot on a
  phone, hidden while the window asks.
- **A window reads left to right wherever it is mounted** (`.panel` resets `text-align` and `white-space`, the coach
  `.modal`'s 2026-09-09 lesson).
- **Windows switched from the second-window ask to the foot:** GoalSheet, PlaceSheet, ReviewGoalDialog,
  RecordResultSheet, RecordObservationDialog, MetricDefinitionSheet, ScheduleEventForm, SponsorRoom ×2, DriveRoom ×2,
  New fundraiser, and Message a family (its own `asking` state removed; `keepWriting` / `discard` left
  `lib/families-words.ts`), and the dues panel's Add adjustment (it waited for Toolbar Rules Stage 3, committed
  `93b35b43` the same day). **Call B2:** ClubReviewCard (a change request typed and not sent), New payee (a name),
  InstallmentScopeSheet (amount, date or scope changed), SessionSheet (any of its facts changed since it opened,
  `snapshotEqual`) and link-org's Approve a club link (the typed team name) now ask too. `useDiscardGuard` stays for its
  15 other callers (hand-built windows) until they move or Stage 3 owns the confirm.
- **/simplify 2026-10-19** (four angles, scoped to 2a): a global `.btn` inside a coach window wears the admin's button
  face (`[data-coach-window] .btn` beside `[data-admin-kit] .btn` in globals.css — Keep writing / Discard, and Join a
  club's and Player progress's buttons, which were still the old display face); the ask's words moved to
  `lib/window-words.ts`; `QuestionShell`'s `leaveGuard.dirty` defaults to the window's own `dirty` (one source, not two
  that can drift; only New fundraiser keeps its own); `openOn="panel"` now leaves focus to the floor instead of
  repeating its rule; the phone save-pill rule joins the §227 `.modalOverlay` block (one measured offset); the 36px
  rule sits in a computer-only media query (no set-then-reset); the dead `data-kit-overlay` and stale comments went;
  the guard reads the tree once (879 → 550 ms). Left for 2b: dropping the no-op `scroll` prop from its 10 callers.
  Left as they are (guarded, a deeper refactor each): one counted page-lock module for the provider and KitDialog; the
  shim's side shadows.
- **/review 2026-10-19** (four lenses: the ask's state, blast radius, layers and rendered CSS, the page lock and
  lifecycle; findings verified in the code, two measured in a browser). Fixed: a window nested inside another (the
  event form's Add a place / Places) answered one Escape twice — the form behind asked too (the floor now lets the
  innermost `[role="dialog"][aria-modal]` own its keys; checked live); the ask's Discard stayed live while a save ran
  (Enter in a field still submits) — the ask now stands down when a save starts or the words are gone, and its buttons
  are busy-gated; the shim's strip hid a field the keyboard reached in a short window (now `scroll-margin-bottom` on
  the body's controls; measured 0 hidden at 1280×560 / 1280×430 / 390×844) and stopped short of a notched phone's
  foot (the strip now hands back the body's safe-area padding and carries it itself); the 36px rule clipped read-only
  `<span class="input">` values (now real inputs and selects only). Not changed, recorded: read-only coach windows no
  longer close on a tap outside (ruled, B and B8); the page pill can sit over the ask's Discard on a phone while a
  Retry shows (pre-existing geometry); a window with a level (`back`) does not ask on ← (no window has both today);
  admin overlays that each save and restore `body.style.overflow` (BottomSheet, HelpDrawer) can still unbalance
  KitDialog's own lock in the admin — true before 2a; `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (lines
  ~687, 754, 815) finds the hand-built money windows by `.modalOverlay` and the old ask words — update it when 2c/2d
  move them.
- **Guards:** new `tests/unit/one-window-stage2-guard.test.ts` (23 tests; 14 mutations, each turned it red). Updated,
  same meaning: `kit-dialog-floor-guard`, `club-stage3d-screens-guard`, `kit-dialog-foot-text-guard`,
  `ledger-parity-screens-guard`, `development-record`, `coach-practice-week-phone-guard`.
- **After-figures:** the same script, 2026-10-19 (`.probe/ow2/after-2a.*`; 27 windows opened at 390 and 27 at 1280 —
  the observation window needed a second try). **Phone:** one-line fields 44 and foot buttons 44 in every window that
  opened (were 35–38.5 and 31.5–34). **Computer:** fields 36 (were 35–38.5); a category picker 36.5 and a seconds
  stepper 40 keep their own sizes (their own classes, not the portal's `.input` / `.select`); foot buttons 34 (39 for a
  read window's links); × 32×32 (was 26×28.5). Still under 44 at 390, none a field or a foot button: a date field's
  calendar icon, a checkbox, two text links, two "More" disclosures (36.5), a "No one" chip (41.5 wide). **Layout
  check** (390 and 1440, Warm) on the six screens that open these windows: no new findings — after the shim's first
  version spilled 20 / 24px out of its wrapper (a negative side margin; now side shadows carry the strip's card and
  hairline to the edges). Screenshots for the hand-off: `.probe/ow2/shot-*.png`.

#### Stage 2b — as built 2026-10-19 (the foot; built from `ONE_WINDOW_STAGE2B_BUILD_PROMPT.md`)
- **Every shell window's buttons are the window's own foot.** `QuestionShell` passes KitDialog's `footer` (buttons only)
  and `footerStart`; 24 files, 34 `<QuestionShell>` windows (the census's 32, plus Club Tier 5c's "not received" ask in
  `ClubHandoffDoor.tsx`, another session's uncommitted file: its two-line foot move rides in that file and is committed
  with it, and Preview counted separately). A submit outside its form names it (`<form id>` + `form=`, the admin's idiom:
  14 forms, ids unique; Enter still submits). **No window had a sentence above its buttons**, so `footerStart` holds only
  the doors a window already had at its left: Remove goal / observation / result / review, Delete session, and Define a
  metric's Preview · Retire · Restore · Delete. ⚖ Kept as the walked two-ended row, not moved to the body's end (the
  rare-door ruling, amended 10-19, allows a two-ended row only if it stays one row at 390 — checked in walk A step C3
  with Remove showing: one row at 390, passed 2026-10-19).
- **A refused Save says why beside the button.** `DialogReason` in KitDialog (re-exported as `QuestionReason`) portals
  the reason into the foot's slot; in place where a window has no foot, or `inPlace` for one field's reason. /simplify
  made it the ONE refusal line: the club money kit's `FormError` is now a wrapper over it (its type, its mark in the
  foot; nothing it renders changed). Kept in place, on purpose: Places' row errors (about a row, not Done), Join a
  club's typed-name mismatch (one field), the load errors of the club practice questions (no foot until they load).
- **The 2a shim is gone** (`.windowBody .modalFooter`, its phone flex column, side shadows, `scroll-margin-bottom`), and
  the no-op `scroll` prop with it (12 callers, not 10: LineupCheck and the inning inspector passed it too), plus the dead
  `scrollPane` wrappers, `.phoneForm` / `.phoneScroll` (the observation sheet's docking), `.footSpacer`, `.sheetFoot`,
  `.footRemove`, and Define a metric's `.foot` rules.
- **The phone save pill rides the measured foot** (the 2a /review's note: it could sit over the ask's Discard).
  KitDialog reports its foot height (`onFootHeight`, a ResizeObserver; any caller may ask); `QuestionShell` keeps the
  stack of open coach windows and publishes the top one's as `--coach-window-foot`, only when it changes; a window with
  no foot publishes nothing (the pill keeps its resting height). The §227 rule reads it; its `:has()` carries the
  window's three marks so it outweighs the `.modalOverlay` rule when a coach window is open over a room.
- **Two things the window now does for a coach form:** the phone foot's button group fills the row (`.footEnd`, so the
  observation sheet's "Save & next player" can grow; no admin button grows), and a coach window's door at the left gets
  a 34px floor at a desk (a ghost Preview measured 26.5 beside Save's 34 once the old strip's stretch was gone).
- **/simplify 2026-10-19** (four angles): FormError onto DialogReason (one reveal-before-paint rule, not two); the pill
  bookkeeping out of the shared window into the coach shell; the root written only on a change and only by the top
  window; dead CSS, stale comments and empty wrappers removed; the club questions' "Keep it" is `QuestionCancel`. Not
  done, noted: a shell-made form id (useId through context) instead of hand-paired ids; a `remove` prop for the four
  sheets' Remove; an opt-in for the `.footEnd` grow.
- **/review 2026-10-19** (high-risk: four lenses, gate first). Fixed: the pill rule lost to the room's `.modalOverlay`
  rule when a coach window was open over a room (equal weight now, and later); the left door's first fix stretched it
  to a wrapped refusal's height in the admin's money windows (a floor instead, coach windows only); a footless window
  dropped the pill over its body's last line; typing in a window nested inside another quieted the outer window's
  reason (the body's capture now ignores a nested window's events — 2a's nested-Escape rule). Noted, not changed (low):
  the root is written twice on open (0, then the height) before first paint; a nested pair mounting in one commit would
  push child-first (only on a hot reload); a reason re-announces if a foot remounts; Enter in a one-field form while it
  asks still submits (as before). Found by the after-figures: the observation sheet's phone Save was 44, not its drawn
  56, since 2a (the window's `.foot button` floor outranked it) — restored.
- **After-figures** (`.probe/ow2/after-2b*.md`): 27 windows opened at 390, 26 at 1280 (the club practice questions, the
  club review card and Join a club have no data on the UAT team). Phone: one-line fields 44, foot buttons 44 (the
  observation sheet's Save 56). Computer: fields 36, foot buttons 34 (a read window's links 39), the left doors 34, × 32.
  **Layout check** (`check:layout`, 9 window screens × 4 widths, one page at a time after a memory abort): no new
  findings; 12 baseline tap-floor entries on the event form and the dues record no longer reproduce (not pruned: the
  baseline is shared).
- **Guards:** `one-window-stage2-guard` (SHIM emptied: no shell window draws a foot strip; submits name their form; no
  `scroll` prop; one refusal line; the measured pill and its weight), `kit-dialog-foot-text-guard` reads QuestionShell
  feet too (and knows the window's Cancel is a button), `modal-scroll-recipe-guard`, `bva-figure-doors-guard`,
  `coach-practice-week-phone-guard`, `club-stage3c-screens-guard`, `admin-overlay-guard` — each restated, none loosened.
- **Discard is red-tinted (owner, 2026-10-19, using 2b):** two outlined buttons were quieter than the lime Save they
  replaced, so the ask went unnoticed and a press on × read as "nothing happened". Discard is now `btn btn-danger` (Q11
  already rules a destructive answer red-tinted); Keep writing stays outlined and keeps the focus. Every window that asks,
  Message a family included. Guarded; hub drawing, walk A and Decisions updated (hub version 19).
- **Help:** two coach articles still say "Keep editing" (Money's forms; the discard question). The shell windows say
  "Keep writing" since 2a; the hand-built ones still say "Keep editing" until they move (2c / 2d) — /docs owed.

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
