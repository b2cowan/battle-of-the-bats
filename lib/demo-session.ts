import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from './supabase-admin';
import { isDemoOrganizerEmail } from './demo-org';

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

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: organizerEmail,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(linkError?.message ?? 'generateLink returned no hashed_token');
  }

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

  const { error: verifyError } = await sessionWriter.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyError) throw new Error(verifyError.message);
}

/**
 * Whoever is signed in on this request, or null when nobody is.
 *
 * Returns the SESSION, not just an email, because the door's decision is "may I replace this?" —
 * and an account with no email address (Supabase supports phone and anonymous identities) is still
 * somebody's account. Answering with an email alone made an email-less session indistinguishable
 * from no session at all, which would have let the door quietly overwrite it. Caught by the
 * 2026-08-03 adversarial review.
 *
 * Uses a READ-ONLY cookie adapter — its `setAll` has nowhere to write, so asking who is here can
 * never mutate the caller's cookies. That property is the whole point at the door, where the
 * answer decides whether we are allowed to touch their session at all.
 */
export async function currentSessionUser(
  request: NextRequest,
): Promise<{ id: string; email: string | null } | null> {
  const reader = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => { /* deliberately inert — see above */ },
      },
    },
  );
  const { data: { user } } = await reader.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email?.trim().toLowerCase() ?? null };
}
