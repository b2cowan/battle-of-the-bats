import { redirect } from 'next/navigation';

// Moved to Plans & Pricing — see /platform-admin/plans-pricing
export default function PlansPage() {
  redirect('/platform-admin/plans-pricing');
}