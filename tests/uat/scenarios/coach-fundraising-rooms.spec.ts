import { test, expect, type Page, type Locator } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * THE FUNDRAISING ROOMS, AS A COACH USES THEM — List · Room · Question Phase B (2026-09-02).
 *
 * The lifecycle spec beside this file walks the MONEY through the product's read endpoints and
 * never touches the screen. This one drives the screen: a drive's row opens its room; the room's
 * Record door stacks the recording conversation OVER it and Escape closes only the top layer (the
 * first genuinely stacked pair in the portal — `useDialogFloor`'s bare-document rule); an entry
 * is corrected through its Question; the sponsor's two-zone room edits a cheque and saves the
 * split with its own button; the conversation's promise row hands off into the pledge sheet
 * with the typing carried, and the sheet hands it back; and a read-only money coach sees the
 * same rooms with no write control at all.
 *
 * ⚠ RUNS ON THE SHARED UAT FIXTURE (`uat-test-org`, the seeder's own drive and sponsor, resolved
 * BY NAME exactly as the layout sweep resolves them). Every write this spec makes is reversed in
 * the same test — the amounts, the method, the split — so the fixture reads the same afterwards
 * and the sweep's baseline keys (label text carries the dollars) stay put. A test that fails
 * mid-way can leave one figure changed; `node scripts/seed-uat-coach-fixture.mjs` will not undo
 * that (it only adds), so put it back by hand if a later run reports a different figure.
 */

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_PROJECT_REF)) {
  throw new Error('coach-fundraising-rooms.spec.ts refuses to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION.');
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const ORG_SLUG = process.env.UAT_ORG_SLUG!;
const COACH_EMAIL = process.env.UAT_COACH_EMAIL!;
const READ_EMAIL = 'uat-asst-money-read@uat-test-org.local';
const PASSWORD = process.env.UAT_COACH_PASSWORD!;

let teamId = '';
let driveId = '';
let sponsorId = '';

test.beforeAll(async () => {
  const { data: org } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  const { data: team } = await admin.from('rep_teams').select('id').eq('org_id', org!.id).limit(1).single();
  teamId = team!.id;
  const { data: py } = await admin.from('rep_program_years')
    .select('id').eq('team_id', teamId).eq('status', 'active').order('year', { ascending: false }).limit(1).single();
  const { data: drive } = await admin.from('rep_fundraisers')
    .select('id').eq('program_year_id', py!.id).eq('kind', 'fundraiser').eq('name', 'Chocolate sale').single();
  const { data: sponsor } = await admin.from('rep_fundraisers')
    .select('id').eq('program_year_id', py!.id).eq('kind', 'sponsor').eq('name', 'Northside Physio').single();
  if (!drive || !sponsor) throw new Error('The UAT fixture is missing its drive or sponsor — run node scripts/seed-uat-coach-fixture.mjs');
  driveId = drive.id;
  sponsorId = sponsor.id;
});

const base = () => `/${ORG_SLUG}/coaches/teams/${teamId}`;
const fundraising = () => `${base()}/accounting?section=fundraisers`;

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/auth/login'), { timeout: 45_000 });
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main[class*="coachesMain"]')).toBeVisible({ timeout: 45_000 });
}

/** The room, once its own read has landed — the same sentinel the layout sweep waits on. */
const room = (page: Page, kind: 'drive' | 'sponsor') =>
  page.locator(`[data-room="${kind}"][data-room-state="loaded"]`);

/** A field by the text of the label beside it — the conversation and the pledge sheet write
 *  `<label>` + control as siblings with no `for`, so `getByLabel` cannot see them. */
const fieldAfter = (scope: Locator, label: string, control = 'input') =>
  scope.locator(`label:has-text("${label}") + ${control}`).first();

/** Park focus on the document body — the state a coach is in after a click on dead space. */
async function blurAll(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
}

