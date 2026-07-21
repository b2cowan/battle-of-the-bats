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
import { createClient } from './supabase-browser';
import { tournamentToday } from './timezone';
import type { Team, Tournament } from './types';

/**
 * Who a device follow belongs to (Follow Ownership & Session Partition, Phase 2).
 *  - 'anonymous' — created with NO session. The genuine no-account follow feature;
 *    belongs to the device and survives sign-out.
 *  - 'account'   — exists on the device because of a session: auto-seeded pins AND
 *    follows tapped while signed in (which also mirror to fan_follows). Belongs to
 *    the account, which holds the durable copy; cleared on sign-out so a shared
 *    device never leaks one person's follows to the next.
 * Untagged legacy entries are treated as 'anonymous' (never nuke what we can't
 * classify). This is a separate axis from `seeded` (which drives pin reconciliation).
 */
export type FollowOrigin = 'anonymous' | 'account';

export interface FollowedTeam {
  id: string;
  name: string;
  divisionId?: string;
  /** N2: pin auto-seeded from the ACCOUNT (never explicitly followed on this
   *  device). Seeded pins are reconciled by the account sync — cleared on
   *  sign-out (shared-device hygiene) and replaced if the account stops
   *  following the team. An explicit on-device follow never carries this. */
  seeded?: boolean;
  /** Ownership for the sign-out sweep (Phase 2). Seeded pins are always 'account'. */
  origin?: FollowOrigin;
}

const FOLLOW_KEY_PREFIX = 'fl_follow_team_';

/**
 * Cache of whether a session is active, so the synchronous follow writes below can
 * stamp ownership (`origin`) without an async/network hop. `null` = unknown →
 * treated as anonymous. Kept fresh by the auth watcher below — the single source, so
 * no follow-button surface has to remember to prime it.
 *
 * Known narrow limitation (accepted): the watcher's first event resolves
 * asynchronously (Supabase validates/refreshes the session, occasionally a network
 * hop), so there's a brief window after a fresh load where the hint is still `null`.
 * A follow tapped in that window by a signed-in user is tagged 'anonymous' and thus
 * survives the sign-out sweep (a narrow shared-device leak). We keep `null → anonymous`
 * deliberately: the alternatives are worse — priming the hint 'account' from a stale
 * token would turn the narrow leak into permanent LOSS of a real anonymous follow, and
 * re-tagging by "team is in the account's follow list" would wrongly sweep a genuine
 * anonymous follow of a team the account also follows. The account layer stays correct
 * regardless (the follow is mirrored to fan_follows on write), so this costs at most
 * one leaked follow, never data loss.
 */
let sessionSignedInHint: boolean | null = null;

function resolveFollowOrigin(explicitAccount?: boolean): FollowOrigin {
  if (explicitAccount) return 'account';
  return sessionSignedInHint ? 'account' : 'anonymous';
}

/**
 * Self-subscribed auth watcher (installed once, browser-only) — the single source
 * that keeps `sessionSignedInHint` fresh AND runs the shared-device follow hygiene
 * on sign-out, for EVERY surface. This is why no follow-button page has to prime the
 * hint and why lib/auth stays a thin Supabase wrapper with no dependency on this
 * module. Mirrors lib/fan-alert-prefs-client.ts's ensureAuthWatcher().
 *   - Any state carrying a session → hint true.
 *   - No session (SIGNED_OUT, or a signed-out INITIAL_SESSION on load) → hint false,
 *     then clear every account-owned follow and restore parked anonymous pins — which
 *     also self-heals a device still holding session-derived follows on a later load.
 */
