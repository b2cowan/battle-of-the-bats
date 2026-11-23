# Free League retired + Founding Season removed — plan

**Owner ruling 2026-11-19** (`docs/agents/strategy/BUSINESS_DECISIONS.md`, top entry). PM brief:
`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PM_BRIEF.md`. Status: on the board (owner brief projects list), never here.

## 0. Why, and what is true today (measured 2026-11-19, counts only)

- **Free League** (internally the "free floor", `organizations.free_floor = 'league_starter'`): **0 production orgs**
  ever held it; 1 dev org (a fixture). It is opened only by the `LEAGUE_STARTER_BETA` flag, which is OFF in production
  and **ON in `.env.local`** (why it surfaced on dev and confused the team-limit pass). Nothing in Stripe, nothing on a
  marketing page. It also carries a live defect: its caps key off `free_floor`, not the plan, and nothing clears the
  value on upgrade, so an org that began on it and bought League Plus or Club would still be held to 1 season / 1
  division / 8 teams.
- **Founding Season**: offer closed 2026-10-26, but the machinery is everywhere (billing page, lock lines, pricing,
  home, for-coaches, for-tournament-organizers, sign-up, onboarding, five emails, the 2027 card window, the next-season
  plan choice, platform-admin desk). It is **not** built on free time: the `org_overrides` `comp_period` row is only a
  cohort mark; the access is the stored plan (`plan_id`, `subscription_status='active'`, `current_period_end=2027-10-01`,
  no Stripe subscription) and, for a coach, `team_workspaces.billing_mode='platform_override'` + a `team_entitlements`
  row. **Nothing ever ends it** (no cron). **A comp can still be granted**: an account whose locked start door predates
  the close gets one on finishing (`isFoundingSeasonOpenFor`), a holder may still switch free → Tournament Plus at $0.
  **Production: 3 unexpired holders** (one `tournament_plus` club, one free `tournament` club, one `team` coach), all to
  2027-10-01; **0** production orgs have a Stripe subscription; 1 `founding_welcome` email sent, none queued.
  No Stripe coupon, promo code or price is tied to Founding.

## 1. The rule this plan builds

1. No free League, anywhere. House league is sold on League Plus, Club and Club · Association, uncapped.
2. No Founding Season, anywhere a customer or staff member reads, and no code that can grant, extend or end one.
3. The three production holders keep their promise on **ordinary staff-given free time through September 30, 2027**
   (the free-plan holder gets **Tournament Plus** free time to that date). Their screens then read as any free-time
   account's do.
4. **Kept, not touched:** staff-given free time and everything it shares with Founding (the `org_overrides` table, its
   `comp_period` CHECK value — old rows may exist and `free-time-story.ts` reads them — `billing_mode='platform_override'`
   told apart by `free_time_given_at`, the "active with no subscription" ending paths). Cut only the Founding BRANCHES
   in shared files.
5. History stays: release notes, decision log entries and archived plans are not edited (superseded, never erased).

## 2. Sequence (by dependency and rework risk)

**Unblocked:** On-sale pages S2 committed `d21eade14` 2026-11-19 (its files were most of this plan's surface).

**⚖ All three stages go BEFORE On-sale pages S3 (owner 2026-11-19)**, recorded in `CLUB_ON_SALE_PAGES_PLAN.md`
"Sequencing against other builds": S3 rebuilds the pages Founding sits on, and S4's free-floor and Founding-comped items
were struck there as handled here. Kept as a separate project (its own board line), not merged into On-sale pages.
**What S2 added that Stage 1 must cut:** `isLeagueDoorOpen()` in `plan-gating-server` (flag half `LEAGUE_STARTER_BETA`)
now feeds the Get started menu and Home's waiting-workspace card; keep the League Plus half only.

- **Stage 1 — the free League** (no customer affected). First, because Stage 2's league-create comp grant disappears
  with it, and because it is smaller.
- **Stage 2a — the holders' move to free time** (design + a dev rehearsal on the 5 dev holders; the production step is
  an owner-run release step). Before 2b, so that removing Founding code never leaves a holder on a stored plan with no
  end.
- **Stage 2b — remove the Founding code.** Then, straight after, the free-time item (`FREE_TIME_SAME_RULES_PLAN.md`); **2b
  reaches production only together with it** (owner 2026-11-19).
- **Stage 3 — records, help, tests, `/legal`, `/review`.** Runs with each stage, closed at the end.

