/**
 * The inviter's club role, in the words the club's invite email uses — "Dana Whitfield, the club's
 * owner, invited you" (Club Tier Stage 2, specimen 6 frame 1; copy is /marketing's). Null leaves the
 * role out rather than guessing: a role the email cannot name honestly is not named.
 *
 * ⚠ PURE (unit-tested).
 */
export function clubRoleWords(role: string | null | undefined): string | null {
  if (role === 'owner') return 'the club’s owner';
  if (role === 'admin') return 'a club admin';
  return null;
}
