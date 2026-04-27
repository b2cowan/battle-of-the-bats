import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
} from '@/lib/email';

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: "Environment variables missing on server." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const { action, ids, updates } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "No IDs provided" }), { status: 400 });
    }

    // 1. Fetch current records for email comparison
    const { data: currents } = await supabase
      .from('registrations')
      .select('*')
      .in('id', ids);

    if (!currents) throw new Error("Could not find records to update");

    // 2. Perform Update
    // Map internal 'poolId' to 'pool_id' column if present
    const dbUpdates = { ...updates };
    if (dbUpdates.poolId !== undefined) {
      dbUpdates.pool_id = dbUpdates.poolId;
      delete dbUpdates.poolId;
    }

    const { error: updateErr } = await supabase
      .from('registrations')
      .update(dbUpdates)
      .in('id', ids);

    if (updateErr) throw updateErr;

    // 3. Handle Emails (Side effects)
    // For simplicity in bulk, we'll iterate and check for changes
    for (const current of currents) {
      const p = {
        teamName:      current.team_name,
        coachName:     current.coach_name,
        ageGroupName:  current.age_group_name,
        tournamentName: current.tournament_name,
        teamId:        current.id,
      };

      if (updates.status === 'accepted' && current.status !== 'accepted') {
        await sendEmail(current.email, `Your Team Has Been Accepted — ${current.team_name}`, acceptanceHtml(p));
      }
      if (updates.status === 'rejected' && current.status !== 'rejected') {
        await sendEmail(current.email, `Registration Update — ${current.team_name}`, rejectionHtml(p));
      }
      if (updates.payment_status === 'paid' && current.payment_status !== 'paid') {
        await sendEmail(current.email, `Payment Confirmed — ${current.team_name}`, paymentConfirmationHtml(p));
      }
    }

    return new Response(JSON.stringify({ success: true, count: ids.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Admin Teams API Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Unknown server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(url!, key!);
    const { ids } = await req.json();

    const { error } = await supabase.from('registrations').delete().in('id', ids);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
