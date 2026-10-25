# Club Tier Stage 9b-1: sign-up, payments-ready (build prompt)

> **Written 2026-10-25**, the day the 9a walk (§372) came back clean and 9a's follow-ups were committed. **Paste this into a
> new chat on `dev` and re-verify every lead first.** The leads come from two helpers' reads of the working tree plus my own
> spot-checks of the cited lines (the register route's capacity block, the single definition of the fee RPC, the one `notify()`
> caller). This prompt names **files, not lines**, and code moves. Other sessions share this working copy (the themed date
> picker, Stage 4f and the bookkeeping work all have uncommitted edits in it): stage explicit paths only, commit only your own
> hunks, and use a temporary index when a file is shared (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5** (a money-adjacent database function, atomicity, a public form, five emails). Helpers stay on
> Sonnet as configured.
>
> 9b-1 is built in **parts, each committed locally after its own checks**, in the order below. Part 1 (the data and the one price
> resolver) is the base for everything else; Part 3 (atomic sign-up) is a live defect fix and may be committed on its own.

## What 9b-1 makes true

A convenor creates a season by giving it a **name, a sport and its dates**. Everything else is set on the season's own page:
**age groups added several at a time** ("Add age groups": tap U8, U10, U12, pick birth years, a size and a price for each), a
**price per age group with one early-bird date for the season** and an early amount per age group, **registration dates that
actually run the form**, the waiver, the email-consent line, and **how families pay**. The checklist ("Before families can sign
up") will not offer **Open registration** until age groups, prices, dates and (when any price is above $0) how-to-pay are set.

A family **signs up one or several children in one go**. Each child's date of birth is required and **picks the division**;
the form shows, before anyone presses Sign up, what happens to each child (a spot at $165, or the waitlist and nothing to
pay), says plainly when no division fits a birth year, and offers the club's contact instead of an error. The same child can't
be signed up twice; two people pressing Sign up for the last spot can't both get it; a waitlist position can't collide. Every
public sign-up puts a notice in the club's Needs attention. The family sees **"Accepted"**, never "Approved", on every screen and
email, a **reference** that finds the whole sign-up again, and (after acceptance) the **club's own how-to-pay words** and the price
that applies. The form still says "payable separately" and a greyed "Pay now" slot is drawn for 12b.

**It is server and public form only.** The staff Registrations screen is rebuilt once, in 9b-2.

## The rulings (do not reopen; record nothing they did not rule)

All in `docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §0 (round 1), §0b (round 2) and §0c, owner 2026-10-24, every one as
recommended. The ones that decide this build:

- **Q5** one sign-up registers several children (each its own registration, tied by one sign-up reference); **9b·5** each child's
  outcome is shown before Submit, a family can remove a child, there is no "only if every child gets a spot".
- **Q2 (the 9b-1 half)** the price follows the **sign-up date** for early bird. (Freezing it on the registration, the per-
  registration correction and "Move division asks to re-price" are **9b-2**; see Part 1's note on how the two meet.)
- **S1·a** Create season asks name, sport, dates; the rest lives on the Overview blocks. **S2·b** the dates run the form; the
  convenor can close early or reopen until a new date, and the season page says which.
- **9b·1** required before Open registration: age groups (birth years and size), prices, dates, and **how-to-pay whenever a
  price is above $0**; the waiver is optional. **9b·2** one early-bird date per season, an early amount per division.
  **9b·4** a birth year no division fits: the form says so and shows the club's contact; nothing is registered.
  **9b·9** how-to-pay text, one per season, required whenever a price is above $0; a free season says "Free" and asks nothing.
  **9b·12** "Accepted" on every family screen and email; staff keep the Approve button. **9b·13** two divisions for one age
  group: the family picks, seeing each division's note and its room; a full one shows as full.
- **Q19** one season, age groups as divisions, added several at once by **Add age groups**; the club picks the birth years (no
  guess from "U13"; the 4c-2 ruling). The drawn alternative "Create several seasons" is **not** built.
- **Contract lines kept** (plan §2): capacity atomic + a waitlist that can't collide; no duplicate child; approve respects
  capacity; CASL consent beside the waiver writing a `family_consents` row; payer = the guardian, no family account; **no
  household money** (two children = two registrations, one payment by hand); "payable separately" stays until 12b.

## Read first

- **The drawings, ruled:** https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT (source `HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`), tab
  **"9b-1 Sign-up"**: §1 Create window · §2 the season's page is its setup (Divisions block, Registration block, the checklist,
  the Add age groups window desk and phone) · §3 a division reads first, edits whole · §4 the family's form and the moment after
  Sign up · §5 the status page · §6 the emails. **The "9b-2 Money" tab is not yours** (see Do not).
- **Two ruled states were never drawn**, so their copy is yours to write through `/marketing`: **9b·4** (no division fits a
  birth year) and **9b·13** (two divisions for one age group, with each division's note and room). The drawn trace is only the
  Overview table showing U10 Division A and B at the same birth years.
- **The plan:** `HOUSE_LEAGUE_STAGE9_PLAN.md` §2 (payments contract), §3 (F07–F12, F23), §4, §6a (build notes), §9 (log).
- `HOUSE_LEAGUE_STAGE9A_COPY.md` (the house voice for this module) and `HOUSE_LEAGUE_STAGE9A_BUILD_PROMPT.md` (the shape of a
  9-series build).
- `memory/design_decisions.md`: "Edit autosaves, create asks", "A record reads first, edits whole", "One window", "A window's
  foot", "A disabled .btn fades", "Mark required, not optional", form selects are dropdowns, the phone secondary-action rule,
  absent beats disabled, "One spelling" (the clock is "8:00 a.m.").
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper; a helper's summary is a lead, not evidence.**
  Schema = dictionary, same unit of work; decide columns from the snapshots, never from migration files.

## Verified state (leads; re-check each)

| What | Today |
|---|---|
| Public sign-up route (`app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`) | Refuses unless the season's **status** is registration open; **never reads** `registration_open_at/close_at` (the register page gates on status alone too). Capacity is `count(status='active')` compared with `capacity`, then a separate insert: **two requests can both pass**. **`pending_review` rows do not count**, and `auto_approve_under_capacity` defaults to false, so on a review-first season the waitlist almost never triggers. Waitlist position is `count(waitlisted)+1`, also racy. No duplicate-child check. Mail is `void`-fired, errors only logged. **No staff notice.** One player per request. |
| Staff approve (`seasons/[seasonId]/registrations/[regId]/route.ts`) | The move to active **never checks capacity**; staff can over-fill. Decline/withdraw promote the first waitlisted row (when `auto_promote_waitlist`) without rechecking capacity, and do so even when the row that left was not holding a spot. Waitlist moves use `count+1`. |
| The form (`components/league/RegisterForm.tsx` + `app/[orgSlug]/league/[seasonSlug]/register/page.tsx`) | One child. **Date of birth optional.** A radio list of divisions with a capacity label; **born years are never used on the form or the route** (they only show on the season page). The waiver checkbox is the only consent. "Registration fee: $X, payable separately" reads the **season** fee. `lib/born-years.ts` has `bornMatchesYear`, a base for DOB-to-division. |
| Schema (dev snapshots) | `league_divisions`: id, season_id, name, capacity, sort_order, born_from_year, born_to_year. **No price, no early bird, no note, no unique (season, name).** `league_seasons`: registration_fee (one number), registration_open_at/close_at (timestamptz), waiver_text, auto_approve_under_capacity, auto_promote_waitlist, dead `auto_generate_fees`, unique (org, slug). **No early-bird date, no how-to-pay text.** `league_registrations`: **no unique beyond the key**, no sign-up reference, `person_id` nullable, `waiver_accepted_at`. |
| The fee, everywhere | RPC `club_league_fee_set` (**defined only in migration 342**) posts the **season's** `registration_fee` when it marks a registration paid, and refuses a declined/withdrawn one. Readers of the season fee: `lib/league-fee-paid.ts`, `lib/families-read.ts` (`leagueFeeLine`), `lib/families-export.ts`, `lib/families-payment.ts`, and the ledger route's "expected total = fee × active count". |
| The tournament's rule to mirror | `lib/registration-amount-due.ts` (pure): a division's own fee when the event's `fee_schedule_mode` is `division` and that division has one, else the event's. League has no mode; the **division's own price, else the season's** is the rule drawn in §3. |
| Consent | `family_consents`: `league_registration` is an allowed basis and `marketing` an allowed scope (per the CHECKs in migrations 214/252: re-check on the live schema). `recordLeagueWaiverConsent` (`lib/org-people.ts`, called from `createRegistration` in `lib/db.ts`) writes the waiver row (basis `league_registration`, scope `child_data`), treating a duplicate as success. **There is no tournament or tryout helper to copy** (the tryout form keeps its consents as columns on its own table); mirror `recordLeagueWaiverConsent`. |
| Person link | `league_registrations.person_id` is **never set at write time**, by design: `families_attach_people` links by guardian email when the Families area loads (header of `lib/org-people.ts`: "do NOT add per-route minting"). |
| Staff notice | Event kind `house_league_registration_new` already exists (label, icon, 'know' tier); `notify()` in `lib/notify.ts` has **one caller, the admin hand-add route**. |
| Registration dates | Stored as the club's wall-clock time with a literal `Z` on the end (`SeasonRecordBlocks`, `CreateLeagueSeasonDialog`, onboarding); read by taking the **first ten characters** for the day (`registrationDay` in `lib/house-league-season.ts`). **Never re-zone.** The public season page formats the stored value with `toLocaleDateString` and can show the wrong day: fix while there. The server only checks close-after-open. |
| The checklist | `seasonChecklist` in `lib/house-league-season.ts`: **divisions (with spots), the season's start/end dates, a fee set**. UI-only: the server accepts moving draft to open with one division. Tests: `tests/unit/house-league-home.test.ts`. |
| Division setup | `DivisionWindow.tsx` (name, spots, born years; header comment says "prices per division are 9b-1's"); routes `divisions/route.ts` (single add; free-floor division cap with a `scope_wall_hit` event) and `divisions/[divisionId]/route.ts` (PATCH name/capacity/born years; DELETE refused when any registration has the division). The tournament wizard's step 2 has the chip pattern with its logic in `lib/tournament-setup-divisions.ts` (tournament-specific; reuse the shape, not the file). |
| 9a's leftovers | The club site's team bands and the editor's House league line still name **one** live season; the Registrations screen keeps its old buttons and windows until 9b-2. Neither is 9b-1's. |

## Two things to argue before building (disagree out loud)

1. **The plan's note "a hand-added child is not linked to the guardian's person; 9b-1 links it" is probably wrong.** No route
   links at write time, on purpose; Families links by email when it loads, so the fixture's Ava Kim most likely just predates a
   Families load. Verify by loading Families and checking her row. **If it attaches, drop the item and say so; do not add
   per-route minting** against the standing header comment.
2. **Per-division prices make the money writer wrong the moment two divisions differ.** `club_league_fee_set` posts the season
   fee. 9b-1 introduces the prices, 9b-2 freezes them on the registration; **in between, the writer must not post a number that
   isn't what the family owes.** So Part 1 changes the writer's input to the resolved amount for that registration (the price
   that applied on its **sign-up date**, resolved from `registered_at`, so 9b-2's frozen column is a backfill, not a
   different answer) and every reader in the table above reads the same resolver. Bring any cheaper idea to the owner before
   building around it.

Also decide and **state in the UX summary** (these are build questions the drawings leave open): a **division note** field for
9b·13 (no column exists today; a short free-text line like "Tuesday nights" on the division, shown on the form and the
Overview); what **"Reopen until…"** and a convenor closing early actually write (the dates, the status, or both: S2·b says the
dates run the form and the page says which); and what staff get when they **add by hand or approve into a full division**
(recommend: the same atomic rule, refused with "Division is full: add to the waitlist instead", never a silent over-fill).

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), plain words: what the convenor, the club admin, the registrar
   and a family see differently, with the role differences (the 9a gate is unchanged: who may write what), and the three
   questions above. Get the owner's yes on the open ones.
2. **The words through `/marketing`** → `docs/projects/active/HOUSE_LEAGUE_STAGE9B1_COPY.md`: the Create window, the Divisions
   block and the Add age groups window (desk and phone), the checklist lines (⚠ **the drawing shows "Waiver and how to pay" as
   optional; the ruling makes how-to-pay required when a price is above $0, so split it into two lines**), every Registration-
   block row, the family form (child blocks, fit lines, the outcome lines, the total line, the consent line, the button),
   the **two undrawn states**, the confirmation, the status page, **every email** (received/accepted/waitlisted/promoted/declined
   variants, one per sign-up), the staff notice, and the refusal messages (closed, not open yet, full, duplicate child, no division
   fits). House rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`, **"Accepted"** for the family.
3. **Do not draw anything new.** If the code can't build a ruling as drawn, bring it to the owner first.

## What to build, in parts

**Part 1 · The data and one price resolver.** One additive migration (next number after 360; dev only; recorded in
`MANUAL_PROD_STEPS.json`; dictionary and snapshots updated in the same unit of work): per-division price and early-bird amount,
the division note, the season's early-bird date, the season's how-to-pay text, a **sign-up reference** and the sign-up's
position on each registration, the consent-line flag as the form needs it. A pure resolver beside `registration-amount-due.ts`'s
shape: *(division, season, the sign-up date) → amount*, "division's own price, else the season's", early amount when the
sign-up date is on or before the early-bird date. **One** reader function for "what does this registration owe" that the fee
writer, Families (read, export, payment) and the ledger's expected total all call; redefine the RPC (`CREATE OR REPLACE`, keeping
the old call shape working so prod's old code is safe until the promote) so it posts that amount. Unit tests on the
resolver (early bird edges, a division with no price, a free season, the club's day not a re-zoned one). Additive only:
**no DROP**, `auto_generate_fees` stays.

**Part 2 · The season's setup: Create, Divisions, Registration, the checklist.** Create season asks name, sport, dates; the slug
is made from the name with a reserved/duplicate guard (today's window already lost its division field and switches in 9a's
follow-up; finish F07). The Overview's **Divisions block** gains Born in / Players / Price / Early bird columns and the
**Add age groups** window (chips, groups already present marked, birth years the club picks, a gap or overlap with another group
pointed out, two divisions for one age group by adding the group twice, a footer that says what is missing; full screen on a
phone). A division reads first and edits whole (drawing §3: the pencil flips the whole record, every field autosaves, "Remove
this division" only while it has nobody) **unless** the 9a walk's accepted call ("a division still saves when you press Save in
its window") is judged the better door: raise it, don't pick silently. The **Registration block** gains dates (with "Reopen
until…"), the early-bird date, the waiver, the email-consent line, how to pay, and "new registrations" (the two switches that
moved off Create). The **checklist** changes to: age groups with birth years and size · prices · registration dates · how to
pay (only when a price is above $0) · waiver (optional); Open registration absent until done, **and enforced on the server**
(today only the page enforces it). Update `seasonChecklist` and `house-league-home.test.ts`. New date fields use the shared
date/time fields the themed-date-picker work introduced (its native-input guard test must stay green); if that work is not yet
committed when you start, ask the owner which order.

**Part 3 · Sign-up that cannot oversell (commit alone; a live defect fix).** One database function behind the public route (and
reused by the staff add and approve paths): lock the division, count the spots **including what the rule says holds one**, place
the registration as accepted / pending / waitlisted, take the next waitlist position, refuse a duplicate child (same child in
the same season: name + date of birth, ignoring cancelled ones), all in one transaction. ⚠ **Do not add a unique constraint on
waitlist position without proving compaction still works**: shifting positions down can trip a non-deferrable unique index
mid-statement; serialising on the division lock is the safer mechanism. Check dev for existing duplicate children **before** any
unique index (the migration must not fail on data). Staff **approve** respects capacity (refused with the full-division message
and an offer to waitlist); promote-on-leave only fires when the leaving row held a spot and only into a free one. A **concurrency
test** (parallel requests for the last spot; the last two waitlist places) and a **guard test** that no house-league path
inserts or approves around the function.

**Part 4 · The dates run the form (S2·b).** A small pure state function for league registration (the tournament's
`registration-state.ts` is tournament-only): open / not open yet / closed / full, from the **status and the dates together**,
read in the club's day with the stored-as-typed convention (never re-zone). Used by the route (the refusal says why), the register
page, the season's public page ("Opens Jun 1", "Closes Aug 1", "Registration closed") and the club home's Open now (a season
not yet open is not "open now"). "Close registration" and "Reopen until…" write what you decided in the UX summary, and the page
says which of the dates or the status is in charge. Fix the public season page's date formatting in the same part.

**Part 5 · The family's form, the confirmation and the status page.** Several children in one sign-up (Child 1 / Child 2 with
Remove, "+ Add another child"), **date of birth required** whenever the season has age bands and **picking the division**, the
fit line per child (division, birth years, spots left, price, early bird applied or ended), the two-divisions-one-band pick
showing note and room, **no division fits** (club contact, nothing registered), the waitlist line ("pays nothing unless a spot
opens"), the consent line unticked by default **writing a `family_consents` row** (mirror `recordLeagueWaiverConsent`; the
unique-live index is per (org, email, basis, scope, source), so decide the source id and say so), the total counting only
children who will be accepted, the button "Sign up N children". One request carries the whole sign-up; **each child gets its own
outcome** (no all-or-nothing). The confirmation shows the reference, each child's tag (Accepted / Waitlist · 1st / Received),
the pay card with the club's how-to-pay words and the greyed "Pay now · 12b" slot, and says "we've emailed this to …". The
**status page** finds the whole sign-up by reference + email, shows each child (name, tag, division, fee, reference), one pay card,
and no Team line yet (9c) and no "Ask to withdraw" (9b-2). On a review-first season the same screen says "received, nothing to
pay until the club accepts".

**Part 6 · Emails and the staff notice.** **One email per sign-up** listing each child with its outcome, price and the total,
plus the club's how-to-pay words once accepted; the approval email now states the fee (today it never does); the waitlist-
promotion email carries the same block (Q4, ghost pay slot). Keep every field escaped (all seven templates do today) and the
mail sending as it is unless you find a reason: if you change fire-and-forget to something awaited, say why. **Every public
sign-up calls `notify()`** with the existing kind and a link to the season's registrations (one notice per sign-up, not per child).

**Part 7 · Help, demos and the lists.** `/docs`: the house-league guides for creating a season, age groups, prices and early
bird, the dates, signing up several children, "Accepted", and the family's reference. Old-look and colour-debt lists: remove
only what you rebuilt. `check:layout --changed` on the Overview, the form and the confirmation at 1440 and 390, Warm and Dark
(the dev server is the right place for `--changed` only; the whole-product sweep is not run here). The demos follow the product:
nothing to do unless a tour anchor moved (the build fails if one did). **The demo seed's house-league fees are numbers**: if a
demo sentence quotes a fee, it is computed from the seed or it is not in the sentence.

## Definition of done

- Parts 1–7 committed; `npm run verify:changed` and `npm run typecheck` clean; the resolver, the atomic sign-up (concurrency),
  the duplicate-child, the dates state and the checklist tests pass; the existing guards stay green
  (`club-stage5c-families-guard` §1 on the single money writer, the house-league gate guards, `league-season-scope-guard`).
- `/review` run on Part 3 (concurrency, money) and on the whole, findings fixed or recorded.
- **The 9b-1 walk**: a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (check the last number; §374 was 4f's), one
  purpose per walk, signed in as owner, registrar and a signed-out family (the dev fixture is `dev-league-org`, owner
  `league-owner@dev.local`, registrar `league-registrar@dev.local`, all `devpass123`, sign-in only, never reset). Cover: create a
  season in three answers; add three age groups at once; prices and early bird; the checklist gating Open registration; dates
  closing and reopening the form; a family signing up two children (one accepted, one waitlisted) and seeing each outcome first;
  the no-division-fits state; two divisions for one age group; the same child twice; two browsers racing for the last spot; the
  email and the status page by reference; the staff notice; a free season.
- The plan's status log and §4 updated; a news row on the Club index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, stage
  `s9`; read it first and pin `if_version`); the TODO line updated with the commit anchors; memory
  `project_club_stage9_house_league.md` updated.
- **Housekeeping the previous session owed:** the 9a walk's result is not yet written into the ledger's §372 and the TODO
  Stage 9 line still says "walk owed". Record it (all 11 sections ticked bar W11's second check, which the owner called unneeded
  because the treasurer already sees house-league money on the main accounting pages) before you add your own entries.

## Do not

- Build any 9b-2 content: the Registrations screen's rebuild (Withdraw, Move division, Release the spot, bulk, the Paid/Owing
  filter, phone rows), **freezing the price on the registration** or the Correct price window, the end-a-registration window and
  refunds, the Money band and **the Overview's Owed / Still owing tiles** (they are drawn on the 9b-1 Overview but belong to the
  9b-2 money rule: leave them out), the amber "owing" rule, Statement filing and Budget vs. Actual, the family record, "Ask to
  withdraw a child". Do not show today's Ledger "Outstanding" figure anywhere new (it always reads $0.00).
- Build the email-composer consolidation (Q12b/Q12c are 9d), the team on the status page (9c), "Start next season" copy-forward of
  how-to-pay (9f), a live "Pay now" (12b: a greyed slot only), tax, installments, discounts or household credit.
- Add per-route person minting. Drop `auto_generate_fees` or any column. Touch the phone bar, the More sheet or the rail's top
  level (Stage 13). Reopen a ruling.
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; build a commit in a temporary index when a file
carries another session's hunks. Part 3 in its own commit. No push and no promote without the owner's word.
