/**
 * POST /api/invitation-stop   (form fields: i, token)
 *
 * The button on /invitation-stop (Signed-in family accounts Stage 4a, Part 5.3; /legal draft (c)). The ONLY place a rep
 * invitation stop is written, and only by a POST (mail scanners prefetch links; an address must never be stopped by a robot).
 *
 * No sign-in: the signed token (the invitation id, its own HMAC suffix) IS the authorization, verified BEFORE any database call.
 * It records `family_invite_stops` (org + address; the rep Send invitation then refuses that address in words) and cancels the
 * address's open rep invitations in that club. Never `second_parent_stops`, never `family_email_optouts`: emails about a sign-up
 * of the address's own still go. Idempotent. Nobody is emailed. Answers with a 303 back to the page (done / invalid / db).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyInviteStopToken } from '@/lib/unsubscribe-token';
import { withObservability } from '@/lib/observability/with-observability';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';

export const runtime = 'nodejs';

export const POST = withObservability(async (request: NextRequest) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });
  const go = (query: string) => NextResponse.redirect(new URL(`/invitation-stop?${query}`, request.url), 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return go('error=invalid');
  }
  const i = String(form.get('i') ?? '');
  const token = String(form.get('token') ?? '');
  if (!i || !token || !verifyInviteStopToken(i, token)) return go('error=invalid');

  const { data: inv, error: invError } = await supabaseAdmin.from('family_invitations').select('org_id, email').eq('id', i).maybeSingle();
  if (invError) return go('error=db');
  if (!inv) return go('error=invalid');
  const { org_id: orgId, email } = inv as { org_id: string; email: string };

  const { error: stopError } = await supabaseAdmin
    .from('family_invite_stops').upsert({ org_id: orgId, email }, { onConflict: 'org_id,email', ignoreDuplicates: true });
  if (stopError) {
    console.error('[invitation-stop] stop failed:', stopError.code, stopError.message);
    return go('error=db');
  }
  const { error: cancelError } = await supabaseAdmin.from('family_invitations')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('org_id', orgId).eq('email', email).eq('source', 'rep_coach').is('used_at', null).is('cancelled_at', null);
  if (cancelError) console.error('[invitation-stop] open invitations were not cancelled:', cancelError.code, cancelError.message);

  return go(new URLSearchParams({ i, token }).toString());
}, { route: '/api/invitation-stop' });
