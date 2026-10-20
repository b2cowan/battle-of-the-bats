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
  parallel and those that need to run sequentially"*). Use **waves**. Say *why* something waits, in a few words.
- **A "run in parallel" group holds only what can start now, each in a new chat** (owner, 2026-10-19, after a follow-up
  step listed inside Wave 1's "all five in parallel" was started early in a fresh chat: *"make sure going forward follow
  up sessions aren't in the same group as 'these can all run in parallel', that is conflicting and confusing"*).
  Inside a wave, the parallel group is only the items the owner can open right now, each in its own new chat, and its
  heading's count counts those items and nothing else. Anything that waits for another item, and any **follow-up** (the
  next message to a chat that is already open: a build after its gate, the next part of a staged build), goes in a
  **separate group below it**, headed as not yet (for example **"Later in this wave · don't start yet"**). Each item
  there says which chat it belongs in and what it waits for, and is never numbered in sequence with the run-now items.
- **A plain request means the last seven days** (owner, 2026-10-19: *"whenever I ask for a simple updated task list,
  only incorporate projects that have been worked on in the past 7 days"*). A plain `/tasks` (or "give me an updated
  list") covers only projects with a commit, a ruling or a record in the last seven days; check git and the records,
  not memory. Their walks, owner calls, prompts and later waves come with them; everything else stays out of the
  waves, the walk table and "waiting on you". A stage of a project in scope is in scope even when it has had no work
  of its own (a Club Tier stage not yet drawn). End with **one line** naming what the rule left out that still gates a
  release (for example a Club-release item untouched this week), so the window never hides a blocker. The full list,
  every project, is for when the owner asks for it ("full list", "everything").
- **Wave 1 lists every open QA walk with its link** (owner, 2026-10-14): a table of walk · what it checks · where to open
  it (the page's URL, the tab, and the walk's number or name).
- **Every Wave 1 session carries its prompt link; a paste block only when the prompt alone isn't enough** (owner,
  2026-10-19: *"I want to see this list like this with the exact build prompt links and the text I need to paste into
  another chat (i.e. if I need to tell the chat to execute build prompt A but start at stage 3, then ensure that is there
  for me to paste)"*; narrowed the same evening: *"I only need full prompts like this if there is something specific I
  need to send with the actual prompt link that is not simply in that prompt file, this is too much and your lists need
  to be more concise"*). Each numbered Wave 1 item gets a clickable link to its prompt file. Add a paste block **only**
  when the owner must tell the chat something the prompt file doesn't already say (start at stage 3; skip parts already
  committed since the prompt was written; a promote is in flight), and keep it to those lines. Never restate the
  prompt's own instructions or the standing repo rules (explicit paths, ask before committing, never push).
- **Concise** (owner, 2026-10-19: *"your lists need to be more concise"*). One line per item where possible; no
  paragraph of reasoning per item; housekeeping and owner questions as short bullets. If a section is empty, drop it. Check a prompt's precondition and its staleness (rulings made after it was
  written) before pointing at it; a stale prompt is named as stale, not pasted around. An item with no prompt says
  "no prompt yet". On 2026-10-19 the owner also asked that run to write the missing ones; that was a one-off request,
  not a change to this agent's read-only rule.
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
3. **Wave 1 · now:** the items that start now (the parallel group), then the walk table with links, then any one-off
   sessions (a `/strategy` or `/marketing` pass), then, as its own group, **later in this wave**: the items that wait
   and the follow-ups to chats already open (the 2026-10-19 grouping ruling above).
4. **Waves 2 onward**, each with its parallel group and, separately, its later items with the reason each waits.
5. **After the Club release:** the platform admin project.
6. **Fillers.**
7. **Still waiting on you:** each a question with your recommendation.
8. **Housekeeping:** uncommitted records worth committing, and by whose session.
9. Prompts: Wave 1's items carry their links and paste blocks in place (see the 2026-10-19 format ruling above). Later
   waves link their prompts at the end. Never paste a prompt's body.

Keep it scannable: headings, numbered waves, short bullets, one table for the walks. No file paths in the body except
the walk and prompt links. End by asking nothing unless a decision is truly blocking.