let followAuthWatcherInstalled = false;
function ensureFollowAuthWatcher(): void {
  if (followAuthWatcherInstalled || typeof window === 'undefined') return;
  followAuthWatcherInstalled = true;
  createClient().auth.onAuthStateChange((_event, session) => {
    sessionSignedInHint = !!session?.user;
    if (!session?.user) {
      clearAllAccountOwnedFollows();
      restoreAllParkedFollows();
    }
  });
}
ensureFollowAuthWatcher();

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
      ? { id: parsed.id, name: parsed.name ?? '', divisionId: parsed.divisionId, seeded: parsed.seeded === true || undefined, origin: parsed.origin }
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
    // explicit follow OVERWRITING a seeded pin correctly un-marks it). `origin`
    // records ownership for the sign-out sweep: a seeded pin, or any follow tapped
    // while signed in, is 'account'; an anonymous tap is 'anonymous'.
    JSON.stringify({
      id: team.id,
      name: team.name,
      divisionId: team.divisionId,
      ...(team.seeded ? { seeded: true } : {}),
      origin: resolveFollowOrigin(team.seeded),
    }),
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
 * Sign-out sweep (shared-device hygiene, Phase 2): drop EVERY account-owned device
 * follow across ALL tournaments and orgs — team pins, whole-tournament follows, and
 * org follows alike — not just the one tournament a page happens to have mounted.
 * syncAccountFollowsToDevice only reconciles the tournament on screen, so anything
 * that landed on the device because of a session (seeded pins, or follows tapped
 * while signed in) otherwise survives a sign-out from the consumer shell (Account
 * tab → /discover, where no AccountFollowSync is mounted) and keeps showing as
 * "Following" on Scores/Home. Anonymous follows (origin 'anonymous', or untagged
 * legacy entries) are deliberately left intact — the no-account feature.
 */
export function clearAllAccountOwnedFollows(): void {
  if (typeof window === 'undefined') return;
  const toRemove = collectStorageKeys(key =>
    (key.startsWith(FOLLOW_KEY_PREFIX) || key.startsWith(FOLLOW_TOURN_KEY_PREFIX) || key.startsWith(FOLLOW_ORG_KEY_PREFIX))
    && isAccountOwnedFollow(key));
  for (const key of toRemove) window.localStorage.removeItem(key);
  if (toRemove.length) {
    invalidateAccountSync();
    notifyFollowChange();
  }
}

/** One guarded localStorage key scan, reused by the follow sweeps. Collects the keys
 *  the predicate accepts and tolerates storage being unavailable. */
function collectStorageKeys(predicate: (key: string) => boolean): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && predicate(key)) out.push(key);
    }
  } catch { /* storage unavailable */ }
  return out;
}

/** True for a stored follow that exists because of a session: tagged 'account', or a
 *  legacy seeded team pin (pre-Phase-2 pins carry seeded:true with no origin). */
function isAccountOwnedFollow(key: string): boolean {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '') as { origin?: FollowOrigin; seeded?: boolean };
    return parsed.origin === 'account' || parsed.seeded === true;
  } catch {
    return false;
  }
}

/* ── Session partition (Phase 3) ───────────────────────────────────────────────
   While signed in, the ACCOUNT is authoritative for the single "my team" pin per
   tournament. If the device already holds an ANONYMOUS pin, it is set aside
   ("parked") so the account's own follow can occupy the pin slot — every pin
   surface (dock, standings highlight, teams sort) keeps reading the primary key and
   lights up with the account's team, not the device owner's. The anonymous pin is
   never destroyed: it is restored to the primary slot on sign-out / session end, so
   a shared device shows fan A's teams to fan A and fan B's to fan B. The parked key
   uses a distinct prefix so readAllFollowedTeams / the sign-out sweep never see it. */

const PARKED_TEAM_KEY_PREFIX = 'fl_parked_team_';

function parkedTeamKey(orgSlug: string, tournamentSlug: string): string {
  return `${PARKED_TEAM_KEY_PREFIX}${orgSlug}_${tournamentSlug}`;
}

