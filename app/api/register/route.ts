import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL } from '@/lib/email';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamName, coachName, email, ageGroupId, ageGroupName, tournamentId, tournamentName, contactEmail, status } = body;

    if (!teamName || !coachName || !email || !ageGroupId || !ageGroupName || !tournamentId || !tournamentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get age group capacity and tournament availability.
    const [{ data: ageGroup, error: agError }, { data: tournament }] = await Promise.all([
      supabase.from('age_groups').select('capacity, is_closed, tournament_id').eq('id', ageGroupId).single(),
      supabase.from('tournaments').select('contact_email, organization_id, status').eq('id', tournamentId).single(),
    ]);

    if (agError) {
      console.error('Error fetching age group capacity:', agError);
    }
    if (!tournament || tournament.status !== 'active') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }
    if (!ageGroup || ageGroup.tournament_id !== tournamentId) {
      return NextResponse.json({ error: 'Invalid division for this tournament.' }, { status: 400 });
    }
    if (ageGroup.is_closed) {
      return NextResponse.json({ error: 'Registration for this division is closed.' }, { status: 403 });
    }

    // 2. Check if slots are configured for this division
    const { count: slotCount } = await supabaseAdmin
      .from('pool_slots')
      .select('*', { count: 'exact', head: true })
      .eq('age_group_id', ageGroupId);

    const slotConfigured = (slotCount ?? 0) > 0;

    let finalStatus = 'pending';

    if (!slotConfigured) {
      // Count-based fallback for divisions without pool slots configured
      const { count: regCount } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('age_group_id', ageGroupId)
        .neq('status', 'rejected');

      if (ageGroup?.capacity && (regCount || 0) >= ageGroup.capacity) {
        finalStatus = 'waitlist';
      }
    }

    // 3. Insert the team record (slot_id assigned after RPC claim)
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
        registered_at: new Date().toISOString(),
        slot_id: null,
        waitlist_position: null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    // 4. Atomically claim a slot (sets pool_slots.team_id and returns the slot id)
    if (slotConfigured && data?.id) {
      const { data: claimedSlotId } = await supabaseAdmin.rpc('claim_next_slot', {
        p_age_group_id: ageGroupId,
        p_team_id: data.id,
      });

      if (claimedSlotId) {
        await supabaseAdmin.from('teams').update({ slot_id: claimedSlotId }).eq('id', data.id);
      } else {
        // No slot available — move to waitlist
        const { data: maxRow } = await supabaseAdmin
          .from('teams')
          .select('waitlist_position')
          .eq('age_group_id', ageGroupId)
          .not('waitlist_position', 'is', null)
          .order('waitlist_position', { ascending: false })
          .limit(1)
          .maybeSingle();
        const pos = ((maxRow as any)?.waitlist_position ?? 0) + 1;
        await supabaseAdmin.from('teams').update({ status: 'waitlist', waitlist_position: pos }).eq('id', data.id);
        finalStatus = 'waitlist';
      }
    } else if (!slotConfigured && finalStatus === 'waitlist' && data?.id) {
      // Count-based waitlist: assign position
      const { data: maxRow } = await supabaseAdmin
        .from('teams')
        .select('waitlist_position')
        .eq('age_group_id', ageGroupId)
        .not('waitlist_position', 'is', null)
        .order('waitlist_position', { ascending: false })
        .limit(1)
        .maybeSingle();
      const pos = ((maxRow as any)?.waitlist_position ?? 0) + 1;
      await supabaseAdmin.from('teams').update({ waitlist_position: pos }).eq('id', data.id);
    }

    // Fire emails (non-blocking — don't fail the request if email fails)
    const isWaitlist = finalStatus === 'waitlist';
    const footerContactEmail = tournament?.contact_email
      || (tournament?.organization_id ? await getOrgOwnerEmail(tournament.organization_id) : undefined)
      || undefined;
    const adminEmailToUse = tournament?.contact_email || contactEmail || footerContactEmail || ADMIN_EMAIL;
    await Promise.allSettled([
      sendEmail(
        email,
        isWaitlist ? `Waitlist Confirmation — ${teamName}` : `Registration Received — ${teamName}`,
        isWaitlist
          ? waitlistConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail })
          : registrationConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail })
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
