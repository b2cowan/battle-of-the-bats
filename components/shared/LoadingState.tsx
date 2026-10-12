import styles from './LoadingState.module.css';

/**
 * The product's ONE loading state, in the coaches portal and the admin alike — pulsing dot, body
 * type, and a sentence that names what is coming.
 *
 * ⚠ IT EXISTS BECAUSE THE CLASS ALONE DID NOT HOLD (UX review 2026-08-26). `.loadingState` had been
 * the portal's house pattern for a year, and ~50 screens retyped its markup by hand — but the whole of
 * Money, Roster, Settings, Staff, Season end and Tryout history had drifted onto a bare
 * `<p className={muted}>Loading…</p>` instead: no dot, body-size type, and no subject. A coach opening
 * Money met the wrong loading state seven times in one visit. A shared class stops style drift; only a
 * shared COMPONENT stops markup drift, which is the drift that actually happened here.
 *
 * ⚠ THE ADMIN HAD THE SAME DRIFT, FIVE LOOKS DEEP (owner, 2026-10-12): a 32px spinning refresh icon
 * centred on an empty page (Schedule, Results, Communications), small caps in the middle of the page
 * (the admin home, Tournaments, Families), and a dozen hand-styled quiet lines — nearly every one of
 * them the bare word. It moved here from the portal so both sides draw one line;
 * `tests/unit/loading-state-guard.test.ts` keeps the admin from typing its own again.
 *
 * ⚠ `label` IS NOT OPTIONAL BY ACCIDENT. Say what the SCREEN shows ("Loading the schedule…"), and say
 * it in every phase of the wait — a screen that first waits on its context and then on its data keeps
 * ONE sentence, so the line never flips from "Loading tournament..." to "Loading schedule..." under
 * the reader. The default exists only for a wait with no honest subject.
 *
 * ⚠ THE LAYOUT SWEEP WAITS THIS LINE OUT BY ITS WORDS (`waitForNoLoading`, scripts/layout-screens.mjs):
 * it must start "Loading", end "…", carry no full stop, and stay under ~40 characters after "Loading" —
 * "Loading Budget vs. Actual…" would release the sweep on a half-drawn screen. The guard checks it.
 */
export default function LoadingState({
  label = 'Loading…',
  inline = false,
}: {
  /** What is being fetched, as a sentence. Say the subject wherever one is known. */
  label?: string;
  /** Tighter padding, for a loading state inside a card, drawer or modal body
   *  rather than one standing in for a whole screen. */
  inline?: boolean;
}) {
  return (
    <div
      className={inline ? `${styles.loadingState} ${styles.loadingStateInline}` : styles.loadingState}
      role="status"
    >
      {label}
    </div>
  );
}
