'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { UserPlus, Trash2, Check, Lock } from 'lucide-react';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import {
  ASSISTANT_DEFAULTS,
  HELPER_PRESET,
  resolveCoachCapabilities,
  staffKindLabel,
  type CoachCapabilities,
  type AssistantCapabilityGrants,
  type DocsAccess,
} from '@/lib/coach-capabilities';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachStaffPanel.module.css';

/**
 * ⚠ The SERVER's type, not a copy of it. This file used to redeclare the whole capability shape
 * (plus its three string unions) as a structural twin — which compiled happily while silently
 * disagreeing, and had to be hand-extended every time a grant was added. It is an alias now, so a
 * new grant is a type error here until this panel decides what to do about it.
 */
type Caps = CoachCapabilities;

interface StaffMember {
  /** The TEAM MEMBERSHIP id (M1, 2026-08-16) — one row per person per team, no season attached. */
  memberId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string | null;
  /**
   * ⚠ A LABEL, never a gate — this person's address also holds a verified family connection to
   * this team. Computed server-side by comparing addresses; no family data is joined or sent here.
   *
   * ⚠ **A `false` here means "not known to be", NOT "definitely isn't."** The lookup is best-effort
   * (it fails soft), and it matches on the address the person signed in with, which need not be the
   * one they followed under. Every sentence that reads this must stay true when it is wrongly
   * false — see the removal dialog.
   */
  alsoFollowsTeam?: boolean;
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
  // ⚠ The Roster Hidden/View control lived here until A1 (2026-08-03). Players' names, numbers and
  // positions are baseline for everyone with portal access, so there is nothing left to switch —
  // `STANDING_ACCESS_NOTE` below is what a head coach reading this grid sees in its place.
  //
  // Everyday since 2026-07-31: this grant is blank TEAM forms only. A player's signed waiver or
  // medical consent now additionally requires `rosterPii` (`canViewPlayerDocuments`), so the speed
  // bump lives on the grant that actually hands over family details.
  { key: 'documents', label: 'Documents', hint: 'Blank team forms', options: [
    { value: 'off', label: 'Hidden' }, { value: 'view', label: 'View' }, { value: 'manage', label: 'Manage' } ] },
];

/**
 * ⚠ A1 (2026-08-03) — what a head coach reads where the Roster Hidden/View control used to be.
 *
 * It is NOT decoration. The switch it replaces was set deliberately by any coach who used it, and
 * they will come looking for it; a grid that simply lost a control tells them nothing. Two jobs, in
 * one sentence each: state what is true now, and point at the switch below that does the protecting
 * the retired one only appeared to.
 */
const STANDING_ACCESS_NOTE =
  'Players’ names, numbers and positions are visible to everyone on your staff. '
  + 'Their contact details and birthdates are not — that’s below.';

