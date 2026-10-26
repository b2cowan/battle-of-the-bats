'use client';
/**
 * Free time on a club's record: the words, the line where the door would be, and its three windows (Give, Change the end
 * date, End it now). Split from ClubRecord.tsx so the record file reads as the record; the rules these windows state are
 * the server's (`lib/free-time-writes.ts`), these are the courtesy in front of them.
 */
import { useState, type ReactNode } from 'react';
import { Flag, Lock, Users } from 'lucide-react';
import DateInput from '@/components/shared/DateInput';
import { CLUB_SECTIONS, planLabel, sectionLabel, subscriptionStatusLabel } from '@/lib/platform-labels';
import { dayAfterWords, formatLongDay, monthDayOf, type GiveBlock } from '@/lib/free-time';
import { possessive } from '@/lib/utils';
import RecordWindow from '../../RecordWindow';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import styles from '../../record.module.css';
import type { ClubRecordProps } from './ClubRecord';

type FreeTimeRow = ClubRecordProps['overrides'][number];

// ── Free time: the words, the line where the door would be, and its three windows ──────────────────────────────────
/** What a running grant gives, in a few words: "Club", "Accounting, House league", "Billing status". */
export function freeTimeSubject(o: FreeTimeRow, ownPlanLabel: string): string {
  if (o.type === 'plan_tier') return planLabel(o.plan ?? '');
  if (o.type === 'module_addon') return o.addons.map(sectionLabel).join(', ') || 'Sections';
  if (o.type === 'subscription_status') return 'Billing status';
  return ownPlanLabel;
}

/** An Access row's title: "Club · the whole plan", "Accounting", "Billing status: Active", "Tournament Plus · Founding Season". */
export function freeTimeTitle(o: FreeTimeRow, org: ClubRecordProps['org']): string {
  if (o.type === 'plan_tier') return `${planLabel(o.plan ?? '')} · the whole plan`;
  if (o.type === 'module_addon') return o.addons.map(sectionLabel).join(', ') || 'Sections';
  if (o.type === 'subscription_status') return `Billing status: ${subscriptionStatusLabel(o.value ?? 'active')}`;
  return o.founding ? `${org.planLabel} · Founding Season` : 'Billing tag, gives nothing';
}

export function BlockLine({ block }: { block: GiveBlock }) {
  const Icon = block.kind === 'switch' ? Lock : block.kind === 'own_club' ? Users : Flag;
  return (
    <p className={`${styles.refuseLine}${block.tone === 'red' ? ` ${styles.refuseLineBad}` : ''}`}>
      <Icon size={15} aria-hidden className={styles.refuseIcon} />
      <span><strong>{block.lead}</strong>{block.rest}</span>
    </p>
  );
}

type FreeTimeBounds = NonNullable<ClubRecordProps['freeTime']>;
type GiveKind = 'plan_tier' | 'module_addon' | 'subscription_status';

const GIVE_CHOICES: Array<{ kind: GiveKind; label: string; sub: string }> = [
  { kind: 'plan_tier', label: 'A whole plan', sub: 'Every part of the product treats the club as on that plan' },
  { kind: 'module_addon', label: 'Sections', sub: 'One or more sections its plan does not include' },
  { kind: 'subscription_status', label: 'Billing status', sub: 'Reads as active while unpaid, to keep a club open' },
];

