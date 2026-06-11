import { NextResponse } from 'next/server';
import {
  getEffectivePlanModuleEntitlements,
  getFeatureMatrixRows,
  isValidPlanModuleEntitlementMatrix,
  publishPlanModuleEntitlements,
  PLAN_ORDER,
  MODULE_CATALOG,
  type PlanModuleEntitlementMatrix,
} from '@/lib/plan-module-entitlements';
import {
  recordCatalogChangeApplication,
  requireApprovedCatalogChangeRequest,
} from '@/lib/platform-catalog-approval';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Capability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';

type CatalogChangeRequestWithProposal = {
  id: string;
  title: string;
  request_type: string;
  status: string;
  implementation_notes: string | null;
  proposal: unknown;
};

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function moduleEntitlementsFromProposal(proposal: unknown): PlanModuleEntitlementMatrix | null {
  if (!proposal || typeof proposal !== 'object') return null;
  const record = proposal as Record<string, unknown>;
  if (record.kind !== 'feature_matrix') return null;
  const moduleEntitlements = record.moduleEntitlements;
  return isValidPlanModuleEntitlementMatrix(moduleEntitlements) ? moduleEntitlements : null;
}

function diffMatrix(current: PlanModuleEntitlementMatrix, proposed: PlanModuleEntitlementMatrix) {
  return PLAN_ORDER.flatMap(planId =>
    MODULE_CATALOG
      .map(module => {
        const currentIncluded = current[planId].includes(module.key);
        const proposedIncluded = proposed[planId].includes(module.key);
        return {
          planId,
          moduleKey: module.key as Capability,
          current: currentIncluded,
          proposed: proposedIncluded,
        };
      })
      .filter(change => change.current !== change.proposed),
  );
}

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const changeRequestId = cleanId(body.change_request_id);
  const changeNote = sanitizePlatformChangeNote(body.change_note);

  if (!changeRequestId) {
    return NextResponse.json({ error: 'Missing change request id' }, { status: 400 });
  }
  if (!changeNote) {
    return NextResponse.json({ error: 'Add a publish note before applying the feature matrix.' }, { status: 400 });
  }

  const approval = await requireApprovedCatalogChangeRequest(changeRequestId, 'feature_matrix');
  if (!approval.ok) return approval.response;

  const { data: request, error: requestError } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .select('id, title, request_type, status, implementation_notes, proposal')
    .eq('id', changeRequestId)
    .maybeSingle<CatalogChangeRequestWithProposal>();

  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }
  if (!request) {
    return NextResponse.json({ error: 'Feature matrix change request not found.' }, { status: 404 });
  }

  const proposed = moduleEntitlementsFromProposal(request.proposal);
  if (!proposed) {
    return NextResponse.json({ error: 'The selected request does not contain a valid feature matrix proposal.' }, { status: 400 });
  }

  const current = await getEffectivePlanModuleEntitlements();
  const changes = diffMatrix(current, proposed);
  if (changes.length === 0) {
    return NextResponse.json({ error: 'This proposal matches the current live feature matrix.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const implementationNotes = [
    request.implementation_notes,
    `Published feature matrix on ${now} by ${auth.user.email}: ${changeNote}`,
  ].filter(Boolean).join('\n\n');

  try {
    await publishPlanModuleEntitlements(proposed, auth.user.email!);

    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('platform_catalog_change_requests')
      .update({
        status: 'implemented',
        implementation_notes: implementationNotes,
        updated_at: now,
        updated_by_email: auth.user.email!,
      })
      .eq('id', request.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const appliedPayload = {
      change_note: changeNote,
      changes,
      previous_module_entitlements: current,
      module_entitlements: proposed,
    };

    await writePlatformAuditLog(
      auth.user.email!,
      null,
      'publish_feature_matrix_entitlements',
      request.id,
      { module_entitlements: current },
      appliedPayload,
    );

    await recordCatalogChangeApplication(
      request.id,
      'feature_matrix',
      'module_entitlements',
      auth.user.email!,
      appliedPayload,
    );

    return NextResponse.json({
      ok: true,
      changeRequest: updatedRequest,
      featureMatrix: await getFeatureMatrixRows(),
      changes,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}, { route: '/api/platform-admin/product-catalog/feature-matrix/publish' });
