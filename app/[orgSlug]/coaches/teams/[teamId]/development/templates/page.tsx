import { redirect } from 'next/navigation';
import { practicePlansHref } from '@/lib/practice-plans-address';

/**
 * Plan templates MOVED under Practice plans (practices re-evaluation stage 0, owner ruling D5,
 * 2026-09-14) — the Templates tab. The address stays so an old link lands on the same library
 * rather than a 404 (`development/board` → Players is the precedent). The room is still the ONE
 * home for rename / retire / import: moved, never duplicated.
 */
export default async function DevelopmentTemplatesRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(practicePlansHref(`/${orgSlug}/coaches/teams/${teamId}`, 'templates'));
}
