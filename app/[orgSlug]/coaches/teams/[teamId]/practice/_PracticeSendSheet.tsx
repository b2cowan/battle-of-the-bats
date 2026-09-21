'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import {
  AUDIENCE_LABEL, FIELD_KINDS, MAX_CHOSEN_RECIPIENTS, PRACTICE_PLAN_AUDIENCES, PRACTICE_PLAN_GROUP_AUDIENCES, mineTagIdsOf, myLabelsOnPlan,
  practicePlanRecipients, practicePlanSentMessage, sanitizeChosenUserIds,
  type PracticeStaffPerson,
} from '@/lib/practice-plan-send';
import type { PickableTag } from '@/components/coaches/TagPicker';
import type { PracticePlan, PracticePlanSendAudience } from '@/lib/types';
import styles from '../../../coaches.module.css';

/**
 * "Send to staff" — the sheet (COACH_PRACTICE_WHO_RUNS_IT, owner rulings A–K 2026-09-17).
 *
 * ⚠ THE SEND IS AN EXPLICIT ACT because the plan autosaves and has no "done" (F04): this sheet
 * asks one thing — who — and shows the answer BY NAME before Send, so a treasurer never hides
 * inside a count. The three group audiences are the same rule the route dispatches with
 * (`practicePlanRecipients`), so the number the coach read is the number that goes.
 *
 * ⚠ "Named in this plan" is the reason the staff tags can be people (mig 303): it reaches exactly
 * the linked people on any block or station, and names the words that are nobody — "Adam — a name
 * only, not sent" — so an outside instructor never looks like a delivery.
 *
 * "Just these people" (owner ask, 2026-09-20 — "sometimes they send to one assistant to review
 * and update before sending to the broader group"): a fourth option whose list the coach ticks
 * — everyone the send could reach, name and role word, so the one assistant is one tick. The
 * same two rules stand (never the sender, never someone without schedule access): the checklist
 * is built from them, and the route reads the ticked ids through them again.
 *
 * ⚠ A hand-pick is NEVER the next default (ruling B, read for the workflow it serves): the sheet
 * remembers the team's last GROUP choice, and the names last ticked wait pre-ticked inside
 * "Just these people" — so "Jen first, then the coaches" is one tick on Monday and none on
 * Tuesday, and a habit press can never send the group's plan to Jen alone.
 *
 * ⚠ "Also email them" (owner ask, ruling J): the coach's OWN email, sent whatever the person's
 * notification settings say and whether or not their account is paused — a colleague addressing
 * colleagues, on the dues-reminder / @mention ground. Off by default; the sheet remembers the
 * team's last choice with the audience (ruling B).
 */
export type SendSheetChoice = { audience: PracticePlanSendAudience; email: boolean; userIds?: string[] };

/** What this browser keeps for the team: the last GROUP sent (the default), the email tick, and
 *  the names last hand-picked (pre-ticked, never the default). */
type RememberedChoice = { audience: Exclude<PracticePlanSendAudience, 'chosen'> | null; email: boolean; chosen: string[] };

/** Where the team's last choice is remembered — this browser, this team. */
export function sendChoiceKey(teamId: string): string {
  return `coach-practice-send.${teamId}`;
}

