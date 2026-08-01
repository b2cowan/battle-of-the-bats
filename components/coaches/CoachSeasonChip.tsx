'use client';
import { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';
import { useDismissable, useAnchoredMenu } from '@/lib/overlay-hooks';
import { resolveSeasonSwitchHref, seasonStatusLabel } from '@/lib/coach-season-view';
import type { SeasonView } from '@/lib/coaches-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "2025 · Complete" — the read-only signal on a past season's page (Chunk F, D-F4).
 *
 * The owner cut the per-screen banner: a coach who switches into an archive learns the convention
 * within a screen or two, and a banner on thirty-odd screens is noise. This chip beside the page
 * title, the amber season switcher in the shell, and the year in the breadcrumb carry it between
 * them.
 *
 * It is ALSO the way out (D-F3). On a phone the switcher lives in the More sheet, so without this
 * the exit from an archive would be buried; the chip is already on screen beside the title and
 * costs no vertical space of its own. It owns its own season list rather than reaching into the
 * bottom nav's sheet state — one component, no cross-component coordination.
 *
 * Renders NOTHING for a live season: the everyday view gains no chrome.
 */
export default function CoachSeasonChip({
  season,
  teamBase,
}: {
  season: SeasonView;
  /** `/{org}/coaches/teams/{teamId}` — where switching seasons lands. */
  teamBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissable(open, wrapRef, () => setOpen(false)); // click-outside + Escape
  // Placement is shared, not hand-rolled (the same hook ExportMenu and the tournament toolbar
  // use). It matters here specifically: this chip sits beside a page TITLE on a 361px phone, so a
  // fixed `top: 100%; left: 0` panel is exactly the shape that opens off the bottom or the right
  // edge. The hook flips above and clamps to the viewport.
  const menuStyle = useAnchoredMenu(open, wrapRef, menuRef, {
    minWidth: 208,
    narrowMinWidth: 160,
    align: 'start',
  });

  if (!season.isReadOnly || !season.current) return null;

  const label = `${season.current.programYearName} · Complete`;

  // Nothing to choose between (a team with one season can't be in an archive, but a coach with
  // access to only one of several can) ⇒ a plain label, not a control that does nothing.
  if (!teamBase || !season.hasChoice) {
    return <span className={styles.seasonChip}>{label}</span>;
  }

  const go = (programYearId: string) => {
    setOpen(false);
    const target = season.options.find(s => s.programYearId === programYearId);
    if (!target) return;
    router.push(resolveSeasonSwitchHref(teamBase, pathname, target));
  };

  return (
    <span className={styles.seasonChipWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.seasonChip} ${styles.seasonChipButton}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}. Choose a different season`}
      >
        {label}
        <ChevronDown size={12} aria-hidden />
      </button>

      {open && (
        <div ref={menuRef} style={menuStyle} className={styles.seasonChipMenu} role="listbox" aria-label="Choose a season">
          <div className={styles.seasonChipMenuHead}>
            <span>Which season?</span>
            <button
              type="button"
              className={styles.seasonChipMenuClose}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          {season.options.map(s => {
            const active = s.programYearId === season.current!.programYearId;
            return (
              <button
                key={s.programYearId}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.seasonChipMenuItem}${active ? ` ${styles.seasonChipMenuItemActive}` : ''}`}
                onClick={() => go(s.programYearId)}
              >
                <span>{s.programYearName}</span>
                <span className={styles.seasonChipMenuMeta}>
                  {seasonStatusLabel(s)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
