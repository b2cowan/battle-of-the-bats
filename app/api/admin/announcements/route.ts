import {
  forbidden,
  getAuthContextWithScope,
  scopeGuard,
  unauthorized,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, data } = await req.json();

    if (action !== 'save-welcome' || !data?.tournamentId) {
      return Response.json({ error: 'Invalid announcement action.' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, data.tournamentId);
    if (denied) return denied;

    const body = String(data.body ?? '').trim();
    if (!body) {
      return Response.json({ error: 'Welcome message cannot be blank.' }, { status: 400 });
    }

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
      const { error } = await supabaseAdmin
        .from('announcements')
        .update({
          body,
          pinned: true,
        })
        .eq('id', existing.id);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to save announcement.';
    return Response.json({ error: message }, { status: 500 });
  }
}
