/**
 * Correct coach-schedule event times that were stored as if the coach's wall clock were UTC.
 *
 * ── The defect (Chunk C, C0 / D-C1) ─────────────────────────────────────────────────────────
 * `rep_team_events.starts_at` is `timestamptz`, but every coach-side writer handed Postgres a
 * NAIVE literal (`2026-09-08T18:00`). Postgres resolved it in the session zone — UTC on Supabase —
 * so a coach's 6:00 PM was stored as 18:00Z and rendered back to them as 2:00 PM. Re-saving an
 * untouched event shifted it again, because the edit form converted UTC→local before the next
 * naive write. The Batch 4 tournament-game mirror wrote naive too, so organizer-owned games were
 * shifted by the same offset.
 *
 * The code is fixed (every write now goes through `zonedWallClockToUtc`). This script repairs the
 * rows written BEFORE that fix.
 *
 * ── Why this is a script and not a migration ────────────────────────────────────────────────
 * The population is not "every row": rows created by seeds and by the tournament schedule (which
 * always converted correctly) are ALREADY right, and shifting them would break them. Deciding
 * which is which needs judgement about live data, so it is a reviewed, dry-run-first operation the
 * owner runs with their eyes open — not something that fires silently during a deploy.
 *
 * ── How a row is identified ─────────────────────────────────────────────────────────────────
 * By PROVENANCE, not by guessing at the clock. EVERY coach-side writer was naive:
 *
 *   • the Add Event form and the recurrence generator  → naive. Affected.
 *   • the Batch 4 tournament-game mirror                → naive. Affected.
 *
 * So the default is "correct every row", and the dry run prints all of them so the owner can see
 * exactly what would move before anything does.
 *
 * ── The one safety catch ────────────────────────────────────────────────────────────────────
 * Dev fixtures (and any future importer that converts properly) DO store correct instants, and
 * correcting one of those would break it. The tell is that the correction pushes the time OUT of
 * a plausible window: a youth event starts between 06:00 and 21:00 local, so a row that would
 * land at 22:00 was already right. Those are SKIPPED and listed loudly for manual review.
 * `--force-all` overrides, and should essentially never be needed.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────────────────────
 *   node scripts/fix-coach-event-times.mjs                  DRY RUN (default) — prints, writes nothing
 *   node scripts/fix-coach-event-times.mjs --apply          actually writes
 *   node scripts/fix-coach-event-times.mjs --prod           read/write the PROD project
 *   node scripts/fix-coach-event-times.mjs --team <uuid>    limit to one team (for a QA rehearsal)
 *
 * ALWAYS dry-run first and read the counts. The output is the evidence the owner reviews.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

const APPLY = process.argv.includes('--apply');
const PROD = process.argv.includes('--prod');
const FORCE_ALL = process.argv.includes('--force-all');
const teamArgIndex = process.argv.indexOf('--team');
const TEAM_ID = teamArgIndex > -1 ? process.argv[teamArgIndex + 1] : null;

config({ path: PROD ? '.env.production.local' : '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const ORG_TIME_ZONE = 'America/Toronto';

/** Signed offset (minutes) of the zone vs UTC at an instant. Mirrors lib/timezone.ts. */
function tzOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = t => Number(parts.find(p => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asUTC - date.getTime()) / 60000;
}

/** The wall clock this instant renders as in the org's zone. */
function zonedHour(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORG_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = t => parts.find(p => p.type === t)?.value ?? '';
  const h = get('hour') === '24' ? '00' : get('hour');
  return { hour: Number(h), label: `${h}:${get('minute')}` };
}

/**
 * The corrected instant: the stored value's UTC wall clock was really the ORG's wall clock, so
 * re-resolve it in the org zone. Two passes so a DST boundary lands correctly, exactly as
 * `zonedWallClockToUtc` does.
 */
function correct(iso) {
  const naiveUtcMs = new Date(iso).getTime();
  const o1 = tzOffsetMinutes(new Date(naiveUtcMs));
  const c1 = naiveUtcMs - o1 * 60000;
  const o2 = tzOffsetMinutes(new Date(c1));
  return new Date(o1 === o2 ? c1 : naiveUtcMs - o2 * 60000).toISOString();
}

// A youth practice or game starts between these hours, org-local. Used ONLY as the safety catch
// described in the header — a correction that lands outside this window is refused, because that
// is the signature of a row that was already stored correctly.
const PLAUSIBLE_START = 6;   // 06:00 local
const PLAUSIBLE_END = 21;    // 21:00 local

async function main() {
  console.log(`\n${APPLY ? '⚠ APPLYING' : '🔍 DRY RUN'} · ${PROD ? 'PRODUCTION' : 'dev'}${TEAM_ID ? ` · team ${TEAM_ID}` : ''}\n`);

  let q = sb.from('rep_team_events')
    .select('id, team_id, name, event_type, starts_at, ends_at, source_tournament_game_id, source_basic_event_id')
    .order('starts_at', { ascending: true });
  if (TEAM_ID) q = q.eq('team_id', TEAM_ID);

  const { data: rows, error } = await q;
  if (error) { console.error('Read failed:', error.message); process.exit(1); }

  const toFix = [];
  const refused = [];

  for (const row of rows ?? []) {
    if (!row.starts_at) continue;
    const before = zonedHour(row.starts_at);
    const correctedIso = correct(row.starts_at);
    const after = zonedHour(correctedIso);
    const entry = { row, before, after, correctedIso };

    // Every coach-side writer was naive, so the default is to correct. The catch protects a row
    // that was already stored correctly — the correction would push it out of the plausible window.
    const afterPlausible = after.hour >= PLAUSIBLE_START && after.hour <= PLAUSIBLE_END;
    if (afterPlausible || FORCE_ALL) toFix.push(entry);
    else refused.push(entry);
  }

  const show = (label, list, limit = 40) => {
    console.log(`${label}: ${list.length}`);
    for (const e of list.slice(0, limit)) {
      const tag = e.row.source_tournament_game_id ? '[mirrored]' : e.row.source_basic_event_id ? '[from free portal]' : '';
      console.log(`   ${e.row.starts_at.slice(0, 10)}  ${e.before.label} → ${e.after.label}  ${tag} ${e.row.name}`);
    }
    if (list.length > limit) console.log(`   … ${list.length - limit} more`);
    console.log('');
  };

  show('✅ WILL BE CORRECTED', toFix);
  show(`⚠ REFUSED — the correction would land outside ${PLAUSIBLE_START}:00–${PLAUSIBLE_END}:00 local, which means these were ALREADY right. Review by hand`, refused);

  const mirrored = toFix.filter(e => e.row.source_tournament_game_id).length;
  console.log(`Totals: ${rows?.length ?? 0} rows · ${toFix.length} to correct (${mirrored} of them organizer-owned mirrors) · ${refused.length} refused\n`);

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply once these counts look right.\n');
    return;
  }
  if (!toFix.length) { console.log('Nothing to do.\n'); return; }

  let ok = 0;
  let failed = 0;
  for (const e of toFix) {
    const patch = { starts_at: e.correctedIso };
    if (e.row.ends_at) patch.ends_at = correct(e.row.ends_at);
    const { error: uErr } = await sb.from('rep_team_events').update(patch).eq('id', e.row.id);
    if (uErr) { failed += 1; console.error(`   ✗ ${e.row.id}: ${uErr.message}`); } else { ok += 1; }
  }
  console.log(`\nDone: ${ok} corrected, ${failed} failed.\n`);
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
