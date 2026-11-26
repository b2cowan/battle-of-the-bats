import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { FACILITY_TYPES, type FacilityType } from '@/lib/types';
import { canSaveVenueLibrary, canReadVenueLibrary, duplicateFacilityName, splitLockedRefusal, VENUE_LIBRARY_WORDS } from '@/lib/venue-library';
import { carryWordsForward, facilitiesBooked, facilitiesWithPartsBooked, readVenueUsage, venueIsBooked } from '@/lib/venue-library-server';
import { sectionsOf, type FieldSections } from '@/lib/field-parts';
import { readVenuePermits } from '@/lib/permit-server';
import { bookingsEmailProblem } from '@/lib/venue-library';
import { tournamentToday } from '@/lib/timezone';

// ---------------------------------------------------------------------------
// The club's Venue library (Club Tier Stage 6b, Ask 9 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, specimen 6)
//
// GET  /api/admin/org/venues?orgSlug=<slug>              — the ACTIVE venues with their facilities: what a picker
//                                                          offers (house league's Venue field, a tournament's Import
//                                                          from Library). An archived venue leaves every picker.
// GET  /api/admin/org/venues?orgSlug=<slug>&library=1    — the library page's read: every venue (archived too), what
//                                                          books each (`readVenueUsage`) and whether this reader saves.
// POST /api/admin/org/venues?orgSlug=<slug>              — the writes:
//   save-venue     — Add venue: the four things every "add a venue" asks (Name, Address, its facilities, Notes),
//                    nothing saved until the window's button is pressed (create asks).
//   update-venue   — the whole record, as the window's form autosaves it: name, address, notes and the facilities
//                    (renamed, re-kinded, reordered, added, removed). A rename reaches the UPCOMING bookings that link
//                    it, past ones keep their words, and no notice is sent (`carryWordsForward`).
//   archive-venue  — out of every picker; every booking keeps it.   restore-venue — Bring back.
//   delete-venue   — only when NOTHING books it, past included (S6-08: a delete strips every link it clears), and no
//                    permit holds time there (Club Tier 10a: a permit's block keeps its venue — archive it instead),
//                    no schedule holds time there, and no schedule's date off names it (mig 488).
//
// Club Tier Stage 10a (Asks 1, 7): the library read carries each venue's PERMITS (the permits that hold time there, each
// with only its blocks there — the window's Permits section; a permit's time reads to every library reader, its money
// never comes here), and a venue keeps its BOOKINGS CONTACT (`bookings_email`, optional, validated; Stage 11a's send
// uses it). A facility a permit's block names is renamed, never removed — the same rule as a booked one.
//
// Club schedules Stage 2 (mig 541, round 1 Ask 4 B, round 2 Ask 7 A): a field carries its SPLIT — not split, two sides, four
// quarters (`sections` 1 / 2 / 4) — on every write, and the library read says which fields have a booking still to come on
// one of their parts (`partsBooked`). Such a field's split is locked: a stale page's change is refused here, in words,
// before the database's own trigger would refuse it (`split_locked`, caught below as the same words).
//
// ⚖ THE SAVE RULE (Ask 9) is checked on EVERY write, once, here: the owner, an admin, a league admin, or anyone granted
// the tournament permission (`canSaveVenueLibrary`). Everyone else reads. A refusal says why, in words and a code, and
// the page shows it in the window — never a save that silently does nothing (D02). Since mig 321 this route is the
// ONLY writer (members' own sessions read; S6-10).
// ---------------------------------------------------------------------------

type VenueRow = { id: string; org_id: string; name: string; address: string | null; notes: string | null; is_active: boolean; bookings_email: string | null };
type FacilityRow = {
  id: string; org_venue_id: string; org_id: string; name: string; facility_type: string; display_order: number; notes: string | null;
  sections: number;
};

function mapOrgVenue(v: VenueRow, facilities: FacilityRow[]) {
  return {
    id:         v.id,
    orgId:      v.org_id,
    name:       v.name,
    address:    v.address ?? null,
    notes:      v.notes ?? null,
    bookingsEmail: v.bookings_email ?? null,
    isActive:   v.is_active,
    facilities: facilities.map(mapOrgFacility),
  };
}

