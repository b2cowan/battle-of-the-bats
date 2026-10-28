# Platform admin support console · Stage 4b, Free time on the Coaches Portal (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-27, the day the owner ruled the Stage 4b drawings (every recommended box
> ticked, all twelve). **Re-verify every lead against the code before you build on it:** this prompt is a lead, not
> evidence, and so is any helper's summary. The working copy is shared with Club Tier, Bookkeeping and Stage 7 sessions:
> stage explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit nothing without
> the owner's OK. This stage moves a coach's data and gives away revenue: **it is a money-adjacent write AND a data
> migration; build and review it as both.**

## 1 · What Stage 4b makes true

Support gives a coach on the free Coaches Portal the Premium Coaches Portal for a set time, and when the time is up the coach
is back on the free portal with everything they made still safe.
- **From the coach's person record.** A free (Basic) coach has no organization, no billing page and no console record, so the
  door is a new **Coaches Portal tab** on the person's record with one door, **Give free time**: team, last free day, why, and
  a sentence that says exactly what happens.
- **Premium is really on.** The Premium portal is made the way a paid upgrade makes it, the team's roster, events and fees are
  copied across once, and the Premium tools work. Nothing is pretend.
- **The portal's record shows it** like a club's: a Free time chip, a band figure, the Access list (Change the end date · End it
  now), Story entries (given, changed, brought across, ended early, ended by itself, ended because the coach subscribed), Put
  it back on the right row only.
- **It ends by itself, safely.** The morning after the last free day the coach lands on their free team, which reads as it did on
  the upgrade day. Nothing is deleted, archived or tagged for retention; what they made on Premium is kept and returns if
  Premium does.
- **The coach is told in the product only:** a "Free through" line and band on Plan & billing, a calmer band in the last 14
  days, the free portal's plain "Free time ended" band for 30 days. **No email.**
- **One queue.** Today's "Free time ending" and the Free time list count a portal beside the clubs; no second queue.
- **Keep Premium** is a real path from free time to paid (new work).

## 2 · Rulings. Do not reopen them

- **The drawings are the spec:** https://claude.ai/artifact/4qzTiG3rUBTmihqPSUAzrW (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_DRAWINGS.html`; open it and click every tag), including the threat list T1–T36 and
  the boundary table. Where this prompt and the drawings disagree, stop and ask.
- **The twelve asks, all as recommended** (`memory/design_decisions.md` 2026-10-27; the plan's "Owner rulings 2026-10-27
  (Stage 4b drawings)"):
  Q1 **A**: keep Premium work whole and hidden, show the free team as it was, say so in one band; no copy back · Q2 the shared
  date field; **90 days Support and Billing, 6 months Super admin** · Q3 **a new power** (portal free time) for Super admin,
  Billing and Support; Product, Growth, Read only see it, never give it · Q4 refuse a paying, Founding or cancelled portal
  (door absent, one line); a **second give needs a Super admin** · Q5 change the running end, **measured from the first
  give**; a later give reuses the portal, Super admin only · Q6 two builds, 4b first, sharing the one question; **4b touches
  no Founding row** · Q7 in the product only, **no email** · Q8 Stage 4's Q10 is replaced by these rules · Q9 **every bulk
  action skips a Coaches Portal** with the window's refusal · Q10 **no hosting; family reminders start off; what families see
  after the end proved at the gate** · Q11 fix 1–4 here, log 5–8 · Q12 D-1 End it now lime · D-2 Keep Premium the one lime,
  Join a club outlined · D-3 the day-after band on the free Overview is new ground · D-4 the hosting line kept, words through
  /billing · D-5 Keep Premium 44px, full width on a phone.
- **Standing:** R1–R8, the Stage 1–7 rulings (shell, Find, the Story, one pencil, Put it back's rules: never anything that
  reached Stripe or an inbox), Stage 4's rulings for clubs (end the day it says, Eastern, reason required, every live change
  confirms in one sentence), D1–D5.

## 3 · Read first

