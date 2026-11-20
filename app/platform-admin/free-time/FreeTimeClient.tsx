'use client';
/**
 * The Free time list on the screen (Support console Stage 4; the server half and the rulings are in `page.tsx`). One
 * list, no tabs; nothing on it acts.
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { formatShortDay } from '@/lib/free-time';
import type { StaffFreeTimeClub } from '@/lib/free-time-list';
import LinkRow from '../LinkRow';
import kit from '../console.module.css';
import recordStyles from '../record.module.css';

const leftWords = (n: number) => (n === 0 ? 'last day' : `${n} day${n === 1 ? '' : 's'}`);

function StaffTable({ clubs, emptyText }: { clubs: StaffFreeTimeClub[]; emptyText: string }) {
  return (
    <div className={`${kit.tableWrap} table-cards`}>
      <table className={kit.comfortable}>
        <thead>
          <tr><th>Club or portal</th><th>Free on</th><th>Free through</th><th className={kit.num}>Left</th><th>Given by</th><th aria-label="Open" /></tr>
        </thead>
        <tbody>
          {clubs.length === 0 && <tr><td colSpan={6} className={kit.empty}>{emptyText}</td></tr>}
          {clubs.map(c => (
            <LinkRow key={c.orgId} href={`/platform-admin/orgs/${c.orgId}?tab=access`}>
              <td className="table-cards-title">
                <Link href={`/platform-admin/orgs/${c.orgId}?tab=access`} className={kit.nameLink}>{c.name}</Link>
              </td>
              <td data-label="Free on" className={kit.nowrap}>{c.freeOn}</td>
              <td data-label="Free through" className={kit.nowrap}>{c.lastDay ? formatShortDay(c.lastDay) : 'No end date'}</td>
              <td data-label="Left" className={`${kit.num} ${kit.nowrap}`}>
                {c.daysLeft == null ? '—' : <span className={c.endingSoon ? recordStyles.soon : undefined}>{leftWords(c.daysLeft)}</span>}
              </td>
              <td data-label="Given by">{c.givenBy}</td>
              <td className={kit.rowDoor}>
                <Link href={`/platform-admin/orgs/${c.orgId}?tab=access`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden>›</Link>
              </td>
            </LinkRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FreeTimeClient({ initialEnding, switchOn, staff }: {
  initialEnding: boolean;
  switchOn: boolean;
  staff: StaffFreeTimeClub[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [endingOnly, setEndingOnly] = useState(initialEnding);

  // The address keeps the filter, so Today's link and a shared link open the same list.
  const go = (ending: boolean) => {
    setEndingOnly(ending);
    router.replace(`${pathname}${ending ? '?ending=14' : ''}`, { scroll: false });
  };

  const shownStaff = endingOnly ? staff.filter(c => c.endingSoon) : staff;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Free time" />

      {!switchOn && (
        <p className={`${recordStyles.refuseLine} ${recordStyles.refuseLineBad}`}>
          <Lock size={15} aria-hidden className={recordStyles.refuseIcon} />
          <span><strong>Free time is switched off on this server</strong>, so anything given here would do nothing. An engineer can switch it on.</span>
        </p>
      )}

      <div className={kit.card}>
        <div className={kit.toolbar}>
          <span className={kit.count}>{shownStaff.length} running, soonest end first</span>
          <span className={kit.toolbarEnd}>
            <label className={kit.check}>
              <input type="checkbox" checked={endingOnly} onChange={e => go(e.target.checked)} />
              {' '}Ending in 14 days
            </label>
          </span>
        </div>
        <StaffTable clubs={shownStaff} emptyText={endingOnly ? 'No free time ends in the next 14 days.' : 'No staff free time is running.'} />
      </div>
    </div>
  );
}
