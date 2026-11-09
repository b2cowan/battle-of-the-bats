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
 * ⚠ A FAILED LOAD says so, with Try again — never an empty library (S6-09: "No venues in your library yet" over a failed
 * read invited the club to add its venues twice).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
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
import { NO_USAGE, VENUE_LIBRARY_WORDS as W, bookedBySummary, type LibraryVenue, type VenueUsage } from '@/lib/venue-library';
import { PERMIT_WORDS as PW } from '@/lib/permit-words';
import type { VenuePermitRow } from '@/lib/permit-server';
import LoadingState from '@/components/shared/LoadingState';

interface LibraryRead { venues: LibraryVenue[]; usage: Record<string, VenueUsage>; permits?: Record<string, VenuePermitRow[]>; canSave: boolean }

/** A window over the page, and the windows opened from it (3d's door rule: each × goes back one level). */
type Level =
  | { kind: 'venue'; id: string }
  | { kind: 'permit'; id: string; edit?: boolean; said?: string | null }
  | { kind: 'line'; lineId: string; yearKey: string };

const facilitiesWords = (v: LibraryVenue) =>
  [...v.facilities].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.name).join(' · ');

export default function VenueLibraryPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
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

  const header = (
    <TabPageHeader
      eyebrow="Organization"
      title="Venue library"
      inlineActions
      actions={planAllowed && canSave ? (
        <button type="button" className={`btn btn-lime${isPhone ? ` ${ck.iconOnlyPhone}` : ''}`} onClick={() => { setSaid(null); setAsking('add'); }}
          aria-label="Add venue" id="org-venue-add-btn">
          <Plus size={15} aria-hidden /><span className={ck.btnWord}>Add venue</span>
        </button>
      ) : undefined}
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

  const venueOf = (id: string) => read?.venues.find(v => v.id === id) ?? null;
  const topVenue = top?.kind === 'venue' ? venueOf(top.id) : null;
  const below = stack[stack.length - 2] ?? null;

  return (
    <div className={ck.pageWide}>
      {header}
      <CoachListToolbar>
        <p className={kit.toolbarLede}>{W.lede}</p>
      </CoachListToolbar>

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
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </div>
  );
}
