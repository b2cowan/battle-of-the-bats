'use client';
/**
 * ONE SETUP WIZARD, EVERY DOOR (Tournament admin redesign Stage 4, Part 1 — D2 and A19, ruled
 * 2026-10-06). The admin frame mounts this provider once; every door calls it:
 *
 *   openReuse(event, door) — "Reuse this setup": the wizard's reuse step, the event already chosen, no
 *                            "pick a source" behind it. The finished board's lime, Summary's Next year,
 *                            Past tournaments' Completed rows, every event's record.
 *   openNew(door)          — New tournament (the rail's +, the Tournaments list's button): the wizard's
 *                            "Start blank, or reuse" step, as before (Stage 5's).
 *
 * Before, the Tournaments list and the rail each mounted their own wizard, Summary had its own reuse
 * window (a year field, everything copied, a "Next tournament draft created" page) and the list a
 * "Tournament Draft Created" window: three endings. Now there is one: the new draft opens on ITS OWN
 * board, with a notice naming the event it came from (the event it came from is untouched).
 *
 * Mounted ABOVE the pages (AdminChrome) so the notice survives the move to the new board, and the window
 * renders outside the rail, whose `position: sticky` would trap a modal under the page.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { CreatedTournament, ReuseSetupSourceSurface } from '@/components/admin/TournamentSetupWizard';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { REUSE_WORDS } from '@/lib/after-event-words';

// Loaded when a door opens it, not with every admin page (it was in the rail's chunk before).
const TournamentSetupWizard = dynamic(() => import('@/components/admin/TournamentSetupWizard'));

/** The event a reuse door is for. Any status — an archived event is a source too. */
export type ReuseSource = { id: string; name: string; year: number | null; status: string | null };

type NewDoor = Extract<ReuseSetupSourceSurface, 'sidebar_create' | 'manage_tournaments_new_button'>;
type ReuseDoor = Exclude<ReuseSetupSourceSurface, NewDoor | 'unknown'>;

type Opener = {
  openNew: (door: NewDoor) => void;
  openReuse: (source: ReuseSource, door: ReuseDoor) => void;
};

type OpenDoor = { kind: 'new'; door: NewDoor } | { kind: 'reuse'; door: ReuseDoor; source: ReuseSource };

const SetupWizardContext = createContext<Opener | null>(null);

const NO_OPENER: Opener = { openNew: () => {}, openReuse: () => {} };

/** The doors' handle on the one wizard. Outside the admin frame it does nothing. */
export function useSetupWizard(): Opener {
  return useContext(SetupWizardContext) ?? NO_OPENER;
}

export function SetupWizardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { tournaments, refresh } = useTournament();
  const [open, setOpen] = useState<OpenDoor | null>(null);
  const [notice, setNotice] = useState<{ key: number; message: string } | null>(null);

  const openNew = useCallback((door: NewDoor) => setOpen({ kind: 'new', door }), []);
  const openReuse = useCallback((source: ReuseSource, door: ReuseDoor) => setOpen({ kind: 'reuse', door, source }), []);
  const value = useMemo(() => ({ openNew, openReuse }), [openNew, openReuse]);

  async function landOnNewDraft(created: CreatedTournament) {
    if (!currentOrg) return;
    setOpen(null);
    // The new draft becomes the current event, then its board opens (Stage 5 draws that board).
    await refresh(created.id);
    router.push(`/${currentOrg.slug}/admin/tournaments/dashboard`);
    if (created.creationMethod === 'reused_setup' && created.sourceName) {
      setNotice({ key: Date.now(), message: REUSE_WORDS.created(created.sourceName) });
    }
  }

  return (
    <SetupWizardContext.Provider value={value}>
      {children}
      {open && currentOrg && (
        <TournamentSetupWizard
          isOpen
          orgSlug={currentOrg.slug}
          orgContactEmail={currentOrg.contactEmail ?? null}
          existingTournaments={tournaments.map(t => ({ id: t.id, name: t.name, year: t.year ?? null, status: t.status ?? null }))}
          initialSource={open.kind === 'reuse' ? open.source : null}
          sourceSurface={open.door}
          previewOrg={currentOrg}
          canManageBranding={Boolean(userRole && hasCapability(userRole, userCapabilities, 'manage_branding'))}
          canClone={hasPlanFeature(currentOrg.planId, 'tournament_cloning')}
          upgradeCopy={requiresTournamentPlusCopy('tournament_cloning')}
          onClose={() => setOpen(null)}
          onCreated={landOnNewDraft}
        />
      )}
      {notice && <NoticePill key={notice.key} message={notice.message} onDone={() => setNotice(null)} />}
    </SetupWizardContext.Provider>
  );
}
