/**
 * POST /api/admin/email/resubscribe
 *
 * Platform admin action: re-subscribe an org that previously opted out.
 * Only for cases where the org owner explicitly contacts support.
 *
 * Body: { orgId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const auth = await getPlatformAdminContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let orgId: string;
  try {
    const body = await request.json();
    orgId = body.orgId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      email_marketing_opt_out: false,
      email_opt_out_at: null,
    })
    .eq('id', orgId);

  if (error) {
    console.error('[email/resubscribe] DB update error:', error);
    return NextResponse.json({ error: 'Failed to update opt-out status' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
