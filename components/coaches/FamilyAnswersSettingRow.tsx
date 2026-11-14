'use client';

import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { FAMILY_AVAILABILITY_COACH_WORDS } from '@/lib/family-availability-words';
import { FAMILY_ANSWERS_SETTINGS, type FamilyAnswersSetting } from '@/lib/family-availability-rules';

const W = FAMILY_AVAILABILITY_COACH_WORDS.setting;

export interface FamilyAnswersSettingData {
  value: FamilyAnswersSetting;
  canEdit: boolean;
  /** Active roster players with a parent in the app, and the active roster. */
  connected: number;
  roster: number;
}

/**
 * Team settings → Sharing: "Families say if they're coming" (Signed-in family accounts Stage 4b, Part 4; drawing tab 3). The row
 * under Schedule visibility, drawn from the SAME segmented control, edited by the SAME gate (O3). It exists only where the server
 * sent it (the family layer, the guardian tier, a live season). The words under the label change with the choice; turning it on
 * sends nothing to anyone.
 */
export function FamilyAnswersSettingRow({ orgSlug, teamId, data, scheduleStaffOnly, onSaved }: {
  orgSlug: string;
  teamId: string;
  data: FamilyAnswersSettingData;
  /** Schedule visibility is Staff only: families can't see events, so the control is disabled and says why. */
  scheduleStaffOnly: boolean;
  onSaved: (value: FamilyAnswersSetting) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // "Turning it back off" reads only right after this coach turned it off here (tab 3's third state).
  const [justTurnedOff, setJustTurnedOff] = useState(false);

  async function choose(next: FamilyAnswersSetting) {
    if (next === data.value || saving) return;
    const before = data.value;
    setSaving(true);
    setError('');
    onSaved(next);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyAnswers: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : W.failed);
      setJustTurnedOff(next === 'off');
    } catch (e) {
      onSaved(before);
      setError(e instanceof Error ? e.message : W.failed);
    } finally {
      setSaving(false);
    }
  }

  const help = scheduleStaffOnly
    ? W.paused(data.value === 'off' ? null : W.choice[data.value])
    : data.value === 'off'
      ? (justTurnedOff ? W.turnedOff : W.off)
      : data.connected === 0
        ? W.nobodyYet
        : W.on(data.value, data.connected, data.roster);

  return (
    <>
      <div className={styles.settingRow}>
        <div className={styles.settingRowMain}>
          <span className={styles.settingRowLabel}>{W.label}</span>
          <span className={styles.settingRowDesc}>{help}</span>
        </div>
        <div className={`${styles.settingRowCtl} ${styles.settingRowCtlWide}`}>
          {data.canEdit ? (
            <div className={styles.segChoice} role="group" aria-label={W.groupLabel}>
              {FAMILY_ANSWERS_SETTINGS.map(v => (
                <button
                  key={v}
                  type="button"
                  // Staff only (owner, 2026-11-13, Stage 4b walk, call 9): the whole control is paused — nothing lit, nothing
                  // pressable — because the saved choice does nothing while families can't see the schedule. The saved
                  // value is untouched, so setting Schedule visibility back to Families lights it again.
                  aria-pressed={!scheduleStaffOnly && data.value === v}
                  className={`${styles.segBtn}${!scheduleStaffOnly && data.value === v ? ' ' + styles.segBtnActive : ''}`}
                  style={scheduleStaffOnly ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                  onClick={() => choose(v)}
                  disabled={saving || scheduleStaffOnly}
                >
                  {W.choice[v]}
                </button>
              ))}
            </div>
          ) : (
            <span className={styles.settingRowDesc}>{W.readOnly(W.choice[data.value])}</span>
          )}
        </div>
      </div>
      {error && (
        <div className={styles.settingRow}>
          <p className={styles.errorText} style={{ margin: 0 }} role="alert">{error}</p>
        </div>
      )}
    </>
  );
}
