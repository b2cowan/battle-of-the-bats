import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { searchOrgPayees, createOrgPayee } from '@/lib/db';
import { listClubPayees } from '@/lib/club-payees';

/**
 * GET /api/admin/accounting/payees?orgSlug=&q=        — the picker's search (club-wide payees).
 * GET /api/admin/accounting/payees?orgSlug=&all=1     — the Payees page (C01): every club payee with
 *                                                        how many lines name it (what a merge moves).
 * POST { name, notes? }                                — create one.
 *
 * The club's payees only; a team's payees are the coach's.
 */
export const GET = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const url = new URL(req.url);
  if (url.searchParams.get('all') === '1') {
    // `canMove`: whether this reader may rename, share, merge or delete (3a’s one money rule) — a payee’s window
    // shows its pencil only then (the record standard: no pencil for a reader).
    return NextResponse.json({ payees: await listClubPayees(ctx.org.id), canMove: canMoveClubMoney(ctx, ctx.org) });
  }
  const payees = await searchOrgPayees(ctx.org.id, url.searchParams.get('q') ?? '');
  return NextResponse.json({ payees });
}, { route: '/api/admin/accounting/payees' });

export const POST = withObservability(async (req: Request) => {
  const r = await resolveClubMoney(req, { scope: 'books', write: true });
  if ('error' in r) return r.error;
  const { ctx } = r;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const notes: string | null = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 });

  try {
    const payee = await createOrgPayee({ orgId: ctx.org.id, name, notes, createdBy: ctx.user.id });
    return NextResponse.json({ payee }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: 'A payee with that name already exists', code: 'payee_exists' }, { status: 409 });
    throw e;
  }
}, { route: '/api/admin/accounting/payees' });
