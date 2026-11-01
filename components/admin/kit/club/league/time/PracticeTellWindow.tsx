'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { Callout, repKit, useDeferredLoad } from '../../RepKit';
import { EmailWordsSample, MailView, SendDoor, useSendLevel } from '../../SendParts';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { PRACTICE_TELL_WORDS as W } from '@/lib/league-practice-tell';
import type { LeftOutFamily, TellRead } from '@/lib/league-practice-tell-server';
import cts from '../schedule/ChangesToSend.module.css';
import p from './PracticeTime.module.css';

/**
 * TELL THE FAMILIES THEIR PRACTICE TIMES (House League Stage 9d-3 Parts 2–3; frames c1, c1b, c2, c3; words
 * HOUSE_LEAGUE_STAGE9D3_COPY.md sections A–B, accepted 2026-11-01). The step after Practice time's hand-out (it opens as
 * the hand-out lands), and the door of the schedule's amber reminder. Nothing goes until Send is pressed; "Not yet" leaves
 * the reminder. A second hand-out reopens it as a CHANGE for exactly the told teams whose practices now differ (9d3·6),
 * with the teams never told getting their first email in the same send.
 *
 * ⚖ The numbers pressed are the server's (the step's read): the press carries what it showed — each team and the told
 * time it read, and how many families — and the server refuses `changed` when either moved (frame c3's "This changed while
 * you were looking"), `already` on a second press (it reads again: "Everyone has been told").
 * ⚖ "See an example" and "See them" are levels of this window behind a named back (the send windows' idiom).
 * ⚖ The owner, an admin and a league admin reach it; a registrar or treasurer never does (the route is 'run').
 */

type Phase =
  | { kind: 'step' }
  | { kind: 'sending'; families: number }
  | { kind: 'result'; reached: number; families: number; failed: number }
  | { kind: 'couldnt' }
  | { kind: 'changed' };

type SendBody = { reached?: number; families?: number; failed?: number; code?: string; error?: string };

/** POST to the route: the response, and its body when one came back. */
async function post(url: string, body: object): Promise<{ r: Response | null; data: SendBody | null }> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  return { r, data: (r ? await r.json().catch(() => null) : null) as SendBody | null };
}

function Notice({ tone, title, text, alert }: { tone: string; title: string; text: string; alert?: boolean }) {
  return (
    <div className={`${ck.notice} ${tone} ${p.result}`} role={alert ? 'alert' : undefined}>
      <b>{title}</b><span>{text}</span>
    </div>
  );
}

