/**
 * THE DELETION REQUEST (Settings in both workspaces Session 1; owner "as recommended", 2026-11-20). Guards:
 *   - owner only, one open request, privacy@ (never the Gmail inbox), every active owner acknowledged;
 *   - the record outlives the organization, and the platform-admin deletion marks it before the organization goes;
 *   - "Delete {name}" is the LAST section of Plan & billing on Premium (running and cancelled), Tournament and Tournament
 *     Plus, and absent on League and Club (their Settings card asks);
 *   - the paid line only while a paid period runs (L-A); the window's words are /legal's v0.2;
 *   - the club's card opens the same window.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_CONFIG } from '../../lib/plan-config.ts';
import { PLAN_BILLING_WORDS as W } from '../../lib/plan-billing-words.ts';
import { LEAVING_WORDS } from '../../lib/online-payment-words.ts';
import { ORG_DELETION_WORDS as DW, deletionPaidUntil, deletionPlanName, deletionReplyTo } from '../../lib/org-deletion-words.ts';
import type { BillingSnapshot, BillingRead } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import type { DeletionRead } from '../../components/billing/DeletionRequest.tsx';
import { readCode } from './_source-code.ts';

const load = billingTestLoader();
const { BillingBodyView } = load('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });

const facts = (request: { id: string; sentAt: string; requesterEmail: string } | null, ownerCount = 1): DeletionRead => ({
  status: 'ready',
  data: { request, ownerCount, viewerEmail: 'jordan@example.ca', onlinePayments: null, exportFrom: 'tournament_payouts' },
});

function fixture(key: keyof typeof PLAN_CONFIG, deletion: DeletionRead = facts(null)): BillingBodyViewProps {
  const profile = PLAN_BILLING_PROFILES[key];
  const impact = planCancellationImpact(profile, [], 0);
  const name = key === 'team' ? 'Riverdale Ridge 13U Coaches Portal' : 'Maple Creek Tournaments';
  const snapshot: BillingSnapshot = {
    org: { id: 'org-a', slug: 'maple', name, planId: key, ownPlanId: key, enabledAddons: [], subscriptionStatus: 'active', subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-04', teamLimit: 15, tournamentLimit: 1 } as unknown as BillingSnapshot['org'],
    canManageBilling: true, usage: ready({ teams: { count: 1, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 0 }),
    freeTime: ready({ freeTime: null, portal: null, overLimitAfter: false }),
    gating: ready({ tournament: false, tournament_plus: false, team: false, league: true, club: true, club_large: true }),
    cancellation: ready({ currentPlan: key, ...impact, activeTeams: 0, activeTournamentCount: 0, tournaments: [], cancelled: null }),
    move: ready({ live: false, scheduledMove: null }),
  };
  return { snapshot, profile, ownProfile: profile, deletion: { read: deletion, onRequest() {} },
    actions: { busy: null, cycle: 'monthly', setCycle() {}, portal() {}, reactivate() {}, keep() {}, keepPlan() {}, cancel() {}, change() {}, details() {}, retry() {} } } as BillingBodyViewProps;
}
const html = (props: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, props)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
/** The page's last section: nothing but closing tags may follow the deletion section. */
const lastSection = (rendered: string) => rendered.slice(rendered.lastIndexOf('<section'));

