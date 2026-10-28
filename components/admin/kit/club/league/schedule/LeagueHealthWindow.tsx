'use client';
/**
 * A HOUSE-LEAGUE SEASON'S SCHEDULE HEALTH WINDOW (Stage 9d-2a step 6, frames d2–d4; ruling 9d2·4: the tournament's button
 * and window, a league's rules). The shape is the tournament's, part for part — its frame (`HealthWindowFrame`), its tiles
 * (`Metric`), its issue rows (`IssueRow`), its team detail, its foot and its rules editor (`HealthRulesDoor`,
 * `HealthRulesEditor`) — so the two cannot drift; what it says is lib/league-schedule-health.ts's.
 *
 * Every door does something in the schedule: "Show them" / "Show it" close the window on the booking's day (the page's
 * `onShow`), "Give it a new date" opens the postponed game (`onOpenGame`), and a team's count opens Team detail here.
 *
 * ⚖ ADJUST THE RULES (9d-2b Part 6, frame d3; mig 412). The foot says the season's rules; whoever runs the season has the
 * door, and the editor opens under it. The window re-scores on the draft as it changes (`rescore`), so the score, tiles
 * and issues above follow before anything is saved; unsaved rules ask before the window closes, and the doors that leave
 * the window wait until they are saved or discarded (the tournament's rule). Games per team is per DIVISION (an empty
 * field = the number most of its teams were given); the other two are the season's.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { HealthWindowFrame } from '@/app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthWindow';
import {
  HealthRulesDoor, HealthRulesEditor, IssueRow, Metric,
} from '@/app/[orgSlug]/admin/tournaments/schedule/components/ScheduleHealthPanel';
import ts from '@/app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css';
import { Callout } from '@/components/admin/kit/club/RepKit';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { SCHEDULE_DAY_WORDS } from '@/lib/schedule-words';
import {
  DEFAULT_LEAGUE_HEALTH_RULES, GAMES_PER_TEAM_MAX, HOME_AWAY_TOLERANCES, LEAGUE_HEALTH_WORDS as H, leagueIssueWords,
  primeTimeCell, sameLeagueHealthRules, type LeagueHealthIssue, type LeagueHealthRules, type LeagueScheduleHealth,
} from '@/lib/league-schedule-health';
import s from './SeasonSchedule.module.css';

/** The phone's window shows two issues, then "{n} more. Show all" (d4). */
const PHONE_ISSUES = 2;

