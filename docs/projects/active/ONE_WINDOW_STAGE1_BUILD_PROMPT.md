# One Window — Stage 1 build prompt (One look)

You are building **Stage 1 of One Window** in the FieldLogicHQ repo. The owner ruled every design question on
2026-10-18; this session builds, it does not re-decide. Read this whole file before doing anything, and re-read it
before you publish or commit (another session may edit it).

## Sources of truth (read these first)
- **Plan of record:** `docs/projects/active/ONE_WINDOW_PLAN.md` — §3 rulings Q1–Q16, §4 Stage 1, §5 guards.
- **PM brief:** `docs/projects/active/ONE_WINDOW_PM_BRIEF.md`.
- **Hub (drawings the owner ruled on, plus the Decisions tab):** https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48.
  Source `docs/projects/active/ONE_WINDOW_HUB.html`. Publish updates to the SAME file path so the URL keeps its history.
- **Design log entry:** `memory/design_decisions.md`, "2026-10-18 — ONE WINDOW FOR THE WHOLE PRODUCT".
- The census in the plan came from helper reads. Treat every count and claim as a lead, and open the cited code before
  you build on it.

## What Stage 1 changes (what the owner will see)
- Every admin form and question window (club and tournament) gets paper-tone fields (36px on a computer, 6px corners),
  the new widths (520 a form, 640 with side-by-side fields, 800 holding a table), 24px inside, and a tinted edge with
  no shadow. The dimmed page stays the themed tone.
- Every labelled field in the coaches portal, on pages as well as in windows, changes from small capitals to sentence
  case (the ClubKit label: 12px, 650, secondary ink). House league's labels too.
- Coach windows dim the page with the themed tone (`--home-scrim`) instead of black at 60%.
- Nothing about what any window asks or does changes. Stages 2–4 (behaviour, one question, strays) are NOT this
  session.

## Blocking gate (no code before all four are done)
1. **Confirm the plan against the code.** Open `KitDialog.tsx` + `.module.css`, `ClubKit.module.css` (fields),
   `coaches.module.css` (`.label`, `.input/.select/.textarea`, `.modalOverlay`), `house-league.module.css` (`.label`).
   Report anything the plan gets wrong before building on it.
2. **Ask the owner one question:** the club kit's required asterisk is red (`.required` → `--home-live`), against the
   2026-08-25 ruling that it is plain in the label's ink (feedback hub F06). Fixing it in Stage 1 also changes the
   club's PAGE forms. In or out? Do not change it unasked.
3. **Width audit, published before code.** List every KitDialog `form` caller (club and tournament; record-style
   windows are out per Q15) with its proposed size: 520, 640 (side-by-side fields) or 800 (a table, today's `wide`).
   Give one line of reason for each. Publish it on the hub as a new section of the Proposal tab ("Stage 1 · width
   audit"). For any form whose layout changes visibly at 520 (rows that would stack, a table that would squeeze), add a
   before/after specimen drawn at true size, Warm and Dark. Run `/design` on those specimens before the hand-off, then
   get the owner's OK on the list.
4. **Restate the PM summary** in the chat in five plain lines (what changes, for whom, what does not), per the
   repo's planning rule.

## Build (after the gate)
- `KitDialog.module.css`: `.form` 40rem → 32.5rem; add a 640 size (40rem) and expose it as a prop with a plain name,
  keeping `wide` at 50rem with its documented meaning (a form whose body is a table). Apply the audit's sizes to the
  callers. Head, body and foot side padding → 1.5rem. Panel border → `rgba(var(--blueprint-blue-rgb), .3)`; remove
  `--shadow-lg`. Question kind stays 26rem; scrim unchanged.
- `ClubKit.module.css` fields → `--white-05` fill, `--home-line-strong` border, 6px radius, 36px min-height on a
  computer (keep 44 at ≤768). `.required` only if the owner said yes in gate 2.
- `coaches.module.css`: `.label` → no uppercase, no letter-spacing, weight 650, `--text-secondary`. `.modalOverlay`
  background → `var(--home-scrim)`.
- Census every other FIELD-label class (grep `text-transform: uppercase` on label-like classes in form modules: house
  league, money, tryouts, settings…). Section labels and table headings are NOT field labels: leave them. List what you
  changed and what you left, with the reason.
- The tournament's four global-`.modal` windows and House league's own modals are Stage 4: do not move them now, but
  their labels follow Q1 if they use a shared label class.

## Guards
- Add a unit guard: the coaches' `.label` carries no `text-transform` and no `letter-spacing`.
- Add a unit guard: KitDialog's form has no `box-shadow` and its default max-width is 32.5rem.
- Keep `kit-dialog-foot-text-guard`, `kit-dialog-floor-guard`, `admin-overlay-guard` green (update rows if a layer
  moves; none should).

## Verify
- `npm run verify:changed`, then `npm run typecheck` (shared components change).
- `npm run check:layout -- --changed` on a sample of touched screens, Warm and Dark, 1280 and 390: at least three club
  admin windows (one 520, one 640, one 800), two tournament windows (Add game, Generate games), two coach forms on
  pages (Roster add player, a money form) and two coach windows. The whole-product sweep is for staging, not the dev
  server.
- Do not drive the browser for visual checks yourself: the owner does browser testing.

## Hand-off
- Publish a **QA walk** on the hub's QA tab (checkable steps, paste-back, the "Sign in as" card). One purpose: Stage 1's
  look. Steps pin to identities (a named window on a named screen), never to a figure that moves. Cover the club admin,
  the tournament admin and the coaches portal, in Warm and Dark, on a computer and a phone.
- Update the hub's stage strip with anchored facts only ("Built `<hash>` <date>"), the plan's status line, the TODO.md
  line, and the auto-memory file `project_one_window.md`.
- Offer `/simplify` (a new size prop is a new pattern) before `/review`, and offer `/review` after.
- Help docs: no article describes label case or window width, so `/docs` should not be needed. Say so explicitly, or
  offer it if you find an article that does.
- **Do not commit or push without the owner's OK.** When OK'd: stay on `dev` (re-check the branch), stage explicit
  paths only, put it in its own commit whose message says what changes on screen, then `git show --stat HEAD` to
  confirm only your files landed.

## Context you would otherwise miss
- The admin's frame carries BOTH `data-admin-kit` and `data-coach-warm-enabled`. A `[data-coach-warm-enabled] …` rule
  you write for coaches also reaches the admin. Check each new selector against both portals.
- The coach window's title is already Barlow 16/700, through the global h1–h6 rule. Do not "fix" it.
- `--white-05` is `--home-paper` in Warm and a 5% white wash in Dark: that is the paper-tone field in both themes.
- The Feedback window project (https://claude.ai/artifact/6GmRQkQ6HgdCKKwEPMwGmU) builds on each portal's window and
  follows this one. Do not build it here.
