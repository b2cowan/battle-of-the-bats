import CoachNotificationsPage from '@/components/coaches/CoachNotificationsPage';

// The full "See all" notifications page for the coaches portal (Notification Center Rework P4).
//
// ⚠ Since 2026-09-03 this route wears the COACH frame (CoachPageHeader + the shared feed body),
// not the admin page's component — coach-notifications review, owner-approved D1. The coaches
// layout supplies the shell + org context; the "Notification settings" door deep-links into the
// universal /account/notifications page focused on this coach's card (feed and settings stay
// separate screens — locked D2) and now carries the way back (`?back=`, D2 = Option B).
export default async function CoachesNotificationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <CoachNotificationsPage orgSlug={orgSlug} />;
}
