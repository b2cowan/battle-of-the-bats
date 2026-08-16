'use client';
import { useState, useEffect, useCallback } from 'react';
import { Gift, Settings, X, Check } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useBumpMoneyRevision, useMoneyRevision } from '@/lib/coach-money-refresh';
import { moneySectionHref } from '@/lib/coach-money-links';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import { createMoneyTag } from '@/lib/coach-money-tags';
import type { RepTeamTag } from '@/lib/types';
import { applyCreditsToBills, normalizeCreditApplicationMode, type CreditApplicationMode } from '@/lib/dues-credits';
import {
  KIND_LABEL, SPONSOR_STATUS_LABEL, SPONSOR_STATUS_HINT,
  type FundraisingKind, type SponsorStatus, type CreditUnit,
} from '@/lib/coach-fundraising';

/**
 * ONE fundraiser — a STATE OF THE FUNDRAISERS TAB, not a page beside it (2026-08-14, binding
 * mockup: Artifact "Fundraiser Drill-In").
 *
 * ⚠ WHY IT IS NOT A PAGE ANY MORE. It was the last screen in Money that a coach could reach only
 * by leaving the hub: the tab row, the archive chip and the Import door all left the screen
 * together, and one text link was the entire way back. The August legacy-routes sweep retired the
 * seven standalone Money LIST pages and explicitly carved this one out ("a single fundraiser has
 * no tab of its own"), which was true and still left the portal with exactly one exception. Living
 * inside the tab dissolves the exception AND a defect one level down: the fundraisers LIST has
 * served `?year=` since Chunk F, so an archived hub listed the right drives — but opening one
 * landed on a page with no season rail at all, which paired a 2025 fundraiser with the 2026
 * roster and left Settings and "Log amount" live over a finished season.
 *
 * So the season is not re-derived here: it is the hub's, read the same way every Money panel reads
 * it, and carried into the fetch and the one link out.
 */

interface FundraiserDetail {
  id: string;
  /** A drive draws a leaderboard; a sponsor is ONE arrival and draws its own facts. */
  kind: FundraisingKind;
  sponsorStatus: SponsorStatus | null;
  name: string;
  description: string | null;
  playerRebatePercent: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  /** Money tags on this record (mig 239) — the money-in half of the money-tag vocabulary. */
  tagIds: string[];
}

interface FundraiserEntry {
  id: string;
  fundraiserId: string;
  playerId: string;
  amountRaised: number;
  rebatePercent: number;
  rebateAmount: number;
  accountingEntryId: string | null;
  creditId: string | null;
  notes: string | null;
}

/** One open bill for the "Where it lands" preview — served in schedule order by the entries
 *  route; the preview walks them in the team's credit-application direction. */
interface OpenBill {
  installmentNumber: number;
  dueDate: string | null;
  amount: number;
  toSend: number;
}

interface PlayerRow {
  playerId: string;
  playerName: string;
  /** What the family is still asked to SEND (dues − cash − credits applied) — the honest name
   *  for the figure this screen used to call remainingDues. */
  leftToSend: number;
  openBills: OpenBill[];
  entry: FundraiserEntry | null;
}

interface Summary {
  totalRaised: number;
  teamNet: number;
  totalCredits: number;
  playerCount: number;
}

/** Shared with the list beside it (which imports it from here) — the two screens print the same
 *  money and had two identical copies of this the moment the drill-in moved out of its page. */
export function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The "Where it lands" preview — THE shared application arithmetic (lib/dues-credits.ts) run
 * over the open bills the entries route served, with the not-yet-saved rebate as the one
 * credit. Never a local re-derivation: the preview must show exactly what saving will do.
 */
