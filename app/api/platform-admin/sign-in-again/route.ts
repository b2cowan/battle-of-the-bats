import { NextResponse } from 'next/server';
import { requireAnyPlatformPower } from '@/lib/platform-auth';
import { checkPasswordAgain } from '@/lib/platform-sign-in-again';
import { SIGN_IN_AGAIN_WORDS, type SignInAgainRefusal } from '@/lib/sign-in-again';
import { withObservability } from '@/lib/observability';

const REFUSAL: Record<SignInAgainRefusal, { status: number; error: string }> = {
  wrong_password: { status: 400, error: SIGN_IN_AGAIN_WORDS.wrongPassword },
  too_many_tries: { status: 429, error: SIGN_IN_AGAIN_WORDS.tooManyTries },
  not_checked: { status: 503, error: SIGN_IN_AGAIN_WORDS.notChecked },
};

const refuse = (code: SignInAgainRefusal) =>
  NextResponse.json({ error: REFUSAL[code].error, code }, { status: REFUSAL[code].status });

/**
 * The SIGN IN AGAIN window's password (Stage 0, Part 10). Open to the staff who hold a power one of the gated doors
 * uses (Bulk changes, a Production price switch); the gated route still decides what it lets through. On success the
 * browser's session is the fresh one, and the screen sends its request again once (Ask 4).
 */
export const POST = withObservability(async (req: Request) => {
  const auth = await requireAnyPlatformPower(['bulk_plan_status', 'bulk_sections', 'catalog']);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) return refuse('wrong_password');

  const result = await checkPasswordAgain(auth.user, password);
  return result.ok ? NextResponse.json({ ok: true }) : refuse(result.refusal);
}, { route: '/api/platform-admin/sign-in-again' });
