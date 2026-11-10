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
 * ⚠ Before the first answer the ORDER is still right: the admin layout reads the club's shape on the server and hands it
 * down as `seedShape` (navigation Phase 1 Part B, owner 2026-11-09), so the rows and the foot's Tournaments door are in the
 * server's HTML and nothing moves when the brief lands. `initialShape` is the seed, or the guess for a render with no seed (a test, a
 * failed server read): what the org itself says (a League plan runs its house league by definition) and the tournaments
 * the shell already holds.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { hasBillingAccess } from '@/lib/roles';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import type { ClubTaken } from '@/lib/permit-dates-off-view';
import type { FeesOwed } from '@/lib/fee-invoice-alert';
import { isAdminProgramKey, repTeamsTabs, type AdminProgramKey, type ClubShape } from '@/lib/admin-kit-nav';

export type BriefKey = 'tryoutApplications' | 'paymentRequests' | 'installmentsDue' | 'assistantCoaches' | 'familyDuplicates' | 'familyChildDuplicates' | 'leagueRegistrations';

export type ClubBrief = {
  asOf: string;
  /** A key is present only where the person can act on it; a present 0 means nothing waits. */
  counts: Partial<Record<BriefKey, number>>;
  shape: ClubShape;
  /** Present only for someone who can open Rep Teams. */
  teams?: { active: number; groups: number };
  detail: {
    tryoutApplications?: { teams: number; oldest: { teamId: string; programYearId: string } | null };
    /** `holdingPayout`: waiting requests the club's answer is the one thing between a team and its
     *  end-of-season payout (Stage 3a, Ask 5b) — named on the door card. */
    paymentRequests?: { oldestDays: number | null; holdingPayout?: number };
    /** `sent`: payments coaches say are on the way; `overdue`: the overdue band inside the count. */
    installmentsDue?: { sent: number; overdue?: number };
  };
  /** Fee invoices the club owes FieldLogicHQ — OWNER ONLY (present only with billing access; absent otherwise and when the read failed). */
  feesOwed?: FeesOwed;
};

type State = { orgSlug: string | null; status: 'loading' | 'ready' | 'error'; brief: ClubBrief | null };

type ClubBriefValue = {
  status: State['status'];
  brief: ClubBrief | null;
  /** What the club runs — the brief's answer, or the org's own facts until it arrives. */
  shape: ClubShape;
  /**
   * "Outside the permit · N" (Club Tier 13c Session B, C3 = A): the bookings the club's permits' dates off took, each once.
   * Null when nothing is outside a permit, before it is read, when it fails, and for anyone but the owner and an unscoped
   * club admin. ⚖ ITS OWN READ, asked only after the brief has answered (owner 2026-11-08, the measured gate: it costs one
   * small read for a club with no date off ahead, about sixteen for one with) — so it never holds up the brief's counts.
   */
  outside: ClubTaken | null;
  reload: () => void;
};

const ClubBriefContext = createContext<ClubBriefValue | null>(null);