- The drawings: headline 1–4 ("Read this first"), "Before the drawings" (the code facts), drawings A–G, the threat list, the
  boundary table, the design pass box.
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: "S4b findings", "Stage 4b drawings", "Owner rulings 2026-10-27", Stage 4's findings
  and rulings (the door, `ownPlanOf`, the exclusion rule from mig 380). The PM brief.
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_BUILD_PROMPT.md` (this stage's template) and the built Stage 4 code:
  `lib/entitlement-grants.ts`, `lib/free-time.ts`, `lib/free-time-writes.ts`, `lib/free-time-list.ts`, `lib/free-time-story.ts`,
  `lib/free-time-copy.ts`, `components/admin/FreeTimeBand.tsx`, `/api/admin/org/free-time`.
- The upgrade and the copy: `provisionStandaloneTeamWorkspace`, `migrateBasicTeamIntoWorkspace` (`lib/coach-upgrade-migration.ts`),
  `lib/coach-team-page.ts`, `lib/team-checkout.ts`, `lib/team-workspace-entitlements.ts`, the retry route.
- The project index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp: news is an `ArtifactData` write to `stages/s4b` and
  `log/…`. Never republish it.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` (never restate a price or a limit in copy), `AGENTS.md` (Next 16),
  `AGENCY_RULES.md`.

## 4 · Facts to re-verify (2026-10-27)

| What | Then |
|---|---|
| A free coach | No organization, billing page or console record; the person record says "0 clubs". Dev: 37 free-team rows = 24 real + 13 shadow rows minted for Premium portals. Production unknown (not queried). |
| Basic → Premium | One-way COPY behind an atomic claim (`basic_coach_teams.team_workspace_id IS NULL`). Copies players, events, fees (one dues schedule per player, one installment per fee, due 30 days out; paid fees become paid installments with a payment row). Not copied: announcements, fees with no amount or player, fee notes/order, members, tournament links (shared). A second provision for a claimed team makes a NEW EMPTY portal beside the first. |
| No reverse copy | Premium-only data (practice plans, attendance, lineups, playing time, money book, awards, tryouts, notes, documents) has no free home. Tournament entries and chat are shared. |
| Free-team write routes | Eleven routes check only free-team membership, never the workspace; only the pages redirect. The announcement route emails real contacts. |
| Liveness | Three records: the organization's status, the workspace's `subscription_status`, `team_entitlements` (+ `ends_at`, read-time enforced in `team-workspace-entitlements.ts`; nothing writes a future one; Stripe sync leaves it alone). |
| Scheduled sweeps | Dues reminders and the digest decide from the organization's status through Stage 4's door; nothing changes it at an end date; reminders default ON; the copy creates dues schedules. |
| Reactivation | `findReactivationWorkspace` refuses a comp-mode portal; a checkout started during free time is refused or attaches nothing; after the end the free portal's Upgrade makes a blank second portal. |
| Cancel | Coach cancel archives tournaments, tags a 365-day retention clock, sets all three records, cancels Stripe, emails; its server route does not check the billing mode. Staff cancel sets only the organization. |
| Bulk | The bulk status override AND the plan change reach portals. |
| One live portal per owner | Enforced in application code only (two gives at once could both pass). |
| Staff accounts | The free routes refuse platform-staff accounts, the Premium routes do not. |
| Stage 4's door | `ownPlanOf` for billing ACTIONS, `org.planId` for access. A portal's grant must follow the same split. |

## 5 · Scope: what Stage 4b is and is not

**Is:** the new power and its rulebook line; the give (record, portal with the end in the same insert, copy); the one question
"is this portal in force right now?" and every workspace-status reader moved onto it, build-guarded; the Coaches Portal tab and
door; the portal's chip, band, Access list, Story; Change the end date / End it now / Put it back for a portal; Today and the
Free time list counting portals; the coach's three states on Plan & billing and the free portal's day-after band; Keep Premium;
the four fixes (Q11 1–4); bulk actions skipping portals; hosting held back; family reminders off at the copy.

**Is not:** any Founding row or Founding's turn-off (the question is written to take any end; that is the Founding build);
an email of any kind; a copy back, "Bring my changes back" or read-only Premium on the free side; hosting in free time;
a scheduled job or anything that runs against production by itself; reopening a cancelled portal; Stripe reads/writes except
Keep Premium's checkout; a change to a price, plan name or gate; the four logged items (Q11 5–8) beyond hiding the price and
Stripe door for free time.

## 6 · Blocking gate: before any code

