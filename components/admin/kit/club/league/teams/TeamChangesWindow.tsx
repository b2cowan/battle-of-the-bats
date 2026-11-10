'use client';
/**
 * REVIEW AND EMAIL: THE FAMILIES NOT YET TOLD (House League team-change emails, TC·3 to TC·5; drawings tab 2 and tab 6).
 * One window, one row and one email per family, each child with what changed (new, or moved from the team the family was
 * last TOLD). A family can be switched off; a switched-off family is not emailed and counts as told. A family whose net
 * change is nothing (moved and moved back) is one quiet line, not a row. Children with no address are one amber line with
 * its own level. "See an example email" is a level behind a named back (the send windows' idiom).
 *
 * ⚖ The list pressed is the list shown: the press carries the read's fingerprint and the server refuses `changed` when
 * anything moved ("The list changed. Review again."), then this window reads again.
 * ⚖ Every sentence in the foot is `footerStart` (the foot-text guard); with every family switched off the Send button is
 * ABSENT, not greyed (design rulings 2026-10-12).
 */
import { useCallback, useState } from 'react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit, useDeferredLoad } from '../../RepKit';
import { MailView, SendDoor, useSendLevel } from '../../SendParts';
import LoadingState from '@/components/shared/LoadingState';
import { TC_CHIP, TC_MAIL, TC_WINDOW as W } from '@/lib/house-league-team-changes-words';
import type { TeamChangesRead } from '@/lib/house-league-team-changes-server';
import { moneyFetch } from '../../money/MoneyKit';
import { send, type TeamsRoutes } from './api';
import css from './Teams.module.css';

export interface TellResult { sent: number; skipped: number; at: string }

