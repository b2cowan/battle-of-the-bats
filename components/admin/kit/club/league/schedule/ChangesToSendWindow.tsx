'use client';
/**
 * CHANGES TO SEND (House League 9d-2b Part 3; rulings 9d2·16, 9d2b; frame f2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md
 * "Stage 9d-2b" f2). Every game in the division whose change is waiting, as families will hear it — the NET effect
 * (moved twice reads once; moved and moved back is not listed) — with who hears each and how many families, Undo on each,
 * and one press that sends them all: one email per family. A game played since is listed and never emailed.
 * The server works out what to tell families from the rows the window saw (`changeIds`): a change landing or undone while
 * it is open is refused ("changed"), never half-sent. The button reads "Sending…" and can't be pressed twice.
 */
import { useCallback, useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { NoticePill, repKit } from '../../RepKit';
import { RotateCcw } from 'lucide-react';
import { formatInOrgZone, utcToZonedInputs } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import { CHANGES_TO_SEND_WORDS as W, reachedLine } from '@/lib/league-schedule-words';
import { SampleMail, SendDoor, useEmailSample, useSendLevel } from '../../SendParts';
import type { GameSnapshot, NetChange } from '@/lib/league-game-changes';
import t from './ChangesToSend.module.css';

interface HeldRow { gameId: string; news: NetChange | null; played: boolean; homeTeamId: string; awayTeamId: string; families: number }
interface Tray {
  games: HeldRow[];
  changeIds: string[];
  families: number;
  teams: number;
  household: { family: string; parts: { child: string; teamId: string }[] } | null;
}

const dayOf = (iso: string) => formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const clockOf = (iso: string) => formatTime(utcToZonedInputs(iso).time);
const dateOf = (iso: string) => utcToZonedInputs(iso).date;

/** One row's line (f2): "Orioles vs Twins · Thu, Jun 24: 6:00 p.m. → 7:30 p.m." and its kin. The family's email says it
 *  as Now / Was (`emailChangeLine`, lib/league-schedule-email.ts) — different words on purpose. */
export function trayChangeLine(title: string, n: NetChange, placeOf: (s: GameSnapshot) => string): string {
  const was = n.before ?? n.now;
  const day = was.scheduledAt ? dayOf(was.scheduledAt) : '';
  const head = (tail: string) => (day ? `${title} · ${day}: ${tail}` : `${title}: ${tail}`);
  if ((n.kind === 'moved' || n.kind === 'given_date') && n.before?.scheduledAt && n.now.scheduledAt) {
    return dateOf(n.before.scheduledAt) === dateOf(n.now.scheduledAt)
      ? W.rowFromTo(title, day, clockOf(n.before.scheduledAt), clockOf(n.now.scheduledAt))
      : W.rowNow(title, day, `${dayOf(n.now.scheduledAt)}, ${clockOf(n.now.scheduledAt)}`);
  }
  if (n.kind === 'place' && n.before) return W.rowFromTo(title, day, placeOf(n.before), placeOf(n.now));
  return head(W.state[n.kind] ?? n.kind);
}

export default function ChangesToSendWindow({ division, api, orgQuery, titleOf, teamName, placeOf, onSent, onUndone, onClose }: {
  division: { id: string; name: string };
  /** `/api/admin/house-league/seasons/{id}/schedule` */
  api: string;
  orgQuery: string;
  /** "Orioles vs Twins", by game id. */
  titleOf: (gameId: string) => string;
  teamName: (teamId: string) => string;
  /** A place as the row says it ("Diamond 2"). */
  placeOf: (s: GameSnapshot) => string;
  /** The send landed: the page reads the season again and says how far it went. */
  onSent: (said: string) => void;
  /** An Undo landed, or the tray moved on under it (a refused press): the page reads again; the tray reads again too. */
  onUndone: () => void;
  onClose: () => void;
}) {
  const [tray, setTray] = useState<Tray | null>(null);
  const [busy, setBusy] = useState(false);
  /** The Send itself is working (not an Undo): the footer and the button say "Sending…" only then. */
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** "Undone. Orioles vs Twins is back as families last heard." — the window's own passing status. */
  const [said, setSaid] = useState<string | null>(null);
  const sep = orgQuery ? '&' : '?';
  const url = `${api}/changes${orgQuery}`;

  /** The division's waiting changes, or the sentence to say why they didn't read. */
  const fetchTray = useCallback(async (): Promise<{ tray: Tray } | { error: string }> => {
    const r = await fetch(`${url}${sep}divisionId=${encodeURIComponent(division.id)}`, { cache: 'no-store' }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    return r?.ok && data ? { tray: data as Tray } : { error: (data as { error?: string } | null)?.error ?? W.failed };
  }, [url, sep, division.id]);
  const show = (got: { tray: Tray } | { error: string }) => ('tray' in got ? setTray(got.tray) : setError(got.error));
  useEffect(() => {
    let live = true;
    void fetchTray().then(got => { if (live) show(got); });
    return () => { live = false; };
  }, [fetchTray]);
  const read = async () => show(await fetchTray());

  // "See their email" (f2, Part 4): the family the note names, as the send would email them — read when first opened.
  const lv = useSendLevel(W.title);
  const email = useEmailSample(`${url}${sep}divisionId=${encodeURIComponent(division.id)}&preview=1`);

  async function send() {
    if (!tray) return;
    setBusy(true); setSending(true); setError(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: division.id, changeIds: tray.changeIds }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { families?: number; reached?: number; failed?: number; silent?: boolean; news?: number; error?: string } | null;
    if (!r?.ok || !data) {
      setError(!r || (r.status >= 500 && !data) ? W.unsure : data?.error ?? W.failed);
      // Refused because the tray moved on (someone else sent or undid): read it again, and the page's count with it, so the
      // next press carries what is really waiting.
      if (r?.status === 409) { onUndone(); await read(); }
      setBusy(false); setSending(false);
      return;
    }
    setBusy(false); setSending(false);
    const n = data.families ?? 0, failed = data.failed ?? 0;
    // "Reached 64 of 66 families · 2 didn't send." — the season's Email families history offers the rest again.
    onSent(!data.news || data.silent ? W.netNothing : failed > 0 ? reachedLine(data.reached ?? 0, n, failed) : W.sent(n));
  }

  async function undo(gameId: string) {
    setBusy(true); setError(null);
    const r = await fetch(`${api}/${gameId}/undo${orgQuery}`, { method: 'POST' }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { error?: string } | null;
    if (!r?.ok) {
      setError(data?.error ?? W.failed);
      if (r?.status === 409) { onUndone(); await read(); }
      setBusy(false);
      return;
    }
    setSaid(W.undone(titleOf(gameId)));
    onUndone();
    // Busy until the tray is read again, so Send and Undo are never live against rows already undone.
    await read();
    setBusy(false);
  }

  const rows = tray?.games ?? [];
  const household = tray?.household;
  return (
    <KitDialog kind="form" size="medium" {...lv.dialog} eyebrow={division.name} title={W.title} onClose={onClose} busy={busy}
      status={said ? <NoticePill inline message={said} onDone={() => setSaid(null)} /> : undefined}
      footerStart={rows.length > 0 && tray ? <span>{sending ? W.sending : W.foot(tray.families, tray.teams)}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{W.notYet}</DialogCancel>
          {rows.length > 0 && (
            <button type="button" className="btn btn-lime" disabled={busy || !tray} onClick={() => void send()}>
              {sending ? W.sending : W.send(rows.length)}
            </button>
          )}
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {lv.level === 'email' ? (
        <SampleMail state={email} failedText={W.sampleFailed} />
      ) : (<>
      {tray && rows.length === 0 && <p className={ck.hint}>{W.empty}</p>}
      {rows.length > 0 && (
        <ul className={t.rows}>
          {rows.map(row => {
            const title = titleOf(row.gameId);
            return (
              <li key={row.gameId} className={t.row}>
                <div className={t.text}>
                  <b>{row.news ? trayChangeLine(title, row.news, placeOf) : title}</b>
                  {row.played
                    ? <span className={t.sub}>{W.played}</span>
                    : <span className={t.sub}>{W.who(teamName(row.homeTeamId), teamName(row.awayTeamId), row.families)}</span>}
                  {row.news?.byClub && <span className={t.sub}>{W.byClub(division.name)}</span>}
                </div>
                {/* No Undo on the club's change (9d-2b Part 5): it would put the game back on time the club gave away. */}
                {!row.played && !row.news?.byClub && (
                  <button type="button" className={t.undo} onClick={() => void undo(row.gameId)} disabled={busy} aria-label={W.undoAria(title)}>
                    <RotateCcw size={13} aria-hidden /> {W.undo}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {household && !busy && (
        <>
          <p className={ck.hint}>{W.oneHousehold(household.family, household.parts.map(p => ({ child: p.child, team: teamName(p.teamId) })))}</p>
          <SendDoor onOpen={() => { lv.open('email'); void email.load(); }}>{W.seeTheirEmail}</SendDoor>
        </>
      )}
      </>)}
    </KitDialog>
  );
}
