/**
 * WHAT THE LIBRARY VIEW KNOWS — every question this screen answers, computed in one pure pass.
 *
 * Plan: docs/projects/active/PITCH_DECK_STUDIO_PLAN.md (stage A). This is the READ-ONLY half of
 * the studio and it writes nothing anywhere; the owner ruling behind that split is binding —
 * **decks are data, slides are CODE** — and a future session must not "finish the CRUD" here.
 * The reason is not preciousness: a build check compares a slide's claim against what the plans
 * actually grant, and nothing watches a sentence once it is a row in a table.
 *
 * ── ⚠⚠ WHAT THIS REPORT CAN AND CANNOT SEE. READ BEFORE ADDING A TICK ANYWHERE ────────────────
 *
 * The single most dangerous thing this screen could do is draw a green tick that means less than
 * it looks like. Its picture columns are honest only because they say what they did not check:
 *
 *  1. **A capture's health is DECLARATION health, not freshness.** `shotManifestProblems` proves a
 *     picture exists with its alt, caption and size recorded. It cannot prove the picture still
 *     resembles the screen it photographed — a failed re-capture leaves the previous PNG in place
 *     (lib/marketing-shots.ts says so in its own header), so a picture of a screen redesigned three
 *     months ago passes this and passes CI. `PICTURE_FRESHNESS_IS_UNCHECKED` below is that fact,
 *     rendered rather than hidden.
 *  2. **A DRAWING HAS NO MANIFEST ENTRY AT ALL**, so the capture-side question is meaningless for
 *     one. ⚠ Nearly half the library is drawn — not an edge case, most of a screen — and reporting
 *     them "healthy" would be four vacuous passes wearing a tick. They report `kind: 'drawing'`
 *     and the screen says so in words.
 *  3. **⚠⚠ THERE IS NO PLAN-LINE COLUMN, AND ITS ABSENCE IS THE RULE — do not build one back.**
 *     This screen originally carried one: it resolved each page panel's plan line against the live
 *     plan configuration, and the build prompt called it the highest-value column here. **The owner
 *     deleted every plan line from the pitch surfaces on 2026-08-21** — *"we don't need to mention
 *     any subscriptions here… we don't want to compartmentalize features at this stage"* — so
 *     `planTag` is gone from `WalkthroughPanel` and the column had nothing left to read.
 *
 *     The division of labour is now by SURFACE: the walkthrough creates desire, the pricing page
 *     qualifies, a human answers in the room. The invariant that replaced the column — that NO
 *     plan, tier or price appears anywhere in the pitch material — is held by
 *     `tests/unit/pitch-slide-library.test.ts`, which is the right place for it: a build check
 *     fails, whereas a column only helps someone who happens to be looking at this screen.
 */
import {
  PITCH_DECKS,
  PITCH_SLIDES,
  SLIDE_NUMBERS_SPOKEN_FOR,
  WALKTHROUGHS,
  derivedMeta,
  resolvePullIds,
  type PitchSlide,
  type SlideNumberStatus,
  type SlideImageClass,
} from '@/lib/walkthrough-content';
import type { StoredPullRead } from '@/lib/pitch-pull-store';
import { pictureFor, shotFor, shotPublicPath, type SlidePictureWithCaption } from '@/components/marketing/slide-picture';
import { shotManifestProblems, type FilePresence } from '@/lib/shot-health';
import { daysBetweenDateStrings, tournamentToday } from '@/lib/timezone';

type Audience = keyof typeof PITCH_DECKS;

/** What a deck is called on screen. One home — both the page and the card render it. */
export const AUDIENCE_LABEL: Record<Audience, string> = {
  coach: 'Coach deck',
  tournament: 'Tournament deck',
};

/** The sentence every capture card carries, so the tick above it cannot be over-read. */
export const PICTURE_FRESHNESS_IS_UNCHECKED =
  'Nothing checks whether this picture still looks like the screen it photographed. A failed ' +
  're-capture leaves the old file in place, so a stale picture passes every check we have.';

/* ── One slide ──────────────────────────────────────────────────────────────── */

/** Where a slide sits in its deck. Every built slide belongs to exactly one deck today. */
export interface DeckPlacement {
  audience: Audience;
  /** 1-based, as a human counts a running order. */
  position: number;
  of: number;
}

/** Where a slide is PUBLISHED — the thing no surface answered before this screen existed. */
export interface PagePlacement {
  path: string;
  /** 1-based position among the panels that page actually shows. */
  panel: number;
  of: number;
}

/**
 * What can be said about the picture, and it is a union because the two kinds of picture are
 * answerable by genuinely different questions rather than by one question with a gap in it.
 */
