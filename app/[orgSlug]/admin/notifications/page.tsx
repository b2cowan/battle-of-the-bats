import NotificationsPageContent from '@/components/notifications/NotificationsPageContent';

// The full "See all" notifications page for the admin shell (Notification Center Rework P4).
// Reached from the bell's "See all" footer link. Auth is enforced by the admin layout +
// the /api/notifications route; the shared component holds the whole experience.
export default function AdminNotificationsPage() {
  return <NotificationsPageContent />;
}
