import { redirect } from 'next/navigation';

type Params = { params: Promise<{ orgSlug: string }> };

export default async function OfficialCompatibilityPage({ params }: Params) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/scorekeeper`);
}
