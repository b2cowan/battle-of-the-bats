# Club Tier Stage 5b — Families: the screens to the portal benchmark (built to hub version 116)

> Paste into a fresh session on `dev`, **after Stage 5a is committed** (`CLUB_TIER_STAGE5A_BUILD_PROMPT.md`: the record
> made true, the message window, the export, the rulings in the design log). Written 2026-10-17, the day Stage 5 was
> **ratified**: all 25 asks as recommended (owner: *"ok all looks good, I agree with your recommendations, can you
> write up the build prompt"*). **One build session, the second of two.** Migration: probably one small log table
> (Ask the coaches); nothing else in the schema moves.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 (version 116) → Mockups → **Stage 5** →
> **P1** (the Families page: tabs, the Show pill and its open menu, the table, the phone cards, the no-family list and
> Ask the coaches), **P2** (a family over the list, desk and phone), **P3** (Duplicates, desk and phone). Every part
> tagged **5b** is yours; the **5a** parts are already built — keep them working as you redraw around them. P4 and P5
> (the message window, the export) were built in 5a; this session moves their doors into the record.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`): every tag note is a requirement.
> - The walk screens hold the findings (S5-01…S5-09, E06); the Decisions tab holds the 25 rulings and their reasons;
>   the Formatting check screen lists the rules each drawing was checked against, and the two /design passes.
> - Where you must depart, say so at build time and record why in the Club plan's Stage 5 record; never silently.
>
> **Read first:** the Club plan §6 Stage 5 (the record, including "5a BUILT" from the previous session) and
> `CLUB_FAMILIES_BOOK_PLAN.md` §4 (matching rules) and §5.3 (binding decisions); `AGENTS.md` (read
> `node_modules/next/dist/docs/` before a route or a page). Memory: `project_club_families_book`,
> `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark` (incl. its 2026-10-17 note on
> pick-one pills), `decision_one_toolbar_rare_tools_behind_tools`, `decision_waiting_count_is_amber_pill`,
> `decision_record_reads_first_edits_whole`, `decision_drawer_layers_form_vs_menu`, `decision_rare_door_ends_body`,
> `decision_window_foot_text_left`, `feedback_money_figures_one_joined_band`, `feedback_shared_component_over_shared_class`,
> `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_dev_email_cannot_reach_fixtures`,
> `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`, `reference_partial_commit_shared_tree`.
> `docs/agents/design/TABLE_AND_LIST_STANDARD.md` §3.4–§3.10. The design log's "CLUB STAGE 5 · FAMILIES" entry (5a's
> Part 0) and 2026-09-30 (Accounting one page with tabs), 2026-10-07 (the olive pill), 2026-10-08 (the joined band),
> 2026-10-11 (one club send), 2026-10-12 (a phone's filter; a menu sheet's room to tap away).

## ⚠ What this code already taught

- **Accounting is the precedent for one page with tabs**: `app/[orgSlug]/admin/accounting/layout.tsx` (the server gate)
  + `components/admin/kit/club/money/AccountingFrame.tsx`, `components/shared/HubTabBar.tsx`, the tab list in
  `lib/admin-kit-nav.ts` (`accountingTabs`; the Accounting rail row has no pages and carries the waiting count).
  Families' rail entry today lists two pages (`case 'families'` in `lib/admin-kit-nav.ts`); `admin-kit-nav.test.ts`
  pins the nav.
- **A record that is a place:** `KitDialog` (`components/admin/kit/club/KitDialog.tsx`) — `address` writes the record
  into the URL through its own Back step (never `router.replace` while it is open), `steps` names the neighbours in the
  foot with the place in the list (absent at either end and when opened from a link with no list), `edit` is the pencil
  (do NOT pass it: the family reads, Ask 15). The 3d allocation window over Allocations is the reference. Keep the
  family's address `/{org}/admin/families/{personId}` (the list with the record over it), so no old link breaks; keep
  `/families/duplicates` as the Duplicates tab's address.
- **The pick-one pill:** `SingleSelectDropdown` (`components/coaches/SingleSelectDropdown.tsx`) with `lead` (the olive
  "what is read" face) and `detail` (a quiet figure at each option's end). On a phone its options open as the portal's
  menu sheet (the 10-12 ruling: a menu sits on top of the bar and stops well short of the top). Search: the tournament
  toolbar's shape (`components/admin/tournament/AdminToolbar.module.css`: beside the toolbar at a desk, its own 44 px row
  under it at ≤640). No Filter button: there is nothing to narrow (absent beats disabled). The chosen question belongs
  in the address (so Back, a reload and Previous · Next keep it).
- **The table and the phone list:** the standard's table (display-face uppercase headings, figures and their heading on
  one side, the name is the link and the whole row opens, one chevron column, the one chip) and its phone rule (white
  cards with a corner chevron, the whole card the door). Today `families.module.css` overrides headings to body-face
  sentence case (S5-03, S2-06's class) and its `.table th` beats `.num`, so Owing's heading sits left of its figures.
- **The joined band:** the portal's money band (`MoneySummaryBand` / the club's `.mband` usage), two-up on a phone.
- **The one club send window** (5a used or extracted it for Message this family): Ask the coaches wears it too. Its
  delivery copies the scheduler's send to coaches (`lib/club-schedule-send.ts`): colleague mail with replies to the
  sender, a "Your club" bell to each recipient, a log row per send claimed before any email goes ("Last sent … by …").
  ⚠ Coaches are colleague mail, never the family door. The bell is informational (not Needs attention) unless the owner
  says otherwise — say so in the UX summary.
- **The club's roster is read-only** (Stage 2: the coach keeps it), so a rep child's guardian can only be added by the
  team's coaches; a house-league registration is the club's own and opens for editing
  (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx`).
