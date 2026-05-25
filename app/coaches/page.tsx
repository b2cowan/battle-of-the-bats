import { redirect } from 'next/navigation';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';

export default function CoachesPortalPage() {
  redirect(COACHES_TOURNAMENTS_PATH);
}
