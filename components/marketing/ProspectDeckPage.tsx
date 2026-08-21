/**
 * THE PROSPECT DECK PAGE — an owner-composed deck on its unlisted link (Deck Studio stage D).
 *
 * Rendered at /pitch/<slug>. The slug is the whole gate: unguessable, `noindex`, no login —
 * a prospect on a call cannot be asked to sign in (owner ruling 2, accepted knowingly; it is
 * marketing material and carries no customer data).
 *
 * ⚠⚠ NOTHING PER-PROSPECT RENDERS HERE. The deck's name is the owner's INTERNAL label and its
 * purpose is internal too — neither reaches this page, so the public rendering can never name
 * the prospect or any real organization. That is ruling 2 held by construction rather than by
 * discipline: the component does not receive the strings at all.
 *
 * ⚠ Every sentence on this page is FIXED CODE COPY or a slide's own build-checked copy — no
 * free text from the composer, ever. And no sentence claims the pictures are all real captures
 * (drawings sit in most decks): the closing is the same invitation-not-denial the walkthrough
 * pages settled on 2026-08-21.
 *
 * Same three renderings as the walkthrough page, same source: this scroll page, present mode,
 * and the print leave-behind — the PDF is this page printed (Save as PDF), which is why it
 * reuses WalkthroughPage.module.css verbatim: the @media print layout IS the deck's PDF.
 */
import Link from 'next/link';
import { derivedMeta, type PitchSlide } from '@/lib/walkthrough-content';
import { pictureFor } from './slide-picture';
import SlidePanels from './SlidePanels';
import WalkthroughPresent, { type PresentSlide } from './WalkthroughPresent';
import styles from './WalkthroughPage.module.css';

/** The address a reader types after the PDF is off the screen — no scheme, no `www.`. */
const PRINT_HOST = 'fieldlogichq.ca';

/** Fixed page furniture — persona-neutral (a deck may mix audiences) and prospect-free. */
const HERO = {
  eyebrow: 'FieldLogicHQ · a walkthrough',
  title: 'The jobs that stop being yours.',
  sub: 'A handful of screens, picked for one conversation — and a live demo behind every one of them.',
};

const CLOSING = {
  eyebrow: 'That was the pitch. Here’s the proof.',
  title: 'The demo is running right now.',
  // The invitation, never the "not a mockup" denial — see the long note on the walkthrough
  // closings; it applies here identically and pre-emptively.
  body: 'Walk the live demos yourself — nothing to sign up for, nothing you can break.',
};

export default function ProspectDeckPage({ slides }: { slides: PitchSlide[] }) {
  // Every slide's picture resolved exactly once, shared by the scroll panels and present mode —
  // the walkthrough page's stated invariant, kept here for the same reason.
  const shownFor = new Map(slides.map(slide => [slide.id, pictureFor(slide)]));

  const present: PresentSlide[] = [
    { eyebrow: HERO.eyebrow, title: HERO.title, body: HERO.sub },
    ...slides.map((slide, i) => ({
      index: `${i + 1} / ${slides.length}`,
      eyebrow: 'The old way',
      title: slide.pain,
      body: slide.claim,
      picture: shownFor.get(slide.id)?.picture,
    })),
    { eyebrow: CLOSING.eyebrow, title: CLOSING.title, body: CLOSING.body },
  ];

  return (
    <main className="bg-pitch-black min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className="container">
          <p className={styles.heroEyebrow}>{HERO.eyebrow}</p>
          <h1 className={styles.heroTitle}>{HERO.title}</h1>
          <p className={styles.heroSub}>{HERO.sub}</p>
          <p className={styles.heroMeta}>{derivedMeta(slides.length)}</p>
          <WalkthroughPresent
            slides={present}
            deckCount={slides.length}
            label="A FieldLogicHQ walkthrough — presentation"
          />
        </div>
      </section>

      {/* ── The deck, one problem per panel — the walkthrough pages' own panel rendering
             (SlidePanels), so the prospect PDF and the walkthrough PDF cannot drift apart. It
             shows each slide's UNATTENDED answer, which is right here too: a prospect opens
             this link alone. */}
      <SlidePanels panels={slides.map(slide => ({ slide, shown: shownFor.get(slide.id) ?? null }))} />

      {/* ── Closing: the proof, then the ask ─────────────────────────────── */}
      <section className={styles.ctaSection}>
        <div className="container">
          <p className={styles.heroEyebrow}>{CLOSING.eyebrow}</p>
          <h2 className={styles.ctaTitle}>{CLOSING.title}</h2>
          <p className={styles.ctaBody}>{CLOSING.body}</p>
          <div className={styles.heroActions}>
            <Link
              href="/demos"
              className="font-mono text-xs font-bold uppercase tracking-widest bg-logic-lime text-pitch-black px-8 py-4 hover:bg-white transition-colors"
            >
              Walk the demos
            </Link>
          </div>
          {/* The leave-behind carries its own way back: buttons don't survive a PDF, an
              address does. Hidden on screen, shown only in print. */}
          <p className={styles.printUrl}>{PRINT_HOST}/demos</p>
        </div>
      </section>

    </main>
  );
}
