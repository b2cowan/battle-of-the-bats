/**
 * EVERY ADMIN READ ASKS WHAT THE CALLER MAY OPEN, NOT ONLY WHETHER THEY BELONG (Board Ready Stage 0a, the third access
 * sweep's findings 1 and 3, 2026-11-10).
 *
 * Every accepted assistant-coach invite writes an ACTIVE, capability-less `role='coach'` club membership, and the
 * shared auth (`getAuthContextWithScope` / `WithRole`) admits any active member — "no assignment rows" reads as
 * unrestricted. So a GET that stopped at the membership, the tournament scope and the tournament-in-org check answered a
 * club's assistant coaches, its scorekeepers and its staff with everything it held: the sent emails and every address
 * they went to, every tournament's full record, the games, venues, branding and archives.
 *
 * The shared auth was NOT changed to refuse coach rows (the census, BOARD_READY_ACCESS_SWEEP_3.md): a coach row
 * legitimately calls its own notification preferences and the free-time band, and a coach given "Run tournaments" holds
 * the tournament bundle as overrides — the question is the CAPABILITY, never the role. So each read names the door its
 * screen implies, and this guard fails the build when an `app/api/admin/**` GET resolves a member and checks nothing
 * the member holds.
 *
 * ⚠ It is a FLOOR: a GET that REFUSES on any branch passes (the free-time band's base read is every member's, its
 * billing facts ask `billing`). Each branch is its own review. It cannot see a GET that resolves the member inside a
 * lib wrapper (accounting, families, rep teams, schedules, the public site): each of those wrappers refuses by
 * capability today (/review 2026-11-10 read them all) — a new wrapper carries that question itself.
 *
 * ⚖ The allow-list below is the decision point. A route goes on it only when every member of the club is meant to read
 * it, with the reason. Adding one is a decision, not a fix for a red build.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readCode, stripComments } from './_source-code.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** Reads that every member of the club is meant to reach, and why. Paths are repo-relative route files. */
const OPEN_TO_EVERY_MEMBER: Record<string, string> = {
  'app/api/admin/board/route.ts':
    'the board’s names and roles (no contact details) — every member’s screens name the board the same way',
  'app/api/admin/members/count/route.ts':
    'the seat count and the plan’s limit — numbers only, no names',
  'app/api/admin/org/pdf-settings/route.ts':
    'the club’s PDF header (name, logo, colours) — every program’s exports print it',
  'app/api/admin/org/notification-preferences/route.ts':
    'the caller’s OWN notification rows only — a coach sets theirs on the account page',
  'app/api/admin/tournaments/[tournamentId]/notification-preferences/route.ts':
    'the caller’s OWN notification rows for one tournament only',
  'app/api/admin/org/permits/document/route.ts':
    'the Venue library’s own rule, as the permits list beside it: a coaching login opens nothing of the club’s, every '
    + 'other member reads the club’s permits (⚖ owner question raised 2026-11-10, sweep 3 finding 1+3 hand-off: should a '
    + 'scorekeeper read the permits and their documents? The permits LIST shares the rule; it passes this floor only '
    + 'because its `outside=1` branch refuses by role)',
  'app/api/admin/org/venues/route.ts':
    'the venue picker a coach schedules with (by design, its bookings contact stripped); the library view (?library=1) is '
    + 'the Venue library’s rule — every member but a coaching login (same owner question as the permits)',
  'app/api/admin/attention-summary/route.ts':
    'the hub’s attention counts — each program’s count is zero for a reader who cannot open that program',
  'app/api/admin/club-brief/route.ts':
    'the club hub’s brief: `shape` (what the club runs) is every reader’s; each program section is built only for a '
    + 'reader who can open it',
  'app/api/admin/org-settings/route.ts':
    'the club’s look (name, address, theme) — what the public site shows; an ACCEPTED member, never an invitee',
};

