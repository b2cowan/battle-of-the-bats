import { getPlatformUsers } from '@/lib/db';
import { getBootstrapAdminEmails } from '@/lib/platform-auth';
import type { PlatformUser } from '@/lib/types';
import CompanyUsersClient from './CompanyUsersClient';

export default async function CompanyUsersPage() {
  const users = await getPlatformUsers();
  const bootstrapEmails = getBootstrapAdminEmails();
  const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
  const bootstrapRows: PlatformUser[] = bootstrapEmails
    .filter(email => !existingEmails.has(email))
    .map(email => ({
      id: `bootstrap:${email}`,
      email,
      displayName: 'Bootstrap Admin',
      role: 'admin',
      isActive: true,
      invitedBy: 'env:PLATFORM_ADMIN_EMAILS',
      createdAt: '',
      updatedAt: '',
    }));

  return <CompanyUsersClient users={[...users, ...bootstrapRows]} bootstrapEmails={bootstrapEmails} />;
}
