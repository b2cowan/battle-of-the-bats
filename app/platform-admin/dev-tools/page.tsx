'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Building2, Users, Trophy, CalendarDays, UserCheck, Shield,
  Lock, RefreshCw, Trash2, CheckCircle, AlertCircle, Loader, Zap,
  CreditCard, BookOpen, Terminal, ClipboardList, X,
} from 'lucide-react';
import styles from './dev.module.css';
import AgentPlaybook from './AgentPlaybook';
import type { OrgPlan } from '@/lib/types';

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


const ORG_PLAN_OPTIONS: { value: OrgPlan; label: string; price: string }[] = [
  { value: 'tournament',      label: 'Tournament',  price: 'Free'    },
  { value: 'tournament_plus', label: 'Tournament+', price: '$39/mo'  },
  { value: 'league',          label: 'League',      price: '$89/mo'  },
  { value: 'club',            label: 'Club',        price: '$179/mo' },
];

const PLAN_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  tournament:      { text: '#86efac', border: 'rgba(34,197,94,0.45)',  bg: 'rgba(34,197,94,0.1)'  },
  tournament_plus: { text: '#93c5fd', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  league:          { text: '#fde68a', border: 'rgba(251,191,36,0.45)', bg: 'rgba(251,191,36,0.1)' },
  club:            { text: '#a5b4fc', border: 'rgba(99,102,241,0.45)', bg: 'rgba(99,102,241,0.1)' },
  team:            { text: '#f9a8d4', border: 'rgba(236,72,153,0.45)', bg: 'rgba(236,72,153,0.1)' },
};

// Plan gates toggle is only available when NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE=true
// (.env.local only — not set on Amplify dev or production)
const PLAN_GATES_TOGGLE_ENABLED =
  process.env.NEXT_PUBLIC_DEV_PLAN_GATES_TOGGLE === 'true';

