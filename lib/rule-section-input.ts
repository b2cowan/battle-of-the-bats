/**
 * WHAT A RULES SECTION MAY SAY (Board Ready W2 fix B, the Rules sections — sweep 3 finding 2, third part, 2026-11-11).
 *
 * The Rules page's sections (`rules`) and their points (`rule_items`) were written from the browser under policies that asked
 * only "member of the event's club": an assistant coach with no `post_rules` could rewrite the public page. They are now written
 * by `/api/admin/rules`, which checks the club and `post_rules`; this file is the pure part it shares with its guard: the limits
 * are the Rules screen's own (title 120, a point 1000) and the icon list is the screen's picker.
 */
import { RULE_ICONS } from './tournament-settings-words';
import { isUuid } from './utils';

export const RULE_TITLE_MAX = 120;
export const RULE_POINT_MAX = 1000;
export const RULE_POINTS_MAX = 100;
export const RULE_DIVISIONS_MAX = 100;

export type SectionFields = { title: string; icon: string; divisionIds: string[] | null };
export type PointInput = { id: string | null; key: string; content: string };

const ICONS: readonly string[] = RULE_ICONS.map(i => i.value);

/**
 * The section's own fields, read from a request body, or a plain reason. `currentIcon`: the icon the section already holds is
 * accepted as it stands (an old section keeps whatever it was given); a NEW icon must be one the screen offers.
 */
export function readSectionFields(body: unknown, currentIcon?: string | null): { ok: true; value: SectionFields } | { ok: false; problem: string } {
  const b = (body ?? {}) as { title?: unknown; icon?: unknown; divisionIds?: unknown };
  if (typeof b.title !== 'string' || !b.title.trim()) return { ok: false, problem: 'A title is required' };
  if (b.title.trim().length > RULE_TITLE_MAX) return { ok: false, problem: 'The title is too long' };
  if (typeof b.icon !== 'string' || !(ICONS.includes(b.icon) || (currentIcon != null && b.icon === currentIcon))) return { ok: false, problem: 'Unknown icon' };
  let divisionIds: string[] | null = null;
  if (b.divisionIds != null) {
    if (!Array.isArray(b.divisionIds) || b.divisionIds.length > RULE_DIVISIONS_MAX || b.divisionIds.some(d => typeof d !== 'string' || !d)
      || new Set(b.divisionIds).size !== b.divisionIds.length) return { ok: false, problem: 'Bad divisions' };
    divisionIds = b.divisionIds.length ? (b.divisionIds as string[]) : null;
  }
  return { ok: true, value: { title: b.title.trim(), icon: b.icon, divisionIds } };
}

/** A new section's points: words, in order; empty ones are dropped (as the screen does). */
export function readNewPoints(items: unknown): { ok: true; value: string[] } | { ok: false; problem: string } {
  if (items == null) return { ok: true, value: [] };
  if (!Array.isArray(items) || items.length > RULE_POINTS_MAX || items.some(i => typeof i !== 'string')) return { ok: false, problem: 'Bad points' };
  const points = (items as string[]).map(i => i.trim()).filter(Boolean);
  if (points.some(p => p.length > RULE_POINT_MAX)) return { ok: false, problem: 'A point is too long' };
  return { ok: true, value: points };
}

/** A saved section's points: each `{ id | null, key, content }`, in order, with words in it. */
export function readSavedPoints(items: unknown): { ok: true; value: PointInput[] } | { ok: false; problem: string } {
  if (!Array.isArray(items) || items.length > RULE_POINTS_MAX) return { ok: false, problem: 'Bad points' };
  const out: PointInput[] = [];
  for (const raw of items) {
    const p = (raw ?? {}) as { id?: unknown; key?: unknown; content?: unknown };
    if (typeof p.content !== 'string' || !p.content.trim() || p.content.trim().length > RULE_POINT_MAX) return { ok: false, problem: 'Bad point' };
    if (typeof p.key !== 'string' || !p.key || p.key.length > 100) return { ok: false, problem: 'Bad point' };
    // A point's id is a uuid: the screen makes a new point's before its first save (trust close-out 8), the database the rest.
    if (p.id != null && !isUuid(p.id)) return { ok: false, problem: 'Bad point' };
    out.push({ id: p.id ?? null, key: p.key, content: p.content.trim() });
  }
  if (new Set(out.map(p => p.key)).size !== out.length) return { ok: false, problem: 'Bad points' };
  const ids = out.map(p => p.id).filter((i): i is string => Boolean(i));
  if (new Set(ids).size !== ids.length) return { ok: false, problem: 'Bad points' };
  return { ok: true, value: out };
}
