'use client';
/**
 * Free time on a Coaches Portal (Support console Stage 4b; drawings 4qzTiG3rUBTmihqPSUAzrW, A and B): the Give window
 * (from the coach's person record, or a later give from the portal's record) and the portal's Change the end date and
 * End it now. Stage 4's windows with the club-shaped fields removed: one thing is given, the Premium Coaches Portal for
 * one team. The rules these state are the server's (`lib/portal-free-time-give.ts`); these are the courtesy in front.
 */
import { useState } from 'react';
import { CreditCard, Flag, Lock, Users } from 'lucide-react';
import DateInput from '@/components/shared/DateInput';
import { dayAfterWords, formatLongDay, monthDayOf } from '@/lib/free-time';
import { firstNameOf, type PortalGiveBlock } from '@/lib/portal-free-time';
import type { CoachPortalTab, CoachTabTeam, PortalFreeTimeBounds } from '@/lib/portal-free-time-tab';
import { possessive } from '@/lib/utils';
import RecordWindow from '../../RecordWindow';
import { errorOf, sendJson } from '../../console-fetch';
import kit from '../../console.module.css';
import styles from '../../record.module.css';

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Where the line sits on the person's tab: under the Premium portals it is about, or under the free team. */
export const PREMIUM_SECTION_BLOCKS = new Set<PortalGiveBlock['kind']>(['running', 'had_free_time', 'paying', 'comped', 'cancelled', 'club']);

/** The one line where the door would be (drawing A, lines 1–9): red for the switch and your own, amber otherwise. */
export function PortalBlockLine({ block }: { block: PortalGiveBlock }) {
  const Icon = block.kind === 'switch' ? Lock : block.kind === 'own' || block.kind === 'club' ? Users : block.kind === 'paying' ? CreditCard : Flag;
  // The first sentence leads in bold, as Stage 4's lines do (never cut at a comma: dates carry one).
  const cut = block.line.search(/\. /);
  const lead = cut > 0 ? block.line.slice(0, cut + 1) : block.line;
  const rest = cut > 0 ? block.line.slice(cut + 1) : '';
  return (
    <p className={`${styles.refuseLine}${block.tone === 'red' ? ` ${styles.refuseLineBad}` : ''}`}>
      <Icon size={15} aria-hidden className={styles.refuseIcon} />
      <span><strong>{lead}</strong>{rest}</span>
    </p>
  );
}

/**
 * The shared date field: days before tomorrow and past the giver's limit are greyed out and cannot be chosen. A Super
 * admin has no limit and also sees "No end date" (owner ruling 2026-11-19, the club's tick), which clears the date.
 */
function PortalFreeThroughField({ value, onChange, bounds, indefinite, onIndefinite }: {
  value: string; onChange: (v: string) => void; bounds: PortalFreeTimeBounds; indefinite: boolean; onIndefinite: (v: boolean) => void;
}) {
  const hint = bounds.capWords == null
    ? 'The last free day; it ends that midnight, Eastern'
    : value && value === bounds.latest
      ? 'The latest day this role can pick. Days after it are greyed out in the calendar and cannot be chosen.'
      : bounds.firstGiveDay
        ? `Measured from the day free time was first given: you can go through ${formatLongDay(bounds.latest)}.`
        : `The last free day; it ends that midnight, Eastern. You can give up to ${bounds.capWords}, through ${formatLongDay(bounds.latest)}.`;
  return (
    <div className={kit.fieldGroup}>
      <span className={kit.label}>Free through{!indefinite && <span className={kit.req} aria-hidden>*</span>}</span>
      <DateInput className={kit.field} value={indefinite ? '' : value} onChange={onChange} min={bounds.earliest} max={bounds.latest}
        disabled={indefinite} aria-label="Free through" required={!indefinite} />
      <span className={kit.hint}>{hint}</span>
      {bounds.superAdmin && (
        <label className={kit.check}>
          <input type="checkbox" checked={indefinite} onChange={e => onIndefinite(e.target.checked)} />
          No end date: it stays until someone ends it
        </label>
      )}
    </div>
  );
}

/** A window that answers "someone changed it while you had it open": nothing changed, look again. */
function StaleWindow({ title, sentence, onDone, onClose }: { title: string; sentence: string; onDone: () => void; onClose: () => void }) {
  return (
    <RecordWindow
      title={title}
      sentence={<span className={styles.refuseLine}><Flag size={15} aria-hidden className={styles.refuseIcon} /><span>{sentence}</span></span>}
      askWhy={false}
      footNote="Nothing was changed."
      confirmLabel="Look again"
      onConfirm={async () => { onDone(); return null; }}
      onClose={onClose}
    />
  );
}

