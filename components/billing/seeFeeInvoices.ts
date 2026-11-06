/**
 * Takes the owner to the fee invoices list on Plan & billing (which has a Pay invoice on each invoice) and moves keyboard focus to
 * its heading. Shared by the page line and the pinned banner (Fee invoice alerts Parts 3–4), and kept free of any stylesheet so the
 * banner, which rides every club admin page, never drags billing's CSS in with it.
 * Returns false when this page has no list (the banner on another page then links to Plan & billing instead).
 */
export function seeFeeInvoices(): boolean {
  const heading = document.getElementById('billing-stripe-fees');
  if (!heading) return false;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  heading.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
  return true;
}
