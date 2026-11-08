'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import WhatsNewHelpLink from '@/components/whats-new/WhatsNewHelpLink';
import styles from './help.module.css';

export interface HelpHubCard {
  title: string;
  desc: string;
  href: string;
  topicCount: number;
  keywords?: string[];
}

export interface HelpHubRolePathStep {
  label: string;
  href: string;
}

export interface HelpHubRolePath {
  title: string;
  steps: HelpHubRolePathStep[];
}

interface HelpHubClientProps {
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  cards: HelpHubCard[];
  /**
   * The reader's OWN first-day path (Club Tier Stage 13b B4, F-A1-9). When given, "New to FieldLogicHQ?" opens on it
   * and `rolePaths` (the other roles') fold away under `otherPathsLabel`; without it, every path sits folded as before.
   */
  ownRolePath?: HelpHubRolePath | null;
  rolePaths?: HelpHubRolePath[];
  /** The fold's name for the other roles' paths (only shown beside an own path). */
  otherPathsLabel?: string;
  /** The line under the guides saying what decides which guides show; each hub says its own. */
  gateNote?: string;
}

function FoldSummary({ children }: { children: ReactNode }) {
  return (
    <summary className={styles.helpHubNewHereSummary}>
      <span className={styles.helpHubNewHereCaret} aria-hidden="true">&#9654;</span>{' '}
      {children}
    </summary>
  );
}

function RolePathGrid({ paths }: { paths: HelpHubRolePath[] }) {
  return (
    <div className={styles.helpHubRolePaths}>
      {paths.map(path => (
        <div key={path.title} className={styles.helpHubRolePath}>
          <h3 className={styles.helpHubRolePathTitle}>{path.title}</h3>
          <ol className={styles.helpHubRolePathList}>
            {path.steps.map(step => (
              <li key={`${path.title}-${step.href}`}>
                <Link href={step.href}>{step.label}</Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

const HELP_HUB_FIRST_DAY_WORDS = {
  heading: 'New to FieldLogicHQ?',
  allPaths: 'First steps by role',
  ownPath: 'Your first steps',
} as const;

function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query);
}

function cardHaystack(card: HelpHubCard): string {
  return [card.title, card.desc, ...(card.keywords ?? [])].join(' ').toLowerCase();
}

export default function HelpHubClient({
  title,
  subtitle,
  searchPlaceholder = 'Search all help — e.g. schedule, registration, payments, exports…',
  cards,
  ownRolePath = null,
  rolePaths = [],
  otherPathsLabel,
  // No default: a hub that filters nothing (platform admin's) says nothing, rather than claiming a filter it lacks.
  gateNote,
}: HelpHubClientProps) {
  const [query, setQuery] = useState('');
  // With an own path, it is shown open and the rest fold under it; without one, every path shows, folded, as before.
  const shown = ownRolePath ? [ownRolePath] : rolePaths;
  const folded = ownRolePath ? rolePaths : [];
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCards = useMemo(
    () => cards.filter(card => matchesQuery(cardHaystack(card), normalizedQuery)),
    [cards, normalizedQuery],
  );

  return (
    <div className={styles.helpHub}>
      <div className={styles.helpHubHeader}>
        <h1 className={styles.helpHubTitle}>{title}</h1>
        <p className={styles.helpHubSubtitle}>{subtitle}</p>
        <WhatsNewHelpLink />
      </div>

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className={styles.helpHubSearchPanel} role="search" aria-label="Help search">
        <div className={styles.helpSearchBox}>
          <Search size={16} className={styles.helpSearchIcon} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className={styles.helpSearchInput}
            aria-label="Search help"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className={styles.helpSearchClear}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Guide cards grid ───────────────────────────────────────────── */}
      <section aria-label="Guides">
        <div className={styles.helpHubSectionLabel} aria-hidden="true">
          <span>Guides</span>
          <div className={styles.helpHubSectionRule} />
        </div>

        {filteredCards.length > 0 ? (
          <div className={styles.helpHubGrid}>
            {filteredCards.map(card => (
              <Link key={card.href} href={card.href} className={styles.helpHubCard}>
                <p className={styles.helpHubCardTitle}>{card.title}</p>
                <p className={styles.helpHubCardDesc}>{card.desc}</p>
                <div className={styles.helpHubCardFoot}>
                  <span className={styles.helpHubCardCount}>{card.topicCount} topics</span>
                  <span className={styles.helpHubCardRead}>Read guide &rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.helpHubEmpty}>
            No guides match that &mdash; try a broader term.
          </p>
        )}

        {gateNote && <p className={styles.helpHubGateNote}>{gateNote}</p>}
      </section>

      {/* ── "New to FieldLogicHQ?" disclosure ─────────────────────────── */}
      {/* `open` only on the first render's value: React rewrites it only when the prop changes, so the reader's toggle holds. */}
      {shown.length > 0 && (
        <details className={styles.helpHubNewHere} open={!!ownRolePath}>
          <FoldSummary>
            {HELP_HUB_FIRST_DAY_WORDS.heading}
            <span className={styles.helpHubNewHereHint}>
              {ownRolePath ? HELP_HUB_FIRST_DAY_WORDS.ownPath : HELP_HUB_FIRST_DAY_WORDS.allPaths}
            </span>
          </FoldSummary>
          <RolePathGrid paths={shown} />
          {folded.length > 0 && otherPathsLabel && (
            <details className={styles.helpHubOtherPaths}>
              <FoldSummary>{otherPathsLabel}</FoldSummary>
              <RolePathGrid paths={folded} />
            </details>
          )}
        </details>
      )}
    </div>
  );
}
