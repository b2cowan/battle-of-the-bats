'use client';
/**
 * ═══ THE FUNDRAISING TAB — two LISTS, and every record opens the same ROOM ═══════════════════
 * (List · Room · Question, owner-ruled 2026-09-02; Phase B built 2026-09-02; the ruled mockup is
 * artifact `11607f0a` §2, and `docs/projects/active/COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md` §3.)
 *
 * ⚖⚖ THIS SUPERSEDES TWO IN-PLACE RULINGS ON PURPOSE — Direction A's sponsor expansion (2026-08-29)
 * and "a drive opens in place" (2026-08-31). Both were applications of the 2026-08-26 modal ruling,
 * and the owner re-decided the whole Money area from a blank sheet: a list never grows a form, a
 * record opens the one overlay anatomy every money record opens, modals only ever ask. The named
 * reversals are dated in `memory/design_decisions.md`; do not restore either on the way past.
 *
 * What survives from the bands, because it was never about the fold: entries-first (the drive's
 * table draws money that exists, an inactive player's entry marked, never a roster-projected board);
 * the flat Pledged / In / To come columns (the reason comparing sponsors never needed a fold);
 * the two create doors in their own band headings; the guarded deletes with their floor sentences;
 * Remove live on a closed drive; the cheque-in-hand hand-off, now in both directions.
 *
 * ⚠ ONE ADDRESS, TWO SHAPES. `?fundraiser=<id>` is the room address for BOTH kinds — one
 * `useRoomAddress('fundraiser')` call, and the record's `kind` decides which room renders. The
 * guard test forbids two FILES reading one key, not one file opening two shapes; every deep link
 * that already carried the key (the Money overview's rows, a budget month door) still lands, and
 * now lands in a room. `?kind=sponsor` survives as a destination only: it scrolls to the sponsor
 * band once (ruling R2).
 *
 * ⚠ NO GLANCE FOLD (D2): room only at first. If the "who hasn't paid" skim across fifteen drives
 * is missed in practice, the recorded fallback is a read-only glance under the parent's own
 * columns — never live controls back in rows.
 */
