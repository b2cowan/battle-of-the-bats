import { redirect } from 'next/navigation';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';

export default function LegacyMyPage() {
  redirect(COACHES_TOURNAMENTS_PATH);
}
