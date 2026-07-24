import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from './system-screens.module.css';

/**
 * Root 404 — handles every unmatched URL app-wide, so it renders without any
 * shell's theme wrapper. It follows the user theme itself: `warm.warmVars`
 * supplies the --home-* tokens and system-screens.module.css warm-gates the
 * overrides, so Dark choosers keep this HUD screen byte-identical while the
 * warm-default majority get paper instead of a dark takeover.
 */
export default function NotFound() {
  return (
    <div className={`min-h-screen bg-pitch-black bg-grid-faint bg-grid flex items-center justify-center p-8 ${warm.warmVars} ${styles.page}`}>
      <div className="max-w-lg w-full">
        <div className="hud-label mb-6">Diagnostic Output</div>
        <div className={`font-mono text-7xl font-bold text-blueprint-blue/30 mb-2 leading-none ${styles.bigCode}`}>404</div>
        <div className={`font-mono text-xl font-bold text-fl-text mb-3 ${styles.title}`}>[DIAGNOSTIC]: ROUTE_NOT_FOUND</div>
        <div className={`font-mono text-xs text-data-gray mb-8 leading-relaxed ${styles.body}`}>
          Requested resource is outside the current system scope.<br />
          Verify the URL and retry, or return to root.
        </div>
        <Link
          href="/"
          className={`font-mono text-xs uppercase tracking-widest text-logic-lime border border-logic-lime px-8 py-3 hover:bg-logic-lime hover:text-pitch-black transition-colors ${styles.cta}`}
        >
          Return to Root Node
        </Link>
      </div>
    </div>
  );
}
