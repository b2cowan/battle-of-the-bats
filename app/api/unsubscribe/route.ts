/**
 * POST /api/unsubscribe   (form fields: org | user | org + guardian, and token)
 *
 * The button on /unsubscribe (CASL-compliant marketing email opt-out; sweep 3, finding 7). The ONLY place an unsubscribe
 * is written, and only by a POST: the link in the email opens the confirm page, and a GET writes nothing, because mail
 * scanners prefetch links and a person (or a whole club) must never be opted out by a robot.
 *
 * No authentication: the signed token IS the authorization, verified BEFORE any database call. The fields also read from the
 * query string when the body has none, so the same address answers a mail client's one-click POST if a sender ever sets a
 * `List-Unsubscribe-Post` header (none does today).
 *
 *   user                → that PERSON opts out (coach campaigns); never the org the email was attributed to
 *   org + guardian      → that family address opts out of that club's emails; never the whole organization
 *   org                 → the organization's marketing opt-out
 * The branch order is the old route's: user, then guardian (a guardian link carries `org` too), then org. The three
 * token families are non-interchangeable (distinct HMAC).
 *
 * Answers 303 to /unsubscribe/confirmed: done, `?error=invalid` (a link we cannot use) or `?error=db` (our failure).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUnsubscribeToken, verifyUserUnsubscribeToken, verifyGuardianUnsubscribeToken } from '@/lib/unsubscribe-token';
import { withObservability } from '@/lib/observability/with-observability';

export const runtime = 'nodejs';

export const POST = withObservability(async (request: NextRequest) => {
  const go = (query = '') => NextResponse.redirect(new URL(`/unsubscribe/confirmed${query}`, request.url), 303);

  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    form = null; // a one-click POST may carry only the query string
  }
  const query = new URL(request.url).searchParams;
  const field = (name: string) => String(form?.get(name) ?? query.get(name) ?? '');

  const orgId = field('org');
  const userId = field('user');
  const guardianEmail = field('guardian').trim().toLowerCase();
  const token = field('token');

  // ── Per-USER opt-out (coach campaigns) — record the person's own choice ────────
  if (userId) {
    if (!token || !verifyUserUnsubscribeToken(userId, token)) return go('?error=invalid');
    const { error } = await supabaseAdmin
      .from('user_marketing_opt_outs')
      .upsert({ user_id: userId, opted_out_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      console.error('[unsubscribe] user opt-out update error:', error.code, error.message);
      return go('?error=db');
    }
    return go();
  }

  // ── Per-GUARDIAN opt-out ("Email families") ────────────────────────────────────
  // Tested before the org branch: a guardian link carries `org` too, and falling through would opt an entire organization
  // out of its own marketing because one parent unsubscribed from a team email. The distinct HMAC means the org branch
  // could not verify this token anyway; the ordering makes that structural rather than incidental.
  if (guardianEmail) {
    if (!orgId || !token || !verifyGuardianUnsubscribeToken(orgId, guardianEmail, token)) return go('?error=invalid');
    const { error } = await supabaseAdmin
      .from('family_email_optouts')
      .upsert(
        { org_id: orgId, email: guardianEmail, opted_out_at: new Date().toISOString(), source: 'announcement_footer' },
        { onConflict: 'org_id,email' },
      );
    if (error) {
      console.error('[unsubscribe] guardian opt-out update error:', error.code, error.message);
      return go('?error=db');
    }
    return go();
  }

  // ── Per-ORG opt-out ────────────────────────────────────────────────────────────
  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) return go('?error=invalid');
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ email_marketing_opt_out: true, email_opt_out_at: new Date().toISOString() })
    .eq('id', orgId);
  if (error) {
    console.error('[unsubscribe] DB update error:', error.code, error.message);
    return go('?error=db');
  }
  return go();
}, { route: '/api/unsubscribe' });
