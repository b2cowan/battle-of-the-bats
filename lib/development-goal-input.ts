import 'server-only';
import { NextResponse } from 'next/server';
import { isTeamFocusTag } from './db';

/**
 * What makes a focus area valid — in ONE place, because two routes now write one.
 *
 * ⚠ **Why this exists.** `createRepPlayerDevelopmentGoal` validates nothing; the invariant lives
 * entirely in caller code. The goals route owned it alone until the Phase-2 tryout seeding route
 * started creating goals too, and immediately re-typed the same 80-character rule, the same tag-
 * ownership check, and the same two error strings. Two copies of a rule with no shared source is
 * how one of them quietly stops matching — the `setRepTeamEventTags` lesson, one layer up.
 *
 * ⚠ **The tag check is a SECURITY check, not a formatting one.** `isTeamFocusTag` proves the tag
 * belongs to this team (or is the club's shared set) *and* is of kind `focus`. A route that skipped
 * it would let a caller staple another team's vocabulary onto their own player's record. It is
 * therefore inside this helper rather than left to each caller's diligence.
 *
 * ⚠ **This helper never MINTS a tag.** Creating team vocabulary is a deliberate act that rides the
 * focus-tags route's own write gate (`schedule`); nothing here may invent one from free text.
 */

/** The coach's own words for the focus area. Long enough for a sentence, short enough to scan. */
export const MAX_FOCUS_AREA_LEN = 80;

export type DevelopmentGoalInput = { focusArea: string; tagId: string | null };

/**
 * The focus text itself. Split from the tag check on purpose: the goals route validates the note
 * and status BETWEEN the two, and collapsing them reordered which error a bad payload gets back —
 * a silent contract change in an already-shipped route (/review, 2026-08-02).
 */
export function readFocusArea(raw: unknown): { focusArea: string } | { error: NextResponse } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const focusArea = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
  if (!focusArea || focusArea.length > MAX_FOCUS_AREA_LEN) {
    return {
      error: NextResponse.json(
        { error: `Focus area is required (max ${MAX_FOCUS_AREA_LEN} characters).` },
        { status: 400 },
      ),
    };
  }
  return { focusArea };
}

/**
 * The optional grouping tag, proved to belong to this team.
 *
 * ⚠ ONE optional grouping tag (mig 221) — the SAME 'focus' vocabulary the team's drills use, which
 * is what lets the focus rail tell which areas match tonight. The focus text stays the coach's own
 * specific words and is never replaced by it.
 * ⚠ Never inferred from the focus text: free text doesn't cluster, and guessing would be a
 * confident lie (§4).
 */
export async function verifyFocusTag(
  raw: unknown,
  scope: { orgId: string; teamId: string },
): Promise<{ tagId: string | null } | { error: NextResponse }> {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const tagId = typeof body.tagId === 'string' && body.tagId.trim() ? body.tagId.trim() : null;
  if (tagId && !(await isTeamFocusTag(tagId, scope.orgId, scope.teamId))) {
    return { error: NextResponse.json({ error: 'That tag is not one of this team’s.' }, { status: 400 }) };
  }
  return { tagId };
}

/** Both halves, for a caller with nothing to validate in between (the tryout seeding route). */
export async function parseDevelopmentGoalInput(
  raw: unknown,
  scope: { orgId: string; teamId: string },
): Promise<{ value: DevelopmentGoalInput } | { error: NextResponse }> {
  const area = readFocusArea(raw);
  if ('error' in area) return area;
  const tag = await verifyFocusTag(raw, scope);
  if ('error' in tag) return tag;
  return { value: { focusArea: area.focusArea, tagId: tag.tagId } };
}
