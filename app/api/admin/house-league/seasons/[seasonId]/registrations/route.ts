import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, mapLeagueRegistration } from '@/lib/db';
import { placeLeagueRegistration } from '@/lib/league-registration-place';
import { leaguePrice } from '@/lib/league-price';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import type { LeagueRegistrationStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { loadSeasonMoneyLines } from '@/lib/league-money-read';
import { clubTakesCards, loadCardRefunds, returnedCardRefunds, unrecordedCardShares } from '@/lib/league-pay-facts';

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
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

  // The money on every row (Club Tier 9b-2): each registration's book lines and its price history, read one way — the
  // screen turns them into the Fee cell through lib/league-money.ts. Readers of the season read the fee as before.
  // Read beside the season check; nothing is returned until it passes.
  const [season, { data, error }, lines, changes, payLinks] = await Promise.all([
    getLeagueSeasonById(seasonId, ctx!.org.id),
    q,
    loadSeasonMoneyLines(ctx!.org.id, seasonId),
    supabaseAdmin.from('league_registration_price_changes')
      .select('registration_id, kind, old_amount, new_amount, reason, changed_by, changed_at, refund_entry_id')
      .eq('org_id', ctx!.org.id).eq('season_id', seasonId).order('changed_at', { ascending: true }),
    // 12b: the club takes card payments, so an owing row offers "Email the pay link".
    clubTakesCards(ctx!.org),
  ]);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (changes.error) return NextResponse.json({ error: changes.error.message }, { status: 500 });

  const registrations = (data ?? []).map(mapLeagueRegistration);
  const shown = new Set(registrations.map(r => r.id));
  const money = Object.fromEntries([...lines].filter(([id]) => shown.has(id)));
  const [unrecordedCard, returnedRefunds, cardRefunds] = await Promise.all([
    unrecordedCardShares([...shown]), returnedCardRefunds([...shown]), loadCardRefunds(ctx!.org.id, [...shown]),
  ]);
  const priceChanges = (changes.data ?? []).map(c => ({
    registrationId: c.registration_id as string, kind: c.kind as 'corrected' | 'moved',
    oldAmount: c.old_amount != null ? Number(c.old_amount) : null, newAmount: Number(c.new_amount),
    reason: (c.reason as string | null) ?? null, changedBy: (c.changed_by as string | null) ?? null, changedAt: c.changed_at as string,
    refundEntryId: (c.refund_entry_id as string | null) ?? null,
  }));

  return NextResponse.json({ registrations, money, priceChanges, today: tournamentToday(), payLinks, unrecordedCard, returnedRefunds, cardRefunds });
}, { route: '/api/admin/house-league/seasons/[seasonId]/registrations' });


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
  const registration = mapLeagueRegistration(row);

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
