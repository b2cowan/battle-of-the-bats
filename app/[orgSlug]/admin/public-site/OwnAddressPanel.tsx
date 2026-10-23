'use client';
/**
 * THE "WEB ADDRESS" ROW'S BODY: a club's own web address, the whole journey in one row (Club Tier Stage 4e, Part 3;
 * drawings ruled 2026-10-23, frames a-h; words CLUB_TIER_STAGE4E_COPY.md via lib/own-address-screen-words.ts).
 *
 *   a  the door            the address families use today, and one door in
 *   b  typing              `www.` fixed in front, Next; a refusal says what to do
 *   c·d waiting            the two records to copy, what we see, the forwarding step, Check now
 *   e  connected           plain facts first; the records fold away behind "Show the two records"
 *   f  needs attention     the padlock record is gone: the site still works, with a date
 *   g  not connected / not working   the three failures, each with its one next step
 *   h  stop                a small question window, then back at the old address at once
 *
 * ⚖ The OWNER connects, tries again and stops; an admin READS every state and can copy the records and press Check now
 * (ruling 2). What an admin may not do is ABSENT, never greyed. ⚖ Typing waits for Next (a create asks); nothing here
 * autosaves. ⚖ Check now is our own lookup and never says the site is live.
 */
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, Clock, Link2, Mail, RefreshCw, XCircle } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, RepChip } from '@/components/admin/kit/club/RepKit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { cleanAddressWhileTyping } from '@/lib/club-domain';
import type { DomainView } from '@/lib/club-domain-service';
import { formatStoredDate, formatInOrgZone } from '@/lib/timezone';
import { OWN_ADDRESS_WORDS as W } from '@/lib/own-address-screen-words';
import {
  OWN_ADDRESS_HELP_HREF, OWN_ADDRESS_HELP_PATH, bareState, gaveUpWhich, recordChip, registrarMessage, waitingLine,
} from '@/lib/own-address-view';
import { RecordCard } from './OwnAddressParts';
import type { useOwnAddress } from './useOwnAddress';
import s from './own-address.module.css';

const clock = (iso: string) => formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
const longDate = (iso: string | null) => (iso ? formatStoredDate(iso, { longMonth: true }) : null);

