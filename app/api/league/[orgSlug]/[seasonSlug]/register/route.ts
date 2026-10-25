import { NextResponse } from 'next/server';
import {
  getLeagueSeasonBySlug,
  getDivisionsForSeason,
} from '@/lib/db';
import { placeLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice } from '@/lib/league-price';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { registrationRefusal } from '@/lib/league-registration-state';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import {
  leagueRegistrationApprovedHtml,
  leagueRegistrationPendingHtml,
  leagueRegistrationWaitlistHtml,
} from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { systemMailFace } from '@/lib/club-email-context';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm, throttlePublicFormRecipient } from '@/lib/public-form-throttle';

export const dynamic = 'force-dynamic';

// ── Field validation ───────────────────────────────────────────────────────────

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function str(v: unknown, max?: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;

  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;

  // 1. Resolve org + season
  // Gate the public register API exactly like the league index/sub-pages (audit J3-068):
  // a private, canceled, or non-entitled org must not accept public registrations.
  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'This club’s site isn’t available.' }, { status: 404 });

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  // 2. The form takes a sign-up only while its status AND its dates say so (9b-1 Part 4, S2·b); the refusal says why.
  const closed = registrationRefusal(season);
  if (closed) return NextResponse.json({ error: closed, code: 'not_open' }, { status: 409 });

  // 3. Parse + validate body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const errors: Record<string, string> = {};

  const divisionId       = str(body.divisionId);
  const playerFirstName  = str(body.playerFirstName, 80);
  const playerLastName   = str(body.playerLastName,  80);
  const playerDob        = str(body.playerDateOfBirth);
  const playerJersey     = str(body.playerJerseyPref, 3);
  const playerPosition   = str(body.playerPositionPref, 60);
  const playerNotes      = str(body.playerNotes, 500);
  const guardianFirst    = str(body.guardianFirstName, 80);
  const guardianLast     = str(body.guardianLastName,  80);
  const guardianEmail    = str(body.guardianEmail, 200);
  const guardianPhone    = str(body.guardianPhone, 30);
  const waiverAccepted   = body.waiverAccepted === true;

  if (!playerFirstName)  errors.playerFirstName  = 'Player first name is required';
  if (!playerLastName)   errors.playerLastName   = 'Player last name is required';
  if (playerDob && !isCalendarDate(playerDob)) errors.playerDateOfBirth = 'Enter a real date of birth';
  if (!guardianFirst)    errors.guardianFirstName = 'Guardian first name is required';
  if (!guardianLast)     errors.guardianLastName  = 'Guardian last name is required';
  if (!guardianEmail)    errors.guardianEmail     = 'Guardian email is required';
  else if (!isValidEmail(guardianEmail)) errors.guardianEmail = 'Enter a valid email address';

  if (season.waiverText && !waiverAccepted) {
    errors.waiverAccepted = 'You must accept the waiver to register';
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // 4. Resolve division (required — season must have at least one division at this point)
  const divisions = await getDivisionsForSeason(season.id);
  if (divisions.length === 0) {
    return NextResponse.json(
      { error: 'No divisions are available for this season' },
      { status: 409 },
    );
  }

  const division = divisionId
    ? divisions.find(d => d.id === divisionId) ?? null
    : divisions.length === 1 ? divisions[0] : null;

  if (!division) {
    return NextResponse.json(
      { error: 'Please select a valid division' },
      { status: 400 },
    );
  }

  // Last gate before the write + mail, so a family retrying after a late refusal (a stale
  // division, a full season) has not spent any of its budget on an email that never went.
  const recipientThrottled = throttlePublicFormRecipient(guardianEmail!);
  if (recipientThrottled) return recipientThrottled;

  // 5. Place the child: ONE locked database step counts the spots (accepted and received children hold one), decides
  // accepted / received / waitlisted, takes the next waitlist place and refuses the same child twice (Part 3, mig 362).
  // The price is the one rule on the club's day of sign-up (lib/league-price.ts), recorded on the registration.
  const waiverAcceptedAt = season.waiverText && waiverAccepted ? new Date().toISOString() : null;
  const result = await placeLeagueRegistration({
    orgId:      org.id,
    seasonId:   season.id,
    divisionId: division.id,
    want:       'auto',
    feeAmount:  leaguePrice(division, season, tournamentToday())?.amount ?? null,
    child: {
      firstName:         playerFirstName!,
      lastName:          playerLastName!,
      dateOfBirth:       playerDob,
      jerseyPref:        playerJersey,
      positionPref:      playerPosition,
      notes:             playerNotes,
      guardianFirstName: guardianFirst!,
      guardianLastName:  guardianLast!,
      guardianEmail:     guardianEmail!,
      guardianPhone:     guardianPhone,
      source:            'public_form',
      waiverAcceptedAt,
    },
    // With waiverAcceptedAt this files the consent-ledger row (mig 252): the route only decides WHETHER acceptance was
    // witnessed; the mechanics live with the placement.
    waiverText: season.waiverText ?? null,
  });
  if ('refusal' in result) {
    if (result.refusal === 'duplicate') {
      return NextResponse.json(
        { error: `${playerFirstName} ${playerLastName} is already signed up for this season. Use your reference to check their status.`, code: 'duplicate' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Please select a valid division' }, { status: 400 });
  }
  const registration = result.placed;
  const regStatus = registration.status;
  const waitlistPosition = registration.waitlistPosition;

  // 7. Send confirmation email (fire-and-forget — registration succeeds even if email fails)
  const emailParams = {
    playerFirstName:  playerFirstName!,
    playerLastName:   playerLastName!,
    guardianFirstName: guardianFirst!,
    seasonName:       season.name,
    divisionName:     division.name,
    registrationId:   registration.id,
    contactEmail:     undefined as string | undefined,
  };

  void (async () => {
    try {
      // The club's face (The public face, warm: S3b); a face that cannot be read is a plainer email, never a missed one.
      const face = await systemMailFace(org);
      let key: string;
      let subject: string;
      let html: string;
      const vars = {
        guardianFirstName: guardianFirst!,
        playerFirstName:   playerFirstName!,
        playerLastName:    playerLastName!,
        seasonName:        season.name,
        divisionName:      division.name,
      };
      if (regStatus === 'active') {
        key     = 'league_registration_approved';
        subject = `Registration approved — ${season.name}`;
        html    = leagueRegistrationApprovedHtml({ ...emailParams, face });
      } else if (regStatus === 'waitlisted') {
        key     = 'league_registration_waitlisted';
        subject = `You're on the waitlist — ${season.name}`;
        html    = leagueRegistrationWaitlistHtml({ ...emailParams, waitlistPosition: waitlistPosition!, face });
      } else {
        key     = 'league_registration_pending';
        subject = `Registration received — ${season.name}`;
        html    = leagueRegistrationPendingHtml({ ...emailParams, face });
      }
      await sendTransactionalEmail({
        key,
        to: guardianEmail!,
        vars: regStatus === 'waitlisted' ? { ...vars, waitlistPosition: waitlistPosition! } : vars,
        defaultSubject: subject,
        defaultHtml: html,
        family: face ? { face, reason: `${playerFirstName} was registered for ${season.name}` } : undefined,
      });
    } catch (e) {
      console.error('[league-register] email send failed:', e);
    }
  })();

  return NextResponse.json({
    id:               registration.id,
    status:           registration.status,
    waitlistPosition: registration.waitlistPosition,
  }, { status: 201 });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/register' });
