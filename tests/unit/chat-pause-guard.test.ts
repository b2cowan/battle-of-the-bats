import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { CHAT_PAUSED } from '../../lib/chat-pause.ts';
import { eventAreas } from '../../lib/invite-only-event.ts';
import { NOTIFICATION_SECTIONS } from '../../lib/notification-labels.ts';
import { isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';
import { kitTournamentGroups } from '../../components/admin/kit/kit-tournament-groups.ts';
import { readCode } from './_source-code';

/**
 * ⚖ CHAT IS PAUSED (owner, 2026-10-18 — BUSINESS_DECISIONS.md "In-app chat PAUSES"; the bars' rulings P1–P8 in
 * docs/projects/active/CHAT_PAUSE_BUILD_PROMPT.md §8). One switch, `lib/chat-pause.ts`, is read by every door and by
 * the server. There was no kill switch before: each door had its own gate, which is how a pause could leak.
 *
 * These guards hold the SHAPE (every door reads the switch; a new chat link cannot appear without reading it) in
 * either state of the switch, and the paused BEHAVIOUR while it is on. Reversing the pause is one commit that sets
 * the switch to false — these still pass then, because they never assert the switch's value.
 */

const REPO = path.join(import.meta.dirname, '..', '..');

/** Every place the pause build changed: each must still read the switch in its CODE (comments stripped). */
const DOORS = [
  // the bars and menus
  'components/consumer/ConsumerNav.tsx',               // home bar + public tournament bar and strip (P2)
  'components/coaches/CoachesBottomNav.tsx',           // paid portal bar: Practices; tiles Lineups · Skills & Goals · Money (P3, P3T)
  'lib/coach-nav-visibility.ts',                       // paid sidebar, phone bar, tour step: Chat hidden (P3, P7)
  'lib/use-chat-door.ts',                              // free portal bar and left menu (P4F)
  'lib/invite-only-event.ts',                          // admin bar → Messages, rail, More, the chat page's redirect (P4, P1)
  'lib/use-chat-unread.ts',                            // no polling, no realtime channel (P8)
  // the pages an old address reaches (P1)
  'app/(consumer)/chat/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/chat/page.tsx',
  'app/coaches/team/[basicTeamId]/chat/page.tsx',
  // the dashboard's Coaches card (P5)
  'app/[orgSlug]/admin/tournaments/dashboard/WeeksBeforeBoard.tsx',
  'app/api/admin/tournament-dashboard/route.ts',
  // scouting share and the staff switch (P6, P7)
  'components/coaches/OpponentScoutingPanel.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/history/opponents/[opponentKey]/page.tsx',
  'app/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/route.ts',
  'components/coaches/CoachStaffSheet.tsx',
  'components/coaches/CoachStaffPanel.tsx',
  // notification settings and the bell
  'lib/notification-labels.ts',
  'lib/notification-view.ts',
  'app/(consumer)/account/notifications/AccountNotificationsClient.tsx',
  'app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx',
  'app/api/me/role-summary/route.ts',
  // the engine (P8)
  'lib/chat-service.ts',
  // copy that promised chat
  'lib/coach-capabilities.ts',
  'app/pricing/page.tsx',
  'app/(consumer)/auth/suspended/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
  'components/coaches/CoachPortalTour.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'help-content') continue;
      walk(rel, out);
    } else if (/\.(tsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel);
  }
  return out;
}

