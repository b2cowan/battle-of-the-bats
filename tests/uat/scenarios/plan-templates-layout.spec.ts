/**
 * Practice Plans Phase 3 — the plan library, the recap, and looking back. Layout probes.
 *
 * BINDING METHOD: read COMPUTED STYLES and real geometry, never eyeball a screenshot (a screenshot
 * pass has produced the wrong fix twice in this portal).
 *
 * What these hold, beyond "it renders":
 *   · every new room renders at 361px — the narrowest phone a coach brings — with no sideways scroll
 *   · every control THIS FEATURE adds clears the 44px tap floor
 *   · ⚠ **the CSS module actually resolved** on each new page. Phase 2 shipped a wrong relative
 *     import depth that typechecked cleanly and rendered a whole room as a build error; only a
 *     probe caught it. Four new pages sit at three different depths here.
 *   · ⚠ **the template editor offers NO people controls** — a template carries the shape and the
 *     teaching, never players or staff, and the controls must be ABSENT rather than disabled
 *   · ⚠ **the coverage table has no sort affordance of any kind** and shows no per-player number
 *     beside a child's name (§4, and this is the surface where that rule is sharpest)
 *
 * Seed the fixture first (idempotent, and it prints the id):
 *   node scripts/seed-uat-coach-fixture.mjs
 *   PROBE_EVENT_ID=<id> npx playwright test --config playwright.config.ts tests/uat/scenarios/plan-templates-layout.spec.ts
 *
 * ⚠ Run by FILE PATH, never `-g`: unrelated specs fail at collection with
 * "Cannot find module 'server-only'" and will drown the run.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

/**
 * ⚠ THE COACH SESSION, EXPLICITLY. The `uat` project defaults every spec to the ORG-OWNER session,
 * who holds no coaching assignment — a coach-portal spec that forgets this line lands on "Not
 * assigned to any teams" and fails in a way that looks like a product bug.
 */
test.use({ storageState: path.join(__dirname, '..', '.auth', 'coach.json') });

const SLUG = 'uat-test-org';
const TEAM = '3127a094-458f-4b78-8726-17342a8e37a6';
const EVENT = process.env.PROBE_EVENT_ID ?? '';

const templatesUrl = () => `/${SLUG}/coaches/teams/${TEAM}/development/templates`;
const reportUrl = () => `/${SLUG}/coaches/teams/${TEAM}/history/development`;
const planUrl = () => `/${SLUG}/coaches/teams/${TEAM}/practice/${EVENT}`;
const hubUrl = () => `/${SLUG}/coaches/teams/${TEAM}/development`;

const WIDTHS = [
  { name: '361 (narrowest phone)', width: 361, height: 780 },
  { name: '390 (iPhone)', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

/** Horizontal overflow of the document — the one thing a coach notices instantly and hates. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * ⚠ **Did the CSS module resolve at all?**
 *
 * A wrong relative depth on a `.module.css` import is invisible to TypeScript and to lint. It
 * surfaces as a build error on that one route — which, on a page that also renders an empty state,
 * can read as "the feature just isn't there yet". This asks the DOM: a resolved CSS module leaves
 * hashed class names on the page's own elements, and an unresolved one leaves the route unable to
 * render at all.
 */
async function pageRenderedWithStyles(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Next's error overlay / build-error page carries none of the portal's hashed classes.
    const hashed = Array.from(document.querySelectorAll('[class]'))
      .some(el => /(^|\s)[A-Za-z]+_[A-Za-z][\w-]*__[\w-]+/.test(el.className.toString()));
    return hashed;
  });
}

