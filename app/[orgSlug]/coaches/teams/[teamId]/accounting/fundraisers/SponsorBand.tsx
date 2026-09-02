'use client';
/**
 * THE SPONSOR BAND — Direction A of the fundraising rework (owner-ruled 2026-08-29, proposal
 * artifact "Promises and Cheques"): sponsors have no pages. They are a compact ledger of
 * promises and cheques that EXPANDS IN PLACE — the promise line, the dated arrivals with Undo,
 * the family split, Record and Edit — everything the one-day-old record page held (Q11,
 * superseded with eyes open), shown at the size a sponsor actually is.
 *
 * The band owns the two EXPECTATION forms:
 *   · "Log a pledge" — a promise on the plan: sponsor, pledged amount, expected-by (Q13, mig
 *     269), the credit families, tags. Nothing moves, and the sheet says so.
 *   · "Edit sponsorship" — the agreement editor (moved here from the retired record page;
 *     the house verb for reopening a saved record is Edit, never Settings — owner, §121 walk):
 *     pledge, expected-by, credit plan, tags, behind the same foreseeable-refusal dead-Save.
 *
 * MONEY never has a form here. Record opens the one conversation locked to the sponsor; Undo
 * lives on the arrival row. Status is nowhere a control — the table's In / To come columns say
 * it in numbers, which is why the Received/Pledged chips are gone too.
 * ⚖ The rule survives the cheque-in-hand case by HANDING OFF (owner, §121 walk, 2026-08-29):
 * the pledge sheet carries a visible "Record it instead" that opens the conversation on
 * "A new sponsor…" with the typed name and amount — see `handOffToRecord`.
 */
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { BandMessageRow, BandDoorsRow, BAND_COL_COUNT } from './BandRows';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import SponsorCreditPlanEditor, { type SponsorCreditPlanRow } from '@/components/coaches/SponsorCreditPlanEditor';
import RecordEditorFooter from '@/components/coaches/RecordEditorFooter';
import { useRecordMoneySignal } from '@/lib/coach-record-money';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod, type RepTeamTag } from '@/lib/types';
import type { CreditUnit } from '@/lib/coach-fundraising';
import {
  deriveAllArrivalCredits, stillToCome, creditPlanProblem, type CreditPlanShare,
} from '@/lib/sponsor-arrivals';
import { fmt } from '@/lib/coach-money-summary';
import { pluralize } from '@/lib/utils';

export interface SponsorRowData {
  id: string;
  name: string;
  description: string | null;
  totalRaised: number;
  totalCredits: number;
  pledgedAmount: number | null;
  stillToCome: number;
  expectedBy: string | null;
  creditFamilies: { playerId: string; value: number; unit: string; name: string | null }[];
  tagIds: string[];
}

interface ExpandedData {
  arrivals: { entryId: string; amount: number; receivedDate: string | null; method: string | null; credited: number }[];
  plan: { playerId: string; playerName: string | null; value: number; unit: string }[];
  exposureByFamily: { playerId: string; exposure: number }[];
}

/** "expected by Sep 1" — and once it has passed, how late, plainly (Q13's whole vocabulary). */
function expectedClause(expectedBy: string | null, remaining: number) {
  if (!expectedBy || remaining <= 0.005) return null;
  const today = tournamentToday();
  const past = expectedBy < today;
  // Capitalized: this clause LEADS the expansion's meta line since the §121 compaction.
  return { text: `Expected by ${formatStoredDate(expectedBy, { withYear: false })}`, past };
}

