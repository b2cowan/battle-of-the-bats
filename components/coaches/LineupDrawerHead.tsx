'use client';
import { X } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE HEAD OF A LINEUP-BUILDER DRAWER — a title and a way out.
 *
 * ⚠ IT EXISTS FOR THE SAME REASON `LineupSheetScrim` DOES, AND THE DRIFT HAD ALREADY STARTED.
 * D12 gave the Setup drawer a titled head because once the scrim covers the control that opened
 * it, nothing on screen says what the surface is. On 2026-09-23 Templates needed the same head
 * (it had none at all) — and `/simplify`'s reuse pass pointed out that a THIRD copy of this idea
 * already exists and has already diverged: `CallUpSheet` renders its own head with a different
 * wrapper class, an `<h3>` instead of a `<p>`, and `modalCloseBtn` + `&times;` instead of this
 * button and the `X` glyph. Two hand-copied call sites is where that starts. This is the head
 * spelled once.
 *
 * ⚠ `CallUpSheet`'s copy is deliberately NOT folded in here. Its close button rides the portal-
 * wide `.modalCloseBtn`, which carries its own 44px floor at ≤768 and whose unification with this
 * one the stylesheet explicitly records as "a portal-wide decision, not a side effect of this
 * pass". Reconciling the two is its own unit of work; doing it here would reshape a surface this
 * ruling never asked about.
 *
 * ⚠⚠ `desktopClose` IS A PROP, NOT AN ANCESTOR (/simplify altitude pass, 2026-09-23). The first
 * build answered "does this head show a × on the true desktop?" by scoping the ≥901 rule to
 * `.lineupSetupDrawer …` — i.e. by sniffing an ancestor whose actual job is layout. That silently
 * gives the wrong answer to any future consumer that wants the × without that ancestor, or
 * carries the ancestor and does not want it. The question is asked, not inferred:
 *
 *   · **Setup** passes it — at ≥901 it is a centered modal, and a modal backdrop is less
 *     obviously clickable than a small popover's "click anywhere else", so it earns an explicit ×.
 *   · **Templates** does not — at ≥901 it is still a small anchored popover, and must not grow a
 *     control it never had.
 *
 * At ≤900 the × always shows, at the portal's 44px floor, because there the drawer COVERS the
 * bottom nav: the visible scrim is a 12px strip, and Escape and the back gesture are both absent
 * on an iPhone running the portal from the home screen. That half is width-only, so the
 * stylesheet decides it — see `.lineupDrawerOverNav .lineupSetupDrawerClose`.
 */
export default function LineupDrawerHead({
  title, onClose, desktopClose,
}: {
  /** What this surface is — the thing the scrim has covered up. */
  title: string;
  onClose: () => void;
  /** Show the × at ≥901 too. Only a drawer that is a MODAL at that width should ask for it. */
  desktopClose?: boolean;
}) {
  const closeClass = desktopClose
    ? `${styles.lineupSetupDrawerClose} ${styles.lineupDrawerCloseDesktop}`
    : styles.lineupSetupDrawerClose;
  return (
    <div className={styles.lineupSetupDrawerHead}>
      <p className={styles.lineupSheetTitle}>{title}</p>
      <button type="button" className={closeClass} aria-label="Close" onClick={onClose}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
