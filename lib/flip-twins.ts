/**
 * lib/flip-twins.ts — "The Flip": the single source of truth for role⇄public page twins.
 *
 * One pure resolver maps between a role surface (admin now; coach/scorekeeper in later phases) and
 * the matching PUBLIC page — or, for a draft tournament with no public site yet, the admin PREVIEW
 * shell. It works in BOTH directions so the FlipPill (shell + public), the AdminContextStrip
 * "see it live" nudge, and any mirror rows all call the SAME mapping and can never drift apart.
 *
 * Deliberately free of React / Next imports — pure string logic, unit-tested in flip-twins.test.ts.
 *
 * Phase 1 exercises `to-public` from the admin shell. `to-role` (public → admin) and the coach/
 * official hats are implemented + tested here so P2/P3 wire the UI without re-deriving the map.
 */

export type FlipDirection = 'to-public' | 'to-role';
export type FlipHat = 'admin' | 'coach' | 'official';

/** Shared page identity used on both sides of the mapping. */
export type PublicTwinKey = 'overview' | 'schedule' | 'standings' | 'teams' | 'news' | 'rules';

export interface FlipContext {
  orgSlug: string;
  /** Live public slug — present once the tournament has a public site (active/completed/archived). */
  tournamentSlug?: string | null;
  /** Draft tournaments have no public site: twins resolve into the admin PREVIEW shell instead. */
  isDraft?: boolean;
  /** Carried through the game↔Results pair so a finalized score deep-links its own game. */
  gameId?: string | null;
  /**
   * Public → admin (`to-role`): which event to load into the admin area. Public pages can hold
   * several of an org's tournaments, so a page-matched admin href (`…/schedule`) must carry
   * `?tournamentId=` to land on THIS event (the admin tournament-context reads it). Absent on the
   * admin-shell direction — the shell already has its tournament — so those hrefs are unchanged.
   */
  adminTournamentId?: string | null;
  /**
   * Admin screens this staffer can actually open (the path segment after `/admin/tournaments/`,
   * e.g. `'results'`). When resolving `to-role`, an out-of-scope twin lands on the nearest permitted
   * screen instead of a 403. Omit (or leave empty) to allow all — the owner/admin case.
   */
  allowedAdminScreens?: string[];
}

export interface FlipTarget {
  /** Same-tab destination href. */
  href: string;
  /** Bare pill label (e.g. "Public site"); FlipPill prepends the ⇄ glyph. The specific destination is
   *  carried by `href`, not advertised in the label. */
  label: string;
  /** Optional one-line explainer shown under a popover row (e.g. the Standings→Results honesty note). */
  sublabel?: string;
}

/** A direct flip (single) or a small chooser (multi) — e.g. admin Results → Public Schedule/Standings. */
export type FlipResolution =
  | { kind: 'single'; target: FlipTarget }
  | { kind: 'multi'; label: string; targets: FlipTarget[] };

// ── Mapping tables (the ONE place the twin map lives) ────────────────────────────────────────────

/** Admin screen (segment after /admin/tournaments/) → its public twin + the page's own label (the
 *  latter feeds the "⇄ Back to {label}" return memory). ONE map so adding a screen updates both at
 *  once and they can't drift; unlisted screens fall back to the Overview twin / generic "Admin". */
const ADMIN_SCREEN: Record<string, { twin: PublicTwinKey; label: string }> = {
  dashboard:     { twin: 'overview', label: 'Dashboard' },
  communication: { twin: 'news',     label: 'News' },
  schedule:      { twin: 'schedule', label: 'Schedule' },
  registrations: { twin: 'teams',    label: 'Teams' },
  rules:         { twin: 'rules',    label: 'Rules' },
  results:       { twin: 'schedule', label: 'Results' }, // public twin = Schedule (where scores land)
};

/** Public twin → admin screen (the reverse map for `to-role`). */
const PUBLIC_TWIN_TO_ADMIN: Record<PublicTwinKey, string> = {
  overview: 'dashboard',
  news: 'communication',
  schedule: 'schedule',
  standings: 'results', // no admin standings screen — Results is where scores live
  teams: 'registrations',
  rules: 'rules',
};

/** Hat → its role-side label (the public FlipPill reuses this for coach/official rows too). */
export const HAT_LABEL: Record<FlipHat, string> = {
  admin: 'Admin',
  coach: 'Coach',
  official: 'Scorekeeper',
};

/** Preference order when a staffer can't open the exact twin — land on the nearest screen, never 403. */
const ADMIN_SCREEN_FALLBACK_ORDER = ['dashboard', 'schedule', 'results', 'registrations', 'communication', 'rules'];

