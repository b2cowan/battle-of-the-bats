/**
 * THE PICTURE STAGE — one frame, every kind of pitch picture.
 *
 * Ratified 2026-08-20 (memory/design_decisions.md): a single fixed 16:10 stage with the
 * picture CONTAINED inside it, never stretched. That is what lets a tall phone capture, a wide
 * cropped table and (from P2) a drawn explainer sit in one deck without it reading as assembled
 * from parts — and the full dues table stays legible precisely BECAUSE it is contained.
 *
 * ⚠ SYSTEM EXTENSION, FLAGGED WHEN IT WAS RULED: no fixed aspect-ratio convention exists
 * anywhere else in the platform. This introduces one, scoped to pitch surfaces only.
 *
 * ⚠ ON A PHONE THE STAGE IS A FLOOR, NOT A CAGE. The ruling gives two rules that collide for a
 * tall picture: "fixed 16:10" and "on a phone the picture takes the full column". At 390px a
 * 16:10 stage is ~350×219, and a phone-shaped capture contained inside it renders ~140px wide —
 * SMALLER than before, i.e. the opposite of the defect this was meant to fix. So below the
 * stacking breakpoint the aspect lock is released and the picture takes the full column at its
 * own shape, capped so it cannot eat the screen. That resolves the conflict in favour of the
 * half the ruling names as the fix; it does not relax it.
 *
 * Shared by the scroll panel and present mode deliberately — a shared CLASS stops style drift
 * but not markup drift, and the ring overlay is markup.
 */
import type { CalloutRing } from '@/lib/walkthrough-content';
import styles from './SlideStage.module.css';

/**
 * THE SLIDE ITSELF — words beside the picture, and the phone reflow that puts the picture first.
 *
 * Lives next to the stage rather than in each renderer because it is the same mechanism twice: a
 * two-column grid that collapses under the stacking breakpoint and flips the visual order. Left
 * as two hand-written copies it would drift the first time the breakpoint or the ratio moved —
 * which is the same argument that made the stage shared, applied one level out.
 *
 * ⚠ ONE ratio for both surfaces (the ratified 38/62). The scroll page briefly ran 40/60 to give
 * its longer unattended answer more room; the difference is two percent, it is not worth a
 * parameter, and matching the ruling exactly is worth more than the two percent.
 *
 * `say` is first in source order on purpose: the pain names what the picture is answering, so a
 * screen reader should meet it first. The phone reflow is `order`, which is a visual concern.
 */
export function SlideLayout({ say, show }: { say: React.ReactNode; show: React.ReactNode }) {
  return (
    <div className={show ? styles.slide : undefined}>
      <div className={styles.say}>{say}</div>
      {show && <div className={styles.show}>{show}</div>}
    </div>
  );
}

export interface SlidePicture {
  src: string;
  /** The capture's real pixel size — it gives the picture box its aspect, so rings land true. */
  width: number;
  height: number;
  alt: string;
  rings?: CalloutRing[];
}

export default function SlideStage({ picture }: { picture: SlidePicture }) {
  return (
    <div className={styles.stage}>
      {/* The picture box carries the CAPTURE's aspect ratio, so it fits inside the stage exactly
          as object-fit:contain would — and, unlike contain, the box is then the same rectangle
          the rings are positioned against. Percentage ring geometry lands on the same pixels at
          every width because of this line. */}
      {/* Three numbers, and the stylesheet spends all three on the WIDTH — see the long note on
          `.picture` in SlideStage.module.css for why a height clamp would squash the picture
          rather than contain it.
            · aspectRatio — gives the box the capture's own shape, so it IS the image's box and
              the percentage ring geometry lands on the same pixels at every width.
            · --shot-w    — never enlarge a capture past the size it was taken. These are phone
              screens; blown up to fill a desktop stage they go soft AND claim to be desktop.
            · --shot-ratio — the unitless w/h the height limits are converted through. */}
      <div
        className={styles.picture}
        style={{
          aspectRatio: `${picture.width} / ${picture.height}`,
          '--shot-w': `${picture.width}px`,
          '--shot-ratio': `${picture.width / picture.height}`,
        } as React.CSSProperties}
      >
        {/* Plain <img>, matching HelpScreenshot's documented precedent: a manifest asset of known
            size, already lazy. next/image would route every request through the sharp-backed
            optimizer — an Amplify code path this repo has been burned by once
            (memory/reference_sharp_turbopack_webpack.md) and that no public page exercises. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={picture.src}
          width={picture.width}
          height={picture.height}
          alt={picture.alt}
          className={styles.img}
          loading="lazy"
          decoding="async"
        />
        {picture.rings?.map((ring, i) => (
          // Decorative: what the ring points AT is already carried by the alt text and the
          // caption, so a screen reader gets the meaning without the geometry. Keyed by
          // position in the list — two rings may legitimately share a corner, and these are
          // stateless spans in a list that never reorders.
          <span
            key={i}
            className={styles.ring}
            aria-hidden="true"
            style={{
              left: `${ring.left}%`,
              top: `${ring.top}%`,
              width: `${ring.width}%`,
              height: `${ring.height}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
