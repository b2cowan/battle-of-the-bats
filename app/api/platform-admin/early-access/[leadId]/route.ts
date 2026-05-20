import { NextRequest, NextResponse } from 'next/server';
import {
  cleanInternalNotes,
  EARLY_ACCESS_SELECT,
  isEarlyAccessStatus,
} from '@/lib/early-access-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type PatchBody = {
  internalStatus?: string;
  internalNotes?: string;
  markContacted?: boolean;
  convertedOrgId?: string | null;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { leadId } = await params;
  const body = await req.json() as PatchBody;

  if (body.internalStatus !== undefined && !isEarlyAccessStatus(body.internalStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (body.internalStatus !== undefined) update.internal_status = body.internalStatus;
  if (body.internalNotes !== undefined) update.internal_notes = cleanInternalNotes(body.internalNotes);
  if (body.convertedOrgId !== undefined) update.converted_org_id = body.convertedOrgId || null;
  if (body.markContacted) {
    update.last_contacted_at = new Date().toISOString();
    update.last_contacted_by = auth.user.email ?? null;
    if (!body.internalStatus) update.internal_status = 'contacted';
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('early_access_leads')
    .select(EARLY_ACCESS_SELECT)
    .eq('id', leadId)
    .maybeSingle();

  if (currentError) {
    console.error('[platform-admin] early-access current read error:', currentError);
    return NextResponse.json({ error: 'Unable to load early-access lead' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
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
