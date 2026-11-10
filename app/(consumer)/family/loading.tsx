import warm from '@/components/consumer/warmTheme.module.css';
import styles from './family.module.css';

/**
 * Loading state for every /family screen (the list, a team, a child, a sign-up, the recap). The family pages are
 * dynamic and paint their own warm ground only once their data has arrived — until then the consumer shell's dark
 * background showed under the white nav (a black flash). This paints the same cream ground, with the same page
 * column, straight away and says nothing else: the screens under /family differ too much for one skeleton to match
 * them, and a placeholder that then jumps shape is a second flash.
 */
export default function FamilyLoading() {
  return (
    <div className={warm.warm} aria-busy="true">
      <div className={styles.page} />
    </div>
  );
}
