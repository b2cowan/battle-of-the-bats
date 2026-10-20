import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCode as readRaw, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * SUBSCRIBE LIVES BEHIND THE SCHEDULE'S EXPORT, AND ONLY THERE (Club Tier Stage 6d, B2, ruled 2026-10-11 — design log,
 * Stage 6d ruling 1). `CoachExportButton` is the portal's ONE export control, shared by the Schedule and every Money tab
 * (`MoneyExportButton` wraps it), so its Subscribe door is an OPT-IN prop: a Money tab that has no schedule must render
 * exactly as it did. And the door goes behind the Export, never on a toolbar line.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const readCode = (f: string) => stripComments(readRaw(f));
const SCHEDULE = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
const TSX = [...walk('app'), ...walk('components')];

describe('only the Schedule passes the Subscribe door', () => {
  it('no file but the Schedule hands CoachExportButton a subscribe prop', () => {
    // Each element, from its tag to the line that closes it (a prop may hold JSX of its own, so `>` can't end it).
    const elements = (code: string) => code.match(/<CoachExportButton\b[\s\S]*?\n\s*\/>/g) ?? [];
    const users = TSX.filter(f => elements(readCode(f)).length > 0);
    assert.ok(users.length >= 2, `the scan sees the control's callers (${users.join(', ')})`);
    const passers = users.filter(f => elements(readCode(f)).some(el => /\bsubscribe=/.test(el)));
    assert.deepEqual(passers, [SCHEDULE]);
  });
  it('MoneyExportButton (every Money tab) never mentions it', () => {
    assert.doesNotMatch(readCode('components/coaches/MoneyExportButton.tsx'), /subscribe/i);
  });
  it('the Schedule passes it only to a coach who can see the schedule', () => {
    assert.match(readCode(SCHEDULE), /const scheduleSubscribe = page\.capabilities\?\.schedule\s*\?/);
  });
});

describe('without the prop, the control is as it was', () => {
  const code = readCode('components/coaches/CoachExportButton.tsx');
  it('the trigger greys exactly as before when nothing can be exported (a Subscribe door is the only exception)', () => {
    assert.match(code, /const triggerDisabled = disabled && !subscribe;/);
  });
  it('the phone Calendar menu and the Subscribe row both render only with the prop', () => {
    assert.match(code, /\{surface === 'drawer' && subscribe && \(/);
    assert.match(code, /onSubscribe=\{subscribe \? /);
    assert.match(code, /setSurface\(subscribe && isPhone \? 'drawer' : 'dialog'\);/);
  });
  it('the Subscribe window is loaded only when it opens — no Money tab carries its code', () => {
    assert.match(code, /const CoachCalendarSubscribe = dynamic\(\(\) => import\('\.\/CoachCalendarSubscribe'\)/);
  });
  it('Subscribe is not a file type — it is never one of the choices', () => {
    assert.doesNotMatch(readCode(SCHEDULE), /id: 'subscribe'/);
  });
});

describe('the public page\'s button reads the one question', () => {
  it('the page passes Subscribe only beside the schedule it renders from getPublicTeamSchedule', () => {
    const page = readCode('app/[orgSlug]/teams/[teamSlug]/page.tsx');
    // Stage 4b-2a wraps the schedule in the desk layout's column; it still renders only from the one answer.
    assert.match(page, /\{publicSchedule && \([\s\S]{0,80}?<RepTeamPublicSchedule\s+view=\{publicSchedule\}/);
    assert.match(page, /subscribe=\{\{ feedPath: publicTeamFeedPath\(orgSlug, team\.slug\)/);
  });
});
