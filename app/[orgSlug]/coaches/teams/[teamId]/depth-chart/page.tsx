import { redirect } from 'next/navigation';

// The depth chart now lives as a view inside the Roster page (Roster ⇄ Depth chart toggle). This
// route is kept only so any old links/bookmarks land in the right place.
export default async function DepthChartRedirect({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = await params;
  redirect(`/${orgSlug}/coaches/teams/${teamId}/roster?view=depth`);
}
