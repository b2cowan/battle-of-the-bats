import Link from 'next/link';
import {
  RELEASE_ENTRIES,
  HORIZON_THEMES,
  CATEGORY_LABELS,
} from '@/lib/release-notes';
import { marketingMetadata } from '@/lib/marketing-metadata';
import kit from '@/components/marketing/MarketingKit.module.css';
import { cn } from '@/lib/utils';
import MarkReleasesSeen from '@/components/whats-new/MarkReleasesSeen';
import styles from './page.module.css';

export const metadata = marketingMetadata({
  title: 'What’s new',
  description:
    'See what’s new in FieldLogicHQ — recent improvements to tournaments, leagues, clubs, and the Coaches Portal, plus a look at what’s on the horizon.',
  path: '/changelog',
});

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

export default function ChangelogPage() {
  return (
    <main className={kit.page}>
      <MarkReleasesSeen />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>What’s new</p>
          <h1 className={kit.headline}>
            We’re always improving.<br />
            <span className={kit.accent}>Here’s what’s changed.</span>
          </h1>
          <p className={kit.lead}>
            FieldLogicHQ gets better every few weeks — from first registration to final standings.
            Here’s what’s new lately, and a look at what we’re building next.
          </p>
        </div>
      </section>

      {/* ── Shipped releases ─────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>The latest</p>
          <h2 className={kit.heading}>Recent updates</h2>

          <ol className={styles.timeline}>
            {RELEASE_ENTRIES.map(entry => (
              <li key={entry.date} className={styles.entry}>
                <div className={styles.entryMeta}>
                  <time className={styles.entryDate} dateTime={entry.date}>
                    {formatDate(entry.date)}
                  </time>
                  <h3 className={kit.subhead}>{entry.title}</h3>
                </div>
                <ul className={styles.highlights}>
                  {entry.highlights.map((h, i) => (
                    <li key={i} className={styles.highlight}>
                      <span className={cn(kit.tag, styles.tag)}>{CATEGORY_LABELS[h.category]}</span>
                      <span className={cn(kit.body, styles.highlightText)}>{h.text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── On the horizon ───────────────────────────────────────────────── */}
      <section className={kit.section}>
        <div className="container">
          <p className={kit.eyebrow}>On the horizon</p>
          <h2 className={kit.heading}>What we’re working on next</h2>
          <p className={cn(kit.lead, styles.horizonLead)}>
            A look at where we’re headed. These are directions, not dates — what we build next
            shifts as we learn from the organizers, coaches, and clubs we work with.
          </p>
          <div className={kit.grid3}>
            {HORIZON_THEMES.map(theme => (
              <div key={theme.title} className={kit.card}>
                <h3 className={kit.title}>{theme.title}</h3>
                <p className={kit.body}>{theme.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className={cn(kit.section, kit.band, kit.center)}>
        <div className="container">
          <h2 className={cn(kit.heading, styles.ctaTitle)}>
            Ready to run your season{' '}
            <span className={kit.accent}>on a real platform?</span>
          </h2>
          <div className={kit.row}>
            <Link href="/start" className={kit.btn}>
              Get started free
            </Link>
            <Link href="/pricing" className={cn(kit.btn, kit.btnSecondary)}>
              See pricing
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
