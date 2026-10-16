import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  freeMoreActive, freeSectionActive, freeTeamTools, resolveCurrentFreeTeam, resolveFreeBarTeam,
  type FreeNavTeam,
} from '../../lib/coach-free-nav';
import { COACHES_CLAIMABLE_CONTEXT_ID, COACHES_NOTIFICATIONS_PATH, isCoachPortalShellPath } from '../../lib/coaches-portal-routes';
import { hasTeamCoachBell } from '../../lib/notification-bell-scope';
import { readCode, readSource } from './_source-code';

/**
 * THE FREE PORTAL'S PHONE BAR (Free coach header parity, the phone step — owner direction and rulings
 * 2026-10-15; build-start answers B1–B4 the same day). On a phone the free portal takes the paid portal's
 * shape: a fixed four-tab team bar, the team's tools in More, the bell's count on More with Notifications
 * first, the paid Notifications page inside the portal. These pin the decisions a refactor could quietly
 * undo; the look is the paid bar's stylesheet's, held by its own guards.
 */

const team = (id: string, activatedFeatures: string[] = [], registrationIds: string[] = []): FreeNavTeam & { name: string } =>
  ({ id, name: id, activatedFeatures, registrationIds });

const otters = team('otters', ['schedule', 'roster'], ['reg-o1', 'reg-o2']);
const badgers = team('badgers', [], ['reg-b1']);

describe('which bar, pointed at which team (owner B3, 2026-10-15)', () => {
  it('the team in the address owns the page; a record page is its team\'s', () => {
    assert.equal(resolveCurrentFreeTeam('/coaches/team/badgers/roster', [otters, badgers])?.id, 'badgers');
    assert.equal(resolveCurrentFreeTeam('/coaches/tournaments/reg-o2', [otters, badgers])?.id, 'otters');
  });

  it('a coach with exactly one team: every page is that team\'s, so every page wears the team bar', () => {
    for (const p of ['/coaches', '/coaches/tournaments', '/coaches/teams', COACHES_NOTIFICATIONS_PATH]) {
      assert.equal(resolveFreeBarTeam(p, [otters], null)?.id, 'otters', p);
    }
  });

  it('a page with no team wears the fan app\'s bar — the front page and the all-tournaments list of a coach with several teams', () => {
    assert.equal(resolveFreeBarTeam('/coaches', [otters, badgers], 'badgers'), null);
    assert.equal(resolveFreeBarTeam('/coaches/tournaments', [otters, badgers], 'badgers'), null);
  });

  it('a coach with no team: the fan app\'s bar everywhere, Notifications included', () => {
    for (const p of ['/coaches', '/coaches/tournaments', '/coaches/tournaments/reg-x', COACHES_NOTIFICATIONS_PATH]) {
      assert.equal(resolveFreeBarTeam(p, [], 'otters'), null, p);
    }
  });

  it('Notifications is More\'s own page: the team bar, pointed at the team last opened, else the first', () => {
    assert.equal(resolveFreeBarTeam(COACHES_NOTIFICATIONS_PATH, [otters, badgers], 'badgers')?.id, 'badgers');
    assert.equal(resolveFreeBarTeam(COACHES_NOTIFICATIONS_PATH, [otters, badgers], null)?.id, 'otters');
    assert.equal(resolveFreeBarTeam(COACHES_NOTIFICATIONS_PATH, [otters, badgers], 'a-team-since-left')?.id, 'otters');
  });
});

describe('what the bar lights — one rule with the computer\'s left menu', () => {
  it('Tournaments: the team\'s list, the account-wide list, and this team\'s record pages — never another team\'s', () => {
    assert.ok(freeSectionActive('/coaches/team/otters/tournaments', otters, '/tournaments'));
    assert.ok(freeSectionActive('/coaches/tournaments', otters, '/tournaments'));
    assert.ok(freeSectionActive('/coaches/tournaments/reg-o1', otters, '/tournaments'));
    assert.ok(!freeSectionActive('/coaches/tournaments/reg-b1', otters, '/tournaments'));
  });

  it('Overview only on the Overview itself', () => {
    assert.ok(freeSectionActive('/coaches/team/otters', otters, ''));
    assert.ok(!freeSectionActive('/coaches/team/otters/roster', otters, ''));
  });

  it('More on every page it leads to: Notifications, a turned-on tool, Explore — and on nothing the bar carries', () => {
    assert.ok(freeMoreActive(COACHES_NOTIFICATIONS_PATH, otters));
    assert.ok(freeMoreActive('/coaches/team/otters/roster', otters));
    assert.ok(freeMoreActive('/coaches/team/otters/explore', otters));
    for (const p of ['/coaches/team/otters', '/coaches/team/otters/tournaments', '/coaches/team/otters/chat']) {
      assert.ok(!freeMoreActive(p, otters), p);
    }
  });

  it('the tools come in the tools\' own order, whatever order they were turned on in', () => {
    assert.deepEqual(freeTeamTools(otters).map(t => t.key), ['roster', 'schedule']);
  });
});

