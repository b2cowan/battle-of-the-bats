import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';
import { resourceLabelProblem, resourceLinkProblem } from '@/lib/resource-file-storage';

/**
 * THE RULES PAGE'S LINKS AND FILES, AS ROWS (Board Ready W2 fix B follow-up, sweep 3 finding 2's second half, 2026-11-11).
 * The browser used to write the `resources` table itself under a policy that asked only "is a member of this event's club":
 * a club's assistant coach or scorekeeper (no `post_rules`) could add, rename, repoint or reorder the public Rules page's links.
 * Every row write now comes here: the caller must be a member of THIS club with `post_rules`, in scope for the event, and the
 * event must be the club's. The FILE itself is stored and removed by `/api/admin/resources/file`.
 *
 *   POST   ?orgSlug  { tournamentId, label, url, order }   → { id }
 *   PATCH  ?orgSlug  { id, label?, url?, order? }          → { ok }     one row
 *   PATCH  ?orgSlug  { ids: [...] }                        → { ok }     the whole list's order (position = display_order)
 */

async function admit(req: Request) {
  const ctx = await getAuthContextWithScope({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() } as const;
  if (!hasCapability(ctx.role, ctx.capabilities, 'post_rules')) return { error: forbidden() } as const;
  return { ctx } as const;
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
/** The list position: a whole number a list could hold. */
const validOrder = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100000;
/** The address rule needs the project's own address to tell its files apart; without it, refuse rather than skip the check. */
const misconfigured = () => (SUPABASE_URL() ? null : NextResponse.json({ error: 'Not available' }, { status: 500 }));

export const POST = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;

  const body = (await req.json().catch(() => null)) as { tournamentId?: unknown; label?: unknown; url?: unknown; order?: unknown } | null;
  const tournamentId = typeof body?.tournamentId === 'string' ? body.tournamentId : '';
  if (!tournamentId) return bad('Missing tournamentId');
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const labelProblem = resourceLabelProblem(body?.label);
  if (labelProblem) return bad(labelProblem);
  const unavailable = misconfigured();
  if (unavailable) return unavailable;
  const linkProblem = resourceLinkProblem(body?.url, ctx.org.id, SUPABASE_URL());
  if (linkProblem) return bad(linkProblem);
  if (!validOrder(body?.order)) return bad('Bad order');
  const order = body.order;

  const { data, error } = await supabaseAdmin
    .from('resources')
    .insert({ tournament_id: tournamentId, label: (body!.label as string).trim(), url: (body!.url as string).trim(), display_order: order })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save the item' }, { status: 500 });
  return NextResponse.json({ id: data.id });
}, { route: '/api/admin/resources' });

export const PATCH = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;

  const body = (await req.json().catch(() => null)) as { id?: unknown; ids?: unknown; label?: unknown; url?: unknown; order?: unknown } | null;

  // ── The whole list's order ──
  if (Array.isArray(body?.ids)) {
    const ids = body.ids as unknown[];
    if (ids.length === 0 || ids.length > 300 || ids.some(i => typeof i !== 'string') || new Set(ids).size !== ids.length) return bad('Bad list');
    const { data: rows, error } = await supabaseAdmin.from('resources').select('id, tournament_id').in('id', ids as string[]);
    if (error) return NextResponse.json({ error: 'Couldn’t read the list' }, { status: 500 });
    if ((rows ?? []).length !== ids.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    for (const tournamentId of new Set((rows ?? []).map(r => r.tournament_id as string))) {
      const denied = scopeGuard(ctx, tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
      if (wrongOrg) return wrongOrg;
    }
    const results = await Promise.all((ids as string[]).map((id, order) => supabaseAdmin.from('resources').update({ display_order: order }).eq('id', id)));
    if (results.some(r => r.error)) return NextResponse.json({ error: 'Couldn’t save the order' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── One row ──
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return bad('Missing id');
  const { data: row, error: readError } = await supabaseAdmin.from('resources').select('id, tournament_id, url').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Couldn’t read the item' }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = scopeGuard(ctx, row.tournament_id as string);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, row.tournament_id as string);
  if (wrongOrg) return wrongOrg;

  const updates: Record<string, unknown> = {};
  if (body?.label !== undefined) {
    const problem = resourceLabelProblem(body.label);
    if (problem) return bad(problem);
    updates.label = (body.label as string).trim();
  }
  if (body?.url !== undefined) {
    // An address the row already holds is accepted as it stands (a copied event's old flat-file link); a NEW address is checked.
    if (typeof body.url !== 'string' || body.url.trim() !== String(row.url ?? '').trim()) {
      const unavailable = misconfigured();
      if (unavailable) return unavailable;
      const problem = resourceLinkProblem(body.url, ctx.org.id, SUPABASE_URL());
      if (problem) return bad(problem);
    }
    updates.url = (body.url as string).trim();
  }
  if (body?.order !== undefined) {
    if (!validOrder(body.order)) return bad('Bad order');
    updates.display_order = body.order;
  }
  if (Object.keys(updates).length === 0) return bad('Nothing to change');

  const { error } = await supabaseAdmin.from('resources').update(updates).eq('id', row.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save the item' }, { status: 500 });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/resources' });