- **The duplicate rule lives in one place** (`buildDuplicatePairs` in `lib/families-read.ts`); the merge route already
  takes `keepId` / `mergeId` but never checks the pair was proposed; `families_merge_people` (mig 254) is the one
  transaction. 5a added the "email changed" proposal from its re-attachment record.
- **The layout sweep already measures Families** (`scripts/layout-screens.mjs`: `admin-families`, `admin-family`,
  `admin-families-duplicates`, on UAT Rep Club as its owner). Their addresses stay; their screens change: re-baseline
  with reasons. `check:old-look` is the ratchet for retiring `families.module.css`.
- **Help is the home for the explanations** the family page's six footnotes carried (Ask 6).
- A walk of a screen another session is editing is not a walk; other sessions share the dev server and UAT Rep Club.

## Preconditions (check before code)

1. **Git:** on `dev`; 5a's commits present; `git log` and `git status` read fresh; other sessions' hunks are theirs.
2. **The UX summary for the owner comes first** (AGENCY_RULES): what a club admin sees (one page with two tabs, the Show
   pill, the record with Previous · Next, Duplicates where they choose the survivor, the no-family list that says who
   adds a guardian and Ask the coaches), what a treasurer and a team-limited member see (nothing unless given
   Families; the limited member can't be given it, and the Members screen now says why), what a **head coach** sees
   (an email and a "Your club" bell when the club asks them to add guardians — the only coach-side change), what a
   family sees (nothing new in 5b). Any departure.
3. **One browser tester at a time.** Ask the owner before any capture, probe against the dev server, `check:layout` run
   or `auth-setup`, and before seeding or resetting a test club. New files and shared modules change, so a dev-server
   restart is owed before the walks: ask first.

## What to build (P1–P3 are the detail; this is the order)

1. **Families, one page with two tabs** (Ask 14): a Families frame (server gate as Accounting's), tabs Families ·
   Duplicates (the amber waiting pill on Duplicates), the rail row with no pages and the same count; `admin-kit-nav`
   and its test.
2. **The Families tab** (P1): the page title; the list's line ("N families · N children have no family on file", from
   5a); the **Show** pill (`lead`, each question's count as its option's `detail`, the chosen one ticked; "All
   families" is one of the six); Search; the table to the standard (Family · Children · Balance · Chased · chevron;
   FEE NOT PAID as a chip on a league child's line; the one chip for Chased); the whole row opens the family; the
   phone's cards; paging or a Load more if a list passes the portal's page size.
3. **"No family on file"** (P1, Ask 4): children grouped by team (band rows); "Why"; no action in a cell; a rep row
   does not open; a house-league row opens its registration; the line "Only a team's coaches can add a guardian to a rep
   roster." and **Ask the coaches** → the send window (a row per team with its head coach and the number of players the
   email names; "Nobody to send to" for a team with no head coach; See <team>'s email; Last sent … by …; Cancel and
   "Send to N coaches"). The coach's email names their players with no guardian on file and where to add one (their
   Roster). The log stores teams and counts, never the children's names (one small table, dictionary + snapshots, RLS
   on, `org_id` indexed; `MANUAL_PROD_STEPS.json`). Words → /marketing.
4. **The family, a record over the list** (P2, Asks 5, 6, 15, 17): `KitDialog` wide, `address`, `steps` through the
   Show list it came from; head = the list and place ("Owes money · 1 of 5") + the name + ×; top line = Message this
   family (opens 5a's window over the record, the kit's form-over-record layer) + Export (5a's menu); the band (Rep
   dues · Paid · Balance); Children as one table (each child once; Dues · Paid · Balance; the league fee chip on its
   row); Contact as read lines (addresses, phone, club email, Last messaged … by …, where the family is named); Forms
   and consent as a table with the one chip; History, five lines + "Show all N"; no pencil; Previous · Next in the
   foot. Phone: the full-screen sheet, Message and the Export icon at its top (44 px), the band two-up, children as
   rows, Next in the foot. The six footnotes go to Help (/docs), not into the record. Retire the old family page.