export default function TeamChangesWindow({ divisionId, divisionName, seasonName, routes, isPhone, onDone, onClose }: {
  divisionId: string;
  divisionName: string;
  seasonName: string;
  routes: TeamsRoutes;
  isPhone: boolean;
  /** A press landed (sent, skipped or both): the screen says so in its own pill and reads the board again. */
  onDone: (result: TellResult) => void;
  onClose: () => void;
}) {
  const [read, setRead] = useState<TeamChangesRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lv = useSendLevel(W.back);

  const load = useCallback(async () => {
    const r = await moneyFetch<TeamChangesRead>(routes.teamChanges(divisionId)).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    const data = r.data;
    setFailed(false);
    setRead(data);
    // A family that is no longer in the list cannot stay switched off.
    const still = new Set(data.families.map(f => f.email));
    setOff(prev => new Set([...prev].filter(e => still.has(e))));
  }, [routes, divisionId]);
  useDeferredLoad(true, load);

  const families = read?.families ?? [];
  const sending = families.filter(f => !off.has(f.email));
  const title = isPhone ? W.phoneTitle(families.length) : W.title(families.length);

  async function press() {
    if (!read || busy) return;
    setError(null);
    setBusy(true);
    const r = await send<{ sentFamilies: number; skippedFamilies: number; at: string }>(
      routes.teamChanges(), 'POST',
      {
        divisionId, fingerprint: read.fingerprint,
        send: sending.map(f => f.email), skip: families.filter(f => off.has(f.email)).map(f => f.email),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.code === 'changed') { setOff(new Set()); await load(); }
      return;
    }
    onDone({ sent: r.data.sentFamilies, skipped: r.data.skippedFamilies, at: r.data.at });
  }

  const toggle = (email: string) => setOff(prev => {
    const next = new Set(prev);
    if (next.has(email)) next.delete(email); else next.add(email);
    return next;
  });

  // ── The levels ───────────────────────────────────────────────────────────────────────────────────────────
  const example = families.find(f => !off.has(f.email)) ?? families[0] ?? null;
  if (lv.level === 'email' && read && example) {
    return (
      <KitDialog kind="form" size="medium" {...lv.dialog} title={W.exampleTitle} onClose={onClose}>
        <MailView to={W.exampleTo} subject={TC_MAIL.subject(example.children.map(c => c.name.split(' ')[0]), seasonName)}>
          <p><b>{TC_MAIL.heading}</b></p>
          <p>Hi there,</p>
          <p>{TC_MAIL.lead(divisionName)}</p>
          {example.children.map(c => (
            <p key={c.id}>
              <b>{TC_MAIL.childTitle(c.name, c.toTeam)}</b><br />
              {c.kind === 'moved' && c.fromTeam ? TC_MAIL.movedFrom(c.fromTeam) : TC_MAIL.newTeam} · {TC_MAIL.coach(c.coaches)}
            </p>
          ))}
          <p>{TC_MAIL.close}</p>
        </MailView>
      </KitDialog>
    );
  }
  if (lv.level === 'who' && read) {
    return (
      <KitDialog kind="form" size="medium" {...lv.dialog} title={W.noEmailTitle(read.noEmail.length)} onClose={onClose}
        footerStart={<span>{W.noEmailNote}</span>}>
        <p className={ck.hint}>{W.noEmailHint}</p>
        <div className={ck.list}>
          {read.noEmail.map(c => (
            <div key={c.id} className={ck.row}>
              <div className={ck.rowMain}>
                <span className={ck.rowTitle}>{c.name}</span>
                <span className={ck.rowSub}>{c.toTeam}</span>
              </div>
            </div>
          ))}
        </div>
      </KitDialog>
    );
  }

  // ── The step ─────────────────────────────────────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  let footerStart: React.ReactNode;
  let footer: React.ReactNode;
  if (failed && !read) {
    body = <p className={repKit.formError} role="alert">{W.loadFailed}</p>;
    footer = <button type="button" className="btn btn-outline" onClick={onClose}>{W.close}</button>;
  } else if (!read) {
    body = <LoadingState inline label={W.loading} />;
  } else {
    body = (
      <>
        <p className={ck.hint}>{isPhone ? W.phoneSub : W.sub}</p>
        {families.length === 0 && <p className={ck.hint}>{W.nobody}</p>}
        <ul className={css.tcList}>
          {families.map(f => {
            const isOff = off.has(f.email);
            return (
              <li key={f.email} className={`${css.tcFam}${isOff ? ` ${css.tcFamOff}` : ''}`}>
                <div className={css.tcFamHead}>
                  <b className={css.tcFamName}>{f.lastName} family</b>
                  {!isPhone && <span className={css.tcMail}>{f.email}</span>}
                  <span className={css.spacer} />
                  <button type="button" className={css.tcToggle} disabled={busy} onClick={() => toggle(f.email)}>
                    {isOff ? W.emailOne : W.skipOne}
                  </button>
                </div>
                <ul className={css.tcKids}>
                  {f.children.map(c => (
                    <li key={c.id} className={css.tcKid}>
                      <span className={css.tcKidName}>{c.name}</span>
                      <span className={`${css.tcChip}${c.kind === 'moved' ? ` ${css.tcChipMoved}` : ''}`}>{c.kind === 'moved' ? TC_CHIP.move : TC_CHIP.place}</span>
                      <span className={css.tcKidTeam}>{c.kind === 'moved' ? W.childMoved(c.fromTeam ?? 'their old team', c.toTeam) : c.toTeam}</span>
                    </li>
                  ))}
                </ul>
                {isOff && <p className={css.tcOffNote}>{W.offNote(new Set(f.children.map(c => c.toTeam)).size)}</p>}
              </li>
            );
          })}
        </ul>
        {read.quiet.map(q => (
          <p key={q.email} className={css.tcQuiet}>
            {W.quiet(q.lastName, q.children.map(c => c.name.split(' ')[0]), q.children[0].team)}
          </p>
        ))}
        {read.noEmail.length > 0 && (
          <p className={css.tcWarnLine}>
            {W.noEmail(read.noEmail.length)}{' '}
            <button type="button" className={repKit.inlineLink} onClick={() => lv.open('who')}>{W.seeThem}</button>
          </p>
        )}
        {families.length > 0 && example && <SendDoor onOpen={() => lv.open('email')}>{W.seeExample}</SendDoor>}
        {error && <p className={repKit.formError} role="alert">{error}</p>}
      </>
    );
    const none = families.length > 0 && sending.length === 0;
    footerStart = families.length === 0 ? undefined
      : none ? <span className={css.tcAllOff}>{W.allOff}</span>
        : <span>{isPhone ? W.phoneFoot(sending.length) : W.footStart(sending.length)}</span>;
    footer = (
      <>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{families.length === 0 ? W.close : W.cancel}</button>
        {/* Absent, not greyed, when every family is switched off. */}
        {sending.length > 0 && (
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void press()}>
            {busy ? W.working : W.send(sending.length)}
          </button>
        )}
      </>
    );
  }

  return (
    <KitDialog kind="form" size="medium" eyebrow={`${seasonName} · ${divisionName}`} title={title} onClose={onClose} busy={busy}
      footerStart={footerStart} footer={footer}>
      {body}
    </KitDialog>
  );
}

