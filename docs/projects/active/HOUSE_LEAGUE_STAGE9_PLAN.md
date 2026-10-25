# House league — Club Tier Stage 9 (plan)

> **Deep dive walked and 9a drawn 2026-10-24.** Hub https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7 (walk · standing back · ladder · 9a drawn · asks):
> source `docs/projects/active/HOUSE_LEAGUE_STAGE9_HUB.html` (captures as `{{IMG:…}}` placeholders; the published copy
> inlines them). PM brief: `HOUSE_LEAGUE_STAGE9_PM_BRIEF.md`. Kickoff prompt: `CLUB_TIER_STAGE9_DEEP_DIVE_PROMPT.md`.
> The Club plan (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 9) reserves the slot; this file is the stage's plan.
> Nothing is built. The next stage is drawn only once the one before it is ruled.

## 0 · Owner rulings 2026-10-24 (paste-back from the deep-dive hub)

26 of 27 asks ruled, every one as recommended. Q10, Q16 and Q17 are recorded as the option text the owner saw: the
paste-back's stored value for those three was the pre-review wording (the label was updated after the /ux review, the value
was not).

- **9a (all ruled):** 9a·1 grouped rows (Running now · Getting ready only when one exists · Past seasons shelf);
  9a·2 rail season block = switcher + Overview · Registrations · Teams & draft · Schedule · Standings · Money · Email
  families; 9a·3 phone = season header + scrolling page strip on every season page; 9a·4 a getting-ready season leads with
  a checklist and a primary Open registration, Complete and Archive are a rare door, every status change asks;
  9a·5 on a phone Add registration is a + and Approve is the one primary; 9a·6 section headings stay inside the card;
  9a·7 a season taking sign-ups shows in Open now and in its program section, on purpose. S1·b the dead fee switch is
  removed in 9a. Q14 every live season shows, labelled by what's happening. Q16 a finished season reads in place, locked
  through the one gate, Money still open, "Finished" in the switcher. Q17 club admin = league admin; registrar =
  registrations, fees and refunds, add by hand, email families, reads the rest; treasurer reads Money; a coach (if Q7) is a
  column of the same gate in 9c. Q18 "Money". Q12 "Email families" — **with an owner note: evaluate whether two ways of
  emailing families in one portal are needed, and whether there is a better organization** (answered in the 9b round).
- **Payments boundary:** Q1 a family pays when accepted (an auto-approved sign-up is accepted at once). Q2 the price is
  frozen at sign-up, early bird follows the sign-up date, the convenor can correct one registration's price with a reason.
  Q3 an accepted unpaid registration holds its spot; the convenor sees "unpaid N days" and decides. Q4 the promotion email
  carries the pay spot (ghost in 9b, live in 12b). Q5 one sign-up registers several children. Q6 ending a paid registration
  asks each time: refund recorded, or kept with a reason. Q10 one "House league registration fees" row with the seasons
  under it; budget = the sum of each division's cap × price; a fee files in the fiscal year it was received. Q15 the season
  Money page is the book on League Plus; Club also files to the Statement.
- **Scope:** S1·a Create season asks name, sport, dates; the rest lives on the season's Overview blocks. Q7 light coach
  accounts (invite by email, own team only, roster contacts + schedule + scores). Q8 a light 1–5 rating feeding a balanced
  snake draft. Q9 volunteers are their own project, not Stage 9. Q11 the schedule health score (the tournament's button,
  window and engine).