1. **Re-run §4** and note every row that moved.
2. **The reader census (the spine).** Delegate a census of every reader of a portal's liveness in all three families: (a)
   organization status through Stage 4's door, (b) the entitlement and its end, (c) the workspace's own `subscription_status`
   read raw (the free team's redirect, free team list, registration picker, one-live-portal check and callers, people list).
   For each: path, what it decides, and **door** · **allowlisted, with a reason** · **must move**. This table is the guard's
   allowlist. Open the cited lines yourself. Show the owner any judgment call.
3. **Prove the end, with a lapsed grant:** a portal whose grant has lapsed is skipped by the dues sweep and the digest; the
   per-team gate reads "not in force"; the free team list and redirect agree. A shadow organization stored as cancelled must
   **not** appear as a churned customer in Retention, the lead book, the metrics or any cancelled-club list.
4. **What a family sees after the end (Q10, T25, T36).** Write plain sentences for the team page, a pay link and team chat once
   a portal is not in force, from the code, not memory. Free time does not ship until they exist. Nothing refunded or deleted.
5. **Keep Premium (Q11 2) with `/billing`:** attach the purchase to the same portal, switch it to coach-paid, clear the end,
   end the grant with its own Story entry, clear the stored ended state. Prove pay-before-end, pay-after-end and
   cancel-then-resubscribe each end with the coach on **one** portal, data intact. Read Stripe's current docs for the
   checkout/subscription events; the checkout gains two small duties (reuse, clear the end) and nothing else.
6. **Customer words through `/billing` and `/marketing`:** the Free-through line, the three bands, the day-after band, the
   hosting line (what the give does not include), Keep Premium's line. Nothing restates a price or what Premium includes.
7. **Migration check against the snapshots, not the migration files.** Likely needed: a database rule for "one live portal per
   owner"; possibly a `pending` copy summary column/value. If so: next free number (check disk, Club Tier and Stage 7 take
   numbers), `docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` in the same unit, `GRANT … TO service_role` on
   any new table, prod step written into MANUAL_PROD_STEPS (not run). If the exclusion/unique rule could block a legitimate
   second give, say so before applying.
8. **Gate asks to put to the owner:** (a) the "sixth give in a week needs a Super admin" line (T2); it is in the drawings'
   safety text but was not in Q3's ticked option — ask, do not assume; (b) the exact copy table from step 6; (c) anything in the
   census that is a judgment call.
9. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build (after the gate), in parts

**Part 0 · The four fixes that make a live Premium twin safe (their own commit, first).**
- The free team's save routes (roster, schedule, fees, announcements, the rest of the eleven) refuse while a portal is in force,
  with a sentence; the announcement route can no longer email old contacts. (T19)
- The copy saves a **pending** summary at the claim so Try again can always repair a copy that stopped. A retry re-copies by
  source row and runs only while the summary says "not ok"; it can restore a row the coach removed on Premium, so the Story row
  says what a retry added. (T18, T22)
- Coach cancel and staff cancel **refuse a portal holding free time** and point to End it now (the server route checks the
  billing mode). A test fails if free-time code imports the cancel or retention functions. (T15)
- Every bulk action (status override and plan change) skips a Coaches Portal with the Give window's refusal, and says so in its
  summary line. (Q9, T8, T33)

**Part 1 · The new power.** One line in `PLATFORM_POWERS` (`lib/platform-areas.ts`): Super admin, Billing, Support. Menu, route and
window read the same line. Product, Growth, Read only see the tab and record read-only (R6: no doors). Re-run the powers
census guard.

**Part 2 · The one question and its readers.** `isPortalInForce(...)` answers from the three records and takes any end (so
Founding can use it later; **4b gives no Founding row an end**). Every census "must move" reader calls it; a build guard fails
on any new raw read of a portal's workspace status outside the allowlist. The wall's words change: a coach whose free time
ended never reads "subscription ended". Shadow organizations stored ended do not count as churn anywhere (step 3).

