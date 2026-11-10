'use client';
/**
 * SidebarLogoTile — the one logo tile (navigation Phase 1 Part B, E10, owner 2026-11-09). A logo, or initials, in ONE
 * frame (`SidebarLogoTile.module.css`): the same white ground, outline and corners either way, so a club with no logo
 * and a club with one wear the same head.
 *
 * ⚖ WHEN IT IS A LOGO (E10 + B4 + B5): only when there is a source, its stored shape is within 1 : 2 … 2 : 1
 * (`logoFitsTile`), and the file loads. No source, an unknown shape, a wordmark wider than 2 : 1 or a banner taller
 * than 1 : 2, or a file that fails to load → the initials. The decision comes from STORED facts, so it is made on the
 * server and the first paint is the last (a width read after the image loaded would swap logo for initials on screen).
 * The one swap that can still happen is the broken file (B4, accepted): `onError` falls back to the initials.
 *
 * `source` and `aspect` are props, not the club's fields, so the event (Phase 2: its logo, then the organization's) and
 * the team (Phase 4: its crest, then its colour) pass their own later — nothing here reads an organization. `size`:
 * 24 beside a name, 40 as a strip tile, `rail` = 24 open and 40 in the folded strip (the club cell, decided by CSS so the
 * server's markup is everybody's).
 *
 * Decorative (`aria-hidden`): the host names the thing — the cell's text, or the strip tile's label.
 */
import { useEffect, useRef, useState } from 'react';
import { logoFitsTile } from '@/lib/logo-aspect';
import { stripTileText } from '@/lib/team-color';
import styles from './SidebarLogoTile.module.css';

export type SidebarLogoTileProps = {
  /** The logo's address, or null/undefined when there is none. */
  source?: string | null;
  /** The logo's stored width / height; unknown (null/undefined) shows the initials. */
  aspect?: number | null;
  /** Names the initials ("Riverdale Minor Ball" → "RM"), also what a failed logo falls back to. */
  name: string;
  size?: 24 | 40 | 'rail';
};

export default function SidebarLogoTile({ source, aspect, name, size = 'rail' }: SidebarLogoTileProps) {
  // A failure belongs to ONE address: a new logo gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const showLogo = !!source && logoFitsTile(aspect) && failed !== source;

  // A file that failed before React took over fired its `error` where nobody listened: it is `complete` with no pixels.
  useEffect(() => {
    const el = img.current;
    if (el && source && el.complete && el.naturalWidth === 0) setFailed(source);
  }, [source, showLogo]);

  return (
    <span className={`${styles.tile} ${styles[size === 'rail' ? 'rail' : `s${size}`]}`} aria-hidden>
      {showLogo
        // eslint-disable-next-line @next/next/no-img-element -- an uploaded or made logo at a fixed 24/40 box; no resize pipeline to ask for
        ? <img ref={img} src={source} alt="" className={styles.image} onError={() => setFailed(source)} />
        : stripTileText(name)}
    </span>
  );
}
