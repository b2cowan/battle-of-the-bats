import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signInHrefFor } from '../../lib/consumer-routes';

/**
 * Sign In from a registration page comes back to the form (a coach signing in mid-registration lost
 * it, 2026-10-13); from anywhere else it stays bare, so sign-in keeps dropping a one-workspace person
 * straight into their workspace.
 */

const back = (path: string) => `/auth/login?next=${encodeURIComponent(path)}`;

describe('signInHrefFor', () => {
  it('returns to every public registration page', () => {
    for (const path of [
      '/milton-softball/battle-of-the-bats-2027/register',
      '/milton-softball/register',
      '/milton-softball/league/2027-house/register',
      '/milton-softball/teams/u13-purple/tryouts/register',
      '/milton-softball/teams/u13-purple/tryouts/2027/register',
    ]) {
      assert.equal(signInHrefFor(path), back(path), path);
    }
  });

  it('stays bare on every other public page', () => {
    for (const path of [
      '/milton-softball/battle-of-the-bats-2027',
      '/milton-softball/battle-of-the-bats-2027/schedule',
      '/milton-softball',
      '/milton-softball/league/2027-house',
      '/discover',
      '/',
    ]) {
      assert.equal(signInHrefFor(path), '/auth/login', path);
    }
  });

  it('never carries an operator page, even one that ends in register', () => {
    assert.equal(signInHrefFor('/milton-softball/admin/tournaments/preview/battle-of-the-bats-2027/register'), '/auth/login');
  });

  it('ignores a top-level route that is not an org', () => {
    assert.equal(signInHrefFor('/auth/register'), '/auth/login');
  });
});