export default function LeagueHealthWindow({
  health, rescore, divisionIds, eyebrow, team, label, place, divisionName, phone, canRun, onSaveRules, onShow, onOpenGame, onClose,
}: {
  /** The season's health by its saved rules (the header button's score). */
  health: LeagueScheduleHealth;
  /** The same season scored by other rules: the editor's draft, live. */
  rescore: (rules: LeagueHealthRules) => LeagueScheduleHealth;
  /** The season's divisions, in order: one games-per-team field each. */
  divisionIds: readonly string[];
  /** The season's name, over the title. */
  eyebrow: string;
  team: (id: string) => string;
  /** A booking by the page's key ("league_game:{id}"), said: "Tigers vs Braves", "Tigers practice". */
  label: (key: string) => string;
  place: (venueId: string, facilityId: string | null) => string;
  divisionName: (id: string) => string;
  phone: boolean;
  /** Whoever runs the season: a postponed game's door is "Give it a new date"; a reader's is "Show it". */
  canRun: boolean;
  /** Saves the rules (whoever runs the season); resolves null when saved, else the words to say. Absent = no door. */
  onSaveRules?: (rules: LeagueHealthRules) => Promise<string | null>;
  /** Close on the issue's bookings in the schedule. */
  onShow: (issue: LeagueHealthIssue) => void;
  /** Open the postponed (or undated) game's window. */
  onOpenGame: (gameId: string) => void;
  onClose: () => void;
}) {
  const saved = health.rules;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LeagueHealthRules>(saved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The saved rules moved (a save landed and the page read them again): the editor starts from them.
  const [seen, setSeen] = useState(saved);
  if (seen !== saved) { setSeen(saved); setDraft(saved); }
  const dirty = editing && !sameLeagueHealthRules(draft, saved);
  const shown = useMemo(() => (dirty ? rescore(draft) : health), [dirty, draft, health, rescore]);

  const scored = shown.timedGames > 0;
  const caption = scored
    ? [GAME_DAY_WORDS.healthCaption(shown.tone, shown.issues.length), SCHEDULE_DAY_WORDS.healthScope(shown.divisions)].filter(Boolean).join(' · ')
    : H.nothingToScore;
  const [allIssues, setAllIssues] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const teamsRef = useRef<HTMLDetailsElement>(null);
  // Opened from an issue's door, Team detail sits under the issues: bring it into view.
  const [scrollTeams, setScrollTeams] = useState(0);
  useEffect(() => { if (scrollTeams) teamsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [scrollTeams]);

  const said = shown.issues.map(issue => ({ issue, ...leagueIssueWords(issue, { team, label, place, division: divisionName }) }));
  const shownIssues = phone && !allIssues ? said.slice(0, PHONE_ISSUES) : said;
  const doorOf = (x: (typeof said)[number]) => {
    // A door that leaves the window waits while the rules are unsaved: leaving would drop them unasked.
    if (dirty && x.door !== 'teams') return null;
    switch (x.door) {
      case 'date': {
        const id = x.issue.kind === 'postponed' ? x.issue.gameId : null;
        return id ? { label: canRun ? H.giveDate : H.showIt, onClick: () => onOpenGame(id) } : null;
      }
      case 'teams': return { label: H.show, onClick: () => { setTeamsOpen(true); setScrollTeams(n => n + 1); } };
      case 'show': return { label: H.show, onClick: () => onShow(x.issue) };
      case 'showIt': return { label: H.showIt, onClick: () => onShow(x.issue) };
      case 'none': return null;
    }
  };

  const save = async () => {
    if (!onSaveRules) return;
    setSaving(true);
    setSaveError(null);
    const refusal = await onSaveRules(draft).catch(() => H.rulesFailed);
    setSaving(false);
    if (refusal) { setSaveError(refusal); return; }
    setEditing(false);
  };
  const toggle = () => { setEditing(e => !e); setDraft(saved); setSaveError(null); };

  const t = shown.tiles;
  const plans = health.plans;
  const samePlan = plans.every(p => p.games === plans[0]?.games);
  const scheduleOf = new Map(shown.plans.map(p => [p.divisionId, p.schedule]));
  const ruleWord = (n: number) => H.homeAwayRuleValue(n);
  return (
    <HealthWindowFrame eyebrow={eyebrow} score={scored ? shown.score : null} tone={shown.tone} caption={caption}
      dirty={dirty} busy={saving}
      notice={saveError ? <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{saveError}</Callout> : null}
      onClose={onClose}>
      {scored && (
        <>
          <div className={ts.healthKpiGrid}>
            <Metric label={H.games} value={H.gamesValue(t.games.onPlan, t.games.teams)} detail={H.gamesDetail}
              tone={t.games.onPlan < t.games.teams ? 'warning' : 'good'} />
            <Metric label={H.homeAway} value={H.homeAwayValue(t.homeAway.off)} detail={H.homeAwayDetail(shown.rules.homeAwayTolerance)}
              tone={t.homeAway.off ? 'warning' : 'good'} />
            <Metric label={H.byes} value={t.byes.backToBack ? String(t.byes.backToBack) : H.byesSpread}
              detail={t.byes.backToBack ? H.byesDetail : H.byesNone} tone={t.byes.backToBack ? 'warning' : 'good'} />
            <Metric label={H.clashes} value={String(t.clashes.pairs)} detail={t.clashes.notChecked ? H.notChecked(t.clashes.notChecked) : H.allChecked}
              tone={t.clashes.pairs ? 'danger' : t.clashes.notChecked ? 'neutral' : 'good'} />
          </div>

          <div className={ts.healthIssues}>
            {said.length === 0 && <IssueRow issue={{ severity: 'info', title: '', detail: H.noIssues }} action={null} />}
            {shownIssues.map((x, i) => (
              <IssueRow key={i} issue={{ severity: x.tone, title: '', detail: x.text }} action={doorOf(x)} />
            ))}
            {shownIssues.length < said.length && (
              <p className={s.healthMore}>
                {H.more(said.length - shownIssues.length)}{' '}
                <button type="button" className={ts.healthIssueDoor} onClick={() => setAllIssues(true)}>{H.showAll}</button>
              </p>
            )}
          </div>

          {shown.teams.length > 0 && (
            <details ref={teamsRef} className={ts.healthDetails} open={teamsOpen} onToggle={e => setTeamsOpen(e.currentTarget.open)}>
              <summary className={ts.healthDetailsSummary}>{H.teamDetail}</summary>
              <div className={ts.healthTeamTableWrap}>
                <table className={ts.healthTeamTable}>
                  <thead>
                    <tr>
                      <th>{H.columns.team}</th><th>{H.columns.games}</th><th>{H.columns.homeAway}</th>
                      <th>{H.columns.byes}</th><th>{H.columns.primeTime}</th><th>{H.columns.places}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.teams.map(row => (
                      <tr key={row.teamId}>
                        <td>{row.name}</td>
                        <td>{H.gamesCell(row.have, row.plan, row.postponed)}</td>
                        <td>{row.home}–{row.away}</td>
                        <td>{row.byes}</td>
                        <td>{primeTimeCell(row.primeTime)}</td>
                        <td>{row.places}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {/* The rules the score uses, said; the door (whoever runs the season) opens them under it. */}
      <div className={`${ts.healthRulesFoot} ${s.healthRules}`}>
        <span>{H.rulesNote}</span>
        {!editing && (
          <dl className={s.healthRuleList}>
            {plans.length > 0 && (
              <div>
                <dt>{H.gamesPerTeam}</dt>
                <dd>{samePlan ? plans[0].games : plans.map(p => `${divisionName(p.divisionId)} ${p.games}`).join(' · ')}</dd>
              </div>
            )}
            <div><dt>{H.twice}</dt><dd>{saved.twiceInADayAllowed ? H.yes : H.no}</dd></div>
            <div><dt>{H.homeAwayRule}</dt><dd>{ruleWord(saved.homeAwayTolerance)}</dd></div>
          </dl>
        )}
        {!editing && plans.some(p => !p.set) && <span className={s.healthRuleHint}>{H.gamesPerTeamHint}</span>}
        {onSaveRules && <HealthRulesDoor label={H.adjust} open={editing} onToggle={toggle} />}
      </div>
      {onSaveRules && editing && (
        <HealthRulesEditor
          dirty={dirty} saving={saving} onSave={() => { void save(); }} onDiscard={() => setDraft(saved)}
          onRestore={() => setDraft(DEFAULT_LEAGUE_HEALTH_RULES)} scrollIntoView
          hint={divisionIds.length ? `${H.rulesLive} ${H.gamesPerTeamEmpty}` : H.rulesLive}
        >
          <label className={ts.healthRule}>
            <span>{H.twice}</span>
            <select value={draft.twiceInADayAllowed ? 'yes' : 'no'}
              onChange={e => setDraft(d => ({ ...d, twiceInADayAllowed: e.target.value === 'yes' }))}>
              <option value="no">{H.no}</option>
              <option value="yes">{H.yes}</option>
            </select>
          </label>
          <label className={ts.healthRule}>
            <span>{H.homeAwayRule}</span>
            <select value={draft.homeAwayTolerance}
              onChange={e => setDraft(d => ({ ...d, homeAwayTolerance: Number(e.target.value) }))}>
              {HOME_AWAY_TOLERANCES.map(n => <option key={n} value={n}>{ruleWord(n)}</option>)}
            </select>
          </label>
          {divisionIds.map(id => (
            <label key={id} className={ts.healthRule}>
              <span>{divisionIds.length === 1 ? H.gamesPerTeam : H.gamesPerTeamOf(divisionName(id))}</span>
              <input
                type="number" inputMode="numeric" min={1} max={GAMES_PER_TEAM_MAX}
                placeholder={scheduleOf.get(id) ? String(scheduleOf.get(id)) : undefined}
                value={draft.gamesPerTeam[id] ?? ''}
                onChange={e => setDraft(d => {
                  const n = parseInt(e.target.value, 10);
                  const next = { ...d.gamesPerTeam };
                  if (Number.isNaN(n)) delete next[id];
                  else next[id] = Math.max(1, Math.min(GAMES_PER_TEAM_MAX, n));
                  return { ...d, gamesPerTeam: next };
                })}
              />
            </label>
          ))}
        </HealthRulesEditor>
      )}
    </HealthWindowFrame>
  );
}
