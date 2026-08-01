/**
 * Chunk F — "everything in a closed season is read-only", enforced as a RULE over the source
 * tree rather than screen by screen.
 *
 * Why this test exists, precisely: before Chunk F, closed-season writes were refused by
 * ACCIDENT, not by a guard. Every write handler resolves its coaching assignment through the
 * active-only lookup (403 for a closed year) and then `getActiveRepProgramYear` (404 when the
 * team has none), so a past season was simply unaddressable. Chunk F makes past seasons
 * addressable — which dissolves that accident. The rule has to be stated somewhere, and stating
 * it here (once, over the whole tree) is worth more than forty runtime probes: a route added
 * next year is covered without anyone remembering to cover it.
 *
 * THE RULE: a write handler may not read the season parameter and may not touch the season-read
 * rail. Reads address a season; writes address the live one, always.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLOSED_TEAM_NAV_ITEMS, isCoachNavItemVisible } from '../../lib/coach-nav-visibility.ts';
import { resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

const COACH_API_ROOT = join(process.cwd(), 'app', 'api', 'coaches');
const WRITE_VERBS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

/**
 * Governing rule 3's single deliberate exception: the head coach may still manage WHO CAN SEE a
 * closed season. Its writes touch assignment rows only — never that season's records. Adding a
 * path here is a security decision; it must come with an owner ruling.
 */
const READ_ACCESS_WRITE_EXCEPTIONS = [
  join('teams', '[teamId]', 'staff'),
];

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

/** The body of one exported handler, from its `export const VERB` to the next one (or EOF). */
function handlerBody(src: string, verb: string): string | null {
  const start = src.search(new RegExp(`export const ${verb}\\b`));
  if (start < 0) return null;
  const rest = src.slice(start + verb.length + 13);
  const next = rest.search(/\nexport const (GET|POST|PATCH|PUT|DELETE)\b/);
  return next < 0 ? src.slice(start) : src.slice(start, start + verb.length + 13 + next);
}

const files = routeFiles(COACH_API_ROOT);

