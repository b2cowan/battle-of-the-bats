import { redirect } from 'next/navigation';
import { practicePlansHref } from '@/lib/practice-plans-address';

/**
 * The bare folder address, `/practice/templates`, is the Templates TAB (`/practice?section=templates`).
 * This page exists for a structural reason as much as a courtesy: `practice/[eventId]` sits beside
 * this folder, and without a page here Next would hand "templates" to that dynamic segment as an
 * event id and render the plan page for an event that does not exist. A static segment beats a
 * dynamic one only when it has a page.
 */
export default async function PracticeTemplatesTabRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(practicePlansHref(`/${orgSlug}/coaches/teams/${teamId}`, 'templates'));
}
