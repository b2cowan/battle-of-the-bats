# Bookkeeping B3 — fixture import adapter and review flow

Date: 2026-10-23. Status: stopped and archived by owner before completion. The fixture-only preview was implemented, but the proposed CSV v1 contract remains unaccepted by the Revenue workstream. No real Stripe exports were imported, no revenue movements were written, and no tax/recognition rules were applied.

## Outcome

Prepare a safe, reviewable first slice for Stripe financial movement imports while the source contract is still being settled. The owner can choose a CSV in the bookkeeping page; a pure browser-side adapter produces a preview of rows, validation issues, duplicate identities, and totals grouped by currency. The file is not uploaded. The flow has no database, network, Stripe, or posting dependency.

## Product experience

The owner-facing import flow is shown in [the review mockup](../archive/BOOKKEEPING_B3_IMPORT_MOCKUP.html) and implemented as a local preview on the private bookkeeping page. The owner selects a CSV, sees its environment and account scope, checks totals and row statuses, reviews blocked or repeated-in-file movements, and stops before posting. The current preview cannot query previously imported identities because no import store exists yet. No club, coach, family, or other platform role gains access; existing exact-owner page gating remains in force.

## Implementation tasks

1. Keep the B0 CSV v1 fields and dedupe key as a proposal; document that only Revenue can accept or revise source semantics.
2. Add a dependency-free CSV parser and preview validator for required fields, supported movement kinds, UTC timestamps, signed integer cents, `net = gross - fee`, and required links for reversals.
3. Detect duplicate movement keys within the selected file and against an optional set of already-imported keys. This remains preview-only; persistence and atomic posting are out of scope.
4. Add synthetic fixtures for a valid subscription sale, processor fee, refund, fee refund, Connect application fee, payout transfer, repeated key, malformed evidence and incomplete reversal link. Keep IDs and policy labels clearly synthetic.
5. Add an owner QA walk for the fixture preview and record progress and known limitations. Do not create a production mapping, revenue schema, database table, or Stripe API/event integration.

## Proposed preview rules

- Required B0 fields must exist in the header; optional B0 evidence/reference fields may be absent.
- `provider` must be `stripe`; `environment` must be `test` or `live`; version must be `1`.
- Movement kinds in this fixture adapter are `subscription_sale`, `application_fee`, `processor_fee`, `refund`, `fee_refund`, and `payout_out`. Unknown kinds are blocked for review.
- Movement identity is `(provider, environment, platform_account_id, connected_account_id, movement_id)`. Duplicate keys in the file or the supplied prior-key set cannot be posted.
- Amounts are integer minor units and use the B0 sign convention. `net_cents = gross_cents - fee_cents`; tax is included in gross. No tax treatment is inferred.
- `refund`, `fee_refund`, and `processor_fee` rows require a parent movement. Non-`posted` rows are previewed but blocked.
- Mixed currencies in one file are summarized separately, not combined into a meaningless total. Whether a live import may contain multiple currencies remains a Revenue contract question.

## Exit gates

This slice can be reviewed when the adapter produces a deterministic preview for the synthetic fixtures and surfaces errors without posting, and the owner completes the fixture-preview QA walk. Revenue must accept or revise source identity, seller/tax attribution, fee/refund linkage, payout mapping, and exporter columns before real imports are designed. Actual B3 completion additionally requires repeated/interrupted import proof and reconciliation under the accepted source and tax model.

## Exclusions and risks

No persisted import batch, journal, atomic commit, reconciliation report, real Stripe CSV mapping, or tax classification is implemented here. `live` is a value understood by the parser, not permission to import production records. Repeated detection covers only the current file; no previous-import registry exists. Synthetic fixture semantics must not be presented as accepted accounting policy.

## Verification

Owner performs browser/visual review after the import UI exists. This preparatory slice is pure parsing/validation and has no browser or database effects. The current task does not run repository tests or broad checks.
