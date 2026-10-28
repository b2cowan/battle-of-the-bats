/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SUPPORT CONSOLE, STAGE 2 — Find, the menu by job, Today, the customer records, one rulebook
 * (owner rulings A1–A11, 2026-10-25; PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_BUILD_PROMPT.md §8).
 *
 *   1. The sign-in lookup (migration 365) is the SERVER's alone: revoked from PUBLIC, anon and authenticated, granted to
 *      service_role, SECURITY DEFINER with an empty search path, and it returns exactly the listed columns. (The live
 *      half — the anon key refused with 42501 — is `.probe/pasc/s2-anon-rpc.mjs`, run on dev 2026-10-25.)
 *   2–5. Find is POST only, checks the staff session and power FIRST, never reads the address, is never cached, never
 *      logs the words, builds its answer per role (a hidden group's reader is never called), takes 2–120 characters,
 *      matches a Stripe number whole only, and caps each group at 8 in the database.
 *   6–8. Every console API resolves its role through the one powers list; Billing holds no club or person support power
 *      but still triages feedback; an unconfirmed email never yields a staff context.
 *   9. The menu: five groups by job, nine names, the eye agrees with the powers list, a folded group carries the sum.
 *   10–11. Put it back only on plan/limit, section and running-override entries; the trail never reaches a Story.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { readCode, readSource, filesUnder } from './_source-code.ts';
import {
  PLATFORM_AREAS, PLATFORM_POWERS, canViewPlatformArea, hasPlatformPower, isPlatformAreaReadOnly, type PlatformArea,
} from '../../lib/platform-areas.ts';
import {
  checkFindWords, findGroupsFor, runFind, stripeNumberKind, FIND_FAILED, FIND_ROWS_PER_GROUP, type FindReaders,
} from '../../lib/platform-find.ts';
import { baseMenuGroups, visibleMenuGroups, foldedGroupCount, TODAY_ITEM } from '../../app/platform-admin/console-menu.ts';
import type { PlatformRole } from '../../lib/platform-auth.ts';

const ROLES: PlatformRole[] = ['super_admin', 'support', 'billing', 'product', 'growth', 'read_only'];
const MIGRATION = 'supabase/migrations/365_support_console_lookup_and_records_opened.sql';

// ── 1 · The lookup ───────────────────────────────────────────────────────────────────────────────────────────────────
describe('1 · the sign-in lookup is the server’s alone', () => {
  // The SQL without its comments (the header names what is NOT returned, in words).
  const sql = readSource(MIGRATION).replace(/--.*$/gm, '');
  const fns = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([^)]*)\)/g)].map(m => ({ name: m[1] }));

  it('creates the four lookups', () => {
    assert.deepEqual(fns.map(f => f.name).sort(), ['platform_find_clubs', 'platform_find_people', 'platform_people_by_ids', 'platform_people_search']);
  });

  for (const fn of ['platform_find_clubs', 'platform_find_people', 'platform_people_by_ids', 'platform_people_search']) {
    it(`${fn}: revoked from PUBLIC, anon and authenticated; granted to service_role only`, () => {
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM PUBLIC;`));
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon, authenticated;`));
      assert.match(sql, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`));
      assert.doesNotMatch(sql, new RegExp(`GRANT [A-Z ,]+ ON FUNCTION public\\.${fn}\\([^)]*\\) TO (anon|authenticated|PUBLIC)`));
    });
  }

  it('every function is SECURITY DEFINER with an empty search path, reading schema-qualified tables', () => {
    const bodies = sql.split('CREATE OR REPLACE FUNCTION').slice(1);
    assert.equal(bodies.length, 4);
    for (const b of bodies) {
      assert.match(b, /SECURITY DEFINER/);
      assert.match(b, /SET search_path = ''/);
      assert.doesNotMatch(b, /FROM (users|organizations|organization_members|platform_users)\b/, 'tables are schema-qualified');
    }
  });

  it('a person row is exactly the listed columns: id, email, name, last sign-in, created, banned-until, confirmed-at', () => {
    const person = /RETURNS TABLE \(\s*id uuid,\s*email text,\s*display_name text,\s*last_sign_in_at timestamptz,\s*created_at timestamptz,\s*banned_until timestamptz,\s*email_confirmed_at timestamptz(,\s*total_count bigint)?\s*\)/g;
    assert.equal([...sql.matchAll(person)].length, 3, 'the three people functions return the listed columns and nothing else');
    assert.doesNotMatch(sql, /\b(phone|encrypted_password|raw_app_meta_data|confirmation_token|recovery_token)\b/);
  });

  it('the trail table is service-role only (RLS on, no policies, no grants to the public key)', () => {
    assert.match(sql, /ALTER TABLE public\.platform_record_opens ENABLE ROW LEVEL SECURITY;/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.platform_record_opens FROM anon, authenticated;/);
  });
});

// ── 2 · Find's door ──────────────────────────────────────────────────────────────────────────────────────────────────
describe('2 · Find is POST only and checks the staff session first', () => {
  const route = readCode('app/api/platform-admin/find/route.ts');

  it('exports POST and nothing else a browser could call', () => {
    assert.match(route, /export const POST = /);
    assert.doesNotMatch(route, /export (const|async function) (GET|PUT|PATCH|DELETE)\b/);
  });

  it('the first statement of the handler is the staff check + power, before any read', () => {
    const body = route.slice(route.indexOf('withObservability(async'));
    const firstAwait = body.indexOf('await ');
    assert.equal(body.slice(firstAwait, firstAwait + "await requirePlatformPower('view_console')".length), "await requirePlatformPower('view_console')");
    assert.ok(body.indexOf('if (auth.response)') < body.indexOf('req.json()'), 'refused before the body is read');
    assert.ok(body.indexOf('if (auth.response)') < body.indexOf('runFind('), 'refused before anything is searched');
  });

  it('the staff check refuses a signed-out, customer or disabled staff session (403) and an unconfirmed email', () => {
    const auth = readCode('lib/platform-auth.ts');
    assert.match(auth, /\.eq\('is_active', true\)/, 'a disabled staff account has no role');
    assert.match(auth, /new NextResponse\('Forbidden', \{ status: 403 \}\)/);
  });
});

// ── 3 · Per role ─────────────────────────────────────────────────────────────────────────────────────────────────────
function spyReaders() {
  const calls: string[] = [];
  const readers: FindReaders = {
    async clubs() { calls.push('clubs'); return { rows: [{ id: 'c1', name: 'Lynx', slug: 'lynx', planLabel: 'Club', statusLabel: 'Active', ownerEmail: 'o@x.ca' }], total: 1 }; },
    async people() { calls.push('people'); return { rows: [{ id: 'p1', email: 'p@x.ca', name: null, lastSignInAt: null, banned: false }], total: 1 }; },
    async personClubs() { calls.push('personClubs'); return new Map(); },
    async stripe(n) { calls.push('stripe'); return [{ orgId: 'c1', orgName: 'Lynx', planLabel: 'Club', number: n, kind: 'customer' }]; },
    async sentEmails() { calls.push('sentEmails'); return { rows: [], total: 0 }; },
  };
  return { readers, calls };
}

describe('3 · each role is answered from the rulebook, and a hidden group is never searched', () => {
  it('Stripe numbers for Super admin, Billing and Support only (A2)', () => {
    assert.deepEqual(ROLES.filter(r => findGroupsFor(r).includes('stripe')), ['super_admin', 'support', 'billing']);
    for (const r of ROLES) assert.deepEqual(findGroupsFor(r).slice(0, 2), ['clubs', 'people'], `${r} finds clubs and people`);
  });

  for (const role of ROLES) {
    it(`${role}: a group it may not read has no key, no count, and its reader is never called`, async () => {
      const { readers, calls } = spyReaders();
      const answer = await runFind(role, 'cus_QF3kR8mZ2vXb1L', readers);
      const stripe = hasPlatformPower(role, 'find_stripe');
      assert.equal('stripe' in answer, stripe);
      assert.equal(calls.includes('stripe'), stripe);
      assert.deepEqual(answer.searched, findGroupsFor(role));
    });
  }

  it('words that are not a Stripe number never start the Stripe search, even for a role that may', async () => {
    const { readers, calls } = spyReaders();
    await runFind('super_admin', 'lynx', readers);
    assert.ok(!calls.includes('stripe'));
  });

  // Stage 3 reads Stripe for a subscription's charge (owner Q5), so "kept in Stripe only" became "nothing matches": a number
  // that is neither a family payment nor one of our clubs' reads the same as one that does not exist.
  it('a pasted charge number found nowhere reads as not found (Stage 3 replaced A10’s state)', async () => {
    const { readers } = spyReaders();
    readers.stripe = async () => [];
    const answer = await runFind('billing', 'ch_3PfQ2kL8mZ', readers);
    assert.equal(answer.stripeNotFound, true);
  });
});

// ── 4 · The words never leave Find's path ────────────────────────────────────────────────────────────────────────────
describe('4 · the words ride in the body, are never cached and never logged', () => {
  const route = readCode('app/api/platform-admin/find/route.ts');
  const lib = readCode('lib/platform-find.ts');
  const box = readCode('app/platform-admin/FindBox.tsx');

  it('no handler on Find\'s path reads the address', () => {
    for (const src of [route, lib]) assert.doesNotMatch(src, /searchParams|req\.url|nextUrl|new URL\(/);
  });

  it('the panel sends a POST with the words in the body, to an address with no query', () => {
    assert.match(box, /fetch\('\/api\/platform-admin\/find', \{\s*method: 'POST'/);
    assert.match(box, /body: JSON\.stringify\(\{ q: trimmed \}\)/);
    assert.doesNotMatch(box, /\/api\/platform-admin\/find\?/);
  });

  it('every answer is no-store', () => {
    assert.match(route, /'Cache-Control': 'no-store'/);
    assert.match(route, /headers: NO_STORE/);
  });

  it('nothing on the path logs, and a failure becomes one fixed sentence before it is recorded', () => {
    for (const src of [route, lib]) assert.doesNotMatch(src, /console\.(log|warn|error|info)/);
    assert.match(route, /captureError\(new Error\(FIND_FAILED\)/);
    assert.doesNotMatch(route, /catch \((err|error|e)\)/, 'the caught error is never kept, let alone recorded');
    assert.doesNotMatch(route, /writePlatformAuditLog|recordOpened/, 'Find writes no audit row and no trail row: opening a record does');
    assert.equal(typeof FIND_FAILED, 'string');
  });

  it('the person table\'s People list searches in the body too, never the address', () => {
    assert.match(readCode('app/platform-admin/customer-users/PeopleClient.tsx'), /fetch\('\/api\/platform-admin\/people', \{\s*method: 'POST'/);
    assert.doesNotMatch(readCode('app/api/platform-admin/people/route.ts'), /searchParams|req\.url/);
  });
});

// ── 5 · Input ────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('5 · input: 2–120 characters, wildcards literal, Stripe whole only, 8 a group in SQL', () => {
  it('2–120 characters after trimming', () => {
    assert.equal(checkFindWords('a').ok, false);
    assert.equal(checkFindWords('  a  ').ok, false);
    assert.equal(checkFindWords('ab').ok, true);
    assert.equal(checkFindWords('x'.repeat(120)).ok, true);
    assert.equal(checkFindWords('x'.repeat(121)).ok, false);
    assert.equal(checkFindWords(42).ok, false);
  });

  it('a Stripe number matches whole only — a partial number is no search key', () => {
    assert.equal(stripeNumberKind('cus_QF3kR8mZ2vXb1L'), 'customer');
    assert.equal(stripeNumberKind('sub_1PfQ2kL8mZ'), 'subscription');
    assert.equal(stripeNumberKind('pi_3PfQ2kL8mZ'), 'payment');
    assert.equal(stripeNumberKind('ch_3PfQ2kL8mZ'), 'payment');
    for (const partial of ['cus_', 'cus_QF3', 'QF3kR8mZ2vXb1L', 'cus_QF3kR8mZ2vXb1L ', 'xcus_QF3kR8mZ2vXb1L', '4242']) {
      assert.equal(stripeNumberKind(partial), null, partial);
    }
  });

  it('LIKE\'s own wildcards are escaped and matched literally', () => {
    const sql = readSource(MIGRATION);
    assert.match(sql, /replace\(replace\(replace\(q, '\\', '\\\\'\), '%', '\\%'\), '_', '\\_'\)/);
    assert.ok((sql.match(/ESCAPE '\\'/g) ?? []).length >= 8);
  });

  it('Find\'s groups are LIMIT 8 in the database, not a parameter', () => {
    const sql = readSource(MIGRATION);
    for (const fn of ['platform_find_people', 'platform_find_clubs']) {
      const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}(`)).split('$$;')[0];
      assert.match(body, /LIMIT 8;/, fn);
      assert.doesNotMatch(body, /p_limit/, `${fn} takes no limit from its caller`);
    }
    assert.equal(FIND_ROWS_PER_GROUP, 8);
  });

  it('staff are left out of People, and the demo sandboxes out of every group', () => {
    const sql = readSource(MIGRATION);
    assert.match(sql, /NOT EXISTS \(SELECT 1 FROM public\.platform_users pu WHERE lower\(pu\.email\) = lower\(u\.email::text\)\)/);
    const lookup = readCode('lib/platform-people-lookup.ts');
    assert.match(lookup, /p_exclude_emails: getBootstrapAdminEmails\(\)/);
    assert.match(lookup, /p_exclude_slugs: \[\.\.\.DEMO_ORG_SLUGS\]/);
    assert.match(readCode('app/api/platform-admin/find/route.ts'), /isDemoOrgSlug\(org\.slug\)/);
  });
});

