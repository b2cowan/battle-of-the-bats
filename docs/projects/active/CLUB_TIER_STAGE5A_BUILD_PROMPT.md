# Club Tier Stage 5a — Families: the record made true (built to hub version 116)

> Paste into a fresh session on `dev`. Written 2026-10-17, the day Stage 5 was **ratified**: all 25 asks as recommended
> (owner: *"ok all looks good, I agree with your recommendations, can you write up the build prompt"*). **One build
> session, the first of two.** 5b (`CLUB_TIER_STAGE5B_BUILD_PROMPT.md`) redraws the screens after this one commits.
> **Migrations: yes** (a function revision and two small tables). Production holds no real organization that can reach
> Families (owner-approved count, 2026-10-16), so nothing here is a hotfix; it ships with the Club release.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 (version 116) → Mockups → the **Stage 5**
> button. Read the walk screens (where it stands, stations 1–7, standing back, the ladder) for the findings, then the
> proposals **P1–P5**. Every changed part carries a stage chip: **5a is yours**, 5b is the next session's.
> - **P4 (Message this family) and P5 (Export) are 5a in full.** Build them to the drawings exactly
>   (memory `feedback_build_to_approved_mockups`): every New / Restyled / Unchanged tag note is a requirement — open each.
> - **P1–P3's 5a-tagged parts are data and words, shipped on TODAY's screens** (see "On-page changes" below). 5b
>   replaces those screens, so make the change, don't restyle around it.
> - A green "fixes E0x / S5-0x" chip names the finding a drawing answers; the finding's dialog says what the code does
>   today. The Decisions tab holds all 25 rulings with their reasons.
> - Where you must depart, say so at build time and record why in the Club plan's Stage 5 record; never silently.
>
> **Read first:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §4E and §6 Stage 5 (the walked-and-drawn record, the
> ratification); `CLUB_FAMILIES_BOOK_PLAN.md` §1.3 (two doors, one mechanism), §4 (matching rules), §5.3, §5.4 and
> §5.5 (P2's binding decisions and the review lessons); `CLUB_FAMILIES_BOOK_P3_PROMPT.md` §3 ("settled — do not reopen")
> and §4 (lessons). `AGENTS.md` (this Next.js is not the one you know — read `node_modules/next/dist/docs/` before a
> route or a page). Memory: `project_club_families_book`, `project_family_email_suppression`,
> `project_club_tier_readiness` (its first screen only), `feedback_build_to_approved_mockups`,
> `feedback_portal_is_the_formatting_benchmark`, `decision_export_is_one_button`, `decision_edit_autosaves_create_asks`,
> `decision_drawer_layers_form_vs_menu`, `feedback_exports_house_format`, `reference_dev_email_cannot_reach_fixtures`,
> `reference_partial_commit_shared_tree`, `reference_backticks_in_shell_strings`. The in-repo
> `memory/design_decisions.md` entries 2026-10-11 ("one club send"), 2026-10-12 (a standing reason in a window's foot;
> a sentence in a foot sits left), 2026-10-09 + 2026-10-11 (an Export sits above what its file holds), 2026-10-08 (an
> export menu names its file in one line).

## ⚠ What this code already taught

- **Attachment has ONE home:** the SQL function `families_attach_people(org)` (migration 252; the team move, mig 313,
  calls it too). About ten write paths save a guardian email and none of them makes a person, on purpose. **E01 and E02
  are fixed inside that function**, keeping 252's rules verbatim (normalize, the claim alias, ambiguity refused,
  newest-non-blank name/phone). Never add per-route minting.
- **A function-only migration is invisible to every drift gate.** Mig 254's two functions were confirmed on production
  only by hand (`pg_proc`, 2026-09-25). Your revised function needs a `MANUAL_PROD_STEPS.json` entry with a check that
  proves the NEW body is live (a distinctive string in `prosrc`), ordered before the promote.
- **`status = 'verified'` on family links is load-bearing** in every household read (a revoked guardian is a coach's
  explicit removal; custody disputes are the canonical case). Keep it in anything you touch.
