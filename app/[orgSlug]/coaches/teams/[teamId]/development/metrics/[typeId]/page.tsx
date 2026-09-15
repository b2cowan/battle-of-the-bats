import { redirect } from 'next/navigation';
import { skillsAndGoalsHref, parseMetricEdit } from '@/lib/development-address';

/**
 * A metric's definition is no longer a page (re-evaluation stage 1, 2026-09-14): it is a SHEET
 * over the Metrics tab, addressed by `?edit=<id>`. The route stays so an old link lands on the
 * same sheet rather than a 404; an id that is not one lands on the Metrics tab alone.
 */
export default async function MetricRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; typeId: string }>;
}) {
  const { orgSlug, teamId, typeId } = await params;
  redirect(skillsAndGoalsHref(`/${orgSlug}/coaches/teams/${teamId}`, 'metrics', { edit: parseMetricEdit(typeId) }));
}
