import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { accountingTabFor, accountingTabs } from '../../lib/admin-kit-nav.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB ACCOUNTING · TEAMS — the shape the owner ruled (2026-10-16, all eight asks as recommended; hub
 * M3iNQq4N8cRWeZCdN6G8Ps v3; plan docs/projects/active/CLUB_ACCOUNTING_TEAMS_PLAN.md §7).
 *
 *   1. a Teams tab, SECOND, that lights on the list AND on a team's account (the account is a view of the tab);
 *   2. the account has no page header — a lead Team pill moves between teams; it reads its season line and Needs you
 *      from its own read;
 *   3. the Overview keeps a CARD (two counts, the band's own read), never the table;
 *   4. a request opens OVER the page you are on: Payment requests and the account mount the one shared flow, and the
 *      account holds no door to Payment requests;
 *   5. "In Rep Teams" only for someone who can open Rep Teams;
 *   6. the dropdown's option groups are opt-in — no other caller's list moves.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ACCOUNT = 'app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx';
const TEAMS = 'app/[orgSlug]/admin/accounting/teams/page.tsx';
const OVERVIEW = 'app/[orgSlug]/admin/accounting/page.tsx';
const REQUESTS = 'app/[orgSlug]/admin/accounting/payment-requests/page.tsx';
const FRAME = 'components/admin/kit/club/money/AccountingFrame.tsx';
const TABLE = 'components/admin/kit/club/money/TeamsTable.tsx';
const FLOW = 'components/admin/kit/club/money/RequestFlow.tsx';
const DROPDOWN = 'components/coaches/SingleSelectDropdown.tsx';
const BASE = '/club/admin';
const REP = { runsRepTeams: true };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full.split(path.sep).join('/')] : [];
  });
}

describe('1 · Teams is the second tab and lights on a team’s account', () => {
  it('second, and only where the club runs rep teams', () => {
    assert.deepEqual(accountingTabs(BASE, REP).map(t => t.id).slice(0, 2), ['overview', 'teams']);
    assert.ok(!accountingTabs(BASE, { runsRepTeams: false }).some(t => t.id === 'teams'));
  });
  it('lit on the list and on a team; nothing else takes a prefix', () => {
    assert.equal(accountingTabFor(`${BASE}/accounting/teams`, BASE, REP), 'teams');
    assert.equal(accountingTabFor(`${BASE}/accounting/teams/t1`, BASE, REP), 'teams');
    assert.equal(accountingTabFor(`${BASE}/accounting/budget-vs-actual`, BASE, REP), 'budget-vs-actual');
  });
  it('the frame never names the browser tab on a team’s account — the page does, and the frame’s effect runs after it', () => {
    assert.match(readCode(FRAME), /const title = lit && pathname === lit\.href \?/);
    assert.match(readCode(ACCOUNT), /usePageTitle\(`\$\{read\?\.team\.name \?\? 'Team'\} · Teams · Accounting`\)/);
  });
});

