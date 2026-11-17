# One Board — Session 2 kick-off prompt

Paste everything below the line into a fresh session.

---

You are picking up **Session 2 of One Board**. Read these first, in this order, and nothing else until a step needs it:

1. `docs/projects/active/ONE_BOARD_PLAN.md`: the plan, the owner's four rulings and the session list.
2. `docs/agents/ops/OWNER_BRIEF.md`: how the board is refreshed and where every fact on it comes from.
3. `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`: the board itself. Its `_readme` defines every field.
4. `scripts/owner-brief.mjs`: run it (`node scripts/owner-brief.mjs`, read-only) to see the board's current lanes,
   goals and ⚠ warnings before you change anything.

## What Session 1 did (2026-11-17)

- The owner ruled, all four as recommended:
  1. One board is the only place a project's status is written; everything else points at it.
  2. The board is the Owner Morning Brief page (https://claude.ai/artifact/XihEHvASiYUqYKPUJScVUX), not a new page.
  3. TODO.md shrinks to one line per project, and the AGENCY_RULES "Task Tracking" rule is amended with it.
  4. The "touch the plan, touch the board line" build check waits a few weeks, then needs his word. **Not this session.**
- Same day he also ruled:
  - Launch in Canada first; the US launch comes after it.
  - The Canadian launch means functionally able to onboard a club. Marketing and the demo come after.
  - He approved the Terms and Privacy Policy text (0.3).
  - support@, privacy@ and hello@ all receive mail.
- The board file gained goals, lanes, phase, stage, next, waitsOn, finishesAfter, youOwe and checked.
  - The script writes a `board` document and prints ⚠ when the board breaks its own rules.
  - The page was republished as the board. The typed "priorities" document was retired; the Now lane is the order.
- The 19 projects that serve the Canadian launch, the board pack and the after-launch goals were truth-checked against
  plan bodies, the QA ledger and git. Plan headers were treated as stale.
- **Session 1 is NOT committed.** Its files share the working tree with other sessions' uncommitted edits.

## Step 0: commit Session 1, only on the owner's yes

Ask once: "Commit Session 1 (the board, its page, the brief's how-to, today's legal-approval records)?"
On yes, commit through a private index with only Session 1's hunks. See memory `reference_partial_commit_shared_tree.md`.
Stage explicit paths, then check `git show --stat HEAD`.

| File | Commit |
|---|---|
| `docs/projects/active/ONE_BOARD_PLAN.md`, `ONE_BOARD_PM_BRIEF.md`, this prompt | Whole file (new) |
| `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, `OWNER_BRIEF.html` | Whole file (rewritten by Session 1) |
| `scripts/owner-brief.mjs` | Session 1's hunks only: the header comment, the `buildBoard` section, the extra project fields, the board writes and summary lines. **Not** the `DONE`/`OWED` regex hunk in `readWalks`, which is another session's. |
| `docs/agents/ops/OWNER_BRIEF.md`, `.claude/commands/brief.md` | Session 1's edits |
| `TODO.md` | The one "One board" line only |
| `docs/projects/active/OWNER_QA_LEDGER.md` | The one `**Result:** Walked 2026-11-17` line in §533 |
| `docs/agents/legal/drafts/TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md` | The Status line only |
| `docs/agents/legal/LEGAL_INDEX.md` | The two "owner-approved 2026-11-17" phrases only |
| `docs/projects/active/GST_HST_STAGE6_TERMS_PLAN.md` | The "Owner 2026-11-17" note only |

No Co-Authored-By line (owner rule).

## Step 1: truth-check what is left

The script says which projects are still unchecked. In Session 1 there were 14:

- **Seven unchecked** (`checked: false`): attendance, navigation, support-console, public-tournament, bookkeeping,
  whats-new, revenue-readiness.
- **Seven unregistered** active plans: Start your club two steps, Notification message rows, Quiet teams and next up
  horizon, Retire old tournament only nav, One window, Bracket game order rule, House league draft board at scale.

How to do the checking:

- Delegate it: two or three helpers in parallel, each returning records in the board's exact shape. Session 1's helper
  briefs asked for `phase / stage / next / remains / waitsOn / finishesAfter / youOwe / goals` plus evidence
  `path:line`, in product-owner English with no paths inside the text fields.
- Trust plan bodies, the ledger and git over plan headers.
- Open the cited lines yourself before you write a record. A helper's summary is a lead, not evidence.

What to do with each finding:

- **A finished plan** (all walked, nothing owed): propose closing it to the owner. Closing and parking are his word only.
  Don't close it yourself. Until he rules, leave it registered with phase "Ready to release" or "Live", whichever is true.
- **An unregistered plan that belongs to an existing project**: add its file to that project's `files`. Don't make a new
  project for it.
- **Walks:** they attach automatically by the `ledger` keywords; never type them into `youOwe`. If a passed walk still
  shows as owed, the ledger's result wording isn't in the script's `DONE` regex. Add a `**Result:** Walked YYYY-MM-DD …`
  line to the ledger section rather than editing the regex, which another session has been changing.

## Step 2: every other tracker points at the board

1. **Billing/tax/pricing sequence page** (https://claude.ai/artifact/Kua6RAqMA7ChA7QBTNE63a): freeze it.
   - Add one `log` row and a `hub/meta` note saying that from 2026-11-17 the five projects' status lives on the board,
     with its link.
   - Use ArtifactData with `if_version`; read the documents first. No republish.
   - Fix its source file's header to say so too.
2. **Club tier index page** (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr): it keeps stages, walks and drawings,
   but loses its own status.
   - Add a `hub/meta` note that the Club project's status lives on the board.
   - Its per-stage states are stale. Don't try to correct them; the note makes that explicit.
   - Same rules: read first, pin versions, no republish.
3. **Plan headers.** For every registered project's plan, replace the `Status:` line (often "PLANNED — nothing built",
   which is stale) with one line: `Status: on the board (Owner Morning Brief).` Keep each plan's stage list; that list is
   the steps.
   - Edit only the status line.
   - Many of these files carry other sessions' uncommitted hunks, so use small exact edits.
4. **Product roadmap Status column.** Rows don't map one-to-one to projects, so don't auto-write them.
   - Recommended: give each board project an optional `roadmap: ["<row item text>"]` field.
   - Have the script print ⚠ when a row's Status disagrees with that project's phase.
   - Fix the known stale rows now, with evidence. For example, "Group email to coaches: Not started" is wrong: Club
     Communications Sessions 1 and 2 are committed.
   - The script is read-only tooling the owner asked to change, not watched automation. Confirm that with
     `scripts/check-agent-automation.mjs` `WATCHED_PATHS` before editing.
5. **`/tasks`** (`docs/agents/ops/TASK_LIST_PROMPT.md`, `.claude/commands/tasks.md`): make it read the board first.
   - Its waves follow the lanes: Now, then Next. Owner steps come from `youOwe` and the walks.
   - Remove its own table of projects and hubs, which cites old hub links. Point at the board instead.
   - Check `WATCHED_PATHS` first.
6. **Memory.**
   - In `MEMORY.md` (auto-memory), project lines stop restating status ("walk owed", "commit owed", "next Session 2").
     Each becomes a pointer: "status on the board".
   - Keep the lesson and ruling lines.
   - The in-repo `memory/` store: same treatment, and update `memory/MEMORY.md` in the same change.

## Step 3: shrink TODO.md and amend the rule (owner ruling 3)

TODO.md is about 128 KB, with 444 open lines. Other sessions edit it constantly, so plan the change first and write it
in one quick pass from a fresh read.

1. Snapshot first: copy today's full TODO.md to `docs/projects/archive/TODO_SNAPSHOT_2026-11-<dd>.md`, so nothing is lost.
2. **A line belonging to a board project** collapses into that project's single line:
   `- [ ] **<Project name>** — status on the board · plan <link>`.
   - Before dropping a line's detail, make sure the plan holds it.
   - If it doesn't, move the detail into the plan's stage list first. A stage with no home is the drift this project
     exists to prevent.
3. **A line belonging to no project:**
   - If it is real work, propose a board project.
   - If it is an idea, move it to `docs/projects/IDEAS_BACKLOG.md`.
   - If it is a one-off chore (for example a demo check after a promote), keep it under a short "Chores" heading.
   - Ask the owner only about the ambiguous ones, as one list.
4. **Amend AGENCY_RULES.md "Task Tracking"** and the TODO header in the same change:
   - TODO is one line per project, pointing at the board.
   - Status lives only on the board.
   - Done lines still move to the completed archive.
   - Point at `ONE_BOARD_PLAN.md`.
5. Re-run `npm run check:todo-size`.

## Step 4: refresh the board and hand back

- Run the script, then write the five documents with one ArtifactData batch (`if_version` on each). See OWNER_BRIEF.md.
- Tell the owner, in product-owner voice:
  - what moved
  - every ⚠ line still printed
  - what he must rule, as one list (project closes, unclear TODO lines)
  - the commit question for Session 2's work, which goes through a private index as in Step 0

## Open owner questions carried from Session 1 (ask once; don't re-argue)

1. **Club release scope.** Launch now means "a club can onboard". The 2026-10-12 ruling holds the Club release until
   every Club stage is walked. These may now be post-launch:
   - coach-entered permits (not drawn)
   - Stage 13f, 13g and 13h (not started)
   - bank check save-for-later
   - each team's amount on several permits

   If he rules, update `club-tier`'s `finishesAfter` and those projects' goals or lanes to match, and record the ruling
   in the Club tier plan.
2. **Logging the decisions.** Record "Canada first, US after" and "launch = a club can onboard; marketing and demo
   after" in the Business Decisions log via `/strategy`. Offered once and not yet answered.

## Rules that bite here

- **Status is written once, on the board.** Don't restate a project's status in any file you touch; point at the board.
- **Changes to shared automation need the owner's ask in this conversation, in their own commit.** That covers hooks,
  settings, the database checks and anything in `WATCHED_PATHS`. The build check (ruling 4) is NOT this session.
- **Broad reading goes to helpers.** Verify their cited lines before acting on them.
- **Product-owner voice** to the owner: no paths or hashes in what he reads.
- **Re-check before you commit.** Before each commit, confirm the branch is `dev` and that only your hunks are staged.
  Never `git add -A`.
