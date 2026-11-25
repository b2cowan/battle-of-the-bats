'use client';
/**
 * OFFER AGAIN (Board Ready Stage 6, Part 4a; owner rulings 1A–12A, 2026-11-25; drawing BOARD_READY_STAGE6_P4A_OFFER_AGAIN_DRAWINGS.html
 * tabs 2–4). One window, last year's deals in three quiet groups — Ready, Waiting, Can't be emailed (2A) — each row the shipped
 * check row: the business, then "{package} · {place} · {price}" (+ "· last year $900.00" when the price changed, 9A) and, on a
 * row that can go, "Paid us on May 2, 2027" (8A: the payment its email rests on, worked out by the server, never typed).
 *   · A row that asks for something asks IN PLACE (asks 3, 4, 5, 6): this year's tournament (pre-picked on a single name match),
 *     a team (last year's division's teams first, a taken team marked "Taken: …"), one of two divisions, or a passed last day.
 *     Picking a place ticks the row; nothing opens a second window.
 *   · Waiting and Can't be emailed rows can't be ticked, and say why.
 *   · Nothing is sent until the press; the press sends each ticked row on its own (10A) and the result is said on the Deals tab.
 *     A long press goes in several requests (the server answers the rows it hasn't reached), said as one result.
 *   · A typed last day before today holds its row back.
 * On a phone it is the full-screen window, Send in the foot (the head's ← is Cancel), fewer rows shown before "Show".
 */
import { useMemo, useState } from 'react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import DateInput from '@/components/shared/DateInput';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import LoadingState from '@/components/shared/LoadingState';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS as W, sponsorshipMoney as money } from '@/lib/club-sponsorships-words';
import { AGAIN_MAX_ROWS, placeForPress, type AgainGroup, type AgainRow } from '@/lib/club-sponsorship-offer-again';
import { send, sponsorshipsApi } from './api';
import { takenWords, useAgain, type AgainRead } from './deals-api';
import css from './Sponsorships.module.css';

const A = D.again;
/** How many rows each group shows before "Show" (the drawing: 4 · all · 4 at a desk; 2 · 1 · 1 on a phone). */
const SHOWN: Record<'desk' | 'phone', Record<AgainGroup, number>> = { desk: { ready: 4, waiting: 3, blocked: 4 }, phone: { ready: 2, waiting: 1, blocked: 1 } };

export default function OfferAgainWindow({ slug, onDone, onClose }: {
  slug: string;
  /** The press's result, said on the Deals tab (10A). */
  onDone: (result: { tone: 'good' | 'bad'; text: string }) => void;
  onClose: () => void;
}) {
  const { data, error } = useAgain();
  const isPhone = useIsPhone();
  if (!data) {
    return (
      <KitDialog kind="form" size="medium" onClose={onClose} title={A.phoneTitle}>
        {error ? <p className={css.error} role="alert">{error}</p> : <LoadingState label={W.loading} />}
      </KitDialog>
    );
  }
  return <AgainForm slug={slug} read={data} isPhone={isPhone} onDone={onDone} onClose={onClose} />;
}

