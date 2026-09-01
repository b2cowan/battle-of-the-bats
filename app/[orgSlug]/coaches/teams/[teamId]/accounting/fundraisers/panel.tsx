'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Gift } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import { createMoneyTag } from '@/lib/coach-money-tags';
import type { RepTeamTag } from '@/lib/types';
import { useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import { FUNDRAISER_COLUMNS, fundraiserRows } from '@/lib/coach-money-exports';
import {
  rollUpFundraising, normalizeKindFilter,
  type FundraisingKind, type SponsorStatus,
} from '@/lib/coach-fundraising';
import { fmt } from '@/lib/coach-money-summary';
import SponsorBand from './SponsorBand';
import DriveBand from './DriveBand';

interface Fundraiser {
  id: string;
  kind: FundraisingKind;
  /** Sponsor only — a drive uses `isActive` for the same job. */
  sponsorStatus: SponsorStatus | null;
  name: string;
  description: string | null;
  playerRebatePercent: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  totalRaised: number;
  teamNet: number;
  totalCredits: number;
  playerCount: number;
  /** Sponsor only, and null for a club-wide one — the two muted words the row keeps. */
  broughtInBy: string | null;
  broughtInById: string | null;
  createdAt: string;
  /** Money tags on the RECORD (mig 239). Not drawn on the row — see the row-density ruling —
   *  but carried here so the export can print them without a second read. */
  tagIds: string[];
  /** Arrivals model (mig 268/269) — sponsor only, null/zero on a drive. */
  pledgedAmount: number | null;
  stillToCome: number;
  expectedBy: string | null;
  creditFamilies: { playerId: string; value: number; unit: string; name: string | null }[];
}

export function FundraisersPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { loading: ctxLoading } = useCoaches();

  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [showModal, setShowModal] = useState(false);

  // The New-fundraiser modal — DRIVES ONLY since Direction A (2026-08-29): a sponsor is made by
  // "Log a pledge" on its band, or by recording its first cheque through the conversation.
  const [formName, setFormName]             = useState('');
  const [formDesc, setFormDesc]             = useState('');
  const [formRebate, setFormRebate]         = useState('0');
  const [formStart, setFormStart]           = useState('');
  const [formEnd, setFormEnd]               = useState('');
  const [formTags, setFormTags]             = useState<string[]>([]);
  const [saving, setSaving]                 = useState(false);
  const [formError, setFormError]           = useState('');
  /** The roster, for "brought in by". Fetched once with the list rather than per form open. */
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  /** The team's standard split, which pre-fills both forms (migration 237). */
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
  /**
   * ONE fundraiser open, addressed by `?fundraiser=` — the tab's own sub-view (2026-08-14).
   *
   * ⚠ A STATE OF THIS TAB, not a page beside it. Opening a fundraiser used to leave the hub
   * entirely, which took the tab row, the archive chip and the Import door with it — the last
   * such exception in Money. The hub drops this key when the coach switches tabs (its
   * ONE_SHOT_KEYS), so it cannot linger on an unrelated URL.
   *
   * The LIST stays mounted behind the detail (this component is not remounted, only its
   * branch), which is why the detail signals a money-revision bump after a save rather than
   * relying on the arrival refetch a full page navigation used to give it for free.
   */
  const openFundraiserId = seasonSearchParams.get('fundraiser');

  /**
   * ⚠ THE KIND FILTER LIVES IN THE ADDRESS (2026-08-15), not in this component.
   *
   * The Money overview grew a Fundraisers row AND a Sponsorships row, and what earns a second row
   * is that it opens this tab already filtered — two doors onto the identical view would be a
   * second navigation system. A filter held in `useState` cannot be a destination, so it had to
   * move. The view is shareable now, and Back steps through it.
   *
   * `replace`, not `push`: flipping between three chips should not bury the page a coach arrived
   * from under three history entries (the same call the dues lens made). Every other param —
   * `section`, `year`, `fundraiser` — is preserved, because this panel is only ever reached with
   * `?section=` already on the URL.
   */
  const router = useRouter();
  const pathname = usePathname();
  /* `?kind=` survives as a DESTINATION only (ruling R2, Direction A): the overview's
     Sponsorships row still deep-links `?kind=sponsor`, which now scrolls its band into view —
     the filter itself retired when the list became two bands. */
  const kindFilter = normalizeKindFilter(seasonSearchParams.get('kind'));
  /* ── DIRECTION A (owner-ruled 2026-08-29): the tab is TWO BANDS, not one filtered list. ──
     ⚠ MEMOISED, AND THAT IS LOAD-BEARING (/simplify efficiency lens, 2026-09-01). Both bands key
     their open expansion's re-read on this array so a money bump refreshes it — which means a
     FRESH ARRAY ON EVERY RENDER re-fetched the open record's entries on every keystroke in the
     New-fundraiser form. The bands' effects see a new reference only when the list itself does. */
  const driveRows = useMemo(() => fundraisers.filter(f => f.kind === 'fundraiser'), [fundraisers]);
  const sponsorRows = useMemo(() => fundraisers
    .filter(f => f.kind === 'sponsor')
    .map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      totalRaised: f.totalRaised,
      totalCredits: f.totalCredits,
      pledgedAmount: f.pledgedAmount,
      stillToCome: f.stillToCome,
      expectedBy: f.expectedBy,
      creditFamilies: f.creditFamilies ?? [],
      tagIds: f.tagIds,
    })), [fundraisers]);

  /** `?fundraiser=` means ONE thing since 2026-08-31: the open row. Both kinds expand their band
   *  row in place (drives joined sponsors when the drill-in retired) — deep links from the
   *  register, the budget month doors and old bookmarks land open, with no dead pages. */
  const openRecord = openFundraiserId ? fundraisers.find(f => f.id === openFundraiserId) ?? null : null;
  const openSponsorId = openRecord?.kind === 'sponsor' ? openRecord.id : null;
  const openDriveId = openRecord?.kind === 'fundraiser' ? openRecord.id : null;
  const setOpenFundraiserParam = useCallback((id: string | null) => {
    const sp = new URLSearchParams(seasonSearchParams.toString());
    if (id) sp.set('fundraiser', id); else sp.delete('fundraiser');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [seasonSearchParams, router, pathname]);

  /** The overview's Sponsorships row deep-links `?kind=sponsor` — under two bands that means
   *  "land on the band", once, not a filter (ruling R2). */
  const sponsorBandRef = useRef<HTMLDivElement | null>(null);
  const scrolledToBand = useRef(false);
  useEffect(() => {
    if (kindFilter === 'sponsor' && !loading && !scrolledToBand.current && sponsorBandRef.current) {
      scrolledToBand.current = true;
      sponsorBandRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [kindFilter, loading]);
  // ⚠ The season figures come from EVERY record, never from what the filter is showing — a
  // summary that moved when you flipped a filter would be answering a different question from the
  // one its labels ask.
  const rollup = rollUpFundraising(fundraisers);

  useOverlayOpen(showModal);

  // Discard guard (review f7-3/f7-7). Rebate opens at '0', so it only counts as entered once
  // the coach moves it off that default.
  // ⚠ Tags count as typing. A coach who picked three labels and closed the sheet has done work
  // the guard exists to protect, and a form that only watched the text fields would drop it
  // silently — the same fork-shaped oversight the Settings sheet's sponsor fields already fixed.
  const formDirty = Boolean(
    formName || formDesc || formStart || formEnd || formRebate !== '0' || formTags.length > 0,
  );
  const closeModal = useDiscardGuard({
    dirty: formDirty,
    close: () => setShowModal(false),
    noun: 'fundraiser',
  });

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
      // The money-tag library rides the list — it is needed the moment the create form opens, and
      // fetching it there would put a spinner inside a modal.
      setMoneyTags(data.moneyTags ?? []);
    } catch (e: any) {
      if (!quiet && seq === loadSeq.current) setError(e.message ?? 'Failed to load fundraisers.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  const bumpMoneyRevision = useBumpMoneyRevision();
  /* Mount loud, bump quiet — the shared convention.
   *
   * ⚰ The `listShown` guard that stood here ("not while a drive is open") retired with the
   * drill-in (2026-08-31): the list is now ALWAYS the screen — an open drive is rows of this
   * list — so a money bump must refresh it precisely when a drive is open (the row's own totals
   * and the expansion, which re-reads off the reloaded list, are what the coach is looking at).
   *
   * ⚠ ALWAYS LOUD on mount (/review, 2026-08-26). This read `load(loadSeq.current > 0)` — "quiet
     if we have loaded before" — the boolean-latch mistake `useOnMoneyRevisionBump`'s header warns
     about: `load` increments that counter SYNCHRONOUSLY, so StrictMode's second mount invocation
     saw 1 and went quiet, and being second it was also the call that WON. A failed first load then
     rendered "Nothing raised yet" — the exact empty-state lie. Quiet belongs to the revision bump,
     where there is a last good screen to keep. */
  useEffect(() => { void load(); }, [load]);
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);

  /** The roster and the team's standard split, loaded once alongside the list. Both only matter
   *  when the create form opens, but fetching them there would put a spinner inside a modal.
   *  (The `openFundraiserId` skip retired with the drill-in — the list is always on screen.) */
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
          // `money` is null for a coach without money access — which cannot happen here, since
          // this effect is gated on write, but the null-coalesce keeps the read honest.
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
      } catch { /* the form still works; it just starts at zero with no roster to attribute to */ }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, teamId, canWriteMoney]);

  /** Create a money tag from inside the picker, returning it so the box can select it at once. */
  async function addMoneyTag(name: string): Promise<RepTeamTag | null> {
    setFormError('');
    const result = await createMoneyTag(orgSlug, teamId, name);
    if ('error' in result) { setFormError(result.error); return null; }
    setMoneyTags(prev => [...prev, result.tag]);
    return result.tag;
  }

  /* ⚖ The ?newSponsor= one-shot lived here for ONE DAY (money centralization P1) and is GONE
     (owner UX ruling 2026-08-23): the conversation's sponsor answer records INLINE through the
     same creation POST now, instead of navigating here to open this modal pre-set. */

  function openModal() {
    setFormName('');
    setFormDesc('');
    // ⚠ PRE-FILLED, NOT GOVERNED (migration 237). The team's standard split lands here as a
    // starting value so the common case is name, amount, save; every record can still differ,
    // and changing the setting later never reaches back into what is already recorded.
    setFormRebate(String(defaultCreditPercent));
    setFormStart('');
    setFormEnd('');
    setFormTags([]);
    setFormError('');
    setShowModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowModal(false);
      await load();
      // A new sponsor posts income and may credit a family, so the rest of Money is now stale.
      bumpMoneyRevision();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (ctxLoading) return <CoachLoading label="Loading your drives…" />;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  /* ⚰ THE DRILL-IN BRANCH THAT STOOD HERE IS GONE (owner-ruled 2026-08-31). A drive's
     `?fundraiser=` no longer replaces the list with a separate leaderboard screen — it expands
     the drive's own row in the band below, exactly as a sponsor's has since Direction A. An id
     that matches nothing (deleted, other season) simply shows the list, as before. */

  return (
    <div className={styles.page}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It rendered only on the legacy standalone route, and every legacy money route is a
          permanent redirect into the hub — so no coach has seen it since that sweep. Deleted as
          dead code rather than migrated to the header arrow, which is for live drill-ins. */}
      {/* Page-level action ruling 2026-08-13: "New Fundraiser" creates a FUNDRAISER, and inside
          the Money hub the header above the tabs names the container, not the fundraisers — so
          the create drops into this tab's own toolbar below. This tab had no control row, so it
          gains a thin one; five of the seven tabs already had one, which is why the pass removes
          a band on net rather than adding seven. */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={Gift}
        title="Fundraising"
        helpLabel="Fundraising"
        // `premium-money-fundraisers` — this was pointing at the BUDGET sub-topic, the nearest
        // thing that existed when the screen was written, and wrong the whole time.
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-fundraisers', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {fundraisers.length > 0 && (
        <div className={styles.panelToolbar}>
          {/* ⚠ THE KIND FILTER RETIRED WITH DIRECTION A (owner-ruled 2026-08-29): the tab is two
              BANDS now — drives, then sponsors — so "which kind" is answered by scrolling, and
              the overview's two rows deep-link to their band. The export keeps BOTH kinds; its
              Received/Pledged split (Q15) is what keeps a spreadsheet honest about the mix. */}
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
        /* ⚠ WAS A HAND-BUILT CARD LIST until 2026-08-13 (Money-hub table consistency, approved
           render `14181bd3`). Each card printed its OWN "Raised / Team keeps / Credits" headings,
           so three fundraisers meant NINE labels and ten meant thirty — the same rule that sent
           the Export menu's format tags off its rows the day before: anything drawn beside every
           item in a list is drawn as many times as the list is long. Worse, each card sized
           itself to its own name, so the three Raised figures landed in three different places
           and "which one raised most" could not be read down a column.

           Now the shared list table: three headings once, at the top, and the takings in one
           column. At 640 it stacks back into cards — which is close to what this looked like all
           along, so the change is a desktop one. */
        <>
        {/* ⚠ THE SPLIT IS THE POINT. One merged "raised" figure cannot answer a treasurer's actual
            question — how much of this season is funded by families selling things versus by
            sponsors — which is the whole reason the two kinds exist. The pledged figure rides
            ALONGSIDE the received one rather than inside it: a promise is not money in. */}
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

        {/* ── BAND ONE: FUNDRAISERS — campaigns that expand IN PLACE (owner-ruled 2026-08-31; the
            drill-in retired). The band owns its toolbar, table, expansion rows and Edit sheet —
            the create door stays this panel's own New-fundraiser modal, passed through. Each
            band's create door sits in ITS OWN heading row, same spot, same weight, sibling
            labels — "+ Fundraiser" / "+ Pledge" (owner, §121 walk). ── */}
        <DriveBand
          orgSlug={orgSlug}
          teamId={teamId}
          drives={driveRows}
          moneyTags={moneyTags}
          canWriteMoney={canWriteMoney}
          onCreate={openModal}
          openId={openDriveId}
          onOpenChange={setOpenFundraiserParam}
          onChanged={bumpMoneyRevision}
          onCreateTag={addMoneyTag}
          tabActive={tabActive}
        />

        {/* ── BAND TWO: SPONSORS — a ledger of promises and cheques that expands in place
            (Direction A). Its two expectation forms — Log a pledge, Sponsor settings — live
            inside the band; money moves only through the conversation's Record door. ── */}
        <div ref={sponsorBandRef}>
          <SponsorBand
            orgSlug={orgSlug}
            teamId={teamId}
            sponsors={sponsorRows}
            roster={roster}
            defaultCreditPercent={defaultCreditPercent}
            moneyTags={moneyTags}
            onCreateTag={addMoneyTag}
            canWriteMoney={canWriteMoney}
            openId={openSponsorId}
            onOpenChange={setOpenFundraiserParam}
            onChanged={bumpMoneyRevision}
          />
        </div>
        </>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
          {/* modalScrollBody: this form is tall enough to scroll, and without it the sticky
              footer's edge-bleed sat on top of the last field — the owner found the date row
              under the action bar (2026-08-15). */}
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            {/* Drives only since Direction A (owner-ruled 2026-08-29): sponsors are made by
                "Log a pledge" on their band or by recording their first cheque through the
                conversation — the fused kind-picker modal retired with the split. */}
            <CoachModalHeader title="New fundraiser" onClose={closeModal} titleTag="h2" closeIconSize={18} />
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
                <>
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
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
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
                  </>

                {/* ⚠ TAGS ARE ON THE RECORD, AND ONLY ON THE RECORD (owner ruling 2026-08-15). The
                    tag FILTER was cut from the list — with five rows it earns nothing — and the
                    field was mistakenly read as cut with it. This is the money-in half of the
                    money-tag report, which until now could only see spending: the SAME vocabulary
                    an expense uses, so "Winter dome" means one thing whichever direction the money
                    went. Last in the form, below the fork, because it applies to both kinds. */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Tags</label>
                  <TagSearchCombobox
                    library={moneyTags}
                    selectedIds={formTags}
                    onChange={setFormTags}
                    onCreate={addMoneyTag}
                    placeholder="Type to find or create a money tag…"
                  />
                </div>
              </div>
              {formError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{formError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showModal && formDirty}
        interceptClicks={showModal && formDirty && tabActive}
        message="You haven't created this fundraiser yet. Leave without saving it?"
      />
    </div>
  );
}