/**
 * Rendered heights of the controls THIS FEATURE adds, so the tap floor is measured, not assumed.
 *
 * ⚠ Deliberately scoped to the classes THIS PHASE introduces. A blanket 44px assertion across the
 * document fails on the portal's own shell — the team nav rows render at 38.5px and the shared
 * `.btnPrimary` / `.btnSecondary` primitives at 41px, product-wide, on every screen. That is a
 * pre-existing portal-wide baseline; re-litigating it from inside one feature's probe would either
 * wrongly fail this build or pressure someone into widening a shared primitive to pass a test.
 *
 * ⚠ **`.ppSuggestChip` is deliberately NOT in this list, and must not be added.** It is a SHARED
 * primitive that shipped in Phase 2 at ~21px and is used by the drill library's filter chips, the
 * plan editor's staff/equipment suggestions and the tag picker's offered tags. This phase's rooms
 * reuse it correctly — they are the same kind of chip — so failing on it here would push someone
 * into widening a primitive that four committed surfaces already depend on. Phase 2's own probe
 * excluded it for exactly this reason; if that baseline is ever raised it is a portal-wide design
 * decision, not something one feature's probe gets to force.
 */
async function shortPhase3ControlHeights(page: Page): Promise<{ text: string; height: number }[]> {
  return page.evaluate(() => {
    const out: { text: string; height: number }[] = [];
    const sel = [
      '[class*="ppSourceTab"]',
      '[class*="reportRecapLink"]',
      '[class*="ppDrillFilters"] input',
    ].join(', ');
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const rect = el.getBoundingClientRect();
      // Skip anything not actually on screen — a collapsed section is not a tap target.
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < 44) {
        out.push({ text: (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40), height: rect.height });
      }
    }
    return out;
  });
}

