/**
 * GET /api/admin/email/sends?batchId=<uuid>
 *
 * Returns individual email_sends rows for a given batch.
 * Used by the expandable batch row in the sent history table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const auth = await getPlatformAdminContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('email_sends')
    .select('id, recipient_email, recipient_name, recipient_org_id, status, suppression_reason, resend_message_id, sent_at, created_at')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sends' }, { status: 500 });
  }

  return NextResponse.json({ sends: data ?? [] });
}
