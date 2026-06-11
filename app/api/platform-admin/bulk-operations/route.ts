import { NextResponse } from 'next/server';
import { getEffectiveTournamentLimit, PLAN_CONFIG } from '@/lib/plan-config';
import { hasPlatformPermission, requireAnyPlatformPermission } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

type BulkActionType = 'subscription_status_override' | 'comp_period' | 'plan_change' | 'module_addon_enablement';
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
  message: string;
};

const VALID_ACTIONS = new Set<BulkActionType>([
  'subscription_status_override',
  'comp_period',
  'plan_change',
  'module_addon_enablement',
]);
const VALID_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing', 'past_due', 'canceled']);
const VALID_MODULE_OPERATIONS = new Set<ModuleOperation>(['enable', 'disable']);
const ADDON_MODULE_LABELS: Record<string, string> = {
  module_public_site: 'Public Site',
  module_house_league: 'House League',
  module_accounting: 'Accounting',
  module_rep_teams: 'Rep Teams',
};
const VALID_ADDON_MODULES = new Set(Object.keys(ADDON_MODULE_LABELS));
const MAX_TARGETS = 100;

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
  const auth = await requireAnyPlatformPermission(['manage_billing', 'manage_product']);
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const actionType = cleanString(body.action_type, 80) as BulkActionType;
  const orgIds = cleanOrgIds(body.org_ids);
  const reason = cleanString(body.reason, 1200);
  const targetStatus = cleanString(body.target_status, 40) as SubscriptionStatus;
  const targetPlan = cleanString(body.target_plan, 80);
  const targetModule = cleanString(body.target_module, 80);
  const moduleOperation = cleanString(body.module_operation, 40) as ModuleOperation;
  const expiresAt = cleanString(body.expires_at, 80);

  if (!VALID_ACTIONS.has(actionType)) {
    return NextResponse.json({ error: 'Invalid bulk operation type' }, { status: 400 });
  }
  const requiresProduct = actionType === 'module_addon_enablement';
  const hasRequiredPermission = requiresProduct
    ? hasPlatformPermission(auth.role, 'manage_product')
    : hasPlatformPermission(auth.role, 'manage_billing');
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
    return NextResponse.json({ error: 'Choose a valid subscription status' }, { status: 400 });
  }
  if (actionType === 'comp_period' && !expiresAt) {
    return NextResponse.json({ error: 'Comp period bulk grants require an expiration date' }, { status: 400 });
  }
  if (actionType === 'plan_change' && !isOrgPlan(targetPlan)) {
    return NextResponse.json({ error: 'Choose a valid target plan' }, { status: 400 });
  }
  if (actionType === 'module_addon_enablement' && !VALID_ADDON_MODULES.has(targetModule)) {
    return NextResponse.json({ error: 'Choose a valid module add-on' }, { status: 400 });
  }
  if (actionType === 'module_addon_enablement' && !VALID_MODULE_OPERATIONS.has(moduleOperation)) {
    return NextResponse.json({ error: 'Choose whether to enable or remove the module add-on' }, { status: 400 });
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
    expires_at: expiresAt || null,
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

  for (const org of (orgs as OrgRow[])) {
    try {
      if (actionType === 'subscription_status_override') {
        const { error } = await supabaseAdmin
          .from('org_overrides')
          .insert({
            org_id: org.id,
            type: 'subscription_status',
            value: targetStatus,
            expires_at: expiresAt || null,
            reason,
            created_by: auth.user.email!,
          });
        if (error) throw error;

        await writePlatformAuditLog(auth.user.email!, org.id, 'bulk_create_override', 'subscription_status', null, {
          bulk_operation_id: operation.id,
          type: 'subscription_status',
          value: targetStatus,
          expires_at: expiresAt || null,
          reason,
        });
        results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: true, message: `Status override set to ${targetStatus}` });
      }

      if (actionType === 'comp_period') {
        const { error } = await supabaseAdmin
          .from('org_overrides')
          .insert({
            org_id: org.id,
            type: 'comp_period',
            value: 'granted',
            expires_at: expiresAt,
            reason,
            created_by: auth.user.email!,
          });
        if (error) throw error;

        await writePlatformAuditLog(auth.user.email!, org.id, 'bulk_create_override', 'comp_period', null, {
          bulk_operation_id: operation.id,
          type: 'comp_period',
          value: 'granted',
          expires_at: expiresAt,
          reason,
        });
        results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: true, message: `Comp period granted through ${expiresAt}` });
      }

      if (actionType === 'plan_change') {
        const planId = targetPlan as OrgPlan;
        const nextLimit = getEffectiveTournamentLimit(planId, PLAN_CONFIG[planId].tournamentLimit);
        const updatePayload: {
          plan_id: OrgPlan;
          tournament_limit: number;
          subscription_status?: 'active';
          stripe_subscription_id?: null;
          subscription_period?: null;
          current_period_end?: null;
        } = {
          plan_id: planId,
          tournament_limit: nextLimit,
        };

        if (planId === 'tournament') {
          updatePayload.subscription_status = 'active';
          updatePayload.stripe_subscription_id = null;
          updatePayload.subscription_period = null;
          updatePayload.current_period_end = null;
        }

        const { error } = await supabaseAdmin
          .from('organizations')
          .update(updatePayload)
          .eq('id', org.id);
        if (error) throw error;

        await writePlatformAuditLog(auth.user.email!, org.id, 'bulk_update_org_plan_and_limit', 'plan_and_limit', {
          plan_id: org.plan_id,
          tournament_limit: getEffectiveTournamentLimit(org.plan_id as OrgPlan, org.tournament_limit),
          subscription_status: org.subscription_status,
          stripe_subscription_id: org.stripe_subscription_id,
          subscription_period: org.subscription_period,
          current_period_end: org.current_period_end,
        }, {
          bulk_operation_id: operation.id,
          plan_id: planId,
          tournament_limit: nextLimit,
          reason,
          free_plan_billing_reset: planId === 'tournament',
        });
        results.push({ orgId: org.id, name: org.name, slug: org.slug, ok: true, message: `Plan changed to ${PLAN_CONFIG[planId].label}` });
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
            reason,
          });
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
    reason,
    parameters,
  });

  return NextResponse.json({ ok: failureCount === 0, operation: updatedOperation, results });
}, { route: '/api/platform-admin/bulk-operations' });
