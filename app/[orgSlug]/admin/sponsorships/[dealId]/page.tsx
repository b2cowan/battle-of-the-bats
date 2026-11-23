'use client';

/**
 * Sponsorships › one deal (Board Ready Stage 6, Part 2; round 1 tab 5). A record over the Deals tab, one level down, so Deals
 * stays lit (`sponsorshipsTabs`' `views`); the static tabs (packages, sponsors, setup) win their own addresses first. The
 * frame and the gate are the layout's.
 */
import { use } from 'react';
import DealScreen from '@/components/admin/kit/club/sponsorships/DealScreen';

export default function SponsorshipsDealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = use(params);
  return <DealScreen key={dealId} dealId={dealId} />;
}
