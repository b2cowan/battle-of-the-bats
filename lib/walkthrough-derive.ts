/**
 * THE PAGE'S DERIVED FURNITURE — pure string assembly, deliberately in its own tiny module.
 *
 * ⚠ WHY THIS IS NOT IN lib/walkthrough-content.ts: the studio's PullEditor is a client
 * component that previews these lines live, and importing them from walkthrough-content would
 * drag the ENTIRE slide library (every pageAnswer paragraph, every caption) into the client
 * bundle. This module takes plain strings and numbers, knows nothing about slides, and costs
 * the browser nothing. walkthrough-content re-exports both helpers so server code keeps one
 * import; only client code should import from here directly, with data passed as props.
 *
 * ⚠ The Oxford-comma join is HAND-ROLLED ON PURPOSE — do not swap it for Intl.ListFormat or one
 * of the module-local "a, b and c" helpers elsewhere in the repo (their separators differ, and
 * ICU output is runtime-owned). This string is public SEO copy that was proven byte-identical
 * to the hand-written descriptions it replaced; explicit branches keep it that way on every
 * runtime that renders it.
 */

/**
 * The "N problems · 90 seconds · nothing to install" line under the hero CTAs — COMPUTED from
 * the pull it describes (Deck Studio finding F3). It used to be typed by hand with a unit test
 * holding the number to the panel count; a test cannot see an owner's save, so the number counts
 * what is rendered. "90 seconds" is the page's promise, not a measurement, and stays fixed.
 */
export function derivedMeta(panelCount: number): string {
  return `${panelCount} ${panelCount === 1 ? 'problem' : 'problems'} · 90 seconds · nothing to install`;
}

/** The derived description opens on a number WORD ("Six jobs…"), as the hand-written one did. */
const COUNT_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
];

/**
 * The SEO description, assembled from the shown slides' phrases (finding F3). The hand-written
 * one named each panel in order and was re-widened by hand every time the pull grew; once the
 * pull is owner-editable that rots silently, so each slide carries a `seoPhrase` and this puts
 * them in a sentence. For today's fallback pulls the output is byte-identical to the
 * descriptions this replaced — the test proves the shape, and the phrases ARE the old words.
 */
export function derivedSeoDescriptionFrom(subject: string, phrases: readonly string[]): string {
  const list =
    phrases.length <= 1 ? phrases.join('')
    : phrases.length === 2 ? `${phrases[0]} and ${phrases[1]}`
    : `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
  const word = COUNT_WORDS[phrases.length] ?? String(phrases.length);
  const jobs = phrases.length === 1 ? 'job that stops' : 'jobs that stop';
  return `${word} ${jobs} being yours the day ${subject} — ${list}. Walk the live demo yourself — no sign-up.`;
}
