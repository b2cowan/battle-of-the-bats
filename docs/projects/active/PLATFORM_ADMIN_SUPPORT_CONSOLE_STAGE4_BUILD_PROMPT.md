# Platform admin support console · Stage 4, Free time (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-25, the day the owner ruled the Stage 4 drawings (every recommended box
> ticked, all eleven). **Re-verify every lead against the code before you build on it:** this prompt is a lead, not
> evidence, and so is any helper's summary. The working copy is shared with Club Tier and Bookkeeping sessions: stage
> explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit nothing without the
> owner's OK.

## 1 · What Stage 4 makes true

Support gives a club free time, with an end, and the product takes it back by itself.
- **A whole plan for a set time.** While it runs, **every** part of the product treats the club as on the given plan:
  the request gate, the pages, the limits, the APIs, the public site, notifications, the billing page. The moment after
  its last day, every part treats it as on its own plan again. Nothing is scheduled; the end is read, on the server,
  every time.
- **One window, Give free time**, on the club record's Access tab: a whole plan, sections, or a billing status; Free
  through (the last free day); why. The consequence sentence is the confirm.
- **The record shows it:** a short "Free time" chip with the plan and day beside it, the band's Free time figure, the
  Access list (Change the end date · End it now on each row), and Story entries (given, changed, ended early, ended by
  itself) with Put it back on the newest entry of a running grant.
- **Free time, one list**, replacing the Founding season menu entry: Everyone · Founding Season (the desk, whole) ·
  Given by staff.
- **Today's "Free time ending"** replaces "Overrides ending": 14 days, counting clubs.
- **The customer sees it:** "Free through {last free day}" on their Plan & billing page, amber in the last 14 days, and
  "ended" for 30 days after.

## 2 · Rulings. Do not reopen them

