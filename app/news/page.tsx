import { Megaphone, Star, Calendar } from 'lucide-react';
import { getAnnouncements, getTournaments } from '@/lib/db';
import { Announcement } from '@/lib/types';
import styles from './news.module.css';

export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const tournaments = await getTournaments();
  const activeTournament = tournaments.find(t => t.isActive);
  const announcements = await getAnnouncements(activeTournament?.id);

  function formatDate(d: string) {
    if (!d) return '';
    // Extract date part if ISO string, then add T12:00:00 to avoid timezone shift
    const datePart = d.includes('T') ? d.split('T')[0] : d;
    return new Date(datePart + 'T12:00:00').toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  const pinned = announcements.filter(a => a.pinned);
  const regular = announcements.filter(a => !a.pinned);

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><Megaphone size={12} /> News</span>
          <h1 className="display-lg">News & Announcements</h1>
          <p className="text-muted">Stay up to date with the latest tournament news, schedule changes, and announcements from the Milton Bats.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {announcements.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={48} />
              <p>No announcements yet. Check back soon!</p>
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
            <span className="badge badge-purple">
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
