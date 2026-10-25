'use client';
/**
 * A club's record, on the screen (Support console Stage 2; the server half and the rulings are in `page.tsx`).
 *
 * ⚖ A RECORD READS FIRST AND EDITS WHOLE (owner 2026-10-01) — with the console's one named exception (A6): the standard
 * autosaves, and a live change to a customer cannot, so the check mark opens ONE confirm window that says every change in
 * one sentence and asks why. The form holds only the fields this role may change; everything else reads. The tabs step
 * aside while editing. Actions are not edits and stay doors in both modes: Add a note and Email the owner in the head,
 * Make owner on a member's row, Cancel the subscription and Delete the club at the END of Access (a rare door ends the
 * body, never a pinned row).
 * ⚖ R6: a role without a power sees no control for it — absent, never disabled, and no banner.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Check, Mail, Pencil } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import DateInput from '@/components/shared/DateInput';
import { filterStory, type StoryEntry, type StoryKind } from '@/lib/platform-story-view';
import { consoleDate, consoleDay } from '@/lib/console-dates';
import { rememberConsoleRecent } from '@/lib/console-recent';
import { cap, CLUB_SECTIONS, humanize, limitWords, overrideWhat, sectionLabel, STORY_KINDS } from '@/lib/platform-labels';
import { possessive } from '@/lib/utils';
import StoryTable from '../../StoryTable';
import RecordWindow from '../../RecordWindow';
import { errorOf, sendJson } from '../../console-fetch';
import { roleLabel } from '@/lib/member-access';
import { subscriptionStatusChip } from '../../chips';
import kit from '../../console.module.css';
import styles from '../../record.module.css';

const NOT_IN_STORY = 'Not in the Story yet: Stripe’s charges and refunds, purchases the customer makes in Stripe, and account emails such as password resets.';

type Tab = 'story' | 'money' | 'access' | 'people';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'story', label: 'Story' },
  { key: 'money', label: 'Money' },
  { key: 'access', label: 'Access' },
  { key: 'people', label: 'People & tournaments' },
];
/** The old record's tab names, so a link written before Stage 2 (Retention's, the Founding desk's) opens the right tab. */
const OLD_TABS: Record<string, Tab> = { billing: 'money', entitlements: 'access', support: 'access', activity: 'story' };

export type ClubRecordProps = {
  org: {
    id: string; name: string; slug: string; planId: string; planLabel: string; status: string; statusLabel: string;
    createdAt: string; currentPeriodEnd: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string | null;
    tournamentLimit: number; teamLimit: number | null; storedTeamLimit: number | null; isClubBand: boolean;
    enabledAddons: string[]; planSections: string[];
  };
  stripeBase: string;
  ownerEmail: string | null;
  ownerLastSignIn: string | null;
  teamCount: number;
  slotsHeld: number;
  members: Array<{ userId: string; email: string; name: string | null; role: string; status: string; lastSignInAt: string | null }>;
  tournaments: Array<{ id: string; name: string; status: string; startDate: string | null; endDate: string | null }>;
  overrides: Array<{
    id: string; type: string; value: string | null; addons: string[]; expiresAt: string | null; reason: string | null;
    createdBy: string | null; createdAt: string; endedAt: string | null; running: boolean;
  }>;
  ownAddress: { address: string; status: string } | null;
  teamMoves: Array<{ id: string; teamName: string; at: string; state: 'moved' | 'waiting_on_coach' | 'waiting_on_club' }>;
  story: { entries: StoryEntry[]; total: number };
  planOptions: Array<{ id: string; label: string; tournamentLimit: number; teamLimit: number }>;
  can: { support: boolean; billing: boolean; sections: boolean; delete: boolean; emailOwner: boolean };
};

type Window =
  | { kind: 'save' }
  | { kind: 'putBack'; entry: StoryEntry }
  | { kind: 'note' }
  | { kind: 'makeOwner'; member: ClubRecordProps['members'][number] }
  | { kind: 'release' }
  | { kind: 'override' }
  | { kind: 'cancel' }
  | { kind: 'delete' }
  | null;

/** A limit as it reads in a field or a fact: "No limit", or the number. */
const limitText = (n: number | null | undefined) => cap(limitWords(n));
/** How many Story entries the record's first page shows, and each "Show more" adds. */
const STORY_PAGE = 50;

