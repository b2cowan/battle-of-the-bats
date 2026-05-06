import { createClient } from '@supabase/supabase-js';
import {
  getAuthContextWithScope,
  unauthorized,
  forbidden,
  scopeGuard,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import type { TournamentStatus } from '@/lib/types';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/admin/tournaments
 * Returns tournaments for the calling user's org, filtered by their assignment scope.
 * Owners and unscoped users (no assignment rows) receive all tournaments.
 */
export async function GET() {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  let query = supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('organization_id', ctx.org.id)
    .order('year', { ascending: false });

  if (ctx.assignedTournamentIds !== null) {
    query = query.in('id', ctx.assignedTournamentIds);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: 'Environment variables missing on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(url, key);
    const { action, id, data } = await req.json();

    // Mutating actions require create_tournaments capability
    if (action !== 'check-slug' && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {
      return forbidden();
    }

    // ── set-status ────────────────────────────────────────────────────────────
    if (action === 'set-status' && id && data?.status) {
      const denied = scopeGuard(ctx, id);
      if (denied) return denied;

      const newStatus: TournamentStatus = data.status;

      if (newStatus === 'active') {
        const { count } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', ctx.org.id)
          .eq('status', 'active')
          .neq('id', id);

        const limit: number = ctx.org.tournamentLimit;
        if (limit < 999 && (count ?? 0) >= limit) {
          return new Response(
            JSON.stringify({
              error: `Your plan allows ${limit} active tournament${limit === 1 ? '' : 's'}. Complete or archive another before activating this one.`,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error } = await supabase
        .from('tournaments')
        .update({ status: newStatus, is_active: newStatus === 'active' })
        .eq('id', id)
        .eq('organization_id', ctx.org.id);

      if (error) throw error;
    }

    // ── check-slug ────────────────────────────────────────────────────────────
    else if (action === 'check-slug' && data?.slug) {
      let slugQuery = supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', ctx.org.id)
        .eq('slug', data.slug)
        .neq('status', 'archived');

      if (data.excludeId) {
        slugQuery = slugQuery.neq('id', data.excludeId);
      }

      const { count } = await slugQuery;
      return new Response(JSON.stringify({ available: (count ?? 0) === 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── update ────────────────────────────────────────────────────────────────
    else if (action === 'update' && id) {
      const denied = scopeGuard(ctx, id);
      if (denied) return denied;

      const updates: Record<string, unknown> = {};
      if (data.year      !== undefined) updates.year       = data.year;
      if (data.name      !== undefined) updates.name       = data.name;
      if (data.slug      !== undefined) updates.slug       = data.slug;
      if (data.startDate !== undefined) updates.start_date = data.startDate;
      if (data.endDate   !== undefined) updates.end_date   = data.endDate;

      const { error } = await supabase
        .from('tournaments')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', ctx.org.id);

      if (error) throw error;
    }

    // ── set-contact-email ─────────────────────────────────────────────────────
    else if (action === 'set-contact-email' && id) {
      const contactEmail = data?.contactEmail ?? null;
      const { error } = await supabase
        .from('tournaments')
        .update({ contact_email: contactEmail })
        .eq('id', id)
        .eq('organization_id', ctx.org.id);

      if (error) throw error;
    }

    // ── delete ────────────────────────────────────────────────────────────────
    else if (action === 'delete' && id) {
      const denied = scopeGuard(ctx, id);
      if (denied) return denied;

      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id)
        .eq('organization_id', ctx.org.id);

      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Admin Tournaments API Error:', err);
    return new Response(JSON.stringify({ error: err.message ?? 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
