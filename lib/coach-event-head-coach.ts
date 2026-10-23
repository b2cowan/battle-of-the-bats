import type { CoachCapabilities } from './coach-capabilities';
import { isValidEmail } from './auth-errors';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO MAY CHANGE AN EVENT'S HEAD COACH — one rule, two readers (Club Tier Stage 7d, Ask 10;
 * owner ruling 2026-10-22, Put to the owner 1 option (a)).
 *
 * The head coach's name and contact email on a tournament entry (`teams.coach`, `teams.coach_email`)
 * decide where the organizer sends acceptance, payment and schedule mail. Until 7d the save checked
 * no role: anyone the record opened for could rewrite it, including an assistant whose only grant
 * was schedule editing.
 *
 * The rule: the head coach, and anyone holding Register for tournaments (whoever may ENTER the team
 * is the organizer's contact for what they entered — the 2026-10-15 door ruling's reason). In a club
 * nobody holds that grant (`applyOrgGrantPolicy` writes it off — a club's entries are the club
 * admin's), so in a club it is the head coach alone. A free team has one signed-in member, who is
 * its head coach.
 *
 * ⚠ The staff LABEL is never the input (`staffKindLabel` — "Team manager" is a preset, not a role).
 * ⚠ The page (form or line) and the PATCH route (refuse) both read `canEditEventHeadCoach` over the
 *   one resolver `resolveEventHeadCoachAccess` (lib/coach-registration-access.ts), so the screen can
 *   never offer what the server refuses. `coach-event-head-coach.test.ts` pins both.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export type EventHeadCoachAccess =
  /** The user holds a coaching assignment on a rep team this entry belongs to — the assignment decides. */
  | { via: 'assignment'; capabilities: Pick<CoachCapabilities, 'isHeadCoach' | 'registerTournaments'> }
  /** No assignment; the user is a member of the free team the entry is linked to (a free team's owner). */
  | { via: 'membership' }
  | null;

export function canEditEventHeadCoach(access: EventHeadCoachAccess): boolean {
  if (!access) return false;
  if (access.via === 'membership') return true;
  return access.capabilities.isHeadCoach || access.capabilities.registerTournaments;
}

/** What the server says to a caller the rule refuses (the page shows the same person a line, never a form). */
export const EVENT_HEAD_COACH_REFUSED = 'Only the head coach can change who coaches at this event.';

/* ── The autosave's checks (Stage 7d; owner ruling 2026-10-22, Put to the owner 4 option (a)) ──────────
   The name and the email save separately, each only when it is worth sending: a blank name is NEVER
   sent (the field says so in place and the last saved name stays in effect — the route would refuse it
   anyway); a malformed email is never sent; a CLEARED email is a save (organizer mail reverts to the
   email the team registered with, as it always has). The route keeps every one of its own checks —
   these only stop the page from sending what it would refuse. */
export const HEAD_COACH_NAME_REQUIRED = 'Enter a head coach name.';
export const HEAD_COACH_EMAIL_INVALID = 'Enter a valid email address, or leave it blank.';

export type HeadCoachSave =
  | { kind: 'skip' }
  | { kind: 'invalid'; message: string }
  | { kind: 'send'; body: { coach: string } | { coachEmail: string | null } };

export function headCoachNameSave(raw: string, saved: string): HeadCoachSave {
  const name = raw.trim();
  if (!name) return { kind: 'invalid', message: HEAD_COACH_NAME_REQUIRED };
  if (name === saved.trim()) return { kind: 'skip' };
  return { kind: 'send', body: { coach: name } };
}

export function headCoachEmailSave(raw: string, saved: string | null): HeadCoachSave {
  const email = raw.trim().toLowerCase();
  if (email && !isValidEmail(email)) return { kind: 'invalid', message: HEAD_COACH_EMAIL_INVALID };
  if (email === (saved ?? '').trim().toLowerCase()) return { kind: 'skip' };
  return { kind: 'send', body: { coachEmail: email || null } };
}
