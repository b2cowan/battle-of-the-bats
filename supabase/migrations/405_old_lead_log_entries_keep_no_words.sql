-- ---------------------------------------------------------------
-- Migration 405 — Support console Stage 7 loose ends: the Audit log's older lead entries keep no one's words.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Stage 7 loose ends"); owner ruling 2026-10-27
-- (asked to clear them before 398 reaches production, answered yes). Data only.
--
-- WHY: before Stage 7 Part 0 (c6e3d3720, 2026-10-27) a lead edit's Audit log entry stored the WHOLE lead on both sides:
-- name, email, organization, the visitor's words and the staff notes. The Audit log is open to every staff role. Part 0
-- stopped writing those and hides the details of every lead entry from Support, Billing and Read only, but the old
-- rows still hold the words in the database.
--
-- WHAT CHANGES: each `update_early_access_lead` row that still holds a whole lead is rewritten to what a row written
-- now holds: old_value = the step before; new_value = the field NAMES that changed and the step after. Nothing else
-- in the table is touched. The step column that migration 398 reads (internal_status) is kept on both sides, so 398's
-- "when the step last moved" back-fill gives the same answer before or after this runs. Re-runnable: a row already in
-- the new shape holds none of the listed keys and is skipped.
-- Order: any time; on prod, before the promote that ships Stage 7 (the old rows are what is being cleared).
-- ---------------------------------------------------------------

BEGIN;

UPDATE public.platform_audit_log a
   SET new_value = jsonb_build_object(
         'changed', COALESCE((
           SELECT jsonb_agg(k ORDER BY k)
             FROM jsonb_object_keys(CASE WHEN jsonb_typeof(a.new_value) = 'object' THEN a.new_value ELSE '{}'::jsonb END) AS k
            WHERE k NOT IN ('updated_at', 'step_changed_at')
              AND (a.old_value -> k) IS DISTINCT FROM (a.new_value -> k)
         ), '[]'::jsonb),
         'internal_status', a.new_value -> 'internal_status'),
       old_value = jsonb_build_object('internal_status', a.old_value -> 'internal_status')
 WHERE a.action = 'update_early_access_lead'
   AND (
        (jsonb_typeof(a.old_value) = 'object' AND jsonb_exists_any(a.old_value, ARRAY['name', 'email', 'email_normalized', 'organization_name', 'internal_notes', 'notes']))
     OR (jsonb_typeof(a.new_value) = 'object' AND jsonb_exists_any(a.new_value, ARRAY['name', 'email', 'email_normalized', 'organization_name', 'internal_notes', 'notes']))
   );

COMMIT;
