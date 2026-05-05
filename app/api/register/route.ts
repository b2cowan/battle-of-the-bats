import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamName, coachName, email, ageGroupId, ageGroupName, tournamentId, tournamentName, contactEmail, status } = body;

    if (!teamName || !coachName || !email || !ageGroupId || !ageGroupName || !tournamentId || !tournamentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get Age Group capacity and tournament contact email
    const [{ data: ageGroup, error: agError }, { data: tournament }] = await Promise.all([
      supabase.from('age_groups').select('capacity').eq('id', ageGroupId).single(),
      supabase.from('tournaments').select('contact_email').eq('id', tournamentId).single(),
    ]);

    if (agError) {
      console.error('Error fetching age group capacity:', agError);
    }

    // 2. Get current registration count (non-rejected)
    const { count: regCount, error: countError } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('age_group_id', ageGroupId)
      .neq('status', 'rejected');

    if (countError) {
      console.error('Error counting registrations:', countError);
    }

    // 3. Determine status
    let finalStatus = status || 'pending';
    if (ageGroup?.capacity && (regCount || 0) >= ageGroup.capacity) {
      finalStatus = 'waitlist';
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('teams')
      .insert({ 
        name: teamName, 
        coach: coachName, 
        email, 
        age_group_id: ageGroupId, 
        tournament_id: tournamentId,
        status: finalStatus,
        payment_status: 'pending',
        registered_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    const adminEmailToUse = contactEmail || ADMIN_EMAIL;

    // Fire emails (non-blocking — don't fail the request if email fails)
    const isWaitlist = finalStatus === 'waitlist';
    const contactEmail = tournament?.contact_email ?? undefined;
    await Promise.allSettled([
      sendEmail(
        email,
        isWaitlist ? `Waitlist Confirmation — ${teamName}` : `Registration Received — ${teamName}`,
        isWaitlist
          ? waitlistConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail })
          : registrationConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail })
      ),
      sendEmail(
        adminEmailToUse,
        `New Registration: ${teamName} (${ageGroupName})${isWaitlist ? ' — Waitlist' : ''}`,
        adminNotificationHtml({ teamName, coachName, email, ageGroupName, tournamentName })
      ),
    ]);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    console.error('Register route error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
