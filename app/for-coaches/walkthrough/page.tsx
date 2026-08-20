import { COACH_WALKTHROUGH, walkthroughMetadata } from '@/lib/walkthrough-content';
import WalkthroughPage from '@/components/marketing/WalkthroughPage';

// The story lives in lib/walkthrough-content.ts; the rendering (scroll page, present mode,
// print leave-behind) lives in components/marketing/WalkthroughPage.tsx. This file is the route.
export const metadata = walkthroughMetadata(COACH_WALKTHROUGH);

export default function CoachWalkthroughPage() {
  return <WalkthroughPage walkthrough={COACH_WALKTHROUGH} />;
}
