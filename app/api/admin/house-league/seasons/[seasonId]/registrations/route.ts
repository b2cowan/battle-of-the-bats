import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, createRegistration, createLeagueRegistrationFeeEntry } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import type { LeagueRegistrationStatus } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const url = new URL(req.url);
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

  // Camel-case mapping (mirrors mapLeagueRegistration in lib/db.ts)
  const registrations = (data ?? []).map((row: any) => ({
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
    registeredAt:        row.registered_at,
    updatedAt:           row.updated_at,
  }));

  return NextResponse.json({ registrations });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

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

  const statusRaw = typeof body.status === 'string' ? body.status : 'active';
  const VALID_STATUSES: LeagueRegistrationStatus[] = ['pending_review', 'active', 'waitlisted', 'declined', 'withdrawn'];
  if (!VALID_STATUSES.includes(statusRaw as LeagueRegistrationStatus)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
  }

  const registration = await createRegistration({
    seasonId,
    divisionId,
    playerFirstName,
    playerLastName,
    playerDateOfBirth:   typeof body.playerDateOfBirth  === 'string' ? body.playerDateOfBirth  : null,
    playerJerseyPref:    typeof body.playerJerseyPref   === 'string' ? body.playerJerseyPref   : null,
    playerPositionPref:  typeof body.playerPositionPref === 'string' ? body.playerPositionPref : null,
    playerNotes:         typeof body.playerNotes        === 'string' ? body.playerNotes        : null,
    guardianFirstName,
    guardianLastName,
    guardianEmail,
    guardianPhone:       typeof body.guardianPhone      === 'string' ? body.guardianPhone      : null,
    status:              statusRaw as LeagueRegistrationStatus,
    source:              'admin_manual',
  });

  // Auto-generate pending fee entry for manually-added active registrations
  if (statusRaw === 'active' && season.autoGenerateFees && season.registrationFee) {
    void createLeagueRegistrationFeeEntry(
      ctx!.org.id, seasonId, season.name, registration.id,
      `${playerFirstName} ${playerLastName}`, season.registrationFee,
      'pending', ctx!.user.id,
    ).catch(e => console.error('[ledger] manual add fee entry failed', e));
  }

  // Notify org admins of new house league registration (fire-and-forget)
  notify({
    orgId: ctx!.org.id,
    eventType: 'house_league_registration_new',
    title: `New registration: ${playerFirstName} ${playerLastName}`,
    body: season.name,
    link: `/${ctx!.org.slug}/admin/house-league/seasons/${seasonId}/registrations`,
  }).catch(console.error);

  return NextResponse.json(registration, { status: 201 });
}
