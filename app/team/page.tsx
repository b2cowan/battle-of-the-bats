import { redirect } from 'next/navigation';
import {
  COACHES_START_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyTeamPage({ searchParams }: PageProps) {
  redirect(pathWithSearchParams(COACHES_START_PATH, await searchParams, { normalizeNext: true }));
}
