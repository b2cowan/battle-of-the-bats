'use client';
/**
 * PERMITS — THE TIME THE CLUB HOLDS, A PLACE OF ITS OWN (⚖ Club Tier Stage 13c Session A — Ask 1 A, C1 = A, C2 = A, owner
 * 2026-11-08; drawing CLUB_TIER_STAGE13C_DRAWINGS.html, the Permits place). MOVED, not copied, from Organization › Venue
 * library's `?view=permits` (Club Tier Stage 10a; that address now lands here).
 *
 *   the place   — "Permits" in the rail between Calendar and Schedules (`kitPermitsLink`), the More sheet's lone row; the
 *                 pinned bar names it and, a one-page place, draws no tab row.
 *   the toolbar — the Fiscal year pill (the year a permit STARTS in, Ask 2), then Export (Excel, the house format) and
 *                 "+ Add permit", the one lime, for savers (`canSaveVenueLibrary`). A year with no permits has nothing to export,
 *                 so Export is absent there, never a dead button (§296 W1).
 *   the table   — Permit (issuer · reference under it) · Where · Dates · A week · Used ("51.5 of 80 h" under it) · Cost · a
 *                 chevron, in bands In use now · Starts later · Ended. ⚖ A permit's MONEY reads only to those who hold the
 *                 club's Accounting (`canMoveClubMoney`): for anyone else the Cost column is absent.
 *   the flag    — NEW (13c): a permit whose dates off from today on took bookings says "2 dates off · 8 bookings on them" under
 *                 its name; the row opens the permit, whose window opens with the notice (`PermitWindow`). Everyone who reads
 *                 the list reads the flag, the treasurer included.
 *   ?permit=id  — opens that permit's window (the Overview's card and the notice's own doors land here).
 *
 * ⚖ WHO (unchanged from the Venue library's Permits view): everyone who opens the Venue library reads it (a coach never: the
 * route refuses them); the owner, an admin, a league admin and anyone granted the tournament permission save.
 * ⚠ A FAILED LOAD says so, with Try again — never an empty list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronRight, Download, FileClock, MapPin, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { moneyFetch } from '@/lib/money-fetch';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import { isUuid } from '@/lib/utils';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { CoachListToolbar } from '@/components/coaches/kit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { AddPermitWindow, PermitWindow } from '@/components/admin/kit/club/PermitWindows';
import { clubWorkbookBrand } from '@/lib/export/club-schedule-export';
import { BudgetLineHandOff } from '@/components/admin/kit/club/money/BudgetWindows';
import YearPill from '@/components/admin/kit/club/money/YearPill';
import pm from '@/components/admin/kit/club/Permits.module.css';
import type { LibraryVenue } from '@/lib/venue-library';
import {
  PERMIT_WORDS as PW, facilityListWords, hoursNumber, hoursWords, permitMoney, takenFlag, usedOfWords, usedPercent, usedRatio,
} from '@/lib/permit-words';
import { buildFilename, downloadXLSX } from '@/lib/export';
import type { PermitListRow, PermitsYearRead } from '@/lib/permit-server';
import LoadingState from '@/components/shared/LoadingState';

/** A window over the page, and the windows opened from it (3d's door rule: each × goes back one level). */
type Level =
  | { kind: 'permit'; id: string; edit?: boolean; said?: string | null }
  | { kind: 'line'; lineId: string; yearKey: string };

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