// ─── Live credentials explorer ───────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', staff: 'Staff', coach: 'Coach',
  league_admin: 'League Admin', treasurer: 'Treasurer', official: 'Scorekeeper',
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
          DB Memberships — password: <code>devpass123</code>
        </span>
        <div className={styles.liveCredViewToggle}>
          <button
            className={`${styles.liveCredViewBtn} ${view === 'byOrg' ? styles.liveCredViewBtnActive : ''}`}
            onClick={() => setView('byOrg')}
          >
            By Org
          </button>
          <button
            className={`${styles.liveCredViewBtn} ${view === 'byUser' ? styles.liveCredViewBtnActive : ''}`}
            onClick={() => setView('byUser')}
          >
            By User
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
                  const pc = PLAN_COLORS[org.planId] ?? PLAN_COLORS.tournament;
                  const isActive = org.orgId === activeOrgId;
                  return (
                    <button
                      key={org.orgId}
                      className={`${styles.credPill} ${isActive ? styles.credPillActive : ''}`}
                      onClick={() => setSelectedOrgId(org.orgId)}
                    >
                      {org.slug}
                      <span
                        className={styles.planBadge}
                        style={{ color: pc.text, borderColor: pc.border, background: pc.bg, fontSize: '0.5rem' }}
                      >
                        {org.planId.replace('_', ' ')}
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
                    <div className={styles.credEmpty}>No members — run Seed Users</div>
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
            <div className={styles.credEmpty}>No users seeded yet — seed an org + run Seed Users first</div>
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
                    <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)' }}>
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
                      const pc = PLAN_COLORS[o.planId] ?? PLAN_COLORS.tournament;
                      return (
                        <div key={o.orgId} className={styles.credDetailRow}>
                          <code className={styles.credDetailSlug}>/{o.slug}</code>
                          <span
                            className={styles.planBadge}
                            style={{ color: pc.text, borderColor: pc.border, background: pc.bg, fontSize: '0.5rem' }}
                          >
                            {o.planId.replace('_', ' ')}
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
    <div className={styles.modalOverlay} onClick={() => !busy && onClose()}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className={styles.modalTitle}>Seed Org + Owner</p>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '0.1rem' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Plan picker */}
        <div>
          <div className={styles.modalSublabel}>Select plan tier</div>
          <div className={styles.planGrid}>
            {ORG_PLAN_OPTIONS.map(opt => {
              const pc = PLAN_COLORS[opt.value];
              const active = selectedPlan === opt.value;
              return (
                <button
                  key={opt.value}
                  className={styles.planTile}
                  onClick={() => setSelectedPlan(opt.value)}
                  style={{
                    borderColor: active ? pc.border : 'rgba(255,255,255,0.1)',
                    background:  active ? pc.bg    : 'transparent',
                  }}
                >
                  <span
                    className={styles.planTileName}
                    style={{ color: active ? pc.text : 'rgba(255,255,255,0.6)' }}
                  >
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
          <button className={styles.wipeCancelBtn} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={styles.seedBtn} onClick={() => onSeed(selectedPlan)} disabled={busy}>
            {busy ? <Loader size={13} className={styles.spin} /> : 'Seed'}
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
        <Building2 size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
        <span className={styles.orgListTitle}>
          Seeded Orgs ({orgList.length})
        </span>
      </div>

      {orgList.length === 0 ? (
        <div className={styles.orgEmptyMsg}>No orgs seeded yet</div>
      ) : (
        orgList.map(org => {
          const pc = PLAN_COLORS[org.plan_id] ?? PLAN_COLORS.tournament;
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
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.55rem', fontWeight: 700, color: 'rgba(255,220,0,0.5)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                      UAT
                    </span>
                  )}
                </span>

                {/* Plan badge */}
                <span
                  className={styles.planBadge}
                  style={{ color: pc.text, borderColor: pc.border, background: pc.bg }}
                >
                  {org.plan_id.replace('_', ' ')}
                </span>

                {/* Wipe action */}
                {org.protected ? (
                  /* UAT-protected — show lock, no wipe */
                  <div style={{ width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={12} style={{ color: 'rgba(255,220,0,0.35)' }} />
                  </div>
                ) : isConfirming ? (
                  <div className={styles.orgWipeConfirm}>
                    <button
                      className={styles.orgWipeYes}
                      onClick={() => { onWipeOrg(org.id); setConfirmId(null); }}
                      disabled={isWiping}
                    >
                      {isWiping ? <Loader size={11} className={styles.spin} /> : 'Wipe'}
                    </button>
                    <button
                      className={styles.orgWipeNo}
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
                  >
                    {isWiping
                      ? <Loader size={11} className={styles.spin} />
                      : <Trash2 size={12} />
                    }
                  </button>
                )}
              </div>

              {/* Per-org wipe result */}
              {result && (
                <div
                  className={result.ok ? styles.logOk : styles.logErr}
                  style={{ padding: '0.4rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}
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

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ count, label }: { count: number; label: string }) {
  return (
    <span className={count > 0 ? styles.pillHas : styles.pillEmpty}>
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
        <button className={styles.refreshBtn} onClick={onRefresh} title="Refresh checkout readiness">
          <RefreshCw size={14} />
        </button>
      </div>

      {!readiness ? (
        <div className={styles.logOk}>
          <Loader size={12} className={styles.spin} />
          <div>Checking Coaches Portal checkout setup...</div>
        </div>
      ) : (
        <>
          <div className={styles.readinessSummary}>
            <span className={readiness.readyForStripeSmoke ? styles.pillHas : styles.pillEmpty}>
              Stripe smoke {readiness.readyForStripeSmoke ? 'ready' : 'blocked'}
            </span>
            <span className={styles.pillEmpty}>
              Env: {readiness.stripeEnvironment}
            </span>
            <span className={failing > 0 ? styles.pillFail : styles.pillHas}>
              {failing} failing
            </span>
            <span className={warning > 0 ? styles.pillWarn : styles.pillHas}>
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
      ? 'Dev Tools override'
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
          <div className={styles.cardTitle}>Mock Billing</div>
          <div className={styles.cardDesc}>{description}</div>
        </div>
      </div>

      <div className={styles.toolStatus}>
        <span className={config?.effectiveEnabled ? styles.pillHas : styles.pillEmpty}>
          {config?.effectiveEnabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className={styles.pillEmpty}>Source: {sourceLabel}</span>
        <span className={config?.stripeConfigured ? styles.pillHas : styles.pillWarn}>
          Stripe {config?.stripeConfigured ? 'configured' : 'missing'}
        </span>
      </div>

      <div className={styles.toolActions}>
        <button
          className={config?.effectiveEnabled ? styles.toolBtn : `${styles.toolBtn} ${styles.toolBtnPrimary}`}
          onClick={() => onSetOverride(true)}
          disabled={busy || !config || config.effectiveEnabled}
        >
          {busy ? <Loader size={13} className={styles.spin} /> : 'Enable Mock'}
        </button>
        <button
          className={!config?.effectiveEnabled ? styles.toolBtn : `${styles.toolBtn} ${styles.toolBtnPrimary}`}
          onClick={() => onSetOverride(false)}
          disabled={busy || !config || !config.effectiveEnabled}
        >
          Disable Mock
        </button>
        <button
          className={`${styles.toolBtn} ${styles.toolBtnMuted}`}
          onClick={() => onSetOverride(null)}
          disabled={busy || !config || config.override === null}
        >
          Use .env Default
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
              <span className={kind === 'standalone' ? styles.kindBadgeStandalone : styles.kindBadgeAdditive}>
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
            className={styles.seedBtn}
            onClick={() => onSeed(orgOptions && selectedOrgId ? selectedOrgId : undefined)}
            disabled={busy}
          >
            {busy ? <Loader size={13} className={styles.spin} /> : 'Seed'}
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
  { label: 'Platform Access', keys: ['platform-user'] },
  { label: 'Orgs & Users',    keys: ['org', 'users']  },
  {
    label:    'Org Features',
    sublabel: 'additive — seeds into an existing org',
    keys:     ['tournament', 'house-league', 'rep-team'],
  },
  {
    label:    'Standalone Products',
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

  useEffect(() => {
    window.queueMicrotask(() => { void fetchStatus(); });
  }, [fetchStatus]);

  useEffect(() => {
    window.queueMicrotask(() => {
      void fetchReadiness();
      void fetchMockBilling();
      void fetchMemberships();
    });
  }, [fetchReadiness, fetchMockBilling, fetchMemberships]);

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
    } catch {
      setOrgWipeResults(r => ({ ...r, [orgId]: { ok: false, error: 'Network error' } }));
    } finally {
      setWipingOrgId(null);
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
      await fetchStatus();
      void fetchMemberships();
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
      title:       'Platform Admin',
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
      title:       'Org + Owner',
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
      title:       'User Set',
      description: 'Plan-appropriate roles for every seeded org — league & club add league-admin and treasurer',
      creates:     'admin/staff/coach for all orgs; league-admin/treasurer for league & club',
      kind:        undefined as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first' as string | undefined,
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
      lockReason:  'Seed Org + Owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.tournaments ?? 0} label="tournaments" />,
    },
    {
      key:         'house-league',
      endpoint:    '/api/dev/seed/house-league',
      icon:        CalendarDays,
      title:       'House League Season',
      description: 'An active recreational season with divisions, teams, games, and sample registrations',
      creates:     '1 season, 2 divisions, 6 teams, 6 games, 2 registrations',
      kind:        'additive' as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.leagueSeasons ?? 0} label="seasons" />,
    },
    {
      key:         'rep-team',
      endpoint:    '/api/dev/seed/rep-team',
      icon:        UserCheck,
      title:       'Rep Team',
      description: 'A competitive team program with roster players, a coach, and upcoming events — added to an existing org',
      creates:     '1 team, 1 program year, 3 players, 1 coach link, 2 events',
      kind:        'additive' as 'additive' | 'standalone' | undefined,
      locked:      !hasOrg,
      lockReason:  'Seed Org + Owner first' as string | undefined,
      orgOptions:  addOrgOptions,
      badges:      <StatusPill count={status?.repTeams ?? 0} label="rep teams" />,
    },
    {
      key:         'team-workspace',
      endpoint:    '/api/dev/seed/team-workspace',
      icon:        CreditCard,
      title:       'Coaches Portal Premium',
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
      title:       'Coaches Portal Claim Link',
      description: 'Creates a secure claim link for a dev tournament team contact',
      creates:     'one available Coaches Portal claim URL',
      kind:        'standalone' as 'additive' | 'standalone' | undefined,
      locked:      (status?.tournaments ?? 0) === 0,
      lockReason:  'Seed Tournament first — claim links attach to a tournament team contact' as string | undefined,
      orgOptions:  undefined as OrgSelectOption[] | undefined,
      badges:      <StatusPill count={status?.teamClaims ?? 0} label="portal claims" />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerBadge}>DEV TOOLS</div>
        <h1 className={styles.title}>{tab === 'seed' ? 'Seed Dashboard' : 'Agent Playbook'}</h1>
        {tab === 'seed' && (
          <button className={styles.refreshBtn} onClick={fetchStatus} title="Refresh status">
            <RefreshCw size={14} />
          </button>
        )}
      </header>

      {/* Tab strip */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'seed' ? styles.tabActive : ''}`}
          onClick={() => setTab('seed')}
        >
          <Terminal size={12} />
          Seed Dashboard
        </button>
        <button
          className={`${styles.tab} ${tab === 'playbook' ? styles.tabActive : ''}`}
          onClick={() => setTab('playbook')}
        >
          <BookOpen size={12} />
          Agent Playbook
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
        {CARD_SECTIONS.map((section, idx) => {
          const sectionCards = CARDS.filter(c => section.keys.includes(c.key));
          return (
            <div key={section.label}>
              <div
                className={styles.sectionDivider}
                style={idx === 0 ? { borderTop: 'none', marginTop: 0, paddingTop: 0 } : undefined}
              >
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

      {/* Plan gates toggle — local only */}
      {PLAN_GATES_TOGGLE_ENABLED && (
        <div style={{
          border: '1px solid rgba(255,255,0,0.2)',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap' as const,
        }}>
          <Zap size={15} style={{ color: 'rgba(255,255,0,0.6)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0f0f0', marginBottom: '0.2rem' }}>
              Plan Gates
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
              {planGatesMode === 'live'
                ? 'All plans treated as live — checkout CTAs visible on pricing page.'
                : 'Gates enforced — League and Club show early-access CTAs.'}
            </div>
          </div>
          <button
            onClick={togglePlanGates}
            disabled={planGatesBusy}
            style={{
              flexShrink: 0,
              fontFamily: 'var(--font-data, monospace)',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              padding: '0.35rem 0.85rem',
              background: planGatesMode === 'live' ? 'rgba(255,255,0,0.1)'     : 'rgba(255,255,255,0.05)',
              border:     planGatesMode === 'live' ? '1px solid rgba(255,255,0,0.45)' : '1px solid rgba(255,255,255,0.15)',
              color:      planGatesMode === 'live' ? '#ffff00'                  : 'rgba(255,255,255,0.5)',
              borderRadius: '5px',
              cursor: planGatesBusy ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {planGatesBusy
              ? <Loader size={13} className={styles.spin} />
              : planGatesMode === 'live' ? 'Enforce Gates' : 'All Live'}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className={styles.danger}>
        <div className={styles.dangerLabel}>Danger Zone</div>
        {wipeConfirm ? (
          <div className={styles.wipeConfirm}>
            <span className={styles.dangerDesc}>This deletes all orgs, users, and data. Cannot be undone.</span>
            <button className={styles.wipeBtn} onClick={handleWipe} disabled={wiping}>
              {wiping ? <Loader size={14} className={styles.spin} /> : <Trash2 size={14} />}
              {wiping ? 'Wiping…' : 'Yes, wipe everything'}
            </button>
            <button className={styles.wipeCancelBtn} onClick={() => setWipeConfirm(false)} disabled={wiping}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className={styles.wipeBtn} onClick={() => setWipeConfirm(true)} disabled={wiping || wipingOrgId !== null}>
              <Trash2 size={14} />
              Wipe Everything
            </button>
            <span className={styles.dangerDesc}>Deletes all orgs, all auth users, and all data.</span>
          </>
        )}
        {wipeResult && (
          <div className={wipeResult.ok ? styles.logOk : styles.logErr} style={{ marginTop: '0.5rem' }}>
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
