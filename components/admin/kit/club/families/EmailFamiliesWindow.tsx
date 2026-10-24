'use client';
/**
 * EMAIL FAMILIES (Club Tier Stage 7c — Asks 6 and 7; drawing 4). The one club send window (the 2026-10-11 ruling —
 * `../SendParts`): what sending does in one statement; Who — every family, some rep teams (ticked, each with its count)
 * or one house-league season, each a row with its count, offered only where the club runs it; the head coach copy; Subject
 * and Message; "Nobody to send to" for this choice's children with no family on file; See the email (the family envelope
 * as a guardian receives it); Last sent; and the foot — the sentence left ("88 families get it. 7 opted out and won't."),
 * Cancel and the lime that counts who it reaches, right (KitDialog `footerStart`). A send is a create, so it asks: Send.
 *
 * The server decides on the press (lib/families-email.ts): the same audience re-counted, the claim (a double press, two
 * admins at once, the club's three a day), the batches through the family door, the log. A press that lost a race — the
 * count changed, the cap went, it was just sent — keeps the message typed and says why at the foot's left, amber. The cap and
 * a double press take the lime's place; a changed count leaves it, to be pressed again on the new number.
 * "Show them" leaves for the list only while nothing is typed (absent, not disabled, once a message is being written —
 * leaving would lose it).
 *
 * ⚠ The words are /marketing's (lib/families-words.ts — drafts as drawn). ⚠ Never the word "Messages".
 */
import { useCallback, useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit, useLatestRead } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { SampleBand, SamplePlatformLine, SendRow, SendRows, SendSample, SendStanding, sendEnvelope } from '../SendParts';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import { FAMILY_EMAIL_WORDS as W, FAMILY_LIST_WORDS as LW } from '@/lib/families-words';
import type { FamilyListKey } from '@/lib/families-lists';
import { familyEnvelopeFooterWords } from '@/lib/family-mail-footer';
import type { FamilyEmailPreview } from '@/lib/families-email';

type Kind = 'every' | 'teams' | 'season' | 'list';

