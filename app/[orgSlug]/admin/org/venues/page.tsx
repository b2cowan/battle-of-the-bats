'use client';
/**
 * Organization › VENUE LIBRARY (Club Tier Stage 6b, Ask 9 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, specimen 6; design log
 * 2026-10-09 (4)). Once the coach's picker reads it (6a), the library is the club's ONE venue book, and it holds up to
 * that:
 *
 *   the page   — the 1200px column. Title "Venue library" (eyebrow Organization), Add venue — the one lime, and it ASKS —
 *                for whoever saves. The lede in the toolbar names every program. A table: Venue (the name the link, the
 *                address under it) · Facilities (the count, the names under it in the club's order) · under "Booked this
 *                season", a column each for Teams, House league and Tournaments · one chevron; the whole row opens. No
 *                cell is a dotted line (owner 2026-11-26). A quiet "N archived venues" line opens them. On a phone the
 *                table is the kit's white rows with a chevron: the name, then one sentence saying what books it.
 *   a venue    — the read-first window (`VenueWindow`): it reads, the pencil edits it whole, saving as you go. Its Permits
 *                section lists the permits holding time there, each opening its window over the venue's.
 *   archive    — a venue anything books (past included) offers Archive; one nothing books offers Delete (red, asks).
 *
 * ⚖ PERMITS ARE A PLACE OF THEIR OWN (Club Tier Stage 13c — Ask 1 A, C1 = A, owner 2026-11-08): the club's permits list
 * moved to Permits (`/admin/permits`, the rail between Calendar and Schedules), and the Venues | Permits switch went with
 * it. The old address keeps working: `?view=permits` lands on Permits (bookmarks, help links, exported links).
 *
 * ⚖ WHO SAVES (Ask 9): the owner, an admin, a league admin, and anyone granted the tournament permission. Everyone else
 * who can open Organization READS it — no Add venue, no pencil, no Archive or Delete. A refused save says why in the
 * window (the route's words), never silently.
 * ⚖ CLOSE A PLACE (Club Website Stage 2, K1, K11): the toolbar's "Close a place" is one of the window's three buttons (the
 * Overview's and the house league schedule's are the others, same words and icon, owner 2026-11-26). The closures showing
 * sit at the top in ONE box, "Closed places" (`ClosedPlacesBox`; S4, owner 2026-11-26): under a heading per day, a row
 * per park and dates ("Diamond 1 and Diamond 2 at Lions Park"), plain lines under it (who closed it; what it did to
 * games, each game once), its own Reopen; with "All our fields" showing, every other row sits under it ("Also closed on
 * their own"). Ticks reopen several in one press (owner 2026-11-27): one ticked row opens that row's window, two or more
 * the several window. A venue's row wears "Closed today" for the whole park or every place, else "2 diamonds closed
 * today", and the same for tomorrow. One that ended by itself at Until is gone. Owner, admin, house league admin only.
 * ⚠ A FAILED LOAD says so, with Try again — never an empty library (S6-09: "No venues in your library yet" over a failed
 * read invited the club to add its venues twice).
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, CloudRain, MapPin, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import {
  CLOSE_WORDS as CW, canClosePlace, venueTags, type CloseFrame, type ClosureRow, type StaffClosure,
} from '@/lib/place-closure-window';
import { tournamentToday } from '@/lib/timezone';
import ClosePlaceWindow from '@/components/admin/kit/club/places/ClosePlaceWindow';
import ReopenPlaceWindow from '@/components/admin/kit/club/places/ReopenPlaceWindow';
import ReopenSeveralWindow from '@/components/admin/kit/club/places/ReopenSeveralWindow';
import ClosedPlacesBox from '@/components/admin/kit/club/places/ClosedPlacesBox';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
// ⚖ Inside Organization (Club Tier Stage 13i, A5) the place names this tab, so only its actions remain (TabPageHeader).
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { AddVenueWindow, VenueQuestion, VenueWindow } from '@/components/admin/kit/club/VenueLibraryWindows';
import { PermitWindow } from '@/components/admin/kit/club/PermitWindows';
import { BudgetLineHandOff } from '@/components/admin/kit/club/money/BudgetWindows';
import own from '@/components/admin/kit/club/VenueLibrary.module.css';
import { NO_USAGE, VENUE_LIBRARY_WORDS as W, bookedSentence, facilitiesCell, type LibraryVenue, type VenueUsage } from '@/lib/venue-library';
import { PERMIT_WORDS as PW } from '@/lib/permit-words';
import type { VenuePermitRow } from '@/lib/permit-server';
import LoadingState from '@/components/shared/LoadingState';

interface LibraryRead { venues: LibraryVenue[]; usage: Record<string, VenueUsage>; permits?: Record<string, VenuePermitRow[]>; canSave: boolean }

/** A window over the page, and the windows opened from it (3d's door rule: each × goes back one level). */
type Level =
  | { kind: 'venue'; id: string }
  | { kind: 'permit'; id: string; edit?: boolean; said?: string | null }
  | { kind: 'line'; lineId: string; yearKey: string };

