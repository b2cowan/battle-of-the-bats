import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { placeLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice } from '@/lib/league-price';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const status     = url.searchParams.get('status')     ?? '';
  const divisionId = url.searchParams.get('divisionId') ?? '';
  const search     = url.searchParams.get('search')     ?? '';

  let q = supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('season_id', seasonId)
    .order('registered_at', { ascending: false });

  if (status)     q = q.eq('status', status as LeagueRegistrationStatus);
  if (divisionId) q = q.eq('division_id', divisionId);
  if (search) {
    const s = search.trim().replace(/[%_]/g, '\\$&');
    q = q.or(
      `player_first_name.ilike.%${s}%,player_last_name.ilike.%${s}%,guardian_email.ilike.%${s}%`,
    );
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const registrations = (data ?? []).map(mapRegistration);

  return NextResponse.json({ registrations });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations' });

// Camel-case mapping (mirrors mapLeagueRegistration in lib/db.ts)
function mapRegistration(row: any) {
  return {
    id:                  row.id,
    seasonId:            row.season_id,
    divisionId:          row.division_id ?? null,
    playerFirstName:     row.player_first_name,
    playerLastName:      row.player_last_name,
    playerDateOfBirth:   row.player_date_of_birth ?? null,
    playerJerseyPref:    row.player_jersey_pref ?? null,
    playerPositionPref:  row.player_position_pref ?? null,
    playerNotes:         row.player_notes ?? null,
    guardianFirstName:   row.guardian_first_name,
    guardianLastName:    row.guardian_last_name,
    guardianEmail:       row.guardian_email,
    guardianPhone:       row.guardian_phone ?? null,
    status:              row.status,
    waitlistPosition:    row.waitlist_position ?? null,
    teamId:              row.team_id ?? null,
    registrationFeePaid: row.registration_fee_paid,
    feeEntryId:          row.fee_entry_id ?? null,
    adminNotes:          row.admin_notes ?? null,
    source:              row.source,
    waiverAcceptedAt:    row.waiver_accepted_at ?? null,
    signupRef:           row.signup_ref ?? null,
    signupPosition:      row.signup_position ?? null,
    feeAmount:           row.fee_amount != null ? Number(row.fee_amount) : null,
    registeredAt:        row.registered_at,
    updatedAt:           row.updated_at,
  };
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  // Add by hand: the registrar too (Q17).
  const err = houseLeagueRefusal(ctx, 'register');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'register', season);
  if (refused) return refused;

  const body = await req.json();

  const playerFirstName  = typeof body.playerFirstName  === 'string' ? body.playerFirstName.trim()  : '';
  const playerLastName   = typeof body.playerLastName   === 'string' ? body.playerLastName.trim()   : '';
  const guardianFirstName = typeof body.guardianFirstName === 'string' ? body.guardianFirstName.trim() : '';
  const guardianLastName  = typeof body.guardianLastName  === 'string' ? body.guardianLastName.trim()  : '';
  const guardianEmail    = typeof body.guardianEmail    === 'string' ? body.guardianEmail.trim()    : '';
  const divisionId       = typeof body.divisionId       === 'string' ? body.divisionId              : null;

  if (!playerFirstName || !playerLastName) {
    return NextResponse.json({ error: 'playerFirstName and playerLastName are required' }, { status: 400 });
  }
  if (!guardianFirstName || !guardianLastName || !guardianEmail) {
    return NextResponse.json({ error: 'guardianFirstName, guardianLastName, and guardianEmail are required' }, { status: 400 });
  }
  if (!divisionId) {
    return NextResponse.json({ error: 'divisionId is required for manual registrations' }, { status: 400 });
  }
  // Ownership: a registration filed under a foreign division would land in that org's draft pool.
  const { data: division } = await supabaseAdmin
    .from('league_divisions').select('id, name, price, early_price').eq('id', divisionId).eq('season_id', seasonId).maybeSingle();
  if (!division) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }

  const playerDob = typeof body.playerDateOfBirth === 'string' && body.playerDateOfBirth.trim() ? body.playerDateOfBirth.trim() : null;
  if (playerDob && !isCalendarDate(playerDob)) {
    return NextResponse.json({ error: 'Enter a real date of birth' }, { status: 400 });
  }

  const statusRaw = typeof body.status === 'string' ? body.status : 'active';
  const VALID_STATUSES: LeagueRegistrationStatus[] = ['pending_review', 'active', 'waitlisted', 'declined', 'withdrawn'];
  if (!VALID_STATUSES.includes(statusRaw as LeagueRegistrationStatus)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  // One locked placement (Part 3, mig 362): a full division refuses Accepted or Received, never over-fills; the same child
  // twice is refused. The price is the one rule on the club's day (lib/league-price.ts), recorded on the registration.
  const result = await placeLeagueRegistration({
    orgId: ctx!.org.id,
    seasonId,
    divisionId,
    want: statusRaw as LeagueRegistrationStatus,
    feeAmount: leaguePrice({
      price: division.price != null ? Number(division.price) : null,
      earlyPrice: division.early_price != null ? Number(division.early_price) : null,
    }, season, tournamentToday())?.amount ?? null,
    child: {
      firstName: playerFirstName,
      lastName: playerLastName,
      dateOfBirth:  playerDob,
      jerseyPref:   typeof body.playerJerseyPref   === 'string' ? body.playerJerseyPref   : null,
      positionPref: typeof body.playerPositionPref === 'string' ? body.playerPositionPref : null,
      notes:        typeof body.playerNotes        === 'string' ? body.playerNotes        : null,
      guardianFirstName,
      guardianLastName,
      guardianEmail,
      guardianPhone: typeof body.guardianPhone === 'string' ? body.guardianPhone : null,
      source: 'admin_manual',
    },
  });
  if ('refusal' in result) {
    if (result.refusal === 'full') {
      return NextResponse.json({ error: `${division.name} is full. Add to the waitlist instead.`, code: 'division_full' }, { status: 409 });
    }
    if (result.refusal === 'duplicate') {
      return NextResponse.json({ error: `${playerFirstName} ${playerLastName} already has a registration this season.`, code: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const { data: row } = await supabaseAdmin.from('league_registrations').select('*').eq('id', result.placed.id).single();
  const registration = mapRegistration(row);

  // Notify org admins of new house league registration (fire-and-forget)
  notify({
    orgId: ctx!.org.id,
    eventType: 'house_league_registration_new',
    title: `New registration: ${playerFirstName} ${playerLastName}`,
    body: season.name,
    link: `/${ctx!.org.slug}/admin/house-league/seasons/${seasonId}/registrations`,
  }).catch(console.error);

  return NextResponse.json(registration, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations' });
