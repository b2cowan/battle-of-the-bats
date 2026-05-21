import { supabaseAdmin } from './supabase-admin';

type ApprovalSurface = 'plan_gating' | 'plan_config' | 'stripe_price' | 'feature_matrix';

type ApprovedChangeRequest = {
  id: string;
  title: string;
  request_type: string;
  status: string;
};

const SURFACE_REQUEST_TYPES: Record<ApprovalSurface, string[]> = {
  plan_gating: ['plan_version', 'pricing', 'campaign', 'trial'],
  plan_config: ['plan_version', 'pricing', 'trial'],
  stripe_price: ['pricing', 'campaign', 'trial'],
  feature_matrix: ['feature_matrix'],
};

export async function requireApprovedCatalogChangeRequest(
  changeRequestId: unknown,
  surface: ApprovalSurface,
): Promise<{ ok: true; changeRequest: ApprovedChangeRequest } | { ok: false; response: Response }> {
  if (typeof changeRequestId !== 'string' || !changeRequestId.trim()) {
    return {
      ok: false,
      response: Response.json({ error: 'Select an approved product catalog change request before applying this live change.' }, { status: 400 }),
    };
  }

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .select('id, title, request_type, status')
    .eq('id', changeRequestId)
    .maybeSingle<ApprovedChangeRequest>();

  if (error) {
    return {
      ok: false,
      response: Response.json({ error: error.message }, { status: 500 }),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: Response.json({ error: 'Approved product catalog change request not found.' }, { status: 404 }),
    };
  }

  if (data.status !== 'approved') {
    return {
      ok: false,
      response: Response.json({ error: 'The selected product catalog change request must be approved before applying live changes.' }, { status: 400 }),
    };
  }

  const allowedTypes = SURFACE_REQUEST_TYPES[surface];
  if (!allowedTypes.includes(data.request_type)) {
    return {
      ok: false,
      response: Response.json({ error: `The selected change request type cannot be applied to ${surface}.` }, { status: 400 }),
    };
  }

  return { ok: true, changeRequest: data };
}

export async function recordCatalogChangeApplication(
  changeRequestId: string,
  surface: ApprovalSurface,
  targetKey: string,
  actorEmail: string,
  appliedPayload: unknown,
) {
  const { error } = await supabaseAdmin
    .from('platform_catalog_change_applications')
    .insert({
      change_request_id: changeRequestId,
      surface,
      target_key: targetKey,
      actor_email: actorEmail,
      applied_payload: appliedPayload ?? {},
    });

  if (error) {
    console.error('[platform-catalog-approval] application write error:', error);
  }
}
