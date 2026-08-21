/**
 * A SLIDE → ITS PICTURE. One resolution, every surface that shows a pitch slide.
 *
 * Lifted out of WalkthroughPage.tsx when the Pitch Deck Studio's library view became a second
 * reader (Deck Studio stage A, 2026-08-21). The alternative was for the studio to rebuild
 * `/marketing/<persona>/<id>.png` and re-derive the enlargement rule from the manifest itself —
 * i.e. a second answer to "how big may this be drawn?", on the one screen whose entire job is to
 * tell the owner what the public pages are showing. A contact sheet that pictures a slide
 * differently from the page is worse than no contact sheet.
 *
 * Everything editorial stays where it was: WHAT is photographed lives in lib/marketing-shots.ts,
 * WHICH slides exist lives in lib/walkthrough-content.ts, and how a picture is FRAMED lives in
 * SlideStage.tsx. This module only joins a slide to its picture.
 */
import { MARKETING_SHOTS } from '@/lib/marketing-shots';
import type { PitchSlide } from '@/lib/walkthrough-content';
import { drawingSize } from './SlideDrawings';
import type { SlidePicture } from './SlideStage';

const SHOTS = new Map(MARKETING_SHOTS.map(s => [s.id, s]));

/** The manifest entry behind a photographed slide — undefined for a drawing, which has none. */
export function shotFor(slide: PitchSlide) {
  return slide.shotId ? SHOTS.get(slide.shotId) : undefined;
}

/**
 * Where a capture's file lives under `public/`. ⚠ The ONE place this convention is written down:
 * the studio reports on the same path the page requests, rather than spelling out a second copy
 * that could quietly diverge and report a healthy file the page never asks for.
 */
export function shotPublicPath(shot: { persona: string; id: string }): string {
  return `/marketing/${shot.persona}/${shot.id}.png`;
}

/** The picture two renderings share, plus the caption only the scroll page's figure shows. */
export interface SlidePictureWithCaption {
  picture: SlidePicture;
  caption: string;
}

/**
 * Captures are taken at double density, so a picture holds twice the pixels of its recorded
 * (CSS) size. That headroom is what lets a small crop grow to fill the stage and stay sharp.
 * Kept in step with the capture context's `deviceScaleFactor` in scripts/lib/shot-capture.mjs.
 */
const CAPTURE_DENSITY = 2;

/** ≤430px covers every capture whose SUBJECT is the phone experience. */
const PHONE_CAPTURE_WIDTH = 430;

/**
 * How large a picture may be drawn.
 *
 * ⚠ TWO DIFFERENT RULES, AND CONFLATING THEM COSTS LEGIBILITY. A capture taken at phone width
 * IS the phone experience — enlarged on a desktop it stops looking like a phone and starts
 * claiming to be a desktop app, so it never grows past the size it was taken. A DESKTOP capture
 * with a tight crop (the playoff bracket is 480px of bracket) misrepresents nothing by being
 * bigger; it was simply cropped small. It may grow to fill the stage, bounded by the pixels it
 * actually has — so it can never be drawn softer than 1:1.
 */
function maxRenderWidth(shot: { width: number; size: { w: number } }): number {
  return shot.width <= PHONE_CAPTURE_WIDTH ? shot.size.w : shot.size.w * CAPTURE_DENSITY;
}

/**
 * A slide's picture, or null while it is declared but not yet captured. The null branch keeps a
 * half-built page carrying its text instead of a broken image; `check:marketing-shots` (wired
 * into verify:changed) is what stops that from becoming a silent permanent state.
 */
export function pictureFor(slide: PitchSlide): SlidePictureWithCaption | null {
  // A DRAWING first (P2b): it is inline SVG, so there is nothing to look up and nothing that can
  // be missing at runtime — `drawingId` is typed against the registry's own key set, and its alt
  // and caption travel with the slide because a drawing has no manifest entry to keep them in.
  if (slide.drawingId) {
    return {
      picture: {
        kind: 'drawing',
        drawingId: slide.drawingId,
        ...drawingSize(slide.drawingId),
        alt: slide.alt,
      },
      caption: slide.caption,
    };
  }
  const shot = shotFor(slide);
  if (!shot?.size) return null;
  return {
    picture: {
      kind: 'capture',
      src: shotPublicPath(shot),
      width: shot.size.w,
      height: shot.size.h,
      maxWidth: maxRenderWidth({ width: shot.width, size: shot.size }),
      alt: shot.alt,
      rings: slide.rings,
    },
    caption: shot.caption,
  };
}
