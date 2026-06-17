'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Compass, X } from 'lucide-react';
import styles from './ScopeShelf.module.css';

/**
 * Per-page feature-education strip for the FREE Coaches Portal (COACH_PORTAL_GROWTH_PLAN Phase 1).
 *
 * A QUIET upsell footnote anchored at the BOTTOM of a Tier-2 section page, below the coach's
 * working content — never a modal, never a gate, never top-of-page. It names what the paid
 * Coaches Portal Premium adds on THIS surface, always validates the free tool ("…is free
 * forever"), and offers a single "express interest" link (self-serve coach checkout is gated,
 * so we capture a lead, not sell).
 *
 * Dismiss mirrors CoachOverviewInvite: per-team, per-section localStorage via useSyncExternalStore
 * (hydration-safe, cross-tab). Dismissing does NOT erase discovery — it degrades to a single faint
 * "what this adds →" line. Only render this when the section has real content (the caller gates it).
 */

type Section = 'roster' | 'schedule' | 'fees' | 'announcements';

const COPY: Record<Section, { heading: string; bullets: string[]; free: string }> = {
  roster: {
    heading: 'Positions, attendance & game lineups',
    bullets: [
      'Track positions and availability for every player',
      'Take attendance at each practice and game',
      'Build batting orders and game-day lineups',
    ],
    free: 'Your free roster stays free — Coaches Portal Premium adds the game-day tools on top.',
  },
  schedule: {
    heading: 'Recurring events, attendance & calendar sync',
    bullets: [
      'Set repeating practices once instead of one at a time',
      'Take attendance straight from each event',
      "Sync your team schedule to your phone's calendar",
    ],
    free: 'Your free schedule stays free — Coaches Portal Premium adds the rest.',
  },
  fees: {
    heading: 'Dues automation & a full season budget',
    bullets: [
      'Installment schedules with due dates, tracked per player',
      'Overdue reminders sent by email — no chasing',
      'Budget vs. actual across the season, with expenses and fundraiser credits',
    ],
    free: 'This manual ledger is free forever — Coaches Portal Premium adds the automation.',
  },
  announcements: {
    heading: 'Scheduled sends & delivery tracking',
    bullets: [
      'Schedule announcements ahead of time',
      'Send dues and event reminders automatically',
      "See who's received each message",
    ],
    free: 'Your free announcements stay free — Coaches Portal Premium adds scheduling and tracking.',
  },
};

export default function ScopeShelf({ basicTeamId, section }: { basicTeamId: string; section: Section }) {
  const copy = COPY[section];
  const storageKey = `fl_coach_scope_shelf:${basicTeamId}:${section}`;
  const startHref = `/coaches/start?source=scope_shelf_${section}`;

  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener('storage', onChange);
      return () => window.removeEventListener('storage', onChange);
    },
    () => {
      try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
    },
    () => false, // server snapshot — never dismissed during SSR
  );

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey }));
    } catch { /* ignore */ }
  }

  if (dismissed) {
    return (
      <Link href={startHref} className={styles.faintLine}>
        <Compass size={13} aria-hidden />
        What Coaches Portal Premium adds here →
      </Link>
    );
  }

  return (
    <aside className={styles.shelf} aria-label="What Coaches Portal Premium adds here">
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={15} aria-hidden />
      </button>
      <p className={styles.eyebrow}>Coaches Portal Premium</p>
      <h3 className={styles.heading}>{copy.heading}</h3>
      <ul className={styles.bullets}>
        {copy.bullets.map(b => <li key={b}>{b}</li>)}
      </ul>
      <p className={styles.free}>{copy.free}</p>
      <Link href={startHref} className={`btn btn-ghost btn-sm ${styles.cta}`}>
        Express interest <ArrowUpRight size={14} aria-hidden />
      </Link>
    </aside>
  );
}
