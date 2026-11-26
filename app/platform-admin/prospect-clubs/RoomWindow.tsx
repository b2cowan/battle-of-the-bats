'use client';
/**
 * The room window (Club Website Track P, Session P3; owner rulings T5, T7, T13; drawing tab 4A). Opened from an open row
 * of Prospect clubs, on the owner's phone in the meeting. In the order the room needs them: the code to scan, the live
 * game's score, Email the link, then the meeting and its removal date; Remove now ends the body (a rare door).
 *
 * Staff write one thing in a preview: the live game's score, through this window, never a club seat (T3: nobody signs in
 * to a preview). Every write goes through `/api/platform-admin/prospect-clubs/{orgId}` (owner only) and one database
 * step; Remove now is platform admin's own Delete.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import KitDialog, { DialogCancel, DialogReason } from '@/components/shared/KitDialog';
import DateTimeInput from '@/components/shared/DateTimeInput';
import { isGameLive } from '@/lib/game-status';
import { formatShortWeekdayDate, orgDayKey, utcToZonedInputs, zonedWallClockToUtc } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import { meetingInWindow, removalDateLabel } from '@/lib/prospect-clubs';
import { ROOM_WORDS, formatClaimCode, previewAddress } from '@/lib/preview-claim';
import type { RoomView } from '@/lib/preview-claim-server';
import kit from '../console.module.css';
import styles from './room.module.css';

type Save = 'idle' | 'saving' | 'saved' | 'failed';

async function post(orgId: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; kind?: string }> {
  try {
    const res = await fetch(`/api/platform-admin/prospect-clubs/${orgId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; kind?: string };
    return { ok: res.ok, error: data.error, kind: data.kind };
  } catch {
    return { ok: false, kind: 'network' };
  }
}

function meetingLabel(iso: string): string {
  return `${formatShortWeekdayDate(orgDayKey(iso))} at ${formatTime(utcToZonedInputs(iso).time)}`;
}

/** The QR as the room needs it: medium error correction and a wide quiet border, so a phone across the table reads it. */
async function qrFor(address: string, width: number): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(address, { errorCorrectionLevel: 'M', margin: 4, width, color: { dark: '#000000', light: '#ffffff' } }); /* token-exempt: the QR library takes hex, and a QR code is black on white in every theme or phones cannot read it */
  } catch {
    return null;
  }
}

