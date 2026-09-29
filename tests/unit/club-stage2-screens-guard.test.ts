import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  boardBands, boardLede, boardPhoneLine, boardSeasonCell, documentsText, headCoachCell, isEmptyLiveRoster,
  nextEventLines,
} from '../../lib/club-board-view.ts';
import {
  closeWarning, closedCardLine, rosterCarryDetail, startLead, startToldLine, startWarningTail, twoOpenBody,
  unsettledLines,
} from '../../lib/club-season-words.ts';
import { clubSeasonNotice, clubSeasonStartedCard, clubWelcomeCard } from '../../lib/club-season-notice.ts';
import { isForTeam, isPortalTeamRequest, isSeasonNotLiveBody } from '../../lib/season-refusal-watch.ts';
import { sensitiveGrantWords, resolveCoachCapabilities, STAFF_PRESETS } from '../../lib/coach-capabilities.ts';
import { NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_LABELS } from '../../lib/notification-labels.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 2 · SESSION 3 — THE CLUB'S REP-TEAMS SCREENS (hub v15, the Coaches Portal
 * benchmark; plan §6 Stage 2). Each block pins a drawn rule or a ruling against the code that
 * carries it, so an edit that quietly reverses one fails here with the reason.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROOT = path.resolve(import.meta.dirname, '../..');
