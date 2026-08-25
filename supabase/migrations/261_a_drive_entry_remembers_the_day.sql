-- 261: a drive entry remembers the day the money arrived (owner ruling 2026-08-23, §80 walk —
-- deviation ① completed honestly).
--
-- The register's own comment documented the gap: "A FUNDRAISING ENTRY HAS NO DATE COLUMN —
-- rep_fundraiser_entries carries only created_at. So the book dates it by the day the coach
-- recorded it." The ruling that treasurers log late but need the record in the PERIOD the money
-- arrived makes that a defect: the entries writer now accepts a received date (it already dates
-- the ledger entry and the rebate credit), and without a column here the REGISTER — the
-- coach-facing book — would keep showing the recording day for the same record.
--
-- Nullable, no backfill: a legacy row's honest answer is "we only know when it was recorded",
-- and readers fall back to created_at exactly as before.

ALTER TABLE rep_fundraiser_entries ADD COLUMN received_date date;
