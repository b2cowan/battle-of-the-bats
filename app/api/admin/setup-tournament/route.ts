import { createClient } from '@supabase/supabase-js';
import { getAuthContext, getAuthContextWithScope, unauthorized, requireCapability } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { isThemePresetKey } from '@/lib/themes';
import { hasOrgVenueLibrary, hasPlanFeature } from '@/lib/plan-features';
import { isTournamentFormat, tournamentFormatCreatePatch } from '@/lib/tournament-phase';
import { copyLibraryVenue, copyPastVenue, createTournamentVenue } from '@/lib/tournament-venue-copy';
import { FACILITY_TYPES, type FacilityType } from '@/lib/types';
import { hasFiniteSlots, readSlotHolders, visibleHolder } from '@/lib/tournament-slot';
import { slotsInUseRefusal } from '@/lib/tournament-status-words';
import { nameTakenRefusal, sameTournamentName } from '@/lib/tournament-name';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';

type DivisionAgeConfig = {
  min: number | null;
  max: number | null;
  order: number;
};

type SetupDivision = {
  name: string;
  minAge?: number | string | null;
  maxAge?: number | string | null;
  capacity: number;
  poolCount: number;
  poolNames: string;
  requiresPoolSelection: boolean;
};

type PoolInsertRow = {
  division_id: string;
  name: string;
  display_order: number;
};

/**
 * The venues the New tournament window picked (Stage 5, E1): a new one with its count, a past event's ("your venues")
 * or the club's library venue. Created in THIS request, after the tournament, so a failure takes the whole draft back
 * (the catch below) — today the wizard saved them one call at a time after the draft, and a failure halfway left a
 * draft missing a park.
 */
type SetupVenue =
  | { kind: 'new'; name: string; address?: string | null; notes?: string | null; count: number; facilityType: FacilityType }
  | { kind: 'past'; sourceVenueId: string }
  | { kind: 'library'; orgVenueId: string };

function readSetupVenues(value: unknown): SetupVenue[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 40) return null;
  const out: SetupVenue[] = [];
  for (const raw of value as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.kind === 'new' && typeof raw.name === 'string' && raw.name.trim()) {
      out.push({
        kind: 'new',
        name: raw.name.trim(),
        address: typeof raw.address === 'string' ? raw.address : null,
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        count: Number(raw.count) || 1,
        facilityType: FACILITY_TYPES.includes(raw.facilityType as FacilityType) ? raw.facilityType as FacilityType : 'other',
      });
    } else if (raw.kind === 'past' && typeof raw.sourceVenueId === 'string') {
      out.push({ kind: 'past', sourceVenueId: raw.sourceVenueId });
    } else if (raw.kind === 'library' && typeof raw.orgVenueId === 'string') {
      out.push({ kind: 'library', orgVenueId: raw.orgVenueId });
    } else {
      return null;
    }
  }
  return out;
}

type SeedTeam = {
  id: string;
  division_id: string;
  pool_id?: string | null;
};

type GameInsertRow = {
  tournament_id: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  game_time: string;
  location: string | null;
  diamond_id: string;
  status: 'completed' | 'scheduled';
  home_score: number | null;
  away_score: number | null;
};

function normalizeOptionalAge(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const age = Number(value);
  return Number.isFinite(age) ? age : null;
}

function getDivisionAgeConfig(division: SetupDivision, index: number): DivisionAgeConfig {
  const min = normalizeOptionalAge(division.minAge);
  const max = normalizeOptionalAge(division.maxAge);
  if (min !== null && max !== null && min > max) {
    throw new Error(`Minimum age cannot be greater than maximum age for ${division.name}.`);
  }
  return {
    min,
    max,
    order: index + 1,
  };
}

