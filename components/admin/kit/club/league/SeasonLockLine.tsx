'use client';
import { useParams, usePathname } from 'next/navigation';
import { useHouseLeagueSeasons } from '../../useHouseLeagueSeasons';
import { seasonGroup, seasonPageAt, type SeasonPageKey } from '@/lib/house-league-season';
import s from './LeagueSeason.module.css';

/** What each page of a finished season says, once (copy §5). Email families says nothing: it stays open (owner 2026-10-24). */
const LOCK_LINE: Partial<Record<SeasonPageKey, string>> = {
  overview: 'This season is finished, so this page is locked. Money stays open for late fees.',
  teams: 'This season is finished, so this page is locked. Money stays open for late fees.',
  schedule: 'This season is finished, so this page is locked. Money stays open for late fees.',
  standings: 'This season is finished, so this page is locked. Money stays open for late fees.',
  registrations: 'This season is finished. Registrations are locked, and you can still mark fees received.',
  money: 'This season is finished. You can still mark fees received.',
};

/**
 * A FINISHED SEASON SAYS SO ON EVERY PAGE (Club Tier Stage 9a, Q16; copy §5): one quiet line, never a banner and never a
 * disabled-looking control — the write controls are simply absent (the one gate), and without this line a locked season
 * would read as the person lacking a permission. Mounted once by the season layout, so no page carries its own copy.
 */
export default function SeasonLockLine() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const pathname = usePathname();
  const season = useHouseLeagueSeasons(true).find(x => x.id === seasonId);
  if (!season || seasonGroup(season) !== 'past') return null;
  const line = LOCK_LINE[seasonPageAt(pathname)];
  return line ? <p className={s.lockLine}>{line}</p> : null;
}
