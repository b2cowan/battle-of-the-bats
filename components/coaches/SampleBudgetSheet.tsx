'use client';
import { useState } from 'react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './SampleBudgetSheet.module.css';

/**
 * Chunk G — the clearly-labelled sample budget (mockups artifact 77f5175e = binding;
 * owner decision D1: the sample carries numbers, but unmistakably ANOTHER TEAM'S).
 *
 * Riverdale 12U is invented, and so is every dollar. The content is a hardcoded
 * constant — no data rows, no API, nothing tenant-owned — so it is structurally
 * incapable of leaking into a real plan. There is deliberately NO affordance that
 * copies a figure anywhere: amounts render as plain text, and the only buttons in
 * this sheet are the two view tabs and the close controls. Visible to read-only
 * money assistants (it is education, not a write), so nothing here may be gated
 * on, or offer, write capability.
 *
 * Holds nothing typed → no discard guard (a confirmation with nothing to protect
 * is friction, not safety — Chunk A rule 4b).
 */

interface SampleLine {
  name: string;
  amount: number;
  /** Optional sub-note (the period-split example). */
  note?: string;
}

const SAMPLE_TEAM = 'Riverdale 12U';
const SAMPLE_PLAYERS = 14;

const SAMPLE_BUDGET: Array<{ category: string; lines: SampleLine[] }> = [
  {
    category: 'Tournaments',
    lines: [
      { name: 'Entry Fees', amount: 2340, note: 'split May / June / July — $780 each' },
      { name: 'Travel', amount: 1150 },
      { name: 'Uniforms', amount: 960 },
    ],
  },
  { category: 'Officials', lines: [{ name: 'Umpire Fees', amount: 1280 }] },
  { category: 'Training', lines: [{ name: 'Off-Season Training', amount: 780 }] },
  { category: 'Facilities', lines: [{ name: 'Dome Time', amount: 840 }] },
  { category: 'Events', lines: [{ name: 'Year-End Party', amount: 260 }] },
];

/** Mid-season snapshot, engineered to teach the three states: genuinely under,
 *  over (the teaching moment), and untouched. */
const SAMPLE_BVA: Array<{ name: string; budget: number; actual: number }> = [
  { name: 'Entry Fees', budget: 2340, actual: 1755 },
  { name: 'Travel', budget: 1150, actual: 640 },
  { name: 'Umpire Fees', budget: 1280, actual: 1410 },
  { name: 'Uniforms', budget: 960, actual: 985 },
  { name: 'Off-Season Training', budget: 780, actual: 780 },
  { name: 'Dome Time', budget: 840, actual: 0 },
];

const SAMPLE_TOTAL = SAMPLE_BUDGET.reduce((s, c) => s + c.lines.reduce((t, l) => t + l.amount, 0), 0);

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-CA');
  return n < 0 ? `-$${abs}` : `$${abs}`;
}

export type SampleTab = 'budget' | 'bva';

export default function SampleBudgetSheet({
  initialTab = 'budget',
  onClose,
}: {
  initialTab?: SampleTab;
  onClose: () => void;
}) {
  useOverlayOpen(true);
  const [tab, setTab] = useState<SampleTab>(initialTab);

  return (
    <div className={shared.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={`${shared.modal} ${shared.modalFlushFooter}`} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title="Sample season budget" onClose={onClose} />

        <div className={styles.fence} data-testid="sample-budget-fence">
          <p className={styles.fenceEyebrow}>Sample — a made-up team</p>
          <p className={styles.fenceTeam}>
            {SAMPLE_TEAM}
            <span className={styles.fenceTeamMeta}>
              {tab === 'budget' ? ` · ${SAMPLE_PLAYERS} players` : ' · in June — 3 of 4 tournaments paid'}
            </span>
          </p>
          <p className={styles.fenceDisclaimer}>
            Riverdale is invented and so is every dollar here. Real costs swing hard by region, age
            and level — copy the structure, never the numbers.
          </p>

          <div className={`${shared.segChoice} ${shared.segChoiceFull} ${styles.tabRow}`}>
            <button
              type="button"
              className={`${shared.segBtn} ${tab === 'budget' ? shared.segBtnActive : ''}`}
              onClick={() => setTab('budget')}
            >
              Season budget
            </button>
            <button
              type="button"
              className={`${shared.segBtn} ${tab === 'bva' ? shared.segBtnActive : ''}`}
              onClick={() => setTab('bva')}
            >
              Budget vs. actual
            </button>
          </div>

          {tab === 'budget' ? (
            <>
              {SAMPLE_BUDGET.map(group => (
                <div key={group.category}>
                  <p className={styles.cat}>{group.category}</p>
                  {group.lines.map(line => (
                    <div key={line.name}>
                      <div className={styles.row}>
                        <span className={styles.rowName}>{line.name}</span>
                        <span className={styles.rowAmt}>{fmt(line.amount)}</span>
                      </div>
                      {line.note && <p className={styles.rowNote}>↳ {line.note}</p>}
                    </div>
                  ))}
                </div>
              ))}
              <div className={styles.total}>
                <span>Riverdale&rsquo;s season</span>
                <span className={styles.totalAmt}>
                  {fmt(SAMPLE_TOTAL)} · {fmt(Math.round((SAMPLE_TOTAL / SAMPLE_PLAYERS) * 100) / 100)}/player
                </span>
              </div>
            </>
          ) : (
            <>
              {/* The real Budget-vs-Actual idiom: a comparison stays a grid, scrolls in its
                  own frame with the line pinned, and says so (Chunk A D1 / CoachScrollX). */}
              <CoachScrollX sticky frame={false} hint="Swipe to compare budget · actual · what's left">
                <div className={styles.bvaGrid}>
                  <div className={styles.bvaHead}>
                    <span className={`${shared.scrollXStickyCell} ${styles.bvaName}`}>Line</span>
                    <span className={styles.bvaCell}>Budget</span>
                    <span className={styles.bvaCell}>Actual</span>
                    <span className={styles.bvaCell}>Left</span>
                  </div>
                  {SAMPLE_BVA.map(row => {
                    const left = row.budget - row.actual;
                    return (
                      <div key={row.name} className={styles.bvaRow}>
                        <span className={`${shared.scrollXStickyCell} ${styles.bvaName}`}>{row.name}</span>
                        <span className={styles.bvaCell}>{fmt(row.budget)}</span>
                        <span className={`${styles.bvaCell} ${row.actual > row.budget ? styles.bvaOver : ''}`}>
                          {fmt(row.actual)}
                        </span>
                        <span className={`${styles.bvaCell} ${left < 0 ? styles.bvaOver : styles.bvaOk}`}>
                          {fmt(left)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CoachScrollX>
              <p className={styles.fenceDisclaimer} style={{ marginTop: '0.7rem', marginBottom: 0 }}>
                Umpire Fees has gone over on purpose — this is the report catching it in June, not
                in September.
              </p>
            </>
          )}
        </div>

        <div className={shared.modalFooter}>
          <button type="button" className={shared.btnGhost} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