function isDateValue(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getTodayDateValue() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : tournamentToday();
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!auth) return unauthorized();

  const denied = await requireCapability(auth, 'create_tournaments');
  if (denied) return denied;

  // Tracked so the outer catch can roll back a half-created tournament.
  let createdTournamentId: string | null = null;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("Setup API Error: Missing environment variables", { url: !!url, key: !!key });
      return new Response(JSON.stringify({
        error: `Environment variables missing on server. URL: ${!!url}, KEY: ${!!key}. Please check Amplify settings.`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const body = await req.json().catch(() => null);
    
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const debug: string[] = [];
    const log = (msg: string, data?: unknown) => {
      const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
      console.log(`[Setup API] ${line}`);
      debug.push(line);
    };

    const { tournament, divisions, announcement, seedData, scheduleParams } = body;
    const allowSeedData = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';
    const effectiveSeedData = allowSeedData ? seedData : null;
    const slug = String(tournament?.slug ?? '').trim().toLowerCase();
    const tournamentName = String(tournament?.name ?? '').trim().replace(/\s+/g, ' ');
    const startDate = isDateValue(tournament?.startDate) ? tournament.startDate : null;
    const endDate = isDateValue(tournament?.endDate) ? tournament.endDate : null;

    if (!tournamentName) {
      return Response.json({ error: 'Tournament name is required.' }, { status: 400 });
    }

    // The style is saved WITH the tournament (F78): it used to be a second call whose failure was swallowed, so an
    // Exhibition could quietly become round robin + playoffs.
    if (tournament?.format != null && !isTournamentFormat(tournament.format)) {
      return Response.json({ error: 'Unknown tournament style.' }, { status: 400 });
    }
    const formatPatch = tournamentFormatCreatePatch(isTournamentFormat(tournament?.format) ? tournament.format : undefined);

    const setupVenues = readSetupVenues(body.venues);
    if (!setupVenues) return Response.json({ error: 'The venues could not be read.' }, { status: 400 });
    // The club's library is League Plus and Club only (the same gate as the library itself).
    if (setupVenues.some(v => v.kind === 'library') && !hasOrgVenueLibrary(auth.org.planId)) {
      return Response.json({ error: 'The Venue library is part of League Plus and Club.' }, { status: 403 });
    }

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return Response.json({ error: 'Tournament URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
    }

    if (endDate && !startDate) {
      return Response.json({ error: 'Choose a start date before setting an end date.' }, { status: 400 });
    }

    if (startDate && startDate < getTodayDateValue()) {
      return Response.json({ error: 'Start date cannot be before today.' }, { status: 400 });
    }

    if (startDate && endDate && endDate < startDate) {
      return Response.json({ error: 'End date cannot be before the start date.' }, { status: 400 });
    }

    const { count: slugCount, error: slugError } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', auth.org.id)
      .eq('slug', slug)
      .neq('status', 'archived');

    if (slugError) throw slugError;
    if ((slugCount ?? 0) > 0) {
      return Response.json({ error: 'A tournament with this URL already exists.' }, { status: 409 });
    }

    const { data: existingNames, error: nameError } = await supabase
      .from('tournaments')
      .select('name')
      .eq('org_id', auth.org.id)
      .neq('status', 'archived');

    if (nameError) throw nameError;
    if ((existingNames ?? []).some(row => sameTournamentName(row.name ?? '', tournamentName))) {
      return Response.json({ error: nameTakenRefusal(tournamentName) }, { status: 409 });
    }

    // One at a time (A23): only a Draft or Active event holds a slot — a finished one stays online and holds none.
    const limit = auth.org.tournamentLimit;
    if (hasFiniteSlots(limit)) {
      const holders = await readSlotHolders(supabase, auth.org.id);
      if (holders.length >= limit) {
        // The refusal names the holder only to a caller who may see it — their assignments, read on this rare path only.
        const scoped = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
        return Response.json({ error: slotsInUseRefusal(limit, visibleHolder(holders, scoped?.assignedTournamentIds)) }, { status: 403 });
      }
    }

    // Year is derived from the start date when present — the setup wizards no longer ask for it
    // separately. Callers without dates (e.g. the League/Club org modal) may still pass a year.
    const derivedYear = startDate ? Number(startDate.slice(0, 4)) : Number(tournament?.year);
    if (!Number.isInteger(derivedYear) || derivedYear < 1900) {
      return Response.json({ error: 'A valid start date (or tournament year) is required.' }, { status: 400 });
    }

    // Public-page colours, when the wizard's swatch row offered them. The UI only shows that
    // row to entitled members, but entitlement is decided HERE: an unknown preset, a plan
    // without custom branding, or a member who may not set branding is refused rather than
    // quietly ignored (a silently dropped choice is worse than an error).
    let themePreset: string | null = null;
    if (tournament?.themePreset != null) {
      const requested = String(tournament.themePreset);
      if (!isThemePresetKey(requested)) {
        return Response.json({ error: 'Unknown theme preset.' }, { status: 400 });
      }
      if (!hasPlanFeature(auth.org.planId, 'advanced_tournament_branding')) {
        return Response.json(
          { error: 'Tournament colours require Tournament Plus or higher.' },
          { status: 403 },
        );
      }
      const brandingDenied = await requireCapability(auth, 'manage_branding');
      if (brandingDenied) return brandingDenied;
      themePreset = requested;
    }

    // Public contact defaults to the member creating the tournament; editable later in Event Settings.
    const { data: creatorMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', auth.org.id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    const inviteOnly = runsInviteOnlyEvents(auth.org.planId);

    // 1. Create Tournament (always starts as draft; activate explicitly from the Tournaments page)
    const { data: newTnt, error: tntError } = await supabase
      .from('tournaments')
      .insert({
        year:            derivedYear,
        name:            tournamentName,
        slug,
        status:          'draft',
        is_active:       false,
        start_date:      startDate,
        end_date:        endDate,
        default_contact_member_id: creatorMember?.id ?? null,
        org_id: auth.org.id,
        // An invite-only event (the free plan, a Premium coach's event) tracks no payments: it is created as "Not
        // tracked here", the one way the product says so (the free tournament tier, 2026-10-16), and its Fees card is absent.
        ...(formatPatch || inviteOnly
          ? { settings: { ...(formatPatch?.settings ?? {}), ...(inviteOnly ? { fee_scope: 'free' } : {}) } }
          : {}),
        // Left NULL unless explicitly chosen, so the event keeps following the org's theme.
        ...(themePreset ? { theme_preset: themePreset } : {}),
      })
      .select()
      .single();

    if (tntError) {
      log('Tournament Create Error', tntError);
      throw tntError;
    }
    const tid = newTnt.id;
    createdTournamentId = tid;
    log('Created Tournament', tid);

    // 2. Initialize Divisions & Pools
    if (divisions && divisions.length > 0) {
      const groupRows = (divisions as SetupDivision[]).map((div, index) => {
        const config = getDivisionAgeConfig(div, index);
        return {
          tournament_id: tid,
          name: div.name,
          min_age: config.min,
          max_age: config.max,
          display_order: config.order,
          // An invite-only event has no spots: the wizard's default count is never stored (the free tournament tier).
          capacity: inviteOnly ? null : div.capacity,
          pool_count: div.poolCount,
          pool_names: div.poolNames,
          requires_pool_selection: div.requiresPoolSelection
        };
      });

      const { data: insertedGroups, error: groupError } = await supabase
        .from('divisions')
        .insert(groupRows)
        .select();

      if (groupError) throw groupError;

      // 3. Create Pools for each group
      if (insertedGroups) {
        const poolRows: PoolInsertRow[] = [];
        for (const g of insertedGroups) {
          const names = (g.pool_names || '').split(',').map((n: string) => n.trim()).filter(Boolean);
          const poolCount = Number(g.pool_count ?? 0);
          for (let i = 0; i < poolCount; i++) {
            const name = names[i] || String.fromCharCode(65 + i);
            poolRows.push({
              division_id: g.id,
              name: name.startsWith('Pool ') ? name.replace('Pool ', '') : name,
              display_order: i
            });
          }
        }

        if (poolRows.length > 0) {
          const { error: poolError } = await supabase.from('pools').insert(poolRows);
          if (poolError) {
            log('Pool Insert Error', poolError);
            throw poolError;
          }
          log(`Initialized ${poolRows.length} pools`);
        }
      }
    }

    // 3.5 Venues, each with its diamonds (Stage 5, E1). Any failure throws, and the catch takes the draft back.
    // (The old "migration" path — venues copied with no facilities — had no caller left and went with it.)
    // A past venue comes only from an event the member may see (their assignments, read when one is asked for).
    // (null = unrestricted — an owner; a member whose scope can't be read gets none.)
    let allowedTournamentIds: string[] | null = null;
    if (setupVenues.some(v => v.kind === 'past')) {
      const scoped = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
      allowedTournamentIds = scoped ? scoped.assignedTournamentIds : [];
    }
    for (const venue of setupVenues) {
      if (venue.kind === 'new') {
        await createTournamentVenue(tid, venue);
      } else if (venue.kind === 'past') {
        const copied = await copyPastVenue(tid, auth.org.id, venue.sourceVenueId, allowedTournamentIds);
        if (!copied) throw new Error('One of your venues could not be found. Pick it again.');
      } else {
        const copied = await copyLibraryVenue(tid, auth.org.id, venue.orgVenueId);
        if (!copied) throw new Error('One of the club’s venues could not be found. Pick it again.');
      }
    }
    if (setupVenues.length) log(`Created ${setupVenues.length} venues`);

    // 4. Seed Data
    if (effectiveSeedData && Object.values(effectiveSeedData).some(v => v)) {
      log('Seeding Data', effectiveSeedData);
      const { data: divisions } = await supabase.from('divisions').select('*, pools(*)').eq('tournament_id', tid);
      
      if (divisions && divisions.length > 0) {
        if (effectiveSeedData.venues) {
          const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
          const rows = names.map((name, i) => ({
            tournament_id: tid,
            name,
            address: `${100 + i} Main St, Milton, ON`,
            notes: i % 2 === 0 ? 'Lighted field' : ''
          }));
          await supabase.from('diamonds').insert(rows);
        }

        if (effectiveSeedData.registrations) {
          const teamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons'];
          const coaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather'];
          
          for (const group of divisions) {
            const groupPools = group.pools || [];
            
            const teamRows = teamNames.map((name, i) => {
              const poolObj = groupPools.length > 0 ? groupPools[i % groupPools.length] : null;
              return {
                tournament_id: tid,
                division_id: group.id,
                name: `${name} ${group.name}`,
                coach: coaches[i],
                email: `coach${i}@example.com`,
                pool_id: poolObj?.id
              };
            });
            const { error: insertError } = await supabase.from('teams').insert(teamRows);
            if (insertError) console.error(`Error inserting teams for group ${group.name}:`, insertError);
          }
        }

        if (effectiveSeedData.schedule || effectiveSeedData.results) {
          log('Seeding schedule/results for tournament:', tid);
          
          // 1. Fetch teams that were just created
          const { data: allTeams, error: teamsFetchError } = await supabase
            .from('teams')
            .select('*')
            .eq('tournament_id', tid);
          
          if (teamsFetchError) {
            log('Teams Fetch Error', teamsFetchError);
          }

          // 2. Fetch venues
          const { data: venues, error: venuesFetchError } = await supabase
            .from('diamonds')
            .select('*')
            .eq('tournament_id', tid);

          if (venuesFetchError) {
            log('Venues Fetch Error', venuesFetchError);
          }

          log(`Schedule Seed: Found ${allTeams?.length || 0} teams and ${venues?.length || 0} venues`);

          if (allTeams && allTeams.length >= 2 && venues && venues.length > 0) {
            log('Starting schedule generation');
            const gameRows: GameInsertRow[] = [];
            const duration = scheduleParams?.gameDuration || 90;
            const turnover = scheduleParams?.turnoverTime || 15;
            const gamesPerTeam = scheduleParams?.gamesPerTeam || 3;
            
            const scheduleStartStr = scheduleParams?.startDate || tournament.startDate || tournamentToday();
            const dayStartStr = scheduleParams?.startTime || '08:00';
            const dayEndStr = scheduleParams?.endTime || '20:30';

            const [startHour, startMin] = dayStartStr.split(':').map(Number);
            const [endHour, endMin] = dayEndStr.split(':').map(Number);
            const dailyLimitMinutes = (endHour * 60 + endMin) || (20 * 60 + 30);
            
            if (duration <= 0) {
              log('Error: Invalid game duration', duration);
              throw new Error('Invalid game duration');
            }

            let currentMinute = (startHour * 60 + startMin);
            let venueIdx = 0;
            let currentDayOffset = 0;
            const teamBusySlots = new Map<string, Set<string>>(); // teamId -> Set<date + time>

            for (const group of divisions) {
              const groupPools = group.pools || [];
              const groupTeams = allTeams.filter(t => t.division_id === group.id);
              if (groupTeams.length < 2) continue;

              log(`Seeding matches for ${group.name}...`);

              // We'll iterate through pools. If no pools, we treat it as one big pool.
              const poolsToProcess = groupPools.length > 0 ? groupPools : [{ id: null, name: 'General' }];
              const selectedPairs: [SeedTeam, SeedTeam][] = [];
              const teamGameCounts = new Map<string, number>();

              for (const pool of poolsToProcess) {
                const pTeams = pool.id 
                  ? groupTeams.filter(t => t.pool_id === pool.id)
                  : groupTeams;
                
                if (pTeams.length < 2) continue;

                log(`Pool ${pool.name || 'All'}: ${pTeams.length} teams`);

                // Generate limited matchups
                for (let i = 0; i < pTeams.length; i++) {
                  for (let j = i + 1; j < pTeams.length; j++) {
                    const t1 = pTeams[i];
                    const t2 = pTeams[j];
                    
                    const c1 = teamGameCounts.get(t1.id) || 0;
                    const c2 = teamGameCounts.get(t2.id) || 0;

                    if (c1 < gamesPerTeam && c2 < gamesPerTeam) {
                      selectedPairs.push([t1, t2]);
                      teamGameCounts.set(t1.id, c1 + 1);
                      teamGameCounts.set(t2.id, c2 + 1);
                    }
                  }
                }
              }

              // Shuffle pairs to spread them out naturally
              for (let i = selectedPairs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [selectedPairs[i], selectedPairs[j]] = [selectedPairs[j], selectedPairs[i]];
              }

              const lastTeamTime = new Map<string, number>();

              for (const [home, away] of selectedPairs) {
                let slotFound = false;
                let attempts = 0;

                while (!slotFound && attempts < 200) {
                  attempts++;
                  
                  if (currentMinute + duration > dailyLimitMinutes) {
                    currentDayOffset++;
                    currentMinute = (startHour * 60 + startMin);
                    venueIdx = 0;
                  }

                  const hour = Math.floor(currentMinute / 60);
                  const min = currentMinute % 60;
                  const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                  const venue = venues[venueIdx % venues.length];

                  const gameDate = new Date(scheduleStartStr + 'T12:00:00');
                  gameDate.setDate(gameDate.getDate() + currentDayOffset);
                  const dateStr = gameDate.toISOString().split('T')[0];
                  const timeKey = `${dateStr} ${timeStr}`;
                  const absoluteMinute = (currentDayOffset * 24 * 60) + currentMinute;

                  const isHomeBusy = teamBusySlots.get(home.id)?.has(timeKey);
                  const isAwayBusy = teamBusySlots.get(away.id)?.has(timeKey);
                  
                  // Back-to-back check: Must have at least ONE slot gap
                  // (currentMinute - lastTime) must be > (duration + turnover)
                  const lastH = lastTeamTime.get(home.id) ?? -9999;
                  const lastA = lastTeamTime.get(away.id) ?? -9999;
                  const hasGapH = absoluteMinute > lastH + (duration + turnover);
                  const hasGapA = absoluteMinute > lastA + (duration + turnover);

                  if (!isHomeBusy && !isAwayBusy && hasGapH && hasGapA) {
                    gameRows.push({
                      tournament_id: tid,
                      division_id: group.id,
                      home_team_id: home.id,
                      away_team_id: away.id,
                      game_date: dateStr,
                      game_time: timeStr,
                      location: venue.name,
                      diamond_id: venue.id,
                      status: effectiveSeedData.results ? 'completed' : 'scheduled',
                      home_score: effectiveSeedData.results ? Math.floor(Math.random() * 8) : null,
                      away_score: effectiveSeedData.results ? Math.floor(Math.random() * 8) : null
                    });

                    if (!teamBusySlots.has(home.id)) teamBusySlots.set(home.id, new Set());
                    if (!teamBusySlots.has(away.id)) teamBusySlots.set(away.id, new Set());
                    teamBusySlots.get(home.id)!.add(timeKey);
                    teamBusySlots.get(away.id)!.add(timeKey);
                    
                    lastTeamTime.set(home.id, absoluteMinute);
                    lastTeamTime.set(away.id, absoluteMinute);

                    slotFound = true;
                  }

                  venueIdx++;
                  if (venueIdx % venues.length === 0) {
                    currentMinute += (duration + turnover);
                  }
                }
              }
            }

            if (gameRows.length > 0) {
              log(`Inserting ${gameRows.length} games...`);
              const { error: gameError } = await supabase.from('games').insert(gameRows);
              if (gameError) log('Game Insert Error', gameError);
              else log('Games inserted successfully');
            } else {
              log('No games generated for any group');
            }
          } else {
            log('Skipping schedule seed: not enough teams/venues', {
              teamCount: allTeams?.length,
              venueCount: venues?.length
            });
          }
        }
      }
    }

    // 5. Announcement — part of the one step: a failed welcome takes the draft back too.
    if (announcement && typeof announcement.body === 'string' && announcement.body.trim()) {
      const { error: welcomeError } = await supabase.from('announcements').insert({
        tournament_id: tid,
        title: 'Welcome!',
        body: announcement.body.trim(),
        published_at: new Date().toISOString(),
        pinned: true
      });
      if (welcomeError) throw welcomeError;
    }

    return new Response(JSON.stringify({ success: true, id: tid, slug, name: tournamentName, debug }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: unknown) {
    console.error('Setup Tournament Error:', err);

    // Roll back the orphaned draft so a failed step (e.g. divisions insert)
    // doesn't leave a contentless tournament behind that blocks retries on the
    // name/slug uniqueness check.
    if (createdTournamentId) {
      try {
        const cleanupUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const cleanupKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (cleanupUrl && cleanupKey) {
          await createClient(cleanupUrl, cleanupKey)
            .from('tournaments')
            .delete()
            .eq('id', createdTournamentId)
            .eq('org_id', auth.org.id);
        }
      } catch (cleanupErr) {
        console.error('Setup Tournament cleanup failed:', cleanupErr);
      }
    }

    // Supabase/Postgrest errors are plain objects, not Error instances — pull
    // their message through so callers see the real cause, not a generic 500.
    const message =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Unknown server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}, { route: '/api/admin/setup-tournament' });
