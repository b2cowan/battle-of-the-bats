'use client';
/**
 * lib/hooks/useDeviceEntityFollows.ts — Phase 6
 * Resolves a signed-out device's whole-tournament + organization follows into Home/Scores-ready
 * cards. localStorage holds only the cached name, so the public status is resolved via one POST to
 * /api/consumer/follows/entities. Shared by Home (HomePersonalization) and All-following
 * (FollowingList), matching the lib/hooks convention (useFollowFeed / useScoresFeed). One POST per
 * device-list change; no polling — these statuses move slowly and both surfaces re-fetch on mount.
 * Render-time guards return [] the moment the corresponding device list empties (no stale state,
 * no synchronous reset-in-effect).
 */
import { useEffect, useState } from 'react';
import type { FollowedTournamentEntry, FollowedOrgEntry } from '@/lib/follow';
import type { TournamentFollowCard, OrgFollowCard } from '@/lib/home-following';

interface DeviceEntities { wholeEvent: TournamentFollowCard[]; organizations: OrgFollowCard[] }
/** Resolved cards tagged with the device-follow key they reflect, so a render can discard cards for
 *  a since-changed follow set (the stale-swap guard, no synchronous reset-in-effect). */
interface KeyedEntities extends DeviceEntities { key: string }

export function useDeviceEntityFollows(
  deviceTournaments: FollowedTournamentEntry[],
  deviceOrgs: FollowedOrgEntry[],
  enabled: boolean,
): DeviceEntities {
  const [entities, setEntities] = useState<KeyedEntities>({ key: '', wholeEvent: [], organizations: [] });
  const key = enabled
    ? [...deviceTournaments.map(t => `${t.orgSlug}/${t.tournamentSlug}`), ...deviceOrgs.map(o => `o:${o.orgSlug}`)].sort().join(',')
    : '';

  useEffect(() => {
    if (!enabled || (deviceTournaments.length === 0 && deviceOrgs.length === 0)) return;
    let cancelled = false;
    fetch('/api/consumer/follows/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournaments: deviceTournaments.map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug, name: t.name })),
        orgs: deviceOrgs.map(o => ({ orgSlug: o.orgSlug, name: o.name })),
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: Partial<DeviceEntities> | null) => {
        if (cancelled || !data) return;
        setEntities({ key, wholeEvent: data.wholeEvent ?? [], organizations: data.organizations ?? [] });
      })
      .catch(() => { /* additive — leave prior state */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the meaningful change
  }, [key, enabled]);

  // Surface cards ONLY when they reflect the CURRENT follow set (entities.key === key) — so when the
  // device list changes (swap or empties), the previous set's cards vanish immediately rather than
  // lingering until the new POST resolves. No synchronous reset-in-effect needed.
  const fresh = enabled && entities.key === key;
  return {
    wholeEvent: fresh && deviceTournaments.length > 0 ? entities.wholeEvent : [],
    organizations: fresh && deviceOrgs.length > 0 ? entities.organizations : [],
  };
}
