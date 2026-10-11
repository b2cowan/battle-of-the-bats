import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCode as readRaw, stripComments } from './_source-code.ts';

/** Code, never prose: a guard that reads a comment proves the comment (tests/unit/_source-code.ts). SQL is read raw. */
const readCode = (f: string) => (f.endsWith('.sql') ? readRaw(f) : stripComments(readRaw(f)));

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CALENDAR FEEDS' WIRING (Club Tier Stage 6d, A3–A6; ruled 2026-10-11). Source scans, because the rules are about
 * WHERE a decision is made and what a route touches:
 *   1. ONE QUESTION for the public schedule — the team page, its Subscribe button and the public feed read
 *      `getPublicTeamSchedule`, and nothing else asks `getFamilyTeamView` for `public_link` (S6D-09, D07).
 *   2. A GOOD READ TOUCHES NO COUNTER — each feed counts a read only where it refuses it (A4, S6D-03).
 *   3. A STOPPED LINK ANSWERS EMPTY — each feed answers its stopped cases with a calendar, never "not found" (F10).
 *   4. THE TEAM-WIDE TOKEN IS GONE — nothing reads or writes `rep_teams.family_calendar_token_hash` (A6).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const COACH_FEED = 'app/api/calendar/coach/[token]/route.ts';
const PUBLIC_FEED = 'app/[orgSlug]/teams/[teamSlug]/calendar/route.ts';
const FAMILY_FEED = 'app/api/family/calendar/[token]/route.ts';
const TEAM_PAGE = 'app/[orgSlug]/teams/[teamSlug]/page.tsx';
const PREDICATE = 'lib/public-team-schedule.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}
const SOURCE = [...walk('app'), ...walk('lib'), ...walk('components')];

describe('1 · one question for the public schedule', () => {
  it('the page and the public feed both ask getPublicTeamSchedule', () => {
    for (const f of [TEAM_PAGE, PUBLIC_FEED]) assert.match(readCode(f), /getPublicTeamSchedule\(\{ org, team \}\)/, f);
  });
  it('no second copy: only the predicate asks getFamilyTeamView for public_link', () => {
    const askers = SOURCE.filter(f => /requireVisibility:\s*'public_link'/.test(readCode(f)));
    assert.deepEqual(askers, [PREDICATE]);
  });
  it('the predicate asks the club-cancelled question the page used to skip', () => {
    assert.match(readCode(PREDICATE), /isOrgBillingSuspended/);
    assert.match(readCode(PREDICATE), /isFamilyLayerEnabled/);
  });
});

describe('2 · a good read touches no counter', () => {
  for (const f of [COACH_FEED, PUBLIC_FEED, FAMILY_FEED]) {
    it(f, () => {
      const code = readCode(f);
      assert.doesNotMatch(code, /checkNoLoginRateLimit/, 'the counting-every-read limiter is gone from the feeds');
      const calls = code.match(/refusedFeedResponse\(req\)/g) ?? [];
      assert.equal(calls.length, 1, 'refused in exactly one place');
      assert.doesNotMatch(code, /countRefusedCalendarRead/, 'the counter is touched only through the shared refusal');
    });
  }
  it('the coach feed counts only in its refused branch', () => {
    const code = readCode(COACH_FEED);
    const refused = code.slice(code.indexOf("case 'refused'"), code.indexOf("case 'stopped'"));
    assert.match(refused, /refusedFeedResponse\(req\)/);
  });
  it('the public and family feeds count only inside their "never issued" guard', () => {
    assert.match(readCode(PUBLIC_FEED), /if \(!org \|\| !team\) return refusedFeedResponse\(req\);/);
    assert.match(readCode(FAMILY_FEED), /if \(!link\) return refusedFeedResponse\(req\);/);
  });
  it('the shared refusal is the counter\'s only caller, and it counts before it answers', () => {
    assert.match(readCode('lib/calendar-feed-response.ts'),
      /export async function refusedFeedResponse\(req: Request\)[\s\S]*?await countRefusedCalendarRead\(req\)/);
  });
});

describe('3 · a stopped link answers an empty calendar, never "not found"', () => {
  it('the coach feed', () => {
    assert.match(readCode(COACH_FEED), /case 'stopped':\s*return calendarResponse\(\{ calendarName: answer\.calendarName, entries: \[\]/);
  });
  it('the public feed', () => {
    assert.match(readCode(PUBLIC_FEED), /if \(!view\) return calendarResponse\(\{ calendarName, entries: \[\]/);
  });
  it('the family feed', () => {
    assert.match(readCode(FAMILY_FEED), /if \(!view\) \{[\s\S]*?return calendarResponse\(\{ calendarName, entries: \[\]/);
  });
  it('the public feed is cacheable by a shared cache; the personal feeds never are', () => {
    assert.match(readCode('lib/calendar-feed-response.ts'), /PUBLIC_FEED_CACHE = 'public, s-maxage=300, stale-while-revalidate=600'/);
    assert.match(readCode(PUBLIC_FEED), /cacheControl: PUBLIC_FEED_CACHE/);
    for (const f of [COACH_FEED, FAMILY_FEED]) assert.doesNotMatch(readCode(f), /PUBLIC_FEED_CACHE/, f);
  });
});

describe('4 · the team-wide calendar token is gone', () => {
  it('nothing reads or writes rep_teams.family_calendar_token_hash (comments aside)', () => {
    assert.deepEqual(SOURCE.filter(f => /family_calendar_token_hash/.test(readCode(f))), []);
  });
  it('the rotating mint and its resolver are gone', () => {
    const code = readCode('lib/family-access.ts');
    assert.doesNotMatch(code, /export async function ensureTeamCalendarToken/);
    assert.doesNotMatch(code, /export async function resolveTeamByCalendarToken/);
  });
  it('mig 324 drops the column and its index', () => {
    const sql = readCode('supabase/migrations/324_the_team_wide_calendar_token_retires.sql');
    assert.match(sql, /drop column if exists family_calendar_token_hash/i);
    assert.match(sql, /drop index if exists public\.rep_teams_family_calendar_token_uniq/i);
  });
});
