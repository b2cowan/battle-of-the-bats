'use client';
/**
 * A PHONE WINDOW — a shipped component drawn at a phone's width on any screen (Public tournament pages Stage 1a Part 3,
 * the Look card's band preview, drawing ask 3: "the shipped band component, never a drawing of it").
 *
 * WHY A WINDOW AND NOT A BOX. The band's phone shape (the tab row under it, the accent rule between) is written in
 * `@media (max-width: 900px)` rules, and a media query reads the WINDOW's width, not its box's: dropped into a box on a
 * desk, the real band draws its desk shape, which is not what a family on a phone sees. So the children render (through
 * a portal — same React tree, same router and contexts) into a same-origin frame of their own, whose window IS the
 * phone's width: every one of the band's own rules applies as on a phone, with no copy of them here.
 *
 * The frame carries the page's stylesheets (mirrored as the page gains them) and its font variables; it is inert (no
 * focus, no clicks, nothing for a screen reader — the caption beside it says what it shows), sized to its content, and
 * never wider than its column, so it cannot make a 360 px page scroll sideways.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import css from './PhoneWindow.module.css';

/** The font variables next/font sets on the page's wrappers; the frame's document has none of those wrappers. */
const FONT_VARS = ['--font-sans', '--font-display', '--font-mono', '--font-inter', '--font-barlow', '--font-dm-serif', '--font-dm-sans'];
const ROOT_ID = 'phone-window-root';
const SHELL = `<!doctype html><html><head></head><body><div id="${ROOT_ID}"></div></body></html>`;
const MIRRORED = 'data-phone-window-mirror';

/** Copy the page's stylesheets into the frame's head, replacing the last copy. */
function mirrorStyles(from: Document, to: Document) {
  to.head.querySelectorAll(`[${MIRRORED}]`).forEach(n => n.remove());
  from.head.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute(MIRRORED, '');
    to.head.appendChild(copy);
  });
}

export default function PhoneWindow({ title, width = 390, children }: { title: string; width?: number; children: ReactNode }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: MutationObserver | null = null;
    let mounted: HTMLElement | null = null;
    // The frame's first document is a blank one the browser swaps for the shell; mount only into the shell's own root.
    const start = () => {
      const doc = frame.contentDocument;
      const el = doc?.getElementById(ROOT_ID);
      if (!doc || !el || el === mounted) return;
      mounted = el;
      mirrorStyles(document, doc);
      const page = getComputedStyle(frame);
      for (const name of FONT_VARS) {
        const value = page.getPropertyValue(name);
        if (value) doc.documentElement.style.setProperty(name, value);
      }
      doc.documentElement.style.background = 'transparent';
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.margin = '0';
      doc.body.style.background = 'transparent';
      doc.body.style.minHeight = '0';
      observer?.disconnect();
      observer = new MutationObserver(() => mirrorStyles(document, doc));
      observer.observe(document.head, { childList: true });
      setRoot(el);
    };
    start();
    frame.addEventListener('load', start);
    return () => { frame.removeEventListener('load', start); observer?.disconnect(); };
  }, []);

  // The frame is as tall as what it holds, measured in the frame's own window.
  useEffect(() => {
    const view = root?.ownerDocument.defaultView;
    if (!root || !view) return;
    const measure = () => setHeight(Math.ceil(root.getBoundingClientRect().height));
    measure();
    const ro = new view.ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [root]);

  return (
    <>
      <iframe ref={frameRef} srcDoc={SHELL} className={css.window} style={{ maxWidth: width, height }}
        tabIndex={-1} aria-hidden inert title={title} />
      {root && createPortal(children, root)}
    </>
  );
}
