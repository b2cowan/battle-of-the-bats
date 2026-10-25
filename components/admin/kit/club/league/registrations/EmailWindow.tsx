'use client';
/**
 * EMAIL FAMILIES FROM REGISTRATIONS (Club Tier Stage 9b-2, Part 3): one family (a row's ⋯), the ticked families (the bulk
 * bar's Email), or the whole season's composer (Tools › Email families — today's audience choice: all active, a division, a
 * team, a status). Subject and message, then Send. The foot says who it reaches and who it skips (a guardian with no email
 * address); a registration with none has nothing to send, so the button is absent rather than disabled.
 * The send is the season's email route; 'selected' reaches only this season's ticked registrations.
 */
import { useEffect, useMemo, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { FormError, TextField, jsonInit, moneyFetch, refusalText } from '../../money/MoneyKit';
import { BULK_WORDS, REGS_EMAIL_WORDS as W } from '@/lib/house-league-money-words';
import type { RegsDivision } from '@/lib/house-league-registrations';
import type { LeagueRegistration, LeagueRegistrationStatus, LeagueTeam } from '@/lib/types';

export type EmailAudience =
  | { kind: 'selected'; regs: readonly LeagueRegistration[] }
  | { kind: 'season' };

type Scope = 'all' | 'division' | 'team' | 'status';
type SeasonStatusPick = 'active' | 'waitlisted' | 'pending_review' | 'declined';

export default function EmailWindow({
  seasonName, audience, allRegs, divisions, orgQuery, seasonId, raised, onClose, onSent,
}: {
  seasonName: string;
  audience: EmailAudience;
  allRegs: readonly LeagueRegistration[];
  divisions: readonly RegsDivision[];
  orgQuery: string;
  seasonId: string;
  raised: boolean;
  onClose: () => void;
  onSent: (said: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [divisionId, setDivisionId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState<SeasonStatusPick>('active');
  const [teams, setTeams] = useState<LeagueTeam[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = audience.kind === 'selected' ? audience.regs : null;

  // The team list is read only when "By team" is chosen.
  useEffect(() => {
    if (scope !== 'team' || teams) return;
    let live = true;
    void fetch(`/api/admin/house-league/seasons/${seasonId}/teams${orgQuery}`)
      .then(r => r.json())
      .then(d => { if (live) setTeams(d.teams ?? []); })
      .catch(() => { if (live) setTeams([]); });
    return () => { live = false; };
  }, [scope, teams, seasonId, orgQuery]);

  const reach = useMemo(() => {
    if (selected) {
      const withEmail = selected.filter(r => r.guardianEmail.trim() !== '');
      return { n: withEmail.length, missing: selected.length - withEmail.length };
    }
    const n = scope === 'all' ? allRegs.filter(r => r.status === 'active').length
      : scope === 'division' ? (divisionId ? allRegs.filter(r => r.divisionId === divisionId && r.status === 'active').length : 0)
        : scope === 'team' ? (teamId ? allRegs.filter(r => r.teamId === teamId).length : 0)
          : allRegs.filter(r => r.status === (status as LeagueRegistrationStatus)).length;
    return { n, missing: 0 };
  }, [selected, scope, divisionId, teamId, status, allRegs]);

  const title = selected ? (selected.length === 1 ? W.titleOne : W.titleMany(selected.length)) : W.titleSeason;
  const foot = selected
    ? (selected.length === 1
      ? (selected[0].guardianEmail.trim() ? W.toOne(selected[0].guardianEmail) : BULK_WORDS.emailLine(1, 1))
      : BULK_WORDS.emailLine(selected.length, reach.missing))
    : W.toSeason(reach.n);

  async function send() {
    if (busy) return;
    if (!subject.trim() || !message.trim()) { setError(W.needBoth); return; }
    setBusy(true); setError('');
    const body = selected
      ? { subject: subject.trim(), message: message.trim(), scope: 'selected', registrationIds: selected.map(r => r.id) }
      : {
        subject: subject.trim(), message: message.trim(), scope,
        divisionId: scope === 'division' ? divisionId : undefined,
        teamId: scope === 'team' ? teamId : undefined,
        status: scope === 'status' ? status : undefined,
      };
    try {
      const r = await moneyFetch<{ sent?: number; skipped?: number }>(`/api/admin/house-league/seasons/${seasonId}/email${orgQuery}`, jsonInit('POST', body));
      if (!r.ok) { setError(refusalText(r.data, W.failed)); setBusy(false); return; }
      const sent = r.data.sent ?? 0;
      const skipped = r.data.skipped ?? 0;
      onSent(selected
        ? (skipped > 0 ? BULK_WORDS.done.email.partial(sent, skipped) : BULK_WORDS.done.email.clean(sent))
        : W.sentSeason(sent, skipped));
    } catch {
      setError(W.failed);
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised={raised}
      eyebrow={W.eyebrow(seasonName)}
      title={title}
      onClose={onClose}
      busy={busy}
      dirty={subject.trim() !== '' || message.trim() !== ''}
      discardAsk="Close without sending? What you typed won’t be kept."
      footerStart={<span>{foot}</span>}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {reach.n > 0 && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy}>
              {busy ? W.working : selected ? W.send : W.sendN(reach.n)}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {!selected && (
        <>
          <label className={ck.field} htmlFor="regs-mail-scope">
            <span className={ck.label}>{W.audience}</span>
            <select id="regs-mail-scope" className={ck.select} value={scope} onChange={e => setScope(e.target.value as Scope)}>
              <option value="all">{W.audienceAll}</option>
              <option value="division">{W.audienceDivision}</option>
              <option value="team">{W.audienceTeam}</option>
              <option value="status">{W.audienceStatus}</option>
            </select>
          </label>
          {scope === 'division' && (
            <label className={ck.field} htmlFor="regs-mail-division">
              <span className={ck.label}>{W.division}</span>
              <select id="regs-mail-division" className={ck.select} value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                <option value="">{W.divisionPick}</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          {scope === 'team' && (
            <label className={ck.field} htmlFor="regs-mail-team">
              <span className={ck.label}>{W.team}</span>
              <select id="regs-mail-team" className={ck.select} value={teamId} onChange={e => setTeamId(e.target.value)}>
                <option value="">{W.teamPick}</option>
                {(teams ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {scope === 'status' && (
            <label className={ck.field} htmlFor="regs-mail-status">
              <span className={ck.label}>{W.status}</span>
              <select id="regs-mail-status" className={ck.select} value={status} onChange={e => setStatus(e.target.value as SeasonStatusPick)}>
                {(Object.keys(W.statusOptions) as SeasonStatusPick[]).map(k => <option key={k} value={k}>{W.statusOptions[k]}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      <TextField id="regs-mail-subject" label={W.subject} value={subject} onChange={setSubject}
        placeholder={W.subjectPlaceholder} required maxLength={200} />
      <label className={ck.field} htmlFor="regs-mail-message">
        <span className={ck.label}>{W.message}<span className={repKit.req} aria-hidden>*</span></span>
        <textarea id="regs-mail-message" className={ck.textarea} rows={6} value={message} placeholder={W.messagePlaceholder}
          onChange={e => setMessage(e.target.value)} />
      </label>
    </KitDialog>
  );
}
