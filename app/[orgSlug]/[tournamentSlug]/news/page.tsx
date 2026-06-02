import { cookies } from 'next/headers';
import Link from 'next/link';
import { Megaphone, Star, Calendar } from 'lucide-react';
import { getAnnouncements, getOrganizationBySlug, getPublicTournamentBySlug, getDivisions } from '@/lib/db';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Announcement } from '@/lib/types';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import styles from '../../news/news.module.css';

export const dynamic = 'force-dynamic';

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { view } = await searchParams;

  const cookieStore = await cookies();
  const prefName = cookieStore.get(`fl_agpref_${orgSlug}`)?.value ?? null;

  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  if (!tournament || !isPublicPageEnabled(tournament, 'news')) notFound();

  const [allAnnouncements, divisions] = await Promise.all([
    getAnnouncements(tournament.id, { admin: true }),
    tournament ? getDivisions(tournament.id, { admin: true }) : Promise.resolve([]),
  ]);

  const preferredGroup = prefName ? divisions.find(g => g.name === prefName) : null;
  const hasTaggedContent = allAnnouncements.some(a => a.divisionIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;

  const announcements = isFiltering
    ? allAnnouncements.filter(a => !a.divisionIds?.length || a.divisionIds.includes(preferredGroup!.id))
    : allAnnouncements;

  function formatDate(d: string) {
    if (!d) return '';
    const datePart = d.includes('T') ? d.split('T')[0] : d;
    return new Date(datePart + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  const pinned = announcements.filter(a => a.pinned);
  const regular = announcements.filter(a => !a.pinned);
  const contactEmail = tournament.contactEmail ?? org?.contactEmail ?? null;
  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const rulesHref = `/${orgSlug}/${tournamentSlug}/rules`;
  const showSchedulePage = isPublicPageEnabled(tournament, 'schedule');
  const showRulesPage = isPublicPageEnabled(tournament, 'rules');

  return (
    <div className="page-content">
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><Megaphone size={12} /> News</span>
          <h1>News & Announcements</h1>
          <p className="text-muted">Stay up to date with the latest tournament news, schedule changes, and announcements.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {hasTaggedContent && prefName && divisions.length > 0 && (
            <DivisionFilterBar
              orgSlug={orgSlug}
              divisions={divisions}
              activeName={prefName}
              isFiltering={isFiltering}
              viewAllHref={`/${orgSlug}/${tournamentSlug}/news?view=all`}
              backHref={`/${orgSlug}/${tournamentSlug}/news`}
            />
          )}

          {announcements.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={48} />
              <p>
                {isFiltering ? `No announcements for ${prefName}.` : 'No announcements yet. Check back soon.'}
                {contactEmail ? <> Questions? Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</> : null}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {isFiltering ? (
                  <Link href={`/${orgSlug}/${tournamentSlug}/news?view=all`} className="btn btn-ghost btn-sm">View All News</Link>
                ) : (
                  <Link href={homeHref} className="btn btn-ghost btn-sm">Tournament Home</Link>
                )}
                {showSchedulePage && <Link href={scheduleHref} className="btn btn-ghost btn-sm">View Schedule</Link>}
                {showRulesPage && <Link href={rulesHref} className="btn btn-ghost btn-sm">Tournament Rules</Link>}
              </div>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className={styles.pinnedSection}>
                  <div className={styles.sectionLabel}>
                    <Star size={13} fill="currentColor" /> Pinned Announcements
                  </div>
                  <div className={styles.annList}>
                    {pinned.map(ann => (
                      <AnnouncementCard key={ann.id} ann={ann} pinned formatDate={formatDate} />
                    ))}
                  </div>
                </div>
              )}

              {regular.length > 0 && (
                <div>
                  {pinned.length > 0 && (
                    <div className={styles.sectionLabel}>
                      <Calendar size={13} /> Recent Announcements
                    </div>
                  )}
                  <div className={styles.annList}>
                    {regular.map(ann => (
                      <AnnouncementCard key={ann.id} ann={ann} pinned={false} formatDate={formatDate} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AnnouncementCard({
  ann, pinned, formatDate,
}: {
  ann: Announcement;
  pinned: boolean;
  formatDate: (d: string) => string;
}) {
  return (
    <div className={`card ${styles.annCard} ${pinned ? styles.pinnedCard : ''}`}>
      <div className={styles.annHeader}>
        <div className={styles.annMeta}>
          {pinned && (
            <span className="badge badge-primary">
              <Star size={9} fill="currentColor" />&nbsp;Pinned
            </span>
          )}
          <span className={styles.annDate}>{formatDate(ann.date)}</span>
        </div>
      </div>

      <h2 className={styles.annTitle}>{ann.title}</h2>
      <p className={styles.annBody}>{ann.body}</p>
    </div>
  );
}
