import BillingKit from '@/components/admin/kit/club/BillingKit';

/** Every admin plan uses the same billing host, including the tournament subscription alias. */
export default function BillingPage() {
  return <BillingKit />;
}
