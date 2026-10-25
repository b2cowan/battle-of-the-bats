import { requirePlatformAreaView } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import PeopleClient from './PeopleClient';
import { PEOPLE_PAGE_SIZE, readPeoplePage } from './people-rows';

export const metadata = { title: 'People — Support console' };

/**
 * People (Support console Stage 2, A8; renamed from Customer users, A7). The first page renders on the server; the search,
 * the filter and the pages go through `POST /api/platform-admin/people` (the words never ride in the address).
 */
export default async function PeoplePage() {
  const auth = await requirePlatformAreaView('customer_users');
  const { rows, total } = await readPeoplePage({ query: '', status: null, page: 1 });
  return (
    <PeopleClient
      initialRows={rows}
      initialTotal={total}
      pageSize={PEOPLE_PAGE_SIZE}
      showStaffDoor={canViewPlatformArea(auth.role, 'platform_users')}
    />
  );
}
