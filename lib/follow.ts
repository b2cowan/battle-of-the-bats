'use client';
/**
 * lib/follow.ts
 * Single source of truth for the anonymous "follow a team" feature on public
 * tournament pages. State lives in localStorage (no account required) under
 * `fl_follow_team_${orgSlug}_${tournamentSlug}` → { id, name, divisionId }.
 *
 * Previously these helpers were duplicated across ScheduleContent, StandingsContent,
 * and TeamsContent. Keep the storage key + shape identical to those originals so
 * existing followers carry over.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSession } from './auth';
import { tournamentToday } from './timezone';
import type { Team, Tournament } from './types';

export interface FollowedTeam {
  id: string;
  name: string;
  divisionId?: string;
  /** N2: pin auto-seeded from the ACCOUNT (never explicitly followed on this
   *  device). Seeded pins are reconciled by the account sync — cleared on
   *  sign-out (shared-device hygiene) and replaced if the account stops
   *  following the team. An explicit on-device follow never carries this. */
  seeded?: boolean;
}

const FOLLOW_KEY_PREFIX = 'fl_follow_team_';

export function followKey(orgSlug: string, tournamentSlug: string): string {
  return `${FOLLOW_KEY_PREFIX}${orgSlug}_${tournamentSlug}`;
}

/** A followed team plus the tournament it belongs to (for cross-tournament lists). */
export interface FollowedTeamEntry extends FollowedTeam {
  orgSlug: string;
  tournamentSlug: string;
}

/**
 * Every team this device follows, across all tournaments — powers the consumer
 * shell's Following / Scores tabs (unified-app Phase 1). Reads the same
 * `fl_follow_team_${orgSlug}_${tournamentSlug}` keys the per-tournament follow
 * uses; org/tournament slugs are kebab-case (no underscores), so the first
 * underscore after the prefix is the org/tournament separator.
 */
export function readAllFollowedTeams(): FollowedTeamEntry[] {
  if (typeof window === 'undefined') return [];
  const out: FollowedTeamEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(FOLLOW_KEY_PREFIX)) continue;
      const rest = key.slice(FOLLOW_KEY_PREFIX.length);
      const sep = rest.indexOf('_');
      if (sep <= 0) continue;
      const orgSlug = rest.slice(0, sep);
      const tournamentSlug = rest.slice(sep + 1);
      if (!orgSlug || !tournamentSlug) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<FollowedTeam>;
        if (parsed.id) {
          out.push({ id: parsed.id, name: parsed.name ?? '', divisionId: parsed.divisionId, orgSlug, tournamentSlug });
        }
      } catch {
        /* skip a malformed entry */
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readFollowedTeam(orgSlug: string, tournamentSlug: string): FollowedTeam | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followKey(orgSlug, tournamentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FollowedTeam>;
    return parsed.id
      ? { id: parsed.id, name: parsed.name ?? '', divisionId: parsed.divisionId, seeded: parsed.seeded === true || undefined }
      : null;
  } catch {
    return null;
  }
}

export function readFollowedTeamId(orgSlug: string, tournamentSlug: string): string | null {
  return readFollowedTeam(orgSlug, tournamentSlug)?.id ?? null;
}

/**
 * Fire-and-forget: mirror a follow/unfollow onto the signed-in account (fan_follows) so
 * it travels across devices (unified-app Phase 2). The device localStorage write above is
 * the source of truth and always happens first; this is purely additive and never blocks.
 * The server no-ops (returns { linked: false }) for anonymous callers, so this is safe to
 * call unconditionally — the account link only happens when there IS an account.
 *
 * Exported as THE one mirror call — every surface that attaches a follow to the account
 * (follow buttons via saveFollowedTeam, the alerts toggles, the signup nudge) goes through
 * here so the endpoint contract and `keepalive` (survives an imminent navigation) are
 * decided once. Idempotent server-side.
 */
export function syncFollowToAccount(
  action: 'follow' | 'unfollow',
  params: { teamId: string; orgSlug: string; tournamentSlug: string },
): void {
  postFollowSync({ action, entityType: 'team', ...params });
}

