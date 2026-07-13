import { redirect } from 'next/navigation';

// Notification Settings Phase 1 (locked D1): the org notification-preferences grid folded into the
// universal /account/notifications page (one grid implementation, zero drift; no live users to
// strand). This route now redirects there, focused on this org's card, so any bookmarked or deep
// link still lands in the right place.
export default async function OrgNotificationsRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(`/account/notifications?focus=org-${orgSlug}`);
}
