'use client';
/**
 * The Free time list on the screen (Support console Stage 4; the server half and the rulings are in `page.tsx`). Three
 * views on tabs (the counts sit on the tabs, never in the title); nothing on it acts.
 */
import { useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { formatShortDay, lastDayOfInstant } from '@/lib/free-time';
import type { StaffFreeTimeClub } from '@/lib/free-time-list';
import FoundingSeasonDesk from './FoundingSeasonDesk';
import LinkRow from '../LinkRow';
import kit from '../console.module.css';
import recordStyles from '../record.module.css';

export type FreeTimeView = 'everyone' | 'founding' | 'staff';

const VIEWS: Array<{ key: FreeTimeView; label: string }> = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'founding', label: 'Founding Season' },
  { key: 'staff', label: 'Given by staff' },
];

const leftWords = (n: number) => (n === 0 ? 'last day' : `${n} day${n === 1 ? '' : 's'}`);

function StaffTable({ clubs, emptyText }: { clubs: StaffFreeTimeClub[]; emptyText: string }) {
  return (
    <div className={`${kit.tableWrap} table-cards`}>
      <table className={kit.comfortable}>
        <thead>
          <tr><th>Club or portal</th><th>Free on</th><th>Free through</th><th className={kit.num}>Left</th><th>Given by</th><th>Why</th><th aria-label="Open" /></tr>
        </thead>
        <tbody>
          {clubs.length === 0 && <tr><td colSpan={7} className={kit.empty}>{emptyText}</td></tr>}
          {clubs.map(c => (
            <LinkRow key={c.orgId} href={`/platform-admin/orgs/${c.orgId}?tab=access`}>
              <td className="table-cards-title">
                <Link href={`/platform-admin/orgs/${c.orgId}?tab=access`} className={kit.nameLink}>{c.name}</Link>
              </td>
              <td data-label="Free on" className={kit.nowrap}>{c.freeOn}</td>
              <td data-label="Free through" className={kit.nowrap}>{formatShortDay(c.lastDay)}</td>
              <td data-label="Left" className={`${kit.num} ${kit.nowrap}`}>
                <span className={c.endingSoon ? recordStyles.soon : undefined}>{leftWords(c.daysLeft)}</span>
              </td>
              <td data-label="Given by">{c.givenBy}</td>
              <td data-label="Why" className={kit.muted}>{c.why || '—'}</td>
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

export default function FreeTimeClient({ initialView, initialEnding, switchOn, staff, desk }: {
  initialView: FreeTimeView;
  initialEnding: boolean;
  switchOn: boolean;
  staff: StaffFreeTimeClub[];
  desk: ComponentProps<typeof FoundingSeasonDesk>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<FreeTimeView>(initialView);
  const [endingOnly, setEndingOnly] = useState(initialEnding);

  // The address keeps the view and the filter, so Today's link and a shared link open the same list.
  const go = (next: FreeTimeView, ending = endingOnly) => {
    setView(next);
    setEndingOnly(ending);
    const params = new URLSearchParams();
    if (next !== 'everyone') params.set('view', next);
    if (next === 'staff' && ending) params.set('ending', '14');
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const shownStaff = endingOnly ? staff.filter(c => c.endingSoon) : staff;
  const everyone = new Set([...desk.rows.map(r => r.orgId), ...staff.map(c => c.orgId)]).size;
  const counts: Record<FreeTimeView, number> = { everyone, founding: desk.rows.length, staff: staff.length };

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Free time" />

      {!switchOn && (
        <p className={`${recordStyles.refuseLine} ${recordStyles.refuseLineBad}`}>
          <Lock size={15} aria-hidden className={recordStyles.refuseIcon} />
          <span><strong>Free time is switched off on this server</strong>, so anything given here would do nothing. An engineer can switch it on.</span>
        </p>
      )}

      <div className={kit.tabs} role="tablist">
        {VIEWS.map(v => (
          <button key={v.key} type="button" role="tab" aria-selected={view === v.key}
            className={`${kit.tab}${view === v.key ? ` ${kit.tabOn}` : ''}`} onClick={() => go(v.key)}>
            {v.label}{counts[v.key] ? <span className={kit.tabCount}>{counts[v.key]}</span> : null}
          </button>
        ))}
      </div>

      {view === 'founding' && <FoundingSeasonDesk {...desk} />}

      {view === 'staff' && (
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>{shownStaff.length} running, soonest end first</span>
            <span className={kit.toolbarEnd}>
              <label className={kit.check}>
                <input type="checkbox" checked={endingOnly} onChange={e => go('staff', e.target.checked)} />
                {' '}Ending in 14 days
              </label>
            </span>
          </div>
          <StaffTable clubs={shownStaff} emptyText={endingOnly ? 'No free time ends in the next 14 days.' : 'No staff free time is running.'} />
        </div>
      )}

      {view === 'everyone' && (
        <>
          <section className={kit.section}>
            <h2 className={kit.sectionTitle}>Given by staff</h2>
            <div className={kit.card}>
              <StaffTable clubs={staff} emptyText="No staff free time is running." />
            </div>
          </section>
          <section className={kit.section}>
            <h2 className={kit.sectionTitle}>Founding Season</h2>
            <div className={kit.card}>
              <div className={`${kit.tableWrap} table-cards`}>
                <table className={kit.comfortable}>
                  <thead><tr><th>Account</th><th>Free on</th><th>Free through</th><th aria-label="Open" /></tr></thead>
                  <tbody>
                    {desk.rows.length === 0 && <tr><td colSpan={4} className={kit.empty}>No founding accounts.</td></tr>}
                    {desk.rows.map(r => (
                      <LinkRow key={r.orgId} href={`/platform-admin/orgs/${r.orgId}?tab=access`}>
                        <td className="table-cards-title">
                          <Link href={`/platform-admin/orgs/${r.orgId}?tab=access`} className={kit.nameLink}>{r.name}</Link>
                        </td>
                        <td data-label="Free on" className={kit.muted}>{r.planLabel}</td>
                        <td data-label="Free through" className={kit.nowrap}>{formatShortDay(lastDayOfInstant(r.freeThrough))}</td>
                        <td className={kit.rowDoor}>
                          <Link href={`/platform-admin/orgs/${r.orgId}?tab=access`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden>›</Link>
                        </td>
                      </LinkRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className={kit.caption}>The Founding Season tab keeps the desk: cards on file, the {desk.nextYearLabel} choice and who signed in last.</p>
          </section>
        </>
      )}
    </div>
  );
}
