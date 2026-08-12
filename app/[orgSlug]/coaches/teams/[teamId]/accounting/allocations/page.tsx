'use client';
import { OrgAllocationsPanel } from './panel';

// Thin on purpose: the panel lives in ./panel so the Money hub (../page.tsx) can import it as a
// tab without importing a PAGE module — a page file may only export Next's page contract, and the
// BUILD-generated .next/types stubs fail `tsc` on any extra export.
export default function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  return <OrgAllocationsPanel params={params} />;
}
