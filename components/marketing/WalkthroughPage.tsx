/**
 * THE WALKTHROUGH PAGE — one renderer, every persona's 90-second pitch.
 *
 * Plan: docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md (the library this now renders from)
 * · docs/projects/active/PRESALES_WALKTHROUGH_PLAN.md (the page itself)
 * · the format: https://claude.ai/code/artifact/b1706db6-8f65-43d1-a5c7-39ffa722300f
 *
 * Everything a walkthrough differs by (its door, its way back, its address, its fallback pull)
 * is DATA in lib/walkthrough-content.ts; each persona's route file is a shell that also resolves
 * WHICH slides to show — the owner's saved pull, or the code fallback (stage B) — and hands it
 * in as `pull`.
 *
 * Three renderings, one source: this scroll page, present mode (WalkthroughPresent), and the
 * print leave-behind (@media print). A fourth persona costs a content entry and a shell.
 *
 * ⚠ THE PAGE IS NOT THE DECK, and the difference is one line of copy each way. A slide's short
 * `claim` speaks with a human in the room; its `pageAnswer` is the unattended version this page
 * shows, with the qualifications a deck doesn't need. Neither names a plan, tier or price
 * anywhere (owner ruling 2026-08-21).
 */
import Link from 'next/link';
import {
  PITCH_SLIDES,
  builtSlides,
  derivedMeta,
  type PitchSlide,
  type SlideId,
  type Walkthrough,
} from '@/lib/walkthrough-content';
import { sandboxDoorsVisible } from '@/lib/sandbox-door';
import { pictureFor } from './slide-picture';
import SlidePanels from './SlidePanels';
import WalkthroughPresent, { type PresentSlide } from './WalkthroughPresent';
import styles from './WalkthroughPage.module.css';

/** The address a reader types after the PDF is off the screen — no scheme, no `www.`. */
const PRINT_HOST = 'fieldlogichq.ca';

export default function WalkthroughPage({
  walkthrough: w,
  deckIds,
  pull,
}: {
  walkthrough: Walkthrough;
  /** The resolved DECK running order (saved row or code fallback — stage C). Present mode
   *  renders this; unbuilt ids in it render nothing. */
  deckIds: string[];
  /** The resolved pull — the route decides saved-vs-fallback; this component just renders it. */
  pull: SlideId[];
}) {
  /**
   * ⚠ EVERY SLIDE'S PICTURE IS RESOLVED EXACTLY ONCE, and that is an invariant rather than a
   * micro-optimisation. The scroll panel and the deck must picture the same slide identically;
   * resolving it twice is how they would eventually stop. (This was the original code's stated
   * guarantee, and making present mode render the deck rather than the pull briefly broke it —
   * the pull's six slides were being resolved a second time inside the deck map.)
   *
   * ⚠ The pull is normalised against the LIVE deck upstream, but "never blank" outranks
   * "always a subset" (see resolvePullIds), so a degenerate deck row can leave a fallback pull
   * slide outside `deckIds` — hence the pull map below keeps its own PITCH_SLIDES lookup as
   * well as this shared picture map.
   */
  const deck = builtSlides(deckIds);
  const shownFor = new Map(deck.map(slide => [slide.id, pictureFor(slide)]));
  // The degenerate case named above: a pull slide the live deck no longer holds still gets its
  // picture resolved ONCE, into the same map, rather than rendering words over an empty stage.
  for (const id of pull) {
    if (!shownFor.has(id)) shownFor.set(id, pictureFor(PITCH_SLIDES[id]));
  }

  // The scroll page's short PULL — a subset of the deck, in deck order. The FALLBACK list is
  // guard-tested; an owner-saved one went through the same `pullProblems` rulebook at save time,
  // and `resolvePullIds` has already dropped anything that rotted since — so by here every id
  // resolves, and the page shows each slide's own unattended `pageAnswer`.
  const pulled = pull.map(id => {
    const slide: PitchSlide = PITCH_SLIDES[id];
    return { slide, shown: shownFor.get(slide.id) ?? null };
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
          {/* Computed from the pull it describes (finding F3) — a hand-typed count cannot see
              the owner recomposing the page. */}
          <p className={styles.heroMeta}>{derivedMeta(pulled.length)}</p>
          <WalkthroughPresent slides={slides} deckCount={deck.length} label={`${w.title} — presentation`} />
        </div>
      </section>

      {/* ── The pull — the shared panel rendering (SlidePanels), which is also the print
             leave-behind's page structure, shared with the prospect deck page (stage D). */}
      <SlidePanels panels={pulled} />

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
