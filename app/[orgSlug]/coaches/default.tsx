import { notFound } from 'next/navigation';

/**
 * The coaches layout's own pages (its implicit `children` slot) beside the `@stripFacts` slot (navigation Phase 4): Next
 * renders this only when it cannot recover the page for an address, which is a 404 as it was before the slot existed.
 */
export default function CoachesDefault() {
  notFound();
}
