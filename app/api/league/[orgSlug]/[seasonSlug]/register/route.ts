import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  getOrganizationBySlug,
  getLeagueSeasonBySlug,
  getDivisionsForSeason,
  createRegistration,
} from '@/lib/db';
import {
  sendEmail,
  leagueRegistrationApprovedHtml,
  leagueRegistrationPendingHtml,
  leagueRegistrationWaitlistHtml,
} from '@/lib/email';
import { withObservability } from '@/lib/observability';

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

  // 1. Resolve org + season
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  // 2. Verify registration is open
  if (season.status !== 'registration_open') {
    return NextResponse.json(
      { error: 'Registration is not currently open for this season' },
      { status: 409 },
    );
  }

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

  // 5. Check capacity + determine registration status
  const { count: activeCount } = await supabaseAdmin
    .from('league_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('division_id', division.id)
    .eq('status', 'active');

  const active = activeCount ?? 0;
  const underCapacity = division.capacity == null || active < division.capacity;

  let regStatus: 'active' | 'pending_review' | 'waitlisted';
  let waitlistPosition: number | null = null;

  if (underCapacity) {
    regStatus = season.autoApproveUnderCapacity ? 'active' : 'pending_review';
  } else {
    regStatus = 'waitlisted';
    const { count: wlCount } = await supabaseAdmin
      .from('league_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('division_id', division.id)
      .eq('status', 'waitlisted');
    waitlistPosition = (wlCount ?? 0) + 1;
  }

  // 6. Insert registration
  const registration = await createRegistration({
    seasonId:           season.id,
    divisionId:         division.id,
    playerFirstName:    playerFirstName!,
    playerLastName:     playerLastName!,
    playerDateOfBirth:  playerDob,
    playerJerseyPref:   playerJersey,
    playerPositionPref: playerPosition,
    playerNotes:        playerNotes,
    guardianFirstName:  guardianFirst!,
    guardianLastName:   guardianLast!,
    guardianEmail:      guardianEmail!,
    guardianPhone:      guardianPhone,
    status:             regStatus,
    waitlistPosition,
    source:             'public_form',
  });

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
      let subject: string;
      let html: string;
      if (regStatus === 'active') {
        subject = `Registration approved — ${season.name}`;
        html    = leagueRegistrationApprovedHtml(emailParams);
      } else if (regStatus === 'waitlisted') {
        subject = `You're on the waitlist — ${season.name}`;
        html    = leagueRegistrationWaitlistHtml({ ...emailParams, waitlistPosition: waitlistPosition! });
      } else {
        subject = `Registration received — ${season.name}`;
        html    = leagueRegistrationPendingHtml(emailParams);
      }
      await sendEmail(guardianEmail!, subject, html);
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
