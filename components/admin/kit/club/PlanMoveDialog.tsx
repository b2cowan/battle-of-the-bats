'use client';
import SharedPlanMoveDialog from '@/components/billing/PlanMoveDialog';
import type { ComponentProps } from 'react';
export { CONTACT_HREF, money } from '@/components/billing/PlanMoveDialog';
/** Existing admin callers supply their host's destinations here. */
export default function PlanMoveDialog(props: Omit<ComponentProps<typeof SharedPlanMoveDialog>, 'returnTo' | 'teamsHref'>) {
  return <SharedPlanMoveDialog {...props} returnTo={`/${props.org.slug}/admin/org/billing`} teamsHref={`/${props.org.slug}/admin/rep-teams`} />;
}