describe('Delete {name} is the last section of Plan & billing', () => {
  it('Premium running: after Reduce or cancel, named by the team, Premium words', () => {
    const rendered = html(fixture('team'));
    assert.ok(rendered.indexOf(W.page.sections.cancel) < rendered.indexOf('Delete Riverdale Ridge 13U'));
    assert.match(lastSection(rendered), /Delete Riverdale Ridge 13U/);
    assert.match(lastSection(rendered), /Ask us to delete this team’s Coaches Portal and everything in it\. Nothing is deleted until you confirm by email\./);
    assert.match(lastSection(rendered), /class="btn btn-outline [^"]*"[^>]*>Request deletion…</);
  });
  it('Premium cancelled: after Basic records are still available', () => {
    const props = fixture('team'); props.snapshot.org.subscriptionStatus = 'canceled';
    const rendered = html(props);
    assert.ok(rendered.indexOf(W.reactivate.basicTitle) < rendered.indexOf('Delete Riverdale Ridge 13U'));
    assert.match(lastSection(rendered), /Request deletion…/);
  });
  it('the free Tournament plan: after the plans shelf, the organization by name', () => {
    const rendered = html(fixture('tournament'));
    assert.ok(rendered.indexOf(W.shelf.title) < rendered.indexOf('Delete Maple Creek Tournaments'));
    assert.match(lastSection(rendered), /Ask us to delete Maple Creek Tournaments and everything in it\./);
    assert.doesNotMatch(rendered, new RegExp(W.page.sections.cancel));
  });
  it('Tournament Plus: after Reduce or cancel, and a cancelled Tournament Plus keeps the door', () => {
    const rendered = html(fixture('tournament_plus'));
    assert.ok(rendered.indexOf(W.page.sections.cancel) < rendered.indexOf('Delete Maple Creek Tournaments'));
    const cancelled = fixture('tournament_plus'); cancelled.snapshot.org.subscriptionStatus = 'canceled';
    assert.match(lastSection(html(cancelled)), /Delete Maple Creek Tournaments/);
  });
  it('League and Club ask from their Settings card, never here', () => {
    for (const key of ['league', 'club', 'club_large'] as const) {
      assert.equal(PLAN_BILLING_PROFILES[key].deletionWorkspace, undefined, key);
      assert.doesNotMatch(html(fixture(key)), /Request deletion…|Delete Maple Creek/, key);
    }
  });
  it('once sent, the olive line replaces the door until staff close it; several owners read as the owners', () => {
    const one = html(fixture('tournament', facts({ id: 'r1', sentAt: '2026-11-20T15:00:00Z', requesterEmail: 'sam@maplecreek.ca' })));
    assert.match(one, /Request sent Nov 20, 2026\. We’ll reply to sam@maplecreek\.ca within 30 days\./);
    assert.doesNotMatch(one, /Request deletion…/);
    const several = html(fixture('tournament', facts({ id: 'r1', sentAt: '2026-11-20T15:00:00Z', requesterEmail: 'sam@maplecreek.ca' }, 2)));
    assert.match(several, /We’ll reply to Maple Creek Tournaments’s owners within 30 days\./);
  });
  it('a failed read says it could not check, and offers no door', () => {
    const rendered = html(fixture('team', { status: 'error' }));
    assert.ok(rendered.includes(DW.section.loadFailed));
    assert.doesNotMatch(rendered, /Request deletion…/);
  });
});

