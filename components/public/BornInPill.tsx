'use client';
import { useRouter } from 'next/navigation';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { bornPickHref } from '@/lib/club-born-public';
import { useClubBase } from '@/lib/use-public-pathname';
import kit from './ClubKit.module.css';

/**
 * BORN IN — the club's Teams and Tryouts pages' one pick-one pill (Club Tier Stage 4c-2 Part A; Stage 4 Ask 15, owner
 * ruling 2026-10-22: the house single-select dropdown pill, NOT ViewPills). "Any year", then every year a listed place
 * names, newest first. The pick lives in the address (`?born=2015`), so a filtered list can be shared; the page reads it
 * on the server and renders the narrowed list — this only moves the address.
 *
 * The face reads as drawn (D15/D16, owner 2026-10-22): "Born in: any year" · "Born in: 2015" — the `labelSuffix` prop and the any
 * option's `faceLabel`, both opt-in on the shared pill; the menu's first row still reads "Any year" and the menu is named "Born in".
 *
 * The pill is the portal's `SingleSelectDropdown`, not a copy: it reads its colours from the platform's names, which the
 * club's frame (ClubFrame.module.css `.site`) redefines for the club's light ground. The pill itself renders only when
 * the page has a year to offer — the page decides, never here.
 */
const ANY = 'any';

export default function BornInPill({ path, years, picked }: { path: string; years: readonly number[]; picked: number | null }) {
  const router = useRouter();
  // `path` arrives club-named (`/lakeshore-lynx/teams`); on a club's own web address the pick moves THAT address (`/teams`).
  const base = useClubBase();
  const here = base?.ownHost && (path === `/${base.slug}` || path.startsWith(`/${base.slug}/`)) ? path.slice(base.slug.length + 1) || '/' : path;
  return (
    <div className={kit.pickRow}>
      <SingleSelectDropdown
        label="Born in"
        options={[{ id: ANY, label: 'Any year', faceLabel: 'any year' }, ...years.map(y => ({ id: String(y), label: String(y) }))]}
        value={picked == null ? ANY : String(picked)}
        labelSuffix=":"
        onChange={id => router.replace(bornPickHref(here, id === ANY ? null : Number(id)), { scroll: false })}
      />
    </div>
  );
}