const STANDINGS_SUBLABEL = 'Standings come from these scores';

// ── Path helpers ─────────────────────────────────────────────────────────────────────────────────

/** The admin screen segment from an admin pathname (`…/admin/tournaments/{screen}/…`), or null. */
function adminScreenFromPath(pathname: string): string | null {
  const match = pathname.match(/\/admin\/tournaments\/([^/?#]+)/);
  return match ? match[1] : null;
}

/** The public section key from a public tournament pathname; `''` means the Overview root. */
function publicSectionFromPath(pathname: string, orgSlug: string, tournamentSlug: string): string {
  const base = `/${orgSlug}/${tournamentSlug}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`) && !pathname.startsWith(`${base}?`)) return '';
  const rest = pathname.slice(base.length).replace(/^\//, '');
  return rest.split(/[/?#]/)[0] || '';
}

function publicBase(ctx: FlipContext): string {
  const slug = ctx.tournamentSlug ?? '';
  return ctx.isDraft
    ? `/${ctx.orgSlug}/admin/tournaments/preview/${slug}`
    : `/${ctx.orgSlug}/${slug}`;
}

/** "Public" on a live event, "Preview" for a draft (no public site exists yet). */
/**
 * Uniform pill label. The page-matched destination is carried by the href, NOT advertised in the
 * label (owner call 2026-07-23) — so the pill reads the same "Public site" everywhere and stays
 * compact on mobile. Drafts (which only have a preview) read "Preview site".
 */
function siteLabel(ctx: FlipContext): string {
  return ctx.isDraft ? 'Preview site' : 'Public site';
}

/**
 * Href for a public twin page. Exported (P3) so coach surfaces that hand-build public links
 * (standings, welcome resources) share the ONE base-URL construction and can't drift from the pill.
 */
export function publicHref(ctx: FlipContext, twin: PublicTwinKey, gameId?: string | null): string {
  const base = publicBase(ctx);
  if (twin === 'overview') return base;
  if (twin === 'schedule' && gameId) return `${base}/schedule?highlightGameId=${encodeURIComponent(gameId)}`;
  return `${base}/${twin}`;
}

/** The public game PAGE (`…/schedule/{gameId}`) — a different route from the Schedule's
 *  `?highlightGameId=` deep-link above. Used by the coach record's per-game links. */
export function publicGamePageHref(ctx: FlipContext, gameId: string): string {
  return `${publicBase(ctx)}/schedule/${gameId}`;
}

/** The public team profile page (`…/teams/{teamId}`) — the coach record's share target. */
export function publicTeamPageHref(ctx: FlipContext, teamId: string): string {
  return `${publicBase(ctx)}/teams/${teamId}`;
}

function adminHref(ctx: FlipContext, screen: string, gameId?: string | null): string {
  const base = `/${ctx.orgSlug}/admin/tournaments`;
  const params = new URLSearchParams();
  // Admin Results focuses a game via `?gameId=` (the existing WI-2 deep-link convention that the
  // Results page already reads) — NOT the public side's `?highlightGameId=`.
  if (screen === 'results' && gameId) params.set('gameId', gameId);
  // Public → admin only: carry the event id so the admin lands on THIS tournament (see
  // FlipContext.adminTournamentId). Never set on the admin-shell direction, so its hrefs stay bare.
  if (ctx.adminTournamentId) params.set('tournamentId', ctx.adminTournamentId);
  const qs = params.toString();
  return qs ? `${base}/${screen}?${qs}` : `${base}/${screen}`;
}

/** Land on the nearest screen the staffer can actually open (never a wrong guess, never a 403). */
function nearestPermittedScreen(preferred: string, allowed?: string[]): string {
  if (!allowed || allowed.length === 0) return preferred; // unscoped (owner/admin) → exact twin
  if (allowed.includes(preferred)) return preferred;
  return ADMIN_SCREEN_FALLBACK_ORDER.find(screen => allowed.includes(screen)) ?? allowed[0];
}

// ── Resolvers ────────────────────────────────────────────────────────────────────────────────────

/**
 * Role surface (admin/coach/official) → the matching public (or preview) page. Always a single target
 * with a uniform "Public site" label; the destination is still page-matched via the href (Results and
 * the coach/official surfaces resolve to the Schedule, unmapped screens to the Overview front page).
 */
function resolveToPublic(pathname: string, hat: FlipHat, ctx: FlipContext): FlipResolution {
  const label = siteLabel(ctx);

  // Coach doors land on the event's public FRONT PAGE (owner call 2026-07-23 — the Overview is
  // the natural "see it as fans do" landing, and where the pre-Flip Fan-view links pointed);
  // the scorekeeper's job is scores, so the official hat lands on the Schedule. With no
  // tournament in context (defensive — P3's contextual model only mounts the pill where one
  // exists), fall back to the org's public root rather than emitting a broken `/{org}//…`.
  if (hat === 'coach' || hat === 'official') {
    if (!ctx.tournamentSlug) {
      return { kind: 'single', target: { href: `/${ctx.orgSlug}`, label } };
    }
    return { kind: 'single', target: { href: publicHref(ctx, hat === 'coach' ? 'overview' : 'schedule'), label } };
  }

  const screen = adminScreenFromPath(pathname);
  // Everything maps to its twin; unmapped screens fall back to Overview (never absent, never wrong).
  const twin: PublicTwinKey = (screen ? ADMIN_SCREEN[screen]?.twin : undefined) ?? 'overview';
  return {
    kind: 'single',
    target: {
      href: publicHref(ctx, twin, twin === 'schedule' ? ctx.gameId : null),
      label,
    },
  };
}

/**
 * Public page → the matching role screen (P2/P3 UI; mapping lives here so it can't drift).
 *
 * NB (P2): this resolves the ADMIN screen for every hat — the `hat` only drives the label. Coach and
 * official destinations are still supplied by the viewer API (the public FlipPill forwards those hrefs
 * directly); P3 moves that record-aware coach landing into this resolver so all three hats resolve here.
 */
function resolveToRole(pathname: string, hat: FlipHat, ctx: FlipContext): FlipResolution {
  const section = publicSectionFromPath(pathname, ctx.orgSlug, ctx.tournamentSlug ?? '');
  let twin: PublicTwinKey;
  switch (section) {
    case 'schedule': twin = 'schedule'; break;
    case 'standings': twin = 'standings'; break;
    case 'teams': twin = 'teams'; break;
    case 'news': twin = 'news'; break;
    case 'rules': twin = 'rules'; break;
    case 'register': twin = 'teams'; break; // the Register CTA shares the Teams→Registrations twin
    default: twin = 'overview'; // overview root + any unknown/hidden section
  }

  // A game context (public game / score card) always prefers Results with its highlight.
  const preferred = ctx.gameId ? 'results' : PUBLIC_TWIN_TO_ADMIN[twin];
  const screen = nearestPermittedScreen(preferred, ctx.allowedAdminScreens);

  return {
    kind: 'single',
    target: {
      href: adminHref(ctx, screen, ctx.gameId),
      label: HAT_LABEL[hat],
      sublabel: twin === 'standings' ? STANDINGS_SUBLABEL : undefined,
    },
  };
}

/**
 * Resolve the flip target(s) for a surface. `to-public` = leave a role surface for the public/preview
 * twin (Phase 1 admin loop); `to-role` = the reverse (Phase 2/3). Always returns a usable result —
 * unmapped screens fall back to Overview — so the pill is never blank in a shell.
 */
export function resolveFlip(input: {
  /** Optional because the coach/official to-public landing is context-driven, not page-matched. */
  pathname?: string;
  direction: FlipDirection;
  hat?: FlipHat;
  ctx: FlipContext;
}): FlipResolution {
  const hat = input.hat ?? 'admin';
  const pathname = input.pathname ?? '';
  return input.direction === 'to-public'
    ? resolveToPublic(pathname, hat, input.ctx)
    : resolveToRole(pathname, hat, input.ctx);
}

/** One tournament the scorekeeper can flip to — the day's board list, threaded from the score API. */
export interface ScorekeeperFlipTournament {
  name: string;
  slug: string;
}

/**
 * The scorekeeper header pill's resolution (P3). The shell is tournament-scoped but a volunteer can
 * cover several concurrent events, so: none in view → the org's public site (the pill is never
 * absent in a shell); exactly one → that event's public Schedule; two or more → the shared `multi`
 * chooser popover, one row per tournament (owner call 2026-07-24). Callers pass only the PUBLICLY
 * VISIBLE tournaments (slug present, active/completed) — a draft has no public site to flip to.
 */
export function resolveScorekeeperFlip(input: {
  orgSlug: string;
  tournaments: ScorekeeperFlipTournament[];
}): FlipResolution {
  const { orgSlug, tournaments } = input;
  if (tournaments.length <= 1) {
    // One event → its public Schedule; none → the resolver's own org-root fallback (one mechanism,
    // not a second hand-rolled copy of it).
    return resolveFlip({
      direction: 'to-public',
      hat: 'official',
      ctx: { orgSlug, tournamentSlug: tournaments[0]?.slug ?? null },
    });
  }
  return {
    kind: 'multi',
    label: 'Public site',
    targets: tournaments.map(t => ({
      href: publicHref({ orgSlug, tournamentSlug: t.slug }, 'schedule'),
      label: t.name,
      sublabel: 'Public schedule',
    })),
  };
}

/**
 * The one destination to use when a surface needs a single target from a resolution regardless of
 * kind — a same-tab mirror row, the "see it live" nudge. For the Results chooser (multi) that's the
 * Schedule twin (index 0). Keeps callers from re-deriving the single/multi branch and drifting.
 */
export function primaryTarget(resolution: FlipResolution): FlipTarget {
  return resolution.kind === 'single' ? resolution.target : resolution.targets[0];
}

// ── Return-memory ("⇄ Back to {label}") ──────────────────────────────────────────────────────────
//
// After a flip, the destination side's pill can offer a one-tap return to the exact origin URL. The
// snapshot lives in sessionStorage; stateless twin resolution is ALWAYS the fallback when it's
// missing or stale. Phase 1 builds only the READ path below; Phase 2 adds the write on every hop,
// co-located with the flip that triggers it.

const RETURN_KEY = 'fl_flip_return';
const RETURN_MAX_AGE_MS = 20 * 60 * 1000; // ~20 min, per the ratified spec

export interface ReturnMemory {
  originUrl: string;
  label: string;
  ts: number;
}

/** Pure parse+validate of a stored snapshot — the testable core of {@link readReturnMemory}. */
export function parseReturnMemory(raw: string | null, now: number, maxAgeMs: number = RETURN_MAX_AGE_MS): ReturnMemory | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const mem = parsed as Partial<ReturnMemory>;
  if (typeof mem.originUrl !== 'string' || !mem.originUrl) return null;
  if (typeof mem.label !== 'string' || !mem.label) return null;
  if (typeof mem.ts !== 'number') return null;
  if (now - mem.ts > maxAgeMs) return null; // stale → fall back to stateless
  return { originUrl: mem.originUrl, label: mem.label, ts: mem.ts };
}

/** Read the return snapshot (browser only). Returns null on any storage/parse failure or staleness. */
export function readReturnMemory(now: number, maxAgeMs: number = RETURN_MAX_AGE_MS): ReturnMemory | null {
  try {
    return parseReturnMemory(sessionStorage.getItem(RETURN_KEY), now, maxAgeMs);
  } catch {
    return null;
  }
}

/**
 * Persist the return snapshot at flip time (browser only) — the write half of the round trip.
 * Called on EVERY hop, both directions, from the shared FlipPill, so the arrival side's pill can
 * offer "⇄ Back to {label}". Best-effort: a storage failure just falls back to stateless resolution.
 */
export function writeReturnMemory(mem: { originUrl: string; label: string }, now: number): void {
  try {
    const payload: ReturnMemory = { originUrl: mem.originUrl, label: mem.label, ts: now };
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable / quota — the stateless page-matched twin still works */
  }
}

/**
 * Spend the return snapshot (browser only). Called once the arrival side leaves its landing page, so
 * the pill reverts to the stateless page-matched twin instead of a stale "⇄ Back to …". Best-effort.
 */
export function clearReturnMemory(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

// ── Origin label ("⇄ Back to {label}") ───────────────────────────────────────────────────────────

/**
 * Human label for the page a flip is LEAVING — powers the arrival side's "⇄ Back to {label}".
 * Derived from the pathname alone (no side-specific plumbing): admin screens read their label from
 * the ADMIN_SCREEN map (the same map that owns the twin, so they can't drift); public sections are
 * just the capitalized section segment (the twin maps own the canonical section vocabulary — this is
 * a cosmetic label, so it needs no second table and gracefully names any section, e.g. Playoffs).
 */
export function flipOriginLabel(pathname: string): string {
  if (/\/admin(\/|$)/.test(pathname)) {
    const screen = adminScreenFromPath(pathname);
    return (screen && ADMIN_SCREEN[screen]?.label) || 'Admin';
  }
  // Coach portals (free `/coaches/…` + premium `/{org}/coaches/…`) and the scorekeeper shell (P3):
  // their inner segments are ids/tools, not public sections, so name the surface itself — otherwise
  // the fallback below would surface a raw UUID ("⇄ Back to 3f2a…").
  if (/\/scorekeeper(\/|$)/.test(pathname)) return 'Scorekeeper';
  if (/\/coaches(\/|$)/.test(pathname)) return 'Coach view';
  // Public tournament path: /{org}/{tournament}/{section?}/… — the section is the 3rd segment.
  const section = pathname.split('/').filter(Boolean)[2];
  return section ? section.charAt(0).toUpperCase() + section.slice(1) : 'Overview';
}
