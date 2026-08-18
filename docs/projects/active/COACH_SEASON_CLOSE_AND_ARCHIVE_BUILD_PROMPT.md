# New-chat prompt — build "Closing the season"

Paste everything below the line into a fresh chat.

---

You are building **`docs/projects/active/COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`**. The owner design
session is **done and approved** (2026-08-18, mockup artifact `57e9bfd3`). Read the plan and its PM
brief first. **The mockups ARE the spec** (house rule) — do not redesign them.

## What is already decided, so you do not re-open it

- **Two states only.** A season is fully LIVE until closed; a closed season is ONE PAGE. There is no
  "winding down" state and no partial restrictions — plan §2.
- **Two doors out:** *Start next season* (exists) and *Close the season* (new, quiet, head-coach
  only, standalone teams only). A club-owned team gets neither — its club manages seasons.
- **Unsettled money WARNS, never blocks** (owner ruling). Naming what is outstanding is required;
  refusing to close is forbidden.
- **Reopen is the SAFE HALF ONLY** — offered when the team has no live season. Undoing an accidental
  rollover is **logged and deliberately not built**; its rule is in plan §3.4 and must not be
  implemented on the way past.
- **Four shelves, all collapsed, none of them linking into a live tool.**

## ⚠⚠ This CHANGES a standing ruling — read plan §1 and the parent's §9 before you touch anything

Design A (2026-08-16) said history is delivered **in place**. This replaces that with the one-page
archive. What is NOT changing: no season dial, no second nav, no thirty screens learning a year.
`HISTORY_ENDPOINTS` remains the mechanism — the two new reads (results, roster) join it as decisions,
each with its three questions answered at the list, exactly as the practices and money shelves did.
If you find yourself restoring `?year=` broadly across record screens, stop; that is the opposite of
this plan.

## The order, and the thing that ships last

1. **Close + reopen + the two warnings.** The season can end, and be un-ended.
2. **The page** — results and roster shelves beside the two that already ship.
3. **The deletion** — the 17 `isReadOnly`/`isRecord` branches, the 12 `CoachNotOnTeam` notices, and
   the between-seasons nav special case.

⚠ **Do not start with the deletion.** Removing the read-only branches before the page exists leaves a
finished season with neither. And ⚠ **the deletion is the measure of success, not the page** — a
change that adds the page and leaves 29 branches behind has done the expensive half and skipped the
valuable one.

## Argue from the code, not the prose

This repo's plans have been wrong repeatedly, and §1 of the plan you are handed exists **because the
design session found the shipped code contradicting the plan line** — "Close out the season" opens
the rollover dialog and closes nothing. If the code disagrees with the plan, the code wins: say so in
the commit and correct the plan in the same unit of work.

Two specifics already verified, so you do not have to re-derive them:
- Starting a season already sets the previous one to `completed`, copies the active roster into the
  new year, and optionally carries planned budget and a dues template with paid state stripped.
  Nothing is moved or deleted — every past-season record is retained.
- The counts in the plan (17 branches, 12 notices) were measured on 2026-08-17. Re-measure before you
  rely on them; other sessions are working in this tree.

## Where the risk is — plan §5

1. **The deletion is where defects will be.** Seventeen screens each give you a chance to remove the
   wrong half of a branch. The membership smoke's "no write control on a finished season" probes are
   the net — **re-aim them, never delete them**, as the surfaces they walk stop existing.
2. **Reopening moves what "current" means mid-session.** Anything cached client-side must not paint
   the old season. The practices shelf's stale-guard lessons apply directly — see the notes on it.
3. **Tryouts need a season**, so *Start next season* is the first real step of the year rather than an
   end-of-year formality. Do not let the nudge become pushy.

## Gates before you hand off

- `npm run verify:changed` per step; `npm run typecheck` (shared read modules).
- ⚠ The UAT fixture has a rolled-forward team and a between-seasons team, both repaired 2026-08-17.
  It needs **a closed season with no next one** to walk the reopen path — seed it, then
  `node scripts/seed-uat-coach-fixture.mjs` before `check:layout`.
- ⚠ A collapsed section is invisible to the rendered sweep. The shelves' OPEN state needs its own
  screen entry, as the practices and money shelves already have.
- Offer `/simplify` (this adds shelves to a page that already has two — duplication risk), **then**
  `/review`.
- `/docs`: the help guide describes a finished season across several topics and will be substantially
  wrong after this. Budget real time for it.
- Demos: the coach sandbox's 13U team is a finished season and is **on the demo path** — the tour's
  last step and the dock line both describe it. Check them against what the page becomes.
- Add one owner-QA ledger section. ⚠ The history sections **§39 · §40 · §42 · §52 · §53 were closed
  2026-08-17** — this changes what several of them describe, so the new section must say which of
  their claims it supersedes rather than leaving two accounts standing.

## Do not

- Build the accidental-rollover undo (plan §3.4). Logged on purpose.
- Delete any record, ever. This is a presentation change; the database keeps everything.
- Make the drill or plan-template libraries, the opponent book or the club book season-aware — those
  decided absences are untouched, and their tests must stay green.
- Reintroduce a season dial, a season chip, or a second nav.
