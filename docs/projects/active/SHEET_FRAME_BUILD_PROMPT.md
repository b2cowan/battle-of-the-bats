# Prompt — build the Sheet Frame, one step per chat

Paste everything below the line into a new Claude Code session in this repo, and replace `STEP` with the step to
build (1 to 5). Build ONE step per session.

---

Build **step STEP** of the Sheet Frame project. The owner ruled every decision on 2026-10-05 ("I agree with all of
your recommendations"), so this is a build, not a design round.

## Read first (binding)

- `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. Work on `dev`; stage explicit pathspecs only; other sessions share this
  working copy.
- The plan: `docs/projects/active/SHEET_FRAME_PLAN.md` — the rulings (D1–D6), what every sheet shares, the five steps,
  the guards, the defects and the step each closes. The hub
  (https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc, source `docs/projects/active/SHEET_FRAME_HUB.html`) holds the
  drawings, the measured facts (`sheet-frame/facts.json`) and the Decisions tab.
- `memory/design_decisions.md`, the 2026-10-05 entry "PHONE SHEETS: ONE FRAME, TWO LAYERS SORTED BY ONE TEST, THREE
  HEADS", and the 2026-09-23 drawer-layers ruling it rests on (the reasoning lives at `.lineupDrawerOverNav` in
  `app/[orgSlug]/coaches/coaches.module.css` and in `components/coaches/LineupSheetScrim.tsx`).

## The test that sorts every sheet

**Would a stray tap on the bottom bar lose something?** No → menu layer (on top of the bar, bar live, not modal).
Yes → form layer (covers the bar, bar out of reach of thumb, keyboard and screen reader, a 44px ×, the keyboard kept
inside, modal). Heads: a small-capitals label for a menu, a sentence title + × for a form, a record head (name +
context line) for a sheet about one record.

## Before you change anything

1. **Disagree out loud** if the code says something the plan does not; argue from what the code does. Every fact in the
   plan is a lead to verify.
2. **Check for parallel work on your step's files** (`git status`, `git log --since=<last week> -- <files>`). Steps 1
   and 2 are committed (`9ab32b23`, `91986b7c`; owner QA §264 and §266 PASSED). On 2026-10-05 a call-ups session was
   editing the lineup builder's Call up sheet, its guard and the lineup PDF (step 5 waits for that), and a
   notifications session was editing `CoachNotificationReader` (a step-4 sheet). `TODO.md`, the Owner QA Ledger and
   `lib/help-content/coaches.tsx` usually hold other sessions' uncommitted edits too — stage only your own lines in
   those (step 2 built `HEAD` + its lines and pointed the index at it: `.probe/sf2/stage-shared.cjs`). Never touch a
   file you did not change.
3. **Capture before.** Step 2's probe is the one to copy: `.probe/sf2/capture.mjs` (opens each sheet live at 390
   touch, records where focus lands on open, the hub's facts via `.probe/fc/sheet-lib.js`, a computed-style
   fingerprint of the sheet and every row inside it, a pixel clip, then Escape and a tap on the dim) and
   `.probe/sf2/diff.mjs` (before vs after, style and pixels); `.probe/sf2/keys.mjs` drives a keyboard walk. Recording
   focus-on-open found three defects step 2's plan never listed — measure it. ⚠ `sheet-lib.js` guesses a sheet's
   title from class names (`[class*="itle"]`), so it misreads the frame's `.label` — trust the fingerprint and the
   pixels, not `facts.title`. Capture every sheet your step touches, warm and dark. The shared frame is
   `components/coaches/SheetFrame.tsx`: the menu layer only so far — the FORM layer is step 3's to add — with a
   REQUIRED `opener` (the frame hands focus back to it after a tap on the dim; keep that contract in the form layer)
   and `SheetLabel` (the menu head). `CoachToolbarMenu` lends its trigger through an optional `triggerRef`. Re-sign
   stale logins with `npx playwright test --config playwright.config.ts --project=auth-setup -g "coach|org-owner"`.
   If the probes fail with "Jest worker encountered 2 child process exceptions", the dev server's render workers have
   died: stop it, delete `.next`, `npm run dev` again.
4. **Present the step's plan** in product-owner words (what a coach sees change, if anything) and a task list. If the
   step needs something the hub never drew, draw it first (an Artifact, true size) and ask; otherwise proceed.

## The steps (detail in the plan)

1. Promote one frame from the Tools drawer; every `drawerOnPhone` caller and the Ledger Filter sheet move onto it; the
   Filter sheet stops claiming `aria-modal`. Nothing visible changes — prove it with before/after captures.
2. The small menus: team and player switchers (menu label, card surface in dark), Print (label + role), the Schedule's
   view menu and Add event as drawers.
3. Game day: Note becomes a form; Who's here stays a menu; the portal dim, the height cap, contained scrolling,
   `--coach-foot-clear` instead of the hand-copied bar height; sort Score, Scouting and End-game by the test.
4. The record sheets (position picker, RSVP, player row menu, notification reader, Award sheet) onto the frame, looking
   unchanged; the position picker drops `aria-modal`.
5. Last: the lineup builder's drawers; Call up takes the shared form head; the three forms keep the keyboard inside
   (`useDialogFloor`, which also calls `useBackStep` — move the §219 guard with it); Copy from's × and the dims of Copy
   from and Save as template return focus to Tools (their Escape already does, since step 2).

## Done means

- The guards in the plan stay green or move their assertions with the step; `tests/unit/sheet-frame-guard.test.ts`
  gains this step's checks.
- `npm run typecheck`, focused lint, `npm run verify:changed` clean; the after-captures measured.
- `check:layout`: it runs in the SESSION's theme, and the UAT coach login may be saved in Dark — dark findings then
  read as new against the warm baseline. Re-run any screen it flags with `--theme=warm` before calling a finding
  yours. A diff touching a shell stylesheet widens `--changed` to ~250 screens and can trip the memory floor — scope
  it with `--only=<the screens your step touches>`.
- Offer `/simplify` (a new shared frame is a new abstraction) then `/review`; offer `/docs` if a coach-visible step
  changed a flow.
- The plan's Build record, the hub (stage strip and a QA Walk tab for a visible step, same file path, republished —
  the tab holds step 2's §266, PASSED: replace its walks with your step's own section and keep one-line records of
  §264 and §266 above it; give your walks a new storage key so old ticks do not carry over),
  TODO.md and an Owner QA Ledger section are updated. ⚠ Read the ledger's last § number RIGHT BEFORE you write your
  section — a parallel session took §265 while step 2 was building. Commit only when the owner says so.
- Shell traps that cost step 2 time: backticks inside `node -e "…"` EXECUTE, and heredocs drop backslashes — write
  edit scripts to a `.cjs` file with the Write tool (split/join, never `replace()` with `$`).
- Hand back in product-owner words: what changed for a coach, what was proved, anything found and not fixed.
