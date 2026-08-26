import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from './supabase-admin';
import { isDemoOrganizerEmail } from './demo-org';
import { SANDBOX_MARKER_COOKIE, SANDBOX_MARKER_MAX_AGE_SECONDS } from './sandbox-exit-rule';

/**
 * lib/demo-session.ts — establishing the ONE demo organizer's session.
 *
 * Shared by the two places that may do it: the door (`/see-it-live`) for a visitor who is signed
 * out, and the confirm step (`/see-it-live/switch`) for a visitor who was signed in as somebody
 * else and said yes to swapping. Stated once so those two can never drift into different rules
 * about who may be signed in.
 *
 * ── The rule this module exists to keep ─────────────────────────────────────────────────────
 *
 * **The address is checked against the hardcoded allow-list before anything happens**, even though
 * every caller passes a compile-time constant. The check earns its keep the day somebody threads a
 * value through from a request — which is exactly the day it must refuse rather than obey.
 *
 * The demo account has no usable password (the seed sets a random one and discards it), so the
 * session is established the way an email link would: mint a one-time token with the service-role
 * client and redeem it server-side. **Nothing is ever emailed** — `generateLink` only generates.
 * Redeeming writes the session cookies onto the response the caller hands in, which also means it
 * REPLACES whatever session those cookies held. That is why only these two callers exist, and why
 * one of them asks first.
 */

/**
 * Write the demo organizer's session cookies onto `response`.
 * @throws if the address is not on the allow-list, or if the session cannot be established.
 */
export async function attachDemoSession(
  request: NextRequest,
  response: NextResponse,
  organizerEmail: string,
): Promise<void> {
  if (!isDemoOrganizerEmail(organizerEmail)) {
    throw new Error('refused to establish a session for an address that is not on the demo allow-list');
  }

  // The "this browser has been through a demo door" marker, set in the ONE place every door
  // already funnels through so a new door cannot forget it. It carries no authority — it is the
  // cheap hint that lets the leave-the-demo rule (lib/sandbox-exit.ts) skip a session read for
  // every visitor who has never seen a sandbox. Same response, same write, one thing.
  response.cookies.set(SANDBOX_MARKER_COOKIE, '1', {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // the two client-side exits clear it as well; it is a hint, not a credential
    secure: process.env.NODE_ENV === 'production',
    maxAge: SANDBOX_MARKER_MAX_AGE_SECONDS,
  });

  const sessionWriter = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // GoTrue keeps ONE live token per user: a concurrent press for the same shared demo account
  // invalidates the token minted here before it is redeemed — GoTrue reports that as
  // `otp_expired` ("Email link is invalid or has expired", seen on prod 2026-08-22). One retry
  // re-mints after losing that race; only a third overlapping press within milliseconds can lose
  // twice. Every OTHER verify failure throws immediately: a re-mint cannot cure it, and retrying
  // a rate-limit response would add to the very pressure that caused it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: organizerEmail,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new Error(linkError?.message ?? 'generateLink returned no hashed_token');
    }
    const { error: verifyError } = await sessionWriter.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (!verifyError) return;
    const lostTokenRace =
      verifyError.code === 'otp_expired' || /invalid or has expired/i.test(verifyError.message);
    if (!lostTokenRace || attempt === 1) throw new Error(verifyError.message);
  }
}

/**
 * Whoever is signed in on this request, or null when nobody is.
 *
 * Lives in `lib/sandbox-exit.ts` now — the leave-the-demo rule runs in the proxy and asks the
 * same question, and the proxy must not pull in this module's service-role client to ask it.
 * Re-exported here because the doors and the confirm screens have always imported it from the
 * module that establishes the session, and that reads correctly: same question, one answer.
 *
 * It returns the SESSION, not just an email, because the door's decision is "may I replace this?" —
 * and an account with no email address (Supabase supports phone and anonymous identities) is still
 * somebody's account. Answering with an email alone made an email-less session indistinguishable
 * from no session at all, which would have let the door quietly overwrite it. Caught by the
 * 2026-08-03 adversarial review.
 */
export { currentSessionUser } from './sandbox-exit';