export function ClubBriefProvider({ children, seedShape }: { children: ReactNode; seedShape?: ClubShape }) {
  const pathname = usePathname();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { tournaments } = useTournament();
  const orgSlug = currentOrg?.slug ?? null;
  const base = orgSlug ? `/${orgSlug}/admin` : null;
  const onHub = pathname === base;
  // A tournament-only workspace has no club hub and no program order to feed — but its OWNER still owes fee invoices
  // (Fee invoice alerts, Part 2, owner ruling 2026-11-05), so the read stays on for the person with the billing door and
  // for no one else there. A cancelled one has nothing to act on (every program is closed until it pays again).
  const enabled = !!currentOrg && currentOrg.subscriptionStatus !== 'canceled'
    && (!isTournamentOnlyWorkspace(currentOrg) || hasBillingAccess(userRole, userCapabilities));

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

  // The permits' count rides behind the brief: each new answer of the brief (mount, a return to the hub, Try again) asks
  // again. Owner and admin on a plan with permits only — the route refuses a scoped admin, which reads as "no count".
  const asksOutside = enabled && !!currentOrg && (userRole === 'owner' || userRole === 'admin')
    && hasOrgVenueLibrary(currentOrg.planId) && !isTournamentOnlyWorkspace(currentOrg);
  // …and on LEAVING Permits, where a date off is added or a booking's permit changes: the pill follows the change on the
  // way out instead of waiting for the next return to the hub (/review 13c B). Leaving, not every visit, as the hub counts.
  const onPermits = !!base && (pathname === `${base}/permits` || pathname.startsWith(`${base}/permits/`));
  const [wasOnPermits, setWasOnPermits] = useState(onPermits);
  const [permitsLeft, setPermitsLeft] = useState(0);
  if (onPermits !== wasOnPermits) {
    setWasOnPermits(onPermits);
    if (!onPermits) setPermitsLeft(n => n + 1);
  }
  const [outside, setOutside] = useState<{ orgSlug: string | null; value: ClubTaken | null }>({ orgSlug: null, value: null });
  const briefAnswer = current.brief;
  useEffect(() => {
    if (!asksOutside || !orgSlug || !briefAnswer) return;
    let stale = false;
    fetch(`/api/admin/org/permits?orgSlug=${encodeURIComponent(orgSlug)}&outside=1`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((r: { outside: ClubTaken | null }) => { if (!stale) setOutside({ orgSlug, value: r.outside ?? null }); })
      // A failed count draws nothing (never a wrong one): the Overview's card and the pill simply wait for the next read.
      .catch(() => { if (!stale) setOutside({ orgSlug, value: null }); });
    return () => { stale = true; };
  }, [asksOutside, orgSlug, briefAnswer, permitsLeft]);
  const outsideNow = asksOutside && outside.orgSlug === orgSlug ? outside.value : null;
  const initialShape = useMemo<ClubShape>(() => seedShape ?? ({
    runsHouseLeague: currentOrg?.planId === 'league' || currentOrg?.freeFloor === 'league_starter',
    hostsTournaments: tournaments.some(t => t.status !== 'archived'),
  }), [seedShape, currentOrg?.planId, currentOrg?.freeFloor, tournaments]);

  const value = useMemo<ClubBriefValue>(() => ({
    status: current.status,
    brief: current.brief,
    shape: current.brief?.shape ?? initialShape,
    outside: outsideNow,
    reload,
  }), [current.status, current.brief, initialShape, outsideNow, reload]);

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
    outside: null,
    reload: () => {},
  };
}

/**
 * The waiting count a program or one of its pages carries on the rail and the phone bar. Rep Teams
 * carries its Assistant coaches page's count, Accounting its waiting payment requests — the hub's
 * "N waiting" is the same figure, so the door, the rail and the bar say one number. Tryout
 * applications sit on each team's own page (no rail row to carry them) and installments on
 * Accounting › Allocations' Coming due; they are the morning strip's, not the rail's.
 */
export function briefPageCount(brief: ClubBrief | null, pageKey: string): number {
  if (!brief) return 0;
  if (pageKey === 'rt-assistant-coaches') return brief.counts.assistantCoaches ?? 0;
  return 0;
}

/**
 * ⚖ Payment requests count on ACCOUNTING since Club Tier Stage 3a (Ask 2: the requests moved there,
 * and "Rep Teams' waiting count drops the requests"). ⚖ N9 (Club Tier Stage 13i): a place's row carries the sum of its
 * tabs' counts, at every depth — Rep teams' is computed from its own tab list, so a tab that gains a count is summed.
 */
export function briefProgramCount(brief: ClubBrief | null, programKey: AdminProgramKey): number {
  if (programKey === 'rep-teams') return REP_TEAMS_TAB_IDS.reduce((n, id) => n + briefPageCount(brief, id), 0);
  // Families' Duplicates tab is two halves (parents, children — Stage 14 S6): the row wears their sum.
  if (programKey === 'families') return familyDuplicatesTotal(brief);
  const key = PROGRAM_COUNT[programKey];
  return key ? brief?.counts[key] ?? 0 : 0;
}

/** Rep teams' tab ids (the address part plays no role in a count). */
const REP_TEAMS_TAB_IDS = repTeamsTabs('').map(t => t.id);

/** A club place's waiting count — a program's (`briefProgramCount`), or 0 for Organization, whose tabs carry none. The
 *  sidebar's place rows and the phone's tabs, tiles and sheet rows all read this one. */
export function briefPlaceCount(brief: ClubBrief | null, placeKey: string): number {
  return isAdminProgramKey(placeKey) ? briefProgramCount(brief, placeKey) : 0;
}

/** A program that is one page with tabs carries its waiting tab's count on its rail row: Accounting its Payment
 *  requests', Families its Duplicates' (⚖ Club Tier Stage 5b, Ask 14). House league carries the registrations waiting for
 *  review across the club's live seasons (Stage 13a, B2) — the sum of its seasons' own Registrations pills. */
const PROGRAM_COUNT: Partial<Record<AdminProgramKey, BriefKey>> = {
  accounting: 'paymentRequests',
  'house-league': 'leagueRegistrations',
};

/** Everything waiting on Families › Duplicates: the parents' proposals plus the children's. */
export function familyDuplicatesTotal(brief: ClubBrief | null): number {
  return (brief?.counts.familyDuplicates ?? 0) + (brief?.counts.familyChildDuplicates ?? 0);
}
