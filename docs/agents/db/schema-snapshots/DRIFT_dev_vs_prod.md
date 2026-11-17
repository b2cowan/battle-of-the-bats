# Dev vs Prod — structural drift

**Generated:** 2026-11-17 by `scripts/refresh-db-snapshots.mjs` (structure only — no business data).

**⚠️ 34 divergence(s)** across dev/prod.

| Dimension | Only in DEV | Only in PROD | Changed |
|---|---|---|---|
| Tables | 2 | 0 | — |
| Columns | 12 | 0 | 0 |
| Indexes | 8 | 0 | 0 |
| Constraints | 10 | 0 | — |
| RLS / CHECK | 2 | 0 | 0 (RLS state) |

## Tables
### Only in DEV (2)
- `club_schedule_bill_rates`
- `org_time_date_off_venues`

### Only in PROD (0)
_none_

## Columns
### Only in DEV (12)
- `club_schedule_bill_rates.created_at`
- `club_schedule_bill_rates.first_billed_send_id`
- `club_schedule_bill_rates.id`
- `club_schedule_bill_rates.org_id`
- `club_schedule_bill_rates.permit_id`
- `club_schedule_bill_rates.permit_name`
- `club_schedule_bill_rates.scale`
- `club_schedule_bill_rates.schedule_id`
- `club_schedules.bill_price_mode`
- `org_time_date_off_venues.date_off_id`
- `org_time_date_off_venues.org_id`
- `org_time_date_off_venues.org_venue_id`

### Only in PROD (0)
_none_

### Type/nullability/default changed (0)
_none_

## Indexes
### Only in DEV (8)
- `club_schedule_bill_rates_org_idx`
- `club_schedule_bill_rates_permit_idx`
- `club_schedule_bill_rates_pkey`
- `club_schedule_bill_rates_schedule_permit_key`
- `club_schedule_bill_rates_send_idx`
- `org_time_date_off_venues_org_idx`
- `org_time_date_off_venues_pkey`
- `org_time_date_off_venues_venue_idx`

### Only in PROD (0)
_none_

### Definition changed (0)
_none_

## Constraints (PK / UNIQUE / FK)
### Only in DEV (10)
- `club_schedule_bill_rates.club_schedule_bill_rates_first_billed_send_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_org_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_permit_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_pkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_schedule_id_fkey`
- `club_schedule_bill_rates.club_schedule_bill_rates_schedule_permit_key`
- `org_time_date_off_venues.org_time_date_off_venues_date_off_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_org_venue_id_fkey`
- `org_time_date_off_venues.org_time_date_off_venues_pkey`

### Only in PROD (0)
_none_

## RLS / CHECK
### RLS state differs (0)
_none_

### CHECK only in DEV (2)
- `club_schedule_bill_rates.club_schedule_bill_rates_scale_check`
- `club_schedules.club_schedules_bill_price_mode_check`

### CHECK only in PROD (0)
_none_

