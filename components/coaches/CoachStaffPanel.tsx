'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { UserPlus, Trash2, Check, Lock } from 'lucide-react';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { ASSISTANT_DEFAULTS } from '@/lib/coach-capabilities';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachStaffPanel.module.css';

type MoneyAccess = 'off' | 'read' | 'write';
type DocsAccess = 'off' | 'view' | 'manage';
type RosterAccess = 'off' | 'view';

interface Caps {
  isHeadCoach: boolean;
  schedule: boolean;
  attendance: boolean;
  lineups: boolean;
  roster: RosterAccess;
  rosterWrite: boolean; // server-derived (assistants always false); present in the resolved response
  rosterPii: boolean;
  notes: boolean;
  money: MoneyAccess;
  documents: DocsAccess;
  announcementsSend: boolean;
  tryouts: boolean;
}

interface StaffMember {
  coachId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string | null;
  capabilities: Caps;
  isSelf: boolean;
}

type Segment = { key: keyof Caps; label: string; hint: string; options: { value: string; label: string }[] };
type Toggle = { key: keyof Caps; label: string; hint: string };

/**
 * The head coach's duty grid. Grants are stored per-assistant; head coaches always have full access.
 *
 * Split into EVERYDAY (what an assistant is invited to do) and SENSITIVE (money, family contact
 * details, and anything that speaks to parents), which sits behind a disclosure — ten flat access
 * decisions in one grid was readiness-review finding #8. Every grant still saves instantly; only
 * *granting* something in the sensitive group asks first (D3, 2026-07-28), and as of 2026-07-31
 * every member of that group has a prompt rather than three of six.
 */
const EVERYDAY_SEGMENTS: Segment[] = [
  { key: 'roster', label: 'Roster', hint: 'Player list', options: [
    { value: 'off', label: 'Hidden' }, { value: 'view', label: 'View' } ] },
  // Everyday since 2026-07-31: this grant is blank TEAM forms only. A player's signed waiver or
  // medical consent now additionally requires `rosterPii` (`canViewPlayerDocuments`), so the speed
  // bump lives on the grant that actually hands over family details.
  { key: 'documents', label: 'Documents', hint: 'Blank team forms', options: [
    { value: 'off', label: 'Hidden' }, { value: 'view', label: 'View' }, { value: 'manage', label: 'Manage' } ] },
];

const EVERYDAY_TOGGLES: Toggle[] = [
  { key: 'schedule', label: 'Schedule', hint: 'View + manage events' },
  { key: 'attendance', label: 'Attendance', hint: 'Record attendance' },
  { key: 'lineups', label: 'Lineups', hint: 'Build game lineups' },
];

const SENSITIVE_SEGMENTS: Segment[] = [
  { key: 'money', label: 'Team money', hint: 'Budget, dues, expenses', options: [
    { value: 'off', label: 'Hidden' }, { value: 'read', label: 'View' }, { value: 'write', label: 'View + edit' } ] },
];

const SENSITIVE_TOGGLES: Toggle[] = [
  { key: 'rosterPii', label: 'Contacts & birthdates', hint: 'Guardian contact + player DOB' },
  { key: 'notes', label: 'Internal notes', hint: 'Private staff notes' },
  { key: 'announcementsSend', label: 'Send announcements', hint: 'Email parents (off = draft only)' },
  { key: 'tryouts', label: 'Tryouts', hint: 'Candidates + decisions' },
];

/**
 * EVERY grant in the Sensitive group asks first — the group's own note promises "You'll be asked to
 * confirm before granting these", and until 2026-07-31 only 3 of 6 actually did: Documents, Internal
 * notes and Tryouts handed over silently. Fixed the behaviour rather than softening the sentence —
 * "some of these" tells a head coach nothing about which. Documents left the group entirely (it now
 * grants blank team forms only), so the four below ARE the group.
 *
 * Adding a control to SENSITIVE_* without an entry here re-breaks that promise.
 *
 * Revoking is never confirmed — a head coach taking access back is always in a hurry.
 */
