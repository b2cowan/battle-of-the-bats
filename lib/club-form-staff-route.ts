import 'server-only';
import { getLeagueSeasonById } from './db';
import { supabaseAdmin } from './supabase-admin';
import { isUuid } from './utils';
import { STAFF_REG_COLS, type StaffRegRow } from './club-form-staff';

/**
 * Behind the staff answer routes (Board Ready Stage 4 Part 3, ruling 6). Each route asks `houseLeagueRefusal(ctx, 'read')`
 * itself — the seats that open Registrations, the action the list and the record already use — and, for a write, again
 * with the season (tests/unit/house-league-gate-guard.test.ts reads every handler). A treasurer, a coach and every other
 * seat get the gate's refusal, never "Not shared". These two only read: this club's season, and its registration.
 */
export async function staffSeason(orgId: string, seasonId: string) {
  return isUuid(seasonId) ? getLeagueSeasonById(seasonId, orgId) : null;
}

/** This season's registration, as the staff readers need it, or null. */
export async function seasonRegistration(seasonId: string, regId: string): Promise<StaffRegRow | null> {
  if (!isUuid(regId)) return null;
  const { data, error } = await supabaseAdmin.from('league_registrations')
    .select(STAFF_REG_COLS).eq('id', regId).eq('season_id', seasonId).maybeSingle();
  if (error) throw error;
  return data as StaffRegRow | null;
}