export default function PermitsPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  usePageTitle(PW.placeTitle);
  const isPhone = useIsPhone();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const planAllowed = hasOrgVenueLibrary(currentOrg?.planId);

  const [permits, setPermits] = useState<PermitsYearRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [year, setYear] = useState<string | null>(null);
  const [stack, setStack] = useState<Level[]>([]);
  const [adding, setAdding] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug || !planAllowed) return;
    const current = beginRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<PermitsYearRead>(`/api/admin/org/permits?${q}${year ? `&year=${encodeURIComponent(year)}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setPermits(r.data);
  }, [slug, planAllowed, q, year, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // The club's venues, for a permit's form (the library's one read; Add permit offers them, the window reads them).
  const [venues, setVenues] = useState<LibraryVenue[] | null>(null);
  const loadVenues = useCallback(async () => {
    if (!slug || !planAllowed) return;
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<{ venues: LibraryVenue[] }>(`/api/admin/org/venues?${q}&library=1`).catch(() => null);
    if (r?.ok) setVenues(r.data.venues);
  }, [slug, planAllowed, q]);
  useDeferredLoad(!orgLoading && !!slug, loadVenues);

  // ?permit=<id> opens that permit once (the Overview's card and the notice's doors land here).
  const askedFor = search.get('permit');
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !askedFor || !isUuid(askedFor)) return;
    opened.current = true;
    setStack([{ kind: 'permit', id: askedFor }]);
  }, [askedFor]);

  const today = tournamentToday();
  const permitList = useMemo(() => {
    const rows = permits?.permits ?? [];
    return BANDS.flatMap(b => rows.filter(p => bandOf(p, today) === b.id));
  }, [permits, today]);
  const money = !!permits?.canMoney;

  const top = stack[stack.length - 1] ?? null;
  const below = stack[stack.length - 2] ?? null;
  // A permit's one-time asks (open in its form, a notice) are spent once it is covered: back on top, it reads (/review 10a).
  const spent = (l: Level): Level => (l.kind === 'permit' ? { ...l, edit: false, said: null } : l);
  const push = (l: Level) => { setSaid(null); setStack(s => [...s.map(spent), l]); };
  const pop = () => setStack(s => s.slice(0, -1));
  const swapTop = (l: Level) => setStack(s => [...s.slice(0, -1), l]);
  const openFromPage = (l: Level) => { setSaid(null); setStack([l]); };
  const close = () => setStack([]);

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
      const brand = await clubWorkbookBrand(q);
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

  // The toolbar's two doors: at a desk they end the toolbar line (specimen 1); on a phone they are the head's two icons,
  // never a row of their own (specimen 13 — /design 10a).
  const doors = (
    <>
      {permitList.length > 0 && (
        <button type="button" className={`btn btn-outline${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => void exportPermits()}
          aria-label="Export">
          <Download size={15} aria-hidden /><span className={ck.btnWord}>Export</span>
        </button>
      )}
      {!!permits?.canSave && (
        <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => { setSaid(null); setAdding(true); }}
          aria-label={PW.addButton} id="org-permit-add-btn" disabled={!venues}>
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>{PW.addButton}</span>
        </button>
      )}
    </>
  );
  const header = <TabPageHeader title={PW.placeTitle} inlineActions actions={planAllowed && isPhone && permits ? doors : undefined} />;

  if (orgLoading) return <PageLoading header={header} label="Loading the club’s permits…" />;
  if (!planAllowed) {
    return (
      <div className={ck.pageWide}>
        {header}
        <EmptyCard icon={<MapPin size={28} aria-hidden />} title="Permits aren’t on your plan">{PW.planLocked}</EmptyCard>
      </div>
    );
  }

  /** "2 dates off · 8 bookings on them" — the row's flag (13c), only while its dates off still hold bookings. */
  const flagOf = (p: PermitListRow) => {
    const t = permits?.taken?.[p.id];
    if (!t?.bookings) return null;
    return <span className={pm.takenFlag}><AlertTriangle size={13} aria-hidden />{takenFlag(t.dates, t.bookings)}</span>;
  };

  const table = permits && (
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
                        {flagOf(p)}
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
                        {flagOf(p)}
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

  // ── The windows, a level at a time ──
  const permitSteps = (id: string) => {
    if (stack.length !== 1) return undefined;
    const at = permitList.findIndex(p => p.id === id);
    if (at < 0 || permitList.length < 2) return undefined;
    const stepTo = (p: PermitListRow | undefined) => (p ? { name: p.name, onStep: () => swapTop({ kind: 'permit', id: p.id }) } : null);
    return { prev: stepTo(permitList[at - 1]), next: stepTo(permitList[at + 1]), position: `${at + 1} of ${permitList.length}`, noun: 'permit' };
  };

  return (
    <div className={ck.pageWide}>
      {header}
      <CoachListToolbar actions={isPhone ? undefined : doors}>
        {permits && <YearPill year={permits.year.key} years={permits.years} onChange={y => { setStack([]); setYear(y); }} />}
      </CoachListToolbar>

      {failed ? (
        <LoadFailed title={PW.loadFailed} onRetry={() => void load()} />
      ) : !permits ? (
        <LoadingState label="Loading the club’s permits…" />
      ) : permitList.length === 0 ? (
        // No door of its own: Add permit is the screen's one lime, at the top (/design 10a).
        <EmptyCard icon={<FileClock size={28} aria-hidden />} title={PW.emptyTitle}>
          {PW.emptyBody}
        </EmptyCard>
      ) : table}

      {top?.kind === 'permit' && (
        <PermitWindow
          key={top.id}
          q={q}
          orgSlug={slug}
          orgName={currentOrg?.name ?? ''}
          permitId={top.id}
          venues={venues ?? undefined}
          steps={permitSteps(top.id)}
          startEditing={!!top.edit}
          said={top.said ?? null}
          onSaidDone={() => setStack(s => s.map((l, i) => (i === s.length - 1 && l.kind === 'permit' ? { ...l, said: null } : l)))}
          fromLine={below?.kind === 'line'}
          onOpenLine={(lineId, yearKey) => push({ kind: 'line', lineId, yearKey })}
          onChanged={() => void load()}
          onRenewed={(id, name) => {
            void load();
            swapTop({ kind: 'permit', id, edit: true, said: PW.renewed(name) });
          }}
          onDeleted={name => { setStack([]); setSaid(PW.deleted(name)); void load(); }}
          onClose={stack.length > 1 ? pop : close}
        />
      )}
      {top?.kind === 'line' && (
        <BudgetLineHandOff q={q} orgSlug={slug} lineId={top.lineId} yearKey={top.yearKey}
          onOpenPermit={id => push({ kind: 'permit', id })} onClose={pop} />
      )}
      {adding && venues && (
        <AddPermitWindow q={q} venues={venues} money={money}
          onClose={() => setAdding(false)}
          onAdded={(id, name, startsOn, note) => {
            setAdding(false);
            setSaid(PW.added(name));
            // The new permit may start in another fiscal year: the list follows it to the year it starts in.
            const yearOf = [...(permits?.years ?? [])].map(y => y.key).filter(k => k <= startsOn).sort().pop() ?? null;
            if (yearOf && yearOf !== permits?.year.key) setYear(yearOf); else void load();
            openFromPage({ kind: 'permit', id, said: note ?? null });
          }} />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </div>
  );
}
