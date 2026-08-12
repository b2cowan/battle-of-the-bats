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
      {/* Page-header ruling 2026-08-11: one shape; the primary keeps its words at every width. */}
      <CoachPageHeader
        embedded={embedded}
        icon={Gift}
        title="Fundraisers"
        season={page.season}
        teamBase={page.teamBase}
        actions={canWriteMoney && (
          <button className={styles.btnPrimary} onClick={openModal}>
            <Plus size={16} /> New Fundraiser
          </button>
        )}
        helpLabel="Fundraisers"
        help={{ module: 'coaches', sectionIds: ['premium-money'], fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {fundraisers.map(f => (
            <Link
              key={f.id}
              href={`${base}/accounting/fundraisers/${f.id}`}
              className={styles.detailSection}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  <TrendingUp size={18} style={{ color: 'var(--success-light)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))', margin: '0 0 0.15rem', fontSize: '0.97rem' }}>
                      {f.name}
                    </p>
                    {f.description && (
                      <p className={styles.muted} style={{ margin: 0, fontSize: '0.82rem', padding: 0 }}>{f.description}</p>
                    )}
                    <p className={styles.muted} style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', padding: 0 }}>
                      {f.playerRebatePercent}% rebate
                      {f.startDate && ` · ${fmtDate(f.startDate)}`}
                      {f.endDate   && ` → ${fmtDate(f.endDate)}`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--home-dim, rgba(255,255,255,0.35))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Raised</p>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--success-light)', fontSize: '1rem' }}>{fmt(f.totalRaised)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--home-dim, rgba(255,255,255,0.35))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Team Keeps</p>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.8))', fontSize: '1rem' }}>{fmt(f.teamNet)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--home-dim, rgba(255,255,255,0.35))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Credits</p>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--home-plum, #a855f7)', fontSize: '1rem' }}>{fmt(f.totalCredits)}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <span className={`${styles.badge} ${f.isActive ? styles.badgeActive : styles.badgeArchived}`}>
                      {f.isActive ? 'Active' : 'Closed'}
                    </span>
                    <ChevronRight size={16} style={{ color: 'var(--home-dim, rgba(255,255,255,0.2))' }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
