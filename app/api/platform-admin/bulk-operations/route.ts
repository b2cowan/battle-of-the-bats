import { NextResponse } from 'next/server';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { applyOperatorPlanChange, PlanRefusedError } from '@/lib/operator-plan-change';
import { endInstantForLastDay, formatLongDay, lastDayRefusal } from '@/lib/free-time';
import { clubsStaffBelongsTo } from '@/lib/staff-own-club';
import { subscriptionStatusLabel } from '@/lib/platform-labels';
import { isClubPlan } from '@/lib/module-entitlements';
import { getPlanConfigOverride } from '@/lib/plan-config-db';
import { hasPlatformPower, requireAnyPlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

type BulkActionType = 'subscription_status_override' | 'plan_change' | 'module_addon_enablement';
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
type ModuleOperation = 'enable' | 'disable';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  tournament_limit: number | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  subscription_period: string | null;
  current_period_end: string | null;
  enabled_addons: string[] | null;
};

type BulkResult = {
  orgId: string;
  name: string;
  slug: string;
  ok: boolean;
  /** Nothing was done to this club, on purpose (its own line says why); counted with the failures. */
  skipped?: boolean;
  message: string;
};

const VALID_ACTIONS = new Set<BulkActionType>([
  'subscription_status_override',
  'plan_change',
  'module_addon_enablement',
]);
const VALID_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing', 'past_due', 'canceled']);
const VALID_MODULE_OPERATIONS = new Set<ModuleOperation>(['enable', 'disable']);
const ADDON_MODULE_LABELS: Record<string, string> = {
  module_public_site: 'Public site',
  module_house_league: 'House league',
  module_accounting: 'Accounting',
  module_rep_teams: 'Rep teams',
};
const VALID_ADDON_MODULES = new Set(Object.keys(ADDON_MODULE_LABELS));
const MAX_TARGETS = 100;
// A plan change runs the full operator rule per org (Club trial check incl. a Stripe history read,
// side effects, restore, archive, audit) one org at a time — far more than the old bare UPDATE.
export const maxDuration = 300;

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isOrgPlan(value: unknown): value is OrgPlan {
  return typeof value === 'string' && value in PLAN_CONFIG;
}

function cleanAddons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value.filter((item): item is string => typeof item === 'string' && VALID_ADDON_MODULES.has(item)),
  ));
}

function cleanOrgIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim()),
  ));
}

function operationStatus(successCount: number, failureCount: number) {
  if (successCount > 0 && failureCount === 0) return 'completed';
  if (successCount > 0 && failureCount > 0) return 'partial_failed';
  return 'failed';
}

