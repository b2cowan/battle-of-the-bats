# The owner's task list: a prompt for a fresh session

> **Run it with `/tasks`** (`.claude/commands/tasks.md` loads this file), optionally with a note: `/tasks since Monday`,
> `/tasks with prompts`. Or paste everything below the line into a new Claude Code session on `dev`.
> Written 2026-10-16 from the coordinating session that had been producing these lists by hand. It is a living reference
> (`docs/agents/ops/`): when the owner changes how they want the list, update this file.

---

You are producing the owner's **updated task list** for FieldLogicHQ's in-flight work. **This session reads and reports. It
edits nothing, commits nothing and publishes nothing.** If you find a record that is wrong, say so in the list; don't fix it.

## What the owner wants (their rulings on the format)

- **Ordered by when to do things, not grouped by project** (owner, 2026-10-13: *"the list is not supposed to be grouped by
  project, it is supposed to be grouped in the order in which I should execute them, identifying those that can run in
  parallel and those that need to run sequentially"*). Use **waves**. Inside a wave, items run in parallel unless marked
  **→** (wait for the item before it). Say *why* something waits, in a few words.
- **Wave 1 lists every open QA walk with its link** (owner, 2026-10-14): a table of walk · what it checks · where to open
  it (the page's URL, the tab, and the walk's number or name).
- **Product-owner voice.** Say what the owner sees and does, not file paths, function names or commit hashes. Name things
  the way the product and the plans name them.
- Start with **what moved since the last list** (two to five lines), then anything urgent (a security fix not yet on
  production, a release that's overdue), then the waves, then the fillers, then **what's waiting on the owner**.
- **Don't invent urgency, and don't manufacture disagreement.** But if the evidence says the order is wrong, say so plainly,
  with the reason (the repo's "disagree out loud" rule).

## Gather the state fresh (never trust a list from memory, including this file's)

1. **Git:** `git fetch`, then:
   - `git log --format="%h %ad %s" --date=format:%m-%d` since the last list (or the last two days);
   - `git rev-list --count origin/master..dev` (commits not on production) and `origin/dev..dev` (not pushed);
   - `git log origin/master -1` (what production is);
   - `git status --short` (uncommitted work belongs to other sessions; never touch it).
2. **Production:** the auto-memory `reference_prod_release_history.md` (the newest PROMOTE line) and `origin/master`.
   Note the migrations that exist on dev but not production (`supabase/migrations/`, and the release record).
3. **Open walks:** the Owner QA Ledger (`docs/projects/active/OWNER_QA_LEDGER.md`). A section is closed when its heading
   carries ✅, or its text says **PASSED**, **CLOSED** or **MARKED COMPLETE**. List only the open ones. Take each walk's
   **link and tab from the section's own text** (it names the hub URL, the tab and the walk numbers). Never guess a link.
   A section can have open re-checks inside a closed walk: say so only if the text says one is still owed.
4. **The projects:** each project's TODO line and its plan's status header. The TODO lines are long: read them whole, and
   cross-check any "BUILT / COMMITTED / owed" claim against git (an "uncommitted" claim is often stale).
5. **Prompts ready to run:** `ls docs/projects/active/*PROMPT*.md`. A prompt exists for the next step of most stages.
   Check its precondition line against what has landed.
6. **Decisions waiting on the owner:** `docs/agents/strategy/BUSINESS_DECISIONS.md` (entries **Proposed** or **Mixed**),
   the plans' asks marked OPEN, and owner calls named in TODO.
7. **Before you list anything as "owed by the owner"**, search the records for it being done. The owner often tells
   another session ("I set the console secret yesterday"). If the records are silent, phrase it as a question, not a
   chore.

## The projects in scope (re-verify each; the list grows)

| Project | Plan of record | Hub (the walks and drawings live here; verify the URL in the ledger) |
|---|---|---|
| **Club Tier readiness** (with the coach Schedule deep dive merged in, and permits + the club scheduler) | `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` (§6 stages, §7 sequencing), `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` | https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 |
| **Club Accounting · Teams** (part of the Club release) | `CLUB_ACCOUNTING_TEAMS_PLAN.md` | https://claude.ai/artifact/M3iNQq4N8cRWeZCdN6G8Ps |
| **The free tournament tier** | `FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` | https://claude.ai/artifact/VEXd9cimTQaSN9jmXfK6hU |
| **Sidebar Strip & Grid Width** (every portal): CLOSED 2026-10-17; only its **layout-check follow-up** in TODO | `docs/projects/archive/SIDEBAR_STRIP_AND_GRID_WIDTH_PLAN.md` §13 | https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC |
| **Register Your Existing Team** (coach registration) | `COACH_REGISTER_EXISTING_TEAM_PLAN.md` | https://claude.ai/artifact/9Q9j9rn3cLxXFYt64xmEmm |
| **Free coach header parity** | `FREE_COACH_HEADER_PARITY_PLAN.md` | https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y |
| **The tournament admin redesign**: CLOSED 2026-10-13; only its **follow-ups group** in TODO | `docs/projects/archive/TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §12 | https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM |
| **Platform admin as a support console**: QUEUED | `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` | none yet |

Also check for **new plans** created since this file was written (`ls -t docs/projects/active/*_PLAN.md | head`). A new
project the owner started belongs in the list.

## The rules the order follows (owner rulings; binding unless the owner changes them)

- **The Club release waits for everything in the Club Tier plan**, unless the owner cancels an item (owner 2026-10-10 and
  2026-10-12; `BUSINESS_DECISIONS.md` 2026-10-16). That includes Stage 9 house league (with the scheduler's house-league
  half), the Families redesign, bank reconciliation (both portals), the calendar feeds, the event-form fixes and the
  merged coach work. **League Plus going on sale the same day is Proposed**, to confirm when Stage 9 opens.
- **The two queued projects:** the **free tournament tier** started after the tournament redesign closed (it may run while
  Club Tier finishes). **Platform admin starts only after the Club release.**
- **Shipping ahead of QA walks is accepted** while there are no paying customers. Walks never block a build or a release.
  The first real customer ends that ruling: say so if the records show one.
- **A security fix should reach production quickly**, as a one-change hotfix if a full release isn't ready. Say plainly
  when a release is overdue and what it carries.
- **Whole-product layout sweeps run on staging as a release step**, not on the dev server (AGENTS.md).

## How to decide the order

- **One drawing session per hub at a time.** Two sessions publishing the Club Tier hub collide. So Club drawings queue
  one after another, while builds and other projects' drawings run beside them.
- **Builds on the same screens run in sequence; builds on different screens run in parallel.** Name the shared screen when
  you sequence two items. The pairs that have mattered:
  - **The free tier build and Club Stage 7:** both change tournament Teams, registration and payments, so Stage 7's
    *build* waits; its *drawing* doesn't.
  - **The free tier build and registration work** (Register Your Existing Team's later stages): both touch the
    registration form.
  - **Two scheduler builds** change the same schedule page and Fair shares; the sidebar project's Fair shares change is
    on the same panel too.
  - **Anything that changes the portal frames or the admin rail** (the sidebar strip, a header build) runs before
    **Stage 8's nav review** and not alongside another frame change.
- **Dependencies written in the plans:** permits before the scheduler; the calendar feeds before the scheduler reaches
  families; the scheduler's house-league half with Stage 9; Stage 8 (release readiness) last, then the owner's go/no-go,
  then the Club release.
- **Walks run any time.** They never sit inside a "→".
- **Releases:** one after each major build lands, so production never falls far behind.
- **Fillers** are things any free session can pick up: small fixes, the tournament redesign's follow-ups, owner calls with
  no deadline, browser checks.

## The output, exactly

1. **Since the last list:** two to five lines.
2. **⚠ Urgent**, only if real: a security fix not on production, or a release far behind (say how far, and what it
   carries).
3. **Wave 1 · now:** the items, then the walk table with links, then any one-off sessions (a `/strategy` or `/marketing`
   pass).
4. **Waves 2 onward**, each with its parallel and sequential items and the reason for each "→".
5. **After the Club release:** the platform admin project.
6. **Fillers.**
7. **Still waiting on you:** each a question with your recommendation.
8. **Housekeeping:** uncommitted records worth committing, and by whose session.
9. If the owner wants prompts for the next sessions, link them at the end. Don't paste them.

Keep it scannable: headings, numbered waves, short bullets, one table for the walks. No file paths in the body except
the walk and prompt links. End by asking nothing unless a decision is truly blocking.
