'use client';
/**
 * FIND A CHILD OR A PARENT, on House league's home above "Running now" (Club Tier Stage 13e-4 A, 13e-1 A; drawing tab 3).
 * The words, the match, the owing and the next line are lib/house-league-find.ts's; the read is
 * /api/admin/house-league/find, gated as Registrations is. While it reads, the last answer stays under the field (nothing
 * jumps); a miss offers "Search past seasons too". Each row is one target that opens the registration.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import { FIND_MIN, FIND_WORDS as W, type FindRow } from '@/lib/house-league-find';
import s from './FindChild.module.css';

type Answer = { q: string; past: boolean; all: boolean; rows: FindRow[]; total: number };

export default function FindChild({ orgSlug }: { orgSlug: string }) {
  const [query, setQuery] = useState('');
  const [past, setPast] = useState(false);
  const [all, setAll] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  const q = query.trim();
  const asks = q.length >= FIND_MIN;

  useEffect(() => {
    if (!asks || !orgSlug) return;
    const ticket = ++latest.current;
    const ctrl = new AbortController();
    // A short pause while typing: one read per word, not one per letter.
    const wait = setTimeout(async () => {
      setReading(true);
      try {
        const params = new URLSearchParams({ orgSlug, q });
        if (past) params.set('past', '1');
        if (all) params.set('all', '1');
        const res = await fetch(`/api/admin/house-league/find?${params}`, { signal: ctrl.signal, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        // An abort that lands while the body streams is swallowed above — never let it read as "no match".
        if (ctrl.signal.aborted || ticket !== latest.current) return;
        if (!res.ok) throw new Error(data.error ?? 'search failed');
        setAnswer({ q, past, all, rows: data.rows ?? [], total: data.total ?? 0 });
        setFailed(false);
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ticket !== latest.current) return;
        setFailed(true);
      } finally {
        if (ticket === latest.current) setReading(false);
      }
    }, 250);
    return () => { clearTimeout(wait); ctrl.abort(); };
  }, [q, asks, past, all, orgSlug, attempt]);

  const onType = (v: string) => {
    setQuery(v);
    const next = v.trim();
    // A new name is a new question: it starts on the first eight again (a space typed after it is not a new name).
    if (next !== q) setAll(false);
    // Too short to ask: whatever was reading is no longer the question (its answer is dropped, "Looking…" goes).
    if (next.length < FIND_MIN) { latest.current += 1; setReading(false); }
    if (!next) { setPast(false); setAnswer(null); setFailed(false); }
  };

  const shown = asks ? answer : null;
  const href = (r: FindRow) => `/${orgSlug}/admin/house-league/seasons/${r.seasonId}/registrations?reg=${r.id}`;

  return (
    <section className={s.find} aria-label={W.label}>
      <div className={s.field}>
        <Search size={16} aria-hidden className={s.icon} />
        <input
          type="search"
          className={s.input}
          value={query}
          onChange={e => onType(e.target.value)}
          placeholder={W.label}
          aria-label={W.label}
          autoComplete="off"
          spellCheck={false}
        />
        {/* "Looking…" takes the scope's place on the field's own line, so nothing under the field moves while it reads. */}
        <span className={s.scope} aria-hidden>{asks && reading ? W.reading : past ? W.scopePast : W.scope}</span>
      </div>

      {/* Always in the page (an announcement into a region that only just appeared is often not read out). */}
      <p className={s.srOnly} role="status" aria-live="polite">
        {asks && reading ? W.reading : ''}
      </p>

      {asks && failed && (
        <p className={s.miss}>
          {W.failed}{' '}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{W.retry}</button>
        </p>
      )}

      {/* While the next read is out, the last answer stays where it is, dimmed (a miss as much as the rows): nothing jumps. */}
      {shown && !failed && shown.rows.length === 0 && (
        <p className={s.miss} aria-busy={reading || undefined}>
          {shown.past ? W.missPast(shown.q) : W.miss(shown.q)}
          {!shown.past && (
            <> <button type="button" className="btn btn-outline btn-sm" onClick={() => setPast(true)}>{W.searchPast}</button></>
          )}
        </p>
      )}

      {shown && !failed && shown.rows.length > 0 && (
        <ul className={s.rows} aria-busy={reading || undefined}>
          {shown.rows.map(r => (
            <li key={r.id}>
              <Link href={href(r)} className={s.row} aria-label={W.rowAria(r.child)}>
                <span className={s.main}>
                  <span className={s.name}>{r.child}</span>
                  <span className={s.facts}>{[r.division, r.team ?? W.noTeam, r.season].filter(Boolean).join(' · ')}</span>
                  <span className={s.facts}>{[r.guardian, r.email].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={s.state}>
                  <span className={s.place}>{r.status}</span>
                  {r.money && <span className={s.money}>{r.money}</span>}
                </span>
                <ChevronRight size={16} aria-hidden className={s.chevron} />
                {r.next && <span className={s.next}>{r.next}</span>}
              </Link>
            </li>
          ))}
          {shown.total > shown.rows.length && (
            <li>
              {shown.all
                ? <p className={s.capped}>{W.capped(shown.rows.length, shown.total)}</p>
                : <button type="button" className={s.showAll} onClick={() => setAll(true)}>{W.showAll(shown.total)}</button>}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
