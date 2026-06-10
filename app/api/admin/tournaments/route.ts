import { createClient } from '@supabase/supabase-js';
import {
  getAuthContextWithScope,
  unauthorized,
  forbidden,
  scopeGuard,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import type { TournamentStatus } from '@/lib/types';
import { supabaseAdmin, getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { hasPlanFeature } from '@/lib/plan-features';
import { sendEmail, SITE_URL, tournamentResultsFinalizedHtml } from '@/lib/email';
import { writePlatformEvent } from '@/lib/platform-events';
import { ROSTER_WAIVER_TEXT_MAX_LENGTH } from '@/lib/roster-requirements';

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTournamentName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

type CompletionNotificationTournament = {
  id: string;
  name: string;
  slug: string | null;
  status: TournamentStatus | null;
  contact_email: string | null;
  notify_teams_on_complete: boolean | null;
  results_notified_at: string | null;
};

type ResultsNotificationTeam = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
};

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function trackResultsNotificationEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  status: 'attempted' | 'blocked' | 'completed' | 'skipped';
  notified?: number;
  reason?: string;
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'post_tournament_summary',
      action: 'send_post_event_results_notification',
      tournamentId: input.tournamentId,
      status: input.status,
      notified: input.notified,
      reason: input.reason,
    },
  });
}

