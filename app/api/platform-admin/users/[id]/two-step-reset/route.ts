import { NextRequest, NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { personActionContext } from '@/lib/platform-person-action';
import { requireFreshCode } from '@/lib/two-step-fresh';
import { twoStepFactsFor } from '@/lib/two-step-reset';
import { backupCodesLeft } from '@/lib/two-step-codes';
import {
  ASKED_HOW, changeSupportReset, lastClosedReset, openReset, ownedClubs, runDueResets, startSupportReset, type AskedHow,
} from '@/lib/two-step-support-reset';

/**
 * PERSON RECORD › ACCOUNT › TWO-STEP SIGN-IN (Board Ready · two-step sign-in, Part 3; drawings tab 7).
 *
 *   GET   the fact line ("On since Nov 12, 2026 · 0 backup codes left"), the clubs the person owns, and a waiting reset.
 *         For anyone who may view people.
 *   POST  `{ action: 'start', askedHow, reason }` — support's record (the platform audit line first) and the confirmation
 *         link to the account's address; `{ action: 'hold' | 'release' | 'cancel', reason }` on a waiting reset.
 *         Through the one front door (`personActionContext`: the support power, the staff guard, a required Why), and a
 *         START asks for the staff member's code (one of the five actions; staff doors ask too, ruled 2026-11-11), after
 *         every check and before the first write. RELEASE asks too: it is the direction that lets a reset the club stopped
 *         go ahead (/review of Part 3).
 *         `{ action: 'run', reason }` — this person's reset, once due, now ("Run it now"); the hourly job's own run.
 */
export const GET = withObservability(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAreaApi('customer_users', 'view');
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [facts, clubs, waiting, last] = await Promise.all([twoStepFactsFor(id), ownedClubs(id), openReset(id), lastClosedReset(id)]);
  const left = facts.on ? await backupCodesLeft(id) : 0;
  return NextResponse.json({
    on: facts.on,
    since: facts.since,
    backupCodesLeft: left,
    ownedClubs: clubs,
    waiting: waiting && {
      requestedAt: waiting.requested_at,
      confirmedAt: waiting.confirmed_at,
      runsAt: waiting.runs_at,
      heldAt: waiting.held_at,
      heldBy: waiting.held_by,
      askedBy: waiting.asked_by,
      clubNoticeCount: waiting.club_notice_count,
      linkExpiresAt: waiting.confirm_expires_at,
    },
    last: last && {
      completedAt: last.completed_at,
      cancelledAt: last.cancelled_at,
      cancelledBy: last.cancelled_by,
    },
    askedHow: ASKED_HOW,
  });
}, { route: '/api/platform-admin/users/[id]/two-step-reset' });

type Body = { action?: unknown; askedHow?: unknown; reason?: unknown };

export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ctx = await personActionContext<Body>(req, id);
  if (ctx.response) return ctx.response;
  const { auth, person, body, reason } = ctx.action;
  const staffEmail = auth.user.email ?? 'platform-admin';
  const action = body.action;

  if (action === 'start') {
    const askedHow = typeof body.askedHow === 'string' && body.askedHow in ASKED_HOW ? body.askedHow as AskedHow : null;
    if (!askedHow) return NextResponse.json({ error: 'Say how they asked.' }, { status: 400 });
    if (!person.email) return NextResponse.json({ error: 'This account has no email address to confirm with.' }, { status: 409 });
    const facts = await twoStepFactsFor(person.id);
    if (!facts.on) return NextResponse.json({ error: 'Two-step sign-in is already off for this person.', code: 'already_off' }, { status: 409 });
    const stale = await requireFreshCode();
    if (stale) return stale;
    const result = await startSupportReset({ staffEmail, person: { id: person.id, email: person.email }, askedHow, reason });
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    return NextResponse.json({ ok: true });
  }

  if (action === 'run') {
    const waiting = await openReset(person.id);
    if (!waiting?.runs_at || waiting.held_at || Date.parse(waiting.runs_at) > Date.now()) {
      return NextResponse.json({ error: 'Nothing is due for this person yet.', code: 'not_due' }, { status: 409 });
    }
    const report = await runDueResets(staffEmail, Date.now(), person.id);
    if (report.done !== 1) return NextResponse.json({ error: 'The reset didn’t run. It is still waiting; the hourly job tries again.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'hold' || action === 'release' || action === 'cancel') {
    if (action === 'release') {
      const stale = await requireFreshCode();
      if (stale) return stale;
    }
    const result = await changeSupportReset({ staffEmail, userId: person.id, action, reason });
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}, { route: '/api/platform-admin/users/[id]/two-step-reset' });
