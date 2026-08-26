'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Gift, Plus, ChevronRight, TrendingUp, Handshake } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import { createMoneyTag } from '@/lib/coach-money-tags';
import type { RepTeamTag } from '@/lib/types';
import { useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import { moneySectionHref } from '@/lib/coach-money-links';
import { FUNDRAISER_COLUMNS, fundraiserRows } from '@/lib/coach-money-exports';
import {
  KIND_LABEL, KIND_HINT, FUNDRAISING_KINDS,
  SPONSOR_STATUS_LABEL, SPONSOR_STATUS_HINT, SPONSOR_STATUSES,
  resolveCredit, rollUpFundraising, normalizeKindFilter,
  type FundraisingKind, type SponsorStatus, type CreditUnit, type KindFilter,
} from '@/lib/coach-fundraising';
import { FundraiserDetail, fmt } from './detail';

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
}

/** What the status column says for either kind — a drive is running or it isn't, a sponsor has
 *  arrived or it hasn't, and the two questions deserve their own words. */
function statusLabel(f: Fundraiser): string {
  if (f.kind === 'sponsor') return SPONSOR_STATUS_LABEL[f.sponsorStatus ?? 'received'];
  return f.isActive ? 'Active' : 'Closed';
}

/** ⚠ A PLEDGE IS NOT A FAILURE AND NOT A SUCCESS — it is money that has not arrived, so it takes
 *  the warning treatment rather than the green one. Reading it as "done" is exactly the flattering
 *  the pledged/received split exists to prevent. */
