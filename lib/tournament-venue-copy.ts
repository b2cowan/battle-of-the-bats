/**
 * EVERY WAY A VENUE REACHES A TOURNAMENT, WITH ITS DIAMONDS (Tournament admin redesign Stage 5 — F77, A51, 6a's F2).
 * Server-only (supabaseAdmin). One home, so no copy path can drop a park's lanes or its library link again:
 *
 *   createTournamentVenue  — a new venue with a count: its lanes named "Diamond 1…N" in the sport's word, never
 *                            "Park — Diamond 1", and one lane "Diamond 1", never the park's name (F77);
 *   copyLibraryVenue       — the club's Venue library venue, its facilities and BOTH library links; a second import of
 *                            the same venue returns the copy already there (6a's S6-04 rule);
 *   copyPastVenue          — a venue a past event used ("your venues"), its facilities and any library links;
 *   copyTournamentVenues   — every venue of one tournament into another (the clone; "into this draft") — until Stage 5
 *                            the clone copied venues and NONE of their facilities (6a's F2), so the demo's Invitational
 *                            held Riverdale Community Park with zero diamonds.
 *
 * Multi-tenant: a library venue and a past venue are proved to be THIS org's before anything is copied (supabaseAdmin
 * bypasses RLS, so the proof is here or nowhere). The target tournament is the caller's to prove.
 */
import { supabaseAdmin } from './supabase-admin';
import { clampFacilityCount, facilityNames } from './venue-facilities';
import { FACILITY_TYPES, type FacilityType } from './types';

type FacilityRow = {
  id: string;
  venue_id: string;
  name: string;
  facility_type: string | null;
  display_order: number | null;
  notes: string | null;
  source_org_facility_id?: string | null;
};

export type NewVenueInput = {
  name: string;
  address?: string | null;
  notes?: string | null;
  count: number;
  facilityType: FacilityType;
};

const kindOf = (v: unknown): FacilityType => (FACILITY_TYPES.includes(v as FacilityType) ? (v as FacilityType) : 'other');
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A new tournament venue and its N lanes, named in the sport's word. Throws on any failed write. */
export async function createTournamentVenue(tournamentId: string, input: NewVenueInput): Promise<{ venueId: string; lanes: number }> {
  const name = text(input.name);
  if (!name) throw new Error('Give the venue a name.');
  const kind = kindOf(input.facilityType);
  const { data: venue, error } = await supabaseAdmin.from('diamonds').insert({
    tournament_id: tournamentId,
    name,
    address: text(input.address),
    notes: text(input.notes),
  }).select('id').single();
  if (error || !venue) throw error ?? new Error('The venue could not be saved.');
  const names = facilityNames(clampFacilityCount(input.count), kind);
  const { error: fErr } = await supabaseAdmin.from('venue_facilities').insert(names.map((laneName, i) => ({
    venue_id: venue.id,
    tournament_id: tournamentId,
    name: laneName,
    facility_type: kind,
    display_order: i,
  })));
  if (fErr) {
    // The venue alone would be a park with no lane — take it back so the caller's retry starts clean.
    await supabaseAdmin.from('diamonds').delete().eq('id', venue.id);
    throw fErr;
  }
  return { venueId: venue.id, lanes: names.length };
}

async function insertFacilities(venueId: string, tournamentId: string, facilities: readonly FacilityRow[], keepSourceLink: boolean, fromLibrary = false) {
  if (!facilities.length) return;
  const { error } = await supabaseAdmin.from('venue_facilities').insert(facilities.map(f => ({
    venue_id: venueId,
    tournament_id: tournamentId,
    name: f.name,
    facility_type: kindOf(f.facility_type),
    display_order: f.display_order ?? 0,
    notes: f.notes ?? null,
    // The facility's library link is what makes a game on it an exact clash (S6-04): a library facility's own id, or the
    // link a past copy already carried.
    source_org_facility_id: fromLibrary ? f.id : keepSourceLink ? f.source_org_facility_id ?? null : null,
  })));
  if (error) throw error;
}

/**
 * The club's library venue into a tournament: its facilities with both links. A venue already copied into this
 * tournament is returned as it is (`existing`), never a second copy. `null` = not this org's library venue.
 */
export async function copyLibraryVenue(tournamentId: string, orgId: string, orgVenueId: string): Promise<{ venueId: string; existing: boolean } | null> {
  const { data: ov, error } = await supabaseAdmin
    .from('org_venues').select('id, org_id, name, address, notes, org_venue_facilities(*)').eq('id', orgVenueId).maybeSingle();
  if (error) throw error;
  if (!ov || ov.org_id !== orgId) return null;
  const { data: already, error: aErr } = await supabaseAdmin
    .from('diamonds').select('id').eq('tournament_id', tournamentId).eq('source_org_venue_id', orgVenueId)
    .order('name', { ascending: true }).limit(1).maybeSingle();
  if (aErr) throw aErr;
  if (already) return { venueId: already.id, existing: true };
  const { data: venue, error: vErr } = await supabaseAdmin.from('diamonds').insert({
    tournament_id: tournamentId,
    name: ov.name,
    address: ov.address ?? null,
    notes: ov.notes ?? null,
    source_org_venue_id: orgVenueId,
  }).select('id').single();
  if (vErr || !venue) throw vErr ?? new Error('The venue could not be copied.');
  const facilities = ((ov.org_venue_facilities ?? []) as FacilityRow[])
    .slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  try {
    await insertFacilities(venue.id, tournamentId, facilities, false, true);
  } catch (e) {
    await supabaseAdmin.from('diamonds').delete().eq('id', venue.id);
    throw e;
  }
  return { venueId: venue.id, existing: false };
}

