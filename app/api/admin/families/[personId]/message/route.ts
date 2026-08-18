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
 * THE PERSON lives inside that choke point (its `personEmails` guard), not
 * here: this route's only jobs are the narrow read of who the household is,
 * and a friendly aggregate answer.
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

  // One list fetch, shared across the household's sends; the choke point
  // re-runs the guard against it per recipient (address AND through-the-person).
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
      personEmails: household.personEmails,
    }),
  ));

  const sent = results.filter(r => r.status === 'sent').length;
  if (sent === 0 && results.every(r => r.status === 'suppressed')) {
    return NextResponse.json({ status: 'suppressed', reason: 'This family has opted out of club email.' });
  }
  return NextResponse.json({ status: 'sent', recipients: household.recipientEmails.length, sent });
}, { route: '/api/admin/families/[personId]/message' });