/** THE one POST to the account follow-mirror endpoint — every entity type (team, whole
 *  tournament, org) fire-and-forgets through here so the endpoint contract + keepalive are
 *  decided once. Anonymous server no-op ({ linked: false }); the device write is always the
 *  source of truth and has already happened before this is called. */
function postFollowSync(body: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/consumer/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => { /* device follow already saved; account sync is best-effort */ });
  } catch {
    /* ignore */
  }
}

/** Mirror a whole-TOURNAMENT follow/unfollow onto the account (Phase 6). */
export function syncTournamentFollowToAccount(
  action: 'follow' | 'unfollow',
  params: { orgSlug: string; tournamentSlug: string },
): void {
  postFollowSync({ action, entityType: 'tournament', ...params });
}

/** Mirror an ORGANIZATION follow/unfollow onto the account (Phase 6). */
export function syncOrgFollowToAccount(
  action: 'follow' | 'unfollow',
  params: { orgSlug: string },
): void {
  postFollowSync({ action, entityType: 'org', ...params });
}

export function saveFollowedTeam(
  orgSlug: string,
  tournamentSlug: string,
  team: Pick<Team, 'id' | 'name' | 'divisionId'> & { seeded?: boolean },
): void {
  if (typeof window === 'undefined') return;
  invalidateAccountSync();
  window.localStorage.setItem(
    followKey(orgSlug, tournamentSlug),
    // `seeded` only persists when true (explicit follows stay unmarked — and an
    // explicit follow OVERWRITING a seeded pin correctly un-marks it).
    JSON.stringify({ id: team.id, name: team.name, divisionId: team.divisionId, ...(team.seeded ? { seeded: true } : {}) }),
  );
  // Notify same-tab listeners (the native `storage` event only fires cross-tab).
  window.dispatchEvent(new CustomEvent('fl-follow-change'));
  syncFollowToAccount('follow', { teamId: team.id, orgSlug, tournamentSlug });
}

export function clearFollowedTeam(orgSlug: string, tournamentSlug: string): void {
  if (typeof window === 'undefined') return;
  invalidateAccountSync();
  // Read the team id before removing so we can mirror the unfollow to the account.
  const prev = readFollowedTeam(orgSlug, tournamentSlug);
  window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
  window.dispatchEvent(new CustomEvent('fl-follow-change'));
  if (prev?.id) {
    syncFollowToAccount('unfollow', { teamId: prev.id, orgSlug, tournamentSlug });
    // N2: keep the hydrated account set honest too, so follow buttons for this
    // team flip immediately instead of waiting for the next hydration.
    pruneAccountFollow(orgSlug, tournamentSlug, prev.id);
  }
}

/**
 * Hook wrapper around the followed-team state. Hydrates after first paint
 * (browser-only storage), and keeps in sync across tabs (`storage`) and across
 * components in the same tab (`fl-follow-change`).
 */
export function useFollowedTeam(orgSlug: string, tournamentSlug: string) {
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === followKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, [orgSlug, tournamentSlug]);

  const follow = useCallback(
    (team: Pick<Team, 'id' | 'name' | 'divisionId'>) => {
      saveFollowedTeam(orgSlug, tournamentSlug, team);
      setFollowedTeamId(team.id);
    },
    [orgSlug, tournamentSlug],
  );

  const unfollow = useCallback(() => {
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
  }, [orgSlug, tournamentSlug]);

  return { followedTeamId, follow, unfollow } as const;
}

/**
 * Hook wrapper around every followed team on this device. Hydrates after first
 * paint (browser-only storage) and stays in sync across tabs (`storage`) and
 * within the tab (`fl-follow-change`). `ready` distinguishes "still hydrating"
 * from "genuinely following nothing" so the UI doesn't flash an empty state.
 */
export function useAllFollowedTeams() {
  const [teams, setTeams] = useState<FollowedTeamEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => { setTeams(readAllFollowedTeams()); setReady(true); };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, []);

  return { teams, ready } as const;
}

