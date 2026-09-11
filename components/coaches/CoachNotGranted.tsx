import type { ReactNode } from 'react';
import CoachEmptyState from './CoachEmptyState';

/**
 * "This section isn't turned on for you" — the ONE block a coach meets on a page their grants do
 * not cover, so eleven pages cannot each phrase the refusal differently.
 *
 * ⚠ Why a shared block (staff access review, 2026-09-10). Every page that reasoned in terms of a
 * capability already said this correctly (Lineups, Practice, Tryouts, Settings). Every page that
 * reasoned "the API will refuse it" rendered the refusal as something else: the roster said "Your
 * roster is empty" beside an Export button, Documents said "No document templates yet", Money
 * offered a Retry that could only fail again, the team board printed raw error text. Each taught
 * the reader something untrue about the team's data. A refused read is a permission fact with a
 * remedy worth printing, and this is the sentence that prints it.
 *
 * Renders the `quiet` empty-state variant — no lime wash, no CTA — because there is nothing on the
 * page the reader can act on (house rule 2026-07-31: the trigger is the absence of a CTA).
 */
export default function CoachNotGranted({
  icon,
  section,
  plural = false,
  what,
  payoff,
  blocker,
}: {
  icon: ReactNode;
  /** The section's own name, as the nav says it — "Roster", "Documents", "Money", "Insights". */
  section: string;
  /** "Documents aren't" rather than "Documents isn't". */
  plural?: boolean;
  /** One sentence on what the section is, so the reader knows what they would be asking for. */
  what: ReactNode;
  payoff?: ReactNode;
  /** Defaults to asking the head coach for this section by name; pass the honest sentence when
   *  the door follows a different grant (the roster opens on any team duty, not on "roster"). */
  blocker?: ReactNode;
}) {
  return (
    <CoachEmptyState
      quiet
      icon={icon}
      headline={`${section} ${plural ? 'aren’t' : 'isn’t'} turned on for you`}
      description={what}
      payoff={payoff}
      blocker={blocker ?? `Ask your head coach to turn on ${section.toLowerCase()} access for you.`}
    />
  );
}
