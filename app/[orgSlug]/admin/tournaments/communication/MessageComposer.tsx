'use client';
/**
 * THE COMPOSER (Tournament admin redesign Stage 2, C2 — ruled 2026-09-30; A14 "build the picker", A15
 * "the count is the send's"). The kit's FORM window: full screen on a phone (← and the phone's Back
 * close it; a tap outside never throws a message away), a window at a desk. Top to bottom:
 *
 *   Start from — one dropdown ("A blank message", then the five templates: a form choice is a
 *                dropdown; the pill is the filter's shape alone). Free on every plan, as today.
 *   Title * · Message * — the plain asterisk in the label's own ink.
 *   Where it goes — a plain block (the tinted Channels panel retired), 22px boxes on 44px lines:
 *     Post to the public site → Pin it at the top → Show under (the division checklist; a lock line
 *       with the plan's name on the Tournament plan — the send refuses a division there, F43);
 *     Email the teams → on Tournament Plus the picker (Teams · Division · Payment) and a LIVE COUNT
 *       read from the send's own rule by a dry run, never a copy here; on the Tournament plan the
 *       count of accepted teams and the picker's lock line;
 *     Push to fans' phones (Tournament Plus; the lock line otherwise).
 *   The send button says the number the send will reach ("Post and email 18").
 *
 * The same window edits a site post (title, message, pin, Show under) and saves with a button, as
 * today's Edit Post did.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { repKit } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import PlanLockLine from '@/components/admin/tournament/PlanLockLine';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { SandboxLockNote, useSandboxLock } from '@/components/sandbox/SandboxLock';
import {
  COMMS_LOCK, COMMS_LOCK_PLAN, COMMS_WORDS, COMPOSER_WORDS as W, PAYMENT_CHOICES, TEAM_CHOICES, recipientCountLine, sendLabel,
} from '@/lib/communication-words';
import type { Division } from '@/lib/types';
import styles from './communication.module.css';

export const QUICK_TEMPLATES = [
  {
    label: 'Schedule is live',
    title: 'Schedule is live — {{tournament}}',
    body: 'Hi teams,\n\nThe schedule for {{tournament}} is now live. You can view game times, dates, and locations on the tournament site.\n\nSee you on the field!',
  },
  {
    label: 'Payment reminder',
    title: 'Reminder: Payment outstanding — {{tournament}}',
    body: 'Hi teams,\n\nThis is a friendly reminder that payment for {{tournament}} is still outstanding. Please arrange payment at your earliest convenience to secure your spot.\n\nThank you!',
  },
  {
    label: 'Weather update',
    title: '⚠️ Weather update — {{tournament}}',
    body: 'Hi teams,\n\nDue to weather conditions, we have an update regarding {{tournament}}. [Add details here.]\n\nWe will share further updates as soon as they are available. Thank you for your patience.',
  },
  {
    label: 'Welcome and info',
    title: 'Welcome to {{tournament}} — important info',
    body: 'Hi teams,\n\nWe are excited to welcome you to {{tournament}}! Here is some important information:\n\n• [Parking / venue info]\n• [Check-in instructions]\n• [Schedule link]\n\nSee you there!',
  },
  {
    label: 'Results are in',
    title: 'Final results are in — {{tournament}}',
    body: 'Hi teams,\n\nThe final results for {{tournament}} are now posted. Thank you to all teams and families for a great tournament!\n\n[Add any closing remarks here.]\n\nHope to see you next year!',
  },
] as const;

export type ComposerValues = {
  title: string; body: string; pinned: boolean;
  channelSite: boolean; channelEmail: boolean; channelPush: boolean;
  divisionIds: string[];
  teamChoice: string; divisionChoice: string; paymentChoice: string;
};

export type ComposerTargeting = { teamStatuses?: string[]; divisionIds?: string[]; paymentStatuses?: string[] } | null;

/** The picker's choices as the send's targeting — null for the basic send (every accepted team). */
export function targetingOf(v: Pick<ComposerValues, 'teamChoice' | 'divisionChoice' | 'paymentChoice'>, canTarget: boolean): ComposerTargeting {
  if (!canTarget) return null;
  const team = TEAM_CHOICES.find(c => c.value === v.teamChoice) ?? TEAM_CHOICES[0];
  const pay = PAYMENT_CHOICES.find(c => c.value === v.paymentChoice) ?? PAYMENT_CHOICES[0];
  const t: NonNullable<ComposerTargeting> = {};
  if (team.value !== 'accepted') t.teamStatuses = [...team.statuses];
  if (v.divisionChoice) t.divisionIds = [v.divisionChoice];
  if (pay.statuses.length) t.paymentStatuses = [...pay.statuses];
  return Object.keys(t).length ? t : null;
}

