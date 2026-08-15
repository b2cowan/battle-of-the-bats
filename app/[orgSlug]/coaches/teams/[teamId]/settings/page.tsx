'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, Settings } from 'lucide-react';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import DuesReminderPreviewModal from '@/components/coaches/DuesReminderPreviewModal';
import DuesMoneySettingRows from '@/components/coaches/DuesMoneySettingRows';
import { canViewMoney, canWriteMoney, canConfigureTeam, type CoachCapabilities } from '@/lib/coach-capabilities';
import { patchAccountingSetting, fetchAccountingSettings } from '@/lib/coach-accounting-settings';
import {
  CREDIT_MODE_SENTENCES, normalizeCreditApplicationMode, type CreditApplicationMode,
} from '@/lib/dues-credits';
import type { LineupSettings } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

interface SettingsData {
  team: { id: string; name: string; division: string | null; sport: string };
  season: { id: string; name: string; year: number; status: string; lineupSettings: LineupSettings | null };
  nextYearDefault: number;
  scope: {
    isStandalone: boolean;
    isHeadCoach: boolean;
    canManageSeasons: boolean;
    canEditDivision: boolean;
  };
  /** Club Shared Book. `showSwitch` false ⇒ the whole section is absent — either the club is
   *  not on the Club plan, or its admin has not turned sharing on. Never a locked tease. */
  clubBook: { showSwitch: boolean; sharing: boolean; canEdit: boolean };
  /** Null when this coach has no money access — the server omits the figures entirely. */
  money: { autoRemindersEnabled: boolean; creditApplication: string; defaultPlayerCreditPercent?: number } | null;
  capabilities?: CoachCapabilities;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};

