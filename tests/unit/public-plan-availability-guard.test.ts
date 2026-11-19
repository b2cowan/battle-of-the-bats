/**
 * THE ON-SALE SWITCH REACHES EVERY PAGE (on-sale pages S1, owner rulings 2026-11-18; plan
 * docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md S1, words CLUB_ON_SALE_COPY.md).
 *
 * Two failures this pins, both found on production on 2026-11-18:
 *  1. The five public plan pages were BUILT ONCE AT DEPLOY (production served /pricing with `x-nextjs-prerender: 1` and a
 *     one-year cache; the build route table marked all five `○`). The gate read ran at `next build`, so flipping a plan
 *     in platform admin reached none of them. `getPlanGatingMap()` now calls `connection()`, which makes every route
 *     that reads the gate render per request.
 *  2. Each page typed its own availability: "Club is in development" on one page, "Coming soon" on another, "Express
 *     interest" over a plan that was on sale. Every public plan page now reads the gate through one answer
 *     (`isPlanOpen`) and its words through the helpers in lib/plan-config.ts, and types none of them.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, functionBody } from './_source-code.ts';

/** The pages a visitor reads about a plan: they read the gate and type no availability. */
const PUBLIC_PLAN_PAGES = [
  'app/pricing/page.tsx',
  'app/for-clubs/page.tsx',
  'app/for-leagues/page.tsx',
  'app/for-coaches/page.tsx',
  'app/for-tournament-organizers/page.tsx',
  'app/page.tsx',
  'app/(consumer)/start/page.tsx',
  'app/(consumer)/start/club/page.tsx',
  'app/(consumer)/start/league/page.tsx',
];

/** Shared pieces those pages render: they type no availability either. */
const SHARED_PIECES = [
  'components/PricingSection.tsx',
  'components/EarlyAccessModalTrigger.tsx',
  'components/EarlyAccessForm.tsx',
];

/** The plan tags and button words only the helpers may type (case-sensitive: these are the tag and button forms). */
const HELPER_ONLY_WORDS = [/Express interest/, /Coming soon/, /Not open yet/, /Available now/];

/**
 * Withdrawn framings no customer reads again (the early-access programme ended 2026-07-28; S1 word list). "early access"
 * with a space: identifiers and anchors (`earlyAccess`, `id="early-access"`) are not words a visitor reads, and prose
 * fixes never touch them; the rendered-page test reads the words.
 */