export default function MessageComposer({
  mode, values, onChange, divisions, tournamentId, tournamentName, orgQuery,
  canTarget, canPush, planHref, sending, error, onSubmit, onCancel, footerStart, emailPart, onTemplate,
}: {
  mode: 'new' | 'edit';
  values: ComposerValues;
  onChange: (patch: Partial<ComposerValues>) => void;
  /** A template's title and message — the page re-bases its unsaved-changes guard on them. */
  onTemplate: (patch: Pick<ComposerValues, 'title' | 'body'>) => void;
  divisions: Division[];
  tournamentId: string;
  tournamentName: string;
  orgQuery: string;
  /** Tournament Plus and above (`targeted_tournament_announcements`). */
  canTarget: boolean;
  /** `fan_score_alerts`. */
  canPush: boolean;
  planHref: string;
  sending: boolean;
  error: string | null;
  onSubmit: () => void;
  onCancel: () => void;
  /** A post's record: Remove from site / Restore to site, kept away from Save. */
  footerStart?: ReactNode;
  /** A post that was ALSO emailed is one record: its email's delivery sits inside (C1). */
  emailPart?: ReactNode;
}) {
  const [template, setTemplate] = useState('');
  // "See it live" sandbox: the send is disabled BEFORE it is pressed, with the honest line beneath
  // (SandboxLockNote). False for every real org.
  const sandboxLocked = useSandboxLock();
  // ── The live count: a dry run of the route's own rule, newest read only ──
  const [count, setCount] = useState<number | null>(null);
  const seq = useRef(0);
  const targeting = targetingOf(values, canTarget);
  const targetingKey = JSON.stringify(targeting);
  useEffect(() => {
    if (mode !== 'new' || !values.channelEmail) return;
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/communications${orgQuery}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'preview-recipients', data: { tournamentId, targeting: JSON.parse(targetingKey) } }),
        });
        const data = await res.json().catch(() => ({}));
        if (mine === seq.current) setCount(res.ok && typeof data.count === 'number' ? data.count : null);
      } catch {
        if (mine === seq.current) setCount(null);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [mode, values.channelEmail, targetingKey, tournamentId, orgQuery]);

  const applyTemplate = (label: string) => {
    setTemplate(label);
    const tpl = QUICK_TEMPLATES.find(x => x.label === label);
    if (!tpl) { onTemplate({ title: '', body: '' }); return; }
    onTemplate({ title: tpl.title.replace('{{tournament}}', tournamentName), body: tpl.body.replace(/{{tournament}}/g, tournamentName) });
  };

  const teamChoice = TEAM_CHOICES.find(c => c.value === values.teamChoice) ?? TEAM_CHOICES[0];
  const payChoice = PAYMENT_CHOICES.find(c => c.value === values.paymentChoice) ?? PAYMENT_CHOICES[0];
  const divisionName = values.divisionChoice ? divisions.find(d => d.id === values.divisionChoice)?.name ?? null : 'all divisions';
  const countLine = count == null ? null
    : canTarget ? recipientCountLine(count, teamChoice.phrase, payChoice.phrase, divisionName)
      : recipientCountLine(count, TEAM_CHOICES[0].phrase, '', null, false);
  const noChannel = !values.channelSite && !values.channelEmail && !values.channelPush;
  const label = mode === 'edit' ? W.saveChanges : sendLabel(values.channelSite, values.channelEmail, values.channelPush, values.channelEmail ? count : null);
  const blocked = mode === 'new' && values.channelEmail && count === 0;

  const toggleDivision = (id: string) => {
    const set = new Set(values.divisionIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ divisionIds: [...set] });
  };

  return (
    <KitDialog
      kind="form"
      title={mode === 'edit' ? 'Edit post' : COMMS_WORDS.newMessage}
      onClose={onCancel}
      busy={sending}
      footerStart={footerStart}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={sending}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={onSubmit}
            disabled={sandboxLocked || sending || noChannel || blocked || !values.title.trim() || !values.body.trim()}>
            {sending ? <><RefreshCw className="spin" size={15} aria-hidden /> {W.sending}</> : label}
          </button>
        </>
      )}
    >
      {mode === 'new' && (
        <label className={ck.field}>
          <span className={ck.label}>{W.startFrom}</span>
          <select className={ck.select} value={template} onChange={e => applyTemplate(e.target.value)}>
            <option value="">{W.blank}</option>
            {QUICK_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
        </label>
      )}
      <label className={ck.field}>
        <span className={ck.label}>{W.title}<span className={repKit.req} aria-hidden>*</span></span>
        <input className={ck.input} value={values.title} onChange={e => onChange({ title: e.target.value })}
          placeholder="e.g. Schedule is live — U14 Boys" required aria-required="true" />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>{W.message}<span className={repKit.req} aria-hidden>*</span></span>
        <textarea className={`${ck.textarea} ${styles.messageBox}`} value={values.body} onChange={e => onChange({ body: e.target.value })}
          placeholder="Write your message here…" required aria-required="true" rows={6} />
      </label>

      <div className={styles.where}>
        <h3 className={styles.whereHeading}>{mode === 'edit' ? W.postSite : W.whereItGoes}</h3>

        {/* Post to the public site */}
        {mode === 'new' && (
          <label className={styles.choice}>
            <input type="checkbox" className={screenParts.check22} checked={values.channelSite}
              onChange={e => onChange(e.target.checked ? { channelSite: true } : { channelSite: false, channelPush: false })} />
            <span className={styles.choiceText}><b>{W.postSite}</b><span>{W.postSiteHint}</span></span>
          </label>
        )}
        {values.channelSite && (
          <div className={styles.sub}>
            <label className={styles.choice}>
              <input type="checkbox" className={screenParts.check22} checked={values.pinned} onChange={e => onChange({ pinned: e.target.checked })} />
              <span className={styles.choiceText}><b>{W.pin}</b><span>{W.pinHint}</span></span>
            </label>
            {divisions.length > 0 && (canTarget ? (
              <fieldset className={styles.showUnder}>
                <legend className={ck.label}>{W.showUnder}</legend>
                <label className={styles.choiceTight}>
                  <input type="checkbox" className={screenParts.check22} checked={values.divisionIds.length === 0} onChange={() => onChange({ divisionIds: [] })} />
                  <span>{W.allDivisions}</span>
                </label>
                {divisions.map(d => (
                  <label key={d.id} className={`${styles.choiceTight} ${styles.indent}`}>
                    <input type="checkbox" className={screenParts.check22} checked={values.divisionIds.includes(d.id)} onChange={() => toggleDivision(d.id)} />
                    <span>{d.name}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <PlanLockLine href={planHref} plan={COMMS_LOCK_PLAN}>{COMMS_LOCK.showUnder}</PlanLockLine>
            ))}
          </div>
        )}

        {/* Email the teams */}
        {mode === 'new' && (
          <>
            <label className={styles.choice}>
              <input type="checkbox" className={screenParts.check22} checked={values.channelEmail} onChange={e => onChange({ channelEmail: e.target.checked })} />
              <span className={styles.choiceText}><b>{W.emailTeams}</b><span>{canTarget ? W.emailTeamsHint : W.emailAcceptedHint}</span></span>
            </label>
            {values.channelEmail && (
              <div className={styles.sub}>
                {canTarget && (
                  <div className={styles.picker}>
                    <label className={ck.field}>
                      <span className={ck.label}>{W.teams}</span>
                      <select className={ck.select} value={values.teamChoice} onChange={e => onChange({ teamChoice: e.target.value })}>
                        {TEAM_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className={ck.field}>
                      <span className={ck.label}>{W.division}</span>
                      <select className={ck.select} value={values.divisionChoice} onChange={e => onChange({ divisionChoice: e.target.value })}>
                        <option value="">{W.allDivisions}</option>
                        {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                    <label className={ck.field}>
                      <span className={ck.label}>{W.payment}</span>
                      <select className={ck.select} value={values.paymentChoice} onChange={e => onChange({ paymentChoice: e.target.value })}>
                        {PAYMENT_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                <p className={styles.count} aria-live="polite">{countLine ?? '…'}</p>
                {!canTarget && <PlanLockLine href={planHref} plan={COMMS_LOCK_PLAN}>{COMMS_LOCK.chooseTeams}</PlanLockLine>}
              </div>
            )}
          </>
        )}

        {/* Push to fans' phones */}
        {mode === 'new' && (canPush ? (
          <label className={styles.choice}>
            <input type="checkbox" className={screenParts.check22} checked={values.channelPush}
              onChange={e => onChange(e.target.checked ? { channelPush: true, channelSite: true } : { channelPush: false })} />
            <span className={styles.choiceText}>
              <b>{W.push}</b><span>{W.pushHint}</span>
              {/* Ticking it ticks "Post to the public site" too — say so, where the organizer is looking. */}
              {values.channelPush && <span>{W.pushPostsToo}</span>}
            </span>
          </label>
        ) : (
          <div className={styles.choiceLocked}>
            <span className={styles.choiceText}><b>{W.push}</b></span>
            <PlanLockLine href={planHref} plan={COMMS_LOCK_PLAN}>{COMMS_LOCK.pushFans}</PlanLockLine>
          </div>
        ))}
      </div>

      {emailPart}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SandboxLockNote />
    </KitDialog>
  );
}