- **Open:** S2·b (do the open/close dates run the form) — unanswered, carried into the 9b round.
- **Raised by the owner with the rulings:** bulk-adding seasons per age group ("U13, U15, U17, U10 opened at the same
  time") — answered in the 9b round (see §6a).

## 0b · Owner rulings 2026-10-24, round 2 ("I agree with your recommendations")

All 15 round-2 asks ruled as recommended (§6a). 9a and 9b are fully ruled.
- **Q19** one season, age groups as divisions, added several at once by "Add age groups"; the club picks birth years.
- **Q12b** one composer: the Families window, opened from the season already set to it; division/team/status/"Selected"
  audiences added in 9d; the old Notifications page and Message registrants window retire; the season keeps its own sent
  history. **Q12c** automatic notices never count toward a cap; each season has its own 3 typed sends a day; club-wide sends
  keep the club's 3.
- **S2·b** the dates run the form; the convenor can close early or reopen until a new date.
- **9b·1** required before Open registration: age groups, prices, dates, and how-to-pay whenever a price is above $0; the
  waiver is optional. **9b·2** one early-bird date per season, an early amount per division. **9b·4** a birth year no
  division fits: the form says so and shows the club's contact; nothing is registered. **9b·5** each child's outcome shown
  before Submit; no all-or-nothing. **9b·7** bulk Approve, Waitlist, Mark received, Move division, Email; Decline and Withdraw
  one at a time; partial results said plainly. **9b·8** "owing" turns amber after a number of days the club sets (starts at
  14). **9b·9** how-to-pay text required whenever a price is above $0, one per season, copied forward; a free season says
  "Free". **9b·10** the Money band is Owed · Received (net of refunds) · Still owing, refunds listed below. **9b·11** a
  season's budget sits in the fiscal year its sign-ups open; the treasurer can split it. **9b·12** "Accepted" on every family
  screen and email; staff keep the Approve button. **9b·13** two divisions for one age group: the family picks, seeing each
  division's note and room.

## 0c · Owner rulings 2026-10-24, the 9a build session (all as recommended)

- **Part 6:** in 9a "Email families" is a rename only; it keeps opening the season's own composer. The switch to the
  Families window, Q12c's per-season allowance, the 9d audiences, the season's sent history and retiring the old page and
  modal all land together in 9d.
- **Email on a finished season stays open** (the gate's one addition to Q16): the convenor and registrar can still email a
  completed season's families. A note to families is not a change to the season's record, and the Families window's
  season audience cannot reach a finished season.
- **Reopen registration** is offered only while the season is in Registration closed (play has not started). Once it is
  Playing now, late players are added by hand; reopening sign-ups mid-season is S2·b's dates work (9b).
- **Archive** stays a label-only door in 9a, said plainly in its window; what Archive does is 9f's. ⚠ The option's
  description as asked said Archive "moves the season off your Past seasons list"; that was the asking session's error —
  in the code an archived season stays under Past seasons, and the copy (`HOUSE_LEAGUE_STAGE9A_COPY.md` §4.6) says so. The
  build follows the code and the copy (it stays on the shelf); the owner was told of the correction the same day.
- **Part 1 committed `29b1618c3`** (the one gate, the two backward status steps, the guard). Until Part 4 builds the status
  windows, the old screens show edit controls on a finished season that the server refuses: Part 4 must land with Part 1
  before any promote.

## 1 · Scope (binding, from the Club plan and the kickoff)

- The trust list re-verified (§3); the coupling check for a standalone League Plus club; the ledger seam under D1 (C18);
  venues under Stage 6's book; confirms on one-click season changes; the League Plus un-park (D11, Proposed — run
  `/strategy` to confirm when this stage opens); the old look retired in the screens this stage rebuilds.
- **Fees reach the Budget vs. Actual Statement** (owner 2026-10-21). Walk 7a step 7.6 is updated, and the stage does not
  close until the Statement and the season books agree.
- **The Stage 6c calendar recipe C1–C12**, admin and public (`TABLE_AND_LIST_STANDARD.md` C1–C13).
- **11b**, the scheduler's house-league half (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`): a house-league writer for the club
  schedule (move, cancel), the Practices view's "From {schedule}", the club-admin role path (Walk §L-b).
- **No household money** (owner 2026-10-19): one fee per child; two children = two registrations, one payment.
- **Facilitated payments**: see `FACILITATED_PAYMENTS_SCOPING_PLAN.md` and `PLAN_PRICING_FACTS.md`. No price, rate or
  inclusion is restated here.
- The public team page is games only; practices are never public.
- **Optional, unruled:** a house-league schedule health score (Q11).

## 2 · The payments contract (12b drops in without rework)

The 14 lines are in the kickoff §4 and are mapped to stages on the hub's Standing back tab (card 4). Summary of where each
lands: price per division + early bird + one resolver (9b-1, mirroring the tournament's `registrationFee` /
`fee_schedule_mode='division'` rule in `lib/registration-amount-due.ts`); real open/close dates (9b-1); price frozen on the
registration with which price applied (9b-2, Q2); capacity atomic + waitlist constraint (9b-1); paid is its own fact read
through one function, **no "payment pending" status** (9b-2); one money writer — `setLeagueFeePaid` → RPC
`club_league_fee_set`, guarded by `tests/unit/club-stage5c-families-guard.test.ts` §1 (kept, every stage); honest ending
with refunds as money out (9b-2, Q6); several children with a shared sign-up reference (9b-1, Q5); CASL consent beside the
waiver writing a `family_consents` row (9b-1); payer = the guardian, linked to the Families person, no family account
(kept); Statement filing by source, the family's processing fee never in the club's book (9b-2, Q10/Q15); ghost pay spots
on status page, emails and Families book (9b-2); "payable separately" kept until 12b.

**Not in Stage 9** (Stage 12 owns): Stripe onboarding, checkout, a payments table, webhooks, processor refunds/disputes,
payouts, tax on a fee, installments/discounts/assistance/household credit (cancelled), online-payment emails.

## 3 · Re-verified census (2026-10-24, against the code on `dev`)

**Already fixed — no fix drawn:** email injection (all seven templates escape fields — the trust plan said six); rate limits
on register and status lookup; reply-to is the convenor and the declined email uses the club's contact; unsubscribe and
suppression; the Waitlist/Pending audiences (J3-058); schedule exports' UTC dates; the cross-tenant IDs (I01,
`lib/league-season-scope.ts` + guard test); the venue library lockout for league admins (I05); the "Cancel game" misclick
(J3-051); the C18 fee seam (fees post on the paid tick through one RPC, decline/withdraw void in one transaction); the
mobile standings clip; withdrawal no longer emails "not approved".

