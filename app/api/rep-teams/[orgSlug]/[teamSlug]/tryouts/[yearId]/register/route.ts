import { NextResponse } from 'next/server';
import {
  getOrganizationBySlug,
  getRepTeamBySlug,
  getRepProgramYear,
  createRepTryoutRegistration,
} from '@/lib/db';
import { tryoutRegistrationConfirmationHtml } from '@/lib/email';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { withObservability } from '@/lib/observability';
import { clientIpFrom } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function str(v: unknown, max?: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamSlug: string; yearId: string }> },) => {
  const { orgSlug, teamSlug, yearId } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  // A cancelled org must not keep taking in players' and guardians' personal details. This is a
  // PUBLIC route — no session, so the billing rail on getAuthContext never sees it — and it writes
  // name, date of birth, and guardian contact details. The house-league sibling
  // (resolvePublicLeagueContext, audit J3-068) has refused registrations for a cancelled org for
  // a while; rep-team tryouts never got the same treatment. 404, not 403: a cancelled org's public
  // surface should read as "not here", the same as its tournament and league pages already do.
  if (isOrgBillingSuspended(org)) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const team = await getRepTeamBySlug(org.id, teamSlug);
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id || programYear.orgId !== org.id) {
    return NextResponse.json({ error: 'Program year not found' }, { status: 404 });
  }

  if (!programYear.tryoutOpen) {
    return NextResponse.json(
      { error: 'Tryout registration is not currently open for this program year' },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  const playerFirstName = str(body.playerFirstName, 80);
  const playerLastName  = str(body.playerLastName,  80);
  const playerDob       = str(body.playerDateOfBirth);
  const playerNotes     = str(body.playerNotes, 500);
  const guardianFirst   = str(body.guardianFirstName, 80);
  const guardianLast    = str(body.guardianLastName,  80);
  const guardianEmail   = str(body.guardianEmail, 200);
  const guardianPhone   = str(body.guardianPhone, 30);

  if (!playerFirstName)  errors.playerFirstName  = 'Player first name is required';
  if (!playerLastName)   errors.playerLastName   = 'Player last name is required';
  if (!playerDob)        errors.playerDateOfBirth = 'Player date of birth is required';
  if (!guardianFirst)    errors.guardianFirstName = 'Guardian first name is required';
  if (!guardianLast)     errors.guardianLastName  = 'Guardian last name is required';
  if (!guardianEmail)    errors.guardianEmail     = 'Guardian email is required';
  else if (!isValidEmail(guardianEmail)) errors.guardianEmail = 'Enter a valid email address';

  // Consent gate (PIPEDA/CASL): all three must be explicitly true. We do NOT trust a client-sent
  // timestamp/IP — those are stamped server-side below.
  const consentDataCollection = body.consentDataCollection === true;
  // OPTIONAL since 2026-07-30 (CASL unbundling, owner-decided): this is genuine MARKETING
  // consent — club news and future-season announcements. The application-received receipt below
  // is a transactional acknowledgement of the family's OWN submission and is never gated on it;
  // making it a submit condition was the pattern CASL frowns on. (The offer / waitlist / release
  // / welcome emails this comment used to also name were removed outright on 2026-08-26 — the
  // receipt is now the only email a tryout ever sends a family.)
  const consentEmailComms     = body.consentEmailComms === true;
  const consentEligibility    = body.consentEligibility === true;
  if (!consentDataCollection || !consentEligibility) {
    errors.consent = 'Please confirm the two boxes above before submitting.';
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const registration = await createRepTryoutRegistration({
    programYearId:    programYear.id,
    teamId:           team.id,
    orgId:            org.id,
    playerFirstName:  playerFirstName!,
    playerLastName:   playerLastName!,
    playerDateOfBirth: playerDob,
    playerNotes:      playerNotes,
    guardianFirstName: guardianFirst!,
    guardianLastName:  guardianLast!,
    guardianEmail:    guardianEmail!,
    guardianPhone:    guardianPhone,
    consentDataCollection,
    consentEmailComms,
    consentEligibility,
    consentAt:        new Date().toISOString(),
    consentIp:        clientIpFrom(req),
  });

  void (async () => {
    try {
      const html = tryoutRegistrationConfirmationHtml({
        guardianFirstName: guardianFirst!,
        playerFirstName:   playerFirstName!,
        playerLastName:    playerLastName!,
        teamName:          team.name,
        yearName:          programYear.name,
        registrationId:    registration.id,
      });
      await sendTransactionalEmail({
        key: 'tryout_application_received',
        to: guardianEmail!,
        vars: {
          guardianFirstName: guardianFirst!,
          playerFirstName:   playerFirstName!,
          playerLastName:    playerLastName!,
          teamName:          team.name,
          yearName:          programYear.name,
        },
        defaultSubject: `Tryout application received — ${team.name} ${programYear.name}`,
        defaultHtml: html,
      });
    } catch (e) {
      console.error('[tryout-register] email send failed:', e);
    }
  })();

  return NextResponse.json({ id: registration.id, status: registration.status }, { status: 201 });
}, { route: '/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register' });
