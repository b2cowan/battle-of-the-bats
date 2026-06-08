'use client';

/**
 * BracketConnectors (C2) — measured SVG tree lines over a bracket canvas.
 *
 * Each matchup references its sources by label ("Winner QF1" / "Loser SF2"), so we
 * map target → source by code, then measure the live card positions (querying
 * [data-matchup-id] inside the canvas) and draw a bezier from each source's right
 * edge to its target's left edge. Recomputes on data change (version) and on
 * layout change (ResizeObserver + window resize). Desktop only — hidden on the
 * mobile round-carousel via CSS. Decorative: pointer-events none, behind the cards.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './BracketBuilder.module.css';

type ConnMatchup = { id: string; code: string; home: { label: string }; away: { label: string } };

export default function BracketConnectors({
  canvasRef,
  matchups,
  finalIds,
  scale = 1,
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  matchups: ConnMatchup[];
  finalIds: Set<string>;
  /** Current zoom factor of an ancestor (CSS `zoom`). Measurements are divided by
   *  it so connector coords stay in the bracket's NATURAL space — the SVG then
   *  scales with the zoomed wrapper exactly like the cards, staying aligned. */
  scale?: number;
}) {
  const [paths, setPaths] = useState<Array<{ d: string; final: boolean; kind: 'winner' | 'loser' }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const version = useMemo(
    () => matchups.map(m => `${m.id}|${m.code}|${m.home.label}|${m.away.label}`).join(';'),
    [matchups],
  );

  // Latest data for the observer callback without re-subscribing every render.
  const dataRef = useRef({ matchups, finalIds, scale });
  useEffect(() => { dataRef.current = { matchups, finalIds, scale }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const recompute = () => {
      const { matchups: ms, finalIds: fids, scale } = dataRef.current;
      const sc = scale || 1;

      const byCode = new Map<string, string>();
      ms.forEach(m => { if (m.code) byCode.set(m.code.trim().toLowerCase(), m.id); });

      // Capture whether each link carries the WINNER (advance) or the LOSER
      // (drop to the losers bracket) of the source game, so the line can be
      // coloured by path. "Winner QF1" → winner path, "Loser SF2" → loser path.
      const links: Array<{ from: string; to: string; kind: 'winner' | 'loser' }> = [];
      ms.forEach(target => {
        [target.home.label, target.away.label].forEach(label => {
          const matched = /^(winner|loser)\s+(.+)$/i.exec((label ?? '').trim());
          if (!matched) return;
          const kind = matched[1].toLowerCase() as 'winner' | 'loser';
          const fromId = byCode.get(matched[2].trim().toLowerCase());
          if (fromId && fromId !== target.id) links.push({ from: fromId, to: target.id, kind });
        });
      });

      const cRect = canvas.getBoundingClientRect();
      const pos = new Map<string, { l: number; t: number; w: number; h: number }>();
      canvas.querySelectorAll<HTMLElement>('[data-matchup-id]').forEach(el => {
        const id = el.dataset.matchupId;
        if (!id) return;
        const r = el.getBoundingClientRect();
        pos.set(id, { l: (r.left - cRect.left) / sc, t: (r.top - cRect.top) / sc, w: r.width / sc, h: r.height / sc });
      });

      const next: Array<{ d: string; final: boolean; kind: 'winner' | 'loser' }> = [];
      links.forEach(({ from, to, kind }) => {
        const s = pos.get(from);
        const t = pos.get(to);
        if (!s || !t) return;
        const sx = s.l + s.w;
        const sy = s.t + s.h / 2;
        const tx = t.l;
        const ty = t.t + t.h / 2;
        const dx = Math.max(14, (tx - sx) / 2);
        next.push({ d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`, final: fids.has(to), kind });
      });

      setPaths(next);
      setSize({ w: cRect.width / sc, h: cRect.height / sc });
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(canvas);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [canvasRef, version, scale]);

  if (paths.length === 0) return null;

  return (
    <svg className={styles.connectors} width={size.w} height={size.h} aria-hidden>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          className={`${p.kind === 'loser' ? styles.connectorLoss : styles.connectorWin}${p.final ? ` ${styles.connectorFinal}` : ''}`}
        />
      ))}
    </svg>
  );
}
