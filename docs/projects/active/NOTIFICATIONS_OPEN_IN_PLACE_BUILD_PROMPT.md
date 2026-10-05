# Prompt — build Notifications Open in Place, one step per chat

Paste everything below the line into a new Claude Code session in this repo, and replace `STEP` with the step to
build (1 to 3). Build ONE step per session, in order: step 2 needs step 1's Done word, delete and destination words;
step 3 needs step 2's shared message block.

---

Build **step STEP** of the Notifications Open in Place project. The owner accepted all nine decisions on 2026-10-05
(round 3, "looks good"), so this is a build, not a design round.

## Read first (binding)

- `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. Work on `dev`; stage explicit pathspecs only; other sessions share this
  working copy.
- The plan: `docs/projects/active/NOTIFICATIONS_OPEN_IN_PLACE_PLAN.md` — the rulings (D1–D9), the facts the build
  stands on, the three steps, the guards, what is out of scope. The hub
  (https://claude.ai/artifact/X78EK19TCyba8wTLAfCfyZ, source `docs/projects/active/NOTIFICATIONS_OPEN_IN_PLACE_HUB.html`)
  holds the drawings at true size (screens 2–6 are the approved build target) and the Decisions tab.
- `memory/design_decisions.md`, the 2026-10-05 entry "A NOTIFICATION OPENS WHERE YOU ARE", and the 09-23 drawer-layers
  ruling (a phone reader is a MENU-layer sheet: the bottom bar stays visible and tappable).

## The three words (the heart of D3, D8, D9)

**Read** = seen (on open, or Mark all read, which now marks everything). **Done** = dealt with (Needs attention only;
the old "Clear"; the only thing that moves a row out of Needs attention). **Delete** = gone from your own list (any
notification; Undo for a few seconds; nobody else's copy and no request or payment is touched). Never let one of them
do another's job: Mark all read must never write `cleared_at`.

## Before you change anything

1. **Disagree out loud** if the code says something the plan does not; argue from what the code does. Every fact in the
   plan is a lead to verify.
2. **Check for parallel work on your step's files** (`git status`, `git log --since=<last week> -- <files>`). ⚠ The
   Sheet Frame project's step 4 moves `components/coaches/CoachNotificationReader.tsx` onto `SheetFrame`; this project's
   step 2 lifts that file's CONTENT into a shared block. Whichever lands second adapts to the first — never rewrite the
   half the other project owns. Never touch a file you did not change.
3. **Present the step's plan** in product-owner words (what a treasurer or coach sees change) and a task list. Build to
   the hub's drawings; anything the hub never drew (an empty drawer, an error, the Undo note's exact place on a phone)
   gets a picture first (an Artifact, true size) and a question.

## The steps (detail in the plan)

1. **The rules under every surface.** Mark all read marks everything (D9); a delete action with Undo in the shared feed
   and the trash in the coach reader (D3, no migration — a lost delete leaves the row, which is benign); Clear becomes
   Done on every notification surface and in help (D8); the admin pages' button names and the holding-payout notice
   carrying its request (D4).
2. **The drawer.** One shared message block; the split drawer replaces the bell's panel in both portals (list 380px,
   message pane 440px to its left, the light dim, selection, read-this-visit, Escape order, trash on hover and focus,
   Undo at the drawer's foot, settings gear, Load more, no "See all"); the old panel and its dead phone rules removed;
   rendered check at 1280 and 1024, warm and dark, with a long message.
3. **The admin's Notifications page** opens notifications (a `SheetFrame` menu-layer sheet on a phone, a dialog on a
   computer), then `/docs` and the QA walk.

## Done means

- The plan's guards are green; `tests/unit/notification-open-in-place-guard.test.ts` gains this step's checks.
- `npm run typecheck` (shared modules change), focused lint, `npm run verify:changed` clean (spelling + dictionary
  included). Restart the dev server before hand-off if the step added or deleted files or changed a shared module.
- Offer `/simplify` (step 2 adds a shared block and a new surface) then `/review`; offer `/docs` where a flow changed
  (step 3 runs it).
- The plan's Build record, the hub (stage strip, and a QA Walk tab for a visible step, same file path, republished),
  TODO.md and an Owner QA Ledger section are updated. Commit only when the owner says so.
- Hand back in product-owner words: what changed for a treasurer and a coach, what was proved, anything found and not
  fixed.
