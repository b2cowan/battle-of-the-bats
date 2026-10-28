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
"Stage 3 build gate", "Stage 3 threats → guards" and "Stage 3 finish review" below. Ledger §384 (https://claude.ai/artifact/CBCDtZjmsd9pFr5o8toUUV, a double
charge, found and refunded) walked 2026-10-26: 44/44, all 9 build calls accepted (full Stripe key kept). §385 (https://claude.ai/artifact/QNSBdd8xbeqGysxH7mTw5y, the guard rails) walked 2026-10-26: 26/26, all 6 build calls accepted.
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
| S3 Money — **BUILT + COMMITTED 2026-10-26 (`270211ca0` · `4bfc9ca41` · `6c6d0da7e` · `d77ee9da9` · `e764efd90` · docs `bc9616345`); walks §384 + §385 both ✅ 2026-10-26; mig 380 prod at release** (DRAWN + RULED 2026-10-26, all 12 as recommended; build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md`) (drawings FdTWB58ne1jgsBXSwutdLX, source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS.html`, captures `.probe/pasc/cap-s3/` via `capture-s3b.mjs`, render check `render-s3.mjs`; see "Stage 3 findings") | Stripe read on the Money tab, duplicate labels, refund (Q7), reason column in the audit log, bulk = single plan change (closed; the shared rule carries M6), M6 (widened: every staff plan change on a paying club) | Migration (audit reason + a refunds record + one running plan grant per club if ask 8). Adversarial review on the refund write. No webhook change unless ask 4 = B |
| S4b Coaches Portal free time — **owner ruled YES 2026-10-26; DRAWN 2026-10-27; ALL 12 ASKS RULED as recommended 2026-10-27 (see "Owner rulings 2026-10-27 (Stage 4b drawings)"); build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_BUILD_PROMPT.md`** | A Premium Coaches Portal reads free time from the same door S4 builds (liveness today reads the portal's own record, which grants never touch), the door shown on a portal record, and the coach Founding comp moved with the Founding access step. Sequenced by dependency: after S4 is built and walked, and together with the Founding access move (Q4), because both change the portal's own billing record and the coach Founding audience (which today ends with no warning) | /billing (coach billing). Drawn first |
| S4 Free time — **BUILT + COMMITTED 2026-10-25 (`6c8f8fb89` · `5353f2cf3` · `e9bb0b059` · `a26ec5165`; finish pass `4071179f0` · `48205738a` · `7bc6b5441`), walk §379 ✅ (owner, in chat 2026-10-27)** (drawings 5eawvGUPwQVPoWiAV7vQY5, all 11 as recommended; build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_BUILD_PROMPT.md`; mig 373 prod at release) | `plan_tier` grant (read-time revert, no cron) read through ONE effective-plan door with a build guard (Q1), one Give free time window, Founding as a group in a Free time list (view now, access at the Founding turn-off: Q4), customer billing page shows "Free through" (Q8), `comp_period` no longer offered (Q5), server-side past-expiry check | Prod `ENTITLEMENT_GRANTS_ENABLED=true` confirmed by the owner 2026-10-25. /billing for the customer pages and the effective-plan door. `proxy.ts` is one of the plan readers (its Tournament-tier redirect) |
| S5 Health — **BUILT 2026-10-26 on dev (gate G1–G4 ruled; mig 389 dev; committed e0fc859d8 · ea0a5ff06 · 202cc2907 · 83b658dfb · df4cbfb7a · 806a477ef + help + fixes; all three walks done 2026-10-27: §391 31/32 https://claude.ai/artifact/8qgZHaUXyygTUssRxJ4dHz · §392 25/30 https://claude.ai/artifact/Rd7zbLU8X31somGq8d21dA · §393 37/44 https://claude.ai/artifact/VmRfEkbaGrMfvYSr8zoAQ5, no failures, 13 steps Held to the release)**; drawn + ruled 2026-10-26, build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_BUILD_PROMPT.md` (drawings BQmiMi3jXGKBwXQHr8UugB, source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_DRAWINGS.html`; see "Stage 5 findings") | Status (reads on open), Errors restyled with a person link, Feedback record page + Reply, Sent email log + delivery callback, a kind on every send | One migration (joins 365/367/373/380); Resend webhook + signing secret, AWS list-builds key and a scoped read-only Supabase token are release owner steps (`/release`). Morning check stays on the owner's PC unchanged (Q2 = B) |
| S6 Club release jobs | Club web addresses list + quota, set up a club from a lead, H03 | Rides the Club release |
| S7 Growth & product — **CHOSEN NEXT 2026-10-27 (owner); DRAWN 2026-10-27: https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM (source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html`); RULED 2026-10-27 (all eleven, every recommended box + Q4 C and D; "Owner rulings 2026-10-27 (Stage 7 drawings)"); build prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_BUILD_PROMPT.md` (Part 0, the Audit log fix, ships first on its own); findings in "Stage 7 findings"** | **Job (owner, 2026-10-27): a growth person can see where every lead lands, gets metrics on historical conversions, and can input information to track and improve future growth opportunities.** Leads, Campaigns, Pitch decks list, Plans & pricing, Approval queue, Templates, Export registry. H1. The prompt puts to the owner whether the catalogue four (Plans & pricing, Approval queue, Templates, Export registry) belong in this stage at all | A conversion history, a lead source and any public capture are asks; a daily snapshot would be a shared automation change (owner's word, own commit) |
| S8 Records | Staff + roles (Q1, M3), audit search server-side (M4), Help | A role change is a security change, drawn first |
| S9 Company accounting review | The two walks over Bookkeeping: record a purchase, find a receipt, correct an entry, a period's spending, the accountant's package | Trigger (owner, 2026-10-25, R9 in `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` §11): **S9a** after the first real expense-and-owner close has been handed to the outside accountant; **S9b** after the first full month with live Stripe income has been closed |
| S10 Plans & pricing — **LOGGED 2026-10-27 (owner), not drawn; the owner picks it up when ready, after S7; where it sits in the order is not ruled** (drawings prompt `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_DRAWINGS_PROMPT.md`; see "Stage 10 findings") | **Job (owner, 2026-10-27): change what we sell without a developer and without surprising a customer.** A guided price-change workflow (who is affected, the policy for existing customers, the new price created in Stripe, the customer notice, the timeline); trial periods added, changed and removed with what they apply to; a Stripe link the console can read, so a missing or wrong price is seen before a customer hits it; a "what changed and when" record; and a **checklist for adding a new plan, enforced by the build**. **Ruled OUT by the owner: a full plan builder** (adding a plan stays a code change; the checklist makes it hard to get wrong). Takes over S7's catalogue four (Plans & pricing, Approval queue, Templates, Export registry) if the owner rules S7 ask 1 = A, plus the old H8 price guard | /billing (the rules), /marketing (the customer notice and the pricing words), /strategy (the policy decisions are business decisions: log them). Any Stripe write is a new capability for the console's key (ask). A migration is likely (a price-change record) and joins 365/367/373/380/389 at release |

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

## Owner rulings 2026-10-26 (Stage 5 drawings; paste-back, every recommended box ticked)

Ten asks; the full wording is in `memory/design_decisions.md` 2026-10-26 "SUPPORT CONSOLE STAGE 5".
- **Q1:** Status shows all four groups: our records + a database function now; the AWS list-builds key and a scoped
  read-only Supabase token are release owner steps (a separate member if the plan allows).
- **Q2:** B. Status reads live; the morning check stays on the owner's PC unchanged.
- **Q3:** Status all roles; Errors unchanged; the sent log Super admin + Support + Billing (a new power), absent for the
  rest; staff emails Super admin only.
- **Q4:** a person link on an error for every Errors reader; a staff account Super admin only; deleted = text; nobody =
  says so; the link follows the person record's own rule.
- **Q5:** feedback reply by email from us, "FieldLogicHQ support" at the no-reply address, replies to
  fieldlogichq@gmail.com, signed first name + FieldLogicHQ support, plain text, Support + Super admin (a new power), no
  reason, New to Acknowledged, under 90 days, same address.
- **Q6:** account emails only; no body or links; recipient, kind label, time, number, state, club, asked-for-by; no
  subject; 90 days; Story rows for sign-up, sign-in, reset, invites, replies; Emails tab + Health "Sent emails" + Find group.
- **Q7:** build the callback (migration, public address, secret, Resend setting, release step).
- **Q8:** a kind required on every send call, build-enforced; account kinds logged, family kinds not; the morning-check
  alert stays outside.
- **Q9:** rides S5: the Errors caveat as one sentence; house clock on Errors and Feedback with the spelling gate learning
  the leading zero; two new powers (reply, sent log); Feedback gets its own record page with triage inside. Not S5:
  browser errors split by address (a later errors pass). Report only: the morning check's build reads failed on the
  owner's PC 2026-10-26 (owner will look); the morning check's alert falls back to the product mail key (own commit, on
  the owner's word).
- **Q10:** S5-D1 lime + the note reworded; S5-D2 refresh symbol on a phone; S5-D3 keep today's words, settle in Stage 8.

## Owner rulings 2026-10-26 (Stage 5 build gate; four asks, every recommended box ticked)

- **G1 kind labels:** approved as listed in the gate table (37 logged kinds: sign-up/sign-in 3, invites 5, access 4,
  plan and billing 10, feedback 2, tournament registration 13). Story rows: Password reset link, Email confirmation link,
  Team sign-in link, the five invitations, Reply to their feedback. The table lives in `lib/email-kinds.ts` (one home).
- **G2 team-business mail** (notifications, club asks of coaches, practice plans, payment hand-offs): **not logged in
  Stage 5**; each still carries a kind.
- **G3 Status thresholds:** accepted as proposed (one home, the Status module): production build failed = Act now,
  staging build failed = Look at it; staging site > 3 s or an error = Look at it; errors last hour ≥ 10 and ≥ 3× a usual
  hour = Look at it, ≥ 50 and ≥ 10× = Act now; error rate 24 h ≥ 1% and ≥ 2× a usual day = Look at it, ≥ 5% = Act now;
  traffic under a quarter of a usual hour (usual ≥ 40) = Look at it; counts > 15 min old = Look at it; database > 0.5 s =
  Look at it, no answer = Act now; connections ≥ 80% or anything stuck ≥ 5 min = Look at it, ≥ 95% = Act now; any
  scheduled run failed in 24 h = Look at it; a production service down = Act now; a staging service down = Look at it;
  gateway errors last hour ≥ 10 = Look at it, ≥ 100 = Act now.
- **G4 defaults:** a reply to a Triaged item moves it to Acknowledged; Acknowledged and Resolved stay (the window's
  sentence promises a move only when one happens); "up to 14 hours" dropped from Delayed (unsourced); the reply email's
  foot "You're getting this because you sent us feedback from inside FieldLogicHQ. Reply to this email to reach a person
  on our team.", signature "{first name}\nFieldLogicHQ support" (no first name, or a name that is an email address =
  "FieldLogicHQ support" alone), quote line "On Oct 26, 2026 at 9:15 a.m., you wrote:" (/marketing 2026-10-26); the two
  missing MANUAL_PROD_STEPS entries (373, 380) are added with the Stage 5 migration.
- **Settled by existing rulings, applied as written:** a missing key reads Not checked, never hidden (Q1; the Supabase
  token CAN be scoped read-only to two projects with no Database permission, so its three lines are built); tournament
  registration emails are logged (Q6); the automatic thank-you is "Feedback received" everywhere (one spelling).
- **Found at the gate:** Errors and Feedback print their times in the SERVER's zone (UTC on Amplify) as well as with a
  leading zero; both move to the console clock (Toronto). The spelling gate reads source, so "learns the leading zero"
  is a rule against `hour: '2-digit'` on a 12-hour clock. No public-address route guard existed; Stage 5 adds one.
  Resend shows a webhook's secret only after it exists, so "secret first" is "the route answers not-ready until the
  secret is set" (Resend retries ~27 h).

## Owner rulings 2026-10-27 (Stage 7 drawings; paste-back, every recommended box ticked, plus Q4 C and D)

Recorded as ticked; the drawings: https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM. Build prompt:
`PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_BUILD_PROMPT.md`.

- **Q1 A:** the growth screens only; the catalogue four stay as built apart from menu place and the Promotions name.
- **Q2:** Signed up = an offered match a person confirms, or by hand; an owner or admin who joined, with a
  self-confirmed address. Pays = own plan not Tournament, billing active, a real subscription; trial, free time and
  Founding comp are not paying.
- **Q3 A:** read live from dated facts; no new job.
- **Q4:** B (staff record a source, short list, and their words on the lead) **and C** (a "How did you hear about us?"
  question on the public form) **and D** (a tag on the links we hand out, kept with the lead). C and D were not the
  recommendation; both are customer-facing release items.
- **Q5:** Campaigns keeps its name + one line; the catalogue list becomes Promotions; no lead link.
- **Q6:** no reason on a lead edit; no confirm window, the check mark saves a lead at once. (The third box, the export's
  roles and the empty email cell for "Asked not to be contacted", was not ticked: the build gate asks.)
- **Q7:** no rulebook change: Super admin, Product, Growth read and edit leads; others see counts only.
- **Q8:** not now: restyle only; staff note "sent the deck" on the lead.
- **Q9:** (a) seven steps; Lost with a required reason; Not a fit and Do not contact become reasons. (b) Notes become
  dated, signed timeline entries (one migration). (c) Stuck = 30 days with no step change, note or follow-up; Waiting
  for launch excluded; not a Today queue. (d) Today's growth rows: New leads, Follow-ups due, Sign-up to confirm,
  Campaigns past due, Campaigns due soon.
- **Q10:** Audit log: lead entries keep field names only; old entries' details shown only to Super admin, Product,
  Growth: **fix NOW on its own**. Public form: a known address never turns a no into a yes nor overwrites a worked lead;
  Copy emails moves to the server (rides S7). Today's campaign rows count live campaigns only (rides S7). The export
  audited, uncapped, formula-safe (rides S7). Findings: the coaches page's interest form refuses every visitor when the
  Coaches Portal is closed for sale (fix before it is ever gated); the public early-access form has no rate limit or
  captcha (a later public-route pass); two public slides say 9 AM / 9 PM (to /marketing; the spelling gate misses a time
  with no minutes); no way to delete a lead on request (Stage 8); the snapshot button writes a row nothing reads (decide
  with Business numbers' own pass).
- **Q11:** S7-D1 to S7-D6 all as recommended.
- **Open at the build gate (raised 2026-10-27, not ruled):** the drawings' threat 10 tied the public-route pass to C or D;
  recommended that the repo's existing public-form throttle rides S7's public-form part, the captcha staying later.
  C and D were drawn as options only: a frame J (the question, the lead page's form answer and tag, Numbers' By link
  tag) is needed before they are built.
- **Build gate answers (owner, 2026-10-27, the build session):** §6-3 frame J was not drawn: the build session draws it
  on the drawings page and brings it back before Part 8. §6-4 the repo's existing public-form throttle goes on the
  early-access route inside Part 8; the captcha stays later. §6-5 as drawn: Super admin, Product and Growth export; the
  email cell is empty for "Asked not to be contacted". **Census 2c: the code CANNOT tell an address its owner confirmed
  from one staff or a script confirmed** (nothing records who confirmed; console Confirm email, dev-mode and seed
  creates, and the coach invite-token sign-up all confirm without a Supabase link). Owner chose **the best signal, safe
  side:** offer only an owner or admin who was sent our confirmation email and has signed in since, with no console
  `confirm_email` / `update_user` entry for that account; when it cannot tell, no offer (staff can still link by hand).
  Sign-up flows untouched; the Stage 7 migration adds the one read of the account's confirmation dates.
- **Part 0 built and committed `c6e3d3720` 2026-10-27:** a lead edit's entry keeps the changed field names and the step
  before/after (the drawings' "field names and the step"), old entries' details reach the growth power only (page,
  entry window, Copy, Same moment, export; one filter `hiddenEntryLine` shared with refunds). Guard
  `tests/unit/support-console-stage7-audit-guard.test.ts`. No migration; reaches prod at the next release on its own.
- **§4 re-run (2026-10-27), rows that moved or were wider than written:** the "paying" rule is a private constant inside
  `classifyGrowthMove` (`lib/plan-growth.ts:32,55`), not lines 43-52, and ⚠ **it is not Q2's rule:** its
  `PAYING_NOW_STATUSES` is `['active', 'trialing']` (right for its job: a subscription STARTS when its trial does),
  while Q2 says a trial is not paying. Part 2 adds one exported "pays now" rule beside it in the same module (own plan
  not Tournament, status active, a real subscription id past `incomplete`, no free-time grant) built on the same
  private helpers, and the guard pins that a trialing club is not paying. A **second
  lead writer** exists: `lib/basic-coach-interest.ts:114-154` (a coach team's interest button) merges into the same row;
  Part 8's overwrite rule covers it too. The public route answers a database error with Supabase's own message (73, 111).
  Business numbers lists 5 of the 8 steps. The link picker includes demo clubs and goes silently empty on a failed read.
  The lead id is never format-checked (`[leadId]/route.ts`). Staff detection (`isPlatformAdminEmail`) reads a failed
  lookup as "not staff": the match must refuse there instead. Outreach templates sit at `EarlyAccessClient.tsx:67-71`.
- **§6-6 `/marketing` words (2026-10-27, the build session's helper; customer copy of C is a release item):** steps,
  the six Lost reasons and the staff source list confirmed as drawn. **The visitor's question** "How did you hear
  about us?" (optional, first option "Choose one"): Another club or team told me → Referral from a club · Someone else
  told me → Other · I came across it at a tournament → A tournament on FieldLogicHQ · I searched online → Search ·
  Social media → Social media · An event or conference → An event or conference · Someone sent me a presentation →
  A pitch deck · Something else → Other. (The drawn "A friend or another club" split: a friend is not a club.) The
  lead page shows "From the form: {the visitor's words}". **Timeline templates:** "{actor} moved it from {old} to
  {new}" (also for New → Contacted when no source is set in the same edit), "{actor} marked it {step} and set the
  source: {source}", "A club signed up with this email: {club}, on a {plan} trial. Not linked yet.", "{actor} linked
  {club}, the offered match (same email). Step: Signed up", "{actor} linked {club} by hand", "Filled the form again, on
  the {page} page", "The club started paying: {plan}, {monthly|yearly}", "A note was removed" (capitalised; never the
  text); sub-lines "Next action: {text} · Follow-up {date}" and "Follow-up and next action cleared". Campaigns' line
  and Promotions ("For the record · not linked to checkout or Stripe"; "No promotions yet."; an approval request
  reads "Promotion") as drawn. Numbers' definitions as drawn, minus the "(question 11)" cross-reference; "3 of the 11"
  and "May 20" are computed, never typed.
- **§6-7 the migration: `398_support_console_leads_pipeline.sql`** (396 and 397 were taken by Club Tier the same
  hour). Written 2026-10-27, NOT applied until the owner's go after the gate. Dev rows each data move touches: **0**
  (0 leads, 0 lead edit entries; `.probe/pasc/s7-mig396-counts.mjs`, SELECT only). Builder's calls in it, beyond §7
  Part 1's list: **Signed up ⇔ `linked_at`** (not the club id: `converted_org_id` is ON DELETE SET NULL, so a deleted
  club leaves the dated facts behind, "Signed up, club since deleted"); **`signed_up_at`** = the club's or portal's
  creation time copied at the link (S7-D4 survives a deletion); **`step_changed_at`** (stuck needs it; back-filled from
  the edit log, whose entries carry the step on both sides before and after Part 0); `heard_from` and `ref_tag` are
  format-checked in the database with their lists in code; the old notes box is emptied once copied; the lead table's
  browser-role grants are revoked (prod still had them in 2026-06; RLS made them harmless); `platform_lead_account_dates`
  is the one account read the match needs.

## Stage 7 build (2026-10-27) — Parts 0–7 and 9 built; Part 8 waits on frame J

Commits: Part 0 `c6e3d3720`; records `ab6fe2c41`; mig 398 `978b645fb` (dev 2026-10-27; prod step in MANUAL_PROD_STEPS);
one definition `c1c195f9b`; Leads `90d1f8408`; words and places `3d3cb8f98`; help + records (this commit).
- **One definition:** `lib/lead-numbers.ts` (pure) over `lib/lead-book.ts` (every lead, pages of 1,000; a failed read is
  `not_read`, printed "Not read"). `paysNow` in `lib/plan-growth.ts`. Today, Business numbers and the menu read it;
  `getCommandCenterStats` reads no leads.
- **Leads:** `app/platform-admin/early-access/` (Pipeline + Numbers, `LeadsScreen.tsx`), the lead page `[leadId]/`,
  sentences in `lib/lead-views.ts`, `lib/lead-numbers-view.ts`, `lib/lead-timeline.ts`; every write in
  `lib/lead-writes.ts`; routes under `app/api/platform-admin/early-access/` (link, dismiss, notes, clubs, copy-emails,
  export, numbers-export).
- **Builder's calls (the walk puts them to the owner):** Mark contacted moves only New → Contacted (a Signed up lead's
  step is its link's); a lead edit's audit entry also keeps the source and Lost reason CODES (fixed lists, never words) so
  the timeline can say "set the source: …"; no "Details" box under Lost (no column; a note instead); the timeline says
  "started a subscription" (the event fires at a trial's start too), not the drawn "started paying"; only the latest
  refill of the form is dated (earlier ones were never kept; Part 8 adds a place); the export carries no staff notes;
  note removal uses the rulebook's `delete_records` (Super admin), no new power; the catalogue four keep their menu
  place (none was drawn); no "Opened" line on a deck (Q8); Business numbers loses its back link (it is in the menu).
  Pitch decks (a helper's restyle, reviewed): Create this deck hidden until a name and a slide, with the new foot line
  "Name the deck and add at least one slide to create it."; saved dates read "Sep 3" through the console's day.
- **Finding, not S7's:** Today's and Business numbers' "about $X a month at list price" counts Founding comps and free
  time at list price (`getCommandCenterStats` MRR: `status === 'active'` only) — Business numbers' own billing pass.
- **Threats → guards:** `tests/unit/support-console-stage7-guard.test.ts` (THREATS table: 1–3, 5–9, 11–14 guarded;
  4, 10, 16 owed to Part 8; 15 not built per Q8), `-stage7-numbers`, `-stage7-audit-guard`.
- **Owed:** frame J (drawn on the drawings page, owner OK) → Part 8 (overwrite fix incl. the coach-interest writer,
  C, D, the throttle, its migration for refills and tags); the two walks. (`/simplify`, `/review` and `/docs` were done
  in the finish pass below.)
- **The two walks, written 2026-10-27 (owed to the owner; they cover the finish pass, committed `e58bdd3d7`):**
  walk A, a lead from the form to signed up, ledger §397, https://claude.ai/artifact/BCtrY5GDktYu41oVY4AqGa
  (`PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_WALK_A.html`, 40 steps, 14 calls); walk B, the guard rails, ledger §398,
  https://claude.ai/artifact/N5HAMnAs71eW97AeEjJkZQ (`…_STAGE7_WALK_B.html`, 35 steps, 7 calls; run after A).
  Found while writing them, put to the owner as calls, not fixed: **the offered match cannot appear on dev** (dev's
  sign-up confirms at once and sends no confirmation email, so `selfConfirmed` never holds; walk it on staging or with
  `REQUIRE_SIGNUP_EMAIL_VERIFICATION=true`); a hand link to a club **older than the lead** reads "0 days after it
  arrived" and counts 0 in Time to sign up; "Month by month" has no paying figure though its caption speaks of paying
  by month; a **refused hand link** (asked not to be contacted) leaves the picker open and silent, its reason on the
  page behind it. Also found: the §394 lead's staff note was written to the old notes column after 398 had emptied it,
  so no screen shows it (dev only; on production, apply 398 with the deploy, not ahead of it).

### Stage 7 finish pass (2026-10-27) — `/simplify`, `/review` (privacy lens first), `/docs`

Made in the working tree on 2026-10-27, before the walks, so the owner never walks code a review then changes.
**Committed 2026-10-27 on the owner's OK:** code `e58bdd3d7`, help `8edfbc5da` (HEAD plus this project's hunks; another
session's "extra feature" wording sweep and a Find wording change were left in the tree). Gate: `tsc` clean, eslint clean on the changed files, 284 guard
tests pass (the three Stage 7 guards plus support-console stage 2/3, platform-admin stage 1, plan-reader-door,
platform-audit-reason), `check:spelling` clean, the read-only render probe `.probe/pasc/s7-render.mjs` prints "all good".
The review ran five lenses (audit/Story privacy, the offered match, egress and route access, correctness and
performance, the Pitch decks restyle); each finding was opened in the code before it was acted on.

- **`/simplify` (behaviour unchanged):** the staff-address set had three copies (the offered match, the hand-link check,
  the club picker) and is now `readStaffAddresses()` in `lib/lead-book.ts`, which throws when unread so every caller
  fails closed; the filter-token cleaner had three copies and is `filterToken()` in `lib/lead-views.ts` (the numbers
  export's tag cap is now 32, the screen's); the unused `planWords` re-export is gone.
- **Fixed from `/review`:**
  - A hand link on a lead who **asked not to be contacted** cleared that reason (the link clears the lost reason), so the
    person could reappear in Copy emails and the export. `linkLead` now refuses such a lead (409) until its step is
    changed on purpose.
  - A second press on Link changed nothing yet wrote an audit entry naming its own club. The link update is now
    conditioned on the lead being unlinked and on the step it read, returns 409 when nothing changed, and writes the
    audit entry only on a real change.
  - **The old paged list route** (`GET /api/platform-admin/early-access`) survived the rebuild with no caller: it read
    every lead with no audit entry and no do-not-contact blanking. **Deleted**; a guard now fails if it returns.
  - **Copy emails** wrote its audit entry best-effort after choosing the addresses. It now writes it first with the strict
    writer and refuses (503) if it cannot, like the export.
  - **CSV cells with a bare carriage return** were not quoted, so a stranger's text could start a new record that Excel
    runs as a formula (`lib/export/csv.ts`, shared; the old export quoted every cell).
  - `?step=<made up>` made Copy emails and the export cover **every** lead while the screen showed Needs you; the scope
    now reads the validated step.
  - Lead days were bucketed by the **UTC** day (`created_at.slice(0, 10)`): a 9 p.m. Eastern arrival fell out of "This
    month" and "Last 30 days" until midnight and could land in the next month. `inPeriod` and the month buckets now use
    `orgDayKey`.
  - **Today** said "Nothing waiting" / "Growth · 0 waiting" when a lead read failed (the queue showed "Not read" beneath).
    The toolbar and each group now say how many queues were not read.
  - The paged reads gained an `id` tiebreaker (offset paging could skip or repeat a row on equal `created_at`).
  - A malformed follow-up date cleared the follow-up silently; the lead PATCH now refuses it (400).
  - Pitch decks: "Discard" in the New deck window did not discard (the draft and a stale refusal came back); Cancel now
    asks like × does. The restyle itself was diffed against `3d3cb8f98~1`: every save/publish/delete/revert call and
    guard is identical; no class name resolves to undefined.
  - New guards: any audit write naming an early-access action must be on `LEAD_ACTIONS` (the privacy filter was a closed
    list nothing forced a new action into), plus one per fix above.
- **Reviewed, kept, because …**
  - A link/unlink entry shows its `org_id` (the club) to every role: the club is a customer, the entry holds nothing about
    the lead.
  - Moving a lead off Lost clears "asked not to be contacted": the database requires a reason exactly while Lost, and a
    step change is a deliberate edit. **Owner question:** a durable do-not-contact flag (a column) so a stray step change
    cannot lift it? It is a migration, so not done here.
  - The same club can be linked to two leads (the index is not unique): two forms from one person is plausible, and
    blocking it is a product call.
  - "Staff-owned" is matched on the exact normalised address (no `+tag` or dot folding) and on owner rows only: the
    ruling is "best signal, safe side", and a miss can only fail to offer, never wrongly offer a stranger's club.
  - The "staff confirmed or changed this account" check depends on `confirm_email` / `update_user` audit entries, which
    use the best-effort writer; a confirmation made outside the console is invisible (census 2c). Switching those two
    shared routes to the strict writer is the owner's call.
  - `readAccounts` calls `isDemoOrgId` per organization: cached after one complete resolution, so free in production
    (the per-open cost is paging every organization id, fine to about 10–20k).
  - Low, not changed: `unlinkLead` takes the step to go back to from the link's audit entry (falls back to Pilot; a lead
    hand-linked before mig 398 has none); the pipeline band counts a demo-linked lead the backfill left behind; clearing a
    follow-up also resets the stuck clock; `consoleDay` of a bare date on Jan 1 shows the year; "from For clubs" and "0 days
    ago" copy on the lead page; Business numbers reads the whole lead book for three counts; a `readOffers` failure blanks
    all three Today lead rows including the two that need no offer.
- **Open, with the number that makes it matter (not fixed in a finish pass):**
  - **Prod step for mig 398:** audit rows written **before Part 0** hold the whole lead (name, email, `internal_notes`)
    and no migration scrubs them; they are hidden from every non-growth role today, and a note moved out of the old box
    is still in those rows after a Super admin "removes" it, so the remove window's "gone for good" is not true for that
    note until they are scrubbed. A new migration (not an edit to 398) is the place, before 398 reaches production.
  - **Scale cliffs, all failing closed as "Not read":** the offered-match and Pay now reads send every id in one request,
    so past roughly 200 open leads (or 200 signed-up clubs) the request may be refused (the line limit is assumed, not
    measured on this gateway) and Today's lead rows, the Leads pill and Pay now read "Not read" for good; chunk them with
    the guards updated. `readLeadBook` reads the whole lead edit log on every Leads/Today/Business numbers load and the
    audit log has no index on `(action, field, created_at)`: it starts to hurt around 3–5k lead edits (about 10k audit
    rows); fix with that index and a SQL aggregate, or a `last_follow_up_set_at` column.
  - **For Part 8:** the public form counts a missing consent field as consent (`!== false`), and a resubmission under the
    same address overwrites consent, so "said yes" under Copy emails means "did not say no"; that writer is Part 8's.
- **Help (`/docs`):** `lib/help-content/platform-admin.tsx` — Today's three lead rows and the "Not read" wording,
  Business numbers (own menu place under Growth, the Leads and conversion card), Campaigns' one line, Promotions (was
  Campaign tracking) in Plans & pricing, a new **Pitch decks** section (standing deck and the Publish rule, New deck window,
  unlisted link, pull) with a hub quick link, and the Leads article's new behaviours (no link on an opted-out lead,
  record-before-copy, Eastern days). Plans & pricing, Leads and Pitch decks converted to sub-topics (over the 350-word
  standard once extended); "How to temporarily override billing access" (577 words) was already over and is not touched.

## Stage 5 build (2026-10-26) — what was built, and the threats → guards

Built on dev in one session after the gate (G1–G4). Migration 389 (dev 2026-10-26; prod step in MANUAL_PROD_STEPS with
365/367/373/380). The kinds' one home is `lib/email-kinds.ts`; Status's thresholds `lib/platform-status-lines.ts`.
- **Status** (`/platform-admin/status`, every role): 13 lines; cheap lines (our records + two database functions) read
  every time, Today's line takes their worst verdict; provider lines (Amplify ListJobs, the staging site, Supabase health
  + gateway count) shared through `platform_status_reading` at most every 30 s, 5 s each; a missing key = Not checked.
- **Sender**: `kind` required on every `sendEmail` (≈50 call sites + wrappers); account and registration kinds write
  `platform_account_emails` before the send and tag the email `flhq_row` + `flhq_db` (the project ref, since
  OBSERVABILITY_ENV is unset on staging); a retry reuses its row (`logId`).
- **Callback** `/api/webhooks/resend`: `RESEND_WEBHOOK_SECRET` unset = 503; Svix verify before parse; one database step.
- **Feedback**: list restyled, record page `/platform-admin/feedback/[id]` (triage behind the pencil), Reply window and
  route (`reply` power). Triage routes now check `feedback_triage` itself (the page also carries `reply`).
- **Sent log**: person Emails tab, `/platform-admin/sent-emails`, the email window, Find's Sent emails group, person
  Story rows — all on the `sent_log` power; staff addresses Super admin only; `platform_accounts_for_emails` decides "no
  account" in one call a page.
- **Errors**: restyled, the caveat one sentence with no counts in it (so it cannot go stale), the person link's states.
- **Clock**: Errors and Feedback on the console clock (they printed UTC with a leading zero); the spelling gate fails on
  `hour: '2-digit'` on a 12-hour clock and on a literal leading-zero time.
- **Settings** (amplify.yml echoes; owner steps at the release): RESEND_WEBHOOK_SECRET, STATUS_AMPLIFY_ACCESS_KEY_ID,
  STATUS_AMPLIFY_SECRET_ACCESS_KEY, STATUS_SUPABASE_TOKEN.

**Threats → guards** (tests: `support-console-stage5-guard`, `-sent-log-guard`, `-clock-guard`,
`public-api-routes-guard`; live: `scripts/support-console-stage5-check.sql` on dev, passed 2026-10-26):
T1 settings guard (no browser file names a key; two server readers) · T2 Status answer shape · T3 ListJobs only, no
commit message/log link read · T4 no `database/query`; token scope = release step · T5 the fixed gateway count · T6
`platform_status_claim` (live S1) · T7 health function text bans · T8 signature/time/size suite · T9 live C2 · T10 live
C3/C4 · T11 parse keeps nothing + live C1 · T12 nothing logged · T13 no content column, labels fixed · T14 Story gate ·
T15 staff filter · T16 power-first routes · T17 search limit + trail row · T18 no recipient from the browser · T19
replyTarget · T20 daily limit + audit · T21 one-line subject · T22 claim + once-only key + live R1/R2 · T23 reply power
first · T24 log failure to the server log only · T25 `public-api-routes-guard` · T26 Errors person-link rule (clock
guard) · T27 unchanged (no IP/browser shown).

**/simplify + /review (high risk, security lens) 2026-10-26:** no Critical or High. Fixed: the one Medium (a reply retry more than 2 minutes after the first press could be taken as stalled and send twice, the row then reading failed) by a per-claim `claimed_at` (mig 389) and a finish conditional on the claim; an ambiguous mail-service answer (5xx, 429, key in flight) is Not confirmed with the same key, only a definite 4xx refusal is "nothing was sent"; the attempt's log row is kept from the claim; every email-window open writes the trail row (a browser-sent `from` no longer decides it); a General bounce reads "refused", never "address does not exist"; a colleague's address left the feedback conversation. Left as decided / for the release: Find's exact-address lookup is not counted against the search limit (a build decision, owner may overrule in the walk); the scheduled-jobs read now covers 24 hours of run history (EXPLAIN on prod-size data at the release).

**Decisions taken in the build (for the walks):** a reply after a refusal takes a new once-only key, after no answer the
same one; a reply stuck "sending" over 2 minutes becomes Not confirmed; the reply window's Cancel after "someone replied"
keeps your words and won't ask again for that reply; an unreadable answer reads as not confirmed in the window; a set
severity cannot be cleared (the status route never could); a staff asker with no name reads "FieldLogicHQ staff" to all
but Super admin; Find's exact-address lookup is not counted against the Sent emails search limit; an unknown account
lookup on an Errors sample reads "Could not read this account".

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

## Stage 4b drawings (2026-10-27; drawn, NOT ruled; nothing built)

Drawings https://claude.ai/artifact/4qzTiG3rUBTmihqPSUAzrW (source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_DRAWINGS.html`; captures
`.probe/pasc/cap-s4b/` via `capture-s4b.mjs`; render `render-s4b.mjs`; assembled from Stage 4's head/CSS/scripts by a scratchpad
`assemble-s4b.cjs`). One example coach through every frame: Frankie Okafor, UAT Free Team (dev: 12 players, 6 events, 3 fees);
given Oct 27, 2026, free through Dec 26, 2026. **12 asks owed** (1 what "back" does with Premium-era work: A keep whole + say so,
recommended; 2 lengths and cap: shared date field, 90 days Support/Billing, 6 months Super admin; 3 who: a new power for Super admin,
Billing and Support; 4 refuse paying/Founding/cancelled, second give Super admin only; 5 change the running end, measured from the first
give; 6 Founding beside: two builds, 4b first; 7 told in the product only, no email; 8 Stage 4's Q10 replaced; 9 every bulk action skips
portals; 10 no hosting, reminders to families start off, family-facing words proved at the gate; 11 four fixes inside 4b, four logged;
12 rule meetings D-1..D-5). The prompt's asks 6 and 9 were reframed (Founding sits beside, not decided; both "still open from earlier
stages" items were closed by Stage 3).

**Findings (the lines marked ✔ were opened by hand after helpers reported):**
- ✔ A free (Basic) coach has **no organization, billing page or console record**; the console's person record says "0 clubs". The door is
  a Coaches Portal tab on the person record; the portal's own record takes over once it exists.
- ✔ Forward copy only (roster, events, fees; once, behind an atomic claim); **no reverse copy**; Premium-only data (practice plans,
  attendance, lineups, playing time, money book, awards, tryouts, notes, documents) has no free home. Tournament entries and chat are shared.
- ✔ The free team's 11 write routes check only free-team membership (never the workspace); only pages redirect. The announcement route
  emails real contacts.
- ✔ `team_entitlements.ends_at` is enforced at read time (only in `team-workspace-entitlements.ts`); nothing writes a future one.
  Stripe's sync rewrites the three records' status and leaves `ends_at` alone.
- ✔ **Scheduled sweeps (dues reminders, digest) decide from the organization's status through Stage 4's door and nothing changes it at an end
  date; reminders default ON and the copy creates dues schedules.** Build shape drawn: store the portal ended, a timed billing-status grant
  holds it open, the entitlement's end set in the same insert, the workspace-status readers learn one question; census of three reader
  families as a build check. Rejected: tidy-on-first-visit, and leaving the organization active.
- ✔ `findReactivationWorkspace` refuses a comp-mode portal; no path from a free-time portal to a paid one exists (Keep Premium is new work).
  Coach cancel and staff cancel must refuse a portal on free time. Retry route cannot repair a null summary (claim spent, nothing copied).
- Bulk status override (and plan change) do not refuse a portal. Give order: record first, then portal with the end in the same insert.
- Dev: 24 real free teams, 13 shadow rows; production unknown (not queried).
- Design pass (fresh reviewer): 17 defects, mostly coach frames drawn with stubs that hid two real lime buttons; all fixed. Safety review
  (fresh, adversarial): changed the central design (above) and added threats T29–T36.

## Owner rulings 2026-10-27 (Stage 4b drawings)

Paste-back from https://claude.ai/artifact/4qzTiG3rUBTmihqPSUAzrW. **Every recommended box ticked, all twelve** (Q11 with the
owner's note "go with your recommendations on these"). Logged in `memory/design_decisions.md` 2026-10-27. Build prompt:
`PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_BUILD_PROMPT.md`.
- **Q1 What "back" does:** A. Premium work is kept whole and hidden; the free team reads as it did on the day of the upgrade;
  one band says so. No copy back (B, a "Bring my changes back" button, and C, an automatic copy back, are not built).
- **Q2 Lengths:** the shared date field, no quick picks; **90 days for Support and Billing, 6 months for Super admin**.
- **Q3 Who:** a **new power** for portal free time, held by Super admin, Billing and Support. Product, Growth and Read only see
  it and cannot give it. (The "sixth give in a week needs a Super admin" line is in the drawings' safety section, not in this
  option's text: NOT ruled, a gate ask.)
- **Q4 Refusals:** a portal that pays, is Founding, or was cancelled gets no door (absent, one line says why). A second give
  to a coach who has had free time needs a Super admin.
- **Q5 More time:** change the running end, **measured from the first give**; a give after it ended reuses the same portal
  (nothing copied again) and is a Super admin's.
- **Q6 Founding beside:** two builds, 4b first, sharing the one question "is this portal in force right now?" (written to
  take any end). **4b touches no Founding row.**
- **Q7 Told:** in the product only (billing line, home band, amber last-14-days band, the free portal's day-after band for 30
  days). **No email.**
- **Q8:** Stage 4's Q10 ("no free time on a portal") is **replaced** by this stage's rules.
- **Q9:** **every bulk action skips a Coaches Portal** (status override and plan change), with the window's refusal, and says so
  in its summary line.
- **Q10:** free time **does not include hosting**; automatic reminders to families **start off** on a free-time portal; what a
  family sees after the end is written as plain sentences and **proved at the build gate** (free time does not ship until it is).
- **Q11 Found along the way:** **fix in 4b:** (1) the free team's save routes, announcements included, refuse while a Premium
  portal is in force; (2) Keep Premium, a real path from free time to paid; (3) the copy saves a pending summary at the claim so
  Try again can always repair; (4) coach cancel and staff cancel refuse a portal holding free time and point to End it now.
  **Log only:** (5) staff cancel sets all three records; (6) one name for the plan in the console's lists (Premium Coaches
  Portal); (7) the billing page says Organization and shows a price for a no-Stripe portal (the price and the Stripe door are
  hidden for free time inside 4b; the rest logged); (8) three definitions of "live portal" disagree on incomplete and unpaid
  (4b's one question replaces all three).
- **Q12 Rule meetings, D-1 to D-5 as drawn:** End it now stays lime; Keep Premium is the billing page's one lime and Join a
  club is outlined; the free Overview's day-after band is new ground; the hosting line stays, worded through /billing; Keep
  Premium is 44px tall and full width on a phone.

**Not ruled (carried as gate asks in the build prompt):** the sixth-give-in-a-week rule (T2); the exact customer words (through
/billing and /marketing); the Free time list and Clubs & portals list rows, the Premium home band, the Premium welcome and the
"check these" notice, which the drawings describe but did not draw (they are drawn at the build's first walk).

## Stage 4b build gate (2026-10-27; findings, before any code)

The build prompt's §6 run against the code (five read-only censuses, the cited lines opened). Owner asks at the end.
- **§4 re-verified.** All rows hold except: the free team's save routes are **14**, not 11 (announcements, events ×3, features,
  fees ×4, interest, roster ×4; all `requireBasicCoachTeamOwner`, none reads the workspace); staff cancel also archives,
  retention-tags and cancels Stripe, but writes only the organization of the three records; the copy's result is
  `team_workspaces.migration_summary` (jsonb, null = never ran, no `pending`); reminders default ON
  (`rep_program_years.auto_reminders_enabled` DEFAULT true) and the copy does create dues schedules. Next migration **406**
  (none claimed). No owner-unique rule on `team_workspaces` (snapshot).
- **Write order (T31) cannot be literal.** A Stage 4 grant is an `org_overrides` row (`org_id` NOT NULL), and
  `provisionStandaloneTeamWorkspace` creates the organization first. Safety-equivalent order: the organization is born
  **cancelled** → the billing-status grant (bounded by the last free day) → workspace born `canceled`, entitlement born
  `active` with `ends_at` = the grant's end, both in their inserts → the claim → the copy (reminders off). Any throw rolls the
  organization back; any stop leaves nothing in force past the last free day.
- **Census: six definitions of "live portal"** (`isLivePortalStatus` any-but-canceled; `LIVE_TEAM_WORKSPACE_SUB_STATUSES`;
  `isOrgBillingSuspended` through the door; `user-contexts` private copy; `getActiveTeamEntitlement` with `ends_at`; the
  people-rows inline copy). **Must move (8):** `getActivePremiumPortal`, `excludeActivePremiumUpgrades`,
  `getRegistrableTeamsForUser`, `isLivePortalTwin`, `getActiveOwnedTeamWorkspace` (+ 5 callers), people-rows, user-contexts.
  **Door already (a):** `getAuthContext`, the coaches layout wall, `getOrgForGate` (families), public team schedule,
  `getInsightsDigestTeams` (both sweeps). **Allowlist:** every writer and Stripe sync, reactivation (`team-checkout.ts:350/367`,
  it changes the rows), lead-book "pays now", the needs-attention payment bell (stored billing standing), `team_workspace_status`
  (adopted-by-a-club, a different question), the console's stored displays. **Schedule-change notices** read no liveness: they
  go to a team's coaches about a tournament game, and the tournament entry is shared by both portals, so a coach whose free time
  ended should still hear it: allowlist with that reason.
- **The end with a lapsed grant:** both sweeps skip it (door → stored `canceled`); the per-team gate returns not entitled
  (`ends_at` past), which also closes the family layer, the staff chat room and the calendar feed. The free-team redirect,
  list and registration picker read only the workspace's status: stored `canceled`, they would send the coach to the free team
  DURING free time too, so they must ask the one question (as planned). `ends_at` and the grant's end are one value; Change the
  end and End it now write both.
- **Churn (step 3): two lists count it, everything else is safe.** Retention (keyed on retained records: none written),
  `subscription_canceled` churn counts (no event written), MRR (status active only), lead book "pays now" (platform override
  never pays) are safe. **Not safe:** the Orgs list "Cancelled (N)" + its needs-attention callout, and Business numbers
  `byStatus.canceled`, read the stored status with no kind filter, so a free-time portal reads as a cancelled customer for its
  whole life. Lead book "New accounts" counts it as a new account. Today's "Free time ending" lists it (wanted, needs a kind).
- **What a family sees after the end (Q10/T25/T36), from the code:** public team page: the existing refusal ("This club's site
  isn't available. {name} has turned off its public site here, or no longer uses it. If a coach or the club sent you this link,
  ask them for an up-to-date one."); the family app's team page: "Schedule not available. This team's schedule isn't being shared
  with families right now. Your connection is still active — check back, or ask the coach."; the public calendar feed: empty under
  the team's name. **There is no family pay link for a portal's dues** (rep-team dues online are not built; the reminder email
  has no link); tournament-entry pay links belong to the host. **There is no family chat** (two surfaces, tournament and coach
  peer; all chat is paused). Nothing is deleted, refunded or emailed at the end.
- **Keep Premium (step 5):** today a coach who pays DURING free time is refused at checkout (once the one question sees the
  portal) or, at the webhook, returns `already_exists` and nothing attaches; AFTER the end the free Overview's Upgrade makes a
  blank second portal (claim lost), and the cancel email's reactivate link throws for a platform-override portal. Needed: checkout
  and `provisionTeamWorkspaceFromCheckoutMetadata` reuse the coach's staff-given portal BEFORE the owner-live guard; the
  conversion writes `billing_mode='team_direct'`, the Stripe ids (org + workspace), clears `ends_at`, sets the entitlement source
  `team_plan`, ends the grant (Story entry), clears the stored ended state; idempotent on the subscription id. Stripe (docs read
  2026-10-27): fulfil on `checkout.session.completed`, the handler may run more than once and concurrently; nothing else changes.
- **Migration 406:** one staff-given portal per coach (partial unique on the owner for `source='platform_admin'`) and one
  staff-given portal per free team; a second give reuses, so neither blocks a legitimate give. No pending-summary column needed
  (jsonb).
- **Owner gate rulings 2026-10-27 (all as recommended):** (a) a giver's **sixth portal give inside seven days needs a Super
  admin** (T2; Stage 3's refund shape); (b) **the reordered give is accepted** (organization born cancelled → grant → workspace
  and entitlement born ended/bounded → claim → copy); (c) **families after the end see the existing words** (the public refusal
  page and the family app's "Schedule not available"); "club" on the public refusal for a coach's team is **logged** for a later
  reword, not changed here.
- **Builder's calls (recorded, not asked):** the one question = the organization through Stage 4's door is not cancelled AND
  the team has a running entitlement; the workspace's own `subscription_status` becomes a Stripe mirror read only by writers and
  reactivation. An `incomplete`/`unpaid` paid portal (org not cancelled) therefore still reads in force, as the redirect does
  today. The free team's ordinary Upgrade after the end reattaches to the saved portal (Q1's "comes back if Premium does").
- **Customer words (gate step 6, `/billing` + `/marketing` review 2026-10-27; final).** Stage 4's club bands are the pattern:
  the day shown is the LAST free day, so "runs through" / "ran through", never "ends on". One wording for desk and phone.
  1. Price line "Free through {December 26, 2026}" · sub "from FieldLogicHQ · then the free Coaches Portal, automatically".
  2. Band running: eyebrow "Free time" · title "Premium Coaches Portal is free through {day}." · text "FieldLogicHQ gave you
     Premium for a while. On {day after} you go back to the free Coaches Portal automatically. Nothing is charged, and nothing
     you made is deleted. Everything you made on Premium is saved, and it comes back if you choose Premium again." (phone: the
     same without the first sentence).
  3. Last 14 days (amber): eyebrow "Free time · {n} days left" / "· 1 day left" / "· last day" · title "Your free time runs
     through {day}." (last day: "Your free time ends today.") · text "On {day after} you go back to the free Coaches Portal
     automatically, and everything you made on Premium is saved. To keep Premium, choose it below."
  4. Billing card: running "No billing action needed: your free time runs through {day}."; last 14 days "Your free time runs
     through {day}. To keep Premium, choose it below. Otherwise there is nothing to do."
  5. Keep Premium (lime) · line "Next you choose how to pay. Your team and everything you made stay as they are." (never imply
     unused free days carry over).
  6. Free Overview, day-after band (30 days): eyebrow "Free time ended" · title "Your Premium free time ran through {day}." ·
     text "You're back on the free Coaches Portal, with your team as it was when your free time started. Everything you made on
     Premium is saved, and it comes back if you choose Premium again." Upgrade card's added line (while Premium work is saved):
     "Everything you made on Premium is saved and comes back with Premium." (no month).
  7. Hosting: one line on the plan card where the hosting clause was: "Hosting a tournament isn't part of free time."
  8. The wall (a Premium page after the end; never "subscription ended"): title "Your free time has ended" · "Your Premium
     free time ran through {day}. Your team is back on the free Coaches Portal, and everything you made on Premium is saved. It
     comes back if you choose Premium again." · button "Go to your team".
  9. Free-team save refused: "{Team} is on Premium right now, so make changes in your Premium Coaches Portal."
  10. Coach cancel refused: "There's nothing to cancel. Your Premium Coaches Portal is free through {day}, then goes back to the
     free Coaches Portal by itself."
  11. Staff: cancel refused "{Portal} has free time through {Dec 26, 2026}. End it now from its Access list instead of
     cancelling." · bulk "Skipped {n} Coaches Portals: their plan and free time can only be changed on each portal's own record."
     (one: "Skipped 1 Coaches Portal: its plan and free time can only be changed on its own record.")
- **Build progress (resume here).** **Part 0 committed `0f6ca5433` 2026-10-27:** the 14 free-team write
  handlers use `requireBasicCoachTeamWriter` (refuses 409 while `getActivePremiumPortal` sees a live portal; reads stay on the
  owner gate); `pendingMigrationSummary` saved right after the claim in `provisionStandaloneTeamWorkspace` (the banner's auto
  Try again repairs a stopped copy; copy rows are unique by source per season, so a concurrent retry cannot duplicate);
  coach cancel and staff cancel (window + save) refuse via `runningPortalFreeTime` before anything is written; every bulk action
  skips `account_kind='team_workspace'` with `bulkPortalSkipLine`. New: `lib/portal-free-time.ts` (pure rules + words),
  `lib/portal-free-time-server.ts`, `tests/unit/support-console-stage4b-guard.test.ts` (25), door-guard allowlist +1. Typecheck
  clean on these files (the only errors are another session's house-league schedule page). **Resume at Part 1** (the power),
  then Part 2: `isPortalInForce` = the org through Stage 4's door is not cancelled AND a running team entitlement; move the 8
  census readers; a new guard pattern for `team_workspaces`+`subscription_status`, `team_entitlements`, `ends_at` and the private
  predicates (the old door guard is file-level and cannot tell a liveness read from a writer); fix the Orgs list "Cancelled"
  count + callout and Business numbers `byStatus.canceled` + lead book "New accounts" for staff-given portals. Part 3 needs an
  `endsAt` input on `provisionStandaloneTeamWorkspace`, entitlement born `active`, `source:'platform_admin'`, event source
  `platform_admin`, reminders off on the new program year.
  - **Parts 1–2 committed `6b20a0763` 2026-10-27.** Part 1: `portal_free_time` in `PLATFORM_POWERS`
    (Super admin, Billing, Support), on the People and Clubs & portals pages' write side. **Builder's call:** Billing's
    read-only eye on People goes (it can now give free time from a person record); the Stage 2 eye guard updated.
    Part 2: the one question `lib/portal-in-force.ts` (pure) + `lib/portal-in-force-server.ts` (`portalsInForce`,
    `workspacesInForce`); moved onto it: `getActivePremiumPortal`, `excludeActivePremiumUpgrades`, `isLivePortalTwin`,
    `getRegistrableTeamsForUser`, `getActiveOwnedTeamWorkspace` (its 5 callers unchanged), the People rows' live-portal
    count; `isLivePortalStatus` and `LIVE_TEAM_WORKSPACE_SUB_STATUSES` deleted. Dev check (read-only, 6 portals): old
    and new answers agree on every one. The wall: `FreeTimeEndedWall` (copy 8) in the coaches layout for a
    `platform_override` portal whose portal grant ended. Churn: `freeTimePortalOrgIds` leaves free-time portals out of
    Business numbers, the lead book's New accounts and the Clubs list's Cancelled count, callout and filter. Guard:
    `tests/unit/support-console-stage4b-inforce-guard.test.ts` (census allowlist with reasons); the Stage 4 door guard
    lost three allowlist rows. Typecheck clean.
    - **Builder's calls:** (1) `user-contexts` stays on the door (allowlisted in spirit: it already folds grants, and a
      portal grant and its entitlement end at one instant); (2) a team MOVED into its club (mig 313/351: workspace left
      `active`, org cancelled, entitlement cancelled) now reads NOT in force, so its free twin is the coach's again
      instead of redirecting into the dead portal; (3) the Clubs list keeps a free-time portal in the list and search,
      out of the Cancelled count and filter only.
    - **⚠ Found: migration 406 as written collides.** Dev has 3 portals that are `source='platform_admin'` +
      `platform_override` TODAY (comped/Founding), so "one staff-given portal per coach" keyed on `source` would mark
      them as free-time portals. Part 3 needs its own mark (the portal grant, or a dedicated column). Also logged for
      `/review`: the club billing takeover (`canTransferBillingMode`) accepts a `platform_override` portal, i.e. one on
      free time.
    - **Resume at Part 3** (the give), with the migration redesigned first.
  - **Part 3 BUILT 2026-10-27 (committed `66da38203`).** Migration **406 redesigned and applied to dev**:
    `team_workspaces.free_time_given_at` (set once by the give, never cleared) is the portal's own mark and the anchor
    the limits are measured from; two partial unique indexes on it (one staff-given portal per coach, per free team).
    Keyed on the mark, so the 3 comped/Founding `platform_admin` portals are untouched. Visible to the drift check (a
    column), so no MANUAL_PROD_STEPS entry; prod step = apply 406 before the promote that ships Part 3. Dictionary +
    snapshots refreshed. Code: `lib/portal-free-time.ts` (pure: caps from the first give, the sixth-in-7-days rule, the
    nine absent-door lines `portalGiveBlockOf`, `decidePortalGive`, `portalChangeRefusal`); `lib/portal-free-time-give.ts`
    (server: `readPortalGiveFacts`, `givePortalFreeTime`, a later give `giveAgain`, `changePortalFreeTimeEnd`,
    `endPortalFreeTimeNow`, `readFreeTimePortal`); `provisionStandaloneTeamWorkspace` gains `freeTime` (grant right after
    the organization, entitlement `ends_at` in its insert, the mark, reminders off, a lost claim throws and rolls back,
    the start door kept); routes `POST /api/platform-admin/people/[id]/portal-free-time` and `PATCH|DELETE
    /api/platform-admin/orgs/[id]/portal-free-time/[oid]` (both `portal_free_time`); `freeTimePortalOrgIds` reads the
    mark. Guard `tests/unit/support-console-stage4b-give-guard.test.ts` (36); T15 import scan covers the give file.
    Dev read-only probe `.probe/pasc/s4b-give-facts.mjs`: every fact query runs; Frankie Okafor reads one unclaimed
    free team, no portal (fixture left untouched for the walk).
    - **Builder's calls:** a coach with ANY portal other than their staff-given one (paying, comped, Founding,
      club-billed, cancelled) gets no door, coach-level (the drawn lines 1–5); a comped non-Founding portal gets its own
      line ("already free from FieldLogicHQ"); line 3 and line 5 drop the drawn date/club name (not read cheaply);
      line 4 drops "or change the end of the first" (an ended grant has no end to change); the give normalizes the free
      team's sport label ("Baseball") to the sport id; the free-team giver check is any active membership (free-team
      membership is role-agnostic) plus the wide own-club check on each of the coach's portals.
    - **Found and fixed:** Stage 4's club "End it now" (DELETE `orgs/[id]/overrides/[oid]`, `club_billing`) would revoke
      a portal's grant and leave its entitlement running (a half-end the per-team gate would not see); it now refuses a
      free-time portal and points to the portal's own Access list.
    - **Residual (named):** the database rule does not cover a give racing a paid checkout for the same coach (liveness
      moves with the clock; the application check holds it). Guard 4 (stop between each step) is proven by order + the
      cascading rollback in source, not by a live stop on the database.
    - **Owner ask:** "measured from the first give" (Q5) means a second give more than 6 months after the first is
      impossible for anyone, Super admin included. Built as ruled; confirm that is meant.
    - **Resume at Part 4** (the console: the person record's Coaches Portal tab + window, the portal record's chip,
      band, Access list, Story, Put it back; Today and the Free time list).
  - **Part 3 committed `66da38203` and Part 4 committed `856fc9caa` 2026-10-28 (owner OK).**
  - **Part 4 BUILT 2026-10-27.** The person record gains the "Coaches
    Portal" band figure (opens the tab) and tab (free teams with players/events/fees, tournament entries, created; Premium
    portals with their state; the door or one of the nine lines, decided by `portalGiveBlockOf` on the give's own facts:
    `lib/portal-free-time-tab.ts`). Shared windows `app/platform-admin/orgs/[id]/PortalFreeTimeWindows.tsx` (Give, a later
    give, Change the end date, End it now; the date field greys past the cap from the first give). The portal's record: chip
    "Free time" + "Premium free through …", band (Tournaments "hosting is not part of free time", Free time "ends … · n days
    left", Billing "Free through … · Given by staff, no Stripe subscription"), its own Access section, its own windows. Story:
    portal words for given / changed / ended early / ended by itself, plus "Coaches Portal created from the free team …" and
    "Free team brought across: …" (from the give's audit entry and the stored copy summary; never Put it back). Put it back
    has two new kinds `portal_end_now` / `portal_end` under `portal_free_time`. Today's sentence and the Free time list
    ("Club or portal" column, "Premium Coaches Portal") count a portal. The give returns the F2 shortfall line. Guard
    `tests/unit/support-console-stage4b-console-guard.test.ts` (21); Stage 2's Put it back guard now names six kinds.
    Typecheck clean (whole tree); 293 related tests pass; spelling clean. Dev smoke (read-only, `.probe/pasc/s4b-console-smoke.mjs`):
    Frankie's tab, band and Give window render; a Founding portal keeps its own Access row; no page errors, no overflow.
    - **Found and fixed:** Put it back on a portal's "given" entry would have gone through the CLUB override end (grant
      revoked, entitlement left running, the same half-end Part 3 fixed on the club DELETE). The Story now gives a portal
      its own kinds, and the route also refuses a club override end on a free-time portal. Stage 4's retired amber line
      ("can't be given free time yet") now says where a portal's free time is given.
    - **Builder's calls:** (1) the status chip on a free-time portal reads "Active" while it runs and "Free time ended"
      after (the drawing said "Active" after the end; the stored status is cancelled; neither "Active" nor "Cancelled" is
      true then); (2) while free time runs, the portal record's Give door is absent with the drawn sentence as a line
      (absent beats a door that only refuses); (3) the F2 shortfall shows as an amber note with "Open the portal" on the
      person record after the window closes, not as a second window state; (4) a paying, Founding or comped portal's record
      keeps Stage 4's Access list, door-less (the reasons live on the coach's tab); (5) "brought across" and "created" only
      on a portal staff gave free time; (6) drawing A's line 7 ("Read only: this role sees the tab…") is a note, not
      shown. Not drawn, still owed at the first walk: Premium home band, welcome, "check these" notice.
    - **Not live-tested:** the portal record's Story, Access row and windows with a running give (Frankie's fixture is left
      untouched for walk A; a one-day give on a scratch coach is the way to see it end).
    - **Resume at Part 5** (the coach's Plan & billing states, the free Overview's day-after band), then Part 6 (Keep
      Premium, with `/billing`).
  - **Parts 5 + 6 BUILT 2026-10-28 (not committed; owner OK owed).**
    - **Part 5 · the coach's screens.** Pure state + words in `lib/portal-free-time.ts` (`portalCustomerFreeTime`:
      running / ending (last 14 days) / ended (30 days), from the portal's newest billing-status grant;
      `portalFreeTimeCopy`: the gate's copy table 1–7 verbatim; `KEEP_PREMIUM_LINE`, `PORTAL_FREE_TIME_HOSTING_LINE`,
      `PREMIUM_WORK_SAVED_LINE`). Server reads in `lib/portal-free-time-server.ts` (`customerPortalFreeTime`,
      `savedFreeTimePortalOfTeam`; only a staff-given portal still `platform_override`; the grant's select is
      `starts_at, expires_at, revoked_at` only, T24). `/api/admin/org/free-time` answers a team workspace with `portal`
      alone. Plan & billing (`app/[orgSlug]/admin/org/billing/page.tsx`): price line → "Free through…" + sub line;
      tagline without its hosting clause; meta line ends with the hosting line; the band; Billing card "No billing
      action needed…"; Payment method & invoices, Cancel Premium and Tournament slots not rendered; Keep Premium card
      (owner only, lime, 44px, full width on a phone); Join a club outlined. Free Overview: the day-after band above
      "Your tournament" (reuses the Stage 4 band), and the Scope shelf's added line while the portal is saved.
    - **Part 6 · Keep Premium.** `lib/portal-keep-premium.ts`: `findKeepPremiumPortal` (the coach's staff-given portal,
      named by the checkout: the billing page's slug or the free team's id; never a tournament claim) and
      `convertFreeTimePortal` (compare-and-set the billing mode `platform_override` → `team_direct` with the Stripe
      ids; then the organization's stored ended state cleared; then a running grant revoked with a `revoke_override`
      audit entry `{ portal, subscribed }`; LAST the entitlement → `team_plan`, `ends_at` null; then a `keep_premium`
      audit entry + `subscription_started` event on the fresh claim only). A repeat delivery of the same subscription is
      taken again only while an end is still on the entitlement, so a stop halfway is repaired and later Stripe events
      take the ordinary path. Wired into `provisionTeamWorkspaceFromCheckoutMetadata` BEFORE the owner-live guard, the
      reactivation and the fresh provision; the checkout route lets the coach's own free-time portal through
      (`existingPortal.workspaceOrgId !== keepPortal?.orgId`) and never takes the Founding comp path for it. The start
      page reads "Keep Premium" + the reviewed line (`&keep=1`). Story: "Free time ended: the coach chose Premium",
      never Put it back.
    - **Guards:** new `tests/unit/support-console-stage4b-coach-guard.test.ts` (25); the T15 import scan now covers
      `lib/portal-keep-premium.ts`; census allowlist +1 (a writer's repair check, not a liveness read); door guard +1
      (`portal`); the account-first pin follows the Founding line. 497 related tests pass; typecheck clean (the only
      errors are another session's `league-game-generator` test); lint clean on changed files; spelling clean. Dev
      probe `.probe/pasc/s4b-coach-reads.mjs` (read-only): every new select chain runs; dev has **0** staff-given
      portals, so the screens were NOT rendered live.
    - **Builder's calls (show the owner at the walk):** (1) Plan & billing after the end (not drawn): the plan card
      without a price, the chip "Free time ended", the ended band (copy 6, one wording), and Keep Premium under the
      same name; never "cancelled", retention or Reactivate. (2) Keep Premium rides the reactivation route with
      `keep=1`; the start page says "Keep Premium" + line 5. (3) A coach whose free time runs and who starts a checkout
      for a DIFFERENT team (not named) is still refused as "already has a Coaches Portal". (4) Reminders to families
      stay off after Keep Premium (the coach turns them on). (5) The Story entry is kind `billing`, "who" the coach.
    - **Owner / `/billing` asks:** (a) the Keep Premium checkout still adds the plan's ordinary Stripe trial on top of
      free time (gate step 5 said "nothing else changes", so it was not touched) — keep or drop? (b) a stop between the
      entitlement write and the `keep_premium` audit entry leaves the Story's "chose Premium" entry but no
      `keep_premium` audit row (named residual).
    - **Not proven live:** pay-before-end, pay-after-end, cancel-then-resubscribe (guard 11) are proven by source and
      order only; prove them in walk C on a scratch coach with the mock checkout.
    - **Walks WRITTEN 2026-10-28 (owed to the owner):** §414 A give + end by itself
      https://claude.ai/artifact/25n21n9VmtFMMZ6ysWGuJJ · §415 B refusals https://claude.ai/artifact/3TErAyK1Zv7s1UfQGCajkH
      · §416 C Keep Premium https://claude.ai/artifact/G6iXm9QvjKSKN88eNms2xb (sources `…_STAGE4B_WALK_{A,B,C}.html`;
      §408–§413 belong to house league). Found while writing, for `/review`: **a Super admin can delete a portal on free
      time** (`orgs/[id]/delete` refuses only a live Stripe subscription); the staff Cancel door is hidden on a free-time
      portal so its refusal is never seen; Stage 4's amber line cannot render on a portal record (`freeTime` passed null);
      12 kinds of absent-door line, not nine. Owner call 1 restated: Premium has NO trial (code + Facts + dev overrides),
      so the real question is whether the first charge waits until the day after the last free day (recommended B).
    - **Resume:** walks A/B/C (`/design` first, checkable Artifacts, matching ledger §s), records (PM brief, TODO,
      `PROGRAM_BILLING_AND_ENTITLEMENTS.md`, design_decisions for the builder's calls), `/docs`, `/simplify` → `/review`,
      `/billing` drift check, `/strategy`, the index `stages/s4b`, a dev-server restart (new file), then the commit.
  - **The ending reminders, BUILT 2026-10-28 on the owner's word ("go with b"; reverses Q7's "no email"):** the Overview
    band for the last 14 days and two emails to the portal's owner at 14 and 3 days (`lib/portal-free-time-reminders.ts`,
    daily job `portal-free-time-daily`, mig 407 columns, mig 408 schedule; logged kind "Free time ending"). `/simplify` +
    `/review` ran the same day. Fixed in review: a send that threw left the stamp unreleased; the 14-day email first
    fired at 13 days left; the claim ignored a Keep Premium that landed first; the release could undo a newer stamp; the
    checkout could add a Stripe trial for a keep portal; the `keep_premium` audit entry had no reason and the daily job's
    audit row read "Not recorded". **Open for the owner:** portal delete while free time runs; who sees the Overview Keep
    button (head coach versus the portal's owner); Keep Premium after the 30-day window; the Stripe webhook gaps Keep
    Premium reaches (a second subscription left live, `past_due` not synced, conversion on an incomplete status).
    Prod: mig 407, then 408 once the code is serving.
  - **`/strategy`, done 2026-10-28:** logged in `BUSINESS_DECISIONS.md`; `PLAN_PRICING_FACTS.md` line 124 updated. The naming
    canon still ratifies "Basic Coaches Portal" for the free tier while the product says "free Coaches Portal".

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

## Stage 10 findings (a helper's census of 2026-10-27; ✔ = re-checked by hand the same day, the rest NOT yet)

Owner's questions, 2026-10-27: how easy is it to set up a new subscription model, change prices (and what workflow
follows: marketing, emails to existing customers, timing), change trials, and sync with Stripe? The owner ruled this its
own stage and ruled a **full plan builder out** ("a rare occurrence"); a checklist is wanted.

