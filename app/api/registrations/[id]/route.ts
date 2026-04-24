import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
  ADMIN_EMAIL,
} from '@/lib/email';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { status, payment_status } = body;

    // Fetch current record
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Build update payload
    const updates: Record<string, string> = {};
    if (status)         updates.status         = status;
    if (payment_status) updates.payment_status = payment_status;

    const { error: updateErr } = await supabaseAdmin
      .from('registrations')
      .update(updates)
      .eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

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
  const { id } = await props.params;
  const { data, error } = await supabaseAdmin
    .from('registrations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}
