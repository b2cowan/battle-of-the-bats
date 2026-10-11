'use client';
/**
 * Organization › VENUE LIBRARY (Club Tier Stage 6b, Ask 9 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, specimen 6; design log
 * 2026-10-09 (4)). Once the coach's picker reads it (6a), the library is the club's ONE venue book, and it holds up to
 * that:
 *
 *   the page   — the 1200px column. Title "Venue library" (eyebrow Organization), Add venue — the one lime, and it ASKS —
 *                for whoever saves. The lede in the toolbar names every program. A table: Venue (the name the link, the
 *                address under it) · Facilities (by name, in the club's order) · Booked by this season (by program, in
 *                words) · one chevron; the whole row opens. A quiet "N archived venues" line opens them. On a phone the
 *                table is the kit's white rows with a chevron.
 *   a venue    — the read-first window (`VenueWindow`): it reads, the pencil edits it whole, saving as you go.
 *   archive    — a venue anything books (past included) offers Archive; one nothing books offers Delete (red, asks).
 *
 * ⚖ PERMITS — THE TIME THE CLUB HOLDS (Club Tier Stage 10a; hub Stages 10 + 11, specimens 1, 2; Asks 1, 2, 4 ratified
 * 2026-10-11). The library is the club's venues AND the time it holds at them: one page, two views of one book, chosen by
 * the olive switch (Venues · Permits; the address keeps it, `?view=permits`). Permits is a table — Permit (issuer ·
 * reference under it) · Where · Dates · A week · Used (a percentage, "51.5 of 80 h" under it) · Cost · chevron — in band
 * rows In use now · Starts later · Ended, scoped by the fiscal-year pill (the year a permit STARTS in, Ask 2). Export
 * above it (Excel, the house format); Add permit the one lime, for savers. A permit opens its window (`PermitWindow`); a
 * venue's window lists the permits holding time there. ⚖ A permit's MONEY reads only to those who hold the club's
 * Accounting (owner, 10a build): for anyone else the Cost column is absent. Windows open over each other as LEVELS — a
 * venue's permit, a permit's budget line, the line's permits — each × going back one (3d's door rule).
 *
 * ⚖ WHO SAVES (Ask 9): the owner, an admin, a league admin, and anyone granted the tournament permission. Everyone else
 * who can open Organization READS it — no Add venue, no pencil, no Archive or Delete. A refused save says why in the
 * window (the route's words), never silently.
 * ⚠ A FAILED LOAD says so, with Try again — never an empty library (S6-09: "No venues in your library yet" over a failed
 * read invited the club to add its venues twice).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Download, FileClock, MapPin, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import { ViewSwitch } from '@/components/coaches/ScheduleCalendarViews';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { AddVenueWindow, VenueQuestion, VenueWindow } from '@/components/admin/kit/club/VenueLibraryWindows';
import { AddPermitWindow, PermitWindow, permitWorkbookBrand } from '@/components/admin/kit/club/PermitWindows';
import { BudgetLineHandOff } from '@/components/admin/kit/club/money/BudgetWindows';
import YearPill from '@/components/admin/kit/club/money/YearPill';
import own from '@/components/admin/kit/club/VenueLibrary.module.css';
import pm from '@/components/admin/kit/club/Permits.module.css';
import { NO_USAGE, VENUE_LIBRARY_WORDS as W, bookedBySummary, type LibraryVenue, type VenueUsage } from '@/lib/venue-library';
import {
  PERMIT_WORDS as PW, facilityListWords, hoursNumber, hoursWords, permitMoney, usedOfWords, usedPercent, usedRatio,
} from '@/lib/permit-words';
import { buildFilename, downloadXLSX } from '@/lib/export';
import type { PermitListRow, PermitsYearRead, VenuePermitRow } from '@/lib/permit-server';

interface LibraryRead { venues: LibraryVenue[]; usage: Record<string, VenueUsage>; permits?: Record<string, VenuePermitRow[]>; canSave: boolean }

type View = 'venues' | 'permits';
/** A window over the page, and the windows opened from it (3d's door rule: each × goes back one level). */
type Level =
  | { kind: 'venue'; id: string }
  | { kind: 'permit'; id: string; edit?: boolean; said?: string | null }
  | { kind: 'line'; lineId: string; yearKey: string };

