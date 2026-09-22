/**
 * Exact addresses for development (development lifecycle Phase 1, F09 — plan §6 / §10: "address
 * report/player/metric state in URLs with safe, internal return destinations").
 *
 * ⚠ ONE mechanism, extended — never a new one. The player record already answers
 * `?section=development` (`CoachCollapseSection` opens the section and scrolls to it); this module
 * adds the VIEW (goals | results — the two views of re-evaluation stage 3; Phase 2's four shrank
 * there), the metric, the goal or the observation to focus, the archive fold, and a way back to the
 * report that sent the coach, carrying that report's own filters. The Insights hub keeps `?section=`
 * and gains its filter state on the same convention.
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

/**
 * The two views inside the player's Skills & Goals tab (re-evaluation stage 3, owner ruling E1,
 * 2026-09-15). Phase 2's `observations` and `archive` views are RETIRED, and their addresses still
 * land somewhere honest (`parseDevelopmentAddress`, `developmentAddressTab`): an observation's home
 * is the Notes tab, and the archive is a fold at the foot of this tab, opened by the address.
 */
export type DevelopmentView = 'goals' | 'results';
export const DEVELOPMENT_VIEWS: ReadonlyArray<DevelopmentView> = ['goals', 'results'];
/** The two Phase 2 views that no longer exist — kept ONLY so an old link lands, never offered. */
const RETIRED_VIEW_OBSERVATIONS = 'observations';
const RETIRED_VIEW_ARCHIVE = 'archive';

/**
 * Skills & Goals — three views on one screen. `overview` is the LANDING (re-evaluation stage 0,
 * owner ruling 2026-09-14): Money's shape — a getting-started card while there is nothing to
 * count, the season's dashboard once there is. The bare hub address IS the overview, so it never
 * carries `?section=overview`; the other two are addressed as before.
 *
 * ⚠ `players` is RETIRED (re-evaluation stage 4, owner ruling G1, 2026-09-16): the roster table has
 * ONE home, Insights → Coverage, because a coach without the Development grant has no Skills &
 * Goals door at all and reads the roster there. An old `?section=players` address lands on the
 * Overview (`parseSkillsAndGoalsSection`); it is never offered.
 */
export type SkillsAndGoalsSection = 'overview' | 'sessions' | 'metrics';
export const SKILLS_AND_GOALS_SECTIONS: ReadonlyArray<SkillsAndGoalsSection> = ['overview', 'sessions', 'metrics'];

export interface DevelopmentAddress {
  view: DevelopmentView | null;
  metricId: string | null;
  goalId: string | null;
  /** An observation to open in its sheet on arrival (Player progress's "Open →", E2). */
  observationId: string | null;
  /** Open the Previous-seasons fold at the tab's foot on arrival (an old `view=archive` link, E1). */
  archive: boolean;
  /** A safe internal path, already validated — or null. */
  returnTo: string | null;
}

/** `URLSearchParams` and Next's `ReadonlyURLSearchParams` both satisfy this. */
interface ParamReader { get(name: string): string | null }

/** An id as the screens send one — never a year, never a path. ONE rule: the readers import it too. */
export const isRecordId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const id = (v: string | null): string | null => (isRecordId(v) ? v : null);

/**
 * Only a path INSIDE this team's portal survives: it must be the team root itself (the Overview —
 * the lineup builder's way back from its card, stage 3 · D3) or start with the team root followed
 * by `/` or `?`, carry no scheme, no `//`, no backslash, no `..` segment, and no year parameter.
 */
export function safeReturnPath(raw: string | null | undefined, base: string): string | null {
  if (!raw) return null;
  if (raw !== base && !raw.startsWith(`${base}/`) && !raw.startsWith(`${base}?`)) return null;
  if (raw.includes('//') || raw.includes('\\') || /(^|\/)\.\.(\/|$|\?)/.test(raw)) return null;
  if (/[?&]year=/.test(raw)) return null;
  return raw;
}

export function parseDevelopmentAddress(params: ParamReader, base: string): DevelopmentAddress {
  const rawView = params.get('view');
  const goalId = id(params.get('goal'));
  // A retired address lands on the home (E1): `view=observations&goal=<id>` is the goal (its history
  // is the door to the observation); a bare `view=observations` is the Notes tab — the page's tab
  // resolution reads that through `developmentAddressTab`, so this parse says no view at all.
  const view: DevelopmentView | null = DEVELOPMENT_VIEWS.includes(rawView as DevelopmentView) ? (rawView as DevelopmentView)
    : rawView === RETIRED_VIEW_OBSERVATIONS && goalId ? 'goals'
    : null;
  return {
    view,
    metricId: id(params.get('metric')),
    goalId,
    observationId: id(params.get('observation')),
    archive: rawView === RETIRED_VIEW_ARCHIVE,
    returnTo: safeReturnPath(params.get('return'), base),
  };
}

