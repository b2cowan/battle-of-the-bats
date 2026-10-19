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
    // Live state (coach checkout gate OPEN, the shipped reality since 2026-07-24): the coach
    // segment is a link into the coach start flow, and the Premium Coaches Portal is a full plan
    // card in the grid. The old assertions pinned the GATED presentation (an express-interest
    // button + the "$29 CAD" callout strip) and went stale the day the gate opened.
    await expect(anonPage.getByRole('link', { name: /Coach or team manager/ })).toBeVisible();
    await expect(anonPage.getByText('Premium Coaches Portal', { exact: true }).first()).toBeVisible();

    await anonPage.goto('/coaches/start?billing=annual');
    await expect(anonPage).toHaveURL(/\/coaches\/start\?billing=annual/, { timeout: 30_000 });
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible();
    // Account first (Account-First Sign-up Part 3, 2026-10-19): signed out, the card is step 1 — the account alone. The
    // team, the sport and the plan (where "Seasonal" and "$290 CAD" live) are step 2, after the email link; the
    // ?billing= choice rides on the account to it. So no billing buttons here, signed out.
    await expect(anonPage.getByRole('heading', { name: 'Create your Coaches Portal' })).toBeVisible();
    await expect(anonPage.getByRole('list', { name: 'Sign-up steps' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Create account' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: /Seasonal/ })).toHaveCount(0);
    await expect(anonPage.getByText('Keep the team running after the tournament')).toBeVisible();
    await expect(anonPage.getByText('Host an invite-only round robin or exhibition weekend')).toBeVisible();

    await anonPage.goto('/coaches/start?billing=annual&source=registration_confirmation&orgSlug=demo-org&tournamentSlug=demo-tournament');
    await expect(anonPage.getByRole('heading', { name: 'From tournament weekend to season workspace.' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(anonPage.getByRole('button', { name: 'Create account' })).toBeVisible();
  });
});
