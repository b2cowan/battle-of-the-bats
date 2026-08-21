import { getWalkthroughRender } from '@/lib/pitch-deck-store';
import { walkthroughMetadata } from '@/lib/walkthrough-content';
import WalkthroughPage from '@/components/marketing/WalkthroughPage';

// The story lives in lib/walkthrough-content.ts; the rendering (scroll page, present mode,
// print leave-behind) lives in components/marketing/WalkthroughPage.tsx. This file is the route.
//
// ⚠ Dynamic since stage B: WHICH slides this page shows is the owner's saved pull
// (pitch_page_pulls), read per request through lib/pitch-pull-store.ts — one tiny keyed read
// with a hard timeout, and the code pull as the fallback, so the page renders correctly even
// with the store unreachable. `force-dynamic` also keeps the build from baking one composition
// in at deploy time, which would hold a save hostage to the next release.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { walkthrough, pull } = await getWalkthroughRender('coach');
  return walkthroughMetadata(walkthrough, pull);
}

export default async function CoachWalkthroughPage() {
  // The DECK is a saved row too since stage C — present mode renders it, and the pull is
  // already normalised against it, so reordering the deck re-orders this page by itself.
  const { walkthrough, deckIds, pull } = await getWalkthroughRender('coach');
  return <WalkthroughPage walkthrough={walkthrough} deckIds={deckIds} pull={pull} />;
}
