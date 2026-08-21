/**
 * THE SLIDE LIBRARY'S OWN INTEGRITY — the four ways this data can go quietly wrong.
 *
 * The library's whole value is that a slide's PERMANENT NUMBER survives the product changing
 * underneath it. That only holds if nothing renumbers, nothing dangles, and a page's short pull
 * is genuinely a pull FROM its deck rather than a second hand-written list — which is exactly
 * what this project replaced.
 *
 * Plan: docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKETING_SHOTS } from '../../lib/marketing-shots.ts';
import {
  PITCH_DECKS,
  PITCH_SLIDES,
  PLANNED_SLIDES,
  WALKTHROUGHS,
  deckSlides,
  type PitchSlide,
} from '../../lib/walkthrough-content.ts';

const SHOT_IDS = new Set(MARKETING_SHOTS.map(s => s.id));

// `PITCH_SLIDES` is declared with `satisfies`, which keeps each entry's EXACT shape so the key
// set stays literal. Reading it back as the interface is what lets these tests ask about the
// optional fields (`rings`, `shotId`) that a given entry may not carry.
const SLIDES: PitchSlide[] = Object.values(PITCH_SLIDES);

test('a slide is keyed by its own permanent number', () => {
  for (const [key, slide] of Object.entries<PitchSlide>(PITCH_SLIDES)) {
    assert.equal(slide.id, key, `${key} is filed under a different id than it carries`);
    assert.match(key, /^#\d\d$/, `${key} is not a library number`);
  }
});

test('every id a deck names is either built or explicitly planned — and never both', () => {
  for (const [audience, ids] of Object.entries(PITCH_DECKS)) {
    for (const id of ids) {
      const built = id in PITCH_SLIDES;
      const planned = id in PLANNED_SLIDES;
      assert.ok(built || planned, `${audience} deck names ${id}, which is neither built nor planned`);
      assert.ok(!(built && planned), `${id} is both built and listed as planned — remove the planned entry`);
      // A planned slot says what it is FOR. Without this the register decays into a bare id
      // list and stops telling the next session what it is meant to build there.
      if (planned) assert.ok(PLANNED_SLIDES[id].trim(), `${id} is planned but says nothing about what it is`);
    }
    assert.equal(new Set(ids).size, ids.length, `${audience} deck names the same slide twice`);
  }
});

test('a library number is never reused across decks', () => {
  const seen = new Map<string, string>();
  for (const [audience, ids] of Object.entries(PITCH_DECKS)) {
    for (const id of ids) {
      const already = seen.get(id);
      assert.equal(already, undefined, `${id} appears in both the ${already} and ${audience} decks`);
      seen.set(id, audience);
    }
  }
});

test('a picture a slide names actually exists in the shot manifest', () => {
  for (const slide of SLIDES) {
    if (!slide.shotId) continue;
    assert.ok(SHOT_IDS.has(slide.shotId), `${slide.id} names shot "${slide.shotId}", which the manifest does not declare`);
  }
});

test('a composed or explainer slide is never silently a bare capture, and rings stay within the picture', () => {
  for (const slide of SLIDES) {
    // Format rule 3: "if a crop needs more than two callout rings, it's two slides".
    assert.ok((slide.rings?.length ?? 0) <= 2, `${slide.id} carries more than two rings — that is two slides`);
    for (const ring of slide.rings ?? []) {
      assert.ok(ring.left >= 0 && ring.left + ring.width <= 100, `${slide.id} has a ring off the side of its picture`);
      assert.ok(ring.top >= 0 && ring.top + ring.height <= 100, `${slide.id} has a ring off the top or bottom of its picture`);
    }
    // A drawn explainer must never claim to be a capture (the forbidden fourth class).
    if (slide.imageClass === 'explainer') {
      assert.equal(slide.shotId, undefined, `${slide.id} is an explainer but names a real capture`);
    }
  }
});

test('NO PLAN OR SUBSCRIPTION NAME APPEARS ON A SLIDE', () => {
  // The owner ruling that makes a slide portable between audiences. The plan line belongs to
  // the page's pull, and the club deck will need a different sentence for the same slide.
  const planWords = /Tournament Plus|Premium Coaches Portal|Coaches Portal|\bClub\b|\bLeague\b plan/i;
  for (const slide of SLIDES) {
    assert.doesNotMatch(slide.pain, planWords, `${slide.id}'s pain names a plan`);
    assert.doesNotMatch(slide.claim, planWords, `${slide.id}'s claim names a plan`);
  }
});

test('each public page pulls FROM its own deck, in deck order', () => {
  for (const w of WALKTHROUGHS) {
    const order = deckSlides(w.persona).map(s => s.id);
    const pulled: string[] = w.panels.map(p => p.slideId);
    // "the bank holds it" is not asserted here — `slideId` is typed to the bank's own key set,
    // so that one is a compile error. What only data can get wrong is the DECK relationship.
    for (const id of pulled) {
      assert.ok(order.includes(id), `${w.path} pulls ${id}, which is not in the ${w.persona} deck`);
    }
    const positions = pulled.map(id => order.indexOf(id));
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
      `${w.path} shows its slides out of the deck's running order`,
    );
    assert.equal(new Set(pulled).size, pulled.length, `${w.path} pulls the same slide twice`);
  }
});

test('the meta line counts the panels the page actually shows', () => {
  for (const w of WALKTHROUGHS) {
    const claimed = Number(w.meta.match(/^(\d+) problems?/)?.[1]);
    assert.equal(claimed, w.panels.length, `${w.path} promises ${claimed} problems and shows ${w.panels.length}`);
  }
});