describe('2 · a team’s account is a view of the tab', () => {
  const page = readCode(ACCOUNT);
  it('no page header, no back arrow, no crumbs — the tab row says where you are', () => {
    assert.doesNotMatch(page, /AdminPageHeader|backTo=|crumbs=/);
  });
  it('the Team pill is the Book pill’s control, leading, and REPLACES the address', () => {
    assert.match(page, /<SingleSelectDropdown lead shrink fill label=\{W\.pill\} options=\{teamPillOptions\(teams, team\)\} value=\{team\.id\} onChange=\{pick\} \/>/);
    assert.match(page, /const pick = \(id: string\) => router\.replace\(id === ALL_TEAMS \? `\$\{base\}\/teams` : `\$\{base\}\/teams\/\$\{id\}`\);/);
  });
  it('the pill’s teams sit under their group, in the table’s own order and words, each with its amber count in the LIST only', () => {
    assert.match(page, /\.\.\.teamsByGroup\(list\)\.flatMap\(g => g\.teams\.map\(t => \(\{/);
    assert.match(readCode(TABLE), /const groups = teamsByGroup\(teams\);/, 'the table and the pill share one order');
    assert.match(page, /group: grouped \? g\.group \?\? TEAMS_WORDS\.noGroup : undefined/);
    assert.match(page, /rowMark: t\.requestsWaiting > 0 \? <WaitingCount n=\{t\.requestsWaiting\} \/> : undefined/);
  });
  it('the season line and Needs you are the read’s own, never worked out here', () => {
    assert.match(page, /const \{ account, team, needsYou, season, headCoaches \} = read;/);
    assert.match(page, /\{needsYou\.count > 0 && \(/, 'Needs you only when something waits');
    assert.match(readCode('lib/club-money-reads.ts'), /const needsYou = teamNeedsYou\(\{/);
    assert.match(readCode('lib/club-money-reads.ts'), /const owed = owedRows\(loop, \[\.\.\.loop\.allocations\.values\(\)\], \(\) => true, today, null\);/,
      'the one reading of "still owed", every year');
  });
  it('one lock line under the band; "Nothing here can be changed" is gone (Ask 7)', () => {
    assert.match(page, /\{W\.lockLine\(team\.name, cash\?\.season\?\.live \?\? true\)\}/);
    assert.doesNotMatch(page, /<Callout|teamAccountCallout/);
    assert.doesNotMatch(readCode('lib/club-money-words.ts'), /Nothing here can be changed/);
  });
  it('the statement keeps its card-on-a-phone frame, its held figure and its Export', () => {
    assert.match(page, /className=\{`\$\{repKit\.tableFrame\} \$\{ledgerKit\.cardsFrame\}`\}/);
    assert.match(page, /key: 'cash', label: 'Cash on hand', held: true,/);
    assert.match(page, /<CoachListToolbar actions=\{<StatementExport read=\{read\} orgSlug=\{orgSlug\} \/>\}>/);
  });
});

describe('3 · the Overview keeps a card, read from its band’s own read', () => {
  const code = readCode(OVERVIEW);
  it('no teams table, no held band on the Overview', () => {
    assert.doesNotMatch(code, /<TeamsTable\b|TeamsTable\(|heldBand/);
  });
  it('its counts are the summary’s, every year (C1)', () => {
    assert.match(code, /const late = summary\.position\.owedByTheTeams\.lateTeams;/);
    assert.match(code, /const waiting = summary\.position\.waitingOnYou\.teams;/);
    assert.match(readCode('lib/club-budget-report.ts'), /lateTeams: teamsWithMoneyLate\(allocations\.flatMap\(a => a\.splits\), today\),/,
      'over the SAME allocations as Owed by the teams');
  });
  it('the moved table is used by the Teams tab only', () => {
    const users = [...walk('app'), ...walk('components')].filter(f => f !== TABLE && /from '@\/components\/admin\/kit\/club\/money\/TeamsTable'/.test(readCode(f)));
    assert.deepEqual(users, [TEAMS]);
  });
  it('the Teams tab reads the Overview’s own read — one definition of every figure on the two screens', () => {
    assert.match(readCode(TEAMS), /moneyFetch<Read>\(`\/api\/admin\/accounting\/summary\?/);
  });
});

describe('4 · a request opens over the page you are on (one flow, one door per kind)', () => {
  it('Payment requests and the account mount the one shared flow', () => {
    assert.match(readCode(REQUESTS), /<RequestFlow key=\{open\.id\} request=\{open\}/);
    assert.match(readCode(ACCOUNT), /<RequestFlow key=\{openRequest\.id\} request=\{openRequest\}/);
    assert.doesNotMatch(readCode(REQUESTS), /<ApproveWindow|<DeclineWindow|<ReverseWindow|<AnswerWindow/, 'the wiring lives in the flow, once');
  });
  it('the account holds no door to Payment requests — statement and Needs you rows open the request over the page', () => {
    const page = readCode(ACCOUNT);
    assert.doesNotMatch(page, /payment-requests\?request=/);
    assert.match(page, /: \{ request: r\.sourceId \};/, 'a statement request row opens the request');
    assert.match(page, /<NeedsYou needs=\{needsYou\} teamName=\{team\.name\} isPhone=\{isPhone\} onOpen=\{r => open\(r\.door\)\} \/>/);
  });
  it('a refused answer keeps its window: the account re-reads its requests IN PLACE, and a click retries a failed read', () => {
    const page = readCode(ACCOUNT);
    const answered = page.slice(page.indexOf('const answered = '), page.indexOf('};', page.indexOf('const answered = ')));
    assert.match(answered, /void loadRequests\(\);/);
    assert.doesNotMatch(answered, /setRequests\(null\)/, 'nulling the rows unmounts the open question and its server sentence');
    assert.match(page, /setRequestId\(door\.request\);\s*if \(!requests\) void loadRequests\(\);/);
    assert.doesNotMatch(page, /^let teamList/m, 'no team list kept in the tab between visits (it would outlive its reader)');
  });
  it('the flow is Payment requests’ own wiring: a waiting hand-back opens Answer, Approve / Decline / Reverse ask first', () => {
    const flow = readCode(FLOW);
    for (const w of ['<AnswerWindow', '<RequestWindow', '<ApproveWindow', '<DeclineWindow', '<ReverseWindow']) assert.ok(flow.includes(w), w);
  });
});

describe('5 · two pages about one team link both ways for whoever can open both', () => {
  it('"In Rep Teams" is gated on Rep Teams, and opens the team’s page', () => {
    assert.match(readCode(ACCOUNT), /\{canOpen\('module_rep_teams'\) && \(\s*<ClubSection id="in-rep-teams"/);
    assert.match(readCode(ACCOUNT), /href=\{`\/\$\{orgSlug\}\/admin\/rep-teams\/teams\/\$\{team\.id\}`\}/);
  });
});

describe('6 · the dropdown’s groups and its list-only mark are opt-in', () => {
  const dd = readCode(DROPDOWN);
  it('a list-only mark never reaches the pill; the pill draws only `mark` and `pillMark`', () => {
    assert.match(dd, /<span className=\{styles\.multiSelectValue\}>\{chosenLabel\}\{chosen\?\.mark\}\{chosen\?\.pillMark\}<\/span>/);
    assert.match(dd, /\{o\.mark\}\s*\{o\.rowMark\}/);
  });
  it('options with no group render as before; a group gets a labelled heading', () => {
    assert.match(dd, /sec\.group == null\s*\? sec\.items\.map\(choice\)/);
    assert.match(dd, /role="group" aria-labelledby=\{`\$\{groupId\}-\$\{i\}`\}/);
  });
  it('only the Team pill passes a group or a list-only mark — no other caller’s list moves', () => {
    const callers = [...walk('app'), ...walk('components')].filter(f => f !== DROPDOWN && /<SingleSelectDropdown\b/.test(readCode(f)));
    // Inside each call (to its closing "/>"), no `group:` — the Team pill builds its options apart (`teamPillOptions`).
    for (const f of callers) {
      const code = readCode(f);
      for (const m of code.matchAll(/<SingleSelectDropdown\b/g)) {
        assert.doesNotMatch(code.slice(m.index, code.indexOf('/>', m.index)), /\bgroup: |\browMark: /, `${f} passes a group inside the call`);
      }
    }
    assert.deepEqual(callers.filter(f => /\browMark: /.test(readCode(f))), [ACCOUNT]);
    assert.match(readCode(ACCOUNT), /function teamPillOptions\(/);
  });
  it('the panel scrolls inside itself (a 30-team list stays in the viewport)', () => {
    assert.match(readCode('components/shared/FilterPill.module.css'), /\.multiSelectPanel \{[^}]*max-height: 320px; overflow-y: auto;/);
  });
});

describe('7 · one spelling', () => {
  it('"No group" on the Teams surfaces, never "Ungrouped"', () => {
    for (const f of [ACCOUNT, TEAMS, TABLE]) assert.doesNotMatch(readCode(f), /Ungrouped/, f);
    assert.match(readCode('lib/club-money-words.ts'), /const NO_GROUP_WORD = 'No group';/);
  });
});
