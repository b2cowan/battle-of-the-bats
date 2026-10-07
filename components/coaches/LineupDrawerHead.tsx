'use client';
import { ChevronLeft, X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE HEAD OF A LINEUP-BUILDER DRAWER — a title and a way out.
 *
 * ⚠ ONE HEAD, THREE FORMS, AND THE DRIFT HAD ALREADY STARTED. D12 gave the Setup drawer a titled
 * head because once the dim covers the control that opened it, nothing on screen says what the
 * surface is. On 2026-09-23 Templates (now Save as template) needed the same head — and `/simplify`'s
 * reuse pass found a THIRD copy already diverged: `CallUpSheet` rendered its own head, an `<h3>` in
 * the display face with `modalCloseBtn` + `&times;`. It was left out then (its × rode the
 * portal-wide `.modalCloseBtn`); Sheet Frame step 5 folded it in (owner D9, 2026-10-06, drawn true
 * size on the hub): all three of the builder's forms wear this head, and `.modalCloseBtn` itself was
 * not touched. This is the head spelled once — the sheet frame's form head (D2).
 *
 * ⚠⚠ `desktopClose` IS A PROP, NOT AN ANCESTOR (/simplify altitude pass, 2026-09-23). The first
 * build answered "does this head show a × on the true desktop?" by scoping the ≥901 rule to
 * `.lineupSetupDrawer …` — i.e. by sniffing an ancestor whose actual job is layout. That silently
 * gives the wrong answer to any future consumer that wants the × without that ancestor, or
 * carries the ancestor and does not want it. The question is asked, not inferred:
 *
 *   · **Setup** passes it — at ≥901 it is a centered modal, and a modal backdrop is less
 *     obviously clickable than a small popover's "click anywhere else", so it earns an explicit ×.
 *   · **Save as template** does not — at ≥901 it is still a small anchored popover, and must not grow
 *     a control it never had.
 *   · **Call up** passes it too — at ≥901 it is a popover, but one that always carried a ×.
 *
 * At ≤900 the × always shows, at the portal's 44px floor, because there all three are the sheet
 * frame's FORM layer and cover the bottom nav: the visible dim is a 12px strip, and Escape and the
 * back gesture are both absent on an iPhone running the portal from the home screen. That half is
 * width-only, so the stylesheet decides it — see `.lineupSetupDrawerClose` at ≤900. The × itself is
 * `LineupDrawerClose`, below, because Copy from carries it without this head.
 */
export default function LineupDrawerHead({
  title, onClose, desktopClose, onBack, backDisabled,
}: {
  /** What this surface is — the thing the scrim has covered up. */
  title: string;
  onClose: () => void;
  /**
   * A view with a step behind it (Save as template's "are you sure", 2026-10-02): the title turns
   * into a Back that names where it goes — "‹ Save as template" — and the view sits under it.
   */
  onBack?: () => void;
  backDisabled?: boolean;
  /** Show the × at ≥901 too. Only a drawer that is a MODAL at that width should ask for it. */
  desktopClose?: boolean;
}) {
  return (
    <div className={styles.lineupSetupDrawerHead}>
      {onBack ? (
        <button type="button" className={styles.lineupDrawerBack} aria-label={`Back to ${title}`} disabled={backDisabled} onClick={onBack}>
          <ChevronLeft size={17} aria-hidden /> {title}
        </button>
      ) : <p className={styles.lineupSheetTitle}>{title}</p>}
      <LineupDrawerClose onClose={onClose} desktop={desktopClose} />
    </div>
  );
}

/**
 * THE BUILDER'S ×, ONE BUTTON FOR EVERY DRAWER THAT CARRIES ONE — the three forms' head above, and Copy
 * from's own two-line head. A plain glyph: no outline, no circle, no square (owner ruling 2026-10-07 — the
 * portal's × is the game-day sheets' and the windows', and circle buttons were already banned in the coach
 * portal). Until then this head wore a round outline and Copy from a private square copy; a drawer that
 * needs a × takes this button, never a class of its own. Shown at ≤900 always; above 900 only when
 * `desktop` asks (see the head's docblock).
 */
export function LineupDrawerClose({ onClose, desktop }: { onClose: () => void; desktop?: boolean }) {
  const className = desktop
    ? `${styles.lineupSetupDrawerClose} ${styles.lineupDrawerCloseDesktop}`
    : styles.lineupSetupDrawerClose;
  return (
    <button type="button" className={className} aria-label="Close" onClick={onClose}>
      <X size={16} aria-hidden />
    </button>
  );
}
