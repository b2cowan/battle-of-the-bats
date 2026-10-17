import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { loadHouseholdReach, loadMessageWindow } from '@/lib/families-read';
import { sendFamilyEmail } from '@/lib/family-email';
import { FAMILY_MESSAGE_REASON, FAMILY_MESSAGE_WORDS as W } from '@/lib/families-words';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writeOrgAudit } from '@/lib/org-audit';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Message this family (chunk F; Club Tier Stage 5a, Ask 9 — the one club send window).
 *
 *   GET  — what the window shows before anything is typed: who it reaches (guardian by guardian, an opted-out one
 *          named as not receiving it), "Last messaged … by …", today's count against the cap.
 *   POST — body { subject, body }. In order: the household's reach is re-read; nobody reachable is refused in words;
 *          the send is CLAIMED and the cap checked in ONE step (`family_message_claim`, mig 334 — two presses at two of
 *          three serialize there, and the second is refused with when the next can go); each guardian is emailed
 *          through `sendFamilyEmail` with replies to the sender; a claim whose send reached nobody is removed; the club's
 *          audit log records the send (counts only — never the words, never the addresses).
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
  return NextResponse.json({ ...read, orgName: ctx.org.name, reason: FAMILY_MESSAGE_REASON });
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

  // A send is an ACTION: it attaches first, so an email a coach changed since the last worklist visit is followed
  // before anyone is mailed (/review 2026-10-17). Reads stay attach-free; the worklist is the visit's one attach.
  const reach = await loadHouseholdReach(ctx.org.id, personId, { attach: true });
  if (!reach) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // The reach, decided on the press — never trusted from the window.
  const to = [...new Set(reach.recipients.filter(r => !r.optedOut).map(r => r.email))];
  if (to.length === 0) return NextResponse.json({ error: W.optedOutRace, code: 'opted_out' }, { status: 409 });

  // The claim and the cap, in one step, before any email goes.
  const { data: claim, error: claimErr } = await supabaseAdmin.rpc('family_message_claim', {
    p_org_id: ctx.org.id, p_person_id: personId, p_actor: ctx.user.id,
  });
  if (claimErr) throw claimErr;
  const c = claim as { ok: boolean; code?: string; nextAt?: string | null; messageId?: string };
  if (!c.ok) {
    if (c.code === 'cap') return NextResponse.json({ error: W.capRace(c.nextAt ?? null), code: 'cap', nextAt: c.nextAt ?? null }, { status: 409 });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // The reach's own suppression list, shared across the household's sends; the choke point re-runs the guard against
  // it per recipient.
  const { suppressed } = reach;
  // A transport that throws (the network dropped) is that guardian's refused send — never a 500 that keeps the claim
  // and invites a second press that mails the others twice (/review 2026-10-17).
  const results = await Promise.all(to.map(address =>
    sendFamilyEmail({
      orgId: ctx.org.id,
      to: address,
      subject: rawSubject,
      content: {
        teamName: ctx.org.name,
        orgName: ctx.org.name,
        title: rawSubject,
        body: rawMessage,
        reason: FAMILY_MESSAGE_REASON,
      },
      suppressed,
      // Ask 9: replies go to the person who wrote it.
      replyTo: ctx.user.email ?? null,
    }).catch(err => {
      console.error('[families] message send failed:', err instanceof Error ? err.message : String(err));
      return { status: 'provider_error' as const };
    }),
  ));
  const sent = results.filter(r => r.status === 'sent').length;
  // A send that reached NOBODY (every one refused by the transport, or suppressed since the read) is no send: the
  // claim goes, so it neither spends today's three nor reads as "Last messaged". A transport switched off in this
  // environment ('skipped') is not a failure of the send.
  const reachedNobody = results.every(r => r.status === 'provider_error' || r.status === 'suppressed');
  if (reachedNobody) {
    const { error: giveBack } = await supabaseAdmin.from('family_messages').delete().eq('id', c.messageId!).eq('org_id', ctx.org.id);
    if (giveBack) console.error('[families] a claim that reached nobody was not removed:', giveBack.message);
    return NextResponse.json({ error: W.sentNoneDelivered, code: 'not_delivered' }, { status: 502 });
  }

  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'family_messaged', { personId, guardians: to.length, delivered: sent });
  return NextResponse.json({ status: 'sent', recipients: to.length, sent });
}, { route: '/api/admin/families/[personId]/message' });
