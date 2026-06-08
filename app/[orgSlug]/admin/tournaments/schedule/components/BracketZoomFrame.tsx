'use client';

/**
 * BracketZoomFrame — shared zoom + drag-pan shell for the HTML/CSS bracket views
 * (the editable BracketBuilder and the read-only admin bracket). Provides:
 *  - a pinned toolbar (drag hint + zoom HUD: − / % / + / Fit) that does NOT scroll
 *    with the bracket,
 *  - a horizontally-scrollable canvas with drag-to-pan (grab empty space),
 *  - CSS `zoom` on a content wrapper (reflows, so pan/scrollbar work at any level),
 *  - default-to-Fit (whole bracket visible, capped at 100%) on mount and whenever
 *    `fitKey` changes (a new bracket).
 *
 * Children is a render-prop receiving the current zoom, so the bracket content can
 * pass `scale={zoom}` to BracketConnectors (which divides measurements by it to
 * stay aligned under zoom). The public SVG bracket uses its own viewBox-native
 * zoom, NOT this frame.
 */
import { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Maximize, GripVertical } from 'lucide-react';
import styles from './BracketBuilder.module.css';

const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5];
const MIN_ZOOM = 0.4;

export default function BracketZoomFrame({ children, fitKey, hint = 'Drag empty space to scroll' }: {
  children: (zoom: number) => React.ReactNode;
  /** Changes when the bracket structure changes → re-fit. */
  fitKey?: string | number;
  hint?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bracketRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; left: number } | null>(null);
  const zoomRef = useRef(1);
  const didFitRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Drag-to-pan: grab any empty area to scroll left/right; ignored on cards/controls.
  const onPanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    if ((e.target as HTMLElement).closest('[data-matchup-id], button, input, select, textarea, a, [role="button"]')) return;
    panRef.current = { x: e.clientX, left: el.scrollLeft };
    setPanning(true);
  };
  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el || !panRef.current) return;
      el.scrollLeft = panRef.current.left - (e.clientX - panRef.current.x);
    };
    const onUp = () => { panRef.current = null; setPanning(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [panning]);

  // Fit = available width ÷ natural bracket width, capped at 100% (never balloons).
  const computeFit = (): number => {
    const outer = scrollRef.current;
    const inner = bracketRef.current;
    if (!outer || !inner) return 1;
    const naturalW = inner.getBoundingClientRect().width / (zoomRef.current || 1);
    const avail = outer.clientWidth - 16;
    if (naturalW <= 4 || avail <= 0) return 1;
    return Math.max(MIN_ZOOM, Math.min(1, avail / naturalW));
  };
  const stepZoom = (dir: 1 | -1) => setZoom(z => {
    if (dir === 1) return ZOOM_STEPS.find(s => s > z + 0.001) ?? z;
    const below = ZOOM_STEPS.filter(s => s < z - 0.001);
    return below.length ? below[below.length - 1] : Math.max(MIN_ZOOM, z);
  });

  // Default to Fit on mount and whenever the bracket changes.
  useEffect(() => { didFitRef.current = false; }, [fitKey]);
  useEffect(() => {
    if (didFitRef.current) return;
    didFitRef.current = true;
    setZoom(computeFit());
  }, [fitKey]);

  // Ctrl/⌘ + wheel zoom (scoped to the canvas; non-passive listener).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      stepZoom(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className={styles.builderWrap}>
      <div className={styles.canvasToolbar}>
        <span className={styles.panHint}>
          <GripVertical size={12} /> {hint}
        </span>
        <div className={styles.zoomHud}>
          <button type="button" className={styles.zoomBtn} onClick={() => stepZoom(-1)} title="Zoom out" aria-label="Zoom out"><Minus size={14} /></button>
          <button type="button" className={styles.zoomPct} onClick={() => setZoom(1)} title="Reset to 100%">{Math.round(zoom * 100)}%</button>
          <button type="button" className={styles.zoomBtn} onClick={() => stepZoom(1)} title="Zoom in" aria-label="Zoom in"><Plus size={14} /></button>
          <button type="button" className={styles.zoomBtn} onClick={() => setZoom(computeFit())} title="Fit bracket to screen" aria-label="Fit bracket to screen"><Maximize size={14} /></button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className={`${styles.builderContainer} ${styles.builderContainerPan} ${panning ? styles.builderContainerPanning : ''}`}
        onMouseDown={onPanStart}
      >
        <div ref={bracketRef} style={{ zoom, width: 'max-content', margin: '0 auto' }}>
          {children(zoom)}
        </div>
      </div>
    </div>
  );
}
