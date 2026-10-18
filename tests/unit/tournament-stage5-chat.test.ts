/**
 * CHAT, WITH ITS TITLE (Tournament admin redesign Stage 5, Part 8 — E11, A57, A60; F14). What the build must keep
 * true:
 *   - the page has its title band: "Chat", Manage room, the bare "?";
 *   - the room is chosen by the olive pill on a phone and a docked column at a desk, New room at its foot;
 *   - close, rename, delete and a name already taken ask in the product's windows — no browser confirm or prompt;
 *   - a reported message's Remove is red words; the free plan's wall stays (UpgradeGate);
 *   - the chat panels' old look is folded.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CHAT_WORDS as W } from '../../lib/tournament-chat-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const PAGE = 'app/[orgSlug]/admin/tournaments/chat/page.tsx';

describe('Chat (E11)', () => {
  const page = code(PAGE);
  it('has its title band: Chat, Manage room, the "?"', () => {
    assert.match(page, /<AdminPageHeader\s+title=\{W\.title\}/);
    assert.match(page, /<HelpButton help=\{CHAT_HELP\}/);
    assert.match(page, /\{W\.manage\}/);
    assert.equal(W.title, 'Chat');
  });
  it('the room: the olive pill on a phone, the docked rooms at a desk with New room at the foot', () => {
    assert.match(page, /className=\{styles\.pill\}/);
    assert.match(page, /<nav className=\{styles\.dock\} aria-label=\{W\.rooms\}>/);
    assert.match(page, /\{W\.newRoom\}/);
    const css = read('app/[orgSlug]/admin/tournaments/chat/chat-admin.module.css');
    assert.match(css, /@media \(max-width: 900px\) \{\n  \.dock \{ display: none; \}\n  \.pillRow \{ display: flex; \}/);
  });
  it('the message box\'s hint names who it reaches, and a disabled Send fades like every disabled button (2026-10-18)', () => {
    // The phone layout built beside this (header hidden, a framed card, search in the pill row) was undone the same day
    // (Chat Consistency Review, Ask 0): the WhatsApp standard keeps the conversation's header and runs it edge to edge.
    assert.match(page, /composerPlaceholder=\{selected \? W\.writeTo\(selected\) : undefined\}/);
    assert.match(read('components/chat/ChatPanel.module.css'), /\.sendBtn:disabled \{ opacity: 0\.5; cursor: not-allowed; \}/);
    assert.equal(W.writeTo({ refSubId: null, name: 'whatever' }), 'Write to all coaches…');
    assert.equal(W.writeTo({ refSubId: 'x', name: '9U & 10U' }), 'Write to 9U & 10U…');
  });
  it('asks in the product\'s windows, never the browser\'s', () => {
    assert.doesNotMatch(page, /window\.(confirm|prompt|alert)\(/);
    assert.match(page, /ask\?\.kind === 'close'/);
    assert.match(page, /ask\?\.kind === 'rename'/);
    assert.match(page, /ask\?\.kind === 'delete'/);
    assert.match(page, /ask\?\.kind === 'taken'/);
  });
  // A60's full-page wall is retired: Tournament Chat is HIDDEN on the free plan (R5, the owner's change — the free
  // tournament tier, 2026-10-12, built 2026-10-16). No nav entry leads here; the address goes to the dashboard.
  it('the free plan has no Chat page: the address goes to the dashboard, never a wall (R5)', () => {
    assert.doesNotMatch(page, /UpgradeGate/);
    assert.match(page, /useAbsentArea\('chat'\)/);
  });
  it('a reported message\'s Remove is red words, and the panels carry no old-look layer', () => {
    assert.match(code('components/chat/ChatManagePanel.tsx'), /className=\{styles\.removeWords\}/);
    for (const f of ['components/chat/ChatManagePanel.module.css', 'components/chat/ChatRoomsPanel.module.css', 'components/chat/NewRoomDialog.module.css', 'app/[orgSlug]/admin/tournaments/chat/chat-admin.module.css']) {
      assert.doesNotMatch(read(f), /\[data-admin-kit\]\)/, f);
    }
  });
});
