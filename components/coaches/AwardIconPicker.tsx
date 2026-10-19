'use client';
import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell from '@/components/coaches/QuestionShell';

// Curated sport/achievement set (Coach Tags & Player Awards Phase 2 — owner caught in mockup
// review that a bare text field for an emoji is a bad ask on desktop). "Type your own" stays
// as a fallback for anything outside the set.
const AWARD_ICON_LIBRARY = [
  '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
  '💪', '🔥', '⚡', '🎯', '👑', '💯',
  '⚾', '🥎', '🧤', '🛡️', '🏃', '🦾',
  '🌟', '⭐', '✅', '🙌', '👏', '🚀',
  '🎉', '🐐', '💎', '🎗️',
];

/**
 * Choose an icon — layers on top of the award-type manager or the give-award form, and opens in the club admin's
 * shared library too.
 *
 * ⚖ THE ONE WINDOW (One Window Stage 2c, owner ruling B5, 2026-10-19): a form that fills a phone (it was a small centred
 * card) and keeps the keyboard inside; it moved with Give an award, which it opens over (a window left on the old
 * layer would open UNDER the one window on a computer). Picking an icon is its answer, so it has no foot. Outside the
 * coaches portal the one window locks the page itself, so the admin's library needs nothing of its own.
 */
export default function AwardIconPicker({
  value,
  onSelect,
  onClose,
}: {
  value: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState('');

  return (
    <QuestionShell open onClose={onClose} ariaLabel="Choose an icon" title="Choose an icon">
      <div className={styles.formBody}>
        <div className={styles.awardEmojiGrid}>
          {AWARD_ICON_LIBRARY.map(emoji => (
            <button
              key={emoji}
              type="button"
              className={`${styles.awardEmojiOpt} ${emoji === value ? styles.awardEmojiOptSelected : ''}`}
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className={styles.formSection}>
          <p className={styles.formSectionTitle}>Or type your own</p>
          <div className={styles.tagPickerRow}>
            <input
              className={`${styles.input} ${styles.awardEmojiPickBtn}`}
              style={{ width: '4rem', textAlign: 'center' }}
              value={custom}
              maxLength={4}
              placeholder="🥎"
              onChange={e => setCustom(e.target.value)}
            />
            <button
              className={styles.btnSecondary}
              disabled={!custom.trim()}
              onClick={() => onSelect(custom.trim())}
            >
              Use this
            </button>
          </div>
        </div>
      </div>
    </QuestionShell>
  );
}