export default function SponsorBand({
  orgSlug,
  teamId,
  sponsors,
  roster,
  defaultCreditPercent,
  moneyTags,
  onCreateTag,
  canWriteMoney,
  openId,
  onOpenChange,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  sponsors: SponsorRowData[];
  roster: { id: string; name: string }[];
  defaultCreditPercent: number;
  moneyTags: RepTeamTag[];
  onCreateTag: (name: string) => Promise<RepTeamTag | null>;
  canWriteMoney: boolean;
  /** The expanded sponsor — the tab's own `?fundraiser=` key, so deep links land open. */
  openId: string | null;
  onOpenChange: (id: string | null) => void;
  onChanged: () => void;
}) {
  const recordSignal = useRecordMoneySignal();
  const confirmDialog = useConfirm();

  // ── The expansion's own data: arrivals + plan + exposure, fetched when a row opens. ──
  const [expanded, setExpanded] = useState<ExpandedData | null>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [expandError, setExpandError] = useState('');
  const [undoingId, setUndoingId] = useState<string | null>(null);

  /* Stamp-and-drop — the Money-panel loading convention (lib/coach-money-refresh.tsx), applied to
     the expansion read (/review, 2026-09-01, High — the drive band's twin fix): a slow OLD answer
     landing after a toggle to another sponsor painted the wrong arrivals and left the open row on
     "Loading…" with nothing left to re-fire for it. */
  const expansionSeq = useRef(0);
  const loadExpansion = useCallback(async (sponsorId: string) => {
    const seq = ++expansionSeq.current;
    setExpandError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsorId}/entries`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (seq !== expansionSeq.current) return; // an older answer loses
      setExpanded({
        arrivals: Array.isArray(data.sponsorArrivals) ? data.sponsorArrivals : [],
        plan: Array.isArray(data.sponsorCreditPlan) ? data.sponsorCreditPlan : [],
        exposureByFamily: Array.isArray(data.sponsorExposureByFamily) ? data.sponsorExposureByFamily : [],
      });
      setExpandedFor(sponsorId);
    } catch (e) {
      if (seq !== expansionSeq.current) return;
      setExpandError(e instanceof Error ? e.message : 'This sponsor could not be loaded.');
      setExpandedFor(sponsorId);
      setExpanded(null);
    }
  }, [orgSlug, teamId]);

  /* The just-deleted id must not be re-read: `deleteSponsor` clears the open id through an ASYNC
     router.replace while its bump lands in the same render pass — see DriveBand's twin note. */
  const deletedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (openId && openId !== deletedIdRef.current) void loadExpansion(openId);
    else { setExpanded(null); setExpandedFor(null); }
  }, [openId, loadExpansion, sponsors]);

  /* Deep links land OPEN and IN VIEW — the drive band's pattern, back-ported (/simplify altitude
     lens, 2026-09-01): the two bands share one `?fundraiser=` contract, and a sponsor far down the
     list was landing expanded but off-screen. On EVERY change of the open id (the tab stays
     mounted for the whole visit, so a once-flag would skip every arrival after the first);
     `nearest` makes an ordinary click a no-op. */
  const openRowRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (openId) openRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openId]);

  async function undoArrival(s: SponsorRowData, a: ExpandedData['arrivals'][number]) {
    setExpandError('');
    const lastOne = (expanded?.arrivals.length ?? 0) === 1;
    const ok = await confirmDialog({
      title: 'Undo this arrival?',
      message: `Removes the ${fmt(a.amount)} that arrived ${a.receivedDate ? formatStoredDate(a.receivedDate) : 'undated'} from the team’s books`
        + (a.credited > 0.005 ? `, and takes back the ${fmt(a.credited)} credited to families from it` : '')
        + (lastOne ? '. This is the last arrival, so the sponsor returns to a pledge.' : '.'),
      confirmText: `Undo ${fmt(a.amount)}`,
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setUndoingId(a.entryId);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${s.id}/arrivals/${a.entryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        setExpandError((await res.json().catch(() => ({}))).error ?? 'That arrival could not be undone.');
        return;
      }
      /* Re-read now AND bump: the bump's list reload re-triggers this read a round trip later,
         and until then the row still showed the arrival just undone (/review, 2026-09-01). */
      void loadExpansion(s.id);
      onChanged();
    } finally {
      setUndoingId(null);
    }
  }

  // ── "Log a pledge" — the expectation form (Direction A: the modal's sponsor half, unfused). ──
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [plName, setPlName] = useState('');
  /* Notes at pledge time too (owner + /design, §121 walk 2026-08-29): the edit form always had
     them, so a coach who knew the story at creation had to create-reopen-edit to write it down —
     an asymmetry with no principle behind it. Same field, same home (right after the name). */
  const [plNotes, setPlNotes] = useState('');
  const [plAmount, setPlAmount] = useState('');
  const [plExpected, setPlExpected] = useState('');
  const [plPlan, setPlPlan] = useState<SponsorCreditPlanRow[]>([]);
  const [plTags, setPlTags] = useState<string[]>([]);
  const [plError, setPlError] = useState('');
  const [plSaving, setPlSaving] = useState(false);

  const plShares: CreditPlanShare[] = plPlan
    .filter(r => r.playerId && Number(r.value) > 0)
    .map(r => ({ playerId: r.playerId, value: Number(r.value), unit: r.unit }));
  const plProblem = Number(plAmount) > 0 ? creditPlanProblem(plShares, Number(plAmount)) : null;
  const plDirty = Boolean(plName || plNotes || plAmount || plExpected || plShares.length || plTags.length);

  function openPledge() {
    setPlName(''); setPlNotes(''); setPlAmount(''); setPlExpected('');
    setPlPlan([{ playerId: '', value: String(defaultCreditPercent), unit: 'percent' as CreditUnit }]);
    setPlTags([]); setPlError('');
    setPledgeOpen(true);
  }
  const closePledge = useDiscardGuard({ dirty: plDirty, close: () => setPledgeOpen(false), noun: 'pledge' });

  /**
   * The cheque-in-hand HAND-OFF (owner, §121 walk, 2026-08-29): "+ Sponsorship" must serve the
   * coach whose money has already arrived — but MONEY never gets a form on this band (Direction
   * A's own rule, and rebuilding arrival fields here would resurrect the duplicated sponsor form
   * this rework was born to kill). So the pledge sheet hands off, visibly, the way the bill form
   * does: into the one conversation, on "A sponsor came through → A new sponsor…", with the typed
   * name and amount carried. One save there creates the sponsor WITH its first cheque.
   * ⚠ Deliberately NOT through the discard guard: the typing travels, so there is nothing to ask
   * about discarding — the same reasoning the bill hand-off's baseline note records.
   */
  function handOffToRecord() {
    const carriedName = plName.trim();
    const carriedAmount = plAmount;
    setPledgeOpen(false);
    recordSignal?.request({
      branch: 'sponsor',
      ids: { sponsorNewName: carriedName },
      ...(carriedAmount ? { amount: carriedAmount } : {}),
    });
  }

  async function savePledge(e: React.FormEvent) {
    e.preventDefault();
    if (!plName.trim()) { setPlError('The sponsor needs a name.'); return; }
    const amount = Number(plAmount);
    if (isNaN(amount) || amount <= 0) { setPlError('A pledge needs an amount greater than zero.'); return; }
    if (plProblem) { setPlError(plProblem); return; }
    setPlSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'sponsor',
          sponsorStatus: 'pledged',
          name: plName.trim(),
          description: plNotes.trim() || null,
          sponsorAmount: amount,
          expectedBy: plExpected || null,
          creditPlan: plShares,
          tagIds: plTags,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setPledgeOpen(false);
      onChanged();
    } catch (err) {
      setPlError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPlSaving(false);
    }
  }

  // ── "Edit sponsorship" — the agreement editor, moved from the retired record page. ──
  const [agreeFor, setAgreeFor] = useState<SponsorRowData | null>(null);
  const [agName, setAgName] = useState('');
  const [agNotes, setAgNotes] = useState('');
  const [agPledged, setAgPledged] = useState('');
  const [agExpected, setAgExpected] = useState('');
  const [agPlan, setAgPlan] = useState<SponsorCreditPlanRow[]>([]);
  const [agTags, setAgTags] = useState<string[]>([]);
  const [agError, setAgError] = useState('');
  const [agSaving, setAgSaving] = useState(false);
  const [agDeleting, setAgDeleting] = useState(false);

  /**
   * ── The delete's two states (Q14, owner-ruled) ──────────────────────────────────────────────
   * A pledge is a promise on the plan and nothing else, so it goes on a plain confirm. A sponsor
   * whose cheques have landed cannot: the arrivals are dated income rows and family credits, and
   * the honest way out is the Undo already sitting on each of them — the door that states its own
   * amount and asks the payout floor. So the button dies and says which door to use.
   *
   * ⚠ COUNTED FROM THE EXPANSION WHEN IT IS LOADED, and from the row's own `In` column when it is
   * not. Edit is only reachable from an open row today, so the first branch is the live one — but
   * a sheet that opened without the count must still refuse, not offer a delete it cannot honour.
   */
  const agArrivals = agreeFor && expanded && expandedFor === agreeFor.id ? expanded.arrivals : null;
  const agArrivalCount = agArrivals ? agArrivals.length : (agreeFor && agreeFor.totalRaised > 0.005 ? 1 : 0);
  const agHasMoney = Boolean(agreeFor && (agreeFor.totalRaised > 0.005 || agArrivalCount > 0));

  async function deleteSponsor() {
    if (!agreeFor) return;
    setAgDeleting(true);
    setAgError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${agreeFor.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setAgError((await res.json().catch(() => ({}))).error ?? 'That sponsor could not be deleted.');
        return;
      }
      /* Straight past the discard guard, deliberately: there is no record left to keep changes
         for. Marked dead first (`deletedIdRef`), then the row collapses — an expanded id that no
         longer exists would otherwise refetch into an error the coach did nothing to cause. */
      deletedIdRef.current = agreeFor.id;
      setAgreeFor(null);
      onOpenChange(null);
      onChanged();
    } finally {
      setAgDeleting(false);
    }
  }

  const agShares: CreditPlanShare[] = agPlan
    .filter(r => r.playerId && Number(r.value) > 0)
    .map(r => ({ playerId: r.playerId, value: Number(r.value), unit: r.unit }));
  const agProblem = agreeFor ? creditPlanProblem(agShares, Number(agPledged) || null) : null;

  /** Replay the arrivals through the edited plan; any family whose credit would fall below what
   *  is already paid out in cash is a refusal this sheet can see coming (QA §118's dead-Save). */
  const agRefusals = (() => {
    if (!agreeFor || !expanded || expandedFor !== agreeFor.id || agProblem) return [];
    const rounds = deriveAllArrivalCredits({
      plan: agShares,
      pledged: Number(agPledged) || null,
      arrivalAmounts: expanded.arrivals.map(a => a.amount),
    });
    const projected = new Map<string, number>();
    for (const round of rounds) for (const sh of round) {
      projected.set(sh.playerId, (projected.get(sh.playerId) ?? 0) + sh.credit);
    }
    return expanded.exposureByFamily
      .filter(f => (projected.get(f.playerId) ?? 0) < f.exposure - 0.005)
      .map(f => ({
        ...f,
        name: expanded.plan.find(p => p.playerId === f.playerId)?.playerName
          ?? roster.find(p => p.id === f.playerId)?.name
          ?? 'this family',
      }));
  })();
  const agForeseeablyRefused = agRefusals.length > 0;
  const agDirty = Boolean(agreeFor && (
    agName !== agreeFor.name
    || agNotes !== (agreeFor.description ?? '')
    || agPledged !== String(agreeFor.pledgedAmount ?? '')
    || agExpected !== (agreeFor.expectedBy ?? '')
    || agTags.length !== agreeFor.tagIds.length
    || agTags.some(id => !agreeFor.tagIds.includes(id))
    || agShares.length !== agreeFor.creditFamilies.length
    || agShares.some(r => !agreeFor.creditFamilies.some(p =>
      p.playerId === r.playerId && Number(p.value) === r.value && p.unit === r.unit))
  ));

  function openAgreement(s: SponsorRowData) {
    setAgName(s.name);
    setAgNotes(s.description ?? '');
    setAgPledged(s.pledgedAmount != null ? String(s.pledgedAmount) : '');
    setAgExpected(s.expectedBy ?? '');
    setAgPlan(
      s.creditFamilies.length
        ? s.creditFamilies.map(p => ({ playerId: p.playerId, value: String(p.value), unit: (p.unit === 'amount' ? 'amount' : 'percent') as CreditUnit }))
        : [{ playerId: '', value: '0', unit: 'percent' as CreditUnit }],
    );
    setAgTags(s.tagIds);
    setAgError('');
    setAgreeFor(s);
  }
  const closeAgreement = useDiscardGuard({ dirty: agDirty, close: () => setAgreeFor(null), noun: 'change to the sponsor' });

  async function saveAgreement(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeFor) return;
    if (!agName.trim()) { setAgError('The sponsor needs a name.'); return; }
    const amount = Number(agPledged);
    if (isNaN(amount) || amount <= 0) { setAgError('A sponsor needs an amount greater than zero.'); return; }
    if (agProblem) { setAgError(agProblem); return; }
    if (agForeseeablyRefused) return; // the dead button's belt — Enter still submits the form
    setAgSaving(true);
    setAgError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${agreeFor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agName.trim(),
          description: agNotes.trim() || null,
          pledgedAmount: amount,
          expectedBy: agExpected || null,
          creditPlan: agShares,
          tagIds: agTags,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setAgreeFor(null);
      onChanged();
    } catch (err) {
      setAgError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setAgSaving(false);
    }
  }

  useOverlayOpen(pledgeOpen || !!agreeFor);

  /* "Credits Gray 25%, Jules $50" — shares only, no mechanics (owner, §121 walk 2026-08-29:
     the "of each arrival" suffix trimmed as more text than the meta line can wear). The
     per-arrival vs against-the-pledge distinction still lives where it is decided — the credit
     plan editor — and in help; here the figures are the sentence. */
  const planWords = (plan: ExpandedData['plan']): ReactNode => {
    const core = plan
      .map(p => `${p.playerName ?? 'A family'} ${p.unit === 'percent' ? `${p.value}%` : fmt(p.value)}`)
      .join(', ');
    return <>Credits <strong>{core}</strong></>;
  };

  return (
    <section aria-label="Sponsors">
      <div className={styles.panelToolbar} style={{ marginTop: '2rem' }}>
        <h3 className={styles.panelSubhead} style={{ margin: 0 }}>Sponsors</h3>
        {canWriteMoney && (
          <div className={styles.panelToolbarActions}>
            {/* ⚖ "+ Pledge", NOT "+ Sponsorship" (owner, §121 walk 2026-08-29, reversing his own
                same-day sibling-naming call with eyes open). "Sponsorship" claims the whole
                relationship, cheques included — the owner himself pressed it holding arrived
                money. "Pledge" is the sponsor-world's "bill" (fold decision 6A: the object noun
                carries the timing), so this door now says WHICH of the sponsor band's two doors
                it is; Record is the other. The sibling symmetry with "+ Fundraiser" survives in
                weight and position — the name asymmetry is earned by a structural one: a drive
                can only be created empty, a sponsorship can be born with money. */}
            <button className={styles.btnSecondary} onClick={openPledge}>
              <Plus size={15} aria-hidden /> Pledge
            </button>
          </div>
        )}
      </div>

      {sponsors.length === 0 ? (
        <p className={styles.muted} style={{ margin: '0.25rem 0 0' }}>
          No sponsors yet.{canWriteMoney && <> Press <strong>+ Pledge</strong> for a promise — or <strong>Record</strong> when a cheque is already in hand.</>}
        </p>
      ) : (
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Sponsor</th>
                <th className={`${styles.th} ${styles.thNum}`}>Pledged</th>
                <th className={`${styles.th} ${styles.thNum}`}>In</th>
                <th className={`${styles.th} ${styles.thNum}`}>To come</th>
                <th className={`${styles.th} ${styles.thNum}`}>Credits</th>
                {/* Header-less action column. The arrivals below hang their Undo here so the
                    three money columns stay pure figures under their own headings. */}
                <th className={styles.th} aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {sponsors.map(s => {
                const open = openId === s.id;
                const expect = expectedClause(s.expectedBy, s.stillToCome);
                return (
                  <SponsorRows
                    key={s.id}
                    s={s}
                    open={open}
                    openRowRef={open ? openRowRef : null}
                    expect={expect}
                    expanded={open && expandedFor === s.id ? expanded : null}
                    expandError={open ? expandError : ''}
                    undoingId={undoingId}
                    canWriteMoney={canWriteMoney}
                    onToggle={() => onOpenChange(open ? null : s.id)}
                    onRecord={() => recordSignal?.request({
                      branch: 'sponsor',
                      lock: {
                        subject: s.name,
                        detail: s.stillToCome > 0.005 ? `${fmt(s.stillToCome)} still to come` : 'opened from its row',
                      },
                      ids: { sponsorId: s.id },
                    })}
                    hasRecordDoor={!!recordSignal}
                    onEdit={() => openAgreement(s)}
                    onUndo={a => void undoArrival(s, a)}
                    planWords={planWords}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Log a pledge ── */}
      {pledgeOpen && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) closePledge(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            {/* The subtitle rides the header's own slot — a loose paragraph between the pinned
                header and the scrolling form gets spaced apart by the modal's layout (owner
                caught the gap on the §121 walk). */}
            <CoachModalHeader
              title="Log a pledge"
              subtitle="A promise on the plan — nothing moves until money arrives."
              onClose={closePledge}
              titleTag="h2"
              closeIconSize={18}
            />
            <form onSubmit={savePledge}>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Sponsor *</label>
                  <input className={styles.input} value={plName} onChange={e => setPlName(e.target.value)} placeholder="e.g. Riverdale Dental" autoFocus required />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Notes</label>
                  <textarea className={styles.textarea} value={plNotes} onChange={e => setPlNotes(e.target.value)} rows={2} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Pledged amount *</label>
                  <input className={styles.input} type="number" min={0} step="0.01" value={plAmount} onChange={e => setPlAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expected by</label>
                  <input className={styles.input} type="date" value={plExpected} onChange={e => setPlExpected(e.target.value)} />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Credit families</label>
                  <SponsorCreditPlanEditor
                    rows={plPlan}
                    onChange={setPlPlan}
                    families={roster}
                    defaultShare={String(defaultCreditPercent)}
                    problem={plProblem}
                  />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Tags</label>
                  <TagSearchCombobox library={moneyTags} selectedIds={plTags} onChange={setPlTags} onCreate={onCreateTag} placeholder="Type to find or create a money tag…" manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }} onManageChanged={onChanged} />
                </div>
                <p className={`${styles.formGridFull}`} style={{ margin: 0, fontSize: '0.8rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}>
                  <strong>When you save: nothing moves.</strong> The promise joins the plan and the forward view — record each cheque as it arrives.
                </p>
                {/* The cheque-in-hand door (owner, §121 walk): this sheet makes promises, so money
                    that has already arrived is handed to Record — see `handOffToRecord`. */}
                {recordSignal && (
                  <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>
                    Cheque already in hand?{' '}
                    <button type="button" className={styles.linkBtn} onClick={handOffToRecord}>
                      Record it instead
                    </button>
                    {' '}— the sponsor is created with its first cheque, and your name and amount
                    come with you.
                  </p>
                )}
              </div>
              {plError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{plError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={closePledge}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={plSaving}>
                  {plSaving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit sponsorship (the agreement) ── */}
      {agreeFor && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) closeAgreement(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <CoachModalHeader title="Edit sponsorship" onClose={closeAgreement} titleTag="h2" closeIconSize={18} />
            <form onSubmit={saveAgreement}>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  {/* "Sponsor", matching the pledge sheet — one field, one name on the sibling
                      forms (owner + /design, §121 walk; the 08-24 one-word rule's spirit). */}
                  <label className={styles.label}>Sponsor *</label>
                  <input className={styles.input} value={agName} onChange={e => setAgName(e.target.value)} required />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Notes</label>
                  <textarea className={styles.textarea} value={agNotes} onChange={e => setAgNotes(e.target.value)} rows={2} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Pledged amount *</label>
                  <input className={styles.input} type="number" min={0} step="0.01" value={agPledged} onChange={e => setAgPledged(e.target.value)} />
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                    {agreeFor.totalRaised > 0.005
                      ? `${fmt(agreeFor.totalRaised)} has arrived — dollar shares re-figure against the new promise.`
                      : 'Nothing has arrived yet — changing the promise moves no money.'}
                  </p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expected by</label>
                  <input className={styles.input} type="date" value={agExpected} onChange={e => setAgExpected(e.target.value)} />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Credit families</label>
                  <SponsorCreditPlanEditor
                    rows={agPlan}
                    onChange={setAgPlan}
                    families={roster}
                    problem={agProblem}
                  />
                  {agRefusals.map(f => (
                    <p key={f.playerId} style={{ margin: 0, fontSize: '0.75rem', color: 'var(--danger)' }}>
                      {/* Same voice as payoutFloorMessage (owner wording 2026-09-01) — the sheet's
                          foreseeable-refusal note and the server's 409 must read as one rule. */}
                      The team has already paid {fmt(f.exposure)} back to {f.name}&rsquo;s family — this change would make that more than they were ever owed. Remove the payout first.
                    </p>
                  ))}
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Tags</label>
                  <TagSearchCombobox library={moneyTags} selectedIds={agTags} onChange={setAgTags} onCreate={onCreateTag} placeholder="Type to find or create a money tag…" manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }} onManageChanged={onChanged} />
                </div>
              </div>
              {agError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{agError}</p>}

              {/* ── Delete (Q14) — ON the closing row, not a rule of its own (owner 2026-08-30) ── */}
              <RecordEditorFooter
                refusal={agHasMoney
                  ? <>This sponsor has <strong>{fmt(agreeFor.totalRaised)}</strong> on the team&rsquo;s books
                      {agArrivals ? <> across {pluralize(agArrivalCount, 'arrival')}</> : null}
                      {' '}— undo {agArrivalCount === 1 ? 'it' : 'them'} from the row first to delete it.</>
                  : null}
                confirmTitle={`Delete “${agreeFor.name}”?`}
                confirmBody={<>
                  Removes the <strong>{fmt(Number(agPledged) || agreeFor.pledgedAmount || 0)}</strong> promise
                  from the plan and the forward view, along with its expected-by date, credit split and tags.{' '}
                  <strong>No money moves</strong> — nothing has arrived from this sponsor.
                </>}
                deleting={agDeleting}
                onDelete={() => void deleteSponsor()}
              >
                <button type="button" className={styles.btnGhost} onClick={closeAgreement}>Cancel</button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={agSaving || agDeleting || agForeseeablyRefused}
                  title={agForeseeablyRefused ? 'Remove the payout first — the note above says why this can’t save.' : undefined}
                >
                  {agSaving ? 'Saving…' : 'Save changes'}
                </button>
              </RecordEditorFooter>
            </form>
          </div>
        </div>
      )}

      <UnsavedChangesGuard active={pledgeOpen && plDirty} message="You haven't logged this pledge yet. Leave without saving it?" />
      <UnsavedChangesGuard active={!!agreeFor && agDirty} message="You have unsaved changes to this sponsor. Leave without saving them?" />
    </section>
  );
}

/** One sponsor: its ledger row, and — when open — the expansion row beneath it. */
function SponsorRows({
  s, open, openRowRef, expect, expanded, expandError, undoingId, canWriteMoney, hasRecordDoor,
  onToggle, onRecord, onEdit, onUndo, planWords,
}: {
  s: SponsorRowData;
  open: boolean;
  openRowRef: React.Ref<HTMLTableRowElement> | null;
  expect: { text: string; past: boolean } | null;
  expanded: ExpandedData | null;
  expandError: string;
  undoingId: string | null;
  canWriteMoney: boolean;
  hasRecordDoor: boolean;
  onToggle: () => void;
  onRecord: () => void;
  onEdit: () => void;
  onUndo: (a: ExpandedData['arrivals'][number]) => void;
  planWords: (plan: ExpandedData['plan']) => ReactNode;
}) {
  /* ⚖ FACTS ONLY (owner + /design, §121 walk): expected-by and the credit split — never a
     sentence restating the columns an inch above. Built once here so the row markup below stays
     readable, and so the "nothing has arrived yet" fallback has ONE definition: it survives only
     where it would otherwise leave an empty line over the buttons. */
  const metaLine: ReactNode = (() => {
    if (!expanded) return null;
    const hasPlan = expanded.plan.length > 0;
    if (!expect && !hasPlan) {
      return expanded.arrivals.length === 0
        ? <span className={styles.mutedInline}>Nothing has arrived yet</span>
        : null;
    }
    return (
      <>
        {expect && <span style={{ color: expect.past ? 'var(--danger)' : undefined }}>{expect.text}</span>}
        {expect && hasPlan && <> · </>}
        {hasPlan && planWords(expanded.plan)}
      </>
    );
  })();

  return (
    <>
      <tr
        ref={openRowRef ?? undefined}
        className={styles.tr}
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
      >
        <td className={styles.td} data-label="Sponsor">
          {/* A real BUTTON (parity with the drive band, 2026-09-01): a row-level onClick alone is
              unreachable by keyboard and invisible to a screen reader. */}
          <button
            type="button"
            className={`${styles.linkBtn} ${styles.playerName}`}
            // `.linkBtn`'s 12px is declared after `.playerName`'s 14px and wins the tie by source
            // order — the same trap the drive band's name button already sidesteps inline.
            style={{ textAlign: 'left', fontSize: 'var(--type-body)' }}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-expanded={open}
          >
            {s.name}
          </button>
          {expect?.past && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--danger)' }}>
              past its expected date
            </span>
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
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits">
          {s.totalCredits > 0.005
            ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(s.totalCredits)}</span>
            : <span className={styles.mutedInline}>—</span>}
        </td>
        <td className={`${styles.td} ${styles.cardActionCell}`} data-label="">
          {/* The row's one full-height touch target on a phone (the card-mode rule stretches a
              trailing control to 44px) and the visible affordance a click-to-open row was missing
              — parity with the drive band (rendered sweep, 2026-09-01). */}
          <button
            type="button"
            className={styles.linkBtn}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={`${open ? 'Close' : 'Open'} ${s.name}`}
          >
            <span className={styles.cardActionLabel}>{open ? 'Close' : 'Open'}</span>
            {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
        </td>
      </tr>
      {/* ── THE EXPANSION IS SIBLING ROWS OF THIS TABLE, NOT A TABLE INSIDE IT ──────────────
          ⚖ IT USED TO BE A NESTED 4-COLUMN TABLE in a colSpan cell, and could not line up with
          the five headings above it BY CONSTRUCTION — a nested table sizes its own columns from
          its own content and cannot see its parent's, so any apparent alignment was coincidence.
          The owner caught the drift on the §122 walk. Sharing the parent's columns is the one
          arrangement that cannot drift again: an arrival's amount is under **In** and its credit
          under **Credits** because it is literally in those columns.
          ⚠ Keep the cell COUNT identical on every row here (six, including the action cell —
          BAND_COL_COUNT in BandRows.tsx). One short row silently re-flows the whole table's
          widths. */}
      {open && expandError && <BandMessageRow tone="error">{expandError}</BandMessageRow>}
      {open && !expanded && !expandError && <BandMessageRow tone="muted">Loading…</BandMessageRow>}
      {/* ⚖ The meta line holds ONLY what the columns can't say (owner, §121 walk): expected-by
          and the credit split, FACTS ONLY. The "nothing has arrived yet" fallback survives just
          where it would otherwise leave an empty line above the buttons. */}
      {open && metaLine && (
        <tr className={styles.tr}>
          <td className={`${styles.td} ${styles.bandSubCell}`} colSpan={BAND_COL_COUNT} style={{ fontSize: '0.82rem' }}>
            {metaLine}
          </td>
        </tr>
      )}
      {open && expanded && expanded.arrivals.map(a => (
        <tr key={a.entryId} className={styles.tr}>
          <td className={`${styles.td} ${styles.bandSubCell}`} data-label="Arrived">
            {a.receivedDate ? formatStoredDate(a.receivedDate) : <span className={styles.mutedInline}>—</span>}
            {/* ⚠⚠ THE DOT LOOKED ORPHANED BECAUSE OF `.muted`, NOT BECAUSE OF THE WORDS (owner,
                §122 walk, twice — my first fix changed the wording and missed the cause). `.muted`
                is the EMPTY-STATE BLOCK: it carries `padding: 2rem`, so greying this span pushed it
                32px clear of the date and the separator stopped reading as a separator. Its own rule
                warns about exactly this and names the fix — `.mutedInline` is colour only. The same
                misuse was shifting every em-dash in this table off the right edge of its column,
                which is the third symptom that warning lists. "by" stays: it earns its place now
                that the phrase sits where it belongs. */}
            {a.method && (
              <span className={styles.mutedInline}> · by {(DUES_PAYMENT_METHOD_LABEL[a.method as DuesPaymentMethod] ?? a.method).toLowerCase()}</span>
            )}
          </td>
          <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="Pledged" />
          <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="In" style={{ fontWeight: 700 }}>
            {fmt(a.amount)}
          </td>
          <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="To come" />
          {/* ⚠ The figure alone — the word "credited" that used to trail it is what the Credits
              heading already says, and it was making the column read ragged. */}
          <td className={`${styles.td} ${styles.tdNum} ${styles.bandSubCell}`} data-label="Credits">
            {a.credited > 0.005
              ? <span style={{ color: 'var(--home-plum)', fontWeight: 600 }}>{fmt(a.credited)}</span>
              : <span className={styles.mutedInline}>—</span>}
          </td>
          <td className={`${styles.td} ${styles.cardActionCell} ${styles.bandSubCell}`} data-label="">
            {canWriteMoney && (
              <button
                className={styles.btnGhost}
                onClick={e => { e.stopPropagation(); onUndo(a); }}
                disabled={undoingId === a.entryId}
                aria-label={`Undo the ${fmt(a.amount)} arrival`}
              >
                {undoingId === a.entryId ? '…' : 'Undo'}
              </button>
            )}
          </td>
        </tr>
      ))}
      {open && canWriteMoney && (
        <BandDoorsRow onRecord={hasRecordDoor ? onRecord : null} onEdit={onEdit} />
      )}
    </>
  );
}
