/**
 * THE PUBLIC-SURFACE SECURITY FIXES OF CLUB TIER STAGE 0 (2026-09-25), pinned as shapes.
 *
 * 1. **A house-league admin route ties every id it is HANDED back to the season in its URL.**
 *    Every route proves the URL's season is the caller's org's (`getLeagueSeasonById(seasonId,
 *    orgId)`). That proves nothing about a division, team or registration id arriving in the body
 *    or query string — and those UUIDs are public. Before this fix the draft `start` action
 *    returned any org's registration rows (guardian email + phone, date of birth, notes) for a
 *    foreign division id, and placement / draft / team / registration writes re-filed other orgs'
 *    rows (plan I01). The schedule, generate and practices routes had been fixed one at a time,
 *    which is how the others were missed — so the rule is now stated over the whole folder.
 *
 *    ⚠ COVERAGE IS DERIVED, NOT LISTED. Which handlers read which ids is worked out from the
 *    source, so a new route (or a new body field on an old one) gains the check the moment it
 *    appears. The floor at the bottom stops the derivation silently finding nothing.
 *
 * 2. **The house-league and tryout emails escape what a family typed.** A PUBLIC form triggers
 *    them, with names the submitter chose, to an address the submitter chose.
 *
 * 3. **The public family forms are throttled.** Registration, status lookup and tryout
 *    registration had no limit at all (the tryout route, cited as the model, had none either).
 *
 * 4. **A tournament archive renders only under its own org** (plan F07).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function routesUnder(dir: string): string[] {
  const abs = join(ROOT, dir);
  return (readdirSync(abs, { recursive: true }) as string[])
    .filter(f => f.replace(/\\/g, '/').endsWith('route.ts'))
    .map(f => relative(ROOT, join(abs, f)).replace(/\\/g, '/'))
    .sort();
}

/** Split a route file into its exported handlers: `{ GET: '...', POST: '...' }`. */
function handlers(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /export const (GET|POST|PATCH|PUT|DELETE)\b/g;
  const marks: Array<{ verb: string; at: number }> = [];
  for (let m; (m = re.exec(src)); ) marks.push({ verb: m[1], at: m.index });
  marks.forEach((m, i) => { out[m.verb] = src.slice(m.at, marks[i + 1]?.at ?? src.length); });
  return out;
}

type IdKind = 'division' | 'team' | 'registration';

/** Ids a handler takes from the REQUEST (body or query string) — URL params are the route's own. */
function requestIds(handler: string): Set<IdKind> {
  const kinds = new Set<IdKind>();
  const destructured = [...handler.matchAll(/(?:const|let)\s*\{([^}]*)\}\s*=\s*body\b/g)].map(m => m[1]).join(',');
  const has = (name: string) =>
    new RegExp(`searchParams\\.get\\('${name}'\\)`).test(handler) ||
    new RegExp(`\\bbody\\.${name}\\b`).test(handler) ||
    new RegExp(`\\b${name}\\b`).test(destructured);
  if (has('divisionId')) kinds.add('division');
  if (has('teamId') || has('pickOrder')) kinds.add('team');
  if (has('registrationId') || has('assignments')) kinds.add('registration');
  return kinds;
}

/** Evidence the handler ties that kind of id to the season (shared helper, or the inline form
 *  the schedule / generate / practices routes were first fixed with). */
