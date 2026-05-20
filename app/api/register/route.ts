import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL } from '@/lib/email';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';

type RegistrationRequestBody = {
  teamName?: unknown;
  coachName?: unknown;
  email?: unknown;
  ageGroupId?: unknown;
  tournamentId?: unknown;
};

type TournamentRow = {
  id: string;
  name: string;
  contact_email: string | null;
  organization_id: string | null;
  status: string | null;
  public_hidden_pages: unknown;
};

type AgeGroupRow = {
  id: string;
  name: string;
  capacity: number | null;
  is_closed: boolean | null;
  tournament_id: string;
  contact_id: string | null;
};

type OrganizationRow = {
  id: string;
  contact_email: string | null;
  is_public: boolean | null;
  subscription_status: string | null;
};

type ContactRow = {
  email: string | null;
};

type WaitlistRow = {
  waitlist_position: number | null;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRegisterPageHidden(value: unknown) {
  return Array.isArray(value) && value.includes('register');
}

async function getNextWaitlistPosition(ageGroupId: string) {
  const { data: maxRow, error } = await supabaseAdmin
    .from('teams')
    .select('waitlist_position')
    .eq('age_group_id', ageGroupId)
    .not('waitlist_position', 'is', null)
    .order('waitlist_position', { ascending: false })
    .limit(1)
    .maybeSingle<WaitlistRow>();

  if (error) throw error;
  return (maxRow?.waitlist_position ?? 0) + 1;
}

async function getDivisionContactEmail(contactId: string | null) {
  if (!contactId) return null;

  const { data: contact, error } = await supabaseAdmin
    .from('contacts')
    .select('email')
    .eq('id', contactId)
    .maybeSingle<ContactRow>();

  if (error) {
    console.error('Registration contact lookup error:', error);
    return null;
  }

  return contact?.email ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RegistrationRequestBody;
    const teamName = cleanString(body.teamName);
    const coachName = cleanString(body.coachName);
    const email = cleanString(body.email).toLowerCase();
    const ageGroupId = cleanString(body.ageGroupId);
    const tournamentId = cleanString(body.tournamentId);

    if (!teamName || !coachName || !email || !ageGroupId || !tournamentId) {
      return NextResponse.json({ error: 'Missing required registration details.' }, { status: 400 });
    }

    const [
      { data: ageGroup, error: ageGroupError },
      { data: tournament, error: tournamentError },
    ] = await Promise.all([
      supabaseAdmin
        .from('age_groups')
        .select('id, name, capacity, is_closed, tournament_id, contact_id')
        .eq('id', ageGroupId)
        .maybeSingle<AgeGroupRow>(),
      supabaseAdmin
        .from('tournaments')
        .select('id, name, contact_email, organization_id, status, public_hidden_pages')
        .eq('id', tournamentId)
        .maybeSingle<TournamentRow>(),
    ]);

    if (ageGroupError) {
      console.error('Registration division lookup error:', ageGroupError);
      return NextResponse.json({ error: 'Unable to confirm division availability. Please try again.' }, { status: 500 });
    }
    if (tournamentError) {
      console.error('Registration tournament lookup error:', tournamentError);
      return NextResponse.json({ error: 'Unable to confirm tournament availability. Please try again.' }, { status: 500 });
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
    if (isRegisterPageHidden(tournament.public_hidden_pages)) {
      return NextResponse.json({ error: 'Registration is not available for this tournament.' }, { status: 403 });
    }

    let organization: OrganizationRow | null = null;
    if (tournament.organization_id) {
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, contact_email, is_public, subscription_status')
        .eq('id', tournament.organization_id)
        .maybeSingle<OrganizationRow>();

      if (orgError) {
        console.error('Registration organization lookup error:', orgError);
        return NextResponse.json({ error: 'Unable to confirm tournament availability. Please try again.' }, { status: 500 });
      }

      organization = orgData;
    }

    if (!organization?.is_public || organization.subscription_status === 'canceled') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }

    const divisionContactEmail = await getDivisionContactEmail(ageGroup.contact_id);

    const { count: slotCount, error: slotError } = await supabaseAdmin
      .from('pool_slots')
      .select('id', { count: 'exact', head: true })
      .eq('age_group_id', ageGroupId);

    if (slotError) {
      console.error('Registration slot lookup error:', slotError);
      return NextResponse.json({ error: 'Unable to confirm division availability. Please try again.' }, { status: 500 });
    }

    const slotConfigured = (slotCount ?? 0) > 0;
    let finalStatus: 'pending' | 'waitlist' = 'pending';

    if (!slotConfigured) {
      const { count: regCount, error: countError } = await supabaseAdmin
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('age_group_id', ageGroupId)
        .neq('status', 'rejected');

      if (countError) {
        console.error('Registration count lookup error:', countError);
        return NextResponse.json({ error: 'Unable to confirm division availability. Please try again.' }, { status: 500 });
      }

      if (ageGroup.capacity && (regCount ?? 0) >= ageGroup.capacity) {
        finalStatus = 'waitlist';
      }
    }

    const { data, error } = await supabaseAdmin
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
      .select('id')
      .single<{ id: string }>();

    if (error) {
      console.error('Registration insert error:', error);
      return NextResponse.json({ error: 'Registration could not be submitted. Please try again.' }, { status: 500 });
    }

    if (slotConfigured && data?.id) {
      const { data: claimedSlotId, error: claimError } = await supabaseAdmin.rpc('claim_next_slot', {
        p_age_group_id: ageGroupId,
        p_team_id: data.id,
      });

      if (claimError) {
        console.error('Registration slot claim error:', claimError);
      }

      if (typeof claimedSlotId === 'string') {
        const { error: updateError } = await supabaseAdmin
          .from('teams')
          .update({ slot_id: claimedSlotId })
          .eq('id', data.id);
        if (updateError) console.error('Registration slot update error:', updateError);
      } else {
        const pos = await getNextWaitlistPosition(ageGroupId);
        const { error: waitlistError } = await supabaseAdmin
          .from('teams')
          .update({ status: 'waitlist', waitlist_position: pos })
          .eq('id', data.id);
        if (waitlistError) console.error('Registration waitlist update error:', waitlistError);
        finalStatus = 'waitlist';
      }
    } else if (!slotConfigured && finalStatus === 'waitlist' && data?.id) {
      const pos = await getNextWaitlistPosition(ageGroupId);
      const { error: waitlistError } = await supabaseAdmin
        .from('teams')
        .update({ waitlist_position: pos })
        .eq('id', data.id);
      if (waitlistError) console.error('Registration waitlist position update error:', waitlistError);
    }

    const isWaitlist = finalStatus === 'waitlist';
    const ageGroupName = ageGroup.name;
    const tournamentName = tournament.name;
    const footerContactEmail = tournament.contact_email
      || (tournament.organization_id ? await getOrgOwnerEmail(tournament.organization_id) : undefined)
      || organization.contact_email
      || undefined;
    const adminEmailToUse = tournament.contact_email || divisionContactEmail || footerContactEmail || ADMIN_EMAIL;

    await Promise.allSettled([
      sendEmail(
        email,
        isWaitlist ? `Waitlist Confirmation - ${teamName}` : `Registration Received - ${teamName}`,
        isWaitlist
          ? waitlistConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail })
          : registrationConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail })
      ),
      sendEmail(
        adminEmailToUse,
        `New Registration: ${teamName} (${ageGroupName})${isWaitlist ? ' - Waitlist' : ''}`,
        adminNotificationHtml({ teamName, coachName, email, ageGroupName, tournamentName })
      ),
    ]);

    return NextResponse.json({ ok: true, id: data.id, status: finalStatus });
  } catch (e) {
    console.error('Register route error:', e);
    return NextResponse.json({ error: 'Registration could not be submitted. Please try again.' }, { status: 500 });
  }
}