test.describe('plan templates — the room', () => {
  for (const vp of WIDTHS) {
    test(`renders, with its stylesheet, and no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(templatesUrl());
      await expect(page.getByRole('heading', { name: 'Plan templates' })).toBeVisible();

      // ⚠ The Phase 2 trap: a wrong CSS-module depth typechecks cleanly and breaks the route.
      expect(await pageRenderedWithStyles(page), 'the page rendered with its CSS module resolved').toBe(true);

      expect(await horizontalOverflow(page), 'document must not scroll sideways').toBeLessThanOrEqual(0);
    });
  }

  test('every control this feature adds clears the 44px tap floor at 361', async ({ page }) => {
    await page.setViewportSize({ width: 361, height: 780 });
    await page.goto(templatesUrl());
    await expect(page.getByRole('heading', { name: 'Plan templates' })).toBeVisible();
    expect(await shortPhase3ControlHeights(page)).toEqual([]);
  });

  test('the empty state offers all three routes in (owner ruling, frame 03)', async ({ page }) => {
    await page.goto(templatesUrl());
    await expect(page.getByRole('heading', { name: 'Plan templates' })).toBeVisible();
    const hasTemplates = await page.locator('[class*="ppDrillCard"]').count() > 0;
    test.skip(hasTemplates, 'this team already has templates — the empty state is not on screen');
    // ⚠ "New template" is offered at ZERO as well as at one: refusing at zero while allowing it at
    // one is an arbitrary rule rather than a principle.
    await expect(page.getByRole('button', { name: /New template/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add from a past season/i })).toBeVisible();
  });
});

/**
 * Make sure this team has at least one template, creating one through the room's own "New
 * template" button if not — which is frame 03's flow, so the setup is itself a probe of it.
 *
 * ⚠ Written as a helper rather than a `test.skip`. The two tests it unblocks are the ones that
 * hold the phase's most important rules (a template carries no people; one picker, two sources),
 * and a probe that quietly skips the rule it exists to enforce is worse than no probe — it reports
 * green while checking nothing.
 */
async function ensureTemplate(page: Page): Promise<void> {
  await page.goto(templatesUrl());
  await expect(page.getByRole('heading', { name: 'Plan templates' })).toBeVisible({ timeout: 30_000 });
  if (await page.locator('[class*="ppTemplateLink"]').count() > 0) return;
  // "New template" is offered at ZERO as well as at one, and lands straight in the editor.
  await page.getByRole('button', { name: /New template/i }).first().click();
  // ⚠ The template's own Name field, not `.ppHeaderCard` — the editor legitimately renders TWO of
  // those (the template's name/tags card, and the plan editor's goal/equipment card), so a class
  // locator is ambiguous by design rather than by accident.
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible({ timeout: 30_000 });
}

test.describe('the template editor — a template carries no people', () => {
  test('offers no roster, staff or group controls, and they are ABSENT rather than disabled', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureTemplate(page);
    await page.goto(templatesUrl());
    await expect(page.getByRole('heading', { name: 'Plan templates' })).toBeVisible({ timeout: 30_000 });
    await page.locator('[class*="ppTemplateLink"]').first().click();

    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible({ timeout: 30_000 });
    expect(await pageRenderedWithStyles(page), 'the editor rendered with its CSS module resolved').toBe(true);

    // ⚠ A control that exists only to refuse should not exist. These must be absent, not disabled —
    // so counting them (rather than checking `disabled`) is the assertion that matters.
    await expect(page.getByRole('button', { name: /Choose players/i })).toHaveCount(0);
    await expect(page.getByLabel(/^Who runs it$/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Draw$|Draw again/i })).toHaveCount(0);
    await expect(page.getByLabel(/^Just for tonight$/i)).toHaveCount(0);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('the practice plan — the recap and the two-source picker', () => {
  test.skip(!EVENT, 'Set PROBE_EVENT_ID (node scripts/seed-uat-coach-fixture.mjs prints it).');

  test('"How it went" is on the practice, and says who sees it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(planUrl());
    await expect(page.getByRole('heading', { name: 'How it went' })).toBeVisible();
    // ⚠ D17's guardrail, checked at the DOM rather than trusted to a code comment: the placeholder
    // and the helper both steer away from naming a child.
    await expect(page.getByLabel('How it went')).toHaveAttribute('placeholder', /what would you do differently/i);
    await expect(page.getByText(/about the practice, not about a player/i).first()).toBeVisible();
    await expect(page.getByText(/Families never see this/i).first()).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('"Start this plan from…" is ONE control with two sources, not two doors', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // A template is one of the two sources, so the control only exists once there is something to
    // start from — seed one rather than skip the rule this probe is here to hold.
    await ensureTemplate(page);
    await page.goto(planUrl());
    const opener = page.getByRole('button', { name: /Start this plan from/i });

    // The retired wording must not survive anywhere: one control, one name.
    await expect(page.getByRole('button', { name: /^Copy from a previous practice$/i })).toHaveCount(0);

    await opener.click();
    await expect(page.getByRole('tab', { name: 'A template' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'A previous practice' })).toBeVisible();
    expect(await shortPhase3ControlHeights(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the plan asks what it is about with the SHARED tag picker, not free text', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(planUrl());
    // The Phase 3 ruling: one vocabulary across drills, templates, plans and focus areas.
    await expect(page.getByText('What this practice is about').first()).toBeVisible();
    // The retired free-text control must be gone — two vocabularies is the drift tags removed.
    await expect(page.getByText(/^Kind of practice$/i)).toHaveCount(0);
  });
});

test.describe('the Development report — coverage, and the rules that bind hardest', () => {
  for (const vp of WIDTHS) {
    test(`renders with no horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(reportUrl());
      // Retitled to the question it answers by the page-header ruling 2026-08-11 — it and the
      // Development HUB were both called "Development", which is how a coach lands on the wrong one.
      await expect(page.getByRole('heading', { name: /^Is everyone getting attention\?/ })).toBeVisible();
      expect(await pageRenderedWithStyles(page), 'the report rendered with its CSS module resolved').toBe(true);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  /**
   * ⚠ The three no-ranking rules on ONE page load, deliberately.
   *
   * They describe one screen, and each extra navigation to this page costs a Turbopack dev compile
   * — six sequential loads made the last one time out on a 60s budget while the same assertion
   * passed four times above it. That was the dev server, never the product. Merging the assertions
   * that read the same rendered table keeps every rule enforced and stops the probe measuring
   * compile latency instead of layout.
   */
  test('⚠ no sort affordance, no comparable number, and the vocabulary says PLANNED', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(reportUrl());
    // Generous, and only here: this page fetches before it can render anything, so the first
    // assertion after a cold compile is measuring the dev server rather than the product.
    await expect(page.getByRole('heading', { name: /^Is everyone getting attention\?/ })).toBeVisible({ timeout: 30_000 });

    const sortable = await page.evaluate(() => {
      const table = document.querySelector('[class*="devBoardTable"]');
      if (!table) return { present: false, offenders: [] as string[] };
      const offenders: string[] = [];
      for (const th of Array.from(table.querySelectorAll('th'))) {
        // Any of these would make a column orderable — and ordering children is what §4 forbids.
        if (th.querySelector('button, a, [role="button"]')) offenders.push(th.textContent ?? '');
        if (th.hasAttribute('aria-sort') || th.getAttribute('role') === 'button') offenders.push(th.textContent ?? '');
        if ((th as HTMLElement).onclick) offenders.push(th.textContent ?? '');
      }
      return { present: true, offenders };
    });
    expect(sortable.offenders, 'a sortable column head on the coverage table').toEqual([]);

    /**
     * ── ⚠ A flag or a tick beside a child's name, NEVER a comparable number ──
     *
     * ⚠ `present: false` is a PASS, not a skip. Assigning players to blocks is optional and the
     * question needs a real habit of planning behind it, so on a team with too few plans — or none
     * that name anyone — the column is deliberately absent rather than a screen of flags that say
     * nothing true. An assertion that demanded the column exist would have pushed the product into
     * exactly the confident lie it refuses. (The seeded UAT fixture is that case: one plan.)
     */
    const coverage = await page.evaluate(() => {
      const table = document.querySelector('[class*="devBoardTable"]');
      if (!table) return { present: false, cells: [] as string[] };
      const heads = Array.from(table.querySelectorAll('th')).map(th => (th.textContent ?? '').trim());
      const col = heads.indexOf('In a plan');
      if (col < 0) return { present: false, cells: [] as string[] };
      return {
        present: true,
        cells: Array.from(table.querySelectorAll('tbody tr'))
          .map(tr => (tr.children[col]?.textContent ?? '').trim()),
      };
    });
    for (const text of coverage.cells) {
      // A count, a percentage or a streak beside a child's name is exactly what §4 forbids: it
      // could be read against the row above it.
      expect(text, `"${text}" must be a flag or a tick, never a number`).toMatch(/^(✓|— not in a plan yet)$/);
    }

    /**
     * ── The COVERAGE vocabulary says PLANNED, never done ──
     *
     * ⚠ Scoped to the coverage table and its finding, NOT to the whole page. Two truth statuses
     * live on this screen on purpose: coverage says *planned*, and "Practices you've run" is the
     * one section allowed to describe what actually happened — it earns that because a coach sat
     * down afterwards and wrote it, and its own copy legitimately reads *"what you did last time"*.
     * A whole-body scan would fail on that sanctioned sentence and quietly pressure someone into
     * softening the section that is supposed to be blunt.
     */
    const coverageText = await page.evaluate(() => {
      const table = document.querySelector('[class*="devBoardTable"]');
      const finding = document.querySelector('[class*="reportFinding"]');
      return [finding?.textContent ?? '', table?.textContent ?? ''].join(' ').toLowerCase();
    });
    for (const banned of ['worked on', 'covered', ' did ', ' ran ', 'completed']) {
      expect(coverageText, `coverage must not claim "${banned}"`).not.toContain(banned);
    }
    // When the column IS on screen, its head must be the exact agreed words — "In a plan" is the
    // whole vocabulary ruling in three words, so it is worth pinning rather than assuming.
    if (coverage.present) expect(coverageText).toContain('in a plan');
  });
});

test.describe('the Development hub — the new door', () => {
  test('offers Plan templates beside Your drills', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(hubUrl());
    await expect(page.getByRole('heading', { name: /^Development/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Plan templates/i })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