- **Compliance carried in a parameter lapses.** Suppression through the person lives inside the family choke point
  (`getFamilySuppressionList` / `sendFamilyEmail` in `lib/family-email.ts`), not in callers. The reply address you add is
  an OPTION on that one door (additive; other senders unchanged), and `tests/unit/family-email-guard.test.ts`'s manifest
  is hand-kept: update it.
- **Money is READ, never recomputed** (§1.3). Families reads `rep_player_dues_installments.paid_at`, a projection the
  money module stamps only once payments cover a whole installment (mig 232), and sums every credit row whatever its
  kind. The coach's Player dues table computes the ladder (Dues − Fundraising − Other credits − Paid + Handed back =
  Balance; event terms hide at zero) from `rep_dues_payments`, credits and payouts — see the dues route
  (`app/api/coaches/[orgSlug]/teams/[teamId]/dues/route.ts`), `lib/dues-payments.ts`, `lib/dues-credits.ts`
  (`deriveDuesPosition`), `lib/coach-dues-actual.ts` (`buildFamilyDuesInputs`, `duesActual`). **Find the one derivation
  the Player dues table shows; if it lives only in the route, extract it into the money module (one home) and have both
  read it.** Never a third copy. A parity test pins it (Gates).
- **Paging is half done without an order.** `lib/family-email.ts` has the right helpers (`readAllPaged`, `chunked`,
  ordered on a column unique in the org); lift them to one shared place and use them for every Families read (E05).
- **Every read of the area writes today** (`loadOrgFamilyWorld` runs the attach first, on the worklist, the family page,
  the duplicates and the export), and a failed attach takes the whole area down ("Could not load the family book"). Run
  it once per visit (the worklist's entry) and never let it fail a read: log it and read on.
- **Two checks became three.** Every Families route asks (1) the member holds `module_families` and (2) the plan
  carries it; every query scopes to the org. Add (3): a member limited to a group of teams is refused
  (`teamIdsInScope(ctx)` in `lib/club-team-route.ts` returns a set for a limited member, `null` for the unlimited),
  both at the route (`lib/families-auth.ts`) and at the grant (the Members write path), with the reason in words.
- **The one club send window** already exists twice: the scheduler's `components/admin/kit/club/schedules/SendWindow.tsx`
  and the accounting `components/admin/kit/club/money/RemindersWindow.tsx`. Message this family wears that shape (the
  10-11 ruling). If the shape is not yet a shared part, extract what the two share rather than drawing a third copy
  (memory `feedback_shared_component_over_shared_class`). ⚠ **Mail paths never mix:** staff mail is colleague mail; a
  family is reached ONLY through `sendFamilyEmail`.
- **The audit log:** `writeOrgAudit` in `lib/org-audit.ts`.
- **The test club is thin and partly wrong** (S5-08): `qa-families-fixture` had NO member until 2026-10-16 (a dev-only
  owner was made by hand: `uat-families-owner@qa-families-fixture.local`, the standing UAT password); its org has no
  `onboarding_completed_at` (the owner lands in setup from the hub — open `/qa-families-fixture/admin/families`); it
  records **no payments**, only paid stamps, so the team's Money hub reads $0.00 paid for the Reyes children; it holds no
  merge and no edited email. `scripts/seed-families-fixture.mjs` is idempotent keyed inserts.
- **Dates through `formatStoredDate`, clock times through `formatTime`**; "installment", two Ls (`check:spelling`).
  Stale-response guards on every PII screen (P2 added them; keep them).
- ⚠ **The `.probe/` folder was emptied by something outside a session on 2026-10-16/17.** Keep probes small and
  re-creatable; never rely on one surviving overnight.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. Other sessions' uncommitted hunks in shared files (TODO, the
   QA ledger, the design log, `lib/db.ts`, the data dictionary, the hub) are theirs.
