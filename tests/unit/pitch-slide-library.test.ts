/**
 * THE SLIDE LIBRARY'S OWN INTEGRITY — the ways this data can go quietly wrong that the COMPILER
 * CANNOT SEE.
 *
 * ⚠ Read that qualifier literally. As of 2026-08-21 `PitchSlide` is a discriminated union, so the
 * capture-vs-drawing pairings it used to assert here are compile errors and were DELETED rather
 * than kept as a second copy of a rule the type already holds. What is left is the set a type
 * genuinely cannot express: relationships BETWEEN slides, decks and pages, and emptiness.
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
  PLAN_WORDS,
  SLIDE_NUMBERS_SPOKEN_FOR,
  WALKTHROUGHS,
  derivedMeta,
  derivedSeoDescription,
  pullProblems,
  resolvePullIds,
  type PitchSlide,
} from '../../lib/walkthrough-content.ts';

const SHOT_IDS = new Set(MARKETING_SHOTS.map(s => s.id));

// `PITCH_SLIDES` is declared with `satisfies`, which keeps each entry's EXACT shape so the key set
// stays literal. Reading it back as the union is what lets these tests ask about fields a given
// arm may not carry (`rings`, `shotId`, `drawingId`).
const SLIDES: PitchSlide[] = Object.values(PITCH_SLIDES);

test('a slide is keyed by its own permanent number', () => {
  for (const [key, slide] of Object.entries<PitchSlide>(PITCH_SLIDES)) {
    assert.equal(slide.id, key, `${key} is filed under a different id than it carries`);
    assert.match(key, /^#\d\d$/, `${key} is not a library number`);
  }
});

/**
 * ⚠ HALF OF THIS TEST IS CURRENTLY UNEXERCISED, AND THAT IS RECORDED RATHER THAN HIDDEN.
 *
 * `SLIDE_NUMBERS_SPOKEN_FOR` holds no `planned` entry today (P2b built everything both decks
 * name), and no deck names a `held` or `retired` number. So the `|| planned` arm and the
 * `!spokenFor || planned` guard below never decide anything against the current data — deleting
 * both would leave the whole suite green. **That is the shape this repo keeps getting burned by**
 * (memory/reference_green_check_over_empty_fixture.md: a check that reports green over an empty
 * fixture reports coverage it does not have).
 *
 * It is kept, and kept honest by saying so, because it is not dead — it is DORMANT. Verified by
 * mutation 2026-08-21: naming a retired id (#08), a held id (#18) or an undefined one (#99) in a
 * deck each fails here with the right message, and the `planned` path is structurally symmetric
 * to those. The assertions go live the moment the club deck (P4) declares its first planned
 * number. ⚠ If you are here because the register is still empty, do not "simplify" this away.
 */
test('every id a deck names is either built or explicitly planned — and never both', () => {
  for (const [audience, ids] of Object.entries(PITCH_DECKS)) {
    for (const id of ids) {
      const built = id in PITCH_SLIDES;
      const spokenFor = SLIDE_NUMBERS_SPOKEN_FOR[id];
      const planned = spokenFor?.status === 'planned';
      assert.ok(built || planned, `${audience} deck names ${id}, which is neither built nor planned`);
      assert.ok(!(built && spokenFor), `${id} is both built and spoken for — remove the register entry`);
      // ⚠ A deck may name a `planned` number and NOTHING else. Naming a `held` or `retired` one is
      // the F5 hole: today it is a compile error, but once decks are owner-editable rows it becomes
      // a slide that silently vanishes from a running order the owner believes is six long.
      assert.ok(
        !spokenFor || planned,
        `${audience} deck names ${id}, which is ${spokenFor?.status} — only a planned number may be named`,
      );
    }
    assert.equal(new Set(ids).size, ids.length, `${audience} deck names the same slide twice`);
  }
});

/**
 * ⚠ A SPENT NUMBER STAYS SPENT — the read-only half of Deck Studio finding F5.
 *
 * `SLIDE_NUMBERS_SPOKEN_FOR` records every gap in the number line and why: #08 retired, #18–#20
 * held for the club deck. That lived only in a prose comment until 2026-08-21. The half the test
 * above does not cover is that a spoken-for number never quietly ACQUIRES a slide — reusing #08
 * would break the one promise the library makes, that a number identifies the same slide forever.
 */
