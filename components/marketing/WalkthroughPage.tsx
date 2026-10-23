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
import { cn } from '@/lib/utils';
import kit from './MarketingKit.module.css';
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
  // behind it. Both CTA rows carry the identical pair, so they cannot drift apart. The ask is the
  // page's lime button; the door is the secondary, with the live dot (no arrow on either).
  const askThenDoor = (
    <>
      <Link href="/start/tournament" className={kit.btn}>
        Start free
      </Link>
      {showSandboxDoor && (
        <Link href={w.door.path} className={cn(kit.btn, kit.btnSecondary, kit.live)}>
          {w.door.label}
        </Link>
      )}
    </>
  );

  return (
    <main className={kit.page}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={kit.hero}>
        <div className="container">
          <p className={kit.eyebrow}>{w.eyebrow}</p>
          <h1 className={kit.headline}>{w.title}</h1>
          <p className={kit.lead}>{w.sub}</p>
          <div className={cn(kit.row, styles.heroActions)}>{askThenDoor}</div>
          {/* Computed from the pull it describes (finding F3) — a hand-typed count cannot see
              the owner recomposing the page. */}
          <div className={styles.finePrint}>
            <p className={kit.small}>{derivedMeta(pulled.length)}<span className={styles.metaSep} aria-hidden="true"> ·</span></p>
            <WalkthroughPresent slides={slides} deckCount={deck.length} label={`${w.title} — presentation`} />
          </div>
        </div>
      </section>

      {/* ── The pull — the shared panel rendering (SlidePanels), which is also the print
             leave-behind's page structure, shared with the prospect deck page (stage D). */}
      <SlidePanels panels={pulled} />

      {/* ── Closing: the proof, then the ask ─────────────────────────────── */}
      <section className={cn(kit.section, styles.ctaSection)}>
        <div className="container">
          <p className={kit.eyebrow}>{w.closing.eyebrow}</p>
          <h2 className={cn(kit.heading, styles.ctaTitle)}>{w.closing.title}</h2>
          <p className={cn(kit.body, styles.ctaBody)}>{w.closing.body}</p>
          <div className={cn(kit.row, styles.heroActions)}>
            {askThenDoor}
            {/* The label is the walkthrough's own data (`back.label`): it names the product the
                persona page is about, so it differs by persona. */}
            <Link href={w.back.href} className={cn(kit.link, kit.linkBlock, styles.backLink)}>
              {w.back.label}
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
