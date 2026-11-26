/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A PREVIEW CLUB IS NEVER A CUSTOMER** (Club Website Track P, owner ruling T1, 2026-11-25).
 *
 * A preview is a prospect's own club site we build before a meeting, on production, with no people (lib/preview-org.ts).
 * One marker says so, `organizations.is_preview` (mig 535), and T1 rules that every count, list, search and email reads
 * it, held by a build check. This is that check. It is the look-back list pattern (`HISTORY_ENDPOINTS`): a new reader
 * of the shape the rule governs fails here until someone decides, in this file, which side of the rule it is on.
 *
 * THE RULES, in the order they are asserted below:
 *   1. Every query that lists or counts ORGANIZATIONS across the platform (a `.from('organizations')` chain that does
 *      not name its club by id, slug or a Stripe id, and writes nothing) is on `ENUMERATORS`, as `rule` (the file
 *      reads the preview rule) or `clean` (a preview cannot be in it by construction, said why). A new one fails; a
 *      listed file that stops enumerating fails, so the list cannot rot.
 *   2. The surfaces of the drawing's tab 1 that reach clubs through ANOTHER table (counts by `org_id`, the senders, the
 *      events) each read the rule: `THROUGH_OTHER_TABLES`.
 *   3. Every email names its club: `orgId` is REQUIRED on the sender (TypeScript then holds every call), and the sender
 *      refuses a preview's mail BEFORE it writes a log row, failing closed.
 *   4. Not indexed, not listed: the org layout's "don't index" reads the marker; the directory's two scopes leave
 *      previews out; robots.txt NEVER names one (that file is public and would list our prospects).
 *   5. Watched: error alerts are NOT silenced for a preview (unlike a demo).
 *   6. The door: a preview gets its public-site sections and nothing else; the plan stays the club's own.
 *
 * ⚠⚠ SCOPE LIMITS, STATED SO THEY ARE NOT MISTAKEN FOR COVERAGE. This is a source scan:
 *   1. A chain that names its club (`.eq('id')`, `.in('id', ids)`, `.eq('slug')`) is taken as reading clubs the caller
 *      already holds. Where those ids came from another table, rule 2 is the only cover, and only for the files it names.
 *   2. A database function that enumerates clubs (an RPC) is invisible here. `platform_find_clubs` (Find) returns
 *      previews on purpose; Find labels them, and the lead picker that shares it filters them (`THROUGH_OTHER_TABLES`).
 *   3. Rule 1 sees `.from('organizations')`; a query written another way (an embedded `organizations(...)` on another
 *      table) is rule 2's or review's.
 *   4. "Reads the rule" is a file-level token for rules 1 and 2; the shared readers are pinned by function below. A file
 *      with several chains passes on one filtered chain: `clean` chains in a `rule` file (Find's Stripe searches) rest on
 *      the database's own CHECK that a preview holds no Stripe ids.
 *   5. `orgId: null` is typed, not proven: a club's send that passed null would skip the preview refusal. Every null today
 *      is our own mail or a person's account mail (reviewed 2026-11-25); review keeps it so.
 * If one of these fails, the change is not necessarily wrong; it just is not decided yet. Decide it here, in the commit.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource, functionBody, between } from './_source-code.ts';
import { foldGrants, ownFactsOf } from '../../lib/free-time.ts';
import { PREVIEW_SECTIONS, isPreviewRow } from '../../lib/preview-org.ts';

/**
 * What "reads the preview rule" looks like in code. A FILE-level test (scope limit 4 below): the rule's own readers are
 * pinned function by function in the later sections, so removing the rule from a shared reader fails there, not here.
 * Not a bare `isPreview`: the tournament admin's "preview" pages carry an unrelated prop of that name.
 */
const PREVIEW_TOKEN = /is_preview|\.isPreview\b|openPreviewOrgIds|isPreviewOrgId|notCustomerOrgIds|getUnlistedOrgIds|PREVIEW_SECTIONS/;

