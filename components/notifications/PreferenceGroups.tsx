'use client';

/**
 * components/notifications/PreferenceGroups.tsx
 *
 * The Simple (default) view for a notification card (Notification Settings Phase 2):
 * plain-language groups ("Needs your attention" / "What's happening") each with one
 * tri-state channel rollup per bell/push/email.
 *
 * Rule R2 — no silent batch writes: a rollup that spans events with differing values
 * renders as a distinct "mixed" state and captions its blast radius; tapping a mixed
 * (or off) rollup turns the whole group on, tapping an on rollup turns it off — the
 * per-event grid (PreferencesTable, behind "Customize") stays the source of truth.
 */

import { NOTIFICATION_EVENT_LABELS } from '@/lib/notification-labels';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';
import styles from './PreferencesTable.module.css';

type Channel = 'channelBell' | 'channelPush' | 'channelEmail';
type Roll = 'on' | 'off' | 'mixed';

export interface PreferenceGroup {
  label: string;
  blurb: string;
  eventTypes: NotificationEventType[];
  /** Rule R1 — a default-ON control (the coach digest) pinned at the top with accent styling,
   *  and no "N types" chip since it's a single named notification, not a rollup of many. */
  lead?: boolean;
}

interface Props {
  groups: PreferenceGroup[];
  prefs: Map<NotificationEventType, NotificationPreference>;
  systemDefaultFor: (et: NotificationEventType) => NotificationPreference;
  onGroupToggle: (eventTypes: NotificationEventType[], channel: Channel, value: boolean) => void;
  pushSupported: boolean | null;
  enablingPush: boolean;
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'channelBell',  label: 'Bell'  },
  { key: 'channelPush',  label: 'Push'  },
  { key: 'channelEmail', label: 'Email' },
];

function rollup(
  eventTypes: NotificationEventType[],
  channel: Channel,
  prefs: Map<NotificationEventType, NotificationPreference>,
  systemDefaultFor: (et: NotificationEventType) => NotificationPreference,
): Roll {
  const vals = eventTypes.map(et => (prefs.get(et) ?? systemDefaultFor(et))[channel]);
  const on = vals.filter(Boolean).length;
  if (on === 0) return 'off';
  if (on === vals.length) return 'on';
  return 'mixed';
}

function TriToggle({
  state,
  onTap,
  label,
  disabled = false,
}: {
  state: Roll;
  onTap: () => void;
  label: string;
  disabled?: boolean;
}) {
  const cls = state === 'on' ? styles.toggleOn : state === 'mixed' ? styles.toggleMixed : '';
  return (
    <button
      type="button"
      role="switch"
      // role="switch" only supports true/false; the "mixed" nuance is carried in the label.
      aria-checked={state === 'on'}
      aria-label={`${label}${state === 'mixed' ? ' — mixed' : ''}`}
      disabled={disabled}
      className={`${styles.toggle} ${cls} ${disabled ? styles.toggleDisabled : ''}`}
      onClick={() => !disabled && onTap()}
    />
  );
}

export default function PreferenceGroups({
  groups,
  prefs,
  systemDefaultFor,
  onGroupToggle,
  pushSupported,
  enablingPush,
}: Props) {
  return (
    <div className={styles.groupsWrap}>
      <div className={styles.groupsHead}>
        <span>&nbsp;</span>
        <span>Bell</span>
        <span>Push</span>
        <span>Email</span>
      </div>
      {groups.map(group => {
        const n = group.eventTypes.length;
        const typesLabel = `${n} notification ${n === 1 ? 'type' : 'types'}`;
        const states = CHANNELS.map(c => ({
          ...c,
          state: rollup(group.eventTypes, c.key, prefs, systemDefaultFor),
        }));
        const mixed = states.filter(s => s.state === 'mixed');
        // Name the actual notifications the group covers (the lead digest keeps its own blurb).
        const description = group.lead
          ? group.blurb
          : group.eventTypes.map(et => NOTIFICATION_EVENT_LABELS[et]).join(', ');
        return (
          <div key={group.label} className={`${styles.group} ${group.lead ? styles.groupLead : ''}`}>
            <div className={styles.groupLabelWrap}>
              <div className={styles.groupLabel}>
                {group.label}
                {!group.lead && <span className={styles.groupCount}>{n} {n === 1 ? 'type' : 'types'}</span>}
              </div>
              <div className={styles.groupBlurb}>{description}</div>
            </div>
            {states.map(({ key, label, state }) => (
              <div key={key} className={styles.triCell}>
                <TriToggle
                  state={state}
                  onTap={() => onGroupToggle(group.eventTypes, key, state !== 'on')}
                  label={`${label} for ${group.label} (${typesLabel})`}
                  disabled={key === 'channelPush' && (pushSupported === false || enablingPush)}
                />
              </div>
            ))}
            {mixed.length > 0 && (
              <div className={styles.groupCaption}>
                <span className={styles.capDot} />
                {mixed.map(m => m.label).join(' and ')} {mixed.length === 1 ? 'covers' : 'cover'} some of
                these — tap to turn all {n} on.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