/**
 * The tab a development address lands on when it is NOT the Skills & Goals tab: a bare
 * `view=observations` (no goal) is the observation's home, the Notes tab (E1/E2). Read by the
 * player page's tab resolution (`resolvePlayerTab`); null for every address this tab answers.
 */
export function developmentAddressTab(params: ParamReader): 'notes' | null {
  return params.get('section') === 'development' && params.get('view') === RETIRED_VIEW_OBSERVATIONS && !id(params.get('goal'))
    ? 'notes'
    : null;
}

/** The player record, opened on Development — with the view, the metric or goal, and the way back. */
export function playerDevelopmentHref(
  base: string,
  playerId: string,
  opts: { view?: DevelopmentView; metricId?: string | null; goalId?: string | null; observationId?: string | null; returnTo?: string | null } = {},
): string {
  const qp = new URLSearchParams();
  qp.set('section', 'development');
  if (opts.view) qp.set('view', opts.view);
  if (opts.metricId) qp.set('metric', opts.metricId);
  if (opts.goalId) qp.set('goal', opts.goalId);
  if (opts.observationId) qp.set('observation', opts.observationId);
  const back = safeReturnPath(opts.returnTo ?? null, base);
  if (back) qp.set('return', back);
  return `${base}/roster/${playerId}?${qp.toString()}`;
}

/**
 * What the way back is called — by where it goes, never by a label the address could carry. The
 * header composes "Back to <label>" for the arrow's name and shows the label beside it, so each is
 * the destination's NOUN. The lineup builder's three doors (phone re-evaluation stage 3 · D3):
 * the game on the Schedule (`schedule?event=…` — that game's sheet), the game-day console, and the
 * bare team address, the Overview.
 */
export function returnLabel(returnTo: string | null, base: string): string | null {
  if (!returnTo) return null;
  if (returnTo === base) return 'Overview';
  // A route prefix with a boundary — `/development` and `/development?section=…`, never `/developmentx`.
  const under = (segment: string) => new RegExp(`^${base.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}/${segment}(?:[/?#]|$)`).test(returnTo);
  if (under('development')) return 'Skills & Goals';
  if (under('history')) return 'Insights';
  if (under('schedule') && /[?&]event=/.test(returnTo)) return 'The game';
  if (under('game')) return 'Game day';
  return null;
}

/**
 * Skills & Goals — sections on `?section=`, the Money and Insights hubs' convention; the overview
 * is the bare address. `edit` opens a metric's DEFINITION in its sheet over whichever section is
 * on screen (re-evaluation stage 1, 2026-09-14 — a metric is a record on a list, so it opens over
 * the list the way a player's dues do, never on a page of its own): `new` defines one, an id edits
 * it. Back closes the sheet. (⚰ `metric` — the Players view's Show choice — went with the view,
 * stage 4; the Show choice lives on the Insights address now.)
 */
export function skillsAndGoalsHref(base: string, section: SkillsAndGoalsSection, extra?: { edit?: MetricEdit | null }): string {
  const qp = new URLSearchParams();
  if (section !== 'overview') qp.set('section', section);
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
/**
 * The four reports, in the selector's order — whole → one: Coverage (who has a result, per player on
 * one metric), Team progress (counts of motion per METRIC, naming nobody — owner ruling T1/T2,
 * 2026-09-16, the project D8 parked), Player progress (one child's chart), Practice review. This
 * ONE list is what the selector offers and what the Overview's rail counts (`developmentReports`),
 * so a report added here appears in both by construction.
 */
export type DevelopmentReport = 'coverage' | 'team' | 'progress' | 'practices';
export const DEVELOPMENT_REPORTS: ReadonlyArray<DevelopmentReport> = ['coverage', 'team', 'progress', 'practices'];
/**
 * The reports whose address carries a METRIC (`metric=`): Coverage's Show and Player progress's
 * Metric. A positive list, so a report added above defaults to "no metric" without the panel
 * growing a second exclusion — Team progress and Practice review read the whole team.
 */
export const REPORTS_WITH_METRIC: ReadonlySet<DevelopmentReport> = new Set<DevelopmentReport>(['coverage', 'progress']);
/**
 * Coverage's first Show choice — the goals as words per player (re-evaluation stage 4, G1: the
 * Players view's "Current focus", moved here with the table). It rides `metric=` with this ONE
 * spelling — the Overview's Goals door and the panel's selector both write it; an id-shaped word,
 * so `isRecordId` lets it through and a real metric id can never collide with it.
 */
export const COVERAGE_FOCUS = 'focus';
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
