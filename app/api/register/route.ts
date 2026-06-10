import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL, coachEmailEnabled } from '@/lib/email';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';
import { getTournamentRegistrationFields, saveTournamentRegistrationFieldAnswers } from '@/lib/db';
import { hasPlanFeature } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { linkTournamentRegistrationToBasicCoachTeam } from '@/lib/basic-coach-teams';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { notify } from '@/lib/notify';
import { captureError } from '@/lib/observability';
import type { OrgPlan, TournamentRegistrationField } from '@/lib/types';
import {
  duplicateTournamentTeamMessage,
  findDuplicateTournamentTeam,
} from '@/lib/team-registration-duplicates';

const REGISTRATION_FILES_BUCKET = 'tournament-registration-files';
const MAX_REGISTRATION_FILE_BYTES = 10 * 1024 * 1024;

type RegistrationRequestBody = {
  teamName?: unknown;
  coachName?: unknown;
  email?: unknown;
  divisionId?: unknown;
  tournamentId?: unknown;
  customFieldAnswers?: unknown;
  basicCoachTeamId?: unknown;
};

type TournamentRow = {
  id: string;
  name: string;
  contact_email: string | null;
  org_id: string | null;
  status: string | null;
  public_hidden_pages: unknown;
  default_contact_member_id: string | null;
  notify_mode: string | null;
  contact_show_to_coaches: boolean | null;
  settings: Record<string, unknown> | null;
};

type DivisionRow = {
  id: string;
  name: string;
  capacity: number | null;
  is_closed: boolean | null;
  tournament_id: string;
  contact_member_id: string | null;
};

type OrganizationRow = {
  id: string;
  slug: string;
  is_public: boolean | null;
  plan_id: OrgPlan;
  subscription_status: string | null;
};

type WaitlistRow = {
  waitlist_position: number | null;
};

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStorageFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'upload';
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
}

function isRegisterPageHidden(value: unknown) {
  return Array.isArray(value) && value.includes('register');
}

async function getNextWaitlistPosition(divisionId: string) {
  const { data: maxRow, error } = await supabaseAdmin
    .from('teams')
    .select('waitlist_position')
    .eq('division_id', divisionId)
    .not('waitlist_position', 'is', null)
    .order('waitlist_position', { ascending: false })
    .limit(1)
    .maybeSingle<WaitlistRow>();

  if (error) throw error;
  return (maxRow?.waitlist_position ?? 0) + 1;
}

/** Resolve an org member's email from their member row ID. */
async function getMemberEmail(memberId: string | null): Promise<string | null> {
  if (!memberId) return null;
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('id', memberId)
    .single();
  if (!member?.user_id) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
  return data?.user?.email ?? null;
}

async function ensureRegistrationFilesBucket() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some(bucket => bucket.name === REGISTRATION_FILES_BUCKET)) return;
  const { error: createError } = await supabaseAdmin.storage.createBucket(REGISTRATION_FILES_BUCKET, {
    public: false,
    fileSizeLimit: MAX_REGISTRATION_FILE_BYTES,
  });
  if (createError) throw createError;
}

async function parseRegistrationRequest(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return {
      body: {
        teamName: formData.get('teamName'),
        coachName: formData.get('coachName'),
        email: formData.get('email'),
        divisionId: formData.get('divisionId'),
        tournamentId: formData.get('tournamentId'),
        basicCoachTeamId: formData.get('basicCoachTeamId'),
      } satisfies RegistrationRequestBody,
      formData,
    };
  }

  const body = await req.json() as RegistrationRequestBody;
  return { body, formData: null };
}

function readCustomAnswer(field: TournamentRegistrationField, formData: FormData | null, body: RegistrationRequestBody) {
  if (formData) {
    if (field.fieldType === 'file') return formData.get(`customFile_${field.id}`);
    return formData.get(`customField_${field.id}`);
  }

  const rawAnswers = body.customFieldAnswers;
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) return null;
  return (rawAnswers as Record<string, unknown>)[field.id] ?? null;
}