export default function PracticeTellWindow({ orgSlug, seasonId, seasonName, divisionId, divisionName, onClose, onHandOut, onSent }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  divisionId: string;
  divisionName: string;
  onClose: () => void;
  /** "Hand out for them" (frame c1b): Practice time, for the teams with none. */
  onHandOut: () => void;
  /** A send landed (the page reads its reminder again). */
  onSent: () => void;
}) {
  const isPhone = useIsPhone();
  const [read, setRead] = useState<TellRead | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'step' });
  const [error, setError] = useState<string | null>(null);
  const q = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const url = `/api/admin/house-league/seasons/${seasonId}/practice-tell${q}`;

  const load = useCallback(async () => {
    const r = await fetch(`${url}&divisionId=${encodeURIComponent(divisionId)}`, { cache: 'no-store' }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !data) { setFailed((data as { error?: string } | null)?.error ?? W.refusals.loadFailed); return; }
    setFailed(null);
    setRead(data as TellRead);
  }, [url, divisionId]);
  useDeferredLoad(true, load);

  const lv = useSendLevel(W.title);
  const level = lv.level;

  function landed(data: SendBody) {
    setPhase({ kind: 'result', reached: data.reached ?? 0, families: data.families ?? 0, failed: data.failed ?? 0 });
    onSent();
    void load();
  }

  async function send() {
    if (!read) return;
    setError(null);
    setPhase({ kind: 'sending', families: read.households });
    const { r, data } = await post(url, { action: 'send', divisionId, saw: read.tell, families: read.households });
    if (r?.ok && data) { landed(data); return; }
    if (data?.code === 'changed') { setPhase({ kind: 'changed' }); return; }
    if (data?.code === 'already') { setPhase({ kind: 'step' }); await load(); return; }
    if (!r || (r.status >= 500 && !data)) { setPhase({ kind: 'couldnt' }); return; }
    setPhase({ kind: 'step' });
    setError(data?.error ?? W.couldnt);
  }

  async function sendAgain(noticeId: string) {
    setError(null);
    setPhase({ kind: 'sending', families: read?.open?.missed ?? 0 });
    const { r, data } = await post(url, { action: 'resend', noticeId });
    if (r?.ok && data) { lv.open('form'); landed(data); return; }
    setPhase({ kind: 'step' });
    setError(data?.error ?? W.couldnt);
  }

  const busy = phase.kind === 'sending';
  const changeMode = !!read?.tell.some(t => t.kind === 'change');
  const told = !!read && read.tell.length === 0 && !!read.last;
  const missed: LeftOutFamily[] = read ? [...read.leftOut, ...(read.open?.missedFamilies ?? [])] : [];
  const title = isPhone ? W.titlePhone : changeMode ? W.changeTitle : W.title;

  // ── The levels: an example email; who won't get it ───────────────────────────────────────────────────────
  if (level === 'email' && read?.sample) {
    return (
      <KitDialog kind="form" size="medium" {...lv.dialog} title={W.exampleTitle} onClose={onClose}>
        <MailView to={read.sample.to} subject={read.sample.words.subject}><EmailWordsSample w={read.sample.words} /></MailView>
      </KitDialog>
    );
  }
  if (level === 'who' && read) {
    return (
      <SeeThem orgSlug={orgSlug} seasonId={seasonId} families={missed} onClose={onClose} busy={busy}
        onFixed={load} onDone={() => lv.open('form')}
        sendAgain={read.open ? { n: read.open.missed, run: () => void sendAgain(read.open!.noticeId) } : null} />
    );
  }

  // ── The step ──────────────────────────────────────────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  let footer: React.ReactNode = <button type="button" className="btn btn-outline" onClick={onClose}>{W.close}</button>;
  let footerStart: React.ReactNode = null;

  if (failed && !read) {
    body = <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{failed}</p>;
  } else if (!read) {
    body = <LoadingState inline label={W.loading} />;
  } else if (phase.kind === 'couldnt') {
    body = <Notice tone={ck.noticeBad} title={W.couldntTitle} text={W.couldnt} alert />;
    footerStart = <span>{W.couldntFoot}</span>;
    footer = <>
      <button type="button" className="btn btn-outline" onClick={onClose}>{W.close}</button>
      <button type="button" className="btn btn-lime" onClick={() => void send()}>{W.tryAgain}</button>
    </>;
  } else if (phase.kind === 'changed') {
    body = <Notice tone={ck.noticeWarn} title={W.changedTitle} text={W.changed} alert />;
    footerStart = <span>{W.changedFoot}</span>;
    footer = <button type="button" className="btn btn-lime" onClick={() => { setPhase({ kind: 'step' }); void load(); }}>{W.review}</button>;
  } else if (phase.kind === 'result') {
    const notGone = phase.failed;
    body = (
      <div className={`${ck.notice} ${notGone ? ck.noticeWarn : ck.noticeGood} ${p.result}`} aria-live="polite">
        <b>{W.result(phase.reached, phase.families)}</b>
        {notGone > 0 && <span>{W.didntGo(notGone)} <button type="button" className={repKit.inlineLink} onClick={() => lv.open('who')}>{W.seeThem}</button></span>}
        <span>{W.resultHistory}</span>
      </div>
    );
    footer = <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>;
  } else if (read.finished) {
    body = <p className={ck.hint}>{W.refusals.finished}</p>;
  } else if (!read.teamsPublished) {
    // Placements are still a draft: families don't know their team yet, so nobody is named and nothing can be sent.
    body = <p className={ck.hint}>{W.teamsFirst(divisionName)}</p>;
    footerStart = <span>{W.teamsFirstFoot}</span>;
    footer = <>
      <button type="button" className="btn btn-outline" onClick={onClose}>{W.close}</button>
      <Link className="btn btn-lime" href={`/${orgSlug}/admin/house-league/seasons/${seasonId}/teams`}>{W.teamsFirstDoor}</Link>
    </>;
  } else if (told) {
    const last = read.last!;
    body = (
      <>
        <Notice tone={ck.noticeGood} title={W.everyoneTitle} text={W.everyone(last.by, last.families, last.date, last.time)} />
        <p className={ck.hint}>{W.everyoneFoot}</p>
        {missed.length > 0 && <LeftOutLine n={missed.length} isPhone={isPhone} onOpen={() => lv.open('who')} />}
        {error && <p className={repKit.formError} role="alert">{error}</p>}
      </>
    );
    // A family still to reach (missed, or given an email since): the same "Send again" the See them window offers.
    footer = read.open
      ? <>
        <button type="button" className="btn btn-outline" onClick={onClose}>{W.done}</button>
        <button type="button" className="btn btn-lime" onClick={() => void sendAgain(read.open!.noticeId)}>{W.sendAgain(read.open.missed)}</button>
      </>
      : <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>;
  } else if (read.tell.length === 0) {
    body = <p className={ck.hint}>{W.refusals.nothing}</p>;
  } else {
    const changed = read.tell.filter(t => t.kind === 'change').length;
    const fresh = read.tell.length - changed;
    const someTeams = read.noPractices.teams.length > 0;
    body = (
      <>
        <p className={p.statement}>
          {changeMode
            ? W.changeStatement(changed, read.toldHouseholds, fresh, read.freshHouseholds)
            : read.households > 0 ? W.lead(read.households, read.rows.filter(r => r.families > 0).length) : W.leadNobody}
        </p>
        {/* Who gets what: a row per team being told, then what the send adds up to. */}
        <ul className={p.teams}>
          {read.rows.map(r => (
            <li key={r.teamId} className={p.teamRow}>
              <b>{r.name}{changeMode && r.kind === 'change' && <span className={p.rowTag}>{W.changedTag}</span>}</b>
              <span className={p.teamWhen}>{r.when || W.rowNoTimes}{r.where && <small>{r.where}</small>}</span>
              <span className={p.teamCount}>{W.rowFamilies(r.families)}</span>
            </li>
          ))}
          <li className={`${p.teamRow} ${p.teamTotal}`}>
            <b>{W.totalLabel}</b>
            <span className={p.teamWhen}>{W.totalWords(read.twoTeams)}</span>
            <span className={p.teamCount}>{W.totalEmails(read.households)}</span>
          </li>
        </ul>
        {/* The one thing still fixable before sending: families the email can't reach. */}
        {read.leftOut.length > 0 && (
          <Callout tone="warn" action={<button type="button" className="btn btn-outline" onClick={() => lv.open('who')}>{W.seeThem}</button>}>
            {isPhone ? W.leftOutRowPhone(read.leftOut.length) : W.leftOutRow(read.leftOut.length, read.households > 0)}
          </Callout>
        )}
        {someTeams && (
          <div className={`${ck.notice} ${ck.noticeWarn} ${p.result}`}>
            <span>{W.noPractices(read.noPractices.teams, read.noPractices.families)}</span>
            <button type="button" className={`${ck.link} ${p.door}`} onClick={onHandOut} disabled={busy}>{W.handOutFor}</button>
          </div>
        )}
        <div className={p.gets}>
          <span className={p.getsBody}>{W.getsLine}</span>
          {read.sample && <SendDoor onOpen={() => lv.open('email')}>{W.seeExample}</SendDoor>}
        </div>
        {error && <p className={repKit.formError} role="alert">{error}</p>}
      </>
    );
    footerStart = busy
      ? <span>{W.sending(phase.families)} {!isPhone && W.sendingHint}</span>
      : undefined;
    footer = <>
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.notYet}</button>
      <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || read.households === 0}>
        {isPhone ? W.sendPhone(read.households) : W.send(read.households)}
      </button>
    </>;
  }

  return (
    <KitDialog kind="form" size="medium" eyebrow={`${seasonName} · ${divisionName}`} title={title} onClose={onClose} busy={busy}
      footerStart={footerStart} footer={footer}>
      {body}
    </KitDialog>
  );
}