type ConfirmCopy = { title: string; message: string };
/** Returns null when THIS grant, for THIS assistant's current access, needs no speed bump. */
type ConfirmOnGrant = (who: string, current: Caps) => ConfirmCopy | null;

const CONFIRM_ON_GRANT: Partial<Record<keyof Caps, ConfirmOnGrant>> = {
  money: who => ({
    title: `Give ${who} access to team money?`,
    message: `${who} will be able to see the budget, dues, and every payment on this team. You can take this back any time.`,
  }),
  // The other half of the same compound: only claim the signed-forms consequence when Documents is
  // actually on, or this prompt overstates what it is about to grant — the mirror of the mistake
  // the Documents entry below fixes.
  rosterPii: (who, current) => ({
    title: `Share family contact details with ${who}?`,
    message: current.documents !== 'off'
      ? `${who} will see guardian names, emails, phone numbers, and player birthdates for the whole roster — and, because they already have Documents access, will be able to open each player's signed forms including medical consents.`
      : `${who} will see guardian names, emails, phone numbers, and player birthdates for the whole roster.`,
  }),
  announcementsSend: who => ({
    title: `Let ${who} email your families?`,
    message: `${who} will be able to send announcements to every guardian on the roster, not just draft them.`,
  }),
  tryouts: who => ({
    title: `Give ${who} access to tryouts?`,
    message: `${who} will see every candidate's guardian contact details and your evaluation decisions — including players who never join the team.`,
  }),
  notes: who => ({
    title: `Share your internal notes with ${who}?`,
    message: `${who} will see private staff notes about each player, which are written for coaches and never shown to families.`,
  }),
  /**
   * ⚠ Documents sits in EVERYDAY because on its own it grants blank team forms — but a player's
   * signed waiver / medical consent needs `documents` AND `rosterPii` together. So when contacts
   * are ALREADY granted, switching Documents on is the second half of a compound grant and DOES
   * hand over medical files — under a control labelled "Blank team forms".
   *
   * `/review` 2026-07-31 caught this: the `rosterPii` prompt covers the compound only when PII is
   * granted LAST, so whether anyone was warned depended purely on the order the head coach happened
   * to flip the two switches. Confirm exactly when the compound completes, and stay silent when
   * this really is just blank forms. Generalises: **when two grants COMBINE to unlock something
   * neither unlocks alone, the confirm belongs on whichever one completes the pair — which means
   * it is conditional on the other, not a fixed property of the control.**
   */
  documents: (who, current) => current.rosterPii
    ? {
        title: `Give ${who} access to signed player forms?`,
        message: `${who} already has family contact details, so turning Documents on also lets them open every player's signed forms — including medical consents.`,
      }
    : null,
};

/**
 * The access rail's two lists. This is the only place on the platform that states what an
 * assistant can actually see, and it used to be an empty state — so it disappeared the moment
 * the first invite landed, which is exactly when a head coach starts granting things (layout
 * study 2026-07-31). It is now standing reference beside the staff list.
 *
 * BOTH lists are derived from `ASSISTANT_DEFAULTS` — the server's own least-privilege bundle —
 * and never from which group a control happens to sit in.
 *
 * /review 2026-07-31 caught the first version deriving "off until you turn it on" from
 * SENSITIVE_* membership. **Sensitive and off-by-default are different questions:** Documents is
 * sensitive but ships `view` (a locked owner decision, 2026-06-25 — see `lib/coach-capabilities.ts`),
 * so the rail told head coaches that waivers and team files were locked when every new assistant
 * could already open them. Reading the defaults directly makes that class of lie structurally
 * impossible — if a default ever changes, this rail changes with it.
 */
const GRANT_LABELS: ReadonlyArray<{ key: keyof Caps; label: string }> =
  [...EVERYDAY_TOGGLES, ...EVERYDAY_SEGMENTS, ...SENSITIVE_SEGMENTS, ...SENSITIVE_TOGGLES]
    .map(({ key, label }) => ({ key, label }));

