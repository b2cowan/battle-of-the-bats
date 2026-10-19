# Club Tier Stage 5c — Families: record a payment (the club's own fee; a rep payment handed to the coach), staff notes (built to hub version 121)

> Paste into a fresh session on `dev`. Written 2026-10-19, the day Stage 5c was **drawn and ratified**: all ten asks
> (26–35) as recommended (the owner pasted the answers instrument, 10 of 10; Ask 29 with both recommended options).
> **One build session.** Migrations: one table for the hand-off, one for notes, and a redefinition of
> `families_merge_people` (function-only — the prod-function blind spot applies).
>
> **⚠ A production release may still be being promoted from `dev`.** Commit locally only when the owner says, and **do not
> push** until the owner says the release's staging sweep is done. Never a whole-product layout sweep on the dev server.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 (version 121) → Mockups → **Stage 5c** →
> **P1** (the whole record, desk + phone, Warm + Dark), **P2** (Record a payment: the window, the refusals, the coach's
> side, the phone sheet, the record afterwards; the two un-chosen shapes at its foot are NOT to be built), **P3** (notes:
> Add a note, a note read, a note edited, empty and capped, the phone sheet), **P5** (the family file's first page).
> **P4 (the staff match) is CUT — build none of it.** The walk screens hold the findings (S5C-01…S5C-10); the Decisions
> tab holds Asks 26–35 with their reasons; the Formatting check screen holds /design round 1 (D1–D10, all applied to
> the drawings) and four written-rule contradictions the owner has not ruled — where one bites, follow the drawing.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`): every tag note is a requirement.
>   The names in the drawings that are not the test club's (the head coach "Pat Moreau", Milan's unpaid fee, the notes)
>   are drawn cases; the seed grows real ones (Part F).
> - Where you must depart, say so at build time and record why in the Club plan's Stage 5 record; never silently.
>
> **Read first:** the Club plan §6 Stage 5 (the "5c WALKED + DRAWN" and "5c RATIFIED" records, and 5a/5b's *Found, not
> fixed*); the rulings **D1** and **D3** (§5); `CLUB_FAMILIES_BOOK_PLAN.md` §1.3 (two doors, one mechanism, never a fork),
> §5.3–§5.5, §8.4 (retention: deferred; what you store lands inside it). The design log's **2026-10-19 "CLUB STAGE 5c ·
> FAMILIES"** entry (the rulings, written by the drawing session) and its 2026-10-17 Stage 5, 2026-10-16 (Needs
> attention clears itself), 2026-10-12 (the window's foot), 2026-10-08 (the joined band), 2026-10-01 (a record reads
> first), 2026-09-24 (edit autosaves, create asks) entries. `AGENTS.md` (read `node_modules/next/dist/docs/` before a
> route or a page). Memory: `project_club_families_book`, `feedback_build_to_approved_mockups`,
> `feedback_portal_is_the_formatting_benchmark`, `decision_record_reads_first_edits_whole`, `decision_edit_autosaves_create_asks`,
> `decision_autosave_word_is_transient`, `decision_rare_door_ends_body`, `decision_window_foot_text_left`,
> `feedback_money_figures_one_joined_band`, `project_needs_attention_self_clearing`, `project_one_window`,
> `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_partial_commit_shared_tree`,
> `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`.

## ⚠ What this code already taught (verified 2026-10-19 by the drawing session — re-read the lines before you lean on them)

1. **A rep payment is one write with two effects.** `recordRepDuesPayment` (`lib/db.ts`, ~11157) posts an income entry to
   the TEAM ledger (“Player dues — {name}”, dated the day received) and then inserts `rep_dues_payments`. The club's
   ledger routes refuse a team's book (`TEAM_BOOK_READ_ONLY`, `lib/club-money-words.ts`; both
   `app/api/admin/accounting/ledgers/[ledgerId]/entries` routes). **No club route may call it, and none of yours will:**
   the club's door for a rep payment is a hand-off; the coach's existing save stays the only writer (Ask 26).
2. **The coach's writers are three**, all behind a coach assignment on the team + `canWriteMoney`, live season only:
   Record money (`.../players/[playerId]/dues-payments` POST), Correct a receipt (the `[paymentId]` PATCH = remove, then
   record — the corrector becomes `created_by`), an installment's “Record as paid”. Plus a system writer in
   `lib/coach-upgrade-migration.ts`. A closed season has no program year: `getActiveRepProgramYear` returns draft or
   active only, and the route refuses with `refuseWithoutLiveSeat` / 404. Your hand-off must refuse the same way.
3. **The house-league fee's write is inline** in `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`
   (the `feePaid` branch, ~L133–180: the role check owner / `league_admin` / `league_registrar` + `module_house_league`,
   the `registration_fee_paid` flip, the ledger entry via `createLeagueRegistrationFeeEntry`, `lib/db.ts` ~2906, posted /
   pending, dated today; a closed fiscal year refuses un-marking). **Extract it into one function first** and make the
   registrations route call it, then the family window — never a second copy (§1.3).
4. **Families has one permission for everything** (`requireFamiliesAccess`, `lib/families-auth.ts`: `module_families`,
   off by default for every role, owner short-circuit, refused for a member limited to some teams). A house-league line
   ALSO needs the fee permission of point 3; a rep line is a send and needs Families alone (Ask 27).
5. **The family's money is READ through the money module** (`seasonDuesFigures`, `lib/dues-ladder.ts`, via
   `lib/families-read.ts`) — never re-derived. The window's balances and the record's band come from that same read;
   the band moves when the COACH records a handed-off payment, not when the club sends it.
6. **The family file says exactly what it holds, as one list in code** (`FAMILY_FILE_SECTIONS`, `lib/family-file.ts`;
   assembled in `lib/families-export.ts`; the PDF in `lib/export/pdf.ts`). **It holds the coach's private pinned note
   today** (`lib/families-export.ts` selects `rep_roster_players.notes` and prints it as “Notes”, ~L40/L81) while its
   “Not in this file” box (`lib/families-words.ts` ~L84) says development notes stay with the team — S5C-03; Ask 29 rules
   it OUT. Every export writes an org audit line.
7. **A merge forgets what is keyed to the merged person** unless the merge function moves it: `families_merge_people`
   (newest definition mig 334; mig 336 pins its search path) moves addresses, rows, `family_messages` and proposals, but
   `org_person_match_rejections` cascade-delete. Notes must be moved inside that one transaction.
8. **Ask the coaches is the delivery to reuse** (`lib/families-coach-ask.ts` `coachAskPreview` / `sendCoachAsk`,
   `family_coach_asks` mig 335): colleague mail to each team's head coach (`loadHeadCoaches`), a “Your club” bell, a log.
   Never `sendFamilyEmail` — nothing in 5c reaches a family. A new Needs-attention kind must clear itself for every
   recipient when handled (owner 2026-10-16; `37d0fe49`/`97ebde23`, mig 332).
9. **Notes have one recipe already:** the coach's player notes (`components/coaches/PlayerNotesTab.tsx` over
   `rep_player_notes`: a dated, signed list, “Add a note”). Every club-side note today is a single unsigned box; do not
   copy those.
10. **The test club cannot show the cases:** no co-guardian, no team staff and no head coach on Fixture Falcons U13, no coach
    sign-in, Milan's ticked fee has no ledger line (`fee_entry_id` null), no unpaid fee beside a rep balance. 0 guardians
    share a sign-in email with staff on either test club (irrelevant now F is cut).

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` / `git status` read fresh. Other sessions leave hunks in this shared tree (on 2026-10-19:
   the coach's `accounting/dues/panel.tsx` and `expenses/panel.tsx` neighbours, `memory/design_decisions.md`, many more) —
   they are theirs; read the files fresh, stage only your own hunks.
2. **The UX summary for the owner comes first** (AGENCY_RULES), in product-owner words: what a club admin sees (Record a
   payment on a family's top line when something is owed; one window that records a house-league fee now and sends a rep
   payment to the head coach; a Sent to coach chip until the coach answers; Notes after Children), what a registrar
   without house-league rights, a treasurer and a team-limited member see, what a **head coach** sees (a “Your club”
   bell + email with Record it and Not received; their own Record money filled in — the only coach-side change), what a
   family sees (nothing new), what the family file now says. Any departure.
3. **The design-log entry is already written** (2026-10-19, “CLUB STAGE 5c · FAMILIES”); check it is in `HEAD` and do not
   write a second.
4. **One browser tester at a time.** Ask the owner before any capture, probe, `check:layout` run, `auth-setup`, and before
   the reseed (Part F). New files, migrations and shared modules change, so a dev-server restart is owed before the walk:
   ask first.

## What to build (the drawings are the detail; this is the order)

**Part A · One house-league-fee write.** Extract the registrations route's `feePaid` branch into one function (role and
module check, the flip, the ledger entry, the closed-year refusal) and make the route call it. Behaviour unchanged; a
guard test pins that both callers use it.

**Part B · The hand-off (the club's rep door).** A table for a payment the club received and passed to a team (ask `/db`
for its shape; it needs at least: org, the guardian record it was sent from, the child's roster row, team, program year,
amount, date received, method — `DUES_PAYMENT_METHODS`, note, sent by / at, a state `sent | recorded | not_received`, who
resolved it and when, the payment it became). `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit; prod at
or before the promote that carries 5c. Delivery through Ask the coaches' path (point 8), recipients the team's head
coach(es); refuse with the drawn reasons when the team has no live season or no head coach.
- **Coach side:** the bell's **Record it** opens the coach's own Record money for that player, filled in (amount, date
  received, how, the note “Received by the club ({name}): …”; the player card reads “Owes $X · sent by the club · {date}”)
  — today's window and words (`expenses/panel.tsx` “Record money” / the player window in `dues/panel.tsx`), nothing else on
  the coach's screen changes. **Save posts through the existing dues-payments POST**, which gains an optional hand-off id:
  the route checks it belongs to this org, team and player and is still `sent`, records the payment the ordinary way, and
  marks the hand-off `recorded` with the payment id. **Not received** is a coach route that marks it `not_received`; the
  club person who sent it gets a notification in the admin's bell. Both clear the coach's Needs-attention for every
  recipient. `/review` decides the ordering and failure handling of “payment written, hand-off not marked” — never a state
  the record cannot explain.
- **Record side:** an amber **Sent to coach** chip beside the child while `sent`; a red **Not received** chip when
  `not_received`; History gains the send and its outcome (amount, coach, date, who sent it).

**Part C · Record a payment (the window).** `KitDialog` medium (640), raised over the record (One Window). As P2: the
statement; Amount received; the two-figure joined band Placed · Left to place; one line per child who owes, pre-placed in
the record's order up to each balance — a house-league line a whole-fee tick, a rep line an amount and “To {coach}, to
record”; Date received (never after today), How, Note; the foot's sentence in `footerStart` saying, child by child, what
pressing does; Cancel + the lime act (“Record and send”, “Record” or “Send to the coach” by content). Refusals as drawn (a
line's dim reason and no input; more than owed explained, not refused; money left to place = the standing reason in the
act's place, the act absent). One server route validates every line before it writes anything, then marks fees (Part A)
and creates hand-offs (Part B); it reports exactly what was done. **The top line:** Message this family · Record a payment
· Export, all `btn-outline`; Record a payment absent when nothing is owed or the member can do none of its lines; phone
label “Record payment”, 44 px, one row (check at 360 px that no label wraps). Phone: the window as a full-screen sheet.

**Part D · Notes.** A table for a family's notes (org, the guardian record, body ≤ 1,000 characters, author, created,
updated; RLS on, service-role only, like the other Families tables), its routes under `app/api/admin/families/[personId]/`
behind `requireFamiliesAccess` (list, create; edit for the author; delete for the author or the owner, writing an org audit
line of who and when — never the words). **Redefine `families_merge_people`** in a new migration so the notes move to the
person kept inside the one transaction (add its `prosrc` check to `MANUAL_PROD_STEPS`). UI as P3: a Notes section after
Children (16 px heading, Add a note outline at its right, the once-line, newest first, the newest two then Show all; with
none, “No notes yet.”); Add a note = `KitDialog` form size (520), required, Save note the lime; a note opens on its own,
reads first, the author's pencil ↔ ✓ (`edit`), autosave with the transient pill, `RecordDelete` “Delete note” at the body's
end in both modes, asking once. Phone: cards and sheets. Words for the once-line and the hint are /marketing's.

**Part E · The family file.** Add a section “Notes about the family” (who wrote each and when) to `FAMILY_FILE_SECTIONS`
before Records joined, so the statement follows; Money lists hand-offs (when, to whom, what came of it); Children names the
club's staff note on a registration as such; **drop the coach's pinned note** (`rep_roster_players.notes`) and add “a
coach's pinned note about a player” to the Not in this file box. Words: /marketing; counsel's read of the statement is
already owed — tell the owner the statement changed.

**Part F · The test club grows its cases** (Ask 33, approved at the build — **ask the owner before the reseed**). Extend
`scripts/seed-families-fixture.mjs`: a head coach who can sign in on Fixture Falcons U13; a second rep team with its own
head coach, and a family with a child on each team; Milan's fee unpaid (and a paid fee that has its ledger line); a team
with no live season and one with no head coach; a member given Families without house-league rights; two people who each
have a note, proposed as duplicates. Never seed `riverdale-*`.

**Not this build:** the staff match (cut, Ask 30); D, a second guardian's write (Not yet, Ask 31); 5d (its own drawing
session after this, Part B of `CLUB_TIER_STAGE5CD_MOCKUP_PROMPT.md`); the coach's receipt trash row action (S5C-10, the
coaches portal's); any receipt email to a family.

## Tests that must fail on today's code (the definition of done)

- **The payment path through the one write:** a stage guard (`tests/unit/club-stage5c-families-guard.test.ts`) — the
  registrations route and the family payment route both call Part A's one function; no `app/api/admin/**` file imports
  `recordRepDuesPayment` / `removeRepDuesPayment` or writes `rep_dues_payments` / `rep_dues_credits`; the coach's
  dues-payments POST resolves a hand-off id and refuses one for another team, player or state; the family record renders
  Record a payment only when something is owed.
- **Notes survive a merge:** a SQL test of the new `families_merge_people` that installs the migration's own text inside a
  rolled-back block (5a's `--old` technique) and fails on today's function.
- **The file:** the export never selects `rep_roster_players.notes`; `FAMILY_FILE_SECTIONS` holds the notes section and the
  statement names it (extend `tests/unit/families-stage5a-guard.test.ts`).
- **Needs attention:** the hand-off's coach notification clears for every recipient on Record it and on Not received.
- **Unchanged and still passing:** the through-the-person suppression test (the family email choke point — 5c sends nothing
  to a family) and `families-access-guard.test.ts`.
- **The old-look ratchets** do not grow: `check:old-look` and `check:admin-type` (new lettering only where a `type-ok` role
  applies).

## Gates

- `npm run verify:changed`, `npm run typecheck`, the targeted unit files above, `check:spelling` (installment, a.m., the
  bare possessive), `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:dictionary`,
  `check:manual-prod-migrations`.
- **`check:layout --changed`** (ask the owner first; never a whole-product sweep on the dev server): the family record and
  its two new windows, the coach's Record money, 1440 and 390, Warm and Dark.
- Then `/simplify`, `/review` at the **high-risk** tier (money, a new coach-side write path, PII notes, a merge function),
  `/design` on the built screens against P1–P3 and P5, `/marketing` on exactly the new strings, `/docs` (the Families help
  article: Record a payment, Notes; the coaches' help: the club's payment notice).

## The walk (Ask 34): its own ledger section, after this build

Not a re-run of §329. The next free § in `OWNER_QA_LEDGER.md`, written as checkable steps on the hub's QA tab (group
“Stage 5c”, one purpose per walk), on the test club after the reseed: the top line and the window with both kinds of line;
the refusals; the coach's side (Record it, Not received) with the test club's new head coach; notes (add, read, edit,
delete, none, Show all, a merge that carries them); the family file; who sees what (the owner, a Families member without
house-league rights, a treasurer, a team-limited member, a head coach); the phone. Dev email cannot reach `.local`
inboxes: say which steps are bell-only on dev.

## Hand-off

- An owner-voice summary, the walk's link, departures from the drawings, anything found and not fixed, and that the file's
  statement changed (counsel).
- Records: the Club plan's Stage 5 record (“5c BUILT”), the PM brief, memory `project_club_families_book` and
  `project_club_tier_readiness`, the TODO Stage 5 line, the ledger §, the hub's QA tab republished at the same address
  (its live copy counts as viewed after a `read`; parse every script before publishing).
- **Commit only when the owner says**, from a private index with this session's files and hunks only; after it,
  `git reset -q -- <paths>` on the shared index. **Do not push** until the owner says.
- What follows (not this session): **5d**'s own drawing session — gates in Part B of the 5c/5d prompt (5c ruled ✅; /strategy
  on who funds a sibling discount; a packaging answer for League Plus against Club; none of the four cancelled).
