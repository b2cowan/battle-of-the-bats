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
}: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  matchups: ConnMatchup[];
  finalIds: Set<string>;
}) {
  const [paths, setPaths] = useState<Array<{ d: string; final: boolean }>>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const version = useMemo(
    () => matchups.map(m => `${m.id}|${m.code}|${m.home.label}|${m.away.label}`).join(';'),
    [matchups],
  );

  // Latest data for the observer callback without re-subscribing every render.
  const dataRef = useRef({ matchups, finalIds });
  dataRef.current = { matchups, finalIds };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const recompute = () => {
      const { matchups: ms, finalIds: fids } = dataRef.current;

      const byCode = new Map<string, string>();
      ms.forEach(m => { if (m.code) byCode.set(m.code.trim().toLowerCase(), m.id); });

      const links: Array<{ from: string; to: string }> = [];
      ms.forEach(target => {
        [target.home.label, target.away.label].forEach(label => {
          const matched = /^(?:winner|loser)\s+(.+)$/i.exec((label ?? '').trim());
          if (!matched) return;
          const fromId = byCode.get(matched[1].trim().toLowerCase());
          if (fromId && fromId !== target.id) links.push({ from: fromId, to: target.id });
        });
      });

      const cRect = canvas.getBoundingClientRect();
      const pos = new Map<string, { l: number; t: number; w: number; h: number }>();
      canvas.querySelectorAll<HTMLElement>('[data-matchup-id]').forEach(el => {
        const id = el.dataset.matchupId;
        if (!id) return;
        const r = el.getBoundingClientRect();
        pos.set(id, { l: r.left - cRect.left, t: r.top - cRect.top, w: r.width, h: r.height });
      });

      const next: Array<{ d: string; final: boolean }> = [];
      links.forEach(({ from, to }) => {
        const s = pos.get(from);
        const t = pos.get(to);
        if (!s || !t) return;
        const sx = s.l + s.w;
        const sy = s.t + s.h / 2;
        const tx = t.l;
        const ty = t.t + t.h / 2;
        const dx = Math.max(14, (tx - sx) / 2);
        next.push({ d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`, final: fids.has(to) });
      });

      setPaths(next);
      setSize({ w: canvas.scrollWidth, h: canvas.scrollHeight });
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(canvas);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, version]);

  if (paths.length === 0) return null;

  return (
    <svg className={styles.connectors} width={size.w} height={size.h} aria-hidden>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" className={p.final ? styles.connectorFinal : styles.connector} />
      ))}
    </svg>
  );
}