/** Granted = a toggle that is true, or a segment set to anything other than 'off'. */
const grantedByDefault = (key: keyof Caps) => {
  const v = ASSISTANT_DEFAULTS[key];
  return v !== false && v !== 'off';
};

// Chat is named explicitly because it is NOT a capability toggle — every coach on a team becomes a
// chat member on reconcile, so there is no default to derive it from.
const DEFAULT_ON = ['Chat', ...GRANT_LABELS.filter(g => grantedByDefault(g.key)).map(g => g.label)];
const DEFAULT_OFF = GRANT_LABELS.filter(g => !grantedByDefault(g.key)).map(g => g.label);

/**
 * Count of sensitive grants currently in effect — shown on the collapsed group so it never hides one.
 * Derived from the SENSITIVE_* arrays themselves, so moving a control between groups (as Documents
 * moved out on 2026-07-31) can't leave a stale term counting something the group no longer shows.
 */
function sensitiveGrantCount(c: Caps): number {
  const granted = (v: unknown) => v !== false && v !== 'off' && v !== undefined;
  return [...SENSITIVE_SEGMENTS, ...SENSITIVE_TOGGLES].filter(t => granted(c[t.key])).length;
}

function grantsFrom(c: Caps) {
  return {
    schedule: c.schedule, attendance: c.attendance, lineups: c.lineups,
    roster: c.roster, rosterPii: c.rosterPii, notes: c.notes,
    money: c.money, documents: c.documents,
    announcementsSend: c.announcementsSend, tryouts: c.tryouts,
  };
}