const PAGE = {
  board: 'app/[orgSlug]/admin/rep-teams/page.tsx',
  team: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx',
  coaches: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/coaches/page.tsx',
  tryouts: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx',
  roster: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/roster/page.tsx',
  schedule: 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx',
  documents: 'app/[orgSlug]/admin/rep-teams/documents/page.tsx',
};
const css = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('the board says each fact one way (specimen 1)', () => {
  const season = (over: Partial<Parameters<typeof boardSeasonCell>[0] & object> = {}) => ({
    id: 's', name: '2026 Season', year: 2026, status: 'active' as const, isLive: true,
    record: { w: 12, l: 8, t: 1 }, recordText: '12-8-1', ...over,
  });

  it('a season is Live or Closed, captioned by its record with hyphens', () => {
    assert.deepEqual(boardSeasonCell(season()), { chip: '2026 · Live', tone: 'good', caption: '12-8-1' });
    assert.equal(boardSeasonCell(season({ recordText: null }))?.caption, 'No games yet');
    assert.deepEqual(boardSeasonCell(season({ status: 'completed', isLive: false, recordText: '21-6-3' })),
      { chip: '2026 · Closed', tone: 'neutral', caption: 'Final 21-6-3' });
    assert.equal(boardSeasonCell(null), null);
  });

  it('the head coach cell: the people, an unexpired invitation, or nobody', () => {
    const none = { headCoach: { people: [], invited: [] } };
    assert.deepEqual(headCoachCell(none, null), { kind: 'none' });
    const invited = { headCoach: { people: [], invited: [
      { inviteId: 'i1', email: 'old@x.ca', invitedAt: '', expiresAt: '', expired: true },
      { inviteId: 'i2', email: 'k@x.ca', invitedAt: '', expiresAt: '', expired: false },
    ] } };
    assert.deepEqual(headCoachCell(invited, null), { kind: 'invited', email: 'k@x.ca' }, 'an expired link is not "Invited"');
    const people = { headCoach: { people: [{ userId: 'u1', name: 'Dana Whitfield', email: 'd@x.ca' }], invited: [] } };
    assert.deepEqual(headCoachCell(people, 'u1'), { kind: 'people', names: ['Dana Whitfield'], you: true });
  });

  it('only a LIVE season with nobody on it is the red "No players" (J4-008)', () => {
    assert.equal(isEmptyLiveRoster({ season: season(), rosterCount: 0 }), true);
    assert.equal(isEmptyLiveRoster({ season: season({ isLive: false }), rosterCount: 0 }), false);
    assert.equal(isEmptyLiveRoster({ season: season(), rosterCount: 3 }), false);
  });

  it('documents read "signed of players", else the standard\'s em dash', () => {
    assert.equal(documentsText({ documents: { signed: 13, of: 14 } }), '13 of 14');
    assert.equal(documentsText({ documents: null }), null);
  });

  it('the next event: a weekday day, and one line in the house clock', () => {
    const game = nextEventLines({ id: 'e', eventType: 'league_game', isScrimmage: false, startsAt: '2026-10-03T14:00:00Z', name: null, opponent: 'Barrie', homeAway: 'home' });
    assert.equal(game.day, 'Sat Oct 3');
    assert.equal(game.line, 'vs Barrie · 10:00 a.m.');
    const away = nextEventLines({ id: 'e', eventType: 'league_game', isScrimmage: false, startsAt: '2026-10-03T14:00:00Z', name: null, opponent: 'Orillia', homeAway: 'away' });
    assert.match(away.line, /^at Orillia/);
    const practice = nextEventLines({ id: 'e', eventType: 'practice', isScrimmage: false, startsAt: '2026-09-29T22:00:00Z', name: 'Practice', opponent: null, homeAway: null });
    assert.equal(practice.line, 'Practice · 6:00 p.m.');
    const tourney = nextEventLines({ id: 'e', eventType: 'external_tournament', isScrimmage: false, startsAt: '2026-10-03T12:00:00Z', name: 'Harvest Classic', opponent: null, homeAway: null });
    assert.equal(tourney.line, 'Harvest Classic');
  });

  it('bands follow the club\'s group order, then Ungrouped; a club with no groups draws no band row', () => {
    const rows = [{ groupId: 'g2' }, { groupId: 'g1' }, { groupId: null }, { groupId: 'g1' }];
    const bands = boardBands(rows, [{ id: 'g1', name: 'Boys' }, { id: 'g2', name: 'Girls' }]);
    assert.deepEqual(bands.map(b => b.label), ['Boys · 2 teams', 'Girls · 1 team', 'Ungrouped · 1 team']);
    const flat = boardBands(rows, []);
    assert.equal(flat.length, 1);
    assert.equal(flat[0].label, '', 'no groups → no band row');
  });

  it('the lede is a count, never a verdict', () => {
    assert.equal(boardLede({ teams: 9, groups: 2, used: 9, limit: 15 }), '9 teams in 2 groups · 9 of 15 on your plan');
    assert.equal(boardLede({ teams: 1, groups: 0, used: 1, limit: 9999 }), '1 team', 'uncapped drops the plan half');
    assert.equal(boardPhoneLine({ coach: 'Tom Becker', roster: 14, nextDay: 'Sat Oct 3' }), 'Tom Becker · 14 players · Sat Oct 3');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('the season windows (specimen 3, Ask 1 (a))', () => {
  it('⚖ unsettled money WARNS and never blocks — every warning ends saying the club can still go ahead', () => {
    const u = { familiesOwing: 3, familiesWaitingToReturn: 2 };
    assert.deepEqual(unsettledLines(u), ['3 families still owe dues', 'Money is waiting to go back to 2 families']);
    assert.match(startWarningTail({ headCoachName: 'Tom Becker', seasonName: '2026 Season' }), /You can still start\.$/);
    assert.equal(closeWarning(u), '3 families still owe dues, and money is waiting to go back to 2 families. You can still close.');
    assert.equal(closeWarning({ familiesOwing: 1, familiesWaitingToReturn: 0 }), '1 family still owes dues. You can still close.');
    assert.equal(closeWarning({ familiesOwing: 0, familiesWaitingToReturn: 0 }), null, 'nothing owed: no box at all');
    assert.deepEqual(unsettledLines(null), []);
  });

  it('COUNTS, never dollars, anywhere in the window\'s words (D1 until Stage 3)', () => {
    const words = [
      startLead({ fromName: '2026 Season', fromIsLive: true }), rosterCarryDetail(14),
      startWarningTail({ headCoachName: null, seasonName: '2026 Season' }), closeWarning({ familiesOwing: 2, familiesWaitingToReturn: 1 }) ?? '',
    ].join(' ');
    assert.doesNotMatch(words, /\$\s?\d/);
  });

  it('the consequence comes first; who is told names the head coach, or nobody by guess', () => {
    assert.match(startLead({ fromName: '2026 Season', fromIsLive: true }), /^This closes the 2026 Season\./);
    assert.equal(startToldLine('Tom Becker'), 'Tom Becker and the team’s staff are told when it starts.');
    assert.equal(startToldLine(null), 'The team’s staff are told when it starts.');
    assert.equal(rosterCarryDetail(14), 'the 14 active players');
  });

  it('the closed card and the two-open refusal say it in words', () => {
    assert.match(closedCardLine({ teamName: '15U AAA', seasonName: '2026 Season', recordText: '21-6-3' }), /^Final 21-6-3\. 15U AAA has no season running/);
    assert.equal(twoOpenBody(['2026 Season', '2027 Season']), 'The 2026 Season and the 2027 Season. Close one of them before starting another. Nothing was changed.');
  });

  it('the window never names an amount and never sends one: the roll carries the register\'s own close', () => {
    const src = readCode('components/admin/kit/club/SeasonDialogs.tsx');
    assert.doesNotMatch(src, /carryCash|openingBalance|amount/, 'the club\'s window has no money field');
    assert.match(src, /year: yearNum, name: name\.trim\(\), carryBudget, carryFees/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('seasons change only through the season doors (session 1\'s retire list, S2-04)', () => {
  it('the season PATCH refuses a status change before anything is written', () => {
    const src = readCode('app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/route.ts');
    const refuse = src.indexOf("code: 'season_status_retired'");
    const write = src.indexOf('await updateRepProgramYear(yearId, fields)');
    assert.ok(refuse > 0 && write > refuse, 'the refusal comes first');
    assert.doesNotMatch(src, /fields\.status\s*=/, 'nothing may write a season status here any more');
  });

  it('the team page\'s doors call the club\'s season routes, never the retired status path', () => {
    const dialogs = readCode('components/admin/kit/club/SeasonDialogs.tsx');
    assert.match(dialogs, /\/seasons\?orgSlug=[^'`]*`, 'POST'/);
    assert.match(dialogs, /\/seasons\?orgSlug=[^'`]*`, 'PATCH', \{\s*action: 'close', seasonId: target\.id/);
    assert.match(dialogs, /\/program-years\?orgSlug=[^'`]*`, 'POST'/, 'the first season has its own door');
    for (const rel of Object.values(PAGE)) assert.doesNotMatch(readCode(rel), /status: '(completed|archived|active)'/, `${rel} sets a season status`);
  });

  it('the old season pages are gone, and every old address lands on its team-level twin', () => {
    const dir = path.join(ROOT, 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]');
    assert.deepEqual(readdirSync(dir).sort(), ['[[...rest]]']);
    const redirect = readCode('app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/[[...rest]]/page.tsx');
    assert.match(redirect, /new Set\(\['coaches', 'tryouts', 'schedule', 'roster'\]\)/);
    for (const p of ['coaches', 'tryouts', 'schedule', 'roster']) {
      assert.ok(existsSync(path.join(ROOT, `app/[orgSlug]/admin/rep-teams/teams/[teamId]/${p}/page.tsx`)), `the team's ${p} page`);
    }
  });

  it('the per-season coaches route kept its READ only (retire, don\'t copy)', () => {
    const src = readCode('app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts');
    assert.match(src, /export const GET = /);
    assert.doesNotMatch(src, /export const (POST|DELETE|PATCH) = /);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('the formatting benchmark (plan §6 "Across every stage — formatting")', () => {
  it('S2-06: the new tables\' headings are the display face, uppercase, SECONDARY ink — never the admin override', () => {
    const kit = css('components/admin/kit/club/RepKit.module.css');
    const th = kit.slice(kit.indexOf('.table th {'), kit.indexOf('}', kit.indexOf('.table th {')));
    assert.match(th, /font-family: var\(--font-display\)/);
    assert.match(th, /text-transform: uppercase/);
    assert.match(th, /color: var\(--text-secondary\)/);
    for (const rel of Object.values(PAGE)) {
      assert.doesNotMatch(readCode(rel), /rep-teams\.module\.css['"];[\s\S]*styles\.(th|tryoutTh)\b/, `${rel} draws a heading with the S2-06 class`);
    }
  });

  it('figures sit right and tabular, their heading with them; the band row is on the paper tone', () => {
    const kit = css('components/admin/kit/club/RepKit.module.css');
    assert.match(kit, /\.table \.num \{ text-align: right; font-variant-numeric: tabular-nums; \}/);
    assert.match(kit, /\.table tr\.band > td \{[\s\S]*?background: var\(--home-paper\)/);
    const board = readCode(PAGE.board);
    assert.match(board, /<th scope="col" className=\{repKit\.num\}>Roster<\/th>/);
    assert.match(board, /<th scope="col" className=\{repKit\.num\}>Documents<\/th>/);
  });

  it('no links or buttons in the board\'s cells — the name and ONE chevron, nothing conditional beside it', () => {
    const board = readCode(PAGE.board);
    const rows = board.slice(board.indexOf('function BandRows'), board.indexOf('function PhoneBand'));
    const links = rows.match(/<Link\b/g) ?? [];
    assert.equal(links.length, 1, 'the name is the one real link — no second door in a cell');
    assert.doesNotMatch(rows, /<button\b/);
    assert.doesNotMatch(rows, /Invite a coach|Start the/);
  });

  it('a row that opens, opens from anywhere (Ask 8 ruling 5 amended 2026-09-29; standard §3.6)', () => {
    // The tint promises the whole row; the row keeps it. The name stays the real control (keyboard,
    // reader, new tab), a click that ends a text selection opens nothing, and the name's own click
    // stops at the name so one gesture never opens twice.
    const board = readCode(PAGE.board);
    for (const [rel, src] of [
      [PAGE.board, board.slice(board.indexOf('function BandRows'), board.indexOf('function PhoneBand'))],
      [PAGE.documents, readCode(PAGE.documents)],
      [PAGE.tryouts, readCode(PAGE.tryouts)],
    ] as const) {
      assert.match(src, /<tr key=\{[^}]+\} className=\{repKit\.rowOpens\} onClick=\{\(\) => \{ if \(window\.getSelection\(\)\?\.toString\(\)\) return;/, `${rel}: the row opens, guarded against a text selection`);
      assert.match(src, /e\.stopPropagation\(\)/, `${rel}: the name's own click stops at the name`);
      assert.doesNotMatch(src, /goLink[^\n]*tabIndex=\{-1\}/, `${rel}: the chevron is a mark, not a hidden second control`);
    }
    const kit = css('components/admin/kit/club/RepKit.module.css');
    assert.match(kit, /\.table tr\.rowOpens \{ cursor: pointer; \}/, 'a row that opens shows the pointer everywhere it tints');
  });

  it('delete is never a row action; tinted panels stay retired', () => {
    for (const rel of [PAGE.coaches, PAGE.documents, PAGE.tryouts]) {
      assert.doesNotMatch(readCode(rel), /Trash2/, `${rel} puts a delete on a row`);
    }
    const kit = css('components/admin/kit/club/RepKit.module.css');
    const callout = kit.slice(kit.indexOf('.callout {'), kit.indexOf('}', kit.indexOf('.callout {')));
    assert.match(callout, /background: var\(--card-bg\)/, 'a callout is a white card');
    assert.match(callout, /border-left: 3px solid/, 'with a coloured edge');
  });

  it('one chip, uppercase mono (Ask 8 ruling 7)', () => {
    const kit = css('components/admin/kit/club/RepKit.module.css');
    const chip = kit.slice(kit.indexOf('.chip {'), kit.indexOf('}', kit.indexOf('.chip {')));
    assert.match(chip, /font-family: var\(--font-data\)/);
    assert.match(chip, /text-transform: uppercase/);
  });

  it('team details AUTOSAVE (edit saves as you go) with the transient word; creating asks', () => {
    const team = readCode(PAGE.team);
    assert.match(team, /useRecordAutosave\(/);
    assert.match(team, /<SavePill /);
    // The word is PINNED to the window (owner 2026-09-29, §249): at a section's foot it scrolls away,
    // and a failed save that scrolls off-screen is the defect the 2026-09-20 ruling named.
    const kit = css('components/admin/kit/club/RepKit.module.css');
    const pill = kit.slice(kit.indexOf('.savePill {'), kit.indexOf('}', kit.indexOf('.savePill {')));
    assert.match(pill, /position: fixed/, 'the save word is pinned to the window, never in the page flow');
    // …and on a phone it rides ABOVE the admin's bottom nav (/review 2026-09-29: the first version sat
    // at the window's foot under the nav, so a failed save on a phone was invisible).
    assert.match(kit, /@media \(max-width: 900px\) \{\s*\.savePill \{[^}]*bottom: calc\(var\(--bottom-nav-height/, 'the pill clears the bottom nav at ≤900');
    assert.doesNotMatch(team.slice(team.indexOf('function TeamDetails')), />Save<|Save changes/);
    assert.match(readCode('components/admin/kit/club/AddTeamDialog.tsx'), /Add team'\}/, 'a new team is an explicit Add');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('coaches: one door, Remove asks (specimen 5, D10, J4-035)', () => {
  it('the invite has no name field and a required "Who are they?" dropdown', () => {
    const src = readCode('components/admin/kit/club/CoachDialogs.tsx');
    const invite = src.slice(src.indexOf('export function InviteCoachDialog'), src.indexOf('export function CoachPersonDialog'));
    assert.doesNotMatch(invite, /firstName|lastName|Their name/);
    assert.match(invite, /<option value="">Choose one<\/option>/, 'no default seat — the choice is forced');
    assert.match(invite, /kind !== ''/);
  });

  it('removing the ONLY head coach is named in the question, and only then confirmed to the server', () => {
    const src = readCode('components/admin/kit/club/CoachDialogs.tsx');
    assert.match(src, /confirmLastHeadCoach: lastHead/);
    assert.match(src, /code === 'last_head_coach'\) \{ setLastHead\(true\); return; \}/, 'a count that moved asks again');
    assert.match(src, /will have no head coach\./);
  });

  it('the person window names what they can open in the portal\'s own words', () => {
    const caps = resolveCoachCapabilities('assistant_coach', { ...STAFF_PRESETS.manager });
    assert.ok(sensitiveGrantWords(caps).includes('team money'));
    assert.deepEqual(sensitiveGrantWords(resolveCoachCapabilities('assistant_coach', null)), []);
    assert.match(readCode('components/coaches/CoachStaffSheet.tsx'), /sensitiveGrantWords/, 'the portal names grants with the same list');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('tryouts on the live season (specimen 7, B07, S2-05)', () => {
  it('Waitlist is a real action; a decline ASKS because it is final; the one-click-restore promise is gone', () => {
    const src = readCode('components/admin/kit/club/TryoutDialogs.tsx');
    assert.match(src, /onStatus\('waitlisted'\)/);
    assert.match(src, /setConfirmDecline\(true\)/);
    assert.match(src, /A declined application is final/);
    for (const rel of [PAGE.tryouts, 'components/admin/kit/club/TryoutDialogs.tsx']) {
      assert.doesNotMatch(readCode(rel), /change back in one click|brought back in one click/i);
    }
  });

  it('a closed season\'s tryout is a record: no sign-up switch, no Add applicant, no action', () => {
    const src = readCode(PAGE.tryouts);
    assert.match(src, /canWrite && isLive \? \(\s*<button/, 'Add applicant only on the live season');
    assert.match(src, /canAct=\{canWrite && isLive\}/);
    assert.match(src, /\{isLive \? \(\s*<ClubSection\s+id="signups"/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('the coach\'s side (specimens 4 and 6)', () => {
  it('the refused save is recognised by its code, on a portal TEAM route, for this team only', () => {
    assert.equal(isSeasonNotLiveBody({ code: 'season_not_live', error: 'x', seasonName: null, closedBy: 'club' }), true);
    assert.equal(isSeasonNotLiveBody({ code: 'forbidden', error: 'x' }), false);
    assert.equal(isSeasonNotLiveBody(null), false);
    assert.equal(isPortalTeamRequest('/api/coaches/north/teams/t1/roster/p1'), true);
    assert.equal(isPortalTeamRequest('/api/admin/rep-teams/teams/t1'), false);
    assert.equal(isForTeam('/api/coaches/north/teams/t1/roster', 't1'), true);
    assert.equal(isForTeam('/api/coaches/north/teams/t10/roster', 't1'), false, 'a prefix of another team id is not this team');
  });

  it('the notice is mounted inside the team layout, beside the season gate', () => {
    assert.match(readCode('app/[orgSlug]/coaches/teams/[teamId]/layout.tsx'), /<CoachSeasonRefusalNotice teamId=\{teamId\}/);
  });

  it('the started card names only what actually came, and the welcome never guesses a name', () => {
    const card = clubSeasonStartedCard({ clubName: 'Northfield', seasonName: '2027 Season', previousSeasonName: '2026 Season',
      carried: { players: 14, budgetPlan: false, feePlan: true, openingBalance: true } });
    assert.equal(card.title, 'Northfield started the 2027 Season');
    assert.equal(card.body, 'Came with the team: 14 players, the fee plan and the opening balance. Tryouts are closed until you open them. The 2026 Season is kept as a record.');
    // The bell says the same, with the team in front.
    assert.equal(clubSeasonNotice({ clubName: 'Northfield', teamName: '9U A', action: 'started', seasonName: '2027 Season',
      previousSeasonName: '2026 Season', carried: { players: 14, budgetPlan: false, feePlan: true, openingBalance: true } }).body, `9U A · ${card.body}`);
    const welcome = clubWelcomeCard({ teamName: '10U A', firstName: null, clubName: 'Northfield', roleWord: 'head coach', namedOn: 'Sep 28', players: 13, otherStaff: 2 });
    assert.equal(welcome.title, 'Welcome to 10U A');
    assert.equal(welcome.body, 'Northfield named you head coach on Sep 28. Your team is already here: 13 players and 2 staff.');
    assert.doesNotMatch(`${welcome.title} ${welcome.body}`, /\b(he|she|his|her)\b/i);
  });

  it('the arrival read is club-only and the working season only — never a year the caller names', () => {
    const src = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/club-arrival/route.ts');
    assert.match(src, /resolveCoachTeamRead\(orgSlug, teamId\)/);
    assert.match(src, /if \(isReadOnly \|\| orgManagesOwnSeasons\(ctx\.org\)\) return none;/);
    assert.doesNotMatch(src, /searchParams|\?year=/);
  });

  it('"Your club" is a notification row on a CLUB coach\'s card only', () => {
    const client = readCode('app/(consumer)/account/notifications/AccountNotificationsClient.tsx');
    assert.match(client, /clubTeam \? \['coach_insights_digest', 'practice_plan_sent', 'club_season_changed'\]/);
    assert.match(readCode('app/(consumer)/account/notifications/page.tsx'), /clubTeam: {10}ctx\.isTeamWorkspace !== true/);
  });

  it('the home card answers a club invitation only for a CONFIRMED address, and a decline tells the club', () => {
    const route = readCode('app/api/auth/coach-invitations/[inviteId]/route.ts');
    assert.match(route, /if \(!user\.email \|\| !user\.email_confirmed_at\)/);
    assert.match(route, /await tellClubInviteDeclined\(declined, user\)/);
    const lib = readCode('lib/assistant-invites.ts');
    // The by-id accept reaches only a CLUB invitation addressed to this account (/review).
    const byId = lib.slice(lib.indexOf('export async function acceptAssistantInviteById'), lib.indexOf('async function acceptInviteRow'));
    assert.match(byId, /\.eq\('sent_by', 'club'\)[\s\S]*\.eq\('invited_email', userEmail\.trim\(\)\.toLowerCase\(\)\)/);
    const decline = lib.slice(lib.indexOf('export async function declineClubCoachInvite'));
    assert.match(decline, /\.eq\('status', 'pending'\)[\s\S]*\.eq\('sent_by', 'club'\)[\s\S]*\.eq\('invited_email', address\)/);
    assert.equal(NOTIFICATION_CATEGORY.club_coach_declined, 'know');
    assert.ok(NOTIFICATION_EVENT_LABELS.club_coach_declined);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('the screens share the kit\'s notices and first read (/simplify)', () => {
  const kitFiles = [
    ...Object.values(PAGE),
    'components/admin/kit/club/CoachDialogs.tsx',
    'components/admin/kit/club/SeasonDialogs.tsx',
  ];

  it('no screen or window re-assembles the callout by hand — it renders Callout or LoadFailed', () => {
    for (const rel of kitFiles) {
      assert.doesNotMatch(readCode(rel), /\$\{repKit\.callout\}/, `${rel} builds a callout by hand`);
    }
  });

  it('every screen runs its first read through useDeferredLoad and waits with PageLoading', () => {
    for (const rel of Object.values(PAGE)) {
      const src = readCode(rel);
      assert.match(src, /useDeferredLoad\(/, `${rel} runs its own first-read effect`);
      assert.match(src, /<PageLoading header=/, `${rel} draws its own loading line`);
      assert.doesNotMatch(src, /requestAnimationFrame/, `${rel} defers its read by hand`);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
describe('what /review fixed stays fixed', () => {
  it('every screen lets only its newest read write (a reload after a write, another team in the same page)', () => {
    for (const rel of Object.values(PAGE)) {
      const src = readCode(rel);
      assert.match(src, /const beginRead = useLatestRead\(\);/, `${rel} reads without the newest-read guard`);
      assert.match(src, /if \(current\(\)\) setLoading\(false\)/, `${rel} ends a stale read's loading state`);
    }
  });

  it('Roster, Schedule and Tryouts say so while a team holds two open seasons', () => {
    for (const rel of [PAGE.roster, PAGE.schedule, PAGE.tryouts]) {
      assert.match(readCode(rel), /<TwoOpenNote /, `${rel} shows one of two open seasons silently`);
    }
  });

  it('a template made for a team that was since archived still names that team in its window', () => {
    assert.match(readCode(PAGE.documents), /teams\?light=1&archived=true&/);
    assert.match(readCode('components/admin/kit/club/TemplateDialogs.tsx'), /teams\.filter\(t => !t\.isArchived \|\| t\.id === value\)/);
  });

  it('the welcome card dates the naming by the invitation, not the acceptance', () => {
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/club-arrival/route.ts'), /namedOn: formatStoredDate\(invite\.created_at/);
  });

  it('a pending team-details edit is sent before leaving or archiving', () => {
    const src = readCode(PAGE.team);
    assert.match(src, /useEffect\(\(\) => \(\) => \{ if \(pending\.current\.dirty\) void pending\.current\.handleSave\(\); \}, \[\]\)/);
    assert.match(src, /if \(dirty && !\(await handleSave\(\)\)\) return;\s*onArchive\(\);/);
  });
});