const facilitiesWords = (v: LibraryVenue) =>
  [...v.facilities].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.name).join(' · ');

/** "Lions Park · Diamond 2" — where a permit holds time, a line per venue. */
const whereLines = (p: PermitListRow) => p.where.map(w => `${w.venueName} · ${w.facilities ? facilityListWords(w.facilities) : PW.everyFacility.toLowerCase()}`);

/** The state of a permit on the day, said once as a band. */
function bandOf(p: PermitListRow, today: string): 'now' | 'later' | 'ended' {
  if (p.startsOn > today) return 'later';
  if (p.endsOn < today) return 'ended';
  return 'now';
}
const BANDS: { id: 'now' | 'later' | 'ended'; label: string }[] = [
  { id: 'now', label: PW.bandNow }, { id: 'later', label: PW.bandLater }, { id: 'ended', label: PW.bandEnded },
];

export default function VenueLibraryPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  usePageTitle('Venue library');
  const isPhone = useIsPhone();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const planAllowed = hasOrgVenueLibrary(currentOrg?.planId);
  const view: View = search.get('view') === 'permits' ? 'permits' : 'venues';
  const setView = (next: View) => router.replace(next === 'permits' ? `${pathname}?view=permits` : pathname, { scroll: false });

  const [read, setRead] = useState<LibraryRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [stack, setStack] = useState<Level[]>([]);
  const [asking, setAsking] = useState<'add' | 'archive' | 'delete' | 'add-permit' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  /** Why Bring back didn't go through — said beside its button, in the window. */
  const [actionError, setActionError] = useState('');
  const [restoring, setRestoring] = useState(false);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug || !planAllowed) return;
    const current = beginRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<LibraryRead>(`/api/admin/org/venues?${q}&library=1`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, planAllowed, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // ── Permits (Club Tier 10a) ──
  const [permits, setPermits] = useState<PermitsYearRead | null>(null);
  const [permitsFailed, setPermitsFailed] = useState(false);
  const [year, setYear] = useState<string | null>(null);
  const beginPermitsRead = useLatestRead();
  const loadPermits = useCallback(async () => {
    if (!slug || !planAllowed) return;
    const current = beginPermitsRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<PermitsYearRead>(`/api/admin/org/permits?${q}${year ? `&year=${encodeURIComponent(year)}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setPermitsFailed(true); return; }
    setPermitsFailed(false);
    setPermits(r.data);
  }, [slug, planAllowed, q, year, beginPermitsRead]);
  useEffect(() => { if (view === 'permits' && !orgLoading) void loadPermits(); }, [view, orgLoading, loadPermits]);
  /** A permit changed: the list, the venues' Permits sections, both read again. */
  const permitChanged = useCallback(() => { void loadPermits(); void load(); }, [loadPermits, load]);

  const active = useMemo(() => (read?.venues ?? []).filter(v => v.isActive), [read]);
  const archived = useMemo(() => (read?.venues ?? []).filter(v => !v.isActive), [read]);
  const canSave = !!read?.canSave;
  const today = tournamentToday();
  const permitList = useMemo(() => {
    const rows = permits?.permits ?? [];
    return BANDS.flatMap(b => rows.filter(p => bandOf(p, today) === b.id));
  }, [permits, today]);
  /* Stable across renders: the window's autosave rebuilds its save from it, and a fresh one every page render would
     restart the autosave's wait (/review 6b). */
  const replaceVenue = useCallback((v: LibraryVenue) => setRead(r => r && { ...r, venues: r.venues.map(x => (x.id === v.id ? v : x)) }), []);

  const top = stack[stack.length - 1] ?? null;
  // A permit's one-time asks (open in its form, a notice) are spent once it is covered: back on top, it reads (/review 10a).
  const spent = (l: Level): Level => (l.kind === 'permit' ? { ...l, edit: false, said: null } : l);
  const push = (l: Level) => { setSaid(null); setActionError(''); setStack(s => [...s.map(spent), l]); };
  const pop = () => setStack(s => s.slice(0, -1));
  const swapTop = (l: Level) => { setActionError(''); setStack(s => [...s.slice(0, -1), l]); };
  const openFromPage = (l: Level) => { setSaid(null); setActionError(''); setStack([l]); };
  const close = () => setStack([]);

  const header = (
    <AdminPageHeader
      eyebrow="Organization"
      title="Venue library"
      actions={planAllowed && canSave && view === 'venues' ? (
        <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => { setSaid(null); setAsking('add'); }}
          aria-label="Add venue" id="org-venue-add-btn">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add venue</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading) return <PageLoading header={header} />;
  if (!planAllowed) {
    return (
      <div className={ck.pageWide}>
        {header}
        <EmptyCard icon={<MapPin size={28} aria-hidden />} title="The Venue library isn’t on your plan">{W.planLocked}</EmptyCard>
      </div>
    );
  }

  /** An action landed: the window closes, the page says it once, and the list takes the change in place — what books each
   *  venue did not move, so there is nothing to read again. */
  const done = (text: string, patch: (r: LibraryRead) => LibraryRead) => {
    setAsking(null); setStack([]); setActionError(''); setSaid(text); setRead(r => r && patch(r));
  };
  const setActive = (id: string, isActive: boolean) => (r: LibraryRead) => ({ ...r, venues: r.venues.map(v => (v.id === id ? { ...v, isActive } : v)) });
  async function restore(v: LibraryVenue) {
    if (restoring) return; // one press, one request
    setRestoring(true);
    setActionError('');
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch(`/api/admin/org/venues?${q}`, jsonInit('POST', { action: 'restore-venue', id: v.id })).catch(() => null);
    setRestoring(false);
    if (!r?.ok) { setActionError(refusalText(r?.data, 'That venue couldn’t be brought back. Check your connection and try again.')); return; }
    done(W.broughtBack(v.name), setActive(v.id, true));
  }

  const table = (venues: LibraryVenue[], label: string) => (
    <>
      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table} aria-label={label}>
          <thead>
            <tr>
              <th scope="col">Venue</th>
              <th scope="col">Facilities</th>
              <th scope="col">{W.bookedByHeading}</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {venues.map(v => {
              const facilities = facilitiesWords(v);
              const booked = read?.usage[v.id] ? bookedBySummary(read.usage[v.id]) : null;
              return (
                <tr key={v.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; openFromPage({ kind: 'venue', id: v.id }); }}>
                  <td>
                    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); openFromPage({ kind: 'venue', id: v.id }); }}>{v.name}</button>
                    {v.address && <span className={repKit.cellSub}>{v.address}</span>}
                  </td>
                  <td className={facilities ? undefined : repKit.dim}>{facilities || W.noFacilities}</td>
                  <td className={booked ? undefined : repKit.dim}>{booked ?? W.nothingBooked}</td>
                  <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>
        <ClubRowFrame><ClubRowList inset label={label}>
          {venues.map(v => {
            const booked = read?.usage[v.id] ? bookedBySummary(read.usage[v.id]) : null;
            return (
              <ClubRow key={v.id} as="button" aria-haspopup="dialog" onClick={() => openFromPage({ kind: 'venue', id: v.id })} title={v.name}
                caption={[facilitiesWords(v) || W.noFacilities, booked ?? W.nothingBooked].join(' · ')} chevron />
            );
          })}
        </ClubRowList></ClubRowFrame>
      </div>
    </>
  );

  // ── The Permits view ──
  const money = !!permits?.canMoney;
  const permitsCanSave = !!permits?.canSave;
  async function exportPermits() {
    if (!permits) return;
    try {
      const headers = ['Permit', 'Issuer', 'Reference', 'Where', 'From', 'To', 'A week (h)', 'Held (h)', 'Booked (h)', 'Used', ...(money ? ['Cost'] : [])];
      const rows = permitList.map(p => [
        p.name, p.issuer ?? '', p.reference ?? '', whereLines(p).join('; '), p.startsOn, p.endsOn,
        hoursNumber(p.weekMinutes), hoursNumber(p.heldMinutes), hoursNumber(p.bookedMinutes),
        usedRatio(p.bookedMinutes, p.heldMinutes),
        ...(money ? [p.cost ?? null] : []),
      ]);
      const brand = await permitWorkbookBrand(q);
      await downloadXLSX(buildFilename({ org: slug, dataset: 'permits', scope: permits.year.name }, 'xlsx'), headers, rows, 'Permits', {
        columnNumFmts: headers.map(h => (h.endsWith('(h)') ? '0.0#' : h === 'Used' ? '0%' : h === 'Cost' ? '$#,##0.00' : undefined)),
        masthead: {
          title: `${currentOrg?.name ?? ''} · Permits`,
          subtitle: `The permits that start in ${permits.year.name} · ${permitList.length} permit${permitList.length === 1 ? '' : 's'}`,
          meta: `As at ${formatStoredDate(today, { longMonth: true })}`,
          logoDataUrl: brand.logoDataUrl,
        },
        notes: [{ runs: [
          { text: 'A week', bold: true }, { text: ': the hours held in one week. ' },
          { text: 'Held', bold: true }, { text: ': over the permit’s dates, less its dates off. ' },
          { text: 'Booked', bold: true }, { text: ': every program’s bookings inside the permit’s hours, each hour counted once.' },
        ] }],
        footer: brand.footer,
        print: brand.print,
      });
    } catch {
      setSaid('The file couldn’t be made. Please try again.');
    }
  }

  const permitsTable = permits && (
    <>
      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table} aria-label="Permits">
          <thead>
            <tr>
              <th scope="col">{PW.colPermit}</th>
              <th scope="col">{PW.colWhere}</th>
              <th scope="col">{PW.colDates}</th>
              <th scope="col" className={repKit.num}>{PW.colWeek}</th>
              <th scope="col" className={repKit.num}>{PW.colUsed}</th>
              {money && <th scope="col" className={repKit.num}>{PW.colCost}</th>}
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map(b => {
              const rows = permitList.filter(p => bandOf(p, today) === b.id);
              if (!rows.length) return null;
              return [
                <tr key={`band-${b.id}`} className={repKit.band}><td colSpan={money ? 7 : 6}>{b.label}</td></tr>,
                ...rows.map(p => {
                  const where = whereLines(p);
                  return (
                    <tr key={p.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; openFromPage({ kind: 'permit', id: p.id }); }}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); openFromPage({ kind: 'permit', id: p.id }); }}>{p.name}</button>
                        {(p.issuer || p.reference) && <span className={repKit.cellSub}>{[p.issuer, p.reference].filter(Boolean).join(' · ')}</span>}
                      </td>
                      <td>{where[0]}{where.slice(1).map(w => <span key={w} className={repKit.cellSub}>{w}</span>)}</td>
                      <td>{formatEventDateRange(p.startsOn, p.endsOn, true)}</td>
                      <td className={repKit.num}>{hoursWords(p.weekMinutes)}</td>
                      <td className={repKit.num}>{usedPercent(p.bookedMinutes, p.heldMinutes)}<span className={repKit.cellSub}>{usedOfWords(p.bookedMinutes, p.heldMinutes)}</span></td>
                      {money && <td className={`${repKit.num}${p.cost == null ? ` ${repKit.dim}` : ''}`}>{p.cost == null ? '—' : permitMoney(p.cost)}</td>}
                      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>
        <ClubRowFrame>
          {BANDS.map(b => {
            const rows = permitList.filter(p => bandOf(p, today) === b.id);
            if (!rows.length) return null;
            return (
              <ClubRowList key={b.id} inset label={b.label}>
                <ClubRowBand>{b.label}</ClubRowBand>
                {rows.map(p => (
                  <ClubRow key={p.id} as="button" aria-haspopup="dialog" onClick={() => openFromPage({ kind: 'permit', id: p.id })} title={p.name} chevron
                    caption={(
                      <>
                        {(p.issuer || p.reference) && <span className={pm.capLine}>{[p.issuer, p.reference].filter(Boolean).join(' · ')}</span>}
                        <span className={pm.capLine}>
                          {[formatEventDateRange(p.startsOn, p.endsOn, true), `${hoursWords(p.weekMinutes)} a week`,
                            p.startsOn <= today ? `${usedPercent(p.bookedMinutes, p.heldMinutes)} used` : '', money && p.cost != null ? permitMoney(p.cost) : '']
                            .filter(Boolean).join(' · ')}
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

  const viewSwitch = (
    <ViewSwitch views={[{ id: 'venues', label: PW.viewVenues }, { id: 'permits', label: PW.viewPermits }]} value={view}
      onChange={next => { setStack([]); setView(next); }} label="Show the library’s" />
  );

  // ── The windows, a level at a time ──
  const permitSteps = (id: string) => {
    if (stack.length !== 1) return undefined;
    const at = permitList.findIndex(p => p.id === id);
    if (at < 0 || permitList.length < 2) return undefined;
    const stepTo = (p: PermitListRow | undefined) => (p ? { name: p.name, onStep: () => swapTop({ kind: 'permit', id: p.id }) } : null);
    return { prev: stepTo(permitList[at - 1]), next: stepTo(permitList[at + 1]), position: `${at + 1} of ${permitList.length}`, noun: 'permit' };
  };
  const venueOf = (id: string) => read?.venues.find(v => v.id === id) ?? null;
  const topVenue = top?.kind === 'venue' ? venueOf(top.id) : null;
  const below = stack[stack.length - 2] ?? null;

  return (
    <div className={ck.pageWide}>
      {header}
      {view === 'venues' ? (
        <CoachListToolbar>
          {viewSwitch}
          <p className={kit.toolbarLede}>{W.lede}</p>
        </CoachListToolbar>
      ) : (
        <CoachListToolbar actions={(
          <>
            <button type="button" className={`btn btn-outline${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => void exportPermits()}
              disabled={!permitList.length} aria-label="Export">
              <Download size={15} aria-hidden /><span className={ck.btnWord}>Export</span>
            </button>
            {permitsCanSave && (
              <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => { setSaid(null); setAsking('add-permit'); }}
                aria-label={PW.addButton} id="org-permit-add-btn">
                <Plus size={15} aria-hidden /><span className={ck.btnWord}>{PW.addButton}</span>
              </button>
            )}
          </>
        )}>
          {viewSwitch}
          {permits && <YearPill year={permits.year.key} years={permits.years} onChange={y => { setStack([]); setYear(y); }} />}
        </CoachListToolbar>
      )}

      {view === 'permits' ? (
        permitsFailed ? (
          <LoadFailed title={PW.loadFailed} onRetry={() => void loadPermits()} />
        ) : !permits ? (
          <p className={ck.loading}>Loading…</p>
        ) : permitList.length === 0 ? (
          <EmptyCard icon={<FileClock size={28} aria-hidden />} title={PW.emptyTitle}
            action={permitsCanSave ? <button type="button" className="btn btn-lime" onClick={() => setAsking('add-permit')}><Plus size={14} aria-hidden /> {PW.addButton}</button> : undefined}>
            {PW.emptyBody}
          </EmptyCard>
        ) : permitsTable
      ) : failed ? (
        <LoadFailed title={W.loadFailed} onRetry={() => void load()} />
      ) : !read ? (
        <p className={ck.loading}>Loading…</p>
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyCard icon={<MapPin size={28} aria-hidden />} title={W.emptyTitle}
          action={canSave ? <button type="button" className="btn btn-lime" onClick={() => setAsking('add')}><Plus size={14} aria-hidden /> Add venue</button> : undefined}>
          {W.emptyBody}
        </EmptyCard>
      ) : (
        <>
          {active.length > 0 ? table(active, 'Venues') : <p className={ck.hint}>Every venue is archived.</p>}
          {archived.length > 0 && (
            <>
              <button type="button" className={own.archivedToggle} aria-expanded={showArchived} onClick={() => setShowArchived(s => !s)}>
                <ChevronDown size={14} aria-hidden />{W.archivedLine(archived.length)}
              </button>
              {showArchived && <div className={own.archived}>{table(archived, 'Archived venues')}</div>}
            </>
          )}
        </>
      )}

      {top?.kind === 'venue' && topVenue && read && (
        <VenueWindow
          q={q}
          venue={topVenue}
          usage={read.usage[topVenue.id]}
          permits={read.permits?.[topVenue.id] ?? []}
          onOpenPermit={id => push({ kind: 'permit', id })}
          canSave={canSave}
          list={stack.length === 1 ? (topVenue.isActive ? active : archived) : [topVenue]}
          onOpen={id => swapTop({ kind: 'venue', id })}
          actionError={actionError}
          onSaved={replaceVenue}
          onArchive={() => setAsking('archive')}
          onRestore={() => void restore(topVenue)}
          onDelete={() => setAsking('delete')}
          onClose={stack.length > 1 ? pop : close}
        />
      )}
      {top?.kind === 'permit' && (
        <PermitWindow
          key={top.id}
          q={q}
          orgSlug={slug}
          orgName={currentOrg?.name ?? ''}
          permitId={top.id}
          venues={read?.venues}
          steps={permitSteps(top.id)}
          startEditing={!!top.edit}
          said={top.said ?? null}
          onSaidDone={() => setStack(s => s.map((l, i) => (i === s.length - 1 && l.kind === 'permit' ? { ...l, said: null } : l)))}
          fromLine={below?.kind === 'line'}
          onOpenLine={(lineId, yearKey) => push({ kind: 'line', lineId, yearKey })}
          onChanged={permitChanged}
          onRenewed={(id, name) => {
            permitChanged();
            swapTop({ kind: 'permit', id, edit: true, said: PW.renewed(name) });
          }}
          onDeleted={name => { setStack([]); setSaid(PW.deleted(name)); permitChanged(); }}
          onClose={stack.length > 1 ? pop : close}
        />
      )}
      {top?.kind === 'line' && (
        <BudgetLineHandOff q={q} orgSlug={slug} lineId={top.lineId} yearKey={top.yearKey}
          onOpenPermit={id => push({ kind: 'permit', id })} onClose={pop} />
      )}
      {(asking === 'archive' || asking === 'delete') && topVenue && read && (
        <VenueQuestion q={q} kind={asking} venue={topVenue} usage={read.usage[topVenue.id]} onClose={() => setAsking(null)}
          onDone={() => (asking === 'archive'
            ? done(W.archived(topVenue.name), setActive(topVenue.id, false))
            : done(W.deleted(topVenue.name), r => ({ ...r, venues: r.venues.filter(v => v.id !== topVenue.id) })))} />
      )}
      {asking === 'add' && (
        <AddVenueWindow q={q} onClose={() => setAsking(null)} onAdded={v => done(W.added(v.name), r => ({
          ...r,
          venues: [...r.venues, v].sort((a, b) => a.name.localeCompare(b.name, 'en-CA', { numeric: true })),
          usage: { ...r.usage, [v.id]: NO_USAGE },
        }))} />
      )}
      {asking === 'add-permit' && read && (
        <AddPermitWindow q={q} venues={read.venues} money={money}
          onClose={() => setAsking(null)}
          onAdded={(id, name, startsOn, note) => {
            setAsking(null);
            setSaid(PW.added(name));
            // The new permit may start in another fiscal year: the list follows it to the year it starts in.
            const yearOf = [...(permits?.years ?? [])].map(y => y.key).filter(k => k <= startsOn).sort().pop() ?? null;
            if (yearOf && yearOf !== permits?.year.key) setYear(yearOf); else permitChanged();
            void load();
            openFromPage({ kind: 'permit', id, said: note ?? null });
          }} />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </div>
  );
}
