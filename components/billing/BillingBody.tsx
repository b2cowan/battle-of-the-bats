'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ChevronRight, CreditCard } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { ownPlanOf } from '@/lib/free-time';
import { PLAN_BILLING_PROFILES, type PlanBillingProfile, type BillingPlanChange } from '@/lib/plan-billing-profile';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import { PLAN_CONFIG, formatPriceAmount, isFoundingSeasonActive, isFoundingSeasonCardWindowOpen } from '@/lib/plan-config';
import { nextSeasonPlanOptions } from '@/lib/next-season-choice';
import { teamWorkspaceReactivatePath, COACHES_START_PATH, COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import type { Organization, OrgPlan } from '@/lib/types';
import type { BillingCycle } from '@/lib/plan-config';
import type { PanelPlanKey } from '@/lib/plan-upgrade';
import { NO_LIMIT } from '@/lib/platform-labels';
import type { BillingRead, BillingSnapshot, BillingUsage, BillingCancellation, BillingDowngrade, BillingFreeTime, BillingFounding, BillingMove } from '@/lib/plan-billing-data';
import type { WaitingMoveView } from '@/lib/plan-ending';
import { joinWithAnd } from '@/lib/utils';
import { CoachCard, CoachEyebrow, CoachChip } from '@/components/coaches/kit';
import LoadingState from '@/components/shared/LoadingState';
import PageNotice, { useNotice, type Notice } from '@/components/shared/PageNotice';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import PlanMoveDialog, { CONTACT_HREF } from './PlanMoveDialog';
import PlanCycleDialog from './PlanCycleDialog';
import FreeTimeBand from './FreeTimeBand';
import PlanArticlePanel from './PlanArticlePanel';
import StripeFeesList from './StripeFeesList';
import PaymentsEndingSection, { moveDateLong } from './PaymentsEndingSection';
import styles from './Billing.module.css';
import ClubUpgradeSetup from './ClubUpgradeSetup';
import { inPlaceReturnPath, isInPlaceReturn } from '@/lib/workspace-upgrade';
import { BILLING_ADDRESS_FORM_WORDS, formatBilledTo, formatBillingAddress } from '@/lib/billing-location';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import { isAddressRefusal, useBillingAddressGate } from './BillingAddressDialog';

/** What `post` answers when a paid route refused for want of a billing address (the caller opens the window and retries). */
const ADDRESS_REFUSED = Symbol('address-refused');

type Registry = Record<string, PlanBillingProfile<string>>;
/** Consume return flags without discarding an explicitly requested drawer or another query parameter. */
export function billingReturnState(search: string, billingBase: string, showFoundingSeason: boolean) {
  const query = new URLSearchParams(search);
  const justChose = query.get('next_season') === '1';
  const cardSaved = query.get('card_saved') === '1';
  const requestedPlan = query.get('plan');
  const detail = requestedPlan && Object.hasOwn(PLAN_BILLING_PROFILES, requestedPlan) ? requestedPlan : null;
  const notice: Notice | null = justChose ? { tone: 'good', text: showFoundingSeason ? W.notice.nextSeason : W.notice.active }
    : query.get('card_saved') === '1' ? { tone: 'good', text: W.notice.cardSaved }
      : query.get('success') === '1' ? { tone: 'good', text: W.notice.active } : null;
  // `keep_plan` opens the Keep {Plan} window once the waiting cancel has loaded (the plan-change window's door elsewhere).
  const keepPlan = query.get('keep_plan') === '1';
  const consumed = ['success', 'card_saved', 'next_season', 'keep_plan'].some(flag => query.has(flag));
  for (const flag of ['success', 'card_saved', 'next_season', 'keep_plan']) query.delete(flag);
  return { justChose, cardSaved, keepPlan, detail, notice, consumed, destination: `${billingBase}${query.size ? `?${query}` : ''}` };
}
type Action = {
  busy: string | null; cycle: BillingCycle; setCycle: (value: BillingCycle) => void;
  portal: () => void; card: () => void; reactivate: () => void; keep: () => void; cancel: () => void;
  /** Keep {Plan}: opens the question window that undoes a waiting cancel (Plans end at renewal, Stage 0 ruling 4). */
  keepPlan: () => void;
  /** Change which tournament you keep (Stage 2, G2): opens its form window while a move to the free plan waits. */
  changePick?: () => void;
  /** A checkout change asks how to pay first (the payment step) unless the cycle is already chosen, as in the details panel. */
  change: (change: BillingPlanChange<string>, cycle?: BillingCycle) => void; details: (key: string) => void;
  choose: (key: string, cycle: BillingCycle) => void; retry: () => void;
};
export type BillingBodyViewProps = {
  snapshot: BillingSnapshot; profile: PlanBillingProfile<string>; ownProfile: PlanBillingProfile<string>;
  profiles?: Registry; actions: Action; notice?: Notice | null; justChose?: boolean;
  /** A wait, not a failure (the white callout with an amber edge): a kept plan whose cheaper move couldn't come back. */
  waitNotice?: string | null;
  cardWindowOpen?: boolean; foundingActive?: boolean; fees?: ReactNode;
  /** The plan whose details panel is open (`?plan=` or a Details link), and how it closes. */
  detail?: string | null; onCloseDetail?: () => void;
  /** GST/HST Stage 1 (drawing tab 6): the billing address on file, read on the plan card, and its Billing address button.
   *  Absent before anything is bought (nothing new shows). */
  billingAddress?: { line: string; onEdit: () => void } | null;
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className={styles.section} aria-labelledby={id}>
    <div className={styles.sectionHead}><h2 id={id} className={styles.sectionTitle}>{title}</h2></div>{children}
  </section>;
}

function ReadFailure({ read, section }: { read: BillingRead<unknown>; section: string }) {
  return read.status === 'error' ? <p role="alert" className={styles.hint}>{W.errors.read(section)}</p> : null;
}

function LockedCard({ orgName }: { orgName: string }) {
  return <div className={styles.lockedCard}>
    <h2 className={styles.lockedTitle}>{W.page.lockedTitle}</h2><p className={styles.lockedBody}>{W.page.lockedBody(orgName)}</p>
  </div>;
}

/**
 * The band under the plan card while a move to the free plan waits (Stage 2 Part B, G2; Stage 0 drawing "The page"): the
 * white callout with an olive edge naming what stays and what goes on the date. Amber only when the kept tournament is
 * gone and there is a choice to make (Stage 0 Ask 8). The door appears only when there is a choice at all.
 */
function MoveBand({ move, movesAt, retentionDays, onChange, disabled }: {
  move: WaitingMoveView; movesAt: string; retentionDays: number; onChange?: () => void; disabled: boolean;
}) {
  const B = W.downgrade.band;
  const target = PLAN_CONFIG[move.targetPlan];
  const gone = move.fellBack && move.choose;
  return <div className={`${styles.waitCallout} ${styles.moveBandFrame} ${gone ? '' : styles.moveBand}`} id="billing-move-band">
    <CoachEyebrow>{B.eyebrow(movesAt)}</CoachEyebrow>
    <p className={styles.moveBandText}>{gone ? B.gone(move.keepIds.length > 0, move.kept[0]?.name ?? '', movesAt)
      : move.kept.length > 0 ? <>{B.youKeep} <strong>{joinWithAnd(move.kept.map(t => t.name))}</strong>. {B.archived(move.archived.map(t => t.name), retentionDays)}</>
      : B.none(target.label, target.tournamentLimit, retentionDays)}</p>
    {move.choose && onChange && <button type="button" className={styles.link} onClick={onChange} disabled={disabled}>{gone ? B.choose : B.change}</button>}
  </div>;
}

/**
 * The tournaments you keep, as rows: the Downgrade window's pick and Change which tournament you keep (one control;
 * Downgrade window redraw, owner 2026-11-05). Exactly one kept: pick-one rows, so the control says "one" without a word.
 * More than one: the same rows as checkboxes, and once `limit` are ticked the rest wait until one is unticked (the foot
 * counts them). Each row wears its status (the one home of status words); `extra` is a second quiet line.
 */
function TournamentChoices({ tournaments, ids, onChange, single, limit, label, extra }: {
  tournaments: BillingDowngrade['tournaments']; ids: string[]; onChange: (ids: string[]) => void;
  single: boolean; limit: number; label: string;
  extra?: (tournament: BillingDowngrade['tournaments'][number]) => string | null;
}) {
  const group = useId();
  // A div of labels, not a list: a group role on a <ul> would strip the list's own meaning from its items.
  return <div className={styles.pickList} role={single ? 'radiogroup' : 'group'} aria-label={label}>{tournaments.map(t => {
    const on = ids.includes(t.id);
    const note = extra?.(t);
    return <label key={t.id} data-on={on || undefined}>
      <input type={single ? 'radio' : 'checkbox'} name={single ? group : undefined} checked={on} disabled={!single && !on && ids.length >= limit}
        onChange={event => onChange(single ? [t.id] : event.target.checked ? [...ids, t.id] : ids.filter(x => x !== t.id))} />
      <span className={styles.pickName}>{t.name}{note && <small className={styles.hint}>{note}</small>}</span>
      <span className={styles.pickStatus}>{W.downgrade.pick.status(t.status)}</span>
    </label>;
  })}</div>;
}

type PickState = { read: BillingRead<BillingDowngrade>; ids: string[]; stored: string[]; error: string | null };
/**
 * Change which tournament you keep (Stage 2 Part B, G2; Stage 0 drawing): a 520px form window over a fresh read of what
 * holds a slot now. The stored pick reads "your choice so far"; one made after the move was scheduled, "added {date}".
 */
function PickWindow({ orgName, endsAt, since, pick, busy, onChange, onSave, onClose }: {
  orgName: string; endsAt: string; since: string; pick: PickState; busy: boolean;
  onChange: (ids: string[]) => void; onSave: () => void; onClose: () => void;
}) {
  const P = W.downgrade.pick;
  const data = pick.read.status === 'ready' ? pick.read.data : null;
  const changed = pick.ids.length !== pick.stored.length || pick.ids.some(id => !pick.stored.includes(id));
  // Compared as instants: the database's and the change log's timestamps are written differently.
  const sinceAt = Date.parse(since);
  const extra = (t: BillingDowngrade['tournaments'][number]) =>
    pick.stored.includes(t.id) ? P.yourChoice : t.createdAt && Date.parse(t.createdAt) > sinceAt ? P.added(t.createdAt) : null;
  return <KitDialog kind="form" title={P.title} onClose={onClose} busy={busy} dirty={changed}
    footerStart={<span>{P.footer(endsAt)}</span>}
    footer={<><DialogCancel>{W.downgrade.close}</DialogCancel>
      <button type="button" className="btn btn-lime" onClick={onSave} disabled={busy || !data || !changed || pick.ids.length !== data.allowedKeepCount}>{busy ? P.saving : P.save}</button></>}
  >
    <DialogReason className={styles.dangerText}>{pick.error}</DialogReason>
    {pick.read.status === 'loading' && <LoadingState inline label={P.loading} />}
    {pick.read.status === 'error' && <PageNotice notice={{ tone: 'bad', text: pick.read.error }} />}
    {data && <>
      <p>{P.intro(orgName, data.targetPlanLabel, endsAt, data.allowedKeepCount, data.retentionDays)}</p>
      <TournamentChoices tournaments={data.tournaments} ids={pick.ids} onChange={onChange} single={data.allowedKeepCount === 1} limit={data.allowedKeepCount} label={P.title} extra={extra} />
    </>}
  </KitDialog>;
}

/** The actual billing presentation, also rendered by the isolated profile fixtures. No portal chrome or providers. */
export function BillingBodyView({ snapshot: s, profile, ownProfile, profiles = PLAN_BILLING_PROFILES, actions: a,
  notice, waitNotice = null, justChose = false, cardWindowOpen = false, foundingActive = false, fees, detail = null, onCloseDetail = () => {},
  billingAddress = null,
}: BillingBodyViewProps) {
  const org = s.org;
  if (!s.canManageBilling) return <LockedCard orgName={org.name} />;

  const sale = (key: string) => s.gating.status === 'ready' && s.gating.data[key as OrgPlan] === false;
  const ft = s.freeTime.status === 'ready' ? s.freeTime.data : null;
  const fd = s.founding.status === 'ready' ? s.founding.data : null;
  const portal = profile.cancellationKind === 'premium' ? ft?.portal ?? null : null;
  const freeCopy = ft?.freeTime ? W.freeTime({ freeTime: ft.freeTime,
    foundingThrough: ownProfile.showFoundingSeason ? ft.foundingThrough : null,
    givenOnSale: sale(ft.freeTime.plan),
    overLimitAfter: ft.overLimitAfter,
  }) : null;
  const portalCopy = portal ? W.portalFreeTime(portal) : null;
  const freeCard = portalCopy?.card ?? freeCopy?.card ?? null;
  const band = portalCopy?.band ?? freeCopy?.band ?? null;
  const staffFree = Boolean(freeCard);
  // A staff grant is stored cancelled even while running. It has no cancellation or retention intent.
  const endedPortal = portal?.state === 'ended';
  const ownBilling = !staffFree && !endedPortal;
  const showChanges = !endedPortal && (!staffFree || ownProfile.key === 'team');
  const cancelled = org.subscriptionStatus === 'canceled' && !portal && !staffFree;
  const controlsReady = s.freeTime.status === 'ready' && (cancelled || endedPortal || !profile.showFoundingSeason || s.founding.status === 'ready');
  const founding = profile.showFoundingSeason && !staffFree && Boolean(fd?.isFoundingSeason);
  const comp = founding && foundingActive;
  const paid = ownProfile.config.monthlyPrice > 0;
  // The row that holds "Payment method & invoices"; the Keep button joins it, and stands alone only where this row is absent.
  const actionsShown = controlsReady && paid && !staffFree && !endedPortal && !founding;
  const preflight = s.cancellation.status === 'ready' ? s.cancellation.data : null;
  // Plans end at the renewal date (Stage 0 rulings 1–3): a waiting cancel takes the plan card's waiting-change line, and
  // the change doors and Reduce or cancel are absent until it is kept.
  const pending = ownBilling && !cancelled ? preflight?.ending?.pending ?? null : null;
  // Stage 2: the waiting change is a cancel or a MOVE to the free plan. A move keeps the Active chip and Reduce or cancel
  // (a cancel replaces it, ruling 4); its line is the waiting-move line, and the band below the card names what stays.
  const pendingMove = pending?.kind === 'downgrade' ? pending : null;
  const pendingCancel = pending && !pendingMove ? pending : null;
  const moveTarget = pendingMove?.move.targetPlan ?? null;
  const keepLabel = pending ? W.cancel.keepDoor(ownProfile.key as OrgPlan) : '';
  // "Ends on {date}" with Keep {Plan}: the olive link on a desk, the full-width lime button on a phone (Stage 0 ruling 7).
  // The door is the lime button beside "Payment method & invoices" at every width (owner 2026-11-03: the sentence-end link
  // was the least noticeable thing on the card); the line above it is the date alone.
  const keepLine = pending && <p className={styles.scheduled}>{pendingMove
    ? W.plan.scheduled(PLAN_CONFIG[pendingMove.move.targetPlan].label, pendingMove.endsAt)
    : W.plan.endsOn(pending.endsAt, org.subscriptionStatus === 'trialing')}</p>;
  const keepButton = pending && <button type="button" className={`btn btn-lime ${styles.keepButton}`} disabled={a.busy !== null} onClick={a.keepPlan}>{keepLabel}</button>;
  const trialingNow = org.subscriptionStatus === 'trialing';
  const changes = ownProfile.changes;
  const scheduled = s.move.status === 'ready' ? s.move.data.scheduledMove : null;
  // Plans & pricing Stage 0 (fix 1): what the customer's own subscription charges, when the webhook has recorded it (in
  // CAD, the only currency these words say); otherwise the price list, as before. The price, not the invoice total.
  const paidCents = profile.key === ownProfile.key && org.subscriptionCurrency === 'cad' ? org.subscriptionAmountCents ?? null : null;
  const price = freeCard?.price ?? (comp ? W.founding.price : profile.config.monthlyPrice === 0 ? W.plan.free
    : paidCents !== null ? W.plan.paidPrice(paidCents, org.subscriptionPeriod ?? 'monthly')
    : W.plan.price(org.subscriptionPeriod === 'annual' ? profile.config.annualPrice : profile.config.monthlyPrice, org.subscriptionPeriod ?? 'monthly'));
  // GST/HST Stage 2 Part 3: a price that is charged says it is before tax; free time, a comp and a free plan have nothing to tax.
  const taxedPrice = !freeCard && !comp && profile.config.monthlyPrice !== 0;
  const disabled = a.busy !== null;
  const premium = ownProfile.cancellationKind === 'premium';
  const keepPremium = portal ? <CoachCard className={styles.keepPremiumCard}>
    <h2 className={styles.sectionTitle}>{W.change.keepPremium}</h2><p className={styles.hint}>{W.change.keepPremiumHelp}</p>
    <a href={`${teamWorkspaceReactivatePath(org)}&keep=1`} className={`btn btn-lime ${styles.keepPremiumButton}`} id="billing-keep-premium">{W.change.keepPremium}</a>
  </CoachCard> : null;
  const joinClub = profile.joinClub ? <CoachCard className={styles.invitation}>
    <h3 className={styles.sectionTitle}>{W.change.clubTitle}</h3><p className={styles.hint}>{W.change.clubBody}</p>
    <a href={`/${org.slug}/coaches/link-org`} className={`btn ${portal ? 'btn-outline' : 'btn-lime'} ${styles.joinClubButton}`}>{W.change.joinClub}</a>
  </CoachCard> : null;

  const retry = <button type="button" className="btn btn-outline" onClick={a.retry} disabled={disabled}>{a.busy === 'retry' ? W.errors.retrying : W.errors.retry}</button>;
  // The panel offers Upgrade exactly where the Change plan table does: a checkout change, on sale, in the ordinary
  // billing view (not staff free time, not cancelled). Only the owner gets here.
  const detailProfile = detail && Object.hasOwn(profiles, detail) ? profiles[detail] : null;
  const detailChange = detailProfile ? changes.find(change => change.target === detailProfile.key && change.mechanism === 'checkout') : undefined;
  const detailPlan = detailProfile && detailProfile.key in PLAN_ARTICLE_CONTENT ? detailProfile.key as PanelPlanKey : null;
  const panel = detailProfile ? <PlanArticlePanel planKey={detailPlan} profile={detailProfile} readOnly={!detailChange} billingCycle={a.cycle} onClose={onCloseDetail}
    onBillingCycleChange={a.setCycle}
    onUpgrade={() => { onCloseDetail(); if (detailChange) a.change(detailChange, a.cycle); }} upgradeLoading={a.busy === 'checkout' ? detailPlan : null}
    isComingSoon={s.gating.status === 'ready' && s.gating.data[detailProfile.key as OrgPlan] !== false}
    canUpgrade={Boolean(detailChange) && controlsReady && ownBilling && !cancelled && !pending && sale(detailProfile.key)} foundingOfferHeld={false} /> : null;
  // A failed grant read cannot distinguish an actual cancellation from staff free time.
  // Offer help without asserting cancellation, renewal, a price, or a retention clock.
  if (s.freeTime.status === 'error') return <><div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    <CoachCard className={styles.planCard}>
      <CoachEyebrow chip={<CoachChip tone="warn">{W.plan.unavailable}</CoachChip>}>{W.page.sections.plan}</CoachEyebrow>
      <h2 className={styles.planName}>{profile.config.label}</h2>
      <ReadFailure read={s.freeTime} section="free time" />
      {/* Part C (b): a cancel that waits doesn't depend on free time, so its line and Keep stay when that read fails. */}
      {keepLine}
      <div className={styles.planActions}>{keepButton}{retry}<a href={CONTACT_HREF} className="btn btn-outline">{W.change.contact}</a></div>
    </CoachCard>
    {fees}
  </div>{panel}</>;

  const readRecovery = [s.usage, s.founding, s.gating, s.cancellation, s.move].some(read => read.status === 'error') ? retry : null;

  // A stored-cancelled org lands on the reactivate card, never the ordinary plan page. Hold the page until the grant
  // read says which card it is (and, for the owner, until the cancellation record fills its date), so the plan page
  // does not flash first and the card does not grow a date after it appears.
  const settlingCancelled = org.subscriptionStatus === 'canceled' && (s.freeTime.status === 'loading' || (cancelled && s.cancellation.status === 'loading'));
  if (settlingCancelled) return <div className={styles.body}><LoadingState label={W.page.loading} /></div>;

  if (endedPortal && controlsReady) return <><div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    <CoachCard className={styles.planCard}>
      <CoachEyebrow>{portalCopy!.band.eyebrow}</CoachEyebrow>
      <h2 className={styles.planName}>{profile.config.label}</h2>
      <p className={styles.planPrice}>{W.plan.free}</p>
    </CoachCard>
    <FreeTimeBand band={portalCopy!.band} />
    {readRecovery}
    {keepPremium}{joinClub}{fees}
  </div>{panel}</>;

  if (cancelled && controlsReady) {
    const until = preflight?.cancelled?.keptUntil ?? null;
    const modules = new Set<string>([...ownProfile.config.moduleEntitlements, ...org.enabledAddons]);
    return <><div className={styles.body}>
      {notice && <PageNotice notice={notice} />}
      <CoachCard className={styles.reactivate}>
        <CoachEyebrow chip={<CoachChip tone="danger">{W.reactivate.chip(preflight?.cancelled?.at ?? null)}</CoachChip>}>
          {premium ? W.reactivate.premiumCancelled : W.reactivate.cancelled(org.name)}
        </CoachEyebrow>
        <h2 className={styles.cardTitle}>{premium ? W.reactivate.premiumAction : W.reactivate.title(ownProfile.config.label)}</h2>
        <p className={styles.hint}>{premium ? W.reactivate.premiumBody(until) : W.reactivate.orgBody}</p>
        <p className={styles.hint}>{W.cancel.retained(preflight?.retentionDays ?? ownProfile.retentionDays)}</p>
        {until && <p className={styles.hint}>{W.reactivate.keptUntil(until)}</p>}
        <p className={styles.hint}>{W.reactivate.intro}</p>
        <ul className={styles.restores}>
          {(premium ? [W.reactivate.premiumTools, W.reactivate.premiumData] : [
            ...(modules.has('module_public_site') ? [W.reactivate.publicSite] : []),
            ...(modules.has('module_rep_teams') ? [W.reactivate.portals] : []),
            W.reactivate.tournaments, W.reactivate.reminders,
          ]).map(line => <li key={line}><CheckCircle2 size={14} aria-hidden />{line}</li>)}
        </ul>
        {!premium && <p className={styles.hint}>{W.reactivate.remainder}</p>}
        <ReadFailure read={s.cancellation} section="the cancellation record" />
        <div className={styles.reactivateRow}>
          {premium ? <a id="billing-reactivate-btn" className="btn btn-lime" href={teamWorkspaceReactivatePath(org)}>{W.reactivate.premiumAction}</a>
            : paid && s.gating.status === 'ready' && sale(ownProfile.key) ? <>
              <label className={styles.cycleField}><span className={styles.srOnly}>{W.plan.billing}</span>
                <select className={styles.select} value={a.cycle} disabled={disabled} onChange={e => a.setCycle(e.target.value as BillingCycle)}>
                  <option value="monthly">{W.plan.monthly} · {formatPriceAmount(ownProfile.config.monthlyPrice)}</option>
                  <option value="annual">{W.plan.annual} · {formatPriceAmount(ownProfile.config.annualPrice)}</option>
                </select></label>
              <button id="billing-reactivate-btn" type="button" className="btn btn-lime" onClick={a.reactivate} disabled={disabled}>{a.busy === 'checkout' ? W.plan.openingCheckout : W.reactivate.action(ownProfile.config.label)}</button>
            </> : <a id="billing-reactivate-btn" href={CONTACT_HREF} className="btn btn-lime">{W.reactivate.contact}</a>}
        </div>
        <ReadFailure read={s.gating} section="plan availability" />
      </CoachCard>
      {premium && <CoachCard className={styles.section}>
        <h2 className={styles.sectionTitle}>{W.reactivate.basicTitle}</h2>
        <p className={styles.hint}>{W.reactivate.basicBody}</p>
        <a href={COACHES_TOURNAMENTS_PATH} className="btn btn-outline">{W.reactivate.basicDoor}</a>
      </CoachCard>}
      {readRecovery}
      {fees}
    </div>{panel}</>;
  }

  const usage = s.usage.status === 'ready' ? s.usage.data : null;
  const changeKeys = Object.keys(profiles).filter(key => key === ownProfile.key || changes.some(change => change.target === key));
  const choice = founding ? fd?.nextSeason ?? null : null;
  const card = fd ? W.founding.formatCard(fd.card ?? null) : null;
  const nextPlans = nextSeasonPlanOptions(ownProfile.key as OrgPlan);
  const chosen = choice ? profiles[choice.planKey] : null;
  const chosenCycle = choice?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const endingContact = !portal && ft?.freeTime?.state === 'ending' && sale(ft.freeTime.plan);
  return <><div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    {waitNotice && <p className={styles.waitCallout} role="status">{waitNotice}</p>}
    {readRecovery}
    {org.subscriptionStatus === 'past_due' && <PageNotice notice={{ tone: 'bad', text: W.plan.pastDue }} />}
    <CoachCard className={styles.planCard}>
      <div className={styles.planGrid}>
        <div className={styles.planSide}>
          <CoachEyebrow chip={<CoachChip tone={pendingCancel ? 'warn' : staffFree ? band?.tone === 'amber' ? 'warn' : 'good' : org.subscriptionStatus === 'canceled' ? 'danger' : org.subscriptionStatus === 'past_due' ? 'warn' : 'good'}>{pendingCancel ? W.plan.ending : portalCopy?.band.eyebrow ?? (staffFree ? freeCopy?.band.eyebrow : W.plan.status(org.subscriptionStatus))}</CoachChip>}>{W.page.sections.plan}</CoachEyebrow>
          <h2 className={styles.planName}>{profile.config.label}</h2>
          {s.freeTime.status === 'loading' ? <LoadingState inline label={W.page.loading} /> : <p className={styles.planPrice}>{price}{taxedPrice && <> <span className={styles.plusTax}>{W.move.plusTax}</span></>}</p>}
          {freeCard && <p className={styles.hint}>{freeCard.from}</p>}
          {comp && <p className={styles.hint}>{W.founding.priceHelp(profile.config.annualPrice)}</p>}
          {controlsReady && ownBilling && !cancelled && !comp && !pending && org.currentPeriodEnd && <p className={styles.hint}>{org.subscriptionStatus === 'trialing' ? W.plan.trialEnds(org.currentPeriodEnd) : W.plan.renews(org.currentPeriodEnd)}</p>}
          {pending && <>
            {keepLine}
            {pending.heldMovePlan && <p className={styles.hint}>{W.plan.renewsAs(PLAN_CONFIG[pending.heldMovePlan].label)}</p>}
            {!actionsShown && keepButton}
          </>}
          {ownBilling && scheduled && !pending && <p className={styles.scheduled}>{W.plan.scheduled(profiles[scheduled.toPlan].config.label, scheduled.effectiveAt)} <button type="button" className={styles.link} disabled={disabled} onClick={a.keep}>{W.plan.keep(ownProfile.config.label)}</button></p>}
          {actionsShown && billingAddress && <p className={styles.hint}>{BILLING_ADDRESS_FORM_WORDS.onFile(billingAddress.line)}</p>}
          {actionsShown && <div className={styles.planActions}>
            {keepButton}
            <button type="button" className="btn btn-outline" id="billing-manage-btn" onClick={a.portal} disabled={disabled}><CreditCard size={14} aria-hidden />{a.busy === 'portal' ? W.plan.openingPortal : W.plan.payment}</button>
            {billingAddress && <button type="button" className="btn btn-outline" onClick={billingAddress.onEdit} disabled={disabled}>{BILLING_ADDRESS_FORM_WORDS.title}</button>}
          </div>}
          <ReadFailure read={s.freeTime} section="free time" />
        </div>
        <div className={styles.capSide}>
          <CoachEyebrow>{W.page.sections.usage}</CoachEyebrow>
          {s.usage.status === 'loading' && <LoadingState inline label="Loading billing usage…" />}
          <ReadFailure read={s.usage} section="billing usage" />
          {usage && profile.usageMeters.filter(m => !portal || m !== 'tournament_slots').map(meter => {
            const value = usage[meter];
            const finite = value.limit < NO_LIMIT;
            const pct = finite ? Math.min(100, Math.round(value.count / Math.max(value.limit, 1) * 100)) : 0;
            const caption = meter === 'teams' ? W.usage.teamCount(value.count, value.limit) : meter === 'tournament_slots'
              ? W.usage.tournamentCount(value.count, value.limit) : W.usage.staffCount(value.count, value.limit);
            return <div key={meter}>
              <p className={styles.capFigure}>{caption}</p>
              {finite && <div className={styles.capBar} role="meter" aria-label={meter === 'teams' ? W.usage.teams : meter === 'tournament_slots' ? W.usage.tournaments : W.usage.seats} aria-valuemin={0} aria-valuemax={Math.max(value.limit, value.count)} aria-valuenow={value.count}>
                <div className={`${styles.capFill} ${pct >= 100 ? styles.capFull : pct >= 85 ? styles.capNear : ''}`} style={{ width: `${pct}%` }} />
              </div>}
              {meter === 'staff_seats' && usage.officials > 0 && <p className={styles.hint}>{W.usage.freeOfficials(usage.officials)}</p>}
              {meter === 'teams' && <>
                <p className={styles.hint}>{staffFree ? W.usage.freeTeams(profile.config.label)
                  : value.limit !== profile.config.teamLimit ? W.usage.customTeams(value.limit, org.name)
                  : (() => {
                    const larger = ownProfile.changes.find(change => change.mechanism === 'move' && profiles[change.target].config.teamLimit > value.limit);
                    return larger ? W.usage.growingTeams(profile.config.label, value.limit, profiles[larger.target].config.label, profiles[larger.target].config.teamLimit)
                      : W.usage.largestTeams(profile.config.label, value.limit);
                  })()}</p>
                {!staffFree && value.count >= value.limit && (() => {
                  const larger = ownProfile.changes.find(change => change.mechanism === 'move' && profiles[change.target].config.teamLimit > value.limit);
                  return <p className={styles.hint}>{larger ? W.usage.fullTeams(org.name, value.limit, profile.config.label, profiles[larger.target].config.label) : W.usage.fullContact(org.name, value.limit, profile.config.label)}{' '}
                    {pending ? null : larger && sale(larger.target) && controlsReady ? <button type="button" className={styles.link} onClick={() => a.change(larger)} disabled={disabled}>{W.change.move(profiles[larger.target].config.label)}</button> : <a href={CONTACT_HREF} className={styles.link}>{W.change.contact}</a>}
                  </p>;
                })()}
              </>}
            </div>;
          })}
          {portal && <p className={styles.hint}>{W.change.hostingExcluded}</p>}
        </div>
      </div>
    </CoachCard>
    {pendingMove && <MoveBand move={pendingMove.move} movesAt={pendingMove.endsAt} retentionDays={preflight?.retentionDays ?? ownProfile.retentionDays} onChange={a.changePick} disabled={disabled} />}
    {band && <FreeTimeBand band={band} action={endingContact ? { label: W.change.contact, href: CONTACT_HREF } : undefined} />}
    {freeCopy?.billingCard && <p className={styles.hint}>{freeCopy.billingCard}{endingContact && <> <a href={CONTACT_HREF} className={styles.link}>{W.change.contact}</a></>}</p>}
    {portalCopy?.billingCard && <p className={styles.hint}>{portalCopy.billingCard}</p>}
    {founding && <CoachCard className={styles.section}>
      <CoachEyebrow>{cardWindowOpen ? W.founding.endingEyebrow : W.founding.eyebrow}</CoachEyebrow>
      <h2 className={styles.cardTitle}>{cardWindowOpen ? W.founding.endingTitle : W.founding.title(ownProfile.config.label)}</h2>
      <p className={styles.hint}>{cardWindowOpen ? W.founding.endingBody : W.founding.body(ownProfile.config.label, ownProfile.config.monthlyPrice, premium ? 'coach' : 'organization')}</p>
      <p className={styles.hint}>{W.founding.priceHelp(ownProfile.config.annualPrice)}</p>
      {cardWindowOpen && choice && chosen ? <>
        <h3 className={styles.sectionTitle}>{W.founding.chosen}</h3>
        <p>{W.founding.chosenTitle(chosen.config.label, chosenCycle)}</p>
        <p className={styles.hint}>{W.founding.chosenBody(chosenCycle === 'annual' ? chosen.config.annualPrice : chosen.config.monthlyPrice, card)}</p>
        <p className={styles.hint}>{W.founding.changeUntil}</p>
        <button type="button" className="btn btn-outline" onClick={a.portal} disabled={disabled}>{W.founding.change}</button>
      </> : cardWindowOpen && !justChose && nextPlans.length > 0 ? <>
        <h3 className={styles.sectionTitle}>{W.founding.chooseTitle}</h3>
        <p className={styles.hint}>{premium ? W.founding.coachChoiceHelp(ownProfile.config.label) : W.founding.orgChoiceHelp(ownProfile.config.label, PLAN_CONFIG.tournament.label)}</p>
        {nextPlans.map(key => <div key={key} className={styles.planActions}>{(['annual', 'monthly'] as const).map(cycle => <button key={cycle} type="button" className={`btn ${cycle === 'annual' ? 'btn-lime' : 'btn-outline'}`} onClick={() => a.choose(key, cycle)} disabled={disabled}>{W.founding.choose(profiles[key].config.label, cycle)} · {W.plan.price(cycle === 'annual' ? profiles[key].config.annualPrice : profiles[key].config.monthlyPrice, cycle)}</button>)}</div>)}
        <p className={styles.hint}>{W.founding.guarantee}</p>
      </> : null}
      {cardWindowOpen && justChose && !choice && <p className={styles.hint}>{W.founding.confirming} {retry}</p>}
      {cardWindowOpen ? <>
        <p className={styles.hint}>{W.founding.card(card)}</p>
        <button type="button" className="btn btn-outline" onClick={a.card} disabled={disabled}>{card ? W.founding.updateCard : W.founding.addCard}</button>
        {!choice && !justChose && <p className={styles.hint}>{premium ? W.founding.coachNothing : W.founding.orgNothing(PLAN_CONFIG.tournament.label)}</p>}
      </> : <p className={styles.hint}>{W.founding.noAction}</p>}
    </CoachCard>}
    <ReadFailure read={s.founding} section="Founding Season status" />
    {fees}
    {keepPremium}
    {(showChanges && changes.length > 0 || profile.joinClub) && <Section id="billing-change" title={W.page.sections.change}>
      {/* Part C (f): held until the cancel read lands — a waiting cancel makes these doors absent, so they never flash first. */}
      {showChanges && changes.length > 0 && s.cancellation.status === 'loading' && <LoadingState inline label={W.page.loading} />}
      {showChanges && changes.length > 0 && s.cancellation.status !== 'loading' && <>
        {pending && <p className={styles.waitCallout}>{pendingMove
          ? W.downgrade.waitingRefusal(ownProfile.key as OrgPlan, pendingMove.move.targetPlan, pendingMove.endsAt)
          : W.cancel.endingRefusal(ownProfile.key as OrgPlan, pending.endsAt)}</p>}
        <div className={styles.tableFrame}><table className={styles.table}>
          <thead><tr><th scope="col">{W.change.headings.plan}</th><th scope="col">{W.change.headings.holds}</th><th scope="col" className={styles.num}>{W.change.headings.monthly}</th><th scope="col" className={styles.num}>{W.change.headings.annual}</th><th scope="col"><span className={styles.srOnly}>{W.change.headings.choice}</span></th></tr></thead>
          <tbody>{changeKeys.map(key => {
            const target = profiles[key];
            const change = changes.find(c => c.target === key);
            return <tr key={key}>
              <td data-label={W.change.headings.plan}><strong>{target.config.label}</strong>{key !== ownProfile.key && <button type="button" className={`${styles.link} ${styles.details}`} onClick={() => a.details(key)}>{W.change.details(target.config.label)}</button>}</td>
              <td data-label={W.change.headings.holds}>{target.usageMeters.includes('teams') ? W.change.upTo(target.config.teamLimit) : W.change.tournamentLimit(target.config.tournamentLimit)}</td>
              <td data-label={W.change.headings.monthly} className={styles.num}>{target.config.monthlyPrice === 0 ? W.plan.free : formatPriceAmount(target.config.monthlyPrice)}</td>
              <td data-label={W.change.headings.annual} className={styles.num}>{target.config.annualPrice === 0 ? W.plan.free : formatPriceAmount(target.config.annualPrice)}</td>
              <td data-label={W.change.headings.choice}>{key === ownProfile.key ? <CoachChip tone="good">{W.change.current}</CoachChip>
                // A waiting cancel or move: the doors are absent, not disabled; the line above the table says why (Stage 0
                // ruling 3). A waiting move's own plan shows the "From {date}" chip, as a waiting paid move's does.
                : pending ? key === moveTarget ? <CoachChip tone="warn">{W.plan.scheduledFrom(pending.endsAt)}</CoachChip> : null
                : scheduled?.toPlan === key ? <CoachChip tone="warn">{W.plan.scheduledFrom(scheduled.effectiveAt)}</CoachChip>
                  // A Founding Season comp has no subscription to reduce; the old page hid the downgrade with Cancel.
                  : founding && change?.mechanism === 'downgrade' ? null
                  : !controlsReady ? null
                  : change && (change.mechanism === 'downgrade' || sale(key)) ? <button type="button" className="btn btn-outline" onClick={() => a.change(change)} disabled={disabled}>{ownProfile.key === 'team' ? W.clubUpgrade.start : change.mechanism === 'downgrade' ? W.change.downgrade(target.config.label) : change.mechanism === 'checkout' ? W.change.upgrade(target.config.label) : W.change.move(target.config.label)}</button>
                    : s.gating.status !== 'loading' && <a className={`btn btn-outline ${styles.moveDoor}`} href={CONTACT_HREF}>{W.change.contactMove}</a>}</td>
            </tr>;
          })}</tbody>
        </table></div>
        <ReadFailure read={s.gating} section="plan availability" />
        <ReadFailure read={s.move} section="scheduled plan changes" />
        {profile.usageMeters.includes('teams') && <p className={`${styles.lede} ${styles.afterTable}`}>{W.change.custom(Math.max(...changeKeys.map(key => profiles[key].config.teamLimit)))} <a href={CONTACT_HREF} className={styles.link}>{W.change.contact}</a> {W.change.customEnd}</p>}
      </>}
      {joinClub}
    </Section>}
    <Section id="billing-includes" title={W.page.sections.included}>
      <ul className={styles.includes}>{profile.included.billing.filter((_, index) => !portal || !profile.freeTimeOmittedBillingItems?.includes(index)).map(line => <li key={line}><CheckCircle2 size={14} aria-hidden />{line}</li>)}</ul>
    </Section>
    {profile.discoveryPlans && <Section id="billing-discovery" title={W.shelf.title}>
      <p className={styles.hint}>{W.shelf.withCoach}</p>
      <div className={styles.discovery}>{profile.discoveryPlans.map(key => <CoachCard key={key} className={styles.discoveryCard}>
        <h3 className={styles.sectionTitle}>{profiles[key].config.label}</h3><p className={styles.hint}>{W.plan.fromPrice(profiles[key].config.monthlyPrice)}</p>
        <button type="button" className={`${styles.link} ${styles.details}`} onClick={() => a.details(key)}>{W.change.details(profiles[key].config.label)}</button>
        {profiles[key].cancellationKind === 'premium' && s.gating.status !== 'loading' && (sale(key) ? <a href={COACHES_START_PATH} className={`btn btn-outline ${styles.discoveryAction}`}>{W.shelf.startCoach}</a> : <a href={CONTACT_HREF} className={`${styles.link} ${styles.discoveryAction}`}>{W.change.contact}</a>)}
      </CoachCard>)}</div>
    </Section>}
    {/* A waiting cancel hides this; a waiting move keeps it — a cancel replaces the move (Stage 2 ruling 4). */}
    {controlsReady && paid && ownBilling && !founding && !pendingCancel && <Section id="billing-cancel" title={W.page.sections.cancel}>
      {/* A subscription that waits for a date it can't name: no door that would promise one, or wrongly say "now". */}
      {preflight?.ending?.waits && !preflight.ending.endsOn ? <><p role="alert" className={styles.hint}>{W.errors.read('the renewal date')}</p>{retry}</>
        : preflight ? <>
        <p className={styles.cancelCopy}>{preflight.ending?.endsOn
          ? premium ? W.cancel.premiumWaitBody(preflight.ending.endsOn, preflight.retentionDays, trialingNow) : W.cancel.waitBody(org.name, preflight.shortShutsDown, preflight.ending.endsOn, preflight.retentionDays, trialingNow)
          : premium ? W.cancel.premiumBody(preflight.retentionDays) : W.cancel.orgBody(org.name, preflight.shortShutsDown, preflight.retentionDays)}</p>
        <button type="button" className={`btn btn-outline ${styles.dangerText}`} id="billing-cancel-btn" onClick={a.cancel} disabled={disabled}>{premium ? W.cancel.premiumDoor : preflight.ending?.endsOn ? W.cancel.waitDoor(ownProfile.config.label) : W.cancel.orgDoor(org.name)}</button>
      </> : s.cancellation.status === 'loading' ? <LoadingState inline label="Loading cancellation details…" /> : <ReadFailure read={s.cancellation} section="cancellation details" />}
    </Section>}
  </div>{panel}</>;
}

/** Same-URL revisions retain their last result while refetching; previous-org reads never paint. */
function useBillingRead<T>(url: string | null, revision: string): BillingRead<T> {
  const identity = `${url}:${revision}`;
  const [read, setRead] = useState<{ url: string; identity: string; value: BillingRead<T> } | null>(null);
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    fetch(url, { cache: 'no-store', signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('Read failed');
      return response.json() as Promise<T>;
    }).then(data => { if (!abort.signal.aborted) setRead({ url, identity, value: { status: 'ready', data } }); })
      .catch(() => { if (!abort.signal.aborted) setRead({ url, identity, value: { status: 'error', error: W.errors.generic } }); });
    return () => abort.abort();
  }, [url, identity]);
  return read?.identity === identity || read?.url === url ? read!.value : { status: 'loading' };
}

