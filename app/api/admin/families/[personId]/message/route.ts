import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { loadMessageWindow } from '@/lib/families-read';
import { messageOneFamily } from '@/lib/families-email';
import { clubEmailFacts } from '@/lib/club-email-context';
import { familyReplyPlan } from '@/lib/email-club-identity';
import { senderName } from '@/lib/families-coach-ask';
import { FAMILY_MESSAGE_REASON, FAMILY_MESSAGE_WORDS as W } from '@/lib/families-words';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Message this family (chunk F; Club Tier Stage 5a, Ask 9 — the one club send window).
 *
 *   GET  — what the window shows before anything is typed: who it reaches (guardian by guardian, an opted-out one
 *          named as not receiving it), "Last messaged … by …", today's count against the cap.
 *   POST — body { subject, body }. The household door's send (`messageOneFamily`, lib/families-email.ts — the claim and
 *          the family's own cap before any email, the guarded send, replies to the sender, the claim given back when
 *          nobody was reached). A house-league season's door calls the same function under its own gate (9d-1).
 *
 * Two doors, one mechanism (plan §1.3): suppression THROUGH THE PERSON lives inside the choke point, not here. ⚠ Mail
 * paths never mix: a family is reached ONLY through `sendFamilyEmail`.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ personId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;
  const { personId } = await params;
  const read = await loadMessageWindow(ctx.org.id, personId);
  if (!read) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // The club's face and the reply line the email will carry (S3b): the window's sample draws its band and foot from them.
  const [club, sender] = await Promise.all([clubEmailFacts(ctx.org), senderName(ctx).catch(() => null)]);
  const reply = familyReplyPlan({ kind: 'person', clubName: ctx.org.name, senderEmail: ctx.user.email, senderName: sender });
  return NextResponse.json({ ...read, orgName: ctx.org.name, reason: FAMILY_MESSAGE_REASON, club, replyLine: reply.line });
}, { route: '/api/admin/families/[personId]/message' });

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
  const rawSubject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const rawMessage = typeof body.body === 'string' ? body.body.trim() : '';
  if (!rawSubject) return NextResponse.json({ error: W.needSubject, code: 'subject' }, { status: 400 });
  if (!rawMessage) return NextResponse.json({ error: W.needMessage, code: 'message' }, { status: 400 });
  if (rawSubject.length > 200 || rawMessage.length > 5000) return NextResponse.json({ error: W.tooLong, code: 'too_long' }, { status: 400 });

  const result = await messageOneFamily(ctx, personId, rawSubject, rawMessage);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });
  return NextResponse.json({ status: 'sent', recipients: result.recipients, sent: result.sent });
}, { route: '/api/admin/families/[personId]/message' });
