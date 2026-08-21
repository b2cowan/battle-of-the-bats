/**
 * ONE SLIDE, AS THE LIBRARY VIEW SHOWS IT — the picture, the words, where it appears, and an
 * honest answer about its condition.
 *
 * ⚠ THERE IS NO PLAN-LINE ROW, AND ITS ABSENCE IS A RULING (2026-08-21). This card carried one
 * until the owner deleted every plan line from the pitch surfaces — *"we don't want to
 * compartmentalize features at this stage"*. Do not add it back under another name; the
 * invariant is held by a build check now, which fails rather than waiting to be looked at.
 *
 * ⚠ THE PICTURE IS RENDERED THROUGH THE PUBLIC PAGE'S OWN `SlideStage`, rings and all, and that
 * is the point of the screen rather than a shortcut. A contact sheet that framed a slide even
 * slightly differently from the surface it is published on would be answering a question nobody
 * asked. Resolution comes from the same `pictureFor()` the walkthrough uses.
 *
 * ⚠⚠ NO EDIT AFFORDANCE. Not "not yet" — the owner was offered an editable-with-review-queue
 * design and declined it (plan ruling 1: DECKS ARE DATA, SLIDES ARE CODE). A slide's words are
 * checked against the live plan configuration by the build; nothing watches a sentence once it is
 * a row in a table, and the same copy feeds the in-app upgrade panels, so a marketing overclaim
 * reaches paying customers. Do not "finish the form".
 */
import SlideStage from '@/components/marketing/SlideStage';
import { AUDIENCE_LABEL, PICTURE_FRESHNESS_IS_UNCHECKED, type SlideReport } from './report';
import styles from './pitch-deck-studio.module.css';

const CLASS_LABEL: Record<string, string> = {
  proof: 'Proof · unretouched capture',
  composed: 'Composed · cropped + ringed',
  explainer: 'Drawing · hand-authored',
};

export default function SlideCard({ report: r }: { report: SlideReport }) {
  const { slide, picture, health, pages, deck } = r;
  const stranded = pages.length === 0;

  return (
    <article className={styles.slideCard}>
      <div className={styles.slidePicture}>
        {picture ? (
          <>
            <SlideStage picture={picture.picture} />
            <p className={styles.pictureCaption}>{picture.caption}</p>
          </>
        ) : (
          // Reachable only if a capture is declared without a recorded size. The public page has
          // the same branch and drops the picture silently; here it is the finding.
          <p className={styles.noPicture}>
            No picture resolves for this slide — the page would render its words with an empty stage.
          </p>
        )}
      </div>

      <div className={styles.slideWords}>
        <div className={styles.slideTop}>
          <span className={styles.slideNum}>{slide.id}</span>
          <span className={styles.badge}>{CLASS_LABEL[r.imageClass] ?? r.imageClass}</span>
          {stranded ? (
            <span className={`${styles.badge} ${styles.badgeStranded}`}>Shown on no public page</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeLive}`}>Published</span>
          )}
        </div>

        <p className={styles.pain}>{slide.pain}</p>
        <p className={styles.claim}>{slide.claim}</p>

        <dl className={styles.facts}>
          <dt className={styles.factLabel}>In deck</dt>
          <dd className={styles.factValue}>
            {deck
              ? `${AUDIENCE_LABEL[deck.audience] ?? deck.audience} · position ${deck.position} of ${deck.of}`
              : /* No deck names it: it is in the bank and in no running order at all. */
                <span className={styles.attention}>In no deck — it is in the library and nothing names it</span>}
          </dd>

          <dt className={styles.factLabel}>On page</dt>
          <dd className={styles.factValue}>
            {stranded ? (
              <>
                <span className={styles.attention}>Nowhere.</span>
                <span className={styles.caveat}>
                  It is in the deck, so it shows in present mode when someone is standing beside it —
                  but no public page pulls it, and it has no page copy of its own.
                </span>
              </>
            ) : (
              pages.map(p => (
                <span key={p.path} className={styles.pageRow}>
                  <a href={p.path} target="_blank" rel="noopener noreferrer">{p.path}</a>
                  {` · panel ${p.panel} of ${p.of}`}
                </span>
              ))
            )}
          </dd>

          <dt className={styles.factLabel}>Picture</dt>
          <dd className={styles.factValue}>
            {health.kind === 'drawing' ? (
              <>
                <span className={styles.mono}>{health.drawingId}</span>
                {/* ⚠ NOT A GREEN TICK. Nearly half the library lands here — the capture
                    check has no manifest entry to look at, and pretending otherwise would be a
                    pass that means nothing on nearly half the screen. */}
                <span className={styles.caveat}>
                  Hand-drawn inline SVG. It has no entry in the picture manifest, so the capture
                  check has nothing to look at — neither passed nor failed. Its description and
                  caption travel with the slide and are checked for emptiness by the guard test.
                </span>
              </>
            ) : (
              <>
                <span className={styles.mono}>{health.publicPath}</span>
                {health.problems.length > 0 ? (
                  health.problems.map(p => (
                    <span key={p} className={styles.problem}>{p}</span>
                  ))
                ) : (
                  <span className={styles.caveat}>
                    Declared properly: file{health.present === null ? ' recorded' : ' present'}, size{' '}
                    {health.size ? `${health.size.w}×${health.size.h}` : 'missing'}, description and
                    caption both written. Taken at {health.captureWidth}px from{' '}
                    <span className={styles.mono}>{health.demoPath}</span>.
                  </span>
                )}
                <span className={styles.caveat}>{PICTURE_FRESHNESS_IS_UNCHECKED}</span>
              </>
            )}
          </dd>

          <dt className={styles.factLabel}>Page copy</dt>
          <dd className={styles.factValue}>
            {!stranded ? (
              <span className={styles.factQuiet}>
                Written — the long unattended answer exists on the page that shows it.
              </span>
            ) : (
              <>
                <span className={styles.attention}>Not written.</span>
                <span className={styles.caveat}>
                  A public page panel needs a longer answer than a deck does, because nobody is
                  standing there to add the qualifications. Until this slide has one it cannot be
                  dropped onto a page as it is.
                </span>
              </>
            )}
          </dd>
        </dl>
      </div>
    </article>
  );
}
