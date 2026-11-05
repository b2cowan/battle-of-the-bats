import type { LiveCardView } from '@/lib/public-game-row';
import scheduleStyles from './PublicSchedule.module.css';
import { ScheduleMatchup } from './PublicGameRow';

/**
 * One game in play as a standalone card on a wide list — the Schedule and Playoffs' Live now: the one-line
 * game row (Public page layout standard R6, on the 104 · rest · 104 grid) in a card with the 3 px green edge (R9). Both
 * names in full ink, because nobody is bold or soft until the game is final; "No score yet" before anyone has entered
 * one (Stage 0 · D2). The Overview's Live now is the stacked form in a list (TournamentOverview), not this card.
 * `href` (optional) makes the row a door to the game's page. `pill={false}` under a "Live now" heading (Playoffs): the heading
 * says it, so the pill would say it twice (R9) and the edge stays.
 */
export default function PublicLiveCard({ view, href, schedule, foot, pill = true }: {
  view: LiveCardView; href?: string; pill?: boolean; schedule: { time: string; division: string; pool?: string | null; round?: string | null }; foot?: string;
}) {
  const [away, home] = view.sides;
  const label = view.noScore
    ? `${away.name} vs ${home.name}, ${view.noScore.toLowerCase()}`
    : `${away.name} ${away.score}, ${home.name} ${home.score}`;
  return <article className={scheduleStyles.liveCard} aria-label={label} data-public-live-card>
    <ScheduleMatchup {...schedule} state="live" href={href} noScore={view.noScore} foot={foot} pill={pill}
      sides={view.sides.map(s => ({ name: s.name, score: s.score, result: null }))} />
  </article>;
}
