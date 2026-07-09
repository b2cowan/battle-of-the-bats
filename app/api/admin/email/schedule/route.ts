/**
 * POST /api/admin/email/schedule
 *
 * Update a marketing campaign's editable planned send date (P2). This date is a planning
 * reminder that drives the dashboard's "upcoming" / "past due" lists — it does NOT trigger
 * an automatic send. Trigger-based campaigns (welcome at signup, check-in ~day 60) have
 * system-defined timing and no editable date.
 *
 * Body: { emailKey: string, plannedDate: 'YYYY-MM-DD' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

// Event-triggered campaigns — their timing is system-defined, so no editable date.
const TRIGGER_KEYS = new Set(['founding_welcome', 'founding_checkin']);

export const POST = withObservability(async (request: NextRequest) => {
  const auth = await requirePlatformAreaApi('email', 'write');
  if (auth.response) return auth.response;

  let emailKey: string;
  let plannedDate: string;
  try {
    const body = await request.json();
    emailKey = body.emailKey;
    plannedDate = body.plannedDate;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!emailKey || TRIGGER_KEYS.has(emailKey)) {
    return NextResponse.json(
      { error: 'This campaign has system-defined timing — its date is not editable.' },
      { status: 400 },
    );
  }
  if (typeof plannedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return NextResponse.json({ error: 'plannedDate must be in YYYY-MM-DD format.' }, { status: 400 });
  }
  // Reject an impossible calendar date (e.g. 2026-13-40 or 2026-02-30).
  const [y, m, d] = plannedDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return NextResponse.json({ error: 'That is not a valid calendar date.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('platform_email_templates')
    .update({
      planned_send_date: plannedDate,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.email ?? auth.user.id,
    })
    .eq('key', emailKey)
    .eq('category', 'marketing')
    .select('key, planned_send_date')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: `Unknown campaign: ${emailKey}` }, { status: 404 });

  return NextResponse.json({ emailKey: data.key, plannedDate: data.planned_send_date });
}, { route: '/api/admin/email/schedule' });
