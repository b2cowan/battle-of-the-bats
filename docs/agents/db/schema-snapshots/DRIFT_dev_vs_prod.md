# Dev vs Prod — structural drift

**Generated:** 2026-11-23 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 210 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 6 | 0 | — |
| Columns | 99 | 0 | 0 |
| Indexes | 16 | 0 | 0 |
| Constraints | 27 | 0 | — |
| RLS / CHECK | 58 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (6)
- `club_sponsor_deal_items`
- `club_sponsor_deal_payments`
- `club_sponsor_deals`
- `club_sponsor_invoice_counters`
- `club_sponsor_offer_stops`
- `club_sponsor_offers`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (99)
- `club_sponsor_deal_items.deal_id`
- `club_sponsor_deal_items.done_at`
- `club_sponsor_deal_items.done_by`
- `club_sponsor_deal_items.done_by_name`
- `club_sponsor_deal_items.item_id`
- `club_sponsor_deal_items.org_id`
- `club_sponsor_deal_payments.amount`
- `club_sponsor_deal_payments.deal_id`
- `club_sponsor_deal_payments.id`
- `club_sponsor_deal_payments.income_entry_id`
- `club_sponsor_deal_payments.method`
- `club_sponsor_deal_payments.note`
- `club_sponsor_deal_payments.org_id`
- `club_sponsor_deal_payments.received_on`
- `club_sponsor_deal_payments.recorded_at`
- `club_sponsor_deal_payments.recorded_by`
- `club_sponsor_deal_payments.recorded_by_name`
- `club_sponsor_deal_payments.reference`
- `club_sponsor_deal_payments.tax_entry_id`
- `club_sponsor_deal_payments.tax_part`
- `club_sponsor_deal_payments.void_reason`
- `club_sponsor_deal_payments.voided_at`
- `club_sponsor_deal_payments.voided_by`
- `club_sponsor_deal_payments.voided_by_name`
- `club_sponsor_deals.amount`
- `club_sponsor_deals.business_name`
- `club_sponsor_deals.charge_tax`
- `club_sponsor_deals.contact_email`
- `club_sponsor_deals.contact_name`
- `club_sponsor_deals.created_at`
- `club_sponsor_deals.due_on`
- `club_sponsor_deals.emailed_at`
- `club_sponsor_deals.ends_on`
- `club_sponsor_deals.form_at`
- `club_sponsor_deals.id`
- `club_sponsor_deals.invoice_city`
- `club_sponsor_deals.invoice_emailed_at`
- `club_sponsor_deals.invoice_postal`
- `club_sponsor_deals.invoice_province`
- `club_sponsor_deals.invoice_seq`
- `club_sponsor_deals.invoice_street`
- `club_sponsor_deals.invoice_year`
- `club_sponsor_deals.invoiced_at`
- `club_sponsor_deals.invoiced_on`
- `club_sponsor_deals.link_unsent_at`
- `club_sponsor_deals.link_version`
- `club_sponsor_deals.logo_on_site`
- `club_sponsor_deals.logo_path`
- `club_sponsor_deals.logo_sent_at`
- `club_sponsor_deals.offered_at`
- `club_sponsor_deals.offered_by`
- `club_sponsor_deals.offered_by_name`
- `club_sponsor_deals.offered_on`
- `club_sponsor_deals.offered_to`
- `club_sponsor_deals.opened_at`
- `club_sponsor_deals.org_id`
- `club_sponsor_deals.package_id`
- `club_sponsor_deals.package_items`
- `club_sponsor_deals.package_name`
- `club_sponsor_deals.paid_on`
- `club_sponsor_deals.pay_method`
- `club_sponsor_deals.phone`
- `club_sponsor_deals.place_kind`
- `club_sponsor_deals.receipt_emailed_at`
- `club_sponsor_deals.revised_on`
- `club_sponsor_deals.sponsor_id`
- `club_sponsor_deals.state`
- `club_sponsor_deals.target_id`
- `club_sponsor_deals.target_name`
- `club_sponsor_deals.tax_amount`
- `club_sponsor_deals.tax_kind`
- `club_sponsor_deals.tax_rate`
- `club_sponsor_deals.total`
- `club_sponsor_deals.updated_at`
- `club_sponsor_deals.website`
- `club_sponsor_deals.withdrawn_at`
- `club_sponsor_deals.withdrawn_by`
- `club_sponsor_deals.withdrawn_by_name`
- `club_sponsor_deals.withdrawn_reason`
- `club_sponsor_invoice_counters.last_seq`
- `club_sponsor_invoice_counters.org_id`
- `club_sponsor_invoice_counters.year`
- `club_sponsor_offer_stops.email`
- `club_sponsor_offer_stops.org_id`
- `club_sponsor_offer_stops.source`
- `club_sponsor_offer_stops.stopped_at`
- `club_sponsor_offer_stops.stopped_by`
- `club_sponsor_offer_stops.stopped_by_name`
- `club_sponsor_offers.business_name`
- `club_sponsor_offers.deal_id`
- `club_sponsor_offers.email`
- `club_sponsor_offers.id`
- `club_sponsor_offers.kind`
- `club_sponsor_offers.org_id`
- `club_sponsor_offers.reason`
- `club_sponsor_offers.reason_on`
- `club_sponsor_offers.sent_at`
- `club_sponsor_offers.sent_by`
- `club_sponsor_offers.sent_by_name`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (16)
- `club_sponsor_deal_items_org_idx`
- `club_sponsor_deal_items_pkey`
- `club_sponsor_deal_payments_deal_idx`
- `club_sponsor_deal_payments_pkey`
- `club_sponsor_deals_invoice_uniq`
- `club_sponsor_deals_org_idx`
- `club_sponsor_deals_package_idx`
- `club_sponsor_deals_pkey`
- `club_sponsor_deals_sponsor_idx`
- `club_sponsor_deals_target_idx`
- `club_sponsor_invoice_counters_pkey`
- `club_sponsor_offer_stops_pkey`
- `club_sponsor_offers_deal_idx`
- `club_sponsor_offers_org_idx`
- `club_sponsor_offers_pkey`
- `club_sponsor_places_one_per_deal`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (27)
- `club_sponsor_deal_items.club_sponsor_deal_items_deal_id_fkey`
- `club_sponsor_deal_items.club_sponsor_deal_items_done_by_fkey`
- `club_sponsor_deal_items.club_sponsor_deal_items_org_id_fkey`
- `club_sponsor_deal_items.club_sponsor_deal_items_pkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_deal_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_income_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_org_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_pkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_recorded_by_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_tax_entry_id_fkey`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_voided_by_fkey`
- `club_sponsor_deals.club_sponsor_deals_offered_by_fkey`
- `club_sponsor_deals.club_sponsor_deals_org_id_fkey`
- `club_sponsor_deals.club_sponsor_deals_package_id_fkey`
- `club_sponsor_deals.club_sponsor_deals_pkey`
- `club_sponsor_deals.club_sponsor_deals_sponsor_id_fkey`
- `club_sponsor_deals.club_sponsor_deals_withdrawn_by_fkey`
- `club_sponsor_invoice_counters.club_sponsor_invoice_counters_org_id_fkey`
- `club_sponsor_invoice_counters.club_sponsor_invoice_counters_pkey`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_org_id_fkey`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_pkey`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_stopped_by_fkey`
- `club_sponsor_offers.club_sponsor_offers_deal_id_fkey`
- `club_sponsor_offers.club_sponsor_offers_org_id_fkey`
- `club_sponsor_offers.club_sponsor_offers_pkey`
- `club_sponsor_offers.club_sponsor_offers_sent_by_fkey`
- `club_sponsor_places.club_sponsor_places_deal_fk`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (58)
- `club_sponsor_deal_items.club_sponsor_deal_items_done_by_name_check`
- `club_sponsor_deal_items.club_sponsor_deal_items_item_id_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_amount_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_method_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_note_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_recorded_by_name_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_reference_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_void_reason_check`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_void_whole`
- `club_sponsor_deal_payments.club_sponsor_deal_payments_voided_by_name_check`
- `club_sponsor_deals.club_sponsor_deals_amount_check`
- `club_sponsor_deals.club_sponsor_deals_business_name_check`
- `club_sponsor_deals.club_sponsor_deals_contact_email_check`
- `club_sponsor_deals.club_sponsor_deals_contact_name_check`
- `club_sponsor_deals.club_sponsor_deals_emailed_to`
- `club_sponsor_deals.club_sponsor_deals_invoice_city_check`
- `club_sponsor_deals.club_sponsor_deals_invoice_postal_check`
- `club_sponsor_deals.club_sponsor_deals_invoice_province_check`
- `club_sponsor_deals.club_sponsor_deals_invoice_seq_check`
- `club_sponsor_deals.club_sponsor_deals_invoice_street_check`
- `club_sponsor_deals.club_sponsor_deals_invoice_whole`
- `club_sponsor_deals.club_sponsor_deals_invoice_year_check`
- `club_sponsor_deals.club_sponsor_deals_invoiced_numbered`
- `club_sponsor_deals.club_sponsor_deals_link_version_check`
- `club_sponsor_deals.club_sponsor_deals_logo_path_check`
- `club_sponsor_deals.club_sponsor_deals_offered_by_name_check`
- `club_sponsor_deals.club_sponsor_deals_offered_to_check`
- `club_sponsor_deals.club_sponsor_deals_package_items_check`
- `club_sponsor_deals.club_sponsor_deals_package_name_check`
- `club_sponsor_deals.club_sponsor_deals_paid_on`
- `club_sponsor_deals.club_sponsor_deals_pay_method_check`
- `club_sponsor_deals.club_sponsor_deals_phone_check`
- `club_sponsor_deals.club_sponsor_deals_place_kind_check`
- `club_sponsor_deals.club_sponsor_deals_revised_invoiced`
- `club_sponsor_deals.club_sponsor_deals_state_check`
- `club_sponsor_deals.club_sponsor_deals_target`
- `club_sponsor_deals.club_sponsor_deals_target_name_check`
- `club_sponsor_deals.club_sponsor_deals_tax_amount_check`
- `club_sponsor_deals.club_sponsor_deals_tax_kind_check`
- `club_sponsor_deals.club_sponsor_deals_tax_rate_check`
- `club_sponsor_deals.club_sponsor_deals_tax_whole`
- `club_sponsor_deals.club_sponsor_deals_total_check`
- `club_sponsor_deals.club_sponsor_deals_website_check`
- `club_sponsor_deals.club_sponsor_deals_withdrawn_by_name_check`
- `club_sponsor_deals.club_sponsor_deals_withdrawn_reason_check`
- `club_sponsor_deals.club_sponsor_deals_withdrawn_whole`
- `club_sponsor_invoice_counters.club_sponsor_invoice_counters_last_seq_check`
- `club_sponsor_invoice_counters.club_sponsor_invoice_counters_year_check`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_email_check`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_source_check`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_stopped_by_name_check`
- `club_sponsor_offer_stops.club_sponsor_offer_stops_who`
- `club_sponsor_offers.club_sponsor_offers_business_name_check`
- `club_sponsor_offers.club_sponsor_offers_email_check`
- `club_sponsor_offers.club_sponsor_offers_kind_check`
- `club_sponsor_offers.club_sponsor_offers_reason_check`
- `club_sponsor_offers.club_sponsor_offers_sent_by_name_check`

### CHECK only in PROD (0)
_none_