- **The drawings are the spec:** https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5 (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_DRAWINGS.html`), including the design pass's applied fixes. Where this prompt and
  the drawings disagree, stop and ask.
- **The eleven asks, all as recommended** (`memory/design_decisions.md` 2026-10-25, "SUPPORT CONSOLE STAGE 4"; the plan's
  "Owner rulings 2026-10-25 (Stage 4 drawings)"):
  Q1 one door for the plan right now, every reader on it, build-enforced · Q2 Super admin + Billing give it; it always
  ends; Billing ≤ 6 months, Super admin ≤ 12; never to a club the staff member belongs to · Q3 no plan grant while a Stripe
  subscription is live; sections and status stay · Q4 Founding folded into the **view** now, its **access** moves at the
  Founding turn-off decision (not in this stage); no bulk end · Q5 comp period no longer offered; existing rows read as
  they are · Q6 more time changes the running grant's end date; the Story says from what to what · Q7 one queue, Free time
  ending, 14 days, counting clubs · Q8 billing page only, three states, "Free through {last free day}" everywhere (console
  too) · Q9 switch off = refuse, server and screen · Q10 no free time on a Coaches Portal; the door is absent there ·
  Q11 D-1 End it now stays lime · D-2 a door that opens a window is an outlined button (Oct 1): Give free time, Change the
  end date, End it now · D-3 absent with one line where the console knows before the click; a sentence in the window only
  for what it cannot know · D-4 a short "Free time" chip, the date beside it in the body face.
- **Standing:** R1–R8 (plan), the Stage 1 and 2 rulings (shell, Find, the menu, Today's frame, the Story, one pencil, Put it
  back's rules: never anything that reached Stripe or an inbox), D1–D5. Every live change confirms in one sentence and
  keeps its reason.

## 3 · Read first

- The drawings: every frame, every tag (click them), "Before the drawings" (the code facts), the threat list (Money and
  safety, T1–T17), the boundary table (G), the design pass box.
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: "Stage 4 findings", the rulings, R1–R8, the ladder (S4, and S4b which is NOT
  this stage). The PM brief.
- The project index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp: news is an `ArtifactData` write to `stages/s4`
  and `log/…`. Never republish it.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` (plan names and ranks; never restate a price or a limit in copy),
  `FOUNDING_SEASON_2027_OFFER_COPY.md` (the "free through" canon).
- `AGENTS.md` (this is Next 16: read `node_modules/next/dist/docs/` before touching `proxy.ts`), `AGENCY_RULES.md`.

## 4 · Verified state (2026-10-25, re-verify)

| What | Then |
|---|---|
| Grant engine | `lib/entitlement-grants.ts`: `computeEffectiveEntitlements` folds `module_addon` (target.addons) and `subscription_status` only; `plan_tier` and `comp_period` are skipped (header ~15-17). `OverrideTarget.plan` has no reader. `isOverrideActive` ~41-49: end exclusive, `now` = server clock. `applyEntitlementGrants` ~94-120 is a no-op unless `ENTITLEMENT_GRANTS_ENABLED==='true'` (read once at module load); its "unchanged" short-circuit compares status + addon-array length only. |
| Who applies grants | Three paths: `lib/api-auth.ts` `getAuthContext` (~227), `lib/db.ts` `getOrganizationBySlug` (~1623), `lib/server-organizations.ts` `getOrganizationBySlugForServer` (~87, wrapped by `getClubBySlug = cache()`). **In all three, `planId`, `tournamentLimit` and `teamLimit` are computed from raw `plan_id` BEFORE grants run** (`api-auth.ts` ~194-196; `server-organizations.ts` ~49-54; `db.ts` ~1786-1794). |
| Raw plan readers (would ignore a plan grant) | `proxy.ts` ~268-282 (Tournament-tier redirect away from `/{org}/admin/org/*`); `app/api/register/route.ts` ~376-408; `lib/chat-service.ts` ~896, 1514, 2530; `lib/team-ownership-transfer.ts` ~133-170; `lib/permit-lookup.ts` ~226, `lib/venue-clash-lookup.ts` ~385; `lib/family-access.ts` ~154-174; `lib/needs-attention.ts` ~379; `lib/team-checkout.ts` ~317-367; `lib/user-contexts.ts` ~173-543; `lib/invite-acceptance.ts` ~17; `app/(consumer)/account/notifications/page.tsx` ~33-45; `lib/notify.ts` ~140; `lib/fan-notify.ts` ~237; `lib/directory.ts` ~421, 498; `lib/fan-follows.ts` ~309/371/440; `lib/scores-feed.ts` ~119; `components/coaches/CoachTournamentRecord.tsx` ~204 (a browser query). Coach/account-kind checks (`coach-membership`, `org-membership-policy`, `db.ts` ~4133) read account kind, not rank: check each. This list came from a helper: **census it again yourself** (delegate), it is the stage's spine. |
| Cached plan | `OrgProvider` (`lib/org-context.tsx`) holds the org for the life of a layout; `use-founding-season-lock.ts` caches per slug in a module `Map`. No `unstable_cache`, no plan in cookies. |
| Overrides write | `app/api/platform-admin/orgs/[id]/overrides/route.ts`: power `club_billing`; refuses `plan_tier` (~45); `expires_at` passed straight through (no past check, no cap, no end required); `suppress_billing` stored, read nowhere. End: `overrides/[oid]/route.ts`. The window builds the instant in the browser (`ClubRecord.tsx` ~804, `${ends}T23:59:00`). DB CHECK on `org_overrides.type` already allows `plan_tier`; `target` is jsonb. RLS on, no customer policy (server only). |
| Console record | `app/platform-admin/orgs/[id]/ClubRecord.tsx`: Add an override door ~616 (olive text, `can.billing`), `OverrideWindow` ~782-850 on the shared `RecordWindow` (Kind: Feature access / Subscription status / Comp period; `DateInput` without `min`/`max` though it supports both); band ~232-270, ~411-415 (`isClubBand` from the stored plan, `orgs/[id]/page.tsx` ~124); chips ~290-293; running list ~623-647. |
| Story + Put it back | `lib/platform-story.ts`: override rows ~289-322 (applied; ended / put back with the `revoke_override` reason; "ran out by itself" derived, key `override-ran-out:{id}`); plan put-back rule ~194-221 (`stripeFree`, `billingSame`). Route `app/api/platform-admin/orgs/[id]/put-back/route.ts` rebuilds the Story and acts only on an entry it offers; override → `endClubOverride` (`lib/club-record-changes.ts` ~130-151). |
| Today | `lib/platform-waiting.ts` ~64 "Overrides ending", 14 days, `stats.alerts.overridesExpiringSoon` (`lib/platform-metrics.ts` ~195-239: counts **rows**, every type, ignores `starts_at`); the list it opens (`orgs?filter=expiring_overrides`) counts clubs. Menu counts via `countsByEntry`; 30 s snapshot cache. |
| Founding | Access is written: org `plan_id='tournament_plus'`, `current_period_end` = the end instant; portals `team_workspaces.billing_mode='platform_override'`. The `comp_period` row marks the cohort by exact expiry (`FOUNDING_SEASON_COMP_EXPIRIES` in `lib/plan-config.ts`). Desk: `app/platform-admin/founding-season/page.tsx` + `lib/founding-season-desk.ts` (read-only by ruling 2026-09-07). Its Free through column prints the instant (Oct 1, 2027) under a Sep 30 header. Dev: 5 accounts, one on the Legacy 2026-12-31 instant, one marked Founding on the free plan. |
| comp_period writers to stop offering | `OverrideWindow` (console) and Bulk operations (`bulk-operations/route.ts` ~123, 207-227; `BulkOperationsClient.tsx`). **Keep** the system writers (org/league create, the $0 checkouts, `ensureFoundingSeasonCompPeriod`). |
| Customer billing | Tournament tiers: `/{org}/admin/tournaments/settings/subscription` (re-exports `app/[orgSlug]/admin/org/billing/page.tsx`; non-Club view; Founding card "Free through …" ~772, banner ~809, Billing card ~1229). Club / Club · Association: `components/admin/kit/club/BillingKit.tsx` (plan card ~316-370; "Trial ends"/"Renews" ~326; Move, Payment method, Reduce or cancel). The view is chosen from `currentOrg.planId` (~169-172). Founding state from `/api/admin/org/founding-season-status` (`.gte` on `expires_at`: inclusive, unlike the engine). |
| Stripe | `app/api/billing/webhook/route.ts` ~373-382 overwrites `plan_id`, both limits, status, period end on subscription events; ~746 forces `active` on payment. Never touches `org_overrides`. |
| Coaches Portal | Liveness reads `team_workspaces.subscription_status` / `team_entitlements` (`lib/coach-team-page.ts`, `lib/team-checkout.ts`); a portal record is an org with `account_kind='team_workspace'`. |
| Switch | `.env.local` true on dev; prod `true` (owner, 2026-10-25), copied into `.env.production` at build (`amplify.yml` ~42). |
| Demo clubs | `lib/demo-org-server.ts` `isDemoOrgId`, `lib/demo-org.ts` `isDemoOrgSlug`. |

## 5 · Scope: what Stage 4 is and is not

**Is:** the effective-plan door and every reader moved onto it, build-guarded; `plan_tier` grants written and read;
the server rules (cap, always ends, last day in Eastern, not your own club, not a paying club for a plan, not a portal,
not a demo, higher plans only, one plan grant at a time, refuse when the switch is off, compare-and-set on change);
Give free time / Change the end date / End it now; the record (chip, band, Access list, Story, Put it back); the Free
time list and menu entry; Today's Free time ending; comp period no longer offered; "free through" as the one phrase in the
console and to the customer; the customer's three states on both billing pages.

**Is not:**
- Moving Founding Season's **access** onto grants, changing its sign-up or checkout paths, or healing its rows (Q4: the
  Founding turn-off decision). Founding is read and shown, as drawn.
