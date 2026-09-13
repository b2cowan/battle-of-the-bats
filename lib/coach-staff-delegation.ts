/**
 * ═══ THE CEILING — what a non-head holder of `manageStaff` may do on the Staff page ═══
 * (owner ruling 2026-09-13; plan `docs/projects/archive/COACH_STAFF_DELEGATION_PLAN.md` §2, §4)
 *
 * Staff management is a MASTER KEY: whoever can set other people's grants can reach anything on the
 * team one step removed — grant a friend money access, or invite a second account of their own with
 * everything on. The owner's ask ("can never do anything to any head coach permissions") protects the
 * head-coach rows; it does not close that. The rule that closes it is older and simpler:
 *
 *   **A delegate hands out only what they hold.**
 *
 *   D3  Everyday grants (schedule, attendance, lineups, development, staff chat, scouting book,
 *       documents) may be given freely — none of them is a data exposure, and a manager who holds no
 *       Attendance must still be able to give it, or the switch is useless to the person it is for.
 *       SENSITIVE grants (money, contacts & birthdates, internal notes, email families, tryouts) may
 *       be WIDENED only up to the actor's own level. Keeping or lowering anything is always allowed.
 *   D4  A head-coach row is untouchable (edit, remove, role), and roles are head-only both ways.
 *   D5  A delegate cannot edit their own row — without this D3 means nothing.
 *   D6  A delegate never CHANGES `manageStaff` — not on (no chain delegation) and not off (a head
 *       coach's decision about who manages staff is not a delegate's to undo; they may remove the
 *       person outright under D7, which is louder and confirmed). "Unchanged" rather than "off" is
 *       load-bearing: every save sends the WHOLE bundle, so a delegate editing a fellow manager's
 *       Attendance re-sends that manager's `manageStaff: true` — "must be off" refused every save
 *       on a fellow delegate's row (/review 2026-09-13, Critical), and a hand-built partial body
 *       could have knocked it off (/review, High).
 *   D8  A preset a delegate applies is CLAMPED to their level, not refused — the sheet never sends
 *       a bundle the server would refuse, and names each control it capped.
 *
 * Framework-free on purpose: the server (invite, member PATCH, pending-invite PATCH) and the sheet
 * both import this, so one definition of "may they?" serves both sides. A head-coach actor passes
 * everything here — the existing self-target refusal for head coaches lives in the route and is
 * unchanged.
 */
import type { AssistantCapabilityGrants, CoachCapabilities } from './coach-capabilities';

export type GrantKey = keyof Required<AssistantCapabilityGrants>;

/** The Sensitive group — the sheet's `SENSITIVE` controls, by key. Mirrors `CoachStaffSheet.tsx`. */
export const SENSITIVE_KEYS: ReadonlyArray<GrantKey> = ['money', 'rosterPii', 'notes', 'announcementsSend', 'tryouts', 'tournaments'];

/**
 * Any WIDENING counts, not just off→on — money read→write is the bigger of the two. Booleans are
 * 0/1; the three-way strings rank off < view/read < manage/write. (Moved here from the sheet so the
 * server and the sheet cannot disagree about what "wider" means.)
 */
const RANK: Record<string, number> = { off: 0, view: 1, read: 1, manage: 2, write: 2 };
export function rank(v: unknown): number {
  return typeof v === 'boolean' ? (v ? 1 : 0) : (RANK[String(v)] ?? 0);
}
export const isWidening = (from: unknown, to: unknown) => rank(to) > rank(from);

export type DelegationViolation = {
  key: GrantKey;
  reason: 'above_ceiling' | 'manage_staff';
};

/** The one sentence a refusal carries, per reason — shown under the control and returned by the API. */
export function delegationReasonSentence(v: DelegationViolation, labelOfKey: (k: GrantKey) => string): string {
  return v.reason === 'manage_staff'
    ? 'Only a head coach changes Manage staff.'
    : `You can’t hand out ${labelOfKey(v.key)} — you don’t hold it yourself.`;
}

