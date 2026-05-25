import { redirect } from 'next/navigation';
import { getAuthDestination } from '@/lib/auth-destination';

export default async function SelectOrgCompatibilityPage() {
  redirect(await getAuthDestination());
}
