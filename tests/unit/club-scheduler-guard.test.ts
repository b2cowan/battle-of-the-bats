import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { functionBody, readCode, readSource } from './_source-code.ts';
import { hasPlanFeature, requiresPlanCopy, requiresTournamentPlusCopy } from '../../lib/plan-features.ts';
import { CLUB_OWNED_API_FIELDS, CLUB_SLOT_REFUSALS } from '../../lib/club-slot-event.ts';
import { SCHEDULE_WORDS } from '../../lib/club-schedule-words.ts';
import {
  NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_DESCRIPTIONS, NOTIFICATION_EVENT_LABELS, PUSH_DEFAULT_ON_EVENTS,
} from '../../lib/notification-labels.ts';
import { EVENT_ICONS } from '../../lib/notification-view.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 11a, PART A — THE CLUB SCHEDULER'S SERVER (ratified 2026-10-11; plan
 * docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md; hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11). What this holds:
 *
 * 1. THE PLAN (Stage 11 Ask 6): `club_scheduler` — League Plus and both Club bands, alike; checked on the server.
 * 2. WHO (Stage 11 Ask 3): an owner or an admin builds and sends; a bill also asks the club's one money rule.
 * 3. WRITTEN AT FINALIZE AND AT SEND THE CHANGES, NEVER ON READ (P11-05): only the send module runs the steps that write a
 *    club practice; no read path does; no TypeScript writes the slot link directly.
 * 4. THE CLUB'S PRACTICE IS THE CLUB'S (Stage 11 Ask 1, Ask 16): the coach's PATCH and DELETE refuse it; the coach keeps
 *    their own fields; "From the club" never names a practice (P11-03).
 * 5. ONE SEND (Ask 9): emails leave only from the send's POST, after the claim; the notices are registered.
 * 6. THE MONEY: Finalize writes the practices and the bill in one step; build question A (the filing) and B (a loss is
 *    owed back, never billed negatively) in the code that does it.
 * 7. THE SEASON ROLL carries a club schedule's upcoming practices (Ask 15) — the header says why.
 * 8. THE DELETE PATHS: a schedule's slots name facilities, so the org-wide deletes clear schedules before facilities; a
 *    permit a schedule hands out can't be deleted.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const MIG = 'supabase/migrations/326_the_club_hands_out_its_time.sql';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(rel);
  }
  return out;
}
const CODE = [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('components'), ...sourceFiles('scripts')];

describe('the scheduler rides League Plus and both Club bands, checked on the server (Stage 11 Ask 6)', () => {
  it('the key passes league, club and club_large — no Tournament plan, no standalone portal', () => {
    for (const p of ['league', 'club', 'club_large'] as const) assert.equal(hasPlanFeature(p, 'club_scheduler'), true, p);
    for (const p of ['tournament', 'tournament_plus', 'team'] as const) assert.equal(hasPlanFeature(p, 'club_scheduler'), false, p);
  });
  it('both copy helpers answer it (a missing case recurses forever) — and never as an upgrade from League Plus', () => {
    assert.match(requiresPlanCopy('club_scheduler'), /included with League Plus and Club/);
    assert.equal(requiresTournamentPlusCopy('club_scheduler'), requiresPlanCopy('club_scheduler'));
  });
  it('the gate asks the key, the role and the rep teams before anything else', () => {
    const gate = functionBody(readCode('lib/club-schedule-server.ts'), 'resolveScheduler');
    assert.match(gate, /getAuthContextWithRole\(\{ orgSlug, requireOrgSlug: true \}\)/);
    // The one rule (lib/club-schedule-gate.ts, part B's /simplify) — each half refused in its own words.
    assert.match(gate, /if \(!clubSchedulerOn\(ctx\.org\.planId\)\) return/);
    assert.match(gate, /if \(!isScheduleBuilder\(ctx\.role\)\) return/);
    const rule = readCode('lib/club-schedule-gate.ts');
    assert.match(rule, /hasPlanFeature\(planId, 'club_scheduler'\)/);
    assert.match(rule, /role === 'owner' \|\| role === 'admin'/);
    assert.match(gate, /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/, 'League Plus has no rep team to hand time to until 11b');
    assert.match(gate, /canMoney: canMoveClubMoney\(ctx, ctx\.org\)/);
  });
  it('every admin scheduler route passes through the gate', () => {
    for (const f of ['app/api/admin/schedules/route.ts', 'app/api/admin/schedules/generate/route.ts',
      'app/api/admin/schedules/[scheduleId]/route.ts', 'app/api/admin/schedules/[scheduleId]/send/route.ts']) {
      const code = readCode(f);
      const handlers = (code.match(/export const (GET|POST|PATCH|DELETE) = withObservability/g) ?? []).length;
      const gated = (code.match(/await resolveScheduler\(req/g) ?? []).length;
      assert.ok(handlers > 0 && gated === handlers, `${f}: ${gated} of ${handlers} handlers ask the gate`);
    }
  });
  it('a bill is money: adding one asks the money rule, and the preview refuses a send without it', () => {
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /if \(!r\.canMoney\) return schedulerRefusal\(403, 'bill_money', R\.billMoney\)/);
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'billBlockers'), /if \(!canMoney\) return \[\{ code: 'bill_money', error: R\.billMoney \}\]/);
    assert.match(functionBody(readCode('lib/club-schedule-server.ts'), 'scheduleView'), /bill: canMoney \? billViewOf\(/, 'the bill reads only to a money reader');
  });
});

