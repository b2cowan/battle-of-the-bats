import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { readConnectedAdults } from '@/lib/family-home';
import { clubDay } from '@/lib/league-registration-state';
import { orgDayKey } from '@/lib/timezone';
import { SECOND_PARENT_WORDS } from '@/lib/league-second-parent';
import { FAMILY_HOME_PATH } from '@/lib/family-invitation-panel';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import LeaveButton from './LeaveButton';

/**
 * /family/children/[childId] — "Connected to {child}", under Manage (Signed-in family accounts Stage 4a, Part 6.2; drawing 5.1).
 * Both parents see the same list; neither can remove the other (ruling 7: a custody question for the club, not the product).
 * Each can leave. The second parent shows by address until they join (the sign-up holds no name for them).
 *
 * ⚠ Only for a child THIS account is connected to (404 otherwise, and while the guardian tier is off).
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Who’s connected',
  robots: { index: false, follow: false },
};

export default async function FamilyChildPage({ params }: { params: Promise<{ childId: string }> }) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const { childId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const read = await readConnectedAdults(user.id, childId);
  if (!read) notFound();
  const { child, club, adults, teamNames } = read;
  const day = (iso: string) => clubDay(orgDayKey(iso));
  const leaveBody = child.invitedAs === 'second_parent'
    ? W.leave.second(teamNames, child.firstName, club.name, SECOND_PARENT_WORDS.stop.button)
    : W.leave.first(teamNames, child.firstName, club.name);

  return (
    <div className={warm.warm}>
      <div className={styles.page}>
        <Link href={FAMILY_HOME_PATH} className={styles.backLink}>{W.manage.back}</Link>
        <h1 className={styles.pageTitle}>{W.manage.title(child.firstName)}</h1>
        <div className={styles.card} style={{ marginTop: '0.75rem' }}>
          {adults.map((a, i) => (
            <div key={`${a.label}-${i}`}>
              {i > 0 && <div className={styles.divider} />}
              <div className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{a.you ? W.manage.you(a.label) : a.label}</div>
                  <div className={styles.rowSub}>{a.state === 'joined' ? W.manage.joined(day(a.at)) : W.manage.invited(day(a.at))}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className={styles.notice}>{W.manage.change(club.name, club.contact)}</p>
        <div className={styles.buttonRow} style={{ marginTop: '1rem' }}>
          <LeaveButton childId={child.childId} childName={child.firstName} body={leaveBody} />
        </div>
      </div>
    </div>
  );
}
