'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { ownPlanOf } from '@/lib/free-time';
import { hasCapability } from '@/lib/roles';
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
import { CoachCard, CoachEyebrow, CoachChip } from '@/components/coaches/kit';
import LoadingState from '@/components/shared/LoadingState';
import PageNotice, { useNotice, type Notice } from '@/components/shared/PageNotice';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import PlanMoveDialog, { CONTACT_HREF } from './PlanMoveDialog';
import FreeTimeBand from './FreeTimeBand';
import PlanArticlePanel from './PlanArticlePanel';
import StripeFeesList from './StripeFeesList';
import PaymentsEndingSection, { moveDateLong } from './PaymentsEndingSection';
import styles from './Billing.module.css';

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
  const consumed = ['success', 'card_saved', 'next_season'].some(flag => query.has(flag));
  for (const flag of ['success', 'card_saved', 'next_season']) query.delete(flag);
  return { justChose, cardSaved, detail, notice, consumed, destination: `${billingBase}${query.size ? `?${query}` : ''}` };
}
type Action = {
  busy: string | null; cycle: BillingCycle; setCycle: (value: BillingCycle) => void;
  portal: () => void; card: () => void; reactivate: () => void; keep: () => void; cancel: () => void;
  change: (change: BillingPlanChange<string>) => void; details: (key: string) => void;
  choose: (key: string, cycle: BillingCycle) => void; retry: () => void;
};
export type BillingBodyViewProps = {
  snapshot: BillingSnapshot; profile: PlanBillingProfile<string>; ownProfile: PlanBillingProfile<string>;
  profiles?: Registry; actions: Action; notice?: Notice | null; justChose?: boolean;
  cardWindowOpen?: boolean; foundingActive?: boolean; fees?: ReactNode;
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

/** The actual billing presentation, also rendered by the isolated profile fixtures. No portal chrome or providers. */
export function BillingBodyView({ snapshot: s, profile, ownProfile, profiles = PLAN_BILLING_PROFILES, actions: a,
  notice, justChose = false, cardWindowOpen = false, foundingActive = false, fees,
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
  const cancelled = org.subscriptionStatus === 'canceled' && !portal && !staffFree;
  const controlsReady = s.freeTime.status === 'ready' && (cancelled || endedPortal || !profile.showFoundingSeason || s.founding.status === 'ready');
  const founding = profile.showFoundingSeason && !staffFree && Boolean(fd?.isFoundingSeason);
  const comp = founding && foundingActive;
  const paid = ownProfile.config.monthlyPrice > 0;
  const preflight = s.cancellation.status === 'ready' ? s.cancellation.data : null;
  const scheduled = s.move.status === 'ready' ? s.move.data.scheduledMove : null;
  const price = freeCard?.price ?? (comp ? W.founding.price : profile.config.monthlyPrice === 0 ? W.plan.free
    : W.plan.price(org.subscriptionPeriod === 'annual' ? profile.config.annualPrice : profile.config.monthlyPrice, org.subscriptionPeriod ?? 'monthly'));
  const disabled = a.busy !== null;
  const premium = ownProfile.cancellationKind === 'premium';
  const keepPremium = portal ? <CoachCard className={styles.keepPremiumCard}>
    <h2 className={styles.sectionTitle}>{W.change.keepPremium}</h2><p className={styles.hint}>{W.change.keepPremiumHelp}</p>
    <a href={`${teamWorkspaceReactivatePath(org)}&keep=1`} className={`btn btn-lime ${styles.keepPremiumButton}`} id="billing-keep-premium">{W.change.keepPremium}</a>
  </CoachCard> : null;
  const joinClub = profile.joinClub ? <CoachCard className={styles.invitation}>
    <h3 className={styles.sectionTitle}>{W.change.clubTitle}</h3><p className={styles.hint}>{W.change.clubBody}</p>
    <a href={`/${org.slug}/coaches/link-org`} className={`btn ${portal ? 'btn-outline' : 'btn-lime'}`}>{W.change.joinClub}</a>
  </CoachCard> : null;

  const retry = <button type="button" className="btn btn-outline" onClick={a.retry} disabled={disabled}>{W.errors.retry}</button>;
  // A failed grant read cannot distinguish an actual cancellation from staff free time.
  // Offer help without asserting cancellation, renewal, a price, or a retention clock.
  if (s.freeTime.status === 'error') return <div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    <CoachCard className={styles.planCard}>
      <CoachEyebrow chip={<CoachChip tone="warn">{W.plan.unavailable}</CoachChip>}>{W.page.sections.plan}</CoachEyebrow>
      <h2 className={styles.planName}>{profile.config.label}</h2>
      <ReadFailure read={s.freeTime} section="free time" />
      <div className={styles.planActions}>{retry}<a href={CONTACT_HREF} className="btn btn-outline">{W.change.contact}</a></div>
    </CoachCard>
    {fees}
  </div>;

  const readRecovery = [s.usage, s.founding, s.gating, s.cancellation, s.move].some(read => read.status === 'error') ? retry : null;

  if (endedPortal && controlsReady) return <div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    <CoachCard className={styles.planCard}>
      <CoachEyebrow>{portalCopy!.band.eyebrow}</CoachEyebrow>
      <h2 className={styles.planName}>{profile.config.label}</h2>
      <p className={styles.planPrice}>{W.plan.free}</p>
    </CoachCard>
    <FreeTimeBand band={portalCopy!.band} />
    {readRecovery}
    {keepPremium}{joinClub}{fees}
  </div>;

  if (cancelled && controlsReady) {
    const until = preflight?.cancelled?.keptUntil ?? null;
    const modules = new Set<string>([...ownProfile.config.moduleEntitlements, ...org.enabledAddons]);
    return <div className={styles.body}>
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
                <select className={styles.select} value={a.cycle} onChange={e => a.setCycle(e.target.value as BillingCycle)}>
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
    </div>;
  }

  const usage = s.usage.status === 'ready' ? s.usage.data : null;
  const changeKeys = Object.keys(profiles).filter(key => key === ownProfile.key || ownProfile.changes.some(change => change.target === key));
  const choice = founding ? fd?.nextSeason ?? null : null;
  const card = fd ? W.founding.formatCard(fd.card ?? null) : null;
  const nextPlans = nextSeasonPlanOptions(ownProfile.key as OrgPlan);
  const chosen = choice ? profiles[choice.planKey] : null;
  const chosenCycle = choice?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const endingContact = !portal && ft?.freeTime?.state === 'ending' && sale(ft.freeTime.plan);
  return <div className={styles.body}>
    {notice && <PageNotice notice={notice} />}
    {readRecovery}
    {org.subscriptionStatus === 'past_due' && <PageNotice notice={{ tone: 'bad', text: W.plan.pastDue }} />}
    <CoachCard className={styles.planCard}>
      <div className={styles.planGrid}>
        <div className={styles.planSide}>
          <CoachEyebrow chip={<CoachChip tone={staffFree ? band?.tone === 'amber' ? 'warn' : 'good' : org.subscriptionStatus === 'canceled' ? 'danger' : org.subscriptionStatus === 'past_due' ? 'warn' : 'good'}>{portalCopy?.band.eyebrow ?? (staffFree ? freeCopy?.band.eyebrow : W.plan.status(org.subscriptionStatus))}</CoachChip>}>{W.page.sections.plan}</CoachEyebrow>
          <h2 className={styles.planName}>{profile.config.label}</h2>
          {s.freeTime.status === 'loading' ? <LoadingState inline label={W.page.loading} /> : <p className={styles.planPrice}>{price}</p>}
          {freeCard && <p className={styles.hint}>{freeCard.from}</p>}
          {comp && <p className={styles.hint}>{W.founding.priceHelp(profile.config.annualPrice)}</p>}
          {controlsReady && ownBilling && !cancelled && !comp && org.currentPeriodEnd && <p className={styles.hint}>{org.subscriptionStatus === 'trialing' ? W.plan.trialEnds(org.currentPeriodEnd) : W.plan.renews(org.currentPeriodEnd)}</p>}
          {ownBilling && scheduled && <p className={styles.scheduled}>{W.plan.scheduled(profiles[scheduled.toPlan].config.label, scheduled.effectiveAt)} <button type="button" className={styles.link} disabled={disabled} onClick={a.keep}>{W.plan.keep(ownProfile.config.label)}</button></p>}
          {controlsReady && paid && !staffFree && !endedPortal && !founding && <div className={styles.planActions}>
            <button type="button" className="btn btn-outline" id="billing-manage-btn" onClick={a.portal} disabled={disabled}><CreditCard size={14} aria-hidden />{a.busy === 'portal' ? W.plan.openingPortal : W.plan.payment}</button>
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
                    {larger && sale(larger.target) && controlsReady ? <button type="button" className={styles.link} onClick={() => a.change(larger)} disabled={disabled}>{W.change.move(profiles[larger.target].config.label)}</button> : <a href={CONTACT_HREF} className={styles.link}>{W.change.contact}</a>}
                  </p>;
                })()}
              </>}
            </div>;
          })}
          {portal && <p className={styles.hint}>{W.change.hostingExcluded}</p>}
        </div>
      </div>
    </CoachCard>
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
    {(ownBilling && ownProfile.changes.length > 0 || profile.joinClub) && <Section id="billing-change" title={W.page.sections.change}>
      {ownBilling && ownProfile.changes.length > 0 && <>
        {controlsReady && ownProfile.changes.some(change => change.mechanism === 'checkout' && sale(change.target)) && <div className={styles.planActions}>
          <label className={styles.cycleField}><span className={styles.srOnly}>{W.plan.billing}</span>
            <select className={styles.select} value={a.cycle} disabled={disabled} onChange={e => a.setCycle(e.target.value as BillingCycle)}>
              <option value="monthly">{W.plan.monthly}</option><option value="annual">{W.plan.annual}</option>
            </select>
          </label>
        </div>}
        <div className={styles.tableFrame}><table className={styles.table}>
          <thead><tr><th scope="col">{W.change.headings.plan}</th><th scope="col">{W.change.headings.holds}</th><th scope="col" className={styles.num}>{W.change.headings.monthly}</th><th scope="col" className={styles.num}>{W.change.headings.annual}</th><th scope="col"><span className={styles.srOnly}>{W.change.headings.choice}</span></th></tr></thead>
          <tbody>{changeKeys.map(key => {
            const target = profiles[key];
            const change = ownProfile.changes.find(c => c.target === key);
            return <tr key={key}>
              <td data-label={W.change.headings.plan}><strong>{target.config.label}</strong>{key !== ownProfile.key && <button type="button" className={`${styles.link} ${styles.details}`} onClick={() => a.details(key)}>{W.change.details(target.config.label)}</button>}</td>
              <td data-label={W.change.headings.holds}>{target.usageMeters.includes('teams') ? W.change.upTo(target.config.teamLimit) : W.change.tournamentLimit(target.config.tournamentLimit)}</td>
              <td data-label={W.change.headings.monthly} className={styles.num}>{target.config.monthlyPrice === 0 ? W.plan.free : formatPriceAmount(target.config.monthlyPrice)}</td>
              <td data-label={W.change.headings.annual} className={styles.num}>{target.config.annualPrice === 0 ? W.plan.free : formatPriceAmount(target.config.annualPrice)}</td>
              <td data-label={W.change.headings.choice}>{key === ownProfile.key ? <CoachChip tone="good">{W.change.current}</CoachChip>
                : scheduled?.toPlan === key ? <CoachChip tone="warn">{W.plan.scheduledFrom(scheduled.effectiveAt)}</CoachChip>
                  // A Founding Season comp has no subscription to reduce; the old page hid the downgrade with Cancel.
                  : founding && change?.mechanism === 'downgrade' ? null
                  : controlsReady && change && (change.mechanism === 'downgrade' || sale(key)) ? <button type="button" className="btn btn-outline" onClick={() => a.change(change)} disabled={disabled}>{change.mechanism === 'downgrade' ? W.change.downgrade(target.config.label) : change.mechanism === 'checkout' ? W.change.upgrade(target.config.label) : W.change.move(target.config.label)}</button>
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
    {controlsReady && paid && ownBilling && !founding && <Section id="billing-cancel" title={W.page.sections.cancel}>
      {preflight ? <>
        <p className={styles.cancelCopy}>{premium ? W.cancel.premiumBody(preflight.retentionDays) : W.cancel.orgBody(org.name, preflight.shortShutsDown, preflight.retentionDays)}</p>
        <button type="button" className={`btn btn-outline ${styles.dangerText}`} id="billing-cancel-btn" onClick={a.cancel} disabled={disabled}>{premium ? W.cancel.premiumDoor : W.cancel.orgDoor(org.name)}</button>
      </> : s.cancellation.status === 'loading' ? <LoadingState inline label="Loading cancellation details…" /> : <ReadFailure read={s.cancellation} section="cancellation details" />}
    </Section>}
    {profile.discoveryPlans && <Section id="billing-discovery" title={W.shelf.title}>
      <p className={styles.hint}>{W.shelf.withCoach}</p>
      <div className={styles.discovery}>{profile.discoveryPlans.map(key => <div key={key}>
        <h3 className={styles.sectionTitle}>{profiles[key].config.label}</h3><p className={styles.hint}>{W.plan.fromPrice(profiles[key].config.monthlyPrice)}</p>
        <button type="button" className={styles.link} onClick={() => a.details(key)}>{W.change.details(profiles[key].config.label)}</button>
        {profiles[key].cancellationKind === 'premium' && s.gating.status !== 'loading' && (sale(key) ? <a href={COACHES_START_PATH} className="btn btn-outline">{W.shelf.startCoach}</a> : <a href={CONTACT_HREF} className={styles.link}>{W.change.contact}</a>)}
      </div>)}</div>
    </Section>}
  </div>;
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
  const { currentOrg, userRole, userCapabilities, loading, refresh } = useOrg();
  if (loading || !currentOrg || !userRole) return <LoadingState label={W.page.loading} />;
  // No billing reads mount without billing access, including free-time and cancelled states.
  if (!hasCapability(userRole, userCapabilities, 'billing')) return <LockedCard orgName={currentOrg.name} />;
  return <BillingOwnerBody key={currentOrg.id} org={currentOrg} refresh={refresh} billingBase={billingBase} teamsHref={teamsHref} />;
}

function BillingOwnerBody({ org, refresh, billingBase, teamsHref }: { org: Organization; refresh: () => Promise<void>; billingBase: string; teamsHref: string }) {
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
  const [review, setReview] = useState<{ kind: 'cancel'; data: BillingCancellation } | { kind: 'downgrade'; read: BillingRead<BillingDowngrade> } | null>(null);
  const [reason, setReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const leaving = useRef(false);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const scope = `orgSlug=${encodeURIComponent(org.slug)}`;
  const version = `${org.planId}:${ownProfile.key}:${org.subscriptionStatus}:${revision}`;
  const usage = useBillingRead<BillingUsage>(`/api/billing/usage?${scope}`, version);
  const freeTime = useBillingRead<BillingFreeTime>(`/api/admin/org/free-time?${scope}&billing=1`, version);
  const founding = useBillingRead<BillingFounding>(profile.showFoundingSeason ? `/api/admin/org/founding-season-status?${scope}` : null, version);
  const gating = useBillingRead<Partial<Record<OrgPlan, boolean>>>('/api/plan-gating', version);
  const cancellation = useBillingRead<BillingCancellation>(`/api/billing/cancel/preflight?${scope}`, version);
  const move = useBillingRead<BillingMove>(ownProfile.changes.some(c => c.mechanism === 'move') && org.subscriptionStatus !== 'canceled' ? `/api/billing/move?${scope}` : null, version);
  const reload = useCallback(async () => {
    try { await refresh(); }
    finally { if (live.current) setRevision(n => n + 1); }
  }, [refresh]);
  // The money operation has succeeded. A context-refresh failure must not recast it as a failed payment.
  const reloadAfterAction = () => { void reload().catch(() => {}); };
  const retryReads = useCallback(() => {
    void reload().catch(() => { if (live.current) setNotice({ tone: 'bad', text: W.errors.refresh }); });
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
    if (!response.ok) throw new Error(data.error ?? W.errors.generic);
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
  async function checkout(target: OrgPlan) {
    await run('checkout', async () => {
      const result = await post('/api/billing/create-checkout', { planKey: target, billingCycle: cycle, returnTo: billingBase });
      if (!live.current) return;
      if (result.applied) { setNotice({ tone: 'good', text: W.notice.updated(PLAN_BILLING_PROFILES[target].config.label, result.restoredCount, result.remainingRetainedCount) }); reloadAfterAction(); }
      else if (result.url) leave(result.url);
      else throw new Error(W.errors.checkout);
    });
  }
  async function openDowngrade(target: OrgPlan) {
    if (busyRef.current) return;
    setReason(''); setReviewError(null); setKeepIds([]); setReview({ kind: 'downgrade', read: { status: 'loading' } });
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
  const actions: Action = {
    busy, cycle, setCycle, retry: retryReads,
    portal: () => void run('portal', async () => { const result = await post('/api/billing/portal', { returnTo: billingBase }); if (result.url) leave(result.url); else if (live.current) throw new Error(W.errors.portal); }),
    card: () => void run('card', async () => { const result = await post('/api/billing/setup-payment-method', { returnTo: billingBase }); if (result.url) leave(result.url); else if (live.current) throw new Error(W.errors.card); }),
    reactivate: () => void checkout(ownProfile.key),
    keep: () => void run('keep', async () => { await post(`/api/billing/move?${scope}`, {}, 'DELETE'); if (live.current) { setNotice({ tone: 'good', text: W.plan.kept(org.name, ownProfile.config.label) }); reloadAfterAction(); } }),
    cancel: () => { if (cancellation.status === 'ready') { setReason(''); setReviewError(null); setReview({ kind: 'cancel', data: cancellation.data }); } },
    change: change => { if (change.mechanism === 'move') setMoveTo(change.target as OrgPlan); else if (change.mechanism === 'downgrade') void openDowngrade(change.target as OrgPlan); else void checkout(change.target as OrgPlan); },
    details: setDetail,
    choose: (key, billingCycle) => void run('choose', async () => {
      const result = await post('/api/billing/choose-next-season', { planKey: key, billingCycle, returnTo: billingBase });
      if (!live.current) return;
      if (result.applied || result.url) { choiceRetries.current = 0; setJustChose(true); }
      if (result.applied) { setNotice({ tone: 'good', text: W.notice.nextSeason }); reloadAfterAction(); }
      else if (result.url) leave(result.url); else throw new Error(W.errors.nextSeason);
    }),
  };
  const downgrade = review?.kind === 'downgrade' && review.read.status === 'ready' ? review.read.data : null;
  const cancel = review?.kind === 'cancel' ? review.data : null;
  const target = downgrade ? PLAN_BILLING_PROFILES[downgrade.targetPlan] : null;
  const premium = ownProfile.cancellationKind === 'premium';
  const closeReview = () => setReview(null);
  const details = detail ? PLAN_BILLING_PROFILES[detail as OrgPlan] : null;
  const published = detail && detail in PLAN_ARTICLE_CONTENT ? detail as PanelPlanKey : null;
  async function confirmReview() {
    if (!cancel && !downgrade) return;
    await run('confirm', async () => {
    setReviewError(null);
    // org-slug-ok: post() adds orgSlug to every body
    const result = cancel ? await post('/api/billing/cancel/confirm', { reason }) : await post('/api/billing/downgrade/confirm', { targetPlan: downgrade!.targetPlan, keepTournamentIds: keepIds, reason });
      if (!live.current) return;
      setReview(null);
      setNotice({ tone: 'good', text: cancel ? premium ? W.notice.premiumCancelled(cancel.retentionDays) : W.notice.cancelled(org.name, cancel.retentionDays)
        : W.notice.downgraded(target!.config.label, result.retainedCount ?? 0, downgrade!.retentionDays) });
      reloadAfterAction();
    });
  }
  return <>
    <BillingBodyView snapshot={{ org, canManageBilling: true, usage, freeTime, founding, gating, cancellation, move }} profile={profile} ownProfile={ownProfile} actions={actions} notice={notice} justChose={justChose} cardWindowOpen={isFoundingSeasonCardWindowOpen()} foundingActive={isFoundingSeasonActive()} fees={<StripeFeesList key={org.id} slug={org.slug} />} />
    {moveTo && <PlanMoveDialog key={`${org.id}:${moveTo}`} org={{ ...org, planId: ownProfile.key }} toPlan={moveTo} returnTo={billingBase} teamsHref={teamsHref} onClose={() => setMoveTo(null)} onMoved={text => { if (live.current) { setMoveTo(null); setNotice({ tone: 'good', text }); reloadAfterAction(); } }} />}
    {details && <PlanArticlePanel planKey={published} profile={details} readOnly billingCycle={cycle} onClose={() => setDetail(null)} onUpgrade={() => {}} upgradeLoading={null} isComingSoon={gating.status === 'ready' && gating.data[details.key] !== false} canUpgrade={false} foundingOfferHeld={false} />}
    {review && <KitDialog kind="form" title={review.kind === 'cancel' ? premium ? W.cancel.premiumTitle : W.cancel.orgTitle(org.name) : target ? W.downgrade.title(target.config.label) : W.page.sections.change} onClose={closeReview} busy={busy !== null} dirty={reason.trim().length > 0 || Boolean(downgrade?.requiresTournamentChoice && keepIds.length)}
      footerStart={cancel || downgrade ? W.cancel.footer((cancel ?? downgrade)!.retentionDays) : undefined}
      footer={<><DialogCancel>{premium && cancel ? W.change.keepPremium : W.plan.keep(ownProfile.config.label)}</DialogCancel>
        {(cancel || downgrade) && <button type="button" className={cancel ? 'btn btn-danger' : 'btn btn-lime'} onClick={() => void confirmReview()} disabled={busy !== null || Boolean(downgrade?.requiresTournamentChoice && keepIds.length !== downgrade.allowedKeepCount)}>{busy === 'confirm' ? W.downgrade.applying : cancel ? premium ? W.cancel.premiumConfirm : W.cancel.confirm : W.downgrade.confirm(target!.config.label)}</button>}</>}
    >
      <DialogReason className={styles.dangerText}>{reviewError}</DialogReason>
      {review.kind === 'downgrade' && review.read.status === 'loading' && <LoadingState inline label="Loading plan-change review…" />}
      {review.kind === 'downgrade' && review.read.status === 'error' && <PageNotice notice={{ tone: 'bad', text: review.read.error }} />}
      {cancel && <>
        <PageNotice notice={{ tone: 'bad', text: premium ? W.cancel.premiumWarning(cancel.retentionDays) : W.cancel.orgWarning(org.name, cancel.shortShutsDown) }} />
        <p>{W.cancel.retained(cancel.retentionDays)}</p><p>{premium ? W.cancel.premiumRetained(cancel.retentionDays) : W.cancel.archived(cancel.tournaments.length)}</p>
        <h3 className={styles.sectionTitle}>{premium ? W.cancel.premiumOfflineHeading : W.cancel.offlineHeading}</h3>
        <ul>{cancel.shutsDown.map(line => <li key={line}>{line}</li>)}</ul>
        <PaymentsEndingSection section={cancel.onlinePayments} ending={{ kind: 'cancel' }} />
      </>}
      {downgrade && target && <>
        <p>{W.downgrade.capacity(downgrade.targetTournamentLimit)}</p><p>{W.downgrade.inUse(downgrade.activeTournamentCount)}</p>
        <p>{W.downgrade.lost(target.config.label, ownProfile.config.label, ownProfile.downgradeLosses ?? [])}</p>
        <p>{downgrade.requiresTournamentChoice ? W.downgrade.choose(downgrade.allowedKeepCount, downgrade.retentionDays) : W.downgrade.fits}</p>
        {downgrade.requiresTournamentChoice && <ul className={styles.choices}>{downgrade.tournaments.map(tournament => <li key={tournament.id}><label><input type="checkbox" checked={keepIds.includes(tournament.id)} onChange={event => setKeepIds(ids => event.target.checked ? [...ids, tournament.id] : ids.filter(id => id !== tournament.id))} />{tournament.name}</label></li>)}</ul>}
        <PaymentsEndingSection section={downgrade.onlinePayments} ending={{ kind: 'move', dateLong: moveDateLong(null) }} />
      </>}
      {(cancel || downgrade) && <div className={styles.field}>
        <label className={styles.label} htmlFor="billing-reason">{cancel ? W.cancel.reason : W.downgrade.reason}</label>
        <textarea id="billing-reason" className={styles.textarea} rows={3} value={reason} onChange={event => setReason(event.target.value)} />
        <p className={styles.hint}>{cancel ? W.cancel.reasonHelp : W.downgrade.reasonHelp}</p>
      </div>}
    </KitDialog>}
  </>;
}
