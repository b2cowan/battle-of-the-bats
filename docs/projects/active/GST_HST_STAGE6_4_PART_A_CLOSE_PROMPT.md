# GST/HST 6.4 Part A — simplify, review, commit, then write Part B's resume prompt

> Written 2026-11-13 by the Part A build session. Run as ONE fresh session on `dev`. Plan of record:
> [GST_HST_STAGE6_4_BUILD_PROMPT.md](GST_HST_STAGE6_4_BUILD_PROMPT.md) — read its **Progress** block first (the hand-over notes,
> the test-mode answers, the open calls). Do not re-litigate the rulings in its §2.

## 0. Before anything
- `git rev-parse --abbrev-ref HEAD` must be `dev`. Other sessions share this working copy: **never** `git add -A` / `git add .`.
- Part A is built, NOT committed. The build lives in exactly these files:
  - **New:** `lib/purchase-details.ts`, `lib/purchase-details-server.ts`, `lib/owners-send-outcome.ts`,
    `supabase/migrations/478_a_purchase_is_told_its_details.sql`, `tests/unit/gst-hst-6-4-purchase-email.test.ts`,
    `docs/projects/active/GST_HST_STAGE6_4_PART_A_CLOSE_PROMPT.md` (this file).
  - **Whole-file ours:** `lib/notify-recipients.ts`, `lib/supabase-admin.ts`, `lib/online-payment-owner-notices.ts`,
    `lib/billing-retention.ts`, `lib/plan-ending-server.ts`, `lib/billing-webhook-handler.ts`, `lib/platform-email-templates.ts`,
    `lib/email-kinds.ts`, `lib/email.ts`, `lib/fieldlogichq-contact.ts`, `lib/legal-acceptance.ts`, `lib/charge-tax-record.ts`,
    `lib/plan-growth.ts`, `lib/next-season-choice.ts`, `lib/plan-move.ts`, `app/api/billing/create-checkout/route.ts`,
    `app/api/billing/create-team-checkout/route.ts`, `app/api/billing/choose-next-season/route.ts`,
    `app/api/billing/move/route.ts`, `app/api/platform-admin/stripe-fees-daily/route.ts`,
    `tests/unit/support-console-stage5-guard.test.ts`, `tests/unit/billing-location-every-path-guard.test.ts`,
    `tests/unit/club-stage1-server-guard.test.ts`, `tests/unit/team-checkout-customer.test.ts`,
    `tests/unit/workspace-move-money.test.ts`, `tests/unit/plan-reader-door-guard.test.ts`,
    `tests/unit/workspace-flip-guard.test.ts`, `docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md`.
    **Verify each with `git diff <file>` before staging** — if another session has edited one since 2026-11-13, it becomes shared.
  - **SHARED (partial commit — only our hunks):** `TODO.md` (the "6.4 Part A … BUILT" clause on the GST/HST Stage 6 line),
    `supabase/migrations/MANUAL_PROD_STEPS.json` (the `478_…` entry only; the `479_…` entry is another session's),
    `docs/agents/db/DATA_DICTIONARY.md` (the four mig 478 entries + the guard-paragraph edit; the mig 479 `marked_at` entry is
    another session's), and the schema snapshots under `docs/agents/db/schema-snapshots/` (re-run `npm run refresh:snapshots`
    first; commit them only if the other session's 479 is already committed, else leave them for that session and say so).
    Use the temp-index method (memory: "Partial commit out of shared files") — never stage a whole shared file.
- `.probe/64/` is scratch: never commit it.

## 1. `/simplify` (the diff adds new shared helpers)
Run `/simplify` over the Part A files above. Things worth a look, not mandates:
- `orgOwnerEmails` (lib/notify-recipients.ts) vs. the online-payments `owners()` wrapper — is the wrapper still earning its place?
- The four every-owner send loops (webhook trial_ending / welcome_back, retention, plan-ending) — one shape or four?
- `lib/purchase-details.ts` holds rules, words AND the once-only run: does the run belong in its own file?
- `purchaseDeps().build` in lib/purchase-details-server.ts is long; is any of it shared with an existing billing reader?
Keep behaviour identical; re-run `node --import ./tests/ts-resolver.mjs --test tests/unit/gst-hst-6-4-purchase-email.test.ts`.

## 2. `/review` (adversarial, money + email + auth-adjacent)
Point it at the same files. Make sure it pressure-tests:
- **Once only:** the claim on `purchase_email_at` vs. both paid events, the daily `purchase_emails` step, and the guard trigger
  (mig 478 re-creates `platform_charge_tax_records_guard` from 451 — diff the two function bodies; only `purchase_email_at`
  may differ).
- **The webhook must never fail because of the email** (`sendPurchaseEmailOrReport` swallows) and must stay silent on a replay.
- **Classifier edges:** a `subscription_update` invoice long after a move (the `flhq_plan_move: 'up'` stamp persists — a
  recorded known limit), a comeback that lands on a trial, a Premium invoice paid before its workspace exists (org_id null →
  the coach via user_id).
- **Every owner:** per-owner idempotency keys (Resend refuses one key for two addresses); the plan-ending outcome rule still
  counts `skipped` as sent (`skippedIsSent: true`), the purchase email does not.
- **Welcome back:** both webhook sends now require `!sub.latest_invoice`; confirm no paid comeback can get two emails or none.
- `getOrgOwnerEmail` now orders by `accepted_at` with `.limit(1).maybeSingle()` — every remaining caller still behaves.
Apply what survives. Then: `npx tsc --noEmit -p .` and `npm run verify:changed`.
**Known reds that are NOT Part A's** (other sessions' in-flight work, seen 2026-11-13; re-check, don't fix): account-first-signup,
billing-plus-tax-words (help-content), club-accounting-teams-guard, club-stage13a-doors-guard, coach-practice-plans-phone-guard,
kit-dialog-floor-guard, online-payments-card-dispute-screens ×2, org-billing-access-guard ×2, plan-billing-usage,
plan-reader-door-guard (tournament-online-payments), possessive-guard (PlayerGuardiansCard), public-tournament-stage6-walk ×3,
series-date-groups, support-console-stage3-guard, support-console-stage4b-inforce-guard, team-move-coverage, workspace-flip-guard
(console-money-sales-tax-wait, DeskNamedPage, kit-tournament-groups). **Any red that names a Part A file is ours: fix it.**

## 3. Accounting + legal before hand-off (CLAUDE.md)
The §6 words were reviewed 2026-11-13. Send `/legal` only the NEW sentences listed in the build prompt's Progress block (the
"your plan" / "your Coaches Portal" fallbacks, the two template descriptions) and the **"paid" conflict** (§6 says never "paid";
its own reviewed cancel sentence says "the period you've paid for"). Record what comes back as owner questions; don't rewrite
reviewed words yourself. `/accounting` only if `/review` changed what a figure reads from.

## 4. Commit (ASK THE OWNER FIRST — show the file list and the message)
- Code + tests + migration in one commit; message says what changes for customers (the purchase email, every owner, welcome back
  folded in) and that **mig 478 must reach prod before the promote** (MANUAL_PROD_STEPS has the verify queries).
- A second, docs-only commit for the record (build prompt Progress, TODO clause, dictionary hunks, this file) is fine.
- After each: `git show --stat HEAD` — only our files. Foreign file slipped in → `git reset --soft HEAD~1`, unstage it, redo.
- End the message with the attribution lines from the session's system reminder.
- Then update the build prompt's Progress line for Part A to "COMMITTED `<hash>` 2026-11-13" (positive fact, no "uncommitted"),
  and the GST/HST memory file + its MEMORY.md line the same way.

## 5. Write Part B's resume prompt
Write `docs/projects/active/GST_HST_STAGE6_4_PART_B_RESUME_PROMPT.md` for a fresh Sonnet build session and give the owner the
one-line paste (`execute @docs/projects/active/GST_HST_STAGE6_4_PART_B_RESUME_PROMPT.md`). It must:
- Point at the build prompt §4 (the yearly reminder, Québec), §6's reminder + Québec words, §7, and the Part A Progress block —
  restate none of it.
- Say what Part A left ready: mig 478's `renewal_reminded_for` on `organizations` and `team_workspaces`; the
  `yearly_renewal_reminder` template row (variables `subjectLine`, `headingLine`, `lead`, `moveDownLine`, `date`, `billingUrl`);
  the kind already in `lib/email-kinds.ts` (logged count is 57); `orgOwnerEmails` + `ownersSendOutcome` to reuse; the purchase
  email's "Charged today"/first-payment date that §4.1's "purchase email under 38 days before its first charge" rule reads (the
  record's `purchase_email_at` + `billing_reason`).
- Say what Part B adds: the `renewal_reminders` daily step in its own `run()`, its own `invoices.createPreview` row in
  `billing-location-every-path-guard.test.ts`, the `{ purchase: true }` option on `requireBillingLocation` (region check BEFORE
  the save), the census column, `billing_region_closed` in the move window's "Check again" exclusions, the Province notice in
  the address form, and the test-mode check that Stripe Checkout cannot take a Québec address.
- Carry the open items: §6's trial-preview tax question (answer it in Part B's test-mode work if a trialing subscription can be
  made without polluting dev, else leave it to the walk); the fee-invoice emails still going to one owner (recommended
  follow-up, owner's call); the "paid" ruling if `/legal` hasn't answered.
- End with: `/simplify` then `/review` offered, `/legal` + `/accounting` before hand-off, ask before committing, and then the
  6.4 walk as its own session (build prompt §8).
