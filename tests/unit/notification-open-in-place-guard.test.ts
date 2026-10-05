/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * NOTIFICATIONS OPEN IN PLACE (owner ruling 2026-10-05, D1–D9 — plan
 * docs/projects/active/NOTIFICATIONS_OPEN_IN_PLACE_PLAN.md). Built in three steps; each adds its own
 * checks here.
 *
 * STEP 1 · the rules under every surface — three words for three things:
 *   READ   = seen (on open, or Mark all read — which now marks EVERYTHING, D9).
 *   DONE   = dealt with (Needs attention only; the old "Clear", D8; the only thing that writes
 *            `cleared_at`, so the only thing that moves a row out of Needs attention).
 *   DELETE = gone from your own list (D3; Undo for a few seconds; nobody else's copy).
 * Never let one do another's job: Mark all read must never write `cleared_at`, and a delete must
 * never reach past the caller's own rows.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource, functionBody, callbackBody } from './_source-code.ts';
import { ADMIN_PAGE } from '../../lib/notification-view.ts';
import { accountingTabs, kitOrgLinks, kitPrograms, kitTournamentLabel } from '../../lib/admin-kit-nav.ts';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { BRING_IN_PAGE_TITLE } from '../../lib/team-move-words.ts';

const ROUTE = 'app/api/notifications/route.ts';
const FEED = 'components/notifications/useNotificationFeed.ts';
const PANEL = 'components/notifications/NotificationPanel.tsx';
const BODY = 'components/notifications/NotificationFeedBody.tsx';
const READER = 'components/coaches/CoachNotificationReader.tsx';

/** One action's branch of the route's POST: from its `body.action === '…'` to the next one. */
function routeBranch(action: string): string {
  const code = readCode(ROUTE);
  const start = code.indexOf(`body.action === '${action}'`);
  assert.ok(start > 0, `the route's '${action}' action is gone — the guard reads it`);
  const next = code.indexOf('body.action ===', start + 1);
  return code.slice(start, next > 0 ? next : undefined);
}

describe('D9 · Mark all read marks everything, and never marks anything Done', () => {
  it('the server marks every unread row read, Needs attention included', () => {
    const branch = routeBranch('mark-all-read');
    assert.match(branch, /\.update\(\{ read_at: now \}\)/);
    assert.match(branch, /\.eq\('user_id', user\.id\)/);
    assert.doesNotMatch(branch, /event_type/, 'mark-all no longer skips a kind of notification (D9)');
    assert.doesNotMatch(readCode(ROUTE), /ACT_EVENT_TYPES|ACT_EXCLUDE_IN/, 'the 09-03 skip is gone from the route');
  });

  it('it never writes cleared_at — server or either client', () => {
    assert.doesNotMatch(routeBranch('mark-all-read'), /cleared_at/);
    assert.doesNotMatch(callbackBody(readCode(FEED), 'markAllRead'), /clearedAt|ACT_EVENT_TYPES/);
    assert.doesNotMatch(functionBody(readCode(PANEL), 'handleMarkAllRead'), /clearedAt|ACT_EVENT_TYPES/);
  });

  it('cleared_at has exactly one writer: Done (the route\'s clear action)', () => {
    const code = readCode(ROUTE);
    const writes = code.match(/cleared_at:/g) ?? [];
    assert.equal(writes.length, 1, 'one update writes cleared_at');
    assert.match(routeBranch('clear'), /cleared_at: now/);
  });

  it('the button shows whenever anything is unread — not only activity', () => {
    assert.match(readCode(FEED), /const anyUnread = items\.some\(n => !n\.readAt\);/);
    assert.match(readCode(PANEL), /const canMarkAllRead = notifications\.some\(n => !n\.readAt\);/);
  });
});

describe('D3 · Delete removes the caller\'s own copy, after an Undo window', () => {
  it('the server deletes only the caller\'s rows, and only rows it was named', () => {
    const branch = routeBranch('delete');
    assert.match(branch, /\.delete\(\)/);
    assert.match(branch, /\.in\('id', ids as string\[\]\)/);
    assert.match(branch, /\.eq\('user_id', user\.id\)/, 'a delete never reaches another person\'s copy');
    assert.doesNotMatch(branch, /\.eq\('org_id'/, 'scoped by owner, not by org — an id is enough with user_id');
  });

  it('the client sends the delete only when its Undo window ends (or the surface goes)', () => {
    const code = readCode(FEED);
    const sends = code.match(/action: 'delete'/g) ?? [];
    assert.equal(sends.length, 1, 'one place sends a delete');
    assert.match(callbackBody(code, 'sendPendingDelete'), /action: 'delete'/);
    assert.match(callbackBody(code, 'deleteRows'), /setTimeout\(sendPendingDelete, UNDO_WINDOW_MS\)/);
    assert.match(code, /addEventListener\('pagehide', sendPendingDelete\)/, 'leaving the page sends it');
    assert.match(code, /keepalive: true/, 'and the request outlives the page');
    assert.doesNotMatch(callbackBody(code, 'undoDelete'), /postAction/, 'Undo sends nothing');
  });

  it('the server takes only well-formed ids, and the client never sends more than it takes', () => {
    assert.match(routeBranch('delete'), /UUID_RE\.test\(id\)/, 'a malformed id is a 400, not a failed cast');
    assert.match(routeBranch('delete'), /ids\.length > NOTIFICATION_DELETE_MAX_IDS/);
    // One limit, shared: a bundle bigger than one request is sent in batches (/review 2026-10-05).
    assert.match(callbackBody(readCode(FEED), 'sendPendingDelete'), /i \+= NOTIFICATION_DELETE_MAX_IDS/);
  });

  it('a delete cannot strand Load more or cross into another organization', () => {
    const code = readCode(FEED);
    // The cursor is where the server's last page ended, never the last row still on screen: delete
    // every loaded row and the list must still be able to load older ones (/review 2026-10-05).
    const loadMore = callbackBody(code, 'loadMore');
    assert.match(loadMore, /const oldest = cursorRef\.current;/);
    assert.doesNotMatch(loadMore, /items\[items\.length - 1\]/);
    // Switching organization sends a pending delete, so Undo can never restore it into the new list.
    assert.match(code, /sendPendingDelete\(\);\s*\};\s*\}, \[orgId, sendPendingDelete\]\);/);
  });

  it('the coach reader carries the trash, last and set apart: Open · Done · Close · Delete', () => {
    const code = readCode(READER);
    const at = (needle: string) => {
      const i = code.indexOf(needle);
      assert.ok(i > 0, `${needle} is gone from the reader`);
      return i;
    };
    const go = at('{goLabel} <ArrowRight');
    const done = at('<Check size={14} aria-hidden /> Done');
    const close = at('onClick={onClose}>Close</button>');
    const trash = at('<Trash2 ');
    assert.ok(go < done && done < close && close < trash, 'the buttons keep the drawn order in every frame');
    assert.match(code, /onClick=\{\(\) => onDelete\(members\)\}/);
  });
});

