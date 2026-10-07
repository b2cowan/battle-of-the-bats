'use client';
/**
 * PLAN & BILLING for a Club, on the kit (Club Tier Stage 1 + 1b, specimen 7; built to club hub v8).
 * Renders only for the two Club bands — every other plan keeps the org billing page's own view,
 * restyled onto the kit in slice 6 (owner, 2026-09-26: the drawings cover the Club's billing only).
 *
 *   The plan card        — price, renewal, status; the secure payment portal (unchanged).
 *   Teams on your plan   — the capacity readout (A15): the count the rep-team cap enforces, against
 *                          the plan's limit (or the org's custom one). Amber near the cap; at the cap
 *                          it names the move.
 *   Club's two sizes     — both bands with both prices (D7). Moving is a question with Stripe's own
 *                          prorated figure (Ask 4; `PlanMoveDialog`), never a second checkout (A06).
 *   What Club includes   — Families in; invoicing and reconciliation out (A15, /marketing's words).
 *   Reduce or cancel     — names the CLUB's programs (A12), then today's review and reason box.
 *   Cancelled            — the reactivate card lists exactly what reactivation restores (A07); a
 *                          plan not yet on sale says "Contact us to reactivate" until Stage 8's flip.
 *
 * ⚖ D6: no Founding Season banner, price line or chooser ever renders here. There is no League Plus
 * or Coaches Portal shelf for a Club (it includes both), and no tournament-slot or seat meter.
 * ⚖ A10: "is this plan on sale?" is read from the ONE gating source checkout and the move routes use
 * (`/api/plan-gating`), not the static flag today's page reads.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { planCarriesModule } from '@/lib/module-entitlements';
import { formatStoredDate } from '@/lib/timezone';
import { joinWithAnd } from '@/lib/utils';
import type { OrgPlan } from '@/lib/types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachCard, CoachEyebrow, CoachChip, kit } from '@/components/coaches/kit';
import { useClubBrief } from './ClubBriefProvider';
import KitDialog from './KitDialog';
import PageNotice, { useNotice } from './PageNotice';
import PlanMoveDialog, { CONTACT_HREF } from './PlanMoveDialog';
import ck from './ClubKit.module.css';
import styles from './Billing.module.css';

const BANDS: OrgPlan[] = ['club', 'club_large'];

/** "What Club includes" — the drawn words (specimen 7), placement for /marketing's final text. */
const CLUB_INCLUDES = [
  'Rep Teams: tryouts, rosters, player documents, season history',
  'A Premium Coaches Portal for every team, with no per-team fee',
  'Accounting: ledgers, the club budget, allocations to teams',
  'Families: every household across your programs',
  'Your club’s public site',
  'House league and tournaments',
  'Unlimited board and staff members',
];

type MoveInfo = { live: boolean; scheduledMove: { toPlan: OrgPlan; effectiveAt: string | null } | null };
type Preflight = { retentionDays: number; tournaments: unknown[]; cancelled: { at: string | null; keptUntil: string | null } | null };
type Gating = Partial<Record<OrgPlan, boolean>>;

const STATUS_CHIP: Record<string, { tone: 'good' | 'warn' | 'danger'; label: string }> = {
  active: { tone: 'good', label: 'Active' },
  trialing: { tone: 'good', label: 'Trial' },
  past_due: { tone: 'warn', label: 'Past due' },
  canceled: { tone: 'danger', label: 'Cancelled' },
};

