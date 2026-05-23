import type { Metadata } from 'next';
import { getOrganizationBySlug } from '@/lib/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  return { title: org?.name ? `${org.name} Scorekeeper` : 'Scorekeeper' };
}

export default function OfficialCompatibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
