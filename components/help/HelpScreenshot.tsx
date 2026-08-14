'use client';

import { useRef } from 'react';
import { HELP_SHOTS } from '@/lib/help-shots';
import styles from './help.module.css';

/**
 * ONE help screenshot — a framed, captioned figure that opens full-size on tap.
 *
 * Everything about the picture except "which one" comes from the manifest
 * (`lib/help-shots.ts`), so a content author writes `<HelpScreenshot id="…" />`
 * and cannot forget alt text, a caption, or the dimensions that stop the guide
 * jumping as images load.
 *
 * Renders in BOTH the full guide and the "?" drawer, so it is sized in relative
 * units and never assumes the wide column.
 *
 * ⚠ FAILS QUIET, BY DESIGN. An unknown id renders NOTHING rather than a broken
 * frame: a picture is always supplementary here (the format standard requires the
 * text to carry the answer on its own), so a missing one must never leave a hole
 * in an otherwise readable topic.
 */
export default function HelpScreenshot({ id }: { id: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shot = HELP_SHOTS.find(s => s.id === id);
  if (!shot) return null;

  const src = `/help/${shot.module}/${shot.id}.png`;

  return (
    <figure className={styles.helpShot}>
      <button
        type="button"
        className={styles.helpShotFrame}
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Enlarge: ${shot.alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a documentation asset of known
            size; next/image would add a loader round-trip for a picture that is already sized
            and already lazy, and these must render identically inside the portal'd drawer. */}
        <img
          src={src}
          alt={shot.alt}
          width={shot.size?.w}
          height={shot.size?.h}
          loading="lazy"
          decoding="async"
          className={styles.helpShotImg}
        />
        {shot.highlight && (
          <span className={styles.helpShotRing} style={shot.highlight} aria-hidden="true" />
        )}
      </button>

      <figcaption className={styles.helpShotCaption}>
        <span>{shot.caption}</span>
        <span className={styles.helpShotZoom} aria-hidden="true">Tap to enlarge ⤢</span>
      </figcaption>

      {/* Native <dialog>: Escape and the backdrop close it with no key handling of our own. */}
      <dialog
        ref={dialogRef}
        className={styles.helpShotDialog}
        onClick={event => {
          // Backdrop click — the dialog element itself is the backdrop's hit target.
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img src={src} alt={shot.alt} className={styles.helpShotDialogImg} />
        <button
          type="button"
          className={styles.helpShotClose}
          onClick={() => dialogRef.current?.close()}
        >
          Close
        </button>
      </dialog>
    </figure>
  );
}
