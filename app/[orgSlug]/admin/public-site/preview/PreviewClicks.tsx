'use client';
/**
 * CLICK THE PREVIEW TO EDIT (Public site builder A9, ruled 2026-10-21: in the first build).
 *
 * Inside the editor's frame only: every click is caught before the page acts on it — no link is followed, no form sent,
 * no Follow — and the part clicked names the editor row that sets it (`data-site-edit` on the club's bar, sections,
 * notice and footer). The row's name goes to the editor, which opens that row. Pointing at a part outlines it in the
 * club's own ink with the row's name, so the club sees what a click will open before it clicks.
 *
 * Opened on its own (not framed) it changes nothing: an ordinary preview whose links work.
 */
import { useEffect, useState } from 'react';
import { PREVIEW_MESSAGE, SITE_EDIT_ROWS } from '@/lib/public-site-builder';
import { isSiteEditRow, type SiteEditRow } from '@/lib/site-edit-marks';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';

export default function PreviewClicks() {
  const [hover, setHover] = useState<{ row: SiteEditRow; top: number; left: number } | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const origin = window.location.origin;
    const tell = (data: Record<string, unknown>) => window.parent.postMessage({ type: PREVIEW_MESSAGE, ...data }, origin);
    const zoneOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-site-edit]') : null);
    const rowOf = (z: HTMLElement | null): SiteEditRow | null => {
      const v = z?.dataset.siteEdit;
      return isSiteEditRow(v) ? v : null;
    };

    let marked: HTMLElement | null = null;
    const mark = (z: HTMLElement | null) => {
      if (z === marked) return;
      marked?.removeAttribute('data-site-edit-hover');
      marked = z;
      const row = rowOf(z);
      if (!z || !row) { setHover(null); return; }
      z.setAttribute('data-site-edit-hover', '');
      const r = z.getBoundingClientRect();
      setHover({ row, top: Math.max(4, r.top + 4), left: Math.max(4, r.left + 4) });
    };

    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const row = rowOf(zoneOf(e.target));
      if (row) tell({ edit: row });
    };
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const onOver = (e: MouseEvent) => mark(zoneOf(e.target));
    const clear = () => mark(null);

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', stop, true);
    document.addEventListener('auxclick', stop, true);
    document.addEventListener('mouseover', onOver, true);
    document.documentElement.addEventListener('mouseleave', clear);
    window.addEventListener('scroll', clear, { passive: true });
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', stop, true);
      document.removeEventListener('auxclick', stop, true);
      document.removeEventListener('mouseover', onOver, true);
      document.documentElement.removeEventListener('mouseleave', clear);
      window.removeEventListener('scroll', clear);
      marked?.removeAttribute('data-site-edit-hover');
    };
  }, []);

  return (
    <>
      {/* The outline and the label wear the club's own colours (the org layout writes them on :root, admin included). */}
      <style>{`
        [data-site-edit-hover] { outline: 2px dashed var(--club-ink); outline-offset: 2px; cursor: pointer; }
        [data-site-edit-hover] * { cursor: pointer; }
      `}</style>
      {hover && (
        <span
          aria-hidden
          style={{
            position: 'fixed', top: hover.top, left: hover.left, zIndex: 50, pointerEvents: 'none',
            background: 'var(--club-fill)', color: 'var(--club-on-fill)', borderRadius: 999,
            padding: '4px 10px', font: '600 12px/1.2 var(--font-inter, Inter, system-ui, sans-serif)',
            boxShadow: 'var(--home-shadow)',
          }}
        >
          {W.previewEditIn(SITE_EDIT_ROWS[hover.row])}
        </span>
      )}
    </>
  );
}
