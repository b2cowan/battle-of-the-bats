# Dues adjustment breakdown

Approved 2026-09-12: implement the [reviewed mockup](COACH_DUES_ADJUSTMENT_BREAKDOWN_MOCKUP.html), including the section-level Add adjustment action and individual Edit controls. Owner QA follow-up: §160.

## Scope

- Preserve original installments; show adjustments and forgiveness separately, followed by the existing net Dues figure.
- Move the manual creation action out of Other credits; retain it in an empty adjustments section for coaches with money-write access. Existing permissions, edit/delete safeguards and adjustment ceilings remain authoritative.
- Make drawer, narrow-screen receipt and family statement explain the same original-to-net bill. Split actual credit rows consistently and account explicitly for historical adjustments no longer reducing dues after payouts.
- Align the roster summary's bill/credit presentation with the same convention where its existing data supports it.
- Preserve persisted records, family balances, installment allocation, collected money and report revenue calculations. No migration.

## Work and validation

- [x] Shared, cents-based presentation breakdown with regression coverage for multiple adjustments, forgiveness, no adjustments, own-money credits and historical payouts.
- [x] Drawer actions, rows, receipt and form language; family-statement builder and PDF rendering; relevant help copy.
- [x] Review roster summary consistency without replacing concurrent work.
- [x] Focused lint, relevant dues/PDF tests, typecheck and relevant static gates.
- [x] Restart dev server and check login health.
- [ ] Owner browser walk: add two adjustments, edit one, remove one, empty/read-only states, compare drawer/receipt/family statement.

Browser and visual verification are owner-owned. Product implementation is tracked here; the earlier mockup is a design artifact, not evidence of working application behaviour.

## Build note - 2026-09-12

Implemented in the Player Dues drawer, family statement builder/PDF, roster dues summary, and help copy. Verification: typecheck; full unit suite (3,603 tests); focused lint (0 errors, existing warnings only); `check:money-report`; `check:pdf`; `check:css-purity`; `check:css-selectors`; `check:spelling`; dev-server restart; login health HTTP 200 with no `EACCES` in the logs.
