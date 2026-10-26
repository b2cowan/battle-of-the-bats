import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, registrationConfirmationHtml, waitlistConfirmationHtml, adminNotificationHtml, ADMIN_EMAIL, coachEmailEnabled } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { getOrgOwnerEmail } from '@/lib/supabase-admin';
import { getTournamentRegistrationFields, saveTournamentRegistrationFieldAnswers } from '@/lib/db';
import { hasPlanFeature } from '@/lib/plan-features';
import { effectiveOrgFactsOf } from '@/lib/entitlement-grants';
import { DOOR_COLUMNS, type DoorRow } from '@/lib/free-time';
import { writePlatformEvent } from '@/lib/platform-events';
import { linkTournamentRegistrationToBasicCoachTeam } from '@/lib/basic-coach-teams';
import { getEntryHeadCoachIdentity, getRegistrableTeamsForUser } from '@/lib/registrable-teams-server';
import {
  alreadyRegisteredRefusal, entryCoachRecord, findRegistrableTeam, pickEntryHeadCoach, TEAM_ALREADY_REGISTERED,
} from '@/lib/registrable-teams';
import { nameFromAccountMetadata } from '@/lib/db';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { notify } from '@/lib/notify';
import { notifyTeamCoaches } from '@/lib/team-coach-notices';
import { registrationNoticeWords } from '@/lib/team-coach-notice-plan';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { assertNotDemoOrg } from '@/lib/demo-guard';
import { tournamentToday } from '@/lib/timezone';
import type { OrgPlan, TournamentRegistrationField } from '@/lib/types';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';
import {
  duplicateTournamentTeamMessage,
  findDuplicateTournamentTeam,
  findTeamEntriesInTournament,
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
  /** C2: the head coach picked on Step 2 when the team has two or more (a staff membership id). */
  headCoachId?: unknown;
};

