'use client';
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The autosave word — a TRANSIENT pill at the window's foot, bottom-right on desktop and above
 * the bottom nav on a phone. It appears when something is happening and leaves when nothing is.
 *
 * Owner ruling 2026-09-20 (phone re-evaluation, stage 0 · A3 — REVISED the same day). The pill
 * had floated here since 2026-09-14 and was moved into the page's title row that morning because
 * on a phone it sat over the lineup grid's last cells and the practice sheet's last line. The
 * title row turned out to be the wrong home at EVERY width: it is not pinned anywhere, so the word
 * scrolled away the moment a coach was deep enough in the grid to want it. The owner's answer:
 * back to the foot, but only while it has something to say —
 *
 *   edit → "Unsaved changes" → "Saving…" → "✓ Saved" (lingers LINGER_MS) → fades → gone.
 *
 * ⚠ ONLY AN ERROR PERSISTS. "Couldn’t save · Retry" stays until a retry lands (then the ordinary
 * "Saved" linger and fade). Nothing shows at rest: on mount with nothing pending the pill is
 * absent, and the absence IS the resting signal. A save that lands while the pill is fading, or an
 * edit during the linger, brings it straight back — no flicker, no queued fades.
 *
 * ⚠ THREE states, not two (the plan page's rule, now shared). "Saving…" means a request really
 * is open; "Unsaved changes" means edits are waiting for the debounce; lumping them together let
 * the word be untrue and gave a coach no way to tell working from stuck. A failure is a Retry
 * button in the pill's place, never a separate line — the pill is the one place the eye already
 * knows to look for the save.
 *
 * ⚠ The component never unmounts its own live region. A screen reader only announces a change
 * INSIDE a region it already knows about, so the wrapper is never removed or `display: none`d by
 * a phase — it fades with opacity (still in the accessibility tree) and its TEXT is cleared once
 * hidden, so a reader navigating the page never lands on an invisible, stale "Saved". (Callers gate
 * the whole pill on load and permission — `canWrite && !loading`, rows > 0 — which is a mount
 * decision made once per screen, not a phase.)
 *
 * ⚠ Retry takes focus WITH it. Every caller's retry clears the error and sets saving in one batch,
 * so the button a keyboard user just pressed is replaced by "Saving…" in the same commit and focus
 * would fall to <body> — inside the attendance slide-over that is a modal with no focus trap, so
 * the next Tab would land behind the scrim. The click lands focus on the pill first (the masthead's
 * own collapse pattern), and the live region says what happened next.
 *
 * The component keeps its name: five call sites and a UAT spec read it, and the word it renders
 * is the same word.
 */

/** How long "✓ Saved" stays before it starts to fade. */
const LINGER_MS = 2500;
/** The CSS fade's length — the text is cleared only once the pill is fully out. */
const FADE_MS = 300;

type State = 'error' | 'saving' | 'dirty' | 'saved';
type Phase = 'hidden' | 'shown' | 'fading';

export default function SaveStatusPill({
  saving, dirty, error, onRetry,
}: {
  saving: boolean;
  dirty: boolean;
  /** The failure sentence, or empty/null when the last save landed. */
  error?: string | null;
  onRetry: () => void;
}) {
  const state: State = error ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const pillRef = useRef<HTMLDivElement>(null);

  // The "Saved" linger is the only thing the pill remembers; everything else is derived from the
  // state it is handed. It is adjusted DURING RENDER from the previous state (React's own pattern
  // for state that depends on a prop changing) rather than in an effect, so the frame that shows
  // the word is the frame the state changed in.
  const [prevState, setPrevState] = useState<State>(state);
  const [linger, setLinger] = useState<'none' | 'shown' | 'fading'>('none');
  if (state !== prevState) {
    setPrevState(state);
    // Only a transition INTO saved is a save landing. Mounting at rest (the initial `prevState`
    // IS `state`) never gets here, so a screen that opens with nothing pending says nothing. Any
    // other state cancels a linger or a fade in progress — the pill comes straight back.
    setLinger(state === 'saved' ? 'shown' : 'none');
  }
  // Linger, then fade (the stylesheet's transition), then clear the text — each step a timer that
  // the next state change's cleanup cancels.
  useEffect(() => {
    if (linger === 'none') return;
    const t = linger === 'shown'
      ? setTimeout(() => setLinger('fading'), LINGER_MS)
      : setTimeout(() => setLinger('none'), FADE_MS);
    return () => clearTimeout(t);
  }, [linger]);

  // Anything but "saved" holds the pill on screen — that is the ONLY-AN-ERROR-PERSISTS rule, and
  // the dirty and saving words with it, since something is happening while they show.
  const phase: Phase = state !== 'saved' ? 'shown' : linger === 'none' ? 'hidden' : linger;

  return (
    /* -1: never in the tab order; focusable as the landing spot when Retry's own button leaves. */
    <div ref={pillRef} tabIndex={-1} className={styles.savePill} data-state={state} data-phase={phase}>
      <span className={styles.saveStatus} aria-live="polite">
        {phase === 'hidden' ? null
          : error
            ? (
              <button
                type="button"
                className={styles.saveRetry}
                disabled={saving}
                onClick={() => { pillRef.current?.focus({ preventScroll: true }); onRetry(); }}
              >
                Couldn’t save · Retry
              </button>
            )
            : saving ? 'Saving…'
              : dirty ? 'Unsaved changes'
                : <><Check size={13} aria-hidden /> Saved</>}
      </span>
    </div>
  );
}