function statusBadgeClass(f: Fundraiser): string {
  if (f.kind === 'sponsor') {
    return f.sponsorStatus === 'pledged' ? styles.badgeCompleted : styles.badgeActive;
  }
  return f.isActive ? styles.badgeActive : styles.badgeArchived;
}

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  // ⚠ "Fundraisers" here is CORRECT and stays. It names a KIND, not the tab — the tab is
  // "Fundraising" because it holds both. This chip was mistaken for a stale label once.
  { id: 'fundraiser', label: 'Fundraisers' },
  { id: 'sponsor',    label: 'Sponsors' },
];

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const [formKind, setFormKind]             = useState<FundraisingKind>('fundraiser');
  const [formName, setFormName]             = useState('');
  const [formDesc, setFormDesc]             = useState('');
  const [formRebate, setFormRebate]         = useState('0');
  const [formStart, setFormStart]           = useState('');
  const [formEnd, setFormEnd]               = useState('');
  // Sponsor-only fields
  const [formAmount, setFormAmount]         = useState('');
  const [formStatus, setFormStatus]         = useState<SponsorStatus>('received');
  const [formPlayerId, setFormPlayerId]     = useState('');
  const [formCredit, setFormCredit]         = useState('0');
  const [formCreditUnit, setFormCreditUnit] = useState<CreditUnit>('percent');
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
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
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
  const kindFilter = normalizeKindFilter(seasonSearchParams.get('kind'));
  function setKindFilter(next: KindFilter) {
    const sp = new URLSearchParams(seasonSearchParams.toString());
    if (next === 'all') sp.delete('kind'); else sp.set('kind', next);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const visibleRows = kindFilter === 'all' ? fundraisers : fundraisers.filter(f => f.kind === kindFilter);
  // The other unit, in words. Derived at render rather than stored, so it can never disagree with
  // what is in the two inputs.
  const creditPreview = (() => {
    const amount = Number(formAmount) || 0;
    const { credit, percent } = resolveCredit(amount, Number(formCredit) || 0, formCreditUnit);
    if (credit <= 0.005) return 'Zero keeps it all with the team.';
    const who = roster.find(p => p.id === formPlayerId)?.name ?? 'that family';
    return formCreditUnit === 'percent'
      ? `= ${fmt(credit)} off ${who}'s dues.`
      : `= ${percent}% of what this sponsor gave.`;
  })();
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
    formName || formDesc || formStart || formEnd || formRebate !== '0'
    || formAmount || formTags.length > 0,
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
  /* Mount loud, bump quiet — the shared convention — with ONE panel-specific twist.
   *
   * ⚠ NOT WHILE A DRIVE IS OPEN. The early return further down decides what RENDERS, not which
   * effects run, so without this guard every amount logged inside a fundraiser would also fetch a
   * list nobody is looking at, once per save. The guard sits in BOTH places on purpose: the effect
   * skips the fetch while the drive is open and re-fires on the way back out (which is exactly
   * when the fresh totals are wanted, and why closing a drive is a quiet re-read rather than a
   * blank tab), and the bump callback skips it for the same reason. */
  const listShown = !openFundraiserId;
  /* ⚠ ALWAYS LOUD (/review, 2026-08-26). This read `load(loadSeq.current > 0)` — "quiet if we have
     loaded before" — which is the boolean-latch mistake `useOnMoneyRevisionBump`'s header warns
     about wearing a different hat: `load` increments that counter SYNCHRONOUSLY, so StrictMode's
     second mount invocation saw 1 and went quiet, and being second it was also the call that WON.
     A failed first load then set no error, cleared the spinner and rendered "Nothing raised yet" —
     the exact empty-state lie this whole pass exists to remove. Quiet belongs to the revision bump
     below, where there is a last good screen to keep; a load this effect fires is either a mount or
     a return from a drive, and neither is a background refresh. */
  useEffect(() => { if (listShown) void load(); }, [load, listShown]);
  const quietReload = useCallback(() => { if (listShown) void load(true); }, [load, listShown]);
  useOnMoneyRevisionBump(quietReload);

  /** The roster and the team's standard split, loaded once alongside the list. Both only matter
   *  when the create form opens, but fetching them there would put a spinner inside a modal. */
  useEffect(() => {
    if (!canWriteMoney || openFundraiserId) return;
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
  }, [orgSlug, teamId, canWriteMoney, openFundraiserId]);

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
    setFormKind('fundraiser');
    setFormName('');
    setFormDesc('');
    // ⚠ PRE-FILLED, NOT GOVERNED (migration 237). The team's standard split lands here as a
    // starting value so the common case is name, amount, save; every record can still differ,
    // and changing the setting later never reaches back into what is already recorded.
    setFormRebate(String(defaultCreditPercent));
    setFormStart('');
    setFormEnd('');
    setFormAmount('');
    setFormStatus('received');
    setFormPlayerId('');
    setFormCredit(String(defaultCreditPercent));
    setFormCreditUnit('percent');
    setFormTags([]);
    setFormError('');
    setShowModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError(formKind === 'sponsor' ? 'The sponsor needs a name.' : 'Name is required.');
      return;
    }
    const rebate = Number(formRebate);
    if (formKind === 'fundraiser' && (isNaN(rebate) || rebate < 0 || rebate > 100)) {
      setFormError('Player credit % must be between 0 and 100.');
      return;
    }
    const amount = Number(formAmount);
    if (formKind === 'sponsor' && (isNaN(amount) || amount <= 0)) {
      setFormError('A sponsor needs an amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formKind === 'fundraiser' ? {
          kind:               'fundraiser',
          name:               formName.trim(),
          description:        formDesc.trim() || null,
          playerRebatePercent: rebate,
          startDate:          formStart || null,
          endDate:            formEnd   || null,
          tagIds:             formTags,
        } : {
          kind:          'sponsor',
          name:          formName.trim(),
          description:   formDesc.trim() || null,
          sponsorStatus: formStatus,
          sponsorAmount: amount,
          tagIds:        formTags,
          // No family means no credit — the server enforces the same thing, because a client
          // that sent one anyway must not be able to create a credit with nobody to credit.
          broughtInById: formPlayerId || null,
          creditValue:   formPlayerId ? Number(formCredit) || 0 : 0,
          creditUnit:    formCreditUnit,
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

  // The tab's sub-view REPLACES its list rather than sitting beside it: the leaderboard is a
  // six-column table and the list is a five-column one, so a split would give neither enough
  // column to be read (binding mockup, "the list is replaced, not pushed aside").
  if (openFundraiserId) {
    return (
      <div className={styles.page}>
        {/* `key` on the id, so one drive can never inherit another's half-typed form. The only
            link out of the detail is back to the list, but browser history and a pasted URL can
            both step straight from `?fundraiser=A` to `?fundraiser=B` with no render in between —
            React would reuse the instance, refetch correctly, and leave the inline "log amount"
            row open holding A's amount against one of B's players.

            `tabActive` travels with it: the Settings modal inside carries an unsaved-changes guard,
            and a guard belonging to a panel the coach has switched away from must stop hijacking
            clicks on the tab they ARE looking at (the same contract every hub panel keeps). */}
        <FundraiserDetail
          key={openFundraiserId}
          orgSlug={orgSlug}
          teamId={teamId}
          fundraiserId={openFundraiserId}
          tabActive={tabActive}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting`}>Back to Money</CoachBackLink>
      )}
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
          {/* ⚠ A KIND FILTER, NOT A TAG FILTER (owner ruling 2026-08-15). The tag filter bar this
              screen nearly grew was cut: money tags stay on the record and still reach the export
              and the tag report, but with five rows a filter earns nothing. The kind switch is
              different — it is the split the tab exists to show. */}
          <div className={styles.viewToggle} role="group" aria-label="Show">
            {KIND_FILTERS.map(k => (
              <button
                key={k.id}
                type="button"
                className={`${styles.viewToggleBtn} ${kindFilter === k.id ? styles.viewToggleBtnActive : ''}`}
                aria-pressed={kindFilter === k.id}
                onClick={() => setKindFilter(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className={styles.panelToolbarActions}>
            {/* ⚠ Per-fundraiser TOTALS only — the per-player breakdown names children beside the
                money they raised and stays on the fundraiser's own page. Not write-gated:
                reading is not writing. */}
            {/* ⚠ EXPORTS WHAT IS ON SCREEN, not the whole season. That is the hub-wide rule for
                why Export lives on a tab's own toolbar at all — "what a tab exports depends on the
                view and the filters the coach has set" — and it only started to matter here when
                the kind filter became a real, addressable view. The scope label says which kind,
                so a spreadsheet can never be mistaken for the full picture. */}
            <MoneyExportButton
              label="Fundraisers"
              formats={['xlsx', 'csv']}
              build={() => ({
                dataset: 'fundraisers',
                title: kindFilter === 'sponsor' ? 'Sponsors' : kindFilter === 'fundraiser' ? 'Fundraisers' : 'Fundraising',
                columns: FUNDRAISER_COLUMNS,
                rows: fundraiserRows(visibleRows, new Map(moneyTags.map(t => [t.id, t]))),
                scopeLabel: [
                  page.programYearName,
                  kindFilter === 'sponsor' ? 'Sponsors only' : kindFilter === 'fundraiser' ? 'Fundraisers only' : '',
                ].filter(Boolean).join(' · '),
                teamName: '',
                emptyMessage: 'This season has no fundraisers to export yet.',
              })}
            />
            {canWriteMoney && (
              <button className={styles.btnPrimary} onClick={openModal}>
                <Plus size={16} aria-hidden /> New
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <CoachLoading label="Loading your drives…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : fundraisers.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>Nothing raised yet</p>
          <p className={styles.emptyStateSub}>
            Run a <strong>fundraiser</strong> and the whole team takes part — log what each player
            raises and their share comes off their dues. Record a <strong>sponsor</strong> when a
            business or grant gives directly, and credit the family who brought it in.
          </p>
          {canWriteMoney && (
            <button className={styles.btnPrimary} onClick={openModal} style={{ marginTop: '1.25rem' }}>
              <Plus size={15} /> New fundraiser or sponsor
            </button>
          )}
        </div>
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
        <div className={styles.summaryGrid} style={{ marginBottom: '1.25rem' }}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Raised — fundraisers</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>{fmt(rollup.fundraiserRaised)}</span>
            <span className={styles.muted} style={{ fontSize: '0.72rem', padding: 0 }}>
              {rollup.fundraiserCount} {rollup.fundraiserCount === 1 ? 'drive' : 'drives'}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryCardLabel}>Raised — sponsors</span>
            <span className={styles.summaryCardValue} style={{ color: 'var(--blueprint-blue)' }}>{fmt(rollup.sponsorReceived)}</span>
            <span className={styles.muted} style={{ fontSize: '0.72rem', padding: 0 }}>
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

        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                <th className={`${styles.th} ${styles.thNum}`}>Team keeps</th>
                <th className={`${styles.th} ${styles.thNum}`}>Credits</th>
                <th className={`${styles.th} ${styles.tdShrink}`}>Status</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(f => (
                <tr key={f.id} className={styles.tr}>
                  {/* ⚠ ONE LINE (owner ruling 2026-08-15: "this looks like a lot of text").
                      The finding worth keeping is that the FIGURES were never the problem —
                      right-aligned tabular columns are what a table is for. It was three stacked
                      lines of prose in this cell. The rebate %, the dates, the progress count, the
                      notes and the tags all moved INSIDE the record; the test was "would a coach
                      scanning for 'how are we doing?' need it, or are they only asking it about
                      one record?".

                      The NAME stays the link, not the row. A row-level onClick is unreachable by
                      keyboard and invisible to a screen reader; an anchor is both, and it gives
                      the record a real target to open in a new tab. */}
                  <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Name">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flexWrap: 'wrap' }}>
                      {f.kind === 'sponsor'
                        ? <Handshake size={15} aria-hidden style={{ color: 'var(--blueprint-blue)', flexShrink: 0 }} />
                        : <TrendingUp size={15} aria-hidden style={{ color: 'var(--success-light)', flexShrink: 0 }} />}
                      {/* ⚠ Through the shared builder, carrying the SEASON: the old link was a
                          hand-built `/accounting/fundraisers/{id}` with no `?year=`, so opening a
                          past season's drive silently landed in the live one. */}
                      <Link href={moneySectionHref(base, 'fundraisers', { fundraiser: f.id })} className={styles.playerNameLink}>
                        {f.name}
                      </Link>
                      <span className={`${styles.badge} ${f.kind === 'sponsor' ? styles.badgeSponsor : styles.badgeActive}`}>
                        {KIND_LABEL[f.kind]}
                      </span>
                      {/* The ONE piece of text kept: two muted words naming the family who brought
                          a sponsor in — the fact a sponsor list is scanned for. ABSENT, never an
                          em-dash, when a sponsor belongs to nobody. */}
                      {f.broughtInBy && (
                        <span className={styles.muted} style={{ fontSize: '0.78rem', padding: 0 }}>· {f.broughtInBy}</span>
                      )}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ color: f.kind === 'sponsor' ? 'var(--blueprint-blue)' : 'var(--success-light)', fontWeight: 700 }}>
                    {fmt(f.totalRaised)}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Team keeps" style={{ fontWeight: 700 }}>
                    {fmt(f.teamNet)}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits" style={{ color: f.totalCredits > 0.005 ? 'var(--home-plum, #a855f7)' : 'var(--home-dim, rgba(255,255,255,0.35))', fontWeight: 700 }}>
                    {f.totalCredits > 0.005 ? fmt(f.totalCredits) : '—'}
                  </td>
                  {/* ⚠ SHRINK-TO-CONTENT, CHIPS LEFT (owner ruling 2026-08-15). Right-aligning was
                      tried and read as a mistake: right-alignment lines up DECIMALS, and a status
                      chip is an object with no decimal — so it only moved the ragged edge to the
                      left. Centring would have shared the raggedness rather than removing its
                      cause, which is a column far wider than the chip in it. The column now takes
                      the width its widest chip needs and the slack goes to the name. */}
                  <td className={`${styles.td} ${styles.tdShrink}`} data-label="Status">
                    <span className={`${styles.badge} ${statusBadgeClass(f)}`}>{statusLabel(f)}</span>
                  </td>
                  <td className={`${styles.td} ${styles.cardActionCell} ${styles.tdNum}`}>
                    <Link href={moneySectionHref(base, 'fundraisers', { fundraiser: f.id })} className={styles.linkBtn} aria-label={`Open ${f.name}`}>
                      <span className={styles.cardActionLabel}>Open</span>
                      <ChevronRight size={16} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* A filter that hides everything must say so — an empty table under an active filter
            reads as "you have none of these" rather than "none of these match". */}
        {visibleRows.length === 0 && (
          <p className={styles.muted} style={{ marginTop: '0.85rem' }}>
            No {kindFilter === 'sponsor' ? 'sponsors' : 'fundraisers'} this season.{' '}
            <button type="button" className={styles.linkBtn} onClick={() => setKindFilter('all')}>Show everything</button>
          </p>
        )}
        </>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) closeModal(); }}>
          {/* modalScrollBody: this form is tall enough to scroll, and without it the sticky
              footer's edge-bleed sat on top of the last field — the owner found the date row
              under the action bar (2026-08-15). */}
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <CoachModalHeader title="New" onClose={closeModal} titleTag="h2" closeIconSize={18} />
            <form onSubmit={handleCreate}>
              <div className={styles.formGrid}>
                {/* ⚠ THE KIND IS PICKED FIRST BECAUSE IT DECIDES THE REST OF THE FORM. Two cards
                    rather than a dropdown: each needs a sentence, and it is the one choice that
                    cannot be changed afterwards — a drive's rows are players and a sponsor is a
                    single arrival, so a switch would have nothing sensible to do with whatever had
                    already been recorded. */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>What is this?</label>
                  <div className={styles.kindPick} role="radiogroup" aria-label="What is this?">
                    {FUNDRAISING_KINDS.map(k => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={formKind === k}
                        className={`${styles.kindOption} ${formKind === k ? styles.kindOptionOn : ''}`}
                        onClick={() => setFormKind(k)}
                      >
                        <span className={styles.kindOptionName}>
                          {k === 'sponsor' ? <Handshake size={14} aria-hidden /> : <TrendingUp size={14} aria-hidden />}
                          {KIND_LABEL[k]}
                        </span>
                        <span className={styles.kindOptionHint}>{KIND_HINT[k]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>{formKind === 'sponsor' ? 'Sponsor *' : 'Fundraiser Name *'}</label>
                  <input
                    className={styles.input}
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder={formKind === 'sponsor' ? 'e.g. Riverdale Dental' : 'e.g. Chocolate Sale 2026'}
                    autoFocus
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>{formKind === 'sponsor' ? 'Notes' : 'Description'}</label>
                  <textarea
                    className={styles.textarea}
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Optional details…"
                    rows={2}
                  />
                </div>

                {formKind === 'fundraiser' ? (
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
                ) : (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Amount *</label>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        step="0.01"
                        value={formAmount}
                        onChange={e => setFormAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Status</label>
                      <select className={styles.select} value={formStatus} onChange={e => setFormStatus(e.target.value as SponsorStatus)}>
                        {SPONSOR_STATUSES.map(s => <option key={s} value={s}>{SPONSOR_STATUS_LABEL[s]}</option>)}
                      </select>
                      {/* ⚠ ONLY THE SURPRISING ONE IS EXPLAINED. "Received" means what it says, and
                          spending three lines saying so pushed the form past the window and left
                          the next field sliced by the action bar. A pledge is the state that needs
                          a sentence, because it deliberately does nothing to the books. */}
                      {formStatus === 'pledged' && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                          {SPONSOR_STATUS_HINT.pledged}
                        </p>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Brought in by</label>
                      <select className={styles.select} value={formPlayerId} onChange={e => setFormPlayerId(e.target.value)}>
                        <option value="">Nobody in particular</option>
                        {roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {/* ⚠ NO FAMILY, NO CREDIT — there is nobody to credit, so the field stands down
                        rather than accepting a figure that would go nowhere. */}
                    {/* Sits BESIDE "Brought in by" rather than under it — the two are one thought
                        ("who, and how much do they keep"), and the form was tall enough that a
                        full-width row here put the last field under the action bar. */}
                    {formPlayerId && (
                      <div className={styles.field}>
                        <label className={styles.label}>Credit to that family</label>
                        <div className={styles.unitField}>
                          <input
                            className={styles.input}
                            type="number"
                            min={0}
                            step="0.01"
                            value={formCredit}
                            onChange={e => setFormCredit(e.target.value)}
                            placeholder="0"
                          />
                          <div className={styles.unitPick} role="group" aria-label="Credit unit">
                            {(['amount', 'percent'] as CreditUnit[]).map(u => (
                              <button
                                key={u}
                                type="button"
                                aria-pressed={formCreditUnit === u}
                                className={`${styles.unitBtn} ${formCreditUnit === u ? styles.unitBtnOn : ''}`}
                                onClick={() => setFormCreditUnit(u)}
                              >
                                {u === 'amount' ? '$' : '%'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Whichever unit was typed, the OTHER is stated in plain words — nobody
                            should have to trust a percentage they cannot see the dollars of. */}
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                          {creditPreview}
                        </p>
                      </div>
                    )}
                  </>
                )}

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