function LeftOutLine({ n, isPhone, onOpen }: { n: number; isPhone: boolean; onOpen: () => void }) {
  return (
    <p className={ck.hint}>
      {isPhone ? W.leftOutPhone(n) : W.leftOut(n)}{' '}
      <button type="button" className={repKit.inlineLink} onClick={onOpen}>{W.seeThem}</button>
    </p>
  );
}

/**
 * "See them" (frame c1's level): each family that won't get this, why, and the fix — an email added, or one the mail
 * refused corrected (owner 2026-10-31: built now; the league's runners). A fixed family joins the send on "Send again".
 */
function SeeThem({ orgSlug, seasonId, families, onClose, onFixed, onDone, sendAgain, busy }: {
  orgSlug: string; seasonId: string; families: LeftOutFamily[];
  onClose: () => void; onFixed: () => Promise<void>; onDone: () => void;
  sendAgain: { n: number; run: () => void } | null; busy: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(regId: string) {
    setSaving(true); setError(null);
    const r = await fetch(`/api/admin/house-league/seasons/${seasonId}/registrations/${regId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guardianEmail: value }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { error?: string } | null;
    setSaving(false);
    if (!r?.ok) { setError(data?.error ?? W.couldnt); return; }
    setEditing(null); setValue('');
    await onFixed();
  }

  return (
    <KitDialog kind="form" size="medium" back={{ label: W.title, onBack: onDone }} levelKey="who" title={W.seeThemTitle(families.length)} onClose={onClose} busy={busy || saving}
      footerStart={<span>{W.seeThemFoot}</span>}
      footer={<>
        <button type="button" className="btn btn-outline" onClick={onDone} disabled={busy || saving}>{W.done}</button>
        {sendAgain && sendAgain.n > 0 && (
          <button type="button" className="btn btn-lime" onClick={sendAgain.run} disabled={busy || saving}>{W.sendAgain(sendAgain.n)}</button>
        )}
      </>}>
      <p className={ck.hint}>{W.seeThemHint}</p>
      <div className={ck.list}>
        {families.map(f => (
          <div key={f.registrationId} className={ck.row}>
            <div className={ck.rowMain}>
              <span className={ck.rowTitle}>{f.name}</span>
              <span className={ck.rowSub}>{f.team} · {f.email ? W.refused(f.email) : W.noEmailOnFile}</span>
              {editing === f.registrationId && (
                <div className={p.fix}>
                  <input className={ck.input} type="email" autoComplete="off" value={value} disabled={saving}
                    aria-label={f.email ? W.fixEmail : W.addEmail} onChange={e => setValue(e.target.value)} />
                  <button type="button" className="btn btn-lime" disabled={saving || !value.trim()} onClick={() => void save(f.registrationId)}>{W.done}</button>
                </div>
              )}
            </div>
            {editing !== f.registrationId && (
              <button type="button" className={`${ck.link} ${p.door}`} disabled={saving}
                onClick={() => { setEditing(f.registrationId); setValue(f.email ?? ''); setError(null); }}>
                {f.email ? W.fixEmail : W.addEmail}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
    </KitDialog>
  );
}

/**
 * The schedule's one action row (frame c3, redrawn owner 2026-10-31): "{n} teams' families haven't been sent their practice
 * times" with its button, in the house's white card with an amber edge, the count in the waiting-count chip. It is the
 * first thing under the title, and absent when nobody is owed anything.
 */
export function PracticeTellReminder({ teams, onOpen }: { teams: number; onOpen: () => void }) {
  if (teams <= 0) return null;
  return (
    <Callout tone="warn" role="status" action={<button type="button" className="btn btn-outline" onClick={onOpen}>{W.tellThem}</button>}>
      <span className={p.reminder}>
        <span className={cts.count} aria-hidden>{teams > 9 ? '9+' : teams}</span>
        <span>{W.reminder(teams)}</span>
      </span>
    </Callout>
  );
}
