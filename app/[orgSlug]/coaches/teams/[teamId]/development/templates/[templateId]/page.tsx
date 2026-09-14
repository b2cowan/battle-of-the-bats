import { redirect } from 'next/navigation';
import { planTemplateHref } from '@/lib/practice-plans-address';

/**
 * The template editor MOVED with its library under Practice plans (practices re-evaluation stage
 * 0, owner ruling D5, 2026-09-14). An old link to one template lands on that template.
 */
export default async function DevelopmentTemplateRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; templateId: string }>;
}) {
  const { orgSlug, teamId, templateId } = await params;
  redirect(planTemplateHref(`/${orgSlug}/coaches/teams/${teamId}`, templateId));
}
