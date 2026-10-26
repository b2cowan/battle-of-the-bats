'use client';
/**
 * RATE A DIVISION (Club Tier Stage 9c, Part 3; copy §3; rulings 9c·2a/c, 9c·8). A number from 1 to 5 a player, nothing
 * else. Each tap saves (edit autosaves; a rating tells nobody), a tap on the chosen number clears it, and on a keyboard
 * 1-5 rates the focused player and moves to the next. A desk ticks rows and rates them together; a phone has rows of five
 * 44px buttons. Only the people who run the league ever open it.
 */
import { useMemo, useRef, useState } from 'react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import { send, type BoardPlayer, type TeamsRoutes } from './api';
import css from './Teams.module.css';

const NUMBERS = [1, 2, 3, 4, 5] as const;

export default function RateWindow({ division, players, ratings, routes, isPhone, onRated, onClose }: {
  division: string;
  players: readonly BoardPlayer[];
  ratings: ReadonlyMap<string, number>;
  routes: TeamsRoutes;
  isPhone: boolean;
  /** The screen's copy of the ratings, kept in step with each save. */
  onRated: (ids: readonly string[], rating: number | null) => void;
  onClose: () => void;
}) {
  const [onlyUnrated, setOnlyUnrated] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLTableRowElement | HTMLDivElement>());
  const unrated = players.filter(p => !ratings.has(p.id));
  const shown = useMemo(() => (onlyUnrated ? players.filter(p => !ratings.has(p.id)) : players), [onlyUnrated, players, ratings]);
  const rated = players.length - unrated.length;

  // Saves go out one after another (a player's later tap always lands last), and a failed save puts back only the
  // players whose latest tap it was — never over a newer one (/review 2026-10-25).
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(new Map<string, number>());
  const seq = useRef(0);
  function rate(ids: readonly string[], rating: number | null) {
    setError(null);
    const mine = ++seq.current;
    const before = ids.map(id => [id, ratings.get(id) ?? null] as const);
    for (const id of ids) latest.current.set(id, mine);
    onRated(ids, rating);
    queue.current = queue.current.then(async () => {
      const r = await send(routes.ratings, 'PUT', { registrationIds: ids, rating });
      if (r.ok) return;
      for (const [id, was] of before) if (latest.current.get(id) === mine) onRated([id], was);
      setError(W.rate.err);
    });
  }
  const tap = (p: BoardPlayer, n: number) => rate([p.id], ratings.get(p.id) === n ? null : n);

  function keyed(e: React.KeyboardEvent, p: BoardPlayer, index: number) {
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 5) return;
    e.preventDefault();
    tap(p, n);
    const next = shown[index + 1];
    if (next) rows.current.get(next.id)?.focus();
  }

  const seg = (p: BoardPlayer, big: boolean) => (
    <div className={`${css.seg}${big ? ` ${css.segBig}` : ''}`} role="group" aria-label={`${p.firstName} ${p.lastName}`}>
      {NUMBERS.map(n => (
        <button
          key={n}
          type="button"
          className={css.segBtn}
          aria-pressed={ratings.get(p.id) === n}
          aria-label={W.rate.aria(`${p.firstName} ${p.lastName}`, n)}
          onClick={() => tap(p, n)}
        >{n}</button>
      ))}
    </div>
  );

  const filters = (
    <div className={css.filters}>
      <button type="button" className={css.filterChip} aria-pressed={!onlyUnrated} onClick={() => setOnlyUnrated(false)}>{W.rate.all(players.length)}</button>
      <button type="button" className={css.filterChip} aria-pressed={onlyUnrated} onClick={() => setOnlyUnrated(true)}>
        {W.rate.unrated}
        {unrated.length > 0 && <span className={frame.count} style={{ marginLeft: '0.4rem' }}>{unrated.length}</span>}
      </button>
    </div>
  );

  const allPicked = shown.length > 0 && shown.every(p => picked.has(p.id));
  return (
    <KitDialog
      kind="form"
      title={W.rate.title(division)}
      onClose={onClose}
      size="wide"
      footerStart={<span>{W.rate.foot(rated, players.length)}</span>}
      footer={<button type="button" className="btn btn-lime" onClick={onClose}>{W.rate.done}</button>}
    >
      <p className={ck.hint}>{W.rate.intro}</p>
      {players.length === 0 ? <p className={ck.hint}>{W.rate.empty}</p> : (
        <>
          {filters}
          {error && <p className={css.error} role="alert">{error}</p>}
          {!isPhone && picked.size > 0 && (
            <div className={css.bulk}>
              <span>{W.rate.selected(picked.size)}</span>
              <span className={css.bulkSpacer} />
              <span>{W.rate.rateThem}</span>
              <div className={css.seg} role="group" aria-label={W.rate.rateThem}>
                {NUMBERS.map(n => (
                  <button key={n} type="button" className={css.segBtn} aria-label={W.rate.bulkAria(n)}
                    onClick={() => { rate([...picked], n); setPicked(new Set()); }}>{n}</button>
                ))}
              </div>
            </div>
          )}
          {isPhone ? (
            <div className={css.rateRows}>
              {shown.map((p, i) => (
                <div key={p.id} className={css.rateRow} tabIndex={-1} ref={el => { if (el) rows.current.set(p.id, el); }} onKeyDown={e => keyed(e, p, i)}>
                  <div className={css.kidName}>{p.firstName} {p.lastName}</div>
                  <div className={css.kidSub}>{W.kid.age(p.age)}{!ratings.has(p.id) ? ` · ${W.rate.unrated.toLowerCase()}` : ''}</div>
                  {seg(p, true)}
                </div>
              ))}
            </div>
          ) : (
            <div className={ck.tableFrame}>
              <table className={ck.table}>
                <thead>
                  <tr>
                    <th scope="col" className={css.tickCell}>
                      <input type="checkbox" aria-label={W.rate.selectAll} checked={allPicked}
                        onChange={() => setPicked(allPicked ? new Set() : new Set(shown.map(p => p.id)))} />
                    </th>
                    <th scope="col">{W.rate.colPlayer}</th>
                    <th scope="col">{W.rate.colAge}</th>
                    <th scope="col">{W.rate.colRating}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => (
                    <tr key={p.id} tabIndex={0} ref={el => { if (el) rows.current.set(p.id, el); }} onKeyDown={e => keyed(e, p, i)} className={css.rateTr}>
                      <td className={css.tickCell}>
                        <input type="checkbox" aria-label={W.rate.select(`${p.firstName} ${p.lastName}`)} checked={picked.has(p.id)}
                          onChange={() => setPicked(prev => { const next = new Set(prev); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })} />
                      </td>
                      <td data-label={W.rate.colPlayer}>
                        <span className={css.kidName}>{p.firstName} {p.lastName}</span>
                        {!ratings.has(p.id) && <span className={css.kidSub}> · {W.rate.unrated.toLowerCase()}</span>}
                      </td>
                      <td data-label={W.rate.colAge}>{p.age ?? '—'}</td>
                      <td data-label={W.rate.colRating}>{seg(p, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isPhone && <p className={ck.hint}>{W.rate.hint}</p>}
        </>
      )}
    </KitDialog>
  );
}