/**
 * Give free time (drawing A2): which team (a first give), the last free day, why, and the sentence that is the confirm.
 * A later give (Super admin, Q5) is the coach's one staff-given portal: no team to choose. `onGiven` is told the new
 * portal and, when the copy fell short, the amber line (drawing F2).
 */
export function PortalGiveWindow({ coachId, coachName, give, onGiven, onClose }: {
  coachId: string;
  coachName: string;
  give: NonNullable<CoachPortalTab['give']>;
  onGiven: (result: { orgId: string; copyShort: string | null }) => void;
  onClose: () => void;
}) {
  const [teamId, setTeamId] = useState(give.offer[0]?.id ?? '');
  const [lastDay, setLastDay] = useState('');
  const [indefinite, setIndefinite] = useState(false);
  const [stale, setStale] = useState<string | null>(null);
  const first = firstNameOf(coachName);
  const team: CoachTabTeam | undefined = give.offer.find(t => t.id === teamId);
  const through = lastDay ? formatLongDay(lastDay) : null;
  const title = `Give free time to ${coachName}`;
  if (stale) return <StaleWindow title={title} sentence={stale} onDone={onClose} onClose={onClose} />;

  const after = lastDay ? dayAfterWords(lastDay) : '';
  const hosting = <>Hosting a tournament is not part of free time.</>;
  const tail = <> Nothing is charged, nothing is deleted. {first} is emailed 14 days and 3 days before it runs out. Their Plan &amp; billing page says “Free through {through}”.
    {' '}{hosting}</>;
  // No end date (owner ruling 2026-11-19): nothing returns by itself, so the sentence says who ends it.
  const openTail = <> It stays until staff end it from the portal’s record. Nothing is charged, nothing is deleted, and {first} is not
    emailed about an end. Their Plan &amp; billing page says “Free from FieldLogicHQ”, with no date. {hosting}</>;
  const copied = team && <>The team’s {counted(team.players, 'player', 'players')}, {counted(team.events, 'event', 'events')} and {counted(team.fees, 'fee', 'fees')} are
    copied across once, as on a paid upgrade; the free team stays as it is.</>;
  const sentence = indefinite
    ? give.mode === 'again' && give.againPortal
      ? <>{coachName} gets the <strong>Premium Coaches Portal again, with no end date</strong>, on the same portal: everything they made on
        Premium is there.{openTail}</>
      : team
        ? <>{coachName} gets the <strong>Premium Coaches Portal for {team.name}, with no end date</strong>. {copied}{openTail}</>
        : 'Choose the team.'
    : !through ? 'Choose the last free day.'
      : give.mode === 'again' && give.againPortal
        ? <>{coachName} gets the <strong>Premium Coaches Portal again through {through}</strong>, on the same portal: everything they made on
          Premium is there. On {after} {first} goes back to the free Coaches Portal by itself and keeps everything.{tail}</>
        : team
          ? <>{coachName} gets the <strong>Premium Coaches Portal for {team.name} through {through}</strong>. {copied} On {after} {first} goes
            back to the free Coaches Portal by itself and keeps everything: what they make on Premium is saved there and returns if Premium
            does.{tail}</>
          : 'Choose the team.';

  return (
    <RecordWindow
      title={title}
      sentence={sentence}
      sentenceAfter
      whyPlaceholder="Why are you giving this?"
      footNote={!indefinite && lastDay && lastDay === give.bounds.latest
        ? `Days before tomorrow and after ${formatLongDay(give.bounds.latest)} are greyed out.`
        : give.mode === 'again' ? 'Shows on the portal’s Story.' : `Shows on the new portal’s Story and on ${possessive(first)} record.`}
      confirmLabel="Give free time"
      confirmBlocked={(!indefinite && !lastDay) || (give.mode === 'first' && !team)}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/people/${coachId}/portal-free-time`, 'POST', {
          team_id: give.mode === 'first' ? teamId : undefined,
          last_day: indefinite ? undefined : lastDay, indefinite: indefinite || undefined, reason,
        });
        if (!ok) {
          const error = errorOf(data, 'Nothing was given. The server could not save it. Your answers are kept; try again.');
          if (/while you had it open/.test(error)) { setStale(error); return null; }
          return error;
        }
        onGiven({ orgId: String(data.orgId), copyShort: typeof data.copyShort === 'string' ? data.copyShort : null });
        return null;
      }}
      onClose={onClose}
    >
      {give.mode === 'first' && (
        <label className={kit.fieldGroup}>
          <span className={kit.label}>Team<span className={kit.req} aria-hidden>*</span></span>
          <select className={kit.select} value={teamId} onChange={e => setTeamId(e.target.value)} required>
            {give.offer.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <span className={kit.hint}>{possessive(first)} free teams. One team can be Premium at a time.</span>
        </label>
      )}
      <PortalFreeThroughField value={lastDay} onChange={setLastDay} bounds={give.bounds} indefinite={indefinite} onIndefinite={setIndefinite} />
    </RecordWindow>
  );
}

/** The running free time on a portal's record (its Access row). A null last day and end = given with no end date. */
export type PortalFreeTimeRow = { id: string; lastDay: string | null; expiresAt: string | null };

export function PortalChangeEndWindow({ orgId, orgName, coachName, row, bounds, onDone, onClose }: {
  orgId: string; orgName: string; coachName: string; row: PortalFreeTimeRow; bounds: PortalFreeTimeBounds; onDone: () => void; onClose: () => void;
}) {
  const wasIndefinite = !row.expiresAt;
  const was = row.lastDay ?? '';
  const [lastDay, setLastDay] = useState(was);
  // Only a Super admin sees "No end date", so anyone else opens an open-ended one on a date to pick.
  const [indefinite, setIndefinite] = useState(wasIndefinite && bounds.superAdmin);
  const [stale, setStale] = useState<string | null>(null);
  const title = `Change the end of ${possessive(orgName)} free time`;
  if (stale) return <StaleWindow title={title} sentence={stale} onDone={onDone} onClose={onClose} />;
  const unchanged = indefinite ? wasIndefinite : !lastDay || lastDay === was;
  const wasWords = wasIndefinite ? 'having no end date' : monthDayOf(was);
  return (
    <RecordWindow
      title={title}
      sentence={unchanged
        ? 'Choose the new last free day.'
        : indefinite
          ? <>{possessive(orgName)} <strong>Premium</strong> free time now has <strong>no end date</strong>. It stays until staff end it
            from this record. {firstNameOf(coachName)} is not emailed about an end.</>
          : <>{possessive(orgName)} <strong>Premium</strong> free time now runs <strong>through {formatLongDay(lastDay)}</strong> instead
            of {wasWords}. Then back to the free Coaches Portal by itself. {firstNameOf(coachName)} is emailed 14 days and 3 days before the new last day.</>}
      sentenceAfter
      footNote={wasIndefinite ? 'A new Story entry. Putting it back to no end date is not offered.' : `A new Story entry; Put it back restores ${wasWords}.`}
      confirmLabel="Change the end date"
      confirmBlocked={unchanged}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/portal-free-time/${row.id}`, 'PATCH', {
          expected_expires_at: row.expiresAt, last_day: indefinite ? undefined : lastDay, indefinite: indefinite || undefined, reason,
        });
        if (!ok) {
          const error = errorOf(data, 'Nothing was changed. The server could not save it.');
          if (/while you had it open/.test(error)) { setStale(error); return null; }
          return error;
        }
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <PortalFreeThroughField value={lastDay} onChange={setLastDay} bounds={bounds} indefinite={indefinite} onIndefinite={setIndefinite} />
    </RecordWindow>
  );
}

export function PortalEndNowWindow({ orgId, orgName, coachName, row, onDone, onClose }: {
  orgId: string; orgName: string; coachName: string; row: PortalFreeTimeRow; onDone: () => void; onClose: () => void;
}) {
  const first = firstNameOf(coachName);
  return (
    <RecordWindow
      title={`End ${possessive(orgName)} free time now`}
      sentence={<>{possessive(orgName)} <strong>Premium</strong> free time ends <strong>now</strong>{row.lastDay ? <> instead of on {formatLongDay(row.lastDay)}</> : <> (it had no end date)</>}.
        {' '}{first} goes back to the free Coaches Portal at once, and anyone on a Premium page is moved out on their next click.
        {' '}<strong>Nothing is deleted:</strong> what {first} made on Premium is kept.</>}
      whyPlaceholder="Why are you ending it early?"
      footNote="Writes a new entry in the Story."
      cancelLabel="Keep it"
      confirmLabel="End it now"
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/portal-free-time/${row.id}`, 'DELETE', { reason });
        if (!ok) return errorOf(data, 'Nothing was ended. The server could not save it.');
        onDone();
        return null;
      }}
      onClose={onClose}
    />
  );
}
