import { redirect } from 'next/navigation';
import {
  COACHES_TOURNAMENTS_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyMyRegistrationDetailPage({ params, searchParams }: PageProps) {
  const { teamId } = await params;
  redirect(pathWithSearchParams(`${COACHES_TOURNAMENTS_PATH}/${teamId}`, await searchParams, { normalizeNext: true }));
}