const EVERYDAY_TOGGLES: Toggle[] = [
  /**
   * ⚠ Two controls since 2026-08-03, not one. `schedule` used to mean *see it* AND *change it*, so
   * there was no way to grant someone the practice they are turning up to without also handing them
   * the power to delete a game. Both default ON for an assistant, so this reads as one grant split
   * in two rather than as anything taken away.
   */
  { key: 'schedule', label: 'Schedule', hint: 'See the schedule + practice plans' },
  { key: 'scheduleManage', label: 'Change the schedule', hint: 'Add, edit and cancel events' },
  { key: 'attendance', label: 'Attendance', hint: 'Record attendance' },
  { key: 'lineups', label: 'Lineups', hint: 'Build game lineups' },
  // Chat used to be un-toggleable and was named as such in the rail below. It is a grant now,
  // because a helper must be able to be staff without being in the room where coaches talk.
  { key: 'staffChat', label: 'Staff chat', hint: 'In the team’s staff room' },
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
const grantedIn = (caps: Caps, key: keyof Caps) => {
  const v = caps[key];
  return v !== false && v !== 'off';
};
const grantedByDefault = (key: keyof Caps) => grantedIn(ASSISTANT_DEFAULTS, key);

// Chat used to be hard-coded into this list because it was NOT a capability — membership was derived
// from the staff assignment. It is `staffChat` now (2026-08-03) and derives like everything else.
const DEFAULT_ON = GRANT_LABELS.filter(g => grantedByDefault(g.key)).map(g => g.label);
const DEFAULT_OFF = GRANT_LABELS.filter(g => !grantedByDefault(g.key)).map(g => g.label);

/**
 * What the HELPER preset hands over, in the head coach's words rather than in grant names.
 *
 * ⚠ **WHICH side each item falls on is DERIVED from `HELPER_PRESET` itself** — only the wording is
 * chosen here. Hand-listing both halves was the first version of this, and copy describing a
 * permission bundle is exactly the kind of thing that drifts silently: widen the preset and the
 * card keeps promising the old boundary, which mis-briefs a head coach about a stranger's access to
 * children. Deriving the membership makes that failure structurally impossible; the day someone
 * adds a grant to the preset, this card moves it across on its own.
 */
const HELPER_CAPS = resolveCoachCapabilities('assistant_coach', HELPER_PRESET);

/** Plainer words than the duty grid's control labels, which are written for a coach mid-edit. */
const HELPER_PHRASING: Partial<Record<keyof Caps, string>> = {
  schedule: 'The practice schedule, and the plan for each practice',
  scheduleManage: 'Adding, changing or cancelling anything on the schedule',
  documents: 'Team documents',
  money: 'Team money — budget, dues and expenses',
  rosterPii: 'Guardian contacts, birthdates and medical details',
  notes: 'Your notes about any player',
  announcementsSend: 'Emailing your families',
};

/** Staff chat is excluded from BOTH derived lists — it gets its own, louder line in the markup. */
const helperGrantLabels = (held: boolean) => GRANT_LABELS
  .filter(g => g.key !== 'staffChat' && grantedIn(HELPER_CAPS, g.key) === held)
  .map(g => HELPER_PHRASING[g.key] ?? g.label);

const HELPER_GETS = [
  ...helperGrantLabels(true),
  // Not derivable from GRANT_LABELS because it is no longer a grant at all: since A1 (2026-08-03)
  // names, numbers and positions are baseline for everyone with portal access.
  'Players’ names, numbers and positions at their station',
];
const HELPER_NEVER = [
  ...helperGrantLabels(false),
  // Also not derivable, and for the mirror-image reason: the roster page and the record surfaces
  // beside it used to hang off the Roster switch. They follow record access now (`hasRecordAccess`),
  // which the preset deliberately holds none of — so this has to be said rather than computed.
  'The roster page, the development board and season reports',
];

/**
 * Count of sensitive grants currently in effect — shown on the collapsed group so it never hides one.
 * Derived from the SENSITIVE_* arrays themselves, so moving a control between groups (as Documents
 * moved out on 2026-07-31) can't leave a stale term counting something the group no longer shows.
 */
function sensitiveGrantCount(c: Caps): number {
  const granted = (v: unknown) => v !== false && v !== 'off' && v !== undefined;
  return [...SENSITIVE_SEGMENTS, ...SENSITIVE_TOGGLES].filter(t => granted(c[t.key])).length;
}

/**
 * ⚠ EVERY grant the server understands must appear here, including the ones this panel has no
 * control for. A PATCH replaces the whole stored bundle, so an omitted key is not "left alone" —
 * it is dropped, and the server then resolves it from the defaults. (The original example of that
 * hazard, `planPlayerNames`, is gone — A1 retired it along with `roster` — but the rule stands for
 * every grant that follows.)
 *
 * ⚠ The `Required<>` return type is what ENFORCES that, rather than this comment asking nicely:
 * every key of `AssistantCapabilityGrants` is mandatory here, so adding a grant to the server is a
 * compile error in this function until someone decides how the panel persists it. That is the
 * whole defence — the failure mode is silent, and a reviewer would have to know to look for it.
 */
function grantsFrom(c: Caps): Required<AssistantCapabilityGrants> {
  return {
    schedule: c.schedule, scheduleManage: c.scheduleManage,
    attendance: c.attendance, lineups: c.lineups,
    rosterPii: c.rosterPii, notes: c.notes,
    money: c.money, documents: c.documents,
    announcementsSend: c.announcementsSend, tryouts: c.tryouts,
    staffChat: c.staffChat,
  };
}

/**
 * DISPLAY ONLY — the server's own labeller, not a second copy of its rules. ⚠ It picks a WORD,
 * never an access decision. A head coach who hand-edits a helper's grants stops seeing "Helper" on
 * their card; nothing about what they can open changes, because the word never governed it.
 */
const isHelperBundle = (c: Caps) => staffKindLabel(c) === 'helper';

/**
 * M1 (owner ruling 2026-08-16): staff is THE TEAM'S — one list, no season attached. Removing
 * someone revokes their access to every screen and every season at once; their name stays on the
 * seasons they coached, and re-inviting reactivates the same membership. The panel's old archive
 * mode ("who may still look at this finished season", Chunk F governing rule 3) is retired with
 * the per-season access model that needed it.
 */
export default function CoachStaffPanel({ orgSlug, teamId }: {
  orgSlug: string;
  teamId: string;
}) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  /**
   * Which preset is being invited. Defaults to `helper` — deliberately, and it is the smaller of
   * the two grants: if a head coach picks without reading, the accident is that someone got LESS
   * access than intended and comes back to ask, rather than more than anyone decided.
   */
  const [invitePreset, setInvitePreset] = useState<'helper' | 'assistant'>('helper');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteError, setInviteError] = useState('');

  const confirm = useConfirm();
  const uid = useId();
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/staff`;

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(base);
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
    setStaff(prev => prev?.map(s => s.memberId === member.memberId ? { ...s, capabilities: next } : s) ?? prev);
    setSavingId(member.memberId);
    setSavedId(null);
    try {
      const res = await fetch(`${base}/${member.memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: grantsFrom(next) }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setStaff(prev => prev?.map(s => s.memberId === member.memberId ? { ...s, capabilities: json.capabilities } : s) ?? prev);
      setSavedId(member.memberId);
      setTimeout(() => setSavedId(id => id === member.memberId ? null : id), 1800);
    } catch {
      void load(); // revert to server truth on failure
    } finally {
      setSavingId(id => id === member.memberId ? null : id);
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
    const who = member.displayName || member.email || 'This assistant';
    // Was a native window.confirm() — the one dialog in the portal that broke from the app's own
    // styled confirmations (readiness-review finding f7-5).
    const ok = await confirm({
      title: 'Remove this assistant?',
      /**
       * ⚠ **TWO SENTENCES WITH A HISTORY — both load-bearing.**
       *
       * "Every screen, every season" is NEW (M1, 2026-08-16) and is the whole point of the model
       * change: removal used to drop ONE season's row while every past season kept admitting them,
       * and the old dialog honestly admitted it ("doesn't affect any other season"). If removal
       * ever stops meaning everywhere-at-once, this sentence is lying about the product's core
       * access promise.
       *
       * "COACHING access" (owner ruling 2026-08-03, ruling D): for an adult who ALSO follows the
       * team as a family member, "loses access to this team" was untrue — a staff removal doesn't
       * touch the family layer. `alsoFollowsTeam` can be a false NEGATIVE (failed lookup, different
       * address), so the base sentence stays scoped to coaching access no matter what the flag
       * says; the flag's only job is to ADD the family warning when we positively know about it.
       * Under-inform, never mis-state.
       */
      message: member.alsoFollowsTeam
        ? `${who} loses their coaching access to this team immediately — every screen, every season. Their name stays on the seasons they coached. ⚠ They're also connected to this team as a family member, and that's separate — they'll keep seeing your schedule, results and any game page you've shared. To end that too, remove them under Family access on your Roster page.`
        : `${who} loses their coaching access to this team immediately — every screen, every season. Their name stays on the seasons they coached, and adding them back later restores their access.`,
      confirmText: 'Remove',
      cancelText: 'Keep them',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingId(member.memberId);
    try {
      const res = await fetch(`${base}/${member.memberId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setStaff(prev => prev?.filter(s => s.memberId !== member.memberId) ?? prev);
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
        body: JSON.stringify({ email: inviteEmail.trim(), preset: invitePreset }),
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

  /**
   * ⚠ ONE role, two presets. Both lists below are `assistant_coach` rows — the split is read from
   * the GRANTS, never from a column, because there is no helper column and adding one would turn
   * this preset into the third role the 2026-08-03 ruling forbade.
   */
  const everyAssistant = (staff ?? []).filter(s => s.coachRole === 'assistant_coach');
  const helpers = everyAssistant.filter(s => isHelperBundle(s.capabilities));
  const assistants = everyAssistant.filter(s => !isHelperBundle(s.capabilities));

  /** Promote a helper to a full assistant coach: same person, same sign-in, a wider bundle. */
  async function promoteToAssistant(member: StaffMember) {
    const who = member.displayName || member.email || 'This helper';
    const ok = await confirm({
      title: `Make ${who} an assistant coach?`,
      message: `${who} will get everything an assistant starts with — the schedule, attendance, lineups, the roster page and your staff chat — and you can grant more from their card. Nothing sensitive is granted by this.`,
      confirmText: 'Make assistant coach',
      cancelText: 'Cancel',
      tone: 'warning',
    });
    if (!ok) return;
    // The server's own least-privilege bundle, not a hand-written copy of it: a change to the
    // assistant defaults must reach this path too, or a promoted helper quietly diverges from
    // everyone invited as an assistant on the same day.
    await saveCaps(member, {
      ...member.capabilities,
      schedule: ASSISTANT_DEFAULTS.schedule,
      scheduleManage: ASSISTANT_DEFAULTS.scheduleManage,
      attendance: ASSISTANT_DEFAULTS.attendance,
      lineups: ASSISTANT_DEFAULTS.lineups,
      documents: ASSISTANT_DEFAULTS.documents as DocsAccess,
      staffChat: ASSISTANT_DEFAULTS.staffChat,
    });
  }

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
      <p className={css.lede}>Invite assistants and choose exactly what each one can do.</p>

      {loadError && <p className={styles.errorText}>{loadError}</p>}

      <div className={css.cols}>
        {/* Invite — its own object, with a real field label. */}
        <div className={`${css.inviteArea} ${css.card} ${css.inviteCard}`}>
          <form onSubmit={sendInvite} className={css.inviteForm}>
            {/*
              The role choice comes BEFORE the email field, because it changes what every line under
              it means — including the field's own label. Radios rather than a select: there are two
              options, each needs a sentence, and a select hides the one you didn't pick.
            */}
            <fieldset className={css.presetSet}>
              <legend className={css.label}>Who are you inviting?</legend>
              {([
                { key: 'helper' as const, name: 'Helper', desc: 'Runs a station. Sees the practice, nothing else.' },
                { key: 'assistant' as const, name: 'Assistant coach', desc: 'Coaches the team. You choose what they can open.' },
              ]).map(opt => (
                <label
                  key={opt.key}
                  className={invitePreset === opt.key ? `${css.presetOpt} ${css.presetOptOn}` : css.presetOpt}
                >
                  <input
                    type="radio"
                    name={`${uid}-preset`}
                    value={opt.key}
                    checked={invitePreset === opt.key}
                    onChange={() => { setInvitePreset(opt.key); setInviteMsg(''); setInviteError(''); }}
                  />
                  <span>
                    <span className={css.presetName}>{opt.name}</span>
                    <span className={css.presetDesc}>{opt.desc}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className={css.field}>
              <label className={css.label} htmlFor={`${uid}-invite-email`}>
                {invitePreset === 'helper' ? 'Helper’s email' : 'Assistant’s email'}
              </label>
              <input
                id={`${uid}-invite-email`}
                type="email"
                required
                className={styles.input}
                placeholder={invitePreset === 'helper' ? 'helper@email.com' : 'assistant@email.com'}
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteMsg(''); setInviteError(''); }}
              />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={inviting}>
              <UserPlus size={15} />
              {inviting ? 'Sending…' : invitePreset === 'helper' ? 'Invite helper' : 'Invite assistant'}
            </button>
          </form>
          {inviteMsg && <p className={css.inviteNote}>{inviteMsg}</p>}
          {inviteError && <p className={`${styles.errorText} ${css.inviteError}`}>{inviteError}</p>}
        </div>

        {/*
          What the chosen preset actually hands over, in sentences. This lives in the PAGE and not
          in the rail beside it, because a reference rail does not exist below the wide breakpoint
          (design decision 2026-08-03) — and a head coach on a phone is the one who most needs to
          read what a stranger is about to be able to see.
        */}
        <div className={`${css.accessArea} ${css.card}`}>
            <p className={css.groupLabel}>
              {invitePreset === 'helper' ? 'What a helper gets' : 'What an assistant gets'}
            </p>
            <h4 className={css.railGroupLabel}>
              {invitePreset === 'helper' ? 'All they can see' : 'On from the start'}
            </h4>
            <ul className={css.railList}>
              {(invitePreset === 'helper' ? HELPER_GETS : DEFAULT_ON).map(label => (
                <li key={label} className={css.railItem}>
                  <span className={css.railIconOn}><Check size={13} aria-hidden /></span>
                  {label}
                </li>
              ))}
            </ul>
            <h4 className={css.railGroupLabel}>
              {invitePreset === 'helper' ? 'Never' : 'Off until you turn it on'}
            </h4>
            <ul className={css.railList}>
              {(invitePreset === 'helper' ? HELPER_NEVER : DEFAULT_OFF).map(label => (
                <li key={label} className={css.railItem}>
                  <span className={css.railIconOff}><Lock size={12} aria-hidden /></span>
                  {label}
                </li>
              ))}
              {invitePreset === 'helper' && (
                /*
                  ⚠ The loudest line on the card, and the only one drawn as an exclusion rather than
                  a lock. Every other "never" here is something a head coach would EXPECT a stranger
                  not to have; the staff room is the one they would assume wrong, because until this
                  release everybody on a team's staff list was in it automatically.
                */
                <li className={`${css.railItem} ${css.railItemNever}`}>
                  <span className={css.railIconNever} aria-hidden>✕</span>
                  <span><strong>Your staff chat</strong> — helpers are never in it</span>
                </li>
              )}
            </ul>
            <p className={css.railFoot}>
              {invitePreset === 'helper'
                ? 'A helper can’t change anything — not the plan, not the schedule, not a single game. They sign in as themselves, and you can take this back any time.'
                : 'Every assistant signs in as themselves — you never share a password — and you can take any of this back the moment you need to.'}
            </p>
        </div>

        <div className={css.listArea}>
          {!staff && !loadError && <p className={styles.muted}>Loading staff…</p>}

          {staff && everyAssistant.length === 0 && (
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

          {staff && everyAssistant.length > 0 && (
            <p className={css.count}>
              {assistants.length > 0 && `${assistants.length} ${assistants.length === 1 ? 'assistant' : 'assistants'}`}
              {assistants.length > 0 && helpers.length > 0 && ' · '}
              {helpers.length > 0 && `${helpers.length} ${helpers.length === 1 ? 'helper' : 'helpers'}`}
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
              const labelId = `${uid}-${member.memberId}-${String(seg.key)}`;
              return (
                <div key={String(seg.key)} className={css.seg}>
                  <span className={css.segLabel} id={labelId}>{seg.label}</span>
                  <span className={css.segControl} role="group" aria-labelledby={labelId}>
                    {seg.options.map(opt => {
                      const active = String(c[seg.key]) === opt.value;
                      return (
                        <button key={opt.value} type="button"
                          aria-pressed={active}
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
                <input type="checkbox" checked={Boolean(c[t.key])}
                  onChange={e => setCap({ [t.key]: e.target.checked } as Partial<Caps>)} />
                <span>
                  <span className={css.checkLabel}>{t.label}</span>
                  <span className={css.checkHint}>{t.hint}</span>
                </span>
              </label>
            );
            const granted = sensitiveGrantCount(c);
            return (
              <div key={member.memberId} className={css.card}>
                <div className={css.person}>
                  <div>
                    <p className={css.personName}>{member.displayName || member.email || 'Assistant coach'}</p>
                    {member.email && member.displayName && <p className={css.personEmail}>{member.email}</p>}
                    {member.alsoFollowsTeam && <p className={css.alsoFollows}>Also connected to this team as a family member</p>}
                  </div>
                  <div className={css.personActions}>
                    {/* Persistent live region — a wrapper that only appears WITH its text is often
                        never announced. This confirms a money / guardian-contact grant actually
                        saved, so it has to reach assistive tech. (/review 2026-07-31) */}
                    <span role="status" aria-live="polite">
                      {savingId === member.memberId && <span className={css.saveState}>Saving…</span>}
                      {savedId === member.memberId && <span className={css.saveStateDone}>Saved</span>}
                    </span>
                    <button type="button" onClick={() => removeAssistant(member)} disabled={removingId === member.memberId}
                      className={`${styles.btnSecondary} ${css.removeBtn}`}>
                      <Trash2 size={13} /> Remove
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
                  <p className={css.standingNote}>{STANDING_ACCESS_NOTE}</p>
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

          {/*
            HELPERS. ⚠ A helper card carries NO capability grid — not a disabled one, an absent one.
            Ten controls that a helper by definition does not hold is a set of switches that exist
            only to refuse, and this portal's rule is that such a control must be absent rather than
            disabled. What a helper has is one sentence; what a head coach can do about it is widen
            it in one tap or take it away in one tap.
          */}
          {helpers.map(member => (
            <div key={member.memberId} className={`${css.card} ${css.helperCard}`}>
              <div className={css.person}>
                <div>
                  <p className={css.personName}>{member.displayName || member.email || 'Helper'}</p>
                  {member.email && member.displayName && <p className={css.personEmail}>{member.email}</p>}
                  {member.alsoFollowsTeam && <p className={css.alsoFollows}>Also connected to this team as a family member</p>}
                </div>
                <div className={css.personActions}>
                  <span className={css.helperChip}>Helper</span>
                  <span role="status" aria-live="polite">
                    {savingId === member.memberId && <span className={css.saveState}>Saving…</span>}
                    {savedId === member.memberId && <span className={css.saveStateDone}>Saved</span>}
                  </span>
                </div>
              </div>

              <p className={css.helperSummary}>
                Sees the practice schedule and plans, and players’ names. Can’t change anything.
                Not in staff chat.
              </p>

              <div className={css.helperActions}>
                <button type="button" className={styles.btnSecondary}
                  disabled={savingId === member.memberId}
                  onClick={() => { void promoteToAssistant(member); }}>
                  Make assistant coach
                </button>
                <button type="button" className={`${styles.btnSecondary} ${css.removeBtn}`}
                  disabled={removingId === member.memberId}
                  onClick={() => removeAssistant(member)}>
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/*
          The rail no longer lists the defaults — that list moved INTO the page (see the access card
          above), where it is preset-aware and survives a phone. What is left here is the question a
          head coach actually has at this screen and can happily miss on a narrow viewport: which of
          the two am I inviting? That is exactly the altitude a reference rail is for.
        */}
        <aside className={`${css.railArea} ${css.rail}`} aria-label="Helper or assistant coach?">
          <h3 className={css.railTitle}>Helper or assistant?</h3>

          <div className={css.railGroup}>
            <h4 className={css.railGroupLabel} id={`${uid}-rail-helper`}>A helper</h4>
            <p className={css.railProse} aria-labelledby={`${uid}-rail-helper`}>
              A parent or an outside instructor who turns up to run a station. One screen,
              read-only, no staff chat. Perfect for the person doing the tee for an hour.
            </p>
          </div>

          <div className={css.railGroup}>
            <h4 className={css.railGroupLabel} id={`${uid}-rail-assistant`}>An assistant coach</h4>
            <p className={css.railProse} aria-labelledby={`${uid}-rail-assistant`}>
              Staff. They start with the schedule, attendance, lineups and the roster, they’re in
              your staff chat, and you can grant more from their card.
            </p>
          </div>

          <p className={css.railFoot}>
            Both sign in as themselves — you never share a password. You can promote a helper to an
            assistant coach later without inviting them again, and take any of it back at any time.
          </p>
        </aside>
      </div>
    </section>
  );
}
