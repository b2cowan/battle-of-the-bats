'use client';

/**
 * Scroll to a help FAQ by id and open it — the <details> is otherwise
 * uncontrolled so the reader can freely toggle it without a re-render snapping
 * it shut.
 *
 * Used by HelpPageLayout when a deep link or a search result names a question:
 * the guide selects the article that owns it, then this brings the question into
 * view already open.
 *
 * (Until 2026-08-14 this also drove the guide's jump chips and sub-heading
 * anchors, which is what `followHashLink` existed for. Under the article model a
 * hash SELECTS an article rather than scrolling within a long page, so there is
 * nothing left to intercept and the helper went with the chips.)
 */
export function revealAndScroll(id: string, opts?: { faq?: boolean }) {
  const el = document.getElementById(id);
  if (!el) return;
  if (opts?.faq && el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
