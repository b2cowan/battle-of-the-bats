'use client';
/**
 * EMAIL FAMILIES (Club Tier Stage 7c — Asks 6 and 7; drawing 4). The one club send window (the 2026-10-11 ruling —
 * `../SendParts`): what sending does in one statement; Who — every family, some rep teams (ticked, each with its count)
 * or one house-league season, each a row with its count, offered only where the club runs it; the head coach copy; Subject
 * and Message; "Nobody to send to" for this choice's children with no family on file; See the email (the family envelope
 * as a guardian receives it); Last sent; and the foot — the sentence left ("88 families get it. 7 opted out and won't."),
 * Cancel and the lime that counts who it reaches, right (KitDialog `footerStart`). A send is a create, so it asks: Send.
 *
 * ⚖ ONE WINDOW, TWO DOORS (Club Tier Stage 9d-1, owner 9d1·1, 2026-10-26). The door decides the Who list:
 *   · FAMILIES (no `season`): today's list; its season choice offers every season with families, any status, and says
 *     whose three it counts toward — that season's, not the club's (9d1·6).
 *   · A SEASON (`season`): only that season's audiences — everyone, divisions, published teams, statuses (chips with
 *     their counts; an empty one is left out), or the families ticked on Registrations — counted in families with their
 *     children beside them; "See who gets it"; "Copy the team's coaches" on a team, unticked (9d1·9). One household (a
 *     row's ⋯, or ticked children of one family) is "Message this family", which never counts (9d1·5).
 * The foot always says the allowance this email counts toward, in any 24 hours (9d1·8, 9d1·12); a spent allowance is said
 * the moment the window opens, with Send absent.
 *
 * The server decides on the press (lib/families-email.ts): the same audience re-counted, the claim (a double press, two
 * people at once, the allowance), the batches through the family door, the log. A press that lost a race — the count
 * changed, the allowance went, it was just sent — keeps the message typed and says why at the foot's left, amber. The cap
 * and a double press take the lime's place; a changed count leaves it, to be pressed again on the new number.
 * "Show them" leaves for the list only while nothing is typed (absent, not disabled, once a message is being written —
 * leaving would lose it).
 *
 * ⚠ The words are /marketing's (lib/families-words.ts; 9d-1's in HOUSE_LEAGUE_STAGE9D1_COPY.md). ⚠ Never the word
 * "Messages"; "emails", never "sends".
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import ls from '../league/LeagueSeason.module.css';
import { repKit, useLatestRead } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import TeamPicker, { GROUPED_FROM } from './TeamPicker';
import { MailView, SampleBand, SamplePlatformLine, SendDoor, SendDoors, SendRow, SendRows, SendStanding, SendWhoList, sendEnvelope, useSendLevel } from '../SendParts';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import {
  ALLOWANCE_WORDS, CLUB_EMAIL_CAP, FAMILY_EMAIL_WORDS as W, FAMILY_LIST_WORDS as LW, SEASON_EMAIL_WORDS as SW, SEND_VIEW_WORDS as VW,
  type AllowanceOwner,
} from '@/lib/families-words';
import { familySenderName } from '@/lib/email-club-identity';
import type { FamilyListKey } from '@/lib/families-lists';
import { familyEnvelopeFooterWords } from '@/lib/family-mail-footer';
import type { FamilyEmailPreview } from '@/lib/families-email';
import type { SeasonEmailPreview } from '@/lib/house-league-email';
import { SEASON_STATUS_KEYS, type SeasonStatusKey } from '@/lib/families-audience';
import { joinWithAnd } from '@/lib/utils';
import { useIsPhone } from '@/lib/hooks/useIsPhone';

type ClubKind = 'every' | 'teams' | 'season' | 'list';
type SeasonKind = 'season' | 'season_divisions' | 'season_teams' | 'season_statuses' | 'season_families';

/** What a send said, for the page that opened the window (its pill, and "Open the email" on the history). */
export interface EmailSent { text: string; partial: boolean; sendId: string | null }

