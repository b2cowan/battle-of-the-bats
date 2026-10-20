import AccountOnlySignup from './AccountOnlySignup';

/**
 * /auth/signup?account=1 — the account-only sign-up (fans, the follow nudge, "I was invited").
 *
 * Every other visit is an old link to Run a tournament's step 1, which lives at /start/tournament since its intro page
 * folded into it (The first look, Ask 6, 2026-10-19). next.config.ts forwards those before any render, carrying the
 * pricing page's plan and billing, so a link printed or bookmarked before the move keeps working.
 */
export default function SignupPage() {
  return <AccountOnlySignup />;
}
