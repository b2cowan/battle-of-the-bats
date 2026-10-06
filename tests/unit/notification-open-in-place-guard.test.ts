/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * NOTIFICATIONS OPEN IN PLACE (owner ruling 2026-10-05, D1–D9 — plan
 * docs/projects/archive/NOTIFICATIONS_OPEN_IN_PLACE_PLAN.md). Built in three steps; each adds its own
 * checks here.
 *
 * STEP 1 · the rules under every surface — three words for three things:
 *   READ   = seen (on open, or Mark all read — which now marks EVERYTHING, D9).
 *   DONE   = dealt with (Needs attention only; the old "Clear", D8; the only thing that writes
 *            `cleared_at`, so the only thing that moves a row out of Needs attention).
 *   DELETE = gone from your own list (D3; Undo for a few seconds; nobody else's copy).
 * Never let one do another's job: Mark all read must never write `cleared_at`, and a delete must
 * never reach past the caller's own rows.
 *
 * STEP 2 · the drawer — on a computer the bell opens a drawer holding the whole list, and a click
 * OPENS a notification in a pane beside it (D1, D2, D6, D7). One message block for every frame; the
 * drawer reads the same feed as the pages; nothing on a computer links to the Notifications pages.
 *
 * STEP 3 · the admin's Notifications page opens notifications too (D5) — in the coach page's own
 * reader, one file for both pages (owner, 2026-10-06, hub screen 10 Q1); nothing in the list
 * navigates on a tap any more, and nothing the admin page loads reaches `coaches.module.css`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readCode, readSource, functionBody, callbackBody, cssRule } from './_source-code.ts';
import { ADMIN_PAGE } from '../../lib/notification-view.ts';
import { accountingTabs, kitOrgLinks, kitPrograms, kitTournamentLabel } from '../../lib/admin-kit-nav.ts';
import { TOUR_GROUPS } from '../../components/admin/admin-nav-config.ts';
import { BRING_IN_PAGE_TITLE } from '../../lib/team-move-words.ts';

