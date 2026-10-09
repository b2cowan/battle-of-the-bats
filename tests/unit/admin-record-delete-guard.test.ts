/**
 * AN ADMIN RECORD'S DELETE IS ONE PART, IN THE PORTAL'S LOOK (owner 2026-10-09, walking Club Tier Stage 3d's payee
 * window: "I don't think this is our standard product format for delete buttons, please review").
 *
 * The 2026-09-30 ruling put Delete at the end of an admin record's body — alone, red, asking first — and said nothing
 * of its look, so each record spelled its own: bold red words, no icon, three copies of one stylesheet rule (the
 * tournament record, a tournament team, a club payee). The coaches portal, the formatting benchmark, draws it as
 * `GuardedDelete`'s door: a trash icon and the words, red at body weight, underlined only on hover. RepKit's
 * `RecordDelete` restates that look once and every admin record renders it.
 *
 * ⚠ The club payee window (Club Tier Stage 3d) renders it too; its assertion lives in `club-stage3d-screens-guard`,
 * which arrives with that window.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

const KIT = readCode('components/admin/kit/club/RepKit.tsx');
const KIT_CSS = readCode('components/admin/kit/club/RepKit.module.css');

/** Each record and the busy lock its Delete keeps while a save or a delete is in flight. */
const RECORDS = {
  'the tournament record': ['components/admin/tournament/TournamentRecord.tsx', /<RecordDelete onClick=\{askFor\('delete'\)\} disabled=\{busy\}>/],
  'a tournament team': ['app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx', /<RecordDelete onClick=\{\(\) => void flushThen\(\(\) => props\.onDelete\(t\)\)\} disabled=\{props\.busy\}>/],
} as const;

const OLD_SHEETS = [
  'components/admin/tournament/ScreenParts.module.css',
  'app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css',
];

describe('an admin record’s Delete', () => {
  it('is RepKit’s RecordDelete: the trash icon and the words, at body weight', () => {
    assert.match(KIT, /export function RecordDelete\(/);
    assert.match(KIT, /className=\{styles\.recordDelete\}[^>]*>\s*<Trash2 size=\{13\} aria-hidden \/> \{children\}/);
    const rule = KIT_CSS.match(/\.recordDelete \{[^}]*\}/)?.[0] ?? '';
    assert.ok(rule, 'the rule exists');
    assert.doesNotMatch(rule, /font-weight/, 'body weight — the portal’s, never bold');
    assert.doesNotMatch(rule, /text-decoration/, 'underlined only on hover');
    assert.match(rule, /color: var\(--danger-light/);
    assert.match(KIT_CSS, /\.recordDelete:hover \{ text-decoration: underline; \}/);
    assert.match(KIT_CSS, /\n {2}\.recordDelete \{ min-height: var\(--tap-min, 44px\); \}\n/, 'the touch floor, inside the phone block');
  });

  for (const [who, [file, call]] of Object.entries(RECORDS)) {
    it(`${who} renders it, still locked while busy`, () => {
      assert.match(readCode(file), call);
    });
  }

  it('no record keeps a Delete style of its own', () => {
    for (const sheet of OLD_SHEETS) {
      assert.doesNotMatch(readCode(sheet), /\.(recordDelete|deleteButton)\b/, sheet);
    }
  });
});
