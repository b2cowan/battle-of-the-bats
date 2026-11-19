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
- **Stage 2b — remove the Founding code.**
- **Stage 3 — records, help, tests, `/legal`, `/review`.** Runs with each stage, closed at the end.

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
  banner + Founding canon (mark history); `BRAND_FOUNDATIONS.md` (35 mentions); memory notes on Founding.

**Done when:** a grep for the census terms returns only history and the kept shared pieces; no screen, email or staff
page says "Founding"; the three holders read as free time on their plan through September 30, 2027.

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
