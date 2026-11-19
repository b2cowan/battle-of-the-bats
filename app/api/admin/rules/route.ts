import { NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, requireWritableTournament, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';
import { readNewPoints, readSavedPoints, readSectionFields } from '@/lib/rule-section-input';
/**
 * THE RULES PAGE'S SECTIONS AND THEIR POINTS (Board Ready W2 fix B, the third part of sweep 3 finding 2, 2026-11-11). The browser
 * used to write `rules` and `rule_items` itself under policies that asked only "is a member of this event's club": a club's
 * assistant coach or scorekeeper (no `post_rules`) could rewrite or delete the public Rules page. Every write now comes here:
 * the caller must be a member of THIS club with `post_rules`, in scope for the event, and the event must be the club's. A
 * section's divisions must be the SAME event's divisions. A COMPLETED event's sections are locked (trust close-out 14, owner
 * 2026-11-18): every verb answers 409 with the schedule routes' own words until the event is reopened.
 *
 *   POST    ?orgSlug  { tournamentId, order, title, icon, divisionIds, items: [text] }        → { id }
 *   PUT     ?orgSlug  { id, title, icon, divisionIds, items: [{ id|null, key, content }] }     → { created: { key: id } }
 *   PATCH   ?orgSlug  { ids: [...] }                                                           → { ok }   sections' order
 *   DELETE  ?orgSlug  { id }                                                                   → { ok }   (its points go with it)
 */

async function admit(req: Request) {
  const ctx = await getAuthContextWithScope({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() } as const;
  if (!hasCapability(ctx.role, ctx.capabilities, 'post_rules')) return { error: forbidden() } as const;
  return { ctx } as const;
}
type Ctx = NonNullable<Awaited<ReturnType<typeof admit>>['ctx']>;

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const failed = (what: string) => NextResponse.json({ error: `Couldn’t ${what}` }, { status: 500 });
const validOrder = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 100000;

/** The event is in scope, the club's, and not completed (trust close-out 14: a completed event's rules are locked). */
async function eventAllowed(ctx: Ctx, tournamentId: string): Promise<Response | null> {
  return requireWritableTournament(ctx, tournamentId);
}

/** Every division named belongs to THIS event (the browser path never asked). Null = fine. */
async function divisionsOfEvent(tournamentId: string, divisionIds: string[] | null): Promise<Response | null> {
  if (!divisionIds?.length) return null;
  const { data, error } = await supabaseAdmin.from('divisions').select('id').eq('tournament_id', tournamentId).in('id', divisionIds);
  if (error) return failed('read the divisions');
  return (data ?? []).length === divisionIds.length ? null : bad('Bad divisions');
}

/**
 * A SAVED section may still name a division that was deleted since (deleting a division never cleans the lists that name it),
 * and the screen sends the stored list back unchanged. Those ids are dropped rather than refusing the save, so the section
 * stays editable; a list that was non-empty and has nothing left is refused (it would otherwise quietly become "every division").
 */
async function keepEventDivisions(tournamentId: string, divisionIds: string[] | null): Promise<{ ids: string[] | null } | Response> {
  if (!divisionIds?.length) return { ids: null };
  const { data, error } = await supabaseAdmin.from('divisions').select('id').eq('tournament_id', tournamentId).in('id', divisionIds);
  if (error) return failed('read the divisions');
  const live = new Set((data ?? []).map(d => d.id as string));
  const kept = divisionIds.filter(d => live.has(d));
  return kept.length ? { ids: kept } : bad('Bad divisions');
}

export const POST = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const tournamentId = typeof body?.tournamentId === 'string' ? body.tournamentId : '';
  if (!tournamentId) return bad('Missing tournamentId');
  const refused = await eventAllowed(ctx, tournamentId);
  if (refused) return refused;

  const fields = readSectionFields(body);
  if (!fields.ok) return bad(fields.problem);
  const points = readNewPoints(body?.items);
  if (!points.ok) return bad(points.problem);
  if (!validOrder(body?.order)) return bad('Bad order');
  const badDivisions = await divisionsOfEvent(tournamentId, fields.value.divisionIds);
  if (badDivisions) return badDivisions;

  const { data, error } = await supabaseAdmin
    .from('rules')
    .insert({ tournament_id: tournamentId, title: fields.value.title, icon: fields.value.icon, display_order: body.order, division_ids: fields.value.divisionIds })
    .select('id')
    .single();
  if (error || !data) return failed('save the section');
  if (points.value.length) {
    const { error: itemsError } = await supabaseAdmin.from('rule_items').insert(points.value.map((content, i) => ({ rule_id: data.id, content, display_order: i })));
    if (itemsError) {
      // The section and its points arrive together or not at all.
      await supabaseAdmin.from('rules').delete().eq('id', data.id);
      return failed('save the section');
    }
  }
  return NextResponse.json({ id: data.id });
}, { route: '/api/admin/rules' });