export default function VenueLibraryPage() {
  const { currentOrg, loading: orgLoading, userRole } = useOrg();
  usePageTitle('Venue library');
  const isPhone = useIsPhone();
  const router = useRouter();
  const search = useSearchParams();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const planAllowed = hasOrgVenueLibrary(currentOrg?.planId);
  // The old address of the permits list (Club Tier 10a's switch): it lands on the Permits place (13c).
  const oldPermitsAddress = search.get('view') === 'permits';
  useEffect(() => {
    if (oldPermitsAddress && slug) router.replace(`/${slug}/admin/permits`);
  }, [oldPermitsAddress, slug, router]);

  const [read, setRead] = useState<LibraryRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [stack, setStack] = useState<Level[]>([]);
  const [asking, setAsking] = useState<'add' | 'archive' | 'delete' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  /** Why Bring back didn't go through — said beside its button, in the window. */
  const [actionError, setActionError] = useState('');
  const [restoring, setRestoring] = useState(false);
  // Close a place (Club Website Stage 2): the closures showing now, and the two windows.
  const canClose = canClosePlace(userRole);
  // S4: the closures showing, the box's rows (counted by the server) and the places whose facilities are all diamonds.
  const [shut, setShut] = useState<{ closures: StaffClosure[]; rows: ClosureRow[]; diamondParks: Set<string> }>(
    () => ({ closures: [], rows: [], diamondParks: new Set() }));
  const [closing, setClosing] = useState<{ venueId: string | null } | null>(null);
  // The rows being reopened, and the box as it stood then: the reload after a Reopen drops them, and the window still
  // shows the result.
  const [reopening, setReopening] = useState<{ picked: ClosureRow[]; shut: typeof shut } | null>(null);
  // The box's ticked rows, by key. Cleared whenever the closures are read, so a closure that has since joined a row is
  // never ticked by itself.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const tick = (keys: readonly string[], on: boolean) => setTicked(t => {
    const next = new Set(t);
    for (const k of keys) if (on) next.add(k); else next.delete(k);
    return next;
  });
  const loadClosures = useCallback(async () => {
    if (!slug || !planAllowed || !canClose) return;
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await fetch(`/api/admin/org/place-closures?${q}`, { cache: 'no-store' }).catch(() => null);
    const d = (r?.ok ? await r.json().catch(() => null) : null) as { closures?: StaffClosure[]; rows?: ClosureRow[]; frame?: CloseFrame } | null;
    setShut({
      closures: d?.closures ?? [], rows: d?.rows ?? [],
      diamondParks: new Set((d?.frame?.venues ?? []).filter(v => v.allDiamonds).map(v => v.id)),
    });
    setTicked(new Set());
  }, [slug, planAllowed, canClose, q]);
  useDeferredLoad(!orgLoading && !!slug && canClose, loadClosures);
  const today = tournamentToday();
  const tagsOf = (id: string) => venueTags(shut.closures, id, today);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug || !planAllowed || oldPermitsAddress) return;
    const current = beginRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<LibraryRead>(`/api/admin/org/venues?${q}&library=1`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setRead(r.data);
  }, [slug, planAllowed, oldPermitsAddress, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const active = useMemo(() => (read?.venues ?? []).filter(v => v.isActive), [read]);
  const archived = useMemo(() => (read?.venues ?? []).filter(v => !v.isActive), [read]);
  const canSave = !!read?.canSave;
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

  // The toolbar's two doors: at a desk they share the lede's row (owner 2026-11-26); on a phone they stay in the page's
  // action row above it, so the sentence never pushes them down.
  const doors = (
    <>
      {canClose && (
        <button type="button" className="btn btn-outline" onClick={() => { setSaid(null); setClosing({ venueId: null }); }}>
          <CloudRain size={16} aria-hidden />{CW.door}
        </button>
      )}
      {canSave && (
        <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => { setSaid(null); setAsking('add'); }}
          aria-label="Add venue" id="org-venue-add-btn">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add venue</span>
        </button>
      )}
    </>
  );
  const header = (
    <TabPageHeader
      eyebrow="Organization"
      title="Venue library"
      inlineActions
      actions={planAllowed && isPhone && (canSave || canClose) ? doors : undefined}
    />
  );

  if (orgLoading || oldPermitsAddress) return <PageLoading header={header} label="Loading the Venue library…" />;
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

  /** A booking column's cell: how many (or the word that stands for any), a quiet dash for none. */
  const count = (n: number | undefined, word?: string) => (
    <td className={`${repKit.num}${n ? '' : ` ${repKit.dim}`}`}>{n ? word ?? n : '—'}</td>
  );

  const table = (venues: LibraryVenue[], label: string) => (
    <>
      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table} aria-label={label}>
          <colgroup span={2} />
          <colgroup span={3} />
          <colgroup />
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className={own.headFoot}>Venue</th>
              <th scope="col" rowSpan={2} className={own.headFoot}>Facilities</th>
              <th scope="colgroup" colSpan={3} className={own.groupHead}>{W.bookedColumns.group}</th>
              <th scope="col" rowSpan={2} className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
            <tr>
              <th scope="col" className={`${repKit.num} ${own.countHead}`}>{W.bookedColumns.teams}</th>
              <th scope="col" className={`${repKit.num} ${own.countHead}`}>{W.bookedColumns.league}</th>
              <th scope="col" className={`${repKit.num} ${own.countHead}`}>{W.bookedColumns.tournaments}</th>
            </tr>
          </thead>
          <tbody>
            {venues.map(v => {
              const facilities = facilitiesCell(v.facilities);
              const use = read?.usage[v.id];
              const tags = tagsOf(v.id);
              return (
                <tr key={v.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; openFromPage({ kind: 'venue', id: v.id }); }}>
                  <td>
                    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); openFromPage({ kind: 'venue', id: v.id }); }}>{v.name}</button>
                    {tags.map(tag => <Fragment key={tag}> <span className={`${repKit.chip} ${repKit.chipWarn}`}>{tag}</span></Fragment>)}
                    {v.address && <span className={repKit.cellSub}>{v.address}</span>}
                  </td>
                  <td className={facilities ? undefined : repKit.dim}>
                    {facilities ? <><span className={own.facilityCount}>{facilities.count}</span><span className={repKit.cellSub}>{facilities.names}</span></> : W.noFacilities}
                  </td>
                  {count(use?.teams.length)}
                  {count(use?.seasons.length, W.bookedColumns.leagueYes)}
                  {count(use?.tournaments.length)}
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
            const tags = tagsOf(v.id);
            return (
              <ClubRow key={v.id} as="button" aria-haspopup="dialog" onClick={() => openFromPage({ kind: 'venue', id: v.id })}
                title={<>{v.name}{tags.map(tag => <span key={tag} className={`${repKit.chip} ${repKit.chipWarn}`}>{tag}</span>)}</>}
                caption={bookedSentence(read?.usage[v.id])} chevron />
            );
          })}
        </ClubRowList></ClubRowFrame>
      </div>
    </>
  );

  const venueOf = (id: string) => read?.venues.find(v => v.id === id) ?? null;
  const topVenue = top?.kind === 'venue' ? venueOf(top.id) : null;
  const below = stack[stack.length - 2] ?? null;

  return (
    <div className={ck.pageWide}>
      {header}
      <CoachListToolbar actions={isPhone ? undefined : doors}>
        <p className={kit.toolbarLede}>{W.lede}</p>
      </CoachListToolbar>

      {shut.rows.length > 0 && (
        <ClosedPlacesBox rows={shut.rows} today={today} ticked={ticked} onTick={tick}
          onReopen={picked => setReopening({ picked, shut })} />
      )}

      {failed ? (
        <LoadFailed title={W.loadFailed} onRetry={() => void load()} />
      ) : !read ? (
        <LoadingState label="Loading the Venue library…" />
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
      {closing && (
        <ClosePlaceWindow
          orgSlug={slug}
          eyebrow={CW.eyebrow}
          initialVenueId={closing.venueId}
          venueLibraryHref={`/${slug}/admin/org/venues`}
          onOpenVenueLibrary={canSave ? () => setAsking('add') : undefined}
          onClosed={() => { void loadClosures(); }}
          onClose={() => setClosing(null)}
        />
      )}
      {reopening && (reopening.picked.length === 1 ? (
        <ReopenPlaceWindow orgSlug={slug} row={reopening.picked[0]} rows={reopening.shut.rows} closures={reopening.shut.closures}
          diamondParks={reopening.shut.diamondParks} onReopened={() => { void loadClosures(); }} onClose={() => setReopening(null)} />
      ) : (
        <ReopenSeveralWindow orgSlug={slug} picked={reopening.picked} rows={reopening.shut.rows} closures={reopening.shut.closures}
          diamondParks={reopening.shut.diamondParks} onReopened={() => { void loadClosures(); }} onClose={() => setReopening(null)} />
      ))}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </div>
  );
}
