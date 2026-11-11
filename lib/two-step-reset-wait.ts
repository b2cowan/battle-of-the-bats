/**
 * THE 24 HOURS a support reset of someone's two-step waits after they confirm it (Board Ready · two-step sign-in, Part 3;
 * tab 7). Plain, with no server client, so the test can read the rule. lib/two-step-support-reset.ts uses it.
 */
const HOUR_MS = 3_600_000;
export const RESET_WAIT_MS = 24 * HOUR_MS;

/**
 * The wait. On DEV only, `TWO_STEP_RESET_WAIT_MINUTES` shortens it so the walk can see a reset run (ruled: "with the wait
 * shortened by a dev-only setting"). A production build never honours it, nor does the production project.
 */
const PROD_SUPABASE_REF = 'qcttcboqysynwcdyghil';
export function resetWaitMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number((env.TWO_STEP_RESET_WAIT_MINUTES ?? '').trim());
  if (!Number.isFinite(raw) || raw <= 0) return RESET_WAIT_MS;
  if (env.NODE_ENV === 'production') return RESET_WAIT_MS;
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!url || url.includes(PROD_SUPABASE_REF)) return RESET_WAIT_MS;
  return Math.min(raw * 60_000, RESET_WAIT_MS);
}
