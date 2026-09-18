'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import {
  AUDIENCE_LABEL, FIELD_KINDS, PRACTICE_PLAN_AUDIENCES, mineTagIdsOf, myLabelsOnPlan, practicePlanRecipients, practicePlanSentMessage,
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
 * inside a count. The three audiences are the same rule the route dispatches with
 * (`practicePlanRecipients`), so the number the coach read is the number that goes.
 *
 * ⚠ "Named in this plan" is the reason the staff tags can be people (mig 303): it reaches exactly
 * the linked people on any block or station, and names the words that are nobody — "Adam — a name
 * only, not sent" — so an outside instructor never looks like a delivery.
 *
 * ⚠ "Also email them" (owner ask, ruling J): the coach's OWN email, sent whatever the person's
 * notification settings say and whether or not their account is paused — a colleague addressing
 * colleagues, on the dues-reminder / @mention ground. Off by default; the sheet remembers the
 * team's last choice with the audience (ruling B).
 */
export type SendSheetChoice = { audience: PracticePlanSendAudience; email: boolean };

/** Where the team's last choice is remembered — this browser, this team. */
export function sendChoiceKey(teamId: string): string {
  return `coach-practice-send.${teamId}`;
}

export function readSendChoice(teamId: string): SendSheetChoice | null {
  try {
    const raw = localStorage.getItem(sendChoiceKey(teamId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SendSheetChoice>;
    const audience = PRACTICE_PLAN_AUDIENCES.find(a => a === parsed.audience) ?? null;
    return audience ? { audience, email: parsed.email === true } : null;
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
  const byAudience = useMemo(
    () => Object.fromEntries(PRACTICE_PLAN_AUDIENCES.map(a => [a, practicePlanRecipients(people, a, ctx)])) as
      Record<PracticePlanSendAudience, ReturnType<typeof practicePlanRecipients>>,
    [people, ctx],
  );
  // Ruling B: "Named in this plan" whenever it reaches anyone, else "Coaches and helpers"; after
  // the first send the team's last choice wins.
  const [audience, setAudience] = useState<PracticePlanSendAudience>(() => {
    // The remembered choice only when it still reaches someone — a staff that changed since must
    // not open the sheet on a dead end.
    const kept = remembered?.audience;
    if (kept && byAudience[kept].recipients.length > 0) return kept;
    return byAudience.named.recipients.length > 0 ? 'named' : 'coaches';
  });
  const [email, setEmail] = useState(remembered?.email ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose, busy });

  // Radios, so the arrow keys move between the three and Space picks — the first is focused on
  // open by the floor's rule (nothing inside took focus), then Tab reaches Also email and Send.
  const firstRadio = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRadio.current?.focus(); }, []);

  const chosen = byAudience[audience];
  const count = chosen.recipients.length;
  // "Named" reaches nobody: say which nobody — the sender is the only linked person on the plan
  // (the probe's own case), or no word on the plan is a person yet.
  const onlyMeNamed = byAudience.named.senderOnPlan;

  // The preview is ONE recipient's real message — the first in the audience — never a template.
  const preview = useMemo(() => {
    const first = chosen.recipients[0];
    if (!first) return null;
    return { name: first.name, ...practicePlanSentMessage({ ...message, myLabels: myLabelsOnPlan(plan, mineTagIdsOf(first)) }) };
  }, [chosen, plan, message]);

  async function submit() {
    if (busy || count === 0) return;
    setBusy(true); setError('');
    const result = await onSend({ audience, email });
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Could not send the plan.'); return; }
    try { localStorage.setItem(sendChoiceKey(teamId), JSON.stringify({ audience, email })); } catch { /* a remembered choice is a convenience */ }
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
              const r = byAudience[a];
              // "Everyone" names the off-field kinds by their kind, so a treasurer never hides in the list.
              const names = r.recipients.map(p => (a === 'staff' && !FIELD_KINDS.has(p.kind)) ? `${p.name} (${p.kindWord.toLowerCase()})` : p.name);
              return (
                <label key={a} className={styles.ppSendAudience} data-on={audience === a ? 'on' : undefined}>
                  <input ref={i === 0 ? firstRadio : undefined} type="radio" name="audience" value={a}
                    checked={audience === a} onChange={() => setAudience(a)} disabled={busy} />
                  <span className={styles.ppSendAudienceName}>
                    {AUDIENCE_LABEL[a]} <span className={styles.ppSendAudienceCount}>{r.recipients.length}</span>
                  </span>
                  <span className={styles.ppSendAudienceWho}>
                    {names.length > 0
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
              {busy ? 'Sending…' : count === 0 ? 'Nobody to send to' : `Send to ${count}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
