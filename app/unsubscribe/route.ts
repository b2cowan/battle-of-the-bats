/**
 * GET /unsubscribe?org=<orgId>&token=<token>
 *
 * CASL-compliant marketing email unsubscribe endpoint.
 * No authentication required — the signed token IS the authorization.
 *
 * On success: sets email_marketing_opt_out = true, redirects to /unsubscribe/confirmed
 * On invalid token: redirects to /unsubscribe/confirmed?error=invalid
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('org') ?? '';
  const token = searchParams.get('token') ?? '';

  // Validate token
  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) {
    return NextResponse.redirect(
      new URL('/unsubscribe/confirmed?error=invalid', request.url)
    );
  }

  // Mark org as opted out
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      email_marketing_opt_out: true,
      email_opt_out_at: new Date().toISOString(),
    })
    .eq('id', orgId);

  if (error) {
    console.error('[unsubscribe] DB update error:', error);
    return NextResponse.redirect(
      new URL('/unsubscribe/confirmed?error=db', request.url)
    );
  }

  return NextResponse.redirect(
    new URL('/unsubscribe/confirmed', request.url)
  );
}
