'use client';
/**
 * ⚖ THE TEAM HEADS ITS SIDEBAR (navigation Phase 4, E6, E10, C6, C7; drawings tab 17 "the cell" and "the list"). The event
 * cell's frame (`AdminKitRail`'s `EventCell`: 45px, the one logo tile, the name on up to two lines with its whole name in a
 * title only when cut), with the team's tile — its crest, else its colour, else its initials (`teamTile`, decided from
 * stored facts so the server's first paint is the last).
 *
 * ⚖ A CHEVRON MEANS "SWITCH" (§6, C-gate cell): with two teams or more — live or between seasons, they count alike — the
 * WHOLE cell is one button that opens the team list (`SidebarMenu`, the event list's window and rows: "Your teams", then
 * "No live season", the current one marked). One team: no chevron, and the cell is a link to the team's Overview (a team
 * with no live season: its season's page, its one door). A picked team opens its Overview (C6), a closed one its
 * season's page. Folded, the cell is the tile alone and opens the same list beside it (the name is the bubble's).
 * Keyboard: Enter, Space or the down arrow opens; the list owns the keys from there.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useCoaches, resolveLiveSeason } from '@/lib/coaches-context';
import { isSidebarStrip } from '@/lib/sidebar-strip';
import { teamHref, teamSwitchGroups, teamTile } from '@/lib/coach-team-tile';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import SidebarMenu from '@/components/shared/SidebarMenu';
import strip from '@/components/shared/SidebarStrip.module.css';
import list from '@/components/shared/SidebarSwitchList.module.css';
import coachKit from '@/app/[orgSlug]/coaches/coaches.module.css';

/** The drawings' window (tab 17): the event list's 320. */
const WIDTH = 320;

/** The name, two lines at most, its whole self in a `title` only while the clamp cuts it (never in the folded strip). */
function CellName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCut(!isSidebarStrip() && el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);
  return <span ref={ref} className={`${strip.rowLabel} ${coachKit.teamCellName}`} title={cut ? name : undefined}>{name}</span>;
}

export default function CoachTeamCell({ orgSlug, currentTeamId }: { orgSlug: string; currentTeamId: string | null }) {
  const { assignments, closedAssignments } = useCoaches();
  const pathname = usePathname();
  const cellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The list closes when the page changes (the shell survives client navigation).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // A team mid-rollover holds two live seasons: it is ONE team, on the season the portal reads (`resolveLiveSeason`).
  const liveOf = (id: string) => {
    const season = resolveLiveSeason(assignments, id);
    return season ? assignments.find(a => a.teamId === id && a.programYearId === season.programYearId) ?? null : null;
  };
  const live = currentTeamId ? liveOf(currentTeamId) : null;
  const team = live ?? closedAssignments.find(a => a.teamId === currentTeamId) ?? null;
  if (!team) return null;
  const name = team.teamName;
  const tile = teamTile(orgSlug, team);
  const liveIds = [...new Set(assignments.map(a => a.teamId))];
  const multi = liveIds.length + closedAssignments.length > 1;
  const tileEl = <SidebarLogoTile source={tile.source} aspect={tile.aspect} color={tile.color} name={name} />;

  if (!multi) {
    return (
      <Link
        href={teamHref(orgSlug, team.teamId, !live)}
        className={coachKit.teamCell}
        aria-label={name}
      >
        {tileEl}
        <CellName name={name} />
      </Link>
    );
  }

  // Built only while the list is open: the cell re-renders on every page change, and the list is shut nearly always.
  const groups = open
    ? teamSwitchGroups(orgSlug, liveIds.map(liveOf).filter((a): a is NonNullable<typeof a> => !!a), closedAssignments, team.teamId)
    : [];
  return (
    <>
      <button
        ref={cellRef}
        type="button"
        className={`${coachKit.teamCell} ${coachKit.teamCellButton}${open ? ` ${coachKit.teamCellOpen}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} · switch team`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
      >
        {tileEl}
        <CellName name={name} />
        <ChevronDown size={16} aria-hidden className={`${coachKit.teamCellChevron} ${strip.fullOnly}`} />
      </button>
      <SidebarMenu
        open={open}
        anchorRef={cellRef}
        label="Your teams"
        placement="cell"
        width={WIDTH}
        className={coachKit.convWhatList}
        onClose={() => setOpen(false)}
      >
        {groups.map(g => (
          <div key={g.label} role="group" aria-label={g.label}>
            <div className={`${coachKit.convWhatGroup} ${list.switchGroup}`} aria-hidden>{g.label}</div>
            {g.rows.map(row => (
              <Link
                key={row.teamId}
                href={row.href}
                role="menuitem"
                tabIndex={-1}
                className={`${coachKit.convWhatOpt} ${list.switchRow}`}
                aria-current={row.current ? 'true' : undefined}
                // The team you are on: picking it again only closes the list (the event list's rule).
                onClick={e => { if (row.current) e.preventDefault(); }}
              >
                <SidebarLogoTile source={row.tile.source} aspect={row.tile.aspect} color={row.tile.color} name={row.name} size={24} />
                <span className={list.switchText}>
                  <span className={`${coachKit.convWhatOptName}${row.current ? ` ${list.switchCurrent}` : ''}`}>{row.name}</span>
                  {row.line && <span className={coachKit.convWhatOptSub}>{row.line}</span>}
                </span>
                {row.current && <Check size={16} aria-hidden className={list.switchIcon} />}
              </Link>
            ))}
          </div>
        ))}
      </SidebarMenu>
    </>
  );
}
