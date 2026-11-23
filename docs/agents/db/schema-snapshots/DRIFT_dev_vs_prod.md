# Dev vs Prod — structural drift

**Generated:** 2026-11-23 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 111 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 4 | 0 | — |
| Columns | 53 | 0 | 0 |
| Indexes | 9 | 0 | 0 |
| Constraints | 12 | 0 | — |
| RLS / CHECK | 31 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (4)
- `club_sponsor_places`
- `club_sponsors`
- `club_sponsorship_packages`
- `club_sponsorship_settings`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (53)
- `club_sponsor_places.created_at`
- `club_sponsor_places.deal_id`
- `club_sponsor_places.ends_on`
- `club_sponsor_places.id`
- `club_sponsor_places.kind`
- `club_sponsor_places.org_id`
- `club_sponsor_places.source`
- `club_sponsor_places.sponsor_id`
- `club_sponsor_places.target_id`
- `club_sponsor_places.updated_at`
- `club_sponsors.contact_email`
- `club_sponsors.contact_name`
- `club_sponsors.created_at`
- `club_sponsors.created_by`
- `club_sponsors.id`
- `club_sponsors.invoice_city`
- `club_sponsors.invoice_postal`
- `club_sponsors.invoice_province`
- `club_sponsors.invoice_street`
- `club_sponsors.link`
- `club_sponsors.logo_url`
- `club_sponsors.name`
- `club_sponsors.org_id`
- `club_sponsors.phone`
- `club_sponsors.position`
- `club_sponsors.updated_at`
- `club_sponsorship_packages.archived_at`
- `club_sponsorship_packages.created_at`
- `club_sponsorship_packages.created_by`
- `club_sponsorship_packages.document_name`
- `club_sponsorship_packages.document_path`
- `club_sponsorship_packages.document_size`
- `club_sponsorship_packages.how_many`
- `club_sponsorship_packages.id`
- `club_sponsorship_packages.items`
- `club_sponsorship_packages.logo_on_site`
- `club_sponsorship_packages.name`
- `club_sponsorship_packages.org_id`
- `club_sponsorship_packages.place_kind`
- `club_sponsorship_packages.price`
- `club_sponsorship_packages.shows_until`
- `club_sponsorship_packages.updated_at`
- `club_sponsorship_settings.cheques_payable_to`
- `club_sponsorship_settings.etransfer_to`
- `club_sponsorship_settings.gst_hst_number`
- `club_sponsorship_settings.gst_hst_registered`
- `club_sponsorship_settings.org_id`
- `club_sponsorship_settings.payment_due_days`
- `club_sponsorship_settings.sponsor_contact_email`
- `club_sponsorship_settings.sponsor_contact_name`
- `club_sponsorship_settings.updated_at`
- `club_sponsorship_settings.updated_by`
- `org_payment_accounts.sponsor_fee_payer`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (9)
- `club_sponsor_places_pkey`
- `club_sponsor_places_sponsor_idx`
- `club_sponsor_places_target_idx`
- `club_sponsor_places_typed_once`
- `club_sponsors_org_idx`
- `club_sponsors_pkey`
- `club_sponsorship_packages_org_idx`
- `club_sponsorship_packages_pkey`
- `club_sponsorship_settings_pkey`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (12)
- `club_sponsor_places.club_sponsor_places_org_id_fkey`
- `club_sponsor_places.club_sponsor_places_pkey`
- `club_sponsor_places.club_sponsor_places_sponsor_id_fkey`
- `club_sponsors.club_sponsors_created_by_fkey`
- `club_sponsors.club_sponsors_org_id_fkey`
- `club_sponsors.club_sponsors_pkey`
- `club_sponsorship_packages.club_sponsorship_packages_created_by_fkey`
- `club_sponsorship_packages.club_sponsorship_packages_org_id_fkey`
- `club_sponsorship_packages.club_sponsorship_packages_pkey`
- `club_sponsorship_settings.club_sponsorship_settings_org_id_fkey`
- `club_sponsorship_settings.club_sponsorship_settings_pkey`
- `club_sponsorship_settings.club_sponsorship_settings_updated_by_fkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (31)
- `club_forms.club_forms_owner_kind`
- `club_sponsor_places.club_sponsor_places_kind_check`
- `club_sponsor_places.club_sponsor_places_source`
- `club_sponsor_places.club_sponsor_places_source_check`
- `club_sponsor_places.club_sponsor_places_target`
- `club_sponsors.club_sponsors_contact_email_check`
- `club_sponsors.club_sponsors_contact_name_check`
- `club_sponsors.club_sponsors_invoice_city_check`
- `club_sponsors.club_sponsors_invoice_postal_check`
- `club_sponsors.club_sponsors_invoice_province_check`
- `club_sponsors.club_sponsors_invoice_street_check`
- `club_sponsors.club_sponsors_link_check`
- `club_sponsors.club_sponsors_logo_url_check`
- `club_sponsors.club_sponsors_name_check`
- `club_sponsors.club_sponsors_phone_check`
- `club_sponsorship_packages.club_sponsorship_packages_document_name_check`
- `club_sponsorship_packages.club_sponsorship_packages_document_size_check`
- `club_sponsorship_packages.club_sponsorship_packages_document_whole`
- `club_sponsorship_packages.club_sponsorship_packages_how_many_check`
- `club_sponsorship_packages.club_sponsorship_packages_items_check`
- `club_sponsorship_packages.club_sponsorship_packages_name_check`
- `club_sponsorship_packages.club_sponsorship_packages_place_kind_check`
- `club_sponsorship_packages.club_sponsorship_packages_price_check`
- `club_sponsorship_settings.club_sponsorship_settings_cheques_payable_to_check`
- `club_sponsorship_settings.club_sponsorship_settings_etransfer_to_check`
- `club_sponsorship_settings.club_sponsorship_settings_gst_hst_number_check`
- `club_sponsorship_settings.club_sponsorship_settings_payment_due_days_check`
- `club_sponsorship_settings.club_sponsorship_settings_registered_number`
- `club_sponsorship_settings.club_sponsorship_settings_sponsor_contact_email_check`
- `club_sponsorship_settings.club_sponsorship_settings_sponsor_contact_name_check`
- `org_payment_accounts.org_payment_accounts_sponsor_fee_payer_chk`

### CHECK only in PROD (0)
_none_

