import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * EVERY SURFACE THAT LINKS THE LEGAL PAGES, AND NONE THAT LINKS THEM WHILE THEY ARE OFF (GST/HST Stage 6 step 6.2, Chunk 2b).
 * The list below is the build prompt's table: each surface must reach the links through the switch (the provider hook in a client
 * component, `legalPagesOn()` in a server one), so with the switch off none renders. A new surface goes on this list.
 */

/** [file, how many LegalFootLinks it must render] — the doors the census lists. */
const FOOT_DOORS: Array<[string, number]> = [
  ['app/(consumer)/auth/login/page.tsx', 1],
  // The two-step code step (Board Ready, Part 1): a sign-in door, a state of the login page.
  ['components/auth/TwoStepCodeStep.tsx', 1],
  ['app/(consumer)/auth/signup/AccountOnlySignup.tsx', 1],
  ['app/(consumer)/start/StartDoorForm.tsx', 3],
  // The claim page (Club Website Track P): its code step and its refused frame.
  ['app/(consumer)/start/claim/[slug]/ClaimDoor.tsx', 2],
  ['app/team/TeamSignupClient.tsx', 3],
  ['app/coaches/join/page.tsx', 4],
  ['app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx', 1],
  ['app/(consumer)/auth/accept-assistant-invite/page.tsx', 1],
  ['app/(consumer)/auth/accept-league-coach/page.tsx', 1],
  ['app/(consumer)/auth/forgot-password/page.tsx', 1],
  ['app/(consumer)/auth/reset-confirm/page.tsx', 1],
  ['app/(consumer)/auth/signup-confirm/page.tsx', 1],
  ['app/(consumer)/auth/reset-password/page.tsx', 1],
  ['components/auth/VerifyEmailSent.tsx', 1],
  ['app/platform-admin/login/page.tsx', 1],
];

describe('the sign-in and sign-up doors carry the legal line', () => {
  for (const [file, count] of FOOT_DOORS) {
    it(`${file} renders the legal line ${count} time(s)`, () => {
      const code = readCode(file);
      // A line is `<StartFoot legal>` (StartFoot draws it) or a direct `<LegalFootLinks>` (a door with no StartFoot under the form).
      const direct = (code.match(/<LegalFootLinks\b/g) ?? []).length;
      assert.equal(direct + (code.match(/<StartFoot\b[^>]*\blegal\b/g) ?? []).length, count);
      if (direct) assert.match(code, /import LegalFootLinks from '@\/components\/legal\/LegalFootLinks'/);
    });
  }

  it('no file outside the census opts a StartFoot into the legal line (the onboarding steps stay without)', () => {
    const listed = new Set(FOOT_DOORS.map(([f]) => f));
    const optedIn = [...filesUnder('app', '.tsx'), ...filesUnder('components', '.tsx')]
      .filter(f => /<StartFoot\b[^>]*\blegal\b/.test(readCode(f)));
    assert.deepEqual(optedIn.filter(f => !listed.has(f)), []);
  });

  it('StartFoot draws the legal line only when a door opts in with `legal`', () => {
    const code = readCode('components/auth/AccountForm.tsx');
    assert.match(code, /legal = false/);
    assert.match(code, /\{legal && <LegalFootLinks \/>\}/);
  });

  it('the platform-admin login uses the console card’s 12px line', () => {
    assert.match(readCode('app/platform-admin/login/page.tsx'), /<LegalFootLinks console \/>/);
  });

  it('LegalFootLinks renders nothing when the provider hands it null', () => {
    const code = readCode('components/legal/LegalFootLinks.tsx');
    assert.match(code, /useLegalLinks\(\)/);
    assert.match(code, /if \(!links\) return null/);
  });
});

