import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail, registrationConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamName, coachName, email, ageGroupId, ageGroupName, tournamentName, contactEmail, status } = body;

    if (!teamName || !coachName || !email || !ageGroupId || !ageGroupName || !tournamentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('registrations')
      .insert({ 
        team_name: teamName, 
        coach_name: coachName, 
        email, 
        age_group_id: ageGroupId, 
        age_group_name: ageGroupName, 
        tournament_name: tournamentName,
        status: status || 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    const adminEmailToUse = contactEmail || ADMIN_EMAIL;

    // Fire emails (non-blocking — don't fail the request if email fails)
    await Promise.allSettled([
      sendEmail(email, `Registration Received — ${teamName}`,
        registrationConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName })
      ),
      sendEmail(adminEmailToUse, `New Registration: ${teamName} (${ageGroupName})`,
        adminNotificationHtml({ teamName, coachName, email, ageGroupName, tournamentName })
      ),
    ]);

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    console.error('Register route error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