describe('Chunk F — no write handler can address a past season', () => {
  it('finds the coach API routes at all (guards against a vacuous pass)', () => {
    assert.ok(files.length > 40, `expected the coach API tree, found ${files.length} route files`);
  });

  it('no write handler reads the ?year= season parameter', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/seasonParam\s*\(|searchParams\.get\(\s*['"]year['"]\s*\)/.test(body)) {
          offenders.push(`${file.replace(process.cwd(), '')} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler reads the season parameter. Writes address the live season only — ' +
      'see lib/coach-season-read.ts. If this is the staff read-access exception, it still may ' +
      'not take a year from the query string.');
  });

  it('no write handler resolves through the season-READ rail', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = file.replace(process.cwd(), '');
      if (READ_ACCESS_WRITE_EXCEPTIONS.some(ex => rel.includes(ex))) continue;
      const src = readFileSync(file, 'utf8');
      for (const verb of WRITE_VERBS) {
        const body = handlerBody(src, verb);
        if (!body) continue;
        if (/resolveCoachSeasonRead(Context)?\s*\(/.test(body)) {
          offenders.push(`${rel} → ${verb}`);
        }
      }
    }
    assert.deepEqual(offenders, [],
      'A write handler uses the season-read rail. That rail admits CLOSED seasons by design — ' +
      'it is read-only infrastructure. Write handlers keep their active-only resolver.');
  });

  it('the read rail is actually in use, so the rule is not guarding an empty set', () => {
    const readers = files.filter(f => /resolveCoachSeasonRead/.test(readFileSync(f, 'utf8')));
    assert.ok(readers.length >= 10,
      `expected the season-read rail on the converted GET routes, found ${readers.length}`);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE ARCHIVE IS OPT-IN (owner ruling, 2026-08-01)
 *
 * "Any new feature, window, etc. in the coaches portal defaults to NOT being viewable in
 *  archived seasons, and we explicitly add them if needed — so we aren't opening up new
 *  functionality to historical seasons without explicitly saying so."
 *
 * The architecture already fails closed: a coach API route that does not opt into the
 * season-read rail resolves the team's ACTIVE year and cannot address a past season at all.
 * These two lists turn that default from an accident into a CONTRACT — reaching into history
 * requires editing a list, which is a decision someone has to make on purpose.
 *
 * If one of these fails, the change is not wrong — it just isn't approved yet. Take the
 * question to the owner, then add the entry in the same commit.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
describe('the archive is opt-in — nothing reaches a past season by default', () => {
  /**
   * Doors a coach can open on a FINISHED season. Adding one means a whole section becomes
   * historical: every page it leads to must resolve the viewed season, show the read-only
   * chip, and offer no write control (tests/uat/scenarios/coach-frozen-season-smoke.spec.ts
   * sweeps exactly that). Owner ruling D-F1 governs what belongs here.
   */
  const APPROVED_ARCHIVE_DOORS = [
    "Season's End", 'Roster', 'Schedule', 'Attendance', 'Lineups', 'Money',
    'Documents', 'Development', 'Tryouts', 'Insights', 'Staff',
  ];

  /**
   * Routes permitted to serve a past season. Everything absent from this list resolves the
   * ACTIVE year — which is the default, and the safe one.
   *
   * ⚠ Adding a path here is the moment a feature becomes historical. Ask three questions
   * first: is it a RECORD or an INSTRUMENT (instruments stay live — D-F7); does its page
   * carry the season through every link and fetch; and does it show what the coach could see
   * AT THE TIME rather than today (governing rule 1)?
   */
  const APPROVED_SEASON_AWARE_ROUTES = [
    'attendance', 'award-types', 'awards', 'budget', 'budget-plan', 'budget-vs-actual',
    'development/board', 'development/sessions', 'dues', 'events',
    'events/[eventId]/lineup', 'expense-tags', 'expenses', 'fundraisers', 'history',
    'lineup-templates', 'milestones', 'money-summary', 'roster', 'roster/[playerId]',
    'season-surplus', 'staff', 'staff/[coachId]', 'tags', 'tryout-history', 'wrapped',
  ];

  it('no door has been added to a finished season without a decision', () => {
    assert.deepEqual(
      CLOSED_TEAM_NAV_ITEMS.map(i => i.label).sort(),
      [...APPROVED_ARCHIVE_DOORS].sort(),
      'The archive door set changed. A new section is NOT viewable in past seasons by default ' +
      '(owner ruling 2026-08-01) — if it should be, get that decision, add it to ' +
      'APPROVED_ARCHIVE_DOORS, and make every page behind it season-aware and read-only.',
    );
  });

  it('no route has learned to serve a past season without a decision', () => {
    const actual = files
      .filter(f => /resolveCoachSeasonRead(Context)?\s*\(|resolveCoachSeasonCapabilityMap\s*\(/
        .test(readFileSync(f, 'utf8')))
      .map(f => f
        .replace(process.cwd(), '')
        .replace(/^[\\/]app[\\/]api[\\/]coaches[\\/]/, '')
        .replace(/\[orgSlug\][\\/]teams[\\/]\[teamId\][\\/]/, '')
        .replace(/[\\/]route\.ts$/, '')
        .replace(/\\/g, '/'))
      .sort();

    assert.deepEqual(actual, [...APPROVED_SEASON_AWARE_ROUTES].sort(),
      'A coach route gained (or lost) the ability to serve a past season. New features are ' +
      'live-season-only by default (owner ruling 2026-08-01). If this one genuinely belongs in ' +
      'the archive, confirm it is a RECORD and not an INSTRUMENT, make its page carry the ' +
      'season through every link and fetch, then add it to APPROVED_SEASON_AWARE_ROUTES.');
  });
});

/**
 * The label-keyed nav gate is a known trap: `isCoachNavItemVisible` switches on the DISPLAY
 * label and falls through to `default: return true`. Chunk F opens nine new doors on a closed
 * season, so a label that isn't in that switch silently hands an ungranted assistant the door.
 * Chunk B's own review found this exact class of bug on a rename.
 */
describe('Chunk F — every closed-season door is actually gated', () => {
  /** Doors deliberately open to any assigned coach — each is a conscious decision, not a gap. */
  const INTENTIONALLY_UNGATED = new Set(["Season's End", 'Insights']);

  /**
   * Everything OFF. Not a real grant bundle — an assistant's floor legitimately includes
   * schedule/attendance/lineups/roster-view/documents-view, so testing against the floor would
   * pass regardless. This tests the thing that actually matters: that the switch RECOGNISES each
   * label at all. A label it doesn't recognise falls through to `default: return true` and stays
   * visible even here.
   */
  const deniedEverything = {
    isHeadCoach: false, schedule: false, attendance: false, lineups: false,
    roster: 'off', rosterWrite: false, rosterPii: false, notes: false,
    money: 'off', documents: 'off', announcementsSend: false, tryouts: false,
  } as ReturnType<typeof resolveCoachCapabilities>;

  it('the closed-season nav is the full record set, not Batch 3’s two doors', () => {
    assert.ok(CLOSED_TEAM_NAV_ITEMS.length >= 10,
      `expected the opened door set, found ${CLOSED_TEAM_NAV_ITEMS.length}`);
  });

  it('no door falls through the label switch to default:true', () => {
    const ungated = CLOSED_TEAM_NAV_ITEMS
      .map(i => i.label)
      .filter(label => !INTENTIONALLY_UNGATED.has(label))
      .filter(label => isCoachNavItemVisible(deniedEverything, label));
    assert.deepEqual(ungated, [],
      'These closed-season doors stay visible to a coach denied everything. The label is missing ' +
      'from the switch in lib/coach-nav-visibility.ts and fell through to `default: return true` ' +
      '— or it belongs in INTENTIONALLY_UNGATED with a reason.');
  });

  it('a head coach still sees every door', () => {
    const head = resolveCoachCapabilities('head_coach', null);
    const hidden = CLOSED_TEAM_NAV_ITEMS
      .map(i => i.label)
      .filter(label => !isCoachNavItemVisible(head, label));
    assert.deepEqual(hidden, [], 'A head coach must see the whole archive.');
  });

  it('the tryouts door points at the ARCHIVE, never the live hub', () => {
    const tryouts = CLOSED_TEAM_NAV_ITEMS.find(i => i.label === 'Tryouts');
    assert.ok(tryouts, 'the tryouts door should exist on a closed season (owner ruling D-F1)');
    assert.equal(tryouts!.href, '/tryouts/history',
      'the live tryout hub runs a tryout — check-in, evaluator links, decisions, offer emails. ' +
      'A finished season gets the record, not the machinery.');
  });
});
