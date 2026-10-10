import { redirect } from 'next/navigation';

/**
 * DATA TOOLS' OLD ADDRESS (Tournament admin redesign Stage 5, E10, A59, ruled 2026-10-10). Data tools retired: each
 * import lives with its data — Teams' Export menu imports teams, the schedule's Tools imports games, through one
 * import sheet (components/admin/tournament/ImportSheet), and the registration workbook stays on Teams' Export. An old
 * link, a bookmark or a help article lands on Teams, as Past tournaments' address lands on the Tournaments list.
 */
export default async function DataToolsAddress({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  redirect(`/${encodeURIComponent(orgSlug)}/admin/tournaments/registrations`);
}
