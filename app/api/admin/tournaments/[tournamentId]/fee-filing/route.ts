import { NextResponse } from 'next/server';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden } from '@/lib/api-auth';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentInOrg } from '@/lib/org-references';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ tournamentId: string }> };

async function gate(req: Request, tournamentId: string) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { response: unauthorized(), ctx: null };
  if (!canMoveClubMoney(ctx, ctx.org)) return { response: forbidden(), ctx: null };
  const outOfScope = scopeGuard(ctx, tournamentId);
  if (outOfScope) return { response: outOfScope, ctx: null };
  if (!(await tournamentInOrg(ctx.org.id, tournamentId))) {
    return { response: NextResponse.json({ error: 'Tournament not found' }, { status: 404 }), ctx: null };
  }
  return { response: null, ctx };
}

async function read(tournamentId: string) {
  const { data, error } = await supabaseAdmin.from('tournament_fee_book_settings')
    .select('category_id, item_id, budget_categories(name)')
    .eq('tournament_id', tournamentId).maybeSingle();
  if (error) throw error;
  const category = data?.budget_categories as unknown as { name: string } | null;
  return { word: category?.name ?? null, categoryId: data?.category_id ?? null, itemId: data?.item_id ?? null };
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const { tournamentId } = await params;
  const { response } = await gate(req, tournamentId);
  if (response) return response;
  return NextResponse.json(await read(tournamentId));
}, { route: '/api/admin/tournaments/[tournamentId]/fee-filing' });

export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const { tournamentId } = await params;
  const { response } = await gate(req, tournamentId);
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const word = typeof body.word === 'string' ? body.word.trim() : '';
  if (!word || word.length > 100) {
    return NextResponse.json({ error: 'Choose a budget category of 1 to 100 characters.' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.rpc('club_tournament_fee_word', { p_tournament: tournamentId, p_word: word });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(await read(tournamentId));
}, { route: '/api/admin/tournaments/[tournamentId]/fee-filing' });
