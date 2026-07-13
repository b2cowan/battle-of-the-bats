import NotificationsPageContent from '@/components/notifications/NotificationsPageContent';

// The full "See all" notifications page for the coaches portal (Notification Center Rework P4).
// Same shared component as the admin route; the coaches layout supplies the shell + org context.
// Notification Settings Phase 1: a "Notification settings" affordance atop the feed deep-links into
// the universal /account/notifications page, focused on this coach's card (feed and settings stay
// separate screens — locked D2).
export default async function CoachesNotificationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <NotificationsPageContent settingsHref={`/account/notifications?focus=coach-${orgSlug}`} />;
}