describe('the other surfaces follow the switch', () => {
  it('the marketing footer’s bottom row renders the links only from the provider', () => {
    const code = readCode('components/Footer.tsx');
    assert.match(code, /useLegalLinks\(\)/);
    assert.match(code, /\{legal && \(/);
    assert.match(code, /'legal',/); // the footer's marketing surface
  });

  it('the footer shows the Data Terms and the list only once each has a published text (Board Ready 0a-5)', () => {
    const code = readCode('components/Footer.tsx');
    assert.match(code, /\{legal\.dataTermsHref && </);
    assert.match(code, /\{legal\.subprocessorsHref && </);
    assert.match(readCode('lib/legal-links.ts'), /legalPageLive\(page, env\) \? legalPageHref\(page\) : null/);
  });

  it('the footer links the Security page first, only inside the legal block (Board Ready §0c, S3)', () => {
    const code = readCode('components/Footer.tsx');
    const block = code.slice(code.indexOf('{legal && ('));
    assert.ok(block.indexOf('legal.securityHref') > 0 && block.indexOf('legal.securityHref') < block.indexOf('legal.termsHref'),
      'Security sits first in the legal row, rendered only while the legal pages are on');
    assert.equal(code.slice(0, code.indexOf('{legal && (')).includes('securityHref'), false);
    assert.match(readCode('lib/legal-links.ts'), /securityHref: `\$\{canonicalAppOrigin\(\)\}\$\{SECURITY_PATH\}`/);
  });

  it('the sign-in doors keep the two links a person accepts there — never the Data Terms, the list or the Security page (rulings 2026-11-19, 2026-11-21)', () => {
    for (const f of ['components/legal/LegalFootLinks.tsx', ...FOOT_DOORS.map(([file]) => file)]) {
      assert.equal(/dataTermsHref|subprocessorsHref|securityHref|DATA_TERMS_|SUBPROCESSORS_|SECURITY_LINK/.test(readCode(f)), false, f);
    }
  });

  it('the account menu carries no legal link — the account page has them (owner 2026-11-09)', () => {
    const code = readCode('components/shared/AccountMenu.tsx');
    assert.equal(/useLegalLinks|legal-words|legalLine|legalHref|termsHref|privacyHref/.test(code), false);
  });

  it('the account menu draws its separator above Sign out only when a row sits above it', () => {
    const code = readCode('components/shared/AccountMenu.tsx');
    assert.match(code, /rowAboveSignOut &&/);
  });

  it('the account page’s rows exist only while the switch is on, signed in or out', () => {
    const code = readCode('app/(consumer)/account/page.tsx');
    assert.match(code, /legalPagesOn\(\)/);
    assert.equal((code.match(/legalRows/g) ?? []).length >= 4, true); // built, signed-in rows, signed-out rows
    assert.match(code, /\{legalRows && /);
  });

  it('the family accept page and the family foot link the privacy policy only through the switch', () => {
    assert.match(readCode('app/(consumer)/family/claim/[token]/ClaimClient.tsx'), /const legal = useLegalLinks\(\);[\s\S]*\{legal\s*\?/);
    assert.match(readCode('app/(consumer)/family/_parts/FamilyRows.tsx'), /legalPagesOn\(\) \? legalPageHref\('privacy'\) : null/);
    for (const f of [...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]) {
      assert.equal(readCode(f).includes('FIELDLOGICHQ_PRIVACY_POLICY_URL'), false, `${f} still reads the retired null constant`);
    }
  });

  it('the legal routes answer "not found" while the switch is off', () => {
    for (const [f, doc] of [
      ['app/terms/page.tsx', 'terms'], ['app/privacy/page.tsx', 'privacy'], ['app/legal/page.tsx', 'terms'],
      ['app/data-terms/page.tsx', 'data-terms'], ['app/subprocessors/page.tsx', 'subprocessors'],
    ]) {
      assert.match(readCode(f), new RegExp(`redirectToLegalDoc\\('${doc}'\\)`), f);
    }
    for (const [f, doc] of [
      ['app/legal/data-terms/page.tsx', 'data-terms'], ['app/legal/data-terms/[version]/page.tsx', 'data-terms'],
      ['app/legal/subprocessors/page.tsx', 'subprocessors'],
    ]) {
      assert.match(readCode(f), new RegExp(`<LegalDocRoute doc="${doc}"`), f);
    }
    const route = readCode('components/legal/LegalDocRoute.tsx');
    // Off — or, for the Data Terms and the list, before their first text — a short address is "not found".
    assert.match(route, /if \(!legalPageLive\(doc\)\) notFound\(\)/);
    assert.match(route, /redirect\(legalPagePath\(/);
    assert.match(route, /if \(!data\) notFound\(\)/);
  });

  it('the redirects are page-level — next.config.ts announces no legal address', () => {
    // The one legal mention allowed is the file-packaging block (outputFileTracingIncludes: which legal pages need the frozen text
    // files in the deployed package, tests/unit/legal-documents-trace-guard.test.ts); it is not a redirect, a rewrite or a link.
    const config = readCode('next.config.ts').replace(/outputFileTracingIncludes:\s*\{[^}]*\}/, '');
    assert.equal(/\/(legal|terms|privacy|data-terms|subprocessors)\b/.test(config), false);
  });

  it('the legal pages are in no sitemap; the Security page is, only behind the same switch (owner 2026-11-22)', () => {
    const sitemap = readCode('app/sitemap.ts');
    // No legal page's address, and no legal-pages helper other than the one switch the Security entry reads.
    assert.equal(/['"`]\/(legal|terms|privacy|data-terms|subprocessors)\b|legalPageHref|legalPagePath/.test(sitemap), false);
    // The Security page is listed, and only while its own switch answers (the page is "not found" otherwise).
    assert.match(sitemap, /resolveLegalLinks\(\)\s*\?\s*\[\{ url: `\$\{SITE_URL\}\$\{SECURITY_PATH\}`/);
    // Own-host sitemaps return before it: a club's host never lists FieldLogicHQ's pages.
    assert.ok(sitemap.indexOf('return clubOwnSitemap') < sitemap.indexOf('SECURITY_PATH}'));
  });
});

describe('the family accept page’s consent words are untouched (6.7 owns them)', () => {
  it('the draft notice and the consent version still exist', () => {
    const code = readCode('lib/family-guardian-consent.ts');
    assert.match(code, /GUARDIAN_CONSENT_DRAFT_NOTICE/);
    assert.match(code, /GUARDIAN_CONSENT_VERSION/);
  });
});
