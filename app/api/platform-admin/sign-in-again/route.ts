import { NextResponse } from 'next/server';
import { requireAnyPlatformPower } from '@/lib/platform-auth';
import { getSessionTwoStep } from '@/lib/api-auth';
import { checkCodeAgain, checkPasswordAgain } from '@/lib/platform-sign-in-again';
import { SIGN_IN_AGAIN_WORDS, type SignInAgainRefusal } from '@/lib/sign-in-again';
import { withObservability } from '@/lib/observability';

const REFUSAL: Record<SignInAgainRefusal, { status: number; error: string }> = {
  wrong_password: { status: 400, error: SIGN_IN_AGAIN_WORDS.wrongPassword },
  wrong_code: { status: 400, error: SIGN_IN_AGAIN_WORDS.wrongCode },
  too_many_tries: { status: 429, error: SIGN_IN_AGAIN_WORDS.tooManyTries },
  not_checked: { status: 503, error: SIGN_IN_AGAIN_WORDS.notChecked },
};

const refuse = (code: SignInAgainRefusal) =>
  NextResponse.json({ error: REFUSAL[code].error, code }, { status: REFUSAL[code].status });

/**
 * The SIGN IN AGAIN window (Stage 0, Part 10). Open to the staff who hold a power one of the gated doors uses (Bulk
 * changes, a Production price switch); the gated route still decides what it lets through. On success the browser's
 * session carries the fresh proof, and the screen sends its request again once (Ask 4).
 *
 * ⚖ Two-step (Board Ready, Part 1): a staff member with two-step on (all of them, outside dev's opt-out) is asked for the
 * CODE; the server decides which, from the session, never the request — a password is never checked for an account that
 * has an authenticator, because that would replace its session with a password-only one.
 */
export const POST = withObservability(async (req: Request) => {
  const auth = await requireAnyPlatformPower(['bulk_plan_status', 'bulk_sections', 'catalog']);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null) as { password?: unknown; code?: unknown } | null;
  const state = await getSessionTwoStep();
  if (state?.hasFactor) {
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code) return refuse('wrong_code');
    const result = await checkCodeAgain(auth.user, code);
    return result.ok ? NextResponse.json({ ok: true }) : refuse(result.refusal);
  }

  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) return refuse('wrong_password');

  const result = await checkPasswordAgain(auth.user, password);
  return result.ok ? NextResponse.json({ ok: true }) : refuse(result.refusal);
}, { route: '/api/platform-admin/sign-in-again' });