function mapOrgFacility(f: FacilityRow) {
  return {
    id:           f.id,
    orgVenueId:   f.org_venue_id,
    orgId:        f.org_id,
    name:         f.name,
    facilityType: f.facility_type,
    displayOrder: f.display_order,
    notes:        f.notes ?? null,
    sections:     sectionsOf(f.sections),
  };
}

/** The club's venues with their facilities in the club's order — every venue, the active ones only, or one (a write's answer). */
async function readVenues(orgId: string, which: { withArchived: boolean; venueId?: string }) {
  let q = supabaseAdmin.from('org_venues').select('*').eq('org_id', orgId).order('name', { ascending: true });
  if (which.venueId) q = q.eq('id', which.venueId);
  else if (!which.withArchived) q = q.eq('is_active', true);
  const { data: venues, error: vErr } = await q;
  if (vErr) throw vErr;
  const venueIds = (venues ?? []).map(v => v.id);
  const facilityByVenue: Record<string, FacilityRow[]> = {};
  if (venueIds.length > 0) {
    const { data: facData, error: fErr } = await supabaseAdmin
      .from('org_venue_facilities')
      .select('*')
      .in('org_venue_id', venueIds)
      .order('display_order', { ascending: true });
    if (fErr) throw fErr;
    for (const f of (facData ?? []) as FacilityRow[]) (facilityByVenue[f.org_venue_id] ??= []).push(f);
  }
  return ((venues ?? []) as VenueRow[]).map(v => mapOrgVenue(v, facilityByVenue[v.id] ?? []));
}

/** The library's read (and a write's answer): each split field says whether a part is booked, so its split is locked. */
async function withPartsBooked<V extends { facilities: { id: string; sections: FieldSections }[] }>(venues: V[]): Promise<V[]> {
  const split = venues.flatMap(v => v.facilities.filter(f => f.sections !== 1).map(f => f.id));
  if (!split.length) return venues;
  const booked = await facilitiesWithPartsBooked(split);
  return venues.map(v => ({ ...v, facilities: v.facilities.map(f => ({ ...f, partsBooked: booked.has(f.id) })) }));
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withObservability(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;

  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // The Venue library is a League Plus / Club feature (the page, the rail row and the Organization tile gate on it).
  if (!hasOrgVenueLibrary(ctx.org.planId)) return forbidden();

  try {
    if (searchParams.get('library') !== '1') {
      // The pickers' list — a coaching-staff login reads it too, so the venue's bookings contact stays off it (Ask 7).
      const venues = await readVenues(ctx.org.id, { withArchived: false });
      return NextResponse.json(venues.map(v => ({ ...v, bookingsEmail: undefined })));
    }
    // The library page: archived venues too, what books each, and whether this reader may save. A failed usage read
    // fails the whole read — the page never offers Delete on a venue whose bookings it could not count. ⚠ What books
    // each venue names the club's teams, seasons and tournaments: the club's people read it, a coaching-staff login
    // (role `coach`, which opens nothing of the club's) does not — its picker reads the plain list above (/review 6b).
    // ⚖ Trust close-out 2 (owner 2026-11-18): the library page — bookings contacts, what books each venue, the permits
    // holding time there — reads only for those who schedule, run tournaments or handle money (`canReadVenueLibrary`).
    if (!canReadVenueLibrary(ctx, ctx.org)) return forbidden();
    const venues = await readVenues(ctx.org.id, { withArchived: true });
    const [split, usage, permits] = await Promise.all([
      // Which split fields have a part booked: their split select is locked (mig 541). A failure fails the read, as usage's
      // does — the page never offers a split change it would refuse.
      withPartsBooked(venues),
      readVenueUsage(ctx.org.id, venues.map(v => ({ id: v.id, facilityIds: (v.facilities ?? []).map(f => f.id) }))),
      // The permits that hold time at each venue are the window's quiet section: a failed read leaves it empty and the
      // library stands (never a page that won't load over a permit).
      readVenuePermits(ctx.org.id, venues.map(v => v.id), tournamentToday())
        .catch(e => { console.error('[venues] the permits read failed (the library stands):', e); return {}; }),
    ]);
    return NextResponse.json({ venues: split, usage, permits, canSave: canSaveVenueLibrary(ctx.role, ctx.capabilities) });
  } catch (err) {
    return captureAndJson(err, { error: VENUE_LIBRARY_WORDS.loadFailed, code: 'load_failed' }, 500);
  }
}, { route: '/api/admin/org/venues' });

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

