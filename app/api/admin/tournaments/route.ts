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

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTournamentName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

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

      if (newStatus !== 'archived') {
        const { count, error: limitError } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', ctx.org.id)
          .neq('status', 'archived')
          .neq('id', id);

        if (limitError) throw limitError;

        const limit: number = ctx.org.tournamentLimit;
        if (limit < 9999 && (count ?? 0) >= limit) {
          return new Response(
            JSON.stringify({
              error: `Your plan allows ${limit} tournament slot${limit === 1 ? '' : 's'}. Archive another tournament before moving this one to ${newStatus}.`,
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (newStatus === 'active') {
        const { data: tournamentRow, error: tournamentError } = await supabase
          .from('tournaments')
          .select('start_date, end_date, contact_email')
          .eq('id', id)
          .eq('organization_id', ctx.org.id)
          .single();
        if (tournamentError) throw tournamentError;

        const { data: ageGroups, error: ageGroupsError } = await supabase
          .from('age_groups')
          .select('id, is_closed')
          .eq('tournament_id', id);
        if (ageGroupsError) throw ageGroupsError;

        const blockers: string[] = [];
        if (!tournamentRow?.start_date || !tournamentRow?.end_date) blockers.push('add tournament dates');
        if (!ageGroups?.length) blockers.push('add at least one division');
        if (!tournamentRow?.contact_email && !ctx.org.contactEmail) blockers.push('add a public contact email');
        if (ageGroups?.length && ageGroups.every(g => g.is_closed)) blockers.push('open at least one division');
        if (blockers.length > 0) {
          return Response.json(
            { error: `Before activating this tournament, please ${blockers.join(', ')}.` },
            { status: 400 }
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
      if (data.name      !== undefined) {
        const name = String(data.name).trim().replace(/\s+/g, ' ');
        if (!name) {
          return Response.json({ error: 'Tournament name is required.' }, { status: 400 });
        }

        const { data: existingNames, error: nameError } = await supabase
          .from('tournaments')
          .select('name')
          .eq('organization_id', ctx.org.id)
          .neq('status', 'archived')
          .neq('id', id);
        if (nameError) throw nameError;
        if ((existingNames ?? []).some(row => normalizeTournamentName(row.name ?? '') === normalizeTournamentName(name))) {
          return Response.json({ error: `A tournament named "${name}" already exists. Choose a different name.` }, { status: 409 });
        }

        updates.name = name;
      }
      if (data.slug      !== undefined) {
        const slug = String(data.slug).trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return Response.json({ error: 'Tournament URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
        }
        const { count } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', ctx.org.id)
          .eq('slug', slug)
          .neq('status', 'archived')
          .neq('id', id);
        if ((count ?? 0) > 0) {
          return Response.json({ error: 'A tournament with this URL already exists.' }, { status: 409 });
        }
        updates.slug = slug;
      }
      if (data.startDate !== undefined) updates.start_date = data.startDate;
      if (data.endDate   !== undefined) updates.end_date   = data.endDate;
      if (data.feeScheduleMode !== undefined) updates.fee_schedule_mode = data.feeScheduleMode;
      if (data.depositAmount   !== undefined) updates.deposit_amount    = data.depositAmount ?? null;
      if (data.depositDueDate  !== undefined) updates.deposit_due_date  = data.depositDueDate ?? null;
      if (data.totalFeeAmount  !== undefined) updates.total_fee_amount  = data.totalFeeAmount ?? null;
      if (data.totalFeeDueDate !== undefined) updates.total_fee_due_date = data.totalFeeDueDate ?? null;

      if (data.startDate !== undefined || data.endDate !== undefined) {
        const hasStartDateUpdate = data.startDate !== undefined;
        const hasEndDateUpdate = data.endDate !== undefined;
        const nextStartDate = !hasStartDateUpdate
          ? null
          : data.startDate === null || data.startDate === ''
          ? null
          : isDateValue(data.startDate)
            ? data.startDate
            : undefined;
        const nextEndDate = !hasEndDateUpdate
          ? null
          : data.endDate === null || data.endDate === ''
          ? null
          : isDateValue(data.endDate)
            ? data.endDate
            : undefined;

        if ((hasStartDateUpdate && nextStartDate === undefined) || (hasEndDateUpdate && nextEndDate === undefined)) {
          return Response.json({ error: 'Tournament dates must use YYYY-MM-DD format.' }, { status: 400 });
        }
        if (hasStartDateUpdate && hasEndDateUpdate && nextEndDate && !nextStartDate) {
          return Response.json({ error: 'Choose a start date before setting an end date.' }, { status: 400 });
        }
        if (hasStartDateUpdate && hasEndDateUpdate && nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
          return Response.json({ error: 'End date cannot be before the start date.' }, { status: 400 });
        }

        if (data.startDate !== undefined) updates.start_date = nextStartDate;
        if (data.endDate !== undefined) updates.end_date = nextEndDate;
      }

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
  } catch (err: unknown) {
    console.error('Admin Tournaments API Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
