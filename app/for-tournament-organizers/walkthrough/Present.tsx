'use client';

/**
 * PRESENT MODE — the walkthrough as full-screen slides (plan P2, approved mockup's ▶ control).
 *
 * Same content, second rendering: the owner pitching a board or screen-sharing a call walks
 * the identical story the scroll page tells. This is a TOOL, not a CTA — the trigger sits
 * text-weight under the hero meta and must never compete with "Start free".
 *
 * Slides carry NO buttons: in a live pitch an on-slide CTA is noise, and the closing slide's
 * spoken ask is the door. Keyboard: → / space / PageDown advance, ← / PageUp back, Esc exits;
 * click/tap anywhere advances (the mockup's contract). Focus moves into the dialog on open and
 * back to the trigger on close; body scroll locks while open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Present.module.css';

export interface PresentSlide {
  eyebrow: string;
  title: string;
  body: string;
  /** Panel slides only. */
  index?: string;
  planTag?: string;
  image?: { src: string; width: number; height: number; alt: string; narrow: boolean };
}

export default function Present({ slides, label }: { slides: PresentSlide[]; label: string }) {
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
        ▸ Present this page — full screen, arrow keys
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
          {/* The stage advances on click/tap — the whole surface is the "next" control. */}
          <div className={styles.stage} onClick={() => move(1)}>
            <div className={styles.slide}>
              {slide.index && <p className={styles.slideIndex}>{slide.index}</p>}
              <p className={slide.index ? styles.slideOld : styles.slideEyebrow}>{slide.eyebrow}</p>
              <h2 className={styles.slideTitle}>{slide.title}</h2>
              {slide.image && (
                <div className={`${styles.slideShot}${slide.image.narrow ? ` ${styles.slideShotNarrow}` : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- same manifest asset,
                      same plain-img precedent as the scroll page */}
                  <img src={slide.image.src} width={slide.image.width} height={slide.image.height} alt={slide.image.alt} />
                </div>
              )}
              <p className={styles.slideBody}>
                {slide.body}
                {slide.planTag && <span className={styles.slideTag}>{slide.planTag}</span>}
              </p>
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
