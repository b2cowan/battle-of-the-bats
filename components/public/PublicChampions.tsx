import { Trophy } from 'lucide-react';
import type { ChampionCardView } from '@/lib/public-host-card';
import kit from './ClubKit.module.css';
import styles from './PublicParts.module.css';

/**
 * The champions (Public tournament pages Stage 2 Part 3; hub "Champions": the division, the team, the score), first on the
 * Overview once the event is over. One card per decided final, in lib/public-host-card.ts's words (`championCards`).
 * The Champions page itself is Stage 6's; the old home banner is deleted with the old Overview at Stage 8 — this is the
 * frame's one copy of the card, not a third.
 */
export default function PublicChampions({ cards }: { cards: ChampionCardView[] }) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="overview-champions">
      <h2 className={kit.srOnly} id="overview-champions">Champions</h2>
      <div className={styles.champList}>
        {cards.map(c => (
          <article key={c.key} className={styles.champ}>
            {(c.division || c.badge) && (
              <span className={styles.champKicker}>{[c.division, c.badge].filter(Boolean).join(' · ')}</span>
            )}
            <b className={styles.champName}><Trophy size={22} aria-hidden />{c.name}</b>
            {c.beat && <p className={styles.champBeat}>{c.beat}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
