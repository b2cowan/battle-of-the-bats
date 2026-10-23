import Link from 'next/link';
import { Globe } from 'lucide-react';
import { CoachRow, CoachRowBand, CoachRowList, CoachRowListFoot } from '@/components/coaches/CoachRowList';
import {
  bandTournamentRows,
  tournamentRowFace,
  type TournamentChipTone,
  type TournamentRowEntry,
} from '@/lib/coach-tournament-rows';
import { resolveRowFanView } from '@/lib/coach-alert-registration';
import portalStyles from '@/app/coaches/coaches-portal.module.css';

/**
 * A team's tournament entries as the portal's row list (Club Tier Stage 7d, drawing 6) — banded
 * Coming up / Finished, the date leading, a chip only where it says something, the chevron last,
 * and the fan side one door under the list. Rendered by the paid team list, the free team list and
 * the free account hub (once per team); the words come from `tournamentRowFace` alone.
 *
 * Server-safe (no hooks), so the free portal's server pages render it directly; the caller passes
 * only where the records live (`hrefBase`).
 */

const CHIP_CLASS: Record<TournamentChipTone, string> = {
  ok: portalStyles.coachLifecycleChipOk,
  waiting: portalStyles.coachLifecycleChipWaiting,
  live: portalStyles.coachLifecycleChipLive,
  mute: portalStyles.coachLifecycleChipComplete,
};

/** The one tournament chip (typewriter capitals, the lifecycle chip's recipe), shared with the record's header. */
export function CoachTournamentChip({ label, tone }: { label: string; tone: TournamentChipTone }) {
  return (
    <span className={`${portalStyles.coachLifecycleChip} ${CHIP_CLASS[tone]}`}>
      {tone === 'live' && <span className={portalStyles.coachLifecycleChipDot} aria-hidden />}
      {label}
    </span>
  );
}

/** What a row needs to draw itself, plus what the fan-view door needs to know about the entry. */
type RowEntry = TournamentRowEntry & Parameters<typeof resolveRowFanView>[0];

export default function CoachTournamentRows<T extends RowEntry>({
  entries,
  hrefBase,
  today,
  label,
}: {
  entries: T[];
  /** Where the records live — a row links to `${hrefBase}/${registration id}`, the one thing that differs between the portals. */
  hrefBase: string;
  today: string;
  /** The list's name for the accessibility tree ("Tournaments", or the team's name on the hub). */
  label: string;
}) {
  const { coming, finished } = bandTournamentRows(entries, today);
  // The fan side's door under the list — only when at least one entry has a public page.
  const fanView = entries.some(entry => resolveRowFanView(entry) !== null);

  const renderRow = (entry: T) => {
    const face = tournamentRowFace(entry, today);
    return (
      <CoachRow
        key={entry.registration.id}
        as="link"
        href={`${hrefBase}/${entry.registration.id}`}
        lead={face.lead ?? undefined}
        title={
          <>
            {face.title}
            {face.chip && <> <CoachTournamentChip {...face.chip} /></>}
          </>
        }
        caption={face.caption ?? undefined}
        door="chevron"
      />
    );
  };

  return (
    <>
      <CoachRowList label={label}>
        {coming.length > 0 && <CoachRowBand>Coming up</CoachRowBand>}
        {coming.map(renderRow)}
        {finished.length > 0 && <CoachRowBand>Finished</CoachRowBand>}
        {finished.map(renderRow)}
      </CoachRowList>
      {fanView && (
        <CoachRowListFoot>
          {/* The fan side of every team this coach follows — an accepted coach follows their team
              automatically (CoachTeamAutoFollow), so their entries' public schedules and live scores
              are all there. Each tournament's own public page is the ⇄ on its record. */}
          <Link href="/following"><Globe size={13} aria-hidden />&nbsp;Fan view of every tournament</Link>
        </CoachRowListFoot>
      )}
    </>
  );
}
