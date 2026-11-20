import { redirect } from 'next/navigation';

/**
 * The old Founding season desk's address. The desk is gone; a link or a bookmark written before lands on the Free time list.
 */
export default function FoundingSeasonPage() {
  redirect('/platform-admin/free-time');
}
