/**
 * Import this FIRST in a test that exercises the Sponsorships place itself (who opens it, what a nav lists, what a plan
 * carries). The place is held from customers until walk §560 passes (lib/sponsorships-open.ts), and the switch's test seam is
 * this global — never an environment variable. A test that imports this proves the feature with the switch ON; the held
 * state is proved by `sponsorships-switch-guard.test.ts`, which does not import it.
 */
(globalThis as { __SPONSORSHIPS_OPEN_FOR_TESTS__?: boolean }).__SPONSORSHIPS_OPEN_FOR_TESTS__ = true;
export {};