describe('the club\'s practices are written at Finalize and at Send the changes — never on read (P11-05)', () => {
  const steps = /rpc\(['"](club_schedule_finalize|club_schedule_apply_changes)['"]/;
  it('only the send module runs the two steps that write them', () => {
    const callers = CODE.filter(f => steps.test(readSource(f)));
    assert.deepEqual(callers, ['lib/club-schedule-send.ts']);
  });
  it('the send runs them from its POST only — the GET is a preview', () => {
    const route = readCode('app/api/admin/schedules/[scheduleId]/send/route.ts');
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const POST'));
    assert.doesNotMatch(get, /sendSchedule\(/);
    assert.match(route.slice(route.indexOf('export const POST')), /await sendSchedule\(r, loaded, kind, body\)/);
  });
  it('no read path writes one: the coach\'s events read and the admin\'s team schedule read never send', () => {
    for (const f of ['app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts', 'app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/events/route.ts']) {
      assert.doesNotMatch(readCode(f), /sendSchedule|club_schedule_finalize|club_schedule_apply_changes/, f);
    }
  });
  it('no TypeScript writes the slot link itself — only the database steps do (mig 326)', () => {
    const raw = /from\(['"]rep_team_events['"]\)\s*\.(insert|update|upsert)\(\{[^}]*club_schedule_slot_id/;
    assert.deepEqual(CODE.filter(f => raw.test(readSource(f))), []);
    const sql = readSource(MIG);
    assert.match(sql, /create or replace function public\.club_practices_write\(/);
    assert.match(sql, /on conflict \(program_year_id, club_schedule_slot_id\) where club_schedule_slot_id is not null\s+do update set status = 'scheduled'/);
  });
  it('the link is not a foreign key, and one slot is one practice a season (207\'s reasoning)', () => {
    const sql = readSource(MIG);
    assert.match(sql, /alter table public\.rep_team_events\s+add column if not exists club_schedule_slot_id uuid;/);
    assert.match(sql, /create unique index if not exists rep_team_events_club_slot_uq\s+on public\.rep_team_events \(program_year_id, club_schedule_slot_id\)\s+where club_schedule_slot_id is not null;/);
  });
  it('a removed practice goes the mirror\'s way: cancelled when worked on, deleted when untouched', () => {
    const sql = readSource(MIG);
    const retire = /create or replace function public\.club_practice_retire[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    assert.match(retire, /if club_practice_worked_on\(p_event\) then[\s\S]*status = 'cancelled'[\s\S]*delete from rep_team_events where id = p_event;/);
    const worked = /create or replace function public\.club_practice_worked_on[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    for (const t of ['rep_team_event_attendance', 'rep_team_lineups', 'rep_team_event_tags', 'rep_player_awards', 'rep_team_expenses', 'rep_player_notes', 'rep_team_evaluation_sessions']) {
      assert.match(worked, new RegExp(t), `${t} is the coach's work`);
    }
    assert.doesNotMatch(worked, /field_number/, 'on a club practice field_number is the club\'s facility name, never the coach\'s');
  });
});

describe('the club\'s practice is the club\'s; the coach keeps their own parts (Stage 11 Ask 1, Ask 16)', () => {
  const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/route.ts');
  it('PATCH refuses a change to its time, place, name or status — 409, the mirror\'s shape', () => {
    assert.match(route, /if \(isClubSlotEvent\(event\)\) \{\s*const attempted = CLUB_OWNED_API_FIELDS\.filter\(field => body\[field\] !== undefined\);/);
    assert.ok(route.indexOf('isClubSlotEvent(event)') < route.indexOf("const scope = new URL(req.url).searchParams.get('scope')"), 'before the series branch');
  });
  it('DELETE refuses it: the coach hands it back instead', () => {
    const del = route.slice(route.indexOf('export const DELETE'));
    assert.match(del, /if \(isClubSlotEvent\(event\)\) \{\s*return NextResponse\.json\(\s*\{ error: CLUB_SLOT_REFUSALS\.remove\(/);
  });
  it('the club owns when, where, what and whether; the coach owns arrival, notes, uniform, links and tags', () => {
    for (const f of ['name', 'startsAt', 'endsAt', 'location', 'fieldNumber', 'orgVenueId', 'orgVenueFacilityId', 'placeId', 'status']) {
      assert.ok((CLUB_OWNED_API_FIELDS as readonly string[]).includes(f), f);
    }
    for (const f of ['arrivalTime', 'description', 'uniform', 'resources', 'tagIds']) {
      assert.ok(!(CLUB_OWNED_API_FIELDS as readonly string[]).includes(f), `${f} stays the coach's`);
    }
  });
  it('a practice reads "From {schedule} · the club\'s schedule" — never "From the club", which means money (P11-03)', () => {
    assert.equal(SCHEDULE_WORDS.sourceLine('Winter dome 2026–27'), 'From Winter dome 2026–27 · the club’s schedule');
    assert.equal(SCHEDULE_WORDS.onlyTheClub, 'Only the club can move or remove this practice.');
    for (const w of [CLUB_SLOT_REFUSALS.change('X'), CLUB_SLOT_REFUSALS.remove('X'), SCHEDULE_WORDS.sourceLine('X')]) {
      assert.doesNotMatch(w, /From the club\b/);
    }
  });
  it('the schedule import never changes one: never matched, and skipped if it ever were (/review 2026-10-11)', () => {
    const imp = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/import/route.ts');
    assert.match(imp, /const clubIds = new Set\(liveEvents\.filter\(isClubSlotEvent\)/);
    assert.match(imp, /liveEvents\.filter\(e => !clubIds\.has\(e\.id\)\)/);
    assert.match(imp, /if \(clubIds\.has\(row\.matchedEventId\)\) \{/);
  });
  it('hand-back is the coach\'s own act, on the schedule\'s write capability', () => {
    const hb = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back/route.ts');
    assert.match(hb, /denyUnless\(canManageSchedule\(assignment\.capabilities\)/);
    assert.match(functionBody(readCode('lib/club-schedule-coach.ts'), 'handBack'), /rpc\('club_schedule_hand_back'/);
  });
  it('the review\'s reply is a head coach\'s, on the team\'s live season (a write never goes through a read context)', () => {
    const rv = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/club-schedules/route.ts');
    const post = rv.slice(rv.indexOf('export const POST'));
    assert.match(post, /await resolveLiveCoachTeamContext\(orgSlug, teamId\)/);
    assert.match(post, /if \(!assignment\.capabilities\.isHeadCoach\) \{/);
  });
});

describe('one club send (Ask 9): a claim before any email, emails only from the POST, reply-to the sender', () => {
  const send = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule');
  it('claims before the step and before a single email', () => {
    const claim = send.indexOf("rpc('club_schedule_send_claim'"), email = send.indexOf('sendEmail(');
    assert.ok(claim > 0 && email > claim, 'the claim comes first');
    assert.match(send, /replyTo: sctx\.ctx\.user\.email \?\? null/);
  });
  it('a refused step releases its claim, so a retry is not "just sent"', () => {
    assert.ok((send.match(/await release\(\)/g) ?? []).length >= 4);
  });
  it('the sender is never a recipient (the people resolver leaves them out)', () => {
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'schedulePeople'), /\.filter\(m => m\.userId !== senderId/);
  });
  it('the database claim refuses a second send of one schedule inside a minute, under a lock', () => {
    const sql = readSource(MIG);
    assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('club_schedule_send:' \|\| p_schedule::text, 0\)\)/);
    assert.match(sql, /sent_at > now\(\) - interval '60 seconds'/);
  });
  it('sendEmail is called nowhere else in the scheduler', () => {
    for (const f of ['lib/club-schedule-server.ts', 'lib/club-schedule-coach.ts', 'lib/club-schedule-engine.ts', 'lib/club-schedule-bill.ts']) {
      assert.doesNotMatch(readCode(f), /sendEmail\(/, f);
    }
  });
  it('the six notices are registered, each in its zone, with an icon and a push default', () => {
    for (const evt of ['club_schedule_review', 'club_schedule_final', 'club_schedule_changes', 'club_bill_arrived', 'club_schedule_reply', 'club_schedule_handed_back'] as const) {
      assert.ok(NOTIFICATION_EVENT_LABELS[evt], evt);
      assert.ok(NOTIFICATION_EVENT_DESCRIPTIONS[evt], evt);
      assert.ok(EVENT_ICONS[evt], evt);
      assert.ok(PUSH_DEFAULT_ON_EVENTS.has(evt), evt);
    }
    assert.equal(NOTIFICATION_CATEGORY.club_schedule_review, 'act', 'a review waits on the coach\'s answer');
    assert.equal(NOTIFICATION_CATEGORY.club_schedule_final, 'know');
  });
});

describe('the money: one step, build questions A and B (ruled 2026-10-11)', () => {
  const sql = readSource(MIG);
  it('Finalize makes the bill and writes the practices in ONE step, refusals before any write', () => {
    const fin = /create or replace function public\.club_schedule_finalize[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    const bill = fin.indexOf('club_allocation_create('), rows = fin.indexOf('club_practices_write(');
    assert.ok(bill > 0 && rows > bill, 'the allocation (which refuses before writing) comes before the practices');
    assert.match(fin, /if not coalesce\(\(v_res->>'ok'\)::boolean, false\) then return v_res; end if;/);
    assert.match(fin, /club_practices_season_refusal\(p_org, p_rows\)/, 'every team on its running season (Ask 15)');
  });
  it('"By the time each team got" is its own split method', () => {
    assert.match(sql, /check \(split_method in \('even', 'percentage', 'sessions', 'fixed', 'time'\)\)/);
    assert.match(sql, /IF p_split_method NOT IN \('even', 'percentage', 'sessions', 'fixed', 'time'\) THEN/);
  });
  it('A: a share is filed only under a PLATFORM word the team\'s running-season plan already has', () => {
    const file = /create or replace function public\.club_bill_file_shares[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    assert.match(file, /bi\.org_id is null and bi\.team_id is null/);
    assert.match(file, /exists \(select 1 from rep_budget_lines r\s+where r\.team_id = s\.team_id and r\.program_year_id = s\.program_year_id and r\.item_id = bi\.id\)/);
  });
  it('B: a correction bills only what teams GAINED; a loss is owed back, never a negative bill', () => {
    const preview = functionBody(readCode('lib/club-schedule-send.ts'), 'previewSend');
    assert.match(preview, /splits = \[\.\.\.correction\.gains\]\.map\(/);
    assert.doesNotMatch(preview, /correction\.losses\]\.map\(/);
    const log = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule');
    assert.match(log, /owedBack: Object\.fromEntries\(preview\.correction\?\.losses \?\? \[\]\)/);
  });
  it('the next send\'s baseline lands IN the step, never after the emails (/review 2026-10-11: a lost completion double-billed)', () => {
    const send = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule');
    for (const step of ['club_schedule_send_review', 'club_schedule_finalize', 'club_schedule_apply_changes']) {
      const at = send.indexOf(`rpc('${step}'`);
      assert.ok(at > 0, step);
      assert.match(send.slice(at, at + 700), /p_send: sendId/, `${step} carries the claimed row`);
    }
    assert.doesNotMatch(send, /team_values:/, 'the completion never writes the money');
    for (const fn of ['club_schedule_finalize', 'club_schedule_apply_changes', 'club_schedule_send_review']) {
      const body = new RegExp(`create or replace function public\\.${fn}[\\s\\S]*?\\$\\$;`).exec(sql)?.[0] ?? '';
      assert.match(body, /update club_schedule_sends set\s+landed_at = now\(\)/, `${fn} marks its send landed`);
    }
    // A claim whose step never landed is no send: not "Last sent", not the baseline, not a review round.
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'lastSends'), /\.not\('landed_at', 'is', null\)/);
    assert.match(functionBody(readCode('lib/club-schedule-coach.ts'), 'latestReviewSend'), /\.not\('landed_at', 'is', null\)/);
  });
  it('a moved practice moves its link with it, and a removed slot never leaves a practice pointing at nothing', () => {
    const apply = /create or replace function public\.club_schedule_apply_changes[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '';
    assert.match(apply, /club_schedule_slot_id = \(v_u->>'slotId'\)::uuid,/);
    assert.match(apply, /update rep_team_events set club_schedule_slot_id = null[\s\S]*delete from club_schedule_slots where schedule_id = p_schedule and removed_at is not null;/);
  });
  it('a bill\'s figures in a send preview and the send log read only to a money reader', () => {
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/send/route.ts'), /const teams = money \? p\.teams : p\.teams\.map\(/);
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /const shownLog = r\.canMoney \? log : log\.map\(/);
  });
});

describe('the season roll carries a club schedule\'s upcoming practices (Ask 15)', () => {
  const roll = readCode('lib/rep-season-rollover.ts');
  it('after the roster (each player\'s replies follow them), before the old season completes', () => {
    const roster = roll.indexOf('const playerIdMap = new Map'), carry = roll.indexOf("rpc('club_practices_carry'"), done = roll.indexOf("await updateRepProgramYear(currentSeason.id, { status: 'completed' })");
    assert.ok(roster > 0 && carry > roster && done > carry);
    assert.match(roll, /p_players: Object\.fromEntries\(playerIdMap\)/);
  });
  it('the header says why "the schedule starts fresh" still holds', () => {
    assert.match(readSource('lib/rep-season-rollover.ts'), /ONE NARROW EXCEPTION \(Club Tier Stage 11a, Ask 15/);
  });
  it('only the upcoming ones move, with their attendance remapped to the new roster', () => {
    const carry = /create or replace function public\.club_practices_carry[\s\S]*?\$\$;/.exec(readSource(MIG))?.[0] ?? '';
    assert.match(carry, /club_schedule_slot_id is not null and starts_at >= p_after/);
    assert.match(carry, /player_id = \(p_players->>player_id::text\)::uuid/);
  });
});

describe('what deletes a venue, a facility or a permit knows about schedules', () => {
  it('the org-wide deletes clear the club\'s schedules before its facilities (a slot names a facility)', () => {
    for (const f of ['app/api/platform-admin/orgs/[id]/delete/route.ts', 'scripts/seed-club-fixture.mjs']) {
      const code = readCode(f);
      const schedules = code.indexOf("from('club_schedules').delete()"), facilities = code.indexOf("from('org_venue_facilities').delete()");
      assert.ok(schedules > 0 && schedules < facilities, f);
    }
  });
  it('a permit a schedule hands out can\'t be deleted', () => {
    assert.match(readCode('app/api/admin/org/permits/route.ts'), /const handing = await schedulesHandingOut\(orgId, permit\.id\);/);
  });
  it('a venue or facility a schedule holds is refused in words', () => {
    const v = readCode('app/api/admin/org/venues/route.ts');
    assert.match(v, /'facility_in_schedule'/);
    assert.match(v, /'venue_in_schedule'/);
  });
});