import { useState, useEffect, useCallback, useMemo, useRef, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight, Pencil, Plus, TrendingUp } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import RoomShell, { type RoomTile } from '@/components/coaches/RoomShell';
import QuestionShell from '@/components/coaches/QuestionShell';
import GuardedDelete from '@/components/coaches/GuardedDelete';
import { useRoomAddress } from '@/components/coaches/useRoomAddress';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import { roomNeighbours } from '@/lib/room-neighbours';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import { createMoneyTag } from '@/lib/coach-money-tags';
import type { RepTeamTag } from '@/lib/types';
import { useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import { useRecordMoneySignal } from '@/lib/coach-record-money';
import { FUNDRAISER_COLUMNS, fundraiserRows } from '@/lib/coach-money-exports';
import { rollUpFundraising, normalizeKindFilter, sponsorStanding } from '@/lib/coach-fundraising';
import { stillToCome } from '@/lib/sponsor-arrivals';
import { fmt } from '@/lib/coach-money-summary';
import { writeFailure } from '@/lib/coach-sandbox-refusal';
import { pluralize } from '@/lib/utils';
import type { DriveEntryRow, Fundraiser, RoomRecord, SponsorArrival } from './types';
import { DriveRoomBody, DriveEntryQuestion, DriveStatusChip, EditDriveSheet } from './DriveRoom';
import {
  SponsorRoomBody, ArrivalQuestion, EditSponsorshipSheet, PledgeSheet, SponsorStatusChip, expectedClause,
} from './SponsorRoom';

export function FundraisersPanel({
  params: paramsPromise,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { loading: ctxLoading } = useCoaches();
  const recordSignal = useRecordMoneySignal();
  const confirmDialog = useConfirm();
  const bumpMoneyRevision = useBumpMoneyRevision();

  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** The roster, for the credit-plan editor. Fetched once with the list rather than per open. */
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  /** The team's standard split, which pre-fills the create forms (migration 237). */
  const [defaultCreditPercent, setDefaultCreditPercent] = useState(0);
  /** The team's money-tag vocabulary — the SAME library expenses use (mig 239). */
  const [moneyTags, setMoneyTags] = useState<RepTeamTag[]>([]);

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  // Money is three-state (off|read|write); the create route already refuses a read-only
  // coach, so offering the form and failing at submit is a broken affordance.
  const canWriteMoney = (page.capabilities?.money === 'write');

  /* Which record's ROOM is open rides the URL (`?fundraiser=`), so a link can open straight to one
     and the layout sweep can reach the room. ⚠ The key is listed in the hub's ONE_SHOT_KEYS; the
     guard test fails the build if a room key ever is not. */
  const [openId, setOpenId] = useRoomAddress('fundraiser');
  /* `?kind=` survives as a DESTINATION only (ruling R2, Direction A): the overview's Sponsorships
     row still deep-links `?kind=sponsor`, which scrolls its band into view. */
  const kindFilter = normalizeKindFilter(seasonSearchParams.get('kind'));

  const driveRows = useMemo(() => fundraisers.filter(f => f.kind === 'fundraiser'), [fundraisers]);
  const sponsorRows = useMemo(() => fundraisers.filter(f => f.kind === 'sponsor'), [fundraisers]);
  // ⚠ The season figures come from EVERY record, never from what is on screen.
  const rollup = useMemo(() => rollUpFundraising(fundraisers), [fundraisers]);

  const sponsorBandRef = useRef<HTMLDivElement | null>(null);
  const scrolledToBand = useRef(false);
  useEffect(() => {
    if (kindFilter === 'sponsor' && !loading && !scrolledToBand.current && sponsorBandRef.current) {
      scrolledToBand.current = true;
      sponsorBandRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [kindFilter, loading]);

  /* Stamp-and-drop + `quiet` — the Money-panel loading convention, written once above
     `useMoneyRevision` in lib/coach-money-refresh.tsx. */
  const loadSeq = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (seq !== loadSeq.current) return;
      setError(''); // a winning load that succeeded means there is no error any more — see the convention
      setFundraisers(data.fundraisers);
      // The money-tag library rides the list — it is needed the moment a form opens, and
      // fetching it there would put a spinner inside a modal.
      setMoneyTags(data.moneyTags ?? []);
    } catch (e: any) {
      if (!quiet && seq === loadSeq.current) setError(e.message ?? 'Failed to load fundraisers.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  /* Mount loud, bump quiet — the shared convention. ⚠ ALWAYS LOUD on mount (/review, 2026-08-26):
     a "quiet if we have loaded before" latch went quiet on StrictMode's second invocation and, being
     second, won — a failed first load then rendered the empty-state lie. Quiet belongs to the
     revision bump, where there is a last good screen to keep. */
  useEffect(() => { void load(); }, [load]);
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);

  /** The roster and the team's standard split, loaded once alongside the list. Both only matter
   *  when a form or the split zone opens, but fetching them there would put a spinner inside it. */
  useEffect(() => {
    if (!canWriteMoney) return;
    let cancelled = false;
    (async () => {
      try {
        const [teamRes, rosterRes] = await Promise.all([
          fetch(`/api/coaches/${orgSlug}/teams/${teamId}`),
          fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`),
        ]);
        if (cancelled) return;
        if (teamRes.ok) {
          const data = await teamRes.json();
          setDefaultCreditPercent(Number(data.money?.defaultPlayerCreditPercent ?? 0));
        }
        if (rosterRes.ok) {
          const data = await rosterRes.json();
          setRoster((data.players ?? [])
            .filter((p: any) => p.status === 'active')
            .map((p: any) => ({
              id: p.id,
              name: [p.playerFirstName, p.playerLastName].filter(Boolean).join(' '),
            })));
        }
      } catch { /* the forms still work; they just start at zero with no roster to attribute to */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId, canWriteMoney]);

  // ── The create-drive form (drives only since Direction A; a sponsor is born on the pledge sheet
  //    or through the conversation's first cheque) ─────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRebate, setFormRebate] = useState('0');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Rebate opens at '0', so it only counts as entered once the coach moves it off that default.
  // ⚠ Tags count as typing — a coach who picked three labels has done work the guard protects.
  const formDirty = Boolean(
    formName || formDesc || formStart || formEnd || formRebate !== '0' || formTags.length > 0,
  );
  const closeCreate = useDiscardGuard({
    dirty: formDirty,
    close: () => setShowCreate(false),
    noun: 'fundraiser',
  });

  /** Create a money tag from inside a picker, returning it so the box can select it at once. */
  async function addMoneyTag(name: string): Promise<RepTeamTag | null> {
    setFormError('');
    const result = await createMoneyTag(orgSlug, teamId, name);
    if ('error' in result) { setFormError(result.error); return null; }
    setMoneyTags(prev => [...prev, result.tag]);
    return result.tag;
  }

  function openCreate() {
    setFormName('');
    setFormDesc('');
    // ⚠ PRE-FILLED, NOT GOVERNED (migration 237): the team's standard split lands here as a
    // starting value; every record can still differ, and changing the setting later never
    // reaches back into what is already recorded.
    setFormRebate(String(defaultCreditPercent));
    setFormStart('');
    setFormEnd('');
    setFormTags([]);
    setFormError('');
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) { setFormError('Name is required.'); return; }
    const rebate = Number(formRebate);
    if (isNaN(rebate) || rebate < 0 || rebate > 100) {
      setFormError('Player credit % must be between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind:               'fundraiser',
          name:               formName.trim(),
          description:        formDesc.trim() || null,
          playerRebatePercent: rebate,
          startDate:          formStart || null,
          endDate:            formEnd   || null,
          tagIds:             formTags,
        }),
      });
      if (!res.ok) throw new Error(writeFailure(res, await res.json().catch(() => ({})), 'Save failed'));
      setShowCreate(false);
      await load();
      bumpMoneyRevision();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── The open record, and the room's own read ─────────────────────────────────────────────
  /** The record whose room is open, from the loaded list — the address alone opens nothing. */
  const openRecord = useMemo(
    () => (openId ? fundraisers.find(f => f.id === openId) ?? null : null),
    [fundraisers, openId],
  );
  /* A stale address — a record from another season, one just deleted — must not leave a room
     "open" on nothing. Once the list has loaded without it, the key is dropped, quietly. */
  useEffect(() => {
    if (openId && !loading && !error && !openRecord) setOpenId(null);
  }, [openId, loading, error, openRecord, setOpenId]);

  /* The room's raw material: the entries GET, stamped and dropped (two reads are routinely in
     flight together — a bump's re-read racing Prev/Next). Re-read whenever the LIST reloads, so a
     money bump anywhere refreshes the open room too. */
  const [room, setRoom] = useState<{ for: string; data: RoomRecord | null; error: string } | null>(null);
  const roomSeq = useRef(0);
  /* ⚠ THE JUST-DELETED ID MUST NOT BE RE-READ. `deleteRecord` clears the address through a
     router.replace — an ASYNC URL change — while the bump it also sends lands in the same render
     pass, so for one pass `openId` can still name the deleted record as the list reloads. */
  const deletedIdRef = useRef<string | null>(null);
  const loadRoom = useCallback(async (id: string) => {
    const seq = ++roomSeq.current;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${id}/entries`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (seq !== roomSeq.current) return; // an older answer loses
      setRoom({
        for: id,
        error: '',
        data: {
          entries: Array.isArray(data.entries) ? data.entries : [],
          rosterCount: Number(data.rosterCount ?? 0),
          arrivals: Array.isArray(data.sponsorArrivals) ? data.sponsorArrivals : [],
          plan: Array.isArray(data.sponsorCreditPlan) ? data.sponsorCreditPlan : [],
          exposureByFamily: Array.isArray(data.sponsorExposureByFamily) ? data.sponsorExposureByFamily : [],
        },
      });
    } catch (e) {
      if (seq !== roomSeq.current) return;
      setRoom({ for: id, data: null, error: e instanceof Error ? e.message : 'This record could not be loaded.' });
    }
  }, [orgSlug, teamId]);
  useEffect(() => {
    if (openId && openId !== deletedIdRef.current) {
      deletedIdRef.current = null; // another record opened — the guard has done its one job
      void loadRoom(openId);
    } else {
      setRoom(null);
    }
  }, [openId, loadRoom, fundraisers]);
  /** The open room's read — only when it is THIS record's; a swap shows Loading, never the last one's rows. */
  const roomRead = room && openRecord && room.for === openRecord.id ? room : null;

  /** What every write inside the room does afterwards: re-read the room NOW (the bump's list
   *  reload re-triggers it a round trip later, and until then the row would still show the
   *  cheque just undone), then bump the hub. */
  const openIdRef = useLatestRef(openId);
  const afterRoomWrite = useCallback(() => {
    // The record open NOW, not the one the writer was rendered with (`/review`, 2026-09-02).
    const id = openIdRef.current;
    if (id) void loadRoom(id);
    bumpMoneyRevision();
  }, [openIdRef, loadRoom, bumpMoneyRevision]);

  // ── The room's gates: busy, dirty, and the refusals that must survive a closed confirm ────
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomDirty, setRoomDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** A refused act (the payout floor's 409, a failed delete) — stamped with its record so it never
   *  reads on a different one after Prev/Next. */
  const [roomError, setRoomError] = useState<{ for: string; text: string } | null>(null);
  const raiseRoomError = useCallback((text: string) => {
    if (openId) setRoomError({ for: openId, text });
  }, [openId]);

  /**
   * Every way out of the room — close, Prev/Next — asks before discarding an unsaved split.
   * ⚠ The walk's `onSelect` takes an id, which `useDiscardGuard`'s closer cannot, so the question
   * is asked here in the guard's own words.
   */
  const goTo = useCallback(async (id: string | null) => {
    if (roomDirty) {
      const ok = await confirmDialog({
        title: 'Discard this change to the credit split?',
        message: 'Closing now won’t save the shares you’ve changed on this sponsor.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setRoomError(null);
    setOpenId(id);
  }, [roomDirty, confirmDialog, setOpenId]);

  // ── Questions and sheets the room asks ───────────────────────────────────────────────────
  const [editDrive, setEditDrive] = useState<Fundraiser | null>(null);
  const [editSponsor, setEditSponsor] = useState<Fundraiser | null>(null);
  const [pledge, setPledge] = useState<{ name: string; amount: string } | null>(null);
  const [entryEdit, setEntryEdit] = useState<DriveEntryRow | null>(null);
  const [arrivalEdit, setArrivalEdit] = useState<SponsorArrival | null>(null);

  /* The conversation's promise row hands off HERE (the carried ruling): the hub switched the tab
     and bumped the nonce; this opens the pledge sheet with the typed name and amount. A
     render-phase adjustment on a change guard (the hub page's own idiom) rather than an effect,
     so the sheet opens in the same pass the nonce arrives and nothing cascades. */
  /* ⚠ Seeded at ZERO, never at the nonce (`/review`, 2026-09-02): the hub marks this tab visited
     and bumps the nonce in the same commit, so on a coach's FIRST visit the panel mounts with the
     nonce already raised — seeding "seen" from it would swallow the very hand-off that mounted it. */
  const pledgeNonce = recordSignal?.pledgeNonce ?? 0;
  const [pledgeNonceSeen, setPledgeNonceSeen] = useState(0);
  if (pledgeNonce !== pledgeNonceSeen) {
    setPledgeNonceSeen(pledgeNonce);
    if (pledgeNonce > 0 && canWriteMoney) {
      setPledge({ name: recordSignal?.pledgeCarry?.name ?? '', amount: recordSignal?.pledgeCarry?.amount ?? '' });
    }
  }

  /** The cheque-in-hand hand-off OUT of the pledge sheet, into the conversation (owner, §121 walk). */
  const recordInstead = recordSignal
    ? (carry: { name: string; amount: string }) => {
        setPledge(null);
        recordSignal.request({
          branch: 'sponsor',
          ids: { sponsorNewName: carry.name },
          ...(carry.amount ? { amount: carry.amount } : {}),
        });
      }
    : null;

  // ── The guarded delete (the room's foot) ─────────────────────────────────────────────────
  async function deleteRecord(f: Fundraiser) {
    setDeleting(true);
    setRoomError(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${f.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setRoomError({ for: f.id, text: writeFailure(res, await res.json().catch(() => ({})), 'That record could not be deleted.') });
        return;
      }
      /* Mark it dead FIRST (see `deletedIdRef`), then close, then bump. The URL change behind
         `setOpenId` is asynchronous, so the guard is what actually stops a refetch of the record
         just deleted; the ordering is tidiness on top. */
      deletedIdRef.current = f.id;
      setOpenId(null);
      bumpMoneyRevision();
    } finally {
      setDeleting(false);
    }
  }

  // ── The open room, derived — its figures, tiles and walk — when the record or its list changes,
  //    never per keystroke of a form this panel also holds ────────────────────────────────────
  const driveRoom = useMemo(() => {
    if (!openRecord || openRecord.kind !== 'fundraiser') return null;
    const d = openRecord;
    const tiles: RoomTile[] = [
      { label: 'Raised', value: fmt(d.totalRaised), tone: d.totalRaised > 0.005 ? 'good' : undefined },
      { label: 'Team keeps', value: fmt(d.teamNet) },
      {
        label: 'Credited to families',
        value: d.playerRebatePercent > 0 ? `${fmt(d.totalCredits)} · ${d.playerRebatePercent}%` : fmt(d.totalCredits),
      },
    ];
    const walk = roomNeighbours(driveRows, d.id, r => r.id, r => r.name);
    /* What the delete has to answer for. ⚠ Counted from the ROOM'S read (every entry regardless of
       roster status — the same set the server counts), falling back to the row's own total when
       the read has not landed: a foot that opened without the count must still refuse. */
    const entryCount = roomRead?.data ? roomRead.data.entries.length : (d.totalRaised > 0.005 ? 1 : 0);
    return { tiles, walk, entryCount };
  }, [openRecord, driveRows, roomRead]);

  const sponsorRoom = useMemo(() => {
    if (!openRecord || openRecord.kind !== 'sponsor') return null;
    const s = openRecord;
    const remaining = stillToCome(s.pledgedAmount, s.totalRaised);
    const expect = expectedClause(s.expectedBy, remaining);
    const tiles: RoomTile[] = [
      { label: 'Pledged', value: s.pledgedAmount != null ? fmt(s.pledgedAmount) : '—' },
      { label: 'Arrived', value: fmt(s.totalRaised), tone: s.totalRaised > 0.005 ? 'good' : undefined },
      {
        label: 'To come',
        value: remaining > 0.005
          ? `${fmt(remaining)}${expect ? ` · by ${expect.short}` : ''}`
          : (s.pledgedAmount ?? 0) > 0 ? 'Promise kept' : '—',
        tone: remaining > 0.005 ? (expect?.past ? 'danger' : 'warn') : undefined,
      },
    ];
    const walk = roomNeighbours(sponsorRows, s.id, r => r.id, r => r.name);
    const arrivalCount = roomRead?.data ? roomRead.data.arrivals.length : (s.totalRaised > 0.005 ? 1 : 0);
    return { tiles, walk, standing: sponsorStanding(s.pledgedAmount, s.totalRaised), arrivalCount };
  }, [openRecord, sponsorRows, roomRead]);

  if (ctxLoading) return <CoachLoading label="Loading your drives…" />;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const roomErrorText = roomError && openRecord && roomError.for === openRecord.id ? roomError.text : '';
  const openRow = (id: string) => { if (window.getSelection()?.toString()) return; void goTo(id); };

  return (
    <div className={styles.page}>
      {/* ⚰ The "Back to Money" row and this panel's own CoachPageHeader are GONE (back-in-header
          ruling 2026-08-26; cleanup tranche 6, 2026-09-01) — every legacy money route is a
          permanent redirect into the hub, whose header is the live one. */}
      {fundraisers.length > 0 && (
        <div className={styles.panelToolbar}>
          {/* The export keeps BOTH kinds; its Received/Pledged split (Q15) is what keeps a
              spreadsheet honest about the mix. */}
          <div className={styles.panelToolbarActions}>
            <MoneyExportButton
              label="Fundraisers"
              formats={['xlsx', 'csv']}
              build={() => ({
                dataset: 'fundraisers',
                title: 'Fundraising',
                columns: FUNDRAISER_COLUMNS,
                rows: fundraiserRows(fundraisers, new Map(moneyTags.map(t => [t.id, t]))),
                scopeLabel: page.programYearName ?? '',
                teamName: '',
                emptyMessage: 'This season has no fundraisers to export yet.',
              })}
            />
          </div>
        </div>
      )}

      {loading ? (
        <CoachLoading label="Loading your drives…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : (
        <>
          {/* ⚠ THE SPLIT IS THE POINT: how much of this season is funded by families selling things
              versus by sponsors. The pledged figure rides ALONGSIDE the received one — a promise is
              not money in. */}
          {fundraisers.length > 0 && (
            <div className={styles.summaryGrid} style={{ marginBottom: '1.25rem' }}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardLabel}>Raised — fundraisers</span>
                <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>{fmt(rollup.fundraiserRaised)}</span>
                <span className={styles.mutedInline} style={{ fontSize: '0.72rem' }}>
                  {rollup.fundraiserCount} {rollup.fundraiserCount === 1 ? 'drive' : 'drives'}
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardLabel}>Raised — sponsors</span>
                <span className={styles.summaryCardValue} style={{ color: 'var(--blueprint-blue)' }}>{fmt(rollup.sponsorReceived)}</span>
                <span className={styles.mutedInline} style={{ fontSize: '0.72rem' }}>
                  {rollup.sponsorCount} {rollup.sponsorCount === 1 ? 'sponsor' : 'sponsors'}
                  {rollup.sponsorPledged > 0.005 && ` · ${fmt(rollup.sponsorPledged)} pledged`}
                </span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardLabel}>Team keeps</span>
                <span className={styles.summaryCardValue}>{fmt(rollup.teamKeeps)}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryCardLabel}>Credited to families</span>
                <span className={styles.summaryCardValue} style={{ color: 'var(--home-plum, #a855f7)' }}>{fmt(rollup.creditedToFamilies)}</span>
              </div>
            </div>
          )}

          {/* ── LIST ONE: FUNDRAISERS ──────────────────────────────────────────────────────────
              A row = name · Raised · Team keeps · one status chip · the chevron to its room. Each
              band's create door sits in ITS OWN heading row, same spot, same weight, sibling
              labels — "+ Fundraiser" / "+ Pledge" (owner, §121 walk). */}
          <section aria-label="Fundraisers">
            <div className={styles.panelToolbar} style={{ marginBottom: '0.5rem' }}>
              <h3 className={styles.panelSubhead}>Fundraisers</h3>
              {canWriteMoney && (
                <div className={styles.panelToolbarActions}>
                  <button type="button" className={styles.btnSecondary} onClick={openCreate}>
                    <Plus size={15} aria-hidden /> Fundraiser
                  </button>
                </div>
              )}
            </div>
            {driveRows.length === 0 ? (
              <p className={styles.muted} style={{ margin: '0 0 0.5rem' }}>
                No drives yet.{canWriteMoney && <> Press <strong>+ Fundraiser</strong> to run one — the whole team takes part, and each player&rsquo;s share comes off their dues.</>}
              </p>
            ) : (
              <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                <table className={styles.table} aria-label="Fundraisers">
                  <thead>
                    <tr>
                      <th className={styles.th}>Name</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Raised</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Team keeps</th>
                      <th className={`${styles.th} ${styles.tdShrink}`}>Status</th>
                      <th className={styles.th} aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {driveRows.map(d => (
                      <tr key={d.id} className={`${styles.tr} ${styles.rowTappable}`} onClick={() => openRow(d.id)}>
                        {/* No `data-label` — a card's lead cell is its TITLE and takes no caption
                            (owner + /design, §134 walk). The labelled cells below caption figures,
                            which is what a label is for. */}
                        <td className={`${styles.td} ${styles.cardStackCell}`}>
                          <span className={styles.listRowName}>
                            <TrendingUp size={15} aria-hidden style={{ color: 'var(--success-light)', flexShrink: 0 }} />
                            {d.name}
                          </span>
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`} data-label="Raised" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                          {fmt(d.totalRaised)}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`} data-label="Team keeps" style={{ fontWeight: 700 }}>
                          {fmt(d.teamNet)}
                        </td>
                        <td className={`${styles.td} ${styles.tdShrink}`} data-label="Status">
                          <DriveStatusChip active={d.isActive} />
                        </td>
                        <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                          <span className={styles.listRowActions}>
                            {/* ⚠⚠ A REAL BUTTON — the row's accessible door to its room. A bare
                                clickable <tr> is mouse-only; one glyph on every row: they all open
                                the same thing. */}
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.listRowToggle}`}
                              onClick={e => { e.stopPropagation(); void goTo(d.id); }}
                              aria-label={`Open ${d.name}`}
                            >
                              <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── LIST TWO: SPONSORS ─────────────────────────────────────────────────────────────
              The flat Pledged / In / To come columns stay — they are why comparing sponsors never
              needed a fold. Status is DERIVED from the two figures, never a field. */}
          <section aria-label="Sponsors" ref={sponsorBandRef}>
            <div className={styles.panelToolbar} style={{ marginTop: '2rem' }}>
              <h3 className={styles.panelSubhead} style={{ margin: 0 }}>Sponsors</h3>
              {canWriteMoney && (
                <div className={styles.panelToolbarActions}>
                  {/* ⚖ "+ Pledge", NOT "+ Sponsorship" (owner, §121 walk): "Sponsorship" claims the
                      whole relationship, cheques included. Pledge is the promise door; Record is the
                      money door. */}
                  <button type="button" className={styles.btnSecondary} onClick={() => setPledge({ name: '', amount: '' })}>
                    <Plus size={15} aria-hidden /> Pledge
                  </button>
                </div>
              )}
            </div>
            {sponsorRows.length === 0 ? (
              <p className={styles.muted} style={{ margin: '0.25rem 0 0' }}>
                No sponsors yet.{canWriteMoney && <> Press <strong>+ Pledge</strong> for a promise — or <strong>Record</strong> when a cheque is already in hand.</>}
              </p>
            ) : (
              <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                <table className={styles.table} aria-label="Sponsors">
                  <thead>
                    <tr>
                      <th className={styles.th}>Sponsor</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Pledged</th>
                      <th className={`${styles.th} ${styles.thNum}`}>In</th>
                      <th className={`${styles.th} ${styles.thNum}`}>To come</th>
                      <th className={`${styles.th} ${styles.tdShrink}`}>Status</th>
                      <th className={styles.th} aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {sponsorRows.map(s => {
                      const expect = expectedClause(s.expectedBy, s.stillToCome);
                      return (
                        <tr key={s.id} className={`${styles.tr} ${styles.rowTappable}`} onClick={() => openRow(s.id)}>
                          {/* No `data-label` — the card's title takes no caption; see the drives table. */}
                          <td className={`${styles.td} ${styles.cardStackCell}`}>
                            <span className={styles.listRowName}>{s.name}</span>
                            {/* The quiet past-due cue lives on the row (Q13) — it is the one fact the
                                columns cannot say. */}
                            {expect?.past && (
                              <span className={styles.listRowSub} style={{ color: 'var(--danger)' }}>past its expected date</span>
                            )}
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`} data-label="Pledged">
                            {s.pledgedAmount != null ? fmt(s.pledgedAmount) : <span className={styles.mutedInline}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`} data-label="In" style={{ fontWeight: 700 }}>
                            {s.totalRaised > 0.005 ? fmt(s.totalRaised) : <span className={styles.mutedInline}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`} data-label="To come">
                            {s.stillToCome > 0.005 ? <strong>{fmt(s.stillToCome)}</strong> : <span className={styles.mutedInline}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.tdShrink}`} data-label="Status">
                            <SponsorStatusChip standing={sponsorStanding(s.pledgedAmount, s.totalRaised)} />
                          </td>
                          <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                            <span className={styles.listRowActions}>
                              <button
                                type="button"
                                className={`${styles.linkBtn} ${styles.listRowToggle}`}
                                onClick={e => { e.stopPropagation(); void goTo(s.id); }}
                                aria-label={`Open ${s.name}`}
                              >
                                <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ THE DRIVE'S ROOM ═════════════════════════════════════════════════════════════════ */}
      {openRecord && driveRoom && tabActive && (
        <RoomShell
          open
          onClose={() => { void goTo(null); }}
          ariaLabel={`${openRecord.name} — fundraiser`}
          title={openRecord.name}
          status={<DriveStatusChip active={openRecord.isActive} />}
          tiles={driveRoom.tiles}
          actions={canWriteMoney ? (
            <>
              <button type="button" className={styles.btnGhost} onClick={() => setEditDrive(openRecord)}>
                <Pencil size={14} aria-hidden /> Edit drive
              </button>
              {/* No Record door on a closed drive — closing means no new money. The drive is
                  PRE-ANSWERED, not locked: a lock would hide "which player" too (the conversation's
                  one lock gate covers every identity question), and there would be nobody to record for. */}
              {openRecord.isActive && recordSignal && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => recordSignal.request({ branch: 'drive', ids: { driveId: openRecord.id } })}
                >
                  Record
                </button>
              )}
            </>
          ) : undefined}
          busy={roomBusy || deleting}
          recordKey={openRecord.id}
          sentinel="drive"
          loaded={!!roomRead?.data || !!roomRead?.error}
          nav={{ ...driveRoom.walk, noun: 'drives', onSelect: id => { void goTo(id); } }}
          footer={canWriteMoney ? (
            /* Keyed by the record: the walk swaps the drive while the foot stays mounted, and an
               unkeyed door would carry its open confirm onto the next drive. */
            <GuardedDelete
              key={openRecord.id}
              label="Delete this fundraiser"
              refusal={driveRoom.entryCount > 0
                ? <>This fundraiser has <strong>{fmt(openRecord.totalRaised)}</strong> logged across{' '}
                    {pluralize(driveRoom.entryCount, 'entry', 'entries')} — remove {driveRoom.entryCount === 1 ? 'it' : 'them'}{' '}
                    from its list first to delete it.
                    {openRecord.isActive && <> If it&rsquo;s simply finished, set it to{' '}
                    <strong>Closed</strong> under Edit drive instead: closing keeps every credit.</>}</>
                : null}
              confirmTitle={`Delete “${openRecord.name}”?`}
              confirmBody={<>
                Nothing has been logged against it, so <strong>no money moves</strong> and no family
                credit changes. The fundraiser and its tags go.
              </>}
              deleting={deleting}
              onDelete={() => void deleteRecord(openRecord)}
            />
          ) : undefined}
        >
          {/* The panel's banner sits BEHIND this overlay — a refused Remove has to be read in the room. */}
          {roomErrorText && <p className={styles.errorText} role="alert" style={{ marginBottom: '0.75rem' }}>{roomErrorText}</p>}
          <DriveRoomBody
            key={openRecord.id}
            orgSlug={orgSlug}
            teamId={teamId}
            drive={openRecord}
            record={roomRead?.data ?? null}
            error={roomRead?.error ?? ''}
            moneyTags={moneyTags}
            canWriteMoney={canWriteMoney}
            onChanged={afterRoomWrite}
            onBusyChange={setRoomBusy}
            onFailure={raiseRoomError}
            onEditEntry={setEntryEdit}
          />
        </RoomShell>
      )}

      {/* ══ THE SPONSOR'S ROOM — the one two-zone room ═══════════════════════════════════════ */}
      {openRecord && sponsorRoom && tabActive && (
        <RoomShell
          open
          onClose={() => { void goTo(null); }}
          ariaLabel={`${openRecord.name} — sponsorship`}
          title={openRecord.name}
          status={<SponsorStatusChip standing={sponsorRoom.standing} />}
          tiles={sponsorRoom.tiles}
          actions={canWriteMoney ? (
            <>
              {/* Waits for the room's own read: the sheet's foreseeable-refusal check needs the
                  stored split and the arrivals, and a sheet opened before they land would offer
                  a Save the server then refuses. */}
              <button type="button" className={styles.btnGhost} disabled={!roomRead?.data} onClick={() => setEditSponsor(openRecord)}>
                <Pencil size={14} aria-hidden /> Edit sponsorship
              </button>
              {recordSignal && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => recordSignal.request({
                    branch: 'sponsor',
                    lock: {
                      subject: openRecord.name,
                      detail: openRecord.stillToCome > 0.005 ? `${fmt(openRecord.stillToCome)} still to come` : 'opened from its room',
                    },
                    ids: { sponsorId: openRecord.id },
                  })}
                >
                  Record
                </button>
              )}
            </>
          ) : undefined}
          busy={roomBusy || deleting}
          recordKey={openRecord.id}
          sentinel="sponsor"
          loaded={!!roomRead?.data || !!roomRead?.error}
          nav={{ ...sponsorRoom.walk, noun: 'sponsors', onSelect: id => { void goTo(id); } }}
          footer={canWriteMoney ? (
            <GuardedDelete
              key={openRecord.id}
              label="Delete this sponsorship"
              refusal={sponsorRoom.arrivalCount > 0
                ? <>This sponsor has <strong>{fmt(openRecord.totalRaised)}</strong> on the team&rsquo;s books
                    {roomRead?.data ? <> across {pluralize(sponsorRoom.arrivalCount, 'arrival')}</> : null}
                    {' '}— undo {sponsorRoom.arrivalCount === 1 ? 'it' : 'them'} under Cheques first to delete it.</>
                : null}
              confirmTitle={`Delete “${openRecord.name}”?`}
              confirmBody={<>
                Removes the <strong>{fmt(openRecord.pledgedAmount ?? 0)}</strong> promise from the plan and
                the forward view, along with its expected-by date, credit split and tags.{' '}
                <strong>No money moves</strong> — nothing has arrived from this sponsor.
              </>}
              deleting={deleting}
              onDelete={() => void deleteRecord(openRecord)}
            />
          ) : undefined}
        >
          {roomErrorText && <p className={styles.errorText} role="alert" style={{ marginBottom: '0.75rem' }}>{roomErrorText}</p>}
          <SponsorRoomBody
            key={openRecord.id}
            orgSlug={orgSlug}
            teamId={teamId}
            sponsor={openRecord}
            record={roomRead?.data ?? null}
            error={roomRead?.error ?? ''}
            roster={roster}
            defaultCreditPercent={defaultCreditPercent}
            moneyTags={moneyTags}
            canWriteMoney={canWriteMoney}
            onChanged={afterRoomWrite}
            onBusyChange={setRoomBusy}
            onDirtyChange={setRoomDirty}
            onFailure={raiseRoomError}
            onEditArrival={setArrivalEdit}
          />
        </RoomShell>
      )}

      {/* ── The Questions the rooms ask (each stacks at most once over its room) ────────────── */}
      {entryEdit && openRecord && (
        <DriveEntryQuestion
          key={entryEdit.id}
          orgSlug={orgSlug}
          teamId={teamId}
          driveId={openRecord.id}
          entry={entryEdit}
          onSaved={() => { setEntryEdit(null); afterRoomWrite(); }}
          onClose={() => setEntryEdit(null)}
          tabActive={tabActive}
        />
      )}
      {arrivalEdit && openRecord && (
        <ArrivalQuestion
          key={arrivalEdit.entryId}
          orgSlug={orgSlug}
          teamId={teamId}
          sponsorId={openRecord.id}
          arrival={arrivalEdit}
          onSaved={() => { setArrivalEdit(null); afterRoomWrite(); }}
          onClose={() => setArrivalEdit(null)}
          tabActive={tabActive}
        />
      )}
      {editDrive && (
        <EditDriveSheet
          key={editDrive.id}
          orgSlug={orgSlug}
          teamId={teamId}
          drive={editDrive}
          moneyTags={moneyTags}
          onCreateTag={addMoneyTag}
          onManageChanged={quietReload}
          onSaved={() => { setEditDrive(null); bumpMoneyRevision(); }}
          onClose={() => setEditDrive(null)}
          tabActive={tabActive}
        />
      )}
      {editSponsor && (
        <EditSponsorshipSheet
          key={editSponsor.id}
          orgSlug={orgSlug}
          teamId={teamId}
          sponsor={editSponsor}
          record={roomRead?.for === editSponsor.id ? roomRead.data : null}
          roster={roster}
          moneyTags={moneyTags}
          onCreateTag={addMoneyTag}
          onManageChanged={quietReload}
          onSaved={() => { setEditSponsor(null); afterRoomWrite(); }}
          onClose={() => setEditSponsor(null)}
          tabActive={tabActive}
        />
      )}
      {pledge && (
        <PledgeSheet
          orgSlug={orgSlug}
          teamId={teamId}
          prefill={pledge}
          roster={roster}
          defaultCreditPercent={defaultCreditPercent}
          moneyTags={moneyTags}
          onCreateTag={addMoneyTag}
          onManageChanged={quietReload}
          onSaved={() => { setPledge(null); bumpMoneyRevision(); }}
          onClose={() => setPledge(null)}
          onRecordInstead={recordInstead}
          tabActive={tabActive}
        />
      )}

      {/* ── New fundraiser — the create form, a Question (drives only since Direction A) ───── */}
      <QuestionShell
        open={showCreate && tabActive}
        onClose={() => { void closeCreate(); }}
        ariaLabel="New fundraiser"
        title="New fundraiser"
        busy={saving}
        scroll
        leaveGuard={{ dirty: showCreate && formDirty, tabActive, message: "You haven't created this fundraiser yet. Leave without saving it?" }}
      >
        <form onSubmit={handleCreate}>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label}>Fundraiser Name *</label>
              <input
                className={styles.input}
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Chocolate Sale 2026"
                autoFocus
                required
              />
            </div>
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Optional details…"
                rows={2}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Player credit %</label>
              <input
                className={styles.input}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={formRebate}
                onChange={e => setFormRebate(e.target.value)}
                placeholder="0"
              />
              <p className={styles.formHint}>
                % of each player&apos;s earnings credited to their dues{defaultCreditPercent > 0 && ' — prefilled from your team default'}
              </p>
            </div>
            <div className={styles.field} />
            <div className={styles.field}>
              <label className={styles.label}>Start Date</label>
              <input className={styles.input} type="date" value={formStart} onChange={e => setFormStart(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>End Date</label>
              <input className={styles.input} type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
            </div>
            {/* ⚠ TAGS ARE ON THE RECORD, AND ONLY ON THE RECORD (owner ruling 2026-08-15): the
                money-in half of the money-tag report — the SAME vocabulary an expense uses. */}
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label}>Tags</label>
              <TagSearchCombobox
                library={moneyTags}
                selectedIds={formTags}
                onChange={setFormTags}
                onCreate={addMoneyTag}
                placeholder="Type to find or create a money tag…"
                manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }}
                onManageChanged={quietReload}
              />
            </div>
          </div>
          {formError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{formError}</p>}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnGhost} onClick={() => { void closeCreate(); }} disabled={saving}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </QuestionShell>
    </div>
  );
}