- **Prices are code-only.** Plan names, prices, bands, limits and trial days live in the plan config; about 65 files read
  it, so display surfaces follow. The DB holds the gating switch, a small override (tournament limit, seat limit, trial
  days only) and the Stripe price slots, never a dollar amount.
- ✔ **Stripe price IDs are rows pasted in by hand**, one per plan, cycle and environment (sandbox or live, chosen by the
  key's prefix). Nothing in the app creates a Stripe product or price (searched for create calls: none). The console
  checks a pasted price against Stripe (hard-blocks inactive, one-time or wrong-interval; only WARNS on a wrong amount).
- ✔ **The webhook finds a plan from the price ID alone** (`getPlanFromPriceId`, no environment). **Swapping the ID in a
  slot orphans every subscriber on the old price.** Keeping existing customers safe today depends on someone knowing to
  keep the old row. No runbook exists. (Report-only finding: nobody pays today, so nothing is broken yet.)
- ✔ **Trial days are applied at checkout only** (`trial_period_days`), withheld when the customer has had a subscription
  before. Length is changeable without a deploy through an approval request. No per-customer or per-promotion trial.
  Stripe owns when a trial ends; there is no cron.
- ✔ **Pricing promos recorded in Plans & pricing (the `platform_catalog_campaigns` table) are read by nothing at
  checkout** (only the Plans & pricing page and its own route touch the table). A "trial" promotion records but does
  nothing. This is the shown-versus-enforced rule (R7) and belongs on the ladder as a found-along-the-way. No coupon or
  promotion code reaches checkout either.
- **No price-change handling for existing customers:** no price kept on the club, no grandfathering, no effective date,
  no price-change email. Request types for pricing, grandfathering and trial exist in the approval queue only as labels.
  The owner's decisions log rules "no grandfathering" for the invite-only event and notes there are no paying customers
  to grandfather. The Founding lock-in price is dormant. (Not re-checked.)
- **No guard ties plan prices to `PLAN_PRICING_FACTS.md`.** The only tests that read the Facts doc check the online-payment
  fee rates. Agreement is a manual checklist at the bottom of the Facts doc. A help article is reported to hardcode a
  price (not re-checked).
- ✔ **`docs/agents/ops/stripe-setup-guide.md` is stale:** it still describes Pro and Elite plans and `STRIPE_PRICE_*`
  settings that no app code reads. Rewrite or retire it in this stage.
- Plans & pricing and the Approval queue exist and work as a request-and-approve loop for gating, price-ID swaps and
  config overrides. It is a 2,800-line client screen; prices and plans cannot be edited from it.

**What else a person who runs pricing would want (raised 2026-10-27, recorded here so the drawings session covers each;
none is ruled, each is an ask or a drawing, not a given).**
1. **Notice and consent for existing customers:** how much notice, and whether any Canadian consumer or tax rule applies
   to these plans. The owner checks that with their advisor; the plan asserts no law. Drawn in B and C; ask 1.
2. **Sandbox and live Stripe parity:** the same product must exist in both, and they drift apart easily. Drawn in A and E.
3. **Monthly and annual:** one price change touches both cycles; a plan may have only one. Drawn in A and B.
4. **Upgrade and downgrade rules:** what a customer is charged when they move mid-period, and what they are told. New
   drawing K; ask 11.
5. **Failed payments and win-back:** what happens when a card fails (the reminders, how long a club keeps access), and
   whether there is a returning-customer offer. New drawing K; ask 11. Check what Stripe and the webhook already do before
   drawing anything.
6. **Add-ons and the Coaches Portal:** each has its own price and Founding rules. In or out of the workflow is ask 8.
7. **Promo codes at checkout:** wanted or not, and how they stack with free time. Drawing G; ask 4.
8. **Founding Season's dormant lock-in price:** what happens to it at a price change. Ask 6.
9. **A price-agreement build check:** fails when the strategy doc and the plan config disagree (none exists today). In
   the checklist drawing F; ask 7.
10. **A trial-end report:** how many trials ended, converted or lapsed, read live. New drawing K; ask 11. Shares its
    definition of "converted" with Stage 7's numbers; do not define it twice.
11. **Stale setup guide:** rewrite or retire the Stripe setup guide (it describes plans that no longer exist). Ask 9.
12. **Also draw, from the owner's questions:** a **rollback** (what undoing a price change does and does not undo) and a
    **record of what changed, who approved it and when** (drawing B and H).

## Frame J rulings and Part 8 (2026-10-27) — the public form, built as drawn

Drawing J (https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM, "J · Public form"; source `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html`) was drawn,
passed `/design` (8 defects, 7 fixed; the shipped coach title is Inter 800, kept) and the owner said **"go ahead as drawn"**: every recommended
option of questions 12-16.

- **Q12:** both public forms (the early-access form and the coach "Express interest" form) gain an optional "How did you hear about us?" — last,
  "Choose one" first, no star, the eight /marketing choices (`lib/lead-form-answers.ts`).
- **Q13 A:** the visitor's answer fills the lead's Source only until staff set one; "From the form: …" always shows under Source; the Link row sits
  under Arrived from. The pencil's empty option reads "{source} (from the form)" and keeps staff's own source null until staff pick one (a builder's
  call: drawn as "selected", built so an unrelated save cannot turn the form's answer into staff's).
- **Q14 (all three):** a yes never replaces a no on any lead; **a withdrawal (box unticked) always lands, even on a worked lead** (the one place the
  drawing differs from the Q10 ruling as first worded); Arrived from, the first tag and the first browser never move. Timeline notes an unapplied
  yes ("Ticked yes to release emails. The lead still says no.") and a withdrawal ("Unticked release emails. The lead now says no.").
- **Q15:** By link tag lists "No tag" first once any lead in the period carries a tag (Part 7 left untagged leads out); the Link tag filter appears
  only once a tag exists; starting tags (examples, **the owner's real list is still owed**): spring-mailout, conference-booth, club-newsletter,
  deck-follow-up. A tag is cut to **32** characters (the database's limit; the drawing said 40, "a builder's number") and kept only from the list.
- **Q16:** two error sentences: the house throttle sentence, and the new "We couldn't save your request just now. Please try again in a few minutes."
  (customer copy: **goes to /marketing before release**).
- **Built, committed `cdc67caea` 2026-10-27 (`/review` done, privacy lens on the public route):** mig **402** `early_access_lead_submissions` (applied to dev; prod at the release with 398); `lib/lead-form-answers.ts`
  (the lists, pure), `lib/early-access-refill.ts` (the rule, pure — BOTH writers call it: `app/api/early-access/route.ts` and
  `lib/basic-coach-interest.ts`); the route is throttled with `throttlePublicForm`, answers a database error with a fixed sentence (the cause goes to
  the error log), and answers a known and an unknown address identically; `lib/ref-tag-client.ts` + `components/RefTagCapture.tsx` (root layout) keep `?ref=`
  in the tab's session storage, no cookie. Guard: `tests/unit/support-console-stage7-part8.test.ts` (23 tests); threats 4, 10 and 16 are now guarded in
  `support-console-stage7-guard.test.ts`. Dictionary documents the new table.
- **Findings, not fixed here:** the early-access form's updates box starts ticked, and the coach form sends no box but a new lead is saved as a yes; the
  form already stores the browser's user-agent text on every lead; the throttle is best-effort per instance (the captcha stays a later pass).
- **Review fixes made before the commit:** the lead form has its OWN throttle buckets (it shared the family registration forms'); a lost first-insert race reads as a known
  address; the refill row is written after the lead update and a missing one is logged, never shown (so a known address answers as an unknown one even before
  402 reaches an environment); NUL and lone surrogates are cleaned; a blank box never wipes earlier words; the leads export gains "Source recorded by".
  **Open design call for the owner:** a stranger who knows an unworked lead's address can overwrite its words (the replaced words are not kept); the rule as
  ruled says "takes the visitor's new words". **Release gate:** the public route and the coach button now read 398 columns and 402, so BOTH migrations go to prod
  BEFORE this code does.
- **Owed:** the walk (a tagged link, the question on both forms, a refill on a worked lead, a withdrawal), `/docs`, `/marketing` for the two sentences, the owner's tag list, prod: apply 402 with 398 at the release. Two other sessions have uncommitted edits in
  `components/EarlyAccessForm.tsx`, its css and `EarlyAccessModalTrigger.tsx` (the confirmation swap): commit Part 8's hunks only.

## Stage 7 findings (verified against the code and dev's data 2026-10-27, before drawing)

Three helpers read the code and ran read-only counts on dev; the lines each drawing turns on were opened by hand.
Drawings: `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html` (assembled from Stage 5's head/scripts by
`assemble-s7.cjs` in that session's scratchpad; captures `.probe/pasc/cap-s7/` via `capture-s7.mjs`; render
`render-s7.mjs`).

- **Dev has 0 leads** (`early_access_leads` empty). Every drawn figure is example data; the email-match rate cannot be
  measured on dev (a counts-only prod read is put to the owner, ask 2).
- **Today's campaign rows count retired campaigns.** `campaignAlerts()` (`lib/platform-waiting.ts:80`) reads every
  `platform_email_templates` row with category `marketing`; the Campaigns board filters to `LIVE_MARKETING_CAMPAIGNS`
  (`lib/marketing-email-defaults.ts:429`). On 10-27 Today showed "past due 5, due soon 1", all six retired spotlight
  emails. Fix = filter to `LIVE_MARKETING_EMAIL_KEYS` (ask 10).
- **Purchases ARE in `platform_events`** (`subscription_started`, `plan_upgraded`; `lib/platform-events.ts:7`) but only
  since commit `6de082f2f` 2026-10-25; not back-filled. Leads and their edit log (`update_early_access_lead` audit rows
  with before/after) both start 2026-05-20 (`19913af85`), so a lead timeline and every lead trend read live.
- **Three definitions/limits:** Leads' band counts the ≤100 loaded rows, opens filtered to New, and calls a lead
  converted on `converted_org_id || converted_at` (`EarlyAccessClient.tsx:126,182`); `getCommandCenterStats` reads the
  newest 5,000 and counts `converted_org_id` only (`lib/platform-metrics.ts:182,304`); the export caps at 1,000 and
  writes no audit row (`early-access/export/route.ts:48`).
- **One person = one lead:** `email_normalized` is unique and a re-submission updates the row (`submission_count`;
  `app/api/early-access/route.ts:66-111`). Only the latest submission is dated.
- **Linking:** staff pick from ≤1,000 orgs incl. sandboxes (`early-access/page.tsx:5-20`); "converted" refuses without
  a club (`[leadId]/route.ts:91`); a club can be linked without the step, and then `converted_at` stays null.
- **"Paying" rule already exists:** `lib/plan-growth.ts:43-52` (a Founding comp is active with no subscription id; only
  active/trialing with a live subscription count). Free time = `org_overrides` grants (`lib/free-time.ts`).
- **No source, no tags:** no utm/referrer anywhere; `source_path` = path + #hash; `metadata` jsonb has no writer; legacy
  `status` always 'new'. The public form trims lengths, has a honeypot, no rate limit, no captcha.
- **Latent public bug:** `/for-coaches` passes plan `coaches_portal` + features the server drops
  (`app/for-coaches/page.tsx:77-78` vs `app/api/early-access/route.ts:6-15`), so every submit 400s. Reached only when the
  team plan is gated (`checkoutOpen` false).
- **"Campaign" names two things:** the Founding Season email screen (12 labels) and `platform_catalog_campaigns`, a
  promo list in Plans & pricing linked to nothing (8 labels). Neither touches leads.
- **Pitch decks:** own stylesheet; `/pitch/[slug]` records nothing; `pitch_page_pulls` = which slides a walkthrough
  shows, not views. Two public slides print "9 AM"/"9 PM" (`lib/walkthrough-content.ts:552,613`).
- **Business numbers** is open to every role, not in the menu; its snapshot button writes `platform_metric_snapshots`
  rows that nothing reads back. Retention = kept data, not churn.
- **Route rename cost:** early-access 8 code places, email 8, pitch-deck-studio 4 (+ help, docs). Recommend labels only.

## Stage 5 findings (verified against the code and the AWS, Supabase and Resend docs 2026-10-26, before drawing)

Four helpers read the code and one read the providers' current docs; the lines each drawing turns on were opened by hand.
Drawings: `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_DRAWINGS.html` (assembled from Stage 3's head/scripts + a Stage 5 body;
captures `.probe/pasc/cap-s5/` via `capture-s5.mjs`, render check `render-s5.mjs`).
- **The morning check** (`scripts/stack-health.mjs`, `scripts/lib/supabase-ops.mjs`) reads Supabase with ONE account PAT
  (`SUPABASE_ACCESS_TOKEN`, both projects; `/database/query` runs any SQL, only `sql()`'s select/with check keeps it to
  reading) and Amplify with the PC's AWS CLI login (`list-jobs`, app `d3ld0l2bgmmlga`, branches `dev` = staging and
  `master`). No CloudWatch. Its extras over a live read are all history: 7-day medians, size vs a week ago, advisors new
  since the last run, heaviest-query deltas, alert de-dup, the Monday digest. Nothing in `app/`/`lib/` reads `.health/`.
  Report-only findings: the 2026-10-26 run could not check either build (AWS CLI failed); the alert falls back to
  `RESEND_API_KEY` when `HEALTH_RESEND_API_KEY` is unset (`stack-health.mjs:488`), against its own comments.
- **Keys.** AWS: `amplify:ListJobs` is resource-scoped to `apps/<id>/branches/<b>`; `GetJob` returns `steps[].logUrl`
  (a log can echo env), so the key must hold ListJobs only. Prod already has a narrowly scoped IAM user for club domains;
  Amplify's SSR compute role exists (2025) but is unproven on Next 16 (a re:Post report). Supabase: scoped PATs exist
  (per project, read or read-write per area) but belong to a person and share the user's 120/min limit across all their
  tokens (`logs.all` 30/min). Project health, advisors and logs need a Management token; the metrics endpoint takes the
  secret API key. DB vitals and `cron.job_run_details` need NO key: one SECURITY DEFINER read function (Stage 2 shape).
- **Our own data.** `request_metrics_rollup` (5-min buckets, kept a year, `org_id` always null), `error_events`
  (30 days; sampled: all up to 50, then 1 in 10; stores `user_id` AND `user_email`, plus IP/UA for browser errors, never
  shown), `observability_cron_heartbeat`. No latency is recorded anywhere. Coverage: 591 of 616 `route.ts` wrapped (575
  direct + 16 through `lib/coach-tag-routes.ts`); the unwrapped 25 are dev/sandbox/collector/manifest routes. The rate
  divides API failures by API calls; page and browser errors have no denominator (why the screen shows 0.00% beside 64).
- **Clock drift.** Errors and Feedback print `06:18 p.m.` (`fmtDateTime`); the console elsewhere prints `5:52 p.m.`. The
  spelling gate misses the leading zero.
- **Browser errors fingerprint by `window.location.pathname`** with real ids, so one fault splits per season. Not drawn.
- **Email.** Every send goes through `lib/email.ts` `sendEmail`/`sendEmailBatch` (~53 + 2 direct calls; wrappers
  `sendTransactionalEmail` ×25 and the family senders ×6) or `lib/email-sender.ts` `sendMarketingEmail` (campaigns, ×5,
  the only logger, `email_sends.resend_message_id`, no delivery state). The only bypass is the stack-health alert. The
  shared sender returns no message id and writes no row. Auth links are `generateLink` + our sender (Supabase sends none).
  From: `RESEND_FROM` (prod `noreply@fieldlogichq.ca` per `AMPLIFY_DEV_ENV_PLAN.md`), default `onboarding@resend.dev`;
  `ADMIN_EMAIL = fieldlogichq@gmail.com` (`lib/email.ts:40`). No webhook route, no svix dependency; `/api/*` outside
  `/api/admin*` passes `proxy.ts` unauthenticated (the connect-webhook route is the cleaner pattern: 503 without the
  secret, dedupe table). Resend: webhooks Svix-signed, retried ~1 day, dedupe on `svix-id`, order not promised; `GET
  /emails/{id}` has `last_event`; 10 req/s per TEAM shared with sends; dashboard keeps 30 days; `tags` round-trip;
  `Idempotency-Key` 24 h.
- **Feedback.** `feedback_submissions` only: no reply/thread/notes; anonymous allowed (all ids null); signed-in rows keep
  `user_id` + `user_email`; states new/triaged/acknowledged/resolved in code only (no CHECK); Today counts `status='new'`.
  No item page (list + disclosure). A "we received your feedback" email already goes out, unlogged.
- **Powers.** No status/health power; `errors_triage` = super, product; observability view = super, product, support;
  feedback view + triage = super, product, support, billing; `customer_users` viewable by ALL roles (staff records super
  only), so the Errors person link grants no new view. Reply and the sent log each need a new power.

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

## Stage 7 loose ends (2026-10-27; owner: "go ahead with the loose ends", then four answers)

Rulings (owner, in the conversation): (1) a club older than its lead says so ("This club already existed: it was created on …") and is **left out of Time to sign up**, still counted Signed up; (2) Month by month gains **"started a subscription"** for each month from Oct 2026 (the first month counts starts only from Oct 25; earlier months show nothing); (3) "asked not to be contacted" becomes a **lasting mark** (mig 404, `do_not_contact_at`), lifted only by **Allow contact again**; (4) the Audit log's older whole-lead entries are **rewritten** by mig 405 before 398 reaches production.

Built, dev only (migs 404 + 405 applied to dev 2026-10-27; 405 proved on a synthetic old-format row, since removed): the picker shows a refused hand link inside its window; `clubPredatesLead` / `daysToSignUp` null for an older club; `readPaying(…, { started: true })` reads `platform_events.subscription_started` since `PAYING_RECORDED_FROM` (moved into `lib/lead-numbers.ts`); the export gains "Month by month: started a subscription" rows; `allowContactAgain` + `/early-access/[leadId]/allow-contact` + the notice and window on the lead page + the timeline line + audit registries (`allow_early_access_contact`); help (Part 8 answers, link tags, second form, lasting mark, Month by month); dictionary; MANUAL_PROD_STEPS for 404 and 405 (prod pending; 405 before the promote that ships Stage 7). Guard `tests/unit/support-console-stage7-loose-ends.test.ts`.

Calls made while building (to the owner): the hand-link refusal for a lead **Lost** for that reason is unchanged (a lead whose step moved on can now be linked and keeps the mark); "started a subscription" counts a club's OWN subscription event, so a Coaches Portal billed through its club shows none; the Part 8 error sentence ("We couldn’t save your request just now. Please try again in a few minutes.") matches the house wording used by the families and venues routes, so no change.

**Link tags (owner, 2026-10-27): ship with the list EMPTY.** The four placeholders (spring-mailout, conference-booth, club-newsletter, deck-follow-up) are removed from `LINK_TAGS`; By link tag stays hidden until a tag is added, and a tag is added (one line plus its label) before the link that carries it goes out. **Still owed:** a walk of the lasting mark and Allow contact again; /review of this diff; commit (partial: `LeadRecord.tsx`, `LeadsScreen.tsx`, `business-numbers/page.tsx` carry another session's hunks).
