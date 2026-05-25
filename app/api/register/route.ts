import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL } from '@/lib/email';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';
import { getTournamentRegistrationFields, saveTournamentRegistrationFieldAnswers } from '@/lib/db';
import { hasPlanFeature } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
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
  ageGroupId?: unknown;
  tournamentId?: unknown;
  customFieldAnswers?: unknown;
};

type TournamentRow = {
  id: string;
  name: string;
  contact_email: string | null;
  org_id: string | null;
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
  plan_id: OrgPlan;
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

function cleanStorageFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'upload';
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File && value.size > 0;
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
        ageGroupId: formData.get('ageGroupId'),
        tournamentId: formData.get('tournamentId'),
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
        .select('id, name, contact_email, org_id, status, public_hidden_pages')
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

    const duplicateTeam = await findDuplicateTournamentTeam({
      tournamentId,
      ageGroupId,
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
        .select('id, contact_email, is_public, plan_id, subscription_status')
        .eq('id', tournament.org_id)
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

    const registrationFields = organization && hasPlanFeature(organization.plan_id, 'custom_registration_fields')
      ? await getTournamentRegistrationFields(tournamentId)
      : [];
    const customAnswerResult = validateCustomAnswers(registrationFields, formData, body);
    if ('error' in customAnswerResult) {
      return NextResponse.json({ error: customAnswerResult.error }, { status: 400 });
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
          ageGroupId,
          registrationId: data.id,
        },
      });
    }

    const ageGroupName = ageGroup.name;
    const tournamentName = tournament.name;
    const footerContactEmail = tournament.contact_email
      || (tournament.org_id ? await getOrgOwnerEmail(tournament.org_id) : undefined)
      || organization.contact_email
      || undefined;
    const adminEmailToUse = tournament.contact_email || divisionContactEmail || footerContactEmail || ADMIN_EMAIL;

    await Promise.allSettled([
      sendEmail(
        email,
        isWaitlist ? `Waitlist Confirmation - ${teamName}` : `Registration Received - ${teamName}`,
        isWaitlist
          ? waitlistConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail })
          : registrationConfirmationHtml({ teamName, coachName, ageGroupName, tournamentName, contactEmail: footerContactEmail, coachEmail: email })
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
