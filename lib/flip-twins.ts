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
   * Admin screens this staffer can actually open (the path segment after `/admin/tournaments/`,
   * e.g. `'results'`). When resolving `to-role`, an out-of-scope twin lands on the nearest permitted
   * screen instead of a 403. Omit (or leave empty) to allow all — the owner/admin case.
   */
  allowedAdminScreens?: string[];
}

export interface FlipTarget {
  /** Same-tab destination href. */
  href: string;
  /** Bare destination label, e.g. "Public · Schedule" — FlipPill prepends the ⇄ glyph at render time. */
  label: string;
  /** Optional one-line explainer shown under a popover row (e.g. the Standings→Results honesty note). */
  sublabel?: string;
}

/** A direct flip (single) or a small chooser (multi) — e.g. admin Results → Public Schedule/Standings. */
export type FlipResolution =
  | { kind: 'single'; target: FlipTarget }
  | { kind: 'multi'; label: string; targets: FlipTarget[] };

// ── Mapping tables (the ONE place the twin map lives) ────────────────────────────────────────────

/** Admin screen (segment after /admin/tournaments/) → its public twin. Unlisted screens fall back. */
const ADMIN_SCREEN_TO_TWIN: Record<string, PublicTwinKey | 'results-split'> = {
  dashboard: 'overview',
  communication: 'news',
  schedule: 'schedule',
  registrations: 'teams',
  rules: 'rules',
  results: 'results-split', // no public "results-admin" twin → offer Schedule + Standings
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

const TWIN_LABEL: Record<PublicTwinKey, string> = {
  overview: 'Overview',
  schedule: 'Schedule',
  standings: 'Standings',
  teams: 'Teams',
  news: 'News',
  rules: 'Rules',
};

const HAT_LABEL: Record<FlipHat, string> = {
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
function sideWord(ctx: FlipContext): string {
  return ctx.isDraft ? 'Preview' : 'Public';
}

function publicHref(ctx: FlipContext, twin: PublicTwinKey, gameId?: string | null): string {
  const base = publicBase(ctx);
  if (twin === 'overview') return base;
  if (twin === 'schedule' && gameId) return `${base}/schedule?highlightGameId=${encodeURIComponent(gameId)}`;
  return `${base}/${twin}`;
}

function adminHref(ctx: FlipContext, screen: string, gameId?: string | null): string {
  const base = `/${ctx.orgSlug}/admin/tournaments`;
  // Admin Results focuses a game via `?gameId=` (the existing WI-2 deep-link convention that the
  // Results page already reads) — NOT the public side's `?highlightGameId=`.
  if (screen === 'results' && gameId) return `${base}/results?gameId=${encodeURIComponent(gameId)}`;
  return `${base}/${screen}`;
}

/** Land on the nearest screen the staffer can actually open (never a wrong guess, never a 403). */
function nearestPermittedScreen(preferred: string, allowed?: string[]): string {
  if (!allowed || allowed.length === 0) return preferred; // unscoped (owner/admin) → exact twin
  if (allowed.includes(preferred)) return preferred;
  return ADMIN_SCREEN_FALLBACK_ORDER.find(screen => allowed.includes(screen)) ?? allowed[0];
}

// ── Resolvers ────────────────────────────────────────────────────────────────────────────────────

/** Role surface (admin/coach/official) → the matching public (or preview) page. */
function resolveToPublic(pathname: string, hat: FlipHat, ctx: FlipContext): FlipResolution {
  const side = sideWord(ctx);

  // Coach / scorekeeper surfaces land on the public Schedule for now (P3 refines coach record-aware
  // landings with the team's registration context).
  if (hat === 'coach' || hat === 'official') {
    return { kind: 'single', target: { href: publicHref(ctx, 'schedule'), label: `${side} · Schedule` } };
  }

  const screen = adminScreenFromPath(pathname);
  const mapped = screen ? ADMIN_SCREEN_TO_TWIN[screen] : undefined;

  // Results has no single public twin — offer both Schedule and Standings.
  if (mapped === 'results-split') {
    return {
      kind: 'multi',
      label: side,
      targets: [
        { href: publicHref(ctx, 'schedule', ctx.gameId), label: `${side} · Schedule` },
        { href: publicHref(ctx, 'standings'), label: `${side} · Standings`, sublabel: STANDINGS_SUBLABEL },
      ],
    };
  }

  // Everything else maps directly; unmapped screens fall back to Overview (never absent, never wrong).
  const twin: PublicTwinKey = (mapped as PublicTwinKey | undefined) ?? 'overview';
  return {
    kind: 'single',
    target: {
      href: publicHref(ctx, twin, twin === 'schedule' ? ctx.gameId : null),
      label: `${side} · ${TWIN_LABEL[twin]}`,
    },
  };
}

/** Public page → the matching role screen (P2/P3 UI; mapping lives here so it can't drift). */
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
  pathname: string;
  direction: FlipDirection;
  hat?: FlipHat;
  ctx: FlipContext;
}): FlipResolution {
  const hat = input.hat ?? 'admin';
  return input.direction === 'to-public'
    ? resolveToPublic(input.pathname, hat, input.ctx)
    : resolveToRole(input.pathname, hat, input.ctx);
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
