'use client';
import { WhereLine } from '@/components/venue/WhereField';
import { useClashCheck } from '@/components/venue/useClashCheck';
import { pickedVenueKinds, type WhereValue } from '@/lib/where-field';
import { clashLine, leagueRefusalLine, leagueSeriesLine } from '@/lib/venue-clash-words';
import { PERMIT_WORDS, permitLine, permitSeriesLine, type PermitOutside } from '@/lib/permit-words';
import type { ClashFinding } from '@/lib/venue-clash';
import type { ClubVenueOption } from '@/lib/types';
import ck from '../../ClubKit.module.css';

/**
 * "See the permit" (9d-2a step 7; frames b4, c3, i): the quiet line's door to the one permit it is about. Absent when the
 * line is about several permits (`permitId` null — never a guess) or the host cannot open a permit (no `onOpen`).
 */
export function SeePermitDoor({ permitId, onOpen }: { permitId: string | null | undefined; onOpen?: (permitId: string) => void }) {
  if (!permitId || !onOpen) return null;
  return <button type="button" className={ck.link} onClick={() => onOpen(permitId)}>{PERMIT_WORDS.seeThePermit}</button>;
}

/** One live-check answer per date (`/venue-check`). */
interface LeagueCheckResult {
  date: string;
  refusal: {
    partnerLabel: string; partnerKind: 'game' | 'practice';
    partnerStartsAt: string | null; partnerEndsAt: string | null; matchedOn: 'facility' | 'venue';
  } | null;
  crossProgram: ClashFinding[];
  /** The date OUTSIDE a permit the club holds at that venue (Club Tier Stage 10a, Ask 3), else null. */
  permit?: PermitOutside | null;
}
const readLeagueCheck = (json: unknown): LeagueCheckResult[] => {
  const results = (json as { results?: unknown } | null)?.results;
  return Array.isArray(results) ? results as LeagueCheckResult[] : [];
};
/** What Create compares with the line on screen: the cross-program findings, and a refusal. */
const countLeagueCheck = (r: LeagueCheckResult[]) => r.reduce((n, x) => n + x.crossProgram.length + (x.refusal ? 1 : 0), 0);

/**
 * House league's window line (specimen 3, Asks 4–5): the league's own refusal in red under the field, before
 * Create (Create greyed) — what it refuses is unchanged — and another program's booking in amber, never blocking.
 * The check runs as soon as a date, a time and one of the club's venues are set, and again on any change; Create
 * asks once more first (the hook's one rule). The words are `lib/venue-clash-words.ts`'s.
 */
export function useLeagueLine(opts: {
  checkPath: string;
  sport: string | null | undefined;
  where: WhereValue;
  /** The club's venues — the picked one's facilities give the line its noun ("can't share a field"). */
  venues: readonly ClubVenueOption[];
  kind: 'game' | 'practice';
  /** One booking… */
  occurrence?: { date: string; startTime: string; endTime: string } | null;
  /** …or a practice series (expanded on the server by the save's own generator)… */
  series?: { dayOfWeek: number; startDate: string; endDate: string; startTime: string; endTime: string } | null;
  /** …or the dates an edit of a series reaches (Stage 11b Part 4). */
  occurrences?: { date: string; startTime: string; endTime: string }[] | null;
  excludeGameId?: string | null;
  /** The practices an edit moves: never a clash with themselves. */
  excludePracticeIds?: string[] | null;
  teamId?: string | null;
  /** Opens the permit the quiet line is about (the game window's "See the permit"); absent = no door. */
  onSeePermit?: (permitId: string) => void;
}) {
  const { checkPath, sport, where, venues, kind, occurrence, series, occurrences, excludeGameId, excludePracticeIds, teamId, onSeePermit } = opts;
  const ready = where.source === 'club' && !!where.orgVenueId && (
    series ? !!(series.startDate && series.endDate && series.startTime && series.endTime)
      : occurrences ? occurrences.length > 0 && occurrences.every(o => o.date && o.startTime)
        : !!(occurrence?.date && occurrence.startTime)
  );
  const { result, checking, lineIsCurrent } = useClashCheck(
    ready ? {
      path: checkPath,
      body: {
        kind, orgVenueId: where.orgVenueId, orgVenueFacilityId: where.orgVenueFacilityId,
        ...(series ? { series } : { occurrences: occurrences ?? [occurrence] }),
        excludeGameId: excludeGameId ?? null, excludePracticeIds: excludePracticeIds ?? [], teamId: teamId ?? null,
      },
    } : null,
    readLeagueCheck,
    countLeagueCheck,
  );

  const ctx = {
    sport, venueName: where.location, facilityName: where.orgVenueFacilityId ? where.fieldNumber : null,
    kinds: pickedVenueKinds(where, venues),
  };
  const refusalAt = (result ?? []).find(r => r.refusal);
  const refusal = refusalAt?.refusal
    ? leagueRefusalLine({
        sport, kinds: ctx.kinds, matchedOn: refusalAt.refusal.matchedOn, venueName: ctx.venueName, facilityName: ctx.facilityName,
        partnerLabel: refusalAt.refusal.partnerLabel, partnerKind: refusalAt.refusal.partnerKind, proposedKind: kind,
        startIso: refusalAt.refusal.partnerStartsAt, endIso: refusalAt.refusal.partnerEndsAt,
        date: series || occurrences ? refusalAt.date : null,
      })
    : null;
  const cross = result?.some(r => r.crossProgram.length)
    ? (series || occurrences
        ? leagueSeriesLine(result.map(r => ({ date: r.date, findings: r.crossProgram })), ctx)
        : clashLine(result[0]?.crossProgram ?? [], ctx))
    : null;
  // The permit's quiet line (Stage 10a, Ask 3): under the league's own and the amber line, never merged, never a refusal.
  const permits = (result ?? []).map(r => r.permit ?? null);
  const outside = permits.some(Boolean)
    ? (series || occurrences ? permitSeriesLine(permits, (result ?? []).map(r => r.date), sport, { nameTheDates: true }) : permitLine(permits[0], sport))
    : '';
  return {
    refused: !!refusal,
    line: refusal || cross || outside ? (
      <>
        {refusal && <WhereLine tone="refuse" lead={refusal.lead} rest={refusal.rest} />}
        {cross && <WhereLine tone={cross.tone} lead={cross.lead} rest={cross.rest} />}
        {outside && <WhereLine tone="quiet" mark="clock" rest={outside}
          door={<SeePermitDoor permitId={permits.find(Boolean)?.permitId} onOpen={onSeePermit} />} />}
      </>
    ) : null,
    checking,
    lineIsCurrent,
  };
}
