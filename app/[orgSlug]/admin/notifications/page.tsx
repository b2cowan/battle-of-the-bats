import NotificationsPageContent from '@/components/notifications/NotificationsPageContent';

// The admin shell's Notifications page (Notification Center Rework P4). On a phone it is the only
// place to read a notification (More › Notifications — there is no bell below 900px); on a computer
// the bell's drawer holds the same list and nothing links here (Notifications Open in Place D6).
// Auth is enforced by the admin layout + the /api/notifications route; the shared component holds
// the whole experience.
export default function AdminNotificationsPage() {
  return <NotificationsPageContent />;
}
