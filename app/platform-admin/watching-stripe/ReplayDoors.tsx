'use client';
/**
 * REPLAY A STRIPE UPDATE: the screen (Plans & pricing Stage 2 Part 5, Session 2; drawings tabs 1–3, as Session 1's rulings
 * narrowed them: the build prompt's Session 2 section). Super admin only: the page draws none of this for any other role, and the
 * GET and POST refuse them (`replay_events`).
 *   · `ReplayDoor` — the word "Replay" in a line of "What failed in Plan billing" (no "›"; it shows on every failed line,
 *     including a kind that is refused: a hidden door would read as "nothing failed").
 *   · `FindUpdate` — "Replay an update by its id": the same window, for an update the list does not show.
 *   · the window: the GET's facts and a reason, or the refusal with no reason asked; then the POST's answer in the same window.
 * Every word is `lib/billing-event-replay.ts`'s.
 */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecordWindow, { type RecordWindowAnswer } from '../RecordWindow';
import { sendJson } from '../console-fetch';
import { consoleWhen } from '@/lib/console-dates';
import {
  REPLAY_REASON_MAX, REPLAY_WINDOW as W, replayRefusal,
  type ReplayLookup, type ReplayRefusal, type ReplayResult, type ReplayResultWords,
} from '@/lib/billing-event-replay';
import kit from '../console.module.css';
import styles from './watching-stripe.module.css';

const URL_BASE = '/api/platform-admin/watching-stripe/replay';

type AnswerStage = { kind: 'answer'; result: ReplayResult; words: ReplayResultWords; update: ReplayLookup };
type Stage =
  | { kind: 'ask'; update: ReplayLookup }
  | { kind: 'refused'; refusal: ReplayRefusal }
  | AnswerStage;

const isRefusal = (v: unknown): v is ReplayRefusal =>
  !!v && typeof (v as ReplayRefusal).title === 'string' && typeof (v as ReplayRefusal).body === 'string';

/** Ask the server what the window shows. A lost answer reads as "could not read", never as "no such update". */
async function lookUp(eventId: string): Promise<Stage> {
  const res = await sendJson(`${URL_BASE}?id=${encodeURIComponent(eventId)}`, 'GET');
  const data = res.data ?? {}; // a body of the literal `null` parses to null
  if (isRefusal(data.refusal)) return { kind: 'refused', refusal: data.refusal };
  const update = data.update as ReplayLookup | undefined;
  if (update && typeof update.eventId === 'string') return { kind: 'ask', update };
  return { kind: 'refused', refusal: replayRefusal('record_unread') };
}

/** The opener both doors share: one look-up at a time, then the window ("Replay again" opens through it too). */
function useReplayWindow() {
  const [stage, setStage] = useState<Stage | null>(null);
  const [opening, setOpening] = useState(false);
  // Which window the screen is on: a look-up that finishes after the window was closed (or moved on) is dropped, never shown.
  const generation = useRef(0);
  const change = (next: Stage | null) => { generation.current += 1; setStage(next); };
  const open = async (eventId: string) => {
    if (opening) return;
    setOpening(true);
    const mine = ++generation.current;
    let next: Stage;
    try {
      next = await lookUp(eventId);
    } catch {
      next = { kind: 'refused', refusal: replayRefusal('record_unread') };
    }
    setOpening(false);
    if (mine === generation.current) setStage(next);
  };
  const window = stage && <ReplayWindow stage={stage} setStage={change} reopen={open} />;
  return { opening, open, window };
}

export function ReplayDoor({ eventId, eventType }: { eventId: string; eventType: string }) {
  const w = useReplayWindow();
  return (
    <>
      <button
        type="button"
        className={`${kit.door} ${kit.doorSm} ${styles.replayDoor}`}
        onClick={() => void w.open(eventId)}
        disabled={w.opening}
        aria-label={`${W.door} ${eventType} ${eventId}`}
      >
        {w.opening ? W.opening : W.door}
      </button>
      {w.window}
    </>
  );
}

export function FindUpdate() {
  const w = useReplayWindow();
  const [id, setId] = useState('');
  const typed = id.trim();
  return (
    <div className={kit.card}>
      <form
        className={`${kit.cardPad} ${styles.find}`}
        onSubmit={e => { e.preventDefault(); if (typed) void w.open(typed); }}
      >
        <h3 className={kit.label}>{W.find.title}</h3>
        <div className={styles.findRow}>
          <input
            className={`${kit.field} ${styles.findField}`}
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder={W.find.placeholder}
            aria-label={W.find.label}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-secondary" disabled={!typed || w.opening}>
            {w.opening ? W.find.finding : W.find.button}
          </button>
        </div>
        <p className={kit.caption}>{W.find.caption}</p>
      </form>
      {w.window}
    </div>
  );
}

