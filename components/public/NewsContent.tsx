import { Megaphone, Star, Calendar } from 'lucide-react';
import type { Announcement, Division } from '@/lib/types';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import styles from '@/app/[orgSlug]/news/news.module.css';

type NewsContentProps = {
  orgSlug: string;
  tournamentSlug: string;
  pageEnabled: boolean;
  announcements: Announcement[];
  divisions: Division[];
  /** Visitor's saved division preference (cookie). Null in the admin preview. */
  prefName: string | null;
  /** `?view=all` escape hatch from the division filter. */
  view?: string;
  contactEmail: string | null;
};

function formatDate(d: string) {
  if (!d) return '';
  const datePart = d.includes('T') ? d.split('T')[0] : d;
  return new Date(datePart + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function AnnouncementCard({
  ann, pinned,
}: {
  ann: Announcement;
  pinned: boolean;
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

/**
 * Shared News & Announcements renderer used by BOTH the live public route
 * (app/[orgSlug]/[tournamentSlug]/news) and the admin tournament preview, so the
 * two render identically. Pure/presentational — callers fetch the data.
 */
export default function NewsContent({
  orgSlug,
  tournamentSlug,
  pageEnabled,
  announcements: allAnnouncements,
  divisions,
  prefName,
  view,
  contactEmail,
}: NewsContentProps) {
  if (!pageEnabled) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Megaphone size={40} />}
              eyebrow="News"
              title="News unavailable"
              description="The organizer has hidden public announcements for this tournament."
              contactEmail={contactEmail}
            />
          </div>
        </div>
      </div>
    );
  }

  const preferredGroup = prefName ? divisions.find(g => g.name === prefName) : null;
  const hasTaggedContent = allAnnouncements.some(a => a.divisionIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;

  const announcements = isFiltering
    ? allAnnouncements.filter(a => !a.divisionIds?.length || a.divisionIds.includes(preferredGroup!.id))
    : allAnnouncements;

  const pinned = announcements.filter(a => a.pinned);
  const regular = announcements.filter(a => !a.pinned);

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
            <PublicTournamentState
              icon={<Megaphone size={40} />}
              eyebrow="News"
              title={isFiltering ? `No announcements for ${prefName}` : 'No announcements yet'}
              description={
                isFiltering
                  ? 'There are no announcements tagged to this division.'
                  : 'Tournament announcements will appear here when the organizer posts them.'
              }
              contactEmail={contactEmail}
              actions={isFiltering ? [{ href: `/${orgSlug}/${tournamentSlug}/news?view=all`, label: 'View All News', variant: 'ghost' as const }] : []}
            />
          ) : (
            <>
              {pinned.length > 0 && (
                <div className={styles.pinnedSection}>
                  <div className={styles.sectionLabel}>
                    <Star size={13} fill="currentColor" /> Pinned Announcements
                  </div>
                  <div className={styles.annList}>
                    {pinned.map(ann => (
                      <AnnouncementCard key={ann.id} ann={ann} pinned />
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
                      <AnnouncementCard key={ann.id} ann={ann} pinned={false} />
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
