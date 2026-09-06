import { test, expect, type Locator, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * THE TEAM BILL'S ROOM, AS A COACH USES IT — List · Room · Question Phase C (2026-09-04).
 *
 * ⚠⚠ **THIS SCREEN HAD NO UAT COVERAGE AT ALL UNTIL THIS FILE** (grepped 2026-09-03: nothing under
 * `tests/uat/scenarios` opened `?bill=`). It carried six autosaving controls, a schedule with a
 * three-way scoped editor, a payments list with a named-dollar Remove and a guarded Delete — every
 * one of them proved by reading source or by owner QA, never by a run. The layout sweep measured
 * the screen at rest and, by its own docblock, "does not TYPE".
 *
 * What this drives, in the order the phase changed them: the list's chevron opens the room over a
 * Ledger that stays mounted; a deep link opens the same room; Prev/Next walks by name; a field
 * autosaves and the list behind agrees; recording a payment throws History open by itself; Remove
 * asks in the FOOT and reverses; the scope Question stacks and Escape peels one layer; and a
 * read-only money coach opens the same room with no write control in it.
 *
 * ⚠ RUNS ON THE SHARED UAT FIXTURE (`uat-test-org`, the seeder's own two-part payable, resolved BY
 * NAME exactly as the layout sweep resolves it). Every write is reversed in the same test — the
 * note, the payment — so the fixture reads the same afterwards and the sweep's baseline keys (label
 * text carries the dollars) stay put. A test that fails mid-way can leave one figure changed;
 * `node scripts/seed-uat-coach-fixture.mjs` will not undo that (it only adds), so put it back by
 * hand if a later run reports a different figure.
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
  throw new Error('coach-bill-room.spec.ts refuses to run: NEXT_PUBLIC_SUPABASE_URL points at PRODUCTION.');
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

/** The seeder's two-part payable: two installments, one settled, one part-paid, two payments. */
const BILL_NAME = 'Spring classic entry';
/** The one figure this spec writes and takes back — see the leftover guard in `beforeAll`. */
const PROBE_AMOUNT = 17;

let teamId = '';
let billId = '';

test.beforeAll(async () => {
  const { data: org } = await admin.from('organizations').select('id').eq('slug', ORG_SLUG).single();
  const { data: team } = await admin.from('rep_teams').select('id').eq('org_id', org!.id).limit(1).single();
  teamId = team!.id;
  const { data: py } = await admin.from('rep_program_years')
    .select('id').eq('team_id', teamId).eq('status', 'active').order('year', { ascending: false }).limit(1).single();
  /* ⚠ BY NAME AND BY TYPE, and `tournament_payable` matters: the same words also name a plain
     `expense` row in this fixture, which has no schedule and no room. */
  const { data: bill } = await admin.from('rep_team_expenses')
    .select('id').eq('program_year_id', py!.id).eq('expense_type', 'tournament_payable')
    .eq('description', BILL_NAME).maybeSingle();
  if (!bill) throw new Error(`The UAT fixture is missing "${BILL_NAME}" — run node scripts/seed-uat-coach-fixture.mjs`);
  billId = bill.id;

  /* ⚠⚠ A CRASHED RUN LEAVES ITS PROBE PAYMENT BEHIND, AND THE NEXT RUN MUST SAY SO RATHER THAN
     WORK AROUND IT. The record-and-remove test posts one $17.00 payment and takes it back; a run
     that dies between the two leaves it on the bill, which changes the room's own figures and the
     layout baseline's label keys.
     ⚠⚠ AND THE REPAIR IS THROUGH THE ROOM, NEVER THROUGH THE DATABASE. A payment POSTS A LEDGER
     ENTRY, and only the DELETE route reverses it — deleting the row directly strands the entry, so
     the team's cash on hand drops by the amount with nothing on any screen to explain it. (Learned
     the expensive way while writing this file: four orphaned entries, $68, invisible.) The seeder
     will not fix this either — it only adds. */
  const { data: strays } = await admin.from('rep_payable_payments')
    .select('id, amount').eq('expense_id', billId).eq('amount', PROBE_AMOUNT);
  if (strays && strays.length > 0) {
    throw new Error(
      `The fixture bill "${BILL_NAME}" carries ${strays.length} leftover $${PROBE_AMOUNT}.00 payment(s) from a `
      + 'crashed run. Open the bill on the Ledger (?bill=…) and press Remove on each — through the '
      + 'room, so the ledger entry is reversed with it. Do NOT delete the row in the database.',
    );
  }
});