**Part 3 · The give (server).** Power check first, then, each refused with a sentence and **zero writes**: switch off · the
giver's own account or a team in a club they belong to · **any platform-staff account** (T34) · a demo/sandbox coach (T28) · a
team that already belongs to a portal live or cancelled, a shadow team, or a coach with a live portal ("one live portal"
checked inside the same step as the claim, T26/T32) · a portal that pays through Stripe, a Founding portal, a cancelled
portal, a club-billed team (Q4) · no end, a day not after today, or past the cap, **measured from the first give** (Support
and Billing 90 days, Super admin 6 months, Q2/Q5) · a second give for a coach who has had free time unless Super admin (Q4).
The coach and the team come from the person record and the team's own membership on the server, never the body (T23). The end
is the last free day as `YYYY-MM-DD`, turned into the end of that day in America/Toronto on the server (T5).
**Order, so a stop halfway never leaves an open-ended portal (T31):** (1) the free-time record (a billing-status grant holding
the portal open to the last free day; harmless with no portal); (2) the portal, made by the same upgrade a paid coach runs,
stored as **ended** (organization cancelled, billing mode platform override) with the entitlement's end set in the same insert;
(3) the copy, **with reminders to families starting off** (Q10, T30). The give marks its events and audit entries staff-given
so metrics, the lead book and Today do not count it as a customer (T35). A second give updates the same portal and the same
entitlement row (T21). Change the end: compare-and-set on the end the window opened with, same cap and reason, from the first
give (T11). End it now: the existing end path, a reason. Every write: an audit entry (reason in `new_value`, Stage 2's way)
and a Story entry. The give is held while it runs (double click, T20).

**Part 4 · Console.** The **Coaches Portal tab** on the person record (the team, what it holds, which tournament it is in) with
the door as drawn in A, nine absent-door lines (each with its one-line reason), the window and its consequence sentence. The
portal's record: chip, band figure, Access list, the two windows, Story entries (given / changed / brought across / created /
ended early / ended by itself (read from the date, not written) / ended because the coach subscribed). Put it back only on the
newest entry of a running grant; on "given" it ends it; on "changed" it restores the earlier end; **never** on brought-across or
created (T12). Today's "Free time ending" and the Free time list count a portal as a kind; Premium home band, Premium welcome,
the "check these" notice, and the two list rows are **not drawn**: draw them at the first walk, from captures.

**Part 5 · The coach's screens.** Plan & billing for a portal on free time: the plan card's price line replaced by "Free through
{day}" + "from FieldLogicHQ · then the free Coaches Portal, automatically"; the Free-time band in three states (running, last 14
days amber, ended for 30 days); the price, Payment method & invoices and Cancel Premium **not rendered**; the hosting clause and
Tournament slots card held back (Q10); **Keep Premium** is the page's one lime (44px, full width on a phone), Join a club
outlined. The free portal's Overview gets the "Free time ended" band (the card's one added line while Premium work is saved).
The page is told the end day and whether it ended, **never the reason or the giver** (T24).

**Part 6 · Keep Premium.** Per gate step 5. Coach-paid conversion, Story entry, one portal.

## 8 · Guards (new unit tests)

1. The census allowlist: no raw read of a portal's workspace status outside it (scan).
2. The one question: a running grant is in force; one ended a millisecond ago is not; a future `starts_at` is not; the switch
   off returns the stored (ended) state; the dues sweep and the digest skip a lapsed portal.
3. Give refuses (each with zero writes): switch off · own account · staff account · club member · demo · claimed team · shadow
   team · live portal · paying · Founding · cancelled · club-billed · no end · past · over the cap per role (from the first
   give) · second give by a non-Super-admin · a role without the power. The end instant is the end of the given day in Toronto;
   an ISO instant is rejected.
4. The give stopped between each of its three steps leaves nothing, or a portal that already ends (T31). A double give copies
   once (T20); a second give reuses the portal and writes no second entitlement row (T21).
5. Change the end: a stale expected end is refused; chain attempts past the first-give cap are refused.
6. The copy-failure injection: a stop after the claim leaves a pending summary and Try again repairs it.
7. The end runs nothing: no archive, retention, suspend, Stripe or email call is reachable from free-time code.
8. The free team's routes refuse with a portal in force and accept after the end. Cancel (coach and staff) refuses on free time.
9. Bulk status override and plan change skip a portal.
10. The customer route returns no reason, giver or grant id. Today's count equals the distinct clubs and portals in the list's
    14-day filter.
11. Keep Premium: pay-before-end, pay-after-end, cancel-then-resubscribe each leave one portal, data intact.
12. The threat list T1–T36: each has a guard or a named reason it cannot.

