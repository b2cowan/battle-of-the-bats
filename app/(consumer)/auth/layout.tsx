import warm from '@/components/consumer/warmTheme.module.css';
import styles from './auth.module.css';

/**
 * Auth-group layout — the theme-following surface for the sign-in family
 * (login / signup / forgot-password / reset / signup-confirm / suspended /
 * accept-invite / accept-assistant-invite). Supersedes the R1-4 "auth stays
 * dark" carve-out: warm is the platform default (2026-07-22), so these screens
 * follow the user theme exactly like the four consumer tabs.
 *
 * Two NESTED divs, deliberately:
 *   • outer `warm.warmTab` — the same pref-gated surface the tabs wear: paper
 *     ground + the --home-* vocabulary under Warm, the exact dark shell values
 *     under an explicit Dark preference. It also CAPTURES --home-lime as true
 *     brand lime at this level (warmTheme.module.css).
 *   • inner `styles.authSurface` — remaps the dark vocabulary tokens this
 *     group's stylesheet + inline styles consume (--fl-text, --data-gray,
 *     --logic-lime→olive, …) under Warm only. It must be a DESCENDANT of the
 *     capture, not the same element: remapping --logic-lime on the element that
 *     declares `--home-lime: var(--logic-lime)` would collapse the captured
 *     lime to olive and turn the lime submit CTA olive (an E3 violation).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={warm.warmTab}>
      <div className={styles.authSurface}>{children}</div>
    </div>
  );
}
