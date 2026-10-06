# Prompt — build the Sheet Frame, one step per chat

Paste everything below the line into a new Claude Code session in this repo, and replace `STEP` with the step to
build (1 to 5). Build ONE step per session.

---

Build **step STEP** of the Sheet Frame project. The owner ruled every decision on 2026-10-05 ("I agree with all of
your recommendations"), so this is a build, not a design round — except where the code disagrees with the plan (below).

## Read first (binding)

- `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. Work on `dev`; stage explicit pathspecs only; other sessions share this
  working copy.
- The plan: `docs/projects/active/SHEET_FRAME_PLAN.md` — the rulings (D1–D8), what every sheet shares, the five steps,
  the guards, the defects and the step each closes, and the *Build record* of every step so far (read step 3's: it
  added the form layer this step builds on). The hub (https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source
  `docs/projects/active/SHEET_FRAME_HUB.html`) holds the drawings, the measured facts (`sheet-frame/facts.json`) and the
  Decisions tab.
- `memory/design_decisions.md`, the 2026-10-05 entry "PHONE SHEETS: ONE FRAME, TWO LAYERS SORTED BY ONE TEST, THREE
  HEADS" (with its 2026-10-06 addendum: a sheet may switch layer while open), and the 2026-09-23 drawer-layers ruling it
  rests on (the reasoning lives at `.lineupDrawerOverNav` in `app/[orgSlug]/coaches/coaches.module.css` and in
  `components/coaches/LineupSheetScrim.tsx`).

## The test that sorts every sheet

**Would a stray tap on the bottom bar lose something?** No → menu layer (on top of the bar, bar live, not modal).
Yes → form layer (covers the bar, bar out of reach of thumb, keyboard and screen reader, a 44px ×, the keyboard kept
inside, modal). Heads: a small-capitals label for a menu, a sentence title + × for a form, a record head (name +
context line) for a sheet about one record.

## Where the frame stands (after step 4)

`components/coaches/SheetFrame.tsx` has BOTH layers. The menu layer is the default; `form` (and `busy`) turn on the
form layer: `.sheet.form` over the nav, the dim raised with it, the nav hidden from thumb, keyboard and screen reader
(`useOverlayOpenIfAvailable`), and `useDialogFloor` — Escape, Tab kept inside, the phone's Back, focus home.
`aria-modal` follows the layer. The layer may change while the sheet is open (game day's Scouting, the Award sheet).
A REQUIRED `opener`: the dim and the floor hand focus back to it. `SheetLabel` is the menu head. `CoachToolbarMenu`
lends its trigger through an optional `triggerRef`. Step 4 added:
- **Its own dim** (`.dim` / `.dim.form` / `.dim.overWindow` in `SheetFrame.module.css`); the frame no longer renders
  `LineupSheetScrim`, so nothing on the frame reaches `coaches.module.css`. The builder's drawers still use
  `LineupSheetScrim` (Setup, Call up, Print, Save as template, Copy from) — a second copy of the same two colours,
  which step 5 retires by moving them onto the frame.
- **`ownsKeys`** — for a sheet with no trigger of its own: the floor in the MENU layer too, WITHOUT its trap
  (`useDialogFloor`'s `trap: false`: Escape, Back, focus in and home; Tab past the end closes it — owner ruling
  2026-10-06), and a pointer-down outside the dim and the sheet (a tap on the bar) closes the sheet first. Worn by the
  record sheets (the position picker, the Award sheet, the notification reader). The trigger-owning consumers (Tools,
  Filter, the two switchers, game day, the row menus) still answer their own keys with `useDismissable` — and Tools,
  Filter and the switchers stand NO back step (Back with one open on a phone leaves the page).
- **`overWindow`** — a sheet opened from inside a full-screen window: the screen's foot, 410 / 409, no overlay of its
  own. RSVP wears `form overWindow`; the depth chart's row menu `overWindow` alone.
- **`grabCloses`** — the grab line as a 44px Close (`.grab`), for a record head.
- `.sheetAnchor` is gone from `CoachesBottomNav.module.css`; only the More sheet wears that container now.

## Before you change anything

1. **Disagree out loud** if the code says something the plan does not; argue from what the code does. Every fact in the
   plan is a lead to verify.
2. **Check for parallel work on your step's files** (`git status`, `git log --since=<last week> -- <files>`). Steps 1–3
   are committed (`9ab32b23`, `91986b7c`, `5d036eeb`) and walked (owner QA §264, §266, §268 PASSED); the step-3 walk's
   two follow-ups too (`62f76580` + `b06d8483`; §269, §270 PASSED). Since 2026-10-05 a call-ups session has held
   uncommitted edits to the lineup PDF and its guard (step 5 waits for that). Notifications Open in Place is complete
   (`157adb69`, `fc889b4b`); its reader now stands on this frame (step 4, committed `2a304b52`, which also moved the
   install banner's guard off the two rules it retired). `TODO.md`, the Owner QA Ledger, `memory/design_decisions.md` and
   `lib/help-content/coaches.tsx` usually hold other sessions' uncommitted edits — stage only your own lines: build
   `HEAD` + your lines and point the index at it (`.probe/sf3/stage-shared.cjs`; `.probe/sf3/record-pass.cjs` anchors
   each edit on text present in BOTH `HEAD` and the working copy). Never touch a file you did not change.
3. **Capture before.** Copy the probe that fits the step:
   - **A step that should look unchanged** (step 4): step 2's `.probe/sf2/capture.mjs` + `diff.mjs` — computed-style
     fingerprint of every node and a pixel clip; the bar is "pixel-identical". It records focus on open, Escape, and a
     tap on the dim.
   - **A sheet that is meant to move**: step 3's `.probe/sf3/capture.mjs` + `diff.mjs` — the same, plus a Tab-out count
     and a per-node position histogram RELATIVE TO THE SHEET (content dx 0 = nothing inside moved).
   - **Put the dim tap OVER something that navigates** (step 3 tapped over the console's ← Back). A tap that falls
     through the dim is invisible to a probe that taps blank page; that is how step 3 found the game-day dim leaving
     the game.
   - `.probe/sf3/keys.mjs` walks the keyboard AND the Back gesture (history entries: one level per Back, none left
     behind); `.probe/sf3/review-check.mjs` shows how to prove a busy/failure path with no write (`page.route` held,
     then aborted); `.probe/sf3/menus.mjs` + `out-menus/` re-captures the frame's existing consumers against the last
     record — rerun it whenever the frame itself changes.
   - ⚠ `sheet-lib.js` guesses a sheet's title from class names — trust the fingerprint and the pixels, not
     `facts.title`. Capture every sheet your step touches, warm and dark; at 390 touch, and 768 where the bar shows.
   - Re-sign stale logins with `npx playwright test --config playwright.config.ts --project=auth-setup -g
     "coach|org-owner"`. ⚠ The dev server dies or gets replaced mid-session: "Jest worker encountered 2 child process
     exceptions", `ERR_ABORTED`, or "This game couldn't be opened" mean stop it, delete `.next`, `npm run dev` again.
     Check node process start times before blaming your code — another session restarted it under step 3 twice. If
     `npm run dev` exits with "Another next dev server is already running", the old server is alive without its
     wrapper.
4. **Present the step's plan** in product-owner words (what a coach sees change, if anything) and a task list. If the
   step needs something the hub never drew, draw it first (an Artifact, true size) and ask; otherwise proceed.

## What step 4 learned (apply it)

- **The UAT fixture is re-seeded under you** (team and game ids changed mid-session on 2026-10-06): take fresh
  before-captures of everything you will diff, including the frame's existing consumers — never diff against an
  earlier step's record. And it may lack what a sheet needs: no awards, no award types, no day with four events.
  Add what you need with a probe that marks its rows and removes them (`.probe/sf4/awardfix.mjs`, `dayfix.mjs`,
  `posfix.mjs` — the last restores the values it saved).
- **A shared component's guard is not only the frame guard.** Moving the openers broke `coach-reports-phone-guard`
  (the award row) and `coach-schedule-sheet-guard` (the attendance row), found only by the full unit run. Grep
  `tests/unit` for every line you change, not just the files you know.
- **Opening a notification is a write** (it marks it read): a probe that opens the reader answers `/api/notifications`
  writes itself (`ctx.route`). The admin's Notifications page re-lands on its own address as it arrives, so a probe's
  first `goto` can come back `ERR_ABORTED` — retry it.
- **A surface's phone form may be dead code.** Before sorting a sheet by the test, open it at 390: the day list's
  ≤640 rules had been unreachable since 2026-09-21.

## What step 3 learned (apply it)

- **A caller's own dismiss and back step must stand down while its sheet is in the form layer** — the floor stands its
  own history entry, and two entries for one sheet make Back take two presses. A layer switch hands the entry over in
  one commit (`useBackStep` takes the dead entry over). Game day's `useDismissable(overlayOpen && !sheetIsForm, …)` is
  the pattern; the plan records why the frame does not yet own this (deferred to the second form consumer — see step 4).
- **`useDismissable` re-captures its Escape restore target every time its `open` flag goes true.** A sheet whose layer
  toggles the caller's hook records an element INSIDE itself; pass `onEscape` that moves focus to the opener at once,
  before the sheet unmounts (game day's `closeSheetToOpener`). `rescueFocusTo` is not that — it only acts from
  `<body>`.
- **A host flag that mirrors a child's state must be reported on the child's UNMOUNT too**, not only in its handlers
  (the observation box, on a 900px crossing that remounts the sheet). Report closes IN THE HANDLER, never from an effect
  keyed on the state, or the floor's focus hand-back lands a commit late.
- **A busy gate covers every close path** — the dim, Escape and Back AND the × and every button that closes.
- iOS Safari does not focus a tapped button: name the opener from the tap (`e.currentTarget`), never from
  `document.activeElement`.

## The steps (detail in the plan)

1. Promote one frame from the Tools drawer; every `drawerOnPhone` caller and the Ledger Filter sheet move onto it; the
   Filter sheet stops claiming `aria-modal`. **Built** (`9ab32b23`).
2. The small menus: team and player switchers, Print, the Schedule's view menu and Add event as drawers. **Built**
   (`91986b7c`).
3. Game day: the form layer; Note and End game forms, Scouting a form while an observation is typed, Score and Who's
   here menus. **Built** (`5d036eeb`; follow-ups `62f76580` + `b06d8483`).
4. The record sheets: the position picker, the Award sheet, RSVP (a form over its window), the notification reader
   (both portals) and the player row menus onto the frame, contents unmoved; the frame's own dim, `ownsKeys`,
   `overWindow`, `grabCloses`. **Built** (`2a304b52`; owner QA §273). The Schedule day list is not a phone sheet —
   reported, not built.
5. Last: the lineup builder's drawers; Call up takes the shared form head; the three forms keep the keyboard inside
   (`useDialogFloor`, which also calls `useBackStep` — move the §219 guard with it); Copy from's × and the dims of Copy
   from and Save as template return focus to Tools (their Escape already does, since step 2). Plus whatever of the
   deferred frame-owned dismiss / `restoreTo` on `useDismissable` step 4 did not take.

## Done means

- The guards in the plan stay green or move their assertions with the step; `tests/unit/sheet-frame-guard.test.ts`
  gains this step's checks. The guard pins one-line implementations character for character — expect to move
  assertions when you simplify.
- `npm run typecheck`, focused lint, `npm run verify:changed` clean; the after-captures measured; `.probe/sf3/menus.mjs`
  re-run if the frame changed.
- `check:layout`: it runs in the SESSION's theme, and the UAT coach login may be saved in Dark — dark findings then
  read as new against the warm baseline. Re-run any screen it flags with `--theme=warm` before calling a finding
  yours. A diff touching a shell stylesheet widens `--changed` to ~250 screens and can trip the memory floor — scope
  it with `--only=<the screens your step touches>` (`--list` shows them).
- Offer `/simplify` then `/review`; offer `/docs` if a coach-visible step changed a flow.
- The plan's Build record, the hub (stage strip and a QA Walk tab, same file path, republished), TODO.md and an Owner
  QA Ledger section are updated. The QA tab holds step 3's §268 (W1–W3) and the follow-ups' §269 (W4) and §270 (W5),
  all PASSED: replace them with your step's own section, keep one-line records of §264, §266, §268, §269 and §270 above
  it, and give your walks a new storage key so old ticks do not carry over. ⚠ The ledger's § number has been taken
  by a parallel session twice mid-build (§265, §267) — read it at WRITE time (`.probe/sf3/stamp.cjs` is the pattern to
  copy: it appends the section with the next free number and stamps that number into the plan, brief, TODO and hub in
  one go). ⚠ Another session may republish the
  hub while you work: the publish is refused and hands you the live version — read it in full, merge, publish again.
  Commit only when the owner says so; the steps so far landed as `feat(sheet-frame): step N …` and then a
  `docs(sheet-frame): record step N's commit …` that writes the hash into the plan, brief, TODO, ledger and hub.
- Shell traps: backticks inside `node -e "…"` EXECUTE, and heredocs drop backslashes (a regex in a heredoc is mangled)
  — write edit scripts to a `.cjs` file with the Write tool (split/join, never `replace()` with `$`).
- Hand back in product-owner words: what changed for a coach, what was proved, anything found and not fixed.