export default function ClubRecord(props: ClubRecordProps) {
  const { org, can } = props;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tabParam = search.get('tab');
  const asked = tabParam ? (OLD_TABS[tabParam] ?? tabParam) : null;
  const tab: Tab = TABS.some(t => t.key === asked) ? (asked as Tab) : 'story';
  const canEdit = can.support || can.billing || can.sections;

  const [editing, setEditing] = useState(false);
  const [win, setWin] = useState<Window>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recent (Find's open-empty list) remembers this record in this browser only.
  useEffect(() => { rememberConsoleRecent({ kind: 'club', id: org.id, title: org.name }); }, [org.id, org.name]);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(search.toString());
    params.delete('via');
    if (next === 'story') params.delete('tab'); else params.set('tab', next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  // ── The form (only what this role may change) ──
  const initial = useMemo(() => ({
    name: org.name,
    slug: org.slug,
    planId: org.planId,
    tournamentLimit: org.tournamentLimit >= 9999 ? '' : String(org.tournamentLimit),
    teamLimit: org.storedTeamLimit && org.storedTeamLimit > 0 ? String(org.storedTeamLimit) : '',
    sections: [...org.enabledAddons].filter(k => CLUB_SECTIONS.some(s => s.key === k)).sort(),
  }), [org]);
  const [form, setForm] = useState(initial);
  const startEditing = () => { setForm(initial); setNotice(null); setEditing(true); };

  const plan = props.planOptions.find(p => p.id === form.planId);
  const targetIsClubBand = form.planId === 'club' || form.planId === 'club_large';
  const changes = {
    name: can.support && form.name.trim() !== initial.name,
    slug: can.support && form.slug.trim().toLowerCase() !== initial.slug,
    plan: can.billing && form.planId !== initial.planId,
    tournamentLimit: can.billing && form.tournamentLimit.trim() !== initial.tournamentLimit,
    teamLimit: can.billing && targetIsClubBand && form.teamLimit.trim() !== initial.teamLimit,
  };
  const sectionsOn = can.sections ? form.sections.filter(k => !initial.sections.includes(k)) : [];
  const sectionsOff = can.sections ? initial.sections.filter(k => !form.sections.includes(k)) : [];
  const sectionsChanged = sectionsOn.length + sectionsOff.length > 0;
  const anyChange = Object.values(changes).some(Boolean) || sectionsChanged;

  const toggleEdit = () => {
    if (!editing) { startEditing(); return; }
    if (!anyChange) { setEditing(false); return; }
    setWin({ kind: 'save' });
  };

  /** Every held change in one sentence (R3), built as pieces so a club's name is never read as markup. */
  function saveSentence(): ReactNode {
    const b = (text: string) => <strong>{text}</strong>;
    const { tournamentLimit: fromTournaments, teamLimit: fromTeams } = org;
    const turns = (keys: string[], word: string) => <>{b(keys.map(sectionLabel).join(', '))} turn{keys.length === 1 ? 's' : ''} {word}. </>;
    return (
      <>
        {changes.plan
          ? <>{org.name} moves from {b(org.planLabel)} to {b(plan?.label ?? form.planId)}. </>
          : <>{org.name} stays on {b(org.planLabel)}. </>}
        {changes.name && <>Its name becomes {b(form.name.trim())}. </>}
        {changes.slug && <>Its web name becomes {b(form.slug.trim().toLowerCase())}, and its addresses change with it. </>}
        {changes.tournamentLimit && <>Its tournament limit goes from {b(limitWords(fromTournaments))} to {b(form.tournamentLimit.trim() || 'no limit')}. </>}
        {changes.teamLimit && <>Its team limit goes from {b(limitWords(fromTeams))} to {b(form.teamLimit.trim() || `the plan’s ${plan?.teamLimit ?? ''}`.trim())} now. </>}
        {sectionsOn.length > 0 && turns(sectionsOn, 'on')}
        {sectionsOff.length > 0 && turns(sectionsOff, 'off')}
        The owner is not emailed.
      </>
    );
  }
  const entryCount = (changes.name ? 1 : 0) + (changes.slug ? 1 : 0) + (changes.plan || changes.tournamentLimit || changes.teamLimit ? 1 : 0)
    + sectionsOn.length + sectionsOff.length;
  const allUndoable = !changes.name && !changes.slug;

  async function save(reason: string) {
    const body: Record<string, unknown> = { reason };
    if (changes.name || changes.slug) { body.name = form.name; body.slug = form.slug; }
    if (changes.plan || changes.tournamentLimit || changes.teamLimit) {
      const lim = form.tournamentLimit.trim();
      body.plan = {
        planId: form.planId,
        tournamentLimit: lim ? Number(lim) : 9999,
        ...(targetIsClubBand && changes.teamLimit ? { teamLimit: form.teamLimit.trim() ? Number(form.teamLimit) : null } : {}),
      };
    }
    if (sectionsChanged) { body.sections = form.sections; body.sectionsWas = initial.sections; }
    const { ok, data } = await sendJson(`/api/platform-admin/orgs/${org.id}/record`, 'PATCH', body);
    if (!ok) {
      // Some parts saved before one failed: bring the record up to date, so trying again sends only what is left.
      if (Array.isArray(data.saved) && data.saved.length > 0) router.refresh();
      return errorOf(data, 'The changes could not be saved.');
    }
    const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
    setWin(null);
    setEditing(false);
    setNotice(warnings.length ? `Saved. ${warnings.join(' ')}` : null);
    router.refresh();
    return null;
  }

  // ── The Story: the first page from the server; the whole Story fetched ONCE when someone searches, filters or asks for
  //    more, then filtered on screen (`filterStory`), so the words never leave the browser.
  const [storyWords, setStoryWords] = useState('');
  const [storyKind, setStoryKind] = useState<StoryKind | ''>('');
  const [storyShown, setStoryShown] = useState(STORY_PAGE);
  const [fullStory, setFullStory] = useState<StoryEntry[] | null>(null);
  // A refresh after a save brings a new Story: drop the fetched copy (the lastPath pattern — never setState in an effect).
  const [storySource, setStorySource] = useState(props.story);
  if (storySource !== props.story) {
    setStorySource(props.story);
    setFullStory(null);
  }
  const wantsWhole = !!storyWords.trim() || !!storyKind || storyShown > STORY_PAGE;
  useEffect(() => {
    if (!wantsWhole || fullStory || props.story.entries.length >= props.story.total) return;
    let live = true;
    void sendJson(`/api/platform-admin/orgs/${org.id}/story`, 'GET').then(({ ok, data }) => {
      if (!live) return;
      if (ok && Array.isArray(data.entries)) setFullStory(data.entries as StoryEntry[]);
      else setNotice('The rest of the Story could not be read, so this shows only its newest entries. Reload to try again.');
    });
    return () => { live = false; };
  }, [wantsWhole, fullStory, props.story, org.id]);
  const storySourceEntries = fullStory ?? props.story.entries;
  const storyMatches = filterStory(storySourceEntries, { kind: storyKind || null, words: storyWords });
  const storyTotal = fullStory || wantsWhole ? storyMatches.length : props.story.total;
  const story = { entries: storyMatches.slice(0, storyShown), total: storyTotal };

  // ── The band: Members, then Teams (a club band) or Tournaments first, then Renews ──
  const membersCell = (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>Members</span>
      <span className={kit.bandValue}>{props.members.length}</span>
      <span className={kit.bandNote}>{props.ownerEmail ? (props.ownerLastSignIn ? `owner signed in ${consoleDay(props.ownerLastSignIn)}` : 'owner never signed in') : 'nobody is the owner'}</span>
    </div>
  );
  const teamsCell = (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>Teams</span>
      <span className={kit.bandValue}>{props.teamCount}{org.teamLimit != null && org.teamLimit < 9999 ? ` of ${org.teamLimit}` : ''}</span>
      <span className={kit.bandNote}>on the {org.planLabel} plan</span>
    </div>
  );
  const tournamentsCell = (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>Tournaments</span>
      <span className={kit.bandValue}>{org.tournamentLimit < 9999 ? `${props.slotsHeld} of ${org.tournamentLimit}` : props.tournaments.length}</span>
      <span className={kit.bandNote}>{org.tournamentLimit >= 9999 ? `no limit on ${org.planLabel}` : `the ${org.planLabel} limit`}</span>
    </div>
  );
  const runningOverrides = props.overrides.filter(o => o.running);
  const overridesCell = (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>Overrides</span>
      <span className={kit.bandValue}>{runningOverrides.length}</span>
      <span className={kit.bandNote}>running now</span>
    </div>
  );
  const renewsCell = (
    <div className={kit.bandCell}>
      <span className={kit.bandLabel}>{org.status === 'canceled' ? 'Ended' : org.status === 'trialing' ? 'Trial ends' : 'Renews'}</span>
      {org.currentPeriodEnd
        ? <><span className={`${kit.bandValue} ${kit.bandValueSm}`}>{consoleDate(org.currentPeriodEnd)}</span>
          <span className={kit.bandNote}>{org.stripeSubscriptionId ? 'from Stripe' : 'no Stripe subscription'}</span></>
        : <><span className={`${kit.bandValueText} ${styles.quietValue}`}>Not set</span>
          <span className={kit.bandNote}>no Stripe subscription</span></>}
    </div>
  );

  /** A window's confirm that sends one call, then closes and refreshes; the server's sentence on a refusal. */
  const act = (url: string, method: string, fallback: string, body: (reason: string) => unknown) => async (reason: string) => {
    const { ok, data } = await sendJson(url, method, body(reason));
    if (!ok) return errorOf(data, fallback);
    const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
    setWin(null);
    setNotice(warnings.length ? `Done. ${warnings.join(' ')}` : null);
    router.refresh();
    return null;
  };

  const counts: Partial<Record<Tab, number>> = { story: props.story.total, people: props.members.length + props.tournaments.length };

  return (
    <div className={kit.page}>
      <AdminPageHeader
        backTo={{ href: '/platform-admin/orgs', label: 'Clubs & portals' }}
        title={org.name}
        titleChips={<>
          <span className={kit.chip}>{org.planLabel}</span>
          <span className={`${kit.chip} ${subscriptionStatusChip(org.status)}`}>{org.statusLabel}</span>
        </>}
        actions={(canEdit || can.emailOwner || can.support) ? (
          <span className={styles.headActions}>
            {canEdit && (
              <button
                type="button"
                className={`${styles.pencil}${editing ? ` ${styles.pencilOn}` : ''}`}
                onClick={toggleEdit}
                aria-label={editing ? 'Done editing — review the changes' : 'Edit this record'}
                title={editing ? 'Done editing' : 'Edit'}
              >
                {editing ? <Check size={16} aria-hidden /> : <Pencil size={15} aria-hidden />}
              </button>
            )}
            {can.emailOwner && props.ownerEmail && (
              <a className="btn btn-secondary" href={`mailto:${props.ownerEmail}`}><Mail size={14} aria-hidden /> Email the owner</a>
            )}
            {can.support && <button type="button" className="btn btn-secondary" onClick={() => setWin({ kind: 'note' })}>Add a note</button>}
          </span>
        ) : undefined}
      />
      <p className={styles.caption}>
        {editing
          ? 'Editing. Nothing changes until you press the check mark and confirm.'
          : <>Owner {props.ownerEmail ?? 'none'} · <code className={kit.code}>{org.slug}</code> · Created {consoleDate(org.createdAt)}</>}
      </p>

      {notice && <div className={kit.notice} role="status">{notice}</div>}

      {editing ? (
        <div className={`${kit.card} ${kit.cardPad}`}>
          <div className={styles.form}>
            <div className={styles.editGrid}>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Name{can.support && <span className={kit.req} aria-hidden>*</span>}</span>
                {can.support
                  ? <input className={`${kit.field} ${changes.name ? styles.changed : ''}`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  : <span className={styles.readValue}>{org.name}</span>}
              </label>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Web name{can.support && <span className={kit.req} aria-hidden>*</span>}</span>
                {can.support
                  ? <input className={`${kit.field} ${kit.code} ${changes.slug ? styles.changed : ''}`} value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))} required />
                  : <span className={`${styles.readValue} ${kit.code}`}>{org.slug}</span>}
              </label>
            </div>
            <div className={styles.editGrid}>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Plan</span>
                {can.billing ? (
                  <select
                    className={`${kit.select} ${changes.plan ? styles.changed : ''}`}
                    value={form.planId}
                    onChange={e => {
                      const next = props.planOptions.find(p => p.id === e.target.value);
                      setForm(f => ({ ...f, planId: e.target.value, tournamentLimit: next && next.tournamentLimit < 9999 ? String(next.tournamentLimit) : '', teamLimit: '' }));
                    }}
                  >
                    {props.planOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                ) : <span className={styles.readValue}>{org.planLabel}</span>}
              </label>
              <div className={styles.editPair}>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Tournament limit</span>
                  {can.billing
                    ? <input className={`${kit.field} ${changes.tournamentLimit ? styles.changed : ''}`} inputMode="numeric" placeholder="No limit" value={form.tournamentLimit}
                        onChange={e => setForm(f => ({ ...f, tournamentLimit: e.target.value.replace(/[^0-9]/g, '') }))} />
                    : <span className={styles.readValue}>{limitText(org.tournamentLimit)}</span>}
                </label>
                {targetIsClubBand && (
                  <label className={kit.fieldGroup}>
                    <span className={kit.label}>Team limit</span>
                    {can.billing
                      ? <input className={`${kit.field} ${changes.teamLimit ? styles.changed : ''}`} inputMode="numeric" placeholder={`The plan’s ${plan?.teamLimit ?? ''}`} value={form.teamLimit}
                          onChange={e => setForm(f => ({ ...f, teamLimit: e.target.value.replace(/[^0-9]/g, '') }))} />
                      : <span className={styles.readValue}>{limitText(org.teamLimit)}</span>}
                  </label>
                )}
              </div>
            </div>
            <div className={kit.fieldGroup}>
              <span className={kit.label}>Sections</span>
              <div className={styles.sections}>
                {CLUB_SECTIONS.map(s => {
                  if (org.planSections.includes(s.key)) {
                    return <span key={s.key} className={styles.included}>{s.label}: in the plan</span>;
                  }
                  const on = form.sections.includes(s.key);
                  return can.sections ? (
                    <label key={s.key} className={kit.check}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setForm(f => ({ ...f, sections: on ? f.sections.filter(k => k !== s.key) : [...f.sections, s.key].sort() }))}
                      />
                      {s.label}
                    </label>
                  ) : <span key={s.key} className={styles.included}>{s.label}: {on ? 'on' : 'off'}</span>;
                })}
              </div>
            </div>
            <p className={kit.caption}>
              {anyChange ? `Changes held: ${[
                changes.name && 'name', changes.slug && 'web name', changes.plan && 'plan', changes.tournamentLimit && 'tournament limit',
                changes.teamLimit && 'team limit', ...sectionsOn.map(k => `${sectionLabel(k)} on`), ...sectionsOff.map(k => `${sectionLabel(k)} off`),
              ].filter(Boolean).join(', ')}. Press the check mark to review them.` : 'Nothing changed yet. The check mark leaves without saving.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className={kit.band}>
            {membersCell}
            {org.isClubBand ? <>{teamsCell}{tournamentsCell}</> : <>{tournamentsCell}{overridesCell}</>}
            {renewsCell}
          </div>

          <div className={kit.tabs} role="tablist">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={`${kit.tab}${tab === t.key ? ` ${kit.tabOn}` : ''}`} onClick={() => setTab(t.key)}>
                {t.label}{counts[t.key] ? <span className={kit.tabCount}>{counts[t.key]}</span> : null}
              </button>
            ))}
          </div>

          {tab === 'story' && (
            <div className={kit.card}>
              <div className={kit.toolbar}>
                <span className={kit.count}>{story.total} {story.total === 1 ? 'entry' : 'entries'}, newest first</span>
                <span className={kit.toolbarEnd}>
                  <input type="text" inputMode="search" className={kit.search} placeholder="Search the story" aria-label="Search the story"
                    value={storyWords} onChange={e => setStoryWords(e.target.value)} maxLength={120} />
                  <select className={kit.select} aria-label="Type" value={storyKind} onChange={e => setStoryKind(e.target.value as StoryKind | '')}>
                    <option value="">All types</option>
                    {STORY_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                </span>
              </div>
              <StoryTable
                entries={story.entries}
                canPutBack={kind => (kind === 'section' ? can.sections : can.billing)}
                onPutBack={entry => setWin({ kind: 'putBack', entry })}
                emptyText={storyWords || storyKind ? 'Nothing in the Story matches.' : 'Nothing has happened here yet.'}
              />
              {story.entries.length < story.total && (
                <div className={styles.more}><button type="button" className="btn btn-secondary btn-sm" onClick={() => setStoryShown(n => n + STORY_PAGE)}>Show more</button></div>
              )}
              <div className={styles.tline}>{NOT_IN_STORY}</div>
            </div>
          )}

          {tab === 'money' && (
            <section className={kit.section}>
              <div className={`${kit.card} ${kit.cardPad}`}>
                <div className={styles.facts}>
                  <div className={styles.fact}><span className={kit.bandLabel}>Plan</span><span className={styles.factValue}>{org.planLabel}</span></div>
                  <div className={styles.fact}><span className={kit.bandLabel}>State</span><span className={styles.factValue}>{org.statusLabel}</span></div>
                  <div className={styles.fact}>
                    <span className={kit.bandLabel}>{org.status === 'canceled' ? 'Ended' : 'Renews or ends'}</span>
                    <span className={styles.factValue}>{org.currentPeriodEnd ? consoleDate(org.currentPeriodEnd) : 'Not set'}</span>
                  </div>
                  <div className={styles.fact}>
                    <span className={kit.bandLabel}>Stripe customer</span>
                    {org.stripeCustomerId
                      ? <span className={styles.factLine}><code className={kit.code}>{org.stripeCustomerId}</code>
                          <a className={`${kit.door} ${kit.doorSm}`} href={`${props.stripeBase}/customers/${org.stripeCustomerId}`} target="_blank" rel="noreferrer">Open in Stripe</a></span>
                      : <span className={`${styles.factValue} ${kit.muted}`}>None</span>}
                  </div>
                  <div className={styles.fact}>
                    <span className={kit.bandLabel}>Stripe subscription</span>
                    {org.stripeSubscriptionId
                      ? <span className={styles.factLine}><code className={kit.code}>{org.stripeSubscriptionId}</code>
                          <a className={`${kit.door} ${kit.doorSm}`} href={`${props.stripeBase}/subscriptions/${org.stripeSubscriptionId}`} target="_blank" rel="noreferrer">Open in Stripe</a></span>
                      : <span className={`${styles.factValue} ${kit.muted}`}>None</span>}
                  </div>
                </div>
              </div>
              <p className={kit.caption}>Charges, refunds and invoices are not shown here yet.</p>
            </section>
          )}

          {tab === 'access' && (
            <AccessTab {...props} onAddOverride={() => setWin({ kind: 'override' })} onRelease={() => setWin({ kind: 'release' })}
              onCancel={() => setWin({ kind: 'cancel' })} onDelete={() => setWin({ kind: 'delete' })} />
          )}

          {tab === 'people' && (
            <PeopleTab {...props} onMakeOwner={member => setWin({ kind: 'makeOwner', member })} />
          )}
        </>
      )}

      {/* ── The windows ── */}
      {win?.kind === 'save' && (
        <RecordWindow
          title={`Save changes to ${org.name}`}
          sentence={saveSentence()}
          footNote={`${entryCount} Story ${entryCount === 1 ? 'entry' : 'entries'}${allUndoable ? (entryCount === 1 ? ', which can be put back.' : ', each can be put back.') : '.'}`}
          cancelLabel="Keep editing"
          confirmLabel="Save changes"
          onConfirm={save}
          onClose={() => setWin(null)}
        />
      )}
      {win?.kind === 'putBack' && win.entry.putBack && (
        <RecordWindow
          title={win.entry.putBack.title}
          sentence={win.entry.putBack.sentence}
          whyPlaceholder="Why are you putting this back?"
          footNote="Writes a new entry in the Story."
          confirmLabel="Put it back"
          onConfirm={act(`/api/platform-admin/orgs/${org.id}/put-back`, 'POST', 'It could not be put back.', reason => ({ key: win.entry.key, reason }))}
          onClose={() => setWin(null)}
        />
      )}
      {win?.kind === 'note' && <NoteWindow orgId={org.id} orgName={org.name} onDone={() => { setWin(null); router.refresh(); }} onClose={() => setWin(null)} />}
      {win?.kind === 'makeOwner' && (
        <RecordWindow
          title={`Make ${win.member.email} the owner`}
          sentence={<><strong>{win.member.email}</strong> becomes the owner of {org.name}. Every current owner becomes an admin.</>}
          confirmLabel="Make owner"
          onConfirm={act(`/api/platform-admin/orgs/${org.id}/transfer-ownership`, 'POST', 'The owner could not be changed.', reason => ({ newOwnerUserId: win.member.userId, reason }))}
          onClose={() => setWin(null)}
        />
      )}
      {win?.kind === 'release' && props.ownAddress && (
        <RecordWindow
          title={`Release ${props.ownAddress.address}`}
          sentence={<><strong>{props.ownAddress.address}</strong> stops working for {org.name}, and the name is free for anyone. <strong>This cannot be put back.</strong></>}
          footNote="The club can connect an address again from its own settings."
          cancelLabel="Keep it"
          confirmLabel="Release the address"
          danger
          onConfirm={act(`/api/platform-admin/orgs/${org.id}/own-address`, 'POST', 'The address could not be released.', reason => ({ reason }))}
          onClose={() => setWin(null)}
        />
      )}
      {win?.kind === 'override' && (
        <OverrideWindow orgId={org.id} orgName={org.name} planSections={org.planSections}
          onDone={() => { setWin(null); router.refresh(); }} onClose={() => setWin(null)} />
      )}
      {win?.kind === 'cancel' && (
        <CancelWindow orgId={org.id} orgName={org.name} hasStripe={!!org.stripeSubscriptionId}
          onDone={message => { setWin(null); setNotice(message); router.refresh(); }} onClose={() => setWin(null)} />
      )}
      {win?.kind === 'delete' && (
        <DeleteWindow orgId={org.id} orgName={org.name} orgSlug={org.slug} hasStripeCustomer={!!org.stripeCustomerId}
          onDone={() => router.push('/platform-admin/orgs')} onClose={() => setWin(null)} />
      )}
    </div>
  );
}

