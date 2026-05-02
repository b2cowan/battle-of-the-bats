import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  sendEmail,
  acceptanceHtml, rejectionHtml, paymentConfirmationHtml,
} from '@/lib/email';
import { getAuthContext, unauthorized } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

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
    const { ids, updates } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: "No IDs provided" }), { status: 400 });
    }

    // 1. Fetch current records for email comparison
    const { data: currents } = await supabase
      .from('teams')
      .select('*')
      .in('id', ids);

    if (!currents) throw new Error("Could not find records to update");

    const dbUpdates = { ...updates };
    if (dbUpdates.poolId !== undefined) {
      dbUpdates.pool_id = dbUpdates.poolId || null;
      delete dbUpdates.poolId;
    }
    if (dbUpdates.paymentStatus !== undefined) {
      dbUpdates.payment_status = dbUpdates.paymentStatus;
      delete dbUpdates.paymentStatus;
    }

    const { error: updateErr } = await supabase
      .from('teams')
      .update(dbUpdates)
      .in('id', ids);

    if (updateErr) throw updateErr;

    // 3. Handle Emails
    for (const current of currents) {
      const p = {
        teamName:      current.name,
        coachName:     current.coach,
        ageGroupName:  'Division',
        tournamentName: 'Tournament',
        teamId:        current.id,
      };

      if (updates.status === 'accepted' && current.status !== 'accepted') {
        await sendEmail(current.email, `Your Team Has Been Accepted — ${current.name}`, acceptanceHtml(p));
      }
      if (updates.status === 'rejected' && current.status !== 'rejected') {
        await sendEmail(current.email, `Registration Update — ${current.name}`, rejectionHtml(p));
      }
      if (updates.payment_status === 'paid' && current.payment_status !== 'paid' || 
          updates.paymentStatus === 'paid' && current.payment_status !== 'paid') {
        await sendEmail(current.email, `Payment Confirmed — ${current.name}`, paymentConfirmationHtml(p));
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
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(url!, key!);
    const { ids } = await req.json();

    const { error } = await supabase.from('teams').delete().in('id', ids);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