const base = () => `/${ORG_SLUG}/coaches/teams/${teamId}`;
const ledgerBills = () => `${base()}/accounting?section=ledger&view=bills`;

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

/** The room, once its STANDING has landed — the same sentinel the layout sweep waits on. */
const room = (page: Page) => page.locator('[data-room="bill"][data-room-state="loaded"]');

/** A field by the text of the label beside it — the Record conversation writes `<label>` + control
 *  as siblings with no `for`, so `getByLabel` cannot see them. */
const fieldAfter = (scope: Locator, label: string, control = 'input') =>
  scope.locator(`label:has-text("${label}") + ${control}`).first();

/** Park focus on the document body — the state a coach is in after a click on dead space. */
async function blurAll(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
}

test.describe('the team bill’s room', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the list’s chevron opens the room over a Ledger that stays put, and the walk names its neighbours', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, ledgerBills());

    /* ⚠⚠ THE ROW'S DOOR IS A REAL BUTTON (owner ruling 2026-09-03, applied to this list in Phase C).
       A bare clickable `<tr>` is mouse-only, so this assertion is the accessibility claim, not a
       cosmetic one: without the button there is no keyboard or screen-reader way into the room. */
    const door = page.getByRole('button', { name: `Open ${BILL_NAME}` });
    await expect(door).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-room]')).toHaveCount(0);

    const main = page.locator('main[class*="coachesMain"]');
    const rows = main.locator('tr[class*="payBillRow"]');
    await expect(rows.first()).toBeVisible();

    await door.click();
    const bill = room(page);
    await expect(bill).toBeVisible({ timeout: 45_000 });
    await expect(bill).toHaveAttribute('aria-label', `${BILL_NAME} — bill`);
    await expect(page).toHaveURL(new RegExp(`bill=${billId}`));

    /* ⚠⚠ THE LEDGER IS STILL THERE — the phase's whole point, and the one thing a screenshot of the
       room cannot show. On the page this replaced, the whole list AND its chrome were gated behind
       `!focusBillId`, so opening a bill unmounted the toolbar, the filters and every row; closing
       rebuilt them from scratch and the coach's place was gone.
       ⚠ PRESENCE, NOT AN EXACT COUNT: the list keeps loading behind the room (the money read
       resolves in stages), so pinning a number taken a moment earlier tests the fixture's timing
       rather than the claim. */
    await expect(rows.first()).toBeVisible();
    await expect(main.getByRole('button', { name: 'Add a bill' })).toBeVisible();

    // The four figures, above anything that scrolls. ⚠ Scoped to the tile LABELS — "Paid" is also a
    // status word on the schedule two inches below, and a bare text match hits both.
    await expect(bill.locator('[class*="tileLabel"]')).toHaveText(['Total', 'Paid', 'Left', 'Next due']);
    // The chip counts PIECES: the fixture's bill has one settled piece of two.
    await expect(bill.getByText(/1 of 2 paid/i)).toBeVisible();
    await expect(bill.getByText(/^Scheduled/)).toBeVisible();
    await expect(bill.getByText('Details', { exact: true })).toBeVisible();

    /* ⚖⚖ THE RUNNING ORDER IS ITSELF THE CLAIM (owner, 2026-09-06): the PLAN, then what actually
       MOVED, then what the bill IS. Asserted as an order rather than three presence checks,
       because the defect it guards against is a block MOVING, not a block vanishing — Details sat
       between the schedule and History for a phase, which put the answer to "why is $540 still
       owing?" five form rows and a fold below the question. */
    /* ⚠⚠ LOWER-CASED, AND THAT IS NOT DEFENSIVE TYPING — `innerText` returns RENDERED text, so it
       carries `text-transform` with it. Both section labels are uppercased in CSS, so the room
       reads "SCHEDULED — 2 INSTALLMENTS" and "DETAILS" here while the source says "Scheduled" and
       "Details" — and the assertion failed on its first run for exactly that reason. (The
       `getByText('Details')` check above passes either way: Playwright matches DOM text content,
       which is NOT transformed. Two matchers, two different strings, same element.) */
    const reading = (await bill.innerText()).toLowerCase();
    const at = (mark: string) => reading.indexOf(mark);
    expect(at('scheduled'), 'the schedule leads the room').toBeGreaterThan(-1);
    expect(at('history'), 'what actually moved follows the plan').toBeGreaterThan(at('scheduled'));
    expect(at('details'), 'what the bill IS is the room’s footer').toBeGreaterThan(at('history'));

    // ── The walk: named destinations, a position count, and it actually moves. ──
    const walk = bill.getByRole('navigation', { name: 'Other bills' });
    await expect(walk).toContainText(/\d+ of \d+ bills/);
    const next = walk.getByRole('button', { name: /^Next: / });
    const nextName = (await next.getAttribute('aria-label'))!.replace(/^Next: /, '');
    await next.click();
    await expect(bill).toHaveAttribute('aria-label', `${nextName} — bill`, { timeout: 30_000 });
    await expect(page).not.toHaveURL(new RegExp(`bill=${billId}`));
    // ...and back, by the arrow key the floor binds on a desktop.
    await bill.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowLeft');
    await expect(bill).toHaveAttribute('aria-label', `${BILL_NAME} — bill`, { timeout: 30_000 });

    // Close is the shell's — no "back to Ledger" label survives — and focus returns to the door.
    await expect(bill.getByRole('link', { name: /ledger/i })).toHaveCount(0);
    await blurAll(page);
    await page.keyboard.press('Escape');
    await expect(bill).toBeHidden();
    await expect(page).not.toHaveURL(/bill=/);
  });

  test('a deep link opens the room, a field autosaves, and the list behind agrees', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, `${ledgerBills()}&bill=${billId}`);
    const bill = room(page);
    await expect(bill).toBeVisible({ timeout: 45_000 });

    /* ⚠ THE NOTE, NOT THE NAME. The name is the one field the server can refuse (an ambiguous
       ledger match on a rename), and a spec that renames the fixture's bill would both risk that
       refusal and move the sweep's baseline keys, which carry label text. */
    const note = bill.getByRole('textbox', { name: 'Notes' });
    const original = await note.inputValue();
    const stamp = `UAT ${Date.now()}`;
    await note.fill(stamp);
    /* ⚠ `exact: true`, and it is load-bearing: Playwright's substring match is case-INSENSITIVE, so
       a loose "Saved" matches **"Unsaved changes"** — the state one beat BEFORE the save. A test
       written the loose way passes instantly on the dirty strip and then reloads the page inside
       the ~0.9s debounce, proving the opposite of what it claims. */
    await expect(bill.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });

    // The autosave landed on the server, not just in the box.
    await page.reload();
    await expect(room(page)).toBeVisible({ timeout: 45_000 });
    await expect(room(page).getByRole('textbox', { name: 'Notes' })).toHaveValue(stamp);

    /* ⚠⚠ AND THE WAY OUT WRITES (Phase C). A room's ✕ is not a link, so `UnsavedChangesGuard` never
       sees it — without the flush, a keystroke inside the ~0.9s autosave debounce would be
       discarded by the closing overlay. Type and close IMMEDIATELY: that is the whole test. */
    await room(page).getByRole('textbox', { name: 'Notes' }).fill(original);
    await room(page).getByRole('button', { name: 'Close' }).click();
    await expect(room(page)).toBeHidden({ timeout: 30_000 });
    await open(page, `${ledgerBills()}&bill=${billId}`);
    await expect(room(page).getByRole('textbox', { name: 'Notes' })).toHaveValue(original, { timeout: 45_000 });
  });

  test('recording a payment throws History open, and Remove asks in the FOOT and reverses it', async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, COACH_EMAIL);
    await open(page, `${ledgerBills()}&bill=${billId}`);
    const bill = room(page);
    await expect(bill).toBeVisible({ timeout: 45_000 });

    /* History is CLOSED at rest — the schedule is the room's one open view. ⚠ It is the portal's
       shared `<details>` section (`CoachCollapseSection`), keyed by the room's own sentinel, so the
       state to read is the element's `open` attribute rather than an `aria-expanded`. */
    const history = bill.locator('details#bill-history');
    await expect(history).toBeVisible();
    await expect(history).not.toHaveAttribute('open', /.*/);

    // ── Record, through the one door, pre-answered to this bill. ──
    await bill.getByRole('button', { name: 'Record', exact: true }).first().click();
    const conversation = page.getByRole('dialog', { name: 'Record money' });
    await expect(conversation).toBeVisible({ timeout: 45_000 });
    await expect(bill).toBeVisible();                       // it STACKS, it does not replace
    /* ⚠⚠ THE DOOR NAMED THE RECORD, SO THE EVENT IS STATED (owner ruling A, 2026-08-23). Asserting
       the lock line is the ghost-save check: without it a coach standing in one bill's room could
       switch "What happened?" and file money against something the screen behind never mentions. */
    await expect(conversation.getByText(`We paid for something — ${BILL_NAME}`)).toBeVisible();
    await expect(conversation.locator('label:has-text("What happened?")')).toHaveCount(0);
    await fieldAfter(conversation, 'Amount *').fill(String(PROBE_AMOUNT));
    await conversation.getByRole('button', { name: /^(Save|Record)/ }).click();
    await expect(conversation).toBeHidden({ timeout: 45_000 });

    /* ⚖ THE FOLD OPENS ITSELF (plan §4). Without this the coach's own act appears to produce
       nothing: the payment lands inside a section that is closed by default. */
    await expect(bill.locator('details#bill-history')).toHaveAttribute('open', /.*/, { timeout: 30_000 });
    await expect(bill.getByText('$17.00').first()).toBeVisible({ timeout: 30_000 });

    // ── Remove ASKS, and the question docks in the FOOT, not under the row. ──
    /* ⚠ `.first()` AND THE LOOP AT THE END ARE THE FIXTURE'S INSURANCE, not sloppiness: this spec
       shares one seeded bill, and a run that dies between the POST and the Remove leaves a $17
       payment behind. The next run then finds two. ⚠⚠ AND THEY MUST BE REMOVED THROUGH THE ROOM,
       never by deleting the row in the database — the payment posts a LEDGER ENTRY, and only the
       route reverses it. A raw row delete strands the entry, and the team's cash on hand quietly
       drops by $17 with nothing on any screen to explain it. */
    const removeDoor = bill.getByRole('button', { name: 'Remove the $17.00 payment' });
    await removeDoor.first().click();
    const question = bill.getByRole('alertdialog', { name: 'Remove the $17.00 payment?' });
    await expect(question).toBeVisible();
    /* ⚠⚠ THE PLACEMENT IS THE RULING (owner, §134 walk; plan §10) — the question must be in the
       pinned foot, which is the one band that is always visible, NOT in the scrolling body where a
       long schedule can push it below the fold. Proved by geometry, not by presence: the question's
       box must sit below the room's own scroll region. */
    const bodyBox = (await bill.locator('[class*="body"]').first().boundingBox())!;
    const askBox = (await question.boundingBox())!;
    expect(askBox.y, 'the confirmation docks in the foot, below the scrolling body')
      .toBeGreaterThanOrEqual(bodyBox.y + bodyBox.height - 2);
    // And it REPLACES the doors it suspends — nothing competing is rendered beside it.
    await expect(bill.getByRole('button', { name: 'Delete this bill' })).toBeHidden();

    await question.getByRole('button', { name: /^Remove \$17\.00$/ }).click();
    await expect(question).toBeHidden({ timeout: 45_000 });
    // The doors the question suspended come back the moment it is answered.
    await expect(bill.getByRole('button', { name: 'Delete this bill' })).toBeVisible({ timeout: 30_000 });

    // The fixture goes back exactly as it was.
    await expect(removeDoor).toHaveCount(0, { timeout: 30_000 });
  });

  test('the scope Question stacks over the room, and a bare Escape peels one layer', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, COACH_EMAIL);
    await open(page, `${ledgerBills()}&bill=${billId}`);
    const bill = room(page);
    await expect(bill).toBeVisible({ timeout: 45_000 });

    await bill.getByRole('button', { name: /^Change installment/ }).first().click();
    const scope = page.getByRole('dialog').filter({ hasText: /this payment|this and the later|all unpaid/i }).first();
    await expect(scope).toBeVisible({ timeout: 30_000 });
    await expect(bill).toBeVisible();

    /* ⚠⚠ THE LAST-OPENED FLOOR ANSWERS A BARE KEY (`useDialogFloor`). With two floors armed and
       focus on <body>, an Escape used to reach BOTH — the question closed and the room closed
       underneath it. One layer at a time, or the coach loses the record they were reading. */
    await blurAll(page);
    await page.keyboard.press('Escape');
    await expect(scope).toBeHidden();
    await expect(bill).toBeVisible();
    /* ⚠ BLURRED AGAIN before the second press, deliberately: the subject of this test is the BARE
       key — the one an Escape with nothing focused answers — and after the question closes, focus
       restore lands back inside the room on its own schedule. Pressing while that is in flight
       tested the timing rather than the rule, and flaked once for exactly that reason. */
    await blurAll(page);
    await page.keyboard.press('Escape');
    await expect(bill).toBeHidden({ timeout: 15_000 });
  });

  test('a read-only money coach opens the same room and can change nothing in it', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, READ_EMAIL);
    await open(page, `${ledgerBills()}&bill=${billId}`);
    const bill = room(page);
    await expect(bill).toBeVisible({ timeout: 45_000 });

    /* ⚖ R5 — THIS STAYS THE ONE PLACE THEY CAN READ A BILL'S PAYEE AND TAGS. Before the fields
       block existed those lived behind Edit, the one door this account is refused, so they were
       unreadable anywhere in the product. Values, never controls. */
    await expect(bill.getByText('Payee', { exact: true })).toBeVisible();
    await expect(bill.getByText('Tags', { exact: true })).toBeVisible();
    await expect(bill.getByText('Details', { exact: true })).toBeVisible();

    // Not one write control, in the body or in the foot.
    for (const name of [/^Record$/, /^Change installment/, /^Remove installment/, /Add an installment/, /^Delete this bill$/, /^Remove the /]) {
      expect(await bill.getByRole('button', { name }).count(), `read-only: ${name}`).toBe(0);
    }
    expect(await bill.getByRole('textbox', { name: 'Bill name' }).count(), 'read-only: the title is not a field').toBe(0);
    expect(await bill.getByRole('textbox', { name: 'Notes' }).count(), 'read-only: the note is not a field').toBe(0);

    // The walk is a reading affordance and stays.
    await expect(bill.getByRole('navigation', { name: 'Other bills' })).toBeVisible();
  });
});
