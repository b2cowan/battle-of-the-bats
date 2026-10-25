'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Users, Trophy, CalendarDays, UserCheck, Shield,
  Lock, RefreshCw, Trash2, CheckCircle, AlertCircle, Loader, Zap,
  CreditCard, BookOpen, Terminal, ClipboardList, X,
} from 'lucide-react';
import styles from './dev.module.css';
import kit from '../console.module.css';
import { humanize } from '../chips';
import AgentPlaybook from './AgentPlaybook';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import type { OrgPlan } from '@/lib/types';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface MembershipData {
  byOrg: {
    orgId:   string;
    slug:    string;
    name:    string;
    planId:  string;
    members: { userId: string; email: string; role: string }[];
  }[];
  byUser: {
    userId: string;
    email:  string;
    orgs: { orgId: string; slug: string; name: string; planId: string; role: string }[];
  }[];
}

interface OrgRow {
  id: string;
  slug: string;
  name: string;
  plan_id: string;
  protected: boolean;
  account_kind: string;
}

interface OrgSelectOption {
  id: string;
  slug: string;
  plan_id: string;
}

interface Status {
  orgs: number;
  platformUsers: number;
  tournaments: number;
  leagueSeasons: number;
  repTeams: number;
  teamWorkspaces: number;
  teamClaims: number;
  orgUsers: number;
  orgList: OrgRow[];
}

interface SeedResult {
  ok: boolean;
  log?: string[];
  error?: string;
}

interface DevUser {
  userId: string;
  email: string;
  ownedOrgs: { orgId: string; slug: string; planId: string }[];
  otherMemberships: { orgId: string; slug: string; role: string }[];
}

interface ReadinessCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface TeamCheckoutReadiness {
  stripeEnvironment: 'sandbox' | 'live' | 'not_configured';
  priceEnvironment: 'sandbox' | 'live';
  billingMockEnabled: boolean;
  stripeConfigured: boolean;
  readyForMockSmoke: boolean;
  readyForStripeSmoke: boolean;
  checks: ReadinessCheck[];
  manualNextSteps: string[];
}

interface MockBillingConfig {
  ok: boolean;
  envEnabled: boolean;
  override: boolean | null;
  effectiveEnabled: boolean;
  source: 'env' | 'runtime_override' | 'production';
  nodeEnv: string;
  stripeConfigured: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────


// Labels and prices come from the plan config (the plan facts' single source), never restated here.
const ORG_PLAN_IDS: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club', 'club_large'];
const ORG_PLAN_OPTIONS: { value: OrgPlan; label: string; price: string }[] = ORG_PLAN_IDS.map(id => {
  const plan = PLAN_CONFIG[id];
  return {
    value: id,
    label: plan.label,
    price: plan.monthlyPrice > 0 ? `${formatPriceAmount(plan.monthlyPrice)}/mo` : formatPriceAmount(plan.monthlyPrice),
  };
});

// Each plan wears a distinct tint, drawn from the status tokens (the module's tone classes set one custom property).
const PLAN_TONES: Record<string, string> = {
  tournament:      styles.toneOk,
  tournament_plus: styles.toneInfo,
  league:          styles.toneWarn,
  club:            styles.toneOlive,
  club_large:      styles.toneOlive,
  team:            styles.toneQuiet,
};
const planTone = (planId: string): string => PLAN_TONES[planId] ?? PLAN_TONES.tournament;

// Dev-tools plan badge label — the legacy keys keep their raw words (sentence case), and the new band
// renders with its proper name (raw '_'-replace would show "club large").
function planBadgeLabel(id: string): string {
  if (id === 'club_large') return 'Club · Association';
  return humanize(id);
}

// Plan gates toggle is only available when NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE=true
// (.env.local only — not set on Amplify dev or production)
const PLAN_GATES_TOGGLE_ENABLED =
  process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE === 'true';

// ─── Live credentials explorer ───────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', staff: 'Staff', coach: 'Coach',
  league_admin: 'League Admin', treasurer: 'Treasurer', official: 'Volunteer',
};

