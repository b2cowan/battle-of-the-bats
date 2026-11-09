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
  ['app/(consumer)/auth/signup/AccountOnlySignup.tsx', 1],
  ['app/(consumer)/start/StartDoorForm.tsx', 3],
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
    it(`${file} renders LegalFootLinks ${count} time(s)`, () => {
      const code = readCode(file);
      assert.equal((code.match(/<LegalFootLinks\b/g) ?? []).length, count);
      assert.match(code, /import LegalFootLinks from '@\/components\/legal\/LegalFootLinks'/);
    });
  }

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

  it('the account menu draws its legal line only from the provider, in the popover and the sheet', () => {
    const code = readCode('components/shared/AccountMenu.tsx');
    assert.match(code, /useLegalLinks\(\)/);
    assert.match(code, /if \(!legal\) return null/);
    assert.equal((code.match(/legalLine\((?:true|false)\)/g) ?? []).length, 2);
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
    for (const f of ['app/terms/page.tsx', 'app/privacy/page.tsx', 'app/legal/page.tsx']) {
      const code = readCode(f);
      assert.match(code, /if \(!legalPagesOn\(\)\) notFound\(\)/, f);
      assert.match(code, /redirect\(legalPagePath\(/, f);
    }
    assert.match(readCode('components/legal/LegalDocRoute.tsx'), /if \(!data\) notFound\(\)/);
  });

  it('the redirects are page-level — next.config.ts announces no legal address', () => {
    assert.equal(/\/(legal|terms|privacy)\b/.test(readCode('next.config.ts')), false);
  });

  it('the legal pages are in no sitemap', () => {
    assert.equal(/legal|\/terms|\/privacy/.test(readCode('app/sitemap.ts')), false);
  });
});

describe('the family accept page’s consent words are untouched (6.7 owns them)', () => {
  it('the draft notice and the consent version still exist', () => {
    const code = readCode('lib/family-guardian-consent.ts');
    assert.match(code, /GUARDIAN_CONSENT_DRAFT_NOTICE/);
    assert.match(code, /GUARDIAN_CONSENT_VERSION/);
  });
});
