/**
 * WHAT A MACHINE CAN HONESTLY SAY ABOUT A CAPTURED PICTURE — one implementation, two callers.
 *
 * `scripts/lib/shot-capture.mjs --check` (wired into `verify:changed`) has always asked these
 * four questions of every entry in `lib/marketing-shots.ts` and `lib/help-shots.ts`. The Pitch
 * Deck Studio's library view asks the SAME four, of the same manifest, and had to be able to ask
 * them without dragging Playwright into the Next bundle — the capture core imports a browser at
 * module scope. So the rules moved here and both callers read them; the studio does not own a
 * second, quietly diverging copy of "is this picture alright?".
 *
 * ⚠⚠ AND HERE IS WHAT THESE FOUR QUESTIONS DO NOT ANSWER, WHICH MATTERS MORE THAN WHAT THEY DO.
 *
 * They prove a picture EXISTS with its words and its size recorded. They cannot prove it still
 * looks like the screen it photographed. `lib/marketing-shots.ts` states the mechanism in its own
 * header: a failed capture LEAVES THE PREVIOUS PNG IN PLACE, so a picture of a screen that was
 * redesigned three months ago passes every one of these and passes CI. A green result here means
 * "declared properly", never "still true".
 *
 * Any surface reporting these results has to say so rather than drawing a tick — the studio's
 * library view does. Closing the real gap needs a re-capture-and-compare, which is a separate
 * piece of work and must not be mistaken for this one.
 *
 * ⚠ A DRAWING HAS NO MANIFEST ENTRY AT ALL, so none of this applies to one. Nearly half the
 * pitch slides are hand-drawn inline SVG (`components/marketing/SlideDrawings.tsx`); asking these
 * questions of them would return four vacuous passes. A caller must branch on the slide's kind
 * before it gets here — `PitchSlide` is a discriminated union precisely so it can.
 */

/** The fields both manifests share, and the only ones these questions read. */
export interface ShotManifestEntry {
  id: string;
  size?: { w: number; h: number };
  /** The day the picture was last taken, `YYYY-MM-DD`. Stamped by the capture, never typed. */
  takenAt?: string;
  alt?: string;
  caption?: string;
}

/**
 * Whether the picture file is actually on disk.
 *
 * `null` is not "no" — it is **not determined by this caller**, and the distinction is
 * load-bearing. The build check reads the repo's own working tree and always knows. A running
 * server may not be able to: `public/` is served by the platform's static layer and is not
 * guaranteed to be on the request handler's filesystem, so a deployed studio that treated
 * "cannot see it" as "missing" would paint thirteen false alarms.
 */
export type FilePresence = boolean | null;

/**
 * Everything wrong with one manifest entry, in the order the build check has always reported it.
 * Messages are BARE — no id prefix — so each caller can present them its own way.
 */
export function shotManifestProblems(
  shot: ShotManifestEntry,
  file: { present: FilePresence; where: string },
): string[] {
  const problems: string[] = [];
  // Chained on purpose, and it is the original order of business: with no file at all, "the
  // manifest has no size" is a second symptom of the same cause, and reporting both sends the
  // reader after two problems. `null` (undetermined) falls through to the size question, which
  // is answerable from the manifest alone wherever this runs.
  if (file.present === false) problems.push(`no image at ${file.where}`);
  else if (!shot.size) problems.push('manifest has no size — re-run the capture so the page can reserve its space');
  if (!shot.alt?.trim()) problems.push('no alt text');
  if (!shot.caption?.trim()) problems.push('no caption');
  return problems;
}
