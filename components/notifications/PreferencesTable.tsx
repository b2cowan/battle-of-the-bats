'use client';

/**
 * components/notifications/PreferencesTable.tsx
 *
 * The ONE shared notification-preferences grid (Notification Settings Phase 1).
 * A purely presentational, declarative table consumed by every surface — the org
 * admin card, the coach card, and later the universal container's per-context cards.
 * One rendering engine, N doors: each surface passes the sections it wants and the
 * current prefs; all load/save/push state lives in the caller (see useOrgPreferences).
 *
 * Columns are the three real engine channels (Bell / Push / Email); a section may be
 * flagged `lead` to render as the always-visible top block (rule R1 — a default-ON
 * control like the weekly digest is never buried).
 */

import { Fragment } from 'react';
import { Bell, Mail, Smartphone, Info } from 'lucide-react';
import {
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENT_DESCRIPTIONS,
} from '@/lib/notification-labels';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';
import styles from './PreferencesTable.module.css';

export interface PreferenceSection {
  label: string;
  eventTypes: NotificationEventType[];
  /** Rule R1 — render as the always-visible lead block (accent styling). */
  lead?: boolean;
}

type Channel = 'channelBell' | 'channelPush' | 'channelEmail';

interface Props {
  sections: PreferenceSection[];
  prefs: Map<NotificationEventType, NotificationPreference>;
  systemDefaultFor: (et: NotificationEventType) => NotificationPreference;
  onToggle: (eventType: NotificationEventType, channel: Channel, value: boolean) => void;
  loading: boolean;
  saving: Set<NotificationEventType>;
  /** null = not yet checked, false = unsupported, true = supported. Disables the Push column when false. */
  pushSupported: boolean | null;
  /** True while a device registration is in flight — disables Push to avoid two OS prompts at once. */
  enablingPush: boolean;
}

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    />
  );
}

export default function PreferencesTable({
  sections,
  prefs,
  systemDefaultFor,
  onToggle,
  loading,
  saving,
  pushSupported,
  enablingPush,
}: Props) {
  const totalRows = sections.reduce((n, s) => n + s.eventTypes.length, 0) || 4;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thEvent}>Event</th>
            <th className={styles.thChannel}>
              <span className={styles.channelLabel}><Bell size={13} /> Bell</span>
            </th>
            <th className={styles.thChannel}>
              <span className={styles.channelLabel}>
                <Smartphone size={13} /> Push
                {pushSupported === false && <span className={styles.unsupportedNote}>n/a</span>}
              </span>
            </th>
            <th className={styles.thChannel}>
              <span className={styles.channelLabel}><Mail size={13} /> Email</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: totalRows }).map((_, i) => (
                <tr key={i} className={styles.skeletonRow}>
                  <td><div className={styles.skeletonLabel} /></td>
                  <td><div className={styles.skeletonToggle} /></td>
                  <td><div className={styles.skeletonToggle} /></td>
                  <td><div className={styles.skeletonToggle} /></td>
                </tr>
              ))
            : sections.map((section, sIdx) => (
                <Fragment key={section.label}>
                  <tr className={`${styles.sectionHeaderRow} ${sIdx > 0 ? styles.sectionHeaderRowBorder : ''}`}>
                    <td colSpan={4} className={`${styles.sectionHeaderCell} ${section.lead ? styles.sectionHeaderLead : ''}`}>
                      {section.label}
                    </td>
                  </tr>

                  {section.eventTypes.map(et => {
                    const pref = prefs.get(et) ?? systemDefaultFor(et);
                    const isSaving = saving.has(et);
                    return (
                      <tr
                        key={et}
                        className={`${styles.row} ${section.lead ? styles.leadRow : ''} ${isSaving ? styles.rowSaving : ''}`}
                      >
                        <td className={styles.tdEvent}>
                          <span className={styles.eventLabel}>{NOTIFICATION_EVENT_LABELS[et]}</span>
                          <span className={styles.eventDesc}>
                            <Info size={12} />
                            <span className={styles.descText}>{NOTIFICATION_EVENT_DESCRIPTIONS[et]}</span>
                          </span>
                        </td>
                        <td className={styles.tdChannel}>
                          <Toggle
                            checked={pref.channelBell}
                            onChange={v => onToggle(et, 'channelBell', v)}
                            label={`Bell notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
                          />
                        </td>
                        <td className={styles.tdChannel}>
                          <Toggle
                            checked={pref.channelPush}
                            onChange={v => onToggle(et, 'channelPush', v)}
                            label={`Push notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
                            disabled={pushSupported === false || enablingPush}
                          />
                        </td>
                        <td className={styles.tdChannel}>
                          <Toggle
                            checked={pref.channelEmail}
                            onChange={v => onToggle(et, 'channelEmail', v)}
                            label={`Email notifications for ${NOTIFICATION_EVENT_LABELS[et]}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
        </tbody>
      </table>
    </div>
  );
}