export default function TeamSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [division, setDivision] = useState('');
  const [savingDivision, setSavingDivision] = useState(false);
  const [divisionMsg, setDivisionMsg] = useState('');
  const [divisionError, setDivisionError] = useState('');

  // P3 lineup-rules caps (strings for the number inputs; '' = that rule is off).
  const [caps, setCaps] = useState({ maxPos: '', pitcher: '', minPlay: '' });
  const [savingCaps, setSavingCaps] = useState(false);
  const [capsMsg, setCapsMsg] = useState('');
  const [capsError, setCapsError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);

  // Club Shared Book — the head coach's switch.
  const [savingShare, setSavingShare] = useState(false);
  const [shareError, setShareError] = useState('');

  /**
   * Money group. These two settings used to live at the bottom of the dues page, where a
   * coach met them every time they came to chase a payment — a set-once decision charging
   * rent on a daily screen. The dues page keeps a read-only line stating what they are;
   * this is where they change (owner call 2026-08-14).
   *
   * The VALUES arrive with the team payload (the route already holds them; a second request
   * would re-resolve the same auth, team and season to read two fields). The WRITE goes to the
   * money route through the shared helper, so this screen and the dues page cannot drift on
   * what a save does.
   */
  const [autoReminders, setAutoReminders] = useState<boolean | null>(null);
  const [autoRemindersSaving, setAutoRemindersSaving] = useState(false);
  const [creditMode, setCreditMode] = useState<CreditApplicationMode | null>(null);
  const [creditModeSaving, setCreditModeSaving] = useState(false);
  const [moneyError, setMoneyError] = useState('');
  const [reminderPreviewOpen, setReminderPreviewOpen] = useState(false);
  /** The team's standard split. A DRAFT + a saved value, because this is a typed field rather
   *  than a switch: it saves when the coach leaves it, and a rejected save must put the real
   *  number back rather than leave a typo on screen looking authoritative. */
  const [defaultCredit, setDefaultCredit] = useState(0);
  const [defaultCreditDraft, setDefaultCreditDraft] = useState('0');
  const [defaultCreditSaving, setDefaultCreditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`);
      if (!res.ok) throw new Error('Settings could not be loaded');
      const json: SettingsData = await res.json();
      setData(json);
      setDivision(json.team.division ?? '');
      const ls = json.season.lineupSettings;
      setCaps({
        maxPos: ls?.maxInningsPerPosition != null ? String(ls.maxInningsPerPosition) : '',
        pitcher: ls?.pitcherMaxInningsDefault != null ? String(ls.pitcherMaxInningsDefault) : '',
        minPlay: ls?.minInningsPerPlayer != null ? String(ls.minInningsPerPlayer) : '',
      });

      // Absent for a coach without money access — the group simply doesn't render.
      if (json.money) {
        setAutoReminders(json.money.autoRemindersEnabled ?? true);
        // Normalize at the fetch boundary (mirror of the server's mapper) so everything below
        // trusts the state as a real mode.
        setCreditMode(normalizeCreditApplicationMode(json.money.creditApplication));
        const pct = Number(json.money.defaultPlayerCreditPercent ?? 0);
        setDefaultCredit(pct);
        setDefaultCreditDraft(String(pct));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Settings could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function saveDivision(e: React.FormEvent) {
    e.preventDefault();
    setSavingDivision(true);
    setDivisionMsg('');
    setDivisionError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division: division.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDivisionError(json.error ?? 'Could not save the division.');
        return;
      }
      setDivision(json.division ?? '');
      setData(prev => prev ? { ...prev, team: { ...prev.team, division: json.division ?? null } } : prev);
      setDivisionMsg('Saved');
    } catch {
      setDivisionError('Could not save the division.');
    } finally {
      setSavingDivision(false);
    }
  }

  async function saveCaps(e: React.FormEvent) {
    e.preventDefault();
    setSavingCaps(true);
    setCapsMsg('');
    setCapsError('');
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupSettings: {
            maxInningsPerPosition: num(caps.maxPos),
            pitcherMaxInningsDefault: num(caps.pitcher),
            minInningsPerPlayer: num(caps.minPlay),
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setCapsError(json.error ?? 'Could not save.'); return; }
      const ls: LineupSettings | null = json.lineupSettings ?? null;
      setCaps({
        maxPos: ls?.maxInningsPerPosition != null ? String(ls.maxInningsPerPosition) : '',
        pitcher: ls?.pitcherMaxInningsDefault != null ? String(ls.pitcherMaxInningsDefault) : '',
        minPlay: ls?.minInningsPerPlayer != null ? String(ls.minInningsPerPlayer) : '',
      });
      setData(prev => prev ? { ...prev, season: { ...prev.season, lineupSettings: ls } } : prev);
      setCapsMsg('Saved');
    } catch {
      setCapsError('Could not save.');
    } finally {
      setSavingCaps(false);
    }
  }

  async function toggleClubBookSharing(next: boolean) {
    setSavingShare(true);
    setShareError('');
    // Optimistic: the switch is the answer to a question the coach just asked. A failure
    // reverts it and says so — sharing state must never LOOK on while it is off.
    setData(prev => prev ? { ...prev, clubBook: { ...prev.clubBook, sharing: next } } : prev);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareClubBook: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not change sharing.');
      setData(prev => prev ? { ...prev, clubBook: { ...prev.clubBook, sharing: json.shareClubBook === true } } : prev);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Could not change sharing.');
      // ⚠ Re-read the SERVER's answer rather than assuming the pre-toggle value. A request that
      // committed but whose response was lost would otherwise leave this switch reading "Not
      // sharing" while the club could in fact read this team's notes — of the two ways to be
      // wrong, that is the one that matters, so the recovery asks rather than guesses.
      await load();
    } finally {
      setSavingShare(false);
    }
  }

  /**
   * Both money settings save on change — a choice has nothing left to type.
   *
   * Optimistic: the description under each row restates the choice, so a control that visibly
   * snapped back until the request landed would read as the product rejecting the coach's answer.
   *
   * ⚠ On failure it RE-READS THE SERVER rather than reverting to a captured value. Chaining a
   * local `previous` is unsound the moment two saves overlap and both fail — the second revert
   * restores the first save's optimistic value, and the switch ends up disagreeing with the
   * database (the full trace is on `fetchAccountingSettings`). Of the two ways to be wrong,
   * "reminders look off while the schedule still emails families" is the one that matters.
   */
  async function resyncMoneySettings() {
    const fresh = await fetchAccountingSettings(orgSlug, teamId);
    if (!fresh) return; // offline — keep the screen as-is and let the error stand
    setAutoReminders(fresh.autoRemindersEnabled);
    setCreditMode(fresh.creditApplication);
    // The typed field resyncs too: a failure in one of the switches must not leave a stale
    // number beside them, and the draft follows so the input shows what the server actually has.
    setDefaultCredit(fresh.defaultPlayerCreditPercent);
    setDefaultCreditDraft(String(fresh.defaultPlayerCreditPercent));
  }

  async function toggleAutoReminders(enabled: boolean) {
    setAutoReminders(enabled);
    setAutoRemindersSaving(true);
    setMoneyError('');
    try {
      await patchAccountingSetting(orgSlug, teamId, { autoRemindersEnabled: enabled });
    } catch (e) {
      setMoneyError(e instanceof Error ? e.message : 'Could not save that setting.');
      await resyncMoneySettings();
    } finally {
      setAutoRemindersSaving(false);
    }
  }

  async function saveCreditMode(mode: CreditApplicationMode) {
    setCreditMode(mode);
    setCreditModeSaving(true);
    setMoneyError('');
    try {
      await patchAccountingSetting(orgSlug, teamId, { creditApplication: mode });
    } catch (e) {
      setMoneyError(e instanceof Error ? e.message : 'Could not save that setting.');
      await resyncMoneySettings();
    } finally {
      setCreditModeSaving(false);
    }
  }

  /**
   * Save the team's standard split when the coach leaves the field.
   *
   * ⚠ A REJECTED SAVE PUTS THE REAL NUMBER BACK. Unlike the two switches beside it this is free
   * text, so a refused value would otherwise sit on screen looking like the setting — and the
   * next form would pre-fill from something the server never accepted. Nothing is sent when the
   * value has not actually changed, so tabbing through the field is silent.
   */
  async function saveDefaultCredit() {
    const pct = Number(defaultCreditDraft);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setMoneyError('Default player credit must be between 0 and 100.');
      setDefaultCreditDraft(String(defaultCredit));
      return;
    }
    if (pct === defaultCredit) { setMoneyError(''); return; }
    setDefaultCreditSaving(true);
    setMoneyError('');
    try {
      await patchAccountingSetting(orgSlug, teamId, { defaultPlayerCreditPercent: pct });
      setDefaultCredit(pct);
      setDefaultCreditDraft(String(pct));
    } catch (e) {
      setMoneyError(e instanceof Error ? e.message : 'Could not save that setting.');
      setDefaultCreditDraft(String(defaultCredit));
    } finally {
      setDefaultCreditSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading...</p>;
  if (loadError || !data) {
    return (
      <div className={styles.notAssigned}>
        <h2>Settings unavailable</h2>
        <p>{loadError || 'This team could not be loaded.'}</p>
      </div>
    );
  }

  const { team, season, nextYearDefault, scope } = data;
  const capabilities = data.capabilities;

  /**
   * ⚠ Two DIFFERENT doors open this page, and they must not be conflated.
   *
   * The five original groups belong to whoever could already reach Settings (head coach, or an
   * assistant who manages the schedule). The Money group belongs to money access — which is a
   * separate grant, and the reason the nav now lets a money coach in at all. Rendering the
   * originals for a money-only coach would hand a team treasurer the lineup rules and the
   * organization link, which is a widening nobody asked for.
   */
  // Fail-open while capabilities are still absent — every route enforces server-side regardless.
  const showTeamGroups = !capabilities || canConfigureTeam(capabilities);
  const hasMoneyAccess = !capabilities || canViewMoney(capabilities);
  const moneyCanWrite = !capabilities || canWriteMoney(capabilities);
  // Kept as two inline checks at the render site rather than folded in here, so the compiler
  // narrows the two nullable settings for the rows below instead of taking them on trust.
  const showMoney = hasMoneyAccess && autoReminders !== null && creditMode !== null;

  // ── Collapsed-header value summaries ───────────────────────────────────────────
  // Each group states what it is currently SET TO, so the CLOSED page answers more than the old
  // open one did. Keep them terse — the meta slot sits beside the group name.
  //
  // ⚠ EVERY ONE OF THESE READS THE SAVED VALUE, never a form draft. The lineup caps were built
  // from `caps` — the same state the number inputs are bound to — so typing "5" into a rule and
  // walking away without saving left the header announcing "5 at a position" for a rule that was
  // never persisted. A summary whose whole job is to say what is set must not report what was
  // merely typed. (Division already did this correctly, reading `team.division` rather than the
  // `division` input; the Depth Chart's caps bar reads the saved settings for the same reason.)
  const savedCaps = season.lineupSettings;
  const capBits = [
    savedCaps?.maxInningsPerPosition != null ? `${savedCaps.maxInningsPerPosition} at a position` : null,
    savedCaps?.pitcherMaxInningsDefault != null ? `${savedCaps.pitcherMaxInningsDefault} pitching` : null,
    savedCaps?.minInningsPerPlayer != null ? `${savedCaps.minInningsPerPlayer} minimum` : null,
  ].filter(Boolean);
  const lineupSummary = capBits.length ? capBits.join(' · ') : 'No rules set';
  // The closed header states the group's condition (the 2026-08-14 ruling). The third clause is
  // conditional: a team that has never set a standard split has nothing to say about one, and
  // "0% to players" on every team that ignores the field would be noise pretending to be a fact.
  const moneySummary = autoReminders !== null && creditMode !== null
    ? [
        autoReminders ? 'Reminders on' : 'Reminders off',
        CREDIT_MODE_SENTENCES[creditMode].toLowerCase(),
        ...(defaultCredit > 0 ? [`${defaultCredit}% to players by default`] : []),
      ].join(' · ')
    : '';

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: the team-name line retires into the masthead that already
          carries it; the page gains the section icon its siblings all have.
          Chunk B (P1 #17): the one door of the five that had NO guide to open. Rather than point
          a "?" at the help hub — a table of contents where the coach expected an answer about
          this screen — the guide was written in the same unit of work. */}
      <CoachPageHeader
        icon={Settings}
        title="Team settings"
        helpLabel="Team settings"
        help={{ module: 'coaches', sectionIds: ['premium-team-settings'], fullGuideHref: `/${orgSlug}/coaches/help#premium-team-settings` }}
      />

      <div className={styles.settingsStack}>

        {/* ── Team ─────────────────────────────────────────────────────────── */}
        {showTeamGroups && (
          <CoachCollapseSection
            sectionId="team"
            title="Team"
            defaultOpen={false}
            meta={team.division || 'No division set'}
          >
            <p className={styles.settingWho}>
              {scope.canEditDivision
                ? 'Head coach only.'
                : scope.isStandalone
                  ? 'Only the head coach can change the division.'
                  : 'Division is managed by your club admin.'}
            </p>
            <form onSubmit={saveDivision} className={styles.settingRows}>
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowLabel}>Division</span>
                  <span className={styles.settingRowDesc}>
                    A short label for your competitive level, e.g. &ldquo;U13 Tier 1&rdquo;.
                  </span>
                </div>
                <div className={styles.settingRowCtl}>
                  {scope.canEditDivision ? (
                    <>
                      <input
                        className={styles.input}
                        aria-label="Division"
                        value={division}
                        maxLength={30}
                        placeholder="e.g. U13 Tier 1"
                        style={{ width: 'auto', minWidth: 180, minHeight: 44 }}
                        onChange={e => { setDivision(e.target.value); setDivisionMsg(''); }}
                      />
                      <button type="submit" className={styles.btnPrimary} disabled={savingDivision} style={{ whiteSpace: 'nowrap' }}>
                        {savingDivision ? 'Saving...' : 'Save'}
                      </button>
                      {divisionMsg && <span className={styles.settingRowSaved}>{divisionMsg}</span>}
                    </>
                  ) : (
                    <span className={styles.settingRowDesc}>
                      {team.division || 'No division set'}
                    </span>
                  )}
                </div>
              </div>
              {divisionError && (
                <div className={styles.settingRow}>
                  <p className={styles.errorText} style={{ margin: 0 }}>{divisionError}</p>
                </div>
              )}
            </form>
          </CoachCollapseSection>
        )}

        {/* ── Season ───────────────────────────────────────────────────────── */}
        {showTeamGroups && (
          <CoachCollapseSection
            sectionId="season"
            title="Season"
            defaultOpen={false}
            meta={`${season.name} · ${STATUS_LABEL[season.status] ?? season.status}`}
          >
            <p className={styles.settingWho}>
              {scope.canManageSeasons
                ? 'Head coach only. Starting a season cannot be undone.'
                : scope.isStandalone
                  ? 'Only the head coach can start a new season.'
                  : 'Your club admin manages seasons for this team.'}
            </p>
            <div className={styles.settingRows}>
              {scope.canManageSeasons && (
                <div className={styles.settingRow}>
                  <div className={styles.settingRowMain}>
                    <span className={styles.settingRowLabel}>Start next season</span>
                    <span className={styles.settingRowDesc}>
                      Your active roster carries forward; the schedule starts fresh; and {season.name} moves
                      to its read-only Season&apos;s End page — the season wrap-up, plus every result and
                      money record in the Insights archive.
                    </span>
                  </div>
                  <div className={styles.settingRowCtl}>
                    <button type="button" className={styles.btnPrimary} onClick={() => setModalOpen(true)}>
                      Start next season
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowLabel}>Past seasons</span>
                  <span className={styles.settingRowDesc}>
                    Every result and money record from the seasons this team has finished.
                  </span>
                </div>
                <div className={styles.settingRowCtl}>
                  {/* 44px floor — this and "Save rules" below were both already under it and
                      baselined as accepted debt. The page was rebuilt around them in this change
                      and the floor is being enforced on its new controls, so they are fixed here
                      rather than carried forward into two more baseline entries. */}
                  <Link
                    href={`${base}/history`}
                    className={styles.btnSecondary}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44 }}
                  >
                    <Archive size={15} /> Season Review
                  </Link>
                </div>
              </div>
            </div>
          </CoachCollapseSection>
        )}

        {/* ── Game day ─────────────────────────────────────────────────────── */}
        {showTeamGroups && (
          <CoachCollapseSection
            sectionId="lineup-rules"
            title="Game day"
            defaultOpen={false}
            meta={lineupSummary}
          >
            <p className={styles.settingWho}>
              Season defaults the game-day Auto-fill follows. Leave a field blank to turn that rule
              off — you can override any of these for a single game in the Auto-fill menu.
            </p>
            <form onSubmit={saveCaps} className={styles.settingRows}>
              {[
                { key: 'maxPos' as const, label: 'Max innings at one position',
                  hint: 'Forces rotation so more players get a turn at each spot.' },
                { key: 'pitcher' as const, label: 'Pitching innings cap',
                  hint: 'Default arm-care limit per pitcher. A player’s own pitcher cap still applies (stricter wins).' },
                { key: 'minPlay' as const, label: 'Minimum innings per player',
                  hint: 'Everyone gets at least this many innings on the field.' },
              ].map(f => (
                <div key={f.key} className={styles.settingRow}>
                  <div className={styles.settingRowMain}>
                    <label className={styles.settingRowLabel} htmlFor={`cap-${f.key}`}>{f.label}</label>
                    <span className={styles.settingRowDesc}>{f.hint}</span>
                  </div>
                  <div className={styles.settingRowCtl}>
                    <input
                      id={`cap-${f.key}`}
                      className={styles.input}
                      type="number"
                      min={1}
                      max={12}
                      placeholder="Off"
                      style={{ width: 100, minHeight: 44 }}
                      value={caps[f.key]}
                      onChange={e => { setCaps(c => ({ ...c, [f.key]: e.target.value })); setCapsMsg(''); }}
                    />
                  </div>
                </div>
              ))}
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowDesc}>Changes apply to every game from now on.</span>
                </div>
                <div className={styles.settingRowCtl}>
                  {capsMsg && <span className={styles.settingRowSaved}>{capsMsg}</span>}
                  {capsError && <span className={styles.errorText}>{capsError}</span>}
                  <button type="submit" className={styles.btnPrimary} disabled={savingCaps} style={{ whiteSpace: 'nowrap', minHeight: 44 }}>
                    {savingCaps ? 'Saving...' : 'Save rules'}
                  </button>
                </div>
              </div>
            </form>
          </CoachCollapseSection>
        )}

        {/* ── Money (the two dues settings, moved off the dues page) ────────── */}
        {showMoney && (
          <CoachCollapseSection
            sectionId="money"
            title="Money"
            defaultOpen={false}
            meta={moneySummary}
          >
            <p className={styles.settingWho}>
              How dues behave for this season. {moneyCanWrite
                ? 'Set once — the dues page states what you chose.'
                : 'You have view-only access to team finances.'}
            </p>
            <div className={styles.settingRows}>
              <DuesMoneySettingRows
                autoReminders={autoReminders}
                creditMode={creditMode}
                canWrite={moneyCanWrite}
                remindersSaving={autoRemindersSaving}
                creditModeSaving={creditModeSaving}
                onToggleReminders={enabled => void toggleAutoReminders(enabled)}
                onChangeCreditMode={mode => void saveCreditMode(mode)}
                onPreviewReminder={() => setReminderPreviewOpen(true)}
                creditNote="Changing this re-figures what every family owes next."
              />

              {/* ⚠ HERE AND NOT IN THE SHARED ROWS. The two rows above are DUES settings and also
                  render inline on Player Dues before any dues exist; this one is about
                  fundraising, and would be a non-sequitur on that screen. It lives in the Money
                  group because that is where a treasurer sets the team's money habits once.

                  ⚠ AND IT ONLY PRE-FILLS. It seeds the new-fundraiser and new-sponsor forms and
                  reaches nothing that already exists — the same rule each logged entry follows by
                  snapshotting its own rate. A setting that quietly revalued past credits would
                  change what families were told they owed. */}
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowLabel}>Default player credit</span>
                  <span className={styles.settingRowDesc}>
                    {defaultCredit > 0
                      ? `Players keep ${defaultCredit}% of what they raise or bring in. Fills in on every new fundraiser and sponsor — you can change it on any one of them.`
                      : 'Nothing is credited back by default — set a share here and it fills in on every new fundraiser and sponsor.'}
                  </span>
                </div>
                <div className={styles.settingRowCtl}>
                  {moneyCanWrite ? (
                    <span className={styles.unitField} style={{ maxWidth: 140 }}>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        aria-label="Default player credit percent"
                        value={defaultCreditDraft}
                        disabled={defaultCreditSaving}
                        style={{ minHeight: 44, textAlign: 'right' }}
                        onChange={e => setDefaultCreditDraft(e.target.value)}
                        onBlur={() => void saveDefaultCredit()}
                      />
                      <span className={styles.unitPick}>
                        <span className={`${styles.unitBtn} ${styles.unitBtnOn}`} aria-hidden>%</span>
                      </span>
                    </span>
                  ) : (
                    <span className={styles.settingRowDesc}>{defaultCredit}%</span>
                  )}
                </div>
              </div>

              {moneyError && (
                <div className={styles.settingRow}>
                  <p className={styles.errorText} style={{ margin: 0 }}>{moneyError}</p>
                </div>
              )}
            </div>
          </CoachCollapseSection>
        )}

        {/* ── Sharing (Club Shared Book) ───────────────────────────────────── */}
        {showTeamGroups && data.clubBook.showSwitch && (
          <CoachCollapseSection
            sectionId="club-book"
            title="Sharing"
            defaultOpen={false}
            meta={data.clubBook.sharing ? 'Book shared with the club' : 'Book not shared'}
          >
            <p className={styles.settingWho}>
              Each head coach decides for their own team — nothing is shared by surprise. Other teams
              can read your book; they can never edit or remove anything in it, and you can never
              change theirs. Sharing stops at your club&apos;s walls.
            </p>
            <div className={styles.settingRows}>
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowLabel}>Share our book with the club</span>
                  <span className={styles.settingRowDesc}>
                    Your book line and observations become readable by your club&apos;s other sharing
                    teams, labelled with your team and each writer&apos;s name. You&apos;ll see their
                    shared books while you share yours. Stop sharing any time — your book disappears
                    from their pages immediately.
                  </span>
                </div>
                <div className={styles.settingRowCtl}>
                  {data.clubBook.canEdit ? (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minHeight: 44 }}>
                      <input
                        type="checkbox"
                        checked={data.clubBook.sharing}
                        disabled={savingShare}
                        onChange={e => toggleClubBookSharing(e.target.checked)}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {data.clubBook.sharing ? 'Sharing' : 'Not sharing'}
                      </span>
                    </label>
                  ) : (
                    <span className={styles.settingRowDesc}>
                      {data.clubBook.sharing ? 'Sharing with the club' : 'Not sharing'} — only coaches
                      with notes access can change it.
                    </span>
                  )}
                </div>
              </div>
              {shareError && (
                <div className={styles.settingRow}>
                  <p className={styles.errorText} style={{ margin: 0 }}>{shareError}</p>
                </div>
              )}
            </div>
          </CoachCollapseSection>
        )}

        {/* ── Organization ─────────────────────────────────────────────────── */}
        {showTeamGroups && scope.isStandalone && (
          <CoachCollapseSection
            sectionId="organization"
            title="Organization"
            defaultOpen={false}
            meta="Not connected to a club"
          >
            <p className={styles.settingWho}>
              Most teams are invited by their organization — if that happens, you&apos;ll see it on
              your Overview and here.
            </p>
            <div className={styles.settingRows}>
              <div className={styles.settingRow}>
                <div className={styles.settingRowMain}>
                  <span className={styles.settingRowLabel}>Connect to a club or league</span>
                  <span className={styles.settingRowDesc}>
                    Belong to a club or league? Connect your team for recognition, or transfer it in
                    entirely.
                  </span>
                </div>
                <div className={styles.settingRowCtl}>
                  <Link href={`/${orgSlug}/coaches/link-org`} className={styles.btnSecondary}>
                    Manage organization link
                  </Link>
                </div>
              </div>
            </div>
          </CoachCollapseSection>
        )}

        {/* A coach who can reach Settings always has at least one group — but a grant change
            mid-session could empty it, and an empty page must still say why. */}
        {!showTeamGroups && !showMoney && (
          <p className={styles.muted}>There are no settings you can change for this team.</p>
        )}
      </div>

      {reminderPreviewOpen && (
        <DuesReminderPreviewModal teamName={team.name} onClose={() => setReminderPreviewOpen(false)} />
      )}

      {modalOpen && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={season.name}
          defaultNextYear={nextYearDefault}
          onClose={() => setModalOpen(false)}
          onDone={() => { window.location.assign(base); }}
        />
      )}
    </div>
  );
}
