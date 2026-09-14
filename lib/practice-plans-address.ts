/**
 * The Practice plans room's addresses (practices re-evaluation stage 0 · Arrive, owner ruling D5,
 * 2026-09-14): one room, three tabs — Practices · Templates · Drills — each a real, shareable
 * address on `?section=`, the Money / Insights / Skills & Goals hubs' convention (`CoachTabBar`).
 * The bare hub address IS the Practices landing and never carries `?section=practices`.
 *
 * ⚠ The two libraries MOVED here whole from under Skills & Goals (`/development/templates`,
 * `/development/drills`); those addresses redirect to the tab. The template editor is a drill-in
 * of its own at `/practice/templates/{id}` — the list is a tab, the record is a page, the same
 * split Skills & Goals makes between `?section=metrics` and `/development/metrics/{id}`.
 *
 * ⚠ NEVER A YEAR. Practice plans, templates and drills are live-season instruments; the look-back
 * layer is the closed-season page (`HISTORY_ENDPOINTS`), and no address here reads one.
 *
 * Framework-free on purpose — the redirect pages are server components, and the unit test imports
 * this under plain node.
 */
export type PracticePlansSection = 'practices' | 'templates' | 'drills';
export const PRACTICE_PLANS_SECTIONS: ReadonlyArray<PracticePlansSection> = ['practices', 'templates', 'drills'];

/** The hub, or one of its tabs. `base` is the team root (`/{org}/coaches/teams/{id}`). */
export function practicePlansHref(base: string, section: PracticePlansSection = 'practices'): string {
  return section === 'practices' ? `${base}/practice` : `${base}/practice?section=${section}`;
}

/** The template editor's own address. */
export function planTemplateHref(base: string, templateId: string): string {
  return `${base}/practice/templates/${templateId}`;
}

/** An unknown or missing section lands on Practices — the landing. */
export function parsePracticePlansSection(raw: string | null | undefined): PracticePlansSection {
  return PRACTICE_PLANS_SECTIONS.includes(raw as PracticePlansSection) ? (raw as PracticePlansSection) : 'practices';
}
