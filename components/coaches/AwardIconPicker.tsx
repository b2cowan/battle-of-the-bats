'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';

// Curated sport/achievement set (Coach Tags & Player Awards Phase 2 — owner caught in mockup
// review that a bare text field for an emoji is a bad ask on desktop). "Type your own" stays
// as a fallback for anything outside the set.
export const AWARD_ICON_LIBRARY = [
  '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️',
  '💪', '🔥', '⚡', '🎯', '👑', '💯',
  '⚾', '🥎', '🧤', '🛡️', '🏃', '🦾',
  '🌟', '⭐', '✅', '🙌', '👏', '🚀',
  '🎉', '🐐', '💎', '🎗️',
];

/** Small centered modal — layers on top of the award-type manager or the give-award form. */
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

  // Mount/unmount pattern (no internal open flag) — register for the whole mounted lifetime.
  // Tolerant variant: this modal also renders from admin/rep-teams/shared-library, outside the
  // coaches portal's CoachesOverlayProvider, where a throwing hook would crash the page.
  useOverlayOpenIfAvailable(true);

  return (
    <div className={`${styles.modalOverlay} ${styles.centeredOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Choose an icon</h3>
          <button className={styles.modalCloseBtn} onClick={onClose}><X size={16} /></button>
        </div>

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
      </div>
    </div>
  );
}