/** The season's door (9d-1): the season, and the families ticked on Registrations when the bulk bar or a row opened it. */
export interface SeasonDoor {
  id: string;
  name: string;
  /** Ticked registrations (the bulk bar), or one (a row's ⋯): Who is fixed to their families. */
  ticked?: readonly string[];
  /** "Show them" and the unpublished line's door. */
  registrationsHref: string;
  teamsHref: string;
}

export default function EmailFamiliesWindow({ q, initialList, season, onClose, onShowNoFamily, onSent }: {
  /** `orgSlug=…` */
  q: string;
  /** Opened from a Families list ("Email these families"): Who starts on that list. */
  initialList?: FamilyListKey;
  /** Opened from a house-league season: its own Who list (9d1·1). */
  season?: SeasonDoor;
  onClose: () => void;
  /** "Show them": the window closes and the list of children with no family on file opens. */
  onShowNoFamily: () => void;
  /** The send went: the page says so. */
  onSent: (text: string, sent?: EmailSent) => void;
}) {
  const phone = useIsPhone();
  const ticked = season?.ticked && season.ticked.length > 0 ? [...season.ticked] : null;
  // Families' Who
  const [kind, setKind] = useState<ClubKind>(initialList ? 'list' : 'every');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [list, setList] = useState<FamilyListKey | ''>(initialList ?? '');
  // A season's Who
  const [sKind, setSKind] = useState<SeasonKind>(ticked ? 'season_families' : 'season');
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [leagueTeamIds, setLeagueTeamIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<SeasonStatusKey[]>([]);

  const [copyCoaches, setCopyCoaches] = useState(!season);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<FamilyEmailPreview | null>(null);
  const [sPreview, setSPreview] = useState<SeasonEmailPreview | null>(null);
  const lv = useSendLevel(VW.backToMessage);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [standing, setStanding] = useState<string | null>(null);
  // A count that changed while the sender wrote: said once, amber, at the foot's left — and the lime stays, since pressing
  // Send again on the new number is exactly what the sender may do. It belongs to the pick it was said about.
  const [changed, setChanged] = useState<{ text: string; who: string } | null>(null);

  const sorted = (ids: readonly string[]) => [...ids].sort().join(',');
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the opener — the send windows' shape).
  const base = season ? `/api/admin/house-league/seasons/${season.id}/emails?${q}` : `/api/admin/families/email?${q}`;
  const scopeQuery = season
    ? sKind === 'season_divisions' ? `&kind=season_divisions&divisionIds=${encodeURIComponent(sorted(divisionIds))}`
      : sKind === 'season_teams' ? `&kind=season_teams&teamIds=${encodeURIComponent(sorted(leagueTeamIds))}`
      : sKind === 'season_statuses' ? `&kind=season_statuses&statuses=${encodeURIComponent(statuses.join(','))}`
      : sKind === 'season_families' ? `&kind=season_families&registrationIds=${encodeURIComponent(sorted(ticked ?? []))}`
      : '&kind=season'
    : kind === 'teams' ? `&kind=teams&teamIds=${encodeURIComponent(sorted(teamIds))}`
      : kind === 'season' ? `&kind=season&seasonId=${encodeURIComponent(seasonId)}`
      : kind === 'list' ? `&kind=list&list=${encodeURIComponent(list)}` : '&kind=every';

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    if (season) {
      const r = await moneyFetch<SeasonEmailPreview>(`${base}${scopeQuery}`).catch(() => null);
      if (!current()) return;
      if (!r?.ok) { setFailed(true); return; }
      setSPreview(r.data);
      // A picked team the list no longer offers (unpublished, or left with no families, while the window was open) is
      // dropped, not carried unseen: the sender could not see it, untick it, or Clear it, and Send would be refused for it.
      const offered = new Set(r.data.choices.teams.map(t => t.teamId));
      setLeagueTeamIds(ids => (ids.every(id => offered.has(id)) ? ids : ids.filter(id => offered.has(id))));
      return;
    }
    const r = await moneyFetch<FamilyEmailPreview>(`${base}${scopeQuery}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setPreview(r.data);
  }, [base, scopeQuery, beginRead, season]);
  // Every change of Who re-reads the count (the server's one audience — never a sum in the browser: two teams can
  // share a family). A tick waits a moment, so a run of ticks is one read.
  const ticking = season ? sKind !== 'season' && sKind !== 'season_families' : kind === 'teams';
  useEffect(() => {
    const t = window.setTimeout(() => { void load(); }, ticking ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, ticking]);

  const choices = preview?.choices ?? null;
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

  // ── Is the read in hand THIS pick's? (after a tick it is the last pick's until the next read lands) ──
  const sc = season ? sPreview?.scope ?? null : preview?.scope ?? null;
  const fresh = season
    ? !!sc && sc.kind === sKind && (
      sc.kind === 'season_divisions' ? sorted(sc.divisionIds) === sorted(divisionIds)
        : sc.kind === 'season_teams' ? sorted(sc.teamIds) === sorted(leagueTeamIds)
        : sc.kind === 'season_statuses' ? sc.statuses.join(',') === SEASON_STATUS_KEYS.filter(k => statuses.includes(k)).join(',')
        : true)
    : !!sc && sc.kind === kind && (sc.kind === 'teams' ? sorted(sc.teamIds) === sorted(teamIds)
      : sc.kind === 'season' ? !!seasonId && sc.seasonId === seasonId
      : sc.kind === 'list' ? !!list && sc.list === list : true);
  // A season's chips with nothing picked: the foot asks for a pick, and no count is read for it.
  const pickedNone = sKind === 'season_divisions' ? divisionIds.length === 0
    : sKind === 'season_teams' ? leagueTeamIds.length === 0
    : sKind === 'season_statuses' ? statuses.length === 0 : false;
  const loaded = season ? !!sPreview : !!preview && !!choices;
  const ready = loaded && !failed && fresh;
  const one = season && ready ? sPreview!.one : null;
  const families = ready ? (season ? sPreview!.families : preview!.families) : 0;

  // ── Whose allowance, and is it spent ──
  const allowance = season ? sPreview?.allowance ?? null : preview?.cap ?? null;
  const owner: AllowanceOwner = season ? { kind: 'season', name: season.name, here: true }
    : preview?.season ? { kind: 'season', name: preview.season.name, here: false } : { kind: 'club' };
  const capReason = (nextAt: string | null) => (owner.kind === 'season'
    ? (phone && owner.here ? SW.capReasonPhone(nextAt) : SW.capReason(owner.name, nextAt)) : W.capReason(nextAt));
  // A one-family message never counts toward the season's three (9d1·5): its own limit is the family's.
  const capHeld = one ? (one.state.capped ? SW.oneCap(one.familyName, one.state.nextAt) : null)
    : allowance?.capped && ready ? capReason(allowance.nextAt) : null;

  // ── Nobody to send to ──
  const pickSay = season && pickedNone
    ? sKind === 'season_divisions' ? SW.pickDivision : sKind === 'season_teams' ? SW.pickTeam : SW.pickStatus : null;
  const nobody = pickSay ?? (ready && families === 0 && !one
    ? !season && kind === 'teams' && teamIds.length === 0 ? W.pickTeams
      : (season ? sPreview!.optedOut : preview!.optedOut) > 0
        ? season && sPreview!.optedOutNamed ? SW.nobodyOptedOutNamed(sPreview!.optedOutNamed) : W.nobodyOptedOut
        : season && sPreview!.noFamily > 0 ? SW.noAddress(sPreview!.noFamily) : W.nobodyAtAll
    : null);
  const oneNobody = one && one.addresses.length === 0 ? SW.oneOptedOut(one.familyName) : null;
  const held = standing ?? capHeld ?? oneNobody ?? nobody;
  const whoKey = season
    ? `${sKind}:${sorted(divisionIds)}:${sorted(leagueTeamIds)}:${statuses.join(',')}`
    : `${kind}:${sorted(teamIds)}:${seasonId}:${list}`;

  async function send() {
    if (busy || !ready || held) return;
    if (!subject.trim()) { setError(W.needSubject); return; }
    if (!message.trim()) { setError(W.needMessage); return; }
    setBusy(true); setError(''); setChanged(null);
    try {
      const body = season
        ? {
          action: 'send', kind: sKind, divisionIds, teamIds: leagueTeamIds, statuses, registrationIds: ticked ?? undefined,
          subject, body: message, copyCoaches: copyCoaches && (sPreview?.coaches ?? 0) > 0, expected: families,
        }
        : {
          kind, teamIds: kind === 'teams' ? teamIds : undefined, seasonId: kind === 'season' ? seasonId : undefined,
          list: kind === 'list' ? list : undefined,
          subject, body: message, copyCoaches: copyCoaches && preview!.coaches > 0, expected: families,
        };
      const r = await moneyFetch<{
        reached?: number; families?: number; coaches?: number; sendId?: string | null; missedNamed?: string | null;
        one?: boolean; familyName?: string | null; code?: string; error?: string;
      }>(base, jsonInit('POST', body));
      if (r.ok) {
        if (r.data.one) { onSent(SW.oneSent(r.data.familyName ?? null)); return; }
        const reached = r.data.reached ?? 0, of = r.data.families ?? families, coaches = r.data.coaches ?? 0;
        const missed = of - reached;
        const said = [
          season ? SW.sent(reached, of) : W.sent(reached, of),
          missed > 0 ? SW.missed(missed, r.data.missedNamed ?? null) : null,
          coaches > 0 ? (season ? SW.coachesCopied(coaches) : W.coachesCopied(coaches)) : null,
          allowance ? ALLOWANCE_WORDS.foot(owner, Math.min(allowance.used + 1, CLUB_EMAIL_CAP)) : null,
        ].filter(Boolean).join(' ');
        onSent(said, { text: said, partial: missed > 0, sendId: r.data.sendId ?? null });
        return;
      }
      const code = r.data?.code;
      // A server error with no reason of its own (a gateway timeout on a long send) may have gone out in part: say so.
      if (!code && r.status >= 500) { setError(season ? SW.unknown : W.unknown); return; }
      if (code === 'cap' || code === 'just_sent') setStanding(refusalText(r.data, W.failed));
      else if (code === 'changed') { setChanged({ text: refusalText(r.data, W.failed), who: whoKey }); void load(); }
      else if (code === 'nobody' || code === 'opted_out') { setError(refusalText(r.data, W.failed)); void load(); }
      else setError(refusalText(r.data, W.failed));
    } catch {
      // No answer: it may have gone. Say so, rather than inviting a second press.
      setError(season ? SW.unknown : W.unknown);
    } finally {
      setBusy(false);
    }
  }

  const clearRefusal = () => { setStanding(null); setError(''); };
  const pickKind = (next: ClubKind) => { setKind(next); clearRefusal(); };
  const pickSeasonKind = (next: SeasonKind) => { setSKind(next); clearRefusal(); };
  const toggle = <T extends string>(set: (f: (xs: T[]) => T[]) => void, id: T) => {
    set(xs => (xs.includes(id) ? xs.filter(x => x !== id) : [...xs, id]));
    clearRefusal();
  };
  const toggleTeam = (id: string, on: boolean) => {
    setTeamIds(ids => (on ? [...new Set([...ids, id])] : ids.filter(x => x !== id)));
    setStanding(null);
  };

  const reason = season ? sPreview?.reason : preview?.reason;
  const orgName = season ? sPreview?.orgName : preview?.orgName;
  const club = season ? sPreview?.club ?? null : preview?.club ?? null;
  const replyLine = season ? sPreview?.replyLine : preview?.replyLine;
  const footer = reason && orgName ? familyEnvelopeFooterWords(orgName, reason) : null;
  const last = (season ? sPreview?.lastSent : preview?.lastSent) ?? null;
  const used = allowance?.used ?? 0;

  // The foot's sentence: who it reaches, who it won't, whose allowance it spends.
  const sentence = !ready ? null
    : one ? (one.addresses[0] ? SW.oneTo(one.addresses.join(', ')) : null)
    : season
      ? [SW.reach(families, sPreview!.children), sPreview!.optedOut > 0 ? SW.optedOut(sPreview!.optedOut, sPreview!.optedOutNamed) : null,
        sPreview!.senderSkipped ? W.youNotCounted : null, ALLOWANCE_WORDS.foot(owner, used)].filter(Boolean).join(' ')
      : [W.reach(families, preview!.optedOut), preview!.senderSkipped ? W.youNotCounted : null, ALLOWANCE_WORDS.foot(owner, used)].filter(Boolean).join(' ');
  const counting = loaded && !fresh && !pickSay ? SW.counting : null;

  const title = season ? (one ? SW.oneTitle : ticked ? SW.tickedTitle(families + (sPreview?.optedOut ?? 0)) : W.title) : W.title;

  // The two levels behind the form (SendParts `useSendLevel`): drawn instead of it, the form's state kept in this window.
  const canSeeWho = !!season && ready && !one && (sPreview?.who.length ?? 0) > 0;
  const showMail = lv.level === 'email' && !!footer && !!orgName;
  const showWho = lv.level === 'who' && canSeeWho;
  const showForm = !showMail && !showWho;

  return (
    <KitDialog
      kind="form"
      size="medium"
      {...(showForm ? {} : lv.dialog)}
      eyebrow={season ? season.name : W.eyebrow}
      title={title}
      onClose={onClose}
      busy={busy}
      dirty={typed}
      discardAsk={W.discardAsk}
      footerStart={held ? <SendStanding>{held}</SendStanding>
        : changed?.who === whoKey ? <SendStanding>{changed.text}</SendStanding>
        : counting ? <p className={ck.hint} role="status">{counting}</p>
        : sentence ? <p className={ck.hint} role="status">{sentence}</p> : undefined}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {!held && !counting && ready && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy}>
              {busy ? W.sending : one ? W.sendOne : W.send(families)}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {failed && !loaded ? (
        <p className={repKit.formError}>{W.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{W.tryAgain}</button></p>
      ) : !loaded ? (
        <LoadingState inline label="Loading who this reaches…" />
      ) : showMail ? (
        <MailView from={familySenderName(orgName)} subject={subject.trim() || W.subject}
          to={one ? one.addresses.join(', ') : W.toFamilies(families)} onTo={canSeeWho ? () => lv.open('who') : undefined}>
          {club ? <SampleBand club={club} /> : <span className={sendEnvelope.kicker}>{orgName}</span>}
          <p className={sendEnvelope.body}>{message.trim() || W.message}</p>
          <p className={sendEnvelope.foot}>{footer!.sentBy}<br />{replyLine && <>{replyLine}<br /></>}<u>{footer!.unsubscribe}</u></p>
          {club && <SamplePlatformLine clubName={club.name} />}
        </MailView>
      ) : showWho ? (
        <SendWhoList head={W.whoHead(families)} items={sPreview!.who.map(f => {
          const last = f.children[0]?.last ?? '';
          const firsts = joinWithAnd(f.children.map(k => k.first));
          const teams = [...new Set(f.children.map(k => k.team).filter((t): t is string => !!t))].join(', ');
          return { title: `${`${firsts} ${last}`.trim()}${teams ? ` · ${teams}` : ''}`, sub: f.optedOut ? W.optedOutTag : undefined, off: f.optedOut };
        })} />
      ) : season ? seasonWho() : clubWho()}
      {loaded && showForm && (
        <>
          <label className={ck.field} htmlFor="email-families-subject" style={{ marginTop: '0.9rem' }}>
            <span className={ck.label}>{W.subject}<span className={ck.required} aria-hidden>*</span></span>
            <input id="email-families-subject" className={ck.input} value={subject} maxLength={200}
              placeholder={season ? SW.subjectPlaceholder : undefined}
              onChange={e => { setSubject(e.target.value); setError(''); }} aria-required data-autofocus="" />
          </label>
          <label className={ck.field} htmlFor="email-families-body">
            <span className={ck.label}>{W.message}<span className={ck.required} aria-hidden>*</span></span>
            <textarea id="email-families-body" className={ck.textarea} value={message} maxLength={5000} rows={7}
              placeholder={season ? W.messagePlaceholder : undefined}
              onChange={e => { setMessage(e.target.value); setError(''); }} aria-required />
          </label>
          {ready && (season ? sPreview!.noFamily > 0 && families > 0 : preview!.noFamily > 0) && (
            <p className={ck.hint}>
              {season ? SW.noAddress(sPreview!.noFamily) : <><b>{W.nobodyLead}</b> {W.noFamily(preview!.noFamily)}</>}
              {!typed && <> <button type="button" className={repKit.inlineLink} onClick={onShowNoFamily}>{W.showThem}</button></>}
            </p>
          )}
          <SendDoors>
            {canSeeWho && <SendDoor onOpen={() => lv.open('who')}>{W.seeWho}</SendDoor>}
            {footer && <SendDoor onOpen={() => lv.open('email')}>{W.seeEmail}</SendDoor>}
          </SendDoors>
          {!one && last && (
            <p className={ck.hint}>{`${W.lastSent} ${W.lastSentValue(last.at, last.by, last.subject, last.families)}.`}</p>
          )}
        </>
      )}
    </KitDialog>
  );

  // ── Families' Who (Stage 7c; the season choice widened by 9d1·6) ──
  function clubWho() {
    if (!choices || !preview) return null;
    const hasRep = choices.teams.length > 0;
    const hasLeague = choices.seasons.length > 0;
    const hasLists = choices.lists.length > 0 || kind === 'list';
    const oneSeason = choices.seasons.length === 1 ? choices.seasons[0] : null;
    const picked = kind === 'season' ? choices.seasons.find(s => s.seasonId === seasonId) ?? null : null;
    const orgSlug = new URLSearchParams(q).get('orgSlug') ?? '';
    return (
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
              sub={oneSeason ? W.seasonOption(oneSeason.name, oneSeason.label ?? null, oneSeason.families) : W.seasonSub}
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
        {/* The name on the first line, its state and count smaller below — the portal's two-line dropdown (the kit's
            Role picker shape). A native `<select>` could only run them together on one line. */}
        {kind === 'season' && !oneSeason && (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="email-families-season">{W.seasonLabel}</label>
            <SublinedChoice id="email-families-season" label={W.seasonLabel} variant="toolbar"
              triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
              options={choices.seasons.map(s => ({ value: s.seasonId, name: s.name, sub: W.seasonPickSub(s.label ?? null, s.families) }))}
              value={seasonId || null}
              onChange={v => { setSeasonId(v); setStanding(null); }} />
          </div>
        )}
        {kind === 'season' && picked && (
          // Whose three it spends, said where the season is picked (9d1·6), with the season's own door for the rest.
          <p className={ck.hint}>
            {W.seasonCounts(picked.name)}{' '}
            <Link className={repKit.inlineLink} href={`/${orgSlug}/admin/house-league/seasons/${picked.seasonId}/notifications`}>{W.openSeason(picked.name)}</Link>
          </p>
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
      </>
    );
  }

  // ── A season's Who (9d-1, frame b) ──
  function seasonWho() {
    const p = sPreview;
    if (!p || !season) return null;
    const c = p.choices;
    const hasTeams = c.teams.length > 0 || p.unpublished.length > 0;
    // More than a dozen teams: shelves by division with a search, not one block of pills (TeamPicker).
    const grouped = c.teams.length > GROUPED_FROM;
    const pickingTeams = sKind === 'season_teams' && c.teams.length > 0;
    const chips = <T extends string>(items: readonly { id: T; name: string; n: number }[], on: readonly T[], flip: (id: T) => void, label: string) => (
      <div className={ls.chips} role="group" aria-label={label}>
        {items.map(x => (
          <button key={x.id} type="button" className={ls.chip} aria-pressed={on.includes(x.id)} onClick={() => flip(x.id)}>
            {SW.chip(x.name, x.n)}
          </button>
        ))}
      </div>
    );
    if (ticked) {
      // The ticked families (the bulk bar), or one family (a row's ⋯, or two children of one family).
      if (one) {
        const kids = joinWithAnd(one.children.map(k => k.first));
        return (
          <>
            <Statement lead={phone ? SW.statementPhone : SW.statement(season.name)} />
            <SendRows>
              <SendRow title={SW.oneFamily(one.familyName)} sub={[kids, one.addresses.join(', ')].filter(Boolean).join(' · ')} />
            </SendRows>
            {ticked.length > 1 && <p className={ck.hint}>{SW.twoChildrenOneFamily(ticked.length)}</p>}
          </>
        );
      }
      const named = p.who.map(f => `${f.familyName ?? f.children[0]?.last ?? ''}${f.children.length ? ` (${joinWithAnd(f.children.map(k => k.first))})` : ''}`);
      return (
        <>
          <Statement lead={phone ? SW.statementPhone : SW.statement(season.name)} />
          <p className={repKit.factsLabel}>{W.who}</p>
          <SendRows>
            <SendRow title={SW.tickedLead(p.who.length)}
              sub={`${named.slice(0, 5).join(' · ')}${named.length > 5 ? ` · ${SW.tickedMore(named.length - 5)}` : ''}`} />
          </SendRows>
        </>
      );
    }
    return (
      <>
        <Statement lead={phone ? SW.statementPhone : SW.statement(season.name)} />
        <p className={repKit.factsLabel} id="email-season-who-label">{W.who}</p>
        <SendRows group={{ radio: true, labelledBy: 'email-season-who-label' }}>
          <SendRow
            pick={{ checked: sKind === 'season', onChange: on => on && pickSeasonKind('season'), radio: 'email-season-who' }}
            title={SW.everyone}
            sub={<>{SW.everyoneSub} · {SW.everyoneCount(c.everyone.families, c.everyone.children)}</>}
          />
          {c.divisions.length > 0 && (
            <SendRow
              pick={{ checked: sKind === 'season_divisions', onChange: on => on && pickSeasonKind('season_divisions'), radio: 'email-season-who' }}
              title={SW.division}
              sub={sKind === 'season_divisions'
                ? chips(c.divisions.map(d => ({ id: d.divisionId, name: d.name, n: d.families })), divisionIds, id => toggle(setDivisionIds, id), SW.division)
                : SW.pickSub}
            />
          )}
          {hasTeams && (
            <SendRow
              pick={{ checked: sKind === 'season_teams', onChange: on => on && pickSeasonKind('season_teams'), radio: 'email-season-who' }}
              title={SW.teams}
              sub={!pickingTeams ? SW.teamsSub : grouped ? undefined
                : chips(c.teams.map(t => ({ id: t.teamId, name: t.name, n: t.families })), leagueTeamIds, id => toggle(setLeagueTeamIds, id), SW.teams)}
              below={!grouped ? undefined : pickingTeams
                ? <TeamPicker teams={c.teams} divisions={c.divisions} picked={leagueTeamIds}
                  onChange={ids => { setLeagueTeamIds(ids); clearRefusal(); }} />
                : null}
            />
          )}
          {c.statuses.length > 0 && (
            <SendRow
              pick={{ checked: sKind === 'season_statuses', onChange: on => on && pickSeasonKind('season_statuses'), radio: 'email-season-who' }}
              title={SW.status}
              sub={sKind === 'season_statuses'
                ? chips(c.statuses.map(s => ({ id: s.key, name: SW.statusNames[s.key], n: s.families })), statuses, id => toggle(setStatuses, id), SW.status)
                : SW.statusSub}
            />
          )}
        </SendRows>
        {sKind === 'season_teams' && (p.unpublished.length > 0 || !p.anyPublished) && (
          // Said up front, never refused after Send (9c's rule: a draft team is not an audience).
          <p className={ck.hint}>
            {!p.anyPublished ? SW.noneUnpublished : p.unpublished.map(d => SW.unpublished(d.name)).join(' ')}{' '}
            <Link className={repKit.inlineLink} href={season.teamsHref}>{SW.goTeams}</Link>
          </p>
        )}
        {sKind === 'season_teams' && c.teams.length > 0 && <p className={ck.hint}>{SW.teamHint}</p>}
        {sKind === 'season_teams' && ready && p.coaches > 0 && (
          <SendRows>
            <SendRow title={SW.copyCoaches(leagueTeamIds.length, p.coaches)} sub={SW.copyCoachesSub}
              pick={{ checked: copyCoaches, onChange: setCopyCoaches }} />
          </SendRows>
        )}
      </>
    );
  }
}
