/**
 * lib/sandbox-curation.ts — the four corners the sandbox deliberately doesn't show.
 *
 * Ratified 2026-08-02 (`TOURNAMENT_ADMIN_SANDBOX_PLAN.md` §8, mockups section 3). This is a demo
 * QUALITY decision, not secrecy: the door itself is ungated permanently, and a competitor already
 * gets more by signing up free than the sandbox ever shows. What is curated is which admin surfaces
 * a stranger meets in their first ninety seconds.
 *
 *   • **Billing & subscription** — a comped demo org's billing page answers a question nobody is
 *     asking yet.
 *   • **Staff invitations** — entirely outbound, so every control on the screen would be locked.
 *     A screen made only of locked buttons reads as a broken product, not a careful one.
 *   • **Data tools & exports** — exporting invented data is a dead end with nothing to learn from.
 *   • **Deep settings forms** — long forms where a stranger cannot tell what changed, or why it
 *     mattered.
 *
 * **Hide the entry point; never let it dead-end.** That is the binding rule already governing
 * archived coach seasons (`CLAUDE.md`) applied to a second surface — a link that 404s or lands on
 * a wall of disabled fields is the same bug wearing a politer face. The pages themselves are
 * untouched and remain harmless if a URL is typed directly: the write block means nothing there can
 * change anything.
 *
 * Everything else in the tournament module stays reachable. This list is four corners, not a
 * curtain — the demo exists to show the product deeply, not defensively.
 */

/**
 * Tournament sidebar keys hidden inside a sandbox org. These are `TourNavItem.key` values from
 * `components/admin/admin-nav-config.ts`; the paths they build are `/{org}/admin/tournaments/{key}`.
 *
 * `settings` is the Settings & Access hub, and hiding it covers three of the four corners at once —
 * it is where subscription, staff invitations, notification settings and the registration-field
 * builder all live. `settings/event` is the Setup group's deep event form. `data-tools` is exports.
 */
export const SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS: ReadonlySet<string> = new Set([
  'settings',
  'settings/event',
  'data-tools',
]);

/**
 * Should this nav item be hidden right now?
 *
 * Takes the sandbox flag rather than reading it, so the same rule serves a server component, a
 * client component and a test without any of them reaching for a context.
 */
export function isNavKeyHiddenInSandbox(isSandbox: boolean, key: string): boolean {
  return isSandbox && SANDBOX_HIDDEN_TOURNAMENT_NAV_KEYS.has(key);
}
