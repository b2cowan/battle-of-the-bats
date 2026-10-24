# Bookkeeping B2 implementation verification

> Recorded 2026-10-23. Focused implementation verification and owner B2 browser evidence are complete.

## Delivered behavior

- Active latest expense revisions drive spend, category, purchase-tax-status and payment-source summaries. Business-use percentages apply to spend and purchase tax. Voided expenses leave active totals.
- Review filters isolate missing receipts, USD invoices with absent or invalid source/date evidence, personally paid expenses, and USD invoices. Missing-evidence work excludes voided entries.
- CSV and receipt-package routes accept the visible review filter along with period, category and search filters. Matching expenses retain every revision in exports and packages.
- USD source notes require a nonempty source plus a real `YYYY-MM-DD` date. Original USD amount and recorded CAD amount remain in each expense revision.
- Reimbursement movements are not represented as expense entries. The same expense remains counted once and separately identified as personally paid for later follow-up.
- The plan records the manual historical-receipt workflow. The separate B2 owner walk covers new report, evidence, export and backfill cases.

## Focused evidence

### Development QA data

On 2026-10-23, seeded three synthetic expenses dated 2026-10-23 under supplier prefix `B2 QA Seed 2026-10-23` in the development DSQL cluster, with two synthetic private PDFs in the development S3 bucket. The seed totals are $27.00 recorded spend, $1.00 pending purchase tax, $1.00 reviewed purchase tax, $17.00 personally paid and $10.00 paid by business card. The USD row stores USD $10.00, CAD $14.00 and `Bank of Canada rate 2026-10-22`.

The guarded, idempotent development-only command is `node --env-file=.env.local scripts/bookkeeping-seed-b2-qa.mjs`. It rejects any endpoint/bucket/region other than the recorded development resources, refuses partial/conflicting rows, and verifies the expected DB totals and receipt bytes. After the owner walk, the synthetic rows may be removed from the development workspace using the existing permanent-delete action; they must not be mixed with real expenses.

Command:

```text
node --import ./tests/ts-resolver.mjs --test tests/unit/bookkeeping-expenses.test.ts tests/unit/bookkeeping-export.test.ts
```

Result: 10 tests passed, 0 failed. Coverage includes latest revisions and voids, business-use adjusted spend/tax/payment totals, conversion source/date validation, missing evidence, filtered revision exports, invalid filters, and ZIP output.

Changed-file lint:

```text
npm.cmd run lint:focused -- app/platform-admin/bookkeeping/BookkeepingClient.tsx app/api/platform-admin/bookkeeping/expenses/route.ts lib/bookkeeping-expenses.ts lib/bookkeeping-export.ts tests/unit/bookkeeping-expenses.test.ts tests/unit/bookkeeping-export.test.ts
```

Result: passed.

Focused product consistency checks:

```text
node scripts/check-spelling-consistency.mjs
node scripts/check-css-module-purity.mjs
```

Result: both passed.

Type-aware verification:

```text
npm.cmd run typecheck
```

Result: passed.

## Evidence still required

The owner reported all 13 steps in [BOOKKEEPING_B2_OWNER_QA_WALK.html](../archive/BOOKKEEPING_B2_OWNER_QA_WALK.html) passed on 2026-10-23; the result is recorded in [BOOKKEEPING_B2_OWNER_QA_RESULTS.md](../archive/BOOKKEEPING_B2_OWNER_QA_RESULTS.md). The B2.5 expense-only gate is complete. Browser verification was owner-performed, not agent-performed.
