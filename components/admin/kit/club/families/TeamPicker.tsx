'use client';
/**
 * THE GROUPED TEAM PICKER (Email families, a house-league season with more than a dozen teams — owner drawing 2026-10-26,
 * "Email families: picking teams at scale"). Fifty pills in one block cannot be scanned, and the same team name (every
 * division has a "Cubs") cannot be told apart. So above `GROUPED_FROM` teams the "A team" row opens this instead:
 *   · one SEARCH field (the shared one) — typing turns the shelves into a flat list of matches, each naming its division;
 *   · one SHELF per division — closed but for the one holding a pick (seeded once, at mount), ONE open at a time, so the
 *     picker is never taller than five headers and a division's pills and nothing inside the window scrolls by itself;
 *   · "Select all" / "Clear" on each shelf — the likeliest send is "most of a division";
 *   · one line saying what is picked ("3 teams picked") with Clear. ⚠ It never counts FAMILIES: the foot says that, once,
 *     from the server's single audience read (two teams can share a family — a sum here would be wrong).
 * A season at or under the threshold keeps today's flat pills, which the window draws itself.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SearchField from '@/components/shared/SearchField';
import { SEASON_EMAIL_WORDS as SW } from '@/lib/families-words';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { claimEscape } from '@/components/coaches/escapeOwnership';
import ls from '../league/LeagueSeason.module.css';
import { RowAction, repKit } from '../RepKit';
import s from './TeamPicker.module.css';

/** More teams than this and the pills become shelves. A dozen still scans as one block. */
export const GROUPED_FROM = 12;

export interface PickerTeam { teamId: string; name: string; divisionId: string; families: number }
export interface PickerDivision { divisionId: string; name: string }

/** The matched letters in bold; a name that doesn't contain the query comes back whole. */
function marked(name: string, q: string) {
  const at = q ? name.toLowerCase().indexOf(q) : -1;
  if (at < 0) return name;
  return <>{name.slice(0, at)}<b>{name.slice(at, at + q.length)}</b>{name.slice(at + q.length)}</>;
}

export default function TeamPicker({ teams, divisions, picked, onChange }: {
  teams: readonly PickerTeam[];
  /** The season's divisions, in their own order. */
  divisions: readonly PickerDivision[];
  /** The picked team ids. */
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const phone = useIsPhone();
  const [q, setQ] = useState('');
  const { shelves, divisionOf } = useMemo(() => {
    const by = new Map<string, PickerTeam[]>();
    for (const t of teams) {
      const list = by.get(t.divisionId);
      if (list) list.push(t); else by.set(t.divisionId, [t]);
    }
    const out = divisions.filter(d => by.has(d.divisionId)).map(d => ({ id: d.divisionId, name: d.name, teams: by.get(d.divisionId)! }));
    // The window's division list is only the divisions that have families, while a team is listed on ITS own families — so a
    // team can name a division the list leaves out. Such teams still get a shelf, never quietly dropped from the choices.
    const known = new Set(divisions.map(d => d.divisionId));
    const strays = teams.filter(t => !known.has(t.divisionId));
    if (strays.length > 0) out.push({ id: '__other', name: SW.otherDivision, teams: strays });
    const shelves = out.map(sh => ({ ...sh, ids: sh.teams.map(t => t.teamId) }));
    return { shelves, divisionOf: new Map(shelves.flatMap(sh => sh.teams.map(t => [t.teamId, sh.name] as const))) };
  }, [teams, divisions]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  // Opened ONCE, at mount (a collapsible seeds its open state once): the shelf that already holds a pick, if any.
  const [open, setOpen] = useState<string | null>(() => shelves.find(sh => sh.ids.some(id => pickedSet.has(id)))?.id ?? null);

  const on = (id: string) => pickedSet.has(id);
  const flip = (id: string) => onChange(on(id) ? picked.filter(x => x !== id) : [...picked, id]);
  const flipAll = (ids: readonly string[]) => {
    const these = new Set(ids);
    onChange(ids.every(on) ? picked.filter(x => !these.has(x)) : [...new Set([...picked, ...ids])]);
  };
  const pickedCount = teams.filter(t => on(t.teamId)).length;

  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => (needle ? teams.filter(t => t.name.toLowerCase().includes(needle)) : []), [teams, needle]);

  return (
    <div className={s.picker}>
      {/* Escape in a filled search box means "clear the search" — never "close the window I am picking teams in" (the floor
          closes on Escape unless a control claims it, and a long pick would be lost with no question asked). */}
      <div className={s.bar} onKeyDown={e => { if (e.key === 'Escape' && q !== '' && !e.nativeEvent.isComposing) { claimEscape(e); setQ(''); } }}>
        <SearchField value={q} onChange={setQ} label={SW.teamSearch} layout={phone ? 'fill' : 'desk'} />
        {pickedCount > 0 && (
          <p className={s.sum} role="status">
            <span>{SW.teamsPicked(pickedCount)}</span>
            <button type="button" className={repKit.inlineLink} onClick={() => onChange([])}>{SW.clear}</button>
          </p>
        )}
      </div>

      {needle ? (
        <>
          <p className={s.matchLine} role="status">{SW.teamMatches(hits.length, teams.length)}</p>
          <div className={s.shelves} role="group" aria-label={SW.matchingTeams}>
            {hits.map(t => (
              <label key={t.teamId} className={s.hit}>
                <input type="checkbox" checked={on(t.teamId)} onChange={() => flip(t.teamId)} />
                <span className={s.hitName}>{marked(t.name, needle)}</span>
                <span className={s.hitSub}>{SW.matchSub(divisionOf.get(t.teamId) ?? SW.otherDivision, t.families)}</span>
              </label>
            ))}
            {hits.length === 0 && <p className={s.empty}>{SW.noTeamMatches}</p>}
          </div>
        </>
      ) : (
        <div className={s.shelves}>
          {shelves.map(sh => {
            const k = sh.ids.filter(on).length;
            const all = k === sh.ids.length;
            const isOpen = open === sh.id;
            return (
              <div key={sh.id} className={s.shelf}>
                <div className={s.shelfHead}>
                  <button type="button" className={s.toggle} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : sh.id)}>
                    {isOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                    <span className={s.dName}>{sh.name}</span>
                    <span className={s.dCount}>{SW.shelfTeams(sh.teams.length)}</span>
                    {k > 0 && <span className={s.badge}>{SW.shelfPicked(k)}</span>}
                  </button>
                  <RowAction onClick={() => flipAll(sh.ids)} aria-label={all ? SW.clearShelfIn(sh.name) : SW.selectAllIn(sh.name)}>
                    {all ? SW.clear : SW.selectAll}
                  </RowAction>
                </div>
                {isOpen && (
                  <div className={s.shelfChips} role="group" aria-label={sh.name}>
                    {sh.teams.map(t => (
                      <button key={t.teamId} type="button" className={ls.chip} aria-pressed={on(t.teamId)} onClick={() => flip(t.teamId)}>
                        {SW.chip(t.name, t.families)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