// ── 6 · One rulebook ─────────────────────────────────────────────────────────────────────────────────────────────────
// `personActionContext` is the person actions' front door: it checks `person_support` first (guarded below).
const GATES = /requirePlatformPower\(|requireAnyPlatformPower\(|requirePlatformAreaApi\(|requireBookkeepingApi\(|requireDevToolPlatformAdmin\(|personActionContext(<[^>]*>)?\(/;

describe('6 · every console API resolves its role through the one powers list', () => {
  const routes = filesUnder('app/api/platform-admin', '.ts').filter(f => f.endsWith('route.ts'));

  it('finds the console routes', () => assert.ok(routes.length > 40));

  for (const file of routes) {
    it(file, () => {
      const src = readCode(file);
      assert.match(src, GATES, 'a gate from the one list');
      assert.doesNotMatch(src, /getPlatformAuthContext|hasPlatformPermission|requireSuperAdmin|ROLE_PERMISSIONS/, 'no second rulebook');
      assert.doesNotMatch(src, /role (===|!==) '(super_admin|support|billing|product|growth|read_only)'/, 'no role read by hand');
      // Each exported handler gates before anything else it awaits (crons: the cron secret first, then the power).
      for (const m of src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withObservability\(async/g)) {
        const body = src.slice(m.index!);
        const next = body.slice(1).search(/export const (GET|POST|PUT|PATCH|DELETE) =/);
        const handler = next >= 0 ? body.slice(0, next + 1) : body;
        const gate = handler.search(GATES);
        assert.ok(gate > 0, `${m[1]} has a gate`);
        const before = handler.slice(0, gate).replace(/await\s*$/, '');
        assert.doesNotMatch(before.replace(/isCronRequest\(req\)/, ''), /await (?!params)/, `${m[1]}: nothing is awaited before the gate`);
      }
    });
  }

  it('the staff list answers a super admin only; the orphaned plan settings routes are gone', () => {
    assert.match(readCode('app/api/platform-admin/company-users/route.ts'), /export const GET = withObservability\(async \(\) => \{[\s\S]*?requirePlatformPower\('staff'\)/);
    assert.ok(!existsSync('app/api/platform-admin/plan-config'), 'plan-config is deleted, not guarded');
    assert.ok(!existsSync('app/api/platform-admin/plan-gating'), 'plan-gating is deleted, not guarded');
  });

  it('there is ONE powers table, and every area\'s write side is made of its powers', () => {
    assert.doesNotMatch(readCode('lib/platform-auth.ts'), /ROLE_PERMISSIONS|PlatformPermission\b/);
    for (const [area, access] of Object.entries(PLATFORM_AREAS)) {
      for (const p of access.powers) assert.ok(p in PLATFORM_POWERS, `${area} uses a power that exists`);
    }
  });
});

// ── 7 · A1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('7 · Billing lost Support\'s club and person powers (A1), and kept feedback triage (F3)', () => {
  it('the powers', () => {
    assert.equal(hasPlatformPower('billing', 'club_support'), false);
    assert.equal(hasPlatformPower('billing', 'person_support'), false);
    assert.equal(hasPlatformPower('billing', 'feedback_triage'), true);
    assert.equal(hasPlatformPower('billing', 'email_owner'), true);
    assert.equal(hasPlatformPower('billing', 'club_billing'), true);
    assert.equal(hasPlatformPower('support', 'club_support'), true);
    assert.equal(hasPlatformPower('support', 'person_support'), true);
  });

  it('every club-identity, ownership, own-address and note route needs club_support; every person action person_support', () => {
    for (const f of ['identity', 'transfer-ownership', 'own-address', 'notes/[noteId]']) {
      assert.match(readCode(`app/api/platform-admin/orgs/[id]/${f}/route.ts`), /requirePlatformPower\('club_support'\)/, f);
    }
    assert.match(readCode('app/api/platform-admin/orgs/[id]/notes/route.ts'), /export const POST[\s\S]*requirePlatformPower\('club_support'\)/);
    for (const f of ['ban', 'confirm-email', 'reset', 'revoke-sessions', 'update']) {
      assert.match(readCode(`app/api/platform-admin/users/[id]/${f}/route.ts`), /personActionContext(<[^>]*>)?\(req, id/, f);
    }
    assert.match(readCode('lib/platform-person-action.ts'), /const auth = await requirePlatformPower\('person_support'\);/);
    assert.match(readCode('app/api/platform-admin/users/[id]/notes/[noteId]/route.ts'), /requirePlatformPower\('person_support'\)/);
  });

  it('feedback triage reads the feedback page\'s power, never a support power', () => {
    for (const f of ['feedback/[id]/status', 'feedback/[id]/escalate']) {
      const src = readCode(`app/api/platform-admin/${f}/route.ts`);
      // Stage 5: the Feedback page now also carries the reply power, so triage asks triage itself, not "any power on
      // the page" (which would let a reply-only role triage).
      assert.match(src, /requirePlatformPower\('feedback_triage'\)/);
      assert.doesNotMatch(src, /person_support|club_support/);
    }
  });
});

// ── 8 · Confirmed email ──────────────────────────────────────────────────────────────────────────────────────────────
describe('8 · an unconfirmed email never yields a staff context', () => {
  it('the check runs before the bootstrap branch and the role read', () => {
    const src = readCode('lib/platform-auth.ts');
    const fn = src.slice(src.indexOf('export async function getPlatformAdminContext'));
    const check = fn.indexOf('if (!user.email_confirmed_at) return null;');
    assert.ok(check > 0);
    assert.ok(check < fn.indexOf('isBootstrapAdmin(user.email)'));
    assert.ok(check < fn.indexOf('getDbPlatformRole(user.email)'));
  });
});

// ── 9 · The menu ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe('9 · the menu by job', () => {
  it('Today alone, then the five groups by job, in order; System and Private finance after', () => {
    assert.equal(TODAY_ITEM.label, 'Today');
    assert.deepEqual(baseMenuGroups(true).map(g => g.label), ['Customers', 'Health', 'Growth', 'Product', 'Records', 'System']);
    assert.deepEqual(visibleMenuGroups('super_admin', true, false).map(g => g.label), ['Customers', 'Health', 'Growth', 'Product', 'Records', 'Private finance']);
  });

  it('the entries and their nine new names', () => {
    const labels = baseMenuGroups(true).map(g => `${g.label}: ${g.items.map(i => i.label).join(', ')}`);
    assert.deepEqual(labels, [
      // Stage 4 renamed Founding season → Free time, in the same place (owner ruling Q4).
      'Customers: Clubs & portals, People, Free time, Retention',
      // Stage 5 joined Status (first) and Sent emails to the group; it made no new group (drawing A).
      'Health: Status, Errors, Feedback, Sent emails, Online payments',
      'Growth: Leads, Campaigns, Pitch decks, Business numbers',
      'Product: Plans & pricing, Approval queue, Bulk changes, Email templates, Export registry',
      'Records: Staff, Audit log',
      'System: Dev tools',
    ]);
  });

  it('every page title takes its menu word', () => {
    const titles: Array<[string, RegExp]> = [
      ['app/platform-admin/page.tsx', /AdminPageHeader title="Today"/],
      ['app/platform-admin/orgs/OrgsClient.tsx', /AdminPageHeader title="Clubs & portals"/],
      ['app/platform-admin/customer-users/PeopleClient.tsx', /AdminPageHeader title="People"/],
      ['app/platform-admin/observability/page.tsx', /title="Errors"/],
      ['app/platform-admin/early-access/page.tsx', /AdminPageHeader title="Leads"/],
      ['app/platform-admin/email/EmailDashboardClient.tsx', /AdminPageHeader title="Campaigns"/],
      ['app/platform-admin/pitch-deck-studio/page.tsx', /AdminPageHeader title="Pitch decks"/],
      ['app/platform-admin/bulk-operations/BulkOperationsClient.tsx', /AdminPageHeader title="Bulk changes"/],
      ['app/platform-admin/users/CompanyUsersClient.tsx', /title="Staff"/],
    ];
    for (const [f, re] of titles) assert.match(readCode(f), re, f);
  });

  it('who sees what did not move: every entry follows canViewPlatformArea; Bookkeeping follows canBookkeep', () => {
    for (const role of ROLES) {
      const seen = visibleMenuGroups(role, false, true).flatMap(g => g.items.map(i => i.area));
      const expected = baseMenuGroups(true).flatMap(g => g.items).filter(i => canViewPlatformArea(role, i.area)).map(i => i.area);
      assert.deepEqual(seen, expected, role);
      assert.ok(!visibleMenuGroups(role, false, true).some(g => g.label === 'Private finance'), `${role}: no Bookkeeping without the allowlist`);
    }
    assert.match(readCode('app/platform-admin/layout.tsx'), /canBookkeep=\{canAccessBookkeeping\(auth\)\}/);
  });

  it('the eye tells the truth (the drawings\' menus, A1 applied)', () => {
    const eyes = (role: PlatformRole) => baseMenuGroups(true).flatMap(g => g.items)
      .filter(i => canViewPlatformArea(role, i.area) && isPlatformAreaReadOnly(role, i.area)).map(i => i.label);
    assert.deepEqual(eyes('super_admin'), []);
    // Stage 4: Free time's write side is the plan-and-billing power (it is given on the record), so Support and Product
    // read it with the eye.
    assert.deepEqual(eyes('support'), ['Free time', 'Retention', 'Errors']);
    // Stage 4b: Billing gives a Coaches Portal free time from a person's record, so People is no longer read-only for it.
    assert.deepEqual(eyes('billing'), ['Plans & pricing', 'Approval queue']);
    assert.deepEqual(eyes('product'), ['People', 'Free time']);
    assert.deepEqual(eyes('growth'), ['Clubs & portals', 'People']);
    assert.deepEqual(eyes('read_only'), ['Clubs & portals', 'People']);
  });

  it('a folded group\'s pill is the sum of its rows (A11)', () => {
    const customers = baseMenuGroups(false)[0];
    const counts: Partial<Record<PlatformArea, number>> = { organizations: 10, retention: 7, customer_users: 0 };
    assert.equal(foldedGroupCount(customers, counts), 17);
    assert.equal(foldedGroupCount(baseMenuGroups(false)[1], {}), 0);
  });

  it('Today\'s icon is the tray, never the house', () => {
    assert.match(readCode('app/platform-admin/PlatformAdminNav.tsx'), /today: Inbox/);
  });
});

// ── 10 · Put it back ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('10 · Put it back only on plan/limit, section and running-override entries', () => {
  const story = readCode('lib/platform-story.ts');
  const view = readCode('lib/platform-story-view.ts');
  // Free time's entries moved to their own module in Stage 4 (lib/free-time-story.ts), the Story still calls it.
  const freeTime = readCode('lib/free-time-story.ts');
  it('the four kinds, and nothing else', () => {
    const kinds = [...view.matchAll(/\| \{ kind: '(\w+)'/g)].map(m => m[1]);
    // Stage 4 added override_end: a free-time change undone restores the earlier last day (T10).
    assert.deepEqual(kinds.sort(), ['override', 'override_end', 'plan', 'section'], 'PutBack is a union of exactly these four');
    const offers = [...(story + freeTime).matchAll(/markPutBack\((?:entry|given), [^;]*?\{\s*kind: '(\w+)'/g)].map(m => m[1]);
    assert.deepEqual([...new Set(offers)].sort(), ['override', 'override_end', 'plan', 'section']);
    assert.match(story, /freeTimeStoryEntries\(/);
  });
  it('free time is offered only while running, on its newest entry; a plan only on the newest plan entry still in force', () => {
    assert.match(freeTime, /markPutBack\(given, running && !newestChange && o\.expires_at \? \{\s*kind: 'override'/);
    assert.match(freeTime, /if \(c === newestChange && running && o\.expires_at\) \{/);
    assert.match(story, /r\.id === newestPlanId && org\.plan_id === toPlan/);
  });
  it('nothing that reached Stripe is put back: no plan door with a Stripe subscription now or cut by the change, or a billing state the undo cannot restore', () => {
    assert.match(story, /const stripeFree = !org\.stripe_subscription_id && !oldV\?\.stripe_subscription_id;/);
    assert.match(story, /org\.plan_id === toPlan && stripeFree && billingSame/);
  });
  it('a section put back changes that one section, and never over a change made at the same moment', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/put-back/route.ts');
    assert.match(route, /toggle: \{ section: target\.section, on: target\.on \}/);
    const changes = readCode('lib/club-record-changes.ts');
    assert.match(changes, /write\.eq\('enabled_addons', JSON\.stringify\(before\)\)/, 'the sections write is a compare-and-set');
    assert.match(changes, /if \(!written \|\| written\.length === 0\) return stale;/);
  });
  it('the route applies the target the Story itself offers, checked against that kind\'s power', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/put-back/route.ts');
    assert.match(route, /\(await buildClubStory\(id\)\)\.find\(e => e\.key === key\)\?\.putBack/);
    assert.match(route, /if \(!target\)/);
    assert.match(route, /target\.kind === 'section' \? 'club_sections' : 'club_billing'/);
    assert.match(route, /applyOperatorPlanChange\(/, 'a plan goes back through the one plan-change rule');
    assert.doesNotMatch(route, /from\('platform_audit_log'\)/, 'the route never works the undo out again from the audit log');
  });
});

// ── 11 · The trail is never on a Story ───────────────────────────────────────────────────────────────────────────────
describe('11 · the Story never shows a "Records opened" row', () => {
  it('the Story reads no trail', () => {
    assert.doesNotMatch(readCode('lib/platform-story.ts'), /platform_record_opens|listRecordsOpened|record_opens/);
  });
  it('only Super admin reads the trail, in the Audit log', () => {
    assert.deepEqual(ROLES.filter(r => hasPlatformPower(r, 'records_opened')), ['super_admin']);
    assert.match(readCode('app/platform-admin/audit/page.tsx'), /hasPlatformPower\(auth\.role, 'records_opened'\)/);
  });
  it('the trail keeps 90 days by pruning on write, never the words', () => {
    const trail = readCode('lib/platform-record-opens.ts');
    assert.match(trail, /RECORD_OPENS_KEEP_DAYS = 90/);
    assert.match(trail, /\.delete\(\)\.lt\('opened_at', cutoff\)/);
    assert.doesNotMatch(trail, /words|query|search/i);
  });
});
