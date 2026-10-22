'use client';
/**
 * THE PREVIEW — the club's home as families see it, beside the rows (Public site builder A1, A2, A9; ruled 2026-10-21).
 *
 * The page itself is the editor's own preview address (./preview/page.tsx: the real frame and sections, for the owner and
 * admins only, offline included), drawn here in a frame at a computer's width (1280) or a phone's (390) so the club's own
 * breakpoints decide its layout, then scaled to fit. After each save the page is fetched again BEHIND the one showing and
 * swapped in once it has drawn, scrolled to where the club was — no white flash, no jump to the top.
 *
 * A click inside names the row that sets the part clicked; the frame's message is believed only from this origin and from
 * one of these frames.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Lock, Monitor, Smartphone } from 'lucide-react';
import { PREVIEW_MESSAGE } from '@/lib/public-site-builder';
import { isSiteEditRow, type SiteEditRow } from '@/lib/site-edit-marks';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import styles from './public-site.module.css';

type Device = 'desk' | 'phone';
const WIDTH: Record<Device, number> = { desk: 1280, phone: 390 };
const PHONE_HEIGHT = 844;

export default function SitePreview({ orgSlug, version, online, onEdit, startOn = 'desk' }: {
  orgSlug: string;
  /** Bumped after every save: the preview is fetched again. */
  version: number;
  online: boolean;
  onEdit: (row: SiteEditRow) => void;
  startOn?: Device;
}) {
  const [device, setDevice] = useState<Device>(startOn);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frameRefs = useRef(new Map<number, HTMLIFrameElement>());
  // The frame showing, and the one loading behind it.
  const [frames, setFrames] = useState<{ id: number; shown: boolean }[]>([{ id: version, shown: false }]);
  const shownId = frames.find(f => f.shown)?.id ?? null;

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      setSize(s => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new version loads behind the one showing (the newest wins; an older one still loading is dropped).
  const [lastVersion, setLastVersion] = useState(version);
  if (version !== lastVersion) {
    setLastVersion(version);
    setFrames(fs => [...fs.filter(f => f.shown), { id: version, shown: false }]);
  }

  const loaded = useCallback((id: number) => {
    const old = shownId != null ? frameRefs.current.get(shownId) : undefined;
    const fresh = frameRefs.current.get(id);
    try {
      const y = old?.contentWindow?.scrollY ?? 0;
      if (y) fresh?.contentWindow?.scrollTo(0, y);
    } catch { /* same origin always; a refusal only loses the scroll */ }
    setFrames(fs => fs.some(f => f.id === id) ? [{ id, shown: true }] : fs);
  }, [shownId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; edit?: string } | null;
      if (!d || d.type !== PREVIEW_MESSAGE || !isSiteEditRow(d.edit)) return;
      const ours = [...frameRefs.current.values()].some(f => f.contentWindow === e.source);
      if (ours) onEdit(d.edit);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onEdit]);

  const width = WIDTH[device];
  const scale = device === 'desk'
    ? (size.w ? size.w / width : 0)
    : (size.w ? Math.min(1, (size.h - 24) / PHONE_HEIGHT, (size.w - 24) / width) : 0);
  const height = device === 'desk' ? (scale ? size.h / scale : 0) : PHONE_HEIGHT;

  return (
    <div className={styles.preview}>
      <div className={styles.previewHead}>
        <span className={styles.previewTitle}>{W.preview}</span>
        <div className={styles.viewPill} role="group" aria-label={W.preview}>
          <button type="button" aria-pressed={device === 'desk'} onClick={() => setDevice('desk')}>
            <Monitor size={13} aria-hidden /> {W.previewComputer}
          </button>
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>
            <Smartphone size={13} aria-hidden /> {W.previewPhone}
          </button>
        </div>
      </div>
      {!online && <p className={styles.previewOffline}><Lock size={13} aria-hidden /> {W.previewOffline}</p>}
      <div ref={stage} className={`${styles.previewStage} ${device === 'phone' ? styles.previewStagePhone : ''}`}>
        {shownId == null && <p className={styles.previewLoading}>{W.previewLoading}</p>}
        {scale > 0 && (
          <div className={device === 'phone' ? styles.previewPhoneBox : styles.previewDeskBox}
            style={{ width: width * scale, height: height * scale }}>
            {frames.map(f => (
              <iframe
                key={f.id}
                ref={el => { if (el) frameRefs.current.set(f.id, el); else frameRefs.current.delete(f.id); }}
                src={`/${orgSlug}/admin/public-site/preview?v=${f.id}`}
                title={W.previewFrameTitle}
                className={styles.previewFrame}
                tabIndex={f.shown ? 0 : -1}
                aria-hidden={f.shown ? undefined : true}
                onLoad={() => loaded(f.id)}
                style={{ width, height, transform: `scale(${scale})`, visibility: f.shown ? 'visible' : 'hidden' }}
              />
            ))}
          </div>
        )}
      </div>
      <p className={styles.previewFoot}>{W.previewFoot}</p>
    </div>
  );
}
