# Prompt — Board Ready Wave 1 · B: friend requests in the house-league draft (drawing session)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10. **Drawings and asks only, no code.** The
> build prompt is written after the owner rules on these drawings. Plan of record:
> `docs/projects/active/BOARD_READY_PLAN.md` (§2 row 2, §3 "Item 2, accuracy", §5 Stage 1, §6, §7 Q3 / Q3b). Index:
> `BOARD_READY_PROMPTS_INDEX.md`. Run `/design` for the drawing work.

## The ask (board feedback 2026-11-10)
Parents list friends on the house-league application. We match those names to this season's registrants as accurately
and transparently as we can, and the auto-draft keeps confirmed friends together. Today the club's registrar does
this by hand in Excel, linking players.

## Owner rulings that bind this drawing (2026-11-10)
- **The club sets the maximum friends per child; the default is 2.**
- **Admins see Honoured / Not honoured, with the reason, after the draft. Parents get no message about it.** A
  parent's "Your sign-up" page shows only what they asked for, and never another child's details.
- **The largest keep-together group is 3 children, siblings counted.** *Not ruled:* whether the club can change it.
  Ask it in this session.
- Plan of record: Stages 1–7 ride League Plus + both Club bands (Business Decisions 2026-11-10).

## Standing rulings that constrain it
- **A name match is a question, never an answer.** *"No sibling claim from a name match — anywhere, ever"*
  (`CLUB_FAMILIES_BOOK_P3_PROMPT.md:104`; Stage 14 Ask 4). Typed names produce **suggestions the registrar confirms**.
  The exact path is a **friend code**: each confirmed sign-up gets a short code shown on its "Your sign-up" page, and
  another family can enter it. A code match is exact.
- **No new links to families** (Business Decisions 2026-10-31). The code is text shown on a page the family already
  has, never a new emailed link.
- **Notes and answers are seen only by seats that can open registrations** (ruling A8;
  `tests/unit/house-league-board-notes-guard.test.ts`).
- "With a friend" was explicitly left unruled by the Stage 9c and draft-at-scale prompts. This session is where it gets
  drawn.

## Read first
1. The plan sections above.
2. Code (read the parts you'll draw over, not whole trees):
   - `lib/house-league-draft.ts`: `runDraft`, the "Families together" grouping (~L127–223), `evenOut` (~L231) and locks;
   - `components/league/RegisterForm.tsx`: the per-child fields and the 500-character notes box;
   - `components/admin/kit/club/league/teams/TeamsBoard.tsx` and `lib/house-league-board-pool.ts`: the pool filters,
     the sibling mark and notes;
   - `lib/continuity-match.ts` (`normName`, `strongNameMatch`): what "a strong name match" already means here;
   - the "Your sign-up" status page (`lib/league-pay-link.ts` and its page).
3. Find out (by helper) **whether house-league registrations can be imported** (CSV, TeamSnap export). The prospect
   club runs on TeamSnap today. If an import exists, draw where a friend-request column maps in.
4. Memory, before drawing:
   - `feedback_mockups_as_claude_artifacts.md` (HTML Artifact, the house layout, before/after, true size);
   - `feedback_draw_controls_from_shipped_component.md` and `feedback_portal_is_the_formatting_benchmark.md`;
   - `feedback_always_run_design_on_mockups.md` (a `/design` pass before hand-off);
   - the UI conventions index in `reference_memory_index_settled.md`.

## Draw (desktop and phone wherever a family or registrar uses it)
1. **The parent's sign-up question**, per child: "Who would you like {child} to play with?" Up to the club's maximum,
   first and last name, an optional "their parent's name", and "or enter a friend code". Show it empty, filled, and at
   the maximum.
2. **The friend code** on "Your sign-up", and how a parent shares it (copy only; nothing is sent by us).
3. **The club setting** in the season's house-league settings: maximum friends per child (default 2), the keep-together
   cap (3), and "Keep friends together in the draft" beside "Families together".
4. **The registrar's Friend requests queue.** Each request shows its best suggestions from this season's sign-ups in
   the same division. Actions: **Confirm · Pick another · Not signed up · Can't honour**. The queue marks **Code match**
   (arrives confirmed) and **Both asked** (each named the other). Show filters and counts, empty, and 120 requests.
5. **The draft:** confirmed requests as keep-together groups, a mark on the player chip and a Friends filter on the
   board (as siblings have), and the convenor splitting a group.
6. **After the draft:** every request reads **Honoured** or **Not honoured — why** (over the cap, a different division,
   a locked player, the friend withdrew).
7. **Registrations list and export:** the request columns.

## Asks to put to the owner (recommend each)
- Can the club change the keep-together cap, the way it sets the maximum? (This is the leftover from Q3b.)
- A request for a child in another division: shown as "Can't honour — different division", or not allowed at sign-up?
- When a requested friend withdraws, or a request is edited after the draft, what does the registrar see?
- Do friend requests import from a TeamSnap / CSV registration export (if an import exists)?
- Anything the drawing needs that the plan does not cover. Draw it and ask; never assume.

## Before hand-off
- `/design` pass on the drawings.
- **`/legal`** (CLAUDE.md: this changes what the product collects about people). The points: a parent typing another
  child's name, what the registrar sees, and how long requests are kept (recommend purging them at season end).
- Put the Artifact URL and the asks into `BOARD_READY_PLAN.md` §5 Stage 1, and update the index row.
- Hand the owner a product-owner summary: what the parent, the registrar and the convenor each see, and the asks.

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index (memory
  `reference_partial_commit_shared_tree.md`).
- No code, no migrations in this session.
- The Milton demo world is being seeded on dev by another session. Don't seed or reset it from here.