/* ── Phase 6 — whole-tournament + organization device follows ──────────────────
   Plain device follows, deliberately WITHOUT the team pin/seeded/reconcile machinery
   above (F6 full independence): a tournament/org follow never seeds a my-team pin, never
   clears on sign-out, never auto-reconciles. Storage keeps the display name cached so
   Home/Scores can label instantly before the server enriches:
     fl_follow_tourn_${orgSlug}_${tournamentSlug} → { name, followedAt }
     fl_follow_org_${orgSlug}                     → { name, followedAt }
   They reuse the same `fl-follow-change` (same-tab) + `storage` (cross-tab) sync as teams. */

const FOLLOW_TOURN_KEY_PREFIX = 'fl_follow_tourn_';
const FOLLOW_ORG_KEY_PREFIX = 'fl_follow_org_';

export function followTournamentKey(orgSlug: string, tournamentSlug: string): string {
  return `${FOLLOW_TOURN_KEY_PREFIX}${orgSlug}_${tournamentSlug}`;
}
export function followOrgKey(orgSlug: string): string {
  return `${FOLLOW_ORG_KEY_PREFIX}${orgSlug}`;
}

export interface FollowedTournamentEntry {
  orgSlug: string;
  tournamentSlug: string;
  name: string;
  followedAt: string;
}
export interface FollowedOrgEntry {
  orgSlug: string;
  name: string;
  followedAt: string;
}

function notifyFollowChange(): void {
  window.dispatchEvent(new CustomEvent('fl-follow-change'));
}

// ── Whole tournament ──────────────────────────────────────────────────────────
export function readFollowedTournament(orgSlug: string, tournamentSlug: string): FollowedTournamentEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followTournamentKey(orgSlug, tournamentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FollowedTournamentEntry>;
    return { orgSlug, tournamentSlug, name: parsed.name ?? '', followedAt: parsed.followedAt ?? '' };
  } catch {
    return null;
  }
}

export function isFollowingTournament(orgSlug: string, tournamentSlug: string): boolean {
  return readFollowedTournament(orgSlug, tournamentSlug) !== null;
}

export function saveFollowedTournament(orgSlug: string, tournamentSlug: string, name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    followTournamentKey(orgSlug, tournamentSlug),
    JSON.stringify({ name, followedAt: new Date().toISOString() }),
  );
  notifyFollowChange();
  syncTournamentFollowToAccount('follow', { orgSlug, tournamentSlug });
}

export function clearFollowedTournament(orgSlug: string, tournamentSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followTournamentKey(orgSlug, tournamentSlug));
  notifyFollowChange();
  syncTournamentFollowToAccount('unfollow', { orgSlug, tournamentSlug });
}

export function readAllFollowedTournaments(): FollowedTournamentEntry[] {
  if (typeof window === 'undefined') return [];
  const out: FollowedTournamentEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(FOLLOW_TOURN_KEY_PREFIX)) continue;
      const rest = key.slice(FOLLOW_TOURN_KEY_PREFIX.length);
      const sep = rest.indexOf('_');
      if (sep <= 0) continue;
      const orgSlug = rest.slice(0, sep);
      const tournamentSlug = rest.slice(sep + 1);
      if (!orgSlug || !tournamentSlug) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<FollowedTournamentEntry>;
        out.push({ orgSlug, tournamentSlug, name: parsed.name ?? '', followedAt: parsed.followedAt ?? '' });
      } catch { /* skip a malformed entry */ }
    }
  } catch { /* storage unavailable */ }
  return out;
}

// ── Organization ──────────────────────────────────────────────────────────────
export function readFollowedOrg(orgSlug: string): FollowedOrgEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followOrgKey(orgSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FollowedOrgEntry>;
    return { orgSlug, name: parsed.name ?? '', followedAt: parsed.followedAt ?? '' };
  } catch {
    return null;
  }
}

export function isFollowingOrg(orgSlug: string): boolean {
  return readFollowedOrg(orgSlug) !== null;
}