function validateCustomAnswers(fields: TournamentRegistrationField[], formData: FormData | null, body: RegistrationRequestBody) {
  const answers: Array<{
    field: TournamentRegistrationField;
    valueText?: string | null;
    valueJson?: unknown;
    file?: File;
  }> = [];

  for (const field of fields) {
    const raw = readCustomAnswer(field, formData, body);

    if (field.fieldType === 'file') {
      const file = formData ? raw : null;
      if (field.required && !isFileLike(file as FormDataEntryValue | null)) {
        return { error: `Please upload a file for: ${field.label}` };
      }
      if (isFileLike(file as FormDataEntryValue | null)) {
        if ((file as File).size > MAX_REGISTRATION_FILE_BYTES) {
          return { error: `${field.label} must be 10MB or smaller.` };
        }
        answers.push({ field, file: file as File });
      }
      continue;
    }

    const value = typeof raw === 'string' ? raw.trim() : typeof raw === 'boolean' ? String(raw) : '';
    if (field.required) {
      if (field.fieldType === 'checkbox' && value !== 'true') {
        return { error: `Please confirm: ${field.label}` };
      }
      if (field.fieldType !== 'checkbox' && !value) {
        return { error: `Please complete: ${field.label}` };
      }
    }
    if (!value && field.fieldType !== 'checkbox') continue;
    if (field.fieldType === 'dropdown' && value && !field.options.includes(value)) {
      return { error: `Choose a valid option for: ${field.label}` };
    }
    answers.push({
      field,
      valueText: field.fieldType === 'checkbox' ? null : value,
      valueJson: field.fieldType === 'checkbox' ? { checked: value === 'true' } : null,
    });
  }

  return { answers };
}

