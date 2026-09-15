import { redirect } from 'next/navigation';
import { skillsAndGoalsHref } from '@/lib/development-address';

/**
 * "Define a metric" is no longer a page (re-evaluation stage 1, 2026-09-14): a metric's definition
 * is a SHEET over the Metrics tab, addressed by `?edit=new`. The route stays so an old link (a
 * bookmark, a help article) lands on the same sheet rather than a 404; every visitor is sent on,
 * before anything renders.
 */
export default async function NewMetricRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(skillsAndGoalsHref(`/${orgSlug}/coaches/teams/${teamId}`, 'metrics', { edit: 'new' }));
}
