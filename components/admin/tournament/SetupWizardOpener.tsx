'use client';
/**
 * ONE SETUP WIZARD, EVERY DOOR (Tournament admin redesign Stage 4, Part 1 — D2 and A19, ruled 2026-10-06; Stage 5's
 * one set of creation questions, E1). The admin frame mounts this provider once; every door calls it:
 *
 *   openReuse(event, door) — "Reuse this setup": the wizard's reuse step, the event already chosen, no "pick a source"
 *                            behind it. The finished board's lime, Summary's Next year, the Tournaments list's Completed
 *                            rows, every event's record.
 *   openInto(draft, done?) — "Start from a past tournament" on a draft's board (Stage 5, E2): the same reuse step,
 *                            filling THAT draft; it lands with the notice naming the event it came from.
 *   openNew(door, finish?) — New tournament: the rail's +, the Tournaments list's button (and its ?create=1 address,
 *                            which the onboarding's League path and the coach portal's hosted section use) and, since
 *                            Stage 5, the FIRST RUN after the plan page (`first_run`) — one window for every door, so a
 *                            first organizer and a returning one meet the same questions (F25). The first run passes its
 *                            own `finish` (it records setup done before the board opens) and its own way out.
 *
 * THE SLOT BEFORE THE DOOR (Stage 5, F83): on a one-slot plan every New tournament door checks the slot first, and at the
 * limit the window never opens to fail at its last step — the door goes to the Tournaments list instead, whose slot line
 * says why, naming the event that holds it (one at a time, A23).
 *
 * Every ending is one: the new draft opens on ITS OWN board, with a notice naming the event it came from when it was
 * reused (the event it came from is untouched).
 *
 * Mounted ABOVE the pages (AdminChrome) so the notice survives the move to the new board, and the window renders outside
 * the rail, whose `position: sticky` would trap a modal under the page.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { CreatedTournament, IntoDraft, ReuseSetupSourceSurface } from '@/components/admin/TournamentSetupWizard';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature } from '@/lib/plan-features';
import { REUSE_WORDS } from '@/lib/after-event-words';
import { hasFiniteSlots, holdsSlot } from '@/lib/tournament-slot';

// Loaded when a door opens it, not with every admin page (it was in the rail's chunk before).
const TournamentSetupWizard = dynamic(() => import('@/components/admin/TournamentSetupWizard'));

/** The event a reuse door is for. Any status — an archived event is a source too. */
export type ReuseSource = { id: string; name: string; year: number | null; status: string | null };

type NewDoor = Extract<ReuseSetupSourceSurface, 'sidebar_create' | 'manage_tournaments_new_button' | 'first_run'>;
type ReuseDoor = Exclude<ReuseSetupSourceSurface, NewDoor | 'unknown'>;

/** A door's own ending (the first run): what happens after Create, and what closing the window does. */
export type NewFinish = {
  onCreated?: (created: CreatedTournament) => void | Promise<void>;
  onClose?: () => void;
};

type Opener = {
  openNew: (door: NewDoor, finish?: NewFinish) => void;
  openReuse: (source: ReuseSource, door: ReuseDoor) => void;
  /** Fills a draft from a past event; `done` runs once it has landed (the board reads itself again). */
  openInto: (draft: IntoDraft, done?: () => void) => void;
};

type OpenDoor =
  | { kind: 'new'; door: NewDoor }
  | { kind: 'reuse'; door: ReuseDoor; source: ReuseSource }
  | { kind: 'into'; draft: IntoDraft };

const SetupWizardContext = createContext<Opener | null>(null);

const NO_OPENER: Opener = { openNew: () => {}, openReuse: () => {}, openInto: () => {} };

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
  const finishRef = useRef<NewFinish | null>(null);
  const intoDoneRef = useRef<(() => void) | null>(null);

  // The slot, read where the doors are: Draft and Active events hold it (A23).
  const atLimit = Boolean(currentOrg && hasFiniteSlots(currentOrg.tournamentLimit)
    && tournaments.filter(t => holdsSlot(t.status)).length >= (currentOrg.tournamentLimit ?? 9999));
  const orgSlug = currentOrg?.slug ?? null;

  const openNew = useCallback((door: NewDoor, finish?: NewFinish) => {
    if (atLimit && door !== 'first_run') {
      // The window never opens to fail at its last step (F83): the list says why, naming the event that holds the slot.
      // The list's own address (every plan reaches it; /admin/org/* bounces a Tournament-plan org away).
      if (orgSlug) router.push(`/${orgSlug}/admin/tournaments/manage`);
      return;
    }
    finishRef.current = finish ?? null;
    setOpen({ kind: 'new', door });
  }, [atLimit, orgSlug, router]);
  const openReuse = useCallback((source: ReuseSource, door: ReuseDoor) => {
    finishRef.current = null;
    setOpen({ kind: 'reuse', door, source });
  }, []);
  const openInto = useCallback((draft: IntoDraft, done?: () => void) => {
    finishRef.current = null;
    intoDoneRef.current = done ?? null;
    setOpen({ kind: 'into', draft });
  }, []);
  const value = useMemo(() => ({ openNew, openReuse, openInto }), [openNew, openReuse, openInto]);

  async function landInDraft({ sourceName }: { sourceName: string }) {
    const done = intoDoneRef.current;
    intoDoneRef.current = null;
    setOpen(null);
    await refresh();
    router.refresh();
    done?.();
    setNotice({ key: Date.now(), message: REUSE_WORDS.broughtIn(sourceName) });
  }

  async function landOnNewDraft(created: CreatedTournament) {
    if (!currentOrg) return;
    const finish = finishRef.current;
    setOpen(null);
    finishRef.current = null;
    if (finish?.onCreated) { await finish.onCreated(created); return; }
    // The new draft becomes the current event, then its board opens.
    await refresh(created.id);
    router.push(`/${currentOrg.slug}/admin/tournaments/dashboard`);
    if (created.creationMethod === 'reused_setup' && created.sourceName) {
      setNotice({ key: Date.now(), message: REUSE_WORDS.created(created.sourceName) });
    }
  }

  function close() {
    const finish = finishRef.current;
    setOpen(null);
    finishRef.current = null;
    intoDoneRef.current = null;
    finish?.onClose?.();
  }

  // The venue step's word for a lane ("Diamond"): the newest event's sport (a new tournament takes the column's default).
  const sport = tournaments.length ? [...tournaments].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0].sport ?? null : null;

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
          sourceSurface={open.kind === 'into' ? 'unknown' : open.door}
          previewOrg={currentOrg}
          canManageBranding={Boolean(userRole && hasCapability(userRole, userCapabilities, 'manage_branding'))}
          canClone={hasPlanFeature(currentOrg.planId, 'tournament_cloning')}
          sport={sport}
          into={open.kind === 'into' ? open.draft : null}
          onBroughtIn={landInDraft}
          onClose={close}
          onCreated={landOnNewDraft}
        />
      )}
      {notice && <NoticePill key={notice.key} message={notice.message} onDone={() => setNotice(null)} />}
    </SetupWizardContext.Provider>
  );
}