export default function BillingBody({ billingBase, teamsHref }: { billingBase: string; teamsHref: string }) {
  const { currentOrg, userRole, loading, refresh } = useOrg();
  if (loading || !currentOrg || !userRole) return <LoadingState label={W.page.loading} />;
  // Plan & billing is the owner's alone (owner, 2026-10-29). No billing reads mount for anyone else, including free-time and cancelled states.
  if (userRole !== 'owner') return <LockedCard orgName={currentOrg.name} />;
  return <BillingOwnerBody key={currentOrg.id} org={currentOrg} refresh={refresh} billingBase={billingBase} teamsHref={teamsHref} />;
}

type BillingOwnerProps = { org: Organization; refresh: () => Promise<void>; billingBase: string; teamsHref: string };
function BillingOwnerBody(props: BillingOwnerProps) {
  const params = useSearchParams();
  // Keep the marker throughout waiting, on either side of the flip. No ordinary billing reads or payment controls mount.
  return isInPlaceReturn(params)
    ? <ClubUpgradeSetup orgSlug={props.org.slug} /> : <BillingPlanBody {...props} />;
}

function BillingPlanBody({ org, refresh, billingBase, teamsHref }: BillingOwnerProps) {
  const router = useRouter();
  const params = useSearchParams();
  const profile = PLAN_BILLING_PROFILES[org.planId];
  const ownProfile = PLAN_BILLING_PROFILES[ownPlanOf(org)];
  const [initialReturn] = useState(() => billingReturnState(params.toString(), billingBase, profile.showFoundingSeason));
  const [revision, setRevision] = useState(0);
  const [cycle, setCycle] = useState<BillingCycle>(org.subscriptionPeriod ?? 'monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [justChose, setJustChose] = useState(initialReturn.justChose);
  const [detail, setDetail] = useState<string | null>(initialReturn.detail);
  const [notice, setNotice] = useNotice(initialReturn.notice);
  const [moveTo, setMoveTo] = useState<OrgPlan | null>(null);
  const [payFor, setPayFor] = useState<OrgPlan | null>(null);
  // GST/HST Stage 1: the buyer's billing address (a Coaches Portal's is the coach's own home address).
  const address = useBillingAddressGate({ orgSlug: org.slug });
  const [review, setReview] = useState<{ kind: 'cancel'; data: BillingCancellation } | { kind: 'downgrade'; read: BillingRead<BillingDowngrade> } | null>(null);
  const [reason, setReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const leaving = useRef(false);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  // Keep {Plan} (Plans end at renewal): its question window, its error, a `keep_plan` arrival, and a kept plan whose
  // cheaper move couldn't come back (said as a wait, not a failure — the plan IS kept).
  // Arriving by `keep_plan=1` starts it open; it shows once the waiting cancel has loaded (derived, never set in an effect).
  const [keepOpen, setKeepOpen] = useState(initialReturn.keepPlan);
  const [keepError, setKeepError] = useState<string | null>(null);
  const [waitNotice, setWaitNotice] = useState<string | null>(null);
  const scope = `orgSlug=${encodeURIComponent(org.slug)}`;
  const version = `${org.planId}:${ownProfile.key}:${org.subscriptionStatus}:${revision}`;
  const usage = useBillingRead<BillingUsage>(`/api/billing/usage?${scope}`, version);
  const freeTime = useBillingRead<BillingFreeTime>(`/api/admin/org/free-time?${scope}&billing=1`, version);
  const founding = useBillingRead<BillingFounding>(profile.showFoundingSeason ? `/api/admin/org/founding-season-status?${scope}` : null, version);
  const gating = useBillingRead<Partial<Record<OrgPlan, boolean>>>('/api/plan-gating', version);
  const cancellation = useBillingRead<BillingCancellation>(`/api/billing/cancel/preflight?${scope}`, version);
  const move = useBillingRead<BillingMove>(ownProfile.changes.some(c => c.mechanism === 'move') && org.subscriptionStatus !== 'canceled' ? `/api/billing/move?${scope}` : null, version);
  const pendingEnding = cancellation.status === 'ready' && org.subscriptionStatus !== 'canceled' ? cancellation.data.ending?.pending ?? null : null;
  // Stage 2: the waiting change is a move to the free plan (its band, Change which tournament you keep, the Keep sentence).
  const waitingMove = pendingEnding?.kind === 'downgrade' ? pendingEnding : null;
  const openKeep = () => { setKeepError(null); setKeepOpen(true); };
  // Change which tournament you keep (G2): a fresh read of what holds a slot NOW (the downgrade review, so a tournament
  // made during the wait is in the list), the stored pick ticked where it still holds one.
  const [pick, setPick] = useState<PickState | null>(null);
  async function openPick() {
    if (!waitingMove || busyRef.current) return;
    const stored = waitingMove.move.keepIds;
    setPick({ read: { status: 'loading' }, ids: [], stored, error: null });
    try {
      // org-slug-ok: post() adds orgSlug to every body
      const data = await post('/api/billing/downgrade/preflight', { targetPlan: waitingMove.move.targetPlan }) as BillingDowngrade;
      if (!live.current) return;
      const holding = new Set(data.tournaments.map(t => t.id));
      // The stored pick as far as it still holds a slot: a gone one is neither ticked nor counted as a change to discard.
      const stillHeld = stored.filter(id => holding.has(id));
      setPick(p => p && { ...p, read: { status: 'ready', data }, ids: stillHeld, stored: stillHeld });
    } catch (error) {
      if (live.current) setPick(p => p && { ...p, read: { status: 'error', error: error instanceof Error ? error.message : W.errors.downgradeReview } });
    }
  }
  async function savePick() {
    if (!pick || pick.read.status !== 'ready' || !waitingMove) return;
    const { ids, read: { data } } = pick;
    await run('pick', async () => {
      try {
        // org-slug-ok: post() adds orgSlug to every body
        await post('/api/billing/downgrade/pick', { keepTournamentIds: ids });
        if (!live.current) return;
        setPick(null);
        setNotice({ tone: 'good', text: W.downgrade.pick.saved(waitingMove.endsAt, data.tournaments.filter(t => ids.includes(t.id)).map(t => t.name)) });
        reloadAfterAction();
      } catch (error) { if (live.current) setPick(p => p && { ...p, error: error instanceof Error ? error.message : W.errors.generic }); }
    });
  }
  const [retrying, setRetrying] = useState(false);
  const reload = useCallback(async () => {
    try { await refresh(); }
    finally { if (live.current) setRevision(n => n + 1); }
  }, [refresh]);
  // The money operation has succeeded. A context-refresh failure must not recast it as a failed payment.
  const reloadAfterAction = () => { void reload().catch(() => {}); };
  const retryReads = useCallback(() => {
    setRetrying(true);
    void reload().catch(() => { if (live.current) setNotice({ tone: 'bad', text: W.errors.refresh }); })
      .finally(() => { if (live.current) setRetrying(false); });
  }, [reload, setNotice]);

  useEffect(() => {
    if (initialReturn.consumed) router.replace(initialReturn.destination, { scroll: false });
  }, [initialReturn, router]);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) {
      leaving.current = false; busyRef.current = false; setBusy(null); setJustChose(false); retryReads();
    } };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [retryReads]);

  const cardReturnNoticed = useRef(false);
  useEffect(() => {
    if (!cardReturnNoticed.current && initialReturn.cardSaved && founding.status === 'ready' && founding.data.isFoundingSeason && isFoundingSeasonActive()) {
      cardReturnNoticed.current = true;
      setNotice({ tone: 'good', text: W.notice.foundingCardSaved });
    }
  }, [initialReturn.cardSaved, founding, setNotice]);

  const choiceRetries = useRef(0);
  useEffect(() => {
    if (!justChose || founding.status !== 'ready' || founding.data.nextSeason) return;
    if (choiceRetries.current >= 5) {
      setJustChose(false);
      setNotice({ tone: 'bad', text: W.errors.nextSeasonRead, action: { label: W.errors.retry, run: retryReads } });
      return;
    }
    const timer = window.setTimeout(() => {
      choiceRetries.current += 1;
      setRevision(n => n + 1);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [justChose, founding, retryReads, setNotice]);

  async function post(endpoint: string, input: Record<string, unknown> = {}, method = 'POST') {
    const response = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : JSON.stringify({ ...input, orgSlug: org.slug }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // GST/HST Stage 1: a paid route with no billing address on file opens the Billing address window, not an error.
      if (isAddressRefusal(data)) return ADDRESS_REFUSED;
      throw new Error(data.error ?? W.errors.generic);
    }
    return data;
  }
  async function run(key: string, work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(key);
    try { await work(); } catch (error) { if (live.current) {
      const text = error instanceof Error ? error.message : W.errors.generic;
      if (review) setReviewError(text); else setNotice({ tone: 'bad', text });
    } }
    finally { if (live.current && !leaving.current) { busyRef.current = false; setBusy(null); } }
  }
  function leave(url: string) {
    if (!live.current) return;
    leaving.current = true;
    try { window.location.assign(url); } catch (error) { leaving.current = false; throw error; }
  }
  async function checkout(target: OrgPlan, chosen: BillingCycle = cycle) {
    await run('checkout', async () => {
      const result = await post('/api/billing/create-checkout', { planKey: target, billingCycle: chosen, returnTo: billingBase });
      if (!live.current) return;
      if (result === ADDRESS_REFUSED) { address.refused(() => void checkout(target, chosen)); return; }
      if (result.applied) { setNotice({ tone: 'good', text: W.notice.updated(PLAN_BILLING_PROFILES[target].config.label, result.restoredCount, result.remainingRetainedCount) }); reloadAfterAction(); }
      else if (result.url) leave(result.url);
      else throw new Error(W.errors.checkout);
    });
  }
  async function openDowngrade(target: OrgPlan) {
    if (busyRef.current) return;
    setReason(''); setReviewError(null); setKeepIds([]); setToolsOpen(false); setReview({ kind: 'downgrade', read: { status: 'loading' } });
    await run('review', async () => {
      try {
        // org-slug-ok: post() adds orgSlug to every body
        const data = await post('/api/billing/downgrade/preflight', { targetPlan: target }) as BillingDowngrade;
        if (!live.current) return;
        setReview({ kind: 'downgrade', read: { status: 'ready', data } });
        if (!data.requiresTournamentChoice) setKeepIds(data.tournaments.map(t => t.id));
      } catch (error) { if (live.current) setReview({ kind: 'downgrade', read: { status: 'error', error: error instanceof Error ? error.message : W.errors.downgradeReview } }); }
    });
  }
  // A comped Founding plan choice charges nothing, so it is not asked for an address first. The server decides for certain:
  // if it disagrees, the checkout's refusal opens the window anyway.
  const freeChoice = (target: OrgPlan) => target === 'tournament_plus' && ownProfile.key === 'tournament'
    && founding.status === 'ready' && founding.data.isFoundingSeason;
  const askFirst = (target: OrgPlan, next: () => void) => { if (freeChoice(target)) next(); else address.ensure(next); };
  const actions: Action = {
    busy: busy ?? (retrying ? 'retry' : null), cycle, setCycle, retry: retryReads,
    portal: () => void run('portal', async () => { const result = await post('/api/billing/portal', { returnTo: billingBase }); if (result.url) leave(result.url); else if (live.current) throw new Error(W.errors.portal); }),
    card: () => void run('card', async () => { const result = await post('/api/billing/setup-payment-method', { returnTo: billingBase }); if (result.url) leave(result.url); else if (live.current) throw new Error(W.errors.card); }),
    // Every paid button asks for the billing address first when none is on file (GST/HST Stage 1): window → question → Stripe.
    reactivate: () => address.ensure(() => void checkout(ownProfile.key)),
    keep: () => void run('keep', async () => { await post(`/api/billing/move?${scope}`, {}, 'DELETE'); if (live.current) { setNotice({ tone: 'good', text: W.plan.kept(org.name, ownProfile.config.label) }); reloadAfterAction(); } }),
    // A `keep_plan` arrival that found nothing waiting must not open Keep over the cancel this starts.
    cancel: () => { if (cancellation.status === 'ready') { setKeepOpen(false); setReason(''); setReviewError(null); setReview({ kind: 'cancel', data: cancellation.data }); } },
    keepPlan: openKeep,
    changePick: () => void openPick(),
    change: (change, chosen) => {
      if (change.mechanism === 'move') setMoveTo(change.target as OrgPlan);
      else if (change.mechanism === 'downgrade') void openDowngrade(change.target as OrgPlan);
      else if (chosen) askFirst(change.target as OrgPlan, () => { setCycle(chosen); void checkout(change.target as OrgPlan, chosen); });
      else askFirst(change.target as OrgPlan, () => setPayFor(change.target as OrgPlan));
    },
    details: setDetail,
    choose: (key, billingCycle) => address.ensure(() => void choose(key, billingCycle)),
  };
  function choose(key: string, billingCycle: BillingCycle) {
    return run('choose', async () => {
      const result = await post('/api/billing/choose-next-season', { planKey: key, billingCycle, returnTo: billingBase });
      if (!live.current) return;
      if (result === ADDRESS_REFUSED) { address.refused(() => void choose(key, billingCycle)); return; }
      if (result.applied || result.url) { choiceRetries.current = 0; setJustChose(true); }
      if (result.applied) { setNotice({ tone: 'good', text: W.notice.nextSeason }); reloadAfterAction(); }
      else if (result.url) leave(result.url); else throw new Error(W.errors.nextSeason);
    });
  }
  const downgrade = review?.kind === 'downgrade' && review.read.status === 'ready' ? review.read.data : null;
  const cancel = review?.kind === 'cancel' ? review.data : null;
  const target = downgrade ? PLAN_BILLING_PROFILES[downgrade.targetPlan] : null;
  const premium = ownProfile.cancellationKind === 'premium';
  const ownKey = ownProfile.key as OrgPlan;
  const keepLabel = W.cancel.keepDoor(ownKey);
  // Plans end at the renewal date (Stage 1): a real subscription's cancel waits for its date; with none it ends at the click.
  const ending = cancel?.ending ?? null;
  const endsOn = ending?.waits ? ending.endsOn : null;
  const trialing = org.subscriptionStatus === 'trialing';
  // A cheaper move waiting at renewal: the cancel sets it aside, and Keep {Plan} brings it back (gap review G1).
  const heldMove = move.status === 'ready' ? move.data.scheduledMove : null;
  // Stage 2 Part B: a paying subscription's move to the free plan waits for its date; none to wait for, it moves at the
  // click (ruling 3). A waiting move whose date is missing says so and offers no confirm (as the Cancel section does).
  const movesOn = downgrade?.when?.waits ? downgrade.when.movesOn : null;
  const moveDateMissing = Boolean(downgrade?.when?.waits && !movesOn);
  // Downgrade window redraw (owner 2026-11-05): the foot says what the button is waiting for, then what was chosen; the
  // button already carries the date, so the foot no longer repeats it. The names of the rest appear once the choice is complete.
  const choiceDone = Boolean(downgrade?.requiresTournamentChoice && keepIds.length === downgrade.allowedKeepCount);
  const keptNames = downgrade ? downgrade.tournaments.filter(t => keepIds.includes(t.id)).map(t => t.name) : [];
  const restNames = downgrade && choiceDone ? downgrade.tournaments.filter(t => !keepIds.includes(t.id)).map(t => t.name) : [];
  const downgradeFoot = !downgrade ? null
    : downgrade.requiresTournamentChoice
      ? keepIds.length === 0 ? W.downgrade.pickNeeded(downgrade.allowedKeepCount) : choiceDone ? W.downgrade.pickedFoot(keptNames) : W.downgrade.pickedCount(keepIds.length, downgrade.allowedKeepCount)
      : movesOn ? null : W.cancel.footer(downgrade.retentionDays);
  const period = org.subscriptionPeriod ?? 'monthly';
  const listPrice = (key: OrgPlan) => W.plan.charge(key, period);
  // The Keep window names the charge: what the subscription charges when the webhook recorded it, else the price list.
  const ownPrice = W.plan.charge(ownKey, period, org.subscriptionAmountCents, org.subscriptionCurrency);
  const closeReview = () => setReview(null);
  async function confirmReview() {
    if (!cancel && !downgrade) return;
    await run('confirm', async () => {
    setReviewError(null);
    // org-slug-ok: post() adds orgSlug to every body
    const result = cancel ? await post('/api/billing/cancel/confirm', { reason }) : await post('/api/billing/downgrade/confirm', { targetPlan: downgrade!.targetPlan, keepTournamentIds: keepIds, reason });
      if (!live.current) return;
      setReview(null);
      setWaitNotice(null);
      // Scheduled: nothing has ended yet. Stripe holds the cancel and our record may still be catching up (said as a wait).
      if (cancel && result.outcome === 'scheduled') {
        if (typeof result.notice === 'string') setWaitNotice(result.notice);
        else setNotice({ tone: 'good', text: W.notice.ending(premium ? 'Premium' : org.name, result.endsAt ?? null) });
      // A move to the free plan that waits for its date: the notice says when, never "your plan is now" (Stage 2).
      } else if (downgrade && result.outcome === 'scheduled') {
        setNotice({ tone: 'good', text: W.move.scheduled(org.name, target!.config.label, result.movesAt ?? null) });
      } else setNotice({ tone: 'good', text: cancel ? premium ? W.notice.premiumCancelled(cancel.retentionDays) : W.notice.cancelled(org.name, cancel.retentionDays)
        : W.notice.downgraded(target!.config.label, result.retainedCount ?? 0, downgrade!.retentionDays) });
      reloadAfterAction();
    });
  }
  async function confirmKeep() {
    await run('keepPlan', async () => {
      setKeepError(null);
      try {
        // org-slug-ok: post() adds orgSlug to every body
        const result = await post('/api/billing/cancel/keep');
        if (!live.current) return;
        setKeepOpen(false);
        setWaitNotice(typeof result.notice === 'string' ? result.notice : null);
        if (typeof result.notice !== 'string') setNotice({ tone: 'good', text: W.plan.kept(org.name, ownProfile.config.label) });
        reloadAfterAction();
      } catch (error) { if (live.current) setKeepError(error instanceof Error ? error.message : W.errors.keep); }
    });
  }
  return <>
    <BillingBodyView snapshot={{ org, canManageBilling: true, usage, freeTime, founding, gating, cancellation, move }} profile={profile} ownProfile={ownProfile} actions={actions} notice={notice} waitNotice={waitNotice} justChose={justChose} detail={detail} onCloseDetail={() => setDetail(null)} cardWindowOpen={isFoundingSeasonCardWindowOpen()} foundingActive={isFoundingSeasonActive()} fees={<StripeFeesList key={org.id} slug={org.slug} />}
      billingAddress={address.info?.location ? { line: formatBillingAddress(address.info.location), onEdit: () => address.edit() } : null} />
    {moveTo && <PlanMoveDialog key={`${org.id}:${moveTo}`} org={{ ...org, planId: ownProfile.key }} toPlan={moveTo} returnTo={billingBase} teamsHref={teamsHref}
      freeThrough={freeTime.status === 'ready' ? freeTime.data.portal?.lastDay ?? freeTime.data.freeTime?.lastDay ?? (founding.status === 'ready' && founding.data.isFoundingSeason ? founding.data.compUntil : null) : null}
      // A waiting cancel refuses every move: the window's door is Keep {Plan}, here the same question window.
      onKeep={pendingEnding ? () => { setMoveTo(null); openKeep(); } : undefined}
      onClose={() => setMoveTo(null)} onMoved={text => { if (live.current) {
        setWaitNotice(null);
        if (ownProfile.key === 'team') { window.location.replace(inPlaceReturnPath(org.slug)); return; }
        setMoveTo(null); setNotice({ tone: 'good', text }); reloadAfterAction();
      } }} />}
    {payFor && <PlanCycleDialog key={`${org.id}:${payFor}`} label={PLAN_BILLING_PROFILES[payFor].config.label} monthlyPrice={PLAN_BILLING_PROFILES[payFor].config.monthlyPrice}
      annualPrice={PLAN_BILLING_PROFILES[payFor].config.annualPrice} savings={W.plan.savings(payFor)} initial={cycle} onClose={() => setPayFor(null)}
      billedTo={address.location ? formatBilledTo(address.location) : null}
      onChangeAddress={() => { const plan = payFor; setPayFor(null); address.edit(() => setPayFor(plan)); }}
      onContinue={chosen => { setPayFor(null); setCycle(chosen); void checkout(payFor, chosen); }} />}
    {address.dialog}
    {address.savedAt !== null && <NoticePill key={address.savedAt} message={BILLING_ADDRESS_FORM_WORDS.saved} onDone={address.clearSaved} />}
    {keepOpen && pendingEnding && <KitDialog kind="question" title={W.cancel.keepTitle(ownKey)} onClose={() => setKeepOpen(false)} busy={busy !== null}
      footer={<><DialogCancel>{W.cancel.notNow}</DialogCancel>
        <button type="button" className="btn btn-lime" onClick={() => void confirmKeep()} disabled={busy !== null}>{busy === 'keepPlan' ? W.cancel.keeping : pendingEnding.heldMovePlan ? W.cancel.keepAndMove(PLAN_CONFIG[pendingEnding.heldMovePlan].label) : keepLabel}</button></>}
    >
      <DialogReason className={styles.dangerText}>{keepError}</DialogReason>
      {pendingEnding.heldMovePlan ? <>
        <p>{W.cancel.keepStaysUntil(org.name, ownProfile.config.label, pendingEnding.endsAt)}</p>
        <p>{W.cancel.keepThenMove(PLAN_CONFIG[pendingEnding.heldMovePlan].label, listPrice(pendingEnding.heldMovePlan))}</p>
      </> : <>
        <p>{(trialing ? W.cancel.keepTrial : W.cancel.keepRenews)(org.name, ownProfile.config.label, pendingEnding.endsAt, ownPrice)}</p>
        <p>{waitingMove ? W.downgrade.keepMoveOff(PLAN_CONFIG[waitingMove.move.targetPlan].label) : W.cancel.keepNothingElse}</p>
      </>}
    </KitDialog>}
    {pick && waitingMove && <PickWindow orgName={org.name} endsAt={waitingMove.endsAt} since={waitingMove.move.since} pick={pick} busy={busy !== null}
      onChange={ids => setPick(p => p && { ...p, error: null, ids })}
      onSave={() => void savePick()} onClose={() => setPick(null)} />}
    {review && <KitDialog kind="form" title={review.kind === 'cancel' ? endsOn && !premium ? W.cancel.waitTitle(ownProfile.config.label) : premium ? W.cancel.premiumTitle : W.cancel.orgTitle(org.name) : target ? W.downgrade.title(target.config.label) : W.page.sections.change} onClose={closeReview} busy={busy !== null} dirty={reason.trim().length > 0 || Boolean(downgrade?.requiresTournamentChoice && keepIds.length)}
      footerStart={cancel ? (!endsOn && premium ? <span>{W.cancel.footer(cancel.retentionDays)}</span> : undefined) : downgradeFoot ? <span>{downgradeFoot}</span> : undefined}
      footer={<><DialogCancel>{keepLabel}</DialogCancel>
        {(cancel || downgrade) && <button type="button" className={cancel ? 'btn btn-danger' : 'btn btn-lime'} onClick={() => void confirmReview()} disabled={busy !== null || moveDateMissing || Boolean(downgrade?.requiresTournamentChoice && keepIds.length !== downgrade.allowedKeepCount)}>{busy === 'confirm' ? cancel ? W.cancel.working : W.downgrade.applying : cancel ? endsOn ? W.cancel.waitConfirm(endsOn) : premium ? W.cancel.premiumConfirm : W.cancel.confirm : movesOn ? W.downgrade.confirmOn(movesOn) : W.downgrade.confirm(target!.config.label)}</button>}</>}
    >
      <DialogReason className={styles.dangerText}>{reviewError}</DialogReason>
      {review.kind === 'downgrade' && review.read.status === 'loading' && <LoadingState inline label="Loading plan-change review…" />}
      {review.kind === 'downgrade' && review.read.status === 'error' && <PageNotice notice={{ tone: 'bad', text: review.read.error }} />}
      {/* Cancel window redraw (owner 2026-11-05, drawing 4AER3dndYsi39C8tYQNPZt): one calm lead (what stays + the way back), the
          list of what goes offline OPEN and said once, then when it is suspended and how long the data is kept, then the payments. */}
      {cancel && endsOn && <>
        <div className={`${styles.waitCallout} ${styles.moveBand} ${styles.calloutLines}`}>
          <p>{trialing ? W.cancel.trialStays(org.name, endsOn) : premium ? W.cancel.premiumStays(endsOn) : W.cancel.stays(org.name, endsOn)}</p>
          <p>{W.cancel.keepAnyTime(premium ? 'Premium' : ownProfile.config.label, endsOn)}</p>
        </div>
        {heldMove && <p className={styles.waitCallout}>{W.cancel.moveSetAside(PLAN_CONFIG[heldMove.toPlan].label, heldMove.effectiveAt, keepLabel)}</p>}
        {/* Stage 2 ruling 4: a cancel over a waiting move to the free plan replaces it; a later Keep returns the full plan. */}
        {waitingMove && <p className={styles.waitCallout}>{W.cancel.replacesMove(PLAN_CONFIG[waitingMove.move.targetPlan].label, waitingMove.endsAt, ownProfile.config.label)}</p>}
        <h3 className={`${styles.sectionTitle} ${styles.reviewHeading}`}>{premium ? W.cancel.premiumOfflineOn(endsOn) : W.cancel.offlineOn(endsOn)}</h3>
        <ul className={styles.offlineList}>{cancel.shutsDown.map(line => <li key={line}>{line}</li>)}</ul>
        <p className={`${styles.hint} ${styles.afterList}`}>{premium ? W.cancel.premiumKeptThen(endsOn, cancel.retentionDays) : W.cancel.suspendedThen(org.name, endsOn, cancel.retentionDays)}</p>
        <PaymentsEndingSection section={cancel.onlinePayments} ending={{ kind: 'cancelOn', dateLong: moveDateLong(endsOn), plan: premium ? 'Premium' : ownProfile.config.label }} />
      </>}
      {cancel && !endsOn && !premium && <>
        {/* No paid period to wait for (comped, Founding Season, a dev mock): the cancel happens at the click, so the lead is the one red
            line, and says why it does not wait. */}
        <div className={`${styles.waitCallout} ${styles.calloutDanger} ${styles.calloutLines}`}>
          {ending && !ending.waits && <p>{W.cancel.noPeriod(org.name)}</p>}
          <p>{W.cancel.suspendedNow(org.name)}</p>
        </div>
        <h3 className={`${styles.sectionTitle} ${styles.reviewHeading}`}>{W.cancel.offlineHeading}</h3>
        <ul className={styles.offlineList}>{cancel.shutsDown.map(line => <li key={line}>{line}</li>)}</ul>
        <p className={`${styles.hint} ${styles.afterList}`}>{W.cancel.retained(cancel.retentionDays)}{cancel.tournaments.length > 0 && ` ${W.cancel.archived(cancel.tournaments.length)}`}</p>
        <PaymentsEndingSection section={cancel.onlinePayments} ending={{ kind: 'cancel' }} />
      </>}
      {/* A Coaches Portal's Premium with no paid period keeps its own wording and layout (not part of the redraw). */}
      {cancel && !endsOn && premium && <>
        {/* No paid period to wait for (comped, Founding Season, a dev mock): today's immediate cancel, and why. */}
        {ending && !ending.waits && <p className={styles.waitCallout}>{W.cancel.noPeriod('Premium')}</p>}
        <PageNotice notice={{ tone: 'bad', text: W.cancel.premiumWarning(cancel.retentionDays) }} />
        <p>{W.cancel.retained(cancel.retentionDays)}</p><p>{W.cancel.premiumRetained(cancel.retentionDays)}</p>
        <h3 className={`${styles.sectionTitle} ${styles.reviewHeading}`}>{W.cancel.premiumOfflineHeading}</h3>
        <ul className={styles.offlineList}>{cancel.shutsDown.map(line => <li key={line}>{line}</li>)}</ul>
        <PaymentsEndingSection section={cancel.onlinePayments} ending={{ kind: 'cancel' }} />
      </>}
      {downgrade && target && <>
        {/* Stage 2 Part B: the move waits for the date (the drawing's words); no paid period → it moves now, and says why. */}
        {moveDateMissing ? <p role="alert" className={styles.hint}>{W.errors.read('the renewal date')}</p>
          : movesOn ? <p>{W.downgrade.whenOn(movesOn, ownProfile.config.label, trialing)}</p>
          : downgrade.when ? <p className={styles.waitCallout}>{W.downgrade.noPeriod(org.name)}</p>
          : <p>{W.downgrade.when}</p>}
        {/* Downgrade window redraw (owner 2026-11-05, drawing MYbuAxtXLUi7qqE16vaz34): the decision comes first, the rules that
            explain it sit quietly under it, and the long list of lost tools opens on request. The words are the shipped ones,
            split to fit the layout; the one-sentence "turns off these tools…" became the row's label and its list. */}
        {downgrade.requiresTournamentChoice ? <section className={styles.reviewBlock}>
          <h3 className={styles.label}>{W.downgrade.chooseCount(downgrade.allowedKeepCount)}</h3>
          <p className={styles.hint}>{W.downgrade.capacity(downgrade.targetTournamentLimit)} {W.downgrade.inUse(downgrade.activeTournamentCount)}</p>
          <TournamentChoices tournaments={downgrade.tournaments} ids={keepIds} onChange={setKeepIds} single={downgrade.allowedKeepCount === 1} limit={downgrade.allowedKeepCount} label={W.downgrade.chooseCount(downgrade.allowedKeepCount)} />
          <p>{W.downgrade.rest(downgrade.retentionDays, movesOn, restNames)}</p>
        </section> : <>
          <p>{W.downgrade.capacity(downgrade.targetTournamentLimit)}</p><p>{W.downgrade.inUse(downgrade.activeTournamentCount)}</p>
          <p>{W.downgrade.fits}</p>
        </>}
        <div className={styles.disclosure} data-open={toolsOpen || undefined}>
          <button type="button" className={styles.disclosureButton} aria-expanded={toolsOpen} aria-controls={toolsOpen ? 'downgrade-tools' : undefined} onClick={() => setToolsOpen(open => !open)}>
            <span>{W.downgrade.toolsOff(ownProfile.config.label)}</span>
            <span className={styles.disclosureCount}>{(ownProfile.downgradeLosses ?? []).length}</span>
            <ChevronRight size={16} aria-hidden className={styles.disclosureChevron} />
          </button>
          {toolsOpen && <div id="downgrade-tools" className={styles.disclosureBody}>
            <ul className={styles.toolsList}>{(ownProfile.downgradeLosses ?? []).map(feature => <li key={feature}>{feature.charAt(0).toUpperCase() + feature.slice(1)}</li>)}</ul>
            <p className={styles.hint}>{W.downgrade.lostKept}</p>
          </div>}
        </div>
        <PaymentsEndingSection section={downgrade.onlinePayments} ending={{ kind: 'move', dateLong: moveDateLong(movesOn) }} />
      </>}
      {(cancel || downgrade) && <div className={`${styles.field} ${styles.reviewField}`}>
        <label className={styles.label} htmlFor="billing-reason">{cancel ? W.cancel.reason : W.downgrade.reason}</label>
        <textarea id="billing-reason" className={styles.textarea} rows={3} value={reason} onChange={event => setReason(event.target.value)} />
        <p className={styles.hint}>{cancel ? W.cancel.reasonHelp : W.downgrade.reasonHelp}</p>
      </div>}
    </KitDialog>}
  </>;
}