function ReplayWindow({ stage, setStage, reopen }: {
  stage: Stage; setStage: (s: Stage | null) => void; reopen: (eventId: string) => Promise<void>;
}) {
  const router = useRouter();
  const close = () => setStage(null);
  // A replay changes the list (the row finishes, the count drops): the page reads again once the window closes.
  const closeAndRead = () => { setStage(null); router.refresh(); };

  // A refusal, before the click or after it, is the window's answer: its title, its sentence, Close alone, no reason asked.
  const update = stage.kind === 'refused' ? null : stage.update;
  const failed = stage.kind === 'answer' && stage.result.kind === 'failed';
  const answer: RecordWindowAnswer | null = stage.kind === 'refused'
    ? { title: stage.refusal.title, body: <p className={styles.answerSentence}>{stage.refusal.body}</p>, closeLabel: W.close }
    : stage.kind === 'answer'
      ? {
          title: stage.words.title,
          body: <AnswerBody result={stage.result} words={stage.words} />,
          footNote: failed ? W.attemptLogged : W.logged,
          main: failed ? { label: W.again, onClick: () => void reopen(stage.update.eventId) } : { label: W.done, onClick: closeAndRead },
          closeLabel: failed ? W.close : undefined,
        }
      : null;

  return (
    <RecordWindow
      title={W.title}
      sentence={W.sentence}
      confirmLabel={W.confirm}
      whyPlaceholder={W.whyPlaceholder}
      whyMax={REPLAY_REASON_MAX}
      footNote={W.foot}
      answer={answer}
      onClose={stage.kind === 'answer' ? closeAndRead : close}
      onConfirm={async reason => {
        if (!update) return null;
        const { ok, data } = await sendJson(URL_BASE, 'POST', { eventId: update.eventId, reason });
        if (ok && data.result && data.words) {
          setStage({ kind: 'answer', update, result: data.result as ReplayResult, words: data.words as ReplayResultWords });
          return null;
        }
        // The server's own "nothing was replayed" is a refusal: the window turns into it. Anything else is a lost answer.
        if (data.nothingReplayed === true && isRefusal(data.refusal)) {
          setStage({ kind: 'refused', refusal: data.refusal });
          return null;
        }
        // A lost answer (a dropped connection, a gateway's page) may have followed a run: it is never "nothing happened".
        return W.noAnswer;
      }}
    >
      {update && <dl className={styles.facts}>
        <dt className={kit.eye}>{W.facts.update}</dt>
        <dd><span className={kit.code}>{update.eventType}</span><span className={kit.sub}>{update.eventId}</span></dd>
        <dt className={kit.eye}>{W.facts.received}</dt>
        <dd>{consoleWhen(update.receivedAt)}</dd>
        <dt className={kit.eye}>{W.facts.club}</dt>
        <dd>{update.clubName ?? <span className={kit.muted}>{W.noClub}</span>}</dd>
        <dt className={kit.eye}>{W.facts.lastResult}</dt>
        <dd>{update.lastResult}</dd>
        <dt className={kit.eye}>{W.facts.messages}</dt>
        <dd>{W.messages}</dd>
      </dl>}
    </RecordWindow>
  );
}

/** The answer: its sentence, Before / After when a comparison was made, and what the run did not show or send. */
function AnswerBody({ result, words }: Pick<AnswerStage, 'result' | 'words'>) {
  const rows = result.rows;
  const same = result.kind === 'unchanged';
  return (
    <>
      <p className={styles.answerSentence}>{words.sentence}</p>
      {rows.length > 0 && (
        <div className={kit.tableWrap}>
          <table className={`${kit.comfortable} ${styles.beforeAfter}`}>
            <thead>
              <tr>
                <th>{W.table.head}</th>
                {same ? <th>{W.table.both}</th> : <><th>{W.table.before}</th><th>{W.table.after}</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.label} className={r.changed ? undefined : styles.sameRow}>
                  <td>{r.label}</td>
                  {same ? <td>{r.after}</td> : (
                    <>
                      <td>{r.before}</td>
                      <td className={r.changed ? styles.changedCell : undefined}>
                        {r.after}{r.changed && <span className="sr-only"> ({W.table.changed})</span>}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={kit.caption}>{words.foot}</p>
    </>
  );
}
