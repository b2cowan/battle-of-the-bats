import type { ReactNode } from 'react';
import CoachJourneyChrome from '@/components/consumer/CoachJourneyChrome';

/**
 * Checkout complete — where Stripe returns a paid Coach Premium checkout (The first look, Stage 3b — F06, 2026-10-20).
 * It is the journey's last step before the portal, so it wears the same warm chrome as the welcome (rule 1: never the
 * marketing bar and footer, which isWarmJourneyPath suppresses for /coaches/checkout).
 */
export default function CoachesCheckoutLayout({ children }: { children: ReactNode }) {
  return <CoachJourneyChrome>{children}</CoachJourneyChrome>;
}
