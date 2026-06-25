'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
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
  rolePaths?: HelpHubRolePath[];
}

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
  rolePaths = [],
}: HelpHubClientProps) {
  const [query, setQuery] = useState('');
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

        <p className={styles.helpHubGateNote}>
          You see the guides your plan and role include &mdash; e.g. Accounting and Rep Teams appear only for orgs with those modules.
        </p>
      </section>

      {/* ── "New to FieldLogicHQ?" disclosure ─────────────────────────── */}
      {rolePaths.length > 0 && (
        <details className={styles.helpHubNewHere}>
          <summary className={styles.helpHubNewHereSummary}>
            <span className={styles.helpHubNewHereCaret} aria-hidden="true">&#9654;</span>{' '}
            New to FieldLogicHQ?
            <span className={styles.helpHubNewHereHint}>Getting-started paths by role</span>
          </summary>
          <div className={styles.helpHubRolePaths}>
            {rolePaths.map(path => (
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
        </details>
      )}
    </div>
  );
}
