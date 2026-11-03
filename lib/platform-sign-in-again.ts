import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase-server';
import { writePlatformAuditLog } from './platform-audit';
import {
  SIGN_IN_AGAIN_AUDIT, SIGN_IN_AGAIN_CODE, SIGN_IN_AGAIN_WORDS,
  isFreshPassword, passwordEnteredAt, type SignInAgainRefusal,
} from './sign-in-again';

/**
 * The server half of SIGN IN AGAIN (Stage 0, Part 10; the rule and the clock are in `lib/sign-in-again.ts`).
 *
 * `requireFreshSignIn` is the gate. A route calls it AFTER its own checks (count, reason, the price's Stripe check) and
 * before its first write, so nobody types a password only to be refused (Ask 13c). It answers 401 with the
 * `sign_in_again` code, which the screen turns into the window. `tests/unit/sign-in-again.test.ts` holds where.
 */
export async function requireFreshSignIn(user: User): Promise<
  { passwordAt: Date; response: null } | { passwordAt: null; response: NextResponse }
> {
  const cookieStore = await cookies();
  // Read-only, as the platform context's own client is: the gate never writes a session.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  // `getClaims` verifies the token (by the project's signing key, or the auth server when it cannot), so the `amr` read
  // here is the session's own, not a cookie someone edited.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const enteredAt = claims && claims.sub === user.id ? passwordEnteredAt(claims.amr) : null;
  if (!isFreshPassword(enteredAt, Date.now())) {
    return {
      passwordAt: null,
      response: NextResponse.json({ error: SIGN_IN_AGAIN_WORDS.refusal, code: SIGN_IN_AGAIN_CODE }, { status: 401 }),
    };
  }
  return { passwordAt: new Date(enteredAt!), response: null };
}

const CHECK_TIMEOUT_MS = 15_000;

/**
 * The window's password, checked as THIS staff member (the address is the session's, never the request's), by a fresh
 * password sign-in whose session replaces the browser's — so the request sent again carries a session that just proved
 * the password. Each wrong try is written to the audit log, with no email (Ask 7); the sign-in service sets the
 * "too many tries" wait, in our words (tab 2, note 6).
 */
export async function checkPasswordAgain(user: User, password: string): Promise<{ ok: true } | { ok: false; refusal: SignInAgainRefusal }> {
  const email = user.email!;
  let code: string | undefined;
  let status: number | undefined;
  try {
    const supabase = await createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS); }),
    ]).finally(() => clearTimeout(timer));
    if (!result.error && result.data.user?.id === user.id) {
      await writePlatformAuditLog(email, null, SIGN_IN_AGAIN_AUDIT.signedIn);
      return { ok: true };
    }
    code = result.error?.code;
    status = result.error?.status;
  } catch {
    return { ok: false, refusal: 'not_checked' };
  }
  if (code === 'invalid_credentials') {
    await writePlatformAuditLog(email, null, SIGN_IN_AGAIN_AUDIT.wrongPassword);
    return { ok: false, refusal: 'wrong_password' };
  }
  if (code === 'over_request_rate_limit' || status === 429) return { ok: false, refusal: 'too_many_tries' };
  return { ok: false, refusal: 'not_checked' };
}
