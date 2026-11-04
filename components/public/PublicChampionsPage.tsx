/**
 * components/public/PublicChampionsPage.tsx — Public tournament pages Stage 6 (Ask 14), the Champions page's body.
 *
 * Closes the "Stage 8 debt" plan §5 flagged: the Overview's finished body already shows `PublicChampions`
 * (Stage 2); this is the frame's ONE other copy of that card, replacing the legacy page's own hand-built hero +
 * per-division standings recap (the legacy body went with Stage 8 Part 3c; `app/[orgSlug]/[tournamentSlug]/champions/page.tsx`
 * renders only this).
 *
 * D1 is the caller's job, not this component's: `champions/page.tsx` already builds `cards` from
 * `onlyPublishedGames` — the same held-back-division filter Stage 4/5 applied to Standings, Playoffs, Teams and a
 * team's page — so a held-back division's champion never reaches here. `standingsHidden` mirrors the legacy
 * page's own gate (the recap inherits the Standings page's visibility, exactly as today).
 *
 * Shares the existing tournament OG image; preview doors are inert because Playoffs has no preview route.
 */
import { Trophy } from 'lucide-react';
import type { ChampionCardView } from '@/lib/public-host-card';
import PublicTournamentState from './PublicTournamentState';
import PublicChampions from './PublicChampions';
import PublicDoorRow from './PublicDoorRow';
import styles from './PublicChampionsPage.module.css';

export default function PublicChampionsPage({
  standingsHidden,
  cards,
  homeHref,
  showPlayoffs = false,
  isPreview = false,
}: {
  /** The organizer hid Standings (or the format has none) — the recap inherits that visibility, as today. */
  standingsHidden: boolean;
  /** Already D1-filtered by the caller (`onlyPublishedGames`); empty means no champion yet. */
  cards: ChampionCardView[];
  homeHref: string;
  showPlayoffs?: boolean;
  isPreview?: boolean;
}) {
  if (standingsHidden) {
    return (
      <div className={styles.page}>
          <div className={styles.state}>
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Champions"
              title="Final results unavailable"
              description="The organizer has hidden results and standings for this tournament."
              actions={isPreview ? [] : [{ href: homeHref, label: 'Tournament Home', variant: 'ghost' as const }]}
            />
          </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className={styles.page}>
          <div className={styles.state}>
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Champions"
              title="No champions crowned yet"
              description="Once the playoff finals are decided, the champion(s) and final results will appear here."
              actions={isPreview ? [] : [
                ...(showPlayoffs ? [{ href: `${homeHref}/playoffs`, label: 'Playoff Picture', variant: 'ghost' as const }] : []),
                { href: homeHref, label: 'Tournament Home', variant: 'ghost' as const },
              ]}
            />
          </div>
      </div>
    );
  }

  return <div className={styles.page}>
    <h1 className="sr-only">Champions</h1>
    <div className={styles.content}>
      <PublicChampions cards={cards} />
      <div className={styles.doors}>
        {showPlayoffs && <PublicDoorRow href={isPreview ? null : `${homeHref}/playoffs`}
          label="The playoff bracket" sub="Every playoff game and score" />}
        <PublicDoorRow href={isPreview ? null : `${homeHref}/standings`} label="Final standings" />
      </div>
    </div>
  </div>;
}
