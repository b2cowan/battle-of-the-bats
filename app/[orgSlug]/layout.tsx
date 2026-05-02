import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from '@/lib/db';

export default async function OrgLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  return <>{children}</>;
}
