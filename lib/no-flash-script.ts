/**
 * lib/no-flash-script.ts — the ONE inline no-flash script for the ROOT layout.
 *
 * Runs in <head> before first paint and sets the <html> attributes that drive attribute-keyed
 * CSS, so a hard reload never flashes the wrong density or theme. It lives in the ROOT layout
 * only: a script placed in a nested layout is re-created by React on client navigation (which it
 * can't execute — dev warning + FOUC), so all no-flash attributes are consolidated here rather
 * than hand-copied per shell (this supersedes the dead DENSITY_NO_FLASH_SCRIPT in admin-density).
 *
 * Four attributes today:
 *   - data-sidebar     (flhq-sidebar → 'strip'; absent = the full sidebar). Every portal's sidebar
 *     narrows to its icon strip under it (lib/sidebar-strip.ts, Sidebar Strip & Grid Width Stage 2).
 *   - data-density     (fl_admin_density → 'comfortable' | 'compact'; coarse-pointer default)
 *   - data-user-theme  (fl_user_theme → 'dark' | 'warm'; WARM is the platform default — the
 *     attribute is always set to 'warm' unless the user explicitly stored 'dark')
 *   - data-coach-setup-skipped  (set only on /coaches/team/{id} when THAT team's setup panel was
 *     skipped). The skip lives on the device, so the server always renders the setup card; without
 *     this a coach who opted out watched the full card paint and collapse to a one-line link on
 *     EVERY Overview visit — permanently, since skipping means the steps never complete. The
 *     attribute is removed at hydration by CoachPortalShell so it can never leak across a
 *     client-side navigation to a different team (this script runs once per hard load only).
 *
 * The keys mirror STORAGE_KEY (lib/admin-density), THEME_STORAGE_KEY (lib/user-theme) and
 * coachNudgeStorageKey/COACH_SETUP_NUDGE (components/coaches/useCoachNudgeDismiss). Kept minimal
 * + fully try/caught so blocked storage never throws before hydration. The account theme (source
 * of truth) reconciles after fetch — one rare repaint, the accepted density-precedent tradeoff.
 *
 * ⚠ ONE FUNCTION, TWO JOBS (2026-10-13). The inline script is this function's own source,
 * stringified — an inline script can't import modules, and a hand-written string beside a
 * hand-written restore would be two copies of one rule. The second job is NoFlashRestore: when
 * hydration fails at the root, React rebuilds <html> from its props and STRIPS every attribute
 * this script set (react-dom's singleton acquisition removes all attributes first). With no
 * data-user-theme, the coach portal fell to its dark base while the consumer bar stayed white —
 * a Warm coach's screen went half dark. So this function must stay SELF-CONTAINED: no imports,
 * no outer variables, nothing a bundler could rename out from under the stringified copy.
 */
export function applyNoFlashAttributes(): void {
  try {
    const root = document.documentElement;
    // Admin density: honour the stored choice, else default by pointer type.
    let dv: string | null = null;
    try { dv = localStorage.getItem('fl_admin_density'); } catch { /* blocked storage */ }
    if (dv !== 'comfortable' && dv !== 'compact') {
      dv = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'comfortable' : 'compact';
    }
    root.setAttribute('data-density', dv);
    // User theme: WARM is the platform default — set 'dark' only on an explicit stored 'dark',
    // otherwise 'warm'. (The attribute is always present so both shells default warm; the coaches
    // portal warms via its marker + this attribute, the consumer shell's dark override never fires.)
    let tv: string | null = null;
    try { tv = localStorage.getItem('fl_user_theme'); } catch { /* blocked storage */ }
    root.setAttribute('data-user-theme', tv === 'dark' ? 'dark' : 'warm');
    // Free coach portal: hide the Overview setup card before first paint when THIS team's panel was
    // already skipped. Team id comes from the path, so the flag is never applied to another team.
    const cm = location.pathname.match(/^\/coaches\/team\/([^/]+)/);
    if (cm) {
      let cv: string | null = null;
      try { cv = localStorage.getItem('fl_coach_nudge_dismissed:' + cm[1] + ':first_run_setup'); } catch { /* blocked storage */ }
      if (cv === '1') root.setAttribute('data-coach-setup-skipped', '1');
    }
    // The sidebar strip (lib/sidebar-strip.ts — SIDEBAR_STRIP_KEY / _ATTR / _VALUE): one choice per device,
    // shared by every portal, so a strip user's sidebar is already narrow on the first paint.
    let sv: string | null = null;
    try { sv = localStorage.getItem('flhq-sidebar'); } catch { /* blocked storage: the full sidebar */ }
    if (sv === 'strip') root.setAttribute('data-sidebar', 'strip');
  } catch { /* never throw before hydration */ }
}

export const NO_FLASH_SCRIPT = `(${applyNoFlashAttributes.toString()})();`;
