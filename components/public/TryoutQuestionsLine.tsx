'use client';
import { ContactCopyRow } from './ClubContactCard';
import styles from './TryoutPage.module.css';

/**
 * The OPEN tryout page's questions line (Club Tier Stage 4c-2 Part B, Ask 3 / Ask 13 D3; words CLUB_TIER_STAGE4C2_COPY.md
 * §I): what to ask about and whom, then the address with Copy — built like the status card's Copy and Directions (a
 * labelled button at a desk, the bare symbol in a 44 px box on a phone). Used ONLY by the team's own tryout page:
 * `ClubContactLine` stays the club's line on the About page and the club's Tryouts page, which never carry a coach's
 * address (`tests/unit/club-stage4c2b-guard.test.ts`).
 */
export default function TryoutQuestionsLine({ lead, email, copyLabel }: { lead: string; email: string | null; copyLabel: string }) {
  if (!email) return null;
  return (
    <div className={styles.qline}>
      <span>{lead}</span>
      <ContactCopyRow email={email} copyLabel={copyLabel} />
    </div>
  );
}
