'use client';

import { useState } from 'react';
import Link from 'next/link';
import LinkRow from '../LinkRow';
import kit from '../console.module.css';
import styles from './email-templates.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  marketing:   'Marketing / Campaign',
  auth:        'Authentication',
  billing:     'Billing',
  tournament:  'Tournament',
  rep_teams:   'Rep teams',
  house_league: 'House league',
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
    <>
      {/* Category tabs */}
      <div className={kit.tabs} role="tablist" aria-label="Template categories">
        {categories.map(cat => {
          const count = grouped[cat]?.length ?? 0;
          const customised = grouped[cat]?.filter(t => t.is_customised).length ?? 0;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active === cat}
              className={`${kit.tab} ${active === cat ? kit.tabOn : ''}`}
              onClick={() => setActive(cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat}
              <span className={kit.tabCount}>{count}</span>
              {customised > 0 && <span className={styles.tabDot} title={`${customised} customised`} />}
            </button>
          );
        })}
      </div>

      {/* Legend — what the statuses mean */}
      <p className={kit.caption}>
        <span className={`${kit.chip} ${kit.chipQuiet}`}>Default</span>
        {' = using the original built-in copy.  '}
        <span className={`${kit.chip} ${kit.chipOk}`}>Customised</span>
        {' = you’ve saved an edited version that overrides it; “Reset to default” in the editor restores the original.'}
      </p>

      <div className={kit.card}>
        <div className={`${kit.tableWrap} table-cards`}>
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Key</th>
                <th>Status</th>
                <th aria-label="Edit"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <LinkRow key={t.key} href={`/platform-admin/email-templates/${t.key}`} className={kit.comfortable}>
                  <td className="table-cards-title">
                    <span className={styles.templateLabel}>{t.label}</span>
                    <span className={kit.sub}>{t.description}</span>
                  </td>
                  <td data-label="Key"><span className={`${kit.code} ${kit.nowrap}`}>{t.key}</span></td>
                  <td data-label="Status">
                    {t.is_customised ? (
                      <span className={`${kit.chip} ${kit.chipOk}`} title="You've saved an edited version that overrides the original.">Customised</span>
                    ) : (
                      <span className={`${kit.chip} ${kit.chipQuiet}`} title="Using the original built-in copy.">Default</span>
                    )}
                  </td>
                  <td className={`${kit.num} ${kit.nowrap}`}>
                    <Link href={`/platform-admin/email-templates/${t.key}`} className={kit.door}>
                      Edit →
                    </Link>
                  </td>
                </LinkRow>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className={kit.empty}>No templates in this category.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
