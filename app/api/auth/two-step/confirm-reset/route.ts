import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isPlausibleNoLoginToken } from '@/lib/no-login-token';
import { confirmSupportReset } from '@/lib/two-step-support-reset';

/**
 * "Confirm the reset" — the person's press on the link support's record emailed to the account's address (Board Ready ·
 * two-step sign-in, Part 3; tab 7). POST only, from the page's button, so an email scanner that fetches the link confirms
 * nothing. No sign-in: the person has lost their phone, and the link in their inbox is the proof asked for. The token is
 * 32 random bytes; only its hash is stored (mig 469).
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => null) as { token?: unknown } | null;
  const token = body?.token;
  if (!isPlausibleNoLoginToken(token)) {
    return NextResponse.json({ error: 'This link no longer works. If you still need the reset, write to support again.', code: 'link_gone' }, { status: 410 });
  }
  const result = await confirmSupportReset(token);
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, runsAt: result.value.runsAt });
}, { route: '/api/auth/two-step/confirm-reset' });
