'use client';
import { Check } from 'lucide-react';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The autosave word, as a pill floating at the foot of the window — bottom-right on desktop,
 * above the bottom nav on a phone — for a screen whose only foot-of-page content WAS that word.
 *
 * Owner ruling 2026-09-14: a full-width bar docked to the viewport is furniture when nothing else
 * is in it. The lineup builder keeps its bar because Undo · Redo · Print live there; the practice
 * plan, the plan-template editor and the schedule's attendance list carry this pill instead.
 *
 * ⚠ THREE states, not two (the plan page's rule, now shared). "Saving…" means a request really
 * is open; "Unsaved changes" means edits are waiting for the debounce; lumping them together let
 * the word be untrue and gave a coach no way to tell working from stuck. A failure is a Retry
 * button in the pill itself, never a separate line — the pill is the one place the eye already
 * knows to look for the save.
 */
export default function SaveStatusPill({
  saving, dirty, error, onRetry,
}: {
  saving: boolean;
  dirty: boolean;
  /** The failure sentence, or empty/null when the last save landed. */
  error?: string | null;
  onRetry: () => void;
}) {
  return (
    <div className={styles.savePill} data-state={error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved'}>
      <span className={styles.saveStatus} aria-live="polite">
        {error
          ? <button type="button" className={styles.saveRetry} disabled={saving} onClick={onRetry}>Couldn’t save · Retry</button>
          : saving ? 'Saving…'
            : dirty ? 'Unsaved changes'
              : <><Check size={13} /> Saved</>}
      </span>
    </div>
  );
}
