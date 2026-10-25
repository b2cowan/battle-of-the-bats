import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { DELETE_DOOR, deleteSeasonWords } from '../../lib/house-league-status-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * DELETING A SEASON THAT IS ONLY A SHELL (owner, 2026-10-25). A season may be deleted only while it has NOT opened
 * registration and nothing real is attached (a family, a team, a game, a sent email, an entry in its book); once it is
 * official it is archived, never deleted. The server enforces the rule; the page only leaves the door out.
 *   1. The server: same people as editing, a finished season refused through the one gate, draft-only, nothing attached,
 *      and the status guard is inside the delete itself (a season that opened a moment ago is not deleted).
 *   2. What counts as attached: families, teams, games, both email logs and the BOOK'S ENTRIES — not setup. The book has no
 *      foreign key to the season, so an empty one is removed with it (first) and one with entries stops the delete.
 *   3. The page: the door shows only to someone who can run the league, only for a deletable season; both windows navigate
 *      with themselves still open (KitDialog's header: closing first lets its Back step cancel the push) and stay busy.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
describe('delete a season that is only a shell — the server', () => {
  const route = readCode('app/api/admin/house-league/seasons/[seasonId]/route.ts');
  const del = route.slice(route.indexOf('export const DELETE'));
  const db = readCode('lib/db.ts');
  const fnBody = (name: string) => {
    const from = db.slice(db.indexOf(`export async function ${name}`));
    return from.slice(0, from.indexOf('\n}\n'));
  };

  it('is the run permission, and a finished season is refused through the one gate', () => {
    assert.match(del, /houseLeagueRefusal\(ctx, 'run', season\)/);
  });

  it('refuses a season that has opened registration, and one with anything real attached — each with its own 409', () => {
    assert.match(del, /season\.status !== 'draft'\) \{\s*return NextResponse\.json\(\{ error: 'Only a season that has not opened registration[^']*' \}, \{ status: 409 \}\);/);
    assert.match(del, /getLeagueSeasonAttachments\(seasonId, ctx!\.org\.id\)\)\.any\) \{\s*return NextResponse\.json\(\{ error: 'This season already has[^']*' \}, \{ status: 409 \}\);/);
    // The draft check and the attachment check both come BEFORE the delete.
    assert.ok(del.indexOf("season.status !== 'draft'") < del.indexOf('deleteDraftLeagueSeason('));
    assert.ok(del.indexOf('getLeagueSeasonAttachments(') < del.indexOf('deleteDraftLeagueSeason('));
  });

  it('deletes through the helper that carries the draft guard itself, scoped to the org', () => {
    assert.match(del, /deleteDraftLeagueSeason\(seasonId, ctx!\.org\.id\)/);
    const body = fnBody('deleteDraftLeagueSeason');
    const season = body.slice(body.indexOf("from('league_seasons')"));
    assert.match(season, /\.delete\(\)/);
    assert.match(season, /\.eq\('org_id', orgId\)/);
    assert.match(season, /\.eq\('status', 'draft'\)/);
  });

  it('counts families, teams, games, both email logs and the book\'s entries as attached — and only those', () => {
    const body = fnBody('getLeagueSeasonAttachments');
    for (const table of ['league_registrations', 'league_teams', 'league_games', 'league_email_log', 'league_notification_log', 'accounting_entries']) {
      assert.ok(body.includes(`'${table}'`), `${table} counts as attached`);
    }
    // The book has no foreign key to the season, so it is found by org + season and its entries counted by its own id.
    assert.match(body, /getLeagueSeasonLedger\(orgId, seasonId\)/);
    assert.match(body, /\.eq\('ledger_id', book\.id\)/);
    // Setup is not attachment: divisions and practices go with the season.
    assert.ok(!body.includes('league_divisions') && !body.includes('league_practices'));
  });

  it('removes the season\'s (empty) book with it — first, and scoped to the org', () => {
    const body = fnBody('deleteDraftLeagueSeason');
    assert.match(body, /from\('accounting_ledgers'\)[\s\S]*\.delete\(\)[\s\S]*\.eq\('org_id', orgId\)[\s\S]*\.eq\('entity_type', 'league_season'\)[\s\S]*\.eq\('entity_id', seasonId\)/);
    assert.ok(body.indexOf("from('accounting_ledgers')") < body.indexOf("from('league_seasons')"), 'the book goes before the season');
  });

  it('tells the page whether the door applies, only for a draft, and a failed count never breaks the read', () => {
    assert.match(route, /const deletable = season\.status === 'draft'\s*&& await getLeagueSeasonAttachments\(seasonId, ctx!\.org\.id\)\.then\(a => !a\.any, \(\) => false\);/);
  });
});

describe('delete a season that is only a shell — the page and its windows', () => {
  const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx');
  const win = readCode('components/admin/kit/club/league/DeleteSeasonWindow.tsx');

  it('shows the door only to someone who can run the league, and only for a deletable season', () => {
    assert.match(page, /canRun && detail\.deletable &&/);
    assert.match(page, /DELETE_DOOR\.link/);
  });

  it('leaves for the Seasons list with the window still open', () => {
    assert.match(page, /onDeleted=\{\(\) => \{ announceSeasonsChanged\(\); router\.push\(`\/\$\{orgSlug\}\/admin\/house-league`\); \}\}/);
    // The window never closes itself on success.
    const go = win.slice(win.indexOf('async function go'), win.indexOf('return (\n    <KitDialog'));
    assert.match(go, /onDeleted\(\)/);
    assert.ok(!/onClose|setDeleting/.test(go), 'closing first lets the Back step cancel the navigation');
  });

  it('Create stays busy once the season is made, and the list opens it without closing the window first', () => {
    const create = readCode('components/admin/kit/club/CreateLeagueSeasonDialog.tsx');
    const fn = create.slice(create.indexOf('async function create'), create.indexOf('return (\n    <KitDialog'));
    // No `finally`: busy is cleared on a refusal or a failure, never on success — a live Create would send a second request
    // and a live Cancel would cancel the move while the new page opens.
    assert.ok(!/finally\s*\{/.test(fn), 'nothing clears busy after onCreated');
    assert.ok(fn.indexOf('setBusy(false)') < fn.indexOf('onCreated('), 'busy is cleared only on the failure paths');
    const list = readCode('app/[orgSlug]/admin/house-league/page.tsx');
    const onCreated = list.slice(list.indexOf('onCreated={season =>'), list.indexOf('{capHit &&'));
    assert.match(onCreated, /router\.push\(`\$\{base\}\/seasons\/\$\{season\.id\}`\)/);
    assert.ok(!/setCreating\(false\)/.test(onCreated), 'the Create window is not closed before the push');
  });

  it('asks, says what goes, and says a refusal in the window', () => {
    assert.match(win, /method: 'DELETE'/);
    assert.match(win, /role="alert"/);
    assert.match(win, /btn btn-danger/);
  });
});

describe('delete a season that is only a shell — the words', () => {
  it('name the season, say it is permanent, and keep one spelling', () => {
    const w = deleteSeasonWords('test season');
    assert.equal(w.title, 'Delete test season?');
    assert.equal(w.phoneTitle, 'Delete the season?');
    assert.equal(w.button, 'Delete season');
    assert.equal(w.foot, 'This can’t be undone.');
    assert.equal(w.looseEnds.length, 0);
    assert.equal(DELETE_DOOR.link, 'Delete the season…');
  });
});
