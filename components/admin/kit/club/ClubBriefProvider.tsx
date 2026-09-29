'use client';
/**
 * ClubBriefProvider — the morning brief, read ONCE for the whole kit frame (Club Tier Stage 1,
 * screens session). The hub's "This morning" strip, the desktop rail's waiting counts and the phone
 * bar's all read this one answer, and so does the plan-aware program ORDER (the brief's `shape`:
 * what the club runs). Three readers, one fetch, one set of numbers — a rail that said "3 waiting"
 * beside a hub that said 2 would be the two-navs drift the coaches portal already paid for once.
 *
 * Mounted by `AdminChrome` round the whole frame. It reads again whenever you come back to the hub
 * (the page whose job is "what waits this morning"), so the counts there are never a visit stale.
 *
 * ⚠ Before the first answer the ORDER is still right for most clubs: `fallbackShape` reads what the
 * org itself says (a League plan runs its house league by definition) and the tournaments the shell
 * already holds, so the rail does not reshuffle on arrival for a club that runs neither.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import type { ClubShape } from '@/lib/admin-kit-nav';

export type BriefKey = 'tryoutApplications' | 'paymentRequests' | 'installmentsDue' | 'assistantCoaches';

export type ClubBrief = {
  asOf: string;
  /** A key is present only where the person can act on it; a present 0 means nothing waits. */
  counts: Partial<Record<BriefKey, number>>;
  shape: ClubShape;
  /** Present only for someone who can open Rep Teams. */
  teams?: { active: number; groups: number };
  detail: {
    tryoutApplications?: { teams: number; oldest: { teamId: string; programYearId: string } | null };
    paymentRequests?: { oldestDays: number | null };
  };
};

type State = { orgSlug: string | null; status: 'loading' | 'ready' | 'error'; brief: ClubBrief | null };

type ClubBriefValue = {
  status: State['status'];
  brief: ClubBrief | null;
  /** What the club runs — the brief's answer, or the org's own facts until it arrives. */
  shape: ClubShape;
  reload: () => void;
};

const ClubBriefContext = createContext<ClubBriefValue | null>(null);

export function ClubBriefProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { tournaments } = useTournament();
  const orgSlug = currentOrg?.slug ?? null;
  const base = orgSlug ? `/${orgSlug}/admin` : null;
  const onHub = pathname === base;
  // A tournament-only workspace has no club hub and no program order to feed; a cancelled one has
  // nothing to act on (every program is closed until it pays again).
  const enabled = !!currentOrg && !isTournamentOnlyWorkspace(currentOrg) && currentOrg.subscriptionStatus !== 'canceled';

  const [state, setState] = useState<State>({ orgSlug: null, status: 'loading', brief: null });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  // Count ARRIVALS on the hub, not every change of "am I on it" — leaving the hub needs no new numbers
  // (the rail keeps the ones it has), and keying the read on the bare boolean fetched again on the way out.
  const [wasOnHub, setWasOnHub] = useState(onHub);
  const [hubArrivals, setHubArrivals] = useState(0);
  if (onHub !== wasOnHub) {
    setWasOnHub(onHub);
    if (onHub) setHubArrivals(n => n + 1);
  }

  useEffect(() => {
    if (!enabled || !orgSlug) return;
    // A late answer for the org you just left must never paint under this one's name.
    let stale = false;
    fetch(`/api/admin/club-brief?orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((brief: ClubBrief) => { if (!stale) setState({ orgSlug, status: 'ready', brief }); })
      .catch(() => { if (!stale) setState(prev => ({ orgSlug, status: 'error', brief: prev.orgSlug === orgSlug ? prev.brief : null })); });
    return () => { stale = true; };
    // `hubArrivals` re-reads on every return to the hub; `nonce` on a "Try again".
  }, [enabled, orgSlug, hubArrivals, nonce]);

  const current = state.orgSlug === orgSlug ? state : { orgSlug, status: 'loading' as const, brief: null };
  const fallbackShape = useMemo<ClubShape>(() => ({
    runsHouseLeague: currentOrg?.planId === 'league' || currentOrg?.freeFloor === 'league_starter',
    hostsTournaments: tournaments.some(t => t.status !== 'archived'),
  }), [currentOrg?.planId, currentOrg?.freeFloor, tournaments]);

  const value = useMemo<ClubBriefValue>(() => ({
    status: current.status,
    brief: current.brief,
    shape: current.brief?.shape ?? fallbackShape,
    reload,
  }), [current.status, current.brief, fallbackShape, reload]);

  return <ClubBriefContext.Provider value={value}>{children}</ClubBriefContext.Provider>;
}

/**
 * The morning brief and the club's shape. Outside the provider (a test, anything rendered outside the
 * admin frame) it answers "nothing known yet" with the org-less shape, so a caller never has to branch.
 */
export function useClubBrief(): ClubBriefValue {
  return useContext(ClubBriefContext) ?? {
    status: 'loading',
    brief: null,
    shape: { runsHouseLeague: false, hostsTournaments: false },
    reload: () => {},
  };
}

/**
 * The waiting count a program or one of its pages carries on the rail and the phone bar. Rep Teams
 * carries its two pages' counts (Payment requests, Assistant coaches) — the hub's "3 waiting" is the
 * same sum, so the door, the rail and the bar say one number. Tryout applications sit on each
 * team's own page (no rail row to carry them) and installments on the Rep Teams hub's list; they are
 * the morning strip's, not the rail's.
 */
export function briefPageCount(brief: ClubBrief | null, pageKey: string): number {
  if (!brief) return 0;
  if (pageKey === 'rt-payment-requests') return brief.counts.paymentRequests ?? 0;
  if (pageKey === 'rt-assistant-coaches') return brief.counts.assistantCoaches ?? 0;
  return 0;
}

export function briefProgramCount(brief: ClubBrief | null, programKey: string): number {
  if (programKey !== 'rep-teams') return 0;
  return briefPageCount(brief, 'rt-payment-requests') + briefPageCount(brief, 'rt-assistant-coaches');
}