/**
 * A past event's venue into a tournament, with its facilities and any library links. `null` = not this org's venue, or
 * (for a member limited to certain tournaments — `allowedTournamentIds`, null = unrestricted) not one of theirs: the
 * list ("your venues") never offers it, and the copy refuses it by id too.
 */
export async function copyPastVenue(
  tournamentId: string, orgId: string, sourceVenueId: string, allowedTournamentIds: readonly string[] | null = null,
): Promise<{ venueId: string } | null> {
  const { data: src, error } = await supabaseAdmin
    .from('diamonds').select('id, tournament_id, name, address, notes, source_org_venue_id, tournaments!inner(org_id)')
    .eq('id', sourceVenueId).maybeSingle();
  if (error) throw error;
  const owner = src ? (Array.isArray(src.tournaments) ? src.tournaments[0] : src.tournaments) as { org_id: string } | null : null;
  if (!src || owner?.org_id !== orgId) return null;
  if (allowedTournamentIds !== null && !allowedTournamentIds.includes(src.tournament_id as string)) return null;
  const { data: venue, error: vErr } = await supabaseAdmin.from('diamonds').insert({
    tournament_id: tournamentId,
    name: src.name,
    address: src.address ?? null,
    notes: src.notes ?? null,
    // The club-library link travels with the copy (S6-04): the source is this org's own (proved above).
    source_org_venue_id: src.source_org_venue_id ?? null,
  }).select('id').single();
  if (vErr || !venue) throw vErr ?? new Error('The venue could not be copied.');
  const { data: facilities, error: fErr } = await supabaseAdmin
    .from('venue_facilities').select('*').eq('venue_id', sourceVenueId).order('display_order', { ascending: true });
  try {
    if (fErr) throw fErr;
    await insertFacilities(venue.id, tournamentId, (facilities ?? []) as FacilityRow[], true);
  } catch (e) {
    await supabaseAdmin.from('diamonds').delete().eq('id', venue.id);
    throw e;
  }
  return { venueId: venue.id };
}

/**
 * Every venue of one tournament into another, each with its facilities and both library links (the clone, and
 * Stage 5's "into this draft"). Both tournaments must be the same org's — the caller reads them by org. Returns the
 * ids written, so an all-or-nothing caller can take them back. Throws on any failed write.
 */
export async function copyTournamentVenues(sourceTournamentId: string, targetTournamentId: string): Promise<{ venueIds: string[] }> {
  const { data: venues, error } = await supabaseAdmin
    .from('diamonds').select('*').eq('tournament_id', sourceTournamentId).order('name', { ascending: true });
  if (error) throw error;
  if (!venues?.length) return { venueIds: [] };
  // One insert per venue (a handful), so each copy's id is ITS venue's — never paired by the position a multi-row
  // insert happens to return its rows in.
  const venueIds: string[] = [];
  const idMap = new Map<string, string>();
  for (const v of venues) {
    const { data: row, error: insErr } = await supabaseAdmin.from('diamonds').insert({
      tournament_id: targetTournamentId,
      name: v.name,
      address: v.address ?? null,
      notes: v.notes ?? null,
      source_org_venue_id: v.source_org_venue_id ?? null,
    }).select('id').single();
    if (insErr || !row) throw insErr ?? new Error('A venue could not be copied.');
    venueIds.push(row.id as string);
    idMap.set(v.id as string, row.id as string);
  }
  const { data: facilities, error: fErr } = await supabaseAdmin
    .from('venue_facilities').select('*').in('venue_id', venues.map(v => v.id)).order('display_order', { ascending: true });
  if (fErr) throw fErr;
  const rows = ((facilities ?? []) as FacilityRow[]).filter(f => idMap.has(f.venue_id)).map(f => ({
    venue_id: idMap.get(f.venue_id)!,
    tournament_id: targetTournamentId,
    name: f.name,
    facility_type: kindOf(f.facility_type),
    display_order: f.display_order ?? 0,
    notes: f.notes ?? null,
    source_org_facility_id: f.source_org_facility_id ?? null,
  }));
  if (rows.length) {
    const { error: insFacErr } = await supabaseAdmin.from('venue_facilities').insert(rows);
    if (insFacErr) throw insFacErr;
  }
  return { venueIds };
}
