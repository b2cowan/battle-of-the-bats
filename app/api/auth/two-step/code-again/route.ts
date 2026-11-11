import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { checkProofAgain, PROOF_REFUSAL_STATUS } from '@/lib/code-again-server';
import { CODE_AGAIN_WORDS as W, type CodeAgainRefusal } from '@/lib/code-again';

const WORDS: Record<CodeAgainRefusal, string> = {
  wrong_code: W.wrongCode,
  wrong_backup_code: W.wrongBackup,
  no_authenticator: W.noAuthenticator,
  too_many_tries: W.tooManyTries,
  not_checked: W.notChecked,
};

/**
 * The ONE "type your code again" window's check (Board Ready · two-step sign-in, Part 2). Answers a 15-minute action
 * (`two_step_fresh_code`) and the 30-day re-ask on a page already open (`two_step_code`); the window then sends the
 * person's press again once. Takes the app's code or a backup code (owner 2026-11-11).
 *
 * Reachable by a session that has the password but not yet the code, on purpose: typing the code here is the same proof
 * as the sign-in page's code step, and it reveals nothing (the answer is only "accepted" or "not").
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { code?: unknown; backupCode?: unknown };
  const result = await checkProofAgain(state, body);
  if (result.ok) return NextResponse.json({ ok: true, via: result.via, left: result.left ?? null });
  return NextResponse.json({ error: WORDS[result.refusal], code: result.refusal }, { status: PROOF_REFUSAL_STATUS[result.refusal] });
}, { route: '/api/auth/two-step/code-again' });