function LiveCredentials({ data }: { data: MembershipData | null }) {
  const [view,            setView]            = useState<'byOrg' | 'byUser'>('byOrg');
  const [selectedOrgId,   setSelectedOrgId]   = useState<string | null>(null);
  const [selectedUserId,  setSelectedUserId]  = useState<string | null>(null);

  // Auto-select first item when data loads or view changes
  const activeOrgId  = selectedOrgId  ?? data?.byOrg[0]?.orgId  ?? null;
  const activeUserId = selectedUserId ?? data?.byUser[0]?.userId ?? null;

  const activeOrg  = data?.byOrg.find(o => o.orgId  === activeOrgId);
  const activeUser = data?.byUser.find(u => u.userId === activeUserId);

  return (
    <div className={styles.liveCredBox}>
      {/* Header row */}
      <div className={styles.liveCredHeader}>
        <span className={styles.liveCredLabel}>
          DB memberships — password: <code>devpass123</code>
        </span>
        <div className={styles.liveCredViewToggle}>
          <button
            className={`${styles.liveCredViewBtn} ${view === 'byOrg' ? styles.liveCredViewBtnActive : ''}`}
            onClick={() => setView('byOrg')}
          >
            By org
          </button>
          <button
            className={`${styles.liveCredViewBtn} ${view === 'byUser' ? styles.liveCredViewBtnActive : ''}`}
            onClick={() => setView('byUser')}
          >
            By user
          </button>
        </div>
      </div>

      {!data ? (
        <div className={styles.credEmpty}>Loading memberships…</div>
      ) : view === 'byOrg' ? (
        <>
          {/* Org pill selector */}
          {data.byOrg.length === 0 ? (
            <div className={styles.credEmpty}>No orgs seeded yet — seed an org first</div>
          ) : (
            <>
              <div className={styles.credPills}>
                {data.byOrg.map(org => {
                  const isActive = org.orgId === activeOrgId;
                  return (
                    <button
                      key={org.orgId}
                      className={`${styles.credPill} ${isActive ? styles.credPillActive : ''}`}
                      onClick={() => setSelectedOrgId(org.orgId)}
                    >
                      {org.slug}
                      <span className={`${styles.planBadge} ${planTone(org.planId)}`}>
                        {planBadgeLabel(org.planId)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Members of selected org */}
              {activeOrg && (
                <div className={styles.credDetail}>
                  <div className={styles.credDetailHeader}>
                    <span className={styles.credDetailTitle}>/{activeOrg.slug}/admin</span>
                    <span className={styles.credDetailCount}>{activeOrg.members.length} member{activeOrg.members.length !== 1 ? 's' : ''}</span>
                  </div>
                  {activeOrg.members.length === 0 ? (
                    <div className={styles.credEmpty}>No members — run Seed users</div>
                  ) : (
                    activeOrg.members.map(m => (
                      <div key={m.userId} className={styles.credDetailRow}>
                        <code className={styles.credDetailEmail}>{m.email}</code>
                        <span className={styles.credDetailRole}>{ROLE_DISPLAY[m.role] ?? m.role}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* User pill selector */}
          {data.byUser.length === 0 ? (
            <div className={styles.credEmpty}>No users seeded yet — seed an org + run Seed users first</div>
          ) : (
            <>
              <div className={styles.credPills}>
                {data.byUser.map(u => (
                  <button
                    key={u.userId}
                    className={`${styles.credPill} ${u.userId === activeUserId ? styles.credPillActive : ''}`}
                    onClick={() => setSelectedUserId(u.userId)}
                  >
                    {u.email.replace('@dev.local', '')}
                    <span className={styles.credPillCount}>
                      {u.orgs.length} org{u.orgs.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>

              {/* Orgs for selected user */}
              {activeUser && (
                <div className={styles.credDetail}>
                  <div className={styles.credDetailHeader}>
                    <span className={styles.credDetailTitle}>{activeUser.email}</span>
                    <span className={styles.credDetailCount}>{activeUser.orgs.length} org{activeUser.orgs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {activeUser.orgs.length === 0 ? (
                    <div className={styles.credEmpty}>No org memberships</div>
                  ) : (
                    activeUser.orgs.map(o => {
                      return (
                        <div key={o.orgId} className={styles.credDetailRow}>
                          <code className={styles.credDetailSlug}>/{o.slug}</code>
                          <span className={`${styles.planBadge} ${planTone(o.planId)}`}>
                            {planBadgeLabel(o.planId)}
                          </span>
                          <span className={styles.credDetailRole}>{ROLE_DISPLAY[o.role] ?? o.role}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Org seed modal ───────────────────────────────────────────────────────────

function OrgSeedModal({
  open,
  onClose,
  onSeed,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSeed: (plan: OrgPlan) => void;
  busy: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = useState<OrgPlan>('club');

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (() => !busy && onClose())?.(); }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>Seed org + owner</p>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Plan picker */}
        <div>
          <div className={styles.modalSublabel}>Select plan tier</div>
          <div className={styles.planGrid}>
            {ORG_PLAN_OPTIONS.map(opt => {
              const active = selectedPlan === opt.value;
              return (
                <button
                  key={opt.value}
                  className={`${styles.planTile} ${planTone(opt.value)} ${active ? styles.planTileActive : ''}`}
                  onClick={() => setSelectedPlan(opt.value)}
                >
                  <span className={styles.planTileName}>
                    {opt.label}
                  </span>
                  <span className={styles.planTilePrice}>{opt.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.modalActions}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onSeed(selectedPlan)} disabled={busy}>
            {busy ? <Loader size={13} className={kit.spin} /> : 'Seed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Org list panel ───────────────────────────────────────────────────────────

function OrgListPanel({
  orgList,
  onWipeOrg,
  wipingOrgId,
  wipeResults,
}: {
  orgList: OrgRow[];
  onWipeOrg: (orgId: string) => void;
  wipingOrgId: string | null;
  wipeResults: Record<string, SeedResult>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className={styles.orgListPanel}>
      <div className={styles.orgListHeader}>
        <Building2 size={13} className={styles.listIcon} />
        <span className={styles.orgListTitle}>
          Seeded orgs ({orgList.length})
        </span>
      </div>

      {orgList.length === 0 ? (
        <div className={styles.orgEmptyMsg}>No orgs seeded yet</div>
      ) : (
        orgList.map(org => {
          const isConfirming = confirmId === org.id;
          const isWiping     = wipingOrgId === org.id;
          const result       = wipeResults[org.id];

          return (
            <div key={org.id}>
              <div className={styles.orgRow}>
                {/* Slug + optional UAT badge */}
                <span className={styles.orgSlug}>
                  {org.slug}
                  {org.protected && (
                    <span className={`${kit.chip} ${kit.chipWarn} ${styles.uatTag}`}>
                      UAT
                    </span>
                  )}
                </span>

                {/* Plan badge */}
                <span className={`${styles.planBadge} ${planTone(org.plan_id)}`}>
                  {planBadgeLabel(org.plan_id)}
                </span>

                {/* Wipe action */}
                {org.protected ? (
                  /* UAT-protected — show lock, no wipe */
                  <div className={styles.orgLock}>
                    <Lock size={12} />
                  </div>
                ) : isConfirming ? (
                  <div className={styles.orgWipeConfirm}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => { onWipeOrg(org.id); setConfirmId(null); }}
                      disabled={isWiping}
                    >
                      {isWiping ? <Loader size={11} className={kit.spin} /> : 'Wipe'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmId(null)}
                      disabled={isWiping}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.orgWipeBtn}
                    onClick={() => setConfirmId(org.id)}
                    disabled={wipingOrgId !== null}
                    title={`Wipe ${org.slug}`}
                    aria-label={`Wipe ${org.slug}`}
                  >
                    {isWiping
                      ? <Loader size={11} className={kit.spin} />
                      : <Trash2 size={12} />
                    }
                  </button>
                )}
              </div>

              {/* Per-org wipe result */}
              {result && (
                <div
                  className={`${result.ok ? styles.logOk : styles.logErr} ${styles.logRowResult}`}
                >
                  {result.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                  <div className={styles.logLines}>
                    {result.error && <div>{result.error}</div>}
                    {result.log?.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── User list panel ──────────────────────────────────────────────────────────

function UserListPanel({
  users,
  onDeleteUser,
  deletingUserId,
  deleteResults,
}: {
  users: DevUser[];
  onDeleteUser: (userId: string) => void;
  deletingUserId: string | null;
  deleteResults: Record<string, SeedResult>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [modalUser, setModalUser] = useState<DevUser | null>(null);

  function handleDeleteClick(user: DevUser) {
    if (deletingUserId) return;
    if (user.ownedOrgs.length > 0) {
      setModalUser(user);
    } else {
      setConfirmId(confirmId === user.userId ? null : user.userId);
    }
  }

  return (
    <div className={styles.orgListPanel}>
      <div className={styles.orgListHeader}>
        <Users size={13} className={styles.listIcon} />
        <span className={styles.orgListTitle}>Auth users ({users.length})</span>
      </div>

      {users.length === 0 ? (
        <div className={styles.orgEmptyMsg}>No deletable auth users</div>
      ) : (
        users.map(user => {
          const isConfirming = confirmId === user.userId;
          const isDeleting   = deletingUserId === user.userId;
          const result       = deleteResults[user.userId];

          return (
            <div key={user.userId}>
              <div className={styles.orgRow}>
                <span className={styles.orgEmail}>{user.email}</span>

                <div className={styles.userOrgTags}>
                  {user.ownedOrgs.map(o => (
                    <span key={o.orgId} className={`${kit.chip} ${kit.chipBad}`}>
                      /{o.slug} owner
                    </span>
                  ))}
                  {user.otherMemberships.map(m => (
                    <span key={m.orgId} className={`${kit.chip} ${kit.chipQuiet}`}>
                      /{m.slug} {m.role}
                    </span>
                  ))}
                  {user.ownedOrgs.length === 0 && user.otherMemberships.length === 0 && (
                    <span className={styles.noOrgsText}>no orgs</span>
                  )}
                </div>

                {isConfirming ? (
                  <div className={styles.orgWipeConfirm}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => { onDeleteUser(user.userId); setConfirmId(null); }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? <Loader size={11} className={kit.spin} /> : 'Delete'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setConfirmId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.orgWipeBtn}
                    onClick={() => handleDeleteClick(user)}
                    disabled={deletingUserId !== null}
                    title={`Delete ${user.email}`}
                    aria-label={`Delete ${user.email}`}
                  >
                    {isDeleting
                      ? <Loader size={11} className={kit.spin} />
                      : <Trash2 size={12} />
                    }
                  </button>
                )}
              </div>

              {result && (
                <div
                  className={`${result.ok ? styles.logOk : styles.logErr} ${styles.logRowResult}`}
                >
                  {result.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                  <div className={styles.logLines}>
                    {result.error && <div>{result.error}</div>}
                    {result.log?.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {modalUser && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (() => setModalUser(null))?.(); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>Delete user</p>
              <button
                className={styles.closeBtn}
                onClick={() => setModalUser(null)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            <p className={styles.modalLead}>
              Deleting <strong>{modalUser.email}</strong> will also permanently delete the following owned org(s) and all their data:
            </p>
            <div className={styles.ownedList}>
              {modalUser.ownedOrgs.map(o => (
                <div key={o.orgId} className={styles.ownedRow}>
                  <span className={styles.ownedSlug}>
                    /{o.slug}
                  </span>
                  <span className={`${styles.planBadge} ${planTone(o.planId)}`}>
                    {planBadgeLabel(o.planId)}
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.modalFine}>
              This cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalUser(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { onDeleteUser(modalUser.userId); setModalUser(null); }}
              >
                <Trash2 size={13} /> Delete user + orgs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ count, label }: { count: number; label: string }) {
  return (
    <span className={`${kit.chip} ${count > 0 ? kit.chipOk : kit.chipQuiet}`}>
      {count} {label}
    </span>
  );
}

// ─── Readiness panel ──────────────────────────────────────────────────────────

function ReadinessPanel({
  readiness,
  onRefresh,
}: {
  readiness: TeamCheckoutReadiness | null;
  onRefresh: () => void;
}) {
  const failing = readiness?.checks.filter(item => item.status === 'fail').length ?? 0;
  const warning = readiness?.checks.filter(item => item.status === 'warn').length ?? 0;

  return (
    <section className={styles.readinessPanel}>
      <div className={styles.readinessHeader}>
        <div className={styles.readinessIcon}><CreditCard size={17} /></div>
        <div className={styles.cardMeta}>
          <div className={styles.cardTitle}>Coaches Portal Checkout Readiness</div>
          <div className={styles.cardDesc}>
            Confirms Coaches Portal price slots, app URL, plan gate, webhook secret, and Stripe price metadata.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh checkout readiness" aria-label="Refresh checkout readiness">
          <RefreshCw size={14} />
        </button>
      </div>

      {!readiness ? (
        <div className={styles.logOk}>
          <Loader size={12} className={kit.spin} />
          <div>Checking Coaches Portal checkout setup...</div>
        </div>
      ) : (
        <>
          <div className={styles.readinessSummary}>
            <span className={`${kit.chip} ${readiness.readyForStripeSmoke ? kit.chipOk : kit.chipQuiet}`}>
              Stripe smoke {readiness.readyForStripeSmoke ? 'ready' : 'blocked'}
            </span>
            <span className={`${kit.chip} ${kit.chipQuiet}`}>
              Env: {readiness.stripeEnvironment}
            </span>
            <span className={`${kit.chip} ${failing > 0 ? kit.chipBad : kit.chipOk}`}>
              {failing} failing
            </span>
            <span className={`${kit.chip} ${warning > 0 ? kit.chipWarn : kit.chipOk}`}>
              {warning} warnings
            </span>
          </div>

          <div className={styles.readinessChecks}>
            {readiness.checks.map(item => (
              <div key={item.key} className={`${styles.readinessCheck} ${styles[`readiness${item.status}`]}`}>
                {item.status === 'pass' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.readinessSteps}>
            <div className={styles.creates}>Stripe smoke checklist</div>
            <ol>
              {readiness.manualNextSteps.map(step => <li key={step}>{step}</li>)}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Mock billing panel ───────────────────────────────────────────────────────

function MockBillingPanel({
  config,
  busy,
  onSetOverride,
}: {
  config: MockBillingConfig | null;
  busy: boolean;
  onSetOverride: (enabled: boolean | null) => void;
}) {
  const sourceLabel = !config
    ? 'Loading'
    : config.source === 'runtime_override'
      ? 'Dev tools override'
      : config.source === 'production'
        ? 'Production locked'
        : '.env.local default';

  const description = !config
    ? 'Loading mock billing state...'
    : config.effectiveEnabled
      ? 'Mock billing is on for this dev server. Checkout paths can provision without completing Stripe.'
      : config.stripeConfigured
        ? 'Mock billing is off. Checkout uses configured Stripe test mode.'
        : 'Mock billing is off. Non-production checkout still direct-provisions when Stripe is missing.';

  return (
    <section className={styles.toolPanel}>
      <div className={styles.toolHeader}>
        <Zap size={15} />
        <div className={styles.cardMeta}>
          <div className={styles.cardTitle}>Mock billing</div>
          <div className={styles.cardDesc}>{description}</div>
        </div>
      </div>

      <div className={styles.toolStatus}>
        <span className={`${kit.chip} ${config?.effectiveEnabled ? kit.chipOk : kit.chipQuiet}`}>
          {config?.effectiveEnabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className={`${kit.chip} ${kit.chipQuiet}`}>Source: {sourceLabel}</span>
        <span className={`${kit.chip} ${config?.stripeConfigured ? kit.chipOk : kit.chipWarn}`}>
          Stripe {config?.stripeConfigured ? 'configured' : 'missing'}
        </span>
      </div>

      <div className={styles.toolActions}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onSetOverride(true)}
          disabled={busy || !config || config.effectiveEnabled}
        >
          {busy ? <Loader size={13} className={kit.spin} /> : 'Enable mock'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onSetOverride(false)}
          disabled={busy || !config || !config.effectiveEnabled}
        >
          Disable mock
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onSetOverride(null)}
          disabled={busy || !config || config.override === null}
        >
          Use .env default
        </button>
      </div>
    </section>
  );
}

// ─── Seed card ────────────────────────────────────────────────────────────────

function SeedCard({
  icon: Icon,
  title,
  description,
  creates,
  kind,
  locked,
  lockReason,
  statusBadges,
  orgOptions,
  onSeed,
  busy,
  result,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  creates: string;
  kind?: 'additive' | 'standalone';
  locked: boolean;
  lockReason?: string;
  statusBadges: React.ReactNode;
  orgOptions?: OrgSelectOption[];
  onSeed: (orgId?: string) => void;
  busy: boolean;
  result: SeedResult | null;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // Auto-select first org when options become available
  const firstOrgId = orgOptions?.[0]?.id ?? '';
  useEffect(() => {
    if (firstOrgId && !selectedOrgId) setSelectedOrgId(firstOrgId);
  }, [firstOrgId, selectedOrgId]);

  return (
    <div className={`${styles.card} ${locked ? styles.cardLocked : ''}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <Icon size={18} />
        </div>
        <div className={styles.cardMeta}>
          <div className={styles.cardTitle}>
            {title}
            {kind && (
              <span className={`${kit.chip} ${kind === 'standalone' ? kit.chipQuiet : kit.chipInfo} ${styles.kindBadge}`}>
                {kind === 'standalone' ? 'Standalone' : 'Additive'}
              </span>
            )}
          </div>
          <div className={styles.cardDesc}>{description}</div>
        </div>
        {locked ? (
          <div className={styles.lockWrap} title={lockReason}>
            <Lock size={14} />
          </div>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onSeed(orgOptions && selectedOrgId ? selectedOrgId : undefined)}
            disabled={busy}
          >
            {busy ? <Loader size={13} className={kit.spin} /> : 'Seed'}
          </button>
        )}
      </div>
      <div className={styles.cardFooter}>
        <div className={styles.creates}>Creates: {creates}</div>
        {orgOptions && orgOptions.length > 0 && !locked && (
          <div className={styles.orgSelectorRow}>
            <span className={styles.orgSelectorLabel}>Into:</span>
            <select
              className={styles.orgSelect}
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              disabled={busy}
            >
              {orgOptions.map(o => (
                <option key={o.id} value={o.id}>{o.slug}</option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.badges}>{statusBadges}</div>
      </div>
      {locked && lockReason && (
        <div className={styles.lockMsg}><Lock size={11} /> {lockReason}</div>
      )}
      {result && (
        <div className={result.ok ? styles.logOk : styles.logErr}>
          {result.ok
            ? <CheckCircle size={12} />
            : <AlertCircle size={12} />
          }
          <div className={styles.logLines}>
            {result.error && <div>{result.error}</div>}
            {result.log?.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card sections — static grouping, keys match CARDS ───────────────────────

const CARD_SECTIONS: { label: string; sublabel?: string; keys: string[] }[] = [
  { label: 'Platform access', keys: ['platform-user'] },
  { label: 'Orgs & users',    keys: ['org', 'users']  },
  {
    label:    'Org features',
    sublabel: 'additive — seeds into an existing org',
    keys:     ['tournament', 'house-league', 'rep-team'],
  },
  {
    label:    'Standalone products',
    sublabel: 'creates its own org space',
    keys:     ['team-workspace', 'team-claim'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readPlanGatesCookie(): 'live' | 'enforced' {
  if (typeof document === 'undefined') return 'enforced';
  const match = document.cookie.match(/dev_plan_gates=([^;]+)/);
  return (match?.[1] === 'live') ? 'live' : 'enforced';
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function DevDashboard() {
  const [tab,    setTab]   = useState<'seed' | 'playbook'>('seed');
  const [status, setStatus]   = useState<Status | null>(null);
  const [busy,   setBusy]     = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, SeedResult | null>>({});

  // Wipe-all state
  const [wiping,      setWiping]      = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wipeResult,  setWipeResult]  = useState<SeedResult | null>(null);

  // Per-org wipe state
  const [wipingOrgId,  setWipingOrgId]  = useState<string | null>(null);
  const [orgWipeResults, setOrgWipeResults] = useState<Record<string, SeedResult>>({});

  // Plan gates toggle (local only)
  const [planGatesMode, setPlanGatesMode] = useState<'live' | 'enforced'>(() => readPlanGatesCookie());
  const [planGatesBusy, setPlanGatesBusy] = useState(false);

  // Readiness + mock billing
  const [readiness,       setReadiness]       = useState<TeamCheckoutReadiness | null>(null);
  const [mockBilling,     setMockBilling]     = useState<MockBillingConfig | null>(null);
  const [mockBillingBusy, setMockBillingBusy] = useState(false);

  // Live memberships
  const [memberships, setMemberships] = useState<MembershipData | null>(null);

  // Dev users (deletable auth users)
  const [devUsers,          setDevUsers]          = useState<DevUser[]>([]);
  const [deletingUserId,    setDeletingUserId]    = useState<string | null>(null);
  const [userDeleteResults, setUserDeleteResults] = useState<Record<string, SeedResult>>({});

  // Org seed modal
  const [orgModal, setOrgModal] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/dev/seed/status');
    if (res.ok) setStatus(await res.json());
  }, []);

  const fetchReadiness = useCallback(async () => {
    const res = await fetch('/api/dev/team-checkout-readiness');
    if (res.ok) setReadiness(await res.json());
  }, []);

  const fetchMockBilling = useCallback(async () => {
    const res = await fetch('/api/dev/mock-billing');
    if (res.ok) setMockBilling(await res.json());
  }, []);

  const fetchMemberships = useCallback(async () => {
    const res = await fetch('/api/dev/seed/memberships');
    if (res.ok) setMemberships(await res.json());
  }, []);

  const fetchDevUsers = useCallback(async () => {
    const res = await fetch('/api/dev/users');
    if (res.ok) setDevUsers(await res.json());
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => { void fetchStatus(); });
  }, [fetchStatus]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void fetchReadiness();
      void fetchMockBilling();
      void fetchMemberships();
      void fetchDevUsers();
    });
  }, [fetchReadiness, fetchMockBilling, fetchMemberships, fetchDevUsers]);

  // ── Seed ────────────────────────────────────────────────────────────────────

  async function seed(key: string, endpoint: string, body?: object) {
    setBusy(b => ({ ...b, [key]: true }));
    setResults(r => ({ ...r, [key]: null }));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        ...(body
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
      });
      const data = await res.json() as SeedResult;
      setResults(r => ({ ...r, [key]: data }));
      await fetchStatus();
      void fetchMemberships();
    } catch {
      setResults(r => ({ ...r, [key]: { ok: false, error: 'Network error' } }));
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  }

  async function handleOrgSeed(plan: OrgPlan) {
    await seed('org', '/api/dev/seed/org', { plan });
    setOrgModal(false);
  }

  // ── Per-org wipe ────────────────────────────────────────────────────────────

  async function handleWipeOrg(orgId: string) {
    setWipingOrgId(orgId);
    setOrgWipeResults(r => { const n = { ...r }; delete n[orgId]; return n; });
    try {
      const res  = await fetch('/api/dev/seed/wipe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orgId }),
      });
      const data = await res.json() as SeedResult;
      setOrgWipeResults(r => ({ ...r, [orgId]: data }));
      await fetchStatus();
      void fetchMemberships();
      void fetchDevUsers();
    } catch {
      setOrgWipeResults(r => ({ ...r, [orgId]: { ok: false, error: 'Network error' } }));
    } finally {
      setWipingOrgId(null);
    }
  }

  // ── Delete user ──────────────────────────────────────────────────────────────

  async function handleDeleteUser(userId: string) {
    setDeletingUserId(userId);
    setUserDeleteResults(r => { const n = { ...r }; delete n[userId]; return n; });
    try {
      const res = await fetch('/api/dev/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      });
      const data = await res.json() as SeedResult;
      setUserDeleteResults(r => ({ ...r, [userId]: data }));
      await fetchStatus();
      void fetchMemberships();
      void fetchDevUsers();
    } catch {
      setUserDeleteResults(r => ({ ...r, [userId]: { ok: false, error: 'Network error' } }));
    } finally {
      setDeletingUserId(null);
    }
  }

  // ── Wipe-all ────────────────────────────────────────────────────────────────

  async function handleWipe() {
    setWiping(true);
    setWipeConfirm(false);
    setWipeResult(null);
    try {
      const res  = await fetch('/api/dev/seed/wipe', { method: 'POST' });
      const data = await res.json() as SeedResult;
      setWipeResult(data);
      setResults({});
      setOrgWipeResults({});
      setUserDeleteResults({});
      await fetchStatus();
      void fetchMemberships();
      void fetchDevUsers();
    } catch {
      setWipeResult({ ok: false, error: 'Network error' });
    } finally {
      setWiping(false);
    }
  }

  // ── Plan gates toggle ───────────────────────────────────────────────────────

  async function togglePlanGates() {
    const next = planGatesMode === 'live' ? 'enforced' : 'live';
    setPlanGatesBusy(true);
    try {
      await fetch('/api/dev/set-plan-gates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: next }),
      });
      setPlanGatesMode(next);
      await fetchReadiness();
    } finally {
      setPlanGatesBusy(false);
    }
  }

  // ── Mock billing ────────────────────────────────────────────────────────────

  async function setMockBillingOverride(enabled: boolean | null) {
    setMockBillingBusy(true);
    try {
      const res = await fetch('/api/dev/mock-billing', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabled }),
      });
      if (res.ok) {
        setMockBilling(await res.json());
        await fetchReadiness();
      }
    } finally {
      setMockBillingBusy(false);
    }
  }

  // ── Card definitions ─────────────────────────────────────────────────────

  const hasOrg = (status?.orgs ?? 0) > 0;

  // Org options for additive seeds — exclude team_workspace orgs and UAT-protected orgs
  const addOrgOptions: OrgSelectOption[] = (status?.orgList ?? [])
    .filter(o => !o.protected && o.account_kind !== 'team_workspace')
    .map(o => ({ id: o.id, slug: o.slug, plan_id: o.plan_id }));

  const CARDS = [
    {
      key:         'platform-user',
      endpoint:    '/api/dev/seed/platform-user',
      icon:        Shield,
      title:       'Platform admin',
      description: 'A FieldLogicHQ staff account with access to /platform-admin',
      creates:     'platform@dev.local (platform admin)',
      kind:        undefined as 'additive' | 'standalone' | undefined,
      locked:      false,
      lockReason:  undefined as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.platformUsers ?? 0} label="platform users" />,
    },
    {
      key:         'org',
      endpoint:    '/api/dev/seed/org',
      icon:        Building2,
      title:       'Org + owner',
      description: 'Creates a plan-specific org (dev-tournament-org, dev-league-org, etc.). Re-seed to change its plan.',
      creates:     'dev-{plan}-org, owner@dev.local (owner)',
      kind:        undefined as 'additive' | 'standalone' | undefined,
      locked:      false,
      lockReason:  undefined as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.orgs ?? 0} label="orgs" />,
    },
    {
      key:         'users',
      endpoint:    '/api/dev/seed/users',
      icon:        Users,
      title:       'User set',
      description: 'Plan-appropriate roles for every seeded org — league & club add league-admin and treasurer',
      creates:     'admin/staff/coach for all orgs; league-admin/treasurer for league & club',
      kind:        undefined as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed org + owner first' as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.orgUsers ?? 0} label="non-owner members" />,
    },
    {
      key:         'tournament',
      endpoint:    '/api/dev/seed/tournament',
      icon:        Trophy,
      title:       'Tournament',
      description: 'A full active tournament with two divisions, teams, and a round-robin schedule',
      creates:     '1 tournament, 2 divisions, 8 teams, 12 games',
      kind:        'additive' as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed org + owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.tournaments ?? 0} label="tournaments" />,
    },
    {
      key:         'house-league',
      endpoint:    '/api/dev/seed/house-league',
      icon:        CalendarDays,
      title:       'House league season',
      description: 'An active recreational season with divisions, teams, games, and sample registrations',
      creates:     '1 season, 2 divisions, 6 teams, 6 games, 2 registrations',
      kind:        'additive' as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed org + owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.leagueSeasons ?? 0} label="seasons" />,
    },
    {
      key:         'rep-team',
      endpoint:    '/api/dev/seed/rep-team',
      icon:        UserCheck,
      title:       'Rep team',
      description: 'A competitive team program with roster players, a coach, and upcoming events — added to an existing org',
      creates:     '1 team, 1 program year, 3 players, 1 coach link, 2 events',
      kind:        'additive' as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed org + owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.repTeams ?? 0} label="rep teams" />,
    },
    {
      key:         'team-workspace',
      endpoint:    '/api/dev/seed/team-workspace',
      icon:        CreditCard,
      title:       'Premium Coaches Portal',
      description: 'A self-contained standalone Team workspace with its own org, rep team, season, coach, entitlement, and billing ledger',
      creates:     'dev-standalone-team org + one Premium portal',
      kind:        'standalone' as 'additive' | 'standalone' | undefined,
      locked:      false,
      lockReason:  undefined as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.teamWorkspaces ?? 0} label="premium portals" />,
    },
    {
      key:         'team-claim',
      endpoint:    '/api/dev/seed/team-claim',
      icon:        ClipboardList,
      title:       'Coaches Portal claim link',
      description: 'Creates a secure claim link for a dev tournament team contact',
      creates:     'one available Coaches Portal claim URL',
      kind:        'standalone' as 'additive' | 'standalone' | undefined,
      locked:      (status?.tournaments ?? 0) === 0,
      lockReason:  'Seed tournament first — claim links attach to a tournament team contact' as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.teamClaims ?? 0} label="portal claims" />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`${kit.page} ${kit.reading}`}>
      <AdminPageHeader
        title={tab === 'seed' ? 'Seed dashboard' : 'Agent playbook'}
        actions={tab === 'seed' ? (
          <button className={styles.refreshBtn} onClick={fetchStatus} title="Refresh status" aria-label="Refresh status">
            <RefreshCw size={14} />
          </button>
        ) : undefined}
      />

      {/* Tab strip */}
      <div className={kit.tabs}>
        <button
          className={`${kit.tab} ${tab === 'seed' ? kit.tabOn : ''}`}
          onClick={() => setTab('seed')}
        >
          <Terminal size={12} />
          Seed dashboard
        </button>
        <button
          className={`${kit.tab} ${tab === 'playbook' ? kit.tabOn : ''}`}
          onClick={() => setTab('playbook')}
        >
          <BookOpen size={12} />
          Agent playbook
        </button>
      </div>

      {/* Playbook view */}
      {tab === 'playbook' && <AgentPlaybook />}

      {/* Seed view */}
      {tab === 'seed' && (<>

      {/* Live DB membership explorer */}
      <LiveCredentials data={memberships} />

      <ReadinessPanel readiness={readiness} onRefresh={fetchReadiness} />
      <MockBillingPanel
        config={mockBilling}
        busy={mockBillingBusy}
        onSetOverride={setMockBillingOverride}
      />

      {/* Seed cards — grouped by section */}
      <div className={styles.cards}>
        {CARD_SECTIONS.map(section => {
          const sectionCards = CARDS.filter(c => section.keys.includes(c.key));
          return (
            <div key={section.label} className={styles.cardGroup}>
              <div className={styles.sectionDivider}>
                <span className={styles.sectionLabel}>{section.label}</span>
                {section.sublabel && (
                  <span className={styles.sectionSublabel}>{section.sublabel}</span>
                )}
              </div>
              {sectionCards.map(card => (
                <SeedCard
                  key={card.key}
                  icon={card.icon}
                  title={card.title}
                  description={card.description}
                  creates={card.creates}
                  kind={card.kind}
                  locked={card.locked}
                  lockReason={card.lockReason}
                  statusBadges={card.badges}
                  orgOptions={card.orgOptions}
                  onSeed={card.key === 'org'
                    ? () => setOrgModal(true)
                    : (orgId?: string) => seed(card.key, card.endpoint, orgId ? { orgId } : undefined)}
                  busy={busy[card.key] ?? false}
                  result={results[card.key] ?? null}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Org list — visible whenever status has loaded */}
      {status && (
        <OrgListPanel
          orgList={status.orgList}
          onWipeOrg={handleWipeOrg}
          wipingOrgId={wipingOrgId}
          wipeResults={orgWipeResults}
        />
      )}

      {/* Auth users — all deletable accounts including orphaned ones */}
      <UserListPanel
        users={devUsers}
        onDeleteUser={handleDeleteUser}
        deletingUserId={deletingUserId}
        deleteResults={userDeleteResults}
      />

      {/* Plan gates toggle — local only */}
      {PLAN_GATES_TOGGLE_ENABLED && (
        <div className={styles.gatesBox}>
          <Zap size={15} className={styles.gatesIcon} />
          <div className={styles.gatesText}>
            <div className={styles.gatesTitle}>
              Plan gates
            </div>
            <div className={styles.gatesDesc}>
              {planGatesMode === 'live'
                ? 'All plans treated as live — checkout CTAs visible on pricing page.'
                : 'Gates enforced — League Plus and Club show early-access CTAs.'}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={togglePlanGates}
            disabled={planGatesBusy}
          >
            {planGatesBusy
              ? <Loader size={13} className={kit.spin} />
              : planGatesMode === 'live' ? 'Enforce gates' : 'All live'}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className={styles.danger}>
        <div className={styles.dangerLabel}>Danger zone</div>
        {wipeConfirm ? (
          <div className={styles.wipeConfirm}>
            <span className={styles.dangerDesc}>This deletes all orgs, users, and data. Cannot be undone.</span>
            <button className="btn btn-danger btn-sm" onClick={handleWipe} disabled={wiping}>
              {wiping ? <Loader size={14} className={kit.spin} /> : <Trash2 size={14} />}
              {wiping ? 'Wiping…' : 'Yes, wipe everything'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setWipeConfirm(false)} disabled={wiping}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn-danger btn-sm" onClick={() => setWipeConfirm(true)} disabled={wiping || wipingOrgId !== null}>
              <Trash2 size={14} />
              Wipe everything
            </button>
            <span className={styles.dangerDesc}>Deletes all orgs, all auth users, and all data.</span>
          </>
        )}
        {wipeResult && (
          <div className={`${wipeResult.ok ? styles.logOk : styles.logErr} ${styles.logStandalone}`}>
            {wipeResult.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            <div className={styles.logLines}>
              {wipeResult.error && <div>{wipeResult.error}</div>}
              {wipeResult.log?.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        )}
      </div>

      {/* Org seed modal — rendered at root so it sits above everything */}
      <OrgSeedModal
        open={orgModal}
        onClose={() => setOrgModal(false)}
        onSeed={handleOrgSeed}
        busy={busy['org'] ?? false}
      />

      </>)}
    </div>
  );
}