type FacilityDraft = { id?: string | null; key?: string; name?: unknown; facilityType?: unknown; sections?: unknown };

const text = (v: unknown): string | null => (typeof v === 'string' ? v.trim() || null : null);
const kindOf = (v: unknown): FacilityType => (FACILITY_TYPES.includes(v as FacilityType) ? (v as FacilityType) : 'other');

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  // A14 (Club Tier Stage 1): every refusal says WHY, with a code — the page used to swallow a bare "Forbidden".
  if (!hasOrgVenueLibrary(ctx.org.planId)) {
    return venueRefusal(403, 'plan_lacks_venue_library', VENUE_LIBRARY_WORDS.planLocked);
  }
  // ⚖ THE SAVE RULE, on every write (Ask 9; D02).
  if (!canSaveVenueLibrary(ctx.role, ctx.capabilities)) {
    return venueRefusal(403, 'no_venue_permission', 'Your role can’t change the Venue library. Ask your club’s owner or an admin.');
  }
  const orgId = ctx.org.id;

  try {
    const { action, id, data } = await req.json();

    // -- save-venue: Add venue (create asks) --------------------------------
    if (action === 'save-venue') {
      const name = text(data?.name);
      if (!name) return venueRefusal(400, 'name_required', 'Give the venue a name.');
      const facilities = (Array.isArray(data?.facilities) ? data.facilities as FacilityDraft[] : [])
        .map(f => ({ name: text(f.name), facilityType: kindOf(f.facilityType), sections: sectionsOf(f.sections) }))
        .filter((f): f is { name: string; facilityType: FacilityType; sections: FieldSections } => !!f.name);
      const twice = duplicateFacilityName(facilities.map(f => f.name));
      if (twice) return venueRefusal(400, 'facility_name_taken', `Two facilities can’t both be called “${twice}”.`);
      const bookingsEmail = text(data?.bookingsEmail);
      const emailProblem = bookingsEmailProblem(bookingsEmail);
      if (emailProblem) return venueRefusal(400, 'bookings_email', emailProblem);
      const { data: venue, error } = await supabaseAdmin.from('org_venues').insert({
        org_id: orgId, name, address: text(data?.address), notes: text(data?.notes), bookings_email: bookingsEmail, is_active: true,
      }).select('*').single();
      if (error) throw error;
      if (facilities.length) {
        const { error: fErr } = await supabaseAdmin.from('org_venue_facilities').insert(facilities.map((f, i) => ({
          org_venue_id: venue.id, org_id: orgId, name: f.name, facility_type: f.facilityType, display_order: i, sections: f.sections,
        })));
        if (fErr) {
          // The venue alone would be a half-added record: take it back and say so.
          await supabaseAdmin.from('org_venues').delete().eq('id', venue.id).eq('org_id', orgId);
          throw fErr;
        }
      }
      const [saved] = await readVenues(orgId, { withArchived: true, venueId: venue.id });
      return NextResponse.json({ success: true, venue: saved });
    }

    // Every other action names one of THIS club's venues (supabaseAdmin bypasses row security: this is the tenant wall).
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('org_venues').select('id, org_id, name, address, notes, is_active').eq('id', id).maybeSingle();
    if (exErr) throw exErr;
    if (!existing || existing.org_id !== orgId) return notInLibrary();

    // -- update-venue: the whole record, autosaved -------------------------
    if (action === 'update-venue') {
      const name = text(data?.name);
      if (!name) return venueRefusal(400, 'name_required', VENUE_LIBRARY_WORDS.nameHeld);
      const address = text(data?.address);
      const notes = text(data?.notes);
      // Absent from an older page's save = keep what is stored (never cleared by a save that didn't send it).
      const sendsEmail = !!data && typeof data === 'object' && 'bookingsEmail' in data;
      const bookingsEmail = sendsEmail ? text(data.bookingsEmail) : undefined;
      const emailProblem = bookingsEmailProblem(bookingsEmail ?? null);
      if (emailProblem) return venueRefusal(400, 'bookings_email', emailProblem);
      const drafts = Array.isArray(data?.facilities) ? data.facilities as FacilityDraft[] : null;

      const { data: storedFacs, error: sfErr } = await supabaseAdmin
        .from('org_venue_facilities').select('id, name, facility_type, display_order, sections').eq('org_venue_id', id).eq('org_id', orgId);
      if (sfErr) throw sfErr;
      const stored = new Map((storedFacs ?? []).map(f => [f.id as string, f as { id: string; name: string; facility_type: string; display_order: number; sections: number }]));

      // Validate the whole draft before writing any of it, so a refused save changes nothing.
      let renamedFacilityIds: string[] = [];
      type Kept = { id: string; name: string; kind: FacilityType; order: number; sections: FieldSections };
      let plan: { keep: Kept[]; add: { key: string; name: string; kind: FacilityType; order: number; sections: FieldSections }[]; remove: string[] } | null = null;
      if (drafts) {
        const rows = drafts.map((f, order) => {
          const fid = typeof f.id === 'string' && f.id ? f.id : null;
          // Absent from an older page's save, or not one of 1 / 2 / 4 = keep the stored split (never unsplit by a save that
          // didn't send a real choice; /review 2026-11-25).
          const sent = f.sections === 1 || f.sections === 2 || f.sections === 4 ? f.sections : null;
          const sections = sent ?? (fid && stored.has(fid) ? sectionsOf(stored.get(fid)!.sections) : 1);
          return { id: fid, key: typeof f.key === 'string' ? f.key : '', name: text(f.name), kind: kindOf(f.facilityType), order, sections };
        });
        if (rows.some(r => r.id && !stored.has(r.id))) return notInLibrary();
        const ids = rows.flatMap(r => (r.id ? [r.id] : []));
        if (new Set(ids).size !== ids.length) return venueRefusal(400, 'facility_twice', 'A facility is listed twice. Reload the page.');
        if (rows.some(r => r.id && !r.name)) return venueRefusal(400, 'facility_name_required', VENUE_LIBRARY_WORDS.facilityNameHeld);
        const named = rows.filter(r => r.name);
        const twice = duplicateFacilityName(named.map(r => r.name!));
        if (twice) return venueRefusal(400, 'facility_name_taken', `Two facilities can’t both be called “${twice}”.`);
        const keptIds = new Set(rows.flatMap(r => (r.id ? [r.id] : [])));
        const remove = [...stored.keys()].filter(fid => !keptIds.has(fid));
        // ⚖ A facility a booking holds is renamed, never removed (Ask 9). The window offers no ✕ on one; this is the race.
        if (remove.length) {
          const booked = await facilitiesBooked(orgId, remove);
          const first = remove.find(fid => booked.has(fid));
          if (first) {
            return venueRefusal(409, 'facility_in_use', `${stored.get(first)!.name} has bookings, so it can be renamed but not removed.`);
          }
          // A facility a permit's block names is held time (Club Tier 10a): renamed, never removed. So is one a club
          // schedule holds (Club Tier 11a: its block names it, or one of its slots stands on it).
          const [{ data: held, error: hErr }, { data: slotted, error: sErr }] = await Promise.all([
            supabaseAdmin.from('org_time_block_facilities').select('facility_id, org_time_blocks!inner(permit_id)')
              .eq('org_id', orgId).in('facility_id', remove).limit(1),
            supabaseAdmin.from('club_schedule_slots').select('facility_id').eq('org_id', orgId).in('facility_id', remove).limit(1),
          ]);
          if (hErr) throw hErr;
          if (sErr) throw sErr;
          if (held?.length) {
            const byPermit = !!(held[0].org_time_blocks as { permit_id?: string | null } | null)?.permit_id;
            return byPermit
              ? venueRefusal(409, 'facility_in_permit', `${stored.get(held[0].facility_id as string)?.name ?? 'That facility'} is held by a permit, so it can be renamed but not removed.`)
              : venueRefusal(409, 'facility_in_schedule', `${stored.get(held[0].facility_id as string)?.name ?? 'That facility'} is in one of the club’s schedules, so it can be renamed but not removed.`);
          }
          if (slotted?.length) {
            return venueRefusal(409, 'facility_in_schedule', `${stored.get(slotted[0].facility_id as string)?.name ?? 'That facility'} is in one of the club’s schedules, so it can be renamed but not removed.`);
          }
        }
        // ⚖ A split is locked while a booking still to come names one of its parts (round 2 Ask 7 A; any change, not only
        // lowering). The window locks the select; this is the race, said in the window's own line.
        const resplit = rows.filter(r => r.id && sectionsOf(stored.get(r.id)!.sections) !== r.sections).map(r => r.id!);
        if (resplit.length) {
          const locked = await facilitiesWithPartsBooked(resplit);
          const first = resplit.find(fid => locked.has(fid));
          if (first) {
            const s = stored.get(first)!;
            return venueRefusal(409, 'split_locked', splitLockedRefusal(s.name, sectionsOf(s.sections)));
          }
        }
        plan = {
          keep: rows.filter(r => r.id).map(r => ({ id: r.id!, name: r.name!, kind: r.kind, order: r.order, sections: r.sections })),
          // A new row with no name yet is still being typed: it waits for its name (the form holds nothing on it).
          add: rows.filter(r => !r.id && r.name).map(r => ({ key: r.key, name: r.name!, kind: r.kind, order: r.order, sections: r.sections })),
          remove,
        };
        renamedFacilityIds = plan.keep.filter(k => stored.get(k.id)!.name !== k.name).map(k => k.id);
      }

      // FIRST the rename reaches the upcoming bookings that link the venue — with the names this save writes — and only then
      // the library's own rows (see `carryWordsForward`: a failure in between must leave the change for the retry to see).
      const carried = await carryWordsForward(orgId, id, {
        name, address,
        facilities: plan ? plan.keep.map(k => ({ id: k.id, name: k.name })) : [...stored.values()].map(f => ({ id: f.id, name: f.name })),
      }, { venueName: existing.name !== name, address: (existing.address ?? null) !== address, facilityIds: renamedFacilityIds });

      const created: Record<string, string> = {};
      if (plan) {
        if (plan.remove.length) {
          const { error } = await supabaseAdmin.from('org_venue_facilities').delete().in('id', plan.remove).eq('org_id', orgId);
          if (error) throw error;
        }
        // The changed facilities, together (each row its own); the new ones in one insert, matched back to their rows by
        // name (unique within the venue, checked above).
        const changed = plan.keep.filter(k => {
          const s = stored.get(k.id)!;
          return s.name !== k.name || s.facility_type !== k.kind || s.display_order !== k.order || sectionsOf(s.sections) !== k.sections;
        });
        // `sections` only when it changed: the split lock's trigger fires on any write of the column.
        const resplitPatch = (k: Kept) => (sectionsOf(stored.get(k.id)!.sections) !== k.sections ? { sections: k.sections } : {});
        const updates = await Promise.all(changed.map(k => supabaseAdmin.from('org_venue_facilities')
          .update({ name: k.name, facility_type: k.kind, display_order: k.order, ...resplitPatch(k) }).eq('id', k.id).eq('org_id', orgId)));
        for (const u of updates) if (u.error) throw u.error;
        if (plan.add.length) {
          const { data: rows, error } = await supabaseAdmin.from('org_venue_facilities').insert(plan.add.map(a => ({
            org_venue_id: id, org_id: orgId, name: a.name, facility_type: a.kind, display_order: a.order, sections: a.sections,
          }))).select('id, name');
          if (error) throw error;
          const idByName = new Map(((rows ?? []) as { id: string; name: string }[]).map(r => [r.name, r.id]));
          for (const a of plan.add) if (a.key && idByName.has(a.name)) created[a.key] = idByName.get(a.name)!;
        }
      }

      // The venue's own row last: until it is written, a retry still sees the rename (and carries it again).
      const { error: uErr } = await supabaseAdmin.from('org_venues')
        .update({ name, address, notes, ...(bookingsEmail !== undefined ? { bookings_email: bookingsEmail } : {}), updated_at: new Date().toISOString() })
        .eq('id', id).eq('org_id', orgId);
      if (uErr) throw uErr;
      const [venue] = await withPartsBooked(await readVenues(orgId, { withArchived: true, venueId: id }));
      return NextResponse.json({ success: true, venue, created, carried });
    }

    // -- archive-venue / restore-venue -------------------------------------
    if (action === 'archive-venue' || action === 'restore-venue') {
      const { error } = await supabaseAdmin.from('org_venues')
        .update({ is_active: action === 'restore-venue', updated_at: new Date().toISOString() }).eq('id', id).eq('org_id', orgId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- delete-venue: only when nothing books it ---------------------------
    if (action === 'delete-venue') {
      // ⚖ Past bookings included (S6-08): every link a delete would clear is ON DELETE SET NULL, so a booked venue is
      // archived instead — refused here even if a stale page still offers Delete.
      if (await venueIsBooked(orgId, id)) {
        return venueRefusal(409, 'venue_in_use', `${existing.name} has bookings, so it can be archived but not deleted.`);
      }
      // A permit's block keeps its venue (Club Tier 10a): archive it instead. So does a club schedule's (Club Tier 11a: its
      // block, or a slot standing on it).
      // A date off that names the venue keeps it too (mig 488's FK is NO ACTION: "no parks named" is All venues, so a delete
      // that took its last park would widen the date off to every park).
      const [{ count: heldBy, error: pErr }, { count: scheduled, error: sErr }, { count: slotted, error: tErr }, { count: offNamed, error: oErr }] = await Promise.all([
        supabaseAdmin.from('org_time_blocks').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('org_venue_id', id).not('permit_id', 'is', null),
        supabaseAdmin.from('org_time_blocks').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('org_venue_id', id).not('schedule_id', 'is', null),
        supabaseAdmin.from('club_schedule_slots').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('org_venue_id', id),
        supabaseAdmin.from('org_time_date_off_venues').select('date_off_id', { count: 'exact', head: true }).eq('org_id', orgId).eq('org_venue_id', id),
      ]);
      if (pErr) throw pErr;
      if (sErr) throw sErr;
      if (tErr) throw tErr;
      if (oErr) throw oErr;
      if ((heldBy ?? 0) > 0) {
        return venueRefusal(409, 'venue_in_permit', `A permit holds time at ${existing.name}, so it can be archived but not deleted.`);
      }
      if ((scheduled ?? 0) + (slotted ?? 0) > 0) {
        return venueRefusal(409, 'venue_in_schedule', `One of the club’s schedules holds time at ${existing.name}, so it can be archived but not deleted.`);
      }
      if ((offNamed ?? 0) > 0) {
        return venueRefusal(409, 'venue_in_date_off', `A date off on one of the club’s schedules names ${existing.name}, so it can be archived but not deleted.`);
      }
      // org_venue_facilities cascade via FK.
      const { error } = await supabaseAdmin.from('org_venues').delete().eq('id', id).eq('org_id', orgId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    // The split lock's trigger (mig 541): a part was booked between the check above and the write. The same words.
    if (/\bsplit_locked\b/.test((err as { message?: string } | null)?.message ?? '')) {
      return venueRefusal(409, 'split_locked', 'A part of that field was just booked, so its split stays as it is. Reload the page.');
    }
    // A supabase-js error is a plain object, not an `Error`, so every database failure used to come back as "Unknown
    // server error" with the cause thrown away. Record the real one; tell the person what happened in words.
    return captureAndJson(err, { error: 'We couldn’t save that just now. Try again.', code: 'save_failed' }, 500);
  }
}, { route: '/api/admin/org/venues' });

function venueRefusal(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

function notInLibrary() {
  return venueRefusal(404, 'not_in_library', 'That isn’t in your Venue library any more. Reload the page.');
}
