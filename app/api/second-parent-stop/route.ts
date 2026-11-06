/**
 * POST /api/second-parent-stop   (form fields: org, email, token)
 *
 * The button on /second-parent-stop (Signed-in family accounts Stage 3b; owner calls O1–O5 ruled 2026-11-06). The ONLY place
 * a second parent's stop is written, and only by a POST: the link in the email opens the confirm page, and a GET writes
 * nothing, because mail scanners prefetch links and an address must never be stopped by a robot.
 *
 * No sign-in: the signed token (org + address, its own HMAC suffix) IS the authorization. It is verified BEFORE any database
 * call. The stop is one transaction in the database (second_parent_stop, mig 448): it clears the address from every sign-up of
 * THAT org and records the stop. Idempotent: a repeat succeeds and clears nothing more. Nobody is emailed (O3).
 *
 * Answers with a 303 back to the confirm page, which then shows the done state (it reads the stop it just wrote). A link we
 * cannot use goes to /second-parent-stop?error=invalid; our failure goes to ?error=db.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySecondParentStopToken } from '@/lib/unsubscribe-token';
import { withObservability } from '@/lib/observability/with-observability';

export const runtime = 'nodejs';

export const POST = withObservability(async (request: NextRequest) => {
  const go = (query: string) => NextResponse.redirect(new URL(`/second-parent-stop?${query}`, request.url), 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return go('error=invalid');
  }
  const orgId = String(form.get('org') ?? '');
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const token = String(form.get('token') ?? '');

  if (!orgId || !email || !token || !verifySecondParentStopToken(orgId, email, token)) return go('error=invalid');

  const { error } = await supabaseAdmin.rpc('second_parent_stop', { p_org: orgId, p_email: email, p_source: 'stop_page' });
  if (error) {
    // Code and message only: a failed CHECK puts the whole row, address included, in `details`.
    console.error('[second-parent-stop] stop failed:', error.code, error.message);
    return go('error=db');
  }

  return go(new URLSearchParams({ org: orgId, email, token }).toString());
}, { route: '/api/second-parent-stop' });