type Klass = 'rule' | 'clean' | 'dev';

const ENUMERATORS: Record<string, [Klass, string]> = {
  'app/platform-admin/orgs/page.tsx': ['rule', 'Clubs & portals: previews live on Prospect clubs (P2)'],
  'app/platform-admin/bulk-operations/page.tsx': ['rule', 'Bulk changes: never a target (the route refuses one too)'],
  'app/platform-admin/plans-pricing/page.tsx': ['rule', 'Plans & pricing: who a price change touches'],
  'app/platform-admin/email/page.tsx': ['rule', 'the email opt-out list'],
  'app/api/platform-admin/find/route.ts': ['rule', 'Find: the phone/number and Stripe searches; Find labels a preview "Preview club" and still finds it by name'],
  'lib/platform-metrics.ts': ['rule', 'Business numbers, the snapshot and Today: notCustomerOrgIds and the preview exclusions carry them'],
  'lib/renewals-read.ts': ['rule', 'Renewals: notCustomerOrgIds'],
  'lib/lead-book.ts': ['rule', 'Leads: New accounts, sign-ups and offered clubs'],
  'lib/directory.ts': ['rule', '/discover, /scores, search, follows and every sitemap: getUnlistedOrgIds and scopeFollowableOrgs'],
  'lib/billing-drift-server.ts': ['rule', 'Stripe watch (a preview holds no subscription; filtered by name too)'],
  'lib/preview-org-server.ts': ['rule', 'the marker reader itself'],
  'lib/console-money-sales-tax-wait.ts': ['clean', 'clubs with a Stripe customer: a preview is never one (no owner, no checkout until the claim clears the marker)'],
  'lib/two-step-grace-emails.ts': ['clean', 'clubs that switched two-step on: a preview has no people to switch it, and its mail is refused by the sender'],
  'app/api/dev/seed/status/route.ts': ['dev', 'dev seed tooling'],
  'app/api/dev/seed/users/route.ts': ['dev', 'dev seed tooling'],
  'app/api/dev/seed/wipe/route.ts': ['dev', 'dev seed tooling'],
};

/** Reached through another table, or a sender: each must read the rule (the drawing's tab 1 rows). */
const THROUGH_OTHER_TABLES: Record<string, string> = {
  'lib/email.ts': 'the main sender refuses a preview club\'s mail, failing closed',
  'lib/email-sender.ts': 'the marketing sender',
  'lib/notify.ts': 'the bell, push and notification email',
  'lib/fan-notify.ts': 'fan score alerts',
  'lib/team-coach-notices.ts': 'the coach notices sweep and the invited-coach bell',
  'lib/platform-events.ts': 'sign-up, activity and billing events are not written for a preview',
  'lib/free-time-list.ts': 'Free time list (and Today\'s free-time count, Renewals)',
  'lib/free-time-writes.ts': 'Free time give refuses a preview',
  'lib/lead-writes.ts': 'a lead is never linked to a preview',
  'app/api/platform-admin/early-access/clubs/route.ts': 'the lead page club picker (Find\'s RPC returns previews)',
  'app/api/platform-admin/bulk-operations/route.ts': 'Bulk changes refuses a preview',
  'lib/platform-online-payments.ts': 'Online payments health',
  'lib/team-org-links.ts': 'the coach-to-club link finder reads a preview as not discoverable',
  'app/[orgSlug]/layout.tsx': '"don\'t index" on every page of a preview',
  'lib/db.ts': 'org mapper: isPreview, and isDiscoverable false for a preview',
  'lib/server-organizations.ts': 'org mapper: isPreview, and isDiscoverable false for a preview',
  'lib/api-auth.ts': 'org mapper: isPreview, and isDiscoverable false for a preview',
  'lib/free-time.ts': 'the door folds the preview sections',
  'lib/entitlement-grants.ts': 'the door folds a preview even with no grant',
};