export type PictureHealth =
  | {
      kind: 'capture';
      /** The file the page requests. Reported whether or not this process can see the disk. */
      publicPath: string;
      /** Recorded pixel size, written back by the capture script. */
      size?: { w: number; h: number };
      /** The width the browser was set to — 390 where the picture's SUBJECT is a phone. */
      captureWidth: number;
      /** Where in the demo world it was taken, so a reader can go and look at the live screen. */
      demoPath: string;
      /**
       * The day the capture stamped, and how many days ago that is — `null` for a picture taken
       * before we started recording it.
       *
       * ⚠⚠ AGE IS A PROXY AND THE SCREEN MUST SAY SO. It answers WHEN, never WHETHER the picture
       * still resembles the screen. A six-month-old picture of a screen nobody has touched is
       * perfectly good; a one-week-old picture of a screen redesigned on Tuesday is not. It tells a
       * reader where to LOOK — it is not the freshness check that lib/shot-health.ts explains we do
       * not have, and it must never be dressed up as one.
       */
      takenAt: string | null;
      ageDays: number | null;
      present: FilePresence;
      problems: string[];
    }
  | {
      kind: 'drawing';
      drawingId: string;
      /**
       * Always true, and stated rather than implied: a drawing is hand-authored inline SVG with no
       * manifest entry, so the capture check has nothing to look at. The screen renders this as a
       * sentence, never as a tick.
       */
      outsideTheCaptureCheck: true;
    };

export interface SlideReport {
  slide: PitchSlide;
  imageClass: SlideImageClass;
  /** ⚠ The caption travels INSIDE this — a capture keeps it in the shot manifest, a drawing carries
   *  its own. Deliberately not lifted to a sibling field: two copies of one string is how they
   *  eventually disagree. */
  picture: SlidePictureWithCaption | null;
  deck: DeckPlacement | null;
  /**
   * Every public page that publishes this slide — resolved from the SAVED pulls where they are
   * usable, so this matches what a visitor sees right now. **Empty is the finding this screen
   * exists for.** ⚠ Finding F4 is CLOSED (stage B): every slide carries its own `pageAnswer` and
   * `seoPhrase` in code, so "on no page" now means exactly one thing — the owner has not picked
   * it — and any deck slide can be added to its page's pull and simply work.
   */
  pages: PagePlacement[];
  health: PictureHealth;
}

/* ── One deck ───────────────────────────────────────────────────────────────── */

/**
 * One slot in a deck's running order.
 *
 * ⚠ Named rather than inlined on `DeckReport` so `state` keeps its literal union: built inside an
 * un-contextualised `.map()`, an inline object type lets `state` widen to `string`.
 */
export interface DeckSlot {
  id: string;
  /**
   * `built` and `planned` are legitimate; everything else is a HOLE in the running order and is
   * reported as a problem too. ⚠ `held` and `retired` are distinguishable from `missing` only
   * because the register carries a status — a deck naming a held number is a different mistake
   * (someone reached for the club deck early) from one naming a number that never existed.
   */
  state: SlideNumberStatus | 'built' | 'missing';
  /** True where the public page shows this slide, so the pull is visible against the deck. */
  onPage: boolean;
}

export interface DeckReport {
  audience: Audience;
  /** Every id in the running order, with what the bank actually holds for it. */
  order: DeckSlot[];
  built: number;
  /**
   * The page this deck is published on, and how much of the deck it shows — resolved the same
   * way the page itself resolves it (saved row or code fallback), so this screen and the public
   * page can never describe two different pulls. `meta` is derived, because the page's is.
   */
  page: {
    path: string;
    shows: number;
    meta: string;
    /** Whether the page is currently rendering the owner's saved pull or the code default. */
    source: 'saved' | 'code';
    savedAt: string | null;
    savedBy: string | null;
    /**
     * ⚠ True when the STORE could not be read at all — a different sentence from "no row
     * saved", because the page falls back identically for both and only this screen can tell
     * the owner which one is happening.
     */
    storeUnreachable: boolean;
  } | null;
  /**
   * F5 made real: a deck naming a spent number, and — since the pull is a row — a SAVED pull
   * naming ids the deck or bank no longer holds. The page silently drops those; this screen
   * says so out loud.
   */
  problems: string[];
}

