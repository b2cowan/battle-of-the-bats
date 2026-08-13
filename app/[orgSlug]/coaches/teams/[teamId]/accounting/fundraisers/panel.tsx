'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Gift, Plus, ChevronRight, TrendingUp } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import styles from '../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { FUNDRAISER_COLUMNS, fundraiserRows } from '@/lib/coach-money-exports';

interface Fundraiser {
  id: string;
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
  createdAt: string;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

  const [formName, setFormName]             = useState('');
  const [formDesc, setFormDesc]             = useState('');
  const [formRebate, setFormRebate]         = useState('0');
  const [formStart, setFormStart]           = useState('');
  const [formEnd, setFormEnd]               = useState('');
  const [saving, setSaving]                 = useState(false);
  const [formError, setFormError]           = useState('');

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  // Money is three-state (off|read|write); the create route already refuses a read-only
  // coach, so offering the form and failing at submit is a broken affordance.
  const canWriteMoney = page.canWrite(page.capabilities?.money === 'write');
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  useOverlayOpen(showModal);

  // Discard guard (review f7-3/f7-7). Rebate opens at '0', so it only counts as entered once
  // the coach moves it off that default.
  const formDirty = Boolean(formName || formDesc || formStart || formEnd || formRebate !== '0');
  const closeModal = useDiscardGuard({
    dirty: formDirty,
    close: () => setShowModal(false),
    noun: 'fundraiser',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setFundraisers(data.fundraisers);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load fundraisers.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  function openModal() {
    setFormName('');
    setFormDesc('');
    setFormRebate('0');
    setFormStart('');
    setFormEnd('');
    setFormError('');
    setShowModal(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) { setFormError('Name is required.'); return; }
    const rebate = Number(formRebate);
    if (isNaN(rebate) || rebate < 0 || rebate > 100) {
      setFormError('Rebate % must be between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:               formName.trim(),
          description:        formDesc.trim() || null,
          playerRebatePercent: rebate,
          startDate:          formStart || null,
          endDate:            formEnd   || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowModal(false);
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting${seasonQuery}`}>Back to Money</CoachBackLink>
      )}
      {/* Page-level action ruling 2026-08-13: "New Fundraiser" creates a FUNDRAISER, and inside
          the Money hub the header above the tabs names the container, not the fundraisers — so
          the create drops into this tab's own toolbar below. This tab had no control row, so it
          gains a thin one; five of the seven tabs already had one, which is why the pass removes
          a band on net rather than adding seven. */}
      <CoachPageHeader
        embedded={embedded}
        icon={Gift}
        title="Fundraisers"
        season={page.season}
        teamBase={page.teamBase}
        helpLabel="Fundraisers"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {fundraisers.length > 0 && (
        <div className={styles.panelToolbar}>
          <div className={styles.panelToolbarActions}>
            {/* ⚠ Per-fundraiser TOTALS only — the per-player breakdown names children beside the
                money they raised and stays on the fundraiser's own page. Not write-gated:
                reading is not writing. */}
            <MoneyExportButton
              label="Fundraisers"
              formats={['xlsx', 'csv']}
              build={() => ({
                dataset: 'fundraisers',
                title: 'Fundraisers',
                columns: FUNDRAISER_COLUMNS,
                rows: fundraiserRows(fundraisers),
                scopeLabel: page.season.current?.programYearName ?? '',
                teamName: '',
                emptyMessage: 'This season has no fundraisers to export yet.',
              })}
            />
            {canWriteMoney && (
              <button className={styles.btnPrimary} onClick={openModal}>
                <Plus size={16} aria-hidden /> New Fundraiser
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : fundraisers.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No fundraisers yet</p>
          <p className={styles.emptyStateSub}>
            Create a fundraiser to track per-player amounts raised and automatically credit player dues.
          </p>
          {canWriteMoney && (
            <button className={styles.btnPrimary} onClick={openModal} style={{ marginTop: '1.25rem' }}>
              <Plus size={15} /> New Fundraiser
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
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Fundraiser</th>
                <th className={`${styles.th} ${styles.thNum}`}>Raised</th>
                <th className={`${styles.th} ${styles.thNum}`}>Team keeps</th>
                <th className={`${styles.th} ${styles.thNum}`}>Credits</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {fundraisers.map(f => (
                <tr key={f.id} className={styles.tr}>
                  {/* The NAME is the link, not the row. A row-level onClick is unreachable by
                      keyboard and invisible to a screen reader; an anchor is both, and it also
                      gives the fundraiser a real target to open in a new tab. */}
                  <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Fundraiser">
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', minWidth: 0 }}>
                      <TrendingUp size={16} aria-hidden style={{ color: 'var(--success-light)', flexShrink: 0, marginTop: '3px' }} />
                      <span style={{ minWidth: 0 }}>
                        <Link href={`${base}/accounting/fundraisers/${f.id}`} className={styles.playerNameLink}>
                          {f.name}
                        </Link>
                        {f.description && (
                          <span className={styles.muted} style={{ display: 'block', fontSize: '0.8rem', padding: 0 }}>{f.description}</span>
                        )}
                        <span className={styles.muted} style={{ display: 'block', fontSize: '0.76rem', padding: 0 }}>
                          {f.playerRebatePercent}% rebate
                          {f.startDate && ` · ${fmtDate(f.startDate)}`}
                          {f.endDate   && ` → ${fmtDate(f.endDate)}`}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Raised" style={{ color: 'var(--success-light)', fontWeight: 700 }}>
                    {fmt(f.totalRaised)}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Team keeps" style={{ fontWeight: 700 }}>
                    {fmt(f.teamNet)}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Credits" style={{ color: f.totalCredits > 0.005 ? 'var(--home-plum, #a855f7)' : 'var(--home-dim, rgba(255,255,255,0.35))', fontWeight: 700 }}>
                    {fmt(f.totalCredits)}
                  </td>
                  <td className={styles.td} data-label="Status">
                    <span className={`${styles.badge} ${f.isActive ? styles.badgeActive : styles.badgeArchived}`}>
                      {f.isActive ? 'Active' : 'Closed'}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                    <Link href={`${base}/accounting/fundraisers/${f.id}`} className={styles.linkBtn} aria-label={`Open ${f.name}`}>
                      <span className={styles.cardActionLabel}>Open fundraiser</span>
                      <ChevronRight size={16} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.modal}>
            <CoachModalHeader title="New Fundraiser" onClose={closeModal} titleTag="h2" closeIconSize={18} />
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
                  <label className={styles.label}>Player Rebate %</label>
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
                    % of each player's earnings credited to their dues
                  </p>
                </div>
                <div className={styles.field}>
                  {/* spacer */}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Start Date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={formStart}
                    onChange={e => setFormStart(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>End Date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={formEnd}
                    onChange={e => setFormEnd(e.target.value)}
                  />
                </div>
              </div>
              {formError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{formError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={saving}>
                  {saving ? 'Creating…' : 'Create Fundraiser'}
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
