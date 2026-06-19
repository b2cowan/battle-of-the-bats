'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CalendarDays, X, Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import { LeagueCapUpgradeModal } from '@/components/admin/LeagueCapUpgrade';
import HelpCallout from '@/components/help/HelpCallout';
import HelpTooltip from '@/components/help/HelpTooltip';
import styles from './house-league.module.css';
import type { LeagueSeason, LeagueSeasonSummary, LeagueSeasonStatus } from '@/lib/types';
import type { LeagueCapKind } from '@/lib/free-floor';
import { SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

type StatusClass = keyof typeof STATUS_LABELS;
const STATUS_LABELS: Record<string, string> = {
  draft:                'Draft',
  registration_open:    'Registration Open',
  registration_closed:  'Registration Closed',
  active:               'Active',
  completed:            'Completed',
  archived:             'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft:                styles.statusDraft,
  registration_open:    styles.statusRegistrationOpen,
  registration_closed:  styles.statusRegistrationClosed,
  active:               styles.statusActive,
  completed:            styles.statusCompleted,
  archived:             styles.statusArchived,
};

const NEXT_TRANSITION: Record<string, { status: LeagueSeasonStatus; label: string; danger?: boolean } | null> = {
  draft:               { status: 'registration_open',   label: 'Open Registration' },
  registration_open:   { status: 'registration_closed', label: 'Close Registration' },
  registration_closed: { status: 'active',              label: 'Start Season' },
  active:              { status: 'completed',           label: 'Mark Complete' },
  completed:           { status: 'archived',            label: 'Archive', danger: true },
  archived:            null,
};

// ── Create season form state ───────────────────────────────────────────────────

interface SeasonForm {
  name: string;
  slug: string;
  sport: string;
  division: string;
  description: string;
  seasonStartDate: string;
  seasonEndDate: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  registrationFee: string;
  waiverText: string;
  autoApproveUnderCapacity: boolean;
  autoPromoteWaitlist: boolean;
  autoGenerateFees: boolean;
}

const BLANK_FORM: SeasonForm = {
  name: '',
  slug: '',
  sport: DEFAULT_SPORT,
  division: '',
  description: '',
  seasonStartDate: '',
  seasonEndDate: '',
  registrationOpenAt: '',
  registrationCloseAt: '',
  registrationFee: '',
  waiverText: '',
  autoApproveUnderCapacity: false,
  autoPromoteWaitlist: false,
  autoGenerateFees: false,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HouseLeaguePage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const isAdmin = userRole === 'owner' || userRole === 'league_admin';

  const [summaries, setSummaries]     = useState<LeagueSeasonSummary[]>([]);
  const [fetching,  setFetching]      = useState(true);
  const [createOpen, setCreateOpen]   = useState(false);
  const [form, setForm]               = useState<SeasonForm>(BLANK_FORM);
  const [slugEdited, setSlugEdited]   = useState(false);
  const [creating,  setCreating]      = useState(false);
  const [capHit,    setCapHit]        = useState<LeagueCapKind | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg,  setFeedbackMsg]  = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res  = await fetch(`/api/admin/house-league/seasons${orgQuery}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setSummaries(data.seasons ?? []);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load seasons.');
    } finally {
      setFetching(false);
    }
  }, [orgQuery]);

  useEffect(() => {
    if (currentOrg) load();
  }, [currentOrg, load]);

  // Auto-derive slug from name unless user has manually edited it
  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      slug: slugEdited ? f.slug : slugify(name),
    }));
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    setForm(f => ({ ...f, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
  }

  function openCreate() {
    setForm(BLANK_FORM);
    setSlugEdited(false);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.slug.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/house-league/seasons${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:                     form.name.trim(),
          slug:                     form.slug.trim(),
          sport:                    form.sport || DEFAULT_SPORT,
          division:                 form.division.trim() || null,
          description:              form.description.trim() || null,
          seasonStartDate:          form.seasonStartDate || null,
          seasonEndDate:            form.seasonEndDate   || null,
          registrationOpenAt:       form.registrationOpenAt  ? form.registrationOpenAt  + ':00Z' : null,
          registrationCloseAt:      form.registrationCloseAt ? form.registrationCloseAt + ':00Z' : null,
          registrationFee:          form.registrationFee ? parseFloat(form.registrationFee) : null,
          waiverText:               form.waiverText.trim() || null,
          autoApproveUnderCapacity: form.autoApproveUnderCapacity,
          autoPromoteWaitlist:      form.autoPromoteWaitlist,
          autoGenerateFees:         form.autoGenerateFees,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Free-floor cap hit → upgrade-aware modal instead of a generic error.
        if (data.capHit) { setCreateOpen(false); setCapHit(data.capHit); return; }
        throw new Error(data.error ?? 'Failed to create season');
      }
      setCreateOpen(false);
      await load();
      showFeedback('success', `Season "${form.name}" created.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to create season.');
    } finally {
      setCreating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_house_league')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the House League module. Contact your organization owner to enable it.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><CalendarDays size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>House League</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — all seasons</p>
          </div>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Create Season
          </button>
        )}
      </div>

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : summaries.length === 0 ? (
        <div className={styles.emptyState}>
          <HelpCallout
            variant="info"
            title="Get started with House League"
            body="A season groups one division of players for one competitive cycle — registrations, teams, schedule, and standings all belong to a season. Create one to get started."
          />
          {isAdmin && (
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={openCreate}>
                Create your first season
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.seasonGrid}>
          {summaries.map(({ season, activeRegistrationCount, waitlistCount, pendingReviewCount, divisionCount }) => (
            <SeasonCard
              key={season.id}
              season={season}
              activeCount={activeRegistrationCount}
              waitlistCount={waitlistCount}
              pendingCount={pendingReviewCount}
              divisionCount={divisionCount}
              base={base}
              isAdmin={isAdmin}
              onTransition={load}
              orgSlug={currentOrg?.slug}
            />
          ))}
        </div>
      )}

      {/* Create Season modal */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={() => setCreateOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create Season</h3>
              <button className={styles.modalCloseBtn} onClick={() => setCreateOpen(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="hl-name">Season Name <span style={{ color: '#f87171' }}>*</span></label>
                <input
                  id="hl-name"
                  className={styles.input}
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. U11 Summer 2025"
                  maxLength={120}
                  autoFocus
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="hl-slug">Slug <span style={{ color: '#f87171' }}>*</span></label>
                <input
                  id="hl-slug"
                  className={styles.input}
                  type="text"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="e.g. u11-summer-2025"
                />
                <p className={styles.hint}>Used in public URLs. Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-sport">Sport</label>
                <select
                  id="hl-sport"
                  className={styles.select}
                  value={form.sport}
                  onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
                >
                  {SPORT_OPTIONS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-division">Division</label>
                <input
                  id="hl-division"
                  className={styles.input}
                  type="text"
                  value={form.division}
                  onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                  placeholder="e.g. U11, U13, Adult"
                  maxLength={30}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-start">Season Start</label>
                <input
                  id="hl-start"
                  className={styles.input}
                  type="date"
                  value={form.seasonStartDate}
                  onChange={e => setForm(f => ({ ...f, seasonStartDate: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-end">Season End</label>
                <input
                  id="hl-end"
                  className={styles.input}
                  type="date"
                  value={form.seasonEndDate}
                  onChange={e => setForm(f => ({ ...f, seasonEndDate: e.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="hl-desc">Description</label>
                <textarea
                  id="hl-desc"
                  className={styles.textarea}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description shown on the public registration page"
                  rows={3}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-reg-open">Registration Opens</label>
                <input
                  id="hl-reg-open"
                  className={styles.input}
                  type="datetime-local"
                  value={form.registrationOpenAt}
                  onChange={e => setForm(f => ({ ...f, registrationOpenAt: e.target.value }))}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="hl-reg-close">Registration Closes</label>
                <input
                  id="hl-reg-close"
                  className={styles.input}
                  type="datetime-local"
                  value={form.registrationCloseAt}
                  onChange={e => setForm(f => ({ ...f, registrationCloseAt: e.target.value }))}
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="hl-fee">Registration Fee (CAD)</label>
                <input
                  id="hl-fee"
                  className={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.registrationFee}
                  onChange={e => setForm(f => ({ ...f, registrationFee: e.target.value }))}
                  placeholder="e.g. 150.00 (display-only; fees are not collected here)"
                />
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="hl-waiver">Waiver Text</label>
                <textarea
                  id="hl-waiver"
                  className={styles.textarea}
                  value={form.waiverText}
                  onChange={e => setForm(f => ({ ...f, waiverText: e.target.value }))}
                  placeholder="Optional waiver shown on the public registration form"
                  rows={4}
                />
              </div>
            </div>

            {/* Automation section */}
            <div className={styles.automationSection} style={{ marginTop: '1rem' }}>
              <p className={styles.automationSectionTitle}>Automation</p>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Auto-approve registrations</div>
                  <div className={styles.toggleDesc}>
                    Automatically approve submissions while a division has open spots. New registrations go directly to Active status without manual review.
                  </div>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.autoApproveUnderCapacity}
                    onChange={e => setForm(f => ({ ...f, autoApproveUnderCapacity: e.target.checked }))}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Auto-promote from waitlist</div>
                  <div className={styles.toggleDesc}>
                    Automatically move the next waitlisted player to Active when a spot opens due to a withdrawal or decline.
                  </div>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.autoPromoteWaitlist}
                    onChange={e => setForm(f => ({ ...f, autoPromoteWaitlist: e.target.checked }))}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <div className={styles.toggleTitle}>Auto-generate fee entries</div>
                  <div className={styles.toggleDesc}>
                    Create an accounting entry when a registration is approved (requires Accounting module).
                  </div>
                </div>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.autoGenerateFees}
                    onChange={e => setForm(f => ({ ...f, autoGenerateFees: e.target.checked }))}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating || !form.name.trim() || !form.slug.trim()}
              >
                {creating ? 'Creating…' : 'Create Season'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />

      {capHit && <LeagueCapUpgradeModal capHit={capHit} onClose={() => setCapHit(null)} orgId={currentOrg?.id} />}
    </div>
  );
}

// ── Season Card ────────────────────────────────────────────────────────────────

function SeasonCard({
  season,
  activeCount,
  waitlistCount,
  pendingCount,
  divisionCount,
  base,
  isAdmin,
  onTransition,
  orgSlug,
}: {
  season: LeagueSeason;
  activeCount: number;
  waitlistCount: number;
  pendingCount: number;
  divisionCount: number;
  base: string;
  isAdmin: boolean;
  onTransition: () => void;
  orgSlug: string | undefined;
}) {
  const [transitioning, setTransitioning] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const seasonOrgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';

  const href = `${base}/house-league/seasons/${season.id}`;
  const next = NEXT_TRANSITION[season.status] ?? null;

  async function doTransition(newStatus: LeagueSeasonStatus) {
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${season.id}${seasonOrgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setConfirmArchive(false);
      onTransition();
    } catch (e: any) {
      setTransitionError(e.message ?? 'Failed to update season status.');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className={styles.seasonCard}>
      <div className={styles.seasonCardTop}>
        <span className={styles.seasonName}>{season.name}</span>
      </div>

      <div className={styles.seasonCardMeta}>
        {season.division && (
          <span className={styles.divisionBadge}>{season.division}</span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className={`${styles.statusBadge} ${STATUS_CSS[season.status] ?? ''}`}>
            {STATUS_LABELS[season.status] ?? season.status}
          </span>
          <HelpTooltip
            title="Season statuses"
            body="Draft: configuration only, not visible publicly. Registration Open: public form is live for parents. Registration Closed: building teams and schedule. Active: games underway. Completed: season is over. Archived: season is retired."
          />
        </span>
      </div>

      <div className={styles.seasonStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Active</span>
          <span className={styles.statValue}>{activeCount}</span>
        </div>
        {pendingCount > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{pendingCount}</span>
          </div>
        )}
        {waitlistCount > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Waitlist</span>
            <span className={styles.statValue}>{waitlistCount}</span>
          </div>
        )}
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Divisions</span>
          <span className={styles.statValue}>{divisionCount}</span>
        </div>
      </div>

      {(season.seasonStartDate || season.seasonEndDate) && (
        <p style={{ fontSize: '0.78rem', color: 'var(--white-35)', margin: '0 0 0.75rem' }}>
          {season.seasonStartDate ? formatDate(season.seasonStartDate) : '?'}
          {' — '}
          {season.seasonEndDate ? formatDate(season.seasonEndDate) : '?'}
        </p>
      )}

      <div className={styles.seasonCardActions}>
        <Link href={href} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
          View Season →
        </Link>

        {isAdmin && next && (
          confirmArchive ? (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--white-50)' }}>Archive this season?</span>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                disabled={transitioning}
                onClick={() => doTransition('archived')}
              >
                {transitioning ? 'Archiving…' : 'Confirm'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                disabled={transitioning}
                onClick={() => setConfirmArchive(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={next.danger ? 'btn btn-danger' : 'btn btn-secondary'}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              disabled={transitioning}
              onClick={() => {
                if (next.status === 'archived') {
                  setConfirmArchive(true);
                } else {
                  doTransition(next.status);
                }
              }}
            >
              {transitioning ? 'Updating…' : next.label}
            </button>
          )
        )}
      </div>

      {transitionError && (
        <p style={{ fontSize: '0.78rem', color: 'var(--danger)', margin: '0.5rem 0 0' }}>
          {transitionError}
        </p>
      )}
    </div>
  );
}
