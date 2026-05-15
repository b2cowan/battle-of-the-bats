import {
  forbidden,
  getAuthContextWithScope,
  scopeGuard,
  unauthorized,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

function mapRow(a: any) {
  return {
    id: a.id,
    tournamentId: a.tournament_id,
    title: a.title,
    body: a.body,
    date: a.published_at,
    pinned: a.pinned,
    ageGroupIds: a.age_group_ids ?? null,
  };
}

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return Response.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data ?? []).map(mapRow));
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    if (action === 'save-welcome') {
      if (!data?.tournamentId) return Response.json({ error: 'Missing tournamentId.' }, { status: 400 });

      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const body = String(data.body ?? '').trim();
      if (!body) return Response.json({ error: 'Welcome message cannot be blank.' }, { status: 400 });

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('announcements')
        .select('id')
        .eq('tournament_id', data.tournamentId)
        .eq('title', 'Welcome!')
        .order('published_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await supabaseAdmin.from('announcements').update({ body, pinned: true }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from('announcements').insert({
          tournament_id: data.tournamentId,
          title: 'Welcome!',
          body,
          published_at: new Date().toISOString(),
          pinned: true,
        });
        if (error) throw error;
      }
      return Response.json({ success: true });
    }

    if (action === 'save') {
      if (!data?.tournamentId) return Response.json({ error: 'Missing tournamentId.' }, { status: 400 });

      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const { data: inserted, error } = await supabaseAdmin.from('announcements').insert({
        tournament_id: data.tournamentId,
        title: data.title,
        body: data.body,
        published_at: data.date ?? new Date().toISOString(),
        pinned: data.pinned ?? false,
        age_group_ids: data.ageGroupIds?.length ? data.ageGroupIds : null,
      }).select().single();
      if (error) throw error;
      return Response.json(mapRow(inserted));
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing } = await supabaseAdmin.from('announcements').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
      }

      const updates: Record<string, unknown> = {};
      if (data.tournamentId !== undefined) updates.tournament_id = data.tournamentId;
      if (data.title !== undefined) updates.title = data.title;
      if (data.body !== undefined) updates.body = data.body;
      if (data.date !== undefined) updates.published_at = data.date;
      if (data.pinned !== undefined) updates.pinned = data.pinned;
      if (data.ageGroupIds !== undefined) updates.age_group_ids = data.ageGroupIds?.length ? data.ageGroupIds : null;

      const { error } = await supabaseAdmin.from('announcements').update(updates).eq('id', id);
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing } = await supabaseAdmin.from('announcements').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
      }

      const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
      if (error) throw error;
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to process announcement.';
    return Response.json({ error: message }, { status: 500 });
  }
}