/**
 * Something that REFUSES by what the member holds — never a check merely computed into a response field (`canSave:
 * canSaveVenueLibrary(…)` refuses nobody; /review 2026-11-10 found the venue library and the permits list passing on one).
 *  · a refuser: a call that returns the refusal itself (`requireCapability`, a program's resolver);
 *  · a predicate, only where it is NEGATED or is an `if`'s condition (`if (!canOpenModule(…))`, `|| !(hasCapability(…)`);
 *  · the owner/admin role, only in its refusing form (`ctx.role !== 'owner'`, `!['owner', 'admin'].includes(`).
 * A predicate stored in a boolean and refused later (`const canMoney = …; if (!canMoney)`) does not count: that read goes
 * on the allow-list with its reason, which is the decision this guard exists to make visible.
 */
const REFUSERS = String.raw`(?:requireCapability|adminTournamentListView|houseLeagueRefusal|requireFamiliesAccess|resolveClubMoney|resolveClubTeam`
  + String.raw`|resolveScheduler|publicSiteEditor|clubLookEditor|requirePlatform\w*)\(`;
const PREDICATES = String.raw`(?:canOpenModule|hasCapability|canGate|canScore|canMoveClubMoney|canOpenRepMoney|canSeePayouts`
  + String.raw`|canConnectPayouts|canRefundOnline|canSaveVenueLibrary|calendarPrograms|canClosePlace)\(`;
const GATE = new RegExp([
  String.raw`\b${REFUSERS}`,
  // `return canGate(…)` is a file's own predicate helper (`canCheckIn`), refused where the handler negates it.
  String.raw`|(?:!\s*\(?\s*|\bif \(\s*|\breturn\s+)${PREDICATES}`,
  String.raw`|\b(?:ctx|auth|r\.ctx|g\.ctx)\.role\s*!==\s*'(?:owner|admin)'`,
  String.raw`|!\s*\[\s*'owner'\s*,\s*'admin'[^\]]*\]\.includes\(`,
  String.raw`|!\s*GROUP_UNSCOPED_ROLES\.includes\(`,
].join(''));