test('a number that is spoken for holds no slide, and says why', () => {
  for (const [id, entry] of Object.entries(SLIDE_NUMBERS_SPOKEN_FOR)) {
    assert.match(id, /^#\d\d$/, `${id} is not a library number`);
    // Without this the register decays into a bare id list and stops telling the next session
    // what it is meant to build there — or why it may never build there again.
    assert.ok(entry.note.trim(), `${id} is ${entry.status} but does not say why — that is the whole point of the register`);
    assert.ok(!(id in PITCH_SLIDES), `${id} is spoken for AND built — a spent number must never be reused`);
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

test('rings stay within the picture, and there are never more than two', () => {
  for (const slide of SLIDES) {
    // Format rule 3: "if a crop needs more than two callout rings, it's two slides".
    assert.ok((slide.rings?.length ?? 0) <= 2, `${slide.id} carries more than two rings — that is two slides`);
    for (const ring of slide.rings ?? []) {
      assert.ok(ring.left >= 0 && ring.left + ring.width <= 100, `${slide.id} has a ring off the side of its picture`);
      assert.ok(ring.top >= 0 && ring.top + ring.height <= 100, `${slide.id} has a ring off the top or bottom of its picture`);
    }
  }
});

/**
 * ⚠ ONE THING A DRAWING'S ALT CAN STILL GET WRONG THAT THE COMPILER CANNOT SEE: being blank.
 *
 * The PAIRINGS moved into the type on 2026-08-21 — `PitchSlide` is a union, so "an explainer names
 * a drawing and never a capture", "a capture never names a drawing", "a drawing carries alt and
 * caption", "a capture carries neither" and "a drawing has no rings" are all compile errors now,
 * and the four assertions that used to live here were deleted rather than left as a second copy
 * of a rule the type already holds.
 *
 * What the type cannot hold is emptiness: `alt: ''` satisfies `alt: string`. And this is the one
 * place it can be caught, because `check:marketing-shots` walks the SHOT MANIFEST — a drawing has
 * no manifest entry at all, so an explainer shipped with a blank alt would pass a green build and
 * reach a public page as a picture no screen reader could describe.
 */
test('a drawing’s own alt and caption are not blank', () => {
  for (const slide of SLIDES) {
    if (!slide.drawingId) continue;
    assert.ok(slide.alt.trim(), `${slide.id} is a drawing with empty alt text — check:marketing-shots cannot see it`);
    assert.ok(slide.caption.trim(), `${slide.id} is a drawing with an empty caption`);
  }
});

/**
 * ⚠⚠ NO PLAN, TIER, PRICE OR SUBSCRIPTION APPEARS ANYWHERE IN THE PITCH MATERIAL — and the scope
 * of that is WIDER than it was (owner ruling 2026-08-21).
 *
 * It used to cover slides only, because the 2026-08-20 ruling was a deliberate split: a slide is
 * plan-free so it can serve two audiences untouched, while the unattended PAGE carries a plan line
 * "because nobody is standing there to answer *is that included?*". **The owner overturned the page
 * half:** *"we don't want to compartmentalize features at this stage, we want to show people all we
 * have to offer and how we will improve their lives, period."*
 *
 * So the check now reads the page's own long `answer` copy too, which is where the nine plan chips
 * and one "(the free portal keeps…)" aside used to live. **The division of labour is by SURFACE:
 * the walkthrough creates desire, the pricing page qualifies, a human answers in the room.**
 *
 * ⚠ The pattern deliberately does NOT ban the bare product name ("the Coaches Portal") — that is
 * what the thing is called, and the hero says it. What it bans is the tier, the gate and the
 * comparison: "Premium Coaches Portal", "Tournament Plus", "free portal", "is part of …".
 */
test('NO PLAN, TIER OR SUBSCRIPTION APPEARS ANYWHERE IN A SLIDE’S COPY', () => {
  // ⚠ The pattern lives in lib/walkthrough-content.ts since stage B — the save path re-checks an
  // assembled page with the SAME regex, and two copies of a rule is how they diverge. The page's
  // long answer moved onto the slide (`pageAnswer`), so reading every slide reads every surface.
  for (const slide of SLIDES) {
    assert.doesNotMatch(slide.pain, PLAN_WORDS, `${slide.id}'s pain names a plan`);
    assert.doesNotMatch(slide.claim, PLAN_WORDS, `${slide.id}'s claim names a plan`);
    assert.doesNotMatch(slide.pageAnswer, PLAN_WORDS, `${slide.id}'s page answer names a plan`);
    assert.doesNotMatch(slide.seoPhrase, PLAN_WORDS, `${slide.id}'s SEO phrase names a plan`);
  }
});

/**
 * ⚠ Emptiness again, same reason as the drawing test above: `pageAnswer: ''` satisfies the type,
 * and a blank answer would render a panel with a heading and no body on a public page.
 */
test('every slide’s page copy is actually written', () => {
  for (const slide of SLIDES) {
    assert.ok(slide.pageAnswer.trim(), `${slide.id} has an empty page answer`);
    assert.ok(slide.seoPhrase.trim(), `${slide.id} has an empty SEO phrase`);
  }
});

/**
 * ⚠ ONE RULEBOOK, TWO CALLERS (stage B). `pullProblems` is the same function the studio's save
 * API refuses with, so this test holds BOTH the code fallbacks and the save path honest at once
 * — the shot-health pattern. If a fallback ever fails here, the owner's saves were being judged
 * by a broken rulebook too.
 */
test('each code fallback pull passes the save path’s own rulebook', () => {
  for (const w of WALKTHROUGHS) {
    assert.deepEqual(
      pullProblems(w.persona, w.fallbackPull),
      [],
      `${w.path}'s fallback pull would be refused by its own save path`,
    );
  }
});

test('the rulebook refuses what the build used to catch — and says why', () => {
  const bad = (persona: 'tournament' | 'coach', ids: string[], want: RegExp) => {
    const problems = pullProblems(persona, ids);
    assert.ok(
      problems.some(p => want.test(p)),
      `${persona} ${JSON.stringify(ids)} should be refused with ${want} — got ${JSON.stringify(problems)}`,
    );
  };
  bad('tournament', [], /no panels at all/);
  bad('tournament', ['#11', '#11'], /appears twice/);
  bad('tournament', ['#27', '#11'], /out of the deck’s running order/);
  bad('tournament', ['#11', '#08'], /retired/);          // a spent number, refused by name
  bad('tournament', ['#11', '#18'], /held/);             // the club deck's, refused by name
  bad('tournament', ['#11', '#99'], /not spoken for/);   // never existed
  bad('tournament', ['#11', '#10'], /not in the tournament deck/); // a coach slide
});

/**
 * How a page READS a saved row — lenient where the save is strict, because a row can rot after
 * it was validly saved and a marketing page must render through it (never blank — the stage B
 * stop line). The fallback answers everything unusable.
 */
test('a broken or rotten saved pull falls back rather than blanking the page', () => {
  const coach = WALKTHROUGHS.find(w => w.persona === 'coach')!;
  // Not an array at all (a malformed row): the code pull, untouched.
  assert.deepEqual(resolvePullIds('coach', null).ids, coach.fallbackPull);
  assert.deepEqual(resolvePullIds('coach', 'garbage').ids, coach.fallbackPull);
  assert.equal(resolvePullIds('coach', null).source, 'code');
  // Rotten ids are dropped and REPORTED — non-strings included, stringified, because the studio
  // must show ALL the rot a malformed row carries, not just the string-shaped half of it.
  const partly = resolvePullIds('coach', ['#01', '#10', '#99', 7]);
  assert.equal(partly.source, 'saved');
  assert.deepEqual(partly.ids, ['#10', '#01']); // deck order, not saved order
  assert.deepEqual(partly.dropped, ['#99', '7']);
  // Nothing usable left: the fallback again, with the rot still reported for the studio.
  const nothing = resolvePullIds('coach', ['#99', '#08']);
  assert.equal(nothing.source, 'code');
  assert.deepEqual(nothing.ids, coach.fallbackPull);
  assert.deepEqual(nothing.dropped, ['#99', '#08']);
});

/**
 * The page's furniture computes itself (finding F3) — the hand-typed meta line and SEO
 * description are gone, so what is asserted now is the DERIVATION: the count is the pull's
 * length by construction, and the description names each shown slide's phrase in page order,
 * in the exact sentence shape the hand-written ones had.
 */
test('the derived furniture counts and names what the page actually shows', () => {
  assert.equal(derivedMeta(6), '6 problems · 90 seconds · nothing to install');
  assert.equal(derivedMeta(1), '1 problem · 90 seconds · nothing to install');
  for (const w of WALKTHROUGHS) {
    const description = derivedSeoDescription(w, w.fallbackPull);
    assert.match(description, /^[A-Z][a-z]+ jobs that stop being yours the day /);
    assert.ok(description.includes(w.seo.subject), `${w.path}'s description lost its subject`);
    assert.ok(
      description.endsWith('Walk the live demo yourself — no sign-up.'),
      `${w.path}'s description lost its closing invitation`,
    );
    let at = -1;
    for (const id of w.fallbackPull) {
      const phrase = PITCH_SLIDES[id].seoPhrase;
      const next = description.indexOf(phrase);
      assert.ok(next > at, `${w.path}'s description misplaces ${id}'s phrase ("${phrase}")`);
      at = next;
    }
  }
});