describe('D8 · Clear is DONE wherever a customer reads it', () => {
  // The identifiers keep their names (`clear`, `clearRow`, `cleared_at`, `.clearBtn`); the words change.
  const VISIBLE_CLEAR = /(>\s*Clear\s*<|['"`]Clear['"`]|“Clear|Clear “|from Needs attention|clear it\b|tap Clear)/;

  for (const file of [PANEL, BODY, READER]) {
    it(`${file} shows no "Clear"`, () => {
      assert.doesNotMatch(readCode(file), VISIBLE_CLEAR);
    });
  }

  it('the zone says what moves a row out of it', () => {
    assert.match(readCode(BODY), />stays until you mark it Done</);
  });

  it('help says Done, and says what Mark all read does now', () => {
    for (const file of ['lib/help-content/coaches.tsx', 'lib/help-content/org.tsx']) {
      const help = readSource(file);
      assert.doesNotMatch(help, /tap Clear|stays until you clear it|mark all read leaves it|leaves them alone for the same reason/i, file);
      assert.match(help, /stay until you mark them Done/, file);
    }
  });
});

describe('D4 · the admin button words are the admin\'s own page names', () => {
  const BASE = '/o/admin';

  it('Accounting: Payment requests is the tab\'s name', () => {
    const tab = accountingTabs(BASE, { runsRepTeams: true }).find(t => t.id === 'payment-requests');
    assert.equal(ADMIN_PAGE.paymentRequests, tab?.label);
  });

  it('a tournament\'s pages are named as its nav names them — registrations is TEAMS', () => {
    const label = (key: string) => {
      const item = TOUR_GROUPS.flatMap(g => g.items).find(i => i.key === key);
      assert.ok(item, `the tournament nav lost ${key}`);
      return kitTournamentLabel(item.label);
    };
    assert.equal(ADMIN_PAGE.tournamentTeams, label('registrations'));
    assert.equal(ADMIN_PAGE.results, label('results'));
    assert.equal(ADMIN_PAGE.checkIn, label('check-in'));
  });

  it('Organization and Rep Teams are named as the rail names them', () => {
    const billing = kitOrgLinks({ base: BASE, role: 'owner', isCanceled: false, canSeeMembers: true, hasVenueLibrary: true })
      .find(l => l.key === 'org/billing');
    assert.equal(ADMIN_PAGE.billing, billing?.label);
    const rep = kitPrograms({ base: BASE, canUse: () => true }).find(p => p.key === 'rep-teams');
    assert.equal(ADMIN_PAGE.repTeams, rep?.label);
    assert.equal(ADMIN_PAGE.bringIn, BRING_IN_PAGE_TITLE);
  });

  it('a house league\'s registrations page titles itself Registrations', () => {
    const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx');
    assert.match(page, new RegExp(`title="${ADMIN_PAGE.leagueRegistrations}"`));
  });

  it('the holding-up-the-payout notice opens its request when exactly one is held', () => {
    const body = readCode('lib/club-money-moves.ts');
    const tell = body.slice(body.indexOf('export async function tellClubIfRequestsHoldPayout'));
    assert.match(tell, /clubMoneyLinks\.requests\(p\.org\.slug, rows\.length === 1 \? rows\[0\]\.id : undefined\)/);
    // A new request's notice already carried its own (Ask 5c) — kept.
    const filed = body.slice(body.indexOf('export async function tellClubOfNewRequest'));
    assert.match(filed, /clubMoneyLinks\.requests\(p\.org\.slug, p\.request\.id\)/);
  });
});