async function sendCompletionResultsNotification(input: {
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthContextWithScope>>>;
  tournament: CompletionNotificationTournament;
}) {
  const { ctx, tournament } = input;

  await trackResultsNotificationEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId: tournament.id,
    status: 'attempted',
  });

  if (!tournament.notify_teams_on_complete) {
    await trackResultsNotificationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId: tournament.id,
      status: 'skipped',
      reason: 'disabled',
    });
    return;
  }

  if (tournament.results_notified_at) {
    await trackResultsNotificationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId: tournament.id,
      status: 'skipped',
      reason: 'already_notified',
    });
    return;
  }

  if (!hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
    await trackResultsNotificationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId: tournament.id,
      status: 'blocked',
      reason: 'plan_gate',
    });
    return;
  }

  if (!tournament.slug) {
    await trackResultsNotificationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId: tournament.id,
      status: 'skipped',
      reason: 'missing_slug',
    });
    return;
  }

  const notifiedAt = new Date().toISOString();
  const { data: lockRows, error: lockError } = await supabaseAdmin
    .from('tournaments')
    .update({ results_notified_at: notifiedAt })
    .eq('id', tournament.id)
    .eq('org_id', ctx.org.id)
    .is('results_notified_at', null)
    .select('id');

  if (lockError) throw lockError;
  if (!lockRows?.length) {
    await trackResultsNotificationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId: tournament.id,
      status: 'skipped',
      reason: 'already_notified',
    });
    return;
  }

  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .select('id, name, coach, email')
    .eq('tournament_id', tournament.id)
    .eq('status', 'accepted');

  if (teamsError) throw teamsError;

  const recipients = new Map<string, ResultsNotificationTeam>();
  for (const team of (teams ?? []) as ResultsNotificationTeam[]) {
    const email = normalizeEmail(team.email);
    if (email && !recipients.has(email)) recipients.set(email, { ...team, email });
  }

  const resultsUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/standings`;
  const scheduleUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/schedule`;
  const teamsUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/teams`;
  const fieldLogicUrl = `${SITE_URL}/pricing?source=post_event_results_email`;
  const teamUrl = `${SITE_URL}/coaches/start?billing=annual&source=post_event_results_email&orgSlug=${encodeURIComponent(ctx.org.slug)}&tournamentSlug=${encodeURIComponent(tournament.slug)}`;
  // Coach-facing results email respects the "Communication with coaches" toggle and resolves
  // the selected contact member. Off → no contact shown.
  const resultsFallback = (await getOrgOwnerEmail(ctx.org.id)) ?? ctx.org.contactEmail ?? null;
  const contactEmail = (await resolveTournamentContactEmail(tournament.id, resultsFallback, 'coach')) ?? undefined;
  let sent = 0;

  for (const recipient of recipients.values()) {
    await sendEmail(
      recipient.email!,
      `Final Results Posted - ${tournament.name}`,
      tournamentResultsFinalizedHtml({
        tournamentName: tournament.name,
        coachName: recipient.coach || recipient.name,
        resultsUrl,
        scheduleUrl,
        teamsUrl,
        fieldLogicUrl,
        teamUrl,
        contactEmail,
      }),
    );
    sent++;
  }

  const { error: updateError } = await supabaseAdmin
    .from('tournaments')
    .update({ results_notification_sent_count: sent })
    .eq('id', tournament.id)
    .eq('org_id', ctx.org.id);

  if (updateError) throw updateError;

  await trackResultsNotificationEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId: tournament.id,
    status: 'completed',
    notified: sent,
  });
}

/**
 * GET /api/admin/tournaments
 * Returns tournaments for the calling user's org, filtered by their assignment scope.
 * Owners and unscoped users (no assignment rows) receive all tournaments.
 */
export async function GET(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  let query = supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('org_id', ctx.org.id)
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
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
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
      let completionNotificationTournament: CompletionNotificationTournament | null = null;

      if (newStatus !== 'archived') {
        const { count, error: limitError } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', ctx.org.id)
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
          .eq('org_id', ctx.org.id)
          .single();
        if (tournamentError) throw tournamentError;

        const { data: divisions, error: divisionsError } = await supabase
          .from('divisions')
          .select('id, is_closed')
          .eq('tournament_id', id);
        if (divisionsError) throw divisionsError;

        const blockers: string[] = [];
        if (!tournamentRow?.start_date || !tournamentRow?.end_date) blockers.push('add tournament dates');
        if (!divisions?.length) blockers.push('add at least one division');
        if (!tournamentRow?.contact_email && !ctx.org.contactEmail) blockers.push('add a public contact email');
        if (divisions?.length && divisions.every(g => g.is_closed)) blockers.push('open at least one division');
        if (blockers.length > 0) {
          return Response.json(
            { error: `Before activating this tournament, please ${blockers.join(', ')}.` },
            { status: 400 }
          );
        }

      }

      if (newStatus === 'completed') {
        const { data: tournamentRow, error: tournamentError } = await supabase
          .from('tournaments')
          .select('id, name, slug, status, contact_email, notify_teams_on_complete, results_notified_at')
          .eq('id', id)
          .eq('org_id', ctx.org.id)
          .single();
        if (tournamentError) throw tournamentError;
        completionNotificationTournament = tournamentRow as CompletionNotificationTournament;
      }

      const { error } = await supabase
        .from('tournaments')
        .update({ status: newStatus, is_active: newStatus === 'active' })
        .eq('id', id)
        .eq('org_id', ctx.org.id);

      if (error) throw error;

      if (
        newStatus === 'completed' &&
        completionNotificationTournament &&
        completionNotificationTournament.status !== 'completed'
      ) {
        try {
          await sendCompletionResultsNotification({ ctx, tournament: completionNotificationTournament });
        } catch (notificationError) {
          console.error('[tournaments] post-event results notification failed:', notificationError);
        }
      }
    }

    // ── check-slug ────────────────────────────────────────────────────────────
    else if (action === 'check-slug' && data?.slug) {
      let slugQuery = supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', ctx.org.id)
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
          .eq('org_id', ctx.org.id)
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
          .eq('org_id', ctx.org.id)
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
      if (data.notifyTeamsOnComplete !== undefined) {
        const wantsNotification = Boolean(data.notifyTeamsOnComplete);
        if (wantsNotification && !hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
          return Response.json({ error: 'Post-event result notifications are included with Tournament Plus, League, and Club.' }, { status: 403 });
        }
        updates.notify_teams_on_complete = wantsNotification;
      }

      // Contact model refactor fields (migration 088)
      if ('defaultContactMemberId' in data) {
        const memberId = data.defaultContactMemberId;
        if (memberId !== null && memberId !== undefined) {
          // Validate the member belongs to this org
          const { data: member } = await supabase
            .from('organization_members')
            .select('id')
            .eq('id', memberId)
            .eq('organization_id', ctx.org.id)
            .single();
          if (!member) {
            return Response.json({ error: 'Contact member not found in this organization.' }, { status: 400 });
          }
          updates.default_contact_member_id = memberId;
        } else {
          updates.default_contact_member_id = null;
        }
      }
      if (data.notifyMode !== undefined) {
        if (data.notifyMode !== 'all' && data.notifyMode !== 'assigned') {
          return Response.json({ error: "notifyMode must be 'all' or 'assigned'." }, { status: 400 });
        }
        updates.notify_mode = data.notifyMode;
      }

      // Contact visibility toggles (migration 120) — control each audience independently.
      if (data.contactShowToCoaches !== undefined) updates.contact_show_to_coaches = Boolean(data.contactShowToCoaches);
      if (data.contactShowOnPublic !== undefined) updates.contact_show_on_public = Boolean(data.contactShowOnPublic);

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
        .eq('org_id', ctx.org.id);

      if (error) throw error;
    }

    // ── patch-settings ────────────────────────────────────────────────────────
    else if (action === 'patch-settings' && id && data?.settings !== undefined) {
      const denied = scopeGuard(ctx, id);
      if (denied) return denied;

      // Whitelist known settings keys so arbitrary data can't be injected.
      const ALLOWED_SETTINGS_KEYS = new Set([
        'format',
        'rulesLayout',
        'resourcesLayout',
        'game_duration_minutes',
        'buffer_minutes',
        'schedule_travel_venue_buffer_minutes',
        'schedule_travel_facility_buffer_minutes',
        // Scope controls (Phase 2 — Divisions UX Rework)
        'game_timing_scope',
        'tie_breakers',
        'tie_breaker_scope',
        'max_run_diff_per_game',
        'fee_scope',
        // Public registration payment display
        'show_fees_on_register',
        'payment_instructions',
        'payment_instructions_on_form',
        // Automatic coach-email on/off switches
        'coach_email_confirmation',
        'coach_email_acceptance',
        'coach_email_rejection',
        'coach_email_payment',
        // Roster requirements (Phase 5f) — what coaches must provide on the event roster
        'roster_require',
        'roster_require_dob',
        'roster_require_jersey',
        'roster_require_waiver',
        'roster_waiver_text',
        'roster_min_players',
        'roster_max_players',
      ]);
      const FORMAT_VALUES           = new Set(['round_robin_playoffs', 'playoff_only']);
      const RULES_LAYOUT_VALUES     = new Set(['columns', 'single']);
      const RESOURCES_LAYOUT_VALUES = new Set(['list', 'grid']);
      const GAME_TIMING_SCOPE_VALUES  = new Set(['tournament', 'allow_override', 'per_division']);
      const TIE_BREAKER_SCOPE_VALUES  = new Set(['tournament', 'allow_override', 'per_division']);
      const FEE_SCOPE_VALUES          = new Set(['tournament', 'allow_override', 'per_division', 'free']);
      const TIE_BREAKER_VALID_VALUES  = new Set(['h2h', 'rf', 'ra', 'rd', 'coin']);

      const sanitized: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data.settings as Record<string, unknown>)) {
        if (!ALLOWED_SETTINGS_KEYS.has(k)) continue;
        if (k === 'format'          && !FORMAT_VALUES.has(String(v))) continue;
        if (k === 'rulesLayout'     && !RULES_LAYOUT_VALUES.has(String(v))) continue;
        if (k === 'resourcesLayout' && !RESOURCES_LAYOUT_VALUES.has(String(v))) continue;
        if (k === 'game_duration_minutes') {
          const n = Number(v);
          if (!Number.isInteger(n) || n < 1 || n > 600) continue;
          sanitized[k] = n;
          continue;
        }
        if (k === 'buffer_minutes') {
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0 || n > 120) continue;
          sanitized[k] = n;
          continue;
        }
        if (k === 'schedule_travel_venue_buffer_minutes' || k === 'schedule_travel_facility_buffer_minutes') {
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0 || n > 240) continue;
          sanitized[k] = n;
          continue;
        }
        if (k === 'game_timing_scope') {
          if (v !== null && !GAME_TIMING_SCOPE_VALUES.has(String(v))) continue;
          sanitized[k] = v ?? null;
          continue;
        }
        if (k === 'tie_breaker_scope') {
          if (v !== null && !TIE_BREAKER_SCOPE_VALUES.has(String(v))) continue;
          sanitized[k] = v ?? null;
          continue;
        }
        if (k === 'fee_scope') {
          if (v !== null && !FEE_SCOPE_VALUES.has(String(v))) continue;
          sanitized[k] = v ?? null;
          continue;
        }
        if (k === 'tie_breakers') {
          if (!Array.isArray(v)) continue;
          // De-dupe + keep only valid breakers, preserving order. Subset allowed.
          const seen = new Set<string>();
          const validated = (v as unknown[])
            .map(String)
            .filter(b => TIE_BREAKER_VALID_VALUES.has(b) && !seen.has(b) && seen.add(b));
          if (validated.length === 0) continue;
          sanitized[k] = validated;
          continue;
        }
        if (k === 'max_run_diff_per_game') {
          // null/'' clears the cap; otherwise a positive integer (1–99) = max per-game run diff.
          if (v === null || v === '') { sanitized[k] = null; continue; }
          const n = Number(v);
          if (!Number.isInteger(n) || n < 1 || n > 99) continue;
          sanitized[k] = n;
          continue;
        }
        if (
          k === 'show_fees_on_register' || k === 'payment_instructions_on_form' ||
          k === 'coach_email_confirmation' || k === 'coach_email_acceptance' ||
          k === 'coach_email_rejection' || k === 'coach_email_payment' ||
          k === 'roster_require' || k === 'roster_require_dob' ||
          k === 'roster_require_jersey' || k === 'roster_require_waiver'
        ) {
          if (typeof v !== 'boolean') continue;
          sanitized[k] = v;
          continue;
        }
        if (k === 'roster_min_players' || k === 'roster_max_players') {
          // null/'' clears the limit; otherwise an integer roster size.
          if (v === null || v === '') { sanitized[k] = null; continue; }
          const n = Number(v);
          if (!Number.isInteger(n) || n < 1 || n > 99) continue;
          sanitized[k] = n;
          continue;
        }
        if (k === 'payment_instructions') {
          if (v === null || v === '') { sanitized[k] = ''; continue; }
          if (typeof v !== 'string') continue;
          sanitized[k] = v.slice(0, 1000);
          continue;
        }
        if (k === 'roster_waiver_text') {
          if (v === null || v === '') { sanitized[k] = ''; continue; }
          if (typeof v !== 'string') continue;
          // Trim so whitespace-only collapses to '' — readers rely on ''/absent = default text.
          sanitized[k] = v.trim().slice(0, ROSTER_WAIVER_TEXT_MAX_LENGTH);
          continue;
        }
        sanitized[k] = v;
      }

      // Read current settings, merge, write back (atomic enough for low-contention admin prefs).
      const { data: existing, error: readErr } = await supabase
        .from('tournaments')
        .select('settings')
        .eq('id', id)
        .eq('org_id', ctx.org.id)
        .single();
      if (readErr) throw readErr;

      const merged = { ...(existing?.settings ?? {}), ...sanitized };

      const { error } = await supabase
        .from('tournaments')
        .update({ settings: merged })
        .eq('id', id)
        .eq('org_id', ctx.org.id);
      if (error) throw error;
    }

    // ── set-contact-email ─────────────────────────────────────────────────────
    else if (action === 'set-contact-email' && id) {
      const contactEmail = data?.contactEmail ?? null;
      const { error } = await supabase
        .from('tournaments')
        .update({ contact_email: contactEmail })
        .eq('id', id)
        .eq('org_id', ctx.org.id);

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
        .eq('org_id', ctx.org.id);

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
