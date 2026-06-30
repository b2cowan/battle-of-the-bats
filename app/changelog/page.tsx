import Link from 'next/link';
import type { Metadata } from 'next';
import {
  RELEASE_ENTRIES,
  HORIZON_THEMES,
  CATEGORY_LABELS,
  type ReleaseCategory,
} from '@/lib/release-notes';
import MarkReleasesSeen from '@/components/whats-new/MarkReleasesSeen';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'What’s New — FieldLogicHQ',
  description:
    'See what’s new in FieldLogicHQ — recent improvements to tournaments, leagues, clubs, and the Coaches Portal, plus a look at what’s on the horizon.',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Format an ISO YYYY-MM-DD without timezone drift. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const CATEGORY_CLASS: Record<ReleaseCategory, string> = {
  new: styles.tagNew,
  improved: styles.tagImproved,
  fixed: styles.tagFixed,
};

export default function ChangelogPage() {
  return (
    <main className="bg-pitch-black min-h-screen">
      <MarkReleasesSeen />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>What’s new</p>
          <h1 className={styles.heroTitle}>
            We’re always improving.<br />
            <span className={styles.heroAccent}>Here’s what’s changed.</span>
          </h1>
          <p className={styles.heroSub}>
            FieldLogicHQ gets better every few weeks — from first registration to final standings.
            Here’s what’s new lately, and a look at what we’re building next.
          </p>
        </div>
      </section>

      {/* ── Shipped releases ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className="container">
          <p className={styles.sectionEyebrow}>The latest</p>
          <h2 className={styles.sectionTitle}>Recent updates</h2>

          <ol className={styles.timeline}>
            {RELEASE_ENTRIES.map(entry => (
              <li key={entry.date} className={styles.entry}>
                <div className={styles.entryMeta}>
                  <time className={styles.entryDate} dateTime={entry.date}>
                    {formatDate(entry.date)}
                  </time>
                  <p className={styles.entryTitle}>{entry.title}</p>
                </div>
                <ul className={styles.highlights}>
                  {entry.highlights.map((h, i) => (
                    <li key={i} className={styles.highlight}>
                      <span className={`${styles.tag} ${CATEGORY_CLASS[h.category]}`}>
                        {CATEGORY_LABELS[h.category]}
                      </span>
                      <span className={styles.highlightText}>{h.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── On the horizon ───────────────────────────────────────────────── */}
      <section className={styles.horizonSection}>
        <div className="container">
          <p className={styles.sectionEyebrow}>On the horizon</p>
          <h2 className={styles.sectionTitle}>What we’re working on next</h2>
          <p className={styles.sectionSub}>
            A look at where we’re headed. These are directions, not dates — what we build next
            shifts as we learn from the organizers, coaches, and clubs we work with.
          </p>
          <div className={styles.horizonGrid}>
            {HORIZON_THEMES.map(theme => (
              <div key={theme.title} className={styles.horizonCard}>
                <p className={styles.horizonCardTitle}>{theme.title}</p>
                <p className={styles.horizonCardBody}>{theme.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <h2 className={styles.ctaTitle}>
            Ready to run your season{' '}
            <span className={styles.ctaAccent}>on a real platform?</span>
          </h2>
          <div className={styles.ctaActions}>
            <Link
              href="/start"
              className="font-mono text-sm font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors border-0"
            >
              Get started free →
            </Link>
            <Link
              href="/pricing"
              className="font-mono text-sm uppercase tracking-widest text-data-gray border border-blueprint-blue/40 px-8 py-4 hover:border-blueprint-blue hover:text-fl-text transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
