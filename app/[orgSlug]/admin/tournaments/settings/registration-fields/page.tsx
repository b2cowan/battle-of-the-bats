import { redirect } from 'next/navigation';

/**
 * REGISTRATION QUESTIONS' OLD ADDRESS (Tournament admin redesign Stage 5 addendum, A74 + P3, owner 2026-10-12). The
 * questions live in their card on Event settings now, each opening its window over the page; the separate page went,
 * and with it a back link that opened Settings & access with no door back. An old link, a bookmark or a help article
 * lands on Event settings with the questions card open (`?section=questions`, CollapsibleCard's deep link). A deep
 * link's event (`?tournamentId=`, the tournament context's) rides along; `?from=` is dropped — there is no page to go
 * back from.
 */
export default async function RegistrationQuestionsAddress({ params, searchParams }: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { orgSlug } = await params;
  const { tournamentId } = await searchParams;
  const event = typeof tournamentId === 'string' && tournamentId ? `&tournamentId=${encodeURIComponent(tournamentId)}` : '';
  redirect(`/${encodeURIComponent(orgSlug)}/admin/tournaments/settings/event?section=questions${event}`);
}
