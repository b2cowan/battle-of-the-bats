/**
 * THE PANEL LIST — one slide per section, the scroll (and print) rendering every pitch page
 * shares. Extracted when the prospect deck page (stage D) became the second consumer: a shared
 * CLASS stops style drift but not markup drift (standing repo lesson), and this markup IS the
 * print leave-behind's page structure — two hand-copies would diverge on the next print or
 * accessibility tweak and the walkthrough PDF and the prospect PDF would quietly stop matching.
 *
 * Renders each slide's `pageAnswer` — the UNATTENDED version — because both consumers are read
 * without a human in the room (a scrolling visitor, a prospect alone with a link).
 */
import type { PitchSlide } from '@/lib/walkthrough-content';
import type { SlidePictureWithCaption } from './slide-picture';
import SlideStage, { SlideLayout } from './SlideStage';
import styles from './WalkthroughPage.module.css';

export interface PanelSlide {
  slide: PitchSlide;
  /** Resolved ONCE by the caller (shared with its present-mode array) — never re-resolved here. */
  shown: SlidePictureWithCaption | null;
}

export default function SlidePanels({ panels }: { panels: PanelSlide[] }) {
  return (
    <>
      {panels.map(({ slide, shown }, i) => (
        <section key={slide.id} className={styles.panel}>
          <div className="container">
            <p className={styles.panelIndex}>{i + 1} / {panels.length}</p>
            <SlideLayout
              say={
                <>
                  <p className={styles.panelOld}>The old way</p>
                  <h2 className={styles.panelPain}>{slide.pain}</h2>
                  {/* ⚠ No plan chip, by owner ruling 2026-08-21 — see the long note in
                      lib/walkthrough-content.ts where WalkthroughPanel used to live. Pitch
                      surfaces name no plan, tier or price anywhere. */}
                  <p className={styles.panelNew}>With FieldLogicHQ</p>
                  <p className={styles.panelAnswer}>{slide.pageAnswer}</p>
                  {/* ⚠ AND NO PER-PANEL "See this screen live" LINK, by the same session's lime
                      ruling. It was the page's only real repetition of the accent — six of them,
                      against a hero and a closing that already offer the identical door. The
                      rule that survives is by SURFACE: lime marks the one recommended action in
                      the APP, and is the brand accent on marketing. Dropping these six is the
                      trim that ruling asked for; do not re-add them panel by panel. */}
                </>
              }
              show={
                shown && (
                  <figure className={styles.shotFigure}>
                    <SlideStage picture={shown.picture} />
                    <figcaption className={styles.shotCaption}>{shown.caption}</figcaption>
                  </figure>
                )
              }
            />
          </div>
        </section>
      ))}
    </>
  );
}