test.describe('the fundraising rooms', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a drive opens its room; the Record question stacks over it and Escape peels one layer at a time', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, fundraising());

    // The list is a list: the drive's row carries its chevron door, and nothing is expanded.
    const door = page.getByRole('button', { name: 'Open Chocolate sale' });
    await expect(door).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-room]')).toHaveCount(0);

    await door.click();
    const drive = room(page, 'drive');
    await expect(drive).toBeVisible({ timeout: 45_000 });
    await expect(drive).toHaveAttribute('aria-label', 'Chocolate sale — fundraiser');
    await expect(page).toHaveURL(new RegExp(`fundraiser=${driveId}`));
    // Tiles, then the entries table — the room's own read, not the row's.
    await expect(drive.getByText('Raised', { exact: true })).toBeVisible();
    await expect(drive.getByText('Team keeps', { exact: true })).toBeVisible();
    await expect(drive.getByRole('table', { name: 'Entries' })).toBeVisible();
    expect(await drive.getByRole('table', { name: 'Entries' }).locator('tbody tr').count(), 'the fixture drive holds entries')
      .toBeGreaterThanOrEqual(3);
    // The walk names its neighbour — the fixture's other drive — and counts the list as shown.
    const walk = drive.getByRole('navigation', { name: 'Other drives' });
    await expect(walk).toContainText(/[12] of 2 drives/);
    await expect(walk).toContainText('Bottle drive');

    // ── THE STACKED PAIR. Record opens the conversation OVER the room. ──
    await drive.getByRole('button', { name: 'Record', exact: true }).click();
    const conversation = page.getByRole('dialog', { name: 'Record money' });
    await expect(conversation).toBeVisible({ timeout: 30_000 });
    await expect(drive).toBeVisible();

    /* ── THE PARTIAL LOCK (owner ruling, §135 walk 2026-09-03) ────────────────────────────────
       The room named the drive, so the event and the drive are STATED — there is no "What
       happened?" control to switch and no "Which drive" to re-point, which is the ghost save this
       door used to allow: change either from inside this room and money files against something
       the screen behind never mentions.
       ⚠ AND THE PLAYER QUESTION SURVIVES IT, which is the whole reason the lock had to learn to be
       partial. Asserting only the two absences would pass just as well on a FULL lock — the shape
       that hides the player picker and leaves nobody to credit. Both halves, or this proves the
       wrong thing. */
    await expect(conversation.getByText('Fundraiser money came in — Chocolate sale')).toBeVisible();
    await expect(conversation.locator('label:has-text("What happened?")')).toHaveCount(0);
    await expect(conversation.locator('label:has-text("Which drive")')).toHaveCount(0);
    await expect(fieldAfter(conversation, 'Which player', 'select')).toBeVisible({ timeout: 30_000 });

    // Escape with NOTHING focused closes only the top layer — the room beneath stays.
    await blurAll(page);
    await page.keyboard.press('Escape');
    await expect(conversation).toBeHidden();
    await expect(drive).toBeVisible();

    // Escape from INSIDE the question closes the question, never the room.
    await drive.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(conversation).toBeVisible();
    await fieldAfter(conversation, 'Amount raised').click();
    await page.keyboard.press('Escape');
    await expect(conversation).toBeHidden();
    await expect(drive).toBeVisible();

    // Focus came back to the room's Record door; one more Escape closes the room and the address.
    await page.keyboard.press('Escape');
    await expect(drive).toBeHidden();
    await expect(page).not.toHaveURL(/fundraiser=/);
    await expect(door).toBeFocused();
  });

  test('an entry is corrected through its question, and the room reads the correction back', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, `${fundraising()}&fundraiser=${driveId}`);
    const drive = room(page, 'drive');
    await expect(drive).toBeVisible({ timeout: 45_000 });

    // The seeded $240.00 entry — the one this spec put there, so it can put it back.
    const edit = drive.getByRole('button', { name: /^Edit the \$240\.00 logged for/ });
    await expect(edit).toBeVisible();
    await edit.click();
    const question = page.getByRole('dialog', { name: /^Edit what .* raised$/ });
    await expect(question).toBeVisible();
    await question.getByLabel('Amount raised *').fill('250');
    await question.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(question).toBeHidden({ timeout: 30_000 });
    await expect(drive.getByRole('button', { name: /^Edit the \$250\.00 logged for/ })).toBeVisible({ timeout: 30_000 });

    // And back, so the fixture — and the sweep's baseline keys — read as they did.
    await drive.getByRole('button', { name: /^Edit the \$250\.00 logged for/ }).click();
    await question.getByLabel('Amount raised *').fill('240');
    await question.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(question).toBeHidden({ timeout: 30_000 });
    await expect(drive.getByRole('button', { name: /^Edit the \$240\.00 logged for/ })).toBeVisible({ timeout: 30_000 });
  });

  test('the sponsor’s two-zone room edits a cheque and saves the split with its own button', async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, COACH_EMAIL);
    await open(page, `${fundraising()}&fundraiser=${sponsorId}`);
    const sponsor = room(page, 'sponsor');
    await expect(sponsor).toBeVisible({ timeout: 45_000 });
    await expect(sponsor).toHaveAttribute('aria-label', 'Northside Physio — sponsorship');

    // Both zones, both visible — the room's whole point.
    const cheques = sponsor.getByRole('region', { name: 'Cheques' });
    const split = sponsor.getByRole('region', { name: 'Credited to players' });
    await expect(cheques).toBeVisible();
    await expect(split).toBeVisible();
    await expect(cheques.locator('tbody tr')).toHaveCount(2);
    await expect(sponsor.getByRole('navigation', { name: 'Other sponsors' })).toContainText('sponsors');

    // ── A cheque is corrected: how it came. ──
    await cheques.getByRole('button', { name: 'Edit the $300.00 arrival' }).click();
    const question = page.getByRole('dialog', { name: 'Edit the $300.00 arrival' });
    await expect(question).toBeVisible();
    await question.getByLabel('How did it arrive?').selectOption('cash');
    await question.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(question).toBeHidden({ timeout: 30_000 });
    await expect(cheques).toContainText('by cash', { timeout: 30_000 });
    // …and put back.
    await cheques.getByRole('button', { name: 'Edit the $300.00 arrival' }).click();
    await question.getByLabel('How did it arrive?').selectOption('cheque');
    await question.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(question).toBeHidden({ timeout: 30_000 });
    await expect(cheques).toContainText('by cheque', { timeout: 30_000 });

    // ── The split is live, and saves once. 20% → 25% re-figures both cheques' credits. ──
    await expect(cheques).toContainText('$60.00');
    await expect(cheques).toContainText('$40.00');
    const share = split.getByLabel('Family 1 share');
    await expect(share).toHaveValue('20');
    await expect(split.getByRole('button', { name: 'Save split' })).toHaveCount(0);
    await share.fill('25');
    const save = split.getByRole('button', { name: 'Save split' });
    await expect(save).toBeVisible();
    await save.click();
    // Value-settled: the button leaves only once the room reads the new split back.
    await expect(save).toBeHidden({ timeout: 30_000 });
    await expect(cheques).toContainText('$75.00', { timeout: 30_000 });
    await expect(cheques).toContainText('$50.00');
    // …and back to 20%.
    await share.fill('20');
    await split.getByRole('button', { name: 'Save split' }).click();
    await expect(split.getByRole('button', { name: 'Save split' })).toBeHidden({ timeout: 30_000 });
    await expect(cheques).toContainText('$60.00', { timeout: 30_000 });
    await expect(cheques).toContainText('$40.00');

    // A dirty split guards the way out: change, try to close, keep editing.
    await share.fill('30');
    await expect(split.getByRole('button', { name: 'Save split' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Discard this change to the credit split?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(sponsor).toBeVisible();
    await split.getByRole('button', { name: 'Cancel' }).click();
    await expect(share).toHaveValue('20');
  });

  /**
   * ⚰ WAS: "the conversation's promise row hands off into the pledge sheet … and back". That test
   * proved a JOURNEY between two forms — typing carried out of Record into a sheet, and carried
   * back through "Record it instead". Owner ruling, §135 walk 2026-09-03: there is no journey. The
   * promise is an answer in Record's own list, the form is the conversation's, and "+ Pledge"
   * opens that same conversation locked. What is worth proving now is the pair of states.
   */
  test('the promise is an answer: switchable from Record, stated from + Pledge', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, fundraising());

    // ── FROM RECORD: the promise is one row among the answers, and every other stays a tap away.
    await page.getByRole('button', { name: /^Record/ }).first().click();
    const conversation = page.getByRole('dialog', { name: 'Record money' });
    await expect(conversation).toBeVisible({ timeout: 30_000 });
    const what = conversation.locator('button').filter({ hasText: 'Fundraiser money came in' }).first();
    await what.click();
    const promise = conversation.locator('[role="option"]').filter({ hasText: 'A sponsor promised us money' }).first();
    await expect(promise, 'the promise sits in the answer list, not inside the sponsor picker').toBeVisible();
    await promise.click();

    /* The form is the pledge form, IN PLACE — the conversation never closed and the tab never
       changed, which is the whole point of the ruling. */
    await expect(conversation).toBeVisible();
    await expect(conversation.locator('label:has-text("Expected by")')).toHaveCount(1);
    await fieldAfter(conversation, 'Sponsor *').fill('Handoff Test Sponsor');
    await fieldAfter(conversation, 'Pledged amount *').fill('123');

    /* ⚠ SWITCHING IS PICKING ANOTHER ANSWER, which is what replaced "Record it instead" — and the
       typing survives it, because the name and amount never left the form they live on. */
    await conversation.locator('button').filter({ hasText: 'A sponsor promised us money' }).first().click();
    await conversation.locator('[role="option"]').filter({ hasText: 'A sponsor came through' }).first().click();
    await expect(fieldAfter(conversation, 'Which sponsor?', 'select')).toBeVisible();
    await expect(conversation.locator('label:has-text("Expected by")'), 'the promise field goes with the answer').toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(conversation).toBeHidden();
    const { data: stray } = await admin.from('rep_fundraisers').select('id').eq('name', 'Handoff Test Sponsor');
    expect(stray ?? [], 'answering and leaving writes nothing').toHaveLength(0);

    // ── FROM "+ Pledge": the SAME form, with the answer stated and nothing to select away to.
    await page.getByRole('button', { name: 'Pledge', exact: true }).first().click();
    await expect(conversation).toBeVisible({ timeout: 30_000 });
    await expect(conversation).toContainText('A sponsor promised us money');
    await expect(conversation.locator('label:has-text("Expected by")'), 'the same form as Record opens').toHaveCount(1);
    await expect(
      conversation.locator('label:has-text("What happened?")'),
      'a door that named what it is for states the answer — there is nothing to switch to',
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(conversation).toBeHidden();
  });

  test('a read-only money coach sees the same rooms with no write control at all', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, READ_EMAIL);

    await open(page, `${fundraising()}&fundraiser=${sponsorId}`);
    const sponsor = room(page, 'sponsor');
    await expect(sponsor).toBeVisible({ timeout: 45_000 });
    await expect(sponsor.getByRole('region', { name: 'Cheques' }).locator('tbody tr')).toHaveCount(2);
    await expect(sponsor.getByRole('region', { name: 'Credited to players' })).toContainText('20%');
    // Anchored: the walk's own "No previous record" label contains "record" and is not a write door.
    await expect(sponsor.getByRole('button', { name: /^(record|edit|undo|delete|save split)/i })).toHaveCount(0);
    // No live field anywhere in the room — the split reads as a list, never as the editor.
    await expect(sponsor.getByRole('textbox')).toHaveCount(0);
    await expect(sponsor.getByRole('spinbutton')).toHaveCount(0);
    await expect(sponsor.getByRole('combobox')).toHaveCount(0);
    await expect(sponsor.locator('input, select, textarea').filter({ visible: true })).toHaveCount(0);

    await open(page, `${fundraising()}&fundraiser=${driveId}`);
    const drive = room(page, 'drive');
    await expect(drive).toBeVisible({ timeout: 45_000 });
    await expect(drive.getByRole('table', { name: 'Entries' })).toBeVisible();
    await expect(drive.getByRole('button', { name: /^(record|edit|remove|delete)/i })).toHaveCount(0);
  });
});
