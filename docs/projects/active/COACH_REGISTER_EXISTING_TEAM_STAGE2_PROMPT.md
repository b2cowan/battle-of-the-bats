# Register Your Existing Team, Stage 2: count the misfiled entries, then recommend a repair door or one-off fixes

> Paste into a fresh session on `dev`. Written 2026-10-16 from the owner's task list (Wave 1, item 6). Stages 1, 1b and
> 1c (one team, one entry) are built, walked and on production (master job 280). The plan's ladder (§4) says Stage 2
> is *"Misfiled entries (F7): count how many exist, then a repair door or one-off fixes · after a count"*.
> **This session counts, reports and recommends. It changes no data and builds nothing** until the owner rules.

## The finding

`COACH_REGISTER_EXISTING_TEAM_PLAN.md` §2, **F7**: *"A misfiled entry cannot be moved. Once an entry is linked to a team
it stays linked. The coach has no way to move it, and the organizer side links only to its own club's teams."*

The one known case was fixed by hand on 2026-10-13 (plan §3, A5; the script with its preconditions is
`.probe/brett-a5-move-entry.mjs`, the removed rows in `.probe/brett-a5-backup.json`). A Premium coach registered from a
shared link, picked "New Team" and filed his entry under a stray free team his Premium portal never sees. That script is
the **pattern** for any one-off fix: preconditions re-checked, a backup first, a dry run, then `--apply` on the owner's go.

## Read first

The plan whole (§1 what happened, §2 F1–F7, §3 rulings, §4 the ladder, §9/§13/§14 what was built); the PM brief;
memory `project_coach_register_existing_team`, `reference_prod_supabase` (how to run a read against production, and
that **auto mode has refused service-role reads of production**: tell the owner what the read answers and let them
approve or run it; never route around a refusal), `feedback_check_records_before_listing_owner_steps`. Decide what a
column means from `docs/agents/db/DATA_DICTIONARY.md` and the snapshots, never from migration files.

## How an entry is linked (snapshot 2026-10-16; verify)

- `teams` is the organizer's entry (one row per team per tournament).
- `basic_coach_team_registrations` links an entry to a coach-side team: `tournament_team_id` → `teams.id`,
  `basic_coach_team_id`, `linked_by_user_id`, `link_source`, `created_at`.
- `basic_coach_teams` is a free coach team; `team_workspace_id` is set on a Premium portal's free-team **twin**.
  `team_workspaces.basic_coach_team_id` points back at the twin, with `subscription_status`, `primary_owner_user_id`
  and `rep_team_id`.
- `basic_coach_team_users` holds who is on a coach team (`role`, `status`).

## Step 1 · Define "misfiled" before you count (write the definitions into the report)

A starting set to refine against the data. Each is a separate count:
1. **A stray team beside a Premium portal** (A5's shape): an entry linked to a free team with no workspace, whose
   linker or members are also active members of a Premium twin. Split by "the stray team is otherwise empty" (no
   players, events, fees, announcements: A5's precondition list) and "it has content of its own".
2. **One team entered twice in one tournament**, from before one-team-one-entry (`2b1fe65a`): two entries in the same
   tournament linked to the same coach team, or to two coach teams with the same people on them (the head coach and
   assistant double entry that started 1c). Include a rejected entry beside a live one (`9ca06ceb` ruled a rejected
   registration still counts).
3. **An entry filed under a team its registrant isn't on:** `linked_by_user_id` is not an active member of the linked
   team.
4. **An entry with no coach-side link** whose contact email matches an account that has a coach team. Count it, but it
   is likely not "misfiled"; an organizer may have added it by hand, and the invite-only claim exists for that. Say
   which.

Split every count **before and after 2026-10-16** (Stages 1, 1b and 1c reached production that day), so the owner can
see whether the cause is closed. Separate test, demo and internal organizations (the demo slugs, `uat-*`, the owner's
own accounts) from real ones. Production is small (on 2026-10-15, 18 accounts and 15 real ones), so a few minutes of
reading each case is affordable.

## Step 2 · The counts (read-only)

- Dev first, to prove the queries against the fixtures, then production with the owner's approval.
- Keep identities (names, emails, ids) in a local `.probe/` file only. The report and anything published name teams
  and tournaments, never a person's email.
- For each real case, a one-line story the owner can check: "Team X's entry in Tournament Y sits under a free team the
  portal never sees; the portal's twin is Z; nothing else lives on the stray team."

## Step 3 · The recommendation

- **If the real cases are a handful and the cause is closed** (none after 2026-10-16): recommend **one-off fixes**, each
  on A5's pattern, each approved by the owner by name. Skip building a door nobody will need again. Write the scripts
  in dry-run form only.
- **If cases keep arising after 2026-10-16, or there are many:** recommend a **repair door** and say whose it is.
  - **The coach's** ("Move this entry to <team>" on the team's Tournaments page, for someone with Register for
    tournaments, within the coach's own teams).
  - **The organizer's**: but the organizer side "links only to its own club's teams" (F7). Which side owns the fix is a
    ruling, not a guess.
  - **Support's**: the platform admin support console is queued for after the Club release, so that is not now.

  A door is a new surface, so it gets drawings on the hub before any code.
- Either way, check what a move must carry (the entry's roster sent to the organizer, its contact, the head coach the
  organizer writes to from Stage 1b, chat-room membership) and what must **not** move (the organizer's entry, its
  status, its payments).

## Publish

On the project's hub (ONE artifact; republish the same path): https://claude.ai/artifact/9Q9j9rn3cLxXFYt64xmEmm, built
from `.probe/reg-existing-hub.src.html` by `.probe/reg-existing-hub-build.mjs` (it renders the plan and brief from the
repo's `.md` files). Add a "Stage 2 · Misfiled entries" tab:
- the definitions;
- the counts (dev and production, before and after 10-16);
- the cases as stories;
- the recommendation;
- one ask per decision, each with a recommendation and a notes box, plus a paste-back summary.

Load `artifact-design` first. Read the live copy before publishing, and parse every script before publishing.

## Records and hand-off

- Plan: a new §15 "Stage 2 · the count" (definitions, counts with their date, the recommendation), and the ladder's
  Stage 2 row. The PM brief if the next step changes. The TODO line's sub-item for Stage 2. Memory
  `project_coach_register_existing_team`.
- An owner-voice summary: how many entries are filed in the wrong place, whether it still happens, what you recommend,
  and the asks.
- **No production write in this session**, and no commit without the owner's word (explicit paths; the working copy
  holds other sessions' changes).
