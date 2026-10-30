'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Minus, Plus, Maximize, X } from 'lucide-react';
import { publicBracketGameLabel, publicBracketRounds } from '@/lib/public-playoffs';
import { publicGameDetailView } from '@/lib/public-game-detail';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { useOrgHref } from '@/lib/use-public-pathname';
import type { Game, PublicTeam, Venue } from '@/lib/types';
import styles from './PublicBracket.module.css';

/** Frame-only presentation of the canonical bracket columns. It never seeds, advances or computes a bracket. */
export default function PublicBracket({ games, teams, venues, orgSlug, tournamentSlug, requireFinalization, now }: {
  games: Game[]; teams: PublicTeam[]; venues: Venue[]; orgSlug: string; tournamentSlug: string;
  requireFinalization: boolean; now: Date;
}) {
  const orgHref = useOrgHref(orgSlug);
  const rounds = publicBracketRounds(games);
  const large = rounds.length > 2 || rounds.some(round => round.games.length > 2);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [connectors, setConnectors] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const boxes = new Map([...element.querySelectorAll<HTMLElement>('[data-bracket-game]')]
        .map(node => [node.dataset.bracketGame, node.getBoundingClientRect()] as const));
      const paths = games.flatMap(game => {
        const target = boxes.get(game.id);
        if (!target) return [];
        return [game.homePlaceholder, game.awayPlaceholder].flatMap(placeholder => {
          const code = /^(?:Winner|Loser)\s+(?:of\s+)?(.+)$/i.exec(placeholder?.trim() ?? '')?.[1].toUpperCase();
          const source = code ? games.find(candidate => candidate.bracketCode?.toUpperCase() === code) : null;
          const from = source ? boxes.get(source.id) : null;
          if (!from) return [];
          const x1 = (from.right - bounds.left) / bounds.width * 100;
          const y1 = (from.top + from.height / 2 - bounds.top) / bounds.height * 100;
          const x2 = (target.left - bounds.left) / bounds.width * 100;
          const y2 = (target.top + target.height / 2 - bounds.top) / bounds.height * 100;
          const mid = (x1 + x2) / 2;
          return [`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`];
        });
      });
      setConnectors(previous => JSON.stringify(previous) === JSON.stringify(paths) ? previous : paths);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    return () => observer.disconnect();
  }, [games, teams, zoom, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const originalFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key !== 'Tab') return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); originalFocus?.focus(); };
  }, [expanded]);

  return <div ref={root} className={styles.bracket} data-expanded={expanded || undefined}
    role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? 'Playoff bracket' : undefined}>
    {large && <div className={styles.tools} aria-label="Bracket controls">
      <button type="button" onClick={() => setZoom(value => Math.max(.1, value - .1))} aria-label="Zoom out"><Minus size={18} aria-hidden /></button>
      <button type="button" onClick={() => setZoom(1)} aria-label="Reset bracket zoom">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={() => setZoom(value => Math.min(1.5, value + .1))} aria-label="Zoom in"><Plus size={18} aria-hidden /></button>
      <button type="button" onClick={() => {
        if (!scroll.current || !board.current) return;
        const padding = getComputedStyle(scroll.current);
        const available = scroll.current.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
        setZoom(Math.min(1, available / board.current.scrollWidth));
      }} aria-label="Fit bracket"><Maximize size={18} aria-hidden /></button>
      <button type="button" ref={close} onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Close full screen' : 'Full screen'}>
        {expanded ? <X size={18} aria-hidden /> : 'Full screen'}
      </button>
    </div>}
    <div className={styles.scroller} ref={scroll}>
      <div className={styles.rounds} ref={board} data-large={large || undefined} style={{ zoom, '--public-bracket-zoom': zoom } as CSSProperties}>
        <svg className={styles.connectors} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {connectors.map((path, index) => <path key={index} d={path} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {rounds.map((round, index) => <section className={styles.round} key={`${round.rank}:${index}`} aria-label={round.title}>
          <h3>{round.title}</h3><div className={styles.games}>
            {round.games.map(game => {
              const view = publicGameDetailView(game, { games, teams, divisions: [], venues, requireFinalization, now });
              const final = view.state === 'final' || view.state === 'unofficial';
              return <Link key={game.id} href={orgHref(`/${tournamentSlug}/schedule/${game.id}`)} className={styles.match}
                data-state={view.state} data-bracket-game={game.id}>
                <span className={styles.matchHead}>{publicBracketGameLabel(game) || 'Playoff game'}
                  {view.stateLabel && <b>{view.stateLabel}</b>}{view.cancelled && <b>Cancelled</b>}
                </span>
                {view.sides.map((side, i) => <span key={i} className={styles.team} data-trailing={side.trailing || undefined}
                  data-winner={final && view.sides.some(s => s.trailing) && !side.trailing || undefined}>
                  <span>{side.name}</span>{side.score != null && <b>{side.score}</b>}
                </span>)}
                {view.live && view.noScore ? <span className={styles.meta}>{view.noScore}</span>
                  : !final && !view.cancelled && <span className={styles.meta}>{game.date ? formatShortWeekdayDate(game.date) : 'Date TBD'} · {view.time}</span>}
              </Link>;
            })}
          </div>
        </section>)}
      </div>
    </div>
  </div>;
}
