import 'server-only';
import { NextResponse } from 'next/server';
import { resolveLiveCoachTeamContext } from './coach-route-context';
import {
  getRepTeamTags,
  getRepTeamTagLibrary,
  createRepTeamTag,
  renameRepTeamTag,
  deleteRepTeamTag,
  mergeRepTeamTags,
} from './db';
import { withObservability } from './observability';
import {
  denyUnless, canManageSchedule, canViewMoney, canWriteMoney, canViewDevelopmentGoals,
  type CoachCapabilities,
} from './coach-capabilities';
import { resolveCoachSeasonRead } from './coach-season-read';
import type { RepTagKind } from './types';

/**
 * ONE implementation behind every coach tag library — game, money, and the shared 'focus'
 * vocabulary (Practice Plans Phase 3).
 *
 * ⚠ **Why this exists.** There were three hand-copied route groups differing only in the tag
 * `kind`, which capability gates them, and one noun in their error copy — and Phase 3 needed a
 * fourth and a fifth. Five copies of an auth chain is five places for one of them to quietly stop
 * checking something; the `focus-tags` route carried a TODO asking for exactly this collapse
 * before a fourth appeared.
 *
 * ⚠ **The three real differences are parameters, not forks**, and they are all security-relevant,
 * so each one is named on the descriptor rather than hidden in a branch:
 *   · `kind`      — which vocabulary. Never derived from a request; always a literal at the call site.
 *   · `canRead`   — money tags ride MONEY, not schedule. The focus vocabulary is readable with
 *                   `notes` alone so a notes-only assistant can see what a focus area is grouped
 *                   under, but minting one is a schedule act.
 *   · `canWrite`  — who may mint, rename, merge and delete.
 *
 * ⚠ **EVERY WRITE resolves the LIVE season, always** — enforced at the source by
 * `tests/unit/coach-season-write-guard.test.ts`. Only the READ may address a past season, and only
 * for the libraries that have been approved for it (`seasonAwareRead` below). Keeping both halves
 * in one file makes that asymmetry visible instead of a coincidence of two files.
 */

/** How many tags one team may keep per kind. Merge two to add another. */
const MAX_TAGS_PER_KIND = 50;

export interface CoachTagRouteConfig {
  kind: RepTagKind;
  /** The route path, for observability tagging. */
  route: string;
  /** Plural noun for the cap message — "game tags", "money tags", "tags". */
  pluralNoun: string;
  canRead: (caps: CoachCapabilities) => boolean;
  canWrite: (caps: CoachCapabilities) => boolean;
  readDenied: string;
  writeDenied: string;
  /**
   * May the GET serve a PAST season?
   *
   * ⚠ **A per-library decision, never a default** — this is the archive-is-opt-in ruling expressed
   * as a field. `true` puts the route in `APPROVED_SEASON_AWARE_ROUTES`, which the build enforces;
   * `false` means it resolves the team's ACTIVE year and cannot address a past season at all.
   *
   * ⚠ It is `false` for the 'focus' vocabulary BY DECISION (2026-08-01), not by omission. A tag
   * library is an INSTRUMENT, like the drill library, and the read-only past-plan page needs no
   * live tags: a past plan renders from the tag NAMES snapshotted into it when the drill was
   * added, which is what keeps it honest about what the coach could see AT THE TIME. Flipping this
   * to "make the libraries consistent" would reverse a ruling.
   */
  seasonAwareRead: boolean;
}

type TeamParams = { params: Promise<{ orgSlug: string; teamId: string }> };
type TagParams = { params: Promise<{ orgSlug: string; teamId: string; tagId: string }> };

// ── The three tag libraries, declared once ───────────────────────────────────
// One place that knows what vocabularies exist and who may touch each. A new one is a descriptor
// plus three three-line route files — which is the point.