describe('the bar (CoachFreeBottomNav)', () => {
  const BAR = 'components/coaches/CoachFreeBottomNav.tsx';
  const src = readSource(BAR);
  const code = readCode(BAR);

  it('B1: wears the PAID bar\'s stylesheet, imported — and no stylesheet of its own', () => {
    assert.match(src, /import styles from '\.\/CoachesBottomNav\.module\.css';/);
    assert.equal((src.match(/\.module\.css'/g) ?? []).length, 1);
  });

  it('four tabs and only four: Overview, Tournaments, Chat (only with a chat door), More', () => {
    const tabs = code.slice(code.indexOf('const tabs = ['), code.indexOf('];', code.indexOf('const tabs = [')));
    assert.deepEqual([...tabs.matchAll(/key: '([a-z]+)'/g)].map(m => m[1]), ['overview', 'tournaments', 'chat']);
    assert.match(tabs, /\.\.\.\(showChat \? \[\{ key: 'chat'/, 'Chat hides without a chat door (P2)');
    assert.equal((code.match(/className=\{`\$\{styles\.tab\}/g) ?? []).length, 2, 'the tabs\' map and More — nothing else is a tab');
  });

  it('More, in order: Notifications first, the tools as tiles with Explore LAST, "You" (Home · Scores · Account — the admin sheet\'s label for that group), then Help and Sign out', () => {
    const order = ['id="free-mob-notifications"', 'styles.hotTiles', 'tools.map(', 'id="free-mob-explore"', '>You</div>', 'id="free-mob-home"', 'id="free-mob-scores"', 'id="free-mob-account"', 'id="free-mob-help"', 'id="free-mob-logout"'];
    const at = order.map(s => code.indexOf(s));
    at.forEach((i, n) => assert.ok(i > -1, `${order[n]} is in the sheet`));
    for (let n = 1; n < at.length; n++) assert.ok(at[n - 1] < at[n], `${order[n - 1]} comes before ${order[n]}`);
    assert.ok(code.includes('styles.hotTileAdd'), 'Explore\'s tile wears the dashed "add more" edge');
  });

  it('the bell is the FREE coach\'s; its count rides More while the sheet is shut', () => {
    assert.ok(code.includes('useNotificationUnread(TEAM_COACH_BELL)'));
    assert.ok(code.includes('{!moreOpen && notifUnread > 0 && <span aria-hidden className={styles.tabCount}>'));
  });

  it('B2: the paid portal\'s overlay safety net — a form-layer surface takes the bar away', () => {
    assert.ok(code.includes('const anyOverlayOpen = useAnyOverlayOpen();'));
    assert.ok(code.includes('styles.navHidden'));
    const layout = readCode('app/coaches/layout.tsx');
    assert.ok(/<CoachesOverlayProvider>\s*<CoachPortalShell/.test(layout), 'the free layout mounts the provider around the shell');
  });
});

describe('the shell at 900px and below (CoachPortalShell)', () => {
  const shell = readCode('components/coaches/CoachPortalShell.tsx');
  const css = readCode('components/coaches/CoachPortalShell.module.css');

  it('the team bar where there is a team, the fan app\'s bar where there is none', () => {
    assert.ok(shell.includes('const barTeam = resolveFreeBarTeam(pathname, teamContexts, rememberedTeamId);'));
    assert.match(shell, /const phoneBar = !contextsLoading && !barTeam\s*\?\s*\(\s*<ConsumerNav\s+variant="coach"/, 'the fan app\'s bar only once the context says there is no team');
    assert.ok(shell.includes(': <CoachFreeBottomNav team={barReady ? barTeam : null}'), 'the team bar (its empty band until it is ready)');
  });

  it('the section tab row is retired: no team section renders above the page on a phone', () => {
    assert.doesNotMatch(shell, /tabScrollerRef|activeTabRef|styles\.tabPillActive|styles\.skelTabs/);
    assert.equal((shell.match(/className=\{styles\.tabRow\}/g) ?? []).length, 1, 'only the no-team "Get started" door is left');
  });

  it('Notifications shows no team header (RDC1)', () => {
    assert.ok(shell.includes('hidden={isNotifications || undefined}'));
  });

  it('a focused field hides either bar, and the portal\'s sheets clear the bar', () => {
    assert.ok(css.includes(":is(nav[aria-label='Primary'], nav[data-free-coach-bar])"));
    assert.match(css, /--coach-foot-clear: calc\(var\(--bottom-nav-height, 72px\) \+ env\(safe-area-inset-bottom, 0px\)\);/);
  });
});

describe('Notifications: the paid page inside the free portal — one component, never a copy', () => {
  it('both routes render CoachNotificationsPage; the free one in its free mode', () => {
    const free = readCode('app/coaches/notifications/page.tsx');
    const paid = readCode('app/[orgSlug]/coaches/notifications/page.tsx');
    assert.ok(free.includes("import CoachNotificationsPage from '@/components/coaches/CoachNotificationsPage';"));
    assert.ok(free.includes('<CoachNotificationsPage free />'));
    assert.ok(paid.includes('<CoachNotificationsPage orgSlug={orgSlug} />'));
    assert.doesNotMatch(free, /NotificationFeedBody|useNotificationFeed/, 'the free route draws no feed of its own');
  });

  it('the free mode reads the free bell and lands its settings door with the way back', () => {
    const page = readCode('components/coaches/CoachNotificationsPage.tsx');
    assert.ok(page.includes('useNotificationFeed(free ? TEAM_COACH_BELL : orgBell(currentOrg?.id))'));
    assert.ok(page.includes('`/account/notifications?back=${encodeURIComponent(here)}`'));
    // Found on the build's own probe: the paid page's empty words name assistants and a weekly review.
    assert.ok(page.includes('emptyCopy={free ? TEAM_COACH_FEED_EMPTY : FEED_EMPTY_COPY.coach}'), 'the free bell\'s empty words, not the paid portal\'s');
  });

  it('it is a portal page: the shell frames it', () => {
    assert.ok(isCoachPortalShellPath(COACHES_NOTIFICATIONS_PATH));
  });
});

describe('found by /design on the built bar (owner: "go ahead and fix", 2026-10-15) — every phone bar', () => {
  it('More (the one tab that is a button) takes the page\'s line height, so its name sits level with the links\'', () => {
    const tab = readCode('components/coaches/CoachesBottomNav.module.css');
    assert.match(tab, /\.tab \{[^}]*font-family: inherit;[^}]*line-height: inherit;/);
  });

  it('a count re-reads when a list reads, finishes, deletes or marks all read — after the request lands', () => {
    const feed = readCode('components/notifications/useNotificationFeed.ts');
    const unread = readCode('lib/use-notification-unread.ts');
    assert.equal((feed.match(/announceNotificationsChanged\(bell\)/g) ?? []).length, 4, 'mark read, Done, Mark all read, delete');
    assert.match(feed, /await Promise\.all\(unreadIds\.map\(id => postAction\(\{ action: 'mark-read', id \}\)\)\);\s*if \(bell\) announceNotificationsChanged\(bell\);/, 'once, after every mark-read has landed');
    assert.ok(unread.includes('window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);'));
    assert.ok(unread.includes('if ((e as CustomEvent<BellSource>).detail === bell) void refresh();'), 'only the bell that changed re-reads');
  });
});

describe('Pause for every free coach (owner P4, 2026-10-15 — the ad0267e4 dead end)', () => {
  it('an account that coaches a free team has the free bell; a claim-only account does not yet', () => {
    assert.equal(hasTeamCoachBell([{ kind: 'coaches_basic', id: 'coaches-basic:teams' }]), true);
    assert.equal(hasTeamCoachBell([{ kind: 'coaches_basic', id: 'coaches-basic:tournament-records' }]), true);
    assert.equal(hasTeamCoachBell([{ kind: 'coaches_basic', id: COACHES_CLAIMABLE_CONTEXT_ID }]), false);
    assert.equal(hasTeamCoachBell([{ kind: 'coaches_premium', id: 'coach:org-1' }]), false);
    assert.equal(hasTeamCoachBell([]), false);
  });

  it('the settings page shows Pause to such an account even with no card and no follow', () => {
    const page = readCode('app/(consumer)/account/notifications/page.tsx');
    const client = readCode('app/(consumer)/account/notifications/AccountNotificationsClient.tsx');
    assert.ok(page.includes('teamCoachBell={hasTeamCoachBell(contexts)}'));
    assert.ok(client.includes('{cards.length === 0 && !fanCard && !teamCoachBell ? ('), 'the empty state needs no free bell either');
  });
});
