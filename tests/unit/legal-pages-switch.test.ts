import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_PAGES_PUBLISHED, legalPagesMode, legalPagesOn } from '../../lib/legal-pages-switch.ts';
import { LEGAL_DOCUMENTS, currentVersion, oldestAcceptedVersion, DRAFT_VERSION } from '../../lib/legal-documents.ts';

/**
 * THE LEGAL PAGES' SWITCH (GST/HST Stage 6 step 6.2, ruling Q2). Two locks: the publication constant (flipped at 6.7, alone,
 * 2026-11-17) and a server-only env var that previews a draft only under a Stripe TEST key.
 *
 * Published, the constant wins over every environment: production serves the dated versions with no env var at all. Unpublished
 * (a reversal is a commit that sets it back), production is off. Each half runs only in its own state, so the test holds both ways.
 */
const ENVS: Record<string, string | undefined>[] = [
  {},
  { STRIPE_SECRET_KEY: 'sk_test_x' },
  { STRIPE_SECRET_KEY: 'sk_live_x' },
  { LEGAL_PAGES_PREVIEW: 'true' },
  { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' },
  { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_live_x' },
];

describe('published: the constant decides, in every environment', { skip: !LEGAL_PAGES_PUBLISHED && 'the pages are not published' }, () => {
  it('every environment is "published" — no env var is needed on production, and none can turn it off', () => {
    for (const env of ENVS) {
      assert.equal(legalPagesMode(env), 'published', JSON.stringify(env));
      assert.equal(legalPagesOn(env), true);
    }
  });

  it('a door records the dated current version, never "draft"', () => {
    for (const doc of ['terms', 'privacy'] as const) {
      for (const env of ENVS) {
        assert.equal(currentVersion(doc, env), LEGAL_DOCUMENTS[doc].current);
        assert.equal(oldestAcceptedVersion(doc, env), LEGAL_DOCUMENTS[doc].oldestAccepted);
        assert.notEqual(currentVersion(doc, env), DRAFT_VERSION);
      }
    }
  });
});

describe('not published: off in production', { skip: LEGAL_PAGES_PUBLISHED && 'the pages are published' }, () => {
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

  it('the versions a door would record: null when off, "draft" in the preview', () => {
    const preview = { LEGAL_PAGES_PREVIEW: 'true', STRIPE_SECRET_KEY: 'sk_test_x' };
    for (const doc of ['terms', 'privacy'] as const) {
      assert.equal(currentVersion(doc, {}), null);
      assert.equal(oldestAcceptedVersion(doc, {}), null);
      assert.equal(currentVersion(doc, preview), DRAFT_VERSION);
      assert.equal(oldestAcceptedVersion(doc, preview), DRAFT_VERSION);
    }
  });
});
