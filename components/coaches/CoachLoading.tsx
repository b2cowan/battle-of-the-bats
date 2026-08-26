import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The coach portal's ONE loading state — pulsing dot, 0.85rem, and a sentence that
 * names what is coming.
 *
 * ⚠ IT EXISTS BECAUSE THE CLASS ALONE DID NOT HOLD (UX review 2026-08-26). `.loadingState`
 * has been the house pattern for a year and ~50 screens retype its markup by hand — but
 * the whole of Money, Roster, Settings, Staff, Season end and Tryout history had drifted
 * onto a bare `<p className={muted}>Loading…</p>` instead: no dot, body-size type (~15%
 * larger than every other screen), and no subject. A coach opening Money met the wrong
 * loading state seven times in one visit. A shared class stops style drift; only a shared
 * COMPONENT stops markup drift, which is the drift that actually happened here.
 *
 * ⚠ `label` IS NOT OPTIONAL BY ACCIDENT. Every one of the drifted call sites said the bare
 * word "Loading…" — the default exists only for the handful of sub-second context waits
 * where naming a subject would be a lie about what is being fetched. If you know what is
 * loading, say it: "Loading the register…", never "Loading…".
 */
export default function CoachLoading({
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