export default function BillingKit() {
  const { currentOrg, userRole, refresh, loading } = useOrg();
  usePageTitle('Plan & billing');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brief } = useClubBrief();
  const slug = currentOrg?.slug ?? '';
  const isOwner = userRole === 'owner';
  const cancelled = currentOrg?.subscriptionStatus === 'canceled';

  const [gating, setGating] = useState<Gating | null>(null);
  const [moveInfo, setMoveInfo] = useState<MoveInfo | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [moveTo, setMoveTo] = useState<OrgPlan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [working, setWorking] = useState<'portal' | 'cancel' | 'reactivate' | 'keep' | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(currentOrg?.subscriptionPeriod ?? 'monthly');
  const [notice, setNotice] = useNotice(() =>
    searchParams.get('success') === '1'
      ? { tone: 'good', text: 'Your plan is active. Everything it includes is open now.' }
      : searchParams.get('card_saved') === '1'
        ? { tone: 'good', text: 'Your payment method is on file.' }
        : null);

  // Strip the one-shot return flags so a refresh doesn't repeat the notice (today's page does too).
  useEffect(() => {
    if (searchParams.get('success') === '1' || searchParams.get('card_saved') === '1') {
      router.replace(window.location.pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the LATEST read may paint: a slow first read resolving after a move's own re-read would put
  // the pre-move state back (/review 2026-09-26).
  const moveReadGen = useRef(0);
  const loadMoveInfo = useCallback(() => {
    if (!slug || !isOwner || cancelled) return;
    const gen = ++moveReadGen.current;
    fetch(`/api/billing/move?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && gen === moveReadGen.current) setMoveInfo({ live: !!d.live, scheduledMove: d.scheduledMove ?? null }); })
      .catch(() => {});
  }, [slug, isOwner, cancelled]);

  useEffect(() => {
    if (!slug || !isOwner) return;
    fetch('/api/plan-gating').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setGating(d as Gating); }).catch(() => {});
    fetch(`/api/billing/cancel/preflight?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setPreflight(d as Preflight); })
      .catch(() => {});
    loadMoveInfo();
  }, [slug, isOwner, loadMoveInfo]);

  if (loading || !currentOrg || !userRole) return <div className={ck.loading}>Loading…</div>;

  const planKey = currentOrg.planId;
  const plan = PLAN_CONFIG[planKey];
  const orgName = currentOrg.name;

  if (!isOwner) {
    return (
      <div className={ck.page}>
        <AdminPageHeader eyebrow="Organization" title="Plan & billing" />
        <div className={styles.lockedCard}>
          <h2 className={styles.lockedTitle}>Plan &amp; billing is the owner’s</h2>
          <p className={styles.lockedBody}>Only {orgName}’s owner can see and change the plan and how it’s paid.</p>
        </div>
      </div>
    );
  }

  // A gated plan (not on sale until Stage 8's flip) cannot be bought or moved onto by self-serve.
  const onSale = (key: OrgPlan) => gating !== null && gating[key] === false;
  const priceLine = (key: OrgPlan, c: 'monthly' | 'annual') =>
    c === 'annual' ? `${formatPriceAmount(PLAN_CONFIG[key].annualPrice)} CAD / year` : `${formatPriceAmount(PLAN_CONFIG[key].monthlyPrice)} CAD / month`;

  async function openPortal() {
    setWorking('portal');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: slug }),
      });
      const d = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? 'The payment portal didn’t open.');
      window.location.assign(d.url);
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'The payment portal didn’t open. Try again.' });
      setWorking(null);
    }
  }

  // ── Cancelled: the reactivate card (A07) ─────────────────────────────────────────────────────
  if (cancelled) {
    const since = preflight?.cancelled?.at ? formatStoredDate(preflight.cancelled.at, { withYear: false }) : null;
    const until = preflight?.cancelled?.keptUntil ? formatStoredDate(preflight.cancelled.keptUntil, { longMonth: true }) : null;

    async function reactivate() {
      setWorking('reactivate');
      try {
        const res = await fetch('/api/billing/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planKey, billingCycle: cycle, orgSlug: slug, returnTo: `/${slug}/admin/org/billing` }),
        });
        const d = await res.json().catch(() => ({})) as { url?: string; error?: string; applied?: boolean };
        if (!res.ok) throw new Error(d.error ?? 'Checkout didn’t open.');
        if (d.applied) { await refresh(); setWorking(null); return; }
        if (!d.url) throw new Error('Checkout didn’t open.');
        window.location.assign(d.url);
      } catch (err) {
        setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'Checkout didn’t open. Try again.' });
        setWorking(null);
      }
    }

    return (
      <div className={ck.page}>
        <AdminPageHeader eyebrow="Organization" title="Plan & billing" />
        {notice && <PageNotice notice={notice} />}
        <CoachCard className={styles.reactivate}>
          <CoachEyebrow chip={<CoachChip tone="danger">{since ? `Cancelled ${since}` : 'Cancelled'}</CoachChip>}>
            {orgName} is cancelled
          </CoachEyebrow>
          <h2 className={styles.cardTitle}>Reactivate {plan.label} and everything comes back</h2>
          {/* EXACTLY what `restoreAfterReactivation` restores (session 1, A07) — the card promised
              "everything below comes back on day one" before, and reactivation restored one thing. */}
          <ul className={styles.restores}>
            <li><CheckCircle2 size={14} aria-hidden /> Your public site goes back online</li>
            {planCarriesModule(currentOrg, 'module_rep_teams') && <li><CheckCircle2 size={14} aria-hidden /> Every team’s coach portal reopens</li>}
            <li><CheckCircle2 size={14} aria-hidden /> Archived tournaments return</li>
            <li><CheckCircle2 size={14} aria-hidden /> Retention reminders stop</li>
          </ul>
          {until && <p className={kit.sub}>Kept until {until}.</p>}
          <div className={styles.reactivateRow}>
            {onSale(planKey) ? (
              <>
                <label className={styles.cycleField}>
                  <span className={styles.srOnly}>Billing</span>
                  <select className={ck.select} value={cycle} onChange={e => setCycle(e.target.value as 'monthly' | 'annual')}>
                    <option value="monthly">Monthly · {formatPriceAmount(plan.monthlyPrice)}</option>
                    <option value="annual">Yearly · {formatPriceAmount(plan.annualPrice)}</option>
                  </select>
                </label>
                <button type="button" className="btn btn-lime" onClick={() => void reactivate()} disabled={working !== null} id="billing-reactivate-btn">
                  {working === 'reactivate' ? 'Opening checkout…' : `Reactivate ${plan.label}`}
                </button>
              </>
            ) : (
              // ⚖ Until Stage 8 flips the gate, a Club cannot check out — the door says who can help.
              <a href={CONTACT_HREF} className="btn btn-lime" id="billing-reactivate-btn">Contact us to reactivate</a>
            )}
          </div>
        </CoachCard>
      </div>
    );
  }

  // ── Live ─────────────────────────────────────────────────────────────────────────────────────
  const status = STATUS_CHIP[currentOrg.subscriptionStatus] ?? STATUS_CHIP.active;
  const renewal = currentOrg.currentPeriodEnd ? formatStoredDate(currentOrg.currentPeriodEnd, { longMonth: true }) : null;
  const scheduled = moveInfo?.scheduledMove ?? null;

  // Capacity: the count the rep-team cap enforces, against the limit that applies to this org.
  const limit = currentOrg.teamLimit;
  const bandLimit = plan.teamLimit;
  const active = brief?.teams?.active ?? null;
  const nearCap = active !== null && limit < 9999 && active >= Math.ceil(limit * 0.85);
  const atCap = active !== null && limit < 9999 && active >= limit;
  const pct = active !== null && limit < 9999 ? Math.min(100, Math.round((active / limit) * 100)) : 0;
  const up: OrgPlan | null = planKey === 'club' ? 'club_large' : null;
  const down: OrgPlan | null = planKey === 'club_large' ? 'club' : null;

  const moveButton = (to: OrgPlan, primary: boolean) =>
    gating === null ? null : onSale(to) ? (
      <button type="button" className={`btn ${primary ? 'btn-lime' : 'btn-outline'}`} onClick={() => setMoveTo(to)}>
        Move to {PLAN_CONFIG[to].label}
      </button>
    ) : (
      <a href={CONTACT_HREF} className={`btn ${primary ? 'btn-lime' : 'btn-outline'}`}>Contact us to move</a>
    );

  // The club's programs, as the cancel sentence names them (A12) — what goes offline.
  const teamWord = active !== null ? ` (${active} team${active === 1 ? '' : 's'})` : '';
  const offline = [
    planCarriesModule(currentOrg, 'module_rep_teams') && `Rep Teams and every team’s coach portal${teamWord}`,
    planCarriesModule(currentOrg, 'module_accounting') && 'Accounting',
    planCarriesModule(currentOrg, 'module_families') && 'Families',
    planCarriesModule(currentOrg, 'module_public_site') && 'the public site',
    planCarriesModule(currentOrg, 'module_house_league') && 'house league',
    'tournaments',
  ].filter((x): x is string => Boolean(x));
  const retentionDays = preflight?.retentionDays ?? 90;

  async function keepCurrentBand() {
    setWorking('keep');
    try {
      const res = await fetch(`/api/billing/move?orgSlug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? 'That didn’t go through.');
      setNotice({ tone: 'good', text: `${orgName} stays on ${plan.label}.` });
      loadMoveInfo();
    } catch (err) {
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'That didn’t go through. Try again.' });
    } finally {
      setWorking(null);
    }
  }

  async function confirmCancel() {
    setWorking('cancel');
    try {
      const res = await fetch('/api/billing/cancel/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason, orgSlug: slug }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? 'The cancellation didn’t go through.');
      setCancelOpen(false);
      await refresh();
    } catch (err) {
      setCancelOpen(false);
      setNotice({ tone: 'bad', text: err instanceof Error ? err.message : 'The cancellation didn’t go through. Try again.' });
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className={ck.page}>
      <AdminPageHeader eyebrow="Organization" title="Plan & billing" />
      {notice && <PageNotice notice={notice} />}

      {currentOrg.subscriptionStatus === 'past_due' && (
        <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>
            Your last payment didn’t go through. Everything stays open during the grace period — update your card in
            {' '}<button type="button" className={ck.link} onClick={() => void openPortal()}>Payment method &amp; invoices</button>{' '}
            to keep it that way.
          </div>
        </div>
      )}

      {/* ── The plan card: the plan, and the teams it holds ─────────────────────────────────── */}
      <CoachCard className={styles.planCard}>
        <div className={styles.planGrid}>
          <div className={styles.planSide}>
            <CoachEyebrow chip={<CoachChip tone={status.tone}>{status.label}</CoachChip>}>Your plan</CoachEyebrow>
            <h2 className={styles.planName}>{plan.label}</h2>
            <p className={styles.planPrice}>
              {priceLine(planKey, currentOrg.subscriptionPeriod ?? 'monthly')}
              {currentOrg.subscriptionPeriod && <> · billed {currentOrg.subscriptionPeriod === 'annual' ? 'yearly' : 'monthly'}</>}
            </p>
            {renewal && (
              <p className={kit.sub}>{currentOrg.subscriptionStatus === 'trialing' ? `Trial ends ${renewal}` : `Renews ${renewal}`}</p>
            )}
            {scheduled && (
              <p className={styles.scheduled}>
                Moves to {PLAN_CONFIG[scheduled.toPlan].label}
                {scheduled.effectiveAt ? ` on ${formatStoredDate(scheduled.effectiveAt, { longMonth: true })}` : ' at renewal'}.{' '}
                <button type="button" className={ck.link} onClick={() => void keepCurrentBand()} disabled={working !== null}>
                  Keep {plan.label}
                </button>
              </p>
            )}
            <div className={styles.planActions}>
              <button type="button" className="btn btn-outline" onClick={() => void openPortal()} disabled={working !== null} id="billing-manage-btn">
                <CreditCard size={15} aria-hidden /> {working === 'portal' ? 'Opening…' : 'Payment method & invoices'}
              </button>
            </div>
          </div>

          <div className={styles.capSide}>
            <CoachEyebrow>Teams on your plan</CoachEyebrow>
            <p className={styles.capFigure}>
              {active !== null ? <>{active} <small>of {limit < 9999 ? limit : 'unlimited'} teams</small></> : <small>Loading…</small>}
            </p>
            {limit < 9999 && active !== null && (
              <div
                className={styles.capBar}
                role="img"
                aria-label={`${active} of ${limit} teams`}
              >
                <div className={`${styles.capFill}${atCap ? ` ${styles.capFull}` : nearCap ? ` ${styles.capNear}` : ''}`} style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
            )}
            <p className={kit.sub}>
              {limit > bandLimit
                ? `Your plan holds up to ${limit} teams, a custom limit for ${orgName}. Archived teams don’t count.`
                : atCap && up
                  ? `${orgName} holds ${limit} teams on ${plan.label}, its limit. Move to ${PLAN_CONFIG[up].label} to add more.`
                  : up
                    ? `${plan.label} holds up to ${bandLimit} teams. Archived teams don’t count. Growing past ${bandLimit}? ${PLAN_CONFIG[up].label} holds ${PLAN_CONFIG[up].teamLimit}.`
                    : `${plan.label} holds up to ${bandLimit} teams. Archived teams don’t count. More than ${bandLimit}? Contact us for a custom plan.`}
            </p>
            {up && !scheduled && <div className={styles.planActions}>{moveButton(up, atCap || nearCap)}</div>}
          </div>
        </div>
      </CoachCard>

      {/* ── Club's two sizes (D7) ────────────────────────────────────────────────────────────── */}
      <section className={ck.section} aria-labelledby="billing-bands">
        <div className={ck.sectionHead}><h2 id="billing-bands" className={ck.sectionTitle}>Club’s two sizes</h2></div>
        <div className={ck.tableFrame}>
          <table className={ck.table}>
            <thead>
              <tr>
                <th scope="col">Plan</th>
                <th scope="col">Teams</th>
                <th scope="col" className={ck.num}>Monthly</th>
                <th scope="col" className={ck.num}>Yearly</th>
                <th scope="col"><span className={styles.srOnly}>Your choice</span></th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map(key => {
                const band = PLAN_CONFIG[key];
                const range = key === 'club' ? `Up to ${band.teamLimit}` : `${PLAN_CONFIG.club.teamLimit} to ${band.teamLimit}`;
                return (
                  <tr key={key}>
                    <td className={ck.cellTitle}>{band.label}</td>
                    <td>{range}</td>
                    <td className={ck.num}>{formatPriceAmount(band.monthlyPrice)}</td>
                    <td className={ck.num}>{formatPriceAmount(band.annualPrice)}</td>
                    <td className={ck.actions}>
                      {key === planKey
                        ? <span className={`${ck.chip} ${ck.chipGood}`}>Your plan</span>
                        : scheduled?.toPlan === key
                          ? <span className={ck.chip}>From {scheduled.effectiveAt ? formatStoredDate(scheduled.effectiveAt, { withYear: false }) : 'renewal'}</span>
                          : key === up || key === down ? moveButton(key, false) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={`${ck.lede} ${styles.afterTable}`}>
          More than {PLAN_CONFIG.club_large.teamLimit} teams? <a href={CONTACT_HREF} className={ck.link}>Contact us</a> for a custom plan.
        </p>
      </section>

      {/* ── What Club includes (A15) ─────────────────────────────────────────────────────────── */}
      <section className={ck.section} aria-labelledby="billing-includes">
        <div className={ck.sectionHead}><h2 id="billing-includes" className={ck.sectionTitle}>What Club includes</h2></div>
        <ul className={styles.includes}>
          {CLUB_INCLUDES.map(line => <li key={line}><CheckCircle2 size={14} aria-hidden /> {line}</li>)}
        </ul>
      </section>

      {/* ── Reduce or cancel (A12): the club's programs, by name ──────────────────────────────── */}
      <section className={ck.section} aria-labelledby="billing-cancel">
        <div className={ck.sectionHead}><h2 id="billing-cancel" className={ck.sectionTitle}>Reduce or cancel</h2></div>
        <p className={styles.cancelCopy}>
          Cancelling suspends {orgName}: {joinWithAnd(offline)} go offline. Everything is kept for {retentionDays} days and comes
          back if you reactivate.
        </p>
        <button type="button" className={`btn btn-outline ${styles.dangerText}`} onClick={() => setCancelOpen(true)} id="billing-cancel-btn">
          Cancel and suspend {orgName}…
        </button>
      </section>

      {moveTo && (
        <PlanMoveDialog
          org={{ slug, name: orgName, planId: planKey, subscriptionPeriod: currentOrg.subscriptionPeriod }}
          toPlan={moveTo}
          onClose={() => setMoveTo(null)}
          onMoved={async (text) => {
            setMoveTo(null);
            setNotice({ tone: 'good', text });
            await refresh();
            loadMoveInfo();
          }}
        />
      )}

      {cancelOpen && (
        <KitDialog
          kind="form"
          title={`Cancel and suspend ${orgName}?`}
          onClose={() => setCancelOpen(false)}
          busy={working === 'cancel'}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setCancelOpen(false)} disabled={working === 'cancel'}>Keep {plan.label}</button>
              <button type="button" className="btn btn-danger" onClick={() => void confirmCancel()} disabled={working === 'cancel'}>
                {working === 'cancel' ? 'Suspending…' : 'Cancel and suspend'}
              </button>
            </>
          }
        >
          <div className={`${ck.notice} ${ck.noticeBad}`}>
            <AlertTriangle size={15} aria-hidden />
            <div className={ck.noticeBody}>
              {orgName} is suspended the moment you confirm: {joinWithAnd(offline)} go offline, and families opening your
              pages will see that they aren’t available.
            </div>
          </div>
          <p>
            Everything is kept for {retentionDays} days.
            {preflight && preflight.tournaments.length > 0
              ? ` ${preflight.tournaments.length} tournament${preflight.tournaments.length === 1 ? '' : 's'} move into the archive until then.`
              : ''}{' '}
            Reactivating brings it all back: the public site, every team’s coach portal and your tournaments.
          </p>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="kit-cancel-reason">Why are you cancelling?</label>
            <textarea id="kit-cancel-reason" className={ck.textarea} value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} />
            <p className={ck.hint}>For your records and ours. You can leave it empty.</p>
          </div>
        </KitDialog>
      )}

    </div>
  );
}