5. **Duplicates** (P3, Asks 7, 8): the tab; each proposal's reason in words; names as typed with their team and season;
   **the reviewer chooses which record survives** ("Keep this record" on each side; default the side with children,
   then the newer); one consequence sentence naming the addresses; "Merge into <name>" (the first card's is the
   screen's one lime) and "Not the same person". **The rule** (one place): first names must agree (an initial matches
   its name); a shared child must be the same child (same name and the same birth date where both are known, otherwise
   the same team and season); 5a's "email changed" proposal joins; three or more records that match are ONE card.
   **The server merges only a pair it would propose now**, with the keeper the request names. No undo (Ask 8).
   Re-measure on UAT Rep Club: its 212 proposals were a seed name pool (seven "Caleb Hughes" guardians on seven teams);
   record the new count.
6. **Members** (Ask 12): the "what they can open" row for Families says why it can't be given to a team-limited member
   (/marketing words; 5a refuses it at the server).
7. **Retire the old look:** `families.module.css` and the old pages go; `check:old-look` drops its Families entries;
   the three sweep entries re-baselined with reasons (Warm and Dark, 1440 and 390; the record and the Show menu open in
   their own entries if the sweep can open them).
8. **Help** (`/docs`): the Families articles rewritten for the tabs, the Show pill, the record and Previous · Next,
   choosing the survivor, the no-family list and Ask the coaches; the footnotes' sentences said once here; old words kept
   as search terms. The coach's help gains a line on the club asking them to add guardians.

## The walk (Ask 25): §54 + §56 as ONE walk, after this build

A new Owner QA ledger § (take the number **at the moment you write it**; grep the ledger before and after appending),
replacing §54 and §56 (mark both "superseded by §N"), as checkable walks on the hub's QA tab (a new "Stage 5" group;
read the live hub first, parse every script before publishing), one purpose each, with the sign-in card:
- **The test club** (`qa-families-fixture`): `uat-families-owner@qa-families-fixture.local`, password from `.env.local`
  (the standing UAT password); open `/qa-families-fixture/admin/families` directly.
- **UAT Rep Club**: its owner `uat-club-owner@uat-rep-club.local` (no-family list, Ask the coaches, the 212-pair
  re-measure), and its treasurer (no Families) for the refusal.
Cover, pinned to identities (names, row kinds), never to as-of-today figures: the Show pill and its counts; a family
opened from "Owes money" and Next through the list; **the Reyes balance equals their team's Money hub** (a relationship,
not a figure); **a merge that holds after a reload**; **an edited email that moves the child and is proposed**; choosing
the survivor; Not the same person remembered; the no-family list and Ask the coaches (the coach's bell; dev email does not
reach fixture inboxes — check the log row and the bell, not an inbox); the message window (who it reaches, Last
messaged, the opted-out family's missing door, the cap's words); the export's PDF contents against its statement; §56's
suppression cases (an opt-out under a former address silences the Families door and a team announcement) and the
transactional exemptions; a phone pass at 390. A destructive step (merge) goes last and says so; a writing step names
the row the owner can read back.

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files (`admin-kit-nav.test.ts`,
  `families-access-guard.test.ts`, the duplicate rule's own new test: first names, the same-child rule, clusters, the
  keeper default, a merge refused for an unproposed pair), `check:spelling`, `check:css-selectors`, `check:contrast` +
  `check:text-contrast`, `check:old-look`, `check:dictionary` (the log table).
- **A screens guard for this stage** (`tests/unit/club-stage5-families-guard.test.ts`): Families has two tabs and its
  rail row no pages; the Show control is `SingleSelectDropdown` with `lead` and no row of pills renders; the family
  opens in `KitDialog` with `address` and `steps` and no `edit`; the record renders no footnote paragraphs; Duplicates
  posts the keeper the reviewer chose; the merge route refuses an unproposed pair.
- **`check:layout --changed`** (ask the owner first; never a whole-product sweep on the dev server): the Families entries,
  1440 and 390, Warm and Dark; baseline with reasons.
- Then `/simplify`, `/review` at the **high-risk** tier (PII screens, a merge rule, a new send to coaches), `/design` on
  the built screens against P1–P3 at 1440 and 390 in Warm and Dark, and a **/marketing** words pass on exactly the new
  strings before the commit.

## Hand-off

- An owner-voice summary, the walk to run (its link), departures from the drawings, and anything found and not fixed.
- Records: the Club plan's Stage 5 record ("5b BUILT"), the PM brief, memory `project_club_families_book` and
  `project_club_tier_readiness`, the TODO Stage 5 line, the ledger §, the hub's QA tab republished at the same address.
- **Commit only when the owner says**, from a private index with this session's files and hunks only. Export and
  typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared index.
- What follows (not this session): **5c**'s and **5d**'s own drawing sessions (record a payment against the family,
  internal notes, the staff match; then "confirm this household" and household money — who funds a sibling discount is a
  `/strategy` question before it is drawn).
