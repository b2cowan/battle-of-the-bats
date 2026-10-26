import { redirect } from 'next/navigation';

/**
 * The Founding season desk's old address. Support console Stage 4 folded the desk into the Free time list as its Founding
 * Season view (owner ruling Q4); a link or a bookmark written before then lands there.
 */
export default function FoundingSeasonPage() {
  redirect('/platform-admin/free-time?view=founding');
}