export interface PitchLibraryReport {
  slides: SlideReport[];
  decks: DeckReport[];
  /** Gaps in the number line, in order, each with the reason it is spent. */
  reserved: { id: string; why: string }[];
  totals: {
    slides: number;
    photographed: number;
    drawn: number;
    /**
     * ⚠ The headline number — and read its NAME carefully. These slides are in a deck and reachable
     * by anyone who presses "Present the full deck" in either page's hero; what they are outside is
     * the SCROLLING page. An earlier version of this screen called them "reachable nowhere", which
     * was false — the same class of self-description error this whole project exists to stop.
     */
    onNoPage: number;
    withProblems: number;
    /**
     * The age of the oldest picture we hold, in days — `null` while no picture carries a date.
     *
     * ⚠ A TILE RATHER THAN A THRESHOLD, on purpose. Every picture in the library is days old today,
     * so a "3 pictures are stale" counter would read 0 for months and teach a reader to ignore it.
     * The worst case as a real number stays informative from day one and needs no invented cutoff.
     */
    oldestPictureDays: number | null;
  };
}

function healthOf(
  slide: PitchSlide,
  fileIsPresent: (publicPath: string) => FilePresence,
  today: string,
): PictureHealth {
  if (slide.drawingId) {
    return { kind: 'drawing', drawingId: slide.drawingId, outsideTheCaptureCheck: true };
  }
  const shot = shotFor(slide);
  // Unreachable while the guard test holds ("a picture a slide names actually exists in the shot
  // manifest"), and reported rather than thrown: a studio that crashes is a worse way to learn a
  // manifest entry was renamed than a studio that says so.
  if (!shot) {
    return {
      kind: 'capture',
      publicPath: '—',
      captureWidth: 0,
      demoPath: '—',
      takenAt: null,
      ageDays: null,
      present: null,
      problems: [`names shot "${slide.shotId}", which the manifest does not declare`],
    };
  }
  const publicPath = shotPublicPath(shot);
  const present = fileIsPresent(publicPath);
  return {
    kind: 'capture',
    publicPath,
    size: shot.size,
    captureWidth: shot.width,
    demoPath: shot.path,
    takenAt: shot.takenAt ?? null,
    // `daysBetweenDateStrings` rather than date arithmetic: both sides are already calendar-day
    // strings in the org's zone, which is the only comparison that means the same thing on a
    // dev machine and on a UTC server.
    ageDays: shot.takenAt ? daysBetweenDateStrings(shot.takenAt, today) : null,
    present,
    problems: shotManifestProblems(shot, { present, where: `public${publicPath}` }),
  };
}

/**
 * Build the whole report.
 *
 * @param fileIsPresent whether a picture file is on disk. Returning `null` means NOT DETERMINED —
 *   see lib/shot-health.ts. The caller owns this because `public/` is served by the platform's
 *   static layer and is not guaranteed to sit on a request handler's filesystem; a studio that
 *   read "cannot see it" as "missing" would paint thirteen false alarms on a healthy deploy.
 * @param storedPulls what pitch_page_pulls holds per persona (stage B). The caller fetches, this
 *   stays a pure pass — and the report resolves each pull with the SAME `resolvePullIds` the
 *   public page uses, so the two surfaces cannot disagree about what is showing.
 */