async function asDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function RoomWindow({ orgId, name, onClose, onChanged }: {
  orgId: string; name: string; onClose: () => void; onChanged: () => void;
}) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [notice, setNotice] = useState('');
  const [ask, setAsk] = useState<'code' | 'remove' | null>(null);
  // A word is a moment (the house rule): "Link copied" and "New code made" clear; the copy-by-hand address stays.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flash(word: string) {
    setNotice(word);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2500);
  }
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // `quiet`: a refresh after a write that went through never replaces the window with "could not be opened" (/review).
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoadFailed(false);
    try {
      const res = await fetch(`/api/platform-admin/prospect-clubs/${orgId}`, { cache: 'no-store' });
      if (!res.ok) { if (!quiet) setLoadFailed(true); return; }
      const data = await res.json() as { room: RoomView };
      setRoom(data.room);
    } catch {
      if (!quiet) setLoadFailed(true);
    }
  }, [orgId]);
  const refresh = useCallback(() => load(true), [load]);

  // Escape closes the full-screen QR (it sits above the window, outside its focus floor).
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setFull(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [full]);

  useEffect(() => { void load(); }, [load]);

  const link = room ? `${window.location.origin}/${room.slug}` : '';
  useEffect(() => {
    if (!link) return;
    void qrFor(link, 640).then(setQr);
  }, [link]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      flash(ROOM_WORDS.copied);
    } catch {
      setNotice(link);
    }
  }

  async function roomCard() {
    if (!room?.code) return;
    const { downloadRoomCard } = await import('@/lib/preview-room-card');
    await downloadRoomCard({
      clubName: room.name, slug: room.slug, tagline: room.tagline, code: room.code,
      removalDate: removalDateLabel(room.meetingAt, true), primary: room.primary, accent: room.accent,
      qrDataUrl: await qrFor(link, 900), logoDataUrl: await asDataUrl(room.logoUrl),
    });
  }

  if (loadFailed) {
    return (
      <KitDialog kind="question" title={name} onClose={onClose}
        footer={<><DialogCancel /><button type="button" className="btn btn-primary" onClick={() => void load()}>Try again</button></>}>
        <p>This preview could not be opened just now. It may have been claimed or removed.</p>
      </KitDialog>
    );
  }

  return (
    <>
      <KitDialog kind="form" title={name} onClose={onClose}>
        {!room ? <p className={kit.muted}>Opening…</p> : (
          <div className={styles.body}>
            {/* ── The code to scan ── */}
            <div className={styles.codeRow}>
              {qr ? <img src={qr} alt={`QR code for ${previewAddress(room.slug)}`} className={styles.qr} /> : <span className={styles.qr} aria-hidden />}
              <div className={styles.codeText}>
                <span className={kit.label}>{ROOM_WORDS.code}</span>
                <span className={styles.code}>{room.code ? formatClaimCode(room.code) : '—'}</span>
                <a href={`/${room.slug}`} target="_blank" rel="noopener noreferrer" className={`${kit.door} ${styles.doorTap}`}>{previewAddress(room.slug)}</a>
              </div>
            </div>
            <div className={styles.buttons}>
              <button type="button" className="btn btn-secondary" onClick={() => void copyLink()}>{ROOM_WORDS.copyLink}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setFull(true)} disabled={!qr}>{ROOM_WORDS.fullScreen}</button>
              <button type="button" className="btn btn-secondary" onClick={() => void roomCard()} disabled={!room.code}>{ROOM_WORDS.card}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setAsk('code')}>{ROOM_WORDS.newCode}</button>
            </div>
            {notice && <p className={kit.hint} role="status">{notice}</p>}
            {room.resting && (
              <div className={`${kit.notice} ${kit.noticeBad}`} role="status">
                {ROOM_WORDS.resting}{' '}
                <button type="button" className={`${kit.door} ${styles.doorTap}`} onClick={async () => {
                  const r = await post(orgId, { action: 'let_try' });
                  if (r.ok) await load(); else setNotice(r.error ?? ROOM_WORDS.failed);
                }}>{ROOM_WORDS.letTry}</button>
              </div>
            )}

            {/* ── The live game ── */}
            <LiveGame key={room.meetingAt} orgId={orgId} room={room} onSaved={refresh} />

            {/* ── Email the link (T13: refused while our mailing address is blank) ── */}
            <EmailTheLink canEmail={room.canEmail} />

            {/* ── The meeting and the removal date ── */}
            <Meeting orgId={orgId} room={room} onMoved={async () => { await load(); onChanged(); }} />
            <p className={kit.hint}>{ROOM_WORDS.removal(removalDateLabel(room.meetingAt, true))}</p>

            <div className={styles.rare}>
              <button type="button" className="btn btn-danger" onClick={() => setAsk('remove')}>{ROOM_WORDS.removeNow}</button>
            </div>
          </div>
        )}
      </KitDialog>

      {full && qr && room && (
        <button type="button" className={styles.full} onClick={() => setFull(false)} aria-label="Close the full-screen QR code">
          <img src={qr} alt={`QR code for ${previewAddress(room.slug)}`} />
          <span className={styles.fullCode}>{room.code ? formatClaimCode(room.code) : ''}</span>
          <span className={styles.fullAddress}>{previewAddress(room.slug)}</span>
          <span className={styles.fullHint}>{ROOM_WORDS.fullClose}</span>
        </button>
      )}

      {ask === 'code' && (
        <NewCodeWindow orgId={orgId} onClose={() => setAsk(null)} onDone={async () => { setAsk(null); flash(ROOM_WORDS.newCodeDone); await load(); }} />
      )}
      {ask === 'remove' && room && (
        <RemoveWindow orgId={orgId} name={room.name} slug={room.slug} onClose={() => setAsk(null)}
          onRemoved={() => { setAsk(null); onChanged(); onClose(); }} />
      )}
    </>
  );
}

