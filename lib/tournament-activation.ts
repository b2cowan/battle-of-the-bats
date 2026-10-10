/**
 * WHAT ACTIVATE NEEDS — one rule, one home (Tournament admin redesign Stage 5, F82, 2026-10-10).
 *
 * Activate (and Reopen, any change to Active) is refused without dates, a division and a contact. Three places
 * ask the question, and before Stage 5 they read three copies of it: the set-status route (the refusal), the
 * event's record (what it says before a tap) and the dashboard route (the draft's checklist and its Ready to
 * activate card). The checklist's copy left the contact out, so a draft could read "ready" while Activate refused.
 * All three read this now, so the board shows Activate only when it can work.
 *
 * A contact is satisfied by a chosen contact member, the tournament's own contact email, OR the organization's
 * email (the three sources `resolveTournamentContactEmail` draws from). The rule asks that a contact EXISTS, not
 * that it is shown publicly: an organizer may hide it from the public site and still be reachable by coaches.
 *
 * Pure (no imports), so a plain Node unit test reads it.
 */

export type ActivationNeed = 'dates' | 'division' | 'contact';

export type ActivationFacts = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  divisionCount: number;
  defaultContactMemberId: string | null | undefined;
  contactEmail: string | null | undefined;
  orgContactEmail: string | null | undefined;
};

/** Where the event's contact comes from — the board's "Who teams can write to" row says which. */
export type ContactSource = 'member' | 'tournament' | 'org';

export function contactSourceOf(f: Pick<ActivationFacts, 'defaultContactMemberId' | 'contactEmail' | 'orgContactEmail'>): ContactSource | null {
  if (f.defaultContactMemberId) return 'member';
  if (f.contactEmail && f.contactEmail.trim()) return 'tournament';
  if (f.orgContactEmail && f.orgContactEmail.trim()) return 'org';
  return null;
}

/** What is still missing, in the order the record says it ("its dates, a division, and a contact"). Empty = it can activate. */
export function activationMissing(f: ActivationFacts): ActivationNeed[] {
  const missing: ActivationNeed[] = [];
  if (!f.startDate || !f.endDate) missing.push('dates');
  if (f.divisionCount < 1) missing.push('division');
  if (!contactSourceOf(f)) missing.push('contact');
  return missing;
}
