'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import styles from './help.module.css';

export interface HelpHubCard {
  title: string;
  desc: string;
  href: string;
  category: string;
  audience: string;
  badge?: string;
  keywords?: string[];
  featured?: boolean;
}

export interface HelpHubQuickLink {
  label: string;
  href: string;
  category?: string;
  keywords?: string[];
}

export interface HelpHubRolePathStep {
  label: string;
  href: string;
}

export interface HelpHubRolePath {
  title: string;
  audience: string;
  desc: string;
  steps: HelpHubRolePathStep[];
  badge?: string;
  keywords?: string[];
}

interface HelpHubClientProps {
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  cards: HelpHubCard[];
  quickLinks?: HelpHubQuickLink[];
  rolePaths?: HelpHubRolePath[];
}

function searchable(parts: Array<string | string[] | undefined>) {
  return parts
    .flatMap(part => Array.isArray(part) ? part : [part])
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesQuery(parts: Array<string | string[] | undefined>, query: string) {
  if (!query) return true;
  return searchable(parts).includes(query);
}

export default function HelpHubClient({
  title,
  subtitle,
  searchPlaceholder = 'Search help...',
  cards,
  quickLinks = [],
  rolePaths = [],
}: HelpHubClientProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filteredCards = useMemo(() => cards.filter(card => matchesQuery([
    card.title,
    card.desc,
    card.category,
    card.audience,
    card.badge,
    card.keywords,
  ], normalizedQuery)), [cards, normalizedQuery]);

  const filteredQuickLinks = useMemo(() => quickLinks.filter(link => matchesQuery([
    link.label,
    link.category,
    link.keywords,
  ], normalizedQuery)), [normalizedQuery, quickLinks]);

  const filteredRolePaths = useMemo(() => rolePaths.filter(path => matchesQuery([
    path.title,
    path.audience,
    path.desc,
    path.badge,
    path.keywords,
    path.steps.map(step => step.label),
  ], normalizedQuery)), [normalizedQuery, rolePaths]);

  const groupedCards = useMemo(() => {
    const groups = new Map<string, HelpHubCard[]>();
    filteredCards.forEach(card => {
      const group = groups.get(card.category) ?? [];
      group.push(card);
      groups.set(card.category, group);
    });
    return [...groups.entries()];
  }, [filteredCards]);

  const featuredCards = !normalizedQuery
    ? cards.filter(card => card.featured).slice(0, 3)
    : [];
  const hasResults = filteredCards.length > 0 || filteredQuickLinks.length > 0 || filteredRolePaths.length > 0;

  return (
    <div className={styles.helpHub}>
      <div className={styles.helpHubHeader}>
        <h1 className={styles.helpHubTitle}>{title}</h1>
        <p className={styles.helpHubSubtitle}>{subtitle}</p>
      </div>

      <section className={styles.helpHubSearchPanel} aria-label="Help search">
        <div className={styles.helpSearchBox}>
          <Search size={16} className={styles.helpSearchIcon} />
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
        {normalizedQuery && (
          <p className={styles.helpSearchMeta}>
            {hasResults
              ? `${filteredRolePaths.length} role path${filteredRolePaths.length === 1 ? '' : 's'}, ${filteredCards.length} guide${filteredCards.length === 1 ? '' : 's'}, and ${filteredQuickLinks.length} task${filteredQuickLinks.length === 1 ? '' : 's'} found`
              : 'No matching help found. Try a broader term like password, registration, schedule, billing, module, or export.'}
          </p>
        )}
      </section>

      {featuredCards.length > 0 && (
        <section className={styles.helpHubFeatured} aria-label="Recommended guides">
          <h2 className={styles.helpUtilityTitle}>Start Here</h2>
          <div className={styles.helpHubFeaturedGrid}>
            {featuredCards.map(card => (
              <Link key={card.href} href={card.href} className={styles.helpHubFeaturedCard}>
                <span>{card.category}</span>
                <strong>{card.title}</strong>
                <em>{card.desc}</em>
              </Link>
            ))}
          </div>
        </section>
      )}

      {filteredRolePaths.length > 0 && (
        <section className={styles.helpHubRolePaths} aria-label="Getting started by role">
          <h2 className={styles.helpUtilityTitle}>{normalizedQuery ? 'Matching Role Paths' : 'Getting Started By Role'}</h2>
          <div className={styles.helpHubRolePathGrid}>
            {filteredRolePaths.map(path => (
              <article key={path.title} className={styles.helpHubRolePathCard}>
                <div className={styles.helpHubCardMeta}>
                  <span>{path.audience}</span>
                  {path.badge && <em>{path.badge}</em>}
                </div>
                <h3>{path.title}</h3>
                <p>{path.desc}</p>
                <ol>
                  {path.steps.map(step => (
                    <li key={`${path.title}-${step.href}-${step.label}`}>
                      <Link href={step.href}>{step.label}</Link>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>
      )}

      {filteredQuickLinks.length > 0 && (
        <section className={styles.helpHubTasks} aria-label="Common help tasks">
          <h2 className={styles.helpUtilityTitle}>{normalizedQuery ? 'Matching Tasks' : 'How Do I...'}</h2>
          <div className={styles.helpHubTaskGrid}>
            {filteredQuickLinks.map(link => (
              <Link key={`${link.href}-${link.label}`} href={link.href} className={styles.helpHubTaskLink}>
                <span>{link.label}</span>
                {link.category && <em>{link.category}</em>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!hasResults && (
        <div className={styles.helpEmptyResults}>
          <p className={styles.emptyStateTitle}>No matching help found</p>
          <p className={styles.emptyStateSub}>Try a broader term or browse the guide groups below after clearing search.</p>
        </div>
      )}

      {groupedCards.map(([category, groupCards]) => (
        <section key={category} className={styles.helpHubGroup} aria-labelledby={`help-hub-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
          <div className={styles.helpHubGroupHeader}>
            <h2 id={`help-hub-${category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>{category}</h2>
            <span>{groupCards.length} guide{groupCards.length === 1 ? '' : 's'}</span>
          </div>
          <div className={styles.helpHubGrid}>
            {groupCards.map(card => (
              <Link key={card.href} href={card.href} className={styles.helpHubCard}>
                <div className={styles.helpHubCardMeta}>
                  <span>{card.audience}</span>
                  {card.badge && <em>{card.badge}</em>}
                </div>
                <p className={styles.helpHubCardTitle}>{card.title}</p>
                <p className={styles.helpHubCardDesc}>{card.desc}</p>
                <span className={styles.helpHubCardLink}>Read guide</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
