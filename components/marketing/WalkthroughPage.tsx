/**
 * THE WALKTHROUGH PAGE — one renderer, every persona's 90-second pitch.
 *
 * Plan: docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md · approved mockup:
 * https://claude.ai/code/artifact/6f16bc17-d5f3-45b6-bd03-b6df54231f15
 *
 * Extracted here when the coach walkthrough arrived (P3) — the /simplify pass that deferred a
 * shared component "until the second consumer" named exactly this moment. Everything a
 * walkthrough differs by (its story, its door, its way back, its address) is DATA in
 * lib/walkthrough-content.ts; each persona's route file is a two-line shell.
 *
 * Three renderings, one source: this scroll page, present mode (WalkthroughPresent), and the
 * print leave-behind (@media print in WalkthroughPage.module.css). A fourth persona costs a
 * content entry and a shell — never a second copy of this file.
 */
import Link from 'next/link';
import { MARKETING_SHOTS } from '@/lib/marketing-shots';
import type { Walkthrough, WalkthroughPanel } from '@/lib/walkthrough-content';
import { sandboxDoorsVisible } from '@/lib/sandbox-door';
import WalkthroughPresent, { type PresentImage, type PresentSlide } from './WalkthroughPresent';
import styles from './WalkthroughPage.module.css';

const SHOTS = new Map(MARKETING_SHOTS.map(s => [s.id, s]));

/** The address a reader types after the PDF is off the screen — no scheme, no `www.`. */
const PRINT_HOST = 'fieldlogichq.ca';

/** The picture two renderings share, plus the caption only the scroll page's figure shows. */
interface Picture {
  image: PresentImage;
  caption: string;
}

/**
 * A panel's picture, or null while it is declared but not yet captured. The null branch keeps a
 * half-built page carrying its text instead of a broken image; `check:marketing-shots` (wired
 * into verify:changed) is what stops that from becoming a silent permanent state.
 */
function pictureFor(panel: WalkthroughPanel): Picture | null {
  const shot = SHOTS.get(panel.shotId);
  if (!shot?.size) return null;
  return {
    image: {
      src: `/marketing/${shot.persona}/${shot.id}.png`,
      width: shot.size.w,
      height: shot.size.h,
      alt: shot.alt,
      narrow: shot.width <= 430, // ≤430px covers every phone capture width
    },
    caption: shot.caption,
  };
}

export default function WalkthroughPage({ walkthrough: w }: { walkthrough: Walkthrough }) {
  // Present mode renders the SAME source as the scroll page, one thought per slide:
  // hero → the panels → the closing. Slides carry data only (the client component receives
  // nothing it could not serialize).
  const slides: PresentSlide[] = [
    { eyebrow: w.eyebrow, title: w.title, body: w.sub },
    ...w.panels.map((panel, i) => {
      const picture = pictureFor(panel);
      return {
        index: `${i + 1} / ${w.panels.length}`,
        eyebrow: 'The old way',
        title: panel.pain,
        body: panel.answer,
        planTag: panel.planTag,
        image: picture?.image,
      };
    }),
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

      {/* ── The panels ───────────────────────────────────────────────────── */}
      {w.panels.map((panel, i) => {
        const picture = pictureFor(panel);
        return (
          <section key={panel.shotId} className={styles.panel}>
            <div className="container">
              <p className={styles.panelIndex}>{i + 1} / {w.panels.length}</p>
              <p className={styles.panelOld}>The old way</p>
              <h2 className={styles.panelPain}>{panel.pain}</h2>
              {picture && (
                <figure className={styles.shotFigure}>
                  <div className={`${styles.shotFrame}${picture.image.narrow ? ` ${styles.shotFrameNarrow}` : ''}`}>
                    {/* Plain <img>, matching HelpScreenshot's documented precedent: a manifest
                        asset of known size, already lazy. next/image would route every request
                        through the sharp-backed optimizer — an Amplify code path this repo has
                        been burned by once (memory/reference_sharp_turbopack_webpack.md) and
                        that no public page exercises today. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={picture.image.src}
                      width={picture.image.width}
                      height={picture.image.height}
                      alt={picture.image.alt}
                      className={styles.shotImg}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <figcaption className={styles.shotCaption}>{picture.caption}</figcaption>
                </figure>
              )}
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
