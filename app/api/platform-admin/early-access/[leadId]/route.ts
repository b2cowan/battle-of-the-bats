import { NextRequest, NextResponse } from 'next/server';
import {
  cleanInternalNotes,
  cleanNextAction,
  cleanOptionalDate,
  EARLY_ACCESS_SELECT,
  isEarlyAccessStatus,
} from '@/lib/early-access-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requireAnyPlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type PatchBody = {
  internalStatus?: string;
  internalNotes?: string;
  markContacted?: boolean;
  convertedOrgId?: string | null;
  followUpDueAt?: string | null;
  nextAction?: string | null;
};

type EarlyAccessLeadRow = {
  internal_status: string | null;
  converted_org_id: string | null;
  converted_at: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await requireAnyPlatformPermission(['manage_growth', 'manage_product']);
  if (auth.response) return auth.response;

  const { leadId } = await params;
  const body = await req.json() as PatchBody;

  if (body.internalStatus !== undefined && !isEarlyAccessStatus(body.internalStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('early_access_leads')
    .select(EARLY_ACCESS_SELECT)
    .eq('id', leadId)
    .maybeSingle<EarlyAccessLeadRow>();

  if (currentError) {
    console.error('[platform-admin] early-access current read error:', currentError);
    return NextResponse.json({ error: 'Unable to load early-access lead' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: Record<string, string | null> = {
    updated_at: now,
  };

  if (body.internalStatus !== undefined) update.internal_status = body.internalStatus;
  if (body.internalNotes !== undefined) update.internal_notes = cleanInternalNotes(body.internalNotes);
  if (body.followUpDueAt !== undefined) update.follow_up_due_at = cleanOptionalDate(body.followUpDueAt);
  if (body.nextAction !== undefined) update.next_action = cleanNextAction(body.nextAction);
  if (body.convertedOrgId !== undefined) update.converted_org_id = body.convertedOrgId || null;
  if (body.markContacted) {
    update.last_contacted_at = now;
    update.last_contacted_by = auth.user.email ?? null;
    if (!body.internalStatus) update.internal_status = 'contacted';
  }

  const nextStatus = update.internal_status ?? current.internal_status ?? 'new';
  const nextConvertedOrgId = body.convertedOrgId !== undefined
    ? body.convertedOrgId || null
    : current.converted_org_id;

  if (nextConvertedOrgId) {
    const { count, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('id', nextConvertedOrgId);

    if (orgError) {
      console.error('[platform-admin] early-access org validation error:', orgError);
      return NextResponse.json({ error: 'Unable to validate converted organization' }, { status: 500 });
    }
    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: 'Converted organization not found' }, { status: 404 });
    }
  }

  if (nextStatus === 'converted') {
    if (!nextConvertedOrgId) {
      return NextResponse.json({ error: 'Select an organization before marking a lead converted' }, { status: 400 });
    }
    update.internal_status = 'converted';
    update.converted_org_id = nextConvertedOrgId;
    update.converted_at = current.converted_at ?? now;
  } else if (body.convertedOrgId === null) {
    update.converted_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from('early_access_leads')
    .update(update)
    .eq('id', leadId)
    .select(EARLY_ACCESS_SELECT)
    .single();

  if (error) {
    console.error('[platform-admin] early-access update error:', error);
    return NextResponse.json({ error: 'Unable to update early-access lead' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_early_access_lead',
    leadId,
    current,
    data,
  );

  return NextResponse.json({ ok: true, lead: data });
}
