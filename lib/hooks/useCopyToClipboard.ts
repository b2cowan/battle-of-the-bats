'use client';
/**
 * lib/hooks/useCopyToClipboard.ts — copy a string, and say "Copied" for a moment (Club Tier Stage 6d: the Subscribe
 * window's Copy and the public team page's Copy the link — two skins, one behaviour).
 *
 * The moment is the feedback, so nothing stays: `copied` is true for `forMs`, then false. A browser that refuses the
 * clipboard (an insecure origin, an old WebView) falls back to the selection copy, so the button never does nothing.
 */
import { useCallback, useEffect, useState } from 'react';

export function useCopyToClipboard(forMs = 2000): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), forMs);
    return () => clearTimeout(t);
  }, [copied, forMs]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
  }, []);

  return { copied, copy };
}
