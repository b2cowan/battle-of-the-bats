'use client';
/**
 * A BANK CHECK IN PROGRESS, KEPT ON OUR SERVERS AS YOU GO — the one hook both cards use (Bank check through a volunteer's
 * eyes S7 Part 2, plan docs/projects/active/BANK_CHECK_NOVICE_UX_PLAN.md §0 A18 rulings 1–9; drawing
 * BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html). The club's Bank card (`BankCheckForm`) and the coach's (`CoachBankCheck`) hand it
 * their own `…/work` route (Part 1: GET { mine, colleagues, elsewhere? } · PUT { work, revision } → { saved } · DELETE).
 * ⚖ NOTHING IS KEPT BEFORE START (ruling 6): `keepNow` (Start) is the first keep; `keep` is the card's work after it.
 * ⚖ KEPT AS YOU GO (ruling 4): `keep` takes the card's work as `workText` whenever it changes; it goes up after a short
 *   pause, one request at a time, each naming the revision it last read (the compare-and-swap). Leaving the page (hidden,
 *   closed, the card unmounted) sends what is waiting at once, with `keepalive`, and the next card to open on the same
 *   route waits for it before it reads, so it never reads the work from before the last change.
 * ⚖ ANOTHER DEVICE KEPT NEWER WORK (`work_changed`, 409, or a row that ended): never re-sent blindly. The hook reads again,
 *   bumps `seed` (the card re-seeds itself from `mine`) and says which way it went (`changed`: 'there' | 'gone').
 * ⚖ A FAILED KEEP SAYS SO (ruling 4): `keepFailed` is true until a keep lands; the card shows it in place of the resting
 *   sentence ("Kept as you go…" must never promise what didn't happen). `flush` sends the latest again (Try again).
 * ⚖ The pre-S7 browser drafts are deleted as the card opens (`clearLegacyDrafts`); nothing is read from them.
 * ⚖ ONE REQUEST AT A TIME, ALL OF THEM (/review S7 Part 3): a keep, Start / Save for later and Start over each wait until
 *   nothing is on its way (`settle`, a loop: two waiters on one keep never both go with the same revision), so none of them
 *   meets its own last keep as "another device". A failed keep is not re-sent on a timer: the next change or Try again
 *   sends it. A failed re-read keeps the card as it is and says the keep failed; it never says the work is gone.
 * ⚖ THE DEMO SANDBOX REFUSES EVERY WRITE BY DESIGN (lib/demo-guard.ts): a refused keep there is the demo working, so the card
 *   carries on in this visit and `sandboxNote` carries the sandbox's own sentence for the resting line (never its code name).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clearLegacyDrafts } from '@/lib/bank-check-draft';
import { workOfSaved, workText, type CheckWork, type ColleagueWork, type SavedWork, type WorkElsewhere } from '@/lib/bank-check-work';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';

const KEEP_PAUSE_MS = 600;

/** The keep each route has on its way: the next card to open on it reads only after it lands (a reload, a re-key). */
const onTheWay = new Map<string, Promise<unknown>>();

/** `error: null`: another device kept newer work, so the hook is reading again and the card says so; nothing else to say. */
export type WorkAnswer = { ok: true; endsOn: string | null } | { ok: false; error: string | null };

export interface BankCheckWork {
  /** The read as the card opened (and after a reload): loading, ready, or failed (the card can still start). */
  read: 'loading' | 'ready' | 'failed';
  /** The person's work as last read: the card seeds itself from it. */
  mine: SavedWork | null;
  colleagues: ColleagueWork[];
  /** The club's other accounts holding this person's work (the Account pill at 2+); empty on a coach's team. */
  elsewhere: WorkElsewhere[];
  /** Bumps when the card must seed itself again from `mine` (a reload after another device's keep). */
  seed: number;
  /** After such a reload: the work is there (another device's), or gone (finished, started over or ended elsewhere). */
  changed: 'there' | 'gone' | null;
  /** The last keep failed: nothing since the last good one is kept yet. */
  keepFailed: boolean;
  /** In a demo sandbox: its own "Nothing is saved here…" sentence, in place of the resting line. Null everywhere else. */
  sandboxNote: string | null;
  /** The last day the work is kept, as the server last said (null before the first keep, and after Start over). */
  endsOn: string | null;
  /** The work after Start, as `workText`, whenever it changes: kept after a short pause. */
  keep: (text: string) => void;
  /** Start checking this statement, and Save for later: kept at once (the 30 days start again even when nothing changed). */
  keepNow: (work: CheckWork) => Promise<WorkAnswer>;
  /** Start over: the work goes. */
  startOver: () => Promise<WorkAnswer>;
  /** Anything waiting goes up now and lands: Try again after a failed keep, and before Save this check (so it never lands
   *  after the check took the work). */
  flush: () => Promise<void>;
  /** After Save this check: the server took the work with the check; the card starts empty. */
  forget: () => void;
  retryRead: () => void;
  /** The `changed` line has been read (the person touched the card). */
  clearChanged: () => void;
}

type Sent = { ok: true; saved: SavedWork | null } | { ok: false; changed: boolean; error: string };