- Free time on a Coaches Portal, or portals reading grants (Q10; proposed S4b, not ruled).
- Any Stripe read or write; pausing or crediting a paying club (Stage 3 / Stripe).
- An email when free time ends (needs its own ruling); the sent-email log (Stage 5).
- A bulk grant or a bulk end; a League or League Plus grant.
- The audit log's reason column (Stage 3): reasons go in `new_value` as Stage 2's do.

## 6 · Blocking gate: before any code

1. **Re-run §4** and note every row that moved.
2. **The reader census.** Delegate a full census of every read of an organization's plan, limits, status or add-ons
   (`plan_id`, `tournament_limit`, `team_limit`, `subscription_status`, `enabled_addons`, and `currentOrg.planId` /
   `org.planId` consumers that make an access decision). For each: path, what it decides, and which of three it is:
   **goes through the door** · **is a writer or shows the stored plan on purpose** (allowlist, with a reason) · **must
   move**. This table is the guard's allowlist; show it to the owner before building if any row is a judgment call.
3. **The door's rule for limits, with /billing.** Proposed: during a plan grant the club's limits are the given plan's,
   unless the club's own stored limit is higher. Confirm with `/billing` (it is a gate) before building on it.
4. **`proxy.ts`.** Its Tournament-tier bounce must ask the door or go (the org-admin layout is the authoritative guard,
   per its own comment). Read the Next 16 proxy docs first; recommend one to the owner with the request cost.
5. **Customer copy through `/billing` and `/marketing`**: the card line, the band in three states, the Billing card,
   Club's hidden Move/Cancel/Payment while Club is free. Nothing restates a price or a limit.
6. **Migration check.** None is expected (`plan_tier` is allowed, `target` is jsonb, the audit log takes any action
   name). Confirm against the snapshots, not the migration files. If one is needed, stop and say so.
7. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build (after the gate), in parts

