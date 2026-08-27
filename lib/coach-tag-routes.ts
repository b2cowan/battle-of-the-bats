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
import { resolveCoachTeamRead } from './coach-team-read';
import { repointTeamPlansOnMerge, repointTeamPlansOnDelete } from './rep-practice-plan-tag-repoint';
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
 * `tests/unit/coach-history-endpoint-guard.test.ts`. The READ resolves the team's WORKING season,
 * which between seasons is the finished one: a coach reading a completed season's game log still
 * sees the tags those games were filed under. Keeping both halves in one file makes that asymmetry
 * visible instead of a coincidence of two files.
 *
 * ⚠ **`seasonAwareRead` IS GONE** (P2, 2026-08-16). It was a per-library opt-in to the season DIAL,
 * and the dial is deleted — no read here can address a season the coach names, so there is nothing
 * left for a library to opt into. The 'focus' vocabulary's decided absence from the archive
 * survives as what it always really was: an instrument, whose write path still demands a live year.
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
   * ⚠ **'staff' and 'equipment' ONLY.** Every other kind links by a real FK (`rep_team_event_tags`,
   * drill/template tag tables), so `merge_rep_team_tags` alone re-points history. Staff/equipment
   * picks live as ids inside `PracticePlan` jsonb — no FK, nothing for the RPC to reach. These
   * hooks run in the SAME request as the tag write, so a plan referencing the loser never survives
   * the merge/delete outliving its target. See `lib/rep-practice-plan-tag-repoint.ts`.
   */
  afterMerge?: (teamId: string, winnerTagId: string, loserTagId: string) => Promise<void>;
  afterDelete?: (teamId: string, tagId: string) => Promise<void>;
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
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/** Money tags — ⚠ the one deliberate capability difference: these ride MONEY, not schedule. */
export const EXPENSE_TAG_LIBRARY = {
  kind: 'expense',
  pluralNoun: 'money tags',
  canRead: canViewMoney,
  canWrite: canWriteMoney,
  readDenied: 'You do not have access to team finances.',
  writeDenied: 'You do not have permission to change team finances.',
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/**
 * The shared 'focus' vocabulary (Phase 3) — ONE list behind drills, plan templates, practice plans
 * and players' focus areas.
 *
 * ⚠ The read/write gates are deliberately DIFFERENT capabilities. Reading is what lets the focus
 * rail explain itself, so an assistant with `notes` alone must be able to see which areas match
 * tonight; MINTING team vocabulary is a practice-planning act and rides `schedule`.
 *
 * ⚠⚠ **WHAT HAPPENED TO ITS `seasonAwareRead: false`** (`/review` 2026-08-16 — asked, and worth
 * answering here rather than leaving a deleted ruling unexplained). That flag was `false` BY
 * DECISION (owner, 2026-08-01): a tag library is an INSTRUMENT and must never be addressable in a
 * past season. **That ruling is intact and still build-enforced** — no read here can be handed a
 * year, and `coach-history-endpoint-guard.test.ts` fails if one learns to be.
 *
 * What DID change is the between-seasons case: the GET used to require an ACTIVE year and 404 when
 * a team had none, and now it answers for the team's working season whatever state that season is
 * in. That follows directly from the model the owner approved — a team between seasons is a team,
 * and its vocabulary belongs to the TEAM rather than to a year. MINTING still demands a live season
 * (every write below keeps `resolveLiveTeamContext`), which is the half the instrument ruling was
 * actually protecting. No current screen reaches this read on a finished season; the behaviour is
 * stated here so a future one does not have to guess whether it was decided or drifted.
 */
export const FOCUS_TAG_LIBRARY = {
  kind: 'focus',
  pluralNoun: 'tags',
  canRead: (c: CoachCapabilities) => canManageSchedule(c) || canViewDevelopmentGoals(c),
  canWrite: canManageSchedule,
  readDenied: 'You do not have access to this team’s practice planning.',
  writeDenied: 'You do not have access to the schedule.',
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/**
 * 'staff' and 'equipment' (mig 266) — real libraries behind the practice plan's remaining two
 * free-text fields. Same read/write gates as `FOCUS_TAG_LIBRARY` — a picker on the same screen
 * should not answer "who can use this" differently kind to kind.
 *
 * ⚠⚠ **The `afterMerge`/`afterDelete` hooks are load-bearing, not optional polish.** See the type's
 * own doc and `lib/rep-practice-plan-tag-repoint.ts` — without them a merge or delete here leaves a
 * dangling id sitting inside a coach's saved plan.
 */
export const STAFF_TAG_LIBRARY = {
  kind: 'staff',
  pluralNoun: 'staff tags',
  canRead: (c: CoachCapabilities) => canManageSchedule(c) || canViewDevelopmentGoals(c),
  canWrite: canManageSchedule,
  readDenied: 'You do not have access to this team’s practice planning.',
  writeDenied: 'You do not have access to the schedule.',
  afterMerge: (teamId, winnerTagId, loserTagId) =>
    repointTeamPlansOnMerge(teamId, 'staff', winnerTagId, loserTagId),
  afterDelete: (teamId, tagId) => repointTeamPlansOnDelete(teamId, 'staff', tagId),
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

export const EQUIPMENT_TAG_LIBRARY = {
  kind: 'equipment',
  pluralNoun: 'equipment tags',
  canRead: (c: CoachCapabilities) => canManageSchedule(c) || canViewDevelopmentGoals(c),
  canWrite: canManageSchedule,
  readDenied: 'You do not have access to this team’s practice planning.',
  writeDenied: 'You do not have access to the schedule.',
  afterMerge: (teamId, winnerTagId, loserTagId) =>
    repointTeamPlansOnMerge(teamId, 'equipment', winnerTagId, loserTagId),
  afterDelete: (teamId, tagId) => repointTeamPlansOnDelete(teamId, 'equipment', tagId),
} as const satisfies Omit<CoachTagRouteConfig, 'route'>;

/**
 * The LIVE-season coach context every write here resolves through — shared with the other coach
 * routes rather than hand-declared for a fourth time (`lib/coach-route-context.ts`).
 *
 * ⚠ A tag vocabulary describes the season a coach is IN, so this is the variant that requires an
 * ACTIVE program year. Deliberately NOT `resolveCoachTeamRead`, which admits a finished working
 * season by design — minting vocabulary into a season that has ended is not a thing.
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
  const GET = withObservability(async (_req: Request, { params }: TeamParams) => {
    const { orgSlug, teamId } = await params;

    // ⚠ ONE posture for every library now (P2, 2026-08-16): the team's WORKING season. The fork
    // this replaced existed to serve the season dial, and the dial is gone — a library's read can
    // no longer address a season the caller names, whichever vocabulary it is. Between seasons it
    // resolves the finished year rather than 404ing, which is what lets a coach read a completed
    // season's game log with its tags intact.
    const resolved = await resolveCoachTeamRead(orgSlug, teamId);
    if ('error' in resolved) return resolved.error;
    const orgId = resolved.ctx.org.id;
    const capabilities: CoachCapabilities = resolved.capabilities;

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

    // ⚠ Delete drops the tag's RELATIONAL links with NO re-pointing (game/expense/focus). Merge is
    // the history-preserving path for those; this is for a tag that was never really used.
    // 'staff'/'equipment' have no relational link to drop — the hook strips the id from every
    // plan's jsonb directly, run BEFORE the row disappears so a failed strip still leaves a
    // resolvable (if now-orphaned) tag rather than a silently dangling id.
    //
    // ⚠ TRY/CATCH, matching PATCH and merge below — `afterDelete` walks every one of the team's
    // practice events and writes each one back; unlike the single-row `deleteRepTeamTag` this
    // used to be the only work here, a failure partway through is a real, reachable case, and
    // without this it would fall through to a bare framework 500 instead of the same clean
    // `{ error }` shape every other write on this route gives the coach.
    try {
      if (config.afterDelete) await config.afterDelete(teamId, tagId);
    } catch (error: unknown) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not remove that tag from every plan' },
        { status: 400 },
      );
    }
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
      // ⚠ AFTER the RPC, not before: the RPC is what proves same-team/same-org/same-kind. Running
      // the jsonb walk on an unproven pair would let a cross-team id slip a rewrite into another
      // team's plans ahead of the check that was supposed to catch it.
      if (config.afterMerge) await config.afterMerge(teamId, winnerTagId, loserTagId);
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
