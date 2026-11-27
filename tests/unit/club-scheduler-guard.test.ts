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
    assert.match(gate, /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/);
    // ⚖ Changed 2026-10-27 (Stage 11b, 9d2·15): house league is a holder of the club's time, so a club with house league
    // has something to schedule — League Plus included. Still the owner or an admin only (the line above `isScheduleBuilder`).
    // A club that RUNS house league (a season not finished), as a rep team needs its running season (11b review).
    assert.match(gate, /const houseLeague = hasModuleEntitlement\(ctx\.org, 'module_house_league'\) && await houseLeagueRuns\(ctx\.org\.id\);/);
    assert.match(gate, /const canSchedule = repTeams \|\| houseLeague;/);
    // House league opening the door never opens the rep teams to a member the owner kept out (11b review).
    assert.match(gate, /canSchedule, houseLeague, repTeams \}/);
    assert.match(functionBody(readCode('lib/club-schedule-server.ts'), 'readClubTeams'), /if \(opts\.repTeams === false\) return/);
    for (const f of ['app/api/admin/schedules/[scheduleId]/route.ts', 'app/api/admin/schedules/[scheduleId]/send/route.ts', 'app/api/admin/schedules/generate/route.ts']) {
      assert.match(readCode(f), /repTeamsRefusal\(r, loaded\)/, `${f} refuses a rep schedule to a member without Rep Teams`);
    }
    assert.match(gate, /canMoney: canMoveClubMoney\(ctx, ctx\.org\)/);
  });
  it('⚖ Stage 11b: house league is taken back out at every edge — the database, the bill, the send, the rules', () => {
    const server = readCode('lib/club-schedule-server.ts');
    // A slot's program goes as `program`, never as a team row (mig 392's floor refuses both: slot_both).
    assert.match(functionBody(server, 'slotsPayload'), /storedHolders\(/);
    assert.match(functionBody(server, 'editSlotsStep'), /storedHolders\(/);
    assert.match(server, /\\bslot_both\\b/);
    // The one refusal is a TEAM's: house league holds many slots at once.
    assert.match(functionBody(server, 'draftToSave'), /teamTwice\(checked\.slots, new Map\(\[\.\.\.a\.value\]\.map\(\(\[k, ids\]\) => \[k, teamsOnly\(ids\)\]\)\)\)/);
    // No team rule names it.
    assert.match(functionBody(server, 'readScheduleRequest'), /isProgramHolder/);
    // Never billed (11b·A), whatever order a caller passes.
    const bill = readCode('lib/club-schedule-bill.ts');
    assert.match(functionBody(bill, 'billShares'), /teamsOnly\(/);
    assert.match(functionBody(bill, 'sharesAtRate'), /teamsOnly\(/);
    // The rep teams' Send the changes measures rep practices only; house league's half is its own.
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'planChanges'), /teamsOnly\(ids\)/);
  });
  it('⚖ Stage 11b Part 5: house league\'s half is the plan the owner saw, and its people hear only after the step', () => {
    const send = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule');
    // Phase 8 (Session 3): each member's step lives in `stepFor` (a schedule and its added parts send together).
    const step = functionBody(readCode('lib/club-schedule-send.ts'), 'stepFor');
    // The step gets the previewed plan (never a fresh one), and a plan that changed under the window is read again.
    assert.match(step, /p_league: half\?\.step \?\? null/);
    assert.match(send, /body\.leagueSeen[\s\S]*preview\.league\?\.seen/);
    // Coaches, families and league admins hear after every step has landed — never inside a transaction.
    assert.ok(send.lastIndexOf('stepFor(') < send.indexOf('tellHouseLeague('), 'house league hears after the steps');
    // The bell reaches everyone who runs house league — owners and admins too (owner 2026-10-27), never the sender.
    const tell = functionBody(readCode('lib/club-schedule-send.ts'), 'tellHouseLeague');
    // Stage 13d: the list lives in one helper (owners, admins, league admins), shared with the time-given bell.
    assert.match(tell, /const userIds = await houseLeagueRunnerUserIds\(org\.id\);/);
    assert.match(readCode('lib/notify-recipients.ts'), /export async function houseLeagueRunnerUserIds[\s\S]*?\.in\('role', \[\.\.\.LEAGUE_RUNNER_ROLES\]\)/);
    assert.match(tell, /excludeUserIds: \[sctx\.ctx\.user\.id\]/);
    // The families' email is a service notice through the batched sender, never the suppression-dropping audience.
    const mail = readCode('lib/club-schedule-league-mail.ts');
    assert.match(mail, /sendFamilyServiceBatch\(/);
    assert.doesNotMatch(mail, /familyAudience|sendEmail\(/);
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
    assert.ok(readCode('lib/club-schedule-send.ts').includes("correction.losses.size > 0 && !sctx.canMoney) correctionBlocked = { code: 'bill_money', error: R.creditMoney }"), 'a credit is money: Send the changes with credits only meets the Money check too');
    const view = functionBody(readCode('lib/club-schedule-server.ts'), 'scheduleView');
    assert.match(view, /bill: canMoney \? billViewOf\(/, 'the bill reads only to a money reader');
    // Stage 11d part B: what each team pays, the plain hand-backs and the bill as made read only to a money reader too, and
    // an ask's figure is stripped for anyone else.
    assert.match(view, /const billed = canMoney && row\.state === 'final' && !!row\.allocation_id;/);
    assert.match(view, /billed \? scheduleMoney\(/);
    assert.match(view, /cents: canMoney \? a\.cents : null/);
  });
});

describe('the club\'s practices are written at Finalize and at Send the changes — never on read (P11-05)', () => {
  // Since mig 489 the send calls the _priced wrappers (the bill and its kept rates in one transaction); either name counts.
  const steps = /rpc\(['"](club_schedule_finalize|club_schedule_apply_changes)(_priced)?['"]/;
  it('only the send module runs the two steps that write them', () => {
    const callers = CODE.filter(f => steps.test(readSource(f)));
    // The demo seed (run by hand, refuses all but the dev project) bills through the product's own step, so its bill is real.
    assert.deepEqual(callers, ['lib/club-schedule-send.ts', 'scripts/lib/prospect-demo-rep.mjs']);
    const importers = CODE.filter(f => /from\s+['"][^'"]*prospect-demo-rep\.mjs['"]/.test(readSource(f))).map(f => f.replace(/\\/g, '/'));
    assert.deepEqual(importers, ['scripts/seed-prospect-demo.mjs']);
    assert.match(readCode('scripts/seed-prospect-demo.mjs'), /if \(url\.includes\(PROD_REF\) \|\| host !== /);
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
    // Through the one reading of a club practice (part C, `resolveClubPractice` — its live seat and season), then this gate.
    assert.match(hb, /const r = await resolveClubPractice\(orgSlug, teamId, eventId\);/);
    assert.match(hb, /denyUnless\(canManageSchedule\(r\.capabilities\)/);
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
  // Phase 8 (Session 3): each member's claim and step live in `stepFor`; the send runs every step before any email.
  const step = functionBody(readCode('lib/club-schedule-send.ts'), 'stepFor');
  it('claims before the step and before a single email', () => {
    const claim = step.indexOf("rpc('club_schedule_send_claim'");
    assert.ok(claim > 0 && claim < step.indexOf("rpc('club_schedule_send_review'"), 'the claim comes before the step');
    assert.ok(send.lastIndexOf('stepFor(') > 0 && send.indexOf('sendEmail(') > send.lastIndexOf('stepFor('), 'every step (its claim) before any email');
    assert.match(send, /replyTo: sctx\.ctx\.user\.email \?\? null/);
  });
  it('a refused step releases its claim, so a retry is not "just sent"', () => {
    assert.ok((step.match(/await release\(\)/g) ?? []).length >= 4);
  });
  it('the sender is never a recipient (the people resolver leaves them out)', () => {
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'schedulePeople'), /\.filter\(\(\{ m \}\) => m\.userId !== senderId/);
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
  it('B, amended by Stage 11d Ask 8: a gain is a correction bill; a loss is CREDITED in the step (never a negative bill, never "owed back")', () => {
    const preview = functionBody(readCode('lib/club-schedule-send.ts'), 'previewSend');
    // The money of Send the changes is worked out in ONE pure function the send calls (`changesMoney`, Session E: its P9 B
    // test runs it through the send's own planning — club-schedule-add-time-send.test.ts).
    const money = functionBody(readCode('lib/club-schedule-send.ts'), 'changesMoney');
    assert.match(preview, /const money = changesMoney\(c, plan, kept, before, await readHandBacks\(/);
    assert.match(preview, /splits = money\.splits;/);
    assert.match(money, /splits: TimeSplit\[\] = \[\.\.\.correction\.gains\]\.map\(/);
    assert.doesNotMatch(money + preview, /correction\.losses\]\.map\(/, 'a loss never becomes a bill');
    // Each team that lost time is worded from the credit the step will write (`lostTime` → `creditApplication`).
    assert.match(preview, /for \(const \[t, cents\] of correction\.losses\) \{\s*const settled = await lostTime\(/);
    // Hand-backs are the team's own act: never measured as the club's change (S11D-03's hidden owed-back).
    assert.match(money, /valuesAfterChanges\(before, atRate, new Set\(plan\.byTeam\.keys\(\)\)\)/);
    assert.match(money, /measureWithHandBacks\(handBacks,/);
    assert.match(preview, /await withHandedBack\(/);
    const send = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule') + functionBody(readCode('lib/club-schedule-send.ts'), 'stepFor');
    assert.doesNotMatch(send, /owedBack/, 'build question B\'s owed-back is retired (Ask 8)');
    assert.match(send, /const losses = billCorrectionsOn \?/, 'one switch for both halves');
    assert.match(send, /p_losses: losses/);
    const mig = readCode('supabase/migrations/328_a_hand_back_may_ask_for_money_back.sql');
    const apply = /create or replace function public\.club_schedule_apply_changes[\s\S]*?\$\$;/.exec(mig)?.[0] ?? '';
    assert.match(apply, /v_credit := club_credit_apply\(/);
    assert.match(apply, /'accepted', 'reimbursement'/, 'what the team had paid is an accepted request to pay');
    assert.doesNotMatch(apply, /owed_back =/, 'owed_back is no longer written');
    assert.match(apply, /settled = v_settled/);
  });
  it('Stage 11d: the ask, its request and the credit are written ONLY by their steps; a hand-back never marks the schedule Changed since sent (Ask 9)', () => {
    const mig = readCode('supabase/migrations/328_a_hand_back_may_ask_for_money_back.sql');
    for (const f of sourceFiles('lib').concat(sourceFiles('app'))) {
      const code = readCode(f);
      assert.doesNotMatch(code, /from\('(club_schedule_hand_backs|club_schedule_hand_back_slots|rep_allocation_credits|rep_allocation_credit_parts)'\)\s*\.(insert|update|upsert|delete)\(/, `${f} writes a hand-back or a credit by hand`);
      assert.doesNotMatch(code, /\.(update|insert|upsert)\(\{[^}]*\bcredited_amount\s*:/, `${f} writes a payment's credit by hand`);
    }
    const hb = /create or replace function public\.club_schedule_hand_back\([\s\S]*?\$\$;/.exec(mig)?.[0] ?? '';
    assert.ok(hb.length > 0);
    assert.doesNotMatch(hb, /changed_since_sent\s*=/, 'a plain hand-back never sets the flag');
    const accept = /create or replace function public\.club_hand_back_accept[\s\S]*?\$\$;/.exec(mig)?.[0] ?? '';
    assert.doesNotMatch(accept, /changed_since_sent\s*=/, 'an accepted ask never sets the flag');
    // The send's "changes waiting" lists no hand-back, and has no place to (part B removed the branch with the page's).
    assert.doesNotMatch(functionBody(readCode('lib/club-schedule-send.ts'), 'changesSummary'), /handedBack/);
    // A WAITING ask's request is answered with the ask, never approved or declined apart from it.
    const approve = /create or replace function public\.club_request_approve[\s\S]*?\$\$;/i.exec(mig)?.[0] ?? '';
    assert.match(approve, /if v_req\.status = 'pending' and v_req\.club_hand_back_id is not null then/i);
    assert.match(functionBody(readCode('lib/club-money-moves.ts'), 'clubDeclineRequest'), /if \(c\.row\.club_hand_back_id\) return refused\(409/);
    // The floor under them: a trigger refuses a write to a linked request's money outside its step.
    assert.match(mig, /create trigger rep_team_payment_requests_club_guard/);
  });
  it('the next send\'s baseline lands IN the step, never after the emails (/review 2026-10-11: a lost completion double-billed)', () => {
    const send = functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule') + functionBody(readCode('lib/club-schedule-send.ts'), 'stepFor');
    for (const step of ['club_schedule_send_review', 'club_schedule_finalize_priced', 'club_schedule_apply_changes_priced']) {
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
  it('a final schedule finalized with no bill can still be billed — one step, the schedule stays final, the baseline lands in it (mig 481)', () => {
    const mig = readCode('supabase/migrations/481_a_finalized_schedule_can_still_be_billed.sql');
    const fn = /create or replace function public\.club_schedule_bill_late[\s\S]*?\$\$;/.exec(mig)?.[0] ?? '';
    assert.ok(fn.length > 0);
    // Refusals before anything is written, in the order the step reads them.
    for (const code of ['not_found', 'not_final', 'already_billed', 'changed', 'changes_waiting', 'asks_waiting']) assert.match(fn, new RegExp(`'code', '${code}'`), code);
    // The same allocation Finalize makes, filed as Finalize files it.
    assert.match(fn, /club_allocation_create\(p_org, p_actor, p_bill->>'description'[\s\S]*'time'/);
    assert.match(fn, /club_bill_file_shares\(v_alloc\)/);
    // It never moves the schedule's state, its send or finalize moment, or its changed flag.
    const write = /update club_schedules set[\s\S]*?where id = p_schedule;/.exec(fn)?.[0] ?? '';
    assert.ok(write.length > 0);
    assert.doesNotMatch(write, /\bstate\s*=|sent_at\s*=|finalized_at\s*=|changed_since_sent\s*=/, 'the schedule stays final, exactly as it was sent');
    // The next Send the changes' baseline is written IN the step, as Finalize writes its own (a `{}` baseline double-bills).
    assert.match(fn, /update club_schedule_sends set landed_at = now\(\), team_values = coalesce\(p_log->'teamValues'/);
    assert.match(mig, /check \(kind in \('review', 'final', 'changes', 'bill'\)\)/);
    assert.match(mig, /revoke all on function public\.club_schedule_bill_late[\s\S]*to service_role;/);
    const send = functionBody(readCode('lib/club-schedule-send.ts'), 'stepFor');
    const at = send.indexOf("rpc('club_schedule_bill_late_priced'");
    assert.ok(at > 0);
    assert.match(send.slice(at, at + 500), /p_send: sendId/, 'the late bill carries the claimed row');
    // The terms are the SERVER's own (read again from the request), never a list the browser sends on trust.
    assert.match(send.slice(at - 400, at + 300), /preview\.billTerms/);
    // The next Send the changes measures from the late bill's row as well as Finalize's and the changes'.
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'lastSends'), /s\.kind === 'bill'/);
    // A team that already handed time back is measured with it, so the next send never reads that time as gained.
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'previewSend'), /kind === 'bill'[\s\S]*withHandedBack\(/);
  });
  it('a bill\'s figures in a send preview and the send log read only to a money reader', () => {
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/send/route.ts'), /const teams = money \? p\.teams : p\.teams\.map\(/);
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /const shownLog = r\.canMoney \? log : log\.map\(/);
    // The route asks the SAME "carries money" the emails are built on, so a mixed team's plain email survives for a sender
    // without Accounting and a money one never does.
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/send/route.ts'), /carriesMoney\(t\) && t\.recipients\.some\(x => x\.money\)/);
  });
});

describe('money terms go only to people who can open Money (owner 2026-11-13, CASL_LATE_BILL_EMAIL finding 4)', () => {
  const code = readCode('lib/club-schedule-send.ts');
  it('every email and bell that can carry a bill is built by the money-audience helper — none in the send module itself', () => {
    // The bill email, the bill bell, the review bell's "and a $ bill" and the correction lines are built only in
    // `lib/club-schedule-money-audience.ts`, which picks their audience. A future send kind that called them here directly
    // would hand the bill to everyone with schedule access again.
    for (const builder of ['billEmail(', 'changesEmail(', 'teamEmail(', 'SCHEDULE_NOTICES.bill', 'SCHEDULE_NOTICES.review']) {
      assert.ok(!code.includes(builder), `${builder} in lib/club-schedule-send.ts`);
    }
    for (const f of ['lib/club-schedule-server.ts', 'lib/club-schedule-coach.ts']) {
      assert.doesNotMatch(readCode(f), /billEmail\(|SCHEDULE_NOTICES\.bill\b/, f);
    }
  });
  it('the late bill keeps only Money people, before the unreachable reasons are worked out', () => {
    const people = functionBody(code, 'schedulePeople');
    assert.match(people, /\.filter\(x => inSendAudience\(kind, x\.caps\)\)/);
    assert.ok(people.indexOf('inSendAudience(') < people.indexOf('unreachableWhy('), 'filtered first');
    assert.match(people, /const mine = eligible\.filter\(/, 'a team’s people come from the filtered list, never the raw staff');
    assert.match(people, /senderEligible: mine\.length > 0 && mine\.every\(/, 'the reason is worked out on the people the filter kept, and "only you" means nobody else is eligible');
    assert.match(people, /money: canViewMoney\(caps\)/);
  });
  it('every email goes through emailForPerson, and every bell through teamBells with the Money-marked staff', () => {
    const send = functionBody(code, 'sendSchedule');
    assert.match(send, /const w = emailForPerson\(kind, preview\.replyBy, t, p\);/);
    assert.ok(!/t\.sample\b/.test(send), 'no email is sent from a team\'s sample without asking who it is for');
    const tell = functionBody(code, 'tellTeams');
    assert.match(tell, /for \(const b of teamBells\(\{/);
    assert.match(tell, /userIds: b\.userIds/);
    assert.match(functionBody(code, 'scheduleUserIds'), /money: canViewMoney\(caps\)/);
  });
  it('Bill the corrections off: the send recomputes its preview with the switch, so nothing told carries a correction', () => {
    assert.match(functionBody(code, 'sendSchedule'), /previewSend\([^)]*corrections: billCorrectionsOn \}\)/);
    const preview = functionBody(code, 'previewSend');
    // Phase 8: what each member tells a team (`sharesOf`) — the schedule's correction and credit only under the switch;
    // a part's own come from its preview, made with the same switch.
    assert.match(preview, /billedCents: toldCorrections \? correction\?\.gains\.get\(teamId\) \?\? null : null, lost: toldCorrections \? lost\.get\(teamId\) \?\? null : null/);
    assert.match(functionBody(code, 'partsToSend'), /previewSend\(sctx, l, kind, \{ corrections \}\)/);
    // ⚠ Only what is told: the step's own inputs (the lost map, the correction, the splits) stay whole.
    assert.match(preview, /lost\.set\(t, settled\.lost\);/);
  });
  it('the review\'s card and reply stay the head coach\'s — the bill\'s safety there rests on it (head coach ⇒ Money)', () => {
    const rv = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/club-schedules/route.ts');
    const get = rv.slice(rv.indexOf('export const GET'), rv.indexOf('export const POST'));
    assert.match(get, /if \(!capabilities\.isHeadCoach \|\| isReadOnly \|\| !clubSchedulerOn\(ctx\.org\.planId\)\) return NextResponse\.json\(\{ reviews: \[\] \}\);/);
    const post = rv.slice(rv.indexOf('export const POST'));
    assert.match(post, /if \(!assignment\.capabilities\.isHeadCoach\) \{\s*return NextResponse\.json\(\{[^}]*code: 'not_head_coach' \}, \{ status: 403 \}\);/);
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
