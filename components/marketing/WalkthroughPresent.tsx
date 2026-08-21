'use client';

/**
 * PRESENT MODE — the walkthrough as full-screen slides (PRESALES_WALKTHROUGH_PLAN.md P2).
 *
 * Same slides, second rendering: the owner pitching a board or screen-sharing a call walks
 * the identical story the scroll page tells. This is a TOOL, not a CTA — the trigger sits
 * text-weight under the hero meta and must never compete with "Start free".
 *
 * ⚠ THIS IS THE SHAPE THE SLIDE FORMAT WAS DESIGNED FOR (ratified 2026-08-20): words on the
 * left, the picture on the right in the shared stage, body copy in the sans face. The scroll
 * panel adapts FROM this, not the other way round.
 *
 * Slides carry NO buttons: in a live pitch an on-slide CTA is noise, and the closing slide's
 * spoken ask is the door. Keyboard: → / space / PageDown advance, ← / PageUp back, Esc exits;
 * click/tap anywhere advances (the mockup's contract). Focus moves into the dialog on open and
 * back to the trigger on close; body scroll locks while open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import SlideStage, { SlideLayout, type SlidePicture } from './SlideStage';
import styles from './WalkthroughPresent.module.css';

/**
 * One slide, as the DECK renders it: the pain, the short claim, the picture in the shared
 * stage — and deliberately NO plan line and no caption. A slide carries no plan or subscription
 * name (owner ruling 2026-08-20): that is what makes it portable between audiences, and a deck
 * has a human in the room to answer "is that included?" The public page, which does not, keeps
 * its plan line. All fields are plain data — this shape crosses the server/client boundary.
 */
export interface PresentSlide {
  eyebrow: string;
  title: string;
  body: string;
  /** Panel slides only. */
  index?: string;
  picture?: SlidePicture;
}

export default function WalkthroughPresent(
  { slides, deckCount, label }: { slides: PresentSlide[]; deckCount: number; label: string },
) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const move = useCallback(
    (d: number) => setAt(cur => Math.min(slides.length - 1, Math.max(0, cur + d))),
    [slides.length],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Tab') {
        // ⚠ THE TRAP IS LOAD-BEARING, and its absence was not theoretical. `aria-modal` is a
        // HINT — nothing enforces it — so without this, Tab walked straight past the footer
        // buttons onto the page behind: links that are invisible (an opaque deck covers them)
        // and unreachable (body scroll is locked), but still live. Pressing Enter there
        // navigated into the demo and ejected the presenter mid-pitch, silently.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = active instanceof Node && dialogRef.current?.contains(active);
        if (!inside) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, move]);

  const slide = slides[at];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => { setAt(0); setOpen(true); }}
      >
        {/* ⚠ "the full deck", not "this page" — since 2026-08-21 this presents every slide in the
            audience's deck rather than the short pull the page shows, so the old label undersold
            it by about half.

            ⚠ AND THE COUNT IS `deckCount`, NOT `slides.length`: `slides` is the hero, the deck and
            the closing panel, so using its length advertised two slides that are not slides. It is
            passed in rather than computed as `slides.length - 2` because that offset is a fact
            about how the caller assembles the array, and it would go quietly wrong the day a
            second framing panel is added at either end. */}
        ▸ Present the full deck — {deckCount} slides, arrow keys
      </button>

      {open && (
        <div
          ref={dialogRef}
          className={styles.deck}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
        >
          {/* The whole surface is the "next" control — click/tap anywhere advances. */}
          <div className={styles.viewport} onClick={() => move(1)}>
            <div className={styles.slide}>
              <SlideLayout
                say={
                  <>
                    {slide.index && <p className={styles.slideIndex}>{slide.index}</p>}
                    <p className={slide.index ? styles.slideOld : styles.slideEyebrow}>{slide.eyebrow}</p>
                    <h2 className={styles.slideTitle}>{slide.title}</h2>
                    <p className={styles.slideBody}>{slide.body}</p>
                  </>
                }
                show={slide.picture && <SlideStage picture={slide.picture} />}
              />
            </div>
          </div>
          <div className={styles.foot}>
            <span className={styles.counter}>{at + 1} / {slides.length}</span>
            <span className={styles.hint}>← → to move · click to advance</span>
            <div className={styles.footActions}>
              <button type="button" className={styles.footBtn} onClick={() => move(-1)} aria-label="Previous slide">←</button>
              <button type="button" className={styles.footBtn} onClick={() => move(1)} aria-label="Next slide">→</button>
              <button type="button" className={styles.footBtn} onClick={close}>Exit (Esc)</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
