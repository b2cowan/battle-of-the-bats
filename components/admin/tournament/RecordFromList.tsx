'use client';
/**
 * An event's record, opened from a list (Tournament admin redesign Stage 4): the list hands over its own
 * order and its read, and this works out everything else the record needs — the neighbours its foot
 * names, its position, the plan (slots, Reuse, Seal), who holds the plan's slots, whether a newer event
 * took its public link — and re-reads both the list and the frame's event list after a change. Both lists
 * render this, so the record cannot say one thing from the Tournaments list and another from Past
 * tournaments.
 */
import TournamentRecord from '@/components/admin/tournament/TournamentRecord';
import { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature } from '@/lib/plan-features';
import { LIST_WORDS } from '@/lib/after-event-words';
import { STATUS_WORD } from '@/lib/tournament-status-words';
import type { ListEvent } from '@/lib/tournament-lists';
import type { useTournamentLists } from './useTournamentLists';

export default function RecordFromList({ openId, order, lists, onOpen, onClose }: {
  openId: string | null;
  /** The list's own order (its bands, top to bottom). */
  order: ListEvent[];
  /** The lists' one read (every event of the club, archived included, and the sealed records). */
  lists: ReturnType<typeof useTournamentLists>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { refresh: refreshCtx } = useTournament();
  const idx = openId ? order.findIndex(e => e.id === openId) : -1;
  // An event that left this list (Mark complete, Reopen, Delete) closes its record.
  if (idx < 0 || !currentOrg) return null;
  const { events, sealed } = lists;
  const event = events.find(e => e.id === openId);
  if (!event) return null;
  const band = order.filter(e => e.status === event.status);
  const inBand = band.findIndex(e => e.id === event.id);
  const seal = sealed.find(s => s.tournamentId === event.id);
  const takenBy = event.status === 'archived' && event.slug
    ? events.find(o => o.id !== event.id && o.status !== 'archived' && o.slug === event.slug)?.name ?? null
    : null;
  return (
    <TournamentRecord
      event={event}
      sealed={seal ? { archiveId: seal.archiveId, sealedAt: seal.sealedAt } : null}
      orgSlug={currentOrg.slug}
      canWrite={Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'))}
      plan={{
        canClone: hasPlanFeature(currentOrg.planId, 'tournament_cloning'),
        canSeal: hasPlanFeature(currentOrg.planId, 'sealed_archives'),
        limit: currentOrg.tournamentLimit ?? 9999,
        planHref: tournamentPlusPanelHref(currentOrg.slug),
        orgContactEmail: currentOrg.contactEmail ?? null,
      }}
      willEmailOnComplete={event.willEmailOnComplete}
      slotHolders={events.filter(e => e.status !== 'archived' && e.id !== event.id)}
      linkTakenBy={takenBy}
      prev={order[idx - 1] ?? null}
      next={order[idx + 1] ?? null}
      position={LIST_WORDS.position(idx + 1, order.length)}
      positionWide={LIST_WORDS.positionIn(inBand + 1, band.length, STATUS_WORD[event.status])}
      onStep={onOpen}
      onClose={onClose}
      onChanged={async () => { await Promise.all([lists.reload(), refreshCtx()]); }}
    />
  );
}
