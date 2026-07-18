'use client';
/**
 * components/public/FollowTeamPicker.tsx
 * The front door to the follow loop (J6-011): a tappable "pick your team" control
 * that follows a team (localStorage, no account) and fires `fl-follow-change` so the
 * dock / scorebug / my-team strip appear immediately. Reused as a standalone card
 * (home empty-state) and inline (schedule scorebug prompt). Caller scopes `teams`.
 */
import { Fragment, useMemo, useState } from 'react';
import { Star, Search, X } from 'lucide-react';
import type { Division, PublicTeam } from '@/lib/types';
import { saveFollowedTeam } from '@/lib/follow';
import styles from './FollowTeamPicker.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  /** Pickable teams — caller scopes these (e.g. to the active division). */
  teams: PublicTeam[];
  /** `card` = standalone home empty-state; `inline` = compact schedule prompt. */
  variant?: 'card' | 'inline';
  /** Fires after a team is followed — e.g. to trigger the post-follow alerts nudge. */
  onFollowed?: (team: PublicTeam) => void;
  /** When the caller spans multiple divisions (e.g. the home empty-state, which
   *  lists every team tournament-wide), pass these so the list groups under a
   *  small division header per section instead of one flat A–Z list. Omit (or a
   *  single division) for an already division-scoped caller — no headers then. */
  divisions?: Division[];
}

export default function FollowTeamPicker({
  orgSlug,
  tournamentSlug,
  teams,
  variant = 'inline',
  onFollowed,
  divisions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter(t => t.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);

  // Group by division only when the caller supplied 2+ divisions — a single-division
  // caller (e.g. the schedule scorebug prompt, already scoped) stays a flat list.
  const groups = useMemo(() => {
    if (!divisions || divisions.length < 2) return null;
    const orderedDivisions = [...divisions].sort((a, b) => a.order - b.order);
    const byDivision = new Map<string, PublicTeam[]>();
    for (const t of filtered) {
      const key = t.divisionId ?? '__other';
      if (!byDivision.has(key)) byDivision.set(key, []);
      byDivision.get(key)!.push(t);
    }
    const out: { id: string; name: string; teams: PublicTeam[] }[] = [];
    for (const d of orderedDivisions) {
      const divTeams = byDivision.get(d.id);
      if (divTeams?.length) out.push({ id: d.id, name: d.name, teams: divTeams });
    }
    const other = byDivision.get('__other');
    if (other?.length) out.push({ id: '__other', name: 'Other', teams: other });
    return out;
  }, [divisions, filtered]);

  if (teams.length === 0) return null;

  function pick(team: PublicTeam) {
    saveFollowedTeam(orgSlug, tournamentSlug, { id: team.id, name: team.name, divisionId: team.divisionId });
    setOpen(false);
    setQuery('');
    onFollowed?.(team);
  }

  return (
    <div className={variant === 'card' ? styles.card : styles.inline}>
      <button type="button" className={styles.trigger} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Star size={14} className={styles.triggerStar} aria-hidden />
        <span>{variant === 'card' ? 'Follow your team' : 'Pick your team to pin its score & next game'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.searchRow}>
            <Search size={14} className={styles.searchIcon} aria-hidden />
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search teams…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search teams"
            />
            <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close team picker">
              <X size={14} />
            </button>
          </div>
          <ul className={styles.list}>
            {groups ? (
              groups.map(g => (
                <Fragment key={g.id}>
                  <li className={styles.groupHeader} aria-hidden="true">{g.name}</li>
                  {g.teams.map(t => (
                    <li key={t.id}>
                      <button type="button" className={styles.teamBtn} onClick={() => pick(t)}>
                        <Star size={12} className={styles.teamStar} aria-hidden />
                        <span>{t.name}</span>
                      </button>
                    </li>
                  ))}
                </Fragment>
              ))
            ) : (
              filtered.map(t => (
                <li key={t.id}>
                  <button type="button" className={styles.teamBtn} onClick={() => pick(t)}>
                    <Star size={12} className={styles.teamStar} aria-hidden />
                    <span>{t.name}</span>
                  </button>
                </li>
              ))
            )}
            {filtered.length === 0 && <li className={styles.empty}>No teams match “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
