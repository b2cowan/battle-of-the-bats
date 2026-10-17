'use client';
/**
 * MoreSheetTiles — the shortcut row at the top of a phone's More sheet: three tiles, each a door to a page the person
 * reaches again and again from a phone. ONE row for the Premium coach's sheet (2026-09-20, A1) and the club and
 * tournament admin's (the nav standard's N8, 2026-10-17), drawn by the one stylesheet every phone bar wears — so two
 * sheets cannot grow two kinds of tile. The free portal's tiles are its TOOLS (an exception in the standard) and keep
 * their own row.
 */
import Link from 'next/link';
import type { ElementType } from 'react';
import styles from './CoachesBottomNav.module.css';

export type SheetTile = { key: string; href: string; label: string; icon: ElementType; active: boolean };

export default function MoreSheetTiles({ tiles, onPick }: {
  tiles: readonly SheetTile[];
  /** Closes the sheet on the tap itself (a tile for the page already on screen brings no route change). */
  onPick: () => void;
}) {
  if (tiles.length === 0) return null;
  return (
    <div className={styles.hotTiles} role="group" aria-label="Most used">
      {tiles.map(({ key, href, label, icon: Icon, active }) => (
        <Link
          key={key}
          href={href}
          className={`${styles.hotTile}${active ? ` ${styles.dropActive}` : ''}`}
          role="menuitem"
          aria-current={active ? 'page' : undefined}
          onClick={onPick}
        >
          <Icon size={20} aria-hidden />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}