const FROM = /\.from\(\s*['"]organizations['"]\s*\)/g;
/** A chain that names its club, or writes: not an enumeration. */
const NAMED = /\.(eq|ilike|in)\(\s*['"](id|slug|stripe_customer_id|stripe_subscription_id)['"]|\.(maybeSingle|single)\b|\.(insert|update|upsert|delete)\(/;

function enumeratingChains(code: string): number {
  let n = 0;
  for (const m of code.matchAll(FROM)) {
    // The chain runs to its statement's end, or to the next query (a Promise.all lists several in one statement). Not to
    // a blank line: stripping a comment out of a chain leaves one.
    const rest = code.slice(m.index!, m.index! + 1200);
    const end = rest.slice(1).search(/;|\.from\(|supabaseAdmin\b/);
    const chain = end >= 0 ? rest.slice(0, end + 1) : rest;
    if (!NAMED.test(chain)) n++;
  }
  return n;
}

const SOURCES = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('lib', '.tsx'),
  ...filesUnder('components', '.ts'), ...filesUnder('components', '.tsx'), 'proxy.ts']
  .filter(f => !/\.test\.tsx?$/.test(f));

describe('preview clubs: every list and count of clubs decides (rule 1)', () => {
  const found = new Map<string, number>();
  for (const f of SOURCES) {
    const n = enumeratingChains(readCode(f));
    if (n > 0) found.set(f, n);
  }

  it('every query listing or counting clubs is on ENUMERATORS', () => {
    const missing = [...found.keys()].filter(f => !ENUMERATORS[f]);
    assert.deepEqual(missing, [], `New platform-wide club queries with no decision about preview clubs (Track P, T1). Read the
preview rule (filter .eq('is_preview', false), or openPreviewOrgIds / notCustomerOrgIds) and add the file as 'rule', or say
why a preview cannot be in it as 'clean':\n  ${missing.join('\n  ')}`);
  });

  it('every file on ENUMERATORS still lists clubs (the list cannot rot)', () => {
    const stale = Object.keys(ENUMERATORS).filter(f => !found.has(f));
    assert.deepEqual(stale, [], `These no longer list clubs; take them off ENUMERATORS:\n  ${stale.join('\n  ')}`);
  });

  it("every 'rule' file reads the preview rule", () => {
    const blind = Object.entries(ENUMERATORS).filter(([f, [k]]) => k === 'rule' && !PREVIEW_TOKEN.test(readCode(f))).map(([f]) => f);
    assert.deepEqual(blind, [], `Marked 'rule' but read no preview marker:\n  ${blind.join('\n  ')}`);
  });
});

describe('preview clubs: the surfaces reached through other tables read the rule (rule 2)', () => {
  for (const [f, why] of Object.entries(THROUGH_OTHER_TABLES)) {
    it(`${f}: ${why}`, () => assert.match(readCode(f), PREVIEW_TOKEN));
  }
  it('Business numbers leaves previews out of the counts it scopes by org (registrations, entries, retention, events)', () => {
    const code = readCode('lib/platform-metrics.ts');
    assert.match(code, /exOrg\(supabaseAdmin\.from\('league_registrations'\)/);
    assert.match(code, /exOrg\(supabaseAdmin\.from\('accounting_entries'\)[^]*?'accounting_ledgers\.org_id'\)/);
    assert.match(code, /exOrg\(supabaseAdmin\s*\.from\('billing_retained_records'\)/);
    assert.match(functionBody(code, 'resolvePreviewExclusions'), /openPreviewOrgIds\(\)/);
  });
  it('the shared not-a-customer set carries the previews itself (Renewals reads it with no ids handed in)', () => {
    assert.match(functionBody(readCode('lib/platform-metrics.ts'), 'notCustomerOrgIds'), /openPreviewOrgIds\(\)/);
  });
  it('the customer list drops previews by its own column, and the kept snapshot fails closed', () => {
    const code = readCode('lib/platform-metrics.ts');
    assert.match(functionBody(code, 'getCommandCenterStats'), /\.from\('organizations'\)[^;]*?\.eq\('is_preview', false\)/);
    assert.match(functionBody(code, 'writeTodayPlatformMetricSnapshot'), /getCommandCenterStats\(\{ strictPreviews: true \}\)/);
  });
  it('the senders refuse a preview by the club they are handed, in the same fail-closed try', () => {
    assert.match(functionBody(readCode('lib/notify.ts'), 'notify'), /if \(await isPreviewOrgId\(opts\.orgId\)\) return;/);
    assert.match(functionBody(readCode('lib/fan-notify.ts'), 'fanPushContext'), /isPreviewOrgId\(tournament\.org_id as string\)\) return null;/);
    assert.match(functionBody(readCode('lib/email-sender.ts'), 'sendMarketingEmail'), /isPreviewOrgId\(orgId\)\) return 'suppressed';/);
    assert.match(functionBody(readCode('lib/platform-events.ts'), 'writePlatformEvent'), /isPreviewOrgId\(input\.orgId\)/);
  });
  it("the console's plan and sections writers refuse a preview", () => {
    assert.match(functionBody(readCode('lib/operator-plan-change.ts'), 'applyOperatorPlanChange'), /is_preview === true\) throw new PlanRefusedError\(PREVIEW_CLUB_PLAN_REFUSAL\)/);
    assert.match(functionBody(readCode('lib/club-record-changes.ts'), 'applyClubSections'), /is_preview === true\) return \{ ok: false/);
  });
});

describe('preview clubs: the database holds "no people, never billed" (T3)', () => {
  // Code only: the migration's header names every code, so a raw read would pass with the RAISE deleted (/review).
  const sql = readSource('supabase/migrations/535_a_club_made_for_a_meeting.sql').replace(/--.*$/gm, '');
  it('a club with people never becomes a preview: made, undone, or the marker written directly (PV001)', () => {
    assert.match(sql, /IF NEW\.claimed_at IS NULL AND \(TG_OP = 'INSERT' OR OLD\.claimed_at IS NOT NULL\)/);
    assert.equal(sql.match(/ERRCODE = 'PV001'/g)?.length, 2, 'the record trigger and the organizations trigger');
    assert.match(sql, /BEFORE INSERT OR UPDATE OF is_preview ON public\.organizations/);
  });
  it('the record names a real club (PV002) and stays with it (PV004); nobody joins an open preview (PV003); no Stripe ids', () => {
    assert.match(sql, /ERRCODE = 'PV002'/);
    assert.match(sql, /ERRCODE = 'PV004'/);
    assert.match(sql, /BEFORE INSERT OR UPDATE OF claimed_at, org_id ON public\.organization_previews/);
    assert.match(sql, /ERRCODE = 'PV003'/);
    assert.match(sql, /BEFORE INSERT OR UPDATE OF organization_id ON public\.organization_members/);
    assert.match(sql, /CHECK \(NOT is_preview OR \(stripe_customer_id IS NULL AND stripe_subscription_id IS NULL\)\)/);
  });
  it('app code never writes the marker (the database keeps it; only the creation step sets it on a new club)', () => {
    const writers = SOURCES.filter(f => /is_preview\s*:\s*(true|false)\b/.test(readCode(f)));
    assert.deepEqual(writers, [], `Writes organizations.is_preview: ${writers.join(', ')}`);
  });
});

describe('preview clubs: every email names its club (rule 3)', () => {
  const email = readCode('lib/email.ts');
  it('orgId is REQUIRED on sendEmail (TypeScript holds every call)', () => {
    assert.match(email, /\n\s*orgId: string \| null;/);
    assert.doesNotMatch(email, /\n\s*orgId\?: string \| null;/);
  });
  it('sendEmailBatch takes the club too', () => {
    assert.match(email, /export async function sendEmailBatch\([^]*?orgId: string \| null,\s*\): Promise<SendEmailResult>/);
  });
  it('sendEmail refuses a preview BEFORE it writes a log row, and the check fails closed', () => {
    const body = functionBody(email, 'sendEmail');
    const refuse = body.indexOf('refusedForPreview(opts.orgId)');
    const log = body.indexOf("import('./email-log')");
    assert.ok(refuse >= 0 && log > refuse, 'the preview refusal must come before the log row');
    const check = functionBody(email, 'refusedForPreview');
    assert.match(check, /\? \{ status: 'skipped', preview: true \} : null/, 'a preview is skipped');
    // A club the sender could not check is NOT `skipped` (several callers count that as delivered): it is a failure.
    assert.match(check, /catch[^]*?return \{ status: 'provider_error' \};/, 'a failed preview read must refuse as a failure');
  });
  it('the template sender and the family batch sender require it as well', () => {
    assert.match(readCode('lib/platform-email-templates.ts'), /\n\s*orgId: string \| null;/);
    assert.match(functionBody(readCode('lib/family-email.ts'), 'sendFamilyServiceBatch'), /sendEmailBatch\([^]*?params\.orgId\)/);
  });
});

describe('preview clubs: not indexed, not listed (rule 4)', () => {
  it('the org layout says "don\'t index" for a preview', () => {
    assert.match(readCode('app/[orgSlug]/layout.tsx'), /org\.isPreview\s*\?\s*\{ robots: \{ index: false/);
  });
  it('the directory leaves previews out of listed tournaments and followable clubs', () => {
    const dir = readCode('lib/directory.ts');
    assert.match(functionBody(dir, 'getUnlistedOrgIds'), /\.eq\('is_preview', true\)/);
    assert.match(between(dir, 'function scopeFollowableOrgs<T>(', 'function followableOrgQuery('), /\.eq\('is_preview', false\)/);
  });
  it('robots.txt NEVER names a preview (it is public, and would list our prospects)', () => {
    assert.doesNotMatch(readCode('lib/robots-rules.ts'), /preview/i);
  });
});

describe('preview clubs: error alerts stay on (rule 5)', () => {
  it('the capture path does not silence a preview the way it silences a demo', () => {
    assert.doesNotMatch(readCode('lib/observability/capture.ts'), /preview/i);
    assert.doesNotMatch(readCode('lib/observability/alerts.ts'), /isPreviewOrgId|is_preview/);
  });
  it('the ops alert is platform mail (orgId null), so the preview refusal never reaches it', () => {
    assert.match(readCode('lib/observability/alerts.ts'), /kind: 'ops_alert', orgId: null/);
  });
});

describe('preview clubs: the door (rule 6)', () => {
  const own = { plan_id: 'tournament', subscription_status: 'active', enabled_addons: [], tournament_limit: 1, team_limit: null };
  it('a preview gets its public-site sections, on the free plan, with the switch off and no grant', () => {
    const facts = foldGrants(ownFactsOf({ id: 'p', ...own, is_preview: true }), [], new Date(), false);
    assert.equal(facts.planId, 'tournament');
    assert.equal(facts.ownPlanId, 'tournament');
    assert.equal(facts.freeTime, null);
    for (const s of PREVIEW_SECTIONS) assert.ok(facts.enabledAddons.includes(s), s);
  });
  it('a club that is not a preview gets nothing from it', () => {
    const facts = foldGrants(ownFactsOf({ id: 'c', ...own }), [], new Date(), true);
    assert.deepEqual(facts.enabledAddons, []);
  });
  it('the sections are sections, never a plan', () => {
    for (const s of PREVIEW_SECTIONS) assert.match(s, /^module_/);
    assert.equal(isPreviewRow({ is_preview: true }), true);
    assert.equal(isPreviewRow({}), false);
  });
  it('the preview rule never grew a demo-style write block or silenced alerts (the demo files are gone)', () => {
    assert.doesNotMatch(readCode('proxy.ts'), /isPreview|is_preview/, 'no write block for a preview in the proxy');
    assert.doesNotMatch(readCode('lib/observability/capture.ts'), /preview/i);
  });
});
