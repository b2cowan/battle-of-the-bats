import { HttpError } from './http-error';
import { twoStepStepUrl } from './two-step-paths';
import type { TwoStepNeed } from './two-step-rule';

/**
 * The refusal a required seat gets when the session must type the code or set two-step up first (Board Ready · two-step
 * sign-in, Part 1). Thrown from deep in the shared sign-in helpers (getAuthContext, the platform context), so ~350 routes
 * and every page behind them need no line of their own — the billing rail's pattern (lib/http-error.ts).
 *
 *   - In a ROUTE, `withObservability` turns it into 401 `{ code: 'two_step_code' | 'two_step_set_up' }`.
 *   - In a PAGE or LAYOUT, it is also a Next redirect (it carries the redirect digest), so the person lands on the code
 *     step or the set-up step — never on an error screen (drawings tab 3 / tab 8).
 */

export const TWO_STEP_REFUSAL = {
  code: 'two_step_code',
  set_up: 'two_step_set_up',
} as const;

export class TwoStepRequiredError extends HttpError {
  readonly status = 401;
  readonly need: Exclude<TwoStepNeed, null>;
  readonly destination: string;
  /** Next's redirect contract (`NEXT_REDIRECT;replace;<url>;307;`): a page or layout that throws this redirects. */
  readonly digest: string;

  constructor(need: Exclude<TwoStepNeed, null>, next: string | null | undefined) {
    super(need === 'code' ? 'Two-step sign-in: type your code' : 'Two-step sign-in: set it up first');
    this.name = 'TwoStepRequiredError';
    this.need = need;
    // `why=required`: the set-up page opens on the club's "set it up to continue" screen when a club is the reason (Part 3).
    this.destination = twoStepStepUrl(need, next, need === 'set_up' ? { why: 'required' } : {});
    this.digest = `NEXT_REDIRECT;replace;${this.destination};307;`;
  }

  body() {
    return {
      error: this.need === 'code'
        ? 'Type the code from your authenticator app to continue.'
        : 'Set up two-step sign-in to continue.',
      code: TWO_STEP_REFUSAL[this.need],
      destination: this.destination,
    };
  }
}

export function isTwoStepRequiredError(err: unknown): err is TwoStepRequiredError {
  return err instanceof TwoStepRequiredError;
}