describe('the plan card (A7)', () => {
  it('Premium: one column, the slot as a line, no seats meter', () => {
    const rendered = html(fixture('team'));
    assert.match(rendered, /1 of 1 tournament slot in use/);
    assert.doesNotMatch(rendered, /staff seat|What's in use|role="meter"/);
  });
  it('the Tournament plans keep both meters', () => {
    for (const key of ['tournament', 'tournament_plus'] as const) {
      const rendered = html(fixture(key));
      assert.match(rendered, /What's in use/, key);
      assert.match(rendered, /staff seat/, key);
      assert.doesNotMatch(rendered, /tournament slot in use/, key);
    }
  });
});

describe('the paid line only while a paid period runs (L-A)', () => {
  const org = (subscriptionStatus: string, currentPeriodEnd: string | null = '2027-08-10') => ({ subscriptionStatus, currentPeriodEnd });
  it('an active paid plan with a renewal date', () => {
    assert.equal(deletionPaidUntil(org('active'), 'team'), '2027-08-10');
    assert.equal(deletionPaidUntil(org('active'), 'tournament_plus'), '2027-08-10');
  });
  it('never a trial, a failed payment, a cancelled (or staff free time) plan, the free plan, or no date', () => {
    assert.equal(deletionPaidUntil(org('trialing'), 'team'), null);
    assert.equal(deletionPaidUntil(org('past_due'), 'team'), null);
    assert.equal(deletionPaidUntil(org('canceled'), 'team'), null);
    assert.equal(deletionPaidUntil(org('active'), 'tournament'), null);
    assert.equal(deletionPaidUntil(org('active', null), 'team'), null);
  });
  it('the ruled sentence, with Premium named the way its Cancel door names it', () => {
    assert.equal(deletionPlanName('team'), 'Premium');
    assert.equal(DW.window.paid('Premium', '2027-08-10', 'Riverdale Ridge 13U'),
      'Premium is paid until Aug 10, 2027. We can delete Riverdale Ridge 13U then, or now. Deleting now ends Premium early, and the time left isn’t refunded. Tell us which when we reply.');
    assert.doesNotMatch(readCode('lib/org-deletion-words.ts'), /Cancel it first/);
  });
});

describe('the window is /legal v0.2, one text for every workspace', () => {
  const src = readCode('components/billing/DeletionRequest.tsx');
  it('what is deleted, what isn’t, the reply line, the buttons', () => {
    assert.equal(DW.window.title('Maple Creek Tournaments'), 'Ask us to delete Maple Creek Tournaments?');
    assert.equal(DW.window.reply('sam@maplecreek.ca'), 'We’ll reply by email to sam@maplecreek.ca within 30 days. Nothing is deleted until you confirm.');
    assert.equal(DW.window.replyOwners('Maple Creek Tournaments'), 'We’ll reply to Maple Creek Tournaments’s owners within 30 days. Nothing is deleted until you confirm.');
    assert.match(DW.window.deleted.tournament, /your staff list, and the payment records here\.$/);
    assert.match(DW.window.deleted.premium, /families’ contact details/);
    assert.equal(DW.window.signIns(DW.window.people.tournament, 'Maple Creek Tournaments'),
      'Your own sign-in, and your staff’s. They lose access to Maple Creek Tournaments. To close your own account, or to ask what we hold about you, email privacy@fieldlogichq.ca.');
    assert.match(DW.window.records('X'), /\(our privacy policy, section 9\)\.$/);
    assert.equal(DW.window.dismiss, 'Don’t send');
    assert.match(src, /<DialogCancel>\{W\.window\.dismiss\}<\/DialogCancel>/);
    assert.match(src, /className="btn btn-danger"/);
    assert.match(src, /W\.window\.keepFirst/);
  });
  it('the export line names a page the organization has (Accounting only on the Club plans)', () => {
    assert.match(LEAVING_WORDS.delete.export.accounting, /from Accounting\.$/);
    assert.match(LEAVING_WORDS.delete.export.tournament_payouts, /Payouts to your bank, on the Payouts tab\.$/);
    const server = readCode('lib/org-deletion-requests.ts');
    assert.match(server, /hasModuleEntitlement\(org, 'module_accounting'\)\) return 'accounting'/);
  });
  it('the club’s card opens the same window, keeps its place, and drops the old "for good" window', () => {
    const club = readCode('components/admin/kit/club/SettingsKit.tsx');
    assert.match(club, /<DeletionRequestWindow [^>]*workspace="club"/);
    assert.match(club, /<DeletionSentLine /);
    assert.doesNotMatch(club, /all its data for good|Request sent — we’ll be in touch/);
    assert.match(club, /Request account deletion…/);
    // Owner calls 1 and 2 (2026-11-20): the card says the ruled sentence; the club's window adds the coach's own portal.
    assert.ok(club.includes('<p className={ck.hint}>{DW.section.body(currentOrg.name)}</p>'));
    assert.doesNotMatch(club, /Permanently remove your organization/);
    assert.ok(src.includes("{workspace === 'club' && <li>{W.window.coachPortalStays(orgName)}</li>}"));
    assert.equal(DW.window.coachPortalStays('Riverdale Minor Ball'), 'A coach’s own Coaches Portal stays theirs; it loses its link to Riverdale Minor Ball.');
  });
});

describe('the record and the route', () => {
  const route = readCode('app/api/admin/org/request-deletion/route.ts');
  const lib = readCode('lib/org-deletion-requests.ts');
  const migration = readCode('supabase/migrations/514_a_deletion_request_is_recorded.sql');
  it('owner only, both ways', () => {
    assert.equal(route.match(/if \(ctx\.role !== 'owner'\) return forbidden\(\);/g)?.length, 2);
  });
  it('one open request: the index, the read first, and a lost race returns the open one', () => {
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS org_deletion_requests_one_open\s+ON public\.org_deletion_requests \(org_id\) WHERE status = 'sent'/);
    assert.ok(lib.indexOf('const existing = await readOpenDeletionRequest(org.id)') < lib.indexOf(".from('org_deletion_requests').insert("));
    assert.match(lib, /error\.code === '23505'/);
  });
  it('the record outlives the organization; the deletion finds it first and marks it only once the organization is gone', () => {
    assert.match(migration, /org_id\s+uuid REFERENCES public\.organizations\(id\) ON DELETE SET NULL/);
    assert.match(migration, /org_name\s+text NOT NULL/);
    assert.match(migration, /org_slug\s+text NOT NULL/);
    assert.match(migration, /REVOKE ALL ON public\.org_deletion_requests FROM anon, authenticated/);
    const del = readCode('app/api/platform-admin/orgs/[id]/delete/route.ts');
    const find = del.indexOf('await findDeletionRequestToMark(id)');
    const orgDelete = del.search(/from\('organizations'\)\s*\.delete\(\)/);
    const mark = del.indexOf('await markDeletionRequestDeleted(deletionRequest,');
    assert.ok(find > 0 && find < orgDelete, 'found while the organization still names it');
    assert.ok(mark > orgDelete, 'marked only after the organization row is gone (a failed delete leaves it as it was)');
    assert.match(lib, /\.eq\('id', target\.id\)\.eq\('status', target\.status\)/);
  });
  it('the record is never rolled back: an unconfirmed privacy@ copy opens an issue instead', () => {
    assert.doesNotMatch(lib, /from\('org_deletion_requests'\)\.delete\(\)/);
    assert.match(lib, /if \(delivered !== 'sent'\) await reportUnsent\(/);
  });
  it('privacy@, never the Gmail inbox; every active owner acknowledged, replies to privacy@', () => {
    assert.doesNotMatch(route + lib, /fieldlogichq@gmail\.com/);
    assert.match(lib, /sendEmail\(\s*PRIVACY_EMAIL,/);
    assert.match(lib, /orgOwnerEmails\(org\.id\)/);
    assert.match(lib, /kind: 'org_deletion_request_received', orgId: org\.id, replyTo: PRIVACY_EMAIL/);
  });
  it('the acknowledgement carries nothing commercial (CASL) and no reason', () => {
    const words = Object.values(DW.email).map(v => typeof v === 'function' ? (v as (...a: string[]) => string)('a@b.ca', '2026-11-20', 'X', 'x') : v).join(' ');
    assert.doesNotMatch(words, /\$|price|offer|discount|come back|reactivate|upgrade/i);
    assert.match(words, /within 30 days/);
    assert.match(words, /didn’t agree to this, reply/);
  });
  it('staff close it on the organization page with a reason, in the staff log', () => {
    const staff = readCode('app/api/platform-admin/orgs/[id]/deletion-request/route.ts');
    assert.match(staff, /requirePlatformPower\('club_support'\)/);
    assert.match(staff, /writePlatformAuditLog\(auth\.user\.email!, id, `deletion_request_\$\{status\}`/);
    assert.match(staff, /if \(!reason\)/);
  });
  it('the reply-to helper', () => {
    assert.equal(deletionReplyTo('Falcons', 1, 'a@b.ca'), 'a@b.ca');
    assert.equal(deletionReplyTo('Falcons', 3, 'a@b.ca'), 'Falcons’s owners');
  });
});
