# Dev vs Prod — structural drift

**Generated:** 2026-11-25 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 97 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 54 | 0 | 0 |
| Indexes | 9 | 0 | 0 |
| Constraints | 15 | 0 | — |
| RLS / CHECK | 15 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `club_sponsor_deal_refunds`
- `organization_previews`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (54)
- `club_sponsor_deal_payments.card_brand`
- `club_sponsor_deal_payments.card_last4`
- `club_sponsor_deal_payments.dispute_lost_at`
- `club_sponsor_deal_payments.fee_amount`
- `club_sponsor_deal_payments.fee_charged`
- `club_sponsor_deal_payments.fee_cost_entry_id`
- `club_sponsor_deal_payments.fee_income_entry_id`
- `club_sponsor_deal_payments.fee_paid_by`
- `club_sponsor_deal_payments.fee_tax`
- `club_sponsor_deal_payments.online_payment_id`
- `club_sponsor_deal_payments.returned_at`
- `club_sponsor_deal_refunds.amount`
- `club_sponsor_deal_refunds.cancel_emailed_at`
- `club_sponsor_deal_refunds.created_at`
- `club_sponsor_deal_refunds.created_by`
- `club_sponsor_deal_refunds.created_by_name`
- `club_sponsor_deal_refunds.credit_seq`
- `club_sponsor_deal_refunds.deal_id`
- `club_sponsor_deal_refunds.emailed_at`
- `club_sponsor_deal_refunds.ends_deal`
- `club_sponsor_deal_refunds.failed_at`
- `club_sponsor_deal_refunds.failure_reason`
- `club_sponsor_deal_refunds.id`
- `club_sponsor_deal_refunds.income_entry_id`
- `club_sponsor_deal_refunds.online_payment_id`
- `club_sponsor_deal_refunds.org_id`
- `club_sponsor_deal_refunds.payment_id`
- `club_sponsor_deal_refunds.reason`
- `club_sponsor_deal_refunds.refunded_on`
- `club_sponsor_deal_refunds.status`
- `club_sponsor_deal_refunds.stripe_refund_id`
- `club_sponsor_deal_refunds.succeeded_at`
- `club_sponsor_deal_refunds.tax_entry_id`
- `club_sponsor_deal_refunds.tax_part`
- `club_sponsor_deal_refunds.whole`
- `club_sponsor_deals.card_fee`
- `club_sponsor_deals.card_fee_tax`
- `online_payments.sponsor_deal_id`
- `online_payments.sponsor_fee_tax`
- `online_payments.sponsor_invoice`
- `organization_previews.claimed_at`
- `organization_previews.claimed_by`
- `organization_previews.created_at`
- `organization_previews.logo_source_url`
- `organization_previews.made_by`
- `organization_previews.meeting_at`
- `organization_previews.org_id`
- `organization_previews.org_name`
- `organization_previews.org_slug`
- `organization_previews.province_code`
- `organization_previews.removed_at`
- `organization_previews.sport`
- `organization_previews.updated_at`
- `organizations.is_preview`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (9)
- `club_sponsor_deal_payments_online_uniq`
- `club_sponsor_deal_refunds_credit_uniq`
- `club_sponsor_deal_refunds_deal_idx`
- `club_sponsor_deal_refunds_payment_idx`
- `club_sponsor_deal_refunds_pkey`
- `club_sponsor_deal_refunds_stripe_uniq`
- `online_payments_one_open_per_deal`
- `organization_previews_org_slug_idx`
- `organization_previews_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (15)
- `club_sponsor_deal_payments.club_sponsor_deal_payments_fee_cost_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_fee_income_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_online_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_created_by_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_deal_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_income_entry_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_online_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_org_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_payment_id_fkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_pkey`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_tax_entry_id_fkey`
- `online_payments.online_payments_sponsor_deal_id_fkey`
- `organization_previews.organization_previews_claimed_by_fkey`
- `organization_previews.organization_previews_made_by_fkey`
- `organization_previews.organization_previews_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (15)
- `club_sponsor_deal_payments.club_sponsor_deal_payments_card`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_amount_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_created_by_name_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_credit_seq_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_failure_reason_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_reason_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_status_check`
- `club_sponsor_deal_refunds.club_sponsor_deal_refunds_succeeded`
- `club_sponsor_deals.club_sponsor_deals_card_fee`
- `organization_previews.organization_previews_claimer_needs_claim`
- `organization_previews.organization_previews_logo_source_is_web`
- `organization_previews.organization_previews_province_code_shape`
- `organization_previews.organization_previews_removed_or_claimed`
- `organizations.organizations_preview_has_no_stripe`

### CHECK only in PROD (0)
_none_

