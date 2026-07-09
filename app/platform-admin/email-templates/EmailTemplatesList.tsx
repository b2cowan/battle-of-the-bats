'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './email-templates.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  marketing:   'Marketing / Campaign',
  auth:        'Authentication',
  billing:     'Billing',
  tournament:  'Tournament',
  rep_teams:   'Rep Teams',
  house_league: 'House League',
  system:      'System',
};

const CATEGORY_ORDER = ['marketing', 'auth', 'billing', 'tournament', 'rep_teams', 'house_league', 'system'];

export type TemplateRow = {
  key: string;
  label: string;
  description: string;
  category: string;
  is_customised: boolean;
};

export default function EmailTemplatesList({ templates }: { templates: TemplateRow[] }) {
  // Group by category, preserving CATEGORY_ORDER; unknown categories go last.
  const grouped: Record<string, TemplateRow[]> = {};
  for (const t of templates) (grouped[t.category] ??= []).push(t);
  const categories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  const [active, setActive] = useState(categories[0] ?? 'marketing');
  const rows = grouped[active] ?? [];

  return (
    <div>
      {/* Category tabs */}
      <div className={styles.tabBar} role="tablist" aria-label="Template categories">
        {categories.map(cat => {
          const count = grouped[cat]?.length ?? 0;
          const customised = grouped[cat]?.filter(t => t.is_customised).length ?? 0;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={active === cat}
              className={`${styles.tab} ${active === cat ? styles.tabActive : ''}`}
              onClick={() => setActive(cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat}
              <span className={styles.tabCount}>{count}</span>
              {customised > 0 && <span className={styles.tabDot} title={`${customised} customised`} />}
            </button>
          );
        })}
      </div>

      {/* Legend — what the statuses mean */}
      <p className={styles.legend}>
        <span className={styles.badgeDefault}>Default</span>
        {' = using the original built-in copy.  '}
        <span className={styles.badgeCustomised}>Customised</span>
        {' = you’ve saved an edited version that overrides it; “Reset to default” in the editor restores the original.'}
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Template</th>
            <th>Key</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.key}>
              <td>
                <div className={styles.templateLabel}>{t.label}</div>
                <div className={styles.templateDesc}>{t.description}</div>
              </td>
              <td><span className={styles.keyChip}>{t.key}</span></td>
              <td>
                {t.is_customised ? (
                  <span className={styles.badgeCustomised} title="You've saved an edited version that overrides the original.">Customised</span>
                ) : (
                  <span className={styles.badgeDefault} title="Using the original built-in copy.">Default</span>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                <Link href={`/platform-admin/email-templates/${t.key}`} className={styles.editBtn}>
                  Edit →
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--data-gray)' }}>No templates in this category.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
