'use client';
import { use } from 'react';
import MetricDefinitionEditor from '@/components/coaches/MetricDefinitionEditor';

/** Define a metric (development lifecycle Phase 1, mockup screen 2) — a new test or skill. */
export default function NewMetricPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  return <MetricDefinitionEditor key={teamId} orgSlug={orgSlug} teamId={teamId} typeId={null} />;
}
