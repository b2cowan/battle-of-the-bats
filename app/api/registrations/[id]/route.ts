import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
} from '@/lib/email';
import { getAuthContext, unauthorized } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    const { id } = await props.params;
    const body = await req.json();
    const { status, payment_status, admin_notes, age_group_id, poolId } = body;

    // Fetch current record using admin client (bypasses RLS for the lookup)
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Build update payload
    const updates: any = {};
    if (status !== undefined)         updates.status         = status;
    if (payment_status !== undefined) updates.payment_status = payment_status;
    if (admin_notes !== undefined)    updates.admin_notes    = admin_notes;
    if (age_group_id !== undefined)   updates.age_group_id   = age_group_id;
    if (poolId !== undefined)         updates.pool_id        = poolId;

    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    const { error: updateErr } = await supabaseAdmin
      .from('teams')
      .update(updates)
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const p = {
      teamName:       current.name,
      coachName:      current.coach,
      ageGroupName:   'Division',
      tournamentName: 'Tournament',
      teamId:         id,
    };

    if (status === 'accepted' && current.status !== 'accepted') {
      await sendEmail(current.email, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml(p));
    }
    if (status === 'rejected' && current.status !== 'rejected') {
      await sendEmail(current.email, `Registration Update — ${current.name}`, rejectionHtml(p));
    }
    if (payment_status === 'paid' && current.payment_status !== 'paid') {
      await sendEmail(current.email, `Payment Confirmed — ${current.name}`, paymentConfirmationHtml(p));
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
        age_groups!teams_age_group_id_fkey (name),
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
      age_group_name: (team.age_groups as any)?.name || 'Division',
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
