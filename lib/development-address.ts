/**
 * Exact addresses for development (development lifecycle Phase 1, F09 — plan §6 / §10: "address
 * report/player/metric state in URLs with safe, internal return destinations").
 *
 * ⚠ ONE mechanism, extended — never a new one. The player record already answers
 * `?section=development` (`CoachCollapseSection` opens the section and scrolls to it); this module
 * adds the VIEW (goals | results | observations | archive — the four views of Phase 2), the metric or
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

/** The four views inside the Development section (mockup screen 4; Phase 2 added observations + archive). */
export type DevelopmentView = 'goals' | 'results' | 'observations' | 'archive';
export const DEVELOPMENT_VIEWS: ReadonlyArray<DevelopmentView> = ['goals', 'results', 'observations', 'archive'];

/**
 * Skills & Goals — four views on one screen. `overview` is the LANDING (re-evaluation stage 0,
 * owner ruling 2026-09-14): Money's shape — a getting-started card while there is nothing to
 * count, the season's dashboard once there is. The bare hub address IS the overview, so it never
 * carries `?section=overview`; the other three are addressed as before.
 */
export type SkillsAndGoalsSection = 'overview' | 'sessions' | 'players' | 'metrics';
export const SKILLS_AND_GOALS_SECTIONS: ReadonlyArray<SkillsAndGoalsSection> = ['overview', 'sessions', 'players', 'metrics'];

export interface DevelopmentAddress {
  view: DevelopmentView | null;
  metricId: string | null;
  goalId: string | null;
  /** A safe internal path, already validated — or null. */
  returnTo: string | null;
}

/** `URLSearchParams` and Next's `ReadonlyURLSearchParams` both satisfy this. */
interface ParamReader { get(name: string): string | null }

/** An id as the screens send one — never a year, never a path. ONE rule: the readers import it too. */
export const isRecordId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const id = (v: string | null): string | null => (isRecordId(v) ? v : null);

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

/**
 * Skills & Goals — sections on `?section=`, the Money and Insights hubs' convention; the overview
 * is the bare address. `metric` is the Players view's Show choice. `edit` opens a metric's
 * DEFINITION in its sheet over whichever section is on screen (re-evaluation stage 1, 2026-09-14
 * — a metric is a record on a list, so it opens over the list the way a player's dues do, never
 * on a page of its own): `new` defines one, an id edits it. Back closes the sheet.
 */
export function skillsAndGoalsHref(base: string, section: SkillsAndGoalsSection, extra?: { metric?: string | null; edit?: MetricEdit | null }): string {
  const qp = new URLSearchParams();
  if (section !== 'overview') qp.set('section', section);
  if (extra?.metric) qp.set('metric', extra.metric);
  if (extra?.edit) qp.set('edit', extra.edit);
  const q = qp.toString();
  return q ? `${base}/development?${q}` : `${base}/development`;
}

/** `new`, or the id of the definition to edit. Anything else is no sheet. */
export type MetricEdit = 'new' | string;
export function parseMetricEdit(raw: string | null | undefined): MetricEdit | null {
  if (raw === 'new') return 'new';
  return isRecordId(raw) ? raw : null;
}

/** An unknown or missing section lands on the overview — the landing. */
export function parseSkillsAndGoalsSection(raw: string | null | undefined): SkillsAndGoalsSection {
  return SKILLS_AND_GOALS_SECTIONS.includes(raw as SkillsAndGoalsSection) ? (raw as SkillsAndGoalsSection) : 'overview';
}

/**
 * Insights → Development — the Report selector's state (Phase 3, mockup screen 5) on the hub's own
 * `?section=development` address: `report=`, and for Player progress `player=`, `metric=`, `show=`
 * and `compare=`, beside the practice-review `tag=` Phase 1 added. Changing the player keeps the
 * report, the metric and the window; Back/Forward and a fresh link move every selector, because the
 * panel reads the address on every render.
 */
