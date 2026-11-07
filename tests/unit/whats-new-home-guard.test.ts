import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANNOUNCEMENTS, LATEST_ANNOUNCED, isAnnouncementUnread } from '../../lib/release-announcements';

/**
 * ⚖ What's new left Help (owner 2026-11-07, docs/projects/active/WHATS_NEW_HOME_PLAN.md):
 *   · no release dot anywhere; Help is a plain row;
 *   · What's new is a row in the account menu (the admin and coach strips only) and a tile in the You group of the three
 *     phone More sheets — never in the MoreSheetFoot, whose order is nav standard N7 (2026-10-17);
 *   · only a release the OWNER announced lights anything (the entry's `announce` line), so a release without it is silent.
 */
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('What’s new home', () => {
  it('the release dot component is gone and nothing renders it', () => {
    assert.equal(existsSync(join(root, 'components/whats-new/ReleaseDot.tsx')), false);
    for (const f of ['components/whats-new/WhatsNewHelpLink.tsx', 'components/admin/kit/AdminKitRail.tsx', 'components/coaches/CoachesSidebar.tsx', 'components/coaches/CoachPortalShell.tsx']) {
      assert.doesNotMatch(read(f), /ReleaseDot/, f);
    }
  });

  it('only the admin and coach strips ask the account menu for the row', () => {
    assert.match(read('components/admin/AdminTopStrip.tsx'), /<AccountMenu\s+showWhatsNew/);
    assert.match(read('components/coaches/CoachTopStrip.tsx'), /<AccountMenu[^>]*\bshowWhatsNew\b/);
    for (const f of ['app/platform-admin/PlatformShell.tsx', 'components/public/ClubBar.tsx', 'components/public/TournamentBand.tsx', 'components/consumer/ConsumerNav.tsx', 'components/Navbar.tsx']) {
      assert.doesNotMatch(read(f), /showWhatsNew/, `${f}: the row is for the portals, not a public bar or the console`);
    }
  });

  it('the phone tile sits in the You group of all three sheets and not in the foot', () => {
    for (const f of ['components/admin/kit/AdminKitBottomNav.tsx', 'components/coaches/CoachesBottomNav.tsx', 'components/coaches/CoachFreeBottomNav.tsx']) {
      assert.match(read(f), /<WhatsNewSheetRow /, f);
    }
    assert.doesNotMatch(read('components/coaches/MoreSheetFoot.tsx'), /WhatsNew|changelog/, 'the foot keeps its ruled order (N7)');
  });

  it('the Overview mounts the note, and the note clears on a dismiss or an open', () => {
    assert.match(read('components/admin/kit/club/ClubHubKit.tsx'), /<WhatsNewNote \/>/);
    const note = read('components/admin/kit/club/WhatsNewNote.tsx');
    assert.match(note, /aria-label="Dismiss the what’s new note" onClick=\{markReleasesSeen\}/);
    assert.match(note, /href="\/changelog"[^>]*onClick=\{\(\) => \{ window\.setTimeout\(markReleasesSeen\); \}\}/);
  });

  it('a release lights nothing unless the owner announced it', () => {
    assert.equal(isAnnouncementUnread(null, '', Date.parse('2026-11-10T12:00:00Z')), false, 'no announcement, nothing lit');
    // Every announcement is one plain line, and ANNOUNCEMENTS is newest first (LATEST_ANNOUNCED reads the top).
    for (const a of ANNOUNCEMENTS) assert.ok(a.line.trim().length > 0 && !a.line.includes('\n') && !a.line.includes('<'), `${a.date}: one plain line`);
    for (let i = 1; i < ANNOUNCEMENTS.length; i++) assert.ok(ANNOUNCEMENTS[i - 1].date >= ANNOUNCEMENTS[i].date, 'newest first');
    assert.equal(LATEST_ANNOUNCED, ANNOUNCEMENTS[0] ?? null);
    // The announcements list is its own tiny file: the menu must not pull the whole changelog into every public bar.
    assert.doesNotMatch(read('components/whats-new/release-seen.ts'), /lib\/release-notes/);
    assert.doesNotMatch(read('components/shared/AccountMenu.tsx'), /lib\/release-notes/);
  });

  it('the unread rule: announced, recent, and not yet seen on this device', () => {
    const a = { date: '2026-11-12', line: 'New: a Rainout button on the house league schedule.' };
    const day = 24 * 60 * 60 * 1000;
    const at = Date.parse('2026-11-12T00:00:00Z');
    assert.equal(isAnnouncementUnread(a, '', at + day), true, 'a fresh device sees a recent announcement');
    assert.equal(isAnnouncementUnread(a, '2026-11-05', at + day), true, 'an older marker is still unread');
    assert.equal(isAnnouncementUnread(a, '2026-11-12', at + day), false, 'opened or dismissed on this device');
    assert.equal(isAnnouncementUnread(a, '2026-12-01', at + day), false, 'a later marker covers it');
    assert.equal(isAnnouncementUnread(a, '', at + 30 * day), true, 'still news on day 30');
    assert.equal(isAnnouncementUnread(a, '', at + 31 * day), false, 'quiet after a month, even on a device that never saw it');
  });
});