**Part 1 · The effective-plan door (the spine).**
- One server function answers "what is this club right now": plan, limits, status, add-ons, and the running free time
  (plan, last free day) for display. Grants are folded **before** limits are computed. `plan_tier` grants read
  `target.plan`; the newest running one wins (there is only ever one: Part 2 refuses a second). The short-circuit compares
  the plan too.
- The three existing grant paths and every "must move" row from the census call it. The browser query in
  `CoachTournamentRecord` moves server-side or reads from the door's answer. `OrgProvider` keeps its seed but every
  server action re-checks through the door, so a stale tab can show, never do.
- A **build guard** (scan test) fails on any new direct read of those columns outside the census allowlist.

**Part 2 · The server rules (the write routes).**
- Give: power `club_billing`; body = kind, plan or sections or status, **last free day as `YYYY-MM-DD`**, reason. The
  server turns the day into the end of that day in America/Toronto; it never takes an instant from the browser.
- Refuse, each with a sentence: switch off (all kinds) · club the staff member belongs to (any role; by membership,
  server-side) · a demo club · a Coaches Portal record · a plan grant while `stripe_subscription_id` is live · a plan not
  above the club's own (rank from plan config; Tournament Plus, Club, Club · Association only) · a second running plan
  grant · no end, a day not after today, or past the cap (Billing 6 months, Super admin 12, calendar months from today,
  every kind) · comp period from the console or Bulk changes.
- Change the end date: compare-and-set on the end the window was opened with; refused with who changed it and to what.
  Same cap and reason rules. Shortening to "now" is End it now.
