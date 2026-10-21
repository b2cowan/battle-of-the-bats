import kit from './ClubKit.module.css';
import styles from './TryoutPage.module.css';
import { TRYOUT_STATE_WORD, type TryoutState } from '@/lib/tryout-season';

/** The tryout state's look, in one place: (DC-04) green for Tryouts open; grey for the rest — with the drawings' dot on
 *  Tryouts closed and Finished, none on Not open yet (`.chip.closed` vs `.chip.wait`). */
const LOOK: Record<TryoutState, string> = {
  open: kit.chipOk,
  notOpenYet: kit.chipNeutral,
  finished: `${kit.chipNeutral} ${styles.dot}`,
  closed: `${kit.chipNeutral} ${styles.dot}`,
};

/** A team's tryout state as its chip — the one phrase per meaning (`TRYOUT_STATE_WORD`) in its one look. */
export default function TryoutChip({ state, className = '' }: { state: TryoutState; className?: string }) {
  return <span className={`${kit.chip} ${LOOK[state]} ${className}`}>{TRYOUT_STATE_WORD[state]}</span>;
}