export type DevelopmentReport = 'coverage' | 'progress' | 'practices';
export const DEVELOPMENT_REPORTS: ReadonlyArray<DevelopmentReport> = ['coverage', 'progress', 'practices'];
export type ProgressShow = 'headline' | 'average';
export const PROGRESS_SHOWS: ReadonlyArray<ProgressShow> = ['headline', 'average'];
export type CompareWindow = 'season' | 'last-two';
export const COMPARE_WINDOWS: ReadonlyArray<CompareWindow> = ['season', 'last-two'];

export interface InsightsDevelopmentAddress {
  /** The practice-review filter as the panel holds it (a tag id or `UNTAGGED_FILTER`), or null. */
  tag: string | null;
  /** An unknown or missing report lands on Coverage. */
  report: DevelopmentReport;
  playerId: string | null;
  metricId: string | null;
  show: ProgressShow | null;
  compare: CompareWindow | null;
}

export interface InsightsDevelopmentOpts {
  tag?: string | null;
  report?: DevelopmentReport | null;
  playerId?: string | null;
  metricId?: string | null;
  show?: ProgressShow | null;
  compare?: CompareWindow | null;
}

/**
 * Insights → Development, carrying the practice-review tag filter when one is set. `tag` is the
 * filter as the panel holds it — a tag id, or the "no tags" sentinel (`UNTAGGED_FILTER`, a string
 * with a space in it) — and this is the ONE place its wire spelling, `none`, is written. Coverage
 * is the report the address names by saying nothing.
 */
const UNTAGGED_ON_THE_WIRE = 'none';
export function insightsDevelopmentHref(base: string, opts: InsightsDevelopmentOpts = {}): string {
  const tag = opts.tag === UNTAGGED_FILTER ? UNTAGGED_ON_THE_WIRE : opts.tag;
  const extra: Record<string, string> = {};
  if (opts.report && opts.report !== 'coverage') extra.report = opts.report;
  if (opts.playerId) extra.player = opts.playerId;
  if (opts.metricId) extra.metric = opts.metricId;
  if (opts.show) extra.show = opts.show;
  if (opts.compare) extra.compare = opts.compare;
  if (tag) extra.tag = tag;
  return insightsSectionHref(base, 'development', Object.keys(extra).length > 0 ? extra : undefined);
}
/** The filter as the panel holds it, from `?tag=` — the inverse of the encoding above. */
export function insightsTagFromAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw === UNTAGGED_ON_THE_WIRE ? UNTAGGED_FILTER : id(raw);
}
/** The whole report state from the hub's address — every selector, read on every render. */
export function parseInsightsDevelopmentAddress(params: ParamReader): InsightsDevelopmentAddress {
  const rawReport = params.get('report');
  const rawShow = params.get('show');
  const rawCompare = params.get('compare');
  return {
    tag: insightsTagFromAddress(params.get('tag')),
    report: DEVELOPMENT_REPORTS.includes(rawReport as DevelopmentReport) ? (rawReport as DevelopmentReport) : 'coverage',
    playerId: id(params.get('player')),
    metricId: id(params.get('metric')),
    show: PROGRESS_SHOWS.includes(rawShow as ProgressShow) ? (rawShow as ProgressShow) : null,
    compare: COMPARE_WINDOWS.includes(rawCompare as CompareWindow) ? (rawCompare as CompareWindow) : null,
  };
}

/**
 * The handout preview (Phase 3, mockup screen 6) — a page of its own under the player's record,
 * with the way back to wherever the coach came from (the Development section, or a report).
 */
export function developmentHandoutHref(base: string, playerId: string, opts: { returnTo?: string | null } = {}): string {
  const back = safeReturnPath(opts.returnTo ?? null, base);
  const qp = new URLSearchParams();
  if (back) qp.set('return', back);
  const query = qp.toString();
  return `${base}/roster/${playerId}/development/handout${query ? `?${query}` : ''}`;
}