export function saveFollowedOrg(orgSlug: string, name: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    followOrgKey(orgSlug),
    JSON.stringify({ name, followedAt: new Date().toISOString() }),
  );
  notifyFollowChange();
  syncOrgFollowToAccount('follow', { orgSlug });
}

export function clearFollowedOrg(orgSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followOrgKey(orgSlug));
  notifyFollowChange();
  syncOrgFollowToAccount('unfollow', { orgSlug });
}

export function readAllFollowedOrgs(): FollowedOrgEntry[] {
  if (typeof window === 'undefined') return [];
  const out: FollowedOrgEntry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(FOLLOW_ORG_KEY_PREFIX)) continue;
      const orgSlug = key.slice(FOLLOW_ORG_KEY_PREFIX.length);
      if (!orgSlug) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<FollowedOrgEntry>;
        out.push({ orgSlug, name: parsed.name ?? '', followedAt: parsed.followedAt ?? '' });
      } catch { /* skip a malformed entry */ }
    }
  } catch { /* storage unavailable */ }
  return out;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
/** Followed-state hook for ONE tournament (the follow strip / sheet row). */
export function useFollowedTournament(orgSlug: string, tournamentSlug: string) {
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    const sync = () => setFollowing(isFollowingTournament(orgSlug, tournamentSlug));
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === followTournamentKey(orgSlug, tournamentSlug)) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, [orgSlug, tournamentSlug]);

  const follow = useCallback((name: string) => { saveFollowedTournament(orgSlug, tournamentSlug, name); setFollowing(true); }, [orgSlug, tournamentSlug]);
  const unfollow = useCallback(() => { clearFollowedTournament(orgSlug, tournamentSlug); setFollowing(false); }, [orgSlug, tournamentSlug]);
  return { following, follow, unfollow } as const;
}

/** Followed-state hook for ONE organization (the org-hero button). */
export function useFollowedOrg(orgSlug: string) {
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    const sync = () => setFollowing(isFollowingOrg(orgSlug));
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === followOrgKey(orgSlug)) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, [orgSlug]);

  const follow = useCallback((name: string) => { saveFollowedOrg(orgSlug, name); setFollowing(true); }, [orgSlug]);
  const unfollow = useCallback(() => { clearFollowedOrg(orgSlug); setFollowing(false); }, [orgSlug]);
  return { following, follow, unfollow } as const;
}

/** Every tournament this device follows — powers Home / Scores signed-out lanes. */
export function useAllFollowedTournaments() {
  const [tournaments, setTournaments] = useState<FollowedTournamentEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setTournaments(readAllFollowedTournaments()); setReady(true); };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, []);
  return { tournaments, ready } as const;
}

/** Every organization this device follows — powers Home's Organizations section + Scores org tiles. */
export function useAllFollowedOrgs() {
  const [orgs, setOrgs] = useState<FollowedOrgEntry[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setOrgs(readAllFollowedOrgs()); setReady(true); };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, []);
  return { orgs, ready } as const;
}

/* ── N2 — account follows on public pages ─────────────────────────────────────
   A signed-in fan's ACCOUNT follows, hydrated client-side per tournament so the
   public pages stop being identity-blind ("Follow" on her own team; no My Team
   pin on a new device). Identity is NEVER server-rendered into public tournament
   HTML (the SW caches it as anonymous content) — same rule as the account chip:
   local session read first (anonymous visitors never hit the network), then one
   GET /api/consumer/follows for the signed-in few.

   Merge model: the device pin stays the single "my team" per tournament. When
   the device has NO pin and the account follows team(s) here, the most recent
   account follow is seeded AS the device pin — every pin surface (dock,
   scorebug, standings highlight, teams sort) lights up with zero re-plumbing.
   Teams the account follows beyond the pin surface as "Following" on their
   buttons via useAccountFollowedTeamIds. Nothing here ever WRITES to the
   account except an explicit unfollow — the device→account claim flow stays
   explicit (locked decision). */

