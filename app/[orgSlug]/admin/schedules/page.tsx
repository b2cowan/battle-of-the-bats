'use client';
/**
 * SCHEDULES — the club's time, handed out to its teams (Club Tier Stage 11a, part B; hub K4MPu4ni53Ct7yrDcmWJd9 → Mockups
 * → Stages 10 + 11, specimen 4 "Schedules"; plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.3; Asks 3, 10, 12, 15).
 *
 *   the door   — "Schedules" in the rail DIRECTLY UNDER Calendar, and in the phone's More sheet (`kitSchedulesLink`):
 *                the club's owner or an admin, on a plan carrying the scheduler, where there are rep teams to hand time
 *                to. Calendar reads what is booked; Schedules is where the club hands its time out (two jobs, two rows).
 *   the page   — the 1200 column. The lede says what a schedule is, and New schedule is the one lime at its end. A table:
 *                Schedule (its name — the link — with the places under it) · Dates · Teams · Handed out (open under it) ·
 *                Last sent ("Sep 2 by Jordan Reyes" / "Not sent") · one chevron; band rows In use now · Coming up · Ended;
 *                ONE state chip only where it needs saying — Draft, In review (olive), the amber Changed since sent; a sent
 *                schedule says nothing more.
 *   a phone    — one frame, band rows, hairlined rows with the corner chevron (the 2026-09-29 phone-list ruling).
 *                ⚖ NEW SCHEDULE IS ABSENT AT PHONE WIDTH (§5.9): building a winter of dome nights is desk work, and a
 *                door that dead-ends is the bug. A phone reads a schedule and sends its changes.
 *   nothing    — a club with no rep team running a season has nothing to hand time to: the page says so in words and
 *                New schedule is absent (the route refuses a write anyway, `nothing_to_schedule`).
 *
 * New schedule opens its window over the page (`NewScheduleWindow`); a kept draft opens on its own page. The permit
 * window's "Hand out this time in a schedule ›" lands here as `?new=1&permit=<id>`, the window open, started from it.
 */
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, ClipboardList, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatStoredDate } from '@/lib/timezone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import NewScheduleWindow from '@/components/admin/kit/club/schedules/NewScheduleWindow';
import { ScheduleStateChip } from '@/components/admin/kit/club/schedules/ScheduleParts';
import sch from '@/components/admin/kit/club/schedules/Schedules.module.css';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { scheduleDates, type ScheduleListRow } from '@/lib/club-schedule-view';

interface ListRead { schedules: ScheduleListRow[]; nothingToSchedule: boolean; canMoney: boolean }

const BANDS = ['in_use', 'coming_up', 'ended'] as const;

