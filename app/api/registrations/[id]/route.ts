import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import {
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
  coachEmailEnabled, resolveCoachRecipient, acceptanceFeeLine, coachPortalUrl,
} from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { cancelScheduledEmailForRecipient, COACH_GAME_DAY_REMINDER_EMAIL_KEY } from '@/lib/email-sender';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';
import { resolveTournamentContactEmail } from '@/lib/db';
import { captureError, withObservability } from '@/lib/observability';

export const PATCH = withObservability(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    const { id } = await props.params;
    const body = await req.json();
    const { status, payment_status, admin_notes, division_id, poolId } = body;

    // Fetch current record with joined names and tournament contact email
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('teams')
      .select(`
        *,
        divisions (name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date),
        tournaments!teams_tournament_id_fkey (name, contact_email, org_id, settings, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date)
      `)
      .eq('id', id)
      .single();

    if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Build update payload
    const updates: any = {};
    if (status !== undefined)         updates.status         = status;
    if (payment_status !== undefined) updates.payment_status = payment_status;
    if (admin_notes !== undefined)    updates.admin_notes    = admin_notes;
    if (division_id !== undefined)   updates.division_id   = division_id;
    if (poolId !== undefined)         updates.pool_id        = poolId;

    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    const { error: updateErr } = await supabaseAdmin
      .from('teams')
      .update(updates)
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const tournamentData = current.tournaments as any;
    const orgOwnerId = tournamentData?.org_id;
    // Coach-facing status emails (accept / decline / payment) respect the per-tournament
    // "Communication with coaches" toggle and resolve the selected contact member, mirroring
    // the registration-confirmation path. Off → no contact shown (org-owner fallback included).
    const orgOwnerEmail = orgOwnerId ? (await getOrgOwnerEmail(orgOwnerId)) ?? null : null;
    const contactEmail = (await resolveTournamentContactEmail(current.tournament_id, orgOwnerEmail, 'coach')) ?? undefined;

    const paymentInstructions = typeof tournamentData?.settings?.payment_instructions === 'string'
      ? tournamentData.settings.payment_instructions
      : undefined;

    const p = {
      teamName:       current.name,
      coachName:      current.coach,
      divisionName:   (current.divisions as any)?.name ?? 'Division',
      tournamentName: tournamentData?.name ?? 'Tournament',
      contactEmail,
      teamId:         id,
      coachEmail:     current.email,
    };

    // Route coach-facing status emails to the assigned coach (teams.coach_email) when set,
    // falling back to teams.email. teams.email stays the claim key (the footer keeps using it).
    const recipient = resolveCoachRecipient(current);
    const coachSettings = tournamentData?.settings;
    // J5-063: state the amount owed (deposit-first) in the acceptance email — skipped if already paid,
    // including when THIS same request marks the team paid (use the effective post-update status).
    const divisionData = current.divisions as any;
    const effectivePaymentStatus = payment_status ?? current.payment_status;
    const feeLine = effectivePaymentStatus === 'paid' ? undefined : acceptanceFeeLine({
      feeMode: tournamentData?.fee_schedule_mode ?? null,
      tournament: tournamentData ? {
        depositAmount: tournamentData.deposit_amount, depositDueDate: tournamentData.deposit_due_date,
        totalFeeAmount: tournamentData.total_fee_amount, totalFeeDueDate: tournamentData.total_fee_due_date,
      } : null,
      division: divisionData ? {
        depositAmount: divisionData.deposit_amount, depositDueDate: divisionData.deposit_due_date,
        totalFeeAmount: divisionData.total_fee_amount, totalFeeDueDate: divisionData.total_fee_due_date,
      } : null,
    });
    if (status === 'accepted' && current.status !== 'accepted' && coachEmailEnabled(coachSettings, 'acceptance')) {
      await sendTransactionalEmail({
        key: 'tournament_registration_accepted',
        to: recipient,
        vars: { coachName: p.coachName, teamName: p.teamName, ageGroupName: p.divisionName, tournamentName: p.tournamentName, profileUrl: coachPortalUrl({ registrationId: p.teamId, email: p.coachEmail }) },
        defaultSubject: `Your Team Has Been Accepted — ${current.name}`,
        defaultHtml: acceptanceHtml({ ...p, paymentInstructions, feeLine }),
      });
    }
    if (status === 'rejected' && current.status !== 'rejected' && coachEmailEnabled(coachSettings, 'rejection')) {
      await sendTransactionalEmail({
        key: 'tournament_registration_rejected',
        to: recipient,
        vars: { coachName: p.coachName, teamName: p.teamName, ageGroupName: p.divisionName, tournamentName: p.tournamentName },
        defaultSubject: `Registration Update — ${current.name}`,
        defaultHtml: rejectionHtml(p),
      });
    }
    // 5m: a newly-rejected team is no longer playing — cancel any scheduled game-day reminder
    // (independent of the rejection-email toggle). Best-effort; never throws.
    if (status === 'rejected' && current.status !== 'rejected' && orgOwnerId && recipient) {
      await cancelScheduledEmailForRecipient(orgOwnerId, COACH_GAME_DAY_REMINDER_EMAIL_KEY, recipient);
    }
    if (payment_status === 'paid' && current.payment_status !== 'paid' && coachEmailEnabled(coachSettings, 'payment')) {
      await sendTransactionalEmail({
        key: 'tournament_payment_recorded',
        to: recipient,
        vars: { coachName: p.coachName, teamName: p.teamName, ageGroupName: p.divisionName, tournamentName: p.tournamentName },
        defaultSubject: `Payment Recorded — ${current.name}`,
        defaultHtml: paymentConfirmationHtml(p),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH team error:', e);
    void captureError(e, { route: '/api/registrations/[id]', method: 'PATCH', statusCode: 500 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { route: '/api/registrations/[id]' });

// Public GET — used by the team lookup page; only returns accepted teams
export const GET = withObservability(async (req: NextRequest, props: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await props.params;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error("Missing environment variables");

    const client = createClient(url, key);
    const { data: team, error } = await client
      .from('teams')
      .select(`
        *,
        divisions (name),
        tournaments!teams_tournament_id_fkey (name),
        pools:pool_id (name)
      `)
      .eq('id', id)
      .single();

    if (error || !team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    if (team.status !== 'accepted') {
      return NextResponse.json({ error: 'Team not yet active' }, { status: 403 });
    }

    return NextResponse.json({
      id: team.id,
      team_name: team.name,
      coach_name: team.coach,
      email: team.email,
      division_name: (team.divisions as any)?.name || 'Division',
      tournament_name: (team.tournaments as any)?.name || 'Tournament',
      status: team.status,
      payment_status: team.payment_status,
      pool: (team.pools as any)?.name || '',
      players: team.players || [],
    });
  } catch (e: any) {
    console.error('GET team error:', e);
    void captureError(e, { route: '/api/registrations/[id]', method: 'GET', statusCode: 500 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { route: '/api/registrations/[id]' });
