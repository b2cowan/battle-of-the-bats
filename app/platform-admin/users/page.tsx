import { getPlatformUsers } from '@/lib/db';
import CompanyUsersClient from './CompanyUsersClient';

export default async function CompanyUsersPage() {
  const users = await getPlatformUsers();
  const bootstrapEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return <CompanyUsersClient users={users} bootstrapEmails={bootstrapEmails} />;
}