describe('the chat pause: one switch, read by every door', () => {
  it('every door the pause changed still reads the switch in its code', () => {
    for (const file of DOORS) assert.match(readCode(file), /\bCHAT_PAUSED\b/, file);
  });

  it('every chat API route answers first, before any work (P8) — the sign-up reminder keeps working', () => {
    const routes = walk('app/api').filter(f => f.endsWith('/route.ts') && /chat/.test(f));
    assert.ok(routes.length >= 20, `expected the chat routes, found ${routes.length}`);
    for (const file of routes) {
      const code = readCode(file);
      assert.match(code, /\bCHAT_PAUSED\b/, file);
      if (/remind-signups/.test(file)) {
        // Sign-ups are not chat: the reminder still sends, without its chat sentence.
        assert.match(code, /mentionsChat:\s*!CHAT_PAUSED/, file);
        continue;
      }
      const handlers = (code.match(/^export const (GET|POST|PATCH|PUT|DELETE) = /gm) ?? []).length;
      const answers = (code.match(/if \(CHAT_PAUSED\) return /g) ?? []).length;
      assert.ok(handlers > 0 && answers >= handlers, `${file}: ${handlers} handlers, ${answers} paused answers`);
    }
  });

  it('a link to a chat address reads the switch, or is gated by something that does', () => {
    // Gated by a reader of the switch, or not a door at all. Each names what keeps it honest, and that is checked.
    const INDIRECT: Record<string, RegExp> = {
      'components/coaches/CoachesSidebar.tsx': /isCoachNavItemVisible\(/,       // the Chat row is visible only through it
      'components/coaches/CoachFreeBottomNav.tsx': /\.\.\.\(showChat \? \[/,  // the tab exists only when useChatDoor says so
      'components/coaches/CoachPortalShell.tsx': /useChatDoor\(/,              // the left menu's row, the same answer
      'lib/consumer-routes.ts': /CONSUMER_SHELL_PREFIXES/,                     // a route list (the redirect needs it), not a door
      'components/Footer.tsx': /pathname === '\/chat'[^\n]*return null/,      // hides itself ON the chat page; links nowhere
      'components/admin/AdminContextStrip.tsx': /pathname\.includes\('\/admin\/tournaments\/chat'\)/, // knows the page; links nowhere
    };
    // The chat surfaces themselves: reached only through pages that redirect while paused.
    const CHAT_SURFACE = /^(components\/chat\/|app\/\(consumer\)\/chat\/|app\/\[orgSlug\]\/admin\/tournaments\/chat\/)/;
    // Any string or template holding a path that ends in /chat — '/chat', '/coaches/chat', `${base}/chat`, '/chat?room=' …
    const CHAT_LINK = /(['"`])[^'"`\n]*\/chat(['"`?/#])|\}\/chat(['"`?/#])/;
    // Import specifiers name files, not doors (e.g. '@/components/chat/ChatUnreadBadge').
    const withoutImports = (code: string) => code.replace(/^\s*(import\b[^\n]*|\}\s*from\s+['"][^'"]+['"];?)$/gm, '');
    const offenders: string[] = [];
    for (const root of ['app', 'components', 'lib']) {
      for (const file of walk(root)) {
        if (file.startsWith('app/api/') || CHAT_SURFACE.test(file)) continue;
        const code = withoutImports(readCode(file));
        if (!CHAT_LINK.test(code) || /\bCHAT_PAUSED\b/.test(code)) continue;
        const gate = INDIRECT[file];
        if (gate && gate.test(code)) continue;
        offenders.push(file);
      }
    }
    assert.deepEqual(offenders, [], 'a new way into chat must read CHAT_PAUSED (lib/chat-pause.ts)');
  });
});

describe('while chat is paused', { skip: !CHAT_PAUSED }, () => {
  it('no event has the chat area, on any plan (the admin bar shows Messages in its place, P4)', () => {
    for (const plan of ['tournament_plus', 'league', 'club', 'club_large'] as const) assert.equal(eventAreas(plan).chat, false, plan);
  });

  it('the tournament admin\'s rail and More list no Chat row, on any plan, in any phase', () => {
    for (const planId of ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large']) {
      for (const status of ['draft', 'active', 'completed', 'archived']) {
        const keys = kitTournamentGroups({ status, isSandbox: false, role: 'owner', planId }).flatMap(g => g.items.map(i => i.key));
        assert.ok(!keys.includes('chat'), `${planId} ${status}`);
      }
    }
  });

  it('the paid portal hides Chat for every role, and Practices follows the Schedule grant (P3)', () => {
    const head = resolveCoachCapabilities('head_coach');
    assert.equal(isCoachNavItemVisible(head, 'Chat'), false);
    assert.equal(isCoachNavItemVisible(head, 'Practices'), true);
    assert.equal(isCoachNavItemVisible({ ...head, schedule: false }, 'Practices'), false);
  });

  it('the bar holds Practices in Chat\'s place and the tiles are Lineups · Skills & Goals · Money (P3, P3T)', () => {
    const code = readCode('components/coaches/CoachesBottomNav.tsx');
    assert.match(code, /CHAT_PAUSED \? PRACTICES_TAB : CHAT_TAB/);
    assert.match(code, /key: '\/practice',\s*icon: NotebookPen,\s*label: 'Practices'/);
    assert.match(code, /HOT_KEYS = CHAT_PAUSED \? \[\s*'\/lineups',\s*'\/development',\s*'\/accounting',\s*\]/);
  });

  it('the home bar leaves Chat\'s place empty (P2)', () => {
    assert.match(readCode('components/consumer/ConsumerNav.tsx'), /ALL_TABS\.filter\(t => !\(CHAT_PAUSED && t\.href === '\/chat'\)\)/);
  });

  it('no notification setting offers chat', () => {
    assert.ok(!NOTIFICATION_SECTIONS.some(s => s.eventTypes.includes('chat_message')));
  });
});
