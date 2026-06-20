-- 140: store the free→Premium upgrade migration summary on the workspace (Coach Premium Upgrade Phase 4).
--
-- When a free Basic team is upgraded, the provisioner copies its roster/schedule/fees into the new
-- Premium season and records an honest "here's what we brought over + check these" summary. This
-- column holds that summary (counts + flags: players needing a guardian, uncertain name splits,
-- defaulted fee due dates, skipped $0/orphan fees, per-pass failures). The Premium team overview
-- reads it on first load to show a dismissible banner; once acknowledged the app stamps
-- `acknowledgedAt` into the JSON. NULL = not an upgrade / nothing migrated.
--
-- Additive, nullable, no backfill — safe + reversible (drop the column).

alter table public.team_workspaces
  add column if not exists migration_summary jsonb;