function previewCreditLanding(openBills: OpenBill[], rebate: number, mode: CreditApplicationMode) {
  const position = applyCreditsToBills({
    coverage: openBills.map(b => ({
      installmentId: String(b.installmentNumber),
      installmentNumber: b.installmentNumber,
      allocated: 0,
      remaining: b.toSend,
      covered: false,
      completedOn: null,
    })),
    credits: [{ id: 'preview', amount: rebate, creditType: 'fundraiser', creditDate: '9999-01-01' }],
    mode,
  });
  const byNumber = new Map(position.perInstallment.map(c => [c.installmentNumber, c]));
  const rows = openBills
    .map(b => {
      const after = byNumber.get(b.installmentNumber);
      if (!after || after.creditApplied <= 0.005) return null;
      return {
        installmentNumber: b.installmentNumber,
        dueDate: b.dueDate,
        wasToSend: b.toSend,
        newToSend: after.toSend,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { rows, leftover: position.owedBack };
}

export function FundraiserDetail({
  orgSlug,
  teamId,
  fundraiserId,
  tabActive = true,
}: {
  orgSlug: string;
  teamId: string;
  /** From the hub's `?fundraiser=` — the tab renders this view instead of its list. */
  fundraiserId: string;
  /** Is the Fundraisers tab the one on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const { loading: ctxLoading } = useCoaches();
  const bumpMoneyRevision = useBumpMoneyRevision();

  const [fundraiser, setFundraiser]   = useState<FundraiserDetail | null>(null);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [players, setPlayers]         = useState<PlayerRow[]>([]);
  // Normalized at the fetch boundary (mirror of the server's mapper), so everything below
  // trusts the state as a real mode.
  const [creditApplication, setCreditApplication] = useState<CreditApplicationMode>('last_first');
  /** The team's money-tag vocabulary — the same library expenses draw on (mig 239). */
  const [moneyTags, setMoneyTags]     = useState<RepTeamTag[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Inline log-amount state
  const [logPlayerId, setLogPlayerId]   = useState<string | null>(null);
  const [logAmount, setLogAmount]       = useState('');
  const [logNotes, setLogNotes]         = useState('');
  const [logSaving, setLogSaving]       = useState(false);
  const [logError, setLogError]         = useState('');

  // Edit fundraiser settings
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editRebate, setEditRebate]     = useState('');
  const [editStart, setEditStart]       = useState('');
  const [editEnd, setEditEnd]           = useState('');
  const [editActive, setEditActive]     = useState(true);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState('');
  // Sponsor-only edit fields
  const [editStatus, setEditStatus]         = useState<SponsorStatus>('received');
  const [editAmount, setEditAmount]         = useState('');
  const [editPlayerId, setEditPlayerId]     = useState('');
  const [editCredit, setEditCredit]         = useState('0');
  const [editCreditUnit, setEditCreditUnit] = useState<CreditUnit>('percent');
  const [editTags, setEditTags]             = useState<string[]>([]);

  // Chunk F — which SEASON is on screen, read exactly as the surrounding panels read it.
  // `page.canWrite()` folds read-only in, so an archived season offers no Settings and no
  // log/edit control; the API refuses both regardless (the write routes resolve the ACTIVE
  // year and a past fundraiser 404s), and this is the same answer given before the click.
  const page = useCoachSeasonPage(orgSlug, teamId);
  const canWriteMoney = page.canWrite(page.capabilities?.money === 'write');
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const isSponsor = fundraiser?.kind === 'sponsor';
  /** A sponsor's single arrival — the only row it has. Found by its entry, not by position. */
  const sponsorRow = isSponsor ? players.find(p => p.entry !== null) ?? null : null;

  useOverlayOpen(showSettings);

  // Discard guard (review f7-3/f7-7). Settings is an EDIT form, so the baseline is the loaded
  // fundraiser rather than a blank object — otherwise opening it would read as dirty at once.
  // ⚠ THE SPONSOR FIELDS COUNT TOO. The form forks on kind, so a guard that only watched the
  // drive's fields would let a coach close the sheet on a re-typed amount, a flipped status or a
  // changed family split without being asked — the exact loss this guard exists to prevent, made
  // silent by a fork rather than by an oversight in the original.
  const settingsDirty = !!fundraiser && (
    editName !== fundraiser.name
    || editDesc !== (fundraiser.description ?? '')
    // Tags are a change like any other — compared as SETS, since the picker appends and the
    // server returns them in its own order, and an order-sensitive compare would report a
    // freshly-opened sheet as dirty.
    || editTags.length !== fundraiser.tagIds.length
    || editTags.some(id => !fundraiser.tagIds.includes(id))
    || (isSponsor
      ? (
        editStatus !== (fundraiser.sponsorStatus ?? 'received')
        || editAmount !== String(summary?.totalRaised ?? '')
        || editPlayerId !== (sponsorRow?.playerId ?? '')
        || editCredit !== String(fundraiser.playerRebatePercent)
        || editCreditUnit !== 'percent'
      )
      : (
        editRebate !== String(fundraiser.playerRebatePercent)
        || editStart !== (fundraiser.startDate ?? '')
        || editEnd !== (fundraiser.endDate ?? '')
        || editActive !== fundraiser.isActive
      ))
  );
  const closeSettings = useDiscardGuard({
    dirty: settingsDirty,
    close: () => setShowSettings(false),
    noun: 'change to the fundraiser',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setFundraiser({ ...data.fundraiser, tagIds: data.fundraiser?.tagIds ?? [] });
      setSummary(data.summary);
      setPlayers(data.players);
      setMoneyTags(data.moneyTags ?? []);
      setCreditApplication(normalizeCreditApplicationMode(data.creditApplication));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load fundraiser.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, fundraiserId]);

  /**
   * ⚠ THE SIGNAL RUNS BOTH WAYS, and a screen that only sends it is the one left wrong.
   *
   * `lib/coach-money-refresh.tsx`'s contract is "a panel that is on screen re-reads itself" — every
   * sibling panel puts the revision in its load deps. This view is the one that is ACTUALLY ON
   * SCREEN while the hub header's `Import ▾` is still reachable above it, so an import that lands
   * dues rows would otherwise leave the coach logging a rebate against a stale "Left to send" and a
   * stale "Where it lands" preview, indefinitely, with nothing on screen to say so.
   */
  const moneyRevision = useMoneyRevision();
  useEffect(() => { load(); }, [load, moneyRevision]);

  /**
   * Money moved — tell the hub, and let the signal bring this screen back too.
   *
   * ⚠ THIS IS WHAT THE OLD PAGE GOT FOR FREE AND THE DRILL-IN MUST DO ON PURPOSE. Logging an
   * amount changes the fundraiser's totals, the team's income and a family's dues; on the old
   * standalone page "Back to Fundraisers" was a full navigation, so every one of those screens
   * refetched on arrival. Inside the hub the list panel is still MOUNTED behind this view and
   * would show its pre-save totals the moment the coach went back.
   *
   * The bump is the ONLY thing a save does: now that the effect above listens, calling `load()`
   * here as well would fetch this screen twice per save.
   */
  const saved = useCallback(() => { bumpMoneyRevision(); }, [bumpMoneyRevision]);

  function startLog(playerId: string, existingEntry: FundraiserEntry | null) {
    setLogPlayerId(playerId);
    setLogAmount(existingEntry ? String(existingEntry.amountRaised) : '');
    setLogNotes(existingEntry?.notes ?? '');
    setLogError('');
  }

  function cancelLog() {
    setLogPlayerId(null);
    setLogAmount('');
    setLogNotes('');
    setLogError('');
  }

  async function saveLog(player: PlayerRow) {
    const amount = Number(logAmount);
    if (isNaN(amount) || amount < 0) { setLogError('Enter a valid amount (0 or more).'); return; }
    setLogSaving(true);
    setLogError('');
    try {
      const existingEntry = player.entry;
      let res: Response;
      if (existingEntry) {
        res = await fetch(
          `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries/${existingEntry.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amountRaised: amount, notes: logNotes || null }),
          },
        );
      } else {
        res = await fetch(
          `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: player.playerId, amountRaised: amount, notes: logNotes || null }),
          },
        );
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      cancelLog();
      saved();
    } catch (e: any) {
      setLogError(e.message);
    } finally {
      setLogSaving(false);
    }
  }

  /** Same create door as the new-record form — a coach labelling a sponsor after the fact must not
   *  have to leave for the Expenses page to invent the label first. */
  async function addMoneyTag(name: string): Promise<RepTeamTag | null> {
    setEditError('');
    const result = await createMoneyTag(orgSlug, teamId, name);
    if ('error' in result) { setEditError(result.error); return null; }
    setMoneyTags(prev => [...prev, result.tag]);
    return result.tag;
  }

  function openSettings() {
    if (!fundraiser) return;
    setEditName(fundraiser.name);
    setEditDesc(fundraiser.description ?? '');
    setEditRebate(String(fundraiser.playerRebatePercent));
    setEditStart(fundraiser.startDate ?? '');
    setEditEnd(fundraiser.endDate ?? '');
    setEditActive(fundraiser.isActive);
    // A sponsor edits its arrival, not a campaign: what came in, whether it has, and who keeps
    // part of it. The credit opens as the AGREED SHARE rather than the dollars, so correcting the
    // cheque re-figures the family's cut instead of silently keeping the old amount.
    setEditStatus(fundraiser.sponsorStatus ?? 'received');
    setEditAmount(String(summary?.totalRaised ?? ''));
    setEditPlayerId(sponsorRow?.playerId ?? '');
    setEditCredit(String(fundraiser.playerRebatePercent));
    setEditCreditUnit('percent');
    setEditTags(fundraiser.tagIds);
    setEditError('');
    setShowSettings(true);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError(isSponsor ? 'The sponsor needs a name.' : 'Name is required.'); return; }
    const rebate = Number(editRebate);
    if (!isSponsor && (isNaN(rebate) || rebate < 0 || rebate > 100)) {
      setEditError('Player credit % must be between 0 and 100.');
      return;
    }
    const amount = Number(editAmount);
    if (isSponsor && (isNaN(amount) || amount <= 0)) {
      setEditError('A sponsor needs an amount greater than zero.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isSponsor ? {
            name:          editName.trim(),
            description:   editDesc.trim() || null,
            sponsorStatus: editStatus,
            sponsorAmount: amount,
            broughtInById: editPlayerId || null,
            creditValue:   editPlayerId ? Number(editCredit) || 0 : 0,
            creditUnit:    editCreditUnit,
            tagIds:        editTags,
          } : {
            name:               editName.trim(),
            description:        editDesc.trim() || null,
            playerRebatePercent: rebate,
            startDate:          editStart || null,
            endDate:            editEnd   || null,
            isActive:           editActive,
            tagIds:             editTags,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowSettings(false);
      saved();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;

  return (
    <>
      {/* One level up, IN THE SAME SEASON — the old page's back link dropped `?year=`, so leaving
          an archived fundraiser quietly ended the archive visit. */}
      <CoachBackLink href={moneySectionHref(base, 'fundraisers', undefined)}>
        All fundraisers
      </CoachBackLink>
      {/* Page-header ruling 2026-08-11: the Active/Closed badge is STATE, so it rides the title
          row; the rebate % and dates are live facts about the entity, so they lead the body.
          `nested`: the hub's own "Money" header is one line up and keeps the h1, the archive chip
          and the "?" — this names the record inside it. */}
      <CoachPageHeader
        variant="nested"
        icon={Gift}
        title={fundraiser?.name ?? 'Fundraiser'}
        titleChips={fundraiser && (
          <>
            <span className={`${styles.badge} ${isSponsor ? styles.badgeSponsor : styles.badgeActive}`}>
              {KIND_LABEL[fundraiser.kind]}
            </span>
            {/* A drive is running or it isn't; a sponsor has arrived or it hasn't. Two different
                questions, so two different words rather than one badge stretched over both. */}
            <span className={`${styles.badge} ${
              isSponsor
                ? (fundraiser.sponsorStatus === 'pledged' ? styles.badgeCompleted : styles.badgeActive)
                : (fundraiser.isActive ? styles.badgeActive : styles.badgeArchived)
            }`}>
              {isSponsor
                ? SPONSOR_STATUS_LABEL[fundraiser.sponsorStatus ?? 'received']
                : (fundraiser.isActive ? 'Active' : 'Closed')}
            </span>
          </>
        )}
        actions={canWriteMoney && fundraiser && (
          <button className={styles.btnSecondary} onClick={openSettings} title="Edit fundraiser settings" aria-label="Fundraiser settings">
            <Settings size={15} aria-hidden /> <span className={styles.headerBtnLabel}>Settings</span>
          </button>
        )}
      />
      {fundraiser && (
        <p className={styles.muted} style={{ margin: '-0.5rem 0 1.5rem' }}>
          {isSponsor
            ? SPONSOR_STATUS_HINT[fundraiser.sponsorStatus ?? 'received']
            : <>
                {fundraiser.playerRebatePercent}% player rebate
                {fundraiser.startDate && ` · ${fundraiser.startDate}`}
                {fundraiser.endDate && ` → ${fundraiser.endDate}`}
              </>}
        </p>
      )}

      {/* ⚠ THE TAGS LIVE HERE, one level in — the list row deliberately does not carry them (the
          row-density ruling: anything drawn beside every item in a list is drawn as many times as
          the list is long). Read-only chips; Settings is where they change. Absent, not an empty
          row, when a record has none. */}
      {fundraiser && fundraiser.tagIds.length > 0 && (
        <div className={styles.tagComboChips} style={{ margin: '-1rem 0 1.5rem' }}>
          {fundraiser.tagIds
            .map(id => moneyTags.find(t => t.id === id))
            .filter((t): t is RepTeamTag => !!t)
            .map(tag => (
              <span key={tag.id} className={`${styles.tagComboChip} ${tag.teamId === null ? styles.tagComboChipOrg : ''}`}>
                {tag.name}
              </span>
            ))}
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : summary && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Total Raised</span>
              <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>
                {fmt(summary.totalRaised)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Team Keeps</span>
              <span className={styles.summaryCardValue}>
                {fmt(summary.teamNet)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Credits Issued</span>
              <span className={styles.summaryCardValue} style={{ color: 'var(--home-plum, #a855f7)' }}>
                {fmt(summary.totalCredits)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>{isSponsor ? 'Status' : 'Players Logged'}</span>
              <span className={styles.summaryCardValue}>
                {isSponsor
                  ? SPONSOR_STATUS_LABEL[fundraiser?.sponsorStatus ?? 'received']
                  : summary.playerCount}
              </span>
            </div>
          </div>

          {/* ⚠ A SPONSOR HAS NO LEADERBOARD. Drawing the roster here would put fifteen "—" rows
              against one arrival, which is the exact shape sponsorships were added to stop. What
              a sponsor has instead is one line: who brought it in and what they kept. */}
          {isSponsor ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Brought in by</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Credited to them</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.tr}>
                    <td className={styles.td} data-label="Brought in by">
                      {sponsorRow?.playerName
                        ? <span className={styles.playerName}>{sponsorRow.playerName}</span>
                        : <span className={styles.muted}>Nobody in particular — a club-wide sponsor</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>
                      {fmt(summary.totalRaised)}
                    </td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Credited to them">
                      {summary.totalCredits > 0.005
                        ? <span style={{ color: 'var(--home-plum, #a855f7)', fontWeight: 600 }}>{fmt(summary.totalCredits)}</span>
                        : <span className={styles.muted}>— all to the team</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : players.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No roster players found</p>
              <p className={styles.emptyStateSub}>Add active players to this team's roster to start logging fundraising amounts.</p>
            </div>
          ) : (
            // One player per row: a list, so it stacks into cards at 640 (the Dues exemplar).
            // The trailing cell carries an inline form, so it stacks rather than trying to
            // fit two inputs and two buttons into a label/value line.
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Rank</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Amount Raised</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Rebate Earned</th>
                    {/* "Left to send" — dues minus cash minus credits applied: what this family
                        is actually asked for (the old "Remaining Dues" silently clamped a
                        different formula — plan §7.6). */}
                    <th className={styles.th} style={{ textAlign: 'right' }}>Left to Send</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const isLogging = logPlayerId === player.playerId;
                    const rank = player.entry ? idx + 1 : null;
                    return (
                      <tr key={player.playerId} className={styles.tr}>
                        <td className={`${styles.td} ${styles.tdShrink}`} data-label="Rank" style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                          {rank ?? '—'}
                        </td>
                        <td className={styles.td} data-label="Player">
                          <span className={styles.playerName}>{player.playerName}</span>
                        </td>
                        <td className={styles.td} data-label="Raised" style={{ textAlign: 'right' }}>
                          {player.entry ? (
                            <span style={{ fontWeight: 700, color: 'var(--success-light)' }}>{fmt(player.entry.amountRaised)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} data-label="Rebate" style={{ textAlign: 'right' }}>
                          {player.entry && player.entry.rebateAmount > 0 ? (
                            <span style={{ fontWeight: 600, color: 'var(--home-plum, #a855f7)' }}>{fmt(player.entry.rebateAmount)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} data-label="Left to send" style={{ textAlign: 'right' }}>
                          <span style={{ color: player.leftToSend > 0 ? 'var(--home-amber, #f97316)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                            {player.leftToSend > 0 ? fmt(player.leftToSend) : '—'}
                          </span>
                        </td>
                        <td
                          className={`${styles.td} ${styles.tdShrink} ${isLogging ? styles.cardStackCell : styles.cardActionCell}`}
                        >
                          {isLogging ? (
                            <div className={styles.stack640} style={{ alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <input
                                className={`${styles.input} ${styles.inlineField}`}
                                style={{ '--inline-field-w': '90px' } as React.CSSProperties}
                                type="number"
                                min={0}
                                step="0.01"
                                value={logAmount}
                                onChange={e => setLogAmount(e.target.value)}
                                placeholder="0.00"
                                aria-label="Amount raised"
                                autoFocus
                              />
                              <input
                                className={`${styles.input} ${styles.inlineField}`}
                                style={{ '--inline-field-w': '120px' } as React.CSSProperties}
                                type="text"
                                value={logNotes}
                                onChange={e => setLogNotes(e.target.value)}
                                placeholder="Notes (optional)"
                                aria-label="Notes"
                              />
                              {logError && <p className={styles.errorText} style={{ margin: 0, fontSize: '0.78rem' }}>{logError}</p>}
                              {/* "Where it lands" (binding mockup §2) — the bills this rebate
                                  will lower, shown BEFORE saving. New entries only: an edit's
                                  preview would need the delta against the credit already
                                  applied, and the screen re-derives on save either way. */}
                              {!player.entry && (() => {
                                const raised = parseFloat(logAmount);
                                const pct = fundraiser?.playerRebatePercent ?? 0;
                                if (isNaN(raised) || raised <= 0 || pct <= 0) return null;
                                const rebate = Math.round(raised * pct) / 100;
                                if (rebate <= 0.005) return null;
                                const landing = previewCreditLanding(player.openBills, rebate, creditApplication);
                                return (
                                  <div style={{ flexBasis: '100%', whiteSpace: 'normal', border: '1px solid var(--home-line, rgba(255,255,255,0.1))', borderRadius: 7, overflow: 'hidden', marginTop: '0.2rem' }}>
                                    <div style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--home-dim, rgba(255,255,255,0.45))', borderBottom: '1px solid var(--home-line, rgba(255,255,255,0.08))', background: 'var(--home-card, rgba(255,255,255,0.03))' }}>
                                      Where it lands — {fmt(rebate)} credit ({pct}% of {fmt(raised)})
                                    </div>
                                    {landing.rows.length === 0 ? (
                                      <p className={styles.muted} style={{ margin: 0, padding: '0.45rem 0.6rem', fontSize: '0.75rem' }}>
                                        {creditApplication === 'keep_separate'
                                          ? 'Credits are kept separate on this team — bills don’t move; the amount is owed back at season’s end.'
                                          : 'No open bills — the credit becomes money owed back to this family.'}
                                      </p>
                                    ) : (
                                      landing.rows.map(r => (
                                        <div key={r.installmentNumber} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.35rem 0.6rem', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))' }}>
                                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}>
                                            Installment #{r.installmentNumber}{r.dueDate ? ` — due ${r.dueDate}` : ''}
                                          </span>
                                          <span style={{ color: 'var(--success-light)', fontWeight: 600 }}>
                                            {r.newToSend <= 0.005 ? 'covered — nothing to send' : `was ${fmt(r.wasToSend)} to send — now ${fmt(r.newToSend)}`}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                    {landing.leftover > 0.005 && creditApplication !== 'keep_separate' && (
                                      <p className={styles.muted} style={{ margin: 0, padding: '0.35rem 0.6rem', fontSize: '0.72rem', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))' }}>
                                        {fmt(landing.leftover)} more than the open bills — owed back to this family.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Named rather than icon-only: these were a bare tick and cross
                                  with only a title attribute, which reads as nothing on a phone
                                  and nothing to a screen reader. Full width once the row stacks. */}
                              <button
                                className={`${styles.btnPrimary} ${styles.block640} ${styles.compactAction}`}
                                disabled={logSaving}
                                onClick={() => saveLog(player)}
                              >
                                <Check size={14} aria-hidden /> {logSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                className={`${styles.btnGhost} ${styles.block640} ${styles.compactAction}`}
                                onClick={cancelLog}
                              >
                                <X size={14} aria-hidden /> Cancel
                              </button>
                            </div>
                          ) : canWriteMoney ? (
                            <button
                              className={styles.btnGhost}
                              onClick={() => startLog(player.playerId, player.entry)}
                              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                              disabled={!fundraiser?.isActive}
                              title={!fundraiser?.isActive ? 'Fundraiser is closed' : undefined}
                            >
                              {player.entry ? 'Edit amount' : 'Log amount'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* WHOSE names these are — the one fact the archive chip cannot carry, and the exact
              thing the old page got wrong (it listed the LIVE roster beside a finished season's
              drive). Not a read-only banner: read-only is the chip's job portal-wide (Chunk F,
              D-F4), and this says something the chip does not. */}
          {page.isReadOnly && players.length > 0 && (
            <p className={styles.muted} style={{ marginTop: '0.85rem' }}>
              These are the players who were on the roster in {page.programYearName || 'that season'} — amounts can’t be added or edited in a finished season.
            </p>
          )}
        </>
      )}

      {/* Settings modal */}
      {showSettings && fundraiser && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeSettings(); }}>
          {/* Same shape, same fields, same fix as the create modal beside it (2026-08-15). */}
          <div className={`${styles.modal} ${styles.modalScrollBody}`}>
            <CoachModalHeader title={isSponsor ? "Sponsor" : "Fundraiser Settings"} onClose={closeSettings} titleTag="h2" closeIconSize={18} />
            <form onSubmit={saveSettings}>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Name *</label>
                  <input
                    className={styles.input}
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    className={styles.textarea}
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                {isSponsor ? (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Amount *</label>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        step="0.01"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Status</label>
                      <select className={styles.select} value={editStatus} onChange={e => setEditStatus(e.target.value as SponsorStatus)}>
                        {(['pledged', 'received'] as SponsorStatus[]).map(s => (
                          <option key={s} value={s}>{SPONSOR_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                      {/* ⚠ Only the surprising state explains itself — and here it also warns:
                          moving back to a pledge un-posts the income and removes the family's
                          credit, which is a consequence a coach should meet before saving. */}
                      {editStatus === 'pledged' && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                          Moving back to a pledge takes it off the books and removes any family credit.
                        </p>
                      )}
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Brought in by</label>
                      <select className={styles.select} value={editPlayerId} onChange={e => setEditPlayerId(e.target.value)}>
                        <option value="">Nobody in particular</option>
                        {players.map(p => <option key={p.playerId} value={p.playerId}>{p.playerName}</option>)}
                      </select>
                    </div>
                    {editPlayerId && (
                      <div className={styles.field}>
                        <label className={styles.label}>Credit to that family</label>
                        <div className={styles.unitField}>
                          <input
                            className={styles.input}
                            type="number"
                            min={0}
                            step="0.01"
                            value={editCredit}
                            onChange={e => setEditCredit(e.target.value)}
                          />
                          <div className={styles.unitPick} role="group" aria-label="Credit unit">
                            {(['amount', 'percent'] as CreditUnit[]).map(u => (
                              <button
                                key={u}
                                type="button"
                                aria-pressed={editCreditUnit === u}
                                className={`${styles.unitBtn} ${editCreditUnit === u ? styles.unitBtnOn : ''}`}
                                onClick={() => setEditCreditUnit(u)}
                              >
                                {u === 'amount' ? '$' : '%'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Player credit %</label>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={editRebate}
                        onChange={e => setEditRebate(e.target.value)}
                      />
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                        Only applies to new entries — existing entries keep their snapshotted rate
                      </p>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Status</label>
                      <select
                        className={styles.select}
                        value={editActive ? 'active' : 'closed'}
                        onChange={e => setEditActive(e.target.value === 'active')}
                      >
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Start Date</label>
                      <input className={styles.input} type="date" value={editStart} onChange={e => setEditStart(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>End Date</label>
                      <input className={styles.input} type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                    </div>
                  </>
                )}

                {/* The same money vocabulary an expense uses, on the money-in side (mig 239).
                    Below the fork because it applies to both kinds. */}
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Tags</label>
                  <TagSearchCombobox
                    library={moneyTags}
                    selectedIds={editTags}
                    onChange={setEditTags}
                    onCreate={addMoneyTag}
                    placeholder="Type to find or create a money tag…"
                  />
                </div>
              </div>
              {editError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{editError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={closeSettings}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showSettings && settingsDirty}
        interceptClicks={showSettings && settingsDirty && tabActive}
        message="You haven't saved your changes to this fundraiser. Leave without saving them?"
      />
    </>
  );
}
