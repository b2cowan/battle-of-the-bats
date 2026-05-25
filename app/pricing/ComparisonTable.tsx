'use client';

import { useState, Fragment } from 'react';
import styles from './page.module.css';

// ─── Data ────────────────────────────────────────────────────────────────────

const COMPARISON_CATEGORIES = [
  {
    label: 'Tournaments & Scheduling',
    defaultOpen: true,
    rows: [
      { feature: 'Non-archived tournament slots', tournament: '1',        plus: 'Unlimited', league: 'Unlimited', club: 'Unlimited' },
      { feature: 'Tournament scheduling',        tournament: 'Manual',   plus: 'Manual + automated', league: 'Manual + automated', club: 'Manual + automated' },
      { feature: 'Playoff games / brackets',     tournament: 'Manual',   plus: 'Generator included', league: 'Generator included', club: 'Generator included' },
      { feature: 'Tournament archive flow',      tournament: 'Basic archive', plus: 'Sealed archives', league: 'Sealed archives', club: 'Sealed archives' },
      { feature: 'Venue management',              tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
      { feature: 'Score entry and standings',    tournament: '✓',        plus: '✓',         league: '✓',         club: '✓' },
    ],
  },
  {
    label: 'Registration Operations',
    defaultOpen: true,
    rows: [
      { feature: 'Team registration form',                   tournament: 'Standard fields',     plus: 'Custom fields + files', league: 'Custom fields + files', club: 'Custom fields + files' },
      { feature: 'Registration exports (Excel, CSV, PDF)',   tournament: '—',                   plus: 'Included',              league: 'Included',              club: 'Included' },
      { feature: 'Selected-row registration updates',        tournament: 'Included',            plus: 'Included',              league: 'Included',              club: 'Included' },
      { feature: 'Division capacity and waitlists',          tournament: 'Collection + review', plus: 'Promotion tools',       league: 'Promotion tools',       club: 'Promotion tools' },
      { feature: 'Payment and deposit tracking',             tournament: 'Basic tracking',      plus: 'Advanced reporting',    league: 'Advanced reporting',    club: 'Advanced reporting' },
    ],
  },
  {
    label: 'Data & Exports',
    defaultOpen: false,
    rows: [
      { feature: 'Schedule export (Excel, CSV, iCal)',        tournament: '✓', plus: '✓',       league: '✓',      club: '✓' },
      { feature: 'Results export (Excel, CSV)',               tournament: '✓', plus: '✓',       league: '✓',      club: '✓' },
      { feature: 'Registration exports (Excel, CSV, PDF)',    tournament: '—', plus: 'Included', league: 'Included', club: 'Included' },
      { feature: 'PDF reports with branded templates',        tournament: '—', plus: 'Included', league: 'Included', club: 'Included' },
      { feature: 'League registration and standings exports', tournament: '—', plus: '—',        league: 'Included', club: 'Included' },
      { feature: 'Rep team and accounting PDF reports',       tournament: '—', plus: '—',        league: '—',        club: 'Included' },
    ],
  },
  {
    label: 'Staff & Access',
    defaultOpen: false,
    rows: [
      { feature: 'Staff / admin seats',                   tournament: '3',       plus: '10',               league: '10',               club: 'Unlimited' },
      { feature: 'Officials seats',                       tournament: 'Counted', plus: 'Unlimited (free)', league: 'Unlimited (free)', club: 'Unlimited (free)' },
      { feature: 'Advanced member roles and permissions', tournament: '—',       plus: '—',                league: '✓',                club: '✓' },
    ],
  },
  {
    label: 'Communications',
    defaultOpen: false,
    rows: [
      { feature: 'Basic team/contact email',         tournament: '✓', plus: '✓',       league: '✓',  club: '✓' },
      { feature: 'Targeted tournament announcements', tournament: '—', plus: 'Included', league: 'Included', club: 'Included' },
      { feature: 'League-scoped communications',     tournament: '—', plus: '—',        league: '✓',  club: '✓' },
    ],
  },
  {
    label: 'Public Presence',
    defaultOpen: false,
    rows: [
      { feature: 'Tournament public branding',       tournament: 'FieldLogicHQ default', plus: 'Full control', league: 'Full control', club: 'Full control' },
      { feature: 'Powered by FieldLogicHQ badge',    tournament: 'Shown',                plus: 'Not shown',    league: 'Not shown',    club: 'Not shown' },
      { feature: 'Public organization page',         tournament: '—',                    plus: '—',            league: '✓',            club: '✓' },
      { feature: 'Branded tournament listing',       tournament: '—',                    plus: '—',            league: '✓',            club: '✓' },
    ],
  },
  {
    label: 'House League',
    defaultOpen: false,
    rows: [
      { feature: 'House League module',            tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'Player registration workflows',  tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'Season and division management', tournament: '—', plus: '—', league: '✓', club: '✓' },
      { feature: 'League scheduling and standings', tournament: '—', plus: '—', league: '✓', club: '✓' },
    ],
  },
  {
    label: 'Accounting',
    defaultOpen: false,
    rows: [
      { feature: 'Accounting module',      tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Organization ledger',    tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Team invoicing',         tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Payment reconciliation', tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Expense tracking',       tournament: '—', plus: '—', league: '—', club: '✓' },
    ],
  },
  {
    label: 'Rep Teams & Coaches Portal',
    defaultOpen: false,
    rows: [
      { feature: 'Rep Teams module',                          tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Tryout registration',                       tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Roster management',                         tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Player document management',                tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Coaches Portal accounts (3 included)',      tournament: '—', plus: '—', league: '—', club: '✓' },
      { feature: 'Additional Coaches Portal accounts',        tournament: '—', plus: '—', league: '—', club: '$19/mo each' },
      { feature: 'Team financial management',                 tournament: '—', plus: '—', league: '—', club: '✓' },
    ],
  },
  {
    label: 'Availability',
    defaultOpen: false,
    rows: [
      { feature: 'Self-serve signup',          tournament: 'Available now', plus: 'Available now', league: 'Coming soon', club: 'Coming soon' },
      { feature: 'Free trial',                 tournament: '—',             plus: '14 days',       league: 'Express interest', club: 'Express interest' },
      { feature: 'Payment details at signup',  tournament: '—',             plus: 'Yes',           league: 'Not yet',          club: 'Not yet' },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ComparisonTable() {
  const [openSet, setOpenSet] = useState<Set<string>>(
    () => new Set(COMPARISON_CATEGORIES.filter(c => c.defaultOpen).map(c => c.label))
  );

  function toggle(label: string) {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thFeature}>Feature</th>
            <th className={styles.th}>Tournament</th>
            <th className={styles.th}>Tournament Plus</th>
            <th className={styles.th}>League</th>
            <th className={`${styles.th} ${styles.thClub}`}>Club</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_CATEGORIES.map(cat => {
            const isOpen = openSet.has(cat.label);
            return (
              <Fragment key={cat.label}>
                {/* Category header row — clicking toggles rows */}
                <tr className={styles.catRow}>
                  <td colSpan={5}>
                    <button
                      className={styles.catToggle}
                      onClick={() => toggle(cat.label)}
                      aria-expanded={isOpen}
                    >
                      <svg
                        className={`${styles.catChevron} ${isOpen ? styles.catChevronOpen : ''}`}
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {cat.label}
                    </button>
                  </td>
                </tr>
                {/* Data rows — only rendered when open */}
                {isOpen && cat.rows.map(row => (
                  <tr key={row.feature} className={styles.dataRow}>
                    <td className={styles.tdFeature}>{row.feature}</td>
                    <td className={styles.td}>{row.tournament}</td>
                    <td className={styles.td}>{row.plus}</td>
                    <td className={styles.td}>{row.league}</td>
                    <td className={`${styles.td} ${styles.tdClub}`}>{row.club}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