const RESOLVES_A_MEMBER = /\bgetAuthContext(?:WithScope|WithRole)?\(/;

/** A top-level declaration's text, from its start to the next top-level declaration. */
function declarationAt(code: string, at: number): string {
  const after = code.slice(at + 1);
  const end = after.search(/\n(?:export |(?:async )?function |(?:const|let|var) \w+\b|type \w+|interface \w+|class \w+)/);
  return code.slice(at, end < 0 ? code.length : at + 1 + end);
}

/** The GET handler's own text, plus the file's own helpers it reaches (`resolveContext` → `gate(ctx)` beside it). */
export function getHandlerText(code: string): string | null {
  const start = code.search(/export (?:const GET\b|(?:async )?function GET\b)/);
  if (start < 0) {
    // A GET exported some other way (`export { handler as GET }`, a re-export) would be skipped silently: refuse to guess.
    if (/\bexport\b[^;\n]*\bGET\b/.test(code)) throw new Error('a GET exported in a form this guard does not read — teach it the form');
    return null;
  }
  const seen = new Set<string>();
  const parts = [declarationAt(code, start)];
  for (let i = 0; i < parts.length && i < 12; i++) {
    for (const [, name] of parts[i].matchAll(/\b([a-zA-Z_]\w*)\(/g)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const def = code.search(new RegExp(String.raw`(?:^|\n)(?:export )?(?:async )?function ${name}\b|(?:^|\n)(?:export )?const ${name}\b[^=\n]*=`));
      if (def >= 0) parts.push(declarationAt(code, def));
    }
  }
  return parts.join('\n');
}

/** True when a GET resolves a member and then asks nothing about what they hold. */
export function opensToAnyMember(code: string): boolean {
  const text = getHandlerText(code);
  if (text === null) return false;
  return RESOLVES_A_MEMBER.test(text) && !GATE.test(text);
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(REPO, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(REPO, rel)).isDirectory()) out.push(...routeFiles(rel));
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

const ROUTES = routeFiles('app/api/admin');

describe('the guard itself (kill tests)', () => {
  const route = (get: string, extra = '') => `${extra}\nexport const GET = withObservability(async (req: Request) => {\n${get}\n});\nexport const POST = withObservability(async () => {\n  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();\n});\n`;
  it('flags a read that stops at the membership', () => {
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithScope({ orgSlug });\n  const denied = scopeGuard(ctx, id);\n  return rows;`)), true);
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContext({ orgSlug });\n  return rows;`)), true);
  });
  it('does not borrow the POST beside it', () => {
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithRole({ orgSlug });\n  return rows;`)), true);
  });
  it('passes a read that asks a door, a capability, a job or the role', () => {
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithScope({ orgSlug });\n  if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();`)), false);
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithScope({ orgSlug });\n  if (!canGate(ctx.role, ctx.capabilities)) return forbidden();`)), false);
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithRole({ orgSlug });\n  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();`)), false);
  });
  it('a role check that only shuts out a coach is not a gate (it lets every volunteer in)', () => {
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithRole({ orgSlug });\n  if (ctx.role === 'coach') return forbidden();`)), true);
  });
  it('follows the file’s own helpers down to the gate', () => {
    const helper = `function gate(ctx: Ctx) {\n  if (!canOpenModule(ctx, ctx.org, 'module_accounting')) return forbidden();\n}\n`;
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithScope({ orgSlug });\n  if (!gate(ctx)) return forbidden();`, helper)), false);
    const twoDeep = `${helper}async function resolveContext(id: string) {\n  const ctx = await getAuthContextWithRole({ orgSlug });\n  const err = gate(ctx);\n}\n`;
    assert.equal(opensToAnyMember(route(`  const r = await resolveContext(id);`, twoDeep)), false);
    const noGate = `async function resolveContext(id: string) {\n  return getAuthContextWithRole({ orgSlug });\n}\n`;
    assert.equal(opensToAnyMember(route(`  const r = await resolveContext(id);`, noGate)), true, 'a helper that only resolves the member is still open');
  });
  it('a gate written only in a comment is no gate (the routes are read through stripComments)', () => {
    const commented = route(`  const ctx = await getAuthContextWithScope({ orgSlug });\n  // if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();\n  return rows;`);
    assert.equal(opensToAnyMember(stripComments(commented)), true);
  });
  it('a check computed into a response field refuses nobody', () => {
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithRole({ orgSlug });\n  if (ctx.role === 'coach') return forbidden();\n  return json({ rows, canSave: canSaveVenueLibrary(ctx.role, ctx.capabilities) });`)), true);
    assert.equal(opensToAnyMember(route(`  const ctx = await getAuthContextWithRole({ orgSlug });\n  return json({ rows, isOwner: ctx.role === 'owner' });`)), true);
  });
  it('a route with no GET is skipped; a GET exported in a form it cannot read is refused, not skipped', () => {
    assert.equal(opensToAnyMember(`export const POST = withObservability(async () => {});`), false);
    assert.throws(() => opensToAnyMember(`async function handler() {}\nexport { handler as GET };`));
  });
  it('a resolver that returns the refusal itself counts (a program’s wrapper)', () => {
    assert.equal(opensToAnyMember(`export const GET = withObservability(async (req: Request) => {\n  const ctx = await getAuthContextWithScope({ orgSlug });\n  const r = await resolveClubMoney(ctx);\n});`), false);
  });
});

const at = (src: string, needle: string) => { const i = src.indexOf(needle); assert.ok(i >= 0, `found: ${needle}`); return i; };
const handler = (src: string, method: string) => {
  const start = at(src, `export const ${method} = `);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next < 0 ? src.length : next);
};

describe('the named reads ask the door their screen implies (sweep 3 findings 1 + 3)', () => {
  it('the sent emails and their recipients: the Communication screen’s own rule, before the posts are read', () => {
    const get = handler(readCode('app/api/admin/communications/route.ts'), 'GET');
    const gate = at(get, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')");
    assert.match(get, /hasCapability\(ctx\.role, ctx\.capabilities, 'post_announcements'\) \|\| hasCapability\(ctx\.role, ctx\.capabilities, 'send_communications'\)/);
    assert.ok(gate < at(get, ".from('announcements')"));
    // The rule is the screen's: lib/flip-twins names who may open Communication.
    assert.match(readCode('lib/flip-twins.ts'), /communication: \['send_communications', 'post_announcements'\]/);
  });
  it('the tournament list: one rule, asked by the route AND the layout’s first paint', () => {
    const list = readCode('lib/admin-tournament-list.ts');
    assert.match(list, /if \(canOpenModule\(ctx, ctx\.org, 'module_tournaments'\)\) return 'full';\s*if \(hasCapability\(ctx\.role, ctx\.capabilities, 'manage_members'\) \|\| canOpenModule\(ctx, ctx\.org, 'module_accounting'\)\) return 'names';\s*return null;/);
    // The first paint bakes FULL rows into the page, so only the full view gets a seed.
    assert.match(list, /if \(!ctx \|\| ctx\.org\.slug !== orgSlug \|\| adminTournamentListView\(ctx\) !== 'full'\) return undefined;/);
    const get = handler(readCode('app/api/admin/tournaments/route.ts'), 'GET');
    const refused = at(get, 'if (!view) return forbidden();');
    assert.ok(at(get, 'const view = adminTournamentListView(ctx);') < refused && refused < at(get, 'readAdminTournamentRows('));
    // A member manager without the tournaments area gets each event's name, never the contact email or the settings.
    assert.match(get, /if \(view === 'names'\) \{\s*return Response\.json\(rows\.map\(r => \(\{ id: r\.id, name: r\.name \?\? null, year: r\.year \?\? null, status: r\.status \?\? null \}\)\)\);/);
    assert.ok(at(get, "if (view === 'names') {") < at(get, "searchParams.get('counts') === '1'"));
  });
  it('the slug check asks the tournaments area (the one POST action not behind create_tournaments)', () => {
    const post = handler(readCode('app/api/admin/tournaments/route.ts'), 'POST');
    assert.match(post, /if \(action === 'check-slug'\s*\? !canOpenModule\(ctx, ctx\.org, 'module_tournaments'\)\s*: !hasCapability\(ctx\.role, ctx\.capabilities, 'create_tournaments'\)\) \{\s*return forbidden\(\);/);
  });
  it('the divisions: the tournaments area, or the gate (the check-in board lists teams by division)', () => {
    const get = handler(readCode('app/api/admin/divisions/route.ts'), 'GET');
    assert.ok(at(get, "const tournamentsArea = canOpenModule(ctx, ctx.org, 'module_tournaments');") < at(get, ".from('divisions')"));
    assert.ok(at(get, 'if (!tournamentsArea && !canGate(ctx.role, ctx.capabilities)) return forbidden();') < at(get, ".from('divisions')"));
    assert.match(readCode('components/admin/CheckInBoard.tsx'), /\/api\/admin\/divisions/);
  });
  it('the divisions: a gate-only volunteer is sent no fees (Board Ready trust close-out 5)', () => {
    const get = handler(readCode('app/api/admin/divisions/route.ts'), 'GET');
    assert.ok(get.includes('const fee = <T,>(v: T | null | undefined): T | null => (tournamentsArea ? v ?? null : null);'));
    for (const f of ['depositAmount: fee(group.deposit_amount)', 'depositDueDate: fee(group.deposit_due_date)',
      'totalFeeAmount: fee(group.total_fee_amount)', 'totalFeeDueDate: fee(group.total_fee_due_date)']) {
      assert.ok(get.includes(f), f);
    }
    // The board itself reads only the id and name.
    assert.doesNotMatch(readCode('components/admin/CheckInBoard.tsx'), /depositAmount|totalFeeAmount/);
  });
  for (const r of ['games', 'pool-slots', 'schedule-facility-lanes', 'venues', 'tournament-activity', 'tournament-branding']) {
    it(`${r}: the tournaments area, before anything is read`, () => {
      const get = handler(readCode(`app/api/admin/${r}/route.ts`), 'GET');
      const gate = at(get, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();");
      assert.ok(gate < get.indexOf('supabaseAdmin') || get.indexOf('supabaseAdmin') < 0);
      assert.ok(gate < at(get, 'scopeGuard(ctx'));
    });
  }
  it('the archives: an accepted member with the tournaments area, within their assigned events', () => {
    const get = handler(readCode('app/api/admin/tournament-archives/route.ts'), 'GET');
    assert.doesNotMatch(get, /getAuthContext\(/, 'not the any-membership context (it admits a pending invitee)');
    assert.ok(at(get, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();") < at(get, ".from('tournament_archives')"));
    assert.match(get, /if \(ctx\.assignedTournamentIds !== null\) query = query\.in\('tournament_id', ctx\.assignedTournamentIds\);/);
  });
  it('a member’s assignments: an accepted member who manages members, or their own', () => {
    const get = handler(readCode('app/api/admin/members/[memberId]/assignments/route.ts'), 'GET');
    assert.doesNotMatch(get, /getAuthContext\(/);
    assert.ok(at(get, "if (target.user_id !== ctx.user.id && !hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();")
      < at(get, ".from('org_member_tournament_assignments')"));
  });
});

describe('the writes that answered any member', () => {
  it('score review is a tournament setting: create_tournaments, before it is written; the write starts at the tournaments area', () => {
    const patch = handler(readCode('app/api/admin/tournament-branding/route.ts'), 'PATCH');
    assert.ok(at(patch, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();") < at(patch, 'await req.json()'));
    const gate = at(patch, "if ('requireScoreFinalization' in body && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {");
    assert.ok(gate < at(patch, 'updates.require_score_finalization = body.requireScoreFinalization'));
  });
  it('tournament access: never your own row below the owner, and a limited manager gives only what they can open', () => {
    const put = handler(readCode('app/api/admin/members/[memberId]/assignments/route.ts'), 'PUT');
    assert.doesNotMatch(put, /getAuthContext\(/, 'not the any-membership context');
    const write = at(put, ".from('org_member_tournament_assignments')");
    assert.ok(at(put, "if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();") < write);
    assert.ok(at(put, "if (target.user_id === ctx.user.id && ctx.role !== 'owner') {") < write);
    assert.ok(at(put, 'if (mine !== null && (tournamentIds.length === 0 || tournamentIds.some(id => !mine.includes(id)))) {') < write);
  });
  it('the setup steps: the owner or an admin writes them; reading them needs the tournaments area', () => {
    const src = readCode('app/api/admin/org/startup-tasks/route.ts');
    const post = handler(src, 'POST');
    assert.ok(at(post, "if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();") < at(post, ".update({ startup_tasks: next })"));
    const get = handler(src, 'GET');
    assert.ok(at(get, "if (!canOpenModule(ctx, ctx.org, 'module_tournaments')) return forbidden();") < at(get, 'buildProgress('));
  });
});

describe('every admin GET asks what the member holds', () => {
  it('finds the admin routes', () => assert.ok(ROUTES.length > 150, `found ${ROUTES.length}`));
  it('no GET stops at the membership, except the reads every member is meant to reach', () => {
    const open = ROUTES.filter(r => !(r in OPEN_TO_EVERY_MEMBER) && opensToAnyMember(readCode(r)));
    assert.deepEqual(open, [], `these GETs answer any member of the club — gate them by what their screen needs, or (a decision) add them to OPEN_TO_EVERY_MEMBER with the reason:\n  ${open.join('\n  ')}`);
  });
  it('the allow-list holds only real routes that are still open (a gated one comes off it)', () => {
    for (const r of Object.keys(OPEN_TO_EVERY_MEMBER)) {
      assert.ok(ROUTES.includes(r), `${r} is not an admin route`);
      assert.equal(opensToAnyMember(readCode(r)), true, `${r} now asks a gate — take it off OPEN_TO_EVERY_MEMBER`);
    }
  });
});