function LiveGame({ orgId, room, onSaved }: { orgId: string; room: RoomView; onSaved: () => Promise<void> }) {
  const g = room.game;
  const [home, setHome] = useState(g?.homeScore != null ? String(g.homeScore) : '');
  const [away, setAway] = useState(g?.awayScore != null ? String(g.awayScore) : '');
  const [save, setSave] = useState<Save>('idle');
  // Mark final can't be taken back in the room (/review 2026-11-25): it asks first.
  const [askFinal, setAskFinal] = useState(false);
  const [error, setError] = useState('');
  // The clock, so "Live now" turns on at the meeting time without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!g) {
    return (
      <section className={styles.group}>
        <h3 className={styles.groupHead}>{ROOM_WORDS.liveGroupBare}</h3>
        <p className={`${kit.hint} ${styles.groupBody}`}>{ROOM_WORDS.noGame}</p>
      </section>
    );
  }
  const final = g.status === 'completed';
  const live = isGameLive({ status: g.status, date: g.date, time: g.time }, g.durationMinutes, now);
  const startIso = zonedWallClockToUtc(g.date, g.time);
  const started = startIso ? Date.parse(startIso) <= now.getTime() : false;
  const state = final ? ROOM_WORDS.final : live ? ROOM_WORDS.liveNow : started ? '' : ROOM_WORDS.notStarted;
  const line = [g.division, formatTime(g.time), state].filter(Boolean).join(' · ');

  async function send(action: 'score' | 'final') {
    setError('');
    const h = Number(home), a = Number(away);
    if (home.trim() === '' || away.trim() === '' || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setError('Type both scores as whole numbers.');
      return;
    }
    setSave('saving');
    const r = await post(orgId, { action, home: h, away: a });
    if (r.ok) {
      setSave('saved');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSave('idle'), 2500);
      await onSaved();
      return;
    }
    // The numbers stay; a network or server failure says the drawing's line, a refusal says why.
    setSave('failed');
    setError(r.kind === 'network' || r.kind === 'failed' || !r.error ? ROOM_WORDS.notSaved : r.error);
  }

  return (
    <section className={styles.group} aria-label={ROOM_WORDS.liveGroup(g.tournament)}>
      <h3 className={styles.groupHead}>{ROOM_WORDS.liveGroup(g.tournament)}</h3>
      <div className={styles.groupBody}>
        <p className={`${kit.hint} ${live ? styles.liveLine : ''}`}>{line}</p>
        <div className={styles.scores}>
          <label className={styles.scoreRow}>
            <span>{g.home}</span>
            <input type="number" inputMode="numeric" min={0} max={999} className={`${kit.field} ${styles.score}`} value={home}
              onChange={e => setHome(e.target.value)} disabled={final} aria-label={`${g.home} score`} />
          </label>
          <label className={styles.scoreRow}>
            <span>{g.away}</span>
            <input type="number" inputMode="numeric" min={0} max={999} className={`${kit.field} ${styles.score}`} value={away}
              onChange={e => setAway(e.target.value)} disabled={final} aria-label={`${g.away} score`} />
          </label>
        </div>
        {error && <p className={kit.fieldError} role="alert">{error}</p>}
        {!final && (
          <div className={styles.actionsEnd}>
            {save === 'saved' && <span className={kit.hint} role="status">{ROOM_WORDS.saved}</span>}
            <button type="button" className="btn btn-secondary" onClick={() => setAskFinal(true)} disabled={save === 'saving'}>{ROOM_WORDS.markFinal}</button>
            <button type="button" className="btn btn-primary" onClick={() => void send('score')} disabled={save === 'saving'}>
              {save === 'saving' ? ROOM_WORDS.saving : ROOM_WORDS.saveScore}
            </button>
          </div>
        )}
        <p className={kit.hint}>{ROOM_WORDS.scoreHelp}</p>
      </div>
      {askFinal && (
        <KitDialog kind="question" title={ROOM_WORDS.finalAsk(home || '0', away || '0')} onClose={() => setAskFinal(false)}
          footer={<>
            <DialogCancel>Keep it live</DialogCancel>
            <button type="button" className="btn btn-primary" onClick={() => { setAskFinal(false); void send('final'); }}>{ROOM_WORDS.markFinal}</button>
          </>}>
          <p>{ROOM_WORDS.finalBody}</p>
        </KitDialog>
      )}
    </section>
  );
}

