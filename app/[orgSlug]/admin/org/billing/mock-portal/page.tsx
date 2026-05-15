import { notFound } from 'next/navigation';
import { isBillingMockEnabled } from '@/lib/billing-mock';
import MockPortalClient from './MockPortalClient';

export default function MockPortalPage() {
  if (!isBillingMockEnabled()) notFound();

  return <MockPortalClient />;
}