/** The section and its points in one save: removed points deleted, the rest upserted by id (every point's id comes back by key). */
export const PUT = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return bad('Missing id');

  const { data: row, error: readError } = await supabaseAdmin.from('rules').select('id, tournament_id, icon').eq('id', id).maybeSingle();
  if (readError) return failed('read the section');
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const tournamentId = row.tournament_id as string;
  const refused = await eventAllowed(ctx, tournamentId);
  if (refused) return refused;

  const fields = readSectionFields(body, row.icon as string | null);
  if (!fields.ok) return bad(fields.problem);
  const points = readSavedPoints(body?.items);
  if (!points.ok) return bad(points.problem);
  const divisions = await keepEventDivisions(tournamentId, fields.value.divisionIds);
  if (divisions instanceof Response) return divisions;

  // ⚖ Board Ready trust close-out 8 (owner 2026-11-18): ONE database step — mig 500's `rule_section_save` (its header has
  // the rules). Points are upserted by the id the screen gave them before their first save, so a retried save never adds one.
  const { data: created, error } = await supabaseAdmin.rpc('rule_section_save', {
    p_rule: id, p_title: fields.value.title, p_icon: fields.value.icon, p_division_ids: divisions.ids, p_items: points.value,
  });
  if (error) {
    if (/\brule_item_foreign\b/.test(error.message ?? '')) return bad('Bad point');
    if (/\brule_not_found\b/.test(error.message ?? '')) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return failed('save the section');
  }
  return NextResponse.json({ created: (created ?? {}) as Record<string, string> });
}, { route: '/api/admin/rules' });

export const PATCH = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 300 || ids.some(i => typeof i !== 'string') || new Set(ids).size !== ids.length) return bad('Bad list');
  const { data: rows, error } = await supabaseAdmin.from('rules').select('id, tournament_id').in('id', ids as string[]);
  if (error) return failed('read the list');
  if ((rows ?? []).length !== ids.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  for (const tournamentId of new Set((rows ?? []).map(r => r.tournament_id as string))) {
    const refused = await eventAllowed(ctx, tournamentId);
    if (refused) return refused;
  }
  const results = await Promise.all((ids as string[]).map((id, order) => supabaseAdmin.from('rules').update({ display_order: order }).eq('id', id)));
  if (results.some(r => r.error)) return failed('save the order');
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rules' });

export const DELETE = withObservability(async (req: Request) => {
  const a = await admit(req);
  if (a.error) return a.error;
  const { ctx } = a;
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return bad('Missing id');
  const { data: row, error: readError } = await supabaseAdmin.from('rules').select('id, tournament_id').eq('id', id).maybeSingle();
  if (readError) return failed('read the section');
  // Already gone (deleted in another tab): the caller treats this as done.
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const refused = await eventAllowed(ctx, row.tournament_id as string);
  if (refused) return refused;
  const { error } = await supabaseAdmin.from('rules').delete().eq('id', row.id);
  if (error) return failed('delete the section');
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rules' });
