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
import { MARKETING_SHOTS } from '@/lib/marketing-shots';
import { PITCH_SLIDES, type PitchSlide, type Walkthrough } from '@/lib/walkthrough-content';
import { sandboxDoorsVisible } from '@/lib/sandbox-door';
import SlideStage, { SlideLayout, type SlidePicture } from './SlideStage';
import WalkthroughPresent, { type PresentSlide } from './WalkthroughPresent';
import styles from './WalkthroughPage.module.css';

const SHOTS = new Map(MARKETING_SHOTS.map(s => [s.id, s]));

/** The address a reader types after the PDF is off the screen — no scheme, no `www.`. */
const PRINT_HOST = 'fieldlogichq.ca';

/** The picture two renderings share, plus the caption only the scroll page's figure shows. */
interface Picture {
  picture: SlidePicture;
  caption: string;
}

/**
 * A slide's picture, or null while it is declared but not yet captured. The null branch keeps a
 * half-built page carrying its text instead of a broken image; `check:marketing-shots` (wired
 * into verify:changed) is what stops that from becoming a silent permanent state.
 */
function pictureFor(slide: PitchSlide): Picture | null {
  const shot = slide.shotId ? SHOTS.get(slide.shotId) : undefined;
  if (!shot?.size) return null;
  return {
    picture: {
      src: `/marketing/${shot.persona}/${shot.id}.png`,
      width: shot.size.w,
      height: shot.size.h,
      alt: shot.alt,
      rings: slide.rings,
    },
    caption: shot.caption,
  };
}

export default function WalkthroughPage({ walkthrough: w }: { walkthrough: Walkthrough }) {
  // Resolved ONCE per panel and read by both renderings below — the scroll panel and the deck
  // must picture the same slide, and looking it up twice is how they would eventually stop.
  // No missing-slide branch: `slideId` is typed to the bank's own key set, so a pull naming a
  // slide that does not exist cannot compile.
  const pulled = w.panels.map(panel => {
    const slide: PitchSlide = PITCH_SLIDES[panel.slideId];
    return { panel, slide, shown: pictureFor(slide) };
  });

  // Present mode is the DECK rendering of the same slides: the short claim, and no plan line.
  // Hero → the slides → the closing. Slides carry data only (the client component receives
  // nothing it could not serialize).
  const slides: PresentSlide[] = [
    { eyebrow: w.eyebrow, title: w.title, body: w.sub },
    ...pulled.map(({ slide, shown }, i) => ({
      index: `${i + 1} / ${pulled.length}`,
      eyebrow: 'The old way',
      title: slide.pain,
      body: slide.claim,
      picture: shown?.picture,
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
          <WalkthroughPresent slides={slides} label={`${w.title} — presentation`} />
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
                    <p className={styles.panelNew}>
                      With FieldLogicHQ
                      {panel.planTag && <span className={styles.planTag}>{panel.planTag}</span>}
                    </p>
                    <p className={styles.panelAnswer}>{panel.answer}</p>
                    {showSandboxDoor && (
                      <Link href={w.door.path} className={styles.panelLive}>
                        See this screen live →
                      </Link>
                    )}
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