export const POST = withObservability(async (req: Request) => {
  const auth = await requireAnyPlatformPower(['bulk_plan_status', 'bulk_sections']);
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const actionType = cleanString(body.action_type, 80) as BulkActionType;
  const orgIds = cleanOrgIds(body.org_ids);
  const reason = cleanString(body.reason, 1200);
  const targetStatus = cleanString(body.target_status, 40) as SubscriptionStatus;
  const targetPlan = cleanString(body.target_plan, 80);
  const targetModule = cleanString(body.target_module, 80);
  const moduleOperation = cleanString(body.module_operation, 40) as ModuleOperation;
  // Bulk changes' billing status override follows free time's rules (Support console Stage 3, owner Q7): a last free day
  // is required (the end is midnight Eastern after it), within the role's cap (Billing 6 months, Super admin 12), and a
  // club the staff member belongs to is skipped. The server decides all three; the window's greyed days are a courtesy.
  const lastDay = cleanString(body.last_day, 10);

  // Comp period is no longer given (Support console Stage 4, owner ruling Q5): it never gave a club anything, and offering
  // it beside things that do is how a club ends up "comped" and charged. Founding Season's own rows are written at sign-up.
  if ((actionType as string) === 'comp_period') {
    return NextResponse.json({ error: 'Comp period is no longer given from the console. It never gave a club anything.' }, { status: 400 });
  }
  if (!VALID_ACTIONS.has(actionType)) {
    return NextResponse.json({ error: 'Invalid bulk operation type' }, { status: 400 });
  }
  const requiresProduct = actionType === 'module_addon_enablement';
  const hasRequiredPermission = requiresProduct
    ? hasPlatformPower(auth.role, 'bulk_sections')
    : hasPlatformPower(auth.role, 'bulk_plan_status');
  if (!hasRequiredPermission) {
    return NextResponse.json({ error: 'Insufficient platform role for this bulk operation' }, { status: 403 });
  }
  if (orgIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one organization' }, { status: 400 });
  }
  if (orgIds.length > MAX_TARGETS) {
    return NextResponse.json({ error: `Bulk operations are limited to ${MAX_TARGETS} organizations at a time` }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }
  if (actionType === 'subscription_status_override' && !VALID_STATUSES.has(targetStatus)) {
    return NextResponse.json({ error: 'Choose a valid billing status' }, { status: 400 });
  }
  const dayRefusal = actionType === 'subscription_status_override' ? lastDayRefusal(lastDay, auth.role) : null;
  if (dayRefusal) return NextResponse.json({ error: dayRefusal }, { status: 400 });
  const expiresAt = actionType === 'subscription_status_override' ? endInstantForLastDay(lastDay) : null;
  if (actionType === 'plan_change' && !isOrgPlan(targetPlan)) {
    return NextResponse.json({ error: 'Choose a valid target plan' }, { status: 400 });
  }
  if (actionType === 'module_addon_enablement' && !VALID_ADDON_MODULES.has(targetModule)) {
    return NextResponse.json({ error: 'Choose a valid extra feature' }, { status: 400 });
  }
  if (actionType === 'module_addon_enablement' && !VALID_MODULE_OPERATIONS.has(moduleOperation)) {
    return NextResponse.json({ error: 'Choose whether to turn on or remove the extra feature' }, { status: 400 });
  }

  const { data: orgs, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, plan_id, tournament_limit, subscription_status, stripe_subscription_id, subscription_period, current_period_end, enabled_addons')
    .in('id', orgIds);

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }
  if (!orgs || orgs.length !== orgIds.length) {
    return NextResponse.json({ error: 'One or more selected organizations could not be found' }, { status: 400 });
  }

  const parameters = {
    target_status: actionType === 'subscription_status_override' ? targetStatus : null,
    target_plan: actionType === 'plan_change' ? targetPlan : null,
    target_module: actionType === 'module_addon_enablement' ? targetModule : null,
    module_operation: actionType === 'module_addon_enablement' ? moduleOperation : null,
    expires_at: expiresAt,
    last_day: actionType === 'subscription_status_override' ? lastDay : null,
  };

  const { data: operation, error: operationError } = await supabaseAdmin
    .from('platform_bulk_operations')
    .insert({
      action_type: actionType,
      status: 'failed',
      target_count: orgs.length,
      success_count: 0,
      failure_count: orgs.length,
      reason,
      parameters,
      result_summary: {},
      created_by_email: auth.user.email!,
    })
    .select('id')
    .single();

  if (operationError) {
    return NextResponse.json({ error: operationError.message }, { status: 500 });
  }

  const results: BulkResult[] = [];
  // One read of the target plan's trial length for the whole batch, not one per org.
  const batchTrialDays = actionType === 'plan_change' && isClubPlan(targetPlan)
    ? (await getPlanConfigOverride(targetPlan as OrgPlan)).trialDays
    : undefined;

  // The clubs the staff member belongs to (the one wider check), asked once for the whole batch.
  const ownClubs = actionType === 'subscription_status_override'
    ? await clubsStaffBelongsTo(orgs.map(o => o.id), { id: auth.user.id, email: auth.user.email ?? '' })
    : new Set<string>();

  for (const org of (orgs as OrgRow[])) {
    try {
      if (actionType === 'subscription_status_override') {
        if (ownClubs.has(org.id)) {
          results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: false, skipped: true,
            message: "Skipped: you belong to this club, so you can't give it a billing status. Another staff member can." });
          continue;
        }
        const { error } = await supabaseAdmin
          .from('org_overrides')
          .insert({
            org_id: org.id,
            type: 'subscription_status',
            value: targetStatus,
            expires_at: expiresAt,
            reason,
            created_by: auth.user.email!,
          });
        if (error) throw error;

        await writePlatformAuditLog(auth.user.email!, org.id, 'bulk_create_override', 'subscription_status', null, {
          bulk_operation_id: operation.id,
          type: 'subscription_status',
          value: targetStatus,
          expires_at: expiresAt,
          last_day: lastDay,
        }, { reason });
        results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: true,
          message: `Billing status reads ${subscriptionStatusLabel(targetStatus)} through ${formatLongDay(lastDay)}` });
      }

      if (actionType === 'plan_change') {
        // The SAME rule as one org's Plan and Limits save (lib/operator-plan-change.ts): the Club trial,
        // the Founding comp revoke, the stale team-limit clear, the reactivation restore and the over-cap
        // archive all run per org. This path once kept its own copy and skipped all but the archive.
        // A failure after the plan lands is reported in this org's result row, never as a failed batch.
        const planId = targetPlan as OrgPlan;
        const change = await applyOperatorPlanChange({
          orgId: org.id,
          planId,
          tournamentLimit: PLAN_CONFIG[planId].tournamentLimit,
          reason,
          actor: auth.user.email!,
          trialDays: batchTrialDays,
          audit: { action: 'bulk_update_org_plan_and_limit', extra: { bulk_operation_id: operation.id } },
        });
        const notes: string[] = [];
        if (change.clubTrialDays > 0) notes.push(`${change.clubTrialDays}-day Club trial started`);
        if (change.revokedComps > 0) notes.push('Founding Season comp ended');
        // Name the old value, so a deliberate custom deal can be put back from this line.
        if (change.clearedTeamLimit) notes.push(`custom team limit of ${change.current?.team_limit ?? '?'} cleared`);
        if (change.reactivated) notes.push('restored from cancellation');
        const archived = change.archivedTournaments.length;
        if (archived > 0) notes.push(`${archived} over-cap tournament${archived === 1 ? '' : 's'} archived`);
        if (change.archiveWarning) notes.push('⚠ over-cap tournaments could NOT be archived; this org is over its limit');
        for (const warning of change.warnings) notes.push(`⚠ ${warning}`);
        results.push({
          orgId: org.id, name: org.name, slug: org.slug, ok: true,
          message: `Plan changed to ${PLAN_CONFIG[planId].label}${notes.length ? ` — ${notes.join(' · ')}` : ''}`,
        });
      }

      if (actionType === 'module_addon_enablement') {
        const currentAddons = cleanAddons(org.enabled_addons);
        const alreadyEnabled = currentAddons.includes(targetModule);
        const nextAddons = moduleOperation === 'enable'
          ? Array.from(new Set([...currentAddons, targetModule]))
          : currentAddons.filter(addon => addon !== targetModule);
        const moduleLabel = ADDON_MODULE_LABELS[targetModule] ?? targetModule;

        if ((moduleOperation === 'enable' && alreadyEnabled) || (moduleOperation === 'disable' && !alreadyEnabled)) {
          results.push({
            orgId: org.id,
            name: org.name,
            slug: org.slug,
            ok: true,
            message: moduleOperation === 'enable'
              ? `${moduleLabel} was already enabled`
              : `${moduleLabel} was already removed`,
          });
        } else {
          const { error } = await supabaseAdmin
            .from('organizations')
            .update({ enabled_addons: nextAddons })
            .eq('id', org.id);
          if (error) throw error;

          await writePlatformAuditLog(auth.user.email!, org.id, 'bulk_update_addons', 'enabled_addons', currentAddons, {
            bulk_operation_id: operation.id,
            enabled_addons: nextAddons,
            module_key: targetModule,
            module_operation: moduleOperation,
          }, { reason });
          results.push({
            orgId: org.id,
            name: org.name,
            slug: org.slug,
            ok: true,
            message: moduleOperation === 'enable'
              ? `Enabled ${moduleLabel}`
              : `Removed ${moduleLabel}`,
          });
        }
      }
    } catch (err) {
      // A paying club's plan changes in Stripe, never here (owner Q9): the club is skipped with the one sentence, and the
      // batch carries on.
      if (err instanceof PlanRefusedError) {
        results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: false, skipped: true, message: `Skipped: ${err.message}` });
        continue;
      }
      results.push({
        orgId: org.id,
        name: org.name,
        slug: org.slug,
        ok: false,
        message: (err as Error).message,
      });
    }
  }

  const successCount = results.filter(result => result.ok).length;
  const failureCount = results.length - successCount;
  const status = operationStatus(successCount, failureCount);
  const completedAt = new Date().toISOString();
  const resultSummary = { results };

  const { data: updatedOperation, error: updateError } = await supabaseAdmin
    .from('platform_bulk_operations')
    .update({
      status,
      success_count: successCount,
      failure_count: failureCount,
      result_summary: resultSummary,
      completed_at: completedAt,
    })
    .eq('id', operation.id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'run_bulk_operation', actionType, null, {
    bulk_operation_id: operation.id,
    action_type: actionType,
    target_count: results.length,
    success_count: successCount,
    failure_count: failureCount,
    parameters,
  }, { reason });

  return NextResponse.json({ ok: failureCount === 0, operation: updatedOperation, results });
}, { route: '/api/platform-admin/bulk-operations' });