export function buildPitchLibraryReport(
  fileIsPresent: (publicPath: string) => FilePresence,
  storedPulls: Record<Audience, StoredPullRead>,
): PitchLibraryReport {
  const today = tournamentToday();

  // Which deck names a slide, and where in the running order. Built once so the per-slide pass is
  // a lookup rather than a scan of both decks per slide.
  const placement = new Map<string, DeckPlacement>();
  for (const [audience, ids] of Object.entries(PITCH_DECKS) as [Audience, string[]][]) {
    ids.forEach((id, i) => placement.set(id, { audience, position: i + 1, of: ids.length }));
  }

  // Each page's pull, resolved exactly as the page resolves it: the saved row where one is
  // usable, the code fallback where it is not. Kept beside the walkthrough so the deck pass
  // below reads the same resolution the placement map was built from.
  const resolvedPulls = new Map(
    WALKTHROUGHS.map(w => [
      w.persona,
      resolvePullIds(w.persona, storedPulls[w.persona]?.row?.slideIds ?? null),
    ]),
  );

  // Where a slide is PUBLISHED. A slide can in principle appear on more than one page — the save
  // path forbids a page pulling the same slide twice, not two pages pulling the same slide — so
  // this is a list, and a slide published in two places would be visible here.
  const published = new Map<string, PagePlacement[]>();
  for (const w of WALKTHROUGHS) {
    const pull = resolvedPulls.get(w.persona)!.ids;
    pull.forEach((slideId, i) => {
      const at: PagePlacement = { path: w.path, panel: i + 1, of: pull.length };
      published.set(slideId, [...(published.get(slideId) ?? []), at]);
    });
  }

  const slides: SlideReport[] = (Object.values(PITCH_SLIDES) as PitchSlide[])
    // Library number order, so the GAPS in it are visible — this is a contact sheet of everything
    // we own, not a running order. The decks above carry the running orders.
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(slide => {
      const pages = published.get(slide.id) ?? [];
      const shown = pictureFor(slide);
      return {
        slide,
        imageClass: slide.imageClass,
        picture: shown,
        deck: placement.get(slide.id) ?? null,
        pages,
        health: healthOf(slide, fileIsPresent, today),
      };
    });

  const pageFor = new Map(WALKTHROUGHS.map(w => [w.persona, w]));
  const decks: DeckReport[] = (Object.entries(PITCH_DECKS) as [Audience, string[]][]).map(([audience, ids]) => {
    const w = pageFor.get(audience);
    const resolved = resolvedPulls.get(audience);
    const stored = storedPulls[audience];
    // Widened to `string` deliberately: a deck's running order is `string[]` (it may name a number
    // the bank does not hold — that is finding F5), and a SAVED pull is data with no type at all.
    // Asking the narrow set about a wide id is the whole question this screen answers.
    const onPage: Set<string> = new Set(resolved?.ids ?? []);
    const order: DeckSlot[] = ids.map(id => ({
      id,
      state: id in PITCH_SLIDES ? 'built' : SLIDE_NUMBERS_SPOKEN_FOR[id]?.status ?? 'missing',
      onPage: onPage.has(id),
    }));
    return {
      audience,
      order,
      built: order.filter(o => o.state === 'built').length,
      page: w && resolved
        ? {
            path: w.path,
            shows: resolved.ids.length,
            meta: derivedMeta(resolved.ids.length),
            source: resolved.source,
            savedAt: resolved.source === 'saved' ? stored?.row?.updatedAt ?? null : null,
            savedBy: resolved.source === 'saved' ? stored?.row?.updatedBy ?? null : null,
            storeUnreachable: stored?.error ?? false,
          }
        : null,
      problems: [
        ...order
          .filter(o => o.state !== 'built' && o.state !== 'planned')
          .map(o => o.state === 'missing'
            ? `names ${o.id}, which holds no slide — it would vanish silently from this running order`
            : `names ${o.id}, which is ${o.state} (${SLIDE_NUMBERS_SPOKEN_FOR[o.id]?.note ?? 'no reason recorded'})`),
        // The rot only this screen can show: a SAVED pull naming ids the deck or bank no longer
        // holds. The public page drops them silently — that is correct for a prospect and wrong
        // for the owner, so they surface here (F5's write half, seen from the read side).
        ...(resolved?.dropped ?? []).map(id =>
          `the saved pull names ${id}, which the ${audience} deck no longer offers — the page skips it silently`),
        // A saved row that resolved to NOTHING usable is a louder version of the same problem:
        // the owner believes a composition is live and the page is on the code default.
        ...(stored?.row && resolved?.source === 'code'
          ? ['a pull is saved but none of it is usable — the page is showing the code default instead']
          : []),
      ],
    };
  });

  return {
    slides,
    decks,
    reserved: Object.entries(SLIDE_NUMBERS_SPOKEN_FOR)
      // A `planned` number is not a gap — it is a slot with artwork on the way, and the deck it
      // belongs to already shows it in its running order with a '…'.
      .filter(([, e]) => e.status !== 'planned')
      .map(([id, e]) => ({ id, why: e.note }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    totals: {
      slides: slides.length,
      /**
       * ⚠ A TILE COUNTS WHAT IT SAYS, and "photographed" must mean a photograph EXISTS — not
       * that one was declared. A slide whose manifest entry has alt and caption but no recorded
       * `size` yet is a normal mid-pipeline state (the manifest's own comments call it "declared
       * but not yet captured"): `healthOf` still calls it a capture, but `pictureFor` returns null
       * and its card renders "No picture resolves for this slide" over an empty stage. Counting it
       * under Photographed would be this screen's own cardinal sin — a number meaning less than it
       * looks like — on the tile a reader trusts most.
       *
       * So these two deliberately need NOT sum to `slides`: the shortfall is exactly the slides
       * with no picture, and `withProblems` already carries every one of them in amber.
       */
      photographed: slides.filter(s => s.health.kind === 'capture' && s.picture).length,
      drawn: slides.filter(s => s.health.kind === 'drawing' && s.picture).length,
      onNoPage: slides.filter(s => s.pages.length === 0).length,
      withProblems: slides.filter(s => s.health.kind === 'capture' && s.health.problems.length > 0).length,
      oldestPictureDays: slides.reduce<number | null>((oldest, s) => {
        const age = s.health.kind === 'capture' ? s.health.ageDays : null;
        return age === null ? oldest : oldest === null ? age : Math.max(oldest, age);
      }, null),
    },
  };
}
