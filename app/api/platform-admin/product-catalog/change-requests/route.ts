import { NextResponse } from 'next/server';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { sanitizePlatformChangeNote } from '@/lib/platform-change-note';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VALID_TYPES = new Set(['plan_version', 'feature_matrix', 'addon', 'pricing', 'grandfathering', 'campaign', 'trial']);
const VALID_STATUSES = new Set(['draft', 'needs_review', 'approved', 'rejected', 'implemented', 'canceled']);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'launch_blocker']);

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanOptionalDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function POST(req: Request) {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const requestType = cleanText(body.request_type, 80) ?? '';
  const title = cleanText(body.title, 160);
  const priority = cleanText(body.priority, 40) ?? 'medium';

  if (!VALID_TYPES.has(requestType)) {
    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (!VALID_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
  }

  const insert = {
    request_type: requestType,
    title,
    description: cleanText(body.description, 2000),
    status: 'draft',
    priority,
    target_plan_id: cleanText(body.target_plan_id, 80),
    target_addon_key: cleanText(body.target_addon_key, 120),
    effective_at: cleanOptionalDateTime(body.effective_at),
    impact_summary: cleanText(body.impact_summary, 1200),
    proposal: typeof body.proposal === 'object' && body.proposal !== null ? body.proposal : {},
    created_by_email: auth.user.email!,
    updated_by_email: auth.user.email!,
  };

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'create_catalog_change_request',
    data.id,
    null,
    data,
  );

  return NextResponse.json({ ok: true, changeRequest: data });
}

export async function PATCH(req: Request) {
  const auth = await requirePlatformPermission('manage_product');
  if (auth.response) return auth.response;

  const body = await req.json() as Record<string, unknown>;
  const id = cleanText(body.id, 80);
  const status = cleanText(body.status, 40);
  const implementationNotes = sanitizePlatformChangeNote(body.implementation_notes);

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Change request not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: Record<string, string | null> = {
    status,
    updated_at: now,
    updated_by_email: auth.user.email!,
  };

  if (status === 'needs_review' && !current.submitted_at) {
    update.submitted_at = now;
    update.submitted_by_email = auth.user.email!;
  }

  if (status === 'approved' || status === 'rejected') {
    update.reviewed_at = now;
    update.reviewed_by_email = auth.user.email!;
  }

  if (implementationNotes !== null) {
    update.implementation_notes = implementationNotes;
  }

  const { data, error } = await supabaseAdmin
    .from('platform_catalog_change_requests')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_catalog_change_request_status',
    id,
    {
      status: current.status,
      implementation_notes: current.implementation_notes,
    },
    {
      status: data.status,
      implementation_notes: data.implementation_notes,
    },
  );

  return NextResponse.json({ ok: true, changeRequest: data });
}
