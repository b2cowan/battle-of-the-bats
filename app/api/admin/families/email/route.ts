import { NextResponse } from 'next/server';
import { requireClubFamilyEmail } from '@/lib/club-communications-auth';
import { familyEmailPreview, resendMissedFamilies, sendFamilyEmailToClub } from '@/lib/families-email';
import { isSeasonDoorScope, parseScope } from '@/lib/families-audience';
import { FAMILY_EMAIL_WORDS as W } from '@/lib/families-words';
import { SAY } from '@/lib/club-group-email-words';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';
// A club's whole book goes inside the request, a hundred families to a provider request (Put to the owner 3): seconds
// for hundreds of families, with room for a slow provider.
export const maxDuration = 120;

/**
 * The club's family window (Club Tier Stage 7c, Asks 6 and 7 — lib/families-email.ts holds the rules).
 *   GET  — ?kind=every|teams|season|list (&teamIds=a,b | &seasonId=… | &list=owes|forms|consent|notback): what the window shows for that choice of Who — the
 *          choices, the count and the opted out, the head coaches a copy reaches, Nobody to send to, Last sent, the cap.
 *   POST — { kind, teamIds | seasonId | list, subject, body, copyCoaches, expected }: re-count, claim, send, complete the log.
 * ⚖ Since Club Communications Stage 1 (direction ruling 4, legal §2c): the OWNER and ADMINS send, with the Communications
 * switch on, and the Families book is NOT asked (`requireClubFamilyEmail`). "Families from a list" is the book's alone
 * (ask 3): offered, sent and finished only by a holder of it. A league seat uses its season's window; staff and every
 * other seat are refused (owner 2026-11-17, as ruled: a book holder who is not owner or admin loses this door).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await requireClubFamilyEmail(req);
  if ('failure' in gate) return gate.failure;
  const params = new URL(req.url).searchParams;
  const scope = parseScope({ kind: params.get('kind') ?? 'every', teamIds: params.get('teamIds') ?? '', seasonId: params.get('seasonId') ?? '', list: params.get('list') ?? '' });
  // A season's divisions, teams and statuses stay on the season's own door (9d1·6).
  if (!scope || isSeasonDoorScope(scope)) return NextResponse.json({ error: W.loadFailed }, { status: 400 });
  if (scope.kind === 'list' && !gate.facts.holdsBook) return NextResponse.json({ error: SAY.notOffered, code: 'not_offered' }, { status: 403 });
  return NextResponse.json(await familyEmailPreview(gate.ctx, scope, { holdsBook: gate.facts.holdsBook }));
}, { route: '/api/admin/families/email' });

export const POST = withObservability(async (req: Request) => {
  const gate = await requireClubFamilyEmail(req);
  if ('failure' in gate) return gate.failure;
  const { ctx, facts } = gate;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  // "Send to the N it missed" on a stopped email (9d1·10): the same row and words, never counted. A list email is the
  // book's: without it, the row is not this sender's to finish (it reads as not stopped, nothing about it leaks).
  if (body.action === 'resend') {
    if (typeof body.sendId !== 'string') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const r = await resendMissedFamilies(ctx, body.sendId, { noLists: !facts.holdsBook });
    if (!r.ok) return NextResponse.json(r.body, { status: r.status });
    await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_emailed', { resend: true, families: r.families, reached: r.reached });
    return NextResponse.json(r);
  }
  // "Families from a list" posted by hand without the book (T10).
  if (body.kind === 'list' && !facts.holdsBook) return NextResponse.json({ error: SAY.notOffered, code: 'not_offered' }, { status: 403 });
  const result = await sendFamilyEmailToClub(ctx, body);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });
  // The club's audit log: counts only — never the words, never an address.
  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_emailed', {
    kind: body.kind, list: body.kind === 'list' ? body.list : undefined, families: result.families, reached: result.reached, failed: result.failed, optedOut: result.optedOut, coaches: result.coaches,
  });
  return NextResponse.json(result);
}, { route: '/api/admin/families/email' });