/** The actor's own ceiling for a grant key — head coaches hold everything. */
function actorLevel(actor: CoachCapabilities, key: GrantKey): number {
  return rank((actor as unknown as Record<string, unknown>)[key]);
}

/**
 * null = allowed. `current` is null for a NEW invite (everything starts at off, so every ON is a
 * widening). Checks the first violation it meets, in Sensitive order, then `manageStaff`.
 *
 * A head-coach actor is never in violation (D3–D6 are about delegates).
 */
export function delegationViolation(
  actor: CoachCapabilities,
  current: Readonly<Required<AssistantCapabilityGrants>> | null,
  next: Readonly<Required<AssistantCapabilityGrants>>,
): DelegationViolation | null {
  if (actor.isHeadCoach) return null;
  for (const key of SENSITIVE_KEYS) {
    const from = current ? current[key] : undefined; // undefined ranks 0 = off
    const to = next[key];
    if (isWidening(from, to) && rank(to) > actorLevel(actor, key)) return { key, reason: 'above_ceiling' };
  }
  // D6 — a delegate's write leaves Manage staff exactly where a head coach put it (off for a new invite).
  if (next.manageStaff !== (current?.manageStaff ?? false)) return { key: 'manageStaff', reason: 'manage_staff' };
  return null;
}

/**
 * D8 — the same bundle with every violating key pulled down. A Sensitive key that would widen
 * past the actor's level is set to the HIGHER of (what the row already had, the actor's level) so
 * a preset never takes away something a head coach granted; `manageStaff` is put back to what the
 * row already had (off for a new invite). Returns the keys it touched so the sheet can say so.
 */
export function clampForDelegate(
  actor: CoachCapabilities,
  current: Readonly<Required<AssistantCapabilityGrants>> | null,
  next: Readonly<Required<AssistantCapabilityGrants>>,
): { grants: Required<AssistantCapabilityGrants>; clamped: GrantKey[] } {
  if (actor.isHeadCoach) return { grants: { ...next }, clamped: [] };
  const grants: Required<AssistantCapabilityGrants> = { ...next };
  const clamped: GrantKey[] = [];
  for (const key of SENSITIVE_KEYS) {
    const from = current ? current[key] : undefined;
    const to = next[key];
    const ceiling = actorLevel(actor, key);
    if (isWidening(from, to) && rank(to) > ceiling) {
      // Fall back to the row's current value if that is itself above the ceiling (keep, never widen).
      const keep = rank(from) >= ceiling ? from : (actor as unknown as Record<string, unknown>)[key];
      (grants as unknown as Record<string, unknown>)[key] = keep ?? (typeof to === 'boolean' ? false : 'off');
      clamped.push(key);
    }
  }
  const keepKey = current?.manageStaff ?? false;
  if (grants.manageStaff !== keepKey) { grants.manageStaff = keepKey; clamped.push('manageStaff'); }
  return { grants, clamped };
}

/**
 * D4 + D5 — which rows a NON-head actor may open for editing. Not consulted for a head coach (the
 * route's own self-target refusal covers them). A row the actor may not edit still opens, read-only,
 * with a sentence saying who can.
 */
export function delegateMayEditRow(
  actor: { userId: string; isHeadCoach: boolean },
  target: { userId: string; coachRole: 'head_coach' | 'assistant_coach' | string },
): boolean {
  if (actor.isHeadCoach) return target.userId !== actor.userId;
  if (target.coachRole === 'head_coach') return false;
  if (target.userId === actor.userId) return false;
  return true;
}

/**
 * The sheet's per-control question: may this actor set THIS key to THIS value on this row? Used
 * to lock individual options/switches (a seg control keeps its lower options live).
 */
export function delegateMaySet(
  actor: CoachCapabilities,
  key: GrantKey,
  currentValue: unknown,
  nextValue: unknown,
): boolean {
  if (actor.isHeadCoach) return true;
  if (key === 'manageStaff') return nextValue === currentValue;
  if (!SENSITIVE_KEYS.includes(key)) return true;
  if (!isWidening(currentValue, nextValue)) return true;
  return rank(nextValue) <= actorLevel(actor, key);
}