function EmailTheLink({ canEmail }: { canEmail: boolean }) {
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<string>(ROOM_WORDS.roles[0]);
  const [ticked, setTicked] = useState(false);
  const [refused, setRefused] = useState(false);
  return (
    <section className={styles.email}>
      <label className={kit.fieldGroup}>
        <span className={kit.label}>{ROOM_WORDS.emailLabel}</span>
        <input type="email" className={kit.field} value={address} onChange={e => setAddress(e.target.value)} autoComplete="off"
          placeholder="name@club.ca" />
      </label>
      <div className={styles.tickRow}>
        <label className={`${kit.check} ${styles.consent}`}>
          <input type="checkbox" checked={ticked} onChange={e => setTicked(e.target.checked)} />
          {ROOM_WORDS.emailTick}
        </label>
        <select className={kit.select} value={role} onChange={e => setRole(e.target.value)} aria-label="Their role">
          {ROOM_WORDS.roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <p className={kit.hint}>{ROOM_WORDS.emailHelp}</p>
      {/* T13: built and tested in Session P4; until then, and until our mailing address exists, nothing is sent. */}
      {refused && <p className={kit.fieldError} role="alert">{canEmail ? ROOM_WORDS.sendNotYet : ROOM_WORDS.sendRefused}</p>}
      <div className={styles.actionsEnd}>
        <button type="button" className="btn btn-secondary" onClick={() => setRefused(true)} disabled={!address.trim() || !ticked}>
          {ROOM_WORDS.send}
        </button>
      </div>
    </section>
  );
}

function Meeting({ orgId, room, onMoved }: { orgId: string; room: RoomView; onMoved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(room.meetingInput);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function move() {
    setError('');
    const [d, t] = value.split('T');
    const at = zonedWallClockToUtc(d, t);
    if (!at || !meetingInWindow(at)) { setError('Pick a meeting in the next 60 days.'); return; }
    setBusy(true);
    const r = await post(orgId, { action: 'meeting', meeting: value });
    setBusy(false);
    if (!r.ok) { setError(r.error ?? ROOM_WORDS.failed); return; }
    setOpen(false);
    await onMoved();
  }

  return (
    <section className={styles.meeting}>
      <span className={kit.label}>{ROOM_WORDS.meeting}</span>
      {!open ? (
        <p className={styles.meetingLine}>
          {meetingLabel(room.meetingAt)} ·{' '}
          <button type="button" className={`${kit.door} ${styles.doorTap}`} onClick={() => { setValue(room.meetingInput); setOpen(true); }}>{ROOM_WORDS.change}</button>
        </p>
      ) : (
        <div className={styles.meetingEdit}>
          <DateTimeInput aria-label={ROOM_WORDS.changeTitle} className={kit.field} value={value} onChange={setValue} />
          <p className={kit.hint}>{ROOM_WORDS.changeHelp}</p>
          {error && <p className={kit.fieldError} role="alert">{error}</p>}
          <div className={styles.actionsEnd}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => void move()} disabled={busy}>{ROOM_WORDS.changeSave}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function NewCodeWindow({ orgId, onClose, onDone }: { orgId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <KitDialog kind="question" title={ROOM_WORDS.newCodeTitle} onClose={onClose} busy={busy}
      footer={<>
        <DialogCancel />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await post(orgId, { action: 'new_code' });
          setBusy(false);
          if (r.ok) await onDone(); else setError(r.error ?? ROOM_WORDS.failed);
        }}>{ROOM_WORDS.newCode}</button>
      </>}>
      {error && <DialogReason className={kit.fieldError}>{error}</DialogReason>}
      <p>{ROOM_WORDS.newCodeAsk}</p>
    </KitDialog>
  );
}

/** Remove now: platform admin's own Delete, the web address typed back as it asks (tab 4: "as Delete does today"). */
function RemoveWindow({ orgId, name, slug, onClose, onRemoved }: {
  orgId: string; name: string; slug: string; onClose: () => void; onRemoved: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = typed.trim().toLowerCase() === slug;
  return (
    <KitDialog kind="question" title={ROOM_WORDS.removeTitle(name)} onClose={onClose} busy={busy}
      footer={<>
        <DialogCancel>Keep it</DialogCancel>
        <button type="button" className="btn btn-danger" disabled={busy || !matches} onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const res = await fetch(`/api/platform-admin/orgs/${orgId}/delete`, {
              method: 'DELETE', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: ROOM_WORDS.removeReason, confirmSlug: slug, notifyOwner: false, deleteStripeCustomer: false }),
            });
            const data = await res.json().catch(() => ({})) as { error?: string };
            if (res.ok) { onRemoved(); return; }
            setError(data.error ?? ROOM_WORDS.failed);
          } catch {
            setError(ROOM_WORDS.failed);
          }
          setBusy(false);
        }}>{ROOM_WORDS.removeConfirm}</button>
      </>}>
      {error && <DialogReason className={kit.fieldError}>{error}</DialogReason>}
      <p>{ROOM_WORDS.removeBody}</p>
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Type <code className={kit.code}>{slug}</code> to confirm<span className={kit.req} aria-hidden>*</span></span>
        <input className={`${kit.field} ${kit.code}`} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
      </label>
    </KitDialog>
  );
}
