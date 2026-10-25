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
**Stage 2 BUILT 2026-10-25 on dev** (walk https://claude.ai/artifact/GqozHVh1Bg2FLqSKEM78Xs, ledger §377; commits named in §377 once the owner OKs them). Migration 365 (the sign-in lookup + `platform_record_opens`) applied to dev 2026-10-25, prod pending as a release step. The gate found nothing beyond A1 that changes who opens or does what; every staff account on dev and prod is confirmed. What the build added to the drawings, all put to the owner as the walk's 13 calls: the menu counts sit beside the page that clears them (so a folded Customers group adds up to Today's), a reason on every person action, Confirm the email on the Account tab, Add an override kept on Access, the Money tab worded without a stage number, "due in the next 30 days" (the real window). Found on the way: the reset-link route mailed whatever email the request carried (now the account's own), a person delete took its email in the address (now the body, checked on the server), and the clubs list's unbounded read would have stopped at the database's default cap (now paged).
Leads re-verified against the code before drawing; what changed the drawings:
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
| S2 Find, menu, Today, record — **BUILT 2026-10-25 on dev, walk §377 owed** (drawings Ub7fXLh29SC34Zp4oqKUx1, walk GqozHVh1Bg2FLqSKEM78Xs) | Global Find (server-side, no 1,000 cap), menu by job, one rulebook (matrix = APIs), Today, a record with Story; a person record (new) | Find is a new read surface: drawn and reviewed as a security change. No proxy change. One migration: the read-only lookup over sign-in records |
| S3 Money | Stripe read on the Money tab, duplicate labels, refund (Q7), reason column in the audit log, bulk = single plan change, M6 | Migration (audit reason). Adversarial review on the refund write |
| S4 Free time | `plan_tier` grant (read-time revert, no cron), one window, Founding as a grant group, customer billing page shows "Free until", `comp_period` retired, server-side past-expiry check | Owner checks `ENTITLEMENT_GRANTS_ENABLED` on prod first. /billing for the customer pages |
| S5 Health | Status (reads on open), Errors restyled with a person link, Feedback reply, Sent email log + delivery callback | Read-only AWS + Supabase keys on prod (owner step). Q6: the stack-health summary, a shared automation change, own commit, only on the owner's word |
| S6 Club release jobs | Club web addresses list + quota, set up a club from a lead, H03 | Rides the Club release |
| S7 Growth & product | Leads, Campaigns, Pitch decks list, Plans & pricing, Approval queue, Templates, Export registry. H1 | — |
| S8 Records | Staff + roles (Q1, M3), audit search server-side (M4), Help | A role change is a security change, drawn first |
| S9 Company accounting review | The two walks over Bookkeeping: record a purchase, find a receipt, correct an entry, a period's spending, the accountant's package | Trigger: `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md` complete |

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

**Still open:** the prod `ENTITLEMENT_GRANTS_ENABLED` check (the owner's, before S4); the Bookkeeping page items for
that session (unchanged from 2026-10-24).

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