const ROUTE = 'app/api/notifications/route.ts';
const FEED = 'components/notifications/useNotificationFeed.ts';
const DRAWER = 'components/notifications/NotificationDrawer.tsx';
const MESSAGE = 'components/notifications/NotificationMessage.tsx';
const BELL = 'components/notifications/NotificationBell.tsx';
const ADMIN_STRIP = 'components/admin/AdminTopStrip.tsx';
const COACH_STRIP = 'components/coaches/CoachTopStrip.tsx';
const BODY = 'components/notifications/NotificationFeedBody.tsx';
const READER = 'components/notifications/NotificationReader.tsx';
const ADMIN_PAGE_FRAME = 'components/notifications/NotificationsPageContent.tsx';
const COACH_PAGE_FRAME = 'components/coaches/CoachNotificationsPage.tsx';
const REPO = path.join(import.meta.dirname, '..', '..');

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
    // The drawer has no mark-all of its own (step 2): it calls the feed's, read on the line above.
    assert.doesNotMatch(readCode(DRAWER), /action: 'mark-all-read'|clearedAt/);
  });

  it('cleared_at has exactly one writer: Done (the route\'s clear action)', () => {
    const code = readCode(ROUTE);
    const writes = code.match(/cleared_at:/g) ?? [];
    assert.equal(writes.length, 1, 'one update writes cleared_at');
    assert.match(routeBranch('clear'), /cleared_at: now/);
  });

  it('the button shows whenever anything is unread — not only activity', () => {
    assert.match(readCode(FEED), /const anyUnread = items\.some\(n => !n\.readAt\);/);
    assert.match(readCode(DRAWER), /\{anyUnread && \(/, 'the drawer shows it on the feed\'s own answer');
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

  it('the opened notification carries the trash, last and set apart: Open · Done · Close · Delete', () => {
    // Since step 2 the buttons are the shared message block's, which every frame wears.
    const code = readCode(MESSAGE);
    const at = (needle: string) => {
      const i = code.indexOf(needle);
      assert.ok(i > 0, `${needle} is gone from the message block`);
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

  for (const file of [DRAWER, MESSAGE, BODY, READER]) {
    it(`${file} shows no "Clear"`, () => {
      assert.doesNotMatch(readCode(file), VISIBLE_CLEAR);
    });
  }

  it('the zone says what moves a row out of it — on the page and in the drawer', () => {
    assert.match(readCode(BODY), />stays until you mark it Done</);
    assert.match(readCode(DRAWER), />stays until you mark it Done</);
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

describe('Step 2 · the bell opens a drawer, and a click opens a notification beside the list', () => {
  /** One `<NotificationMessage … />` element in a file, props and all. */
  const messageElement = (file: string) => {
    const code = readCode(file);
    const i = code.indexOf('<NotificationMessage');
    assert.ok(i > 0, `${file} no longer wears the shared message block`);
    return code.slice(i, code.indexOf('/>', i));
  };

  it('a row OPENS its notification — nothing in the drawer leaves the page on a click (D1)', () => {
    const code = readCode(DRAWER);
    assert.doesNotMatch(code, /window\.location/, 'a bell row never navigates');
    assert.match(functionBody(code, 'openEntry'), /setOpened\(entry\);\s*keep\(members\.map\(m => m\.id\)\);\s*void markSeen\(members\);/);
    // One row shell opens both kinds — a single notification and a bundle.
    assert.equal((code.match(/onClick=\{\(\) => openEntry\(entry\)\}/g) ?? []).length, 1);
    assert.match(functionBody(code, 'itemRow'), /return row\(\{ kind: 'item', notification: n \}/);
    assert.match(functionBody(code, 'bundleRow'), /return row\(entry, \{/);
  });

  it('one message block: the drawer\'s pane and the coach reader wear the same one', () => {
    const pane = messageElement(DRAWER);
    assert.match(pane, /portal=\{portal\}/);
    assert.doesNotMatch(pane, /onClose=/, 'the pane closes with its own ×, not a Close button');
    const reader = messageElement(READER);
    assert.match(reader, /portal=\{portal\}/, 'the reader speaks the words of the page that opened it (step 3)');
    assert.match(reader, /onClose=\{onClose\}/);
    // The reader's words live only in the block now — no second stamp, destination or button row.
    assert.doesNotMatch(readCode(READER), /notificationStamp|notificationDestination|<Trash2|<ArrowRight/);
  });

  it('each strip names its portal, and nothing on a computer links to the Notifications pages (D6)', () => {
    assert.match(readCode(ADMIN_STRIP), /<NotificationBell[\s\S]*?portal="admin"/);
    assert.match(readCode(COACH_STRIP), /<NotificationBell[\s\S]*?portal="coach"/);
    for (const file of [ADMIN_STRIP, COACH_STRIP, BELL, DRAWER]) {
      const code = readCode(file);
      assert.doesNotMatch(code, /seeAllHref|See all/, `${file}: the "See all" link is gone`);
      assert.doesNotMatch(code, /\/(?:admin|coaches)\/notifications/, `${file} links to a Notifications page`);
    }
    // The bell opens the drawer, loaded on the click (the bell is on every page; the drawer is not).
    assert.match(readCode(BELL), /const NotificationDrawer = dynamic\(\(\) => import\('\.\/NotificationDrawer'\), \{ ssr: false \}\);/);
    assert.equal(existsSync(path.join(REPO, 'components/notifications/NotificationPanel.tsx')), false, 'the old panel is gone');
  });

  it('the drawer reads the pages\' feed, opens on Unread (Q3), and keeps what it opened (D2)', () => {
    const code = readCode(DRAWER);
    assert.match(code, /useNotificationFeed\(orgId, \{ unreadOnly: true, keep: kept \}\)/);
    assert.doesNotMatch(code, /fetch\(/, 'no second fetch of its own (the panel kept one)');
    // The visit is the DRAWER's memory; the feed only honours the set it is handed.
    const feed = readCode(FEED);
    assert.match(feed, /const visible = unreadOnly \? items\.filter\(n => !n\.readAt \|\| keep\?\.has\(n\.id\)\) : items;/);
    assert.doesNotMatch(feed, /setKept|keepSeen|setSeen/, 'the feed never decides what to keep');
    // Done keeps its row in view too: "it stays in your list below, read" (hub screen 6) — from the row
    // and from the pane, both through markDone.
    assert.match(functionBody(code, 'markDone'), /keep\(\[n\.id\]\);\s*void clearRow\(n\);/);
    assert.doesNotMatch(code, /void clearRow\(n\);\s*closePane/, 'the pane\'s Done goes through markDone');
    // Mark all read keeps nothing: under Unread, reading everything empties the list to "caught up".
    assert.match(code, /onClick=\{readAll\}/);
    assert.doesNotMatch(functionBody(code, 'readAll'), /keep\(/);
  });

  it('Escape and Back go up one level — the message, then the drawer', () => {
    assert.match(readCode(DRAWER), /useDialogFloor\(true, drawerRef, \{ onClose: open \? closePane : onClose \}\)/);
  });

  it('the bell\'s count follows the drawer: every read, Done, Mark all read, delete and Undo', () => {
    const feed = readCode(FEED);
    assert.match(feed, /const unreadCount = unreadBeyond === null \? null : unreadBeyond \+ unreadIn\(items\);/);
    assert.match(callbackBody(feed, 'markAllRead'), /setUnreadBeyond\(b => \(b === null \? null : 0\)\)/);
    assert.match(callbackBody(feed, 'loadMore'), /setUnreadBeyond\(/);
    assert.match(readCode(BELL), /onUnreadChange=\{setUnreadCount\}/);
    // The drawer hands up the server's count once, then MOVES the bell — an absolute push erased the +1
    // the bell's live listener gave an arrival this list does not hold (/review 2026-10-06).
    const drawer = readCode(DRAWER);
    assert.match(drawer, /if \(before === null\) countRef\.current\(unreadCount\);/);
    assert.match(drawer, /countRef\.current\(c => Math\.max\(0, c \+ unreadCount - before\)\)/);
    // Mark all read reads arrivals too, so it sets the bell to zero outright.
    assert.match(functionBody(drawer, 'readAll'), /countRef\.current\(0\);\s*void markAllRead\(\);/);
    // A row waiting out its Undo window is read by Mark all read as well, so an Undo brings it back read.
    assert.match(callbackBody(feed, 'markAllRead'), /p\.members\.map\(m => \(m\.readAt \? m : \{ \.\.\.m, readAt: now \}\)\)/);
  });

  it('Load more shows whenever there is more — under "caught up" too (/review 2026-10-06)', () => {
    // The first page can be all read with unread rows behind it: Unread must still reach them.
    assert.match(readCode(DRAWER), /\{!loading && !error && hasMore && \(/);
  });

  it('one organization per drawer', () => {
    assert.match(readCode(BELL), /key=\{orgId\}/);
  });

  it('the trash shows for the pointer AND the keyboard; the Undo note sits at the list\'s foot (Q1)', () => {
    const css = readCode('components/notifications/notifications.module.css');
    assert.match(css, /\.notifItem:hover \.rowTrash,\s*\.notifItem:focus-within \.rowTrash \{/);
    assert.doesNotMatch(cssRule(css, '.rowTrash'), /visibility|display:\s*none/, 'hidden by opacity, so it keeps its Tab stop');
    assert.match(readCode(DRAWER), /<NotificationUndoNote feed=\{feed\} placement="drawer"/);
  });

  it('a delete closes the message it deleted, never the drawer', () => {
    const del = functionBody(readCode(DRAWER), 'deleteEntry');
    assert.doesNotMatch(del, /onClose\(/);
    assert.match(del, /deleteRows\(members\);/);
  });

  it('the drawer carries both portals\' theme markers through its portal', () => {
    assert.match(
      readCode(DRAWER),
      /<PortalKitRoot>\s*<div style=\{\{ display: 'contents' \}\} \{\.\.\.coachWarmAttr\}>\{layer\}<\/div>\s*<\/PortalKitRoot>/,
    );
  });
});

/**
 * Every repo file a module loads, at any depth — static imports, re-exports and `import('…')` — through
 * `@/` and relative specifiers only (packages are not ours to walk). Comments are stripped first, so a
 * comment that NAMES a stylesheet is not an import of it. ⚠ A stylesheet is walked too: a CSS module's
 * `composes: x from '…'` and `@import` load the sheet they name, and `composes` is exactly how the coach
 * stylesheet has been borrowed before — a leak through one would pass a walker that stopped at `.css`.
 */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? path.join(REPO, spec.slice(2)) : path.resolve(path.dirname(path.join(REPO, from)), spec);
    for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) {
      const abs = base + ext;
      if (existsSync(abs) && /\.(tsx?|css)$/.test(abs)) return path.relative(REPO, abs).split(path.sep).join('/');
    }
    return null;
  };
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const specs = rel.endsWith('.css')
      ? [...readSource(rel).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:composes:[^;]*?from\s+|@import\s+(?:url\(\s*)?)['"]([^'"]+)['"]/g)].map(m => m[1])
      : [...readCode(rel).matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const spec of specs) {
      if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
      const next = resolve(rel, spec);
      if (next) walk(next);
    }
  };
  walk(entry);
  return seen;
}

describe('Step 3 · the admin\'s Notifications page opens notifications (D5)', () => {
  it('a tap opens the reader on the admin page, in the admin\'s words', () => {
    const page = readCode(ADMIN_PAGE_FRAME);
    assert.match(page, /<NotificationFeedBody feed=\{feed\} onOpen=\{openEntry\} \/>/);
    assert.match(functionBody(page, 'openEntry'), /setReading\(entry\);\s*void feed\.markSeen\(entryMembers\(entry\)\);/);
    assert.match(page, /<NotificationReader entry=\{reading\} portal="admin" feed=\{feed\} onClose=\{\(\) => setReading\(null\)\} \/>/);
  });

  it('one reader for both pages (Q1): the coach page wears the same file, and the old one is gone', () => {
    assert.match(readCode(COACH_PAGE_FRAME), /<NotificationReader entry=\{reading\} portal="coach" feed=\{feed\} onClose=\{\(\) => setReading\(null\)\} \/>/);
    assert.equal(existsSync(path.join(REPO, 'components/coaches/CoachNotificationReader.tsx')), false, 'no second reader');
    assert.match(readCode(READER), /onDone=\{n => \{ void feed\.clearRow\(n\); onClose\(\); \}\}/);
    assert.match(readCode(READER), /onDelete=\{members => \{ feed\.deleteRows\(members\); onClose\(\); \}\}/);
    // Done and Delete act on the LIVE row, in the feed, for every caller — the reader's and the drawer pane's
    // snapshots predate the read, and a failed Done's rollback must not bring a read row back unread
    // (/review 2026-09-25, fixed in the reader alone until the step-3 /simplify moved it here).
    const feed = readCode(FEED);
    assert.match(callbackBody(feed, 'clearRow'), /const n = items\.find\(x => x\.id === row\.id\) \?\? row;/);
    assert.match(callbackBody(feed, 'deleteRows'), /members\.map\(m => items\.find\(x => x\.id === m\.id\) \?\? m\)/);
  });

  it('nothing in the notification list leaves the page on a tap — on either page (D1)', () => {
    assert.match(readCode(BODY), /onOpen: \(entry: ActivityEntry\) => void;/, 'opening is required, not optional');
    for (const file of [BODY, FEED, READER, ADMIN_PAGE_FRAME, COACH_PAGE_FRAME]) {
      assert.doesNotMatch(readCode(file), /window\.location|\bmarkRead\b|\bbundleClick\b/, `${file} navigates on a tap`);
    }
  });

  it('a delete on the admin page leaves the page\'s Undo note, at the column\'s foot (step 1 Q1)', () => {
    const body = readCode(BODY);
    assert.match(body, /<NotificationUndoNote feed=\{feed\} returnFocusTo=/);
    assert.doesNotMatch(body, /placement="drawer"/);
  });

  it('nothing the admin page loads reaches the coach portal\'s ~945KB stylesheet', () => {
    const loaded = reachableFrom(ADMIN_PAGE_FRAME);
    assert.ok(loaded.has(READER) && loaded.has('components/coaches/CoachesBottomNav.module.css'), 'the walk reaches the reader and its sheet styles');
    assert.equal(loaded.has('app/[orgSlug]/coaches/coaches.module.css'), false,
      'the admin Notifications page must never load coaches.module.css — not through the reader, the message block, a hook or a stylesheet\'s composes');
  });
});