export default function OwnAddressPanel({ orgSlug, query, clubName, ownerName, fieldlogicAddress, isOwner, own, onTell }: {
  orgSlug: string;
  /** `?orgSlug=…` for the routes. */
  query: string;
  clubName: string;
  /** The signed-in owner's name for the message they copy; null when unknown. */
  ownerName: string | null;
  /** The address families use without it: `fieldlogichq.ca/lakeshore-lynx`. */
  fieldlogicAddress: string;
  isOwner: boolean;
  own: ReturnType<typeof useOwnAddress>;
  /** A short sentence in the page's one notice pill. */
  onTell: (message: string) => void;
}) {
  const view = own.connection;
  const [typing, setTyping] = useState(false);
  const [other, setOther] = useState(false);
  const [value, setValue] = useState('');
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<{ reason: string; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [showRecords, setShowRecords] = useState(false);
  const [askStop, setAskStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const message = useCopyToClipboard();
  const base = `/api/admin/public-site/own-address`;

  async function call(path: string, init?: RequestInit) {
    const res = await fetch(`${base}${path}${query}`, init);
    const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; connection?: DomainView | null; record1?: { state: string }; record2?: { state: string } };
    return { ok: res.ok, data };
  }

  // ── b · Next ──
  async function connect() {
    if (!value.trim() || working) return;
    setWorking(true);
    setRefusal(null);
    try {
      const { ok, data } = await call('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: value, mode: other ? 'other' : 'www' }),
      });
      if (ok && data.connection) {
        own.setConnection(data.connection);
        setTyping(false);
        setValue('');
        setOther(false);
      } else {
        setRefusal({ reason: data.reason ?? 'failed', text: data.error || W.actionFailed });
      }
    } catch {
      setRefusal({ reason: 'failed', text: W.actionFailed });
    } finally {
      setWorking(false);
    }
  }

  // ── c·d · Check now ──
  async function checkNow() {
    setChecking(true);
    setNote(null);
    try {
      const { ok, data } = await call('/check', { method: 'POST' });
      if (ok && data.connection) {
        own.setConnection(data.connection);
        const say = (n: 1 | 2, st?: string) => (st === 'found' ? W.announceFound(n) : st === 'points_elsewhere' ? W.announcePointsElsewhere(n) : W.announceNotSeen(n));
        setAnnounce(`${say(1, data.record1?.state)} ${say(2, data.record2?.state)}`);
      } else {
        setNote(data.error || W.lookupFailed);
      }
    } catch {
      setNote(W.lookupFailed);
    } finally {
      setChecking(false);
    }
  }

  // ── g1 · Try again, and every way out ──
  async function retry() {
    setBusy(true);
    setNote(null);
    try {
      const { ok, data } = await call('/retry', { method: 'POST' });
      if (ok && data.connection) own.setConnection(data.connection);
      else setNote(data.error || W.actionFailed);
    } catch {
      setNote(W.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  /** Stop, or Cancel and start over, or Use a different address: the host is told first; everything reverts at once. */
  async function stop(then: 'notice' | 'form' | 'quiet') {
    setBusy(true);
    setNote(null);
    try {
      const { ok, data } = await call('', { method: 'DELETE' });
      if (!ok) {
        setNote(data.error || W.actionFailed);
        return;
      }
      const was = view;
      own.setConnection(null);
      setAskStop(false);
      setShowRecords(false);
      if (then === 'notice' && was) onTell(W.stoppedNotice(fieldlogicAddress, was.domain));
      if (then === 'form') { setTyping(true); setValue(''); setOther(false); setRefusal(null); }
    } catch {
      setNote(W.actionFailed);
    } finally {
      setBusy(false);
    }
  }

  const ownerLabel = isOwner ? 'you' : 'the owner';
  const live = () => <span className={s.srOnly} aria-live="polite">{announce}</span>;

  // ── The pieces every state reuses ──
  const wholeNameHint = (v: DomainView) => <p className={s.hint}>{W.wholeNameHint(v.fullName, v.domain)}</p>;

  const cards = (v: DomainView, which: 'both' | 'padlock' | 'site', liveRecords: boolean) => {
    const sees = v.lastCheck?.record2.state === 'points_elsewhere' ? v.lastCheck.record2.sees : null;
    return (
      <div className={s.cards}>
        {which !== 'site' && (
          <RecordCard n={1} title={W.padlockTitle} record={v.records.padlock} chip={recordChip(v.lastCheck?.record1, liveRecords)} why={W.whyPadlock} />
        )}
        {which !== 'padlock' && (
          <RecordCard n={2} title={W.siteTitle} record={v.records.site} chip={recordChip(v.lastCheck?.record2, liveRecords)}
            why={W.whySite(v.records.site.name)}
            sees={sees ? W.sees(v.prefix, sees, v.records.site.value) : undefined} />
        )}
      </div>
    );
  };

  const foot = (v: DomainView, text: (time: string) => string) => (
    <div className={s.foot}>
      <span>{v.lastCheckedAt ? text(clock(v.lastCheckedAt)) : W.neverChecked}</span>
      <button type="button" className={`btn btn-outline btn-data ${s.checkNow}`} onClick={() => void checkNow()} disabled={checking}
        aria-label={checking ? W.checkingNow : W.checkNow}>
        <RefreshCw size={14} aria-hidden />
        <span className={s.checkWord}>{checking ? W.checkingNow : W.checkNow}</span>
      </button>
    </div>
  );

  const noteLine = note && <p className={s.error} role="alert">{note}</p>;
  const ownerLine = !isOwner && <p className={s.hint}>{W.ownerConnects}</p>;

  const stopDoor = isOwner && (
    <div className={s.rareDoor}>
      <button type="button" className="btn btn-ghost" onClick={() => setAskStop(true)} aria-haspopup="dialog">{W.stopDoor}</button>
    </div>
  );

  const families = (v: DomainView, chip: boolean) => (
    <div className={s.fact}>
      <span className={s.factLabel}>{W.familiesFindLabel}</span>
      <p className={s.factValue}>
        <span className={s.mono}>{v.fullName}</span>
        {chip && <>{' '}<RepChip tone="good">{W.connectedChip}</RepChip></>}
      </p>
    </div>
  );

  // ── a · the door, and b · typing ──
  if (!view) {
    if (own.failed && !own.loaded) return <p className={s.error} role="alert">{W.actionFailed}</p>;

    if (!typing) {
      return (
        <div>
          <div className={s.fact}>
            <span className={s.factLabel}>{W.familiesFindLabel}</span>
            <p className={s.factValue}><span className={s.mono}>{fieldlogicAddress}</span></p>
          </div>
          {isOwner ? (
            <>
              <p className={s.hint}>
                {W.changeLastPart.split(W.settingsLink)[0]}
                <Link href={`/${orgSlug}/admin/org/settings`}>{W.settingsLink}</Link>
                {W.changeLastPart.split(W.settingsLink)[1]}
              </p>
              <h3 className={s.doorTitle}>{W.doorTitle}</h3>
              <p className={s.doorBody}>{W.doorBody}</p>
              <button type="button" className="btn btn-outline" onClick={() => { setTyping(true); setRefusal(null); }}>{W.useIt}</button>
            </>
          ) : (
            <p className={s.hint}>{W.adminDoor}</p>
          )}
        </div>
      );
    }

    // b · the form. Held-by-another-service (g2) replaces the field's error with its own card and a Try again.
    const held = refusal?.reason === 'held_elsewhere';
    const fieldError = refusal && !held ? refusal.text : null;
    const fullPreview = other ? value : `www.${value}`;
    return (
      <div>
        <div className={s.field}>
          <label className={s.fieldLabel} htmlFor="own-address-input">{W.fieldLabel}</label>
          <div className={`${s.addressBox}${fieldError || held ? ` ${s.addressBoxBad}` : ''}`}>
            {!other && <span className={s.addressPrefix} aria-hidden>{W.fieldPrefix}</span>}
            <input
              id="own-address-input"
              className={`${s.addressInput}${other ? ` ${s.addressInputFull}` : ''}`}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={value}
              placeholder={other ? W.placeholderOther : W.placeholder}
              onChange={e => { setValue(cleanAddressWhileTyping(e.target.value, other ? 'other' : 'www')); setRefusal(null); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void connect(); } }}
              disabled={working}
              aria-invalid={!!fieldError || held || undefined}
              aria-describedby="own-address-hint"
            />
          </div>
          <p className={s.hint} id="own-address-hint" aria-label={value ? fullPreview : undefined}>{other ? W.fieldHintOther : W.fieldHint}</p>
          {fieldError && <p className={s.error} role="alert">{fieldError}</p>}
          <p className={s.hint}>
            <button type="button" className={s.linkButton} onClick={() => { setOther(o => !o); setValue(''); setRefusal(null); }} disabled={working}>
              {other ? W.backToWww : W.otherLink}
            </button>
          </p>
        </div>

        {held ? (
          <Callout tone="warn" role="alert" flush icon={<AlertTriangle size={16} aria-hidden />}>
            <p className={s.boxTitle}>{W.heldTitle}</p>
            <p className={s.boxText}>{W.heldBody(fullPreview)}</p>
          </Callout>
        ) : (
          <Callout tone="warn" flush icon={<AlertTriangle size={16} aria-hidden />}>{other ? W.replaceWarnOther : W.replaceWarn}</Callout>
        )}

        {working && <p className={s.loadingLine} role="status"><span className={s.dot} aria-hidden />{W.loadingRecords}</p>}
        <div className={s.formFoot}>
          <button type="button" className="btn btn-outline" onClick={() => { setTyping(false); setValue(''); setOther(false); setRefusal(null); }} disabled={working}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void connect()} disabled={working || !value.trim()}>{held ? W.tryAgain : W.next}</button>
        </div>
      </div>
    );
  }

  // ── A connection exists ──
  const old = fieldlogicAddress;
  const stopDialog = askStop && (
    <KitDialog
      kind="question"
      title={W.stopTitle(view.fullName)}
      onClose={() => { if (!busy) setAskStop(false); }}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={() => setAskStop(false)} disabled={busy} data-autofocus="">{W.keepIt}</button>
          <button type="button" className="btn btn-danger" onClick={() => void stop('notice')} disabled={busy}>{busy ? W.stopping : W.stopIt}</button>
        </>
      )}
    >
      <p>{W.stopBody(view.fullName, old)}</p>
    </KitDialog>
  );

  // e · connected
  if (view.status === 'connected') {
    const bare = bareState(view);
    const date = longDate(view.padlockExpiresAt);
    return (
      <div>
        {live()}
        <dl className={s.facts}>
          <div><dt>{W.familiesFindLabel}</dt><dd><span className={s.mono}>{view.fullName}</span> <RepChip tone="good">{W.connectedChip}</RepChip></dd></div>
          <div><dt>{W.oldAddressLabel}</dt><dd><span className={s.mono}>{W.oldAddressForwards(old)}</span></dd></div>
          {bare && (
            <div>
              <dt><span className={s.mono}>{view.domain}</span></dt>
              <dd>
                {bare === 'forwards' && W.bareForwards}
                {bare === 'unknown' && W.bareUnknown}
                {bare === 'not_forwarding' && <>{W.bareNotForwarding} · <a className={s.linkButton} href={OWN_ADDRESS_HELP_HREF} target="_blank" rel="noopener noreferrer">{W.bareHow}</a></>}
              </dd>
            </div>
          )}
          <div><dt>{W.padlockLabel}</dt><dd>{W.padlockRenews(date)}</dd></div>
        </dl>
        <p className={s.hint}>{W.keepRecords(view.domain)}</p>
        <div className={s.disclosure}>
          <button type="button" className={`${s.disclosureButton}${showRecords ? ` ${s.disclosureOpen}` : ''}`} aria-expanded={showRecords}
            aria-controls="own-address-records" onClick={() => setShowRecords(v => !v)}>
            {showRecords ? W.hideRecords : W.showRecords}
            <ChevronDown size={16} aria-hidden />
          </button>
          <div id="own-address-records" hidden={!showRecords}>
            {cards(view, 'both', true)}
            {wholeNameHint(view)}
          </div>
        </div>
        {noteLine}
        {ownerLine}
        {stopDoor}
        {stopDialog}
      </div>
    );
  }

  // f · needs attention
  if (view.status === 'needs_attention') {
    const noticed = longDate(view.needsAttentionSince) ?? '';
    return (
      <div>
        {live()}
        <Callout tone="warn" role="alert" flush icon={<AlertTriangle size={16} aria-hidden />}>
          <p className={s.boxTitle}>{W.padlockGoneTitle}</p>
          <p className={s.boxText}>{W.padlockGoneBody(view.domain, longDate(view.padlockExpiresAt), noticed, ownerLabel)}</p>
        </Callout>
        <div style={{ height: 12 }} />
        {cards(view, 'padlock', true)}
        {wholeNameHint(view)}
        {foot(view, W.checkEveryDay)}
        {noteLine}
        {families(view, false)}
        {ownerLine}
        {stopDoor}
        {stopDialog}
      </div>
    );
  }

  // g3 · not working
  if (view.status === 'not_working') {
    return (
      <div>
        {live()}
        <Callout tone="bad" role="alert" flush icon={<XCircle size={16} aria-hidden />}>
          <p className={s.boxTitle}>{W.notWorkingTitle(view.fullName)}</p>
          <p className={s.boxText}>{W.notWorkingBody(view.domain, old, ownerLabel, view.notWorkingSince ? clock(view.notWorkingSince) : null)}</p>
        </Callout>
        <div style={{ height: 12 }} />
        {cards(view, 'site', true)}
        {foot(view, W.checkEveryHour)}
        {noteLine}
        {ownerLine}
        {stopDoor}
        {stopDialog}
      </div>
    );
  }

  // g1 · gave up after two days
  if (view.status === 'not_connected') {
    return (
      <div>
        {live()}
        <Callout tone="warn" role="alert" flush icon={<AlertTriangle size={16} aria-hidden />}>
          <p className={s.boxTitle}>{W.gaveUpTitle}</p>
          <p className={s.boxText}>{W.gaveUpBody(gaveUpWhich(view), view.domain)}</p>
        </Callout>
        <div style={{ height: 12 }} />
        {cards(view, 'both', false)}
        {wholeNameHint(view)}
        {isOwner && (
          <div className={s.messageRow}>
            <button type="button" className="btn btn-lime" onClick={() => void retry()} disabled={busy}>{W.tryAgain}</button>
          </div>
        )}
        {noteLine}
        {ownerLine}
        {isOwner && (
          <div className={s.rareDoor}>
            <button type="button" className="btn btn-ghost" onClick={() => void stop('form')} disabled={busy}>{W.useDifferent}</button>
          </div>
        )}
      </div>
    );
  }

  // c·d · waiting for the records
  const line = waitingLine(view, new Date());
  const statusTitle = line === 'still_waiting' ? W.stillWaitingTitle : W.checkingTitle;
  const giveUp = new Date(view.giveUpAt).toISOString();
  const statusBody =
    line === 'record2_old' ? W.checkingRecord2Old
    : line === 'still_waiting' ? W.stillWaitingBody(`${formatInOrgZone(giveUp, { weekday: 'long' })} at ${clock(giveUp)}`)
    : !isOwner ? W.checkingAdmin
    : checking ? W.checkingRunning
    : W.checkingStart;
  const helpMessage = () => registrarMessage({ clubName, ownerName, view, helpLink: OWN_ADDRESS_HELP_PATH });

  return (
    <div>
      {live()}
      <p className={s.lead}>{W.recordsLead(view.domain)}</p>
      {cards(view, 'both', false)}
      {wholeNameHint(view)}

      {isOwner && (
        <div className={s.messageRow}>
          <button type="button" className="btn btn-outline" onClick={() => void message.copy(helpMessage())}>
            <Mail size={14} aria-hidden /> {message.copied ? W.messageCopied : W.copyMessage}
          </button>
          <span className={s.hint}>{W.copyMessageFor(view.domain)}</span>
        </div>
      )}

      {view.prefix === 'www' && (
        <div className={s.box}>
          <Link2 size={16} aria-hidden />
          <div className={s.boxBody}>
            <p className={s.boxTitle}>{W.forwardTitle(view.domain)}</p>
            <p className={s.boxText}>{W.forwardBody(view.fullName)}</p>
            <p className={s.places}>
              <span>{W.forwardHowTo}</span>
              {W.forwardPlaces.map(p => (
                <a key={p} href={`${OWN_ADDRESS_HELP_HREF}#${p.toLowerCase().replace(/\s+/g, '-')}`} target="_blank" rel="noopener noreferrer">{p}</a>
              ))}
            </p>
            <p className={s.boxText}>{W.forwardAlias}</p>
          </div>
        </div>
      )}
      <p className={s.hint}>{W.emailUnaffected(view.domain)}</p>

      <div className={s.box} role="status">
        <Clock size={16} aria-hidden />
        <div className={s.boxBody}>
          <p className={s.boxTitle}>{statusTitle}</p>
          <p className={s.boxText}>{statusBody}</p>
        </div>
      </div>

      {foot(view, W.lastChecked)}
      {noteLine}
      {ownerLine}
      {isOwner && (
        <div className={s.rareDoor}>
          <button type="button" className="btn btn-ghost" onClick={() => void stop('quiet')} disabled={busy}>{W.cancelStart}</button>
        </div>
      )}
    </div>
  );
}
