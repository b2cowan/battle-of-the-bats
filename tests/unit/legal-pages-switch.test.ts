import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_PAGES_PUBLISHED, legalPagesMode, legalPagesOn } from '../../lib/legal-pages-switch.ts';
import { currentVersion, oldestAcceptedVersion, DRAFT_VERSION } from '../../lib/legal-documents.ts';

/**
 * THE LEGAL PAGES' SWITCH (GST/HST Stage 6 step 6.2, ruling Q2). Two locks: the publication constant (flipped at 6.7, alone) and
 * a server-only env var that previews the drafts only under a Stripe TEST key. Production is off.
 */
describe('the legal pages switch: off in production', () => {
  it('the publication lock is closed — 6.7 flips it, alone, in a reviewed commit', () => {
    assert.equal(LEGAL_PAGES_PUBLISHED, false);
  });

  it('is off with no env var — production does not set it', () => {
    assert.equal(legalPagesMode({}), 'off');
    assert.equal(legalPagesMode({ STRIPE_SECRET_KEY: 'sk_test_x' }), 'off');
    assert.equal(legalPagesMode({ STRIPE_SECRET_KEY: 'sk_live_x' }), 'off');
    assert.equal(legalPagesOn({}), false);
  });

  it('is off for anything but the literal "true"', () => {
    for (const v of ['1', 'TRUE', 'yes', 'on', '']) {
      assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: v, STRIPE_SECRET_KEY: 'sk_test_x' }), 'off', v);
    }
  });

  it('a LIVE key keeps it off even with the env var set', () => {
    assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_live_x' }), 'off');
    assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'rk_live_x' }), 'off');
  });

  it('no Stripe key at all keeps it off', () => {
    assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true' }), 'off');
  });

  it('the env var plus a test key is the preview', () => {
    assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' }), 'preview');
    assert.equal(legalPagesMode({ LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'rk_test_x' }), 'preview');
    assert.equal(legalPagesOn({ LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' }), true);
  });
});

describe('the versions a door would record follow the switch', () => {
  const preview = { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' };
  it('is null when off, "draft" in the preview', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      assert.equal(currentVersion(doc, {}), null);
      assert.equal(oldestAcceptedVersion(doc, {}), null);
      assert.equal(currentVersion(doc, preview), DRAFT_VERSION);
      assert.equal(oldestAcceptedVersion(doc, preview), DRAFT_VERSION);
    }
  });
});