/** Game tags — how a coach describes a fixture ("League", "Provincials"). */
export const GAME_TAG_LIBRARY = {
  kind: 'game',
  pluralNoun: 'game tags',
  canRead: canManageSchedule,
  canWrite: canManageSchedule,
  readDenied: 'You do not have access to the schedule.',
  writeDenied: 'You do not have access to the schedule.',
  // Approved in Chunk F: a past season's games still render the tags they were given.
  seasonAwareRead: true,
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/** Money tags — ⚠ the one deliberate capability difference: these ride MONEY, not schedule. */
export const EXPENSE_TAG_LIBRARY = {
  kind: 'expense',
  pluralNoun: 'money tags',
  canRead: canViewMoney,
  canWrite: canWriteMoney,
  readDenied: 'You do not have access to team finances.',
  writeDenied: 'You do not have permission to change team finances.',
  // Approved in Chunk F: a finished season's expenses still render the tags they were filed under.
  seasonAwareRead: true,
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/**
 * The shared 'focus' vocabulary (Phase 3) — ONE list behind drills, plan templates, practice plans
 * and players' focus areas.
 *
 * ⚠ The read/write gates are deliberately DIFFERENT capabilities. Reading is what lets the focus
 * rail explain itself, so an assistant with `notes` alone must be able to see which areas match
 * tonight; MINTING team vocabulary is a practice-planning act and rides `schedule`.
 */
export const FOCUS_TAG_LIBRARY = {
  kind: 'focus',
  pluralNoun: 'tags',
  canRead: (c: CoachCapabilities) => canManageSchedule(c) || canViewDevelopmentGoals(c),
  canWrite: canManageSchedule,
  readDenied: 'You do not have access to this team’s practice planning.',
  writeDenied: 'You do not have access to the schedule.',
  /**
   * ⚠ **FALSE BY DECISION** (owner ruling 2026-08-01), not by omission. A tag vocabulary is an
   * INSTRUMENT, exactly like the drill library, so this resolves the team's ACTIVE year and cannot
   * address a past season at all. The read-only past-plan page needs nothing from here: a past
   * plan renders from the tag NAMES snapshotted into it when the drill was added, which is what
   * keeps it honest about what the coach could see AT THE TIME.
   */
  seasonAwareRead: false,
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/**
 * The LIVE-season coach context every write here resolves through — shared with the other coach
 * routes rather than hand-declared for a fourth time (`lib/coach-route-context.ts`).
 *
 * ⚠ A tag vocabulary describes the season a coach is IN, so this is the variant that requires an
 * active program year. Deliberately NOT the season-read rail, which admits CLOSED seasons.
 */
const resolveLiveTeamContext = resolveLiveCoachTeamContext;

/** The unique index on (team, kind, lower(name)) turned into a sentence a coach can act on. */
function tagWriteError(error: unknown, name: string, fallback: string): NextResponse {
  if ((error as { code?: string })?.code === '23505') {
    return NextResponse.json({ error: `A tag named “${name}” already exists` }, { status: 409 });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 400 },
  );
}

function readTagName(body: unknown): { name: string } | { error: NextResponse } {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return { error: NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 }) };
  }
  return { name };
}

/** `/tags` — GET the library, POST to mint one. */
export function coachTagCollectionRoutes(config: CoachTagRouteConfig) {
  const GET = withObservability(async (req: Request, { params }: TeamParams) => {
    const { orgSlug, teamId } = await params;

    // ⚠ Which season this read may address is a per-library DECISION — see `seasonAwareRead`.
    // Both branches produce the same shape; only what they are allowed to reach differs.
    let orgId: string;
    let capabilities: CoachCapabilities;
    if (config.seasonAwareRead) {
      const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
      if ('error' in resolved) return resolved.error;
      orgId = resolved.ctx.org.id;
      capabilities = resolved.capabilities;
    } else {
      const resolved = await resolveLiveTeamContext(orgSlug, teamId);
      if ('error' in resolved) return resolved.error!;
      orgId = resolved.ctx.org.id;
      capabilities = resolved.assignment.capabilities;
    }

    const denied = denyUnless(config.canRead(capabilities), config.readDenied);
    if (denied) return denied;

    // The team's own tags PLUS the club's shared set — ONE list, because the picker shows one
    // list and fetching the halves separately is how they start disagreeing.
    const tags = await getRepTeamTagLibrary(teamId, config.kind, orgId);
    return NextResponse.json({ tags });
  }, { route: config.route });

  const POST = withObservability(async (req: Request, { params }: TeamParams) => {
    const { orgSlug, teamId } = await params;
    const resolved = await resolveLiveTeamContext(orgSlug, teamId);
    if ('error' in resolved) return resolved.error!;
    const { ctx, assignment } = resolved;
    const denied = denyUnless(config.canWrite(assignment.capabilities), config.writeDenied);
    if (denied) return denied;

    const parsed = readTagName(await req.json().catch(() => ({})));
    if ('error' in parsed) return parsed.error;

    // The cap counts the team's OWN tags — the club's shared set must not eat a team's allowance.
    const existing = await getRepTeamTags(teamId, config.kind);
    if (existing.length >= MAX_TAGS_PER_KIND) {
      return NextResponse.json(
        // ⚠ "Delete OR merge" — both are true, and this is the wording game and money tags already
        // shipped with. Unifying the routes briefly narrowed it to "Merge two", which quietly told
        // coaches on two committed surfaces that an option they still have does not exist.
        { error: `You can keep up to ${MAX_TAGS_PER_KIND} ${config.pluralNoun}. Delete or merge one to add another.` },
        { status: 400 },
      );
    }

    try {
      const tag = await createRepTeamTag({
        orgId: ctx.org.id, teamId, kind: config.kind, name: parsed.name, createdBy: ctx.user.id,
      });
      return NextResponse.json({ tag });
    } catch (error: unknown) {
      // ⚠ A 409 here is the case-insensitive unique index working — it is what makes "Hitting" and
      // "hitting" impossible rather than merely discouraged.
      return tagWriteError(error, parsed.name, 'Could not save tag');
    }
  }, { route: config.route });

  return { GET, POST };
}