export function readSendChoice(teamId: string): RememberedChoice | null {
  try {
    const raw = localStorage.getItem(sendChoiceKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedChoice>;
    const audience = PRACTICE_PLAN_GROUP_AUDIENCES.find(a => a === parsed.audience) ?? null;
    return { audience, email: parsed.email === true, chosen: sanitizeChosenUserIds(parsed.chosen) };
  } catch {
    return null;
  }
}

export default function PracticeSendSheet({
  teamId, people, staffTags, plan, viewerUserId, message, onSend, onClose,
}: {
  teamId: string;
  people: readonly PracticeStaffPerson[];
  staffTags: readonly PickableTag[];
  plan: PracticePlan | null;
  viewerUserId: string;
  /** The message's fixed parts, from the page's own clock labels — the preview reads as one person will. */
  message: { dayLabel: string; startLabel: string; arriveLabel: string | null };
  onSend: (choice: SendSheetChoice) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const remembered = useMemo(() => readSendChoice(teamId), [teamId]);
  const ctx = useMemo(() => ({ senderUserId: viewerUserId, plan, staffTags }), [viewerUserId, plan, staffTags]);
  const byGroup = useMemo(
    () => Object.fromEntries(PRACTICE_PLAN_GROUP_AUDIENCES.map(a => [a, practicePlanRecipients(people, a, ctx)])) as
      Record<Exclude<PracticePlanSendAudience, 'chosen'>, ReturnType<typeof practicePlanRecipients>>,
    [people, ctx],
  );
  // The checklist: everyone a send could reach — "Everyone on staff" IS that set, by the two rules.
  const reachable = byGroup.staff.recipients;
  // Ruling B: "Named in this plan" whenever it reaches anyone, else "Coaches and helpers"; after
  // the first send the team's last GROUP choice wins. A hand-pick is never the default.
  const [audience, setAudience] = useState<PracticePlanSendAudience>(() => {
    // The remembered choice only when it still reaches someone — a staff that changed since must
    // not open the sheet on a dead end.
    const kept = remembered?.audience;
    if (kept && byGroup[kept].recipients.length > 0) return kept;
    return byGroup.named.recipients.length > 0 ? 'named' : 'coaches';
  });
  // The names last ticked, pre-ticked — only those still reachable.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => {
    const ids = new Set(reachable.map(p => p.userId));
    return new Set((remembered?.chosen ?? []).filter(id => ids.has(id)));
  });
  const [email, setEmail] = useState(remembered?.email ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });

  // Radios, so the arrow keys move between the four and Space picks — the first is focused on
  // open by the floor's rule (nothing inside took focus), then Tab reaches the list, Also email
  // and Send.
  const firstRadio = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRadio.current?.focus(); }, []);

  const chosen = useMemo(
    () => practicePlanRecipients(people, 'chosen', { ...ctx, chosenUserIds: [...picked] }),
    [people, ctx, picked],
  );
  const recipientsOf = (a: PracticePlanSendAudience) => (a === 'chosen' ? chosen : byGroup[a]);
  const current = recipientsOf(audience);
  const count = current.recipients.length;
  // "Named" reaches nobody: say which nobody — the sender is the only linked person on the plan
  // (the probe's own case), or no word on the plan is a person yet.
  const onlyMeNamed = byGroup.named.senderOnPlan;

  // The preview is ONE recipient's real message — the first in the audience — never a template.
  const preview = useMemo(() => {
    const first = current.recipients[0];
    if (!first) return null;
    return { name: first.name, ...practicePlanSentMessage({ ...message, myLabels: myLabelsOnPlan(plan, mineTagIdsOf(first)) }) };
  }, [current, plan, message]);

  const toggle = (userId: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });

  async function submit() {
    if (busy || count === 0) return;
    const userIds = audience === 'chosen' ? current.recipients.map(r => r.userId) : undefined;
    // The route caps a hand-pick and would send the first N without a word — the number the coach
    // read must be the number that goes, so past the cap the sheet refuses here (/review, 2026-09-20).
    if (userIds && userIds.length > MAX_CHOSEN_RECIPIENTS) {
      setError(`That's more than ${MAX_CHOSEN_RECIPIENTS} people — send to a group instead.`);
      return;
    }
    setBusy(true); setError('');
    const result = await onSend({ audience, email, userIds });
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not send the plan.'); return; }
    // The group stays the default; a hand-pick only refreshes the names that wait pre-ticked.
    const next: RememberedChoice = {
      audience: audience === 'chosen' ? (remembered?.audience ?? null) : audience,
      email,
      chosen: userIds ?? remembered?.chosen ?? [],
    };
    try { localStorage.setItem(sendChoiceKey(teamId), JSON.stringify(next)); } catch { /* a remembered choice is a convenience */ }
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Send to staff"
        aria-busy={busy || undefined} className={`${styles.modal} ${styles.modalScrollBody}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Send to staff</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.ppDrillWrite}>
          <p className={styles.formHint}>
            A bell and a push, with a link to this plan. Never you; never someone whose access
            doesn&rsquo;t include the schedule.
          </p>

          <fieldset className={styles.ppSendAudiences}>
            <legend className="sr-only">Who</legend>
            {PRACTICE_PLAN_AUDIENCES.map((a, i) => {
              const r = recipientsOf(a);
              // "Everyone" names the off-field kinds by their kind, so a treasurer never hides in the list.
              const names = r.recipients.map(p => (a === 'staff' && !FIELD_KINDS.has(p.kind)) ? `${p.name} (${p.kindWord.toLowerCase()})` : p.name);
              const on = audience === a;
              return (
                <div key={a}>
                  <label className={styles.ppSendAudience} data-on={on ? 'on' : undefined}>
                    <input ref={i === 0 ? firstRadio : undefined} type="radio" name="audience" value={a}
                      checked={on} onChange={() => setAudience(a)} disabled={busy} />
                    <span className={styles.ppSendAudienceName}>
                      {AUDIENCE_LABEL[a]} <span className={styles.ppSendAudienceCount}>{r.recipients.length}</span>
                    </span>
                    <span className={styles.ppSendAudienceWho}>
                      {a === 'chosen'
                        ? (reachable.length === 0
                          ? 'Nobody on the staff who can open the plan.'
                          : names.length > 0 ? names.join(' · ') : 'Tick the names yourself — one assistant to read it over before the group gets it.')
                        : names.length > 0
                          ? names.join(' · ')
                          : a === 'named'
                            ? onlyMeNamed
                              ? 'Only you are linked on this plan so far.'
                              : 'Nobody on this plan is linked to a person yet — Manage staff… on a Staff field links a name to someone.'
                            : 'Nobody on the staff who can open the plan.'}
                    </span>
                    {a === 'named' && r.unlinkedNames.length > 0 && (
                      <span className={styles.ppSendAudienceOnly}>
                        {r.unlinkedNames.join(' · ')} — {r.unlinkedNames.length === 1 ? 'a name only' : 'names only'}, not sent
                      </span>
                    )}
                  </label>
                  {/* The checklist — a sibling of the radio's label, not a child (see the CSS note).
                      Everyone reachable, in staff order, role word beside each; the radio's own
                      line above reads the ticked names back. */}
                  {a === 'chosen' && on && reachable.length > 0 && (
                    <div className={styles.ppSendPick} role="group" aria-label="Just these people">
                      {reachable.map(p => {
                        const ticked = picked.has(p.userId);
                        return (
                          <label key={p.userId} className={styles.ppSendPickRow} data-on={ticked ? 'on' : undefined}>
                            <input type="checkbox" checked={ticked} disabled={busy} onChange={() => toggle(p.userId)} />
                            <span>{p.name}</span>
                            <small>{p.kindWord}</small>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          <label className={styles.ppSendEmail} data-on={email ? 'on' : undefined}>
            <input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} disabled={busy} />
            <span className={styles.ppSendAudienceName}>Also email them</span>
            <span className={styles.ppSendAudienceWho}>
              An email from you with the outline and their stations, whatever their notification settings.
            </span>
          </label>

          {preview && (
            <div className={styles.ppSendPreview}>
              <span className={styles.ppSendPreviewLabel}>As {preview.name} will read it</span>
              <b>{preview.title}</b>
              <p>{preview.body}</p>
            </div>
          )}

          {error && <p className={styles.errorText} role="alert">{error}</p>}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button type="button" className={styles.btnPrimary} disabled={busy || count === 0} onClick={submit}>
              {busy ? 'Sending…' : count === 0 ? (audience === 'chosen' && reachable.length > 0 ? 'Tick someone' : 'Nobody to send to') : `Send to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
