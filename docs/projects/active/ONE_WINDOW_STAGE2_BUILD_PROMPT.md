# One Window — Stage 2 build prompt (One behaviour)

> Paste into a fresh session on `dev`. Written 2026-10-19. Precondition: Stage 1 is committed `992243fb` (walk §339 passed
> 30 of 30) and "a window keeps its width" is committed `6e3222f8` (walk 2 passed 14 of 14); the Admin type sweep's
> `check:admin-type` gate exists. No migration, no API.
> **A production release (2026-10-19) is being promoted from `dev` right now. Commit locally. Do NOT push to origin
> until the owner says the release's staging sweep is done** (a push rebuilds staging mid-sweep). Stage 2 is not in
> that release.

**Read first (in this order).** `docs/projects/active/ONE_WINDOW_PLAN.md`: status header, §3 rulings Q1–Q16, §4 "Stage 2 ·
One behaviour", "Stage 1 — as built", §5 guards. `ONE_WINDOW_PM_BRIEF.md`. The hub, https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48
(source `docs/projects/active/ONE_WINDOW_HUB.html`): **read the live copy with the Artifact tool before you republish it**
(walk 2 and walk 1 are on its QA tab; publish to the SAME file path). `memory/design_decisions.md`, the entry "2026-10-18 —
ONE WINDOW FOR THE WHOLE PRODUCT". `docs/projects/active/ONE_WINDOW_STAGE1_BUILD_PROMPT.md` (the shape of a stage).
Then `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. CLAUDE.md sends broad reading to a helper and says a helper's claim is a
lead: open the cited lines before relying on it. Everything below marked "verified" was opened in the code on 2026-10-19;
everything marked "helper" or "verify first" was not.

## What the owner will see (plain language)
- A coach form no longer closes when you tap outside it. With words typed, ×, Cancel, Escape or the phone's Back asks first,
  **in the window's foot** ("Close without saving? What you typed won't be kept." · Keep writing · Discard), not in a second
  window over it. With nothing typed it closes at once.
- Every coach window has the foot's sentence slot (left) and puts a refused Save's reason beside the button instead of above
  the fields. No new wording: a sentence already sitting above the foot moves there.
- On a phone, fields and foot buttons in windows are 44px, measured before and after (the 2026-08-19 rule).
- The hand-built coach windows that never kept Tab inside or answered the phone's Back now do.
- Not changing: what any window asks, says or does; rooms (`RoomShell`), record windows and sheets (Q15); the "are you sure"
  window (Stage 3); House league and the tournament's old windows (Stage 4). Admin forms keep today's behaviour unless the
  owner orders sub-part 2e.

## Where the plan is wrong or thin (verified 2026-10-19 — re-open each line before you build on it)
1. **Q7 is not "the admin's behaviour" yet.** `KitDialog` (`components/admin/kit/club/KitDialog.tsx`) has no dirty ask: ×, ←,
   Cancel and Escape close at once with words typed. The one window found that asks in the foot is
   `components/admin/kit/club/families/MessageFamilyWindow.tsx` (:55–82 the `asking` state, :119–134 the foot), hand-rolled
   in the caller (a grep of `components/admin/kit/club` for Discard / Keep writing finds only it and SettingsKit's navigation
   question; grep ALL ~78 KitDialog callers, tournament admin included, before telling the owner so). The ask must be BUILT
   into the piece. Inert scrim on a form IS true today (KitDialog.tsx:245–247, question kind only).
2. **The hub contradicts itself on a tap outside.** The Stage 2 legend (hub :707) and Q7 (:1333) say "a tap outside … asks
   first"; F07 (:892, :1304) and the Q7 headline say a stray tap never closes a form. See owner question B.
3. **The hand-built coach windows are staged twice.** Plan §4 Stage 2 moves them now; the ruled Q14 (hub :1340, "All of them,
   in stage 4"), S4's row (:586) and F15 (:1312) put them in Stage 4, and plan §4 Stage 4 omits them. See owner question C.
4. **Counts.** `useDiscardGuard(` has 28 call sites in 23 files (the plan and hub say 24); 4 are `components/rep-teams/Tryout*`
   cards; it asks through `useConfirm()` (`components/coaches/useDiscardGuard.ts:36–49`), i.e. the FeedbackModal
   window (z 1000), not the foot. Hand-built coach windows: 45 render `modalOverlay` themselves (helper; matches the plan's
   ~44) + 5 tryout windows on a `scrim` class + the desktop lineup setup modal. **20 of the 45 have no `useDialogFloor`
   (19 files re-grepped), not ~17.** QuestionShell: 32 `<QuestionShell` uses in 24 files (verified).
5. **Layers are not the same stack.** KitDialog: 400, raised 405, question 410 (`KitDialog.module.css` :13, :23, :26). Coach
   `.modalOverlay`: 200 on a computer, 400 at ≤900 (`coaches.module.css` :4571–4580, :6611–6613), raised 401
   (`components/coaches/overlayLayers.ts:15`). The autosave pill (250, :9931) rises over a window only through
   `body:has(.modalOverlay…) .savePill` (:9972–9986): move a window to KitDialog and that selector stops matching, and a
   KitDialog at 400 covers the pill at EVERY width (a coach window stood at 200, below the pill's 250, at a desk, so the pill
   showed over it). Also tied to
   `.modalOverlay`: `SheetFrame.module.css` over-window layers (~:98, :131, :219–220: 389/409/410), `CoachRsvpSheet.module.css`
   :75, and guards `ledger-parity-screens-guard.test.ts:192` (pins QuestionShell's inline `RAISED_OVERLAY_Z`),
   `install-banner-layer-guard.test.ts:93`, `sheet-frame-guard.test.ts:275,434`, `admin-overlay-guard.test.ts`,
   `coach-practice-plans-phone-guard.test.ts:544` (`:not(.modalOverlay)`), `coach-schedule-*-guard`.
6. **Two page-scroll locks would fight.** KitDialog locks `body.style.overflow` itself with a module counter
   (KitDialog.tsx:100–113, :228). The coach shell registers with `CoachesOverlayProvider`
   (`lib/coaches-overlay.tsx:45–58`, :98), which also hides the phone bars and sets/clears the same property. Open order can
   leave the page frozen. One lock path, guarded.
7. **"Check every coach mount for a containing-block ancestor" is mostly moot:** QuestionShell and the hand-built windows
   already render in place with `position: fixed`. The real exceptions: `accounting/expenses/panel.tsx:8156` PORTALS the
   record form into the warm marker because the hub keeps panels mounted `display:none` under another tab (its note: never
   `<body>`, the palette hangs off `[data-coach-warm-enabled]`); consumers with `open={tabActive}`; a window mounted inside
   the phone bars (`position: fixed` + `backdrop-filter`) would be trapped (none of the census windows is: verify); and `--home-*` tokens
   exist only under `[data-coach-warm-enabled]` (`app/globals.css` ~:766, :1081): a window mounted outside it paints with
   undefined borders (check `coaches/link-org/page.tsx`, the free portal).
8. **Coach fields have no height rule.** `.input, .select, .textarea` (`coaches.module.css` :4936–4949) carry padding only, no
   `min-height`, no phone floor, and are shared with page forms. "36px exact" was the club kit's (plan Q2 amendment);
   the Feedback build prompt (another session, written today, not verified here) says a coach field measures 35px. Any
   rule must be scoped to fields INSIDE a window; page fields are not ruled here.
9. **The 390 measurement needs a probe.** `scripts/layout-screens.mjs` lists 390 as a width (`--width=390`), but has window
   openers for only a handful of coach windows; a probe in `.probe/` (gitignored; memory `reference_probe_scratch_dir`,
   `reference_probe_signin_without_browser`) must open each moved window.
10. **Props the coach shell has and KitDialog lacks** (verified by grep): `leaveGuard` ×7 callers (MetricDefinitionSheet,
    DriveRoom ×2, SponsorRoom ×2, fundraisers/panel, PayeesWindow NewPayee); `onBack` ×2 (PayeesWindow MergeQuestion :489,
    LineupInningInspector :332); `headerExtra` ×2 (LineupCheck, LineupInningInspector: a status mark between title and ×);
    `raised` ×2 (PayeesWindow); `subtitle` (→ KitDialog `identity`); `open`. `scroll` is a no-op (KitDialog's body scrolls),
    `wide` is `size="medium"`. The shell renders its children even when `open` is false only for the reload warning
    (QuestionShell.tsx:82–90): a wrapper that returns null would drop it for the hidden-tab forms.
11. **Where a coach foot lives.** Consumers draw `.modalFooter` inside their own `<form>`; KitDialog's foot sits outside the
    body. The admin idiom: `<form id="…" onSubmit>` in the body and `<button type="submit" form="…">` in `footer`
    (`InviteMemberDialog.tsx:155,161`). Docked `role="alertdialog"` confirms live inside `.modalFooter`
    (`coaches.module.css` :8604, :14977; GuardedDelete, expenses/club/dues panels, ScheduleEventSheet :1123): they are out of
    scope (plan §8) but their container moves, so re-check each.

## The gate (blocking: no code until all five are done)
1. **Say where the plan is wrong** (the list above, plus anything you find) in the chat, before work.
2. **Ask the owner these four in ONE message, with a recommendation each.** Do not reopen a ruling; these are the places the
   rulings are silent or collide.
   - **A · How far does the dirty ask reach?** Q7 reads "every window". Recommend: build the mechanism, turn it on in the
     coach windows that have a guard today (13 `useDiscardGuard` sites among the QuestionShell windows, plus the hand-built
     ones in 2c/2d) and Message a family; leave the ~84 admin forms to an optional sub-part 2e (each needs a "what counts as
     typed"). The owner may believe the admin already asks everywhere; it does not.
   - **B · A tap outside a form.** Recommend: does nothing, with or without words typed (what KitDialog does; F07).
   - **C · When do the hand-built windows move?** Recommend Stage 2 as the plan has it: the 20 with no floor first (they
     lack Tab and Back, and several lose typed words to a scrim tap), then the 25 with a floor; the 7 record/sheet-like ones stay out
     under Q15 (practice station and block sheets, groups room, the schedule event slide-over, the dues player drawer, the
     depth-chart player sheet, the dues settlement window); the 5 tryout windows join. If the owner says Stage 4, sub-parts
     2c and 2d wait and 2a–2b still stand alone.
   - **D · The windows that stay a small centred card on a phone** (`centeredOnMobile`: AwardIconPicker, CalendarSubscribeWindow,
     CloseSeasonModal, CoachExportButton, MoneyMonthGrid ×2, PlayerDocumentsSection, StartNextSeasonModal, the Budget "Delete
     line" confirm). KitDialog's form fills a phone; its question is the small card (Q12). Recommend: an actual question
     (Close season, Delete line) becomes `kind="question"`; the rest follow the census call on the hub. Add NO new variant.
3. **Publish the window census on the hub** (new section on the Proposal tab, "Stage 2 · windows", like Stage 1's width
   audit): every window in the sub-parts below, its sub-part, whether it has a floor / a guard / typed state, and a one-line
   call each (B1, B2 … so the owner can rule by number). Re-check the helper lists below against the code while you do it
   (the census came from helper reads; the floor column was re-grepped for 19 files). Run `/design` on anything drawn.
4. **Step 0 — measure BEFORE you change anything.** Tap floors at 390 and field/foot-button heights at 1280 for every window
   you will move, from a probe in `.probe/ow2/`; save the "before" figures (the plan's "as built" records before and after).
5. **Restate the PM summary** in the chat in five plain lines (AGENCY_RULES), including any visible change the rulings imply
   (for example coach fields inside a window going to exactly 36px on a computer, if they measure otherwise).

## The build, in sub-parts with a checkpoint after each
Checkpoint = `npm run verify:changed`, `npm run typecheck`, `check:layout` on the touched screens, the measurement figures
recorded, a five-line summary to the owner with a short "look at these windows" list; **commit (locally) only after the
owner's OK**, then start the next part. Tell the owner plainly which parts leave the portal half-moved and are not for a
promote on their own.

### 2a · The one piece, and QuestionShell as a thin wrapper
- **KitDialog learns the coach shell's duties.** (1) ONE page lock + phone-bar hiding: `useOverlayOpenIfAvailable(true)`
  (no-op in the admin) and skip KitDialog's own lock when a provider exists; guard it. (2) The in-foot dirty ask: a `dirty`
  prop; all close paths (×, ←, Cancel, the floor's Escape/Back at KitDialog.tsx:212, which `kit-dialog-floor-guard.test.ts`
  pins verbatim: update that row) go through one `requestClose`; while asking, the same key means Keep writing (the
  MessageFamilyWindow rule) and `useBackStep` keeps its entry (useBackStep.ts header: "Keep editing leaves the entry
  standing"); Cancel needs the same closer (a hook or a render prop); `busy` blocks all of it; the scrim stays inert. Foot
  copy as drawn on the hub (:982), "Close without saving?", with the sentence overridable per window (Message a family says
  "without sending", `lib/families-words.ts` :47–49) and Keep writing / Discard written once. Message a family drops its own
  `asking` state for it. The Feedback build starts from this API, so keep it small and describe it in the plan's as-built. (3) The props in finding 10.
  (4) End the "Admin only" convention (KitDialog.tsx:19 says it; read what `admin-overlay-guard` and the other KitDialog
  guards assume) and say so in the new guard; do NOT move the file (78 importers). No coach file imports
  `components/admin/kit` today: check no guard forbids that direction.
- **QuestionShell** keeps its name and its 32 call sites, renders KitDialog, keeps the reload-warning guard when `!open`, and
  maps `open`. Legacy `.modalFooter` children keep working through a scoped shim (so no consumer needs an edit to look right),
  that shim is allow-listed and shrinks to zero in 2b.
- **Layers and hooks (finding 5).** Re-point every `.modalOverlay`-keyed rule so a KitDialog in the coach portal is covered
  (`[data-kit-dialog]`), at every width; pick ONE raised value; update the pinned guards rather than loosen them.
- **Q10 inside a window only:** fields and foot buttons 44px at ≤768 (and, if Step 0 shows it, exactly 36px one-line fields on
  a computer), scoped by the window's `data-kit-dialog` attribute from `coaches.module.css`. Page fields untouched.
- The 13 QuestionShell windows that call `useDiscardGuard` today pass `dirty` instead (their `noun`/`detail` stakes sentence
  goes; the drawn foot sentence is generic: say so to the owner). **Do not delete `useDiscardGuard`**: whatever still calls it
  (the tryout cards, any skipped record window) keeps working until Stage 3 owns the confirm. Do not touch `ConfirmProvider`
  or `FeedbackModal`.

### 2b · The 32 windows adopt the foot (no invented copy)
Per window: buttons into `footer` (with `<form id>` + `form=`), an existing sentence above the foot into `footerStart`, the
held error into the reason slot (`KitReasonSlot`; the club's `FormError` portals into it: reuse it or a coach twin on the same
context, and mention it to `/simplify`), docked alertdialog confirms re-checked. Groups: money (PayeesWindow ×2,
LedgerLineWindow, InstallmentScopeSheet, SponsorRoom ×2, DriveRoom ×2, fundraisers/panel, budget-vs-actual ×2, the dues
adjustment window); development (SessionSheet, ReviewGoalDialog, RecordResultSheet, RecordObservationDialog, GoalSheet,
MetricDefinitionSheet ×2, history/development/panel, development/sessions/[sessionId]); schedule and lineups
(ScheduleEventForm, PlaceSheet, ManagePlacesSheet, ClubSlotParts ×4, ClubReviewCard, LineupCheck, LineupInningInspector);
link-org. LineupCheck and LineupInningInspector have no foot and no form: they only need `headerExtra`/`onBack`.

### 2c · The hand-built windows with no floor (20, plus 5 tryout) — only if owner question C says Stage 2
BudgetImportSheet, BudgetItemManagerModal, BudgetStarterSheet, GiveAwardModal, RosterBulkAddSheet, ScheduleImportSheet,
StartNextSeasonModal, PlayerDocumentsSection, roster Add player (`roster/page.tsx:955`, a hand-rolled confirm in
`requestCloseAdd` + route guard), the Budget line form and its Delete confirm, CloseSeasonModal, AwardIconPicker,
CoachExportButton (an Escape listener only), MoneyImportMenu, PastSeasonImport, SampleBudgetSheet, the schedule day list
(`schedule/page.tsx:969`, a sheet: likely stays), the lineup Apply picker, the depth-chart player sheet (a record: likely
stays); tryouts: TryoutCheckIn ×2, TryoutDayCard, TryoutEvaluatorsCard, TryoutRubricCard. Each is: pick KitDialog kind
(form / question per owner call D), keep its words, give it the floor, `dirty` where it has typed state, a scrim tap that does
nothing. **High-risk scrim losses first** (raw close with typed state): DrillSheet, GiveAwardModal, RosterBulkAddSheet,
StartNextSeasonModal.

### 2d · The hand-built windows that already have a floor (25; 6 of them are record or sheet-like and stay out)
DrillSheet, CoachStaffSheet, SentWindow and the Club request form (`club/panel.tsx` :546, :2203), GenerateInstallmentsModal,
the Record-money form (**portaled: keep the portal**, finding 7), Set refund, Send due reminders, PromoteDialog and Save as
template, _PracticeSendSheet, CalendarSubscribeWindow, DuesReminderPreviewModal, MoneyMonthGrid's two read windows (they
register no overlay at all: verify), the practice pickers. The practice plan editor's windows sit in a sheet-pair layout whose
CSS is keyed on `.modalOverlay` (guard :544): do them last, one at a time. Record/sheet-like windows stay out (Q15); list
each skipped window with its reason in the plan, and add the allow-list below.

### 2e · Admin forms get the dirty ask — ONLY on the owner's yes to question A
Per form: what counts as typed, `dirty` passed, nothing else changes. Not started without the yes.

## Guards (build-enforced; mutation-check each: break the source, watch it fail, restore)
New `tests/unit/one-window-stage2-guard.test.ts` (read sources with `tests/unit/_source-code.ts` helpers): QuestionShell renders
KitDialog and no `modalOverlay`; a KitDialog form's scrim does nothing; a dirty window asks in the foot and Cancel, ×, ← and
the floor's onClose share one closer; one scroll-lock path; the save pill and the sheet layers cover `[data-kit-dialog]`; no
coach file builds a window from `modalOverlay` outside an allow-list (RoomShell, the day sheet, each Q15 skip, anything the
owner deferred to Stage 4: every entry carries its reason, and the list only shrinks, the plan's §5 guard). Update, never
loosen: `kit-dialog-floor-guard`, `ledger-parity-screens-guard`, `modal-scroll-recipe-guard` (it reads QuestionShell's
`scroll`), `sheet-frame-guard`, `install-banner-layer-guard`, `admin-overlay-guard`, `one-window-stage1-guard`.

## Verify
- `npm run verify:changed`, then `npm run typecheck` (shared modules change). **Keep `check:admin-type` green**: it scans
  `components/admin/**` and `components/shared/**`, so new CSS in `KitDialog.module.css` is body face, sentence case, no
  800/900 weight (an allowed place carries a `type-ok: <role>` comment). The kit folder is also held to tokens only by
  `check:public-tokens`. A gate that goes red: first see whether it is red on a clean `HEAD` or because of another session's
  half-done edit, then report it; a check is report-only and never a mandate to change shared automation.
- `check:layout -- --changed --workers=1 --width=390` and `--width=1440` on the screens you touched, Warm; Dark for contrast
  only. **Never a whole-product sweep on the dev server** (staging does that). Do not drive the browser for visual checks;
  the owner walks. Measurement is a script, not a visual drive.
- KitDialog and QuestionShell are shared modules: restart the dev server (stop, then `npm run dev`; never a raw `next dev`)
  before handing the owner a walk.

## Hand-off
- **After the build:** offer `/simplify` first (a new prop family, a coach reason-slot twin, a closer hook: new abstraction),
  then `/review` (the dirty ask, the lock, the layers, the portaled form), then `/docs`: grep `lib/help-content/*.tsx` for
  "Discard this", "Keep editing" and any article that says a tap outside closes a form; offer `/docs` if one does. The coach
  confirm said "Keep editing"; the ruled foot says "Keep writing": grep both before adding a word.
- **QA walks.** Read `docs/projects/active/OWNER_QA_LEDGER.md` for the next free § (the last at writing is §340; other
  sessions add sections, so re-check). One purpose per walk, and each is a checkable QA group on the hub's QA tab (checkboxes,
  paste-back, the "Sign in as" note; parse the page scripts before publishing: memory `reference_hub_script_parse_trap`;
  a hub publish needs the live copy READ in full: `reference_artifact_publish_needs_full_read`):
  - **Walk A (after 2a, 2b): the coach forms behave like the admin's.** Steps pin to a named window on a named screen, never
    to a figure. As Premium coach `uat-coach@uat-test-org.local` (UAT Standalone Team): a player's record › Add a goal; Money ›
    Fundraising › New fundraiser; Money › Player dues › Add adjustment; Ledger › Payees › New payee; Schedule › an event's
    form (confirm each path exists on that account first). For each: tap outside
    (nothing), type, ×/Cancel/Esc/Back (the foot asks; Keep writing returns), Discard, a refused Save (reason beside the
    button), then at 390 the field and button sizes; Dark once. As club owner `uat-club-owner@uat-rep-club.local`: Families ›
    Message a family still asks the same way. Free coach `uat-free-coach@uat-free-coach.local` for any window the free portal opens.
  - **Walk B (after 2c, 2d, if question C said Stage 2): the moved windows.** Each opens, Tab stays inside, Esc and the phone's
    Back close only the top window, a tap outside does nothing, the pill still shows over an autosaving window.
  - Walk C only if 2e is ordered. A walk is never a gate for old work.
- **Records.** Plan: a "Stage 2 — as built" section per sub-part with the before/after tap-floor table, the census calls, the
  skips with reasons; update the status header and the PM brief if scope changed (AGENCY_RULES). `TODO.md` line (one line, no
  paths). The QA ledger §. The hub: stage strip with anchored facts only ("Built `<hash>` <date>"). `memory/design_decisions.md`
  ONLY if the owner rules something new (A–D): record it as ruled, nothing it did not rule. Auto-memory
  `project_one_window.md` + its MEMORY.md line.
- **Commit** only after the owner confirms: stay on `dev` (re-check the branch), explicit pathspecs only (never `git add -A`),
  one commit per sub-part whose message says what changes on screen, no push (release in progress), then
  `git show --stat HEAD` and confirm only your paths. `TODO.md`, the QA ledger and `design_decisions.md` carry other sessions'
  uncommitted edits: commit only your lines (memory `reference_partial_commit_shared_tree`: HEAD + your exact block in a
  temporary index, never a patch; Toolbar Stage 1's scripts are in `.probe/tb1/`).

## Rulings not to reopen
Q1–Q16 as recommended (plan §3), including Q7 "no form closes on a stray tap", Q8 and Q9 in every window, Q10 measured, Q15
rooms and records out, Q16 coaches ride the admin's release; the S1–S5 widths; the 2026-10-19 "one flow keeps one width".
Not this session: the question window and notices (Stage 3), the strays (Stage 4), the feedback window.

## Overlap with builds that may run in parallel (one shared working copy; verified 2026-10-19 except where marked)
- **Toolbar Rules Stage 3 (placement): real overlap, different regions.** Its own prompt
  (`TOOLBAR_RULES_STAGE3_BUILD_PROMPT.md`, written today) names the same files ("coach windows live in these panels"; for the stylesheet, "different regions, same file").
  Shared: `app/[orgSlug]/coaches/coaches.module.css` (theirs `.ppDrillFilters` ~:11624, `.club*` ~:14369–14400; yours the
  `.modalOverlay` family :4571–6675, the pill :9931–9986), `accounting/dues/panel.tsx` (their `duesToolbar` ~:2446–2548; your
  windows ~:1507–1567, :3119, :3591, :4680, :4879, :5013), `accounting/club/panel.tsx` (their state row ~:468; your :546, :798,
  :2203), `accounting/budget/panel.tsx` (their `When`; your Budget line form :3672, Delete :4394, guards :964/:987) and
  `components/rep-teams/TryoutCheckIn.tsx` (their check-in field; your walk-up window :578 and session picker :686, in 2c).
  Not shared: their Practice-plans toolbar files (`_DrillsView`, `_CircuitsView`, `_PlanTemplatesView`, `LibraryRow.tsx`),
  `history/{awards,results}/panel.tsx` (the award window is `GiveAwardModal.tsx`, a different file), the club Calendar, Schedule
  detail and Accounting pages. Rules: small unique Edit hunks only, no codemod or rewrite across the shared files;
  `git diff --stat <file>` before editing one; if the other session holds uncommitted edits in it, work other files first and
  do the money panels and TryoutCheckIn (2c/2d) after their commit. Both gates run the whole `npm test`, so one session's
  half-done edit can turn the other's gate red: say so before blaming your change.
- **Account-first Part 3: none.** `app/team/TeamSignupClient.tsx`, `app/api/auth/team-signup/route.ts` and its pages render no
  window (helper-grepped for the five window markers). Shared surface is only the whole-suite gate and the records files.
- **Feedback window: no shared file today; it builds on you.** Its build prompt
  (`FEEDBACK_WINDOW_THEME_BUILD_PROMPT.md`, written today) makes "One Window Stage 2 is committed" its precondition and says to
  stop if it is not. It will use your `dirty` ask (its A6), `footerStart`, and KitDialog outside the admin shell (a body
  portal wrapped in the themed roots), so your "admin only ends" guard must allow a KitDialog consumer outside
  `components/admin`. It edits `admin-overlay-guard.test.ts` (its `feedback` row) and `kit-dialog-*` guards, which you also
  touch: that is why it waits for you. Its widget (`components/feedback/FeedbackWidget.tsx`, global `modal-overlay`, z 1100)
  is not a window you move.
- **Families Stage 5b is committed** (`05eaa588`; the Toolbar plan's "in flight" note is stale), so `MessageFamilyWindow.tsx`
  is free to edit. Still run `git status` on it first.
