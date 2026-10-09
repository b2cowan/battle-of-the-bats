# Club Tier Readiness — Stage 3d mockup session prompt ("Club money: the last pages become windows")

> Paste into a fresh session on `dev`. Written 2026-10-08, after Stage 3c was built, committed and walked (§283 ✅,
> all thirteen walks). **This session draws and settles rulings. It does not build.**
>
> **Start it only after the Ask 11 session has committed** ("New allocation, round 2": group headings in the teams
> table, a group's figure spread over its teams, the refusal beside the button). That work edits files this stage
> reads (`AllocationWindow.tsx`, the shared `FormTable`, `MoneyKit`'s `FormError`) and publishes to the same hub.
> Check `git log` and `git status` first. If those files still show uncommitted edits, ask the owner before you start.
>
> **Read first:**
> - `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, §6 Stage 3, **"⚖ 3d ADDED 2026-10-08"**. It holds
>   the owner's words, what is still a page, what stays one, and the asks to draw. Also read 3c's two window items
>   (New allocation in the line's window, Ask 6; the payee report inside the payee's window, Ask 7). 3d finishes
>   that job.
> - The PM brief's 3d paragraph (`CLUB_TIER_PRODUCTION_READINESS_PM_BRIEF.md`).
> - The hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html`
>   = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Stage 3c's Mockups section, and its round 2 screens
>   (`s3c-closeq`, the close question; `s3c-alloc2`, Ask 11), are your drawing method and part of your "before".
> - Memory: `project_club_tier_readiness`, `decision_record_reads_first_edits_whole`,
>   `decision_edit_autosaves_create_asks`, `decision_drawer_layers_form_vs_menu`,
>   `feedback_portal_is_the_formatting_benchmark`, `feedback_clickable_design_annotations`,
>   `feedback_mockups_as_claude_artifacts`, `feedback_qa_walkthroughs_as_checkable_artifacts`.

## What 3d is (the owner's ask, 2026-10-08)

*"Wasn't part of 3c supposed to look into a new design for payees and allocations away from pages and into drawers
like how we manage similar pages in other areas of the portal?"* → *"yes add 3d"*.

- **The Payees list becomes a window over the Ledger,** as the coaches portal's is. The club's list is a page today:
  `app/[orgSlug]/admin/accounting/payees/page.tsx`, reached from Ledger → Tools → Payees, with a back arrow. Each
  payee there is already a window, decluttered in §283 W10 (commit `163fdb6d`). The coach's window is
  `app/[orgSlug]/coaches/teams/[teamId]/accounting/PayeesWindow.tsx`. It is your benchmark: read how it lists
  payees, opens one, merges and shares, and match it unless the club's shared-payee report needs otherwise.
- **An allocation becomes a window that reads first and edits whole.** Today it is a page,
  `app/[orgSlug]/admin/accounting/allocations/[allocationId]/page.tsx`, whose team bills open as windows over it
  (the bill room, `?bill=`).
- **A team's account stays a page** (`accounting/teams/[teamId]`): one team's bills, requests and history, which is
  tab-like rather than one record. Draw it only where a door from it changes.

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Add a "Stage 3d" link set and screens. Whole screen,
   before (as built today, real fixture figures) and after.
2. **Every highlight is clickable:** NEW / RESTYLED / UNCHANGED tags, each with its own `data-note`.
3. **True size:** the kit's windows are 640px (form), 800px (`wide`, New allocation's and the close question's)
   and 26rem (question). Phone frames at 390px with the 44px block. **Both themes:** "after" drawn Warm, with a Dark
   copy cloned at load (`.spec.darkcopy`).
4. **Check against the formatting benchmark before the owner sees a drawing.** The written rules come before the
   previous hub's CSS.
5. **Record every ruling on the Decisions tab as it happens** (rows `open`, then `accepted`).

## Verify before drawing (read the code; plans in this repo have been wrong)

- **Every door into an allocation today.** Each one is a page link (`router.push` / `Link`):
  - the Allocations list rows and its Coming due bands (`accounting/allocations/page.tsx`);
  - a budget line's window, which lists its allocations (`BudgetWindows.tsx`);
  - a Ledger line that came from an allocation (`LedgerWindows.tsx`, `?bill=`);
  - Budget vs. Actual's "behind the figure" (`StatementBehindWindow.tsx`, and its `allocation:` drill);
  - the Overview's "From 2025–26, still open", and a team's account.

  Find any others with a grep. **Each door is an ask:** does the allocation open as a window over the window it came
  from, or does the door move you to Allocations with the window open?
- **What an allocation shows and edits today:** name, notes, the line it bills from, each team's share and schedule,
  payments, Undo, the closed-year lock and its locked sentence. What can change after it is made, and where? Read
  the page and its routes; don't assume.
- **The bill room** (`?bill=`): what it holds, and how it would open from inside an allocation window. A window over
  a window, or in place? Check what the kit allows (`KitDialog`) and what the coach does for a club bill (Money →
  Club; `BillWindows`).
- **Old addresses:** `accounting/payees` (and `?payee=`, which the retired report page forwards to through
  `proxy.ts`), and `accounting/allocations/[id]` with `?bill=`. Notifications and emails may link them; grep for the
  paths. Every old address must forward.
- **The phone:** what each window becomes (a form covers the bar; a menu sits on top of it).

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Where the Payees window opens.** Recommended: Ledger → Tools → Payees, over the Ledger, as the coach's does. The
   old address opens the Ledger with the window open, and `?payee=` opens that payee.
2. **One payee from the list:** a window over the Payees window, or in place inside it. Match whatever the coach's
   `PayeesWindow` does, unless it can't hold the shared-payee report.
3. **What an allocation's window reads first.** Recommended: the bill (name, amount, the line it bills from and its
   year), then its teams as a table (share, schedule, paid, still owed), then its notes. Its pencil edits what can
   change; everything else reads.
4. **How a team's bill opens from inside it** (the bill room).
5. **The doors** (from "Verify"): for each, a window over the window you're in, or a move to Allocations. Recommend
   one rule for all doors rather than one per door.
6. **A team's account:** stays a page (recommended). Only its doors into an allocation change.
7. **Anything the verification finds** that the plan's list misses. Say so; don't force-fit it.

## Working beside the other sessions (learned the hard way in §283)

- **The hub is published from the shared working copy by several sessions.**
  - Before every edit, read it fresh and check `git status`.
  - Parse its scripts before every publish (`new Function` over each `<script>`): one unescaped apostrophe kills
    every tab.
  - The Artifact tool refuses a publish until the live version has been read **in full**, once per session (about
    1.6 MB). Hand that read and the first publish to a subagent. After its publish, this session can publish
    directly.
  - A refusal saying a newer version is live usually means another session published the same file. Diff the live
    copy against yours (strip the publish skeleton first) before merging; never `force`.
- **QA walks keep their ticks by step POSITION.** Add steps only at a walk's end; never insert or reorder steps in
  a walk the owner may have started.
- **A walk of a screen another session is editing is not a walk.** §283 W13's create never reached the server
  because the window was being rebuilt under it. If your drawings lead to walks, say which files they depend on.
- **One browser tester at a time.** Before a probe or `auth-setup`, ask the owner whether another session is
  measuring. Read-only probes only; never create, close or reopen on dev without the owner's go.
- **No code, no help, no gates.** Your files:
  - the hub's Mockups Stage 3d section, and its INTENTS / Decisions additions;
  - the plan's Stage 3 section (3d);
  - the PM brief's 3d paragraph, your TODO line, and memory.
- **Git:** use a private index and explicit pathspecs. Build shared files as HEAD plus your own hunks. Export and
  typecheck the staged tree. After committing, run `git reset -q -- <paths>` on the shared index, because otherwise
  it holds your files as reverts. Commit only when the owner says.

## Hand-off

- Write in product-owner voice. Lead with what a treasurer sees differently: opening Payees from the Ledger, and
  opening an allocation from each door. Then what a head coach sees (probably nothing; say so).
- **Tell the owner to open the hub on a phone.**
- Put the asks as numbered questions with a recommendation each.
- Offer `/design` for a review pass if the session has budget.
- **Write the 3d build prompt only after the drawings are ratified.** Its definition of done carries:
  - every old address forwarding;
  - each door opening the window as ruled;
  - the retired pages' old look removed (`check:admin-old-look`);
  - walks that open Payees and an allocation from every door, on a phone too.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Redraw New allocation (3c Ask 6 and Ask 11 own it) or the payee window's contents (§283 W10 settled them). 3d
  moves where they live, not what they say.
- Turn a team's account into a window without the owner asking.
- Change a price, a plan or a gate, or write customer copy. Draw the placement and tag it `/marketing`.
- Mint a second artifact. The hub is the only one.