export interface AccountFollow {
  teamId: string;
  teamName: string;
  divisionId: string | null;
}

const ACCOUNT_FOLLOWS_EVENT = 'fl-account-follows-change';

/** Staleness guard for account hydration (/review 2026-07-17). Bumped when a new
 *  sync starts AND on every local follow mutation — an in-flight response older
 *  than either must be discarded, never applied: a stale snapshot once re-seeded
 *  (and server-side re-followed) a team the user had just explicitly unfollowed,
 *  and a slow signed-in response could land after a sign-out's empty hydration. */
let accountSyncGeneration = 0;

function invalidateAccountSync(): void {
  accountSyncGeneration++;
}

/** Module-level cache of the CURRENT tournament's account-followed team ids (one
 *  tournament on screen at a time; re-hydrated by AccountFollowSync on nav/auth
 *  change). Ids only — the full follow objects are consumed at hydration time
 *  (pin seeding) and never needed again. The Set reference is shared with every
 *  hook consumer so unchanged hydrations bail out of re-renders via Object.is. */
let accountFollows: { key: string; teamIds: Set<string> } | null = null;

function accountKey(orgSlug: string, tournamentSlug: string): string {
  return `${orgSlug}/${tournamentSlug}`;
}

function setAccountFollows(orgSlug: string, tournamentSlug: string, teamIds: Set<string>): void {
  accountFollows = { key: accountKey(orgSlug, tournamentSlug), teamIds };
  window.dispatchEvent(new CustomEvent(ACCOUNT_FOLLOWS_EVENT));
}

/** Drop one team from the hydrated account set (after an unfollow that already
 *  mirrored server-side) so button state flips without a refetch. */
function pruneAccountFollow(orgSlug: string, tournamentSlug: string, teamId: string): void {
  if (accountFollows?.key !== accountKey(orgSlug, tournamentSlug)) return;
  if (!accountFollows.teamIds.has(teamId)) return;
  const next = new Set(accountFollows.teamIds);
  next.delete(teamId);
  setAccountFollows(orgSlug, tournamentSlug, next);
}

/**
 * Fetch the signed-in account's follows for this tournament and reconcile them
 * onto the device — the "follows travel with you" moment. Anonymous sessions
 * resolve to an empty set with no network call. Called by AccountFollowSync on
 * mount and on auth transitions.
 *
 * Reconciliation rules (/review 2026-07-17):
 *  - No pin + account follows here → seed the pin from the NEWEST follow,
 *    marked `seeded` (an auto-pin, distinct from an explicit on-device follow).
 *  - No session → clear a SEEDED pin (it must never outlive its session on a
 *    shared device) and empty the account set. Explicit pins are untouched.
 *  - Session but the account no longer follows the seeded pin (unfollowed on
 *    another device, or a different account signed in) → replace or clear it.
 *  - Transient fetch failure while signed in → keep whatever state we had; an
 *    error blip must not flip "Following" buttons or touch the pin.
 *  - A response that raced a newer sync or ANY local follow mutation is stale —
 *    discarded wholesale (see accountSyncGeneration).
 */
