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
    const { status, payment_status, admin_notes, age_group_id, age_group_name, poolId } = body;

    // Fetch current record
    const { data: current, error: fetchErr } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Build update payload - only add fields that are provided
    const updates: any = {};
    if (status !== undefined)         updates.status         = status;
    if (payment_status !== undefined) updates.payment_status = payment_status;
    if (admin_notes !== undefined)    updates.admin_notes    = admin_notes;
    if (age_group_id !== undefined)   updates.age_group_id   = age_group_id;
    if (age_group_name !== undefined) updates.age_group_name = age_group_name;
    if (poolId !== undefined)         updates.pool_id        = poolId;

    // If no updates provided, just return success
    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });

    const { data: updatedRow, error: updateErr } = await supabase
      .from('registrations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('Supabase update silent failure check:', updateErr);
      return NextResponse.json({ error: 'Database update failed (check RLS policies): ' + updateErr.message }, { status: 500 });
    }

    const p = {
      teamName:      current.team_name,
      coachName:     current.coach_name,
      ageGroupName:  current.age_group_name,
      tournamentName: current.tournament_name,
      teamId:        id,
    };

    // Send status-change emails
    if (status === 'accepted' && current.status !== 'accepted') {
      await sendEmail(current.email, `Your Team Has Been Accepted — ${current.team_name}`, acceptanceHtml(p));
    }
    if (status === 'rejected' && current.status !== 'rejected') {
      await sendEmail(current.email, `Registration Update — ${current.team_name}`, rejectionHtml(p));
    }
    if (payment_status === 'paid' && current.payment_status !== 'paid') {
      await sendEmail(current.email, `Payment Confirmed — ${current.team_name}`, paymentConfirmationHtml(p));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH registration error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing environment variables");
    }

    const supabaseAdmin = createClient(url, key);
    
    // 1. Try Registrations first
    const { data: reg, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('*, pool_id(name), age_groups(name), tournaments(name)')
      .eq('id', id)
      .single();

    if (!regError && reg) {
      // Safety check: Only show accepted teams to the public
      if (reg.status !== 'accepted') {
        return NextResponse.json({ error: 'Team not yet active' }, { status: 403 });
      }

      return NextResponse.json({
        ...reg,
        age_group_name: reg.age_groups?.name || reg.age_group_name,
        tournament_name: reg.tournaments?.name || reg.tournament_name,
        pool: reg.pool_id?.name || reg.pool
      });
    }

    // 2. Fallback to Teams table if registration not found (for legacy/manual teams)
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('*, pool_id(name), age_groups(name), tournaments(name)')
      .eq('id', id)
      .single();

    if (!teamError && team) {
      return NextResponse.json({
        id: team.id,
        team_name: team.name,
        coach_name: team.coach,
        email: team.email,
        age_group_name: team.age_groups?.name || 'Division',
        tournament_name: team.tournaments?.name || 'Tournament',
        status: 'accepted',
        payment_status: 'paid',
        pool: team.pool_id?.name || team.pool
      });
    }

    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  } catch (e: any) {
    console.error('GET registration error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
