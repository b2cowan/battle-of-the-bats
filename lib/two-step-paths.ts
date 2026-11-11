import { safeNextPath } from './safe-redirect';

/**
 * The two places a two-step sign-in sends a person (client-safe; the server's refusal in lib/two-step-gate.ts and the
 * browser's hand-off in lib/auth.ts both build their links here, so the two can never disagree).
 *
 *   - the CODE STEP is a state of the one shared sign-in page (drawings tab 3): /auth/login?step=code
 *   - the SET-UP STEP is the sign-in page's own column, after the password (tab 2): /auth/two-step
 */
export const TWO_STEP_CODE_STEP_PATH = '/auth/login';
export const TWO_STEP_SET_UP_PATH = '/auth/two-step';

export function twoStepStepUrl(
  need: 'code' | 'set_up',
  next: string | null | undefined,
  extra: Record<string, string> = {},
): string {
  const safe = safeNextPath(next ?? null, null);
  const params = new URLSearchParams(extra);
  if (need === 'code') params.set('step', 'code');
  if (safe) params.set('next', safe);
  const qs = params.toString();
  return `${need === 'code' ? TWO_STEP_CODE_STEP_PATH : TWO_STEP_SET_UP_PATH}${qs ? `?${qs}` : ''}`;
}