export default function SchedulesPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  usePageTitle(W.title);
  const isPhone = useIsPhone();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;

  const [read, setRead] = useState<ListRead | null>(null);
  const [failed, setFailed] = useState<{ refused: boolean; text: string } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  // The permit window's door opens New schedule started from that permit (`?new=1&permit=<id>`).
  const startPermit = search.get('new') === '1' ? search.get('permit') : null;
  const [newOpen, setNewOpen] = useState(() => search.get('new') === '1');
  const closeNew = () => {
    setNewOpen(false);
    if (search.get('new')) router.replace(pathname, { scroll: false });
  };

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<ListRead>(`/api/admin/schedules?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) {
      setFailed(r?.status === 403 ? { refused: true, text: refusalText(r.data, R.who) } : { refused: false, text: W.loadFailed });
      return;
    }
    setFailed(null);
    setRead(r.data);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const rows = useMemo(() => read?.schedules ?? [], [read]);
  const canNew = !!read && !read.nothingToSchedule && !isPhone;
  const href = (id: string) => `/${slug}/admin/schedules/${id}`;

  const newButton = canNew ? (
    <button type="button" className="btn btn-lime" onClick={() => setNewOpen(true)} id="org-schedule-new-btn">
      <Plus size={15} aria-hidden />{W.newButton}
    </button>
  ) : undefined;
  const header = <AdminPageHeader title={W.title} inlineActions />;

  if (orgLoading || (!read && !failed)) return <PageLoading header={header} label="Loading the schedules…" />;
  if (failed?.refused) {
    return <div className={ck.pageWide}>{header}<EmptyCard icon={<ClipboardList size={28} aria-hidden />} title="Nothing to show">{failed.text}</EmptyCard></div>;
  }

  const sent = (r: ScheduleListRow) => (r.lastSent ? W.sentBy(formatStoredDate(r.lastSent.at), r.lastSent.by) : null);
  const table = (
    <>
      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table} aria-label={W.title}>
          <thead>
            <tr>
              <th scope="col">{W.cols.schedule}</th>
              <th scope="col">{W.cols.dates}</th>
              <th scope="col" className={repKit.num}>{W.cols.teams}</th>
              <th scope="col" className={repKit.num}>{W.cols.handedOut}</th>
              <th scope="col">{W.cols.lastSent}</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map(b => {
              const inBand = rows.filter(r => r.band === b);
              if (!inBand.length) return null;
              return [
                <tr key={`band-${b}`} className={repKit.band}><td colSpan={6}>{W.bands[b]}</td></tr>,
                ...inBand.map(r => (
                  <tr key={r.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; router.push(href(r.id)); }}>
                    <td>
                      <span className={sch.nameLine}>
                        <Link href={href(r.id)} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{r.name}</Link>
                        <ScheduleStateChip state={r.state} changed={r.changedSinceSent} />
                      </span>
                      {r.places.length > 0 && <span className={repKit.cellSub}>{r.places.join(' · ')}</span>}
                    </td>
                    <td>{scheduleDates(r.startsOn, r.endsOn)}</td>
                    <td className={repKit.num}>{r.teams}</td>
                    <td className={repKit.num}>{r.handedOut}<span className={repKit.cellSub}>{W.open(r.open)}</span></td>
                    <td className={sent(r) ? undefined : repKit.dim}>{sent(r) ?? W.notSent}</td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>
        <ClubRowFrame>
          {BANDS.map(b => {
            const inBand = rows.filter(r => r.band === b);
            if (!inBand.length) return null;
            return (
              <ClubRowList key={b} inset label={W.bands[b]}>
                <ClubRowBand>{W.bands[b]}</ClubRowBand>
                {inBand.map(r => (
                  <ClubRow key={r.id} as="link" href={href(r.id)} chevron
                    title={<span className={sch.nameLine}>{r.name}<ScheduleStateChip state={r.state} changed={r.changedSinceSent} /></span>}
                    caption={(
                      <>
                        <span className={sch.capLine}>{[r.places[0], scheduleDates(r.startsOn, r.endsOn)].filter(Boolean).join(' · ')}</span>
                        <span className={sch.capLine}>
                          {r.band === 'ended' && r.lastSent ? W.phoneSent(formatStoredDate(r.lastSent.at), r.lastSent.by) : W.phoneTeams(r.teams, r.handedOut)}
                        </span>
                      </>
                    )} />
                ))}
              </ClubRowList>
            );
          })}
        </ClubRowFrame>
      </div>
    </>
  );

  return (
    <div className={ck.pageWide}>
      {header}
      <CoachListToolbar actions={newButton}>
        <p className={kit.toolbarLede}>{W.lede}</p>
      </CoachListToolbar>

      {failed ? (
        <LoadFailed title={failed.text} onRetry={() => void load()} />
      ) : read!.nothingToSchedule && rows.length === 0 ? (
        <EmptyCard icon={<ClipboardList size={28} aria-hidden />} title={W.emptyTitle}>{R.nothingToSchedule}</EmptyCard>
      ) : rows.length === 0 ? (
        // No door of its own: New schedule is the screen's one lime, at the top.
        <EmptyCard icon={<ClipboardList size={28} aria-hidden />} title={W.emptyTitle}>{W.emptyBody}</EmptyCard>
      ) : (
        <>
          {read!.nothingToSchedule && <p className={ck.hint}>{R.nothingToSchedule}</p>}
          {table}
        </>
      )}

      {newOpen && canNew && (
        <NewScheduleWindow
          q={q}
          orgSlug={slug}
          startPermitId={startPermit}
          onCancel={closeNew}
          onSaved={id => { setNewOpen(false); router.push(href(id)); }}
        />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </div>
  );
}
