import { redirect } from 'next/navigation';
import {
  COACHES_TOURNAMENTS_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyMyRegistrationsPage({ searchParams }: PageProps) {
  redirect(pathWithSearchParams(COACHES_TOURNAMENTS_PATH, await searchParams, { normalizeNext: true }));
}