export async function POST(req: NextRequest) {
  try {
    const { body, formData } = await parseRegistrationRequest(req);
    const teamName = cleanString(body.teamName);
    const coachName = cleanString(body.coachName);
    const email = cleanString(body.email).toLowerCase();
    const divisionId = cleanString(body.divisionId);
    const tournamentId = cleanString(body.tournamentId);
    const basicCoachTeamId = cleanString(body.basicCoachTeamId) || null;

    if (!teamName || !coachName || !email || !divisionId || !tournamentId) {
      return NextResponse.json({ error: 'Missing required registration details.' }, { status: 400 });
    }

    // FieldLogicHQ staff emails must never become a public team contact.
    if (await isPlatformAdminEmail(email)) {
      return NextResponse.json({ error: 'This email address cannot be used to register a team.' }, { status: 403 });
    }

    let signedInCoach: { id: string; email: string } | null = null;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && user.email) {
      signedInCoach = { id: user.id, email: user.email.toLowerCase() };
    }

    if (basicCoachTeamId && (!signedInCoach || signedInCoach.email !== email)) {
      return NextResponse.json({ error: 'Sign in with the coach email before selecting an existing Coaches Portal team.' }, { status: 401 });
    }

    const [
      { data: division, error: divisionError },
      { data: tournament, error: tournamentError },
    ] = await Promise.all([
      supabaseAdmin
        .from('divisions')
        .select('id, name, capacity, is_closed, tournament_id, contact_member_id')
        .eq('id', divisionId)
        .maybeSingle<DivisionRow>(),
      supabaseAdmin
        .from('tournaments')
        .select('id, name, contact_email, org_id, status, public_hidden_pages, default_contact_member_id, notify_mode, contact_show_to_coaches, settings')
        .eq('id', tournamentId)
        .maybeSingle<TournamentRow>(),
    ]);

    if (divisionError) {
      console.error('Registration division lookup error:', divisionError);
      return NextResponse.json({ error: 'Unable to confirm division availability. Please try again.' }, { status: 500 });
    }
    if (tournamentError) {
      console.error('Registration tournament lookup error:', tournamentError);
      return NextResponse.json({ error: 'Unable to confirm tournament availability. Please try again.' }, { status: 500 });
    }
    if (!tournament || tournament.status !== 'active') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }
    if (!division || division.tournament_id !== tournamentId) {
      return NextResponse.json({ error: 'Invalid division for this tournament.' }, { status: 400 });
    }
    if (division.is_closed) {
      return NextResponse.json({ error: 'Registration for this division is closed.' }, { status: 403 });
    }
    if (isRegisterPageHidden(tournament.public_hidden_pages)) {
      return NextResponse.json({ error: 'Registration is not available for this tournament.' }, { status: 403 });
    }

    const duplicateTeam = await findDuplicateTournamentTeam({
      tournamentId,
      divisionId,
      teamName,
    });
    if (duplicateTeam) {
      return NextResponse.json({
        error: `${duplicateTournamentTeamMessage(teamName)} Contact the tournament organizer if you need to update it.`,
      }, { status: 409 });
    }

    let organization: OrganizationRow | null = null;
    if (tournament.org_id) {
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, slug, is_public, plan_id, subscription_status')
        .eq('id', tournament.org_id)
        .maybeSingle<OrganizationRow>();

      if (orgError) {
        console.error('Registration organization lookup error:', orgError);
        return NextResponse.json({ error: 'Unable to confirm tournament availability. Please try again.' }, { status: 500 });
      }

      organization = orgData;
    }

    // Registration does NOT depend on the org's public-profile (is_public) flag — that gates only
    // the org home/league pages (League/Club). Tournament Plus orgs have no org profile
    // (is_public=false) yet their tournaments + registration must work. Mirror the read-path gate
    // in lib/public-tournament-data.ts getPublicContext: org must exist and not be canceled.
    if (!organization || organization.subscription_status === 'canceled') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }

    const registrationFields = organization && hasPlanFeature(organization.plan_id, 'custom_registration_fields')
      ? await getTournamentRegistrationFields(tournamentId)
      : [];
    const customAnswerResult = validateCustomAnswers(registrationFields, formData, body);
    if ('error' in customAnswerResult) {
      return NextResponse.json({ error: customAnswerResult.error }, { status: 400 });
    }

    // Resolve member-based contact emails in parallel.
    // Division contact only matters when notify_mode is 'assigned'.
    const [tournamentDefaultMemberEmail, divisionMemberEmail] = await Promise.all([
      getMemberEmail(tournament.default_contact_member_id ?? null),
      getMemberEmail(division.contact_member_id ?? null),
    ]);

    const { count: slotCount, error: slotError } = await supabaseAdmin
      .from('pool_slots')
      .select('id', { count: 'exact', head: true })
      .eq('division_id', divisionId);

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
        .eq('division_id', divisionId)
        .neq('status', 'rejected');

      if (countError) {
        console.error('Registration count lookup error:', countError);
        return NextResponse.json({ error: 'Unable to confirm division availability. Please try again.' }, { status: 500 });
      }

      if (division.capacity && (regCount ?? 0) >= division.capacity) {
        finalStatus = 'waitlist';
      }
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({
        name: teamName,
        coach: coachName,
        email,
        division_id: divisionId,
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

    if (data?.id && signedInCoach && signedInCoach.email === email) {
      try {
        await linkTournamentRegistrationToBasicCoachTeam({
          userId: signedInCoach.id,
          userEmail: signedInCoach.email,
          registrationId: data.id,
          basicCoachTeamId,
          linkSource: 'registration_flow',
        });
      } catch (linkError) {
        console.error('Registration Basic coach team link error:', linkError);
      }
    }

    if (slotConfigured && data?.id) {
      const { data: claimedSlotId, error: claimError } = await supabaseAdmin.rpc('claim_next_slot', {
        p_division_id: divisionId,
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
        const pos = await getNextWaitlistPosition(divisionId);
        const { error: waitlistError } = await supabaseAdmin
          .from('teams')
          .update({ status: 'waitlist', waitlist_position: pos })
          .eq('id', data.id);
        if (waitlistError) console.error('Registration waitlist update error:', waitlistError);
        finalStatus = 'waitlist';
      }
    } else if (!slotConfigured && finalStatus === 'waitlist' && data?.id) {
      const pos = await getNextWaitlistPosition(divisionId);
      const { error: waitlistError } = await supabaseAdmin
        .from('teams')
        .update({ waitlist_position: pos })
        .eq('id', data.id);
      if (waitlistError) console.error('Registration waitlist position update error:', waitlistError);
    }

    const customAnswersToSave = customAnswerResult.answers ?? [];
    if (customAnswersToSave.length > 0 && data?.id) {
      const answerRows: Array<{
        fieldId: string;
        valueText?: string | null;
        valueJson?: unknown;
        fileUrl?: string | null;
      }> = [];

      const fileAnswers = customAnswersToSave.filter(answer => answer.file);
      if (fileAnswers.length > 0) await ensureRegistrationFilesBucket();

      for (const answer of customAnswersToSave) {
        if (answer.file) {
          const ext = answer.file.name.includes('.') ? answer.file.name.split('.').pop() : 'bin';
          const path = `${organization.id}/${tournamentId}/${data.id}/${answer.field.id}-${crypto.randomUUID()}-${cleanStorageFileName(answer.file.name || `upload.${ext}`)}`;
          const bytes = new Uint8Array(await answer.file.arrayBuffer());
          const { error: uploadError } = await supabaseAdmin.storage
            .from(REGISTRATION_FILES_BUCKET)
            .upload(path, bytes, { contentType: answer.file.type || 'application/octet-stream' });
          if (uploadError) {
            console.error('Registration custom file upload error:', uploadError);
            return NextResponse.json({ error: 'Registration file upload failed. Please try again.' }, { status: 500 });
          }
          answerRows.push({ fieldId: answer.field.id, fileUrl: path });
        } else {
          answerRows.push({
            fieldId: answer.field.id,
            valueText: answer.valueText ?? null,
            valueJson: answer.valueJson ?? null,
          });
        }
      }

      await saveTournamentRegistrationFieldAnswers(data.id, answerRows);
    }

    const isWaitlist = finalStatus === 'waitlist';
    if (isWaitlist && tournament.org_id) {
      await writePlatformEvent({
        eventType: 'tournament_registration_operation_used',
        source: 'app',
        orgId: tournament.org_id,
        planId: organization.plan_id,
        metadata: {
          feature: 'waitlist_collection',
          action: 'waitlist_join',
          tournamentId,
          divisionId,
          registrationId: data.id,
        },
      });
    }

    const divisionName = division.name;
    const tournamentName = tournament.name;

    // Resolved contact — prefer new member system, fall back to legacy chain.
    // (organizations has no contact_email column — that field lives on org_public_site_content;
    // the tournament contact + org-owner email cover the fallback.)
    const resolvedContactEmail = tournamentDefaultMemberEmail
      || tournament.contact_email
      || (tournament.org_id ? await getOrgOwnerEmail(tournament.org_id) : undefined)
      || undefined;

    // Footer contact shown to coaches respects the per-tournament "Communication with coaches"
    // toggle (Settings → Notifications & Contact). Off → omit the "Questions? Contact …" line.
    // This only controls DISPLAY in coach-facing emails; admin alert routing below is unaffected.
    const footerContactEmail = tournament.contact_show_to_coaches === false ? undefined : resolvedContactEmail;

    // Admin notification routing respects notify_mode (independent of the display toggle):
    //   'assigned' → send to division-specific contact if set; otherwise fall back to tournament default
    //   'all'      → always send to tournament default contact (division assignment ignored)
    const notifyMode = (tournament.notify_mode ?? 'all') as 'all' | 'assigned';
    const adminEmailToUse = (notifyMode === 'assigned' && divisionMemberEmail)
      ? divisionMemberEmail
      : (tournamentDefaultMemberEmail || tournament.contact_email || resolvedContactEmail || ADMIN_EMAIL);

    // The admin notification always fires; the coach confirmation respects the
    // per-tournament "automatic coach emails" switch (Settings → Notifications & Contact).
    const emailSends = [
      sendEmail(
        adminEmailToUse,
        `New Registration: ${teamName} (${divisionName})${isWaitlist ? ' - Waitlist' : ''}`,
        adminNotificationHtml({ teamName, coachName, email, divisionName, tournamentName })
      ),
    ];
    if (coachEmailEnabled(tournament.settings, 'confirmation')) {
      emailSends.push(
        sendEmail(
          email,
          isWaitlist ? `Waitlist Confirmation - ${teamName}` : `Registration Received - ${teamName}`,
          isWaitlist
            ? waitlistConfirmationHtml({ teamName, coachName, divisionName, tournamentName, contactEmail: footerContactEmail, registrationId: data?.id, coachEmail: email })
            : registrationConfirmationHtml({ teamName, coachName, divisionName, tournamentName, contactEmail: footerContactEmail, coachEmail: email, registrationId: data?.id })
        )
      );
    }
    await Promise.allSettled(emailSends);

    // Notify org admins via bell / push / email per their preferences (fire-and-forget)
    if (tournament.org_id && organization?.slug) {
      notify({
        orgId: tournament.org_id,
        tournamentId,
        eventType: 'registration_new',
        title: `New registration: ${teamName}`,
        body: `${divisionName}${isWaitlist ? ' · Waitlist' : ''}`,
        link: `/${organization.slug}/admin/tournaments/registrations?tournamentId=${tournamentId}`,
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true, id: data.id, status: finalStatus });
  } catch (e) {
    console.error('Register route error:', e);
    void captureError(e, { route: '/api/register', method: 'POST', statusCode: 500 });
    return NextResponse.json({ error: 'Registration could not be submitted. Please try again.' }, { status: 500 });
  }
}
