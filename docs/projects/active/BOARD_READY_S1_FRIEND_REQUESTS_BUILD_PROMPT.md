# Prompt — Board Ready Stage 1 · BUILD: friend requests in the house-league draft

> Three build sessions, one Part each, each pasted into a fresh chat (`/clear` first) as
> *"Read and follow docs/projects/active/BOARD_READY_S1_FRIEND_REQUESTS_BUILD_PROMPT.md — Part N"*. Written
> 2026-11-10, after the owner ruled every drawing ask. Parts run **in order** (2 reads what 1 stores; 3 reads what 2
> confirms). Plan of record: `BOARD_READY_PLAN.md` §5 Stage 1 (the rulings, the `/legal` findings and build rules, the
> code facts). Index: `BOARD_READY_PROMPTS_INDEX.md`.

## The source of truth
**The drawings, as ruled:** https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8 (source
`BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html`, committed `bf5ac936c`). Tabs 1–7 plus 5b are the specimens; tab 8 holds
the rulings (A1–A15, all as recommended, owner 2026-11-10: *"i agree with the recommendations in the mockups, i like
your proposal in 5b as well"*). **Build to the drawings.** Where the code makes a drawn thing wrong or impossible,
STOP and draw the difference for the owner. Never decide it silently (`feedback_build_to_approved_mockups`).

## The rulings the build must hold (copied from the ruled asks; add nothing)
- **The maximum per child** is a stored season setting in Overview › Registration: None (don't ask) · 1 · 2, default 2
  (A8). At None the form asks nothing and the Friend requests view is **absent**.
- **The keep-together group is at most 3 children, brothers and sisters counted, fixed** (A1). The cap never splits
  brothers and sisters (A6). When a group would pass 3, keep links in this order: Both asked, then code matches, then
  the earliest confirmed (A7). The rest read "Not honoured · the group would pass 3 children".
- **A name match is a suggestion; only the registrar confirms.** A friend code match arrives confirmed. A Both asked
  pair is ONE row and ONE Confirm (A13's drawn-in proposal).
- **Cross-division requests are allowed at sign-up**, and the queue marks them "Different division" with Can't honour
  as the row's action (A2). The form never says whether a named child is registered, never says which division they
  are in, and never shows the name behind a code.
- **Families may add or change requests on "Your sign-up" until that child's division has its teams made** (A5). After
  that the page reads "Friend requests closed when the teams were made."
- **The friend code**: one per child sign-up, 6 characters shown 3 + 3, with no 0/O/1/I. The sixth character is a
  check letter, so the form catches a typo with **no lookup**. It is text on "Your sign-up" and the confirmation
  screen, and text in the confirmation email in the neutral sentence (A10). Never a link.
- **Who sees requests**: the seats that can open Registrations, on every surface: queue, record, board marks and
  popover, filter, after-draft result, export (A11; ruling A8 for family notes). Anyone else who runs the board still
  gets groups kept together, without the marks or names.
- **The result is live** (A3): Honoured / Not honoured is read from the teams as they stand. Nothing re-deals by itself.
- **"Keep friends together"** is a switch in the *Run the draft* window beside "Keep families together". It is not a
  stored setting, it shows only when the division has at least one confirmed request, and it is on by default (A9).
- **Deletion** (A12): typed names, codes, matches and groups are deleted when the season is marked finished, or 60 days
  after its last day if it never is. **Built in this stage**, because the form promises it.
- **Board rows (A14 = option B; A15)**: fixed places in each row. RTG (rating) · Player · **Together** (family +
  confirmed friends, one place; the count is how many of the player's group are on this team; amber "1 of 2" when
  someone in the group is on another team) · Note · $ · Age · ⋯. Each place is headed by its symbol, and a place the
  reader can't see is absent, not empty. The rating column is headed **RTG**, with the hover "Rating: 1 is newest to the
  sport, 5 among the strongest". Names wrap, as they do today. This changes the board for **every** club, with or
  without friend requests (the owner was told).
- **Gate**: League Plus and both Club bands (Business Decisions 2026-11-10), on the existing three-plan check (the venue
  library's `hasOrgVenueLibrary` set). Reuse it; no new key.

## `/legal` build rules (plan §5 Stage 1; not optional)
- Typed names are used **only for team placement**. No outreach to a "Not signed up" family, no invitation, and never
  fed into the families, people or prospect lists.
- Requests and codes hang on the **season's registration**, never on the child's cross-season record (Stage 14), so the
  deletion is clean.
- The form's two lines, verbatim from the drawing: "Only name a child whose family is happy for you to." and "Only the
  club staff who handle sign-ups see these names, and only to put friends on the same team. They are deleted after the
  season." (The `/marketing` pass may tune the words. It may not widen the promise.)
- "Delete request…" removes one request completely, so the club can answer an erasure request.
- Friend **names** never go into "Excel with contact details". That export gains only the name-free "Friend Requests" and
  "Friends Honoured" columns. Names go only into the Friend requests view's own export (children's names only, no
  parent names).
- Anonymous free text reaches Excel/CSV, so check formula neutralization in the shared table export (`lib/export/table.ts`)
  before the friend columns land. Route a gap to `/review` and fix it in this stage.

## Facts read from the code (2026-11-10; re-check the lines you touch)
- Draft: `lib/house-league-draft.ts` `runDraft(players, teamIds, seed, { together })`. Families group by guardian email
  (`householdOf`) into units placed whole. There is **no size cap** today. `evenOut` swaps singles only. The output is the
  deal map, with no "why". The window is `components/admin/kit/club/league/teams/DraftWindow.tsx` (the families switch
  is `SwitchButton`, words `lib/house-league-teams-screen-words.ts` L173–177, the trial deal at L96). The route is
  `app/api/admin/house-league/seasons/[seasonId]/draft/route.ts` (`together = body.together !== false`).
- Board: `TeamsBoard.tsx` + `Teams.module.css` + `lib/house-league-board-pool.ts`. The row columns come from
  `columns(rights)` (`--cols`, TeamsBoard ~L96). Marks are `.mark` buttons with a popover (`SheetFrame` on a phone) and
  `.kidLit` rows. The pool filter is `FilterMenu` "Show only". The board shows 2 cards across, and the screen stops at
  1200px. Notes are read only through `readBoardNotes` behind `houseLeagueRefusal(ctx,'read')`; friends follow the same
  path (`tests/unit/house-league-board-notes-guard.test.ts` shows the pattern, so extend it to friends).
- Sign-up: `components/league/RegisterForm.tsx` (anonymous; the division forecast is live, ~L192–250; the "Remove" word
  link L166–170; the `.fit` panel in `register.module.css` L150) posts to `/api/league/{org}/{season}/register`.
- "Your sign-up": `app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx` (also mounted in the family app at
  `/family/signup/[registrationId]`). Copy look: `ContactCopyRow` in `components/public/ClubContactCard.tsx` on
  `lib/hooks/useCopyToClipboard.ts`.
- Registrations: `RegistrationsScreen.tsx` (the `ViewSwitch` with To review's amber count ~L618–630), `RegistrationsList.tsx`
  (`RowAction`, `RowMenu`, `ClubRowList` phone rows, the "… N more" row), `BulkBar.tsx`, `RegistrationRecordWindow.tsx`,
  the export `registrationsExport.ts`, words `REGS_WORDS` / `REG_RECORD_WORDS` in `lib/house-league-money-words.ts`.
- Settings: Overview › Registration block, `SeasonRecordBlocks.tsx` ~L215–325 (pencil ↔ ✓, autosave).
- Matching: `lib/continuity-match.ts` `normName` only lower-cases and collapses spaces. **Add a new normaliser** for
  friends (accents, hyphens, apostrophes; first-name prefix = similar). Do not change `normName`, because continuity and
  duplicates depend on it.
- Finishing a season already erases player ratings (`lib/house-league-status-words.ts` L192/L221, the status route).
  Friend-request deletion joins that same moment, and the finish confirm gains the line. The 60-day backstop runs on the
  existing pg_cron tick (mig 183; `app_cron_secret`). Seasons can sit past their last day un-finished
  (`lib/house-league-season.ts` ~L128).
- There is no house-league import (A4): nothing to map. Record the rule ("a future import lands typed names in this
  queue as suggestions") in the plan only.
- Latest migration at writing: **460**. Check again at commit time, since other sessions add migrations.

## Part 1 — The family side and the settings
Drawing tabs 1, 2 and 3 (top). The parent's question per child (empty, filled, at the maximum; desktop + phone), the
code check letter, "Your sign-up" (code + Copy, "Plays with" one line per friend, Change until the teams are made, closed
after), the confirmation screen and email lines, and the Overview › Registration "Friend requests" row + edit field.
- **Migration first**: the season's maximum; request rows (asking registration, slot, typed first/last/parent or code
  entered, state, mark, matched registration, reason/note, decided by/at, kept apart by/at, created); a per-registration
  code (unique per season). RLS as the house-league tables have it. Then `DATA_DICTIONARY.md` + `npm run
  refresh:snapshots` in the same unit of work. Apply to **dev** only, and add the prod step to `MANUAL_PROD_STEPS.json`.
- Code matches resolve on save (same season, by code). A code for a child in another division is stored as a code match
  marked Different division. Typed names are stored only; matching runs on read in Part 2.
- Ends with: `/legal` re-check on the built copy (form lines, email sentence), `/docs`, one `/marketing` words pass,
  `/review`, then a QA walk (an Artifact, `feedback_qa_walkthroughs_as_checkable_artifacts`).

## Part 2 — The registrar
Drawing tab 4, the export half of tab 7, and the deletion. The Friend requests view (bands To confirm · Confirmed ·
Closed; Both asked pair row; Code match; Different division; "… N more"; the amber count), the toolbar (DivisionPicker,
search, FilterMenu with tick boxes, ExportMenu), RowAction + ⋯ (Pick another…, Not signed up, Can't honour…, Open
registration, Delete request…), BulkBar "Confirm best match", the request window, the Can't honour window (outlined,
no lime), empty states, the phone rows, the registrations Flags filter "Has a friend request", the two export changes,
and the deletion (finish-season moment + the 60-day backstop + the finish confirm's line).
- The suggestion ranking: same division first; the new normaliser; parent name as rank + reason; never auto-confirm.
- The guard test: friends readable only behind the Registrations read check, on every route that returns them.
- Ends as Part 1 does (+ `/legal` on the deletion and the export).

## Part 3 — The draft
Drawing tabs 3 (bottom), 5, 5b and 6. The engine: groups = household ∪ confirmed, un-split links; the cap of 3 with the
A7 order; siblings never split; locks win as for families. Store each request's draft outcome (kept / over the cap) so
the live result can say why. The *Run the draft* window: the Friends fact row (counts, waiting requests + link), "Keep
friends together", and "How it deals". The board: option B rows (RTG · Player · Together · Note · $ · Age · ⋯), the
Together popover listing family and friends labelled, amber when split, the "Has a friend request" filter, the ⋯ items
"Keep apart from a friend…" / "Keep together with {friend} again". The after-draft view (Not honoured first, with every
reason in tab 6's list) and the registration record's "Friend requests" section.
- `evenOut` must never move a friend group, just as it never moves families.
- Test the engine: cap and order, siblings over the cap, locks, a split, Draft again keeps splits, and same seed gives the
  same teams.
- Ends as Part 1 does (+ the help guide for the draft).

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index
  (`reference_partial_commit_shared_tree.md`).
- `npm run verify:changed` per part; `npm run typecheck` (shared modules, routes, migrations).
- Dev server: restart only as `AGENTS.md` says (new files, `lib/` shared changes).
- The Milton demo world is seeded by another session. Don't seed or reset it from here. `/demos` picks this up in its cycle.
- Record each part's commit hash and walk number in plan §5 Stage 1, this index row and TODO (positive facts only).
