/**
 * lib/tryout-contact-rules.ts — the head coach's tryout questions address, as pure rules (Club Tier Stage 4c-2 Part B;
 * words CLUB_TIER_STAGE4C2_COPY.md §H, §I, §K). The database side is `lib/coach-tryout-contact.ts`; tests in
 * `tests/unit/club-stage4c2b.test.ts`.
 */
import { checkEmail, looksPersonalEmail, BAD_EMAIL, type Checked } from './site-field-checks';
import { formatStoredDate, orgDayKey } from './timezone';

/** H3 — the field's hint. The nudge (H7) sits under it, never in its place (owner ruling 2026-10-22). */
export const TRYOUT_CONTACT_HINT =
  'Shown on your team’s tryout page, where anyone can read it. Use an inbox you’re happy to share, not the one you sign in with. It comes off when you stop being head coach.';
/** H8 — another head coach set it; the reader is a head coach too. */
export const ANOTHER_HEAD_SET_IT =
  'Any head coach can change or remove it. If you change it, it becomes yours and ends when your role does.';
/** H9 — an assistant with tryouts access. */
export const ONLY_A_HEAD_COACH_CHANGES = 'Only a head coach can change it.';

/**
 * The row's status line when NO coach address is live (H2, H2b, H10). The club's reset wins while it stands; the date
 * carries its year only when it is not this year. An assistant (H9) reads only where questions go: the invitation to
 * set one is a head coach's alone.
 */
export function tryoutContactUnsetLine(
  clubAddress: string | null,
  resetAt: string | null,
  nowIso = new Date().toISOString(),
  canChange = true,
): string {
  if (resetAt) {
    const sameYear = orgDayKey(resetAt).slice(0, 4) === orgDayKey(nowIso).slice(0, 4);
    const when = formatStoredDate(resetAt, { withYear: !sameYear });
    const where = clubAddress ? ` Questions go to ${clubAddress}.` : '';
    return `The club put its own address back on ${when}.${where}${canChange ? ' You can set your own again.' : ''}`;
  }
  if (!canChange) return clubAddress ? `They go to the club (${clubAddress}).` : 'The page shows no questions address yet.';
  return clubAddress
    ? `They go to the club (${clubAddress}). Add your own address for this team’s tryout page.`
    : 'The page shows no questions address yet. Add your own for this team’s tryout page.';
}

/** The row's status line while an address is live (H4, H8, H9). */
export function tryoutContactSetLine(email: string, setByYou: boolean, setByName: string | null): string {
  return setByYou || !setByName ? `${email} · on your tryout page` : `${email} · set by ${setByName}`;
}

/** H5 — the coach typed the address they sign in with. */
export const SIGN_IN_ADDRESS_REFUSAL = "That's the address you sign in with. Use a separate one, so your sign-in stays private.";
/** H6 — the shared check's words. */
export const NOT_AN_ADDRESS = BAD_EMAIL;
/** H14 — the route, for anyone who is not a head coach of the team. */
export const ONLY_HEAD_COACH_SETS = 'Only a head coach can set the tryout address.';
/** K8 — the club's reset, with no coach address to reset. */
export const NO_COACH_ADDRESS = 'No coach address is set on this page.';
/** E22 — the club's window showed an address the head coach has since changed. */
export const COACH_CHANGED_IT = 'The head coach changed the address since this page opened. Check it and try again.';
/** H7 — accepted, with the nudge; shown UNDER the hint (owner ruling 2026-10-22), quiet, never red. */
export const TRYOUT_ROLE_ADDRESS_NUDGE =
  'A role address such as tryouts@ keeps working when a volunteer changes. You can use this one if you prefer.';

/**
 * The address a head coach typed: trimmed, the shared site check, and never their sign-in address (compared trimmed,
 * ignoring case). Blank is refused here — removing is its own door.
 */
export function checkTryoutContactEmail(raw: unknown, signInEmail: string | null | undefined): Checked<string> {
  const checked = checkEmail(raw);
  if (!checked.ok) return checked;
  if (!checked.value) return { ok: false, error: NOT_AN_ADDRESS };
  if (signInEmail && checked.value.toLowerCase() === signInEmail.trim().toLowerCase()) {
    return { ok: false, error: SIGN_IN_ADDRESS_REFUSAL };
  }
  return { ok: true, value: checked.value };
}

/** The nudge under the hint, for a personal-looking address. Never a refusal. */
export function tryoutContactNudge(email: string | null | undefined): string | null {
  return looksPersonalEmail(email) ? TRYOUT_ROLE_ADDRESS_NUDGE : null;
}

export interface TryoutContactRow {
  email: string | null;
  setByMembershipId: string | null;
}

/** The setter's membership, as far as the rule needs it (a `TeamStaffMembership` fits). */
export interface TryoutContactSetter {
  id: string;
  teamId: string;
  coachRole: string;
  status: string;
}

/**
 * ⚠ THE SECOND HALF OF "IT ENDS WITH THE ROLE": the stored address counts only while the membership that set it is an
 * ACTIVE head_coach seat on THIS team. Removal and demotion also clear it in the write; this makes any path that missed
 * the clear (a race, a future writer) fail closed — back to the club's address.
 */
export function liveTryoutContactEmail(
  row: TryoutContactRow | null,
  setter: TryoutContactSetter | null,
  teamId: string,
): string | null {
  if (!row?.email || !row.setByMembershipId || !setter) return null;
  if (setter.id !== row.setByMembershipId) return null;
  if (setter.teamId !== teamId || setter.status !== 'active' || setter.coachRole !== 'head_coach') return null;
  return row.email;
}

/**
 * A person's name as a PUBLIC page may print it: trimmed, and never something shaped like an address (a club that typed
 * a coach's email as their name, or an account named by its address). Null means "leave the name out".
 */
export function publicPersonName(name: string | null | undefined): string | null {
  const v = name?.trim();
  return v && !v.includes('@') ? v : null;
}

/** Which tryout states carry the coach's line (Ask 3): open and not open yet. Finished and closed keep the club's. */
export function tryoutStateShowsCoachContact(state: string): boolean {
  return state === 'open' || state === 'notOpenYet';
}
