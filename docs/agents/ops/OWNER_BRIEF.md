# Owner Morning Brief — how to refresh it

The owner's one-page view of the business, and since 2026-11-17 **the board** (`docs/projects/active/ONE_BOARD_PLAN.md`):
the goals, the projects in Now in his order, every step waiting on him, what comes next and after launch, which projects
are moving or have gone quiet, and progress against the product and technology roadmaps.

**The board file `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` is the ONLY place a project's status is written**
(goals, lane, phase, now → next, next action, waitsOn / finishesAfter, the owner's own steps). Its `_readme` defines every
field. A session that moves a project changes that project's line **in the same commit as the work**. Every other
tracker points here.

- **Page:** https://claude.ai/artifact/XihEHvASiYUqYKPUJScVUX (private to the owner). Source: `docs/agents/strategy/OWNER_BRIEF.html`.
- **The command is `/brief`** (`.claude/commands/brief.md`, added 2026-11-14 on the owner's word). `/brief park <project>: <reason>` parks a project first.
- **Refresh only when the owner asks** (`/brief`, "refresh the brief", "morning brief"). It is never scheduled (owner, 2026-11-14:
  "no need to waste energy refreshing statuses on a day I am not here").
- **Nothing on the page is typed into the page.** It renders five documents from its own database (`brief/meta`,
  `projects`, `roadmap`, `walks`, `board`), all written by the script. The judgment lives in the board file in the repo.
  (The old typed `priorities` document was retired 2026-11-17: the Now lane is the order.)

## A refresh, start to finish (keep it cheap: do it in a fresh session, read nothing else)

1. `node scripts/owner-brief.mjs` — read-only. Prints a short summary, the lanes, the goals, and a ⚠ line for every
   place the board breaks its own rules, and writes `.probe/owner-brief/out/{meta,projects,roadmap,walks,board}.json`.
2. `ArtifactData` `list` on collection `brief` (to learn each document's current `version`), then ONE `batch` of five
   `set` writes with `file_path` pointing at the five JSON files and `if_version` on each. The data never passes
   through the conversation.
3. Tell the owner, in a few lines: what changed since the last brief that matters, every ⚠ line, and the link.

**Republish the page only when its layout changes.** News is a data write, never a republish.

## Acting on a line (2026-11-17)

Every step waiting on the owner, every Now card and every Next row has a **Copy prompt** button. It copies
`/brief do <project id>[: <step>]` for a fresh chat; that session shows what is being decided, takes the answer, records
it on the board and refreshes the page (method in `.claude/commands/brief.md`). A step with a real page to act on
(an asks page, a draft, a dashboard) carries a `url` on the board and shows an **Open** button; a Now card with a walk
owed opens the walk. If the browser refuses the clipboard, the line appears selected beside the button.

## Where each fact comes from (fix the source, not the page)

| On the page | Source | To change it |
|---|---|---|
| Changes and database steps not yet live, days since release | `origin/master..dev`, `release/*` tags, `supabase/migrations/MANUAL_PROD_STEPS.json` | Ship, or update the steps record |
| Walks waiting on the owner | `docs/projects/active/OWNER_QA_LEDGER.md`, newest 90 sections | Record the result in the ledger section |
| "No result recorded" on a walk | The section has a published walk and none of the result wordings the script knows | Write the result line (`**Result:** PASSED n/n on YYYY-MM-DD`) |
| Moving / gone quiet / days stopped / "started since" | Git history of each project's plan files | Nothing to type; it follows the work |
| Parked on purpose, closed | `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` | Only on the owner's word: `state` + `parked: { since, reason }` |
| A project's name, grouping, "what remains" line | The same registry | Edit the registry |
| Roadmap items and their status | The tables in `docs/agents/strategy/PRODUCT_ROADMAP.md` §2 | Change the row's Status in the unit of work that changes the fact. A board project's `roadmap` field names the rows that cover its whole scope, and the script prints ⚠ when a row's Status does not fit the project's phase |
| Goals, lanes, phase, next step, dependencies, steps waiting on him | The board file `OWNER_BRIEF_PROJECTS.json` | The session doing the work, in the same commit; lanes and Now order only on the owner's word |

## Rules the script applies

- **Quiet** = no commit to any of the project's plan files for more than 7 days, and no uncommitted change.
  A quiet project with an owed walk reads **Waiting on you**; without one, **Gone quiet**.
- **An unregistered plan** (a `*_PLAN.md` the registry does not list) still appears, tagged Unregistered, so new work
  cannot hide. Once it goes quiet it stays on the page only while `TODO.md` has an open line naming its file;
  otherwise it is counted as settled and left off.
- **Counts, never percentages.** Progress is "n of m live", one square per roadmap item.

## Known limits (2026-11-14)

- Activity is read from plan files, so a project worked on without touching its plan looks quiet.
- The ledger is free text. A new way of wording a result needs adding to `DONE` in the script, or the walk shows
  as "No result recorded".
- Rulings the owner owes are not computed. They reach the page as a project's `youOwe` line on the board.
- The page was published without a rendered check in the session that built it.