**Corrections to the kickoff:** there are **no** browser `confirm()` calls in house league (the windows are in-page); the
real gap is one-click status changes (F05). C18 is fixed in code, but the Statement half is open (F15).

**Open, with evidence** (findings as on the hub; paths relative to the repo root):

| # | Finding | Evidence |
|---|---|---|
| F01 | Club admin reads everything, saves nothing (D8 vs hard-coded roles) | `lib/roles.ts:54-61` (D8); every write in `app/api/admin/house-league/seasons/**` checks `ctx.role !== 'owner' && ctx.role !== 'league_admin'` (16 route files); fee/status allow `LEAGUE_FEE_ROLES` (`lib/league-fee-paid.ts:27`) incl. registrar, never admin; `email` GET refuses admin |
| F02 | Overview + Ledger not in the rail; switcher never renders; no season pages on a phone | `components/admin/kit/AdminKitRail.tsx:388-397` (five rows), `:116-140` reads `d.seasons[].id` but the route returns `{ seasons: [{ season, … }] }` (`app/api/admin/house-league/seasons/route.ts:24-26`, `lib/db.ts:2960`), so the list is always empty and `seasons.length > 1` never holds; `lib/nav-tiles.ts` (no season block on the phone) |
| F03 | Seasons in creation order; no Past seasons | `lib/db.ts:2425-2431`; `lib/admin-kit-nav.ts:138-147` |
| F04 | Index and club home show one live season (newest-created) | `app/[orgSlug]/league/page.tsx:51-55`; `lib/club-site-home.ts:23-25`; `app/[orgSlug]/page.tsx:121` |
| F05 | One-click status moves | `app/[orgSlug]/admin/house-league/page.tsx` (Mark complete, Close registration); `seasons/[seasonId]/page.tsx:520-529` (Archive) |
| F06 | Old look | `scripts/lib/admin-old-look.mjs:50`; `scripts/.admin-old-look-baseline.json` (9 files); `scripts/check-public-tokens.mjs:527` |
| F07 | Create season asks slug + free-text Division; dead `auto_generate_fees`; age band not editable | `seasons/route.ts:91` stores it, nothing reads it; `divisions/[divisionId]/route.ts` PATCH takes name + capacity only |
| F08 | Dates decorative | `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts:53` (status only) |
| F09 | One child; no CASL; DOB optional | `components/league/RegisterForm.tsx` (waiver only, `:458-460` "payable separately") |
| F10 | Capacity race; waitlist count+1; approve ignores capacity; no uniqueness | `register/route.ts:120-148`; `registrations/[regId]/route.ts:213-216, 251-257`; `supabase/migrations/020_house_league.sql:107-110` (indexes only) |
| F11 | Fee read live | RPC `club_league_fee_set` posts `v_season.registration_fee` (`supabase/migrations/342_club_tournament_fee_book.sql:174-178`); `lib/families-read.ts:211` |
| F12 | Ending a paid registration voids silently | RPC `club_league_fee_end` (`342…sql:187-203`) via `voidLeagueRegistrationFee` |
| F13 | No Withdraw / bulk / fee filter; phone actions off-screen | `registrations/page.tsx:553-615`; measured: table 851 px in a 358 px scroller, actions at x=644 |
| F14 | Ledger "Outstanding" = pending entries (always $0.00) | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/ledger/page.tsx:101-110`; `ledger/route.ts:57` |
| F15 | Fees file nowhere | `lib/club-ledger.ts:157` (`house_league_fees` → null); `lib/club-money-figures.ts:635-640` |
| F16 | No ratings; coach is a typed name | `league_teams.coach_name`; `app/[orgSlug]/coaches/page.tsx:56-67` ("No team assignments yet") |
| F17 | Generator thin | `schedule/generate/route.ts:77-128, 153-167` |
| F18 | Admin schedule off-recipe; reader gets a greyed form | `schedule/page.tsx:141, 146, 411-473` |
| F19 | Public schedule: no place; cancelled hidden; postponed as on | `lib/db.ts:2766`; `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:49-55, 150-230` |
| F20 | No family notices; season email one-by-one, no dedupe, no cap | `email/route.ts:91-139`; batched sender `lib/family-email.ts:210` + `CLUB_EMAIL_CAP` (`lib/families-email.ts`) |
| F21 | Standings hard-coded W2/T1 | `lib/db.ts:2944`; sport pack `lib/sports.ts:125-131` unused |
| F22 | Finished season shows live tools; no copy forward | `seasons/[seasonId]/page.tsx` (Add division on a completed season); no clone route |
| F23 | Public sign-up notifies no staff; mails fire-and-forget; status lookup omits team | `registrations/route.ts:143-150` (manual add only); `register/route.ts:185`; `status-lookup/route.ts` |
| F24 | Permit not reachable from the schedule; generator one venue | `schedule/page.tsx:202`; `schedule/generate/route.ts:94-103` |

Also open from the trust plan, carried into the stages: the `':00Z'` suffix on registration open/close in two places
(`house-league/page.tsx:180-181`, `seasons/[seasonId]/page.tsx:231-232`) — 9b-1; the green "0 delivered" (9d); one
draft per season and no reserved-slug guard (9c / 9b-1); `league_email_log` has no CREATE TABLE in the migrations (trap,
check the snapshot before touching it); the org home's empty-tournaments hero (Stage 13 input).

## 4 · The ladder (dependency and rework order, never dates)

| Stage | Covers | Asks | Size |
|---|---|---|---|
| **9a** The frame and who can do what — **BUILT 2026-10-24** (§9; walk §372 owed) | Home (Running now · Getting ready · Past seasons shelf); season block with Overview, Money, Email families and a working switcher; phone season header + tab strip inside house league's frame; two live seasons (admin, index, club home); every status change asks (rare door + window); one write gate matched to D8 + registrar/treasurer; dead fee switch removed; old look retired on home and overview | Q12 Q14 Q16 Q17 Q18 S1·b 9a·1–4 | M |
| **9b-1** Sign-up, payments-ready | Create reshaped (Setup = the Overview's Divisions and Registration blocks, extended); price per division + early bird, one resolver; real dates; atomic capacity + waitlist constraint; no duplicate child; approve respects capacity; several children; CASL; DOB picks division; staff notice on every public sign-up. Server and public form only — the Registrations screen is rebuilt once, in 9b-2 | Q5 S1·a S2·b | L |
| **9b-2** Money, honest | Frozen price (per-registration correction with a reason; Move division asks to re-price); one ending path with refunds as money out; Money band; Money stays open after Complete; Registrations on the kit (Withdraw, Move division, Release the spot, bulk, Paid/Owing filter, phone rows); the club's own payment instructions until 12b; "Ask to withdraw" on the status page; Statement filing + Walk 7a 7.6; ghost pay spots; Families balance from the frozen price. **12b drawn right after this is ruled.** | Q1 Q2 Q3 Q4 Q6 Q10 Q15 | L |
| **9c** Teams and people | Ratings (convenor-only) + balanced snake draft; draft per division; coach accounts (if Q7) as a column of 9a's gate; Publish teams with placement notices; the status page shows the team | Q7 Q8 Q9 | M–L |
| **9d** The schedule | Generator rebuilt; C1–C12 admin + public; health (Q11); 11b; venue/permit links; Publish schedule + change notices; season email onto the batched sender | Q11 | L |
| **9e** Game day | Standings by sport pack; score entry (coaches if Q7); rainout as one action | — | S–M |
| **9f** Season end | Archive; the finished-season record (Q16); Start next season copies forward. Returning families with a pre-filled form wait on Stage 14 | — | M |

Changes from the kickoff's proposal (argued on the hub's Ladder tab): 9b split into 9b-1 and 9b-2; the season email moves
onto the batched sender in 9d (its change notices need it); the season Money page must be right on its own because a League
Plus club has no Statement (Q15).

## 5 · Reviews run before the hand-off (2026-10-24)

- **/ux** (flows): Complete keeps Money open; Setup lives on the Overview; a getting-ready season leads with "Open registration"; Q3/Q4 conditional on Q1, with "Release the spot"; Q2 per-registration correction + Move division; Publish teams / Publish schedule steps; payment instructions, Ask to withdraw and a staff notice for the family path; the batched sender in 9d everywhere; a coach column of the 9a gate in 9c; Q16 keeps "in place, locked" with the coaches-portal ruling's reason stated (the cost here is one gate input, not a branch per screen).
- **/design** (drawings): fit-to-width with a true-size button; 44 px phone floor; symbol-alone secondary actions; the amber pill inside tabs fixed; underline status tabs; outline icons; a full-screen phone window for D; a phone frame and whole-row links for E; tags positioned so they don't shift figures; a registrar's view showing absent controls; the role table's "no access"; the empty Getting ready group dropped; "Registration" as the one word. Three owner calls added as asks 9a·5–9a·7. Recorded on the hub's Formatting check card, not in the design log.
- The "before" captures were re-shot after one caught a dev-server restart mid-load.

## 6a · Round 2: 9b drawn, and the owner's two questions (2026-10-24)

Drawings: https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT (source `docs/projects/active/HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`;
built by `.probe/hl/build9b.mjs` from `.probe/hl/src9b/` + round 1's kit CSS and script). /ux and /design run and applied
before publish; their changes are listed on the page's asks tab.

- **Several age groups at once (owner's question) → Q19.** Recommended: one season with each age group as a division, added
  several at once by "Add age groups" (the tournament wizard's chip pattern; groups the season already has are marked; the
  club picks birth years per the 4c-2 ruling — no guess from "U13"). Separate seasons per age group would break Q5 (one
  sign-up for siblings in different age groups), and multiply Money pages, status changes and public rows. An age group on
  its own calendar is a different season, copied by 9f's Start next season. Verified: generator, standings, teams and draft
  are already per division.
- **Two ways to email families (owner's note on Q12) → Q12b + Q12c.** There are three: the season's Notifications page, the
  Registrations "Message registrants" window (same send path), and Families › Email families (Stage 7c, `lib/families-email.ts`
  batched, one per household, `CLUB_EMAIL_CAP` = 3 club-wide/day, Families › Emails log). Recommended: one composer, the
  Families window, opened from the season already set to it; division/team/status/"Selected" audiences added in 9d; the old
  page and window retire; the season shows its own sent history (the registrar has no Families access:
  `lib/roles.ts:73-75`). Cap (Q12c): automatic notices never count; each season gets its own 3 typed sends a day. Rulings
  cited: design_decisions "one club send" (10-11, deferred not rejected), E6 (chat pause), 7c "not in scope".
- **New asks:** Q19 · Q12b · Q12c · S2·b (still open) · 9b·1 required before Open registration · 9b·2 early-bird date ·
  9b·4 a birth year no division fits · 9b·5 two children, one waitlisted · 9b·7 bulk actions · 9b·8 owing turns amber ·
  9b·9 how-to-pay text (required when a price > $0) · 9b·10 Money band (re-recommended: Owed · Received net · Still owing) ·
  9b·11 which fiscal year carries a season's budget · 9b·12 "Accepted" as the family word · 9b·13 two divisions for one age.
- **Build notes the reviews surfaced (not asks):**
  - Q17's "treasurer reads Money" needs the Money page opened to `module_accounting`; the treasurer has no house-league
    capability (`lib/roles.ts:76-79`).
  - "Owing N days" counts from acceptance, which nothing records today; 9b-2 adds an accepted-at fact.
  - A correction or a division move on a paid registration must settle the difference (refund or still owing), because the
    fee writer is a paid/unpaid tick today.
  - A refund after a fiscal year closes files in the year it is paid out.
  - A hand-added child is not linked to the guardian's person (Ava Kim, `person_id` null); 9b-1 links it.
  - 12b needs a "no longer payable" page for pay links on ended registrations.
  - The fixture's 9 pre-writer paid ticks need backfilling into the season book before the Money page is honest on it.
  - The form keeps "payable separately" (contract line 14); the club's own how-to-pay text appears after acceptance.

## 6 · Asks (round 1, ruled in §0 except S2·b)

Payments boundary: Q1 when a family pays · Q2 when the price is frozen (and early bird's date) · Q3 does an accepted unpaid
registration hold its spot · Q4 pay-later link on promotion · Q5 several children in one sign-up · Q6 refund on ending ·
Q10 Statement shape and budget side · Q15 League Plus without accounting.
Scope: Q7 coaches as people · Q8 evaluations · Q9 volunteers · Q11 health score vs clash box · Q12 the composer's name ·
Q14 two live seasons · Q16 a finished season · Q17 who may do what · Q18 the money page's name · S1·a Create season ·
S1·b the dead fee switch · S2·b dates run the form · 9a·1 home shape · 9a·2 season block · 9a·3 phone navigation ·
9a·4 status changes · 9a·5 Approve as the only phone primary · 9a·6 section headings · 9a·7 a season twice on the club home.

## 7 · Fixture (dev only)

`dev-league-org` (League plan), owner `league-owner@dev.local` / `devpass123` (sign-in does not reset passwords). Extended
2026-10-24 through the app's own routes where one exists (`.probe/hl/extend.mjs`, idempotent): 2026 Division B capacity
14; 2027 U10 Division B capacity 10; 2027 "U12 Division" capacity 16, born 2015–2016; Henry Kim marked paid (a real season
book line); Ethan Brown marked paid then declined (shows F12; the decline auto-promoted Zoe Leblanc); Ava Kim added under
Henry's guardian (two children); venue "Maple Grove Park" with Diamond 1 and 2 and permit "Maple Grove diamonds 2026"
(service role, no app path); all 2026 games linked to the venue; one game cancelled. Fixture artifacts: game times read
6:00 a.m. (seeded at 10:00 UTC), and 9 of 10 paid ticks in 2026 predate the fee writer and have no book line.
Added 2026-10-24 for the 9a walk (`.probe/hl/roles9a.mjs`, idempotent, creates new accounts only and never resets a
password): `league-clubadmin@dev.local` (admin), `league-registrar@dev.local` (league_registrar), `league-treasurer@dev.local`
(treasurer), all `devpass123`. ⚠ The League plan carries no Accounting, so this club's treasurer reads no Money (the
gate's rule); a treasurer's Money read needs a Club-plan club.

## 8 · Stage 13 inputs (found outside house league's block; not drawn here)

The League-plan phone bar (Overview · Calendar · House league · Families · More); "Notifications" meaning three things;
the org home's empty-tournaments hero for a league-only club. **From the 9a build:** a treasurer (Accounting only) has no
menu door to a season's Money — the gate opens Money to them (Q17) but the menu lists House league only for people who
open it, and the menu's top level is Stage 13's.

## 9 · Status log

- 2026-10-24 — deep dive walked (12 stations, desk + phone), ladder proposed, 9a drawn, /ux and /design applied; published https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7; Club index row s9 → in-progress (log 2026-10-24-01); 24 asks open.
- 2026-10-24 — owner ruled 26 of 27 (§0), committed fa1528058; round 2 (9b + the two questions) drawn, /ux and /design
  applied, published https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT; 15 asks open.
- 2026-10-24 — 9a build prompt written (`HOUSE_LEAGUE_STAGE9A_BUILD_PROMPT.md`; recommends the Email families switch-over move to 9d with Q12c) and the Stage 12 kickoff prompt (`CLUB_TIER_STAGE12_KICKOFF_PROMPT.md`; 12a + 12b drawn together, 12c beside).
- 2026-10-24 — **9a BUILT**, dev only, four rulings in §0c. Commits: `29b1618c3` Part 1 the one gate
  (`lib/house-league-access.ts` + `lib/house-league-gate.ts`, every route, the two backward status steps, reviewed in three
  lenses) · `0f6ac568f` the words (`HOUSE_LEAGUE_STAGE9A_COPY.md`) · `53184dbf5` Part 2 the season frame (rail block +
  switcher, phone header + strip, Money at /money, Email families) · `eb3aff61b` Part 3 the home · `d0180b8e2` Part 4 the
  season page and the status windows · `52dffe9eb` Part 5 every live season public · `313d736b0` fixes from `/review` on
  the whole (three lenses, no Critical/High) · `b7944619b` help. Part 6: the rename only, as ruled. Guards:
  `house-league-gate-guard`, `-season-frame`, `-home`, `-season-page`, `-public-seasons`. Walk: §372,
  https://claude.ai/artifact/M3mkiar1SGya4jifLbQJjh.
  **Not run:** `check:layout` — the UAT club the sweep uses now forwards to its own web address (another session's 4e
  live-run), so every fixture page leaves the dev server; a per-role probe (`.probe/hl/gate9a.mjs`) checked the matrix
  against the server instead. The layout baseline is unrefreshed for the rebuilt screens until it runs.
  **Left open:** the Registrations screen's old buttons and windows (9b-2 rebuilds it); the club site's team bands and the
  editor's House league line still name one live season (`runningLeagueSeason` in `lib/club-public-teams.ts`,
  `lib/public-site-editor-facts.ts`); the record blocks' checkboxes read the saved value until the re-read lands;
  `house-league.module.css` stays on the colour-debt list (the sub-pages still use it). Promote note: Part 1 locks finished
  seasons, and Part 4 brings their reopen door, so the two promote together (they do, as one branch).
