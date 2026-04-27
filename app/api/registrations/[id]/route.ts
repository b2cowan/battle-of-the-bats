import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
  ADMIN_EMAIL,
} from '@/lib/email';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { status, payment_status, admin_notes, age_group_id, poolId } = body;

    // Fetch current record
    const { data: current, error: fetchErr } = await supabase
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

    const { error: updateErr } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send emails if status changed
    const p = {
      teamName:      current.name,
      coachName:     current.coach,
      ageGroupName:  'Division', // Simplified for now, or fetch from DB
      tournamentName: 'Tournament',
      teamId:        id,
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

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) throw new Error("Missing environment variables");

    const supabaseAdmin = createClient(url, key);
    const { data: team, error } = await supabaseAdmin
      .from('teams')
      .select('*, pool_id(name), age_groups(name), tournaments(name)')
      .eq('id', id)
      .single();

    if (error || !team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    // Safety check: Only show accepted teams to the public
    if (team.status !== 'accepted') {
      return NextResponse.json({ error: 'Team not yet active' }, { status: 403 });
    }

    return NextResponse.json({
      id: team.id,
      team_name: team.name,
      coach_name: team.coach,
      email: team.email,
      age_group_name: team.age_groups?.name || 'Division',
      tournament_name: team.tournaments?.name || 'Tournament',
      status: team.status,
      payment_status: team.payment_status,
      pool: team.pool_id?.name || team.pool,
      players: team.players || []
    });
  } catch (e: any) {
    console.error('GET team error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
