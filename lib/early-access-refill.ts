/**
 * What a second form from a known address changes on the lead (Support console Stage 7 Part 8; the plan's "Frame J
 * rulings 2026-10-27", drawing J question 14 "as drawn"). Pure: both writers of a lead call it, so neither is a back
 * door — the public early-access form (`app/api/early-access/route.ts`) and a coach team's interest button
 * (`lib/basic-coach-interest.ts`).
 *
 * The rules:
 *   • A visitor's "yes" to release emails NEVER replaces a "no", on any lead. Only a person can turn it on.
 *   • A visitor's withdrawal (the box unticked) ALWAYS lands, on any lead, worked or not.
 *   • A lead staff have worked keeps every field as staff left it; the refill is only a dated entry on the timeline.
 *   • A lead nobody has worked takes the visitor's new words.
 *   • Where the lead arrived (its first page, its first tag, its first browser) never moves.
 * The caller answers a known address and an unknown one identically — nothing here is visible to the visitor.
 */

export type KnownLead = {
  internal_status: string | null;
  source: string | null;
  source_words: string | null;
  linked_at: string | null;
  converted_org_id: string | null;
  last_contacted_at: string | null;
  next_action: string | null;
  follow_up_due_at: string | null;
  release_notifications_consent: boolean | null;
};

/** Any step past New, a note, a source, a link, or a follow-up plan: a person has spent time on this lead. */
export function isWorkedLead(lead: KnownLead, hasNotes: boolean): boolean {
  return (
    hasNotes
    || (lead.internal_status ?? 'new') !== 'new'
    || !!lead.source || !!lead.source_words
    || !!lead.linked_at || !!lead.converted_org_id
    || !!lead.last_contacted_at
    || !!lead.next_action || !!lead.follow_up_due_at
  );
}

export type RefillIncoming = {
  name: string;
  organization_name: string;
  role: string | null;
  sports: string | null;
  plan_interest: string[];
  features_interested: string[];
  notes: string | null;
  heard_from: string | null;
  /** The box as the visitor left it; undefined when the form has no such box (the coach form), meaning "no statement". */
  consent: boolean | undefined;
};

export type RefillOutcome = {
  /** Fields to write on the lead, besides the form-activity fields (updated_at, last_submitted_at, submission_count). */
  patch: Record<string, unknown>;
  /** What the timeline keeps about this form. */
  entry: { their_words: string | null; heard_from: string | null; yes_not_applied: boolean; withdrew_consent: boolean };
};

export function decideRefill(lead: KnownLead, worked: boolean, incoming: RefillIncoming): RefillOutcome {
  const wasYes = lead.release_notifications_consent === true;
  const withdrew = wasYes && incoming.consent === false;
  const yesNotApplied = !wasYes && incoming.consent === true;

  const patch: Record<string, unknown> = {};
  if (withdrew) patch.release_notifications_consent = false;

  if (!worked) {
    // A blank box is not new words: it never wipes what the first form said.
    patch.name = incoming.name;
    patch.organization_name = incoming.organization_name;
    if (incoming.role) patch.role = incoming.role;
    if (incoming.sports) patch.sports = incoming.sports;
    patch.plan_interest = incoming.plan_interest;
    patch.features_interested = incoming.features_interested;
    if (incoming.notes) patch.notes = incoming.notes;
    if (incoming.heard_from) patch.heard_from = incoming.heard_from;
  }

  return {
    patch,
    entry: { their_words: incoming.notes, heard_from: incoming.heard_from, yes_not_applied: yesNotApplied, withdrew_consent: withdrew },
  };
}
