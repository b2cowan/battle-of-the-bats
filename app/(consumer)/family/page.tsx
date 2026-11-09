import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from './family.module.css';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { readFamilyHome } from '@/lib/family-home';
import { familyFeedUrl } from '@/lib/family-calendar';
import { canonicalAppOrigin } from '@/lib/app-origin';
import { scheduleDayLabel, scheduleRowTitle, scheduleTimeLabel } from '@/lib/family-schedule-format';
import { FAMILY_HOME_WORDS as W, nameList } from '@/lib/family-home-words';
import FamilyCalendarCard from './_parts/FamilyCalendarCard';
import { SignupRow } from './_parts/FamilyRows';

/**
 * /family — "Your family" (Signed-in family accounts Stage 4a, Part 6.1; drawing 3.3, 3.4 and 5.3). The list, shown when the
 * parent has more than one team OR NONE right now; with exactly one team (and nothing else to say) it opens that team's page
 * (carrying the one-time `?joined=1`). Siblings on one team share a card; one sign-up appears once; the calendar row lives
 * here for a family with several teams, because it covers every team. A child connected with no team right now says so; a
 * child the club removed this account from gets one line in words that take no side (no email was sent).
 *
 * ⚠ 404 while the guardian tier is off. Never indexed, never cached.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your family',
  robots: { index: false, follow: false },
};

export default async function FamilyHomePage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const { joined } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className={warm.warm}>
        <div className={styles.page}>
          <div className={styles.card}>
            <h1 className={styles.joinTitle}>{W.family.signInTitle}</h1>
            <p className={styles.joinLede}>{W.family.signInBody}</p>
            <div className={styles.actions}>
              <Link href={`/auth/login?next=${encodeURIComponent('/family')}`} className={styles.chip}>{W.family.signIn}</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const home = await readFamilyHome(user.id);
  const noTeamChildren = home.children.filter(c => !home.teams.some(t => t.childIds.includes(c.childId)));

  // Exactly one team and nothing else to say: "Your family" opens that team (drawing 3.3's rule).
  if (home.teams.length === 1 && noTeamChildren.length === 0 && home.removed.length === 0) {
    redirect(`${home.teams[0].href}${joined === '1' ? '?joined=1' : ''}`);
  }

  const calendarUrl = home.children.length ? await familyFeedUrl(user.id, canonicalAppOrigin()) : null;
  const clubLine = [...new Set(home.clubs.filter(c => home.children.some(ch => ch.orgId === c.orgId)).map(c => c.name))].join(' · ');

  return (
    <div className={warm.warm}>
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{W.family.title}</h1>
        {clubLine && <p className={styles.pageSub}>{clubLine}</p>}

        {home.removed.map(r => (
          <div key={r.childId} className={styles.removedNote} role="status">
            <p>{W.family.removed(r.firstName, r.club.name, r.club.contact)}</p>
          </div>
        ))}

        {home.teams.map(t => (
          <div key={`${t.kind}:${t.teamId}`} className={styles.card}>
            <Link href={t.href} className={`${styles.row} ${styles.rowAnchor}`}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{t.kind === 'league' && t.divisionName ? `${t.teamName} · ${t.divisionName}` : t.teamName}</div>
                <div className={styles.rowSub}>{nameList(t.children)}</div>
              </div>
              <span className={styles.rowLink}>{W.family.open}</span>
            </Link>
            {t.nextUp && (
              <div className={styles.upNext}>
                <div className={styles.upNextLabel}>{W.family.upNext}</div>
                <div className={styles.upNextLine}>
                  {[scheduleRowTitle(t.nextUp, t.teamName), scheduleDayLabel(t.nextUp.startsAt), scheduleTimeLabel(t.nextUp.startsAt)].join(' · ')}
                </div>
                {(t.nextUp.location || t.nextUp.fieldNumber) && (
                  <div className={styles.rowSub}>{[t.nextUp.location, t.nextUp.fieldNumber].filter(Boolean).join(', ')}</div>
                )}
              </div>
            )}
          </div>
        ))}

        {noTeamChildren.map(c => (
          <div key={c.childId} className={styles.card}>
            <div className={styles.playerBand}>
              <span className={styles.playerMark} aria-hidden>{c.firstName.charAt(0).toUpperCase()}</span>
              <div className={styles.rowMain}>
                <div className={styles.playerName}>{c.firstName}</div>
                <div className={styles.rowSub}>{W.family.noTeam}</div>
              </div>
            </div>
          </div>
        ))}

        {home.children.length > 0 && <FamilyCalendarCard initialUrl={calendarUrl} />}

        {home.signups.map(s => <SignupRow key={s.registrationId} row={s} />)}

        {home.children.length === 0 && home.removed.length === 0 && (
          <div className={styles.card}>
            <h2 className={styles.joinTitle}>{W.family.emptyTitle}</h2>
            <p className={styles.joinLede}>{W.family.emptyBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}
