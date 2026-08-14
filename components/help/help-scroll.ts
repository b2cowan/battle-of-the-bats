'use client';

/**
 * Scroll to a help anchor (section, sub-topic, or FAQ) by id. For an FAQ, open
 * its <details> imperatively — the <details> is otherwise uncontrolled so the
 * reader can freely toggle it without a re-render snapping it shut.
 *
 * Shared by HelpPageLayout (TOC, search results, hash deep-links) and
 * HelpSectionBlock (jump chips, sub-heading anchors) so every in-guide hash
 * control follows the same contract: intercept the click, replaceState the
 * hash (never push — Back should leave the page, not replay every jump), and
 * drive ONE smooth scroll from here rather than racing the browser's native
 * anchor scroll.
 */
export function revealAndScroll(id: string, opts?: { faq?: boolean }) {
  const el = document.getElementById(id);
  if (!el) return;
  if (opts?.faq && el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/** The shared click handler for an in-page `<a href="#id">` hash control. */
export function followHashLink(event: { preventDefault: () => void }, id: string, opts?: { faq?: boolean }) {
  event.preventDefault();
  window.history.replaceState(null, '', `#${id}`);
  revealAndScroll(id, opts);
}
