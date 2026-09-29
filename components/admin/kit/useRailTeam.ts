'use client';
/**
 * The rail's team block NAMES the team you are in ("9U A" over Team page · Roster · Schedule ·
 * Tryouts · Coaches — Club Tier Stage 2, specimen 2's rail). The rail lives in the admin chrome, above
 * the page tree, and has no team read of its own; a second fetch of the team per navigation would be
 * waste when the page on screen has already loaded it. So the team's pages PUBLISH the name they read
 * and the rail subscribes. Until a page has published, the block's label is the plain word "Team".
 */
import { useEffect, useSyncExternalStore } from 'react';

type Published = { teamId: string; name: string } | null;
let current: Published = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** A team page: publish the name it read, so the rail can show it. */
export function usePublishRailTeam(teamId: string | null, name: string | null | undefined): void {
  useEffect(() => {
    if (!teamId || !name) return;
    if (current?.teamId === teamId && current.name === name) return;
    current = { teamId, name };
    listeners.forEach(l => l());
  }, [teamId, name]);
}

/** The rail: the published name of THIS team, or null. */
export function useRailTeamName(teamId: string | null): string | null {
  const published = useSyncExternalStore(subscribe, () => current, () => null);
  return teamId && published?.teamId === teamId ? published.name : null;
}
