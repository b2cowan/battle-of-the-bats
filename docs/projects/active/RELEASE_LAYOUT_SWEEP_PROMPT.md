# The layout sweep before the next release — session prompt

> Paste into a fresh session on `dev`. Written 2026-10-13. **This session measures and reports.** It fixes nothing without
> the owner's word, changes no gate, and does not release. The `/release` session runs after it.
>
> **Why.** The tournament admin redesign's close-out (2026-10-13; archived plan §12.1) made this a condition of the
> release that carries its Stage 5: *"`check:layout` was never run on the late shared changes: the phone row's conflict
> chips (§301, the shared row reaches Results and the schedule), the portal-wide menu sheet cap (§302), and the
> volunteers' screens (§282, §6f 'Not run'). Both §301 and §302 say: run it before the release that carries them."*
>
> **Widened, on purpose.** Production is the 2026-10-10 release. Dev carries about 150 commits since, many of them on
> shared parts: the admin kit's windows, menus and record frames; the portal's toolbar and loading line; the calendars;
> the club money and scheduler kits. Only about nine of those commits say they ran this check, and `/release` doesn't run
> it. So:
> - **Part 1** is the close-out's three (required).
> - **Part 2** is every screen touched since the last release.
>
> If the owner wants Part 1 only, they will say so at the start.

## Before you start: ask the owner, and wait for the answers

1. **A quiet dev server.** No build session running, and no other browser tester. AGENTS.md: *"Do not launch a sweep
   against a server that is also being used for something else."* Ask the owner to pause the other sessions for the run.
2. **The dev server itself.** It is the owner's (`npm run dev`, which goes through `scripts/dev.mjs`, with network
   access). Check that `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` answers 200 and the log shows
   no Supabase `EACCES`. If the server has taken heavy browsing, ask for a restart first (the per-request memory drip,
   AGENTS.md's memory rule). Never restart it without the owner's word.
3. **The UAT sign-ins.** The sweep needs them present. `auth-setup` rotates every other session's sign-ins: run it only
   on the owner's word.
4. **Free memory.** The tool aborts below the floor (`scripts/memory-guard.mjs`). **An abort is a failure, not a pass.**
   It writes nothing, and the batch runs again after a restart.

## Read first

- `scripts/check-layout-invariants.mjs`, the header whole. Its rules:
  - Usage: `--only`, `--width`, `--theme`, `--dump`, `--list`, `--changed`, `--init`, `--prune`. **An unknown flag is
    refused.**
  - **The baseline has no theme** (it was recorded warm). A `--theme=dark` run is compared with `--dump`, never written.
  - **The tap floor is a touch rule** (361, 390, 768).
  - **`--changed` reads only the uncommitted working tree,** not the commits since a release. That is why Part 2 builds
    its own list.
- `scripts/layout-screens.mjs`, the screen list. `--list` prints it.
- `scripts/memory-guard.mjs`, AGENTS.md's "Memory rule", and `docs/agents/ops/AGENT_VERIFICATION_WORKFLOW.md`.
- The archived redesign plan, `docs/projects/archive/TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: **§12.1**, and §6c/§6f for what
  §301, §302 and §282 changed.
- The ledger sections **§282, §301, §302**, for the exact screens and widths each change reaches.
- Memory: `reference_verification_traps_index` (the layout gate and sweep traps; a sweep opener with no door measures the
  page behind it), `reference_probe_scratch_dir`, and `project_sheet_frame` (`check:layout --changed` on a shared
  stylesheet sweeps every screen and can abort on memory; use `--only`).

## Part 1: the close-out's three (required)

Map each change to its screen ids, from the ledger and `--list`, and say the list before running it:
1. **The phone row's conflict chips (§301):** the tournament schedule's views and Results, everywhere the shared row
   reaches.
2. **The portal-wide menu sheet cap (§302):** every screen with a toolbar menu or Filter sheet, in both portals (the cap
   is portal-wide).
3. **The volunteers' screens (§282):** the scorekeeper and the gate.

Run `--only=<those ids>` at **every width** (no `--width`), warm. Then run the same list with `--theme=dark --dump=<file>`,
plus a warm `--dump` to compare against. Report anything that appears only in Dark.

## Part 2: everything since the last release

1. **Production's commit:** read it from the release-history record and `origin/master` (2026-10-10 at the time of
   writing: `ed37ed1c`). Then list `git diff --name-only <that commit>..HEAD`.
2. **Map the files to screens with the tool's own rule:** a route's files select that route's screens. A shared file
   (the admin kit, the portal stylesheet, a shell, anything the tool treats as shared) selects **every screen on that
   side**. When unsure, widen; never narrow. Say the resulting list and the time it will take (about 3.4 seconds per
   screen per width on a warm server) before running.
3. **Run in batches by side with `--only`:** the coach portal, the club admin (money, calendar, venues, permits,
   schedules), the tournament admin, house league, the public and guest screens, and the marketing site. Warm, every
   width.
   - Check free memory between batches.
   - Restart the server between batches if memory has fallen, **on the owner's word**.
   - Then a Dark `--dump` pass of each batch, as in Part 1.
4. **Known coverage gaps:** screens the sweep has no id for, for example:
   - the New tournament and reuse wizard;
   - the public league schedule;
   - the public tournament schedule;
   - the fan app's screens.

   **Report them; don't add ids.** The screen list is the gate's, and changing a gate needs the owner's ask.

## What to do with findings

- **A NEW finding fails the check.** For each one, give:
  - the screen and width;
  - the rule;
  - the measured numbers;
  - **the commit since the release that caused it** (from the diff, by file);
  - a recommended fix.
- **Group them:**
  - (a) regressions from the commits since the release;
  - (b) older debt that this run surfaced;
  - (c) Dark-only findings.
- **Fix only on the owner's word.** Each fix is its own commit, with that screen re-run (`--only`) before and after. A fix
  to a shared part re-runs that whole side.
- **Never silence a finding.** No `--init`, and no baseline edit, to make a new finding pass. `--prune` (dropping entries
  now fixed) runs only on the owner's word, only from a complete run (never `--allow-partial`), and never on a Dark run.

## Hand-off

- Product-owner voice: what was swept (screens, widths, both themes, how long), whether it came back clean, and for each
  regression, what a person would see on which screen and phone or desk, and the fix.
- **Say plainly whether the release can go**, or what has to land first.
- **Record the result** on the TODO's tournament follow-up line ("Before the release that carries Stage 5: the layout
  sweep"), with the date and the outcome, so `/release` reads it there.
- List any fix commits for `/release`.

## Do not

- Run beside another session's build or browser testing, or restart the server or run `auth-setup` without the owner.
- Change `scripts/check-layout-invariants.mjs`, `scripts/layout-screens.mjs`, `scripts/memory-guard.mjs` or the baseline
  file (other than `--prune` on the owner's word). These are shared checks; a change needs the owner's ask in this
  session and its own commit.
- Release, push or merge.
- **Git:** use a private index and explicit pathspecs, build shared files as HEAD plus your own hunks, and commit only when
  the owner says.