export function GiveWindow({ org, freeTime, rows, onChangeEnd, onDone, onClose }: {
  org: ClubRecordProps['org']; freeTime: FreeTimeBounds; rows: FreeTimeRow[];
  onChangeEnd: (row: FreeTimeRow) => void; onDone: () => void; onClose: () => void;
}) {
  const planBlock = freeTime.planBlock;
  const [kind, setKind] = useState<GiveKind | null>(planBlock ? null : 'plan_tier');
  const [plan, setPlan] = useState(freeTime.plansAbove[0]?.id ?? '');
  const [addons, setAddons] = useState<string[]>([]);
  const [lastDay, setLastDay] = useState('');
  const offered = CLUB_SECTIONS.filter(s => !org.planSections.includes(s.key));
  const planName = freeTime.plansAbove.find(p => p.id === plan)?.label ?? '';
  const founding = rows.find(o => o.running && o.founding && o.lastDay) ?? null;
  const grantedRow = planBlock?.kind === 'granted' ? rows.find(o => o.id === planBlock.overrideId) ?? null : null;
  const b = (text: string) => <strong>{text}</strong>;
  const through = lastDay ? formatLongDay(lastDay) : null;

  let sentence: ReactNode = 'Choose what to give and its last free day.';
  if (kind && through) {
    if (kind === 'plan_tier') {
      const stillFounding = founding && founding.lastDay! > lastDay
        ? <>, still free through {formatLongDay(founding.lastDay!)} under Founding Season</> : null;
      sentence = <>{org.name} gets {b(`${planName} through ${through}`)}. On {dayAfterWords(lastDay)} it goes back to {b(org.planLabel)} by
        itself{stillFounding}. Nothing is charged, nothing is deleted, and the owner is not emailed. Their Plan &amp; billing page
        says “Free through {through}”.</>;
    } else if (kind === 'module_addon') {
      const names = addons.map(sectionLabel).join(', ');
      sentence = names
        ? <>{org.name} gets {b(`${names} through ${through}`)}, then {addons.length === 1 ? 'it turns' : 'they turn'} off by itself. Nothing
          is charged or deleted, and the owner is not emailed.</>
        : 'Choose the sections to give.';
    } else {
      sentence = <>{org.name} reads as {b(`active through ${through}`)} while unpaid, then goes back to its own billing status by itself.
        Nothing is charged or deleted, and the owner is not emailed.</>;
    }
  }
  const ready = !!kind && !!lastDay && (kind !== 'plan_tier' || !!plan) && (kind !== 'module_addon' || addons.length > 0);

  return (
    <RecordWindow
      title={`Give free time to ${org.name}`}
      sentence={sentence}
      sentenceAfter
      whyPlaceholder="Why are you giving this?"
      footNote={!kind && planBlock ? 'Sections and billing status can still be given.'
        : kind === 'module_addon' ? 'Sections, as today, now with an end.'
        : 'Shows on the Story, and can be ended early or given a new end date from there.'}
      confirmLabel="Give free time"
      confirmHidden={!kind}
      confirmBlocked={!ready}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${org.id}/overrides`, 'POST', {
          kind, plan: kind === 'plan_tier' ? plan : undefined, addons: kind === 'module_addon' ? addons : undefined, last_day: lastDay, reason,
        });
        if (!ok) return errorOf(data, 'Nothing was given. The server could not save it. Your answers are kept; try again.');
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <div className={kit.fieldGroup} role="radiogroup" aria-label="What">
        <span className={kit.label}>What</span>
        <div className={styles.choices}>
          {planBlock && (
            <p className={styles.refuseLine}>
              <Flag size={15} aria-hidden className={styles.refuseIcon} />
              <span>
                {planBlock.sentence}
                {grantedRow && <> <button type="button" className={kit.door} onClick={() => onChangeEnd(grantedRow)}>Change the end date</button></>}
              </span>
            </p>
          )}
          {GIVE_CHOICES.filter(c => !(planBlock && c.kind === 'plan_tier')).map(c => (
            <label key={c.kind} className={`${styles.choice}${kind === c.kind ? ` ${styles.choiceOn}` : ''}`}>
              <input type="radio" name="free-time-kind" checked={kind === c.kind} onChange={() => setKind(c.kind)} />
              <span><span className={styles.choiceLabel}>{c.label}</span><span className={styles.choiceSub}>{c.sub}</span></span>
            </label>
          ))}
        </div>
      </div>
      {kind === 'module_addon' && (
        <div className={kit.fieldGroup}>
          <span className={kit.label}>Sections<span className={kit.req} aria-hidden>*</span></span>
          <div className={styles.sections}>
            {offered.length === 0 && <span className={styles.included}>Every section is already in the plan.</span>}
            {offered.map(s => (
              <label key={s.key} className={kit.check}>
                <input type="checkbox" checked={addons.includes(s.key)}
                  onChange={() => setAddons(a => (a.includes(s.key) ? a.filter(k => k !== s.key) : [...a, s.key]))} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {kind && (
        <div className={styles.windowGrid}>
          {kind === 'plan_tier' && (
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Plan<span className={kit.req} aria-hidden>*</span></span>
              <select className={kit.select} value={plan} onChange={e => setPlan(e.target.value)}>
                {freeTime.plansAbove.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <span className={kit.hint}>{freeTime.plansAbove.map(p => p.label).join(' or ')}</span>
            </label>
          )}
          <FreeThroughField value={lastDay} onChange={setLastDay} freeTime={freeTime} />
        </div>
      )}
    </RecordWindow>
  );
}

/** The shared date field: days before tomorrow and past the giver's limit greyed out in its calendar. */
function FreeThroughField({ value, onChange, freeTime }: { value: string; onChange: (v: string) => void; freeTime: FreeTimeBounds }) {
  const over = !!value && value > freeTime.latest;
  return (
    <div className={kit.fieldGroup}>
      <span className={kit.label}>Free through<span className={kit.req} aria-hidden>*</span></span>
      <DateInput className={kit.field} value={value} onChange={onChange} min={freeTime.earliest} max={freeTime.latest} aria-label="Free through" required />
      {over
        ? <span className={kit.fieldError}>You can give up to {freeTime.capMonths} months, through {formatLongDay(freeTime.latest)}.{freeTime.superAdmin ? '' : ' Longer needs a super admin.'}</span>
        : <span className={kit.hint}>The last free day; it ends that midnight, Eastern</span>}
    </div>
  );
}

export function ChangeEndWindow({ org, row, freeTime, onDone, onClose }: {
  org: ClubRecordProps['org']; row: FreeTimeRow; freeTime: FreeTimeBounds; onDone: () => void; onClose: () => void;
}) {
  const [lastDay, setLastDay] = useState(row.lastDay ?? '');
  const [stale, setStale] = useState<string | null>(null);
  const subject = freeTimeSubject(row, org.planLabel);
  const was = row.lastDay ?? '';
  const afterwards = row.type === 'plan_tier' ? <>Then back to {org.planLabel} by itself.</>
    : row.type === 'module_addon' ? <>Then it turns off by itself.</> : <>Then back to its own billing status by itself.</>;

  if (stale) {
    return (
      <RecordWindow
        title={`Change the end of ${possessive(org.name)} free time`}
        sentence={<span className={styles.refuseLine}><Flag size={15} aria-hidden className={styles.refuseIcon} /><span>{stale}</span></span>}
        askWhy={false}
        footNote="Nothing was changed."
        confirmLabel="Look again"
        onConfirm={async () => { onDone(); return null; }}
        onClose={onClose}
      />
    );
  }
  return (
    <RecordWindow
      title={`Change the end of ${possessive(org.name)} free time`}
      sentence={lastDay && lastDay !== was
        ? <>{possessive(org.name)} <strong>{subject}</strong> free time now runs <strong>through {formatLongDay(lastDay)}</strong> instead
          of {monthDayOf(was)}. {afterwards} The owner is not emailed.</>
        : 'Choose the new last free day.'}
      sentenceAfter
      footNote={`A new Story entry; Put it back restores ${monthDayOf(was)}.`}
      confirmLabel="Change the end date"
      confirmBlocked={!lastDay || lastDay === was}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${org.id}/overrides/${row.id}`, 'PATCH', {
          expected_expires_at: row.expiresAt, last_day: lastDay, reason,
        });
        if (!ok) {
          const error = errorOf(data, 'Nothing was changed. The server could not save it.');
          if (/changed this free time while you had it open/.test(error)) { setStale(error); return null; }
          return error;
        }
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <FreeThroughField value={lastDay} onChange={setLastDay} freeTime={freeTime} />
    </RecordWindow>
  );
}