2. **The UX summary for the owner comes first** (AGENCY_RULES), short: what a club admin sees differently on today's
   Families screens after 5a (the figures, the message window, the export), what a treasurer or a team-limited staff
   member sees (nothing new unless given Families; a limited member can no longer be given it), what a family receives
   (a reply address, a cap, a readable export), what a head coach sees (**nothing changes**). Any departure.
3. **One browser tester at a time.** Ask the owner before any capture, probe run against the dev server,
   `check:layout` run or `auth-setup`, and **before running the fixture seed** (it writes to dev) or resetting UAT Rep
   Club. New files, migrations and shared modules change in this build, so a dev-server restart is owed before the
   owner looks: ask first.
4. **Migration numbers:** take the next free number at the moment you write each file (`ls supabase/migrations`);
   another session may take one the same day.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

`memory/design_decisions.md`, newest first (another session holds uncommitted entries at its top: add yours as HEAD +
your hunk, memory `reference_partial_commit_shared_tree`), and `memory/MEMORY.md`'s index if it lists entries. One
entry, "CLUB STAGE 5 · FAMILIES" (owner ratification quote above; hub https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9
v116 → Stage 5), carrying:
1. **Families is one page with two tabs, Families · Duplicates**; the rail row has no pages; the Duplicates count is the
   amber waiting pill (Ask 14; the 2026-09-30 one-page rule).