function scoped(kind: IdKind, handler: string, file: string): boolean {
  const inline = (table: string) =>
    new RegExp(`from\\('${table}'\\)[\\s\\S]{0,200}?eq\\('season_id', seasonId\\)`).test(handler);
  switch (kind) {
    case 'division': return /\bdivisionInSeason\(/.test(handler) || inline('league_divisions');
    case 'team':
      return /\bteamsInSeason\(/.test(handler) ||
        (/\bverifyTeamInSeason\(/.test(handler) && /function verifyTeamInSeason[\s\S]{0,300}?eq\('season_id', seasonId\)/.test(read(file)));
    case 'registration': return /\bregistrationsInSeason\(/.test(handler);
  }
}

/**
 * Handlers that read an id ONLY to narrow a query already filtered to this season — a foreign id
 * matches nothing, so there is nothing to tie back. Each entry says why.
 */
const FILTER_ONLY: Record<string, string> = {
  'app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts GET division':
    'narrows `league_games` already filtered `.eq(season_id)`',
  'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts GET division':
    'narrows `league_registrations` already filtered `.eq(season_id)`',
  'app/api/admin/house-league/seasons/[seasonId]/email/route.ts POST division':
    "filters this season's registrations in memory (getRegistrationsForSeason)",
  'app/api/admin/house-league/seasons/[seasonId]/email/route.ts POST team':
    "filters this season's registrations in memory (getRegistrationsForSeason)",
};

const HOUSE_LEAGUE = 'app/api/admin/house-league/seasons/[seasonId]';

/**
 * A handler with `if (action === '…')` branches is judged BRANCH BY BRANCH: an id a branch reads
 * must be checked in that branch, or in the prelude before the first branch (which every branch
 * runs through). Judging the whole handler at once would let a new unchecked branch pass on the
 * strength of a sibling's check — the draft and placement routes are exactly this shape.
 */
function segments(handler: string): { prelude: string; branches: string[] } {
  const parts = handler.split(/(?=if \(action === ')/);
  return { prelude: parts[0], branches: parts.slice(1) };
}

describe('house-league admin routes tie request ids to the season (plan I01)', () => {
  const found: string[] = [];
  const unscoped: string[] = [];
  for (const file of routesUnder(HOUSE_LEAGUE)) {
    for (const [verb, handler] of Object.entries(handlers(read(file)))) {
      const { prelude, branches } = segments(handler);
      for (const [label, text] of [['', prelude], ...branches.map((b, i) => [` #${i + 1}`, b])] as const) {
        for (const kind of requestIds(text)) {
          const key = `${file} ${verb} ${kind}`;
          if (!found.includes(key)) found.push(key);
          if (FILTER_ONLY[key]) continue;
          if (!scoped(kind, text, file) && !scoped(kind, prelude, file)) unscoped.push(`${key}${label}`);
        }
      }
    }
  }

  it('every handler that takes a division, team or registration id from the request checks it', () => {
    assert.deepEqual(unscoped, [], `Tie these ids to the season with lib/league-season-scope.ts:\n  ${unscoped.join('\n  ')}`);
  });

  it('every FILTER_ONLY exemption still matches a handler that reads that id', () => {
    const stale = Object.keys(FILTER_ONLY).filter(k => !found.includes(k));
    assert.deepEqual(stale, [], 'Remove exemptions whose handler no longer reads the id');
  });

  it('the derivation finds the handlers known on 2026-09-25 (it cannot silently find none)', () => {
    for (const key of [
      `${HOUSE_LEAGUE}/draft/route.ts POST division`,
      `${HOUSE_LEAGUE}/draft/route.ts POST team`,
      `${HOUSE_LEAGUE}/draft/route.ts POST registration`,
      `${HOUSE_LEAGUE}/placement/route.ts POST division`,
      `${HOUSE_LEAGUE}/placement/route.ts POST team`,
      `${HOUSE_LEAGUE}/placement/route.ts POST registration`,
      `${HOUSE_LEAGUE}/standings/route.ts GET division`,
      `${HOUSE_LEAGUE}/teams/route.ts GET division`,
      `${HOUSE_LEAGUE}/teams/route.ts POST division`,
      `${HOUSE_LEAGUE}/registrations/route.ts POST division`,
      `${HOUSE_LEAGUE}/registrations/[regId]/route.ts PATCH division`,
      `${HOUSE_LEAGUE}/registrations/[regId]/route.ts PATCH team`,
      `${HOUSE_LEAGUE}/practices/route.ts POST team`,
      `${HOUSE_LEAGUE}/schedule/route.ts POST division`,
      `${HOUSE_LEAGUE}/schedule/generate/route.ts POST division`,
    ]) assert.ok(found.includes(key), `expected the guard to see ${key}`);
  });

  it("the email log is read only after the season is proven to be the caller's", () => {
    const get = handlers(read(`${HOUSE_LEAGUE}/email/route.ts`)).GET;
    assert.ok(/getLeagueSeasonById\(seasonId, ctx!\.org\.id\)[\s\S]*getLeagueEmailLog\(seasonId\)/.test(get));
  });
});

describe('house-league and tryout emails escape what a family typed', () => {
  const src = read('lib/email.ts');
  const builders = [...src.matchAll(/export function ((?:league|tryout)\w*Html)\(/g)].map(m => m[1]);

  it('finds the builders (it cannot silently find none)', () => {
    assert.ok(builders.length >= 8, `found only ${builders.length}: ${builders.join(', ')}`);
  });

  for (const name of builders) {
    it(`${name} escapes its params before interpolating any of them`, () => {
      // The params type closes with `}) {`; the body's first line follows it.
      const bodyStart = src.indexOf('\n', src.indexOf('}) {', src.indexOf(`export function ${name}(`))) + 1;
      const firstLine = src.slice(bodyStart, src.indexOf('\n', bodyStart)).trim();
      assert.equal(firstLine, 'const p = escapeEmailFields(input);', `${name} must open with the escape`);
    });
  }
});

describe('the public family forms are throttled', () => {
  const PUBLIC_FORMS = [...routesUnder('app/api/league/[orgSlug]'), ...routesUnder('app/api/rep-teams/[orgSlug]')]
    .filter(f => /export const POST\b/.test(read(f)));

  it('finds the forms (it cannot silently find none)', () => {
    assert.ok(PUBLIC_FORMS.length >= 3, PUBLIC_FORMS.join(', '));
  });

  for (const file of PUBLIC_FORMS) {
    it(`${file} throttles before it resolves anything`, () => {
      const post = handlers(read(file)).POST;
      const throttle = post.indexOf('throttlePublicForm(req)');
      assert.ok(throttle > 0, 'missing throttlePublicForm(req)');
      assert.ok(throttle < post.indexOf('await ', post.indexOf('await params') + 1), 'throttle must come first');
    });
  }

  it('the two registration forms also cap mail to one recipient', () => {
    for (const file of PUBLIC_FORMS.filter(f => f.endsWith('/register/route.ts'))) {
      assert.ok(/throttlePublicFormRecipient\(guardianEmail!\)/.test(read(file)), file);
    }
  });
});

describe('a tournament archive renders only under its own org (plan F07)', () => {
  it('the archive page compares the archive to the org in the URL', () => {
    assert.ok(/if \(archive\.orgId !== org\.id\) notFound\(\);/.test(read('app/[orgSlug]/archives/[archiveId]/page.tsx')));
  });
});
