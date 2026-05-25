import { redirect } from 'next/navigation';
import {
  COACHES_JOIN_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyCoachJoinPage({ searchParams }: PageProps) {
  redirect(pathWithSearchParams(COACHES_JOIN_PATH, await searchParams, { normalizeNext: true }));
}
