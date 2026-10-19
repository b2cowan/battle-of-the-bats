/**
 * WHAT ACTIVATE NEEDS — one rule, one home (Tournament admin redesign Stage 5, F82, 2026-10-10).
 *
 * Activate (and Reopen, any change to Active) is refused without dates and a division. Three places ask the
 * question, and before Stage 5 they read three copies of it: the set-status route (the refusal), the event's record
 * (what it says before a tap) and the dashboard route (the draft's checklist and its Ready to activate card). All
 * three read this now, so the board shows Activate only when it can work.
 *
 * The contact is never missing (owner ruling 2026-10-19). With nobody chosen, coach-facing email already falls back
 * to the organization's owner, and Event settings says "Defaults to the owner" over a dropdown whose blank choice is
 * labelled with the owner's name — yet this rule used to refuse that same tournament for "no contact", stranding an
 * organizer on a screen that said the contact was set. The owner is now the last source, so the board's "Who teams
 * can write to" row always says who, and Activate no longer asks for one.
 *
 * Pure (no imports), so a plain Node unit test reads it.
 */

export type ActivationNeed = 'dates' | 'division';

export type ActivationFacts = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  divisionCount: number;
};

export type ContactFacts = {
  defaultContactMemberId: string | null | undefined;
  contactEmail: string | null | undefined;
  orgContactEmail: string | null | undefined;
};

/** Where the event's contact comes from — the board's "Who teams can write to" row says which. */
export type ContactSource = 'member' | 'tournament' | 'org' | 'owner';

export function contactSourceOf(f: ContactFacts): ContactSource {
  if (f.defaultContactMemberId) return 'member';
  if (f.contactEmail && f.contactEmail.trim()) return 'tournament';
  if (f.orgContactEmail && f.orgContactEmail.trim()) return 'org';
  return 'owner';
}

/** What is still missing, in the order the record says it ("its dates and a division"). Empty = it can activate. */
export function activationMissing(f: ActivationFacts): ActivationNeed[] {
  const missing: ActivationNeed[] = [];
  if (!f.startDate || !f.endDate) missing.push('dates');
  if (f.divisionCount < 1) missing.push('division');
  return missing;
}
