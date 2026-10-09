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
 * ⚖ WHO SAVES (Ask 9): the owner, an admin, a league admin, and anyone granted the tournament permission. Everyone else
 * who can open Organization READS it — no Add venue, no pencil, no Archive or Delete. A refused save says why in the
 * window (the route's words), never silently.
 * ⚠ A FAILED LOAD says so, with Try again — never an empty library (S6-09: "No venues in your library yet" over a failed
 * read invited the club to add its venues twice).
 * ⚠ THE OLD LOOK IS GONE from this page (its legacy header and its kit-scoped layer): the stylesheet it shared is the
 * tournament's Venues & Facilities screen's alone now, until Tournament Stage 5.
 */
import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachListToolbar } from '@/components/coaches/kit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  ClubRow, ClubRowFrame, ClubRowList, EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { AddVenueWindow, VenueQuestion, VenueWindow } from '@/components/admin/kit/club/VenueLibraryWindows';
import own from '@/components/admin/kit/club/VenueLibrary.module.css';
import { NO_USAGE, VENUE_LIBRARY_WORDS as W, bookedBySummary, type LibraryVenue, type VenueUsage } from '@/lib/venue-library';

interface LibraryRead { venues: LibraryVenue[]; usage: Record<string, VenueUsage>; canSave: boolean }

const facilitiesWords = (v: LibraryVenue) =>
  [...v.facilities].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.name).join(' · ');

export default function VenueLibraryPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  usePageTitle('Venue library');
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const planAllowed = hasOrgVenueLibrary(currentOrg?.planId);

  const [read, setRead] = useState<LibraryRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState<'add' | 'archive' | 'delete' | null>(null);
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

  const active = useMemo(() => (read?.venues ?? []).filter(v => v.isActive), [read]);
  const archived = useMemo(() => (read?.venues ?? []).filter(v => !v.isActive), [read]);
  const open = openId && read ? read.venues.find(v => v.id === openId) ?? null : null;
  const canSave = !!read?.canSave;
  /* Stable across renders: the window's autosave rebuilds its save from it, and a fresh one every page render would
     restart the autosave's wait (/review 6b). */
  const replaceVenue = useCallback((v: LibraryVenue) => setRead(r => r && { ...r, venues: r.venues.map(x => (x.id === v.id ? v : x)) }), []);

  const header = (
    <AdminPageHeader
      eyebrow="Organization"
      title="Venue library"
      actions={planAllowed && canSave ? (
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
    setAsking(null); setOpenId(null); setActionError(''); setSaid(text); setRead(r => r && patch(r));
  };
  const setActive = (id: string, isActive: boolean) => (r: LibraryRead) => ({ ...r, venues: r.venues.map(v => (v.id === id ? { ...v, isActive } : v)) });
  const openVenue = (id: string | null) => { setSaid(null); setActionError(''); setOpenId(id); };
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
                <tr key={v.id} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; openVenue(v.id); }}>
                  <td>
                    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); openVenue(v.id); }}>{v.name}</button>
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
              <ClubRow key={v.id} as="button" aria-haspopup="dialog" onClick={() => { openVenue(v.id); }} title={v.name}
                caption={[facilitiesWords(v) || W.noFacilities, booked ?? W.nothingBooked].join(' · ')} chevron />
            );
          })}
        </ClubRowList></ClubRowFrame>
      </div>
    </>
  );

  return (
    <div className={ck.pageWide}>
      {header}
      <CoachListToolbar lede={W.lede} />

      {failed ? (
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

      {open && read && (
        <VenueWindow
          q={q}
          venue={open}
          usage={read.usage[open.id]}
          canSave={canSave}
          list={open.isActive ? active : archived}
          onOpen={openVenue}
          actionError={actionError}
          onSaved={replaceVenue}
          onArchive={() => setAsking('archive')}
          onRestore={() => void restore(open)}
          onDelete={() => setAsking('delete')}
          onClose={() => openVenue(null)}
        />
      )}
      {(asking === 'archive' || asking === 'delete') && open && read && (
        <VenueQuestion q={q} kind={asking} venue={open} usage={read.usage[open.id]} onClose={() => setAsking(null)}
          onDone={() => (asking === 'archive'
            ? done(W.archived(open.name), setActive(open.id, false))
            : done(W.deleted(open.name), r => ({ ...r, venues: r.venues.filter(v => v.id !== open.id) })))} />
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
