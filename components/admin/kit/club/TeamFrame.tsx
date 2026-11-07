'use client';
/**
 * A REP TEAM IS A PLACE (⚖ Club Tier Stage 13i, A3 — Asks 1 and 2 = A, owner 2026-11-06; drawing tabs 2 and 4).
 *
 * One header on every page of one team: "← Teams" (the way up, named by where it goes — it used to be "← 14U AA" on Roster
 * and "← Teams" on the team page, two back doors for one place), the eyebrow "Rep teams · {group}", the team's name and its
 * season chip; then the team's five tabs (`teamTabs`: Team page · Roster · Schedule · Tryouts · Coaches). The sub-pages lost
 * their own "← {team}" link and title (2026-10-20: a back link stays only where the tab row does not go). No team switcher
 * (not ruled: from 14U AA to 15U AA is through Teams, as before).
 *
 * The team's History and one past season are RECORD pages (owner 2026-11-06): they keep their own back arrows ("← 14U AA",
 * "← History") and this frame draws nothing over them.
 *
 * The header reads the team itself (the light read every sub-page already makes), once per team: a layout outlives the move
 * from tab to tab. Until it answers, the name reads "Team" in the same line, so nothing shifts. A page that CHANGES the team
 * (the Team page: a rename, a season closed or started, archived) publishes what it read (`usePublishTeamHead`), so the chip
 * never says "Live" over a season the page just closed.
 */
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { placeTabFor, teamTabs } from '@/lib/admin-kit-nav';
import { latestClosedSeasonOf, liveSeasonOf } from '@/lib/season-live';
import type { RepProgramYear, RepTeam } from '@/lib/types';
import PlaceFrame from './PlaceFrame';
import { RepChip } from './RepKit';

/** What the team's header says: its name, its group, and its season chip. */
export type TeamHead = { name: string; groupName: string | null; chip: { label: string; live: boolean } | null };

/** The header's words from a team read — the chip the Team page itself drew: Archived, the live season, or the last closed. */
export function teamHeadOf(
  team: Pick<RepTeam, 'name' | 'isArchived'> & { groupName?: string | null },
  seasons: readonly Pick<RepProgramYear, 'name' | 'status' | 'year' | 'createdAt'>[],
): TeamHead {
  const live = liveSeasonOf(seasons);
  const closed = live ? null : latestClosedSeasonOf(seasons);
  const chip = team.isArchived ? { label: 'Archived', live: false }
    : live ? { label: `${live.name} · Live`, live: true }
    : closed ? { label: `${closed.name} · Closed`, live: false }
    : null;
  return { name: team.name, groupName: team.groupName ?? null, chip };
}

// One shared answer for the team on screen: the frame's own read, replaced by a page's newer one.
let current: { teamId: string; head: TeamHead } | null = null;
/** Counts every answer written, so the frame's read never overwrites a page's answer that landed while it was in flight. */
let written = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function publish(teamId: string, head: TeamHead) {
  current = { teamId, head };
  written += 1;
  listeners.forEach(l => l());
}

/** A team page that read (or changed) the team: the header shows what it read. */
export function usePublishTeamHead(teamId: string | null, head: TeamHead | null): void {
  const key = head ? JSON.stringify(head) : '';
  useEffect(() => {
    if (teamId && key) publish(teamId, JSON.parse(key) as TeamHead);
  }, [teamId, key]);
}

function useTeamHead(orgSlug: string, teamId: string, enabled: boolean): TeamHead | null {
  const shared = useSyncExternalStore(subscribe, () => current, () => null);
  // Once per team while the layout stands: moving to a record page and back to a tab must not read the team again.
  const readFor = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !orgSlug || !teamId || readFor.current === teamId) return;
    readFor.current = teamId;
    let live = true;
    let answered = false;
    const asOf = written;
    // A failed read leaves the plain word "Team" in place: the page under it says what failed, with its own retry.
    fetch(`/api/admin/rep-teams/teams/${teamId}?light=1&orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() as Promise<{ team: RepTeam & { groupName?: string | null }; programYears: RepProgramYear[] }> : null))
      .then(d => {
        if (!d) return;
        answered = true;
        // A page that published while this read was in flight keeps its (newer) answer.
        if (live && written === asOf) publish(teamId, teamHeadOf(d.team, d.programYears));
      })
      .catch(() => { /* the page's own read reports the failure */ });
    // Cut off, or failed, before it answered (a record page opened first): the next time round reads again.
    return () => { live = false; if (!answered) readFor.current = null; };
  }, [orgSlug, teamId, enabled]);
  return shared?.teamId === teamId ? shared.head : null;
}

export default function TeamFrame({ children }: { children: ReactNode }) {
  const { orgSlug, teamId } = useParams<{ orgSlug: string; teamId: string }>();
  const pathname = usePathname();
  const repTeams = `/${orgSlug}/admin/rep-teams`;
  const tabs = teamTabs(`${repTeams}/teams/${teamId}`);
  const tab = placeTabFor(tabs, pathname);
  const head = useTeamHead(orgSlug, teamId, tab != null);
  if (!tab) return <>{children}</>;

  const header = (
    <AdminPageHeader
      backTo={{ href: repTeams, label: 'Teams' }}
      crumbs={[{ label: 'Rep teams' }, head?.groupName ? { label: head.groupName } : null]}
      title={head?.name ?? 'Team'}
      titleChips={head?.chip ? <RepChip tone={head.chip.live ? 'good' : 'neutral'}>{head.chip.label}</RepChip> : null}
    />
  );
  return (
    <PlaceFrame header={header} tabs={tabs} activeId={tab} ariaLabel="Team pages">
      {children}
    </PlaceFrame>
  );
}