/** Set the device's anonymous pin aside for the duration of a session. No-op with no pin. */
function parkAnonymousPin(orgSlug: string, tournamentSlug: string): void {
  const primary = followKey(orgSlug, tournamentSlug);
  const raw = window.localStorage.getItem(primary);
  if (!raw) return;
  const parked = parkedTeamKey(orgSlug, tournamentSlug);
  // Never clobber an already-parked pre-session anonymous pin — it has no server
  // backup, so overwriting it loses it permanently. If one already exists, the
  // current primary arose during the session (e.g. a hint-window mistag), so drop it
  // rather than overwrite the genuine parked pin.
  if (window.localStorage.getItem(parked) === null) {
    window.localStorage.setItem(parked, raw);
  }
  window.localStorage.removeItem(primary);
}

/** Move a parked key's value into its primary slot, but only when the slot is free.
 *  Returns true when the primary was written. */
function restoreParkedByKey(parkedKey: string, primaryKey: string): boolean {
  const raw = window.localStorage.getItem(parkedKey);
  if (raw === null) return false;
  // Check the slot BEFORE removing the parked value: if a primary already occupies it
  // (shouldn't happen under the normal clear→restore order, but can under a two-tab
  // sign-out race or a hint-window mistag), leave the parked pin in place so it is
  // never lost — a later restore reclaims it once the slot frees.
  if (window.localStorage.getItem(primaryKey) !== null) return false;
  window.localStorage.removeItem(parkedKey);
  window.localStorage.setItem(primaryKey, raw);
  return true;
}

/** Restore a parked anonymous pin into the primary slot (per-tournament, session end). */
function restoreParkedPin(orgSlug: string, tournamentSlug: string): boolean {
  return restoreParkedByKey(parkedTeamKey(orgSlug, tournamentSlug), followKey(orgSlug, tournamentSlug));
}

/** Global restore of every parked anonymous pin — paired with clearAllAccountOwnedFollows
 *  at sign-out so the device returns to exactly its pre-session anonymous follow set,
 *  regardless of which shell the sign-out happened in. */
export function restoreAllParkedFollows(): void {
  if (typeof window === 'undefined') return;
  let restored = false;
  for (const parked of collectStorageKeys(key => key.startsWith(PARKED_TEAM_KEY_PREFIX))) {
    const primary = FOLLOW_KEY_PREFIX + parked.slice(PARKED_TEAM_KEY_PREFIX.length);
    if (restoreParkedByKey(parked, primary)) restored = true;
  }
  if (restored) notifyFollowChange();
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
    JSON.stringify({ name, followedAt: new Date().toISOString(), origin: resolveFollowOrigin() }),
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
    JSON.stringify({ name, followedAt: new Date().toISOString(), origin: resolveFollowOrigin() }),
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
    // Session over: drop any account-owned device pin (a seeded pin OR a team the
    // account followed while signed in) — it must never outlive its session on a
    // shared device — then restore the device owner's parked anonymous pin. Both
    // also self-heal on any later anonymous visit. Direct removal (not
    // clearFollowedTeam) avoids a spurious account-unfollow mirror.
    let changed = false;
    if (pin && (pin.seeded || pin.origin === 'account')) {
      window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
      changed = true;
    }
    if (restoreParkedPin(orgSlug, tournamentSlug)) changed = true;
    if (changed) notifyFollowChange();
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

  // Session partition (Phase 3): an anonymous device pin is set aside so the account's
  // own follow occupies the single pin slot. After parking, treat this tournament as
  // pinless and seed from the account below.
  let effectivePin = pin;
  let parked = false;
  if (pin && !pin.seeded && pin.origin !== 'account') {
    parkAnonymousPin(orgSlug, tournamentSlug);
    effectivePin = null;
    parked = true;
  }

  if (!effectivePin) {
    if (list.length > 0) seedPin(list[0]);        // seedPin → saveFollowedTeam dispatches the change
    else if (parked) notifyFollowChange();         // parked with nothing to seed → announce the removal once
  } else if (effectivePin.seeded && !list.some(f => f.teamId === effectivePin.id)) {
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