2. **A list's pick-one questions are ONE Show pill** (the lead `SingleSelectDropdown`): it names the question on screen
   and its count, opens the options with each count at its row's end (a panel at a desk, a menu sheet on a phone);
   Search beside it at a desk, its own row on a phone; no Filter until there is something to narrow. Never a row or a
   sideways-scrolling strip of pills (Ask 3; the owner's 08-19/08-20 one-control-shape rule, caught again 2026-10-17).
3. **A family is a record over the list**, stepping through the list it came from (Previous · Next); it reads and has
   no pencil until it owns a fact of its own (P3's notes); a contact detail is changed where it is typed (Asks 5, 15).
4. **A family's money is the team's money, read the same way:** each child once with Dues · Paid · Balance in the
   coach's ladder words; the family's rep figures as one joined band; a house-league fee is a chip, never summed (E03,
   E08).
5. **Message this family wears the one club send window**; replies go to the person who wrote it; three messages a day
   for one family; each send keeps its date and its sender, never its words or its recipients (Ask 9 — reads the
   2026-08-18 "date only" ruling as "never the words", ratified).
6. **A family's Export sits at the family's top, opens two formats, PDF first** (a named exception to the admin
   Export's "Excel first": a family file is a document), a structured file second; it holds the club's administrative
   file and says exactly what it holds and what it does not (Asks 10, 11).
7. **A row the club cannot fix says who can:** a rep child with no guardian on file is the team's coaches' to add (the
   club's roster is read-only since Stage 2); the club can ask them in one send (Ask 4).
8. **Duplicates:** the reason in words; the reviewer chooses which record survives (default: the side with children);
   first names must agree; a shared child must be the same child; a changed guardian email is proposed for a person to
   decide; nothing merges on its own; no undo yet (Asks 7, 8).
9. **Families is never given to a member limited to a group of teams** (a household spans teams) (Ask 12).
Also `docs/agents/design/TABLE_EXCEPTION_REGISTER.md` (or the export standard's home, if that is where the 10-01 export
rule is written): the family export's PDF-first order as a named exception, with its reason.

## What to build (in this order)

1. **Migrations** (dictionary + `npm run refresh:snapshots` in the same unit; RLS on, service-role-only tables get no
   policies; `org_id` NOT NULL and indexed — `check:indexes`):
   - **`families_attach_people`, revised** (function-only). (E01) Make a person only for an address nobody in the
     club's address book (`org_person_emails`) already owns — today it checks `org_people` alone, so a merge's address
     comes back as a childless "ghost". (E02) Re-point any source row whose typed address (normalized; for a family link,
     `claimed_email` else `invited_email`) is no longer one of its person's addresses, to the person who owns that
     address (made under 252's rules if new). Never merge: when the person left behind has no source rows left, write a
     re-attachment record (below) so the duplicate queue can propose the pair. Everything else verbatim.
   - **`org_person_reattachments`** (`org_id`, `from_person_id`, `to_person_id`, the source table and row id, `at`) — a
     row the attach writes when an edited email empties a person; read by the duplicate queue (P3's second card).
     Decide `ON DELETE` with the merge function in mind (a merge deletes a person).
   - **`family_messages`** (`org_id`, `person_id`, `sent_by`, `sent_at`) — date and sender only. It is the send's
     claim (written before any email goes), the cap (three per person per rolling 24 hours) and "Last messaged … by …".
     The claim and the cap check are ONE step (a function or a locked insert), or two presses race past three.
   - `MANUAL_PROD_STEPS.json`: the function body check (above), both tables, the order against the promote.
2. **The reads** (`lib/families-read.ts`): paged and chunked everywhere (E05); the attach once per visit, never fatal;
   **money through the money module's own position** per child (Dues, Paid, Fundraising / Other credits / Handed back
   when not zero, Balance), the family's rep figures (dues, paid, balance) and the league fee chip, never summed (E03);
   credits by kind, never one summed line; **children counted once** (E08): a child's rep seasons group under one name
   where a **confirmed** `rep_player_continuity_links` row joins them (mind its alias rule: a link may sit on the
   registration the roster row came from); a league row is never folded into a rep row; the worklist's line drops its
   children count; history from payment rows with the dollar sign (and every line in the export, uncapped);
   Guardians drops `portalActive` (E09) and labels a link-only person truthfully; the duplicate read adds the
   re-attachment proposal ("An email changed on <child>'s roster row, <date>").
3. **Message this family** (P4, all states): the window's read (who it reaches, guardian by guardian with suppression
   state; Last messaged with the sender's name; today's count; the sample email in the family envelope for "See the
   email"); the send (claim + cap in one step, then `sendFamilyEmail` with the new reply option = the sender's address,
   then `writeOrgAudit`); refusals in words (the cap race in Send's place, amber, count first — the 10-12 ruling). On
   the page: no door for an opted-out family or a capped one, the reason where it was. The lime counts who it reaches.
   Words in one words module, drafted as drawn, then **/marketing** on exactly the new strings.
4. **Export** (P5): one admin `ExportMenu` at the family's top (on today's page: the page head's right), formats PDF then
   structured file (JSON), the menu's one line; the **administrative file** (Ask 10 A): guardian and contact (every
   address with dates, phone, the club-email setting and how/when it was recorded), each child's registrations (team or
   season, birth date, medical notes, emergency contact, the club's notes), tryout applications with their consent
   (when, and the connection it came from), money (dues by child, every payment with date/amount/method, credits by
   kind, reminders sent, house-league fees), forms and consent (documents on file with their dates; waivers; consents),
   the message dates (with sender), records joined (merges with dates); then "Not in this file" (coaching records stay
   with each team; ask the head coach or the club). **The "what this holds" list and the assembler's sections are ONE
   list in code**, so the statement can never drift from the contents. PDF in the house format (`lib/export/pdf.ts`; the
   practice plan PDF's masthead and foot: club, title, exported on/by, page numbers; `npm run check:pdf` must pass, and
   a new report shape needs its entry there). Every export → `writeOrgAudit`. The statement's words → **/marketing** (and
   recommend counsel reads it before Club goes on sale: it is a privacy statement on a club's behalf).
5. **On-page changes on TODAY's screens** (temporary; 5b replaces them — keep it to data and words): the family page's
   Money card shows per child Dues · Paid · Balance (event lines when not zero) and "Rep dues balance"; the Children card
   says "N children"; the Portal access line goes; Contact gains "Last messaged … by …"; History payments carry "$";
   Export moves to the page head; Message opens the window; the worklist's line drops the children count and its
   Owing column reads the family's rep balance. (Hub v112's drawing A2, in the artifact's version history, showed the
   card's rows if you want a reference; nothing there is ruled beyond the figures and words.)
6. **Who can open it:** the route refuses a team-limited member; the Members write path refuses to give
   `module_families` to one, with a reason in words (/marketing; 5b draws the Members sentence). Owner default
   unchanged: off for every role.
7. **The test club** (Ask 24; ask before running): the seed ensures its owner sign-in (create or re-assert the password,
   as `seed-club-fixture.mjs` does) and `onboarding_completed_at`; records the Reyes, Ionescu and Whitehall payments
   **through the money module's own write path** (payment rows + the paid projection), with Riley's third installment
   part-paid ($50.00 of $150.00), so Families and the team's Money hub agree; adds a merged pair (merged through
   `families_merge_people`, then a re-attach proving no ghost) and an edited guardian email (Tatum Whitehall's row:
   `val.whitehall@example.com` → `v.whitehall@newmail.example`) that produces a re-attachment proposal. It prints its
   sign-in and the cases it built.
8. **Help** (`/docs`): the Families articles say what is now true — money as the team's book reads it; the message
   window (who it reaches, replies, three a day, what is kept); the export (what it holds and does not); history no
   longer claims reminders; "every guardian" means every guardian on a rep team's family links; no Portal access line.
   Keep the old words as search terms.

## Gates

- **E01–E04 proven by tests that FAIL on today's code** (run each against the old code first and say so in the record):
  E01 a merge then an attach leaves no ghost and no re-proposal; E02 an edited email moves the child to the new address
  and records a re-attachment, and a re-run changes nothing; E03 a **parity test**: for every rep player on the test club
  and on UAT Rep Club, Families' per-child Balance equals the coach's Player dues Balance, including a part payment and a
  credit of each kind; E04 the export holds every section its statement lists, and nothing it says it doesn't. SQL-level
  proofs follow the club money atomicity harness's pattern (`scripts/check-club-money-atomicity.mjs` + its `.sql`,
  with `--mutate`), so a regex-matched mutation can show each test bites.
- **The through-the-person suppression test covers the Families message door with its cap and reply address**
  (`family-email-guard.test.ts` manifest; every guarded sender has been pinned since 2026-08-18).
- **`families-access-guard.test.ts`:** off by default for every role (unchanged) + a team-limited member refused at the
  route and at the grant.
- The cap race: two sends at two-of-three, in parallel, one succeeds. Paging: a read past 1,000 rows returns them all.
- `npm run verify:changed`, `npm run typecheck`, the targeted unit files, `check:dictionary`, `check:indexes`,
  `check:spelling`, `check:export-catalog` (the new export), `check:css-selectors`, schema parity (red until the
  migrations reach production — expected; do not re-baseline it).
- Then `/simplify` (a lifted shared part, a new option on the family choke point), `/review` at the **high-risk** tier
  (PII, compliance, a money read, a SQL function every Families read runs), and `/design` on the built message window
  (1440 and 390, Warm and Dark) and the PDF's first page against P4/P5.
- **No owner walk in 5a** (Ask 25: §54 + §56 run once, after 5b). Prove the screens with a read-only probe on the test
  club (ask first): the Reyes Balance matches the team's Money hub; the merged pair stays merged after a reload; the
  edited email moved Tatum and the queue proposes the pair.

## Hand-off

- An owner-voice summary (what a club admin, a treasurer, a team-limited member, a family and a head coach see), the
  departures, and anything found and not fixed.
- Records: the Club plan's Stage 5 record ("5a BUILT" with the gates' results and the migrations' prod order), the PM
  brief if anything moved, memory `project_club_families_book`, the TODO Stage 5 line, `MANUAL_PROD_STEPS.json`.
- **Commit only when the owner says**, from a private index with this session's files and hunks only; Part 0 is its own
  commit. Export and typecheck the staged tree before committing; after it, `git reset -q -- <paths>` on the shared index.
- Then the owner runs `CLUB_TIER_STAGE5B_BUILD_PROMPT.md` in a fresh session.