export default function CoachStaffPanel({ orgSlug, teamId, readAccessOnly = false, seasonQuery = '' }: {
  orgSlug: string;
  teamId: string;
  /**
   * Chunk F, governing rule 3: on a FINISHED season this panel governs who may still LOOK at
   * that season, and nothing else. Removing a coach revokes their read access immediately;
   * nobody can be invited to a season that has already happened, so the invite form goes.
   * The capability toggles become a read-out of what each person could see at the time — the
   * grants are the historical record, not a live control.
   */
  readAccessOnly?: boolean;
  /** `?year=…` for the season being shown, so the LIST matches the page heading. */
  seasonQuery?: string;
}) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteError, setInviteError] = useState('');

  const confirm = useConfirm();
  const uid = useId();
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/staff`;
  // ⚠ READ only. The write endpoints below deliberately do NOT carry the season — they resolve
  // the live year, which is why the archive hides them (see the Remove button).
  const readBase = `${base}${seasonQuery}`;

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(readBase);
      if (!res.ok) throw new Error('Could not load the coaching staff.');
      const json = await res.json();
      setStaff(json.staff ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the coaching staff.');
    }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  async function saveCaps(member: StaffMember, next: Caps) {
    // Optimistic update
    setStaff(prev => prev?.map(s => s.coachId === member.coachId ? { ...s, capabilities: next } : s) ?? prev);
    setSavingId(member.coachId);
    setSavedId(null);
    try {
      const res = await fetch(`${base}/${member.coachId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: grantsFrom(next) }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStaff(prev => prev?.map(s => s.coachId === member.coachId ? { ...s, capabilities: json.capabilities } : s) ?? prev);
      setSavedId(member.coachId);
      setTimeout(() => setSavedId(id => id === member.coachId ? null : id), 1800);
    } catch {
      void load(); // revert to server truth on failure
    } finally {
      setSavingId(id => id === member.coachId ? null : id);
    }
  }

  /**
   * Apply one capability change. Escalations into the sensitive group ask first; everything else
   * — including every revoke — saves the instant it's tapped, as it always has.
   */
  async function requestSetCap(member: StaffMember, patch: Partial<Caps>) {
    const [key, value] = Object.entries(patch)[0] as [keyof Caps, Caps[keyof Caps]];
    const current = member.capabilities[key];
    // Any WIDENING counts as a grant, not just off→on. Money read→write ("View" → "View + edit")
    // is the bigger of the two money grants, so confirming only the smaller one had it backwards.
    const RANK: Record<string, number> = { off: 0, view: 1, read: 1, manage: 2, write: 2 };
    const isGrant = typeof value === 'boolean'
      ? value && !current
      : (RANK[String(value)] ?? 0) > (RANK[String(current)] ?? 0);
    const prompt = CONFIRM_ON_GRANT[key];
    // A prompt may decline to fire for THIS assistant's current access (see `documents`), so the
    // null case is "no speed bump needed", not "no prompt configured".
    const copy = isGrant && prompt
      ? prompt(member.displayName || member.email || 'this assistant', member.capabilities)
      : null;
    if (copy) {
      const ok = await confirm({ ...copy, confirmText: 'Give access', cancelText: 'Cancel', tone: 'warning' });
      if (!ok) return;
    }
    await saveCaps(member, { ...member.capabilities, ...patch });
  }

  async function removeAssistant(member: StaffMember) {
    // Was a native window.confirm() — the one dialog in the portal that broke from the app's own
    // styled confirmations (readiness-review finding f7-5).
    const ok = await confirm({
      title: readAccessOnly ? 'Remove their access to this season?' : 'Remove this assistant?',
      // The archive wording names the blast radius precisely: this season's records only, and
      // nothing about the current one. It matters because the same button on a live season DOES
      // remove them from the team.
      message: readAccessOnly
        ? `${member.displayName || member.email || 'This assistant'} will no longer be able to open this finished season's records. It doesn't change what happened, and it doesn't affect any other season.`
        : `${member.displayName || member.email || 'This assistant'} loses access to this team immediately. You can invite them again later.`,
      confirmText: readAccessOnly ? 'Remove access' : 'Remove',
      cancelText: 'Keep them',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingId(member.coachId);
    try {
      const res = await fetch(`${base}/${member.coachId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setStaff(prev => prev?.filter(s => s.coachId !== member.coachId) ?? prev);
    } catch {
      void load();
    } finally {
      setRemovingId(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true); setInviteMsg(''); setInviteError('');
    try {
      const res = await fetch(`${base}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setInviteError(json.error ?? 'Could not send the invite.'); return; }
      setInviteMsg(json.pendingApproval
        ? 'Invite sent — your club admin will approve access.'
        : `Invite sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
    } catch {
      setInviteError('Could not send the invite.');
    } finally {
      setInviting(false);
    }
  }

  const assistants = (staff ?? []).filter(s => s.coachRole === 'assistant_coach');

  return (
    <section className={css.wrap} aria-labelledby={`${uid}-title`}>
      {/* The design decision retires the VISIBLE second section header (the page h1 names this
          screen). The heading itself still has to exist: without it the page jumped h1 → h3/h4 and
          a screen-reader user browsing by heading saw loose h3s with nothing tying them to
          "Assistant coaches" (/review 2026-07-31). Hidden visually, present structurally. */}
      <h2 id={`${uid}-title`} className={css.srOnly}>Assistant coaches</h2>

      {/* One sentence. The other half of the old intro ("nothing sensitive until you grant it")
          now lives in the access rail, where it can name the actual areas instead of being the
          same promise said twice on one screen. */}
      <p className={css.lede}>{readAccessOnly
          ? 'Who can still open this season’s records. Removing someone takes their access away straight away.'
          : 'Invite assistants and choose exactly what each one can do.'}</p>

      {loadError && <p className={styles.errorText}>{loadError}</p>}

      <div className={css.cols}>
        {/* Invite — its own object, with a real field label. Absent in an archive: you cannot
            add someone to a season that has already happened (Chunk F, rule 3). */}
        {!readAccessOnly && (
        <div className={`${css.inviteArea} ${css.card} ${css.inviteCard}`}>
          <form onSubmit={sendInvite} className={css.inviteForm}>
            <div className={css.field}>
              <label className={css.label} htmlFor={`${uid}-invite-email`}>Assistant&apos;s email</label>
              <input
                id={`${uid}-invite-email`}
                type="email"
                required
                className={styles.input}
                placeholder="assistant@email.com"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteMsg(''); setInviteError(''); }}
              />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={inviting}>
              <UserPlus size={15} /> {inviting ? 'Sending…' : 'Invite assistant'}
            </button>
          </form>
          {inviteMsg && <p className={css.inviteNote}>{inviteMsg}</p>}
          {inviteError && <p className={`${styles.errorText} ${css.inviteError}`}>{inviteError}</p>}
        </div>
        )}

        <div className={css.listArea}>
          {!staff && !loadError && <p className={styles.muted}>Loading staff…</p>}

          {staff && assistants.length === 0 && (
            // Quiet, not the glowing illustration: the invite sits directly above and the rail
            // beside it, so this is a note at the weight of the panels around it, not a hero.
            // The description no longer says an assistant "sees only the areas you switch on" —
            // that was false (several areas are on from the start) and contradicted the rail
            // beside it. (/review 2026-07-31)
            <CoachEmptyState
              quiet
              icon={<UserPlus size={18} aria-hidden />}
              headline="No assistant coaches yet"
              description="An assistant gets their own sign-in to this team, and you decide which areas they can open."
              payoff="They can add games while you run practice, build the lineup, or take attendance on game day, and it all lands in the same team — so the roster, schedule and Insights everyone sees stay in step."
            />
          )}

          {staff && assistants.length > 0 && (
            <p className={css.count}>
              {assistants.length} {assistants.length === 1 ? 'assistant' : 'assistants'}
            </p>
          )}

          {assistants.map(member => {
            const c = member.capabilities;
            const setCap = (patch: Partial<Caps>) => { void requestSetCap(member, patch); };
            // The visible label is tied to the button group with role="group" + aria-labelledby.
            // Without it a screen-reader user tabbing in hears only "Hidden, pressed" with no idea
            // WHICH area it governs — on a screen that hands out team money and guardian contact
            // details, that was the most consequential gap /review found (2026-07-31). The ids are
            // per-assistant so they stay unique when several staff cards are on screen.
            const renderSegment = (seg: Segment) => {
              const labelId = `${uid}-${member.coachId}-${String(seg.key)}`;
              return (
                <div key={String(seg.key)} className={css.seg}>
                  <span className={css.segLabel} id={labelId}>{seg.label}</span>
                  <span className={css.segControl} role="group" aria-labelledby={labelId}>
                    {seg.options.map(opt => {
                      const active = String(c[seg.key]) === opt.value;
                      return (
                        <button key={opt.value} type="button"
                          aria-pressed={active}
                          // Archive: a read-out of what this person could see AT THE TIME, not a
                          // control. The grants ARE the historical record (rule 1) — changing
                          // them would rewrite what the season showed.
                          disabled={readAccessOnly}
                          className={active ? `${css.segBtn} ${css.segBtnOn}` : css.segBtn}
                          onClick={() => setCap({ [seg.key]: opt.value } as Partial<Caps>)}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </span>
                  <span className={css.segHint}>{seg.hint}</span>
                </div>
              );
            };
            const renderToggle = (t: Toggle) => (
              <label key={String(t.key)} className={css.check}>
                <input type="checkbox" checked={Boolean(c[t.key])} disabled={readAccessOnly}
                  onChange={e => setCap({ [t.key]: e.target.checked } as Partial<Caps>)} />
                <span>
                  <span className={css.checkLabel}>{t.label}</span>
                  <span className={css.checkHint}>{t.hint}</span>
                </span>
              </label>
            );
            const granted = sensitiveGrantCount(c);
            return (
              <div key={member.coachId} className={css.card}>
                <div className={css.person}>
                  <div>
                    <p className={css.personName}>{member.displayName || member.email || 'Assistant coach'}</p>
                    {member.email && member.displayName && <p className={css.personEmail}>{member.email}</p>}
                  </div>
                  <div className={css.personActions}>
                    {/* Persistent live region — a wrapper that only appears WITH its text is often
                        never announced. This confirms a money / guardian-contact grant actually
                        saved, so it has to reach assistive tech. (/review 2026-07-31) */}
                    <span role="status" aria-live="polite">
                      {savingId === member.coachId && <span className={css.saveState}>Saving…</span>}
                      {savedId === member.coachId && <span className={css.saveStateDone}>Saved</span>}
                    </span>
                    {/*
                      Rule 3's one live action on a finished season. The endpoint resolves the
                      TARGET'S own season, so removing here revokes access to THAT season and
                      never touches a live assignment — the label says which.
                    */}
                    <button type="button" onClick={() => removeAssistant(member)} disabled={removingId === member.coachId}
                      className={`${styles.btnSecondary} ${css.removeBtn}`}>
                      <Trash2 size={13} /> {readAccessOnly ? 'Remove access' : 'Remove'}
                    </button>
                  </div>
                </div>

                {/* Everyday coaching — what an assistant is invited to do, always visible. One fixed
                    two-column grid (three toggles + Roster + Documents) instead of an auto-filling
                    one that re-flowed the same team's controls differently at every width. */}
                <p className={css.groupLabel}>Everyday coaching</p>
                <div className={css.grid}>
                  {EVERYDAY_TOGGLES.map(renderToggle)}
                  {EVERYDAY_SEGMENTS.map(renderSegment)}
                </div>

                {/* Sensitive access — money, family contact details, and anything that emails parents.
                    The count on the collapsed toggle means a granted permission is never out of sight,
                    and the group opens by default whenever something is already granted. */}
                <div className={css.disclosureWrap}>
                  <CoachFormDisclosure
                    label="Sensitive access"
                    title="Sensitive access"
                    note="Money, family contact details, and anything that emails your parents. You'll be asked to confirm before granting these."
                    meta={granted > 0 ? `${granted} granted` : undefined}
                    defaultOpen={granted > 0}
                  >
                    <div className={css.grid}>
                      {SENSITIVE_SEGMENTS.map(renderSegment)}
                      {SENSITIVE_TOGGLES.map(renderToggle)}
                    </div>
                  </CoachFormDisclosure>
                </div>
              </div>
            );
          })}
        </div>

        {/* Standing access reference — see DEFAULT_ON / DEFAULT_OFF above. */}
        <aside className={`${css.railArea} ${css.rail}`} aria-label="What an assistant gets">
          <h3 className={css.railTitle}>What an assistant gets</h3>

          {/* Real lists, each tied to its own heading. The check and lock glyphs are decorative
              (aria-hidden), so before this the on/off distinction reached assistive tech ONLY as
              reading order — fine read top-to-bottom, useless to anyone jumping by list or
              heading. The headings now carry the state, and the lists announce their length.
              (/review 2026-07-31) */}
          <div className={css.railGroup}>
            <h4 className={css.railGroupLabel} id={`${uid}-rail-on`}>On from the start</h4>
            <ul className={css.railList} aria-labelledby={`${uid}-rail-on`}>
              {DEFAULT_ON.map(label => (
                <li key={label} className={css.railItem}>
                  <span className={css.railIconOn}><Check size={13} aria-hidden /></span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className={css.railGroup}>
            <h4 className={css.railGroupLabel} id={`${uid}-rail-off`}>Off until you turn it on</h4>
            <ul className={css.railList} aria-labelledby={`${uid}-rail-off`}>
              {DEFAULT_OFF.map(label => (
                <li key={label} className={css.railItem}>
                  <span className={css.railIconOff}><Lock size={12} aria-hidden /></span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <p className={css.railFoot}>
            Every assistant signs in as themselves — you never share a password — and you can take
            any of this back the moment you need to.
          </p>
        </aside>
      </div>
    </section>
  );
}
