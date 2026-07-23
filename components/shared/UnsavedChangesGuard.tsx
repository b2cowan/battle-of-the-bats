'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedbackModal from '@/components/FeedbackModal';

/**
 * Warns before leaving a form with unsaved changes — covers BOTH:
 *  • tab close / refresh / external navigation (native beforeunload prompt), and
 *  • in-app navigation (sidebar, bottom nav, in-page links, the FlipPill) via a capture-phase click
 *    interceptor that beats Next's <Link> handler and shows a confirm modal.
 *
 * Copy is parameterized so any shell can reuse it. Drop
 *   <UnsavedChangesGuard active={isDirty} message="…" />
 * into any edit screen. Same-tab flips (The Flip) can now navigate away from dirty forms that the old
 * new-tab "View Site" behavior accidentally protected — this closes that gap.
 */
export default function UnsavedChangesGuard({
  active,
  message = 'You have unsaved changes. Leave without saving them?',
}: {
  active: boolean;
  message?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  // Tab close / refresh / external navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);

  // In-app link clicks (capture phase, so we intercept before Next's <Link>).
  // Only attached while there are unsaved changes.
  useEffect(() => {
    if (!active) return;
    function onClick(e: MouseEvent) {
      // Let modified clicks (new tab, etc.) and non-primary buttons through
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return; // external
      // Same page (e.g. an in-page anchor) — nothing to guard
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  return (
    <FeedbackModal
      isOpen={!!pending}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const href = pending;
        setPending(null);
        if (href) router.push(href);
      }}
      title="Unsaved changes"
      message={message}
      confirmText="Leave without saving"
      cancelText="Stay on this page"
      type="danger"
    />
  );
}