export function EndNowWindow({ org, row, onDone, onClose }: {
  org: ClubRecordProps['org']; row: FreeTimeRow; onDone: () => void; onClose: () => void;
}) {
  const subject = freeTimeSubject(row, org.planLabel);
  const insteadOf = row.lastDay ? <> instead of on {formatLongDay(row.lastDay)}</> : null;
  const then = row.type === 'plan_tier'
    ? <>It goes back to {org.planLabel} at once; anyone using the tools that come only with {subject} is moved out on their next click.</>
    : row.type === 'module_addon' ? <>{row.addons.length === 1 ? 'It turns' : 'They turn'} off at once.</>
    : <>The club reads its own billing status again at once.</>;
  return (
    <RecordWindow
      title={`End ${possessive(org.name)} free time now`}
      sentence={<>{possessive(org.name)} <strong>{subject}</strong> free time ends <strong>now</strong>{insteadOf}. {then} Nothing is deleted.</>}
      whyPlaceholder="Why are you ending it early?"
      footNote="Writes a new entry in the Story."
      cancelLabel="Keep it"
      confirmLabel="End it now"
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${org.id}/overrides/${row.id}`, 'DELETE', { reason });
        if (!ok) return errorOf(data, 'Nothing was ended. The server could not save it.');
        onDone();
        return null;
      }}
      onClose={onClose}
    />
  );
}
