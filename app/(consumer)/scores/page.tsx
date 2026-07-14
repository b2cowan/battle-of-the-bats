import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectoryListings, DIRECTORY_MAX_LIMIT } from '@/lib/directory';
import styles from '@/components/consumer/ConsumerPage.module.css';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fieldlogichq.ca';

// Server-render live listings so search engines and first paint get real content.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live Scores',
  description:
    'Tournaments live right now across the FieldLogicHQ community — jump straight to live scores, schedules, and standings.',
  alternates: { canonical: `${SITE_URL}/scores` },
  openGraph: {
    title: 'Live Scores | FieldLogicHQ',
    description: 'Tournaments live right now across the FieldLogicHQ community.',
    url: `${SITE_URL}/scores`,
    type: 'website',
  },
};

export default async function ScoresPage() {
  const live = await getDirectoryListings({ timeframe: 'live', limit: DIRECTORY_MAX_LIMIT, offset: 0 });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Scores</h1>
        <p className={styles.subtitle}>
          Live right now across FieldLogicHQ. Tap an event for live scores, schedule, and standings.
        </p>
      </div>

      {live.items.length > 0 ? (
        <>
          <p className={styles.sectionLabel}>Live now</p>
          <div className={styles.list}>
            {live.items.map((t) => (
              <Link key={t.id} href={t.href} className={styles.card}>
                {t.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logoUrl} alt="" className={styles.cardLogo} />
                ) : (
                  <span className={styles.cardLogoFallback} aria-hidden>
                    {t.tournamentName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className={styles.cardBody}>
                  <span className={styles.cardName}>{t.tournamentName}</span>
                  <span className={styles.cardMeta}>{t.orgName} · {t.sportLabel}</span>
                </span>
                <span className={styles.livePill}><span className={styles.liveDot} />Live</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No games are live right now</p>
          <p className={styles.emptyText}>
            When a tournament in the directory is underway, its live events show up here.
          </p>
          <Link href="/discover" className={styles.cta}>Browse tournaments →</Link>
        </div>
      )}
    </div>
  );
}
