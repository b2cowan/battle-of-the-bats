-- Migration 119: add the missing `notes` column to rep_team_expenses.
-- The rep team-expense feature (coach accounting → Expenses) has always threaded a free-text
-- `notes` value through the entire stack — the RepTeamExpense type (lib/types.ts), the create
-- and PATCH routes, mapRepTeamExpense (lib/db.ts), and the coach expenses form's Notes textarea
-- — but the column was never added to the table. As a result createRepTeamExpense /
-- updateRepTeamExpense errored with `column "notes" does not exist` on every expense save/edit.
-- Verified absent in dev AND prod via information_schema (2026-06-09, during Data Dictionary
-- Phase 4b). This adds the nullable text column so the feature works as designed; sibling
-- rep-finance tables (rep_team_payment_requests, rep_player_dues_schedules, etc.) already carry
-- a nullable `notes text`. Non-destructive; applied to dev + prod together to keep them in sync.

alter table public.rep_team_expenses
  add column if not exists notes text;
