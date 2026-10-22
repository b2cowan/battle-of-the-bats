import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * OUR TEAM HAS ONE ANSWER (Club Tier Stage 7b, owner 2026-10-21). A registration linked to a rep team of the club that hosts the
 * tournament is "our team" and owes no entry fee ON EVERY PLAN — the database's rule (mig 345 refuses its fee). Before 7b there
 * were four answers: the Teams page and the dashboard added "carries Accounting", the coach's record added "is on the Club plan",
 * and the payment reminders, the check-in board, the export, the recap and the coach's fee tile asked nothing at all, so entering
 * the club's teams in bulk would have reminded them of a fee nobody can record.
 *
 * The census: every file that works out what a team owes asks lib/club-own-tournament-team.ts (or takes the answer from a caller
 * that does), or is exempt with its reason. A new reader fails here until it does.
 */

const OWES_READ = /registrationAmountDue\(|computePaymentStatus\(|paymentFact\(|acceptanceFeeLine\(|paymentReadinessStatus\(|paymentDue\(|status\.fee\.amountDue|effectiveFee\(|registrationFee\(|feeOf\(/;
const ASKS = /club-own-tournament-team|isClubOwnTeam|feeExempt|\bourTeam\b/;

const EXEMPT: Record<string, string> = {
  'lib/registration-amount-due.ts': 'pure fee arithmetic; the reminder route and lib/needs-attention.ts take our team out before calling it',
  'lib/tournament-teams.ts': 'pure fee arithmetic; the Teams page answers "No fee" for our team before calling it',
  'lib/mark-paid.ts': 'fee resolution for Mark paid; the database refuses a fee for our team (mig 345) and the routes ask first',
  'lib/email.ts': 'templates; the routes that send them decide the fee line (our team gets none)',
  'app/dev/email-preview/page.tsx': 'dev-only template preview',
};

describe('our team has one answer (Stage 7b)', () => {
  const files = ['app', 'components', 'lib']
    .flatMap(d => [...filesUnder(d, '.ts'), ...filesUnder(d, '.tsx')])
    .filter(rel => !rel.endsWith('.test.ts'))
    .map(rel => ({ rel, code: readCode(rel) }))
    .filter(f => OWES_READ.test(f.code));

  it('finds the readers it expects (the census is not reading an empty tree)', () => {
    assert.ok(files.length >= 12, `only ${files.length} files work out what a team owes`);
  });

  it('every reader of what a team owes asks the one answer, or is exempt with a reason', () => {
    const missing = files.filter(f => !ASKS.test(f.code) && !(f.rel in EXEMPT)).map(f => f.rel);
    assert.deepEqual(missing, [], 'a file works out what a team owes without asking whether it is our team');
  });

  it('every exemption still reads what a team owes (a stale entry is removed, not left to hide a file)', () => {
    const readers = new Set(files.map(f => f.rel));
    assert.deepEqual(Object.keys(EXEMPT).filter(rel => !readers.has(rel)), []);
  });

  it('the answer carries no plan, module or accounting gate (the database has none)', () => {
    const helper = readCode('lib/club-own-tournament-team.ts');
    assert.doesNotMatch(helper, /hasModuleEntitlement|module_accounting|plan_id|planId|hasPlanFeature/);
    assert.match(helper, /row\.org_id === hostOrg && repOrg === hostOrg/, 'the link, the rep team and the tournament are one club');
  });

  it('no screen keeps its own gated copy of the answer', () => {
    const page = readCode('app/[orgSlug]/admin/tournaments/registrations/page.tsx');
    assert.doesNotMatch(page, /orgCarriesAccounting/, 'the Teams page decided "our team" with an Accounting gate');
    assert.match(page, /\/api\/admin\/teams\/our-teams/, 'the Teams page reads our teams from the server');
    const dashboard = readCode('app/api/admin/tournament-dashboard/route.ts');
    assert.match(dashboard, /clubOwnTeamIds = await ourTournamentTeamIds\(tournamentId\)/);
    assert.doesNotMatch(dashboard, /getRepTeamLinksForTournament/);
    const record = readCode('components/coaches/CoachTournamentRecord.tsx');
    assert.doesNotMatch(record, /plan_id === 'club'/, 'the coach\'s record decided "our team" with a plan gate');
  });

  it('the payment reminders, the check-in board and the export take our team out', () => {
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/payment-reminders/route.ts'), /ourTeams\.has\(team\.id\)/);
    assert.match(readCode('app/api/admin/check-in/route.ts'), /owed: ourTeams\.has\(t\.id\) \? 0/);
    assert.match(readCode('components/admin/CheckInBoard.tsx'), /if \(team\.ourTeam\) return <span>No fee<\/span>/);
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts'), /ourTeams\.has\(team\.id\) \? 'No fee'/);
    assert.match(readCode('app/api/admin/communications/route.ts'), /ourTeams\.has\(t\.id\) \? \{ \.\.\.t, payment_status: 'paid' \}/);
  });
});
