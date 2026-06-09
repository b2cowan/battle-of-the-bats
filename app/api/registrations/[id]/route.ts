import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
  coachEmailEnabled,
} from '@/lib/email';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
        divisions (name),
        tournaments!teams_tournament_id_fkey (name, contact_email, org_id, settings)
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
    const contactEmail = tournamentData?.contact_email
      || (orgOwnerId ? await getOrgOwnerEmail(orgOwnerId) : undefined)
      || undefined;

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
    };

    const coachSettings = tournamentData?.settings;
    if (status === 'accepted' && current.status !== 'accepted' && coachEmailEnabled(coachSettings, 'acceptance')) {
      await sendEmail(current.email, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml({ ...p, paymentInstructions }));
    }
    if (status === 'rejected' && current.status !== 'rejected' && coachEmailEnabled(coachSettings, 'rejection')) {
      await sendEmail(current.email, `Registration Update — ${current.name}`, rejectionHtml(p));
    }
    if (payment_status === 'paid' && current.payment_status !== 'paid' && coachEmailEnabled(coachSettings, 'payment')) {
      await sendEmail(current.email, `Payment Recorded — ${current.name}`, paymentConfirmationHtml(p));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH team error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Public GET — used by the team lookup page; only returns accepted teams
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
