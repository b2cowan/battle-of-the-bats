'use client';

import type { Division, Game, PublicTeam, Venue } from '@/lib/types';
import PublicBracket from './PublicBracket';
import publicStyles from './PublicBracket.module.css';
import { publicBracketSections } from '@/lib/public-playoffs';

interface Pool { id: string; name: string }

interface TieredBracketProps {
  /** Playoff games for the active division (already filtered by the caller). */
  games: Game[];
  teams: PublicTeam[];
  /** Division pools — drives the per-pool split when the bracket is pool-seeded. */
  pools: Pool[];
  orgSlug: string;
  tournamentSlug: string;
  venues: Venue[];
  requireFinalization: boolean;
  now: Date;
  /** Published divisions for the team-link boundary. */
  divisions: Division[];
}

/**
 * Renders a division's playoff games as one bracket per section — one per pool when the bracket is pool-seeded,
 * one per tier when the games span independent brackets, otherwise one (`publicBracketSections`). Each section
 * resolves live venue labels and links cards to the public game page.
 */
export function TieredBracket({ games, teams, pools, orgSlug, tournamentSlug, venues, requireFinalization, now, divisions }: TieredBracketProps) {
  return <div className={publicStyles.groups}>
    {publicBracketSections(games, teams, pools).map(section => <section key={section.key}>
      {section.name && <h3 className={publicStyles.groupTitle}>{section.name}</h3>}
      <PublicBracket games={section.games} teams={teams} venues={venues} orgSlug={orgSlug} tournamentSlug={tournamentSlug}
        requireFinalization={requireFinalization} divisions={divisions} now={now} />
    </section>)}
  </div>;
}