## 9 · Verify

- `npx next typegen` then `npm run typecheck` (shared modules, auth and checkout change); `lint:focused` on changed files; the
  guards directly with `node --import ./tests/ts-resolver.mjs --test <files>` (the resolver does not resolve `@/`: a module a
  unit test imports uses relative imports; `server-only` modules are pinned by source); `check:spelling`; `check:dictionary`.
- **A live check on dev** for any new embed or FK path (a bare `organizations(name)` embed went ambiguous once, PGRST201): only a
  real GET catches it. A password-signin GET probe is the render check (`.probe/pasc/`); read-only probes, abort non-GET; never
  overwrite `tests/uat/.auth/*.json`.
- `npm test` / `verify:changed` clear `test-results/`: run them only when no other session is mid-walk, and say so.
- **Restart the dev server** at hand-off via `npm run dev` only (new files, shared modules).
- `check:layout -- --changed` on the person record, the portal record, Today, Plan & billing and the free Overview (1440, 1024,
  390, Warm and Dark) or the overflow sweep if the layout session is stale.
- The owner does the browser testing. A scratch coach is needed: Frankie Okafor / UAT Free Team on dev (12 players, 6 events,
  3 fees) is the drawings' example.

## 10 · Hand-off

- **QA walks as checkable Artifacts, one purpose each** (never combine): (A) give free time, see it everywhere, see it end by
  itself and the free team read as it was; (B) the refusals and guard rails (nine absent doors, roles, cancel/bulk refusals);
  (C) Keep Premium and the money paths. Matching Owner QA Ledger sections; never sort the § numbers. Say how to see an end
  (a one-day grant).
- **Prod steps** named, not run (migration(s) with the Stage 7/5/4 set; check order).
- **The index:** `stages/s4b` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walk links.
- **Records:** the plan's S4b row and Status, TODO, the PM brief, the auto-memory `project_platform_admin_support_console.md`,
  `PROGRAM_BILLING_AND_ENTITLEMENTS.md`, `memory/design_decisions.md` for any call the builder makes.
- **Offers:** `/simplify` then `/review` (high risk: access path, a data copy, a checkout change, scheduled emails to
  families); `/docs` (console help on free time on a portal; the coach's billing and Help); `/billing` drift check against
  `PLAN_PRICING_FACTS.md`; `/strategy` to log free-time-on-the-portal as Decided.
- No commit without the owner's OK.

## 11 · Do not

- Touch a Founding row, its sign-up, checkout or end; or give Founding an end.
- Send an email, or add one; or let any sweep email a family after the end.
- Add a scheduled job, a trigger, or anything that runs against production by itself; edit shared automation or watched scripts.
- Archive, delete, suspend or tag for retention on the end; call the cancel or retention functions from free-time code.
- Build a copy back, "Bring my changes back", hosting in free time, or free time in bulk.
- Take the end instant, the coach or the team from the browser.
- Restate a price or a limit in copy.
- Implement the four logged items (Q11 5–8) on the way past, except hiding the price and Stripe door for free time.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- Part 0 (the four fixes), on its own, first;
- the new power, the one question, the readers and the census guard;
- the give and its rules and guards (and the migration);
- the console;
- the coach's screens and Keep Premium;
- docs, help and records.
Several files here (`lib/db.ts`, `TODO.md`, `lib/types.ts`) carry other sessions' hunks: partial-commit, and typecheck the
COMMITTED tree.

## 13 · Context you would otherwise miss

- Example coach in the drawings: Frankie Okafor / UAT Free Team; given Oct 27, 2026, free through Dec 26, 2026. Dates and giver
  are examples.
- A portal on free time is billed by nobody: billing mode "platform override", no Stripe subscription. A Coaches Portal a club
  pays for bills on the **club's** customer as a second subscription; never call that "shared".
- The coach's words: free **Coaches Portal** / **Premium Coaches Portal**. The console's lists say plain "Coaches Portal"
  (Q11 6, logged, not fixed here).
- `lib/operator-plan-change.ts` is the one plan-change rule; a grant is not a plan change and must not call it.
- Stage 4's Q10 (no free time on a portal) and the amber "can't be given free time yet" line are retired by this stage.
- Still open for later: Founding's turn-off (rides the one question), a coach email, reopening a cancelled portal.