/** `/tags/[tagId]` — PATCH to rename, DELETE to remove. */
export function coachTagItemRoutes(config: CoachTagRouteConfig) {
  const PATCH = withObservability(async (req: Request, { params }: TagParams) => {
    const { orgSlug, teamId, tagId } = await params;
    const resolved = await resolveLiveTeamContext(orgSlug, teamId);
    if ('error' in resolved) return resolved.error!;
    const denied = denyUnless(config.canWrite(resolved.assignment.capabilities), config.writeDenied);
    if (denied) return denied;

    const parsed = readTagName(await req.json().catch(() => ({})));
    if ('error' in parsed) return parsed.error;

    try {
      // Scoped by team_id, so a coach can never rename the club's SHARED tags (team_id NULL) —
      // those belong to an org admin, and a 404 is the honest answer rather than a silent no-op.
      const updated = await renameRepTeamTag(tagId, teamId, parsed.name);
      if (!updated) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
      return NextResponse.json({ tag: updated });
    } catch (error: unknown) {
      return tagWriteError(error, parsed.name, 'Could not rename tag');
    }
  }, { route: config.route });

  const DELETE = withObservability(async (_req: Request, { params }: TagParams) => {
    const { orgSlug, teamId, tagId } = await params;
    const resolved = await resolveLiveTeamContext(orgSlug, teamId);
    if ('error' in resolved) return resolved.error!;
    const denied = denyUnless(config.canWrite(resolved.assignment.capabilities), config.writeDenied);
    if (denied) return denied;

    // ⚠ Delete drops the tag's links with NO re-pointing. Merge is the history-preserving path;
    // this is for a tag that was never really used.
    const deleted = await deleteRepTeamTag(tagId, teamId);
    if (!deleted) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }, { route: config.route });

  return { PATCH, DELETE };
}

/**
 * `/tags/merge` — fold one tag into another, keeping every link.
 *
 * ⚠ Atomic in the database (`merge_rep_team_tags`, mig 181, replaced by mig 221 so it re-points
 * drills, plan templates and focus areas as well as events). A half-finished merge would strand a
 * coach's history under a tag that no longer exists, which is worse than no merge at all.
 */
export function coachTagMergeRoute(config: CoachTagRouteConfig) {
  const POST = withObservability(async (req: Request, { params }: TeamParams) => {
    const { orgSlug, teamId } = await params;
    const resolved = await resolveLiveTeamContext(orgSlug, teamId);
    if ('error' in resolved) return resolved.error!;
    const denied = denyUnless(config.canWrite(resolved.assignment.capabilities), config.writeDenied);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const winnerTagId = typeof body.winnerTagId === 'string' ? body.winnerTagId : '';
    const loserTagId = typeof body.loserTagId === 'string' ? body.loserTagId : '';
    if (!winnerTagId || !loserTagId) {
      return NextResponse.json({ error: 'winnerTagId and loserTagId are required' }, { status: 400 });
    }
    if (winnerTagId === loserTagId) {
      return NextResponse.json({ error: 'Choose two different tags to merge' }, { status: 400 });
    }

    try {
      // Both ids are proved to belong to THIS team before the RPC sees them; the function itself
      // re-checks same-team/same-org/same-kind as a defence-in-depth backstop.
      await mergeRepTeamTags(winnerTagId, loserTagId, teamId);
      return NextResponse.json({ ok: true });
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Merge failed' },
        { status: 400 },
      );
    }
  }, { route: config.route });

  return { POST };
}