function AgainForm({ slug, read, isPhone, onDone, onClose }: {
  slug: string; read: AgainRead; isPhone: boolean;
  onDone: (result: { tone: 'good' | 'bad'; text: string }) => void; onClose: () => void;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>(() => Object.fromEntries(read.rows.map(r => [r.dealId, r.ticked])));
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [ends, setEnds] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<ReadonlySet<AgainGroup>>(new Set());
  const [busy, setBusy] = useState(false);
  /** How many a long press has sent so far (it goes in turns; closing the page would stop the turns still to come). */
  const [progress, setProgress] = useState<{ sent: number; of: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const groups = useMemo(() => (['ready', 'waiting', 'blocked'] as const).map(g => ({ g, rows: read.rows.filter(r => r.group === g) })), [read.rows]);
  const lastDayOf = (r: AgainRow) => ends[r.dealId] ?? r.endsOn ?? '';
  const pastDay = (r: AgainRow) => !!r.lastDayPassed && !!lastDayOf(r) && lastDayOf(r) < read.today;
  const canGo = (r: AgainRow) => r.group === 'ready' && placeForPress(r.place, picks[r.dealId] ?? null) != null && !pastDay(r);
  const chosen = read.rows.filter(r => ticked[r.dealId] && canGo(r));
  const n = chosen.length;

  async function press() {
    if (!n || busy) return;
    setBusy(true);
    setFailure(null);
    // An empty last day is the club clearing the field; a row that never asked sends none.
    let rows = chosen.map(row => ({ dealId: row.dealId, targetId: picks[row.dealId] ?? null, ...(row.lastDayPassed ? { endsOn: lastDayOf(row) } : {}) }));
    let sent = 0;
    let answered = false;
    const failed: { name: string; why: string }[] = [];
    const unconfirmed: string[] = [];
    while (rows.length) {
      const turn = rows.slice(0, AGAIN_MAX_ROWS);
      const r = await send<{ sent: number; failed: { name: string; why: string }[]; unconfirmed: string[]; later: string[] }>(sponsorshipsApi(slug, '/deals/offer-again'), 'POST', { rows: turn });
      if (!r.ok) {
        if (!answered) { setBusy(false); setFailure(r.error); return; }
        onDone({ tone: 'bad', text: A.stopped(sent) });
        return;
      }
      answered = true;
      sent += r.data.sent;
      failed.push(...r.data.failed);
      unconfirmed.push(...r.data.unconfirmed);
      const later = new Set(r.data.later);
      rows = [...turn.filter(row => later.has(row.dealId)), ...rows.slice(turn.length)];
      if (rows.length) setProgress({ sent, of: n });
    }
    onDone(failed.length || unconfirmed.length ? { tone: 'bad', text: A.sentSome(sent, n, failed, unconfirmed) } : { tone: 'good', text: A.sentAll(sent) });
  }

  function hint(r: AgainRow): string {
    const place = r.place.status === 'ok' ? (r.placeKind === 'club' ? D.list.theClub : r.place.label) : null;
    return [r.packageName, place, money(r.price), r.lastPrice != null ? A.lastPrice(r.lastPrice) : null, r.lastTeam ? A.lastTeam(r.lastTeam) : null,
      r.group !== 'ready' ? r.why : null].filter(Boolean).join(' · ');
  }

  function rowView(r: AgainRow) {
    const id = `again-${r.dealId}`;
    const off = r.group !== 'ready';
    const pick = !off && r.place.status === 'pick' ? r.place : null;
    return (
      <div key={r.dealId} className={`${css.againRow}${off ? ` ${css.againRowOff}` : ''}`}>
        <input id={id} type="checkbox" checked={!!ticked[r.dealId] && canGo(r)} disabled={busy || !canGo(r)}
          onChange={e => setTicked(t => ({ ...t, [r.dealId]: e.target.checked }))} />
        <div className={css.againMain}>
          <label htmlFor={id} className={css.againLabel}>
            <strong>{r.businessName}</strong>
            <small>{hint(r)}</small>
          </label>
          {pick && (
            <div className={css.againAsk}>
              {/* On a phone the picker says what it is by what it shows; the date field below keeps its name. */}
              <span className={`${css.againAskLabel} ${css.deskOnly}`}>{A.showsOn}</span>
              <SublinedChoice id={`${id}-place`} label={A.showsOn} variant="toolbar"
                triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                placeholder={pick.prompt} value={picks[r.dealId] ?? pick.chosen}
                onChange={v => { setPicks(p => ({ ...p, [r.dealId]: v })); setTicked(t => ({ ...t, [r.dealId]: true })); }}
                options={pick.choices.map(c => ({ value: c.id, name: c.label, sub: takenWords(read.holds, r.placeKind, c.id), group: c.group ?? undefined }))} />
              {pick.lastYear && <span className={ck.hint}>{pick.lastYear}</span>}
            </div>
          )}
          {!off && r.lastDayPassed && (
            <div className={css.againAsk}>
              <label className={css.againAskLabel} htmlFor={`${id}-until`}>{A.showsUntil}</label>
              <DateInput id={`${id}-until`} className={ck.input} value={lastDayOf(r)} min={read.today} disabled={busy}
                onChange={v => setEnds(e => ({ ...e, [r.dealId]: v }))} />
              <span className={ck.hint}>{A.lastDayPassed(r.lastDayPassed)}</span>
            </div>
          )}
        </div>
        {!off && r.paidOn && <span className={css.againPaid}>{A.paidOn(r.paidOn)}</span>}
      </div>
    );
  }

  const label = { ready: A.groupReady, waiting: A.groupWaiting, blocked: A.groupBlocked } as const;
  const more = { ready: A.moreReady, waiting: A.moreWaiting, blocked: A.more } as const;
  const limit = SHOWN[isPhone ? 'phone' : 'desk'];

  return (
    <KitDialog kind="form" size="medium" onClose={onClose} busy={busy}
      eyebrow={isPhone ? undefined : A.eyebrow(read.thisYear)}
      title={isPhone ? A.phoneTitle : A.title(read.lastYear)}
      identity={isPhone ? A.phoneSub(read.lastYear) : undefined}
      footerStart={<span className={css.footLine} role="status">{read.blocked ?? (busy && progress ? A.progress(progress.sent, progress.of) : A.sends(n))}</span>}
      footer={(
        <>
          {!isPhone && <DialogCancel>{A.cancel}</DialogCancel>}
          <button type="button" className="btn btn-lime" disabled={busy || !n || !!read.blocked} onClick={() => void press()}>
            {busy ? A.sending : A.send(n)}
          </button>
        </>
      )}>
      <div className={css.againList}>
        {groups.filter(x => x.rows.length).map(({ g, rows }) => {
          const all = opened.has(g) || rows.length <= limit[g];
          const shown = all ? rows : rows.slice(0, limit[g]);
          return (
            <section key={g} className={css.againGroup} aria-label={label[g](rows.length)}>
              <h3 className={css.againGroupLabel}>{label[g](rows.length)}</h3>
              {shown.map(rowView)}
              {!all && (
                <p className={css.againMore}>
                  {more[g](rows.length - shown.length)} · <button type="button" className={css.linkButton} onClick={() => setOpened(s => new Set(s).add(g))}>{A.show}</button>
                </p>
              )}
            </section>
          );
        })}
        {failure && <p className={css.error} role="alert">{failure}</p>}
      </div>
    </KitDialog>
  );
}