**Order against the On-sale pages work (recorded 2026-11-19, after the S2 walk §545 passed; the owner's yes):**
Stage 1 → 2a → 2b → **the team move's own small session** (On-sale plan call C1) **and the three small items** from walk
§545 call C5 (two tabs making two organizations; sign-in from `/auth/login?next=/start/club` landing on Home; the doubled
title) → S3 → S3b → S4. The first two of those come after this project because they edit code this project deletes:
the team move and the plan-move and team-transfer code carry Founding branches (the comp revokes, the Founding-comped move
refusal), and the create step that makes two organizations also carries the Founding grant and, in Stage 1, the free
League's own create route. The title fix and the sign-in fix share no code with this project and may go at any time after
Stage 1 (Stage 1 edits the same start pages). **Production:** the Stage 2a holder move is an owner-run release step and
must reach production **before** the Stage 2b code does; the migration and Terms steps of the on-sale production order are
separate and unchanged. Do not start any of the follow-on items while a build of this project is open in the shared copy.

## 3. Stage 1 — remove the free League

Census (2026-11-19, file:line as found; re-grep `free_floor|freeFloor|league_starter|isFreeFloorLeague|FREE_FLOOR|LEAGUE_STARTER_BETA|houseLeague(Season|Division|Team)Cap|LeagueCapKind|leagueCapHit|LeagueCapUpgrade|Free League`):

- **Entry points:** `app/api/league/create/route.ts` (whole route: flag gate :60, create :158, events :172-190, Founding
  comp :195-201) · `app/(consumer)/start/league/page.tsx:28-29,54-71` (free form branch) + `StartLeagueForm.tsx` ·
  `app/(consumer)/start/StartDoorForm.tsx:63-76` (the `league` door, "Free — one season, one division, up to 8 teams") ·
  `app/(consumer)/start/page.tsx:138-148,161,172` (`LEAGUE_OPTION`, flag read) · `lib/plan-gating-server.ts:99-106`
  `isLeagueDoorOpen()` (keep it as "League Plus door open" only) → readers `lib/start-menu.ts`, `app/api/consumer/home/route.ts:131-138`.
- **Sign-in and roles:** `lib/user-contexts.ts:314` ("Free League" card), `:483-488` routing; `lib/member-home.ts`;
  `lib/board-roles.ts:58`; `components/admin/kit/club/ClubBriefProvider.tsx:136-138`; `lib/module-entitlements.ts:2,24,50-52`
  (`freeFloorModules` union).
- **Caps and refusals:** `lib/free-floor.ts` (delete the file); house-league routes `seasons/route.ts:48-60,82,134-142`,
  `seasons/[seasonId]/route.ts:54-55,276-279`, `divisions/route.ts:114-123`, `teams/route.ts:84-96`,
  `schedule/generate/route.ts:239-246`; `lib/league-season-slot.ts` (keep the live-season count if anything else reads
  it, else trim); `lib/house-league-status-words.ts` (Reopen refusal); `components/admin/LeagueCapUpgrade.tsx` (delete).
- **Admin UI branches:** onboarding `page.tsx:186-208,514,770,850,1243`; house-league `page.tsx`, `seasons/[seasonId]/page.tsx`,
  `schedule/page.tsx:1279-1308`; `CreateLeagueSeasonDialog.tsx`, `AddAgeGroupsWindow.tsx`, `RegistrationsScreen.tsx:679,759,862`,
  `FriendRequestsView.tsx:62,83,529` (each: the floor branch goes, the paid behaviour stays).
- **Analytics:** `lib/platform-events.ts:53-62` floor-only event types, `app/api/events/league/route.ts` (accepts client
  events for floor orgs only — remove the route if nothing else posts), `lib/league-events-client.ts`. Keep historic
  rows readable if `platform_events` has any (check counts on dev and prod first; do not drop data).
- **Platform admin:** orgs list `page.tsx:42,188` + `OrgsClient.tsx` (filter, band "Free League Starter", chip, CSV column);
  `lib/platform-metrics.ts` `leagueStarter` block; `business-numbers/page.tsx` panel; `dev-tools/AgentPlaybook.tsx:133,474`.
- **Types and config:** `lib/types.ts:234-237,282-283` (`FreeFloor`, `Organization.freeFloor`); every org loader that
  selects `free_floor` (`api-auth`, `server-organizations`, `directory`, `invite-acceptance`, `user-contexts`,
  `public-club-access`, account notifications page, `db.ts:1695,1709,1766`); remove `LEAGUE_STARTER_BETA` from
  `.env.local` and tell the owner to remove it from any hosted env.
- **Copy and help:** `lib/help-content/house-league.tsx` (the "Plans and limits — free League vs. League Plus" article
  :98-112, plus :9,162,197,353,638,680), `registrations.tsx:182`. Keep League Plus content.
- **Data:** a migration that nulls nothing on prod (0 rows) and **drops `organizations.free_floor` + its CHECK**; the dev
  fixture org with it set: drop the column with it (the org stays a plain Tournament org) or delete the fixture if it
  only existed for the floor. Dictionary (`DATA_DICTIONARY.md:171-172`), snapshots (`npm run refresh:snapshots`),
  `MANUAL_PROD_STEPS.json` if the repo records prod migrations there. Seeds writing `free_floor: null`
  (`seed-uat-standalone-coach.mjs:260`, `seed-plan-ending-words-walk.mjs:255`).
- **Tests:** floor-specific — `league-season-slot`, `house-league-season-page:99-107,181`, `house-league-start-from:232-238`,
  `role-defaults-guard:131-133`, `on-sale-doors-s2:279-303`, `account-first-signup:440`, `plan-pricing-facts-agreement:42-44`,
  `workspace-flip-guard`; ~20 more carry `freeFloor: null` in fixtures and break only when the field leaves the type.
- **Records:** Facts doc League row and every "only the free League floor caps…" clause (incl. the 2026-11-19 team-limit
  lines); `PRICING_PAGE_COPY.md:32,102-117,264,443,449-450` and its top team-limit section's ⚠ line;
  `BRAND_STRATEGY.md:123`; `CLUB_GATE_FLIP_RUNBOOK.md:174,180`; `CLUB_ON_SALE_PAGES_PLAN.md:23,217,242,363`.

**Done when:** a grep for the census terms returns only history; `/start/league` with League Plus closed shows the
interest page; a League Plus org can create a 9th house league team, a 2nd division and a 2nd live season.

**Build record (2026-11-19).** Counts re-taken first (counts only): `free_floor` set — prod 0, dev 1 (`test-minor-softball`,
kept as a plain Tournament org; its one house-league season stays in the database, unreachable); `platform_events` rows of
the seven free-League types — 0 on both, so the types were removed outright. Deleted: `lib/free-floor.ts`,
`lib/league-season-slot.ts` (nothing else read it), `LeagueCapUpgrade.tsx`, `/api/league/create` (with its Founding grant),
`StartLeagueForm.tsx`, `/api/events/league` + `lib/league-events-client.ts`, the free `league` entry in `StartDoorForm`'s
door copy. `isLeagueDoorOpen()` is gone; its two readers ask `isPaidDoorOpen('league')`. The Reopen refusal plumbing
(`blockedBy`, `MoveWords.refused`, the window's refused branch) went with the cap. Migration 509 drops the column + CHECK,
applied to dev 2026-11-19; production is an owner-run release step AFTER the code is serving (`MANUAL_PROD_STEPS.json`).
`LEAGUE_STARTER_BETA` removed from `.env.local`. **Found on the way (not changed):** League Plus and Club both carry
`club_scheduler`, so the house-league schedule's older generator (the "no club's schedule" path in
`schedule/generate/route.ts` and the schedule page) is now reached only by an org given house league as an add-on —
a candidate for removal, recorded here rather than done (out of Stage 1's scope).

**Checks and review (2026-11-19).** Unit tests: 30 failed of 17,854, none from Stage 1 (29 fail identically on a clean copy of the
last commit; one is another session's public division filter). Typecheck clean apart from one committed test file Stage 1 never
touched; the generated route types for the two deleted routes needed `npx next typegen` and removing their stale folders.
Migration check, dictionary and spelling pass. Review at the high-risk tier (sign-in/onboarding, entitlement, the five house-league
create routes, the migration, start pages and menu, platform admin): no defects; League Plus, Club and Club · Association house league
unchanged. Fixed in the same commit: the League Plus pricing card still said "No credit card required" with "Start free" and now says
the ruled trial sentence (30 days) with "Start your League Plus trial" (`BUSINESS_DECISIONS.md` 2026-11-18, Ask 7). **Release order, the
one real hazard:** drop `organizations.free_floor` on production ONLY after the new build is serving — the previous build reads the
column by name in the membership read, ignores the error, and every signed-in member would silently see no workspaces (and creating an
organization would fail). After the drop: refresh the schema snapshots and delete the dictionary entry. Left as is: stale comments naming
the deleted routes (`app/api/auth/signup/route.ts:19`, `lib/demo-guard.ts:154,170`, `components/EarlyAccessModalTrigger.module.css:2`);
an account that signed up on the old free League door will meet the paid plan step when League Plus opens (its Home card names no price);
`LEAGUE_STARTER_BETA` may still be set in a hosted environment.

## 4. Stage 2a — the holders' move to free time

- Read the free-time model first (`lib/free-time*.ts`, `lib/entitlement-grants.ts`, `lib/portal-free-time*.ts`; the
  memory note "Free time: super admin unlimited + No end date" — the Billing role is limited to 6 months, a super admin
  is not). Decide the exact rows each holder needs so that, **after** 2b, it reads as free time on its plan until
  2027-09-30 and then ends the way free time ends (verify the end path exists for both an org and a coach workspace).
- Write the move as **one idempotent script or migration that selects holders by the comp mark, never by name**
  (`org_overrides.type='comp_period'`, unrevoked, expiry in `FOUNDING_SEASON_COMP_EXPIRIES`). The free `tournament`
  holder is moved to Tournament Plus free time.
- Rehearse on dev (5 holders), then show the owner the before/after of one holder's billing page.
- **Production is an owner-run release step**, in the release record, with counts before and after (an AI session reads
  production as counts only).
- Whether to mark the holders' comp rows revoked after the move: yes (revoked, not deleted), once free time carries them.

**Build record (2026-11-19).** Mockup `FOUNDING_HOLDERS_FREE_TIME_MOCKUP.html` (Artifact `claude.ai/artifact/3qxEXPjuuqJrx1y9WLHJPZ`,
`/design` reviewed). **Owner rulings this session:** go as planned; (A) club free time gets the coach's 14- and 3-day ending
reminders, as its own board item; (B) no email to the holders; (C) the coach's free time cannot be extended from the staff
screens (its limit counts from the move's date) — accepted, and overtaken by the next ruling; **a super admin can give free time
with no end date on BOTH clubs and coaches** (today only clubs), built as its own small item. Both items: board line
`free-time-same-rules`, plan `FREE_TIME_SAME_RULES_PLAN.md`.

- **What the model needed (argued from the code).** A club's free time is a `plan_tier` grant folded over its OWN stored plan, and it
  lifts only a plan above the own one — so a Tournament Plus holder's stored plan comes down to `tournament` and the grant lifts it,
  which is also what makes it end. The staff give cannot do the coach (it refuses Founding portals, and no role reaches past
  2027-05-19); the coach is rewritten into the shape `givePortalFreeTime` writes. The date needed no change: free time's end for
  "last day September 30" is 2027-10-01 04:00 UTC, the instant Founding stored.
- **Migration 510** (`510_founding_holders_move_to_free_time.sql`, data only): one DO block, holders chosen by the unrevoked comp
  mark at a `FOUNDING_SEASON_COMP_EXPIRIES` instant, refusals before any write, audit rows matching the staff writes (the coach's
  with mode `moved` so the Story does not say the portal was made from a free team), marks revoked with a `revoke_override` row.
  Every holder gets September 30, 2027, whichever instant its mark carried (dev's one legacy-dated fixture included; production has none).
- **Dev rehearsal:** 5 holders (three Tournament Plus clubs, one free Tournament club, one coach) → 0; 4 club grants, 1 coach
  grant, 5 marks revoked; a second run returned the same counts and changed nothing. Rows read back: each club `tournament`/limit 1/
  active/no period end + a running Tournament Plus grant; the coach stored cancelled, workspace marked free time, entitlement
  `platform_override` ending 2027-10-01 04:00 UTC.
- **End path proven** (`.probe/founding-move-endpath.mts`, the product's read rules over those rows at five clocks): until 11 p.m.
  Eastern on September 30, 2027 the club reads Tournament Plus (unlimited) and the coach's portal is open; from the last 14 days the
  band turns amber ("Free time · 10 days left"); at 12:30 a.m. Eastern on October 1 the club reads free Tournament (1 tournament,
  "Free time ended" band) and the coach's portal is closed behind "Your free time has ended"; both bands are gone by November 5,
  2027. The coach also gets the 14- and 3-day emails (the daily job selects `free_time_given_at` + `platform_override`); a club is
  told on the page only until the reminder item is built. The coach holder has a free team to return to (production and dev: 1 of 1).
- **Production:** owner-run, `MANUAL_PROD_STEPS.json` entry 510 (pending), with the counts to expect (3 holders → 0; 2 club
  grants, 1 coach grant, 3 marks revoked) and three verify queries. Any time before the Stage 2b code reaches production; first
  confirm `ENTITLEMENT_GRANTS_ENABLED=true` in Amplify. Found on the way: production's coach held `current_period_end`
  2027-01-01 (left from before the date was extended); the move clears it.
- **Reviews.** `/accounting`: no change — monthly revenue unchanged (the clubs' stored plan is the $0 Tournament plan; free time never
  feeds it), "comped out" 3 → 0, the coach leaves the customer counts (the existing free-time portal rule), renewals 3 → 3 on the same
  day, no book, invoice or GST/HST effect. `/legal` (row in `LEGAL_INDEX.md`): no must-fix; the promise is kept; no notice owed and none
  sent; one condition — the "we'll remind you during the summer" lines lose their mechanism, so club reminders should be built before
  or with 2b (owner call). Production counts for `/legal`: 0 holders with a card on file or a next-season choice. `/review` (high tier):
  no confirmed defect — every gating reader goes through the free-time door (the plan-reader guard's list), the coach's portal stays
  open through the folded status + the moved entitlement, no daily job acts on either shape, the audit rows match what the Story and
  the free-time list read, every Founding reader skips a revoked mark. Taken: its hardening point — the migration now also refuses a
  holder that is not active or is suspended, or a coach whose portal is not an independent staff-billed one free of Stripe ids
  (production 0 in any of those states, counts only); proved on dev by re-running (no change) and by a rolled-back run that
  un-revoked one mark and was refused. Accepted as a property of all free time: a failed read of the grants leaves a club on its own
  plan for that one request (fails open toward the free plan). Cosmetic: the giver reads "system". Checks: dictionary, spelling, production-steps gate pass; `check:migrations` shows only other sessions' pending prod
  changes; `verify:changed` 30 of 17,894 tests fail, none from this stage (all in files committed before it; same count as Stage 1);
  typecheck 2 errors in one committed test file (`layout-run-journal.test.ts`, 2026-11-18), as Stage 1 recorded.
- **Committed `d27742a97` 2026-11-19.** Owner after the commit (2026-11-19): looked at the free-plan dev holder's Plan & billing
  page and **approved** it; and **agreed** with `/legal`'s condition — **Stage 2b reaches production only together with the
  free-time item** (`FREE_TIME_SAME_RULES_PLAN.md`), built straight after 2b.

## 5. Stage 2b — remove the Founding code

Census (2026-11-19; re-grep `Founding|FOUNDING_SEASON|founding_|foundingSeason|showFoundingSeason|comp_period|next_season|NEXT_SEASON_CHOICE|start_door`):

- **Config:** `lib/plan-config.ts:321-557` (the whole block); `lib/founding-season.ts`, `lib/founding-season-desk.ts`,
  `lib/use-founding-season-lock.ts`, `lib/next-season-choice.ts` (delete); `lib/plan-billing-profile.ts:27,201-245`
  (`showFoundingSeason`).
- **Grant paths:** `app/api/org/create/route.ts:169-173`; the $0 Tournament Plus switch in
  `app/api/billing/create-checkout/route.ts:216-220,328-405`; `app/api/billing/create-team-checkout/route.ts:120-131` →
  `lib/team-checkout.ts:683-766,811-889`; the start-door lock in the signup routes (`auth/signup:210`,
  `team-signup:149`, `coach-signup:144`) and `lib/start-door-server.ts` (keep the lock only if something else reads it).
- **Read and revoke paths:** `app/api/admin/org/founding-season-status/route.ts`; `choose-next-season`,
  `setup-payment-method` routes; `lib/billing-setup.ts:125-142,347,418`; **`lib/billing-webhook-handler.ts:270,322,432-445,644,755`
  (the next-season arms — high risk; confirm 0 next-season subscriptions exist on dev and prod first)**;
  `plan-growth.ts`, `team-ownership-transfer.ts:535`, `lead-book.ts`; revokes in `plan-move.ts:355-357`,
  `operator-plan-change.ts:261-330`, platform-admin plan + bulk-operations routes, `staff-change-alert-email.ts:73`.
- **Emails:** `lib/marketing-email-defaults.ts:104-260` (live `founding_*` templates; 269-415 already retired),
  `app/api/admin/email/send/route.ts`, `app/api/admin/email/route.ts`, `schedule/route.ts`, `lib/email-sender.ts:478-575`,
  `lib/email.ts:751-762,1973-2076`, `app/api/admin/org/onboarding-plan/route.ts:93-95`. Keep `email_sends` history.
- **Customer screens:** billing (`BillingBody.tsx`, `plan-billing-words.ts:73-76,274-304`, `plan-billing-data.ts`,
  `PlanArticlePanel`, `PlanPanelDrawer`, `PlanCycleDialog`, `FreeTimeBand` (shared)); lock lines
  (`invite-only-words.ts:24-27`, `PlanLockLine.tsx`, `ExportMenu.tsx:144`, tournaments schedule page :1407); pricing
  (`app/pricing/page.tsx` imports, FAQ, flags, panel, trial note, closing lines; `ViewerAwarePlans.tsx`; `PricingSection.tsx`);
  `app/page.tsx`; `for-tournament-organizers`; `for-coaches`; `FoundingSeasonPanel.tsx`, `FoundingSeasonOfferBar.tsx`,
  `globals.css:488`; sign-up and onboarding (`start/page.tsx`, `start-menu.ts`, `TeamSignupClient.tsx`, coaches
  start / welcome / checkout-complete, `CoachWelcomeCard.tsx`, onboarding banner + `PlanStep.tsx`); coach upsells
  (`ScopeShelf`, `ScopeCeilingInterest`, `CoachExploreCatalog`).
- **Platform admin:** clubs list filter/count/chip; club record + `FreeTimeWindows` (shared, cut branches); the free-time
  page's Founding tab + `FoundingSeasonDesk.tsx` + `founding-season.module.css` + the `/platform-admin/founding-season`
  redirect; email dashboard; renewals (`free_or_founding`); `platform-metrics.ts:249-253` (comped orgs out of revenue —
  becomes "free time out of revenue"); `platform-labels.ts:76`, `platform-areas.ts:181-184`, `export/catalog.ts:1060-1077`
  (points at a missing file), `BulkOperationsClient.tsx:389`.
- **Data:** no Founding-only column or table. `organization_billing_facts` next-season columns (mig 283) are written only
  by Founding — drop them in a migration if nothing else reads them; card-on-file stays (generic webhook).
  `DATA_DICTIONARY.md` Founding lines (incl. stale :398). Leave the `comp_period` CHECK value (shared, old rows).
- **Help:** `lib/help-content/org.tsx:32,51,438,443,549,1925`; `platform-admin.tsx:37,254,272,587,614,637-656,1637-1654,1791-1826,1947,2027`.
  Not "founding year" (`org.tsx:1960,2060`, `past-year-hint.ts`) — unrelated.
- **Tests:** ~20 Founding-focused (`founding-season-dates`, `next-season-choice`, `plan-billing-*`, `renewals`,
  `free-time-surfaces`, `free-time-story`, `first-look-stage3`, `marketing-campaign-registry`, …) and ~25 passing mentions;
  `tests/uat/scenarios/pricing-team-smoke.spec.ts`; scripts `seed-founding-season-fixture.mjs`,
  `generate-campaign-reseed-migration.mjs`, `set-team-plan-gating.mjs`. The `plan-billing-profile` article fingerprint
  will need re-baselining (state it in the commit).
- **Records:** Facts doc Promotions (collapse) and the Tournament Plus / Premium rows' Founding notes; `PRICING_PAGE_COPY.md`
  banner + Founding canon (mark history); `BRAND_FOUNDATIONS.md` (35 mentions); memory notes on Founding;
  `docs/agents/legal/PRICE_CHANGE_NOTICE_PROCEDURE.md` lines 16, 22 ("Founding comps" → free time, still excluded from notices);
  `ON_SALE_PAGES_S1_REVIEW.md` item 4 closes; the stale "Founding Season" comment on the comped-out figure in `platform-metrics.ts`
  (the figure itself is dead once no `comp_period` row is live — remove it or rename it, `/accounting` 2026-11-19).
- **Already done by 2a (do not redo):** no holder carries a live comp mark, so every Founding read path finds nothing for them.

**Done when:** a grep for the census terms returns only history and the kept shared pieces; no screen, email or staff
page says "Founding"; the three holders read as free time on their plan through September 30, 2027.

### 5a. Stage 2b gate record (2026-11-19 → 2026-11-20) — gate PASSED, build not started

- **Census re-grep** (two helpers, verdict per item) — corrections to the census above, argued from the code:
  - **Shared, KEEP:** the card-saving session in `lib/billing-setup.ts` (`createCardSetupSession`) is also the fallback of
    `app/api/billing/portal/route.ts` for an org with no Stripe customer, so it and the webhook's setup-mode arm stay. Only
    its metadata `purpose: 'founding_season_card_on_file'` is renamed (the webhook does not read `purpose`). The card-on-file
    columns become **write-only** — keep them, say so in the dictionary.
  - **Two more readers of the next-season columns** (must stop reading before the drop): `lib/billing-drift-server.ts`
    and `lib/renewal-reminder-server.ts` (+ `renewal-reminder.ts`, `purchase-details.ts`'s next-season case).
  - **The start-door lock** is `app_metadata.start_door`, read only by Founding; it is **not** `user_metadata.start`
    (`readStartDoor`, kept).
  - **Trap:** `PricingSection.tsx` turns the paid CTA into "Start now" only through the Founding promo note. Removing the
    note reverts two paid plans to "Start free" + "No credit card required" — set `'Start now'` outright.
  - **Missed by the census:** the plan-lock menu foot in registrations + `RegistrationChip.tsx`; the "comped clubs not
    counted" line on `app/platform-admin/page.tsx` and `business-numbers/page.tsx`; the portal free-time Founding block;
    `email-templates/page.tsx`; `lead-numbers-view.ts`; the `/coaches/welcome` route (reached only via the comp path) and
    its `WARM_JOURNEY_PREFIXES` entry; the dead `--offer-bar-h` CSS and Founding-only CSS classes;
    `export/catalog.ts`'s entry for a missing file.
  - **Env:** neither `.env.local` nor `.env.production.local` holds `NEXT_PUBLIC_FOUNDING_SEASON_*`; only the hosting
    console might (owner step).
  - **Campaigns** (`/platform-admin/email`) is entirely Founding: all five live campaigns are `founding_*` and its
    audience band and opt-out list are built from Founding orgs only.
  - Already closed up: every public Founding piece (pricing, home, for-* pages, start) has been hidden since 2026-10-26.
    `ON_SALE_PAGES_S1_REVIEW.md` item 4 is already fixed in code — close it in the record.
- **Counts** (dev / prod, counts only): next-season choices 0 / 0; orgs with a Stripe subscription 5 / 0; comp_period rows
  9 / 3, unrevoked 0 / 3 (all 2027-10-01 04:00 UTC, the 3 holders until 510 runs); cards on comp orgs 0 / 0; start-door
  locks 2 (both post-close) / 0; Founding `email_sends` none / `founding_welcome` = 1. Migration 510 on prod: pending.
- **Mockups:** `FOUNDING_REMOVAL_2B_MOCKUP.html`, published https://claude.ai/artifact/VfLyZhTrSZbGkvySkHVYQ5, `/design`
  run, all findings fixed. **PM UX summary presented 2026-11-19.**
- **Owner rulings 2026-11-20 ("go with all four recommendations"):**
  - **A.** The Free time page becomes **one list under the "Free time" title, no tabs.** Old links to the Founding view and
    the old `/platform-admin/founding-season` address land on that list.
  - **B.** **Campaigns stays as a record:** Sent history and Opt-outs only, with Opt-outs **widened to every organization
    that unsubscribed** (today: Founding orgs only). The audience band, counts, schedule and send controls go, with the five
    `founding_*` campaigns and their sending paths. `email_sends` history stays.
  - **C.** The holders' old Story lines read through the **ordinary comp-period wording** (the Founding branch of
    `free-time-story.ts` goes). The reason 2a recorded — "Founding Season promise kept as free time through September 30,
    2027 (owner ruling 2026-11-19)" — **stays as history** in the Why column; it is the one place staff still read the
    word, and it is exempt from "no staff page says Founding". The Oct 1 (stored instant) vs Sep 30 (last free day) pair
    is accepted.
  - **D.** "· N comped clubs not counted" **comes off Today and Business numbers**, with the dead figure in
    `platform-metrics.ts` — `/accounting` confirms during the build.
- **Build prompt:** §8c.

### 5b. Stage 2b build record (2026-11-20)

- **Re-verified first (counts only on production):** next-season choices 0 / 0 and next-season subscriptions 0 / 0 (dev / prod);
  unrevoked comp marks 0 / 3 (the holders, until 510); migration 510 on production: pending. Census re-grepped (204 files).
- **Removed.** The whole Founding block of `lib/plan-config.ts` (`showsFreeCredit` kept); `lib/founding-season.ts`,
  `lib/founding-season-desk.ts`, `lib/use-founding-season-lock.ts`, `lib/next-season-choice.ts`; routes
  `/api/admin/org/founding-season-status`, `/api/billing/choose-next-season`, `/api/billing/setup-payment-method` (only the
  Founding card window posted to it), `/api/admin/email` (GET), `/email/send`, `/email/schedule`, `/email/preview`;
  `/coaches/welcome` (+ its warm-journey and public-path entries); `FoundingSeasonPanel`, `FoundingSeasonOfferBar`,
  `FoundingSeasonDesk` and their CSS; the start-door lock (`app_metadata.start_door`; `user_metadata.start` kept); the org-create
  grant, the $0 Tournament Plus switch, the comp portal provisioning and reactivation; every Founding revoke and refusal in plan
  moves, operator changes, bulk operations and the free-time give; the webhook's three next-season arms (every other arm
  unchanged); the next-season reads in the drift check, renewal reminder and purchase-details email; the Founding-only emails
  (Tournament Plus welcome and upsell, the comp portal welcome); the plan-lock "free for you through" lines; the onboarding banner;
  Today's two campaign queues (always 0 once nothing is live); dead `--offer-bar-h` uses and Founding-only CSS. Scripts
  `seed-founding-season-fixture.mjs` and `generate-campaign-reseed-migration.mjs` deleted (nothing live to reseed);
  `seed-gst-6-4-walk-fixture.mjs` lost its next-season and card-window commands.
- **Kept, as ruled:** `org_overrides` + the `comp_period` value (old rows, all revoked); the card-saving session (portal fallback;
  metadata purpose renamed `card_on_file`) and the webhook's setup arm — card-on-file is now written and read by nothing;
  `FreeTimeBand` without `foundingThrough`; the five `founding_*` templates **retired** (not deleted) in
  `lib/marketing-email-defaults.ts` with frozen copy, so Email templates and Sent history still show past sends.
- **The four rulings, built:** A — Free time is one list, no tabs; `/platform-admin/founding-season` redirects to it. B —
  Campaigns shows Sent history + Opt-outs only; Opt-outs lists every organization with the opt-out set (it was filtered to
  Founding orgs in code; the 100-row cap went so the count is honest). C — the Story reads old comp rows the ordinary way; the
  stored reason stays. D — the comped line and its figure are gone from Today and Business numbers.
- **Visitors:** no change. The paid pricing cards say "Start now" outright (the trap in §5a): Tournament Plus and the Premium
  Coaches Portal; Tournament keeps "Get started free" + "No credit card required".
- **Data:** migration 511 drops `organization_billing_facts`' four next-season columns, their two CHECKs and
  `idx_org_billing_facts_no_next_season_choice`; applied to dev 2026-11-20 (6 card rows kept); production pending in
  `MANUAL_PROD_STEPS.json` with the ORDER **510 → the 2b code together with the free-time item → 511 after that code serves**.
  Dictionary updated (card-on-file write-only; two Stripe-bypass paths, not three; campaigns retired; `platform_events`
  `source='founding_season'` no longer written — historic rows dev 6 / prod 1); snapshots refreshed (prod still lists the four
  columns until 511 runs there — refresh again then).
- **Help** (`org.tsx`, `platform-admin.tsx`, the staff help hub's Campaigns link): no Founding anywhere; Free time, Campaigns,
  Renewals follow rulings A, B. `measure:help` unchanged set of long sections; spelling passes.
- **Records:** Facts doc Promotions collapsed to "no promotion runs" (Last-reconciled entry 2026-11-20 — the `/strategy` drift
  check runs against it; no price, name, band or gate moved; the agreement test passes); `PRICING_PAGE_COPY.md` and
  `BRAND_FOUNDATIONS.md` mark Founding as history; `PRICE_CHANGE_NOTICE_PROCEDURE.md` lines 16, 22 say staff-given free time;
  `ON_SALE_PAGES_S1_REVIEW.md` item 4 closed; in-repo memory updated.
- **Reviews.** `/accounting` (`FOUNDING_REMOVAL_2B_REVIEW.md`): no must-fix; the monthly estimate would overstate two list prices
  only if the 2b code served before 510 — the order prevents it. `/legal` (LEGAL_INDEX row 2026-11-20): no must-fix; the holders
  keep every dated promise through the free-time band; the 2a condition (club reminders) is met by shipping 2b only with the
  free-time item; CASL — sending only shrinks; the published Terms §8 "for a next season you choose" example can no longer arise
  (harmless, no notice) and is removed from the held draft (`drafts/TERMS_OF_SERVICE.md` 0.3).
- **`/review` (high tier, 5 lenses: correctness, security/tenancy, data/contract/webhook, regression, free-time rules):
  no confirmed defect.** Refuted: "for-coaches visitors see different words" (every switch keeps the offer-closed branch;
  the difference against HEAD is another session's uncommitted edit). Accepted as properties of the removal (0 such
  subscriptions on dev and prod): a stray next-season subscription would now take the ordinary webhook path, count as a used
  trial and get no reminder. Owner-visible, as ruled: an old Renewals link to a Founding choice opens on All; a holder's
  Money-tab Billing cell reads like any free-time club's ("Renews · Not set · no Stripe subscription"; the Free through row is
  right). Notes for later, not defects: the widened Opt-outs list reads each owner one at a time (fine at today's handful;
  page it if it grows); Re-subscribe writes no audit row (pre-existing — owner call whether to log it); a cancelled former
  comp portal that reactivates gets the org-billed error text (no such portal after 510). Checks: typecheck clean except the
  2 committed errors in `layout-run-journal.test.ts`; unit tests 30 fail vs 42 on a clean copy of the last commit, the only 2
  new from another session's `DivisionFilterBar`; spelling, dictionary, migrations-gate (only other sessions' prod drift +
  511's expected only-prod columns), production-steps gate pass; the other verify gates' failures are other sessions' files
  (tokens, admin type/old look, index coverage, org-slug callers, root files) or pre-date this change (unused CSS selectors).
  Help was done as a dedicated help pass following the `/docs` rules (measure:help, spelling) rather than the `/docs` agent.
- **Left as is (noted):** two dev accounts still carry the inert `app_metadata.start_door` key (prod 0; nothing reads it);
  `coachUpsell.normally` in `plan-billing-words.ts` is unrendered; `lib/marketing-schedule.ts` now has no product caller (its
  test stays); `createEmailBatch`/`finalizeBatch` have no caller; the paid Premium reactivation path does not clear the start
  record (it never did — only the removed comp path did).

## 6. Checks per stage

`npm run verify:changed`; `npm run typecheck` (needs `NODE_OPTIONS=--max-old-space-size=8192` on this machine while
other sessions run — default heap ran out 2026-11-19); `npm run check:migrations`; `npm run check:dictionary`;
`npm run check:spelling`; `npm run measure:help`; `/review` (high-risk tier: billing, webhook, auth signup, migrations);
`/legal` before handoff (what the holders were promised and are now shown); `/accounting` only if any charge path
changes (it should not); `/docs` for help.

## 7. Open questions for the owner

- **League Plus's name** once nothing sits under it (Proposed only; separate `/strategy` session).
- Remove `LEAGUE_STARTER_BETA` and the `NEXT_PUBLIC_FOUNDING_SEASON_*` vars from any hosted environment (owner, in
  the hosting console).

## 8. Build prompt (paste into a fresh session, one stage per session)

> Build Stage N of `docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` (owner ruling 2026-11-19, top entry of
> `BUSINESS_DECISIONS.md`). First confirm On-sale pages S2 is committed (`git status` shows none of its files modified);
> if not, stop and say so. Re-grep the census terms in the stage's section rather than trusting its line numbers. Keep
> every piece the plan marks as shared with free time. Present the PM UX summary before editing. Run the stage's
> checks, `/review`, and `/legal` for Stage 2; do not commit without the owner's go; stage explicit pathspecs only.

### 8b. Stage 2b build prompt (written 2026-11-19, after 2a `d27742a97`)

```
Stage 2b of docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md — remove the Founding Season code. Owner ruling
2026-11-19 (top entry of docs/agents/strategy/BUSINESS_DECISIONS.md). Stage 1 (free League) and Stage 2a (holders moved to
free time, migration 510, committed d27742a97) are done on dev; read the plan's §4 build record first. Do NOT build the
free-time item (FREE_TIME_SAME_RULES_PLAN.md) in this session — it is the NEXT session, and 2b reaches production only
together with it (owner 2026-11-19). Do not start the team move or the three small doors-walk fixes either.

WHAT IS TRUE NOW (verify, counts only on production)
- No account carries a live Founding mark: on dev 0 unrevoked comp_period rows at a Founding instant; production still has 3
  until the owner runs migration 510 (MANUAL_PROD_STEPS.json, pending). The 2b code must not reach production before 510 is
  applied there — say so in the production-steps record and in the release notes this session writes.
- Production on 2026-11-19: 0 next-season choices, 0 cards on file for holders, 0 Stripe subscriptions on any org. Re-count
  next-season subscriptions on dev and production BEFORE touching the webhook's next-season arms.

SCOPE: the plan's §5 census (re-grep the census terms; the line numbers are from 2026-11-19 and have moved). Remove every
Founding branch a customer or staff member can read, every path that can grant, extend or end a comp, the five Founding
emails' sending paths (keep email_sends history), the 2027 card window and next-season plan choice, the Founding desk.
KEEP (plan §1 rule 4): staff-given free time and what it shares — org_overrides, the comp_period CHECK value and
free-time-story.ts's reading of OLD comp rows, billing_mode='platform_override' told apart by free_time_given_at, the
"active with no subscription" ending paths, FreeTimeBand (cut only its Founding clause: free-time-copy's foundingThrough).
Also from 2a's reviews: the platform-metrics "comped out" figure becomes dead (remove or rename it, /accounting);
docs/agents/legal/PRICE_CHANGE_NOTICE_PROCEDURE.md lines 16 and 22 ("Founding comps" → free time, still excluded from
notices); ON_SALE_PAGES_S1_REVIEW.md item 4 closes. Data: drop organization_billing_facts' next-season columns (mig 283) only
if nothing else reads them (dictionary + snapshots + MANUAL_PROD_STEPS — a dropped column is invisible to check:migrations;
ORDER: after the code that stops reading them is serving). Remove NEXT_PUBLIC_FOUNDING_SEASON_* from .env files and tell the
owner to remove them from the hosted environment. Not "founding year" (unrelated).

BLOCKING GATE, IN THIS ORDER (AGENCY_RULES + owner memory):
1. Delegate the census re-grep to a helper; take back paths with line numbers and a verdict per item (remove / keep-shared /
   history), not dumps. Argue from the code; if the census is wrong or misses something, say so first.
2. Mockups, published as one Claude Artifact (HTML page, house layout: sticky numbered tabs, View switch Everything / Show
   only what differs, numbered clickable notes, GOES / CHANGED / UNCHANGED tags), /design run on it before hand-off. Draw the
   DECISIONS, a whole screen before/after each: (a) /pricing (the Founding banner, FAQ answer, trial note and closing lines —
   what re-flows when they go); (b) the home page and for-tournament-organizers / for-coaches sections that carry Founding;
   (c) the start / sign-up step and coaches welcome where a Founding line sits; (d) platform admin: the free-time page without
   its Founding tab, the clubs list without the filter/chip, renewals. Say what replaces each removed piece (usually
   nothing — then show the page closing up).
3. A product-manager UX summary in plain language: what each audience sees differently, role differences, risks.
Wait for the owner's go before editing code.

CHECKS: verify:changed, typecheck (NODE_OPTIONS=--max-old-space-size=8192), check:migrations, check:dictionary,
check:spelling, measure:help, npm test; report failures that are other sessions' with evidence (30 tests and 2 typecheck
errors in committed files were failing before 2a), fix only what 2b broke. The plan-billing-profile article fingerprint will
need re-baselining (say so in the commit). Then /legal (every customer-facing removal; what the holders were promised),
/accounting (the metrics figure, renewals' free_or_founding bucket), /review at the high-risk tier (billing, webhook, signup,
migrations), /docs for the help lines (lib/help-content org.tsx and platform-admin.tsx per §5). Apply what they find or record
it as an owner question.

RECORDS, SAME COMMIT AS THE WORK: the plan's §5 build record, the board line (OWNER_BRIEF_PROJECTS.json id
"free-league-founding"), the Facts doc (docs/agents/strategy/PLAN_PRICING_FACTS.md) Promotions + Founding notes and
PRICING_PAGE_COPY.md's Founding canon marked history (a pricing-facts change: /strategy drift check), BRAND_FOUNDATIONS.md,
memory notes on Founding. Shared working copy, branch dev: stage explicit pathspecs; partial-commit shared files (HEAD + your
exact edits, temp index, guarded commit); do not commit without the owner's go; review only your own hunks. Report in
product-owner voice.

DONE WHEN: a grep for the census terms returns only history and the kept shared pieces; no screen, email or staff page says
"Founding"; the three holders still read as free time on their plan through September 30, 2027; the production-steps
record says 510 before this code, and this code before the next-season column drop.
```

### 8c. Stage 2b build prompt — gate passed (written 2026-11-20; supersedes 8b)

```
Build Stage 2b of docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md — remove the Founding Season code (owner
ruling 2026-11-19, top entry of docs/agents/strategy/BUSINESS_DECISIONS.md). THE GATE IS PASSED: census, mockups (/design
run) and the PM UX summary were done in the previous session, and the owner ruled on its four asks on 2026-11-20. Pasting
this prompt is the owner's go to build. Do not redraw or re-ask; open with a short task list (AGENCY_RULES "planning
first") and start. Read first, in order: the plan's §4 (2a build record), §5 (census), §5a (gate record: census
corrections, counts, the four rulings), then the mockup docs/projects/active/FOUNDING_REMOVAL_2B_MOCKUP.html — build to it.

NOT IN THIS SESSION: the free-time item (FREE_TIME_SAME_RULES_PLAN.md) is the NEXT session, and 2b reaches production only
together with it (owner 2026-11-19). Not the team move, not the three small doors-walk fixes.

RE-VERIFY BEFORE EDITING (counts only on production, never rows that hold a person's information)
- Re-count next-season subscriptions and choices on dev and prod BEFORE touching the webhook's next-season arms (§5a: 0/0).
- Migration 510's prod status in MANUAL_PROD_STEPS.json (pending on 2026-11-20). The 2b code must not reach production
  before 510 is applied there.
- Re-grep the census terms (Founding|FOUNDING_SEASON|founding_|foundingSeason|showFoundingSeason|comp_period|next_season|
  NEXT_SEASON_CHOICE|start_door) through a helper; line numbers have moved. Do the reading through helpers (CLAUDE.md),
  open the cited lines yourself before editing them.

SCOPE: §5 as corrected by §5a. Remove every Founding branch a customer or staff member can read, every path that can grant,
extend or end a comp, the five founding_* campaigns and their sending paths, the 2027 card window and the next-season plan
choice, the Founding desk, the start-door lock (app_metadata.start_door — NOT user_metadata.start, which stays), the
/coaches/welcome route and its WARM_JOURNEY_PREFIXES entry, the Founding-only scripts, tests and CSS.
KEEP (plan §1 rule 4 + §5a): org_overrides; the comp_period CHECK value; free-time-story.ts's ordinary reading of OLD comp
rows; billing_mode='platform_override' told apart by free_time_given_at; the "active with no subscription" ending paths;
FreeTimeBand (cut only free-time-copy's foundingThrough); the card-saving session and the webhook's setup-mode arm (shared
with the billing portal fallback — rename only the metadata purpose; card-on-file columns become write-only, keep them and
say so in the dictionary).
THE FOUR RULINGS (§5a, build exactly these):
 A. Free time = one list titled "Free time", no tabs; old Founding-view links and /platform-admin/founding-season land on it.
 B. Campaigns stays as a record: Sent history + Opt-outs, Opt-outs widened to every organization that unsubscribed; the
    band, counts, schedule and send controls go.
 C. Story: remove the Founding branch; the holders' old rows read through the ordinary comp-period wording; the recorded
    reason text stays as history (the ONE permitted "Founding" a staff member reads). Oct 1 / Sep 30 accepted.
 D. Remove "· N comped clubs not counted" from Today and Business numbers and the dead figure in platform-metrics.ts.
TRAP: PricingSection's paid CTA reads "Start now" only through the Founding promo note — set 'Start now' outright and keep
it in every promoActive ternary (for-coaches, pricing), or two paid plans revert to "Start free" + "No credit card".
Visitors must see no change on /pricing, home, for-tournament-organizers, for-coaches, start (all hidden since 2026-10-26).
Also: docs/agents/legal/PRICE_CHANGE_NOTICE_PROCEDURE.md lines 16, 22 ("Founding comps" → free time, still excluded from
notices); ON_SALE_PAGES_S1_REVIEW.md item 4 closes (already fixed in code).

DATA: a new migration (next free number) drops organization_billing_facts' next-season columns (mig 283), their CHECKs and
idx_org_billing_facts_no_next_season_choice — ONLY after billing-drift-server.ts, renewal-reminder-server.ts,
renewal-reminder.ts and purchase-details.ts stop reading them. Apply to dev; record prod in MANUAL_PROD_STEPS.json with the
ORDER: 510 → the 2b code (with the free-time item) → this drop, after that code is serving (a dropped column is invisible to
check:migrations). DATA_DICTIONARY.md (Founding lines incl. the stale one, next-season columns gone, card-on-file
write-only) + npm run refresh:snapshots. Say the same order in the release notes this session writes.
ENV: no NEXT_PUBLIC_FOUNDING_SEASON_* in the local .env files (§5a); tell the owner to remove SIGNUP_CLOSE, END and
CARD_WINDOW_OPEN (NEXT_PUBLIC_FOUNDING_SEASON_*) from the hosting console. Not "founding year" (unrelated, keep).

CHECKS: verify:changed, typecheck (NODE_OPTIONS=--max-old-space-size=8192), check:migrations, check:dictionary,
check:spelling, measure:help, npm test. Report other sessions' failures with evidence (30 tests + 2 typecheck errors in
committed files were failing before 2a); fix only what 2b broke. Re-baseline the plan-billing-profile article fingerprint
and say so in the commit. Then /legal (every customer-facing removal; what the holders were promised and are shown),
/accounting (ruling D, renewals' free_or_founding bucket → free time), /review at the high-risk tier (billing, webhook,
signup, migrations), /docs (lib/help-content org.tsx and platform-admin.tsx per §5; Campaigns and Free time help follow
rulings A and B). Apply what they find or record it as an owner question. Restart the dev server before hand-off (files
deleted, shared modules changed).

RECORDS, SAME COMMIT AS THE WORK: plan §5 build record (+ §5a and this prompt, uncommitted from the gate session); the board
line (OWNER_BRIEF_PROJECTS.json id "free-league-founding"); PLAN_PRICING_FACTS.md Promotions + Founding notes and
PRICING_PAGE_COPY.md's Founding canon marked history (/strategy drift check); BRAND_FOUNDATIONS.md; memory notes on Founding
(Claude memory project_free_league_founding_removal.md; in-repo memory/billing-plan-invariants.md, project_pricing_strategy.md,
memory/MEMORY.md). The mockup file FOUNDING_REMOVAL_2B_MOCKUP.html commits with the work. Shared working copy, branch dev:
explicit pathspecs; partial-commit shared files (HEAD + your exact edits, temp index, guarded commit); do not commit without
the owner's go; review only your own hunks. Report in product-owner voice.

DONE WHEN: a grep for the census terms returns only history and the kept shared pieces; no screen, email or staff page says
"Founding" except ruling C's recorded reason; the three holders still read as free time on their plan through September
30, 2027; visitors see no change; the production-steps record says 510 before this code, and this code before the
next-season column drop.
```