// ── Access: plan and limits, sections, overrides, the own web address; the rare doors end it ─────────────────────────
function AccessTab(props: ClubRecordProps & {
  onAddOverride: () => void; onRelease: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const { org, can } = props;
  const [showPast, setShowPast] = useState(false);
  const running = props.overrides.filter(o => o.running);
  const past = props.overrides.filter(o => !o.running);
  const what = (o: ClubRecordProps['overrides'][number]) => overrideWhat(o.type, o.value, o.addons);
  const canCancel = can.billing && org.status !== 'canceled' && (org.planId !== 'tournament' || !!org.stripeSubscriptionId);
  return (
    <div className={kit.page}>
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Plan and limits</h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          <div className={styles.facts}>
            <div className={styles.fact}><span className={kit.bandLabel}>Plan</span><span className={styles.factValue}>{org.planLabel}</span></div>
            <div className={styles.fact}><span className={kit.bandLabel}>Tournament limit</span><span className={styles.factValue}>{limitText(org.tournamentLimit)}</span></div>
            {org.isClubBand && (
              <div className={styles.fact}><span className={kit.bandLabel}>Team limit</span>
                <span className={styles.factValue}>{limitText(org.teamLimit)}{org.storedTeamLimit && org.storedTeamLimit > 0 ? ' (set for this club)' : ''}</span></div>
            )}
          </div>
        </div>
      </section>

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Sections</h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          <div className={styles.facts}>
            {CLUB_SECTIONS.map(s => {
              const inPlan = org.planSections.includes(s.key);
              const on = inPlan || org.enabledAddons.includes(s.key);
              return (
                <div key={s.key} className={styles.fact}>
                  <span className={kit.bandLabel}>{s.label}</span>
                  <span className={styles.factValue}>{inPlan ? 'In the plan' : on ? 'On' : 'Off'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={kit.section}>
        <div className={styles.blockHead}>
          <h2 className={kit.sectionTitle}>Overrides</h2>
          {can.billing && <button type="button" className={kit.door} onClick={props.onAddOverride}>Add an override</button>}
        </div>
        <div className={`${kit.card} ${kit.cardPad}`}>
          {running.length === 0 && <p className={kit.caption}>Nothing is overridden right now.</p>}
          <div className={styles.list}>
            {running.map(o => (
              <div key={o.id} className={styles.listRow}>
                <span className={styles.listMain}>{what(o)}
                  <span className={styles.listSub}>{o.expiresAt ? `Until ${consoleDate(o.expiresAt)}` : 'No end date'} · {o.reason ?? 'No reason kept'} · by {o.createdBy ?? 'staff'}</span>
                </span>
              </div>
            ))}
          </div>
          {past.length > 0 && (
            <>
              <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => setShowPast(v => !v)}>
                {showPast ? 'Hide' : 'Show'} {past.length} past override{past.length === 1 ? '' : 's'}
              </button>
              {showPast && (
                <div className={styles.list}>
                  {past.map(o => (
                    <div key={o.id} className={styles.listRow}>
                      <span className={styles.listMain}>{what(o)}
                        <span className={styles.listSub}>{o.endedAt ? `Ended ${consoleDate(o.endedAt)}` : 'Not started yet'} · applied {consoleDate(o.createdAt)} by {o.createdBy ?? 'staff'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {running.length > 0 && <p className={kit.caption}>An override that is running can be ended early from its entry on the Story.</p>}
        </div>
      </section>

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Own web address</h2>
        <div className={`${kit.card} ${kit.cardPad}`}>
          {props.ownAddress ? (
            <div className={styles.factLine}>
              <code className={kit.code}>{props.ownAddress.address}</code>
              <span className={kit.chip}>{humanize(props.ownAddress.status)}</span>
              {can.support && <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={props.onRelease}>Release this address</button>}
            </div>
          ) : <p className={kit.caption}>This club has not connected its own web address.</p>}
        </div>
      </section>

      {(canCancel || can.delete) && (
        <div className={styles.rareDoors}>
          {canCancel && <button type="button" className={styles.redDoor} onClick={props.onCancel}>Cancel the subscription</button>}
          {can.delete && <button type="button" className={styles.redDoor} onClick={props.onDelete}>Delete the club</button>}
        </div>
      )}
    </div>
  );
}

// ── People & tournaments: members (each opening the person record), tournaments, teams brought in ────────────────────
function PeopleTab(props: ClubRecordProps & { onMakeOwner: (m: ClubRecordProps['members'][number]) => void }) {
  const { can } = props;
  return (
    <div className={kit.page}>
      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Members</h2>
        <div className={kit.card}>
          <div className={kit.tableWrap}>
            <table className={kit.comfortable}>
              <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last signed in</th><th aria-label="Make owner" /></tr></thead>
              <tbody>
                {props.members.length === 0 && <tr><td colSpan={5} className={kit.empty}>Nobody belongs to this club.</td></tr>}
                {props.members.map(m => (
                  <tr key={m.userId}>
                    <td>
                      <Link href={`/platform-admin/customer-users/${m.userId}`} className={kit.nameLink}>{m.name ?? m.email}</Link>
                      {m.name && <span className={kit.sub}>{m.email}</span>}
                    </td>
                    <td>{roleLabel(m.role)}</td>
                    <td>{humanize(m.status)}</td>
                    <td className={kit.nowrap}>{m.lastSignInAt ? consoleDate(m.lastSignInAt) : <span className={kit.muted}>Never</span>}</td>
                    <td className={kit.num}>
                      {can.support && m.role !== 'owner' && m.status === 'active' && (
                        <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => props.onMakeOwner(m)}>Make owner</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Tournaments</h2>
        <div className={kit.card}>
          <div className={kit.tableWrap}>
            <table className={kit.comfortable}>
              <thead><tr><th>Name</th><th>State</th><th>Dates</th></tr></thead>
              <tbody>
                {props.tournaments.length === 0 && <tr><td colSpan={3} className={kit.empty}>No tournaments that are not archived.</td></tr>}
                {props.tournaments.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{humanize(t.status)}</td>
                    <td className={kit.nowrap}>{t.startDate ? `${consoleDate(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ` – ${consoleDate(t.endDate)}` : ''}` : <span className={kit.muted}>No dates</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {props.teamMoves.length > 0 && (
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Teams brought in</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            <div className={styles.list}>
              {props.teamMoves.map(t => (
                <div key={t.id} className={styles.listRow}>
                  <span className={styles.listMain}>{t.teamName}
                    <span className={styles.listSub}>
                      {t.state === 'moved' ? 'Moved into this club, with its staff and every team record.'
                        : t.state === 'waiting_on_coach' ? 'Requested by this club — waiting on the coach.'
                        : 'Requested by the coach — waiting on this club.'} · {consoleDate(t.at)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Add a note ───────────────────────────────────────────────────────────────────────────────────────────────────────
function NoteWindow({ orgId, orgName, onDone, onClose }: { orgId: string; orgName: string; onDone: () => void; onClose: () => void }) {
  const [body, setBody] = useState('');
  return (
    <RecordWindow
      title={`Add a note to ${orgName}`}
      sentence="Staff see it on the Story. The club never does."
      askWhy={false}
      confirmBlocked={!body.trim()}
      footNote="The note is its own why."
      confirmLabel="Add the note"
      onConfirm={async () => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/notes`, 'POST', { body });
        if (!ok) return errorOf(data, 'The note could not be added.');
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Note<span className={kit.req} aria-hidden>*</span></span>
        <textarea className={kit.textarea} value={body} onChange={e => setBody(e.target.value)} maxLength={4000} required aria-required />
      </label>
    </RecordWindow>
  );
}

// ── Add an override ──────────────────────────────────────────────────────────────────────────────────────────────────
function OverrideWindow({ orgId, orgName, planSections, onDone, onClose }: {
  orgId: string; orgName: string; planSections: string[]; onDone: () => void; onClose: () => void;
}) {
  const [type, setType] = useState<'module_addon' | 'subscription_status' | 'comp_period'>('module_addon');
  const [value, setValue] = useState('active');
  const [addons, setAddons] = useState<string[]>([]);
  const [ends, setEnds] = useState('');
  const offered = CLUB_SECTIONS.filter(s => !planSections.includes(s.key));
  const what = type === 'module_addon'
    ? (addons.length ? `${addons.map(sectionLabel).join(', ')} turn${addons.length === 1 ? 's' : ''} on` : 'Pick the sections to turn on')
    : type === 'subscription_status' ? `The subscription reads as ${humanize(value).toLowerCase()}` : 'It is marked as comped (a billing tag; it gives no access)';
  return (
    <RecordWindow
      title={`Add an override to ${orgName}`}
      sentence={<>{what} for {orgName}, {ends ? <>until <strong>{consoleDate(ends)}</strong></> : <strong>with no end date</strong>}.</>}
      confirmBlocked={type === 'module_addon' && addons.length === 0}
      footNote="It shows on the Story, and can be ended early from there."
      confirmLabel="Add the override"
      onConfirm={async reason => {
        const body: Record<string, unknown> = { type, reason };
        if (type === 'subscription_status') body.value = value;
        if (type === 'module_addon') body.target = { addons };
        if (ends) body.expires_at = new Date(`${ends}T23:59:00`).toISOString();
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/overrides`, 'POST', body);
        if (!ok) return errorOf(data, 'The override could not be added.');
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Kind</span>
        <select className={kit.select} value={type} onChange={e => setType(e.target.value as typeof type)}>
          <option value="module_addon">Feature access (timed)</option>
          <option value="subscription_status">Subscription status</option>
          <option value="comp_period">Comp period</option>
        </select>
      </label>
      {type === 'module_addon' && (
        <div className={kit.fieldGroup}>
          <span className={kit.label}>Sections<span className={kit.req} aria-hidden>*</span></span>
          <div className={styles.sections}>
            {offered.length === 0 && <span className={styles.included}>Every section is already in the plan.</span>}
            {offered.map(s => (
              <label key={s.key} className={kit.check}>
                <input type="checkbox" checked={addons.includes(s.key)}
                  onChange={() => setAddons(a => (a.includes(s.key) ? a.filter(k => k !== s.key) : [...a, s.key]))} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {type === 'subscription_status' && (
        <label className={kit.fieldGroup}>
          <span className={kit.label}>Reads as</span>
          <select className={kit.select} value={value} onChange={e => setValue(e.target.value)}>
            {['active', 'trialing', 'past_due', 'canceled'].map(v => <option key={v} value={v}>{humanize(v)}</option>)}
          </select>
        </label>
      )}
      <div className={kit.fieldGroup}>
        <span className={kit.label}>Ends on</span>
        <DateInput className={kit.field} value={ends} onChange={setEnds} aria-label="Ends on" />
        <span className={kit.hint}>Leave it empty for no end date. It ends at the end of that day.</span>
      </div>
    </RecordWindow>
  );
}

// ── Cancel the subscription (red: it reaches Stripe and is never offered as Put it back) ──────────────────────────────
function CancelWindow({ orgId, orgName, hasStripe, onDone, onClose }: {
  orgId: string; orgName: string; hasStripe: boolean; onDone: (message: string | null) => void; onClose: () => void;
}) {
  const [pre, setPre] = useState<{ activeTournamentCount?: number; retentionDays?: number; shutsDown?: string[] } | null>(null);
  const [notify, setNotify] = useState(false);
  useEffect(() => {
    void sendJson(`/api/platform-admin/orgs/${orgId}/cancel-subscription`, 'GET').then(({ ok, data }) => { if (ok) setPre(data); });
  }, [orgId]);
  return (
    <RecordWindow
      title={`Cancel the subscription for ${orgName}`}
      sentence={<>
        {hasStripe ? <>Stripe stops charging {orgName}. </> : <>{possessive(orgName)} subscription ends here. </>}
        <strong>This cannot be put back</strong>: the owner would have to buy again.
        {pre?.activeTournamentCount ? <> Its {pre.activeTournamentCount} tournament{pre.activeTournamentCount === 1 ? ' is' : 's are'} archived and kept for {pre.retentionDays} days.</> : null}
      </>}
      whyPlaceholder="Why are you cancelling?"
      footNote="Reaches Stripe. Never offered as Put it back."
      cancelLabel="Keep it"
      confirmLabel="Cancel the subscription"
      danger
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/cancel-subscription`, 'POST', { reason, notifyOwner: notify });
        if (!ok) return errorOf(data, 'The subscription could not be cancelled.');
        onDone(typeof data.stripeWarning === 'string' ? `Cancelled here. Stripe needs it cancelled by hand: ${data.stripeWarning}` : null);
        return null;
      }}
      onClose={onClose}
    >
      {pre?.shutsDown && pre.shutsDown.length > 0 && (
        <div className={kit.fieldGroup}>
          <span className={kit.label}>What stops</span>
          <ul className={kit.caption}>{pre.shutsDown.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      <label className={kit.check}>
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
        Email the owner that it is cancelled (this reaches an inbox and cannot be taken back)
      </label>
    </RecordWindow>
  );
}

// ── Delete the club (super admin; red; the web name typed to confirm) ────────────────────────────────────────────────
function DeleteWindow({ orgId, orgName, orgSlug, hasStripeCustomer, onDone, onClose }: {
  orgId: string; orgName: string; orgSlug: string; hasStripeCustomer: boolean; onDone: () => void; onClose: () => void;
}) {
  const [pre, setPre] = useState<{ hasActiveSubscription?: boolean; memberCount?: number; tournamentCount?: number; coachesLinkCount?: number; retentionRecordCount?: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [notify, setNotify] = useState(false);
  const [dropStripe, setDropStripe] = useState(false);
  useEffect(() => {
    void sendJson(`/api/platform-admin/orgs/${orgId}/delete`, 'GET').then(({ ok, data }) => { if (ok) setPre(data); });
  }, [orgId]);
  const blocked = !!pre?.hasActiveSubscription;
  return (
    <RecordWindow
      title={`Delete ${orgName}`}
      sentence={blocked
        ? <>{orgName} still has a running subscription. <strong>Cancel the subscription first</strong>, then delete the club.</>
        : <>{orgName} and everything in it — {pre?.memberCount ?? 0} member{pre?.memberCount === 1 ? '' : 's'}, {pre?.tournamentCount ?? 0} tournament{pre?.tournamentCount === 1 ? '' : 's'}
          {pre?.coachesLinkCount ? `, ${pre.coachesLinkCount} coaches portal link${pre.coachesLinkCount === 1 ? '' : 's'}` : ''} — are removed. <strong>This cannot be taken back.</strong></>}
      footNote="Invoice history stays in Stripe."
      cancelLabel="Keep it"
      confirmLabel="Delete the club"
      danger
      confirmBlocked={blocked || typed.trim().toLowerCase() !== orgSlug}
      onConfirm={async reason => {
        const { ok, data } = await sendJson(`/api/platform-admin/orgs/${orgId}/delete`, 'DELETE', { reason, confirmSlug: typed.trim().toLowerCase(), notifyOwner: notify, deleteStripeCustomer: dropStripe });
        if (!ok) return errorOf(data, 'The club could not be deleted.');
        onDone();
        return null;
      }}
      onClose={onClose}
    >
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Type <code className={kit.code}>{orgSlug}</code> to confirm<span className={kit.req} aria-hidden>*</span></span>
        <input className={`${kit.field} ${kit.code}`} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" disabled={blocked} />
      </label>
      <label className={kit.check}>
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} disabled={blocked} />
        Email the owner that the account is closed (this reaches an inbox and cannot be taken back)
      </label>
      {hasStripeCustomer && (
        <label className={kit.check}>
          <input type="checkbox" checked={dropStripe} onChange={e => setDropStripe(e.target.checked)} disabled={blocked} />
          Also delete the Stripe customer (only when the customer asked to be forgotten)
        </label>
      )}
    </RecordWindow>
  );
}