type TournamentRow = {
  id: string;
  name: string;
  contact_email: string | null;
  org_id: string | null;
  status: string | null;
  start_date: string | null;
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

type OrganizationRow = DoorRow & {
  slug: string;
  is_public: boolean | null;
};

/** The hosting club as the door reads it right now (free time included). */
type HostOrg = { id: string; slug: string; planId: OrgPlan; ownPlanId: OrgPlan; subscriptionStatus: string };

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
        headCoachId: formData.get('headCoachId'),
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

export const POST = withObservability(async (req: NextRequest) => {
  try {
    const { body, formData } = await parseRegistrationRequest(req);
    const teamName = cleanString(body.teamName);
    const coachName = cleanString(body.coachName);
    const email = cleanString(body.email).toLowerCase();
    const divisionId = cleanString(body.divisionId);
    const tournamentId = cleanString(body.tournamentId);
    const basicCoachTeamId = cleanString(body.basicCoachTeamId) || null;
    const headCoachId = cleanString(body.headCoachId) || null;

    if (!teamName || !email || !divisionId || !tournamentId) {
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

    // WHO REGISTERED (Stage 1b, C3): a signed-in person is their account — the form shows them no name
    // boxes, so their name is the account's. A typed name is used only when the account has none (a
    // new coach whose sign-up landed in an account that already existed) or nobody is signed in as this
    // email, and only that last path still REQUIRES one. Absence is NULL, never '' and never the email:
    // the public Teams page prints the coach.
    const registrantIsAccount = !!signedInCoach && signedInCoach.email === email;
    const registrantName = (registrantIsAccount ? nameFromAccountMetadata(user?.user_metadata) : null) || coachName || null;
    if (!registrantIsAccount && !coachName) {
      return NextResponse.json({ error: 'Missing required registration details.' }, { status: 400 });
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
        .select('id, name, contact_email, org_id, status, start_date, public_hidden_pages, default_contact_member_id, notify_mode, contact_show_to_coaches, settings')
        .eq('id', tournamentId)
        .maybeSingle<TournamentRow>(),
    ]);

    if (divisionError) {
      console.error('Registration division lookup error:', divisionError);
      return captureAndJson(divisionError, { error: 'Unable to confirm division availability. Please try again.' }, 500);
    }
    if (tournamentError) {
      console.error('Registration tournament lookup error:', tournamentError);
      return captureAndJson(tournamentError, { error: 'Unable to confirm tournament availability. Please try again.' }, 500);
    }
    if (!tournament || tournament.status !== 'active') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }
    // Lifecycle gate (mirrors lib/registration-state.ts): once the event is underway
    // (today ≥ start date) registration is closed even while the row is still "active",
    // so a stale mid-tournament link can't mint a junk registration + coach account (J6-035).
    const todayISO = tournamentToday();
    if (tournament.start_date && todayISO >= tournament.start_date) {
      return NextResponse.json({ error: 'Registration is closed — the tournament is underway.' }, { status: 403 });
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

    // D1 (owner, 2026-10-13): an entry may be filed under a team only when the form would have offered
    // that team UNLOCKED to this person — their own free team, or a Premium team they may register.
    // Asked HERE, before the entry exists: the link below runs after the insert and swallows its
    // failure, so a refusal there would leave an organizer holding an entry no coach can see.
    const registrableTeams = basicCoachTeamId && signedInCoach
      ? await getRegistrableTeamsForUser(signedInCoach.id, { forCheck: true })
      : undefined;
    const chosenTeam = basicCoachTeamId ? findRegistrableTeam(registrableTeams ?? [], basicCoachTeamId) : null;
    if (basicCoachTeamId && !chosenTeam) {
      return NextResponse.json({
        error: 'You can’t register that team, so it has NOT been registered. Ask its head coach to register it, or to let you.',
      }, { status: 403 });
    }

    // ONE TEAM, ONE ENTRY (owner, 2026-10-16). The form shows a team already in this tournament as
    // already registered; this is the same rule asked fresh, for a form opened before someone else on
    // the staff (or another tab) entered it. Any division: a team entered in the wrong one is moved by
    // the organizer, not entered again. The name rule below still runs — it is the only rule for a team
    // typed in by hand. ⚠ Two Submits in the same instant can both pass, as with the name rule.
    if (chosenTeam) {
      const entered = (await findTeamEntriesInTournament({ tournamentId, teams: [chosenTeam] }))
        .get(chosenTeam.basicCoachTeamId);
      if (entered) {
        return NextResponse.json({
          error: `${alreadyRegisteredRefusal(chosenTeam.name, entered)} It’s on your team’s Tournaments page.`,
          code: TEAM_ALREADY_REGISTERED,
        }, { status: 409 });
      }
    }

    // THE ENTRY'S COACH (Stage 1b, C1 + C2). A standalone Premium team's head coach comes from the same
    // staff list the D1 check just read — never a name from the browser — and C1 sends the organizer's
    // emails to them: `coach_email` when they are not the person registering. `email` stays the
    // registrant's, the claim key. Every other team: the person registering is the coach, as before.
    const pick = pickEntryHeadCoach(chosenTeam?.headCoaches ?? [], headCoachId);
    if (!pick.ok) {
      // The form asks the same question before Review, so this is a staff list that changed while the
      // form was open (a second head coach added, or the one picked stepped down): only a reload shows it.
      return NextResponse.json({
        error: 'Your team’s head coaches changed while this page was open, so your team has NOT been registered. Reload the page and try again.',
      }, { status: 409 });
    }
    const identity = pick.headCoach ? await getEntryHeadCoachIdentity(pick.headCoach.id) : null;
    const record = entryCoachRecord({
      headCoach: pick.headCoach,
      identity,
      registrantName,
      registrantEmail: email,
      addressRefused: !!identity?.email && !pick.headCoach?.isYou && await isPlatformAdminEmail(identity.email),
    });
    if (!record.ok) {
      return NextResponse.json({
        error: 'We couldn’t confirm your team’s head coach just now, so your team has NOT been registered. Reload the page and try again.',
      }, { status: 409 });
    }
    const { coach: entryCoach, coachEmail: entryCoachEmail, headCoachElsewhere } = record;

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

    let organization: HostOrg | null = null;
    if (tournament.org_id) {
      const { data: orgData, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select(`${DOOR_COLUMNS}, slug, is_public`)
        .eq('id', tournament.org_id)
        .maybeSingle<OrganizationRow>();

      if (orgError) {
        console.error('Registration organization lookup error:', orgError);
        return captureAndJson(orgError, { error: 'Unable to confirm tournament availability. Please try again.' }, 500);
      }

      if (orgData) {
        const facts = await effectiveOrgFactsOf(orgData);
        organization = {
          id: orgData.id,
          slug: orgData.slug,
          planId: facts.planId,
          ownPlanId: facts.ownPlanId,
          subscriptionStatus: facts.subscriptionStatus,
        };
      }
    }

    // Registration does NOT depend on the org's public-profile (is_public) flag — that gates only
    // the org home/league pages (League/Club). Tournament Plus orgs have no org profile
    // (is_public=false) yet their tournaments + registration must work. Mirror the read-path gate
    // in lib/public-tournament-data.ts getPublicContext: org must exist and not be canceled.
    if (!organization || organization.subscriptionStatus === 'canceled') {
      return NextResponse.json({ error: 'Tournament registration is not open.' }, { status: 403 });
    }
    // An invite-only event takes no registrations: its host adds every team (the free tournament tier, R3, B2,
    // 2026-10-16). Its Register page is absent; this holds a stale link or a direct post.
    if (runsInviteOnlyEvents(organization.planId)) {
      return NextResponse.json({ error: INVITE_REFUSALS.registration }, { status: 403 });
    }

    // Sandbox write block, body-identified branch. This is one of the few write endpoints whose
    // org is named in the REQUEST BODY (via the tournament id) rather than the URL, so the proxy
    // chokepoint cannot see it — the guard has to be called here, at the first point the org is
    // actually known. Without it, a visitor could register a real team into the demo tournament.
    const sandboxBlocked = assertNotDemoOrg(organization.slug);
    if (sandboxBlocked) return sandboxBlocked;

    const registrationFields = organization && hasPlanFeature(organization.planId, 'custom_registration_fields')
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
      return captureAndJson(slotError, { error: 'Unable to confirm division availability. Please try again.' }, 500);
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
        return captureAndJson(countError, { error: 'Unable to confirm division availability. Please try again.' }, 500);
      }

      if (division.capacity && (regCount ?? 0) >= division.capacity) {
        finalStatus = 'waitlist';
      }
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({
        name: teamName,
        coach: entryCoach,
        coach_email: entryCoachEmail,
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
      return captureAndJson(error, { error: 'Registration could not be submitted. Please try again.' }, 500);
    }

    // Filed under a team: only then is there anyone to tell in the team's bell (below).
    let linkedCoachId: string | null = null;
    if (data?.id && signedInCoach && signedInCoach.email === email) {
      try {
        await linkTournamentRegistrationToBasicCoachTeam({
          userId: signedInCoach.id,
          userEmail: signedInCoach.email,
          registrationId: data.id,
          basicCoachTeamId,
          linkSource: 'registration_flow',
          registrableTeams,
        });
        linkedCoachId = signedInCoach.id;
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
            return captureAndJson(uploadError, { error: 'Registration file upload failed. Please try again.' }, 500);
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
        planId: organization.ownPlanId,
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
    // The organizer's alert names the coach and where their emails go; the confirmation goes to the person
    // who registered, greets THEM, and says where updates go when the head coach is someone else (Stage 1b).
    const emailSends = [
      sendEmail(
        adminEmailToUse,
        `New Registration: ${teamName} (${divisionName})${isWaitlist ? ' - Waitlist' : ''}`,
        adminNotificationHtml({
          teamName, coachName: entryCoach, contactEmail: entryCoachEmail ?? email, divisionName, tournamentName,
          registeredBy: headCoachElsewhere ? { name: registrantName, email } : null,
        })
      ),
    ];
    if (coachEmailEnabled(tournament.settings, 'confirmation')) {
      const confirmation = {
        teamName, coachName: entryCoach, registrantName, divisionName, tournamentName,
        // "Organizer emails go to the head coach" only when they will: a refused address leaves them here.
        headCoachElsewhere: headCoachElsewhere && entryCoachEmail !== null,
        contactEmail: footerContactEmail, registrationId: data?.id, coachEmail: email,
      };
      emailSends.push(
        sendTransactionalEmail({
          key: isWaitlist ? 'tournament_registration_waitlist' : 'tournament_registration_confirmation',
          to: email,
          // A customised platform template greets `{{coachName}}`: the person this email goes to.
          vars: { coachName: registrantName?.trim() || 'Coach', teamName, ageGroupName: divisionName, tournamentName },
          defaultSubject: isWaitlist ? `Waitlist Confirmation - ${teamName}` : `Registration Received - ${teamName}`,
          defaultHtml: isWaitlist
            ? waitlistConfirmationHtml(confirmation)
            : registrationConfirmationHtml({ ...confirmation, paymentsTracked: tournamentTracksPayments(tournament.settings) }),
        })
      );
    }
    await Promise.all([
      Promise.allSettled(emailSends),
      // Every OTHER coach on the free team this entry was just filed under hears it in their bell (Free coach
      // header parity, owner 2026-10-13); the submitter has the confirmation. After the waitlist block, so
      // the words match the final status, and outside the email switch above: the bell ignores it (A6).
      // Never throws (lib/team-coach-notices).
      linkedCoachId && notifyTeamCoaches({
        registrationIds: [data.id],
        eventType: 'team_coach_registered',
        compose: registrationNoticeWords(finalStatus),
        excludeUserIds: [linkedCoachId],
      }),
    ]);

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
    await captureError(e, { route: '/api/register', method: 'POST', statusCode: 500 });
    return NextResponse.json({ error: 'Registration could not be submitted. Please try again.' }, { status: 500 });
  }
}, { route: '/api/register' });
