import Link from 'next/link';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';
import type { Organization } from '@/lib/types';
import styles from './SubscriptionEndedWall.module.css';

/**
 * The goodbye a cancelled organization sees on a surface it can no longer use.
 *
 * Owner ruling 2026-08-06: a cancelled subscription stops working immediately. The API rail
 * (lib/org-billing-access.ts) is what actually closes the door — this is the human half, so a
 * coach or a scorekeeper meets a sentence that explains itself instead of a wall of failed
 * fetches. "A link that dead-ends is the same bug wearing a politer face."
 *
 * Deliberately says nothing about price, plan or how to resubscribe: the people who hit this wall
 * (assistant coaches, scoring volunteers) are usually not the person who can fix it, and telling
 * them to go pay would be both useless and slightly insulting. It names who CAN fix it instead.
 * Nothing here is destructive — the data is retained and returns intact on resubscribe.
 */
export default function SubscriptionEndedWall({
  orgName,
  contactEmail,
  surface,
}: {
  orgName: string;
  contactEmail?: string | null;
  /** Shapes only the one sentence about what stopped — never the verdict. */
  surface: 'coaches' | 'scorekeeper' | 'check-in';
}) {
  const what =
    surface === 'coaches' ? 'The coaching tools for this club are closed for now.'
    : surface === 'scorekeeper' ? 'Score entry for this organization is closed for now.'
    : 'Check-in for this organization is closed for now.';

  return (
    <div className={styles.wall}>
      <h2>{orgName}&rsquo;s subscription has ended</h2>
      <p>{what} Nothing has been deleted — everything comes back if the subscription is renewed.</p>
      <p className={styles.detail}>
        {contactEmail ? (
          <>
            Questions?{' '}
            <a href={`mailto:${contactEmail}`} className={styles.emailLink}>{contactEmail}</a>
          </>
        ) : (
          <>An organization admin can restore access from their billing page.</>
        )}
      </p>
      <div className={styles.doors}>
        <Link href="/discover" className={styles.door}>Go to Home</Link>
      </div>
    </div>
  );
}

/**
 * The wall, or null — for a server layout that just needs to bail out early.
 *
 * Exists because the check + early return was byte-identical in the scorekeeper and check-in
 * layouts, and the ORDER matters: it must run BEFORE the capability wall, or a cancelled org's
 * volunteer is told "Access Denied" (wrong, and it sends them to their org admin over nothing)
 * instead of "the subscription ended". That rule lived only in a comment in two places; here it
 * lives in one function that the next day-of-volunteer surface can call.
 *
 * The coaches portal deliberately does NOT use this: it renders the same wall inside its own
 * portal chrome, so it calls `SubscriptionEndedWall` directly.
 */
export function suspendedOrgWall(
  org: Pick<Organization, 'subscriptionStatus' | 'name' | 'contactEmail'>,
  surface: 'coaches' | 'scorekeeper' | 'check-in',
) {
  if (!isOrgBillingSuspended(org)) return null;
  return (
    <SubscriptionEndedWall
      orgName={org.name}
      contactEmail={org.contactEmail}
      surface={surface}
    />
  );
}
