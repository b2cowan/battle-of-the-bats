/**
 * lib/no-flash-script.ts — the ONE inline no-flash script for the ROOT layout.
 *
 * Runs in <head> before first paint and sets the <html> attributes that drive attribute-keyed
 * CSS, so a hard reload never flashes the wrong density or theme. It lives in the ROOT layout
 * only: a script placed in a nested layout is re-created by React on client navigation (which it
 * can't execute — dev warning + FOUC), so all no-flash attributes are consolidated here rather
 * than hand-copied per shell (this supersedes the dead DENSITY_NO_FLASH_SCRIPT in admin-density).
 *
 * Two attributes today:
 *   - data-density     (fl_admin_density → 'comfortable' | 'compact'; coarse-pointer default)
 *   - data-user-theme  (fl_user_theme → 'dark' | 'warm'; WARM is the platform default — the
 *     attribute is always set to 'warm' unless the user explicitly stored 'dark')
 *
 * The keys mirror STORAGE_KEY (lib/admin-density) and THEME_STORAGE_KEY (lib/user-theme). It is a
 * raw string (an inline script can't import modules), kept minimal + fully try/caught so blocked
 * storage never throws before hydration. The account theme (source of truth) reconciles after
 * fetch — one rare repaint, the accepted density-precedent tradeoff.
 */
export const NO_FLASH_SCRIPT =
  "(function(){try{" +
  // Admin density: honour the stored choice, else default by pointer type.
  "var dk='fl_admin_density',dv=null;try{dv=localStorage.getItem(dk);}catch(e){}" +
  "if(dv!=='comfortable'&&dv!=='compact'){dv=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)?'comfortable':'compact';}" +
  "document.documentElement.setAttribute('data-density',dv);" +
  // User theme: WARM is the platform default — set 'dark' only on an explicit stored 'dark',
  // otherwise 'warm'. (The attribute is always present so both shells default warm; the coaches
  // portal warms via its marker + this attribute, the consumer shell's dark override never fires.)
  "var tk='fl_user_theme',tv=null;try{tv=localStorage.getItem(tk);}catch(e){}" +
  "document.documentElement.setAttribute('data-user-theme',tv==='dark'?'dark':'warm');" +
  "}catch(e){}})();";