export default function EmailFamiliesWindow({ q, initialList, onClose, onShowNoFamily, onSent }: {
  /** `orgSlug=…` */
  q: string;
  /** Opened from a Families list ("Email these families"): Who starts on that list. */
  initialList?: FamilyListKey;
  onClose: () => void;
  /** "Show them": the window closes and Families lists the children with no family on file. */
  onShowNoFamily: () => void;
  /** The send went: the page says so. */
  onSent: (text: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(initialList ? 'list' : 'every');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [list, setList] = useState<FamilyListKey | ''>(initialList ?? '');
  const [copyCoaches, setCopyCoaches] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<FamilyEmailPreview | null>(null);
  const choices = preview?.choices ?? null;
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [standing, setStanding] = useState<string | null>(null);
  // A count that changed while the sender wrote: said once, amber, at the foot's left — and the lime stays, since pressing
  // Send again on the new number is exactly what the sender may do. It belongs to the pick it was said about.
  const [changed, setChanged] = useState<{ text: string; who: string } | null>(null);

  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the Emails tab — the send windows' shape).
  const base = `/api/admin/families/email?${q}`;
  const scopeQuery = kind === 'teams' ? `&kind=teams&teamIds=${encodeURIComponent([...teamIds].sort().join(','))}`
    : kind === 'season' ? `&kind=season&seasonId=${encodeURIComponent(seasonId)}`
    : kind === 'list' ? `&kind=list&list=${encodeURIComponent(list)}` : '&kind=every';

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<FamilyEmailPreview>(`${base}${scopeQuery}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setPreview(r.data);
  }, [base, scopeQuery, beginRead]);
  // Every change of Who re-reads the count (the server's one audience — never a sum in the browser: two teams can
  // share a family). A tick in the teams list waits a moment, so a run of ticks is one read.
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, kind === 'teams' ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, kind]);

  // A season choice starts on the first season (one season: the row itself names it).
  useEffect(() => {
    if (kind === 'season' && !seasonId && choices?.seasons[0]) setSeasonId(choices.seasons[0].seasonId);
  }, [kind, seasonId, choices]);

  // A list choice starts on the first list the club has. A window opened ON a list keeps it even when nobody on it can be
  // emailed (a family that is only the sender): it says so in the foot, rather than quietly becoming another list.
  useEffect(() => {
    if (kind === 'list' && choices && !list && choices.lists[0]) setList(choices.lists[0].list);
  }, [kind, list, choices]);

  const typed = subject.trim() !== '' || message.trim() !== '';
  const ready = !!preview && !failed && preview.scope.kind === kind;
  // The count on the lime belongs to THIS pick: after a tick or a season change it is the last pick's until the read lands.
  const sc = preview?.scope;
  const fresh = !!sc && sc.kind === kind && (sc.kind === 'teams' ? sc.teamIds.join(',') === [...teamIds].sort().join(',')
    : sc.kind === 'season' ? !!seasonId && sc.seasonId === seasonId
    : sc.kind === 'list' ? !!list && sc.list === list : true);
  const families = ready ? preview!.families : 0;
  const capHeld = preview?.cap.capped ? W.capReason(preview.cap.nextAt) : null;
  const nobody = ready && fresh && families === 0
    ? kind === 'teams' && teamIds.length === 0 ? W.pickTeams
      : preview!.optedOut > 0 ? W.nobodyOptedOut : W.nobodyAtAll
    : null;
  const held = standing ?? capHeld ?? nobody;
  const whoKey = `${kind}:${[...teamIds].sort().join(',')}:${seasonId}:${list}`;

  async function send() {
    if (busy || !ready || !fresh || held) return;
    if (!subject.trim()) { setError(W.needSubject); return; }
    if (!message.trim()) { setError(W.needMessage); return; }
    setBusy(true); setError(''); setChanged(null);
    try {
      const r = await moneyFetch<{ reached?: number; families?: number; coaches?: number; code?: string; error?: string }>(
        base, jsonInit('POST', {
          kind, teamIds: kind === 'teams' ? teamIds : undefined, seasonId: kind === 'season' ? seasonId : undefined,
          list: kind === 'list' ? list : undefined,
          subject, body: message, copyCoaches: copyCoaches && preview!.coaches > 0, expected: families,
        }));
      if (r.ok) {
        const coaches = r.data.coaches ?? 0;
        onSent(`${W.sent(r.data.reached ?? 0, r.data.families ?? families)}${coaches > 0 ? ` ${W.coachesCopied(coaches)}` : ''}`);
        return;
      }
      const code = r.data?.code;
      // A server error with no reason of its own (a gateway timeout on a long send) may have gone out in part: say so.
      if (!code && r.status >= 500) { setError(W.unknown); return; }
      if (code === 'cap' || code === 'just_sent') setStanding(refusalText(r.data, W.failed));
      else if (code === 'changed') { setChanged({ text: refusalText(r.data, W.failed), who: whoKey }); void load(); }
      else if (code === 'nobody') { setError(refusalText(r.data, W.failed)); void load(); }
      else setError(refusalText(r.data, W.failed));
    } catch {
      // No answer: it may have gone. Say so, rather than inviting a second press.
      setError(W.unknown);
    } finally {
      setBusy(false);
    }
  }

  const pickKind = (next: Kind) => { setKind(next); setStanding(null); setError(''); };
  const toggleTeam = (id: string, on: boolean) => {
    setTeamIds(ids => (on ? [...new Set([...ids, id])] : ids.filter(x => x !== id)));
    setStanding(null);
  };
  const footer = preview ? familyEnvelopeFooterWords(preview.orgName, preview.reason) : null;
  const hasRep = (choices?.teams.length ?? 0) > 0;
  const hasLeague = (choices?.seasons.length ?? 0) > 0;
  const hasLists = (choices?.lists.length ?? 0) > 0 || kind === 'list';
  const oneSeason = choices?.seasons.length === 1 ? choices.seasons[0] : null;
  const last = preview?.lastSent ?? null;
  const sentence = ready ? `${W.reach(families, preview!.optedOut)}${preview!.senderSkipped ? ` ${W.youNotCounted}` : ''}` : null;

  return (
    <KitDialog
      kind="form"
      size="medium"
      eyebrow={W.eyebrow}
      title={W.title}
      onClose={onClose}
      busy={busy}
      dirty={typed}
      footerStart={held ? <SendStanding>{held}</SendStanding> : changed?.who === whoKey ? <SendStanding>{changed.text}</SendStanding> : sentence ? <p className={ck.hint} role="status">{sentence}</p> : undefined}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {!held && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !ready || !fresh}>
              {busy ? W.sending : W.send(families)}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {failed && !choices ? (
        <p className={repKit.formError}>{W.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{W.tryAgain}</button></p>
      ) : !choices || !preview ? (
        <LoadingState inline label="Loading who this reaches…" />
      ) : (
        <>
          <Statement lead={W.statement} />
          <p className={repKit.factsLabel} id="email-families-who-label">{W.who}</p>
          <SendRows group={{ radio: true, labelledBy: 'email-families-who-label' }}>
            <SendRow
              pick={{ checked: kind === 'every', onChange: on => on && pickKind('every'), radio: 'email-families-who' }}
              title={<>{W.every} · {choices.every}</>}
              sub={W.everySub(hasRep, hasLeague)}
            />
            {hasRep && (
              <SendRow
                pick={{ checked: kind === 'teams', onChange: on => on && pickKind('teams'), radio: 'email-families-who' }}
                title={W.teams}
                sub={W.teamsSub}
              />
            )}
            {hasLeague && (
              <SendRow
                pick={{ checked: kind === 'season', onChange: on => on && pickKind('season'), radio: 'email-families-who' }}
                title={W.season}
                sub={oneSeason ? `${oneSeason.name} · ${W.count(oneSeason.families)}` : undefined}
              />
            )}
            {hasLists && (
              <SendRow
                pick={{ checked: kind === 'list', onChange: on => on && pickKind('list'), radio: 'email-families-who' }}
                title={W.list}
                sub={W.listSub}
              />
            )}
          </SendRows>
          {kind === 'teams' && (
            <SendRows group={{ label: W.teams }}>
              {choices.teams.map(t => (
                <SendRow key={t.teamId} title={t.teamName} sub={W.count(t.families)}
                  pick={{ checked: teamIds.includes(t.teamId), onChange: on => toggleTeam(t.teamId, on) }} />
              ))}
            </SendRows>
          )}
          {/* The name on the first line, its count smaller below — the portal's two-line dropdown (the kit's
              Role picker shape). A native `<select>` could only run them together on one line. */}
          {kind === 'season' && !oneSeason && (
            <div className={ck.field}>
              <label className={ck.label} htmlFor="email-families-season">{W.seasonLabel}</label>
              <SublinedChoice id="email-families-season" label={W.seasonLabel} variant="toolbar"
                triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                options={choices.seasons.map(s => ({ value: s.seasonId, name: s.name, sub: W.count(s.families) }))}
                value={seasonId || null}
                onChange={v => { setSeasonId(v); setStanding(null); }} />
            </div>
          )}
          {kind === 'list' && (
            <div className={ck.field}>
              <label className={ck.label} htmlFor="email-families-list">{W.listLabel}</label>
              <SublinedChoice id="email-families-list" label={W.listLabel} variant="toolbar"
                triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                options={(list && !choices.lists.some(l => l.list === list) ? [...choices.lists, { list, families: 0 }] : choices.lists)
                  .map(l => ({ value: l.list, name: LW.questions[l.list], sub: W.count(l.families) }))}
                value={list || null}
                onChange={v => { setList(v); setStanding(null); }} />
            </div>
          )}
          {ready && preview.coaches > 0 && (
            <SendRows>
              <SendRow title={W.copyCoaches(preview.coaches)} pick={{ checked: copyCoaches, onChange: setCopyCoaches }} />
            </SendRows>
          )}
          <label className={ck.field} htmlFor="email-families-subject" style={{ marginTop: '0.9rem' }}>
            <span className={ck.label}>{W.subject}<span className={ck.required} aria-hidden>*</span></span>
            <input id="email-families-subject" className={ck.input} value={subject} maxLength={200}
              onChange={e => { setSubject(e.target.value); setError(''); }} aria-required data-autofocus="" />
          </label>
          <label className={ck.field} htmlFor="email-families-body">
            <span className={ck.label}>{W.message}<span className={ck.required} aria-hidden>*</span></span>
            <textarea id="email-families-body" className={ck.textarea} value={message} maxLength={5000} rows={7}
              onChange={e => { setMessage(e.target.value); setError(''); }} aria-required />
          </label>
          {ready && preview.noFamily > 0 && (
            <p className={ck.hint}>
              <b>{W.nobodyLead}</b> {W.noFamily(preview.noFamily)}
              {!typed && <> <button type="button" className={repKit.inlineLink} onClick={onShowNoFamily}>{W.showThem}</button></>}
            </p>
          )}
          {footer && (
            <SendSample summary={W.seeEmail}>
              {preview.club ? <SampleBand club={preview.club} /> : <span className={sendEnvelope.kicker}>{preview.orgName}</span>}
              <p><b>{subject.trim() || W.subject}</b></p>
              <p className={sendEnvelope.body}>{message.trim() || W.message}</p>
              <p className={sendEnvelope.foot}>{footer.sentBy}<br />{preview.replyLine && <>{preview.replyLine}<br /></>}<u>{footer.unsubscribe}</u></p>
              {preview.club && <SamplePlatformLine clubName={preview.club.name} />}
            </SendSample>
          )}
          <p className={ck.hint}>
            {last ? `${W.lastSent} ${W.lastSentValue(last.at, last.by, last.subject, last.families)}.` : `${W.neverSent}.`}
          </p>
        </>
      )}
    </KitDialog>
  );
}