- End it now = the existing end path, with a reason.
- Every write: an audit entry with the reason in `new_value` (Stage 2's way) and a Story entry.

**Part 3 · The record.** The door renamed **Give free time** (outlined button, D-2) at the head of the Access tab's
**Free time** list; the window as drawn (three radio rows; the whole-plan row replaced by one line when it cannot be given;
Plan dropdown of higher plans; the shared date field with `min`/`max` from the cap; Why; the live consequence sentence;
foot sentence left). Where the console knows before the click (switch off, your own club, a portal), the door is
**absent** and one line says why (D-3). Rows: plan or sections or status, "Free through …", days left, reason, giver,
**Change the end date** and **End it now** (outlined). Founding's row shows read-only ("given at sign-up"). Old
non-Founding comp rows read "Billing tag, gives nothing". The title chip "Free time" with "{plan} free through {day}"
beside it (body face), opening the Access list. The band: Overrides → **Free time** (count, soonest end); the band's shape
follows the **effective** plan; the last figure reads **Billing** "Free through …" when nothing renews.

**Part 4 · The Story.** Entries: Free time given / changed (from → to) / ended early / ended by itself (The product), for
every grant kind (today's override rows renamed). Founding: "Founding Season: Tournament Plus free through Sep 30,
2027", The product, no Put it back. Put it back only on the newest entry of a running grant: on "given" it ends it now;
on "changed" it restores the earlier day (cap and reason apply). The put-back route keeps acting only on an entry the
Story offers.

**Part 5 · Free time list, menu, Today.** The menu entry Founding season → **Free time** (same place; viewers: Super
admin, Billing, Support, Product; givers per Q2). Views: Everyone · Founding Season (the desk whole: band, summer note,
columns incl. card, 2028 choice, owner last seen; its Free through column shows the **last day**, Sep 30, 2027) · Given
by staff (soonest end first, an "Ending in 14 days" filter). The old address redirects. Nothing on it acts. Today:
"Overrides ending" → **Free time ending**, every kind, 14 days, **counting clubs**, opening the list's 14-day filter; the
menu count sits on Free time. A red line on the list while the switch is off.

**Part 6 · The customer's page.** Both billing pages, three states, on the page's own parts (the Founding pattern: plan
card's price line → "Free through {day}" + "from FieldLogicHQ · then {own plan}, automatically"; the olive band with its
eyebrow; the Billing card). Amber band in the last 14 days; "ended" band for 30 days after. The page is told only plan,
last day and ended, **never the reason or the giver**. Club's page while Club is free hides Move, Payment method and
Reduce or cancel (as /billing confirmed at the gate). The view (Club kit vs tournament page) follows the effective plan.

**Part 7 · One phrase.** "Free through {last free day}" wherever the console or the customer reads a free-time end,
including Founding's desk column and the record's band. Add the variants ("free until", "Until {instant}") to the
spelling gate's list if it fits that gate's shape; otherwise a guard test.

## 8 · Guards (new unit tests)

1. The census allowlist: no direct read of plan/limits/status/add-ons outside it (scan).
2. The door: a running plan grant changes plan **and** limits; one ended a millisecond ago does not; `starts_at` in the
   future does not; the switch off returns the stored plan.
3. The gate in front of the club pages admits a Tournament club with a running Club grant and bounces it after the end.
4. Give refuses: switch off · own club · demo · portal · paying club (plan only) · not-higher plan · League plans ·
   second plan grant · no end · past · over the cap per role · comp period from console and bulk · a role without
   `club_billing`. Each with zero writes.
5. The end instant is the end of the given day in Toronto whatever the request's time zone; the route rejects an ISO
   instant.
6. Change the end date: a stale `expected` end is refused, nothing written.
7. Put it back is offered only on the newest entry of a running grant; never on Founding; never on an ended grant.
8. Today's count equals the number of distinct clubs in the list's 14-day filter.
9. The customer's billing route returns no reason, giver or grant id.
10. The threat list T1–T17: each has a guard or a named reason it cannot.

## 9 · Verify

- `npx next typegen` then `npm run typecheck` (shared modules and `proxy.ts` change); `lint:focused` on changed files;
  the guards directly with `node --import ./tests/ts-resolver.mjs --test <files>` (the resolver does not resolve `@/`: a
  module a unit test imports uses relative imports); `check:spelling`; `check:dictionary`.
- ⚠ `npm test` / `verify:changed` clear `test-results/` for every session: run them only when no other session is
  mid-walk, and say so. Report your reds apart from other sessions'.
- **Restart the dev server** at hand-off (`proxy.ts`, shared modules, new files), via `npm run dev` only.
- `check:layout -- --changed` on the club record, Free time, Today, and both customer billing pages (1440, 1024, 390 for
  the customer pages), Warm and Dark; the `.probe/pasc/` overflow sweep if the layout session is stale.
- Read-only probes only (`.probe/pasc/`, abort non-GET); never overwrite `tests/uat/.auth/*.json` (the Club owner's
  session was expired on 10-25).
- The owner does the browser testing. A scratch club is needed to walk a grant end to end (dev's UAT clubs are
  Founding or paying).

## 10 · Hand-off

- **A QA walk as a checkable Artifact**, one purpose: "give a club free time, see it everywhere, and see it end by
  itself". Role cards (Super admin, Billing, Support, Read only) and the refusals. A matching Owner QA Ledger section;
  never sort its § numbers. Include a grant that ends during the walk (a day's grant) or say how to see the end.
- **Prod steps** named, not run (none expected beyond the deploy; the switch is already on).
- **The index:** `stages/s4` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walk's link.
- **Records:** the plan's S4 row and Status, TODO, the PM brief, the auto-memory `project_platform_admin_support_console.md`,
  `PROGRAM_BILLING_AND_ENTITLEMENTS.md` (the timed plan grant is no longer deferred).
- **Offers:** `/simplify` then `/review` (high risk: the access path for the whole product, `proxy.ts`, a money-adjacent
  write); `/docs` (the console's help on free time, and the customer's billing help); `/billing` drift check against
  `PLAN_PRICING_FACTS.md`.
- No commit without the owner's OK.

## 11 · Do not

- Move Founding Season's access, change its sign-up or checkout, heal its rows, or end it in bulk.
- Make a Coaches Portal read grants, or show the door on a portal.
- Read or write Stripe; suppress or pause billing (`suppress_billing` stays unread).
- Send an email, or add one.
- Add a scheduled job or anything that runs against production.
- Offer League or League Plus as a grant; restate a price or a limit in copy.
- Take the end instant from the browser.
- Edit shared automation or watched scripts.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- the door, the moved readers, `proxy.ts`, and the census guard;
- the write rules and their guards;
- the console (record, Story, Free time list, menu, Today, Bulk changes);
- the customer's billing pages;
- docs and help.

## 13 · Context you would otherwise miss

- The drawings' clubs are dev's real UAT Plus Org (a Founding club on Tournament Plus), UAT Test Org (free Tournament),
  UAT Rep Club, UAT Lakeshore Lynx; the grants, reasons and dates on them are examples.
- A Club grant does **not** revoke a Founding comp (only a plan **move** to Club does, `lib/plan-move.ts` ~250): at its
  end the club is back on Founding's Tournament Plus, free through Sep 30, 2027, and the customer's sentence says so.
- `lib/operator-plan-change.ts` is the one plan-change rule; a grant is not a plan change and must not call it.
- The two Founding coach emails' audience excludes portals on purpose ("a coach's free season would end with no
  warning"): that is S4b's and the Founding plan's, not this stage's.
- `.probe/pasc/capture-s4.mjs` and `render-s4.mjs` are the drawings' capture and render scripts.
- Still open for later stages: the morning check on Status (S5); Coaches Portal free time (S4b, proposed).
