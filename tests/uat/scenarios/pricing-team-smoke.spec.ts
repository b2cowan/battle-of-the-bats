import { test, expect } from '../helpers/fixtures';

test.describe('public pricing Team segment', () => {
  test('Team buyer path is visible and reaches Team signup', async ({ anonPage }) => {
    await anonPage.goto('/pricing');

    await expect(anonPage.getByRole('heading', { name: 'What does your role look like?' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(anonPage.getByText('I run tournaments.')).toBeVisible();
    await expect(anonPage.getByText('I run a house league season.')).toBeVisible();
    await expect(anonPage.getByText('I run a club with rep teams.')).toBeVisible();
    await expect(anonPage.getByRole('button', { name: /Coach or team manager/ })).toBeVisible();
    await expect(anonPage.getByText('$29 CAD')).toBeVisible();

    await anonPage.goto('/coaches/start?billing=annual');
    await expect(anonPage).toHaveURL(/\/coaches\/start\?billing=annual/, { timeout: 30_000 });
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible();
    await expect(anonPage.getByText('$290 CAD / season')).toBeVisible();
    await expect(anonPage.getByText('Keep the team running after the tournament')).toBeVisible();
    await expect(anonPage.getByText('Create a free-tier round robin or exhibition weekend')).toBeVisible();

    await anonPage.goto('/coaches/start?billing=annual&source=registration_confirmation&orgSlug=demo-org&tournamentSlug=demo-tournament');
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(anonPage.getByText('$290 CAD / season')).toBeVisible();
  });
});
