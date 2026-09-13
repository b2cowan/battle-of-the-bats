/**
 * Exact addresses for development (development lifecycle Phase 1, F09 — plan §6 / §10: "address
 * report/player/metric state in URLs with safe, internal return destinations").
 *
 * ⚠ ONE mechanism, extended — never a new one. The player record already answers
 * `?section=development` (`CoachCollapseSection` opens the section and scrolls to it); this module
 * adds the VIEW (goals | results — observations and previous seasons are Phase 2), the metric or
 * the goal to focus, and a way back to the report that sent the coach, carrying that report's own
 * filters. The Insights hub keeps `?section=` and gains its filter state on the same convention.
 *
 * ⚠ NEVER A YEAR. The look-back layer is the closed-season page and the routes it calls
 * (`HISTORY_ENDPOINTS` in tests/unit/coach-history-endpoint-guard.test.ts); a development address
 * reads the working season and nothing else. `returnTo` is a PATH inside this team's portal — a
 * bare origin-relative path starting with the team root, or it is dropped: an address is the one
 * place a link from outside the app can put text, and following it anywhere else is an open
 * redirect wearing a politer face.
 *
 * Framework-free on purpose (the demo seeders and sandbox chrome import their link helpers under
 * plain node); the extension on the import is the repo's convention for that.
 */
import { insightsSectionHref } from './coach-insights-links.ts';
import { UNTAGGED_FILTER } from './rep-drills.ts';

export type DevelopmentView = 'goals' | 'results';
export const DEVELOPMENT_VIEWS: ReadonlyArray<DevelopmentView> = ['goals', 'results'];

export type SkillsAndGoalsSection = 'sessions' | 'players' | 'metrics';
export const SKILLS_AND_GOALS_SECTIONS: ReadonlyArray<SkillsAndGoalsSection> = ['sessions', 'players', 'metrics'];

export interface DevelopmentAddress {
  view: DevelopmentView | null;
  metricId: string | null;
  goalId: string | null;
  /** A safe internal path, already validated — or null. */
  returnTo: string | null;
}

/** `URLSearchParams` and Next's `ReadonlyURLSearchParams` both satisfy this. */
interface ParamReader { get(name: string): string | null }

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const id = (v: string | null): string | null => (v && ID_RE.test(v) ? v : null);

/**
 * Only a path INSIDE this team's portal survives: it must start with the team root followed by
 * `/` or `?`, carry no scheme, no `//`, no backslash, no `..` segment, and no year parameter.
 */
export function safeReturnPath(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith(`${base}/`) && !raw.startsWith(`${base}?`)) return null;
  if (raw.includes('//') || raw.includes('\\') || /(^|\/)\.\.(\/|$|\?)/.test(raw)) return null;
  if (/[?&]year=/.test(raw)) return null;
  return raw;
}

export function parseDevelopmentAddress(params: ParamReader, base: string): DevelopmentAddress {
  const rawView = params.get('view');
  return {
    view: DEVELOPMENT_VIEWS.includes(rawView as DevelopmentView) ? (rawView as DevelopmentView) : null,
    metricId: id(params.get('metric')),
    goalId: id(params.get('goal')),
    returnTo: safeReturnPath(params.get('return'), base),
  };
}

/** The player record, opened on Development — with the view, the metric or goal, and the way back. */
export function playerDevelopmentHref(
  base: string,
  playerId: string,
  opts: { view?: DevelopmentView; metricId?: string | null; goalId?: string | null; returnTo?: string | null } = {},
): string {
  const qp = new URLSearchParams();
  qp.set('section', 'development');
  if (opts.view) qp.set('view', opts.view);
  if (opts.metricId) qp.set('metric', opts.metricId);
  if (opts.goalId) qp.set('goal', opts.goalId);
  const back = safeReturnPath(opts.returnTo ?? null, base);
  if (back) qp.set('return', back);
  return `${base}/roster/${playerId}?${qp.toString()}`;
}

/** What the way back is called — by where it goes, never by a label the address could carry. */
export function returnLabel(returnTo: string | null, base: string): string | null {
  if (!returnTo) return null;
  // A route prefix with a boundary — `/development` and `/development?section=…`, never `/developmentx`.
  const under = (segment: string) => new RegExp(`^${base.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/${segment}(?:[/?#]|$)`).test(returnTo);
  if (under('development')) return 'Skills & Goals';
  if (under('history')) return 'Insights';
  return null;
}

/** Skills & Goals — three sections on `?section=`, the Money and Insights hubs' convention. */
export function skillsAndGoalsHref(base: string, section: SkillsAndGoalsSection, extra?: { metric?: string | null }): string {
  const qp = new URLSearchParams();
  qp.set('section', section);
  if (extra?.metric) qp.set('metric', extra.metric);
  return `${base}/development?${qp.toString()}`;
}

/** An unknown or missing section lands on the everyday one. */
export function parseSkillsAndGoalsSection(raw: string | null | undefined): SkillsAndGoalsSection {
  return SKILLS_AND_GOALS_SECTIONS.includes(raw as SkillsAndGoalsSection) ? (raw as SkillsAndGoalsSection) : 'sessions';
}

/**
 * Insights → Development, carrying the practice-review tag filter when one is set. `tag` is the
 * filter as the panel holds it — a tag id, or the "no tags" sentinel (`UNTAGGED_FILTER`, a string
 * with a space in it) — and this is the ONE place its wire spelling, `none`, is written.
 */
const UNTAGGED_ON_THE_WIRE = 'none';
export function insightsDevelopmentHref(base: string, opts: { tag?: string | null } = {}): string {
  const tag = opts.tag === UNTAGGED_FILTER ? UNTAGGED_ON_THE_WIRE : opts.tag;
  return insightsSectionHref(base, 'development', tag ? { tag } : undefined);
}
/** The filter as the panel holds it, from `?tag=` — the inverse of the encoding above. */
export function insightsTagFromAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw === UNTAGGED_ON_THE_WIRE ? UNTAGGED_FILTER : id(raw);
}
