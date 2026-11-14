# Owner Morning Brief — how to refresh it

The owner's one-page view of the business: today's priorities in order, what is waiting on him, which projects are
moving or have gone quiet, and progress against the product and technology roadmaps.

- **Page:** https://claude.ai/artifact/XihEHvASiYUqYKPUJScVUX (private to the owner). Source: `docs/agents/strategy/OWNER_BRIEF.html`.
- **The command is `/brief`** (`.claude/commands/brief.md`, added 2026-11-14 on the owner's word). `/brief park <project>: <reason>` parks a project first.
- **Refresh only when the owner asks** (`/brief`, "refresh the brief", "morning brief"). It is never scheduled (owner, 2026-11-14:
  "no need to waste energy refreshing statuses on a day I am not here").
- **Nothing on the page is typed status.** The page renders five documents from its own database (`brief/meta`,
  `projects`, `roadmap`, `walks`, `priorities`). Four are written by code; only `priorities` is judgment.

## A refresh, start to finish (keep it cheap: do it in a fresh session, read nothing else)

1. `node scripts/owner-brief.mjs` — read-only. Prints a short summary and writes
   `.probe/owner-brief/out/{meta,projects,roadmap,walks}.json`.
2. From that summary alone, write `.probe/owner-brief/out/priorities.json`: `{ "setOn": "YYYY-MM-DD", "items": [ … ] }`,
   three to five items in order, each `{ title, kind, why, link, linkLabel }`.
   - `kind` is one word: Walk · Ruling · Commit · Read · Build · Release.
   - Order by what unblocks the most, and by what only the owner can do (rulings, walks, commit approvals). Recommend
     the order; do not ask him what comes first.
   - A walk's `link` comes from `walks.json`, never from memory.
   - Product-owner voice. No file paths, hashes or internal stage codes beyond a § walk number.
3. `ArtifactData` `list` on collection `brief` (to learn each document's current `version`), then ONE `batch` of five
   `set` writes with `file_path` pointing at the five JSON files and `if_version` on each. The data never passes
   through the conversation.
4. Tell the owner, in a few lines: what changed since the last brief that matters, and the link.

**Republish the page only when its layout changes.** News is a data write, never a republish.

## Where each fact comes from (fix the source, not the page)

| On the page | Source | To change it |
|---|---|---|
| Changes and database steps not yet live, days since release | `origin/master..dev`, `release/*` tags, `supabase/migrations/MANUAL_PROD_STEPS.json` | Ship, or update the steps record |
| Walks waiting on the owner | `docs/projects/active/OWNER_QA_LEDGER.md`, newest 90 sections | Record the result in the ledger section |
| "No result recorded" on a walk | The section has a published walk and none of the result wordings the script knows | Write the result line (`**Result:** PASSED n/n on YYYY-MM-DD`) |
| Moving / gone quiet / days stopped / "started since" | Git history of each project's plan files | Nothing to type; it follows the work |
| Parked on purpose, closed | `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` | Only on the owner's word: `state` + `parked: { since, reason }` |
| A project's name, grouping, "what remains" line | The same registry | Edit the registry |
| Roadmap items and their status | The tables in `docs/agents/strategy/PRODUCT_ROADMAP.md` §2 | Change the row's Status in the unit of work that changes the fact |
| Today's priorities | Written at each refresh (step 2) | The owner overrules; the next refresh follows his order |

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
- Rulings the owner owes are not computed. They reach the page only as a priority.
- The page was published without a rendered check in the session that built it.
