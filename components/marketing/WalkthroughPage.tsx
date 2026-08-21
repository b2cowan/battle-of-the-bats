/**
 * THE WALKTHROUGH PAGE — one renderer, every persona's 90-second pitch.
 *
 * Plan: docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md (the library this now renders from)
 * · docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md (the page itself)
 * · the format: https://claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f
 *
 * Everything a walkthrough differs by (its pull, its door, its way back, its address) is DATA
 * in lib/walkthrough-content.ts; each persona's route file is a two-line shell.
 *
 * Three renderings, one source: this scroll page, present mode (WalkthroughPresent), and the
 * print leave-behind (@media print). A fourth persona costs a content entry and a shell.
 *
 * ⚠ THE PAGE IS NOT THE DECK, and the difference is one line of copy each way. A slide carries
 * NO plan name (that is what makes it portable between audiences); the page carries one wherever
 * a feature is gated, because a deck has a human in the room to answer "is that included?" and a
 * web page does not. Same reason the page gets the long `answer` and a slide gets the short
 * `claim`.
 */
import Link from 'next/link';
import { PITCH_SLIDES, deckSlides, type PitchSlide, type Walkthrough } from '@/lib/walkthrough-content';
import { sandboxDoorsVisible } from '@/lib/sandbox-door';
import { pictureFor } from './slide-picture';
import SlideStage, { SlideLayout } from './SlideStage';
import WalkthroughPresent, { type PresentSlide } from './WalkthroughPresent';
import styles from './WalkthroughPage.module.css';

/** The address a reader types after the PDF is off the screen — no scheme, no `www.`. */
const PRINT_HOST = 'fieldlogichq.ca';

export default function WalkthroughPage({ walkthrough: w }: { walkthrough: Walkthrough }) {
  /**
   * ⚠ EVERY SLIDE'S PICTURE IS RESOLVED EXACTLY ONCE, and that is an invariant rather than a
   * micro-optimisation. The scroll panel and the deck must picture the same slide identically;
   * resolving it twice is how they would eventually stop. (This was the original code's stated
   * guarantee, and making present mode render the deck rather than the pull briefly broke it —
   * the pull's six slides were being resolved a second time inside the deck map.)
   */
  const deck = deckSlides(w.persona);
  const shownFor = new Map(deck.map(slide => [slide.id, pictureFor(slide)]));

  // The scroll page's short PULL — a subset of the deck, in deck order (the guard test enforces
  // both). No missing-slide branch: `slideId` is typed to the bank's own key set, so a pull
  // naming a slide the bank does not hold cannot compile.
  const pulled = w.panels.map(panel => {
    const slide: PitchSlide = PITCH_SLIDES[panel.slideId];
    return { panel, slide, shown: shownFor.get(slide.id) ?? null };
  });

  /**
   * ⚠⚠ PRESENT MODE RENDERS THE WHOLE DECK, NOT THE PAGE'S PULL (P2b, 2026-08-21) — and this
   * two-line change is the reason the library has an audience at all.
   *
   * It used to map `pulled`, i.e. the short pull the scroll page shows, while a comment in
   * lib/walkthrough-content.ts claimed the opposite ("present mode and the printed leave-behind
   * both render every built slide already"). That comment was FALSE, and `deckSlides()` had
   * exactly one caller — the guard test. **The consequence was that five finished coach slides —
   * playing time, awards, player development, the fundraising credit and the lineup board, all
   * photographed and checked in P2a — could not be seen anywhere in the product.**
   *
   * The scroll page is deliberately NOT changed: a web page nobody scrolls to the bottom of is
   * exactly what the short pull exists to prevent. The deck is the long form, and present mode is
   * where a human is standing beside it. That division is the whole point of the library.
   *
   * Slides still carry data only — the client component receives nothing it could not serialize,
   * which is why a drawing is passed as an id rather than as rendered markup.
   */
  const slides: PresentSlide[] = [
    { eyebrow: w.eyebrow, title: w.title, body: w.sub },
    ...deck.map((slide, i) => ({
      index: `${i + 1} / ${deck.length}`,
      eyebrow: 'The old way',
      title: slide.pain,
      body: slide.claim,
      picture: shownFor.get(slide.id)?.picture,
    })),
    { eyebrow: w.closing.eyebrow, title: w.closing.title, body: w.closing.body },
  ];

  // Same gate, same posture as the persona pages: the walkthrough is the pitch, the demo is the
  // proof one step behind it, and signup stays the ask. When the doors are dark, the panels still
  // stand on their pictures — only the door links go.
  const showSandboxDoor = sandboxDoorsVisible();

  // The standing placement ruling, rendered once: the ask leads, the door follows one step
  // behind it. Both CTA rows carry the identical pair, so they cannot drift apart.
  const askThenDoor = (
    <>
      <Link
        href="/auth/signup"
        className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
      >
        Start free
      </Link>
      {showSandboxDoor && (
        <Link href={w.door.path} className={styles.seeItLive}>
          <span className={styles.seeItLiveDot} aria-hidden="true" />
          {w.door.label}
        </Link>
      )}
    </>
  );

  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>{w.eyebrow}</p>
          <h1 className={styles.heroTitle}>{w.title}</h1>
          <p className={styles.heroSub}>{w.sub}</p>
          <div className={styles.heroActions}>{askThenDoor}</div>
          <p className={styles.heroMeta}>{w.meta}</p>
          <WalkthroughPresent slides={slides} deckCount={deck.length} label={`${w.title} — presentation`} />
        </div>
      </section>

      {/* ── The pull ─────────────────────────────────────────────────────── */}
      {pulled.map(({ panel, slide, shown }, i) => {
        return (
          <section key={slide.id} className={styles.panel}>
            <div className="container">
              <p className={styles.panelIndex}>{i + 1} / {pulled.length}</p>
              <SlideLayout
                say={
                  <>
                    <p className={styles.panelOld}>The old way</p>
                    <h2 className={styles.panelPain}>{slide.pain}</h2>
                    {/* ⚠ No plan chip, by owner ruling 2026-08-21 — see the long note on
                        WalkthroughPanel. This page names no plan, tier or price anywhere. */}
                    <p className={styles.panelNew}>With FieldLogicHQ</p>
                    <p className={styles.panelAnswer}>{panel.answer}</p>
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
        );
      })}

      {/* ── Closing: the proof, then the ask ─────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <p className={styles.heroEyebrow}>{w.closing.eyebrow}</p>
          <h2 className={styles.ctaTitle}>{w.closing.title}</h2>
          <p className={styles.ctaBody}>{w.closing.body}</p>
          <div className={styles.heroActions}>
            {askThenDoor}
            {/* Invariant copy: "everything else IT does" reads right for every persona, so it
                lives here rather than being re-typed once per walkthrough. */}
            <Link href={w.back.href} className={styles.backLink}>
              Everything else it does →
            </Link>
          </div>
          {/* The leave-behind carries its own way back: buttons don't survive a PDF, an
              address does. Hidden on screen, shown only in print. */}
          <p className={styles.printUrl}>{PRINT_HOST}{w.path}</p>
        </div>
      </section>

    </main>
  );
}
