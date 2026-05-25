import { redirect } from 'next/navigation';
import {
  COACHES_CHECKOUT_COMPLETE_PATH,
  pathWithSearchParams,
  type SearchParamsRecord,
} from '@/lib/coaches-portal-routes';

type PageProps = {
  searchParams: Promise<SearchParamsRecord>;
};

export default async function LegacyTeamCheckoutCompletePage({ searchParams }: PageProps) {
  redirect(pathWithSearchParams(COACHES_CHECKOUT_COMPLETE_PATH, await searchParams, { normalizeNext: true }));
}
