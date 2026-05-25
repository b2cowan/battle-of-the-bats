import { redirect } from 'next/navigation';
import {
  COACHES_CLAIM_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyTeamClaimPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  redirect(pathWithSearchParams(`${COACHES_CLAIM_PATH}/${encodeURIComponent(token)}`, await searchParams, { normalizeNext: true }));
}
