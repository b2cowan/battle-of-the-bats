import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { loadHouseholdRecipients } from '@/lib/families-read';
import { sendFamilyEmail, getFamilySuppressionList } from '@/lib/family-email';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Message the household (chunk F). body: { subject, body }
 *
 * Two doors, one mechanism (plan §1.3): this sends through sendFamilyEmail —
 * the SAME choke point the coach announcement path uses. Suppression THROUGH
 * THE PERSON lives inside that choke point, not here: this route's only jobs
 * are the narrow read of who the household is, and a friendly aggregate answer.
 *
 * ⚠ NO SEND CAP YET. The announcement path limits a team to N sends per 24h by
 * counting its own send-log rows; nothing records a per-family send, so there is
 * nothing here to count. That record is the "date only" message log the owner
 * chose on 2026-08-18 — the cap and the log want the SAME row, so they land
 * together in the next unit rather than growing two mechanisms.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;

  const { personId } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const message = typeof body.body === 'string' ? body.body.trim().slice(0, 5000) : '';
  if (!subject || !message) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 });
  }

  const household = await loadHouseholdRecipients(ctx.org.id, personId);
  if (!household) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // One list fetch, shared across the household's sends; the choke point re-runs
  // the guard against it per recipient. The list already covers former addresses
  // (it expands through the person), so there is nothing to hand it about who
  // this household is.
  const suppressed = await getFamilySuppressionList(ctx.org.id);
  const results = await Promise.all(household.recipientEmails.map(to =>
    sendFamilyEmail({
      orgId: ctx.org.id,
      to,
      subject,
      content: {
        teamName: ctx.org.name,
        orgName: ctx.org.name,
        title: subject,
        body: message,
        reason: 'your family is registered with this organization',
      },
      suppressed,
    }),
  ));

  const sent = results.filter(r => r.status === 'sent').length;
  if (sent === 0 && results.every(r => r.status === 'suppressed')) {
    return NextResponse.json({ status: 'suppressed', reason: 'This family has opted out of club email.' });
  }
  return NextResponse.json({ status: 'sent', recipients: household.recipientEmails.length, sent });
}, { route: '/api/admin/families/[personId]/message' });
