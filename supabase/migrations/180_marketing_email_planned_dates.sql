-- 180_marketing_email_planned_dates.sql
-- P2 of Editable Email Campaigns: gives the founding-season MARKETING campaigns an
-- editable planned send date so the Email Dashboard can surface "upcoming" and "past due"
-- campaigns and let an operator change the date on the calendar-based sends.
--
-- Trigger-based campaigns (founding_welcome = at signup, founding_checkin = ~day 60) keep
-- NULL: their timing is system-defined (an event, not a calendar date) and stays locked.
--
-- Additive + idempotent (IF NOT EXISTS; UPDATEs only fill a still-NULL date so a later
-- operator edit is never clobbered on re-run).

ALTER TABLE platform_email_templates
  ADD COLUMN IF NOT EXISTS planned_send_date DATE;

UPDATE platform_email_templates SET planned_send_date = '2026-11-01' WHERE key = 'founding_renewal'        AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-12-15' WHERE key = 'founding_final'          AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-08-01' WHERE key = 'spotlight_club'          AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-09-01' WHERE key = 'spotlight_league'        AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-10-01' WHERE key = 'spotlight_coaches_org'   AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-10-01' WHERE key = 'spotlight_coaches_coach' AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-10-15' WHERE key = 'spotlight_club_last'     AND planned_send_date IS NULL;
UPDATE platform_email_templates SET planned_send_date = '2026-11-15' WHERE key = 'spotlight_full_picture'  AND planned_send_date IS NULL;
