/**
 * WHAT THE CONFIRMATION EMAIL SAYS COMES NEXT (The first look, U6, ruled 2026-10-20 with `/marketing`'s read and the
 * owner's two calls). The email follows "Confirm your email to finish your account." with one sentence: a start door's
 * step 2, a registration the link connects the person to, or, for an account alone, Home when the link returns there
 * and "you're in" when it returns somewhere else (a tournament they followed, an invitation, a team claim) — so it
 * never promises Home to someone the link takes elsewhere. It names the step, never a typed team or organization.
 *
 * Framework-free: lib/email.ts builds the sentence into the email, lib/signup-verification.ts picks it.
 */
import { START_DOOR_PATH, type StartDoor } from './start-door';

export type VerificationNextStep = StartDoor | 'registration' | 'home' | 'onward';

export const VERIFICATION_NEXT_STEP: Record<VerificationNextStep, string> = {
  team: 'Then you’ll name your team.',
  league: 'Then you’ll name your league.',
  organization: 'Then you’ll name your organization and pick a plan.',
  premium: 'Then you’ll name your team and choose its sport.',
  registration: 'Then we’ll connect you to your team’s registration.',
  home: 'Then you’ll land on your Home page.',
  onward: 'Then you’re in.',
};

/** Home's address, and its old one (`/home` now redirects to it). */
const HOME_PATHS = ['/discover', '/home'];

/**
 * The step for a link that returns to `next` (a same-site path). The account's start door, but only when the link
 * really returns to that door's step 2: a resend from a sign-in that was headed somewhere else carries that page as its
 * `next` (verificationReturnPath lets the caller's `next` beat the door), and the email must name where the link goes
 * (`/review` 2026-10-20). Else a registration: the sender says so (the tournament registration form), or the join
 * page's return carries the registration; else Home or onward by where the link lands.
 */
export function verificationNextStep(p: {
  door?: StartDoor | null;
  next: string;
  registration?: boolean;
}): VerificationNextStep {
  // `next` is already a same-site path (safeNextPath), so a split is enough.
  const [path, query = ''] = p.next.split('#')[0].split('?');
  if (p.door && path === START_DOOR_PATH[p.door]) return p.door;
  if (p.registration || new URLSearchParams(query).has('registrationId')) return 'registration';
  return HOME_PATHS.includes(path) ? 'home' : 'onward';
}
