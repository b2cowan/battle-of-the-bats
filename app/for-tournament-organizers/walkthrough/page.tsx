import Link from 'next/link';
import type { Metadata } from 'next';
import { MARKETING_SHOTS } from '@/lib/marketing-shots';
import { TOURNAMENT_WALKTHROUGH } from '@/lib/walkthrough-content';
import { SEE_IT_LIVE_PATH, sandboxDoorsVisible } from '@/lib/sandbox-door';
import Present, { type PresentSlide } from './Present';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'The 90-Second Walkthrough for Tournament Organizers — FieldLogicHQ',
  description:
    'Five jobs that stop being yours the day the tournament runs on FieldLogicHQ — live scores families check themselves, volunteer score entry, one-action rain delays, self-building brackets, and registration health. Real screens, not a brochure.',
  alternates: { canonical: '/for-tournament-organizers/walkthrough' },
};

const W = TOURNAMENT_WALKTHROUGH;
const SHOTS = new Map(MARKETING_SHOTS.map(s => [s.id, s]));

// Present mode renders the SAME source as the scroll page, one thought per slide:
// hero → the panels → the closing. Slides carry data only (the client component
// receives nothing it could not serialize).
const SLIDES: PresentSlide[] = [
  { eyebrow: W.eyebrow, title: W.title, body: W.sub },
  ...W.panels.map((panel, i) => {
    const shot = SHOTS.get(panel.shotId);
    return {
      index: `${i + 1} / ${W.panels.length}`,
      eyebrow: 'The old way',
      title: panel.pain,
      body: panel.answer,
      planTag: panel.planTag,
      image: shot?.size
        ? {
            src: `/marketing/${shot.persona}/${shot.id}.png`,
            width: shot.size.w,
            height: shot.size.h,
            alt: shot.alt,
            narrow: shot.width <= 430,
          }
        : undefined,
    };
  }),
  { eyebrow: W.closing.eyebrow, title: W.closing.title, body: W.closing.body },
];

export default function TournamentWalkthroughPage() {
  // Same gate, same posture as the persona pages: the walkthrough is the pitch, the demo is the
  // proof one step behind it, and signup stays the ask. When the doors are dark, the panels still
  // stand on their pictures — only the door links go.
  const showSandboxDoor = sandboxDoorsVisible();
  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>{W.eyebrow}</p>
          <h1 className={styles.heroTitle}>{W.title}</h1>
          <p className={styles.heroSub}>{W.sub}</p>
          <div className={styles.heroActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start free
            </Link>
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_PATH} className={styles.seeItLive}>
                <span className={styles.seeItLiveDot} aria-hidden="true" />
                {W.doorLabel}
              </Link>
            )}
          </div>
          <p className={styles.heroMeta}>{W.meta}</p>
          <Present slides={SLIDES} label={`${W.title} — presentation`} />
        </div>
      </section>

      {/* ── The panels ───────────────────────────────────────────────────── */}
      {W.panels.map((panel, i) => {
        const shot = SHOTS.get(panel.shotId);
        return (
          <section key={panel.shotId} className={styles.panel}>
            <div className="container">
              <p className={styles.panelIndex}>{i + 1} / {W.panels.length}</p>
              <p className={styles.panelOld}>The old way</p>
              <h2 className={styles.panelPain}>{panel.pain}</h2>
              {/* A declared-but-not-yet-captured picture renders nothing — the text carries the
                  panel rather than a broken image carrying the page. check:marketing-shots is
                  what keeps this branch from being a silent permanent state. */}
              {shot?.size && (
                <figure className={styles.shotFigure}>
                  {/* A capture taken at phone width IS the phone experience — it displays at
                      phone size (≤430px covers every phone capture width) rather than blowing
                      up soft to the container. */}
                  <div className={`${styles.shotFrame}${shot.width <= 430 ? ` ${styles.shotFrameNarrow}` : ''}`}>
                    {/* Plain <img>, matching HelpScreenshot's documented precedent: a manifest
                        asset of known size, already lazy. next/image would route every request
                        through the sharp-backed optimizer — an Amplify code path this repo has
                        been burned by once (memory/reference_sharp_turbopack_webpack.md) and
                        that no public page exercises today. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/marketing/${shot.persona}/${shot.id}.png`}
                      width={shot.size.w}
                      height={shot.size.h}
                      alt={shot.alt}
                      className={styles.shotImg}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <figcaption className={styles.shotCaption}>{shot.caption}</figcaption>
                </figure>
              )}
              <p className={styles.panelNew}>
                With FieldLogicHQ
                {panel.planTag && <span className={styles.planTag}>{panel.planTag}</span>}
              </p>
              <p className={styles.panelAnswer}>{panel.answer}</p>
              {showSandboxDoor && (
                <Link href={SEE_IT_LIVE_PATH} className={styles.panelLive}>
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
          <p className={styles.heroEyebrow}>{W.closing.eyebrow}</p>
          <h2 className={styles.ctaTitle}>{W.closing.title}</h2>
          <p className={styles.ctaBody}>{W.closing.body}</p>
          <div className={styles.heroActions}>
            <Link
              href="/auth/signup"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Start free
            </Link>
            {showSandboxDoor && (
              <Link href={SEE_IT_LIVE_PATH} className={styles.seeItLive}>
                <span className={styles.seeItLiveDot} aria-hidden="true" />
                {W.doorLabel}
              </Link>
            )}
            <Link href="/for-tournament-organizers" className={styles.backLink}>
              Everything else it does →
            </Link>
          </div>
          {/* The leave-behind carries its own way back: buttons don't survive a PDF, an
              address does. Hidden on screen, shown only in print. */}
          <p className={styles.printUrl}>fieldlogichq.ca/for-tournament-organizers/walkthrough</p>
        </div>
      </section>

    </main>
  );
}
