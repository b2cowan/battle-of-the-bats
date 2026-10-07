import { redirect } from 'next/navigation';

/**
 * PAST TOURNAMENTS' OLD ADDRESS (Tournament admin redesign Stage 4, D7, ruled 2026-10-06). Its page became
 * the Tournaments list's Completed, Archived and Sealed records bands — every event on one list — so an old
 * link, a bookmark or a help article lands there.
 */
export default async function PastTournamentsAddress({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  redirect(`/${encodeURIComponent(orgSlug)}/admin/tournaments/manage`);
}