const RETIRED = [
  /early access/i, /in (active )?development/i, /finishing its final workflows/i, /while we finish/i,
  /next parts of the platform/i, /plan ahead and express interest/i, /path into the roadmap/i, /keeps the launch honest/i,
  /bring (your|each coach[’']s) team in with everything/i, /Free right now/, /Start Tournament Plus free/,
  /We set up Club with you/i, /let[’']s talk/i, /Most organizations are running/i, /\bused by\b/i, /\b8am\b/i,
];

/** Re-spelling the gate on a page instead of asking `isPlanOpen` (the inversion that offered a door that did not open). */
const GATE_RESPELLED = [
  /gatingStatus/, /isEffectivelyGated/, /\bgating(?:Map)?\s*\[/, /\bgating(?:Map)?\.(?:team|league|club|club_large|tournament|tournament_plus)\b/,
  /\(await getPlanGatingMap\(\)\)\./,
];

describe('the on-sale switch reaches every public plan page', () => {
  it('reading the gate makes a route render per request (connection() before anything else)', () => {
    const body = functionBody(readCode('lib/plan-gating-server.ts'), 'getPlanGatingMap');
    assert.match(body, /^[^{]*\{\s*await connection\(\);/, 'connection() is the first thing getPlanGatingMap does');
    assert.match(readCode('lib/plan-gating-server.ts'), /import \{ connection \} from 'next\/server';/);
  });

  it('every public plan page reads the live gate', () => {
    for (const file of PUBLIC_PLAN_PAGES) {
      if (file.includes('/start/club/') || file.includes('/start/league/')) continue; // closed pages until S2; dynamic already
      assert.match(readCode(file), /getPlanGatingMap\(\)|isCoachesPortalPurchasable\(\)/, `${file} reads the gate`);
    }
  });

  it('no public plan page re-spells the gate or reads the code’s copy of it', () => {
    for (const file of PUBLIC_PLAN_PAGES) {
      const code = readCode(file);
      for (const re of GATE_RESPELLED) assert.doesNotMatch(code, re, `${file} re-spells the gate (${re}); use isPlanOpen()`);
    }
  });

  it('no public plan page or shared piece types a plan tag or the interest button', () => {
    for (const file of [...PUBLIC_PLAN_PAGES, ...SHARED_PIECES]) {
      const code = readCode(file);
      for (const re of HELPER_ONLY_WORDS) {
        assert.doesNotMatch(code, re, `${file} types ${re}; use the helpers in lib/plan-config.ts`);
      }
    }
  });

  it('no retired framing is typed again', () => {
    for (const file of [...PUBLIC_PLAN_PAGES, ...SHARED_PIECES, 'lib/plan-article-content.ts']) {
      const code = readCode(file);
      for (const re of RETIRED) assert.doesNotMatch(code, re, `${file} types ${re}`);
    }
  });

  it('the in-product reader asks the live gate, never the code’s copy', () => {
    const onboarding = readCode('app/[orgSlug]/admin/onboarding/page.tsx');
    assert.match(onboarding, /const gatingMap = usePlanGating\(\);/);
    assert.doesNotMatch(onboarding, /gatingStatus/, 'the first paint no longer seeds from the code');
    assert.match(onboarding, /\{gatingMap && <PricingSection/, 'the chooser waits for the live gate');
  });

  it('the interest form’s consent box opens unticked (Ask 6, /legal)', () => {
    assert.match(readCode('components/EarlyAccessForm.tsx'), /setReleaseNotificationsConsent\] = useState\(false\)/);
    // …and the server stores only a tick as consent: a form with no box (the coach start's) is not a yes.
    assert.match(readCode('app/api/early-access/route.ts'), /release_notifications_consent: consentSent === true,/);
  });

  it('the footer reaches the four persona pages and holds one "Coaches" link (W63)', () => {
    const footer = readCode('components/Footer.tsx');
    assert.match(footer, /heading: 'Built for'/);
    for (const href of ['/for-tournament-organizers', '/for-leagues', '/for-clubs', '/for-coaches']) assert.ok(footer.includes(`'${href}'`), href);
    assert.equal(footer.match(/\['Coaches',/g)?.length, 1);
  });

  // ⚖ UPDATED IN THE OPEN (owner 2026-11-19): W63's test pinned a "Coaches Portal" → /coaches/start link here. The
  // owner replaced the footer's per-product sign-up doors with ONE door to the chooser, which already knows what is
  // on sale and where the coach door leads (lib/start-menu.ts) — the footer is pathname-only and cannot.
  it('the footer holds one door to the chooser, never a sign-up door per product; signed in, it stops offering sign-in', () => {
    const footer = readCode('components/Footer.tsx');
    assert.match(footer, /\['Get started', '\/start'\]/);
    // Any spelling of a sign-up door: a path under the chooser, the coach sign-up, or one of the constants that name them.
    assert.doesNotMatch(footer, /\/start\/|\/coaches\/start|COACHES_START_PATH|START_DOOR_PATH|COACH_DOOR_HREF/, 'a sign-up door belongs on the chooser');
    assert.doesNotMatch(footer, /['"`]Start free['"`]/i);
    assert.match(footer, /const signedIn = useClientSignedIn\(surface !== null\);/);
    assert.match(footer, /!signedIn\s*\?\s*SIGNED_OUT_LINKS/);
  });
});
