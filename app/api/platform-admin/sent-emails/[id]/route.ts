import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { captureError } from '@/lib/observability/capture';
import { recordOpened } from '@/lib/platform-record-opens';
import { getSentEmail } from '@/lib/sent-log';
import { addressesWithAccounts, askedByLine } from '@/lib/sent-log-people';
import type { SentWindowEmail } from '@/lib/sent-log-view';
import { SENT_EMAIL_FAILED } from '@/lib/sent-log-words';

/**
 * One email's window (Support console Stage 5, drawing E4; threats T13-T16) — `GET /api/platform-admin/sent-emails/{id}`,
 * `?from=log` (opened from Health > Sent emails or from Find) or `?from=person` (a person's Emails tab).
 *
 * ⚖ The `sent_log` power is the FIRST statement (T16). An email opened from Sent emails writes one row to the trail of
 * records opened (A3: that screen can look up anyone's address, including people with no account), as opening a person
 * does. Every open writes it, whatever `from` says (the /review of the build: a browser-sent `from` must not decide
 * whether a lookup is recorded); the trail itself ignores a repeat by the same person within ten minutes. `from` is not
 * search words, so it may ride in the address; the email is named by its id, never by its address. Nothing returned is a subject, a body or a
 * link: there are none (T13). The asker's account number never leaves the server — only their name and club.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export const GET = withObservability(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('sent_log');
  if (auth.response) return json({ error: 'Forbidden' }, auth.response.status);

  try {
    const { id } = await ctx.params;
    const email = await getSentEmail(auth.role, id);
    if (!email) return json({ error: 'That email is not here. It may be older than 90 days.' }, 404);

    await recordOpened({ actorUserId: auth.user.id, actorEmail: auth.user.email, kind: 'email', recordId: id, viaFind: false });

    const [accounts, askedBy] = await Promise.all([
      addressesWithAccounts([email.to]),
      askedByLine(auth.role, email.askedBy, { id: email.orgId, name: email.orgName }),
    ]);
    // Named fields, not a spread: the asker's account number and the club's id are not the window's to carry.
    const shown: SentWindowEmail = {
      id: email.id, label: email.label, to: email.to, orgName: email.orgName, state: email.state, stateAt: email.stateAt,
      bounceReason: email.bounceReason, sentAt: email.sentAt, wasDelayed: email.wasDelayed, resendId: email.resendId, timeline: email.timeline,
    };
    return json({ email: shown, noAccount: accounts ? !accounts.has(email.to) : false, askedBy });
  } catch {
    await captureError(new Error(SENT_EMAIL_FAILED), { route: '/api/platform-admin/sent-emails/[id]', method: 'GET' });
    return json({ error: SENT_EMAIL_FAILED }, 500);
  }
}, { route: '/api/platform-admin/sent-emails/[id]' });
