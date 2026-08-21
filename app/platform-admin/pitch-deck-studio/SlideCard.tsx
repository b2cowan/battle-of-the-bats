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
import type { ReactNode } from 'react';
import { PICTURE_FRESHNESS_IS_UNCHECKED, type SlideReport } from './report';
import styles from './pitch-deck-studio.module.css';

const CLASS_LABEL: Record<string, string> = {
  proof: 'Proof · unretouched capture',
  composed: 'Composed · cropped + ringed',
  explainer: 'Drawing · hand-authored',
};

/**
 * How old a picture is, in words a reader parses at a glance.
 *
 * ⚠ No colour and no threshold. Every picture in the library is days old today, so a red/amber
 * cutoff would sit green for months and train the eye to skip it — and any cutoff we picked would
 * be invented, because age does not decide staleness on its own (a year-old picture of an
 * untouched screen is fine). The number is stated plainly and the sentence beneath it says what
 * it does not prove. The totals strip carries the worst case so the whole library is one glance.
 */
function describeAge(days: number | null): string {
  if (days === null) return 'at an unrecorded time';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `over a year ago`;
}

export default function SlideCard({
  report: r,
  stage,
}: {
  report: SlideReport;
  /** The slide already rendered in the page's own frame — the SAME node the composer previews,
   *  passed down so the card and the preview are one server render, not two look-alikes. */
  stage?: ReactNode;
}) {
  const { slide, picture, health, pages, decks } = r;
  const stranded = pages.length === 0;

  return (
    <article className={styles.slideCard}>
      <div className={styles.slidePicture}>
        {picture && stage ? (
          <>
            {stage}
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
            <span className={`${styles.badge} ${styles.badgeStranded}`}>Slideshow only</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeLive}`}>Published</span>
          )}
        </div>

        <p className={styles.pain}>{slide.pain}</p>
        <p className={styles.claim}>{slide.claim}</p>

        <dl className={styles.facts}>
          <dt className={styles.factLabel}>In deck</dt>
          <dd className={styles.factValue}>
            {decks.length > 0
              ? /* A LIST since stage C — decks are rows and one slide can sit in several. Keyed
                   by index: deck NAMES are free text with no uniqueness rule, so two same-named
                   decks placing this slide identically would collide on any content key. */
                decks.map((d, i) => (
                  <span key={i} className={styles.pageRow}>
                    {d.deck} · position {d.position} of {d.of}
                  </span>
                ))
              : /* No running order names it: it is in the bank and nothing shows it anywhere. */
                <span className={styles.attention}>In no deck — it is in the library and nothing names it</span>}
          </dd>

          <dt className={styles.factLabel}>On page</dt>
          <dd className={styles.factValue}>
            {stranded ? (
              <>
                <span className={styles.attention}>Not in either page’s pull.</span>
                <span className={styles.caveat}>
                  ⚠ Not the same as unreachable: it IS in the deck, so it appears in{' '}
                  <em>Present the full deck</em> — a button in each page’s hero that any visitor can
                  press. What it misses is the reader who only scrolls. Its page copy travels with
                  it (stage B), so the deck card above can put it on the page.
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
                {/* ⚠ THE AGE SITS DIRECTLY ABOVE THE SENTENCE THAT LIMITS IT, and that adjacency is
                    the design. On its own a date reads as a freshness verdict; the reader has to
                    meet "how old" and "nobody has checked whether it still matches" together, or
                    the number quietly becomes the reassurance we do not actually have. */}
                <span className={styles.caveat}>
                  {health.takenAt
                    ? <>Taken <strong>{describeAge(health.ageDays)}</strong> — {health.takenAt}.</>
                    : <>No capture date recorded — it was taken before we started stamping them.
                        Re-taking this picture will stamp it.</>}
                </span>
                <span className={styles.caveat}>{PICTURE_FRESHNESS_IS_UNCHECKED}</span>
              </>
            )}
          </dd>

          {/* ⚠ The "Page copy" row is GONE because the gap it surfaced is closed (stage B /
              finding F4): `pageAnswer` and `seoPhrase` are required fields on every slide, so
              "not written" is a compile error now, not a condition a screen needs to report. */}
        </dl>
      </div>
    </article>
  );
}
