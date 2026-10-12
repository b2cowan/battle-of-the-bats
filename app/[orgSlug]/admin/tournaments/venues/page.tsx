'use client';
/**
 * VENUES & FACILITIES — Tournament admin redesign Stage 5 (E5, A51; F87), built to hub v45, ruled 2026-10-10.
 *
 *   phone   one white frame, a row per venue: its name, its diamonds named ("Diamond 1 · Diamond 2", or "No diamonds yet"
 *           in amber — a schedule can't put a game there), and its games on the right
 *   desk    a table: Venue (and "From the club's Venue library") · Address · Diamonds · Games
 *
 * Every row opens the venue's RECORD (VenueRecord — the Venue library venue's shape): it reads first, the pencil edits
 * the venue and its diamonds in one form, the in-use rule is said before any tap, Delete ends it. The fold-open action
 * bar, the per-facility windows and the four-line address went. "Add a venue" is ONE window (AddVenuesWindow): the
 * club's library first (or "your venues"), then a new venue with its count; Import from Library is inside it, and
 * ?import=library (the schedule's empty state) opens it. Export stays the title band's one button.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability } from '@/lib/roles';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubRow, ClubRowList, EmptyCard, LoadFailed, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import VenueRecord, { type RecordFacility, type RecordVenue } from '@/components/admin/tournament/VenueRecord';
import AddVenuesWindow from '@/components/admin/tournament/AddVenuesWindow';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/types';
import { facilityKindForSport, facilityNoun } from '@/lib/venue-facilities';
import { VENUE_WORDS as W, lanesLine, noLanes } from '@/lib/tournament-venue-words';
import styles from './venues.module.css';
import LoadingState from '@/components/shared/LoadingState';

const VENUES_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Venue Name',     key: 'name',         format: 'text' },
  { label: 'Facility',       key: 'facilityName', format: 'text' },
  { label: 'Facility Type',  key: 'facilityType', format: 'text' },
  { label: 'Address',        key: 'address',      format: 'text' },
  { label: 'Notes',          key: 'notes',        format: 'text' },
];

/** Venues & facilities' "?" (A56): its own help sub-topic. */
const VENUES_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['venues-contacts-rules'], subtopicId: 'venues-records' };

/** A venue as the list reads it: the record's facts, each lane with its kind (the export says it). */
type ListVenue = Omit<RecordVenue, 'facilities'> & { facilities?: Array<RecordFacility & { facilityType?: FacilityType }> };

