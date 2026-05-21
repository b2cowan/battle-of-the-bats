-- Migration 064: bulk module/add-on enablement action
-- Extends platform bulk operation batch records to include org-level module add-on changes.

alter table public.platform_bulk_operations
  drop constraint if exists platform_bulk_operations_action_check;

alter table public.platform_bulk_operations
  add constraint platform_bulk_operations_action_check
  check (action_type in ('subscription_status_override', 'comp_period', 'plan_change', 'module_addon_enablement'));

comment on table public.platform_bulk_operations is
  'Platform-admin bulk operation batches with reason, parameters, and per-target outcome summary, including billing and module add-on changes.';
