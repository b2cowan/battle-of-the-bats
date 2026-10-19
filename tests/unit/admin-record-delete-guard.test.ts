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
    // The shape is ONE rule shared with RecordAction (2026-10-09); each colour is its own line after it. Every rule that
    // styles either door at rest is held — not only the first match, which since the split is the one-line colour rule.
    const rule = KIT_CSS.match(/\.recordDelete,\r?\n\.recordAction \{[^}]*\}/)?.[0] ?? '';
    assert.ok(rule, 'the shared shape rule exists');
    const atRest = [...KIT_CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .filter(([, sel]) => /\.record(Delete|Action)\b/.test(sel) && !/:(hover|focus-visible|disabled)/.test(sel));
    assert.ok(atRest.length >= 4, 'the shape, both colours and the phone floors');
    for (const [, sel, body] of atRest) {
      assert.doesNotMatch(body, /font-weight/, `body weight — the portal’s, never bold (${sel.trim()})`);
      assert.doesNotMatch(body, /text-decoration/, `underlined only on hover (${sel.trim()})`);
    }
    assert.match(KIT_CSS, /\.recordDelete \{ color: var\(--danger-light, var\(--danger\)\); \}/);
    assert.match(KIT_CSS, /\.recordDelete:hover \{ text-decoration: underline; \}/);
    assert.match(KIT_CSS, /\n {2}\.recordDelete \{ min-height: var\(--tap-min, 44px\); \}\n/, 'the touch floor, inside the phone block');
  });

  for (const [who, [file, call]] of Object.entries(RECORDS)) {
    it(`${who} renders it, still locked while busy`, () => {
      assert.match(readCode(file), call);
    });
  }

  it('its rare non-destructive twin, RecordAction (Archive, Bring back, Merge), is the same shape in the text’s colour', () => {
    assert.match(KIT, /export function RecordAction\(/);
    assert.match(KIT, /className=\{styles\.recordAction\}[^>]*>\s*\{icon\} \{children\}/);
    assert.match(KIT_CSS, /\.recordDelete,\r?\n\.recordAction \{[^}]*font-size: var\(--type-body\);[^}]*\}/, 'one shared shape');
    assert.match(KIT_CSS, /\.recordAction \{ color: var\(--text-primary\); \}/, 'never red: it can be undone');
    assert.match(KIT_CSS, /\.recordAction:hover \{ text-decoration: underline; \}/);
    assert.match(KIT_CSS, /\n {2}\.recordAction \{ min-height: var\(--tap-min, 44px\); \}\r?\n/, 'the touch floor, inside the phone block');
  });

  it('no record keeps a Delete style of its own', () => {
    for (const sheet of OLD_SHEETS) {
      assert.doesNotMatch(readCode(sheet), /\.(recordDelete|deleteButton)\b/, sheet);
    }
  });

  it('a lone door ending an editing body carries the save pill on its line above a touch width — no empty reserve under it (owner 2026-10-12)', () => {
    assert.match(KIT, /className=\{styles\.recordDelete\} [^>]*data-record-door=""/);
    assert.match(KIT, /className=\{styles\.recordAction\} [^>]*data-record-door=""/);
    const dialog = readCode('components/admin/kit/club/KitDialog.module.css');
    assert.match(dialog, /\.bodyWrap\[data-has-status\] > \.body \{ padding-bottom: 3\.75rem; \}/, 'the reserve stays the rule');
    assert.match(dialog, /@media \(min-width: 769px\) \{\s*\.bodyWrap\[data-has-status\] > \.body:has\(> :last-child > \[data-record-door\]:only-child\) \{ padding-bottom: 1rem; \}/,
      'only ONE door alone in the last block, and only above a touch width');
    // Sharing the line, the pill keeps to the right half so a long held reason wraps there, clear of the door (/review).
    assert.match(dialog, /\.bodyWrap\[data-has-status\]:has\(> \.body > :last-child > \[data-record-door\]:only-child\) > \.status \{ max-width: 50%; \}\s*\}/,
      'the pill’s right-half cap sits inside the same desk-only block');
  });

  it('a row of doors that can show no held reason opts in by marking itself — the game window read first (owner 2026-10-19)', () => {
    const dialog = readCode('components/admin/kit/club/KitDialog.module.css');
    assert.match(dialog, /@media \(min-width: 769px\) \{\s*\.bodyWrap\[data-has-status\] > \.body:has\(> :last-child > \[data-record-doors\]:only-child\) \{ padding-bottom: 1rem; \}\s*\.bodyWrap\[data-has-status\]:has\(> \.body > :last-child > \[data-record-doors\]:only-child\) > \.status \{ max-width: 50%; \}\s*\}/,
      'desk only, and the pill keeps to the right half');
    const windowCode = readCode('app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx');
    assert.match(windowCode, /className=\{gw\.actions\} data-record-doors=""/);
    // Only the READ body ends with that row: the form the pencil opens (where a held reason lives) never does.
    assert.equal((windowCode.match(/data-record-doors=""/g) ?? []).length, 1);
  });
});