/** The demo sandbox's refusal (403 `sandbox: true`): its sentence, or null for any other answer. */
function sandboxSentence(r: { status: number; data: unknown }): string | null {
  const d = r.data as { sandbox?: unknown; message?: unknown } | null;
  if (r.status !== 403 || d?.sandbox !== true) return null;
  return typeof d.message === 'string' && d.message ? d.message : 'Nothing is saved here.';
}

/**
 * `url` is the card's own work route (it carries `orgSlug` for the club). `fallback` is the card's failed-keep words, for a
 * refusal that carries none. The card mounts after the bank is read, so `url` is known from the first render.
 */
export function useBankCheckWork(url: string, fallback: string): BankCheckWork {
  const [read, setRead] = useState<BankCheckWork['read']>('loading');
  const [mine, setMine] = useState<SavedWork | null>(null);
  const [colleagues, setColleagues] = useState<ColleagueWork[]>([]);
  const [elsewhere, setElsewhere] = useState<WorkElsewhere[]>([]);
  const [seed, setSeed] = useState(0);
  const [changed, setChanged] = useState<BankCheckWork['changed']>(null);
  const [keepFailed, setKeepFailed] = useState(false);
  const [sandboxNote, setSandboxNote] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [readAgain, setReadAgain] = useState(0);

  const revision = useRef<number | null>(null);
  const keptText = useRef<string | null>(null); // the work the server holds now, as `workText`
  const latest = useRef<string | null>(null); // the card's latest work after Start, as `workText`
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const live = useRef(true);
  // A reload after `work_changed` is the one thing that re-seeds the card: `reload` reads, then bumps `seed`.
  const reloading = useRef(false);
  // The pause's keep reaches the newest `flush` through this (`flush` re-arms the pause itself, so it can't name itself).
  const flushRef = useRef<(keepalive?: boolean) => Promise<void>>(async () => undefined);

  const cancelPause = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  /** Until nothing is on its way: a loop, since another waiter may have sent the next one while this one waited. */
  const settle = useCallback(async () => { while (inFlight.current) await inFlight.current; }, []);
  /** Run one request as the one on its way: every keep that comes meanwhile waits for it. */
  const exclusive = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    await settle();
    const go = run();
    const mark: Promise<void> = go.then(() => undefined, () => undefined).finally(() => { if (inFlight.current === mark) inFlight.current = null; });
    inFlight.current = mark;
    return go;
  }, [settle]);
  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = undefined; void flushRef.current(); }, KEEP_PAUSE_MS);
  }, []);

  /** The server's answer to a keep that landed: its revision and end date, and what it now holds. */
  const landed = useCallback((text: string, saved: SavedWork | null) => {
    revision.current = saved?.revision ?? null;
    // The server holds THIS (a row, or none for work not worth keeping): the same text is not sent again (/review).
    keptText.current = text;
    setEndsOn(saved?.endsOn ?? null);
    setKeepFailed(false);
  }, []);
  /** A read's work becomes what the card holds and the server holds. */
  const adopt = useCallback((m: SavedWork | null) => {
    revision.current = m?.revision ?? null;
    keptText.current = latest.current = m ? workText(workOfSaved(m)) : null;
    setEndsOn(m?.endsOn ?? null);
    setMine(m);
  }, []);

  /** GET, after any keep still on its way to this route. */
  const fetchRead = useCallback(async () => {
    await onTheWay.get(url)?.catch(() => undefined);
    const r = await moneyFetch<{ mine?: SavedWork | null; colleagues?: ColleagueWork[]; elsewhere?: WorkElsewhere[] }>(url).catch(() => null);
    return r?.ok && Array.isArray(r.data.colleagues) ? r.data : null;
  }, [url]);

  useEffect(() => {
    live.current = true;
    clearLegacyDrafts();
    let current = true;
    void fetchRead().then(d => {
      if (!current) return;
      if (!d) { setRead('failed'); return; }
      adopt(d.mine ?? null);
      setColleagues(d.colleagues ?? []); setElsewhere(d.elsewhere ?? []); setRead('ready');
    });
    return () => { current = false; };
  }, [fetchRead, adopt, readAgain]);

  /** Another device kept newer work, or the row ended: read again and re-seed the card (never re-send blindly). */
  const reload = useCallback(async () => {
    if (reloading.current) return;
    reloading.current = true;
    cancelPause();
    const d = await fetchRead();
    reloading.current = false;
    if (!live.current) return;
    // A failed read says nothing about the work: the card stays as it is, its keep failed (Try again reads the conflict
    // again). Never "gone" on a read that didn't happen (/review).
    if (!d) { setKeepFailed(true); return; }
    const m = d.mine ?? null;
    adopt(m);
    setKeepFailed(false);
    setColleagues(d.colleagues ?? []); setElsewhere(d.elsewhere ?? []);
    setChanged(m ? 'there' : 'gone'); setSeed(n => n + 1);
  }, [fetchRead, adopt]);

  /** One PUT of the work (as `workText`), naming the revision last read. `keepalive` when the page may be going. */
  const put = useCallback(async (text: string, keepalive = false): Promise<Sent> => {
    const init: RequestInit = { ...jsonInit('PUT', { work: JSON.parse(text) as CheckWork, revision: revision.current }), ...(keepalive ? { keepalive: true } : {}) };
    const go = moneyFetch<{ saved?: SavedWork | null; code?: string }>(url, init)
      // A keepalive body has a size ceiling: past it the browser refuses outright, so send it as an ordinary request.
      .catch(e => { if (keepalive) return moneyFetch<{ saved?: SavedWork | null; code?: string }>(url, { ...init, keepalive: false }); throw e; });
    onTheWay.set(url, go);
    try {
      const r = await go;
      if (r.ok) { setSandboxNote(null); return { ok: true, saved: r.data.saved ?? null }; }
      // The demo refusing is the demo working: the card carries on in this visit, held nowhere (`saved` null).
      const sandbox = sandboxSentence(r);
      if (sandbox) { setSandboxNote(sandbox); return { ok: true, saved: null }; }
      return { ok: false, changed: r.data.code === 'work_changed', error: refusalText(r.data, fallback) };
    } catch {
      return { ok: false, changed: false, error: fallback };
    } finally {
      if (onTheWay.get(url) === go) onTheWay.delete(url);
    }
  }, [url, fallback]);

  /** Send the latest work if the server doesn't hold it yet; one at a time (a change meanwhile goes after this one lands). */
  const flush = useCallback(async (keepalive = false): Promise<void> => {
    cancelPause();
    const landedOk = await exclusive(async () => {
      // Read once it is this one's turn: a keep that landed meanwhile may already hold it.
      const text = latest.current;
      if (!text || reloading.current || text === keptText.current) return false;
      const r = await put(text, keepalive);
      if (r.ok) { landed(text, r.saved); return true; }
      if (!live.current) return false;
      if (r.changed) void reload();
      else setKeepFailed(true);
      return false;
    });
    // Changed while that one was on its way (even back to what the server held before it): that goes next. A failed keep
    // is not re-sent on a timer (offline or refused, that would ask every 0.6 s for as long as the card is open): the next
    // change, or Try again, sends it (/review).
    if (landedOk && live.current && latest.current && !reloading.current && latest.current !== keptText.current && timer.current === undefined) schedule();
  }, [put, reload, landed, schedule, exclusive]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const keep = useCallback((text: string) => {
    latest.current = text;
    if (reloading.current) return;
    // Back to what the server holds: nothing to send, and nothing un-kept to say (/review).
    if (text === keptText.current) { cancelPause(); setKeepFailed(false); return; }
    schedule();
  }, [schedule]);

  const keepNow = useCallback(async (work: CheckWork): Promise<WorkAnswer> => {
    cancelPause();
    const text = workText(work);
    latest.current = text;
    const r = await exclusive(async () => {
      const sent = await put(text);
      if (sent.ok) landed(text, sent.saved);
      return sent;
    });
    if (!live.current) return { ok: false, error: fallback };
    if (r.ok) { setChanged(null); return { ok: true, endsOn: r.saved?.endsOn ?? null }; }
    if (r.changed) { void reload(); return { ok: false, error: null }; }
    return { ok: false, error: r.error };
  }, [put, reload, landed, fallback, exclusive]);

  const forget = useCallback(() => {
    cancelPause();
    revision.current = null;
    keptText.current = latest.current = null;
    setEndsOn(null); setKeepFailed(false); setChanged(null);
  }, []);

  const startOver = useCallback(async (): Promise<WorkAnswer> => {
    cancelPause();
    // The DELETE is the one on its way: a keep made meanwhile waits for it, then finds nothing to send (`forget`).
    const r = await exclusive(async () => {
      const got = await moneyFetch<{ ok?: boolean }>(url, { method: 'DELETE' }).catch(() => null);
      // The demo refusing is the demo working: the card starts over in this visit.
      if (got?.ok || (got && sandboxSentence(got))) forget();
      return got;
    });
    if (!live.current) return { ok: false, error: fallback };
    if (r && (r.ok || sandboxSentence(r))) return { ok: true, endsOn: null };
    return { ok: false, error: r ? refusalText(r.data, fallback) : fallback };
  }, [url, fallback, forget, exclusive]);

  // Leaving: the page hidden or closed sends what is waiting at once; so does the card going away (another tab of the
  // portal, another account). The next card on this route reads only after it lands (`onTheWay`).
  useEffect(() => {
    live.current = true; // a re-attach (React's development double mount) is live again
    const away = () => { if (document.visibilityState === 'hidden' && timer.current !== undefined) void flush(true); };
    const closing = () => { if (timer.current !== undefined) void flush(true); };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', closing);
    return () => {
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('pagehide', closing);
      if (timer.current !== undefined) void flush(true);
      live.current = false;
    };
  }, [flush]);

  return {
    read, mine, colleagues, elsewhere, seed, changed, keepFailed, sandboxNote, endsOn,
    keep, keepNow, startOver, flush: useCallback(() => flush(), [flush]), forget,
    retryRead: useCallback(() => { setRead('loading'); setReadAgain(n => n + 1); }, []),
    clearChanged: useCallback(() => setChanged(null), []),
  };
}
