'use client';
import { useEffect } from 'react';

/** Keeps --vvh / --vv-offset-top in sync with window.visualViewport so fixed,
 * keyboard-adjacent layouts (e.g. mobile chat) can size themselves to what's
 * actually visible above the on-screen keyboard, independent of a browser's
 * own viewport-resize behaviour (Safari never honours the `interactive-widget`
 * viewport hint, so this is the cross-browser fallback for it). */
export function useVisualViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      document.documentElement.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}
