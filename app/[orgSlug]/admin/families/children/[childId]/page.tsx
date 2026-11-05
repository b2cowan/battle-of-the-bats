'use client';

/**
 * Families › a child's page (Club Tier Stage 14 S5). The gate is the Families layout's (decided on the server before any
 * page mounts); the frame draws no tab row over it — the page wears its own header (`isFamiliesChildPage`).
 */
import { use } from 'react';
import ChildPage from '@/components/admin/kit/club/families/ChildPage';

export default function FamiliesChildPage({ params }: { params: Promise<{ orgSlug: string; childId: string }> }) {
  const { orgSlug, childId } = use(params);
  return <ChildPage orgSlug={orgSlug} childId={childId} />;
}
