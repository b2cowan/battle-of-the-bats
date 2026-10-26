# Platform admin, reorganized for the support team's jobs — plan

**Status:** QUEUED 2026-10-10 (owner); cleared to run in parallel with Club Tier 2026-10-24 (owner: "don't take my
after club tier too literally, I am fine running them in parallel, they are different areas of the application
completely"). **Kickoff walked and end state drawn 2026-10-24** (from `PLATFORM_ADMIN_SUPPORT_CONSOLE_KICKOFF_PROMPT.md`).
**Owner ruled 2026-10-24** (paste-back; see "Owner rulings" below). Four items stay open. The bulk plan-change fix
ruled "fix now" was built and /review-ed 2026-10-24 (4 lenses; no Critical or High; three fixes applied: maxDuration
300, trial days read once per batch, the cleared team limit named in the result line; the guard anchored to the
plan_change branch). **Stage 1 build prompt written 2026-10-24:** `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE1_BUILD_PROMPT.md`.
It scopes Overview and the org record to shell/frame/header/type only, since S2 rebuilds them, leaves out the bell
(no platform notifications), and asks the owner three things at its gate: the portal's name, Help in place, and the
console sign-out.
**Stage 1 BUILT 2026-10-24 on dev** (drawings https://claude.ai/artifact/7DWPUBp9cDp26a2P359zLW, owner asks 1–5 all ruled as recommended
the same day; owner walk https://claude.ai/artifact/DnTBX4BCZnTdyqK3fP4JyF, ledger §371). The shell is
`app/platform-admin/{layout,PlatformShell,PlatformAdminNav}`, the shared recipes are `app/platform-admin/console.module.css`, and every
console screen was restyled onto them; committed `df9fe3ab5` (shared parts) · `d6fe761d3` (the console) · `aaa9743c3` (records) 2026-10-24, after /simplify, a six-lens /review and the /docs sweep. Rulings that joined at the build:
the portal is called **Support console**; **Help opens in place** from the menu foot; the shared account menu gained `signOutTo="platform"`
and `showAccount={false}` (staff get Appearance and Sign out only); **Overview and the club record got a colour-only pass**; **the sign-in
is always warm** (the 2026-10-23 signed-out rule overrode the build prompt's "follows the setting"). Not built, by design: a per-screen `?`
glyph (the console has no per-screen help drawer), the bell, Find. Bookkeeping got the shell only (its inside is the Bookkeeping plan's).
**Stage 1 walked 2026-10-25** (ledger §371, 45 of 45). **Stage 2 DRAWN 2026-10-25**
(from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_DRAWINGS_PROMPT.md`): drawings https://claude.ai/artifact/Ub7fXLh29SC34Zp4oqKUx1
(source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_DRAWINGS.html`, captures `.probe/pasc/cap-s2/`), after a design pass and a
security review of Find's design. **Owner ruled all 11 asks as recommended 2026-10-25** (see "Owner rulings 2026-10-25"); **Stage 2 build prompt written 2026-10-25:** `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_BUILD_PROMPT.md`.
**Stage 2 BUILT 2026-10-25 on dev** (walk https://claude.ai/artifact/GqozHVh1Bg2FLqSKEM78Xs, ledger §377; committed `4615ec678` · `b6f7afb30` · `c956362f4` 2026-10-25). Migration 365 (the sign-in lookup + `platform_record_opens`) applied to dev 2026-10-25, prod pending as a release step. The gate found nothing beyond A1 that changes who opens or does what; every staff account on dev and prod is confirmed. What the build added to the drawings, all put to the owner as the walk's 13 calls: the menu counts sit beside the page that clears them (so a folded Customers group adds up to Today's), a reason on every person action, Confirm the email on the Account tab, Add an override kept on Access, the Money tab worded without a stage number, "due in the next 30 days" (the real window). Found on the way: the reset-link route mailed whatever email the request carried (now the account's own), a person delete took its email in the address (now the body, checked on the server), and the clubs list's unbounded read would have stopped at the database's default cap (now paged).
**Stage 4 BUILT 2026-10-25 on dev, committed `6c8f8fb89` (the door, the readers, mig 373) · `5353f2cf3` (the server rules) · `e9bb0b059` (the console) · `a26ec5165` (the customer pages) 2026-10-25** (from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_BUILD_PROMPT.md`; gate and owner calls
in "Stage 4 build gate" below; walk ledger §379). **Finish pass done 2026-10-25 (simplify + review + help + strategy): `4071179f0` · `48205738a` · `7bc6b5441`; findings in "Stage 4 finish review" below.** Migration 373 (the fee book reads free time) applied to dev 2026-10-25,
prod is a release step. The door is `lib/entitlement-grants.ts` (rules `lib/free-time.ts`), guarded by
`tests/unit/plan-reader-door-guard.test.ts`; the threat map is "Stage 4 threats → guards" below.
**Stage 4 DRAWN 2026-10-25** (from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_DRAWINGS_PROMPT.md`): drawings
https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5 (source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_DRAWINGS.html`, captures
`.probe/pasc/cap-s4/` via `capture-s4.mjs`, render check `render-s4.mjs`), after a design pass (14 defects fixed, 4 rule meetings
asked as question 11) and a security threat list over the design (17). **Eleven asks owed to the owner.** See "Stage 4 findings" below.
Stage 2 leads re-verified against the code before drawing; what changed the Stage 2 drawings:
- The sign-in service's admin API cannot search (page/perPage only), so server-side Find needs a read-only SECURITY
  DEFINER lookup over `auth.users`: **a migration** (execute revoked from PUBLIC, anon and authenticated; service role
  only; tested with the anon key). No sign-in or `proxy.ts` change.
- Subscription charge ids are stored nowhere (only `online_payments` keeps family `pi_`/`ch_`), so Find matches whole
  `cus_`/`sub_`/family `pi_`/`ch_` only; a subscription charge waits for S3 unless ask 10 says otherwise.
- `platform_events` records no customer purchase or upgrade (only downgrade, cancel, past due, recovered), so the Story
  shows "bought" from S3's Stripe read.
- The 1,000-account cap is in four places (Customer users, the orgs list's owner sign-ins, Overview's owner-inactive
  count, the Founding Season desk).
- Beyond Organizations, the rulebooks also disagree on the staff list API (any session) and the orphaned plan-config /
  plan-gating GETs (any session).
- The console's staff check (`getPlatformAdminContext`) never checks that the session's email is confirmed; whether the
  hosted sign-in allows unconfirmed sign-in was not verified. The drawings carry "a staff account must have a confirmed
  email" as a Stage 2 guard.
**Stage 3 DRAWN 2026-10-26** (from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS_PROMPT.md`): drawings
https://claude.ai/artifact/FdTWB58ne1jgsBXSwutdLX, after a design pass (18 defects fixed, 2 rule meetings asked as question
11) and a security review of the refund design (15 findings folded in). **Owner ruled all twelve as recommended 2026-10-26**
(see "Owner rulings 2026-10-26 (Stage 3 drawings)"); **build prompt written 2026-10-26:**
`PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md`. See "Stage 3 findings" below.
**Stage 3 BUILT and committed 2026-10-26 on dev** (`270211ca0` · `4bfc9ca41` · `6c6d0da7e` · `d77ee9da9` · `e764efd90` · docs `bc9616345`), from the build prompt: migration 380 applied to dev
(the audit log's `reason` column with old reasons copied in, `platform_refunds`, `btree_gist` + one running plan grant per club;
prod is a release step with 365, 367 and 373); the Money tab, the five patterns, the charge and refund windows, recovery, the
Story's money, the audit log's Reason column and entry window, Find by charge / invoice / invoice number, Q9 in the shared
plan rule, Q7 on Bulk changes, Q10's words (gated), the window foot face. Gate calls, threats and the finish review are in
"Stage 3 build gate", "Stage 3 threats → guards" and "Stage 3 finish review" below. Walks owed: ledger §384 (https://claude.ai/artifact/CBCDtZjmsd9pFr5o8toUUV, a double
charge, found and refunded) and §385 (https://claude.ai/artifact/QNSBdd8xbeqGysxH7mTw5y, the guard rails).
**Project index:** https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp (source `PLATFORM_ADMIN_SUPPORT_CONSOLE_INDEX.html`,
db-backed: news is a data write, never a republish).
**Kickoff artifacts:**
- The walk: https://claude.ai/artifact/2sNNCtRUJWi9PSE1QDmCDq (`PLATFORM_ADMIN_SUPPORT_CONSOLE_WALK.html`)
- The end state: https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g (`PLATFORM_ADMIN_SUPPORT_CONSOLE_END_STATE.html`)
- Captures, the capture script and the render check are in `.probe/pasc/`.

**PM brief:** `PLATFORM_ADMIN_SUPPORT_CONSOLE_PM_BRIEF.md`.

## The owner's ask

2026-10-10: *"reformat and reorganize platform admin to be more user friendly to the different business use cases and
user types that exist on the support team (i.e. troubleshooting technical issues, marketing resources,
plan/subscription modifications, user/org subscription observability and editability, etc.). part of the project
should making the design more of a warm theme like the rest of the app and then go section by section analyzing the
design/ux so I can do a serious review and testing to ensure they fit my needs."*

2026-10-24 adds:
- **Two walks.** Walk A by support role, and Walk B by intent, click by click.
- **The owner's three required tasks:** a double billing, activating without charging for a period, and server status
  and API errors.
- **Formatting follows the client portals' path.**
- **Company accounting gets a LATER stage:** a usability review once `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` is complete.

## What exists (re-verified against the code 2026-10-24)

- **36 `page.tsx` under `app/platform-admin`, counting sign-in.** Two are redirect stubs (`/plans` and `/stripe-prices`
  go to `/plans-pricing`). The sidebar (`PlatformAdminNav.tsx`) has 19 entries in 7 data-named groups. Bookkeeping is
  its own last group, gated by an email allowlist (`lib/bookkeeping-access.ts`), not a role. Committed in `76f012fe3`.
- **Six roles** (`lib/platform-auth.ts:10`): super_admin, support, billing, product, growth, read_only. Two permission
  systems run side by side:
  - the area matrix `PLATFORM_AREAS` (`lib/platform-areas.ts`), used by the nav and the pages;
  - legacy `ROLE_PERMISSIONS`, used by most APIs.
  - **They disagree on Organizations:** the matrix says `writeRoles: []`, but support, billing and product all write
    there through the legacy permissions. So the nav cannot mark orgs as view-only for growth and read_only.
  - Bulk operations check per operation type (`bulk-operations/route.ts:83-104`), so product cannot bulk-change plans.
  - `proxy.ts` checks for a session only; every role check sits in the layout, the pages and each API.
- **Look:** its own dark console. `CoachThemeColor fixed="dark"` sits in the layout, and K-10 keeps the data face.
  `NAV_STANDARD.md` exempts it. It uses no admin kit. The old-look baseline holds 0 platform files, so any
  `[data-admin-kit]`-scoped CSS there would fail the gate.
- **No global search.**
  - Customer Users loads `listUsers({page:1, perPage:1000})` (`customer-users/page.tsx:51`), so it silently caps at
    1,000 accounts.
  - Organizations filters name and slug client-side only.
  - Nothing searches a Stripe id or card digits.

## Kickoff findings (detail and captures in the walk artifact)

**Task 1, double billing.**
- The org record shows only our columns (plan, status, period end, the Stripe ids). It shows no charges, invoices or
  events, and makes no Stripe read anywhere in the platform admin.
- A refund happens in Stripe and leaves no trace on our side.
- `platform_audit_log` has no reason column (`lib/platform-audit.ts`): the reason is stuffed into `new_value`, and
  override revoke and the add-on toggle record none.
- The path is about 14 clicks, with a trip out to Stripe.

**Task 2, free for a period.** There are four mechanisms and none does the job whole:
- **A plan change** (`orgs/[id]/plan`) is permanent, and the UI calls it a "free comp".
- **Overrides** (`org_overrides`, `lib/entitlement-grants.ts`) revert at read time with no cron, but cover only
  `module_addon` and `subscription_status`. They are inert unless `ENTITLEMENT_GRANTS_ENABLED==='true'`, and that is
  unverified on prod. Apply has no confirm step.
- **`comp_period`** grants nothing; it is a label.
- **Founding Season** sets `plan_id` and `current_period_end`, and nothing turns it off
  (`founding-season/page.tsx:20-27`).
- The customer never sees an override's end date.

**Task 3, status and API errors.**
- Observability reads only the app's own `error_events`, `error_groups` and request rollups.
- `scripts/stack-health.mjs` writes to `.health/` on the owner's PC, and nothing in `app/` reads it.
- Builds, the DB and raw logs live in the Amplify, Supabase and CloudWatch consoles: 5–6 places in all.
- The coverage caveat on Observability is stale: 546 of 581 routes are wrapped.
- The email in a sample event is plain text, not a link.

**Added tasks 4–12** (find by email, the subscription story, a mid-season plan change, can't sign in, a club's web
address, feedback reply, marketing resource, "I never got the email", setting up a club):
- **Bulk plan change drift:** `bulk-operations/route.ts:221-247` skips `applyPlanChangeSideEffects`, which
  `orgs/[id]/plan/route.ts:155` runs.
- **Account emails are unlogged:** `lib/email.ts` writes no log; only campaign sends are recorded, in `email_sends`.
- **Feedback has no reply.**
- **No platform view of club domains or the Amplify quota.** The `'limit'` refusal is never produced.
- **Two orphaned APIs:** `plan-config` and `plan-gating`.
- **"Use 9999 for unlimited"** is shown on the plan form.
- Pitch Deck Studio is a 12,300 px composer.

**Club release jobs** (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`):
- A Club exists only by an operator plan change (H02).
- H03: `addons/route.ts` checks nothing, and the overrides list omits `module_families`.
- 4e is self-serve with no platform view.
- The support posture runbook is still to write.

**Earlier issues re-checked:**
- **Fixed:** H2–H6, H14, M1, M2, M5. H3 and A.2 (the program doc wrongly lists them as unbuilt gaps).
- **Still open:** H8b (the price guard has zero callers), M3, M4, M6, M7 (the 1,000-user cap), and the server-side
  past-expiry check.
- **Never walked:** Retention, the Founding desk, Feedback escalate, Export registry, Email templates, Pitch Deck
  Studio, visits, Bookkeeping.

**Found on the way:** the dev error list holds a ReferenceError on `/platform-admin/bookkeeping`, 4 occurrences. It
belongs to the bookkeeping session.

## Standing rules every stage builds to (R1–R8)

- **R1** One place to find a customer.
- **R2** A record reads first and edits whole.
- **R3** Every live change confirms in one sentence.
- **R4** Every change records who and why, with the reason in its own column.
- **R5** Undo is "Put it back" from the story, never for anything that reached Stripe or an inbox.
- **R6** A read-only section shows as a record without controls, and the menu marks it.
- **R7** The money truth is shown, never remembered.
- **R8** Plain words, in the product's look.

## The stage ladder (order after S1 = owner's Q3)

| Stage | Covers | Shared changes / owner steps |
|---|---|---|
| S1 Warm foundation — **BUILT 2026-10-24, walk §371 owed** | Kit, Warm / Dark, `NAV_STANDARD` in full, the 1200 frame, type ladder, words. No job changes | F1 + D1–D5. Shared: `admin-kit-switch-guard` must allow the platform shell. `NAV_STANDARD.md` drops its platform line. K-10 and the "operator shells stay dark" log line retired. Console CSS written as plain rules, so the old-look gate stays at 0 |
| S2 Find, menu, Today, record — **BUILT 2026-10-25 on dev, walked 2026-10-25 (§377, 60 of 60, all calls accepted)** (drawings Ub7fXLh29SC34Zp4oqKUx1, walk GqozHVh1Bg2FLqSKEM78Xs) | Global Find (server-side, no 1,000 cap), menu by job, one rulebook (matrix = APIs), Today, a record with Story; a person record (new) | Find is a new read surface: drawn and reviewed as a security change. No proxy change. One migration: the read-only lookup over sign-in records |
| S3 Money — **BUILT + COMMITTED 2026-10-26 (`270211ca0` · `4bfc9ca41` · `6c6d0da7e` · `d77ee9da9` · `e764efd90` · docs `bc9616345`); walks §384 + §385 owed; mig 380 prod at release** (DRAWN + RULED 2026-10-26, all 12 as recommended; build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md`) (drawings FdTWB58ne1jgsBXSwutdLX, source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS.html`, captures `.probe/pasc/cap-s3/` via `capture-s3b.mjs`, render check `render-s3.mjs`; see "Stage 3 findings") | Stripe read on the Money tab, duplicate labels, refund (Q7), reason column in the audit log, bulk = single plan change (closed; the shared rule carries M6), M6 (widened: every staff plan change on a paying club) | Migration (audit reason + a refunds record + one running plan grant per club if ask 8). Adversarial review on the refund write. No webhook change unless ask 4 = B |
| S4b Coaches Portal free time — **PROPOSED 2026-10-25, not ruled** | A Premium Coaches Portal reads free time from the same door S4 builds (liveness today reads the portal's own record, which grants never touch), the door shown on a portal record, and the coach Founding comp moved with the Founding access step. Sequenced by dependency: after S4 is built and walked, and together with the Founding access move (Q4), because both change the portal's own billing record and the coach Founding audience (which today ends with no warning) | /billing (coach billing). Drawn first |
| S4 Free time — **BUILT + COMMITTED 2026-10-25 (`6c8f8fb89` · `5353f2cf3` · `e9bb0b059` · `a26ec5165`; finish pass `4071179f0` · `48205738a` · `7bc6b5441`), walk §379 owed** (drawings 5eawvGUPwQVPoWiAV7vQY5, all 11 as recommended; build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_BUILD_PROMPT.md`; mig 373 prod at release) | `plan_tier` grant (read-time revert, no cron) read through ONE effective-plan door with a build guard (Q1), one Give free time window, Founding as a group in a Free time list (view now, access at the Founding turn-off: Q4), customer billing page shows "Free through" (Q8), `comp_period` no longer offered (Q5), server-side past-expiry check | Prod `ENTITLEMENT_GRANTS_ENABLED=true` confirmed by the owner 2026-10-25. /billing for the customer pages and the effective-plan door. `proxy.ts` is one of the plan readers (its Tournament-tier redirect) |
| S5 Health | Status (reads on open), Errors restyled with a person link, Feedback reply, Sent email log + delivery callback | Read-only AWS + Supabase keys on prod (owner step). Q6: the stack-health summary, a shared automation change, own commit, only on the owner's word |
| S6 Club release jobs | Club web addresses list + quota, set up a club from a lead, H03 | Rides the Club release |
| S7 Growth & product | Leads, Campaigns, Pitch decks list, Plans & pricing, Approval queue, Templates, Export registry. H1 | — |
| S8 Records | Staff + roles (Q1, M3), audit search server-side (M4), Help | A role change is a security change, drawn first |
| S9 Company accounting review | The two walks over Bookkeeping: record a purchase, find a receipt, correct an entry, a period's spending, the accountant's package | Trigger (owner, 2026-10-25, R9 in `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` §11): **S9a** after the first real expense-and-owner close has been handed to the outside accountant; **S9b** after the first full month with live Stripe income has been closed |

Open TODO lines:
- **In:** timed grants (S4, with the tier trial), and observability and feedback screens (S5).
- **In as a rule:** "shown vs enforced".
- **Out:** H8 price guard, handed to /billing.

## Owner rulings 2026-10-24 (paste-back from the end-state artifact; recorded as ticked, nothing added)

- **Q1:** menu by job, roles trim it. *M3 (billing loses support's account powers) was not ticked: open.*
- **Q2:** confirm + reason on every live change; Put it back for plan, limit, section and free time.
- **Q3:** S1 → S2 → S4 → S3 → S5 → S6 → S7 → S8 → S9.
- **Q4:** desktop only; Status and Today readable on a phone.
- **Q5:** timed grants in, whole plan, Founding Season folded in. *Observability + feedback screens, shown-vs-enforced as
  a rule, and H8 to /billing were not ticked: open.*
- **Q6:** "dev servers" = the deployed sites, their builds and the databases. *Whether Status shows the morning check's
  result (a stack-health change) was not ticked either way: open. Nothing is wired until the owner says yes.*
- **Q7:** refund from the console; credits stay in Stripe.
- **F1:** retire K-10, the "operator shells stay dark" line and the nav-standard exception; the sign-in page follows.
  Logged in `memory/design_decisions.md` 2026-10-24. The doc lines themselves are edited when S1 ships.
- **D1–D5:** all five as the design pass recommended (logged with F1).
- **Found on the way:**
  - Fix the bulk plan change now. **Built 2026-10-24:** one shared rule (`lib/operator-plan-change.ts`), called by
    both the single-org save and Bulk Operations. The bulk screen's copy names the follow-on steps, and each org's
    result line reports them. A guard test in `club-stage1-server-guard.test.ts` fails if either route repeats a step.
  - *The production grant-switch check and passing the Bookkeeping error on were not ticked: open.*

**Open, to ask again:** M3, the rest of Q5 and Q6 were ruled 2026-10-25 (below). Still open: the prod
`ENTITLEMENT_GRANTS_ENABLED` check (the owner does it before S4) · the Bookkeeping page items for that session. The dev ReferenceError is one. The other: its
`bookkeeping.module.css` mints three off-ladder table sizes (.58rem, .61rem), which fail `table-recipe-guard.test.ts`.

## Owner rulings 2026-10-25 (Stage 2 drawings; "I agree with all of your recommendations")

All eleven asks as recommended; the full wording is in `memory/design_decisions.md` 2026-10-25 "SUPPORT CONSOLE STAGE 2".
- **A1 (M3, now closed):** Billing loses Support's account powers; Billing keeps feedback triage (F3).
- **A2:** Find follows the one rulebook; Stripe numbers for Super admin, Billing, Support.
- **A3:** a trail of records opened, not the words, 90 days, Super admin reads it.
- **A4:** the Story ships now with a "not in it yet" line; purchases come with S3.
- **A5:** every real queue plus new errors and new feedback; nothing invented.
- **A6:** one pencil for the whole record; the check mark confirms in one sentence and asks why.
- **A7:** the names as drawn. **A8:** both lists stay; People rows open a new person record.
- **A9:** Q5's rest all in (observability and feedback screens, shown-versus-enforced as a rule, H8 to /billing); Q6
  Status shows the morning check, decided at S5; the owner checks the prod timed-grant switch before S4.
- **A10:** charge numbers in Find wait for S3. **A11:** a folded menu group shows the sum of its counts.

**Still open:** the Bookkeeping page items for that session (unchanged from 2026-10-24). The prod
`ENTITLEMENT_GRANTS_ENABLED` check is done: `true` on AWS, confirmed by the owner 2026-10-25.

## Owner rulings 2026-10-26 (Stage 3 drawings; paste-back, every recommended box ticked)

All twelve as recommended; the full wording is in `memory/design_decisions.md` 2026-10-26 "SUPPORT CONSOLE STAGE 3".
- **Q1:** Super admin + Billing refund; never own club (wide check, free time too); no dollar cap; older than 6 months or a
  6th refund in 24h needs Super admin; Support reads.
- **Q2:** all or part; original card only; several parts up to the charge.
- **Q3:** Stripe receipt only; owner confirms the Refunds switch is on in prod; no email from us.
- **Q4:** A: read Stripe live; our own entries always show.
- **Q5:** Stripe numbers + invoice number; no card digits; one line says so.
- **Q6:** reason required on every staff change; product jobs none; copy old reasons into the column; "Not recorded".
- **Q7:** the bulk Subscription status override follows free time's rules (end required, 6/12-month cap, never own club,
  server-enforced).
- **Q8:** the double plan grant fix rides Stage 3's migration.
- **Q9:** refuse a staff plan change while a live Stripe subscription runs; one line says why.
- **Q10:** Cancelled + Trial everywhere a person reads them; one renewal label set; Billing status; gated.
- **Q11:** D-1 and D-2 as recommended.
- **Q12:** Field moves into the audit entry window with the values.

**Build prompt written 2026-10-26:** `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md`.

## Owner rulings 2026-10-25 (Stage 4 drawings; paste-back, every recommended box ticked)

All eleven as recommended; the full wording is in `memory/design_decisions.md` 2026-10-25 "SUPPORT CONSOLE STAGE 4".
- **Q1:** one door for the plan right now, every reader on it, build-enforced.
- **Q2:** Super admin + Billing; always ends; Billing 6 months, Super admin 12; never your own club.
- **Q3:** refuse a plan grant while Stripe charges; sections and status stay.
- **Q4:** fold in the view now; move Founding's access when the turn-off is decided; no bulk end.
- **Q5:** stop offering comp period now; existing rows read as they are.
- **Q6:** change the running grant's end date; the Story says from what to what.
- **Q7:** one queue, Free time ending, 14 days, counting clubs.
- **Q8:** billing page only, three states, worded Free through {last free day}, everywhere.
- **Q9:** refuse: the server and the window both say it is switched off.
- **Q10:** no free time on a Coaches Portal in Stage 4; the door is absent there.
- **Q11:** D-1 to D-4 as recommended.

**Asked with the rulings, answered as a recommendation (not ruled):** when free time for a Premium Coaches Portal comes.
See the ladder row "S4b".

## Owner ruling 2026-10-26 (S4b, conversation; recorded as said)

- **Sequence:** agreed as recommended: Stage 3, then Stage 5, with S4b slotted ahead of the Founding turn-off deadline.
- **Support WILL be able to give a coach free time.** The main use the owner expects: a coach who came in by being
  claimed onto a tournament team, got the free (Basic) Coaches Portal, and wants to try the Premium one. Support says
  "I'll convert your free portal to Premium for 30, 60, 90 days" and it goes back on its own.
- **The owner's requirement:** the two portals are built differently in the back end, so going from Basic to Premium
  and back must be efficient **without compromising the coach's data**.
- Not yet ruled: the shape of the lengths (fixed 30/60/90 or any date), who may give it and the cap, what the coach is
  told, what "back" looks like when the coach has built things on Premium. These are the S4b drawings' asks.

**S4b findings (helper census 2026-10-26; the lines marked ✔ were reopened by hand, the rest are leads to re-verify
before drawing):**
- ✔ **Basic → Premium today is a one-way COPY.** The Basic team's rows stay; a Premium workspace is made and the roster,
  schedule and fees are copied in once (`provisionStandaloneTeamWorkspace` → `migrateBasicTeamIntoWorkspace`,
  `lib/coach-upgrade-migration.ts`). An atomic claim (`basic_coach_teams.team_workspace_id IS NULL`) makes exactly one
  copy happen per Basic team, ever. Announcements are not copied.
- ✔ **While Premium is live, the Basic pages redirect to Premium** (`lib/coach-team-page.ts`); when the workspace is
  `canceled` the Basic team is usable again.
- **There is NO reverse copy.** Work done on Premium during a trial never returns to Basic. Basic's rows are the
  pre-upgrade ones. (helper; re-verify)
- **The only existing "back" is the cancel path**, which archives hosted tournaments and tags records for retention:
  wrong for a trial. Staff cancel updates only the org row, not the workspace or entitlement (an existing inconsistency).
- **Three liveness sources must agree** (org status, workspace status, team entitlement + `ends_at`); nothing enforces
  `ends_at`/`current_period_end`, and nothing runs at an end date.
- **Basic write APIs may not refuse while Premium is live** (only the pages redirect): re-verify.
- The first trial would use the existing copy; a SECOND trial or a later real upgrade must reuse the same workspace
  (the claim guard prevents a second copy, and one live portal per owner).

## Stage 3 build gate (2026-10-26)

The build prompt's §6 gate, run before any code: §4 re-verified (all rows held; "Not recorded" and the "not in it yet" line
live in the record screen, not the Story builder), five censuses (audit writers and readers, the plan rule's callers, every
status/renewal label, every window foot), Stripe's current docs, `/billing` and `/marketing`, then four owner calls.
- **Owner calls (2026-10-26):** (1) **Reason required on customer changes only** — every change to a customer's club, person,
  plan, money or retention, and refunds; the console's work tools (notes, decks, campaigns, triage, lead edits) write none and
  read "-"; staff roles get a reason when Stage 8 draws Staff; catalog approvals' change note fills the column. Q6's premise
  ("every staff route since Stage 2 asks") held for customer changes only — ~25 staff writes never asked. (2) **Q8 as an
  exclusion rule** (`btree_gist`), not a unique index (a grant that ran out by itself keeps `revoked_at` null). (3) The
  read-only overlap check on dev **and prod**: none on either; prod holds no `plan_tier` rows at all. (4) **Stripe's Refunds
  email is ON in production** (Q3), so the sentence names the receipt.
- **The console key:** Stripe grants refunds only with charge writes (one "Charges and Refunds" permission), and the console
  already cancels subscriptions and deletes customers: the full key stays (T23); no Amplify env var.
- **`/billing`:** refund the charge directly (no credit note); the invoice stays paid and nothing else moves (Stripe states it
  for neither — the walk checks it in test mode); the 6-month rule on Stripe's `created`; G 10's sentence as drawn; ours-vs-Stripe
  compares the plan the club PAYS for, free time named on our side only.
- **`/marketing`:** Cancelled / Trial approved; the receipt clause names the address ("Stripe emails a receipt to …"); help's
  hidden search synonym `canceled` stays (Q10 is "where a person reads"), gate case-sensitive.
- **Found on the way:** a Coaches Portal the club pays for bills on the club's OWN Stripe customer as a second subscription —
  named as the club's (never "two live subscriptions", never "shared"); Q9 narrowed to what Stripe overwrites (plan and
  tournament limit) so a Club · Association custom team limit still saves.

## Stage 3 threats → guards (the build, 2026-10-26)

All 23 of drawing H, each in `tests/unit/support-console-stage3-guard.test.ts` ("13 · the 23 threats" holds the map):
T1 the power before any read · T2 the wide own-club check (`lib/staff-own-club.ts`, free time and Bulk adopt it) · T3 seen on
the Story and the audit Reason · T4 Billing's 6 months and sixth-in-24 h · T5/T6 ownership on every read (`ownsObject`: exactly
this club's non-shared customer, same mode) · T7 one key = our record id · T8 recovery lists, never re-sends · T9 one unfinished
refund per charge (partial unique index) · T10 our record first or Stripe is never asked · T11 unknown is never done · T12 no
refund messages (Q4 A); the Story de-duplicates on the refund number · T13 reason required, Luhn refused · T14 metadata holds no
words · T15 no card data written · T16 Stripe's text never kept · T17 never `fraudulent` · T18 no webhook change · T19 Q9 in the
one plan rule · T20 Find shape-checks before Stripe · T21 no Stripe call for a role without the power · T22 mode on every read ·
T23 the full key stays (above). Proven on dev in rolled-back transactions: the refunds guard (frozen request, forward-only,
one open per charge, released by not made, never `fraudulent`) and the plan-grant rule (overlap refused; after a ran-out grant
allowed).

## Stage 3 finish review (2026-10-26: simplify, high-risk review, help, strategy)

`/simplify` (four lenses): one refund-door rule for the table, the window and the server; the paying-club rule and sentence in a
plain module; the own-club check batched for Bulk; one Stripe read per visit; house helpers reused. `/review` (five lenses,
high-risk, money lens). **Fixed:** a cancelled club moved to the free plan kept its dead subscription link as "active" and was
refused every later plan change (and a missed webhook did the same) — Stripe is now asked before refusing, and the free plan
drops only an ended link; a lost answer read "Nothing was sent to Stripe" — now "may or may not have gone through"; refund
reasons reached Product/Growth/Read only in the audit log and export — hidden for them; the refund's time budget could outlast
the route; a refund finished since the person's read could pass the "it changed" check — Stripe's remainder is read again
after our record holds the charge; a gateway's 4xx counted as Stripe's no; Find failed whole when Stripe did; two openings
recovered one refund twice; smaller screen fixes. **Reported, not changed (owner calls, none urgent):** two refunds by one
Billing person at the same instant can make six in 24 h; a refund Stripe accepts and later fails is recorded done (the charge
window reads Stripe's status); zero-decimal currencies would display wrongly (clubs bill in CAD); the card-number check can
refuse a 20+ digit order number; Stripe down skips the customer-email part of the own-club check for free time and Bulk
(documented; the owner email still runs); pre-existing — the console's cancel marks the club cancelled before Stripe confirms;
the pencil hides the plan field on a club our record says Stripe bills even when Stripe already ended it (Bulk and Put it back
ask Stripe). `/strategy`: refund authority logged Decided; `PLAN_PRICING_FACTS.md` needs nothing. `/billing` drift: none.

## Stage 4 build gate (2026-10-25)

The build prompt's §6 gate, run before any code. Census (a helper, every cited site reopened by hand where it decides
anything), `/billing` and `/marketing` consulted, then four owner calls.
- **Owner calls (2026-10-25):** (1) `proxy.ts`'s Tournament-tier bounce is **deleted** (the org-admin layout is the
  guard and reads the door; saves a query per club-page request). (2) **Tournament fees post to the club's Accounting
  book during free time: a migration** (an effective-plan SQL helper the four fee-book checks call), against
  `/billing`'s "accept the gap". (3) The customer's page shows **whole-plan grants only**, as drawn. (4) The amber
  last-14-days band **warns** when the club will hold more than its own plan allows.
- **`/billing` (gate):** limits = the given plan's, raised by the club's own when higher (tournament: max of the given
  plan's and the club's own effective limit, never the stored value through the given plan; team: the given plan's
  band, raised by the stored override). Effective plan = the higher rank of own and given; a tie is own. **Every billing
  action reads the club's own plan** (checkout, move, downgrade, cancel, next-season choice, preflights, upgrade lists,
  plan events); access reads the effective plan. Reading the effective plan in downgrade/confirm would let a free club
  on a Club grant keep Tournament Plus for good. Club's page hides Payment method, Move and Reduce or cancel while Club is
  free; Club is not self-serve, so its amber state offers the page's Contact us, not "choose it below". Metrics, the
  Founding email audience and "card payment failed" read the stored plan/status on purpose.
- **`/marketing` (gate):** the undrawn strings (per own plan, amber, ended, the Billing card, last day / 1 day);
  "Tournament Plus's own tools" broke the possessive rule and became "the tools that come only with Tournament Plus".
- **Owed to `/strategy` (not blocking):** a PLAN_PRICING_FACTS line for operator free time; a Club grant followed by the
  full Club trial (moot until Club is on sale).

## Stage 4 threats → guards (the build, 2026-10-25)

Every threat in the drawings' Money and safety list, and what stops it. Unit tests are in `tests/unit/`.
- **T1** own club — `decideGive` refuses by membership (any role or state), read on the server; `free-time-give` "a club the
  staff member belongs to". **T2** a friend's club — no technical guard can know friends; every grant shows on the Story,
  the Given by staff view and Today, with giver and reason; the cap bounds one grant. **T3** a role without the power —
  every route checks `club_billing` first (`free-time-give` "the routes"); `decideGive` refuses a role with no cap too.
- **T4** never ends / past cap — `lastDayRefusal` (no day, a day not after today, Billing 6 months, Super admin 12) for
  every kind. **T5** the wrong day — the server takes `YYYY-MM-DD` only and ends it at midnight Eastern
  (`endInstantForLastDay`); an instant is refused. **T6** around Stripe — a plan grant refused while a live subscription
  runs; billing actions read the own plan (`plan-reader-door-guard`).
- **T7** many at once — no bulk grant; comp period gone from Bulk changes. **T8** switch off — the server refuses, the
  record shows a red line, the list a red line; grants simply stop applying (`free-time` "the switch off"). **T9** an ended
  grant read as running — one door, read at the moment of reading; the census guard fails on a new raw read; a stale tab
  can show, never do (every write re-checks on the server).
- **T10** Put it back to lengthen — on "given" it only ends; on "changed" it restores the earlier day under the same cap,
  or ends now when that day has passed (`free-time-story`). **T11** two at once — compare-and-set on the end
  (`free-time-story` "compare-and-set"). **T12** a demo club — refused. **T13** a parked plan — only Tournament Plus,
  Club, Club · Association; the fold ignores any other. **T14** an empty reason — required on give, change and end.
- **T15** the customer reads staff notes — the customer route returns plan, last day, own plan, over-limit and Founding's
  day only (`free-time-surfaces`). **T16** the wrong club — the club is the address's id, never the body. **T17** a browser
  reads grants — `org_overrides` stays server-only; the customer reads through its route.

## Stage 4 finish review (2026-10-25: simplify, high-risk review, help, strategy)

Five read-only lenses (the access door; billing actions; write rules and time; SQL fold vs TS fold; customer and console
surfaces), each finding reopened by hand. Deterministic gate: typecheck clean on these files; the door guard, the 62 Stage 4
tests and the spelling and dictionary checks pass; the read-only smoke probe passes against the running dev server. The
suite's other reds are other sessions' (migration table grants, team move, possessive, reference shape, search side, the
coin toss, family email senders, the bookkeeping css clashes, one house-league route type error).

**Fixed (`4071179f0`):** a cancelled club that holds free time was offered Reactivate for the free plan, not its own (both
billing pages); the grants lookup sent up to 2,000 ids in one request and dropped its own errors (now chunks of 100, a failed
read is logged); changing an end date could revive a grant that ran out between read and write; End it now stamped an
already-ended grant "ended early".

**Reported, not changed (owner calls, none urgent):**
- **Two staff giving a plan at the same instant can both pass** (Medium): no unique rule on running plan grants, so the
  Story could show two. Access stays sane (newest wins). Fix is a partial unique index (a migration).
- **The fee book's SQL cannot see the `ENTITLEMENT_GRANTS_ENABLED` switch** (Medium): with the switch off the app ignores
  every grant while fees still post to the Accounting book for a club holding free time. Matters only if the switch is used as
  a kill switch; document it or pass the switch in.
- **Billing actions still read the door's billing status** (Low-Medium, design): a billing-status grant makes a cancelled
  club read as active in the checkout, move and cancel preflight code; there is a plan twin (`ownPlanOf`) but no status twin.
  The console decides whether a status grant may be given to a cancelled club.
- A club that buys its own plan while free Club time still runs sees "Free through" and no Payment method, Renews or Cancel
  until the free time ends; the cancel review's "shuts down" list can name sections held only as free time; a plan grant is
  not refused by a legacy plan row without an end date; the club record sends every override's reason and giver to every
  console role that can open Clubs (staff only); the customer free-time route needs membership but not an admin role (a
  deliberate exemption in the billing access guard); the fee-book SQL accepts a non-array `addons` value (hand-edited rows
  only).
- Known and unchanged: `cancel/confirm` has no server guard for a club with nothing to cancel; Bulk changes' Subscription
  status override takes an optional end with no cap (walk call 14 asks the owner).
- Help: the Bulk changes guide still lists Comp period (the product no longer offers it); the line sits beside another
  session's uncommitted rename of that section, so it is left for that session.

## Stage 3 findings (verified against the code and Stripe's docs 2026-10-26, before drawing)

Four helpers read the code and one read Stripe's current docs (stripe-node 22.1.0, API `2026-04-22.dahlia`); the lines each
drawing turns on were opened by hand.
- **M6 found and widened.** Origin: `docs/projects/archive/PLATFORM_ADMIN_WALKTHROUGHS.md:49` ("Setting a plan to Coaches
  Portal doesn't clear the old Stripe link"); the UX eval's M6 (contextual help) is unrelated. `applyOperatorPlanChange`
  (`lib/operator-plan-change.ts`, callers: plan, bulk-operations, put-back, record routes) writes `organizations` only and
  never calls Stripe; only a move to `tournament` clears `stripe_subscription_id` (and leaves the Stripe subscription
  charging). The webhook (`app/api/billing/webhook/route.ts` ~364-384) overwrites `plan_id`, `tournament_limit`, status and
  the subscription id by `stripe_customer_id` on every subscription event, so the staff change is silently reverted at the
  next renewal. Nothing refuses a staff plan change on a club with a live subscription. → **ask 9** (refuse inside the shared
  rule, any uncancelled subscription id regardless of status; Bulk skips with a reason line).
- **We keep no charge, invoice or payment of a club's subscription** (only `cus_`/`sub_`, plan, status, period end).
  `online_payments` (family rail, dev only) keeps its own `pi_`/`ch_`. The end state's "We recorded" column cannot be
  honest; the R7 comparison is at the subscription.
- **Purchases are already recorded:** `subscription_started` and `plan_upgraded` are written to `platform_events`
  (`writeGrowthEvent`); the Story filters them out (`lib/platform-story.ts` ~76-78 reads only downgrade, cancel, past due,
  recovered). Purchases join the Story with no migration and no webhook change.
- **The webhook handles no refund event** (`charge.refunded`, `refund.*` fall through to `ok`); a refund changes no plan.
  No event-id idempotency table for this webhook. → ask 4.
- **Audit log:** no `reason` column (both snapshots); 70 writer calls + 1 direct insert; 21 keep a reason in `new_value`.
  `writePlatformAuditLog` swallows its own errors. **The prompt's "override revoke and add-on toggle record none" is out of
  date:** both require and keep a reason since Stage 2 (`lib/club-record-changes.ts` 123, 148); only pre-Stage 2 rows lack
  one. The Story already shows "Not recorded". → ask 6.
- **Powers:** no refund power; `find_stripe` (super_admin, billing, support) already gates Stripe reading (A2).
- **Own-club check is narrow:** `staffBelongsTo` (`lib/free-time-writes.ts:91`) reads `organization_members` only; misses team
  staff, Coaches Portal owners/billing owners, pending invites, a staff email equal to the owner/customer email. Free time
  (Stage 4) has the same gap. → ask 1 (one wider check, free time adopts it).
- **Double plan grant race confirmed:** no unique index on running `plan_tier` rows in `org_overrides`. → ask 8.
- **Bulk Subscription status override:** "Optional expiry", no cap, past dates accepted, no own-club refusal, up to 100
  clubs. → ask 7.
- **Facilitated Payments** = families paying a club on its Connect account; a club's subscription never runs on it.
- **Labels:** "Canceled"/"Cancelled" split on the record and on the two customer billing pages and emails; six renewal
  labels; five names for billing status; "Trialing" vs "Trial". → ask 10.
- **Stripe docs (2026-10-26):** refunds only to the original payment method; partials until fully refunded; no card age
  limit stated; idempotency keys pruned after ≥24 h (so recovery must list refunds, never re-POST); refund receipt emails
  only if the dashboard's Refunds switch is on (owner must check prod); Search can match `payment_method_details.card.last4`
  (the end state said it could not), ~1 min behind, 20 req/s; restricted keys exist (whether refunds can be granted
  without charges is unverified).
- **Captures:** the probe session had expired and the dev server sat at ~4 GB; captures were retaken Warm only, one page at
  a time, with a wait for the sign-in page to hydrate (`capture-s3b.mjs`).

**Asks (owner, owed):** 1 who refunds + cap + wider own-club check · 2 all or part · 3 does the customer hear (Stripe's
receipt; prod switch to confirm) · 4 Story source (live read vs keep events) · 5 Find and card digits · 6 reason column
required + old rows · 7 bulk status override follows free time's rules · 8 the double grant rides this migration · 9 M6
widened: refuse · 10 one spelling (Cancelled, Trial, Billing status, renewal labels) · 11 D-1 red for refusals, D-2 heading
rule · 12 Field leaves the audit table too. **Owner direction 2026-10-26 (in the session, before the paste-back):** the audit
log's Old value and New value leave the table for the entry window (raw data, a "more details" item, never filtered or
searched); the export keeps every column. **Owner direction 2026-10-26: a window's foot sentence must not ship unformatted
again** (the 2026-10-25 defect, fixed in `9c1545220` for a CLASSLESS span/p in KitDialog's `footerStart` only). Found:
the console's `RecordWindow` passes its `footNote` with `record.module.css .footNote` = `--type-body` (14px) tertiary,
not the kit's `--type-support` (12px, as `RepKit .footNote` and the 10-25 rule); every console confirm/free-time window,
and so the refund windows, inherit it. The build owes: `.footNote` onto the kit face, and a guard that every text in a
console window's `footerStart` is classless or wears a foot-note class at the support size (the 10-25 fix has no test).
Kickoff Q6 (Status shows the morning check) does not bear on Stage 3; it stays for S5.

## Stage 4 findings (verified against the code 2026-10-25, before drawing)

Four helpers read the code; the lines each drawing turns on were opened by hand.
- **A whole-plan grant reaches nothing today.** `applyEntitlementGrants` (`lib/entitlement-grants.ts`) folds only
  `module_addon` and `subscription_status`, and `planId` + both limits are computed from the raw `plan_id` BEFORE it runs
  (`lib/api-auth.ts` ~194). Only three paths apply grants at all (`getAuthContext`, `getOrganizationBySlug`,
  `getOrganizationBySlugForServer`). About twenty read the plan around them: `proxy.ts` (the Tournament-tier redirect
  away from `/admin/org/*`), register, chat, team transfer, venue lookups, family access, needs-attention, team checkout,
  user contexts, invite acceptance, notification prefs, `notify`/`fan-notify`, directory + sitemap, fan follows, scores
  feed, `CoachTournamentRecord` (a browser query). `OrgProvider` holds the plan for the life of a layout. The POST route
  refuses `plan_tier`; the DB CHECK allows it. → **Q1: one effective-plan door, every reader on it, build-guarded.**
- **Founding Season is not a grant.** Access = `plan_id='tournament_plus'` + `current_period_end` written on the org
  (`team_workspaces.billing_mode='platform_override'` for a portal); the `comp_period` row only marks the cohort by an
  exact expiry match (`FOUNDING_SEASON_COMP_EXPIRIES`). Nothing ends it (desk page header). The turn-off is the Founding
  plan's Phase 3, due May 2027. Dev: 5 accounts, one on the Legacy 2026-12-31 instant, one (`test-minor-softball`) marked
  Founding on the free plan. → **Q4.**
- **`comp_period` grants nothing**; ~30 read/write sites, nearly all Founding. Bulk operations offer it with any expiry.
- **Stripe overwrites** `plan_id`, both limits and status on every subscription event (`webhook/route.ts` ~373). → Q3.
- **Expiry:** checked in JS only on the three grant paths (`isOverrideActive`, end exclusive); the founding-status
  route's `.gte` is inclusive; writes accept any `expires_at`, past included, no cap, built in the browser's time zone
  (`ClubRecord.tsx` ~804). No self-grant guard. `suppress_billing` is stored and read nowhere.
- **Switch off:** writes still succeed and the console shows them running; the flag is fixed at build on prod
  (`amplify.yml`). → Q9.
- **Today's "Overrides ending" is 14 days, not 30**, and counts override rows while its list counts clubs. → Q7.
- **A Coaches Portal grant would not open the portal**: liveness reads `team_workspaces`, which grants never touch. → Q10.
- **The customer already reads "Free through September 30, 2027"** (Founding copy); the console says "Until Oct 1,
  2027" and the band "Renews Oct 1, 2027"; the desk's Free through column says Oct 1. → Q8, one phrase.
- `org_overrides` has RLS on with no customer policy (server-only); the design keeps it so.

## Questions as asked (kept for the reasons behind each recommendation)

1. **Q1** Who does support, and should the menu follow the task, the role or both? Rec: both (menu by job, roles trim
   it). Decide M3 (rec: billing loses support powers).
2. **Q2** What needs a confirmation, a reason, an undo? Rec: confirm and reason on every live change; Put it back for
   plan, limit, section and free time.
3. **Q3** Order after S1. Rec: S2 → S4 → S3 → S5 → S6 → S7 → S8 → S9.
4. **Q4** Phone? Rec: desktop only; Status and Today readable on a phone.
5. **Q5** Open lines in or out. Rec as above.
6. **Q6** "Dev servers" means what, and should Status show the morning check? Rec: the deployed sites, builds and
   databases; yes, via a stack-health change on the owner's word.
7. **Q7** Refund in the console or hand off to Stripe? Rec: refund from the console; credits stay in Stripe.
8. **F1** Retire K-10, the "operator shells stay dark" log line and the nav-standard exception. Rec: yes, the sign-in
   page included.
9. **D1–D5** (from /design: written rules that contradict each other):
   - D1: heading above the card.
   - D2: button tiers (white / lime / olive door).
   - D3: no compact-log exception. Times in the body face, codes in the data face.
   - D4: the nav standard in full.
   - D5: a form pick-one is a dropdown or radio rows.

   The same pass also notes that `TABLE_AND_LIST_STANDARD.md` §3.2's badge row still says chips are uppercase.

## Not in scope

Customer-facing screens, except the "Free until" line in S4, which is drawn first. Price, plan and gate changes
(`/strategy` decides). The marketing site.
