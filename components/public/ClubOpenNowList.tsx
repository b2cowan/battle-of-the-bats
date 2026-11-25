'use client';
import Link from 'next/link';
import ClubMoreRow, { useShowMore } from './ClubMoreRow';
import type { OpenNowRow } from './ClubSiteHome';
import kit from './ClubKit.module.css';

/** Open now shows this many rows, then "N more open now" (Stage 0 A1; built in Club Website Stage 1). */
const OPEN_NOW_ROWS = 2;

/**
 * Open now's list on the club home (Stage 0 A1, ruled 2026-11-24): at most two rows, nearest deadline first (the page
 * orders them), then one row saying how many more and naming them, opening the rest in place like the games part's own
 * "N more" rows — so the games part right under it starts inside a phone's first screen. The heading says "open" once,
 * so the rows carry no chip.
 */
export default function ClubOpenNowList({ rows }: { rows: OpenNowRow[] }) {
  const { open, ref, toggle } = useShowMore<HTMLDivElement>();
  const capped = rows.length > OPEN_NOW_ROWS;
  const rest = capped ? rows.slice(OPEN_NOW_ROWS) : [];
  return (
    <div ref={ref} className={`${kit.list} ${kit.edge}`}>
      {(capped && !open ? rows.slice(0, OPEN_NOW_ROWS) : rows).map(r => (
        <Link key={r.key} href={r.href} className={kit.row}>
          <span className={kit.rowMain}>
            <span className={kit.rowName}>{r.title}</span>
            {r.sub && <span className={kit.rowSub}>{r.sub}</span>}
          </span>
        </Link>
      ))}
      {capped && (
        <ClubMoreRow open={open} onToggle={toggle} title={`${rest.length} more open now`} sub={rest.map(r => r.title).join(' · ')} />
      )}
    </div>
  );
}
