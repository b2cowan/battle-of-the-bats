/**
 * GET /unsubscribe?org=<orgId>&token=<token>                      — org-level marketing opt-out
 * GET /unsubscribe?user=<userId>&token=<token>                    — per-person opt-out (coach campaigns)
 * GET /unsubscribe?org=<orgId>&guardian=<email>&token=<token>     — per-family opt-out ("Email families")
 *
 * CASL-compliant marketing email unsubscribe endpoint.
 * No authentication required — the signed token IS the authorization.
 *
 * The per-user path (CASL fix, Notification Settings Phase 2) exists so that an individual
 * (a coach) unsubscribing from a coach-targeted email opts out THAT PERSON, never the org the
 * email was attributed to. User tokens and org tokens are non-interchangeable (distinct HMAC).
 *
 * On success: sets the appropriate opt-out, redirects to /unsubscribe/confirmed.
 * On invalid token: redirects to /unsubscribe/confirmed?error=invalid
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  verifyUnsubscribeToken,
  verifyUserUnsubscribeToken,
  verifyGuardianUnsubscribeToken,
} from '@/lib/unsubscribe-token';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('org') ?? '';
  const userId = searchParams.get('user') ?? '';
  const guardianEmail = (searchParams.get('guardian') ?? '').trim().toLowerCase();
  const token = searchParams.get('token') ?? '';

  const invalid = () =>
    NextResponse.redirect(new URL('/unsubscribe/confirmed?error=invalid', request.url));
  const dbError = () =>
    NextResponse.redirect(new URL('/unsubscribe/confirmed?error=db', request.url));
  const done = () =>
    NextResponse.redirect(new URL('/unsubscribe/confirmed', request.url));

  // ── Per-USER opt-out (coach campaigns) — record the person's own choice ────────
  if (userId) {
    if (!token || !verifyUserUnsubscribeToken(userId, token)) return invalid();

    const { error } = await supabaseAdmin
      .from('user_marketing_opt_outs')
      .upsert(
        { user_id: userId, opted_out_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

    if (error) {
      console.error('[unsubscribe] user opt-out update error:', error);
      return dbError();
    }
    return done();
  }

  // ── Per-GUARDIAN opt-out (Chunk D 0.3 — "Email families") ─────────────────────
  // MUST be tested before the org branch: a guardian link carries `org` too, and falling
  // through to the org branch would opt an entire organization out of its own marketing
  // because one parent unsubscribed from a team email. The distinct HMAC means the org
  // branch could not verify this token anyway — this ordering makes that structural rather
  // than incidental.
  if (guardianEmail) {
    if (!orgId || !token || !verifyGuardianUnsubscribeToken(orgId, guardianEmail, token)) return invalid();

    const { error } = await supabaseAdmin
      .from('family_email_optouts')
      .upsert(
        { org_id: orgId, email: guardianEmail, opted_out_at: new Date().toISOString(), source: 'announcement_footer' },
        { onConflict: 'org_id,email' },
      );

    if (error) {
      console.error('[unsubscribe] guardian opt-out update error:', error);
      return dbError();
    }
    return done();
  }

  // ── Per-ORG opt-out (existing behaviour) ───────────────────────────────────────
  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) return invalid();

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      email_marketing_opt_out: true,
      email_opt_out_at: new Date().toISOString(),
    })
    .eq('id', orgId);

  if (error) {
    console.error('[unsubscribe] DB update error:', error);
    return dbError();
  }

  return done();
}
