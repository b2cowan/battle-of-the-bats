import { test, expect } from '../helpers/fixtures';

test.describe('public pricing Team segment', () => {
  test('Team buyer path is visible and reaches Team signup', async ({ anonPage }) => {
    await anonPage.goto('/pricing');

    await expect(anonPage.getByRole('heading', { name: 'What are you managing?' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(anonPage.getByText('I run tournaments.')).toBeVisible();
    await expect(anonPage.getByText('I run a league or club.')).toBeVisible();
    await expect(anonPage.getByRole('link', { name: /Coach or team manager/ })).toBeVisible();
    await expect(anonPage.getByText('$290 CAD')).toBeVisible();
    await expect(anonPage.getByText('attendance, lineups, reminders')).toBeVisible();

    await anonPage.getByRole('link', { name: /Start Team workspace/i }).first().click();
    await expect(anonPage).toHaveURL(/\/team\?billing=annual/, { timeout: 30_000 });
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible();
    await expect(anonPage.getByText('$290 CAD / season')).toBeVisible();
    await expect(anonPage.getByText('Keep the team running after the tournament')).toBeVisible();
    await expect(anonPage.getByText('Create a free-tier round robin or exhibition weekend')).toBeVisible();

    await anonPage.goto('/team?billing=annual&source=registration_confirmation&orgSlug=demo-org&tournamentSlug=demo-tournament');
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(anonPage.getByText('$290 CAD / season')).toBeVisible();
  });
});
