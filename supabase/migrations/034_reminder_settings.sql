-- Migration 034: per-team auto-reminder toggle + separate 30/7-day reminder tracking

-- Coach-controlled per-team toggle; default true so existing teams get reminders
ALTER TABLE rep_program_years
  ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean NOT NULL DEFAULT true;

-- Separate columns for 30-day and 7-day reminder waves so both fire independently
ALTER TABLE rep_player_dues_installments
  ADD COLUMN IF NOT EXISTS reminder_30_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_7_sent_at  timestamptz;

-- Allocation installments: single reminder tracking (org notifies coaches)
ALTER TABLE rep_allocation_installments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
