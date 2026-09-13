'use client';
import { use } from 'react';
import DevelopmentHandoutPreview from '@/components/coaches/DevelopmentHandoutPreview';

/**
 * Preview development handout (development lifecycle Phase 3, mockup screen 6) — a page of its own
 * under the player's record, addressed with the way back (`?return=`); it paginates, so it is not a
 * modal. Nothing here is stored: the handout is a print of the record as of today.
 */
export default function DevelopmentHandoutPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; playerId: string }>;
}) {
  const { orgSlug, teamId, playerId } = use(params);
  // Fresh instance per player — no choices carried from one record to the next.
  return <DevelopmentHandoutPreview key={playerId} orgSlug={orgSlug} teamId={teamId} playerId={playerId} />;
}
