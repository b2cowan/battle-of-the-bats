/**
 * ONE FULLY FILLED PLAYER on the UAT fixture (phone re-evaluation stage 5 · People, 2026-09-23).
 *
 * ⚠ WHY THIS EXISTS. Read from the database on 2026-09-22: all twelve fixture players had an EMPTY
 * record — no date of birth, no Best or Never positions, no bats, throws or jersey size, and the one
 * pitching profile carried a cap with no rank. So the player page measured at 2,111px with 21
 * sub-floor controls was the EMPTY one, the read face the stage lands could not be seen at all
 * (eight dashes in a row), and a sweep of it re-measured the same blank screen. This is
 * `COACH_TOUCH_TARGET_DEBT_PLAN.md`'s warning running verbatim: "an empty screen also hides RED".
 *
 * ⚠ DEVON, not any other player: Devon Test is the player the layout sweep opens
 * (`receiptPlayerId` in `uat-fixture-context.mjs`), so filling Devon is what makes the sweep's five
 * player screens — and the two edit-state screens stage 5 adds — measure a real record.
 *
 * ASSERTED on every run, not inserted once: a QA walk edits this record through the product, and a
 * re-seed puts it back to the shape the walk expects. Positions go through the product's OWN write
 * builder (`buildLineupProfileWrite`), so the stored triplet is byte-for-byte what a Save produces —
 * a hand-typed profile is how a fixture drifts from the shape the app reads.
 *
 * Side effect, stated: Devon now pitches (rank 2, 2-inning cap), so the fixture's lineup auto-fill
 * has a second arm. Avery's arm-care override (cap 1, the warning) is untouched.
 */
import { buildLineupProfileWrite } from '../../lib/lineup-profile.ts';

/** The filled record, in the product's own vocabulary. Contact details are fictional (555-01xx). */
export const FILLED_PLAYER = {
  firstName: 'Devon',
  dateOfBirth: '2013-03-14',
  best: ['2B', 'SS'],
  never: ['C'],
  pitcher: { rank: 2, maxInnings: 2 },
  bats: 'R',
  throws: 'R',
  jerseySize: 'YL',
  guardian: { first: 'Dana', last: 'Test', email: 'dana.test@example.com', phone: '(905) 555-0142' },
  medicalNotes: 'Peanut allergy — EpiPen in the kit bag.',
  emergency: { name: 'Sam Test', phone: '(905) 555-0143' },
};

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ programYearId: string }} where
 * @returns {Promise<string>} the filled player's id
 */
export async function fillPlayerRecord(db, { programYearId }) {
  const f = FILLED_PLAYER;
  const { data: row, error } = await db.from('rep_roster_players').select('id')
    .eq('program_year_id', programYearId).eq('player_first_name', f.firstName).eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`filled player lookup failed: ${error.message}`);
  if (!row) throw new Error(`no active player "${f.firstName}" on the live season to fill`);

  /* The vocabulary the builder validates against is the codes written here plus the mound.
     `lib/sports.ts` cannot load under plain Node (it imports a directory), and these codes are the
     schema's fixed diamond domain (see the lineup block in the seeder) — so the builder still does
     the real work: the Best/Never split, Never winning, the primary/secondary columns. */
  const write = buildLineupProfileWrite(
    { preferred: f.best, never: f.never, pitcher: f.pitcher, aSquad: false },
    [...f.best, ...f.never, 'P'], 'P',
  );
  const upd = await db.from('rep_roster_players').update({
    player_date_of_birth: f.dateOfBirth,
    primary_position: write.primaryPosition,
    secondary_position: write.secondaryPosition,
    lineup_profile: write.lineupProfile,
    bats: f.bats, throws: f.throws, jersey_size: f.jerseySize,
    guardian_first_name: f.guardian.first, guardian_last_name: f.guardian.last,
    guardian_email: f.guardian.email, guardian_phone: f.guardian.phone,
    medical_notes: f.medicalNotes,
    emergency_contact_name: f.emergency.name, emergency_contact_phone: f.emergency.phone,
  }).eq('id', row.id);
  if (upd.error) throw new Error(`filled player update failed: ${upd.error.message}`);
  return row.id;
}