export async function syncAccountFollowsToDevice(orgSlug: string, tournamentSlug: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const generation = ++accountSyncGeneration;

  let signedIn = false;
  let fetched = false;
  let list: AccountFollow[] = [];
  try {
    const session = await getSession().catch(() => null);
    signedIn = !!session?.user;
    if (signedIn) {
      const res = await fetch(
        `/api/consumer/follows?orgSlug=${encodeURIComponent(orgSlug)}&tournamentSlug=${encodeURIComponent(tournamentSlug)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { follows?: AccountFollow[] };
        if (Array.isArray(data.follows)) {
          list = data.follows;
          fetched = true;
        }
      }
    }
  } catch { /* account layer is additive — the device experience stands alone */ }

  // Stale response — a newer sync started or the user acted while this was in
  // flight. Their intent is fresher than this snapshot; apply nothing.
  if (generation !== accountSyncGeneration) return;

  const pin = readFollowedTeam(orgSlug, tournamentSlug);

  if (!signedIn) {
    setAccountFollows(orgSlug, tournamentSlug, new Set());
    // Shared-device hygiene: an account-seeded pin never outlives its session
    // (also self-heals a leftover seeded pin on any later anonymous visit).
    if (pin?.seeded) clearFollowedTeam(orgSlug, tournamentSlug);
    return;
  }

  if (!fetched) return; // transient failure — keep the last good state

  setAccountFollows(orgSlug, tournamentSlug, new Set(list.map(f => f.teamId)));

  const seedPin = (follow: AccountFollow) =>
    saveFollowedTeam(orgSlug, tournamentSlug, {
      id: follow.teamId,
      name: follow.teamName,
      divisionId: follow.divisionId ?? '',
      seeded: true,
    });

  if (!pin) {
    if (list.length > 0) seedPin(list[0]);
  } else if (pin.seeded && !list.some(f => f.teamId === pin.id)) {
    // The account walked away from the seeded pin — follow it: replace with the
    // newest account follow, or clear when the account follows nothing here.
    if (list.length > 0) seedPin(list[0]);
    else clearFollowedTeam(orgSlug, tournamentSlug);
  }
}

/**
 * The team ids this ACCOUNT follows in this tournament (empty set when anonymous
 * or not yet hydrated). Follow buttons OR this with the device pin so every
 * account-followed team reads "Following", not just the pinned one.
 */
export function useAccountFollowedTeamIds(orgSlug: string, tournamentSlug: string): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const sync = () => {
      setIds(accountFollows?.key === accountKey(orgSlug, tournamentSlug)
        ? accountFollows.teamIds
        : new Set());
    };
    sync();
    window.addEventListener(ACCOUNT_FOLLOWS_EVENT, sync);
    return () => window.removeEventListener(ACCOUNT_FOLLOWS_EVENT, sync);
  }, [orgSlug, tournamentSlug]);

  return ids;
}

/**
 * Unfollow a team on the ACCOUNT (fire-and-forget, idempotent) and update the
 * local account set so buttons flip immediately. Used for account-followed teams
 * that are NOT this device's pin — the pin's own unfollow (clearFollowedTeam)
 * already mirrors to the account.
 */
function unfollowAccountTeam(orgSlug: string, tournamentSlug: string, teamId: string): void {
  invalidateAccountSync();
  pruneAccountFollow(orgSlug, tournamentSlug, teamId);
  syncFollowToAccount('unfollow', { teamId, orgSlug, tournamentSlug });
}

/**
 * THE one unfollow rule for merged follow state (N2): if this team is the device
 * pin, clear the pin (which mirrors its own account unfollow); otherwise it's an
 * account-only follow — unfollow it there. Every follow surface calls this so
 * the pin-vs-account decision can never drift between them. clearFollowedTeam's
 * fl-follow-change dispatch keeps each surface's useFollowedTeam state in sync.
 */
export function unfollowTeamEverywhere(orgSlug: string, tournamentSlug: string, teamId: string): void {
  if (readFollowedTeamId(orgSlug, tournamentSlug) === teamId) clearFollowedTeam(orgSlug, tournamentSlug);
  else unfollowAccountTeam(orgSlug, tournamentSlug, teamId);
}

/**
 * A tournament is "in progress" when today falls within its event window.
 * Used to gate live polling so we only refresh on game day. Mirrors the
 * `isInProgress` check in TournamentHomeContent.
 */
export function isTournamentInProgress(
  tournament: Pick<Tournament, 'startDate' | 'endDate' | 'status'> | null | undefined,
): boolean {
  if (!tournament) return false;
  if (tournament.status !== 'active') return false;
  const { startDate, endDate } = tournament;
  if (!startDate || !endDate) return false;
  // Tournament-local date, not UTC — otherwise this flips false after ~8 PM Eastern on
  // the final evening, killing the dock + live polling during championship play (J6-056).
  const today = tournamentToday();
  return today >= startDate && today <= endDate;
}
