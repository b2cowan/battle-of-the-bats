'use client';
import { useRouter } from 'next/navigation';
import { setDivisionPref } from '@/lib/division-cookie';
import type { Division } from '@/lib/types';
import styles from './DivisionFilterBar.module.css';

interface Props {
  orgSlug: string;
  divisions: Pick<Division, 'id' | 'name'>[];
  activeName: string;
  isFiltering: boolean;
  viewAllHref: string;
  backHref: string;
}

/** The public pages' division filter (Rules, News): the same dropdown as the Schedule's and Teams', with "All divisions"
 *  first. Picking a division remembers it (the cookie) and narrows the page; "All divisions" shows everything for this
 *  visit and leaves the remembered division alone, so coming back to a division is one pick. */
export default function DivisionFilterBar({
  orgSlug, divisions, activeName, isFiltering, viewAllHref, backHref,
}: Props) {
  const router = useRouter();

  function choose(value: string) {
    if (value === '') {
      if (isFiltering) router.push(viewAllHref);
      return;
    }
    setDivisionPref(orgSlug, value);
    if (isFiltering) {
      router.refresh();
    } else {
      router.push(backHref);
    }
  }

  return (
    <label className={styles.bar}>
      <span className="sr-only">Division</span>
      <select
        className={styles.select}
        aria-label="Division"
        value={isFiltering ? activeName : ''}
        onChange={e => choose(e.target.value)}
      >
        <option value="">All divisions</option>
        {divisions.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
      </select>
    </label>
  );
}