export default function TournamentVenuesPage() {
  const { currentTournament } = useTournament();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Venues & Facilities');
  const orgSlug = currentOrg?.slug ?? '';
  const canWrite = Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'));
  const kind = facilityKindForSport(currentTournament?.sport ?? null);
  // The library's door, for those who may open it: a plan with a library, an owner or admin (Club 6b's "who can save").
  const libraryHref = hasOrgVenueLibrary(currentOrg?.planId) && (userRole === 'owner' || userRole === 'admin')
    ? `/${orgSlug}/admin/org/venues` : null;

  const [venues, setVenues] = useState<ListVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const tournamentId = currentTournament?.id;
  /** Re-reads the list; false when it didn't load (the record then keeps what it saved rather than the old list). */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!tournamentId) return false;
    try {
      const res = await fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}&orgSlug=${encodeURIComponent(orgSlug)}&withGameCounts=1`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) throw new Error('The venues didn’t load.');
      setVenues(data as ListVenue[]);
      setError('');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The venues didn’t load.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [tournamentId, orgSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own venues
    setLoading(true);
    setOpenId(null);
    setAdding(false);
    void refresh();
  }, [refresh]);

  // The schedule's empty state links ?import=library: the one Add a venue window, which holds the library.
  const searchParams = useSearchParams();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an address that asks for the window opens it
    if (canWrite && searchParams.get('import') === 'library') setAdding(true);
  }, [canWrite, searchParams]);

  // ── Export (unchanged: one row per facility) ──
  function buildExportRows() {
    return venues.flatMap(v =>
      (v.facilities ?? []).length > 0
        ? (v.facilities ?? []).map(f => ({
          name: v.name,
          facilityName: f.name,
          facilityType: f.facilityType ? FACILITY_TYPE_LABELS[f.facilityType] : '',
          address: v.address ?? '',
          notes: v.notes ?? '',
        }))
        : [{ name: v.name, facilityName: '', facilityType: '', address: v.address ?? '', notes: v.notes ?? '' }],
    );
  }
  function handleExportXLSX() {
    const filename = buildFilename({ org: currentTournament?.slug ?? 'org', dataset: 'venues' }, 'xlsx');
    downloadXLSX(filename, serializeHeaders(VENUES_EXPORT_COLS), serializeRows(buildExportRows(), VENUES_EXPORT_COLS), 'Venues');
  }
  function handleExportCSV() {
    const filename = buildFilename({ org: currentTournament?.slug ?? 'org', dataset: 'venues' }, 'csv');
    downloadCSVBlob(filename, generateCSV(serializeHeaders(VENUES_EXPORT_COLS), serializeRows(buildExportRows(), VENUES_EXPORT_COLS)));
  }

  const lanesOf = (v: ListVenue) => [...(v.facilities ?? [])].sort((a, b) => a.displayOrder - b.displayOrder).map(f => f.name);
  const lanesCaption = (v: ListVenue) => {
    const names = lanesOf(v);
    return names.length ? lanesLine(names) : <span className={styles.none}>{noLanes(kind)}</span>;
  };
  const idx = openId ? venues.findIndex(v => v.id === openId) : -1;
  const open = idx >= 0 ? venues[idx] : null;

  const addButton = canWrite && tournamentId ? (
    <button
      type="button"
      className={`btn btn-outline btn-data ${screenParts.headerButton}`}
      onClick={() => setAdding(true)}
      aria-label={W.add}
      title={W.add}
      aria-haspopup="dialog"
    >
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{W.add}</span>
    </button>
  ) : null;

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={W.title}
        inlineActions
        actions={(
          <>
            {addButton}
            <ExportMenu formats={['xlsx', 'csv']} onExportXLSX={handleExportXLSX} onExportCSV={handleExportCSV} disabled={venues.length === 0} />
            <HelpButton help={VENUES_HELP} label={W.title} iconOnly />
          </>
        )}
      />

      {!tournamentId ? null : error && venues.length === 0 ? (
        <LoadFailed title={error} onRetry={() => { setLoading(true); void refresh(); }} />
      ) : loading ? (
        <LoadingState label="Loading venues…" />
      ) : venues.length === 0 ? (
        <EmptyCard
          title={W.none}
          action={canWrite ? <button type="button" className="btn btn-outline" onClick={() => setAdding(true)}>{W.add}</button> : undefined}
        >
          {W.noneLine}
        </EmptyCard>
      ) : (
        <>
          <div className={repKit.phoneOnly}>
            <ClubRowList label={W.title}>
              {venues.map(v => (
                <ClubRow
                  key={v.id}
                  as="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpenId(v.id)}
                  title={v.name}
                  caption={lanesCaption(v)}
                  trail={<span className={styles.games}>{v.gameCount ? W.games(v.gameCount) : W.noGames}</span>}
                  chevron
                />
              ))}
            </ClubRowList>
          </div>
          <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{W.colVenue}</th>
                  <th scope="col">{W.colAddress}</th>
                  <th scope="col">{facilityNoun(kind, 2).replace(/^./, c => c.toUpperCase())}</th>
                  <th scope="col" className={repKit.num}>{W.colGames}</th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {venues.map(v => (
                  <tr key={v.id} className={repKit.rowOpens} onClick={() => setOpenId(v.id)}>
                    <td>
                      <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                        onClick={ev => { ev.stopPropagation(); setOpenId(v.id); }}>{v.name}</button>
                      {v.sourceOrgVenueId && <span className={styles.from}>{W.fromLibraryShort}</span>}
                    </td>
                    <td className={repKit.dim}>{v.address ?? '—'}</td>
                    <td className={repKit.dim}>{lanesCaption(v)}</td>
                    <td className={repKit.num}>{v.gameCount ?? 0}</td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && (
        <VenueRecord
          venue={open}
          orgSlug={orgSlug}
          kind={kind}
          canWrite={canWrite}
          libraryHref={libraryHref}
          prev={idx > 0 ? { id: venues[idx - 1].id, name: venues[idx - 1].name } : null}
          next={idx < venues.length - 1 ? { id: venues[idx + 1].id, name: venues[idx + 1].name } : null}
          position={`${idx + 1} of ${venues.length}`}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}

      {adding && currentTournament && (
        <AddVenuesWindow
          orgSlug={orgSlug}
          planId={currentOrg?.planId}
          tournament={{ id: currentTournament.id, name: currentTournament.name, sport: currentTournament.sport ?? null }}
          here={venues.map(v => ({ name: v.name, sourceOrgVenueId: v.sourceOrgVenueId }))}
          onClose={() => setAdding(false)}
          onAdded={async () => { await refresh(); }}
        />
      )}
    </div>
  );
}
