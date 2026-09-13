'use client';
import { use } from 'react';
import MetricDefinitionEditor from '@/components/coaches/MetricDefinitionEditor';

/** One metric's definition (development lifecycle Phase 1, mockup screen 2) — edit, retire, restore. */
export default function MetricPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; typeId: string }>;
}) {
  const { orgSlug, teamId, typeId } = use(params);
  // Fresh instance per definition — no stale draft when the coach opens a second one.
  return <MetricDefinitionEditor key={typeId} orgSlug={orgSlug} teamId={teamId} typeId={typeId} />;
}
