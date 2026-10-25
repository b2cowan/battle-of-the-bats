'use client';
import { RepChip, type ChipTone } from './RepKit';
import { seasonState, type SeasonTone } from '@/lib/house-league-season';
import type { LeagueSeasonStatus } from '@/lib/types';

const TONE: Record<SeasonTone, ChipTone> = { green: 'good', amber: 'warn', neutral: 'neutral' };

/**
 * What is happening in a house-league season, as one pill (Club Tier Stage 9a, Q14; copy §2): Getting ready · Registration
 * open · Registration closed · Starts {date} · Playing now · Ended {date} · Finished. The home's rows, the season page's
 * header and the phone's season header all wear this one — never a second set of words.
 */
export default function SeasonStatePill({ season }: {
  season: {
    status: LeagueSeasonStatus | string; seasonStartDate?: string | null; seasonEndDate?: string | null;
    // The form's dates (9b-1 Part 4): an opened season's pill reads "Opens Jun 1" / "Closed Aug 1" from them.
    registrationOpenAt?: string | null; registrationCloseAt?: string | null; registrationClosedAt?: string | null;
  };
}) {
  const { label, tone } = seasonState(season);
  return <RepChip tone={TONE[tone]}>{label}</RepChip>;
}
