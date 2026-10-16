/**
 * An upgrade link opens the plan's panel where you are (owner, the free tier walk 2026-10-16): every plan lock stays a
 * link to Plan & billing's panel, and the admin layout's one PlanPanelHost turns a plain click on it into the panel
 * over the page. These pin what counts as an upgrade link, that the host is mounted and leaves new-tab clicks alone,
 * and that the panel stands on the window floor (Escape and Back close it alone over a window).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planPanelFromHref, upgradePlansFor } from '../../lib/plan-upgrade';
import { getBillingHref } from '../../lib/billing-urls';

const read = (...p: string[]) => readFileSync(join(import.meta.dirname, '..', '..', ...p), 'utf8');

describe('what counts as an upgrade link', () => {
  it('Plan & billing with a plan named — the tournament tiers’ address and the organization’s', () => {
    assert.equal(planPanelFromHref('/free-test-org/admin/tournaments/settings/subscription?plan=tournament_plus'), 'tournament_plus');
    assert.equal(planPanelFromHref('http://localhost:3000/free-test-org/admin/tournaments/settings/subscription?plan=tournament_plus'), 'tournament_plus');
    assert.equal(planPanelFromHref('/acme/admin/org/billing?plan=club'), 'club');
    assert.equal(planPanelFromHref('/acme/admin/org/billing?plan=league&x=1'), 'league');
  });
  it('anything else is an ordinary link', () => {
    assert.equal(planPanelFromHref('/free-test-org/admin/tournaments/settings/subscription'), null, 'Plan & billing itself is a page');
    assert.equal(planPanelFromHref('/acme/admin/onboarding?plan=club'), null, 'the onboarding is not a panel');
    assert.equal(planPanelFromHref('/auth/signup?plan=club'), null);
    assert.equal(planPanelFromHref('/acme/admin/org/billing?plan=enterprise'), null, 'an unknown plan opens nothing');
    assert.equal(planPanelFromHref('/acme/admin/tournaments/settings/subscription/extra?plan=tournament_plus'), null);
  });
  it('both of Plan & billing’s homes, as getBillingHref spells them, with a plan named, are one', () => {
    for (const planId of ['tournament', 'tournament_plus', 'league', 'club']) {
      assert.equal(planPanelFromHref(`${getBillingHref('acme', planId)}?plan=tournament_plus`), 'tournament_plus', planId);
    }
  });
  it('the lock lines’ own address is one', () => {
    const lock = read('components', 'admin', 'tournament', 'PlanLockLine.tsx');
    const built = /return `\/\$\{orgSlug\}(\/admin\/tournaments\/settings\/subscription\?plan=tournament_plus)`;/.exec(lock);
    assert.ok(built, 'tournamentPlusPanelHref is the panel address');
    assert.equal(planPanelFromHref(`/demo${built[1]}`), 'tournament_plus');
  });
});

describe('the host', () => {
  it('is mounted once, in the admin layout', () => {
    assert.match(read('app', '[orgSlug]', 'admin', 'layout.tsx'), /<PlanPanelHost \/>/);
  });
  it('catches a plain click before the router, and leaves a new-tab click alone', () => {
    const host = read('components', 'billing', 'PlanPanelHost.tsx');
    assert.match(host, /window\.addEventListener\('click', onClick, true\)/, 'capture, ahead of next/link');
    assert.match(host, /e\.button !== 0 \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/);
    assert.match(host, /e\.preventDefault\(\);/);
    assert.doesNotMatch(host, /\.stopPropagation\(/, 'a menu’s own click still closes the menu');
  });
  it('ships only the listener: the panel and its Upgrade load on the first click', () => {
    const host = read('components', 'billing', 'PlanPanelHost.tsx');
    assert.match(host, /dynamic\(\(\) => import\('\.\/PlanPanelDrawer'\), \{ ssr: false \}\)/);
    assert.doesNotMatch(host, /import PlanArticlePanel|usePlanGating|FeedbackModal/);
  });
  it('the game-day board’s locked follow-up asks for the panel too (the one lock that linked to the bare page)', () => {
    const board = read('app', '[orgSlug]', 'admin', 'tournaments', 'dashboard', 'WeeksBeforeBoard.tsx');
    assert.match(board, /href=\{locked \? `\$\{subscriptionHref\}\?plan=tournament_plus` :/);
  });
  it('a settings page’s unsaved-changes guard lets an answered click pass', () => {
    assert.match(read('components', 'admin', 'kit', 'club', 'SettingsKit.tsx'), /if \(e\.defaultPrevented\) return;/);
  });
});

describe('the Upgrade is Plan & billing’s', () => {
  it('one request and one rule for who is offered it, read by both places', () => {
    const drawer = read('components', 'billing', 'PlanPanelDrawer.tsx');
    const billing = read('app', '[orgSlug]', 'admin', 'org', 'billing', 'page.tsx');
    for (const src of [drawer, billing]) {
      assert.match(src, /requestPlanUpgrade\(/);
      assert.match(src, /upgradePlansFor\(/);
    }
  });
  it('only the owner is offered the Upgrade, on both panels — anyone else reads, with no button the server would refuse', () => {
    assert.match(read('components', 'billing', 'PlanPanelDrawer.tsx'), /canUpgrade=\{userRole === 'owner' && /);
    assert.match(read('app', '[orgSlug]', 'admin', 'org', 'billing', 'page.tsx'), /canUpgrade=\{canManageBilling && /);
  });
  it('an applied plan says "Plan updated" before the re-read, and a checkout keeps Upgrade busy as the page leaves', () => {
    const drawer = read('components', 'billing', 'PlanPanelDrawer.tsx');
    const applied = drawer.indexOf("setOutcome({ title: 'Plan updated'");
    const reread = drawer.indexOf('await Promise.all([refreshOrg(), refreshTournaments()])');
    assert.ok(applied > 0 && reread > applied, 'success is said first; a failed re-read cannot turn it red');
    assert.doesNotMatch(drawer, /finally \{/, 'no finally that re-enables Upgrade under a leaving page');
    assert.match(drawer, /e\.persisted\) setLoading\(false\)/, 'Back from checkout through the cache re-enables it');
  });
  it('only the free Tournament plan is offered Tournament Plus', () => {
    assert.deepEqual(upgradePlansFor('tournament'), ['tournament_plus']);
    for (const planId of ['tournament_plus', 'team', 'league', 'club', null]) assert.deepEqual(upgradePlansFor(planId), [], String(planId));
  });
});

describe('the panel stands on the window floor', () => {
  it('Escape and Back close it alone over a window; no Escape of its own', () => {
    const panel = read('components', 'billing', 'PlanArticlePanel.tsx');
    assert.match(panel, /useDialogFloor\(Boolean\(planKey\), panelRef/);
    assert.doesNotMatch(panel, /addEventListener\('keydown'/);
    // The floor seats focus on the panel; a panel that cannot take focus left it on the lock, and Escape went to the
    // window underneath (the composer, with the draft).
    assert.match(panel, /<aside ref=\{panelRef\} tabIndex=\{-1\}/);
  });
  it('sits above a window and a raised window, below a question', () => {
    const css = read('components', 'billing', 'PlanArticlePanel.module.css');
    assert.match(css, /\.backdrop \{[^}]*z-index: 406;/);
    assert.match(css, /\.panel \{[^}]*z-index: 407;/);
  });
});
