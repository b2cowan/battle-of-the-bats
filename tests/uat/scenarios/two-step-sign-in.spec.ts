/**
 * UAT Suite: Two-step sign-in — the code step (Board Ready, Part 1; drawings tab 3 and tab 9).
 *
 * The dedicated two-step account (auth.setup gives it a password and a known authenticator key each run) signs in through
 * the real sign-in page, so the code step is tested on purpose every run:
 *   - the password alone lands on "Enter your code", and the server refuses that half-signed-in session;
 *   - a wrong code shows the red notice and stays;
 *   - the right code signs in;
 *   - a backup code signs in, says how many are left, and "I still have it, continue" goes on.
 */
import { test, expect } from '../helpers/fixtures';
import { UAT_TWO_STEP_EMAIL, freshTotpCode, twoStepKeyFor } from '../helpers/two-step';
import { createBackupCodes } from '../../../lib/two-step-codes';
import { findAuthUserByEmail } from '../../../lib/auth-account-lookup';

test.describe.configure({ mode: 'serial' });

async function passwordStep(page: import('@playwright/test').Page) {
  const { password } = twoStepKeyFor(UAT_TWO_STEP_EMAIL);
  await page.goto('/auth/login');
  await page.locator('#login-email').fill(UAT_TWO_STEP_EMAIL);
  await page.locator('#login-password').fill(password!);
  await page.locator('#login-submit').click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(`Signing in as ${UAT_TWO_STEP_EMAIL}`)).toBeVisible();
}

test.describe('Two-step sign-in / the code step', () => {
  test('the password alone is not a sign-in; a wrong code stays; the right code signs in', async ({ anonPage }) => {
    await passwordStep(anonPage);

    // The half-signed-in session: the server says so, and a signed-in-only route refuses it.
    const status = await (await anonPage.request.get('/api/auth/two-step/status')).json();
    expect(status).toMatchObject({ signedIn: true, hasFactor: true, passed: false });
    expect((await anonPage.request.get('/api/me/role-summary')).status()).toBe(401);

    await anonPage.locator('#two-step-code').fill('000000');
    await anonPage.locator('#two-step-submit').click();
    await expect(anonPage.getByText('That code didn’t work.')).toBeVisible({ timeout: 10_000 });
    await expect(anonPage).toHaveURL(/\/auth\/login/);

    await anonPage.locator('#two-step-code').fill(await freshTotpCode(twoStepKeyFor(UAT_TWO_STEP_EMAIL).secret));
    await anonPage.locator('#two-step-submit').click();
    await expect(anonPage).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    const after = await (await anonPage.request.get('/api/auth/two-step/status')).json();
    expect(after).toMatchObject({ signedIn: true, hasFactor: true, passed: true });
  });

  test('a backup code signs in once, and says how many are left', async ({ anonPage }) => {
    const user = await findAuthUserByEmail(UAT_TWO_STEP_EMAIL);
    const codes = await createBackupCodes(user!.id);
    await passwordStep(anonPage);

    await anonPage.getByRole('button', { name: 'Use a backup code' }).click();
    await anonPage.locator('#two-step-backup').fill(codes[0]);
    await anonPage.locator('#two-step-backup-submit').click();
    await expect(anonPage.getByRole('heading', { name: 'You’re in' })).toBeVisible({ timeout: 10_000 });
    await expect(anonPage.getByText('You have 9 backup codes left.')).toBeVisible();

    await anonPage.locator('#two-step-continue').click();
    await expect(anonPage).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
    const after = await (await anonPage.request.get('/api/auth/two-step/status')).json();
    expect(after).toMatchObject({ passed: true, viaBackupCode: true, backupCodesLeft: 9 });
  });
});
